import {
  add,
  deserializeCamera,
  floorAtLevel,
  negate,
  scalePowerOfTwo,
  serializeCamera,
  subtract,
  type ExactCamera,
  type SerializedCamera,
  type WorldKey,
} from "@webgpu-zoomer/exact-camera";

export type SamplePlanOptions = Readonly<{
  formulaId: string;
  formulaVersion: number;
  samplingVersion: number;
  samplesPerAxis: number;
  maximumSamples: number;
}>;

export type SamplePlan = Readonly<{
  schemaVersion: 1;
  planId: string;
  checksum: string;
  camera: ExactCamera;
  requestEpoch: bigint;
  formulaVersion: number;
  level: bigint;
  bounds: Readonly<{ minX: bigint; maxX: bigint; minY: bigint; maxY: bigint }>;
  samples: readonly WorldKey[];
}>;

export type SerializedSamplePlan = Readonly<{
  schemaVersion: 1;
  planId: string;
  checksum: string;
  camera: SerializedCamera;
  requestEpoch: string;
  formulaVersion: number;
  level: string;
  bounds: Readonly<{ minX: string; maxX: string; minY: string; maxY: string }>;
  samples: readonly Readonly<{
    formulaId: string;
    level: string;
    x: string;
    y: string;
    samplingVersion: number;
  }>[];
}>;

export class SamplePlanBudgetExceeded extends RangeError {
  readonly requestedSamples: bigint;
  readonly maximumSamples: number;

  constructor(requestedSamples: bigint, maximumSamples: number) {
    super(`Sample plan requires ${requestedSamples} samples; budget is ${maximumSamples}.`);
    this.name = "SamplePlanBudgetExceeded";
    this.requestedSamples = requestedSamples;
    this.maximumSamples = maximumSamples;
  }
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function powerOfTwoExponent(value: number): bigint {
  const exactValue = BigInt(value);
  if (!Number.isSafeInteger(value) || value < 1 || (exactValue & (exactValue - 1n)) !== 0n) {
    throw new RangeError("samplesPerAxis must be a positive power-of-two safe integer.");
  }
  let exponent = 0n;
  for (let remaining = value; remaining > 1; remaining /= 2) exponent += 1n;
  return exponent;
}

function positiveFloorLog2(cameraScale: ExactCamera["viewportScale"]): bigint {
  const magnitudeBits = BigInt(cameraScale.numerator.toString(2).length - 1);
  return cameraScale.exponent + magnitudeBits;
}

function ceilAtLevel(value: ExactCamera["centerX"], level: bigint): bigint {
  return -floorAtLevel(negate(value), level);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function serializableCore(plan: Omit<SamplePlan, "planId" | "checksum">) {
  return {
    schemaVersion: 1 as const,
    camera: serializeCamera(plan.camera),
    requestEpoch: plan.requestEpoch.toString(),
    formulaVersion: plan.formulaVersion,
    level: plan.level.toString(),
    bounds: {
      minX: plan.bounds.minX.toString(),
      maxX: plan.bounds.maxX.toString(),
      minY: plan.bounds.minY.toString(),
      maxY: plan.bounds.maxY.toString(),
    },
    samples: plan.samples.map((sample) => ({
      formulaId: sample.formulaId,
      level: sample.level.toString(),
      x: sample.x.toString(),
      y: sample.y.toString(),
      samplingVersion: sample.samplingVersion,
    })),
  };
}

export function planSquareSampleGrid(camera: ExactCamera, options: SamplePlanOptions): SamplePlan {
  if (!options.formulaId) throw new RangeError("formulaId is required.");
  assertNonNegativeSafeInteger(options.formulaVersion, "formulaVersion");
  assertNonNegativeSafeInteger(options.samplingVersion, "samplingVersion");
  if (!Number.isSafeInteger(options.maximumSamples) || options.maximumSamples < 1) {
    throw new RangeError("maximumSamples must be a positive safe integer.");
  }
  const densityExponent = powerOfTwoExponent(options.samplesPerAxis);
  const level = positiveFloorLog2(camera.viewportScale) - densityExponent;
  const halfSpan = scalePowerOfTwo(camera.viewportScale, -1n);
  const minimumX = subtract(camera.centerX, halfSpan);
  const maximumX = add(camera.centerX, halfSpan);
  const minimumY = subtract(camera.centerY, halfSpan);
  const maximumY = add(camera.centerY, halfSpan);
  const bounds = Object.freeze({
    minX: floorAtLevel(minimumX, level),
    maxX: ceilAtLevel(maximumX, level) - 1n,
    minY: floorAtLevel(minimumY, level),
    maxY: ceilAtLevel(maximumY, level) - 1n,
  });
  const width = bounds.maxX - bounds.minX + 1n;
  const height = bounds.maxY - bounds.minY + 1n;
  const requestedSamples = width * height;
  if (requestedSamples > BigInt(options.maximumSamples)) {
    throw new SamplePlanBudgetExceeded(requestedSamples, options.maximumSamples);
  }

  const samples: WorldKey[] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y += 1n) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1n) {
      samples.push(Object.freeze({
        formulaId: options.formulaId,
        level,
        x,
        y,
        samplingVersion: options.samplingVersion,
      }));
    }
  }
  const core = Object.freeze({
    schemaVersion: 1 as const,
    camera,
    requestEpoch: camera.epoch,
    formulaVersion: options.formulaVersion,
    level,
    bounds,
    samples: Object.freeze(samples),
  });
  const checksum = `fnv1a64:${fnv1a64(JSON.stringify(serializableCore(core)))}`;
  return Object.freeze({ ...core, planId: `sample-plan:${checksum}`, checksum });
}

export function serializeSamplePlan(plan: SamplePlan): SerializedSamplePlan {
  return Object.freeze({
    ...serializableCore(plan),
    planId: plan.planId,
    checksum: plan.checksum,
  });
}

export function replaySamplePlan(serialized: SerializedSamplePlan, options: SamplePlanOptions): SamplePlan {
  const replayed = planSquareSampleGrid(deserializeCamera(serialized.camera), options);
  if (replayed.planId !== serialized.planId || replayed.checksum !== serialized.checksum
    || JSON.stringify(serializeSamplePlan(replayed)) !== JSON.stringify(serialized)) {
    throw new Error("Serialized sample plan does not reproduce its canonical identity.");
  }
  return replayed;
}
