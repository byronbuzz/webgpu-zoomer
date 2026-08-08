import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCamera,
  deserializeCamera,
  dyadic,
  floorAtLevel,
  serializeCamera,
  worldKey,
  zoomAbout,
} from "./index.js";
import { approximateDyadic } from "./approximate.js";

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

  it("serializes thousands-of-digits magnification without loss", () => {
    const camera = createCamera(dyadic(-3n, -2n), dyadic(1n, -4n), dyadic(1n, -20_000n), 9n);
    const encoded = serializeCamera(camera);
    expect(deserializeCamera(JSON.parse(JSON.stringify(encoded)))).toEqual(camera);
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
