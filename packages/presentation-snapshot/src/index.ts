import { dyadic, serializeCamera, serializeDyadic, type WorldKey } from "@webgpu-zoomer/exact-camera";
import { canonicalSampleKey, type AcceptedSampleSnapshot } from "@webgpu-zoomer/numerical-contract";
import { serializeSamplePlan, type SamplePlan, type SerializedSamplePlan } from "@webgpu-zoomer/view-planner";

export type UnresolvedPresentationCoverage = Readonly<{
  key: WorldKey;
  reason: "not_published" | "pending" | "stale_epoch" | "conflict" | "failed";
}>;

type SerializedWorldKey = SerializedSamplePlan["samples"][number];

export type PresentationCell = Readonly<{
  key: SerializedWorldKey;
  source: "accepted";
  sampleKey: string;
  displayValue: Readonly<{ escapeIterations: number }>;
  acceptedEpoch: string;
}> | Readonly<{
  key: SerializedWorldKey;
  source: "unresolved";
  reason: UnresolvedPresentationCoverage["reason"];
  displayValue: null;
}>;

export type PresentationSnapshot = Readonly<{
  schemaVersion: 1;
  snapshotId: string;
  checksum: string;
  authority: "presentation-only";
  sourcePlanId: string;
  camera: SerializedSamplePlan["camera"];
  requestEpoch: string;
  level: string;
  domain?: SerializedSamplePlan["domain"];
  bounds: SerializedSamplePlan["bounds"];
  counts: Readonly<{ total: number; accepted: number; unresolved: number }>;
  cells: readonly PresentationCell[];
}>;

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function serializeWorldKey(key: WorldKey): SerializedWorldKey {
  return Object.freeze({
    formulaId: key.formulaId,
    level: key.level.toString(),
    x: key.x.toString(),
    y: key.y.toString(),
    samplingVersion: key.samplingVersion,
  });
}

function worldKeyIdentity(key: WorldKey): string {
  return `${key.formulaId}:${key.level}:${key.x}:${key.y}:${key.samplingVersion}`;
}

function sampleKeyAtCellCenter(key: WorldKey, formulaVersion: number): string {
  if (key.formulaId !== "mandelbrot") throw new Error(`Unsupported formula ${key.formulaId}.`);
  return canonicalSampleKey({
    formulaId: "mandelbrot",
    formulaVersion,
    cRe: serializeDyadic(dyadic(2n * key.x + 1n, key.level - 1n)),
    cIm: serializeDyadic(dyadic(2n * key.y + 1n, key.level - 1n)),
    samplingVersion: key.samplingVersion,
  });
}

export function createPresentationSnapshot(input: Readonly<{
  plan: SamplePlan;
  acceptedSamples: readonly AcceptedSampleSnapshot[];
  unresolvedCoverage: readonly UnresolvedPresentationCoverage[];
}>): PresentationSnapshot {
  const serializedPlan = serializeSamplePlan(input.plan);
  const plannedBySampleKey = new Map<string, WorldKey>();
  const plannedWorldKeys = new Set<string>();
  for (const key of input.plan.samples) {
    const worldIdentity = worldKeyIdentity(key);
    const sampleKey = sampleKeyAtCellCenter(key, input.plan.formulaVersion);
    if (plannedWorldKeys.has(worldIdentity) || plannedBySampleKey.has(sampleKey)) {
      throw new Error("Presentation source plan contains duplicate sample identity.");
    }
    plannedWorldKeys.add(worldIdentity);
    plannedBySampleKey.set(sampleKey, key);
  }

  const acceptedBySampleKey = new Map<string, AcceptedSampleSnapshot>();
  for (const sample of input.acceptedSamples) {
    if (sample.acceptedEpoch !== input.plan.requestEpoch.toString()) {
      throw new Error("Presentation snapshot cannot consume stale accepted samples.");
    }
    if (!plannedBySampleKey.has(sample.key)) {
      throw new Error("Accepted sample is outside the presentation source plan.");
    }
    if (acceptedBySampleKey.has(sample.key)) throw new Error("Accepted presentation coverage is duplicated.");
    acceptedBySampleKey.set(sample.key, sample);
  }

  const unresolvedByWorldKey = new Map<string, UnresolvedPresentationCoverage>();
  for (const unresolved of input.unresolvedCoverage) {
    const identity = worldKeyIdentity(unresolved.key);
    if (!plannedWorldKeys.has(identity)) throw new Error("Unresolved coverage is outside the presentation source plan.");
    if (unresolvedByWorldKey.has(identity)) throw new Error("Unresolved presentation coverage is duplicated.");
    const sampleKey = sampleKeyAtCellCenter(unresolved.key, input.plan.formulaVersion);
    if (acceptedBySampleKey.has(sampleKey)) throw new Error("Accepted and unresolved presentation coverage overlap.");
    unresolvedByWorldKey.set(identity, unresolved);
  }

  const cells = input.plan.samples.map((key): PresentationCell => {
    const sampleKey = sampleKeyAtCellCenter(key, input.plan.formulaVersion);
    const accepted = acceptedBySampleKey.get(sampleKey);
    if (accepted) {
      return Object.freeze({
        key: serializeWorldKey(key),
        source: "accepted" as const,
        sampleKey,
        displayValue: Object.freeze({ escapeIterations: accepted.channels.iterations }),
        acceptedEpoch: accepted.acceptedEpoch,
      });
    }
    const unresolved = unresolvedByWorldKey.get(worldKeyIdentity(key));
    if (!unresolved) throw new Error("Presentation snapshot requires total accepted or explicit unresolved coverage.");
    return Object.freeze({
      key: serializeWorldKey(key),
      source: "unresolved" as const,
      reason: unresolved.reason,
      displayValue: null,
    });
  });
  if (acceptedBySampleKey.size + unresolvedByWorldKey.size !== input.plan.samples.length) {
    throw new Error("Presentation coverage cardinality does not match the source plan.");
  }
  const counts = Object.freeze({
    total: cells.length,
    accepted: acceptedBySampleKey.size,
    unresolved: unresolvedByWorldKey.size,
  });
  const core = Object.freeze({
    schemaVersion: 1 as const,
    authority: "presentation-only" as const,
    sourcePlanId: input.plan.planId,
    camera: serializeCamera(input.plan.camera),
    requestEpoch: input.plan.requestEpoch.toString(),
    level: input.plan.level.toString(),
    ...(serializedPlan.domain ? { domain: serializedPlan.domain } : {}),
    bounds: serializedPlan.bounds,
    counts,
    cells: Object.freeze(cells),
  });
  const checksum = `fnv1a64:${fnv1a64(JSON.stringify(core))}`;
  return Object.freeze({ ...core, snapshotId: `presentation-snapshot:${checksum}`, checksum });
}
