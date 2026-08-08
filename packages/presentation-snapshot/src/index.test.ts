import { createCamera, dyadic } from "@webgpu-zoomer/exact-camera";
import { evaluateShallowDirectPublication, type AcceptedSampleSnapshot } from "@webgpu-zoomer/numerical-contract";
import { planSquareSampleGrid } from "@webgpu-zoomer/view-planner";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createPresentationSnapshot } from "./index.js";

function plan(epoch = 3n) {
  return planSquareSampleGrid(
    createCamera(dyadic(0n, 0n), dyadic(0n, 0n), dyadic(1n, 0n), epoch),
    { formulaId: "mandelbrot", formulaVersion: 1, samplingVersion: 1, samplesPerAxis: 2, maximumSamples: 16 },
  );
}

function acceptedFor(key: ReturnType<typeof plan>["samples"][number], epoch = 3n): AcceptedSampleSnapshot {
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

describe("one-way presentation snapshots", () => {
  it("requires total accepted or explicit unresolved coverage in plan order", () => {
    const sourcePlan = plan();
    const acceptedSamples = sourcePlan.samples.slice(0, 2).map((key) => acceptedFor(key));
    const acceptedBefore = JSON.stringify(acceptedSamples);
    const snapshot = createPresentationSnapshot({
      plan: sourcePlan,
      acceptedSamples,
      unresolvedCoverage: sourcePlan.samples.slice(2).map((key) => ({ key, reason: "not_published" as const })),
    });
    expect(snapshot).toMatchObject({
      authority: "presentation-only",
      sourcePlanId: sourcePlan.planId,
      requestEpoch: "3",
      counts: { total: 4, accepted: 2, unresolved: 2 },
    });
    expect(snapshot.cells.map((cell) => cell.source)).toEqual(["accepted", "accepted", "unresolved", "unresolved"]);
    expect(snapshot.snapshotId).toBe(`presentation-snapshot:${snapshot.checksum}`);
    expect(snapshot.checksum).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.getOwnPropertySymbols(snapshot)).toHaveLength(0);
    expect(JSON.stringify(acceptedSamples)).toBe(acceptedBefore);
  });

  it("is deterministic and exact at extreme camera exponents", () => {
    const sourcePlan = planSquareSampleGrid(
      createCamera(dyadic(1n, -20000n), dyadic(-1n, -20001n), dyadic(1n, -20000n), 7n),
      { formulaId: "mandelbrot", formulaVersion: 1, samplingVersion: 1, samplesPerAxis: 2, maximumSamples: 16 },
    );
    const input = {
      plan: sourcePlan,
      acceptedSamples: [] as AcceptedSampleSnapshot[],
      unresolvedCoverage: sourcePlan.samples.map((key) => ({ key, reason: "pending" as const })),
    };
    expect(createPresentationSnapshot(input)).toEqual(createPresentationSnapshot(input));
    expect(createPresentationSnapshot(input).camera.viewportScale).toEqual({ numerator: "1", exponent: "-20000" });
  });

  it("rejects incomplete, overlapping, foreign, and stale coverage", () => {
    const sourcePlan = plan();
    const accepted = acceptedFor(sourcePlan.samples[0]!);
    expect(() => createPresentationSnapshot({ plan: sourcePlan, acceptedSamples: [accepted], unresolvedCoverage: [] }))
      .toThrow(/total accepted or explicit unresolved coverage/);
    expect(() => createPresentationSnapshot({
      plan: sourcePlan,
      acceptedSamples: [accepted],
      unresolvedCoverage: sourcePlan.samples.map((key) => ({ key, reason: "not_published" as const })),
    })).toThrow(/overlap/);
    expect(() => createPresentationSnapshot({
      plan: sourcePlan,
      acceptedSamples: [{ ...accepted, acceptedEpoch: "2" }],
      unresolvedCoverage: sourcePlan.samples.slice(1).map((key) => ({ key, reason: "not_published" as const })),
    })).toThrow(/stale accepted/);
    const foreign = { ...sourcePlan.samples[1]!, x: 100n };
    expect(() => createPresentationSnapshot({
      plan: sourcePlan,
      acceptedSamples: [accepted],
      unresolvedCoverage: [
        ...sourcePlan.samples.slice(1, -1).map((key) => ({ key, reason: "not_published" as const })),
        { key: foreign, reason: "not_published" as const },
      ],
    })).toThrow(/outside/);
  });

  it("has no upstream dependency path into numerical or navigation authority", () => {
    for (const source of [
      "packages/exact-camera/src/index.ts",
      "packages/view-planner/src/index.ts",
      "packages/numerical-contract/src/index.ts",
      "packages/numerical-work/src/index.ts",
      "packages/gpu-engine/src/index.ts",
    ]) {
      expect(readFileSync(resolve(source), "utf8")).not.toContain("@webgpu-zoomer/presentation-snapshot");
    }
  });
});
