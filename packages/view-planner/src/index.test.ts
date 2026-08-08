import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCamera, deserializeCamera, dyadic, serializeCamera, zoomAbout } from "@webgpu-zoomer/exact-camera";
import { describe, expect, it } from "vitest";
import {
  SamplePlanBudgetExceeded,
  planSquareSampleGrid,
  replaySamplePlan,
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
