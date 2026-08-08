import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCamera, deserializeCamera, dyadic, serializeCamera, zoomAbout } from "@webgpu-zoomer/exact-camera";
import { describe, expect, it } from "vitest";
import {
  SamplePlanBudgetExceeded,
  planSquareSampleGrid,
  planViewportSampleGrid,
  replaySamplePlan,
  replayViewportSamplePlan,
  serializeSamplePlan,
  type SamplePlanOptions,
} from "./index.js";

const options: SamplePlanOptions = {
  formulaId: "mandelbrot",
  formulaVersion: 1,
  samplingVersion: 1,
  samplesPerAxis: 8,
  maximumSamples: 256,
};

describe("canonical square sample planning", () => {
  it("covers the exact shallow camera with deterministic negative-quadrant keys", () => {
    const camera = createCamera(dyadic(-1n, -1n), dyadic(0n, 0n), dyadic(11n, -2n));
    const plan = planSquareSampleGrid(camera, options);
    expect(plan.level).toBe(-2n);
    expect(plan.bounds).toEqual({ minX: -8n, maxX: 3n, minY: -6n, maxY: 5n });
    expect(plan.samples).toHaveLength(144);
    expect(plan.samples[0]).toEqual({ formulaId: "mandelbrot", level: -2n, x: -8n, y: -6n, samplingVersion: 1 });
    expect(plan.samples.at(-1)).toEqual({ formulaId: "mandelbrot", level: -2n, x: 3n, y: 5n, samplingVersion: 1 });
    expect(plan.checksum).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(plan.checksum).toBe("fnv1a64:3cd55c4427a37a3f");
  });

  it("replays byte-identically from serialized exact camera state", () => {
    const camera = createCamera(dyadic(-9n, -4n), dyadic(3n, -5n), dyadic(1n, -20000n), 27n);
    const plan = planSquareSampleGrid(camera, options);
    const serialized = serializeSamplePlan(plan);
    expect(serializeSamplePlan(replaySamplePlan(JSON.parse(JSON.stringify(serialized)), options))).toEqual(serialized);
    expect(plan.level).toBe(-20003n);
  });

  it("keeps world identity stable while request epoch changes", () => {
    const camera = createCamera(dyadic(-3n, -3n), dyadic(5n, -4n), dyadic(1n, -100n), 4n);
    const newer = createCamera(camera.centerX, camera.centerY, camera.viewportScale, 5n);
    const first = planSquareSampleGrid(camera, options);
    const second = planSquareSampleGrid(newer, options);
    expect(second.requestEpoch).toBe(5n);
    expect(second.planId).not.toBe(first.planId);
    expect(second.samples).toEqual(first.samples);
  });

  it("is independent of inverse zoom history", () => {
    const camera = createCamera(dyadic(-7n, -4n), dyadic(9n, -5n), dyadic(3n, -120n));
    const focusX = dyadic(5n, -4n);
    const focusY = dyadic(-3n, -4n);
    const roundTrip = zoomAbout(zoomAbout(camera, focusX, focusY, -17n), focusX, focusY, 17n);
    const normalizedRoundTrip = createCamera(
      roundTrip.centerX,
      roundTrip.centerY,
      roundTrip.viewportScale,
      camera.epoch,
    );
    expect(serializeSamplePlan(planSquareSampleGrid(normalizedRoundTrip, options)))
      .toEqual(serializeSamplePlan(planSquareSampleGrid(camera, options)));
  });

  it("rejects over-budget demand before allocating samples", () => {
    const camera = createCamera(dyadic(0n, 0n), dyadic(0n, 0n), dyadic(15n, -1n));
    expect(() => planSquareSampleGrid(camera, { ...options, maximumSamples: 64 }))
      .toThrow(SamplePlanBudgetExceeded);
  });

  it("does not reconstruct exact camera authority through binary64", () => {
    const source = readFileSync(resolve("packages/view-planner/src/index.ts"), "utf8");
    expect(source).not.toMatch(/(?:center|viewportScale).*\bNumber\s*\(/);
    const camera = createCamera(dyadic(1n, -20000n), dyadic(-1n, -20001n), dyadic(1n, -20020n));
    expect(deserializeCamera(serializeCamera(camera))).toEqual(camera);
    expect(() => planSquareSampleGrid(camera, options)).not.toThrow();
  });
});

describe("exact integer-aspect viewport planning", () => {
  it("covers a 16:9 domain with exact rational horizontal bounds", () => {
    const camera = createCamera(dyadic(-1n, -1n), dyadic(0n, 0n), dyadic(11n, -2n));
    const plan = planViewportSampleGrid(camera, {
      ...options,
      viewportWidth: 16,
      viewportHeight: 9,
    });
    expect(plan.domain).toEqual({ kind: "integer-aspect", version: 1, width: 16, height: 9 });
    expect(plan.level).toBe(-2n);
    expect(plan.bounds).toEqual({ minX: -12n, maxX: 7n, minY: -6n, maxY: 5n });
    expect(plan.samples).toHaveLength(240);
  });

  it("preserves world keys for equivalent aspect ratios while versioning dimensions", () => {
    const camera = createCamera(dyadic(-5n, -4n), dyadic(3n, -5n), dyadic(7n, -8n), 9n);
    const small = planViewportSampleGrid(camera, { ...options, maximumSamples: 512, viewportWidth: 16, viewportHeight: 9 });
    const large = planViewportSampleGrid(camera, { ...options, maximumSamples: 512, viewportWidth: 1600, viewportHeight: 900 });
    expect(large.samples).toEqual(small.samples);
    expect(large.planId).not.toBe(small.planId);
  });

  it("replays exactly at extreme depth and rejects insufficient viewport budgets", () => {
    const camera = createCamera(dyadic(-1n, -20000n), dyadic(1n, -20001n), dyadic(1n, -20020n), 12n);
    const viewportOptions = { ...options, maximumSamples: 512, viewportWidth: 21, viewportHeight: 9 };
    const plan = planViewportSampleGrid(camera, viewportOptions);
    const serialized = serializeSamplePlan(plan);
    expect(serializeSamplePlan(replayViewportSamplePlan(
      JSON.parse(JSON.stringify(serialized)),
      viewportOptions,
    ))).toEqual(serialized);
    expect(plan.level).toBe(-20023n);
    expect(() => planViewportSampleGrid(camera, { ...viewportOptions, maximumSamples: 32 }))
      .toThrow(SamplePlanBudgetExceeded);
  });

  it("uses mathematical floor and ceiling across negative fractional boundaries", () => {
    const camera = createCamera(dyadic(-17n, -5n), dyadic(-1n, -3n), dyadic(3n, -3n));
    const plan = planViewportSampleGrid(camera, {
      ...options,
      viewportWidth: 3,
      viewportHeight: 2,
    });
    expect(plan.samples[0]!.x).toBe(plan.bounds.minX);
    expect(plan.samples[0]!.y).toBe(plan.bounds.minY);
    expect(plan.bounds.minX).toBeLessThan(0n);
    expect(plan.bounds.minY).toBeLessThan(0n);
  });
});
