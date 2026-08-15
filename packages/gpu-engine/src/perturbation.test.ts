import { describe, expect, it } from "vitest";
import { createPerturbationPreviewView } from "./index.js";

describe("bounded perturbation preview transport", () => {
  it("creates finite high/low reference transport for the recorded deep-zoom aim", () => {
    const view = createPerturbationPreviewView({
      centerX: -0.777120613150274923773,
      centerY: 0.126857238786361887169,
      viewportScale: 2 ** -22,
      iterationCap: 320,
    });
    expect(view).toBeDefined();
    expect(view).toMatchObject({
      kind: "perturbation",
      iterationCap: 320,
      glitchThreshold: 0.25,
      transportLimit: 2 ** -40,
    });
    expect(view!.transportError).toBeLessThanOrEqual(view!.transportLimit);
    expect(view!.referenceOrbit).toHaveLength(321 * 4);
    expect([...view!.referenceOrbit].every(Number.isFinite)).toBe(true);
    expect(view!.referenceOrbit.slice(0, 4)).toEqual(new Float32Array([0, 0, 0, 0]));
  });

  it("rejects invalid, oversized, and non-finite reference requests before allocation", () => {
    expect(createPerturbationPreviewView({
      centerX: 0,
      centerY: 0,
      viewportScale: 1,
      iterationCap: 513,
    })).toBeUndefined();
    expect(createPerturbationPreviewView({
      centerX: Number.POSITIVE_INFINITY,
      centerY: 0,
      viewportScale: 1,
    })).toBeUndefined();
    expect(createPerturbationPreviewView({
      centerX: 0,
      centerY: 0,
      viewportScale: 0,
    })).toBeUndefined();
    expect(createPerturbationPreviewView({
      centerX: 0,
      centerY: 0,
      viewportScale: 1,
      referenceOffsetX: 0.251,
    })).toBeUndefined();
    expect(createPerturbationPreviewView({
      centerX: 0,
      centerY: 0,
      viewportScale: 1,
      transportErrorLimit: 2 ** -39,
    })).toBeUndefined();
  });
});