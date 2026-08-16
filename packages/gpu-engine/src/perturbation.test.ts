import { describe, expect, it } from "vitest";
import { createPerturbationPreviewView, perturbationPreviewIterationCap } from "./index.js";

const targetReal = -0.777120613150274923773;
const targetImaginary = 0.126857238786361887169;
const targetScale = 2 ** -22;
const atlasReferences = Array.from({ length: 9 }, (_, referenceIndex) => ({
  centerX: targetReal + (referenceIndex % 3 - 1) * targetScale / 3,
  centerY: targetImaginary + (1 - Math.floor(referenceIndex / 3)) * targetScale / 3,
}));

describe("bounded perturbation preview transport", () => {
  it("creates a finite fixed 3x3 reference transport for the recorded deep-zoom aim", () => {
    const view = createPerturbationPreviewView({
      centerX: targetReal,
      centerY: targetImaginary,
      viewportScale: targetScale,
      iterationCap: 320,
      referenceCoordinates: atlasReferences,
    });
    expect(view).toBeDefined();
    expect(view).toMatchObject({
      kind: "perturbation",
      iterationCap: 320,
      glitchThreshold: 0.25,
      previewMode: "bounded-f64-reference-atlas-3x3-compensated-ds-v1",
      atlasColumns: 3,
      atlasRows: 3,
      transportLimit: 2 ** -40,
    });
    expect(view!.transportError).toBeLessThanOrEqual(view!.transportLimit);
    const orbitLength = 513 * 4;
    expect(view!.referenceOrbit).toHaveLength(9 * orbitLength);
    expect([...view!.referenceOrbit].every(Number.isFinite)).toBe(true);
    expect(view!.referenceOrbit.slice(0, 4)).toEqual(new Float32Array([0, 0, 0, 0]));
    const firstReference = atlasReferences[0]!;
    expect(view!.referenceOrbit.slice(4, 8)).toEqual(new Float32Array([
      Math.fround(firstReference.centerX),
      Math.fround(firstReference.centerX - Math.fround(firstReference.centerX)),
      Math.fround(firstReference.centerY),
      Math.fround(firstReference.centerY - Math.fround(firstReference.centerY)),
    ]));
    expect(view!.referenceOrbit.slice(8 * orbitLength + 4, 8 * orbitLength + 8)).not.toEqual(view!.referenceOrbit.slice(4, 8));
  });

  it("selects the bounded deep iteration tier without changing the maximum allocation", () => {
    expect(perturbationPreviewIterationCap(2 ** -19)).toBe(320);
    expect(perturbationPreviewIterationCap(2 ** -22)).toBe(512);
  });

  it("rejects invalid, oversized, and non-finite atlas requests before allocation", () => {
    expect(createPerturbationPreviewView({ centerX: 0, centerY: 0, viewportScale: 1, iterationCap: 513 })).toBeUndefined();
    expect(createPerturbationPreviewView({ centerX: Number.POSITIVE_INFINITY, centerY: 0, viewportScale: 1 })).toBeUndefined();
    expect(createPerturbationPreviewView({ centerX: 0, centerY: 0, viewportScale: 0 })).toBeUndefined();
    expect(createPerturbationPreviewView({ centerX: 0, centerY: 0, viewportScale: 1, referenceCoordinates: [] })).toBeUndefined();
    expect(createPerturbationPreviewView({
      centerX: 0,
      centerY: 0,
      viewportScale: 1,
      referenceCoordinates: Array.from({ length: 9 }, () => ({ centerX: Number.NaN, centerY: 0 })),
    })).toBeUndefined();
    expect(createPerturbationPreviewView({ centerX: 0, centerY: 0, viewportScale: 1, transportErrorLimit: 2 ** -39 })).toBeUndefined();
  });
});
