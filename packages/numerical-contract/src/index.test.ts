import { describe, expect, it } from "vitest";
import {
  AcceptedNumericalStore,
  canonicalSampleKey,
  compareGpuCandidate,
  evaluateShallowDirectPublication,
  type CanonicalSampleIdentity,
  type PublicationDecision,
} from "./index.js";

const identity: CanonicalSampleIdentity = {
  formulaId: "mandelbrot",
  formulaVersion: 1,
  cRe: { numerator: "2", exponent: "0" },
  cIm: { numerator: "0", exponent: "0" },
  samplingVersion: 1,
};

function escapedDecision(epoch: bigint, iterations = 2): PublicationDecision {
  return evaluateShallowDirectPublication({
    identity,
    requestEpoch: epoch,
    candidate: { status: "escaped", iterations, reason: "gpu_candidate_only" },
    oracle: { status: "escaped", iterations, reason: "escape_proved", workingPrecisionBits: 64 },
    oracleVersion: "exact-dyadic-v1",
    methodVersion: "gpu-direct-f32-v1",
  });
}

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

  it("publishes a canonical escaped sample only after exact oracle agreement", () => {
    const decision = escapedDecision(7n);
    expect(decision.accepted).toBe(true);
    if (!decision.accepted) throw new Error("Expected an accepted publication.");
    expect(decision.sample).toMatchObject({
      key: "mandelbrot:1:1p1:0p0:1",
      provenance: "escaped",
      channels: { iterations: 2 },
      qualityTier: "exact-oracle-agreement",
      errorSummary: {
        contract: "exact-oracle-iteration-agreement",
        workingPrecisionBits: 64,
      },
      acceptedEpoch: 7n,
    });
  });

  it("keeps unresolved and mismatched candidates outside the accepted store", () => {
    const store = new AcceptedNumericalStore();
    const unresolved = evaluateShallowDirectPublication({
      identity,
      requestEpoch: 1n,
      candidate: { status: "unresolved", iterations: 128, reason: "gpu_candidate_only" },
      oracle: {
        status: "unresolved",
        iterations: 128,
        reason: "iteration_budget_exhausted",
        workingPrecisionBits: 64,
      },
      oracleVersion: "exact-dyadic-v1",
      methodVersion: "gpu-direct-f32-v1",
    });
    const mismatch = evaluateShallowDirectPublication({
      identity,
      requestEpoch: 1n,
      candidate: { status: "escaped", iterations: 1, reason: "gpu_candidate_only" },
      oracle: { status: "escaped", iterations: 2, reason: "escape_proved", workingPrecisionBits: 64 },
      oracleVersion: "exact-dyadic-v1",
      methodVersion: "gpu-direct-f32-v1",
    });
    expect(unresolved).toEqual({ accepted: false, publishedStatus: "unresolved", reason: "gpu_candidate_only" });
    expect(mismatch).toEqual({ accepted: false, publishedStatus: "unresolved", reason: "comparison_mismatch" });
    expect(store.size).toBe(0);
  });

  it("rejects stale and conflicting writes while allowing monotonic equivalent refresh", () => {
    const store = new AcceptedNumericalStore();
    const current = escapedDecision(4n);
    const stale = escapedDecision(3n);
    const fresh = escapedDecision(5n);
    const conflict = escapedDecision(6n, 3);
    if (!current.accepted || !stale.accepted || !fresh.accepted || !conflict.accepted) {
      throw new Error("Expected accepted publication fixtures.");
    }
    expect(store.publish(current.sample)).toEqual({ status: "inserted", reason: "accepted" });
    expect(store.publish(current.sample)).toEqual({ status: "unchanged", reason: "duplicate" });
    expect(store.publish(stale.sample)).toEqual({ status: "rejected", reason: "stale_epoch" });
    expect(store.publish(conflict.sample)).toEqual({ status: "rejected", reason: "conflict" });
    expect(store.publish(fresh.sample)).toEqual({ status: "replaced", reason: "accepted" });
    expect(store.get(canonicalSampleKey(identity))?.acceptedEpoch).toBe("5");
    expect(store.checksum()).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  });

  it("normalizes equivalent dyadic identities to one canonical key", () => {
    expect(canonicalSampleKey(identity)).toBe(canonicalSampleKey({
      ...identity,
      cRe: { numerator: "1", exponent: "1" },
    }));
  });
});
