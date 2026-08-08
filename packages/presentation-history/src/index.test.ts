import { createCamera, dyadic, type ExactCamera, type WorldKey } from "@webgpu-zoomer/exact-camera";
import { evaluateShallowDirectPublication, type AcceptedSampleSnapshot } from "@webgpu-zoomer/numerical-contract";
import { createPresentationSnapshot } from "@webgpu-zoomer/presentation-snapshot";
import { planViewportSampleGrid } from "@webgpu-zoomer/view-planner";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PresentationHistoryStore } from "./index.js";

function acceptedFor(key: WorldKey, epoch: bigint, formulaVersion = 1): AcceptedSampleSnapshot {
  const decision = evaluateShallowDirectPublication({
    identity: {
      formulaId: "mandelbrot",
      formulaVersion,
      cRe: { numerator: (2n * key.x + 1n).toString(), exponent: (key.level - 1n).toString() },
      cIm: { numerator: (2n * key.y + 1n).toString(), exponent: (key.level - 1n).toString() },
      samplingVersion: key.samplingVersion,
    },
    requestEpoch: epoch,
    candidate: { status: "escaped", iterations: Number(epoch) + 1, reason: "gpu_candidate_only" },
    oracle: { status: "escaped", iterations: Number(epoch) + 1, reason: "escape_proved", workingPrecisionBits: 64 },
    methodVersion: "gpu-direct-f32-v1",
    oracleVersion: "exact-dyadic-v1",
  });
  if (!decision.accepted) throw new Error("Expected accepted fixture.");
  const { acceptedEpoch, ...sample } = decision.sample;
  return { ...sample, acceptedEpoch: acceptedEpoch.toString() };
}

function snapshot(camera: ExactCamera, acceptedIndexes: readonly number[], formulaVersion = 1) {
  const plan = planViewportSampleGrid(camera, {
    formulaId: "mandelbrot",
    formulaVersion,
    samplingVersion: 1,
    samplesPerAxis: 2,
    maximumSamples: 16,
    viewportWidth: 400,
    viewportHeight: 400,
  });
  const accepted = new Set(acceptedIndexes);
  return createPresentationSnapshot({
    plan,
    acceptedSamples: plan.samples.flatMap((key, index) => accepted.has(index)
      ? [acceptedFor(key, camera.epoch, formulaVersion)]
      : []),
    unresolvedCoverage: plan.samples.flatMap((key, index) => accepted.has(index)
      ? []
      : [{ key, reason: "not_published" as const }]),
  });
}

function camera(epoch: bigint, center = 0n): ExactCamera {
  return createCamera(dyadic(center, -2n), dyadic(0n, 0n), dyadic(1n, 0n), epoch);
}

describe("bounded presentation history", () => {
  it("monotonically merges newer accepted coverage without regressing accepted cells", () => {
    const history = new PresentationHistoryStore(2);
    const older = snapshot(camera(1n), [0]);
    const newer = snapshot(camera(2n), [1]);
    expect(history.publish(older)).toMatchObject({ status: "inserted", reason: "accepted" });
    expect(history.publish(newer)).toMatchObject({ status: "merged", reason: "accepted" });
    const frame = history.snapshot()[0]!;
    expect(frame.counts).toEqual({ total: 4, accepted: 2, unresolved: 2 });
    expect(frame.cells[0]).toMatchObject({ source: "accepted", sourceSnapshotId: older.snapshotId, sourceEpoch: "1" });
    expect(frame.cells[1]).toMatchObject({ source: "accepted", sourceSnapshotId: newer.snapshotId, sourceEpoch: "2" });
    expect(frame.latestSnapshotId).toBe(newer.snapshotId);
    expect(frame.requestEpoch).toBe("2");
  });

  it("rejects stale and same-epoch conflicting snapshots without resurrecting them", () => {
    const history = new PresentationHistoryStore(2);
    const current = snapshot(camera(3n), [0, 1]);
    const conflict = snapshot(camera(3n), [2]);
    const stale = snapshot(camera(2n), [3]);
    history.publish(current);
    expect(history.publish(conflict)).toMatchObject({ status: "rejected", reason: "conflict" });
    expect(history.publish(stale)).toMatchObject({ status: "rejected", reason: "stale_epoch" });
    expect(history.snapshot()[0]!.latestSnapshotId).toBe(current.snapshotId);
    expect(history.diagnostics()).toMatchObject({ staleSnapshots: 1, conflicts: 1 });
  });

  it("evicts the oldest view deterministically at its explicit capacity", () => {
    const history = new PresentationHistoryStore(2);
    const first = history.publish(snapshot(camera(1n, 0n), [0]));
    const second = history.publish(snapshot(camera(2n, 1n), [0]));
    const third = history.publish(snapshot(camera(3n, 2n), [0]));
    expect(first.status).toBe("inserted");
    expect(second.status).toBe("inserted");
    expect(third).toMatchObject({ status: "inserted", evictedViewKey: first.viewKey });
    expect(history.diagnostics()).toMatchObject({ maximumViews: 2, residentViews: 2, evictedViews: 1 });
    expect(history.snapshot().map((frame) => frame.viewKey)).not.toContain(first.viewKey);
  });

  it("keeps formula versions in distinct presentation-view identities", () => {
    const history = new PresentationHistoryStore(2);
    const sourceCamera = camera(1n);
    const first = history.publish(snapshot(sourceCamera, [0], 1));
    const second = history.publish(snapshot(sourceCamera, [0], 2));
    expect(first.status).toBe("inserted");
    expect(second.status).toBe("inserted");
    expect(second.viewKey).not.toBe(first.viewKey);
    expect(history.diagnostics().residentViews).toBe(2);
  });

  it("selects exact spatial history and rejects unproven transforms or viewport changes", () => {
    const history = new PresentationHistoryStore(2);
    const sourceCamera = camera(1n);
    history.publish(snapshot(sourceCamera, [0]));
    const sameSpatialNewEpoch = camera(9n);
    const selected = history.select(sameSpatialNewEpoch, 400, 400);
    expect(selected.selected).toBe(true);
    if (!selected.selected) throw new Error("Expected exact spatial history selection.");
    expect(selected.frame.requestEpoch).toBe("1");
    expect(history.select(createCamera(sourceCamera.centerX, sourceCamera.centerY, dyadic(1n, -1n), 2n), 400, 400))
      .toEqual({ selected: false, reason: "invalid_transform" });
    expect(history.select(sameSpatialNewEpoch, 401, 400))
      .toEqual({ selected: false, reason: "viewport_mismatch" });
  });

  it("has no history import path into camera, planning, numerical, snapshot, or GPU authority", () => {
    for (const source of [
      "packages/exact-camera/src/index.ts",
      "packages/view-planner/src/index.ts",
      "packages/numerical-contract/src/index.ts",
      "packages/numerical-work/src/index.ts",
      "packages/gpu-engine/src/index.ts",
      "packages/presentation-snapshot/src/index.ts",
    ]) {
      expect(readFileSync(resolve(source), "utf8")).not.toContain("@webgpu-zoomer/presentation-history");
    }
  });
});
