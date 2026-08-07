export const provenanceStates = ["escaped", "certified_interior", "unresolved", "invalid"] as const;
export type SampleProvenance = (typeof provenanceStates)[number];

export const provenanceReasons = [
  "analytic_interior",
  "escape_proved",
  "iteration_budget_exhausted",
  "insufficient_precision",
  "gpu_candidate_only",
  "comparison_mismatch",
  "nonfinite",
  "resource_budget_exhausted",
] as const;
export type ProvenanceReason = (typeof provenanceReasons)[number];

export type OracleResult = Readonly<{
  status: SampleProvenance;
  reason: ProvenanceReason;
  iterations: number;
  workingPrecisionBits: number;
}>;

export type GpuCandidate = Readonly<{
  status: "escaped" | "unresolved" | "invalid";
  iterations: number;
  reason: "gpu_candidate_only" | "nonfinite";
}>;

export type DifferentialResult = Readonly<{
  accepted: boolean;
  publishedStatus: "escaped" | "unresolved" | "invalid";
  reason: ProvenanceReason;
}>;

/** GPU direct results are candidates. Oracle agreement is required for this Phase-0 harness. */
export function compareGpuCandidate(candidate: GpuCandidate, oracle: OracleResult): DifferentialResult {
  if (candidate.status === "invalid") {
    return { accepted: false, publishedStatus: "invalid", reason: "nonfinite" };
  }
  if (candidate.status === "escaped" && oracle.status === "escaped" && candidate.iterations === oracle.iterations) {
    return { accepted: true, publishedStatus: "escaped", reason: "escape_proved" };
  }
  if (candidate.status === "escaped") {
    return { accepted: false, publishedStatus: "unresolved", reason: "comparison_mismatch" };
  }
  return { accepted: false, publishedStatus: "unresolved", reason: "gpu_candidate_only" };
}
