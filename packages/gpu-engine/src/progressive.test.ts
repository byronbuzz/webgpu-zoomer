import { describe, expect, it } from "vitest";
import {
  maximumProgressiveIterations,
  nextProgressiveIterationFrontier,
  perturbationPreviewIterationCap,
} from "./index.js";

describe("progressive convergence policy", () => {
  it("advances toward the semantic iteration target in bounded quanta", () => {
    const frontiers: number[] = [];
    let frontier = 0;
    while (frontier < 150) {
      frontier = nextProgressiveIterationFrontier(frontier, 150);
      frontiers.push(frontier);
    }
    expect(frontiers).toEqual([64, 128, 150]);
  });

  it("supports the complete selected range without a 320/512 product ceiling", () => {
    expect(nextProgressiveIterationFrontier(49_984, maximumProgressiveIterations)).toBe(50_000);
    expect(perturbationPreviewIterationCap(8)).toBe(8);
    expect(perturbationPreviewIterationCap(50_000)).toBe(512);
  });

  it("rejects invalid iteration targets", () => {
    expect(() => nextProgressiveIterationFrontier(0, 0)).toThrow(RangeError);
    expect(() => nextProgressiveIterationFrontier(0, 50_001)).toThrow(RangeError);
    expect(() => perturbationPreviewIterationCap(Number.NaN)).toThrow(RangeError);
  });
});
