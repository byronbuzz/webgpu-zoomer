import { describe, expect, it } from "vitest";
import { compareGpuCandidate } from "./index.js";

describe("conservative publication", () => {
  it("accepts only an escaped candidate with matching oracle iteration", () => {
    expect(compareGpuCandidate(
      { status: "escaped", iterations: 3, reason: "gpu_candidate_only" },
      { status: "escaped", iterations: 3, reason: "escape_proved", workingPrecisionBits: 64 },
    ).accepted).toBe(true);
  });

  it("fails an intentional insufficient-bound candidate safely", () => {
    expect(compareGpuCandidate(
      { status: "escaped", iterations: 2, reason: "gpu_candidate_only" },
      { status: "unresolved", iterations: 0, reason: "insufficient_precision", workingPrecisionBits: 32 },
    )).toEqual({ accepted: false, publishedStatus: "unresolved", reason: "comparison_mismatch" });
  });

  it("never promotes cap exhaustion to interior", () => {
    expect(compareGpuCandidate(
      { status: "unresolved", iterations: 100, reason: "gpu_candidate_only" },
      { status: "unresolved", iterations: 100, reason: "iteration_budget_exhausted", workingPrecisionBits: 128 },
    ).publishedStatus).toBe("unresolved");
  });
});
