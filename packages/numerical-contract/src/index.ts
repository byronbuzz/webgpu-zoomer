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
  accepted: true;
  publishedStatus: "escaped";
  reason: "escape_proved";
}> | Readonly<{
  accepted: false;
  publishedStatus: "unresolved" | "invalid";
  reason: ProvenanceReason;
}>;

export type SerializedDyadic = Readonly<{
  numerator: string;
  exponent: string;
}>;

export type CanonicalSampleIdentity = Readonly<{
  formulaId: "mandelbrot";
  formulaVersion: number;
  cRe: SerializedDyadic;
  cIm: SerializedDyadic;
  samplingVersion: number;
}>;

export type ShallowDirectPublicationRequest = Readonly<{
  identity: CanonicalSampleIdentity;
  requestEpoch: bigint;
  candidate: GpuCandidate;
  oracle: OracleResult;
  oracleVersion: string;
  methodVersion: string;
}>;

const acceptedPublication = Symbol("accepted-publication");

export type AcceptedSample = Readonly<{
  [acceptedPublication]: true;
  key: string;
  identity: CanonicalSampleIdentity;
  provenance: "escaped";
  reason: "escape_proved";
  channels: Readonly<{ iterations: number }>;
  qualityTier: "exact-oracle-agreement";
  methodVersion: string;
  oracleVersion: string;
  errorSummary: Readonly<{
    contract: "exact-oracle-iteration-agreement";
    workingPrecisionBits: number;
  }>;
  acceptedEpoch: bigint;
}>;

export type PublicationDecision = Readonly<{
  accepted: true;
  sample: AcceptedSample;
}> | Readonly<{
  accepted: false;
  publishedStatus: "unresolved" | "invalid";
  reason: ProvenanceReason;
}>;

export type AcceptedStoreWrite = Readonly<{
  status: "inserted" | "replaced" | "unchanged" | "rejected";
  reason: "accepted" | "duplicate" | "stale_epoch" | "conflict";
}>;

export type AcceptedSampleSnapshot = Omit<AcceptedSample, typeof acceptedPublication | "acceptedEpoch"> & Readonly<{
  acceptedEpoch: string;
}>;

function canonicalDyadic(value: SerializedDyadic): string {
  if (!/^-?\d+$/.test(value.numerator) || !/^-?\d+$/.test(value.exponent)) {
    throw new Error("Canonical sample coordinates must be integer strings.");
  }
  let numerator = BigInt(value.numerator);
  let exponent = BigInt(value.exponent);
  if (numerator === 0n) return "0p0";
  while (numerator % 2n === 0n) {
    numerator /= 2n;
    exponent += 1n;
  }
  return `${numerator.toString()}p${exponent.toString()}`;
}

export function canonicalSampleKey(identity: CanonicalSampleIdentity): string {
  if (!Number.isSafeInteger(identity.formulaVersion) || identity.formulaVersion < 0
    || !Number.isSafeInteger(identity.samplingVersion) || identity.samplingVersion < 0) {
    throw new Error("Canonical sample versions must be non-negative safe integers.");
  }
  return [
    identity.formulaId,
    identity.formulaVersion,
    canonicalDyadic(identity.cRe),
    canonicalDyadic(identity.cIm),
    identity.samplingVersion,
  ].join(":");
}

function immutableIdentity(identity: CanonicalSampleIdentity): CanonicalSampleIdentity {
  return Object.freeze({
    formulaId: identity.formulaId,
    formulaVersion: identity.formulaVersion,
    cRe: Object.freeze({ ...identity.cRe }),
    cIm: Object.freeze({ ...identity.cIm }),
    samplingVersion: identity.samplingVersion,
  });
}

/**
 * The bounded shallow direct contract: f32 WebGPU may nominate an escape, but
 * only independent exact-oracle agreement on the escape iteration can publish.
 */
export function evaluateShallowDirectPublication(request: ShallowDirectPublicationRequest): PublicationDecision {
  const comparison = compareGpuCandidate(request.candidate, request.oracle);
  if (!comparison.accepted) {
    return {
      accepted: false,
      publishedStatus: comparison.publishedStatus,
      reason: comparison.reason,
    };
  }
  if (request.requestEpoch < 0n) {
    throw new Error("Publication epochs must be non-negative.");
  }
  if (!request.oracleVersion || !request.methodVersion) {
    throw new Error("Publication method and oracle versions are required.");
  }
  if (!Number.isSafeInteger(request.oracle.iterations) || request.oracle.iterations < 1
    || !Number.isSafeInteger(request.oracle.workingPrecisionBits) || request.oracle.workingPrecisionBits < 1) {
    throw new Error("Accepted escape iterations and working precision must be positive safe integers.");
  }
  const identity = immutableIdentity(request.identity);
  return {
    accepted: true,
    sample: Object.freeze({
      [acceptedPublication]: true as const,
      key: canonicalSampleKey(identity),
      identity,
      provenance: "escaped" as const,
      reason: "escape_proved" as const,
      channels: Object.freeze({ iterations: request.oracle.iterations }),
      qualityTier: "exact-oracle-agreement" as const,
      methodVersion: request.methodVersion,
      oracleVersion: request.oracleVersion,
      errorSummary: Object.freeze({
        contract: "exact-oracle-iteration-agreement" as const,
        workingPrecisionBits: request.oracle.workingPrecisionBits,
      }),
      acceptedEpoch: request.requestEpoch,
    }),
  };
}

function equivalentAuthority(left: AcceptedSample, right: AcceptedSample): boolean {
  return left.provenance === right.provenance
    && left.channels.iterations === right.channels.iterations
    && left.qualityTier === right.qualityTier
    && left.methodVersion === right.methodVersion
    && left.oracleVersion === right.oracleVersion
    && left.errorSummary.contract === right.errorSummary.contract
    && left.errorSummary.workingPrecisionBits === right.errorSummary.workingPrecisionBits;
}

function snapshotSample(sample: AcceptedSample): AcceptedSampleSnapshot {
  const { acceptedEpoch, ...serializable } = sample;
  return Object.freeze({ ...serializable, acceptedEpoch: acceptedEpoch.toString() });
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export class AcceptedNumericalStore {
  readonly #samples = new Map<string, AcceptedSample>();

  get size(): number {
    return this.#samples.size;
  }

  publish(sample: AcceptedSample): AcceptedStoreWrite {
    const current = this.#samples.get(sample.key);
    if (!current) {
      this.#samples.set(sample.key, sample);
      return { status: "inserted", reason: "accepted" };
    }
    if (sample.acceptedEpoch < current.acceptedEpoch) {
      return { status: "rejected", reason: "stale_epoch" };
    }
    if (!equivalentAuthority(current, sample)) {
      return { status: "rejected", reason: "conflict" };
    }
    if (sample.acceptedEpoch === current.acceptedEpoch) {
      return { status: "unchanged", reason: "duplicate" };
    }
    this.#samples.set(sample.key, sample);
    return { status: "replaced", reason: "accepted" };
  }

  get(key: string): AcceptedSampleSnapshot | undefined {
    const sample = this.#samples.get(key);
    return sample ? snapshotSample(sample) : undefined;
  }

  snapshot(): readonly AcceptedSampleSnapshot[] {
    return [...this.#samples.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(snapshotSample);
  }

  checksum(): string {
    return `fnv1a64:${fnv1a64(JSON.stringify(this.snapshot()))}`;
  }
}

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
