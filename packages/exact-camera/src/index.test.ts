import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  add,
  createCamera,
  multiply,
  deserializeCamera,
  dyadic,
  floorAtLevel,
  interpolateOctaveScale,
  serializeCamera,
  worldKey,
  zoomAbout,
  zoomAboutScale,
} from "./index.js";
import { approximateDyadic, boundedPositiveDyadic } from "./approximate.js";

function generator(seed: bigint): () => bigint {
  let state = seed;
  return () => {
    state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return state;
  };
}

describe("exact dyadic camera", () => {
  it("round-trips inverse power-of-two zooms at extreme exponents", () => {
    const next = generator(0x5eedn);
    for (let index = 0; index < 500; index += 1) {
      const exponent = (next() % 20_001n) - 10_000n;
      const x = dyadic(BigInt.asIntN(64, next()) | 1n, exponent);
      const y = dyadic(BigInt.asIntN(64, next()) | 1n, exponent - 17n);
      const scale = dyadic((next() | 1n) & ((1n << 63n) - 1n), exponent - 300n);
      const focusX = dyadic(BigInt.asIntN(32, next()), -31n);
      const focusY = dyadic(BigInt.asIntN(32, next()), -31n);
      const camera = createCamera(x, y, scale);
      const inward = zoomAbout(camera, focusX, focusY, -37n);
      const roundTrip = zoomAbout(inward, focusX, focusY, 37n);
      expect(roundTrip.centerX).toEqual(camera.centerX);
      expect(roundTrip.centerY).toEqual(camera.centerY);
      expect(roundTrip.viewportScale).toEqual(camera.viewportScale);
    }
  });

  it("interpolates a continuous octave with bigint arithmetic and exact focus", () => {
    const camera = createCamera(dyadic(-1n, -1n), dyadic(0n, 0n), dyadic(11n, -2n));
    const focusX = dyadic(1n, -3n);
    const focusY = dyadic(-3n, -4n);
    const quarter = interpolateOctaveScale(camera.viewportScale, 1n, 2n, -1n);
    const half = interpolateOctaveScale(camera.viewportScale, 2n, 2n, -1n);
    const endpoint = interpolateOctaveScale(camera.viewportScale, 4n, 2n, -1n);
    const outwardQuarter = interpolateOctaveScale(camera.viewportScale, 1n, 2n, 1n);
    const outwardHalf = interpolateOctaveScale(camera.viewportScale, 2n, 2n, 1n);
    const outwardEndpoint = interpolateOctaveScale(camera.viewportScale, 4n, 2n, 1n);
    expect(approximateDyadic(quarter)!.value).toBeGreaterThan(approximateDyadic(half)!.value);
    expect(approximateDyadic(outwardQuarter)!.value).toBeLessThan(approximateDyadic(outwardHalf)!.value);
    expect(endpoint).toEqual(dyadic(11n, -3n));
    expect(outwardEndpoint).toEqual(dyadic(11n, -1n));
    const moved = zoomAboutScale(camera, focusX, focusY, quarter);
    expect(add(moved.centerX, multiply(focusX, moved.viewportScale)))
      .toEqual(add(camera.centerX, multiply(focusX, camera.viewportScale)));
    expect(add(moved.centerY, multiply(focusY, moved.viewportScale)))
      .toEqual(add(camera.centerY, multiply(focusY, camera.viewportScale)));
  });

  it("serializes thousands-of-digits magnification without loss", () => {
    const camera = createCamera(dyadic(-3n, -2n), dyadic(1n, -4n), dyadic(1n, -20_000n), 9n);
    const encoded = serializeCamera(camera);
    expect(deserializeCamera(JSON.parse(JSON.stringify(encoded)))).toEqual(camera);
  });

  it("decomposes scale beyond binary64 range without losing its bigint exponent", () => {
    expect(boundedPositiveDyadic(dyadic(11n, -2n))).toEqual({
      significand: 1.375,
      binaryExponent: 1n,
      significandError: 0,
    });
    expect(boundedPositiveDyadic({ numerator: 22n, exponent: -3n })).toEqual({
      significand: 1.375,
      binaryExponent: 1n,
      significandError: 0,
    });
    expect(boundedPositiveDyadic(dyadic(11n, -20_004n))).toEqual({
      significand: 1.375,
      binaryExponent: -20_001n,
      significandError: 0,
    });
    expect(boundedPositiveDyadic(dyadic((1n << 80n) + 3n, -20_000n), 8)).toEqual({
      significand: 1,
      binaryExponent: -19_920n,
      significandError: 1 / 128,
    });
    expect(boundedPositiveDyadic(dyadic(0n, -20_000n))).toBeNull();
    expect(boundedPositiveDyadic(dyadic(-1n, -20_000n))).toBeNull();
  });

  it("uses mathematical floor in negative quadrants", () => {
    expect(floorAtLevel(dyadic(-1n, -1n), 0n)).toBe(-1n);
    expect(floorAtLevel(dyadic(-3n, -1n), 0n)).toBe(-2n);
    const a = worldKey("mandelbrot", -4n, dyadic(-17n, -5n), dyadic(31n, -6n));
    const b = worldKey("mandelbrot", -4n, dyadic(-34n, -6n), dyadic(62n, -7n));
    expect(a).toEqual(b);
  });

  it("contains no binary64 reconstruction in the authoritative module", () => {
    const source = readFileSync(resolve("packages/exact-camera/src/index.ts"), "utf8");
    expect(source).not.toMatch(/\b(?:Number|parseFloat|Math)\s*\(/);
  });

  it("derives bounded presentation numbers without reconstructing authority", () => {
    const exact = dyadic((1n << 60n) + 1n, -60n);
    const approximate = approximateDyadic(exact);
    expect(approximate).not.toBeNull();
    expect(approximate!.value).toBe(1);
    expect(approximate!.absoluteError).toBeGreaterThanOrEqual(2 ** -60);
    expect(approximateDyadic(dyadic(1n, -20_000n))).toBeNull();
  });
});
