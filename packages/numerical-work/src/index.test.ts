import { createCamera, dyadic } from "@webgpu-zoomer/exact-camera";
import { AcceptedNumericalStore } from "@webgpu-zoomer/numerical-contract";
import { planSquareSampleGrid } from "@webgpu-zoomer/view-planner";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AsyncWorkAdmission,
  workItemsFromPlan,
  type AdmissionPolicy,
  type NumericalWorkItem,
  type WorkCompletion,
} from "./index.js";

const policy: AdmissionPolicy = {
  maximumPendingItems: 128,
  iterationBudget: 64,
  methodVersion: "gpu-direct-f32-v1",
  oracleVersion: "exact-dyadic-v1",
};

function plan(epoch: bigint) {
  return planSquareSampleGrid(
    createCamera(dyadic(0n, 0n), dyadic(0n, 0n), dyadic(1n, 0n), epoch),
    { formulaId: "mandelbrot", formulaVersion: 1, samplingVersion: 1, samplesPerAxis: 2, maximumSamples: 16 },
  );
}

function escaped(items: readonly NumericalWorkItem[], iterations = 1): readonly WorkCompletion[] {
  return items.map((item) => ({
    workId: item.id,
    key: item.key,
    requestEpoch: item.requestEpoch,
    methodVersion: item.method.version,
    oracleVersion: item.reference.version,
    candidate: { status: "escaped", iterations, reason: "gpu_candidate_only" },
    oracle: { status: "escaped", iterations, reason: "escape_proved", workingPrecisionBits: 64 },
  }));
}

describe("asynchronous numerical work admission", () => {
  it("creates immutable versioned work at exact cell centers", () => {
    const items = workItemsFromPlan(plan(3n), policy);
    expect(items[0]).toMatchObject({
      requestEpoch: 3n,
      method: { id: "shallow-direct", version: "gpu-direct-f32-v1" },
      reference: { id: "exact-dyadic-oracle", version: "exact-dyadic-v1" },
      progress: { completedIterations: 0, iterationBudget: 64 },
      requiredChannels: ["escape_iterations"],
      provenance: { status: "unresolved", reason: "gpu_candidate_only" },
    });
    expect(items[0]!.identity.cRe).toEqual({ numerator: "-1", exponent: "-2" });
    expect(Object.isFrozen(items[0])).toBe(true);
  });

  it("admits synchronously and publishes only after background completion", async () => {
    const store = new AcceptedNumericalStore();
    const admission = new AsyncWorkAdmission(store, policy);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const result = admission.admit(plan(1n), async (items) => {
      await gate;
      return escaped(items);
    });
    expect(result.accepted).toBe(true);
    expect(result).not.toBeInstanceOf(Promise);
    expect(admission.diagnostics()).toMatchObject({ pendingItems: 4, publishedItems: 0, admissionReturnsPromise: false });
    expect(store.size).toBe(0);
    release();
    await admission.whenIdle();
    expect(admission.diagnostics()).toMatchObject({ pendingItems: 0, completedItems: 4, publishedItems: 4 });
    expect(store.size).toBe(4);
  });

  it("admits a newer epoch without draining and discards late old completion", async () => {
    const store = new AcceptedNumericalStore();
    const admission = new AsyncWorkAdmission(store, policy);
    let releaseOld!: () => void;
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
    admission.admit(plan(4n), async (items) => {
      await oldGate;
      return escaped(items);
    });
    const newer = admission.admit(plan(5n), async (items) => escaped(items));
    expect(newer.accepted).toBe(true);
    await Promise.resolve();
    releaseOld();
    await admission.whenIdle();
    expect(store.size).toBe(4);
    expect(store.snapshot().every((sample) => sample.acceptedEpoch === "5")).toBe(true);
    expect(admission.diagnostics()).toMatchObject({ admittedItems: 8, completedItems: 8, publishedItems: 4, staleItems: 4 });
  });

  it("rejects resource excess and completion identity conflicts conservatively", async () => {
    const store = new AcceptedNumericalStore();
    const admission = new AsyncWorkAdmission(store, { ...policy, maximumPendingItems: 4 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    admission.admit(plan(1n), async (items) => {
      await gate;
      const completions = escaped(items);
      return completions.map((completion, index) => index === 0
        ? { ...completion, methodVersion: "wrong-version" }
        : completion);
    });
    expect(admission.admit(plan(2n), async (items) => escaped(items))).toMatchObject({
      accepted: false,
      reason: "resource_budget_exhausted",
    });
    release();
    await admission.whenIdle();
    expect(store.size).toBe(3);
    expect(admission.diagnostics()).toMatchObject({ conflictItems: 1, unresolvedItems: 1, budgetRejectedItems: 4 });
  });

  it("keeps readback and diagnostic drain waits outside interaction functions", () => {
    const source = readFileSync(resolve("apps/web/src/main.ts"), "utf8");
    const interaction = source.slice(
      source.indexOf("function startPresentationTransition"),
      source.indexOf("async function initializePreview"),
    );
    expect(interaction).not.toMatch(/mapAsync|whenIdle|createDirectHarness|executePlannedShallowBatch/);
  });
});
