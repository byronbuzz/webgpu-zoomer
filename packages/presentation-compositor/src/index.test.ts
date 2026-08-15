import { createCamera, dyadic, type WorldKey } from "@webgpu-zoomer/exact-camera";
import { evaluateShallowDirectPublication, type AcceptedSampleSnapshot } from "@webgpu-zoomer/numerical-contract";
import { createPresentationSnapshot } from "@webgpu-zoomer/presentation-snapshot";
import { planViewportSampleGrid } from "@webgpu-zoomer/view-planner";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareHistoryComposite, prepareSnapshotComposite } from "./index.js";
import { PresentationHistoryStore } from "@webgpu-zoomer/presentation-history";

function acceptedFor(key: WorldKey, epoch: bigint): AcceptedSampleSnapshot {
  const decision = evaluateShallowDirectPublication({
    identity: {
      formulaId: "mandelbrot",
      formulaVersion: 1,
      cRe: { numerator: (2n * key.x + 1n).toString(), exponent: (key.level - 1n).toString() },
      cIm: { numerator: (2n * key.y + 1n).toString(), exponent: (key.level - 1n).toString() },
      samplingVersion: key.samplingVersion,
    },
    requestEpoch: epoch,
    candidate: { status: "escaped", iterations: 2, reason: "gpu_candidate_only" },
    oracle: { status: "escaped", iterations: 2, reason: "escape_proved", workingPrecisionBits: 64 },
    methodVersion: "gpu-direct-f32-v1",
    oracleVersion: "exact-dyadic-v1",
  });
  if (!decision.accepted) throw new Error("Expected accepted fixture.");
  const { acceptedEpoch, ...sample } = decision.sample;
  return { ...sample, acceptedEpoch: acceptedEpoch.toString() };
}

function fixture() {
  const camera = createCamera(dyadic(0n, 0n), dyadic(0n, 0n), dyadic(1n, 0n), 3n);
  const plan = planViewportSampleGrid(camera, {
    formulaId: "mandelbrot",
    formulaVersion: 1,
    samplingVersion: 1,
    samplesPerAxis: 2,
    maximumSamples: 16,
    viewportWidth: 400,
    viewportHeight: 400,
  });
  const snapshot = createPresentationSnapshot({
    plan,
    acceptedSamples: plan.samples.slice(0, 2).map((key) => acceptedFor(key, camera.epoch)),
    unresolvedCoverage: plan.samples.slice(2).map((key) => ({ key, reason: "not_published" as const })),
  });
  return { camera, plan, snapshot };
}

describe("current-view presentation compositor", () => {
  it("prepares bounded f32 instances with explicit accepted and unresolved sources", () => {
    const { camera, snapshot } = fixture();
    const prepared = prepareSnapshotComposite(snapshot, camera, 400, 400);
    expect(prepared).toMatchObject({
      accepted: true,
      checksum: snapshot.checksum,
      cellCount: 4,
      acceptedCount: 2,
      unresolvedCount: 2,
      transformErrorLimitPx: 0.25,
    });
    if (!prepared.accepted) throw new Error("Expected accepted composite.");
    expect([...prepared.instances.slice(0, 8)]).toEqual([-1, 0, 0, 1, 2, 0, 0, 0]);
    expect([...prepared.instances.slice(-8)]).toEqual([0, -1, 1, 0, 0, 1, 0, 0]);
  });

  it("drops camera and viewport mismatches instead of reprojecting invalid history", () => {
    const { camera, snapshot } = fixture();
    const newerCamera = createCamera(camera.centerX, camera.centerY, dyadic(1n, -1n), 4n);
    expect(prepareSnapshotComposite(snapshot, newerCamera, 400, 400)).toEqual({
      accepted: false,
      reason: "camera_mismatch",
    });
    expect(prepareSnapshotComposite(snapshot, camera, 401, 400)).toEqual({
      accepted: false,
      reason: "viewport_mismatch",
    });
  });

  it("fails extreme transforms and malformed coverage conservatively", () => {
    const { camera, snapshot } = fixture();
    expect(prepareSnapshotComposite({ ...snapshot, counts: { total: 4, accepted: 4, unresolved: 1 } }, camera, 400, 400))
      .toEqual({ accepted: false, reason: "invalid_snapshot" });
    const deepCamera = createCamera(dyadic(0n, 0n), dyadic(0n, 0n), dyadic(1n, -20000n), 9n);
    const deepPlan = planViewportSampleGrid(deepCamera, {
      formulaId: "mandelbrot",
      formulaVersion: 1,
      samplingVersion: 1,
      samplesPerAxis: 2,
      maximumSamples: 16,
      viewportWidth: 400,
      viewportHeight: 400,
    });
    const deepSnapshot = createPresentationSnapshot({
      plan: deepPlan,
      acceptedSamples: [],
      unresolvedCoverage: deepPlan.samples.map((key) => ({ key, reason: "pending" as const })),
    });
    expect(prepareSnapshotComposite(deepSnapshot, deepCamera, 400, 400)).toEqual({
      accepted: false,
      reason: "precision_limit",
    });
  });

  it("renders selected bounded history against the target camera without permitting an unselected transform", () => {
    const { snapshot } = fixture();
    const history = new PresentationHistoryStore(2);
    history.publish(snapshot);
    const target = createCamera(dyadic(1n, -2n), dyadic(0n, 0n), dyadic(1n, -1n), 4n);
    const selection = history.select(target, 400, 400);
    expect(selection.selected).toBe(true);
    if (!selection.selected) throw new Error("Expected bounded history selection.");
    const prepared = prepareHistoryComposite(selection.frame, selection.reprojection, target, 400, 400);
    expect(prepared).toMatchObject({
      accepted: true,
      historyFrameId: selection.frame.frameId,
      reprojection: { kind: "limited_dyadic_pan_zoom_v1", targetScaleExponentDelta: "-1" },
      cellCount: 4,
    });
    expect(prepareHistoryComposite(selection.frame, undefined, target, 400, 400)).toEqual({
      accepted: false,
      reason: "camera_mismatch",
    });
    expect(prepareHistoryComposite(selection.frame, {
      ...selection.reprojection!,
      targetScaleExponentDelta: "0",
    }, target, 400, 400)).toEqual({
      accepted: false,
      reason: "camera_mismatch",
    });
  });

  it("has no import path from compositor resources into authority packages", () => {
    for (const source of [
      "packages/exact-camera/src/index.ts",
      "packages/view-planner/src/index.ts",
      "packages/numerical-contract/src/index.ts",
      "packages/numerical-work/src/index.ts",
      "packages/gpu-engine/src/index.ts",
      "packages/presentation-snapshot/src/index.ts",
    ]) {
      expect(readFileSync(resolve(source), "utf8")).not.toContain("@webgpu-zoomer/presentation-compositor");
    }
  });
});
