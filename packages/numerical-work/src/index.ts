import { dyadic, serializeDyadic, type WorldKey } from "@webgpu-zoomer/exact-camera";
import {
  AcceptedNumericalStore,
  evaluateShallowDirectPublication,
  type CanonicalSampleIdentity,
  type GpuCandidate,
  type OracleResult,
} from "@webgpu-zoomer/numerical-contract";
import type { SamplePlan } from "@webgpu-zoomer/view-planner";

export type NumericalWorkItem = Readonly<{
  schemaVersion: 1;
  id: string;
  key: WorldKey;
  identity: CanonicalSampleIdentity;
  requestEpoch: bigint;
  method: Readonly<{ id: "shallow-direct"; version: string }>;
  reference: Readonly<{ id: "exact-dyadic-oracle"; version: string }>;
  progress: Readonly<{ completedIterations: 0; iterationBudget: number }>;
  requiredChannels: readonly ["escape_iterations"];
  provenance: Readonly<{ status: "unresolved"; reason: "gpu_candidate_only" }>;
}>;

export type WorkCompletion = Readonly<{
  workId: string;
  key: WorldKey;
  requestEpoch: bigint;
  methodVersion: string;
  oracleVersion: string;
  candidate: GpuCandidate;
  oracle: OracleResult;
}>;

export type WorkExecutor = (items: readonly NumericalWorkItem[]) => Promise<readonly WorkCompletion[]>;

export type AdmissionPolicy = Readonly<{
  maximumPendingItems: number;
  iterationBudget: number;
  methodVersion: string;
  oracleVersion: string;
}>;

export type AdmissionResult = Readonly<{
  accepted: boolean;
  reason: "admitted" | "stale_plan" | "resource_budget_exhausted";
  itemCount: number;
  requestEpoch: bigint;
}>;

export type WorkDiagnostics = Readonly<{
  schemaVersion: 1;
  activeEpoch: string | null;
  pendingItems: number;
  activeBatches: number;
  admittedItems: number;
  completedItems: number;
  publishedItems: number;
  unresolvedItems: number;
  staleItems: number;
  conflictItems: number;
  failedItems: number;
  budgetRejectedItems: number;
  admissionReturnsPromise: false;
}>;

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive safe integer.`);
}

function sameWorldKey(left: WorldKey, right: WorldKey): boolean {
  return left.formulaId === right.formulaId
    && left.level === right.level
    && left.x === right.x
    && left.y === right.y
    && left.samplingVersion === right.samplingVersion;
}

function identityAtCellCenter(key: WorldKey, formulaVersion: number): CanonicalSampleIdentity {
  if (key.formulaId !== "mandelbrot") throw new Error(`Unsupported formula ${key.formulaId}.`);
  return Object.freeze({
    formulaId: "mandelbrot",
    formulaVersion,
    cRe: serializeDyadic(dyadic(2n * key.x + 1n, key.level - 1n)),
    cIm: serializeDyadic(dyadic(2n * key.y + 1n, key.level - 1n)),
    samplingVersion: key.samplingVersion,
  });
}

export function workItemsFromPlan(plan: SamplePlan, policy: AdmissionPolicy): readonly NumericalWorkItem[] {
  assertPositiveSafeInteger(policy.iterationBudget, "iterationBudget");
  if (!policy.methodVersion || !policy.oracleVersion) throw new RangeError("Method and oracle versions are required.");
  return Object.freeze(plan.samples.map((key, index) => Object.freeze({
    schemaVersion: 1 as const,
    id: `${plan.planId}:work:${index}`,
    key,
    identity: identityAtCellCenter(key, plan.formulaVersion),
    requestEpoch: plan.requestEpoch,
    method: Object.freeze({ id: "shallow-direct" as const, version: policy.methodVersion }),
    reference: Object.freeze({ id: "exact-dyadic-oracle" as const, version: policy.oracleVersion }),
    progress: Object.freeze({ completedIterations: 0 as const, iterationBudget: policy.iterationBudget }),
    requiredChannels: Object.freeze(["escape_iterations"] as const),
    provenance: Object.freeze({ status: "unresolved" as const, reason: "gpu_candidate_only" as const }),
  })));
}

export class AsyncWorkAdmission {
  readonly #store: AcceptedNumericalStore;
  readonly #policy: AdmissionPolicy;
  readonly #batches = new Set<Promise<void>>();
  #activeEpoch: bigint | undefined;
  #pendingItems = 0;
  #admittedItems = 0;
  #completedItems = 0;
  #publishedItems = 0;
  #unresolvedItems = 0;
  #staleItems = 0;
  #conflictItems = 0;
  #failedItems = 0;
  #budgetRejectedItems = 0;

  constructor(store: AcceptedNumericalStore, policy: AdmissionPolicy) {
    assertPositiveSafeInteger(policy.maximumPendingItems, "maximumPendingItems");
    assertPositiveSafeInteger(policy.iterationBudget, "iterationBudget");
    if (!policy.methodVersion || !policy.oracleVersion) throw new RangeError("Method and oracle versions are required.");
    this.#store = store;
    this.#policy = Object.freeze({ ...policy });
  }

  /** Starts background work and deliberately does not return an awaitable. */
  admit(plan: SamplePlan, executor: WorkExecutor): AdmissionResult {
    if (this.#activeEpoch !== undefined && plan.requestEpoch < this.#activeEpoch) {
      return { accepted: false, reason: "stale_plan", itemCount: plan.samples.length, requestEpoch: plan.requestEpoch };
    }
    if (this.#pendingItems + plan.samples.length > this.#policy.maximumPendingItems) {
      this.#budgetRejectedItems += plan.samples.length;
      return {
        accepted: false,
        reason: "resource_budget_exhausted",
        itemCount: plan.samples.length,
        requestEpoch: plan.requestEpoch,
      };
    }

    this.#activeEpoch = plan.requestEpoch;
    const items = workItemsFromPlan(plan, this.#policy);
    this.#pendingItems += items.length;
    this.#admittedItems += items.length;
    const batch = Promise.resolve()
      .then(() => executor(items))
      .then((completions) => this.#consume(items, completions))
      .catch(() => {
        this.#failedItems += items.length;
        this.#unresolvedItems += items.length;
        this.#completedItems += items.length;
      })
      .finally(() => {
        this.#pendingItems -= items.length;
        this.#batches.delete(batch);
      });
    this.#batches.add(batch);
    return { accepted: true, reason: "admitted", itemCount: items.length, requestEpoch: plan.requestEpoch };
  }

  #consume(items: readonly NumericalWorkItem[], completions: readonly WorkCompletion[]): void {
    const byId = new Map(completions.map((completion) => [completion.workId, completion]));
    for (const item of items) {
      this.#completedItems += 1;
      if (item.requestEpoch !== this.#activeEpoch) {
        this.#staleItems += 1;
        continue;
      }
      const completion = byId.get(item.id);
      if (!completion) {
        this.#failedItems += 1;
        this.#unresolvedItems += 1;
        continue;
      }
      if (completion.requestEpoch !== item.requestEpoch
        || completion.methodVersion !== item.method.version
        || completion.oracleVersion !== item.reference.version
        || !sameWorldKey(completion.key, item.key)) {
        this.#conflictItems += 1;
        this.#unresolvedItems += 1;
        continue;
      }
      const publication = evaluateShallowDirectPublication({
        identity: item.identity,
        requestEpoch: item.requestEpoch,
        candidate: completion.candidate,
        oracle: completion.oracle,
        oracleVersion: completion.oracleVersion,
        methodVersion: completion.methodVersion,
      });
      if (!publication.accepted) {
        this.#unresolvedItems += 1;
        continue;
      }
      const write = this.#store.publish(publication.sample);
      if (write.status === "rejected") {
        if (write.reason === "stale_epoch") this.#staleItems += 1;
        else this.#conflictItems += 1;
      } else {
        this.#publishedItems += 1;
      }
    }
  }

  /** Diagnostics/tests only; interaction and rAF code must never call this. */
  async whenIdle(): Promise<void> {
    while (this.#batches.size > 0) await Promise.all([...this.#batches]);
  }

  diagnostics(): WorkDiagnostics {
    return Object.freeze({
      schemaVersion: 1,
      activeEpoch: this.#activeEpoch?.toString() ?? null,
      pendingItems: this.#pendingItems,
      activeBatches: this.#batches.size,
      admittedItems: this.#admittedItems,
      completedItems: this.#completedItems,
      publishedItems: this.#publishedItems,
      unresolvedItems: this.#unresolvedItems,
      staleItems: this.#staleItems,
      conflictItems: this.#conflictItems,
      failedItems: this.#failedItems,
      budgetRejectedItems: this.#budgetRejectedItems,
      admissionReturnsPromise: false,
    });
  }
}
