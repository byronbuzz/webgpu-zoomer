import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";
import {
  add,
  deserializeCamera,
  deserializeDyadic,
  multiply,
  type ExactCamera,
  type ExactDyadic,
  type SerializedCamera,
} from "@webgpu-zoomer/exact-camera";

type HarnessResult = Readonly<{
  schemaVersion: number;
  status: "passed" | "failed";
  environment: { info: { isFallbackAdapter: boolean } };
  summary: {
    selectedReferenceIterationLimit: number;
    referenceBatchLimits: {
      maximumItems: number;
      maximumTotalIterations: number;
      maximumNumeratorBits: number;
      maximumElapsedMs: number;
    };
    fixtureCount: number;
    oracleMismatchCount: number;
    gpuDifferentialCount: number;
    gpuMismatchCount: number;
    acceptedGpuEscapes: number;
    acceptedStoreChecksum: string;
    plannedSampleCount: number;
    samplePlanChecksum: string;
    samplePlanLevel: string;
    scheduledAcceptedCount: number;
    scheduledStoreChecksum: string;
    presentationSnapshotChecksum: string;
    presentationAcceptedCount: number;
    presentationUnresolvedCount: number;
    presentationHistoryChecksum: string;
    presentationHistoryResidentViews: number;
    intentionalInsufficientBoundPassed: boolean;
    fallbackAdapter: boolean;
  };
  acceptedStore: Array<{
    key: string;
    provenance: string;
    channels: { iterations: number };
    qualityTier: string;
    errorSummary: { contract: string; workingPrecisionBits: number };
    acceptedEpoch: string;
  }>;
  samplePlan: {
    planId: string;
    checksum: string;
    requestEpoch: string;
    formulaVersion: number;
    level: string;
    domain?: { kind: string; version: number; width: number; height: number };
    bounds: { minX: string; maxX: string; minY: string; maxY: string };
    samples: Array<{ level: string; x: string; y: string }>;
  };
  workAdmission: {
    admission: { accepted: boolean; reason: string; itemCount: number; requestEpoch: string };
    admissionCallMs: number;
    immediatelyAfterAdmission: WorkDiagnostics;
    settled: WorkDiagnostics;
    acceptedStore: Array<{ acceptedEpoch: string }>;
  };
  presentationSnapshot: {
    snapshotId: string;
    checksum: string;
    authority: string;
    sourcePlanId: string;
    requestEpoch: string;
    counts: { total: number; accepted: number; unresolved: number };
    cells: Array<{
      source: "accepted" | "unresolved";
      reason?: string;
      acceptedEpoch?: string;
      displayValue: { escapeIterations: number } | null;
    }>;
  };
  presentationComposite: {
    status: "composited" | "dropped";
    reason?: string;
    snapshotId?: string;
    checksum?: string;
    cellCount?: number;
    acceptedCount?: number;
    unresolvedCount?: number;
    transformErrorLimitPx?: number;
  };
  presentationHistory: {
    publish: { status: string; reason: string; viewKey?: string; evictedViewKey?: string };
    selection: {
      selected: boolean;
      reason?: string;
      viewKey?: string;
      frameId?: string;
      requestEpoch?: string;
      counts?: { total: number; accepted: number; unresolved: number };
    };
    invalidTransformSelection: { selected: boolean; reason?: string };
    diagnostics: {
      maximumViews: number;
      residentViews: number;
      insertedViews: number;
      mergedViews: number;
      evictedViews: number;
      staleSnapshots: number;
      conflicts: number;
    };
    checksum: string;
  };
}>;

type WorkDiagnostics = {
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
  admissionReturnsPromise: boolean;
};

async function waitForIsolation(page: import("playwright/test").Page): Promise<void> {
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => window.crossOriginIsolated);
    } catch {
      return false;
    }
  }).toBe(true);
}

async function readCamera(page: import("playwright/test").Page): Promise<ExactCamera> {
  const encoded = await page.locator("#preview").getAttribute("data-camera");
  if (!encoded) throw new Error("Camera state is not published for inspection.");
  return deserializeCamera(JSON.parse(encoded) as SerializedCamera);
}

function worldAtFocus(camera: ExactCamera, focusX: ExactDyadic, focusY: ExactDyadic) {
  return {
    x: add(camera.centerX, multiply(focusX, camera.viewportScale)),
    y: add(camera.centerY, multiply(focusY, camera.viewportScale)),
  };
}

function approximateDyadic(value: ExactDyadic): number {
  return Number(value.numerator) * 2 ** Number(value.exponent);
}

async function readLastFocus(page: import("playwright/test").Page): Promise<{ x: ExactDyadic; y: ExactDyadic }> {
  const encoded = await page.locator("#preview").getAttribute("data-last-focus");
  if (!encoded) throw new Error("The quantized pointer focus was not recorded.");
  const value = JSON.parse(encoded) as {
    x: { numerator: string; exponent: string };
    y: { numerator: string; exponent: string };
  };
  return { x: deserializeDyadic(value.x), y: deserializeDyadic(value.y) };
}

test("isolated stable browser harness reports capabilities", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  const response = await page.reload();
  expect(response?.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(response?.headers()["cross-origin-embedder-policy"]).toBe("require-corp");
  await page.locator("details.diagnostics").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  const capabilities = JSON.parse(await page.locator("#capabilities").innerText());
  expect(capabilities.crossOriginIsolated).toBe(true);
  expect(capabilities.sharedArrayBuffer).toBe(true);
  expect(capabilities.webGpu).toBe(true);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#mandelbrot")).toBeVisible();
});

test("exploration controls expose exact zoom cadence and a logarithmic 50,000-iteration ceiling", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
  const initialScale = JSON.parse((await page.locator("#preview").getAttribute("data-scale-telemetry")) ?? "null") as {
    state: string;
    scale: { significand: number; binaryExponent: string; significandError: number };
    depth: { octaves: number; integerExponentDifference: string };
  };
  expect(initialScale).toMatchObject({
    state: "bounded",
    scale: { significand: 1.375, binaryExponent: "1", significandError: 0 },
    depth: { octaves: 0, integerExponentDifference: "0" },
  });
  await expect(page.locator("#camera-readout")).toContainText("scale 1.3750000 × 2^1");
  await expect(page.locator("#camera-readout")).not.toContainText("Infinity");
  await expect(page.locator("#zoom-speed-readout")).toHaveText(/steps\/s$/);
  await page.locator("#zoom-speed").fill("10");
  await expect(page.locator("#zoom-speed-readout")).toHaveText("10.0 steps/s");
  await page.locator("#reference-iterations").fill("1000");
  await expect(page.locator("#reference-iterations-readout")).toHaveText("50,000");
  await expect(page.locator("#preview")).toHaveAttribute("data-reference-iteration-limit", "50000");
  await expect(page.locator("#preview")).toHaveAttribute("data-zoom-steps-per-second", "10.0");
  const iterationPolicy = JSON.parse(
    (await page.locator("#preview").getAttribute("data-iteration-policy")) ?? "null",
  ) as {
    requestedVisibleConvergence: { iterationTarget: number; purpose: string };
    effectiveConvergence: {
      method: string;
      iterationTarget: number;
      iterationFrontier: number;
      dispatchQuantum: number;
      complete: boolean;
      authority: string;
    };
    requestAffectsVisibleConvergence: boolean;
    capExhaustionClassification: string;
  };
  expect(iterationPolicy).toMatchObject({
    requestedVisibleConvergence: { iterationTarget: 50_000, purpose: "visible-current-view-convergence" },
    effectiveConvergence: {
      method: "progressive-direct-f32-v1",
      iterationTarget: 50_000,
      dispatchQuantum: 64,
      authority: "presentation-only",
    },
    requestAffectsVisibleConvergence: true,
    capExhaustionClassification: "unresolved",
  });
  expect(iterationPolicy.effectiveConvergence.iterationFrontier).toBeGreaterThan(0);
  expect(iterationPolicy.effectiveConvergence.iterationFrontier).toBeLessThan(50_000);
  expect(iterationPolicy.effectiveConvergence.complete).toBe(false);
});

test("iteration selection progressively changes visible current-view convergence", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
  const canvas = page.locator("#mandelbrot");
  const shallow = await canvas.screenshot();
  const position = Math.round(1_000 * Math.log(128 / 8) / Math.log(50_000 / 8));
  await page.locator("#reference-iterations").fill(position.toString());
  const selected = Number(await page.locator("#preview").getAttribute("data-reference-iteration-limit"));
  expect(selected).toBeGreaterThan(8);
  await expect.poll(async () => {
    const policy = JSON.parse(
      (await page.locator("#preview").getAttribute("data-iteration-policy")) ?? "null",
    ) as {
      effectiveConvergence?: {
        iterationTarget?: number;
        iterationFrontier?: number;
        complete?: boolean;
        coverage?: { status?: string; activePixels?: number; escapedPixels?: number; unresolvedPixels?: number };
      };
    };
    return policy.effectiveConvergence;
  }).toMatchObject({
    iterationTarget: selected,
    iterationFrontier: selected,
    complete: true,
    coverage: { status: "measured", activePixels: 0 },
  });
  const measuredPolicy = JSON.parse(
    (await page.locator("#preview").getAttribute("data-iteration-policy")) ?? "null",
  ) as { effectiveConvergence: { coverage: { escapedPixels: number; unresolvedPixels: number } } };
  const backingPixels = await canvas.evaluate((element: HTMLCanvasElement) => element.width * element.height);
  expect(measuredPolicy.effectiveConvergence.coverage.escapedPixels
    + measuredPolicy.effectiveConvergence.coverage.unresolvedPixels).toBe(backingPixels);
  const converged = await canvas.screenshot();
  expect(converged.equals(shallow)).toBe(false);
  await page.locator("#reference-iterations").fill("0");
  await expect.poll(async () => {
    const policy = JSON.parse(
      (await page.locator("#preview").getAttribute("data-iteration-policy")) ?? "null",
    ) as { effectiveConvergence?: { iterationTarget?: number; iterationFrontier?: number; complete?: boolean; requestReset?: boolean } };
    return policy.effectiveConvergence;
  }).toMatchObject({
    iterationTarget: 8,
    iterationFrontier: 8,
    complete: true,
    requestReset: true,
  });
  expect((await canvas.screenshot()).equals(shallow)).toBe(true);
});

test("50,000 iteration reference requests remain bounded and unresolved without a direct candidate", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await page.locator("details.diagnostics").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  await page.locator("#reference-iterations").fill("1000");
  await page.getByRole("button", { name: "Run deterministic corpus" }).click();
  await expect(page.locator("#results")).toHaveAttribute("data-state", /passed|failed|error/, { timeout: 120_000 });
  const result = JSON.parse(await page.locator("#results").innerText()) as HarnessResult & { error?: string };
  expect(result.error).toBeUndefined();
  expect(result.status).toBe("passed");
  expect(result.summary).toMatchObject({
    selectedReferenceIterationLimit: 50_000,
    referenceBatchLimits: {
      maximumItems: 64,
      maximumTotalIterations: 100_000,
      maximumNumeratorBits: 4_096,
      maximumElapsedMs: 1_000,
    },
    scheduledAcceptedCount: 0,
  });
  expect(result.summary.plannedSampleCount).toBeLessThanOrEqual(8);
  expect(result.workAdmission.settled).toMatchObject({
    completedItems: result.summary.plannedSampleCount,
    publishedItems: 0,
    unresolvedItems: result.summary.plannedSampleCount,
    failedItems: 0,
  });
  expect(result.presentationSnapshot.counts).toEqual({
    total: result.summary.plannedSampleCount,
    accepted: 0,
    unresolved: result.summary.plannedSampleCount,
  });
});

test("WASM oracle and direct WebGPU corpus pass conservatively", async ({ page, browser }, testInfo) => {
  await page.goto("./");
  await waitForIsolation(page);
  await page.locator("details.diagnostics").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  await page.getByRole("button", { name: "Run deterministic corpus" }).click();
  await expect(page.locator("#results")).toHaveAttribute("data-state", /passed|failed|error/, { timeout: 120_000 });

  const raw = await page.locator("#results").innerText();
  const result = JSON.parse(raw) as HarnessResult & { error?: string };
  const evidence = {
    ...result,
    browserVersion: browser.version(),
    playwrightProject: testInfo.project.name,
  };
  const outputPath = process.env.WEBGPU_ZOOMER_RESULT_PATH
    ? resolve(process.env.WEBGPU_ZOOMER_RESULT_PATH)
    : testInfo.outputPath("phase-0-browser.json");
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await testInfo.attach("phase-0-browser-evidence", { path: outputPath, contentType: "application/json" });

  expect(result.error).toBeUndefined();
  expect(result.schemaVersion).toBe(1);
  expect(result.status).toBe("passed");
  expect(result.environment.info.isFallbackAdapter).toBe(false);
  expect(result.summary).toMatchObject({
    fixtureCount: 10,
    oracleMismatchCount: 0,
    gpuDifferentialCount: 4,
    gpuMismatchCount: 0,
    acceptedGpuEscapes: 3,
    plannedSampleCount: 312,
    samplePlanLevel: "-2",
    scheduledAcceptedCount: 274,
    scheduledStoreChecksum: "fnv1a64:10d82ed1636ffd19",
    presentationSnapshotChecksum: "fnv1a64:56b82dc8f9e2e849",
    presentationAcceptedCount: 274,
    presentationUnresolvedCount: 38,
    presentationHistoryChecksum: "fnv1a64:99d09993e8ee4c40",
    presentationHistoryResidentViews: 1,
    intentionalInsufficientBoundPassed: true,
    fallbackAdapter: false,
  });
  expect(result.summary.acceptedStoreChecksum).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  expect(result.summary.samplePlanChecksum).toBe("fnv1a64:db573639b8996b89");
  expect(result.samplePlan).toMatchObject({
    planId: `sample-plan:${result.summary.samplePlanChecksum}`,
    checksum: result.summary.samplePlanChecksum,
    requestEpoch: "0",
    level: "-2",
  });
  expect(result.samplePlan.domain).toEqual({ kind: "integer-aspect", version: 1, width: 1186, height: 517 });
  expect(result.samplePlan.bounds).toEqual({ minX: "-15", maxX: "10", minY: "-6", maxY: "5" });
  expect(result.samplePlan.samples).toHaveLength(312);
  expect(result.samplePlan.samples[0]).toMatchObject({ level: "-2", x: "-15", y: "-6" });
  expect(result.samplePlan.samples.at(-1)).toMatchObject({ level: "-2", x: "10", y: "5" });
  expect(result.workAdmission.admission).toEqual({
    accepted: true,
    reason: "admitted",
    itemCount: 312,
    requestEpoch: "0",
  });
  expect(result.workAdmission.admissionCallMs).toBeLessThan(50);
  expect(result.workAdmission.immediatelyAfterAdmission).toMatchObject({
    activeEpoch: "0",
    pendingItems: 312,
    activeBatches: 1,
    admittedItems: 312,
    completedItems: 0,
    publishedItems: 0,
    admissionReturnsPromise: false,
  });
  expect(result.workAdmission.settled).toMatchObject({
    activeEpoch: "0",
    pendingItems: 0,
    activeBatches: 0,
    admittedItems: 312,
    completedItems: 312,
    publishedItems: 274,
    unresolvedItems: 38,
    staleItems: 0,
    conflictItems: 0,
    failedItems: 0,
    budgetRejectedItems: 0,
    admissionReturnsPromise: false,
  });
  expect(result.workAdmission.acceptedStore).toHaveLength(274);
  expect(result.workAdmission.acceptedStore.every((sample) => sample.acceptedEpoch === "0")).toBe(true);
  expect(result.presentationSnapshot).toMatchObject({
    snapshotId: "presentation-snapshot:fnv1a64:56b82dc8f9e2e849",
    checksum: "fnv1a64:56b82dc8f9e2e849",
    authority: "presentation-only",
    sourcePlanId: result.samplePlan.planId,
    requestEpoch: "0",
    formulaVersion: 1,
    counts: { total: 312, accepted: 274, unresolved: 38 },
  });
  expect(result.presentationSnapshot.cells).toHaveLength(312);
  expect(result.presentationSnapshot.cells.filter((cell) => cell.source === "accepted")).toHaveLength(274);
  expect(result.presentationSnapshot.cells
    .filter((cell) => cell.source === "unresolved")
    .every((cell) => cell.reason === "not_published" && cell.displayValue === null)).toBe(true);
  expect(result.presentationComposite).toEqual({
    status: "composited",
    snapshotId: "presentation-snapshot:fnv1a64:56b82dc8f9e2e849",
    checksum: "fnv1a64:56b82dc8f9e2e849",
    cellCount: 312,
    acceptedCount: 274,
    unresolvedCount: 38,
    transformErrorLimitPx: 0.25,
  });
  expect(result.presentationHistory).toEqual({
    publish: {
      status: "inserted",
      reason: "accepted",
      viewKey: "presentation-view:fnv1a64:50ae8ecc03478b5c",
    },
    selection: {
      selected: true,
      viewKey: "presentation-view:fnv1a64:50ae8ecc03478b5c",
      frameId: "presentation-history-frame:fnv1a64:e16554ef5616a066",
      requestEpoch: "0",
      counts: { total: 312, accepted: 274, unresolved: 38 },
    },
    invalidTransformSelection: { selected: false, reason: "invalid_transform" },
    diagnostics: {
      schemaVersion: 1,
      maximumViews: 4,
      residentViews: 1,
      insertedViews: 1,
      mergedViews: 0,
      evictedViews: 0,
      staleSnapshots: 0,
      conflicts: 0,
    },
    checksum: "fnv1a64:99d09993e8ee4c40",
  });
  await expect(page.locator("#preview")).toHaveAttribute("data-snapshot-state", "composited");
  await expect(page.locator("#preview")).toHaveAttribute("data-snapshot-checksum", "fnv1a64:56b82dc8f9e2e849");
  expect(result.acceptedStore).toHaveLength(3);
  expect(result.acceptedStore.map((sample) => sample.key)).toEqual([
    "mandelbrot:1:-17p-3:0p0:1",
    "mandelbrot:1:1p0:0p0:1",
    "mandelbrot:1:1p1:0p0:1",
  ]);
  expect(result.acceptedStore.every((sample) => sample.provenance === "escaped"
    && sample.qualityTier === "exact-oracle-agreement"
    && sample.errorSummary.contract === "exact-oracle-iteration-agreement"
    && sample.acceptedEpoch === "0")).toBe(true);
});

test("repeated exact-view publication remains one bounded history frame", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await page.locator("details.diagnostics").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  await page.getByRole("button", { name: "Run deterministic corpus" }).click();
  await expect(page.locator("#results")).toHaveAttribute("data-state", "passed", { timeout: 120_000 });
  const first = JSON.parse(await page.locator("#results").innerText()) as HarnessResult;
  await page.getByRole("button", { name: "Run deterministic corpus" }).click();
  await expect.poll(async () => {
    const result = JSON.parse(await page.locator("#results").innerText()) as HarnessResult;
    return result.presentationHistory.publish.status;
  }, { timeout: 120_000 }).toBe("unchanged");
  const second = JSON.parse(await page.locator("#results").innerText()) as HarnessResult;
  expect(second.presentationHistory.publish).toMatchObject({ status: "unchanged", reason: "duplicate" });
  expect(second.presentationHistory.diagnostics.residentViews).toBe(1);
  expect(second.presentationHistory.checksum).toBe(first.presentationHistory.checksum);
  expect(second.summary.scheduledStoreChecksum).toBe(first.summary.scheduledStoreChecksum);
});

test("bounded history reprojects on a one-step exact-camera change without changing numerical evidence", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await page.locator("details.diagnostics").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  await page.getByRole("button", { name: "Run deterministic corpus" }).click();
  await expect(page.locator("#results")).toHaveAttribute("data-state", "passed", { timeout: 120_000 });
  await expect(page.locator("#preview")).toHaveAttribute("data-snapshot-state", "composited");
  const before = JSON.parse(await page.locator("#results").innerText()) as HarnessResult;
  const cameraBefore = await readCamera(page);
  await page.locator("#mandelbrot").scrollIntoViewIfNeeded();
  const bounds = await page.locator("#mandelbrot").boundingBox();
  if (!bounds) throw new Error("Mandelbrot canvas has no layout bounds.");
  await page.locator("#mandelbrot").hover({ position: { x: bounds.width * 0.5, y: bounds.height * 0.5 } });
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await readCamera(page)).epoch > cameraBefore.epoch).toBe(true);
  await expect(page.locator("#preview")).toHaveAttribute("data-snapshot-state", "history-reprojected");
  await expect(page.locator("#preview")).toHaveAttribute("data-history-frame-id", /^presentation-history-frame:/);
  await expect(page.locator("#preview")).toHaveAttribute("data-history-checksum", /^fnv1a64:[0-9a-f]{16}$/);
  const reprojection = JSON.parse((await page.locator("#preview").getAttribute("data-history-reprojection")) ?? "null") as {
    kind: string;
    targetScaleExponentDelta: string;
    maximumSourceCenterOffset: { numerator: string; exponent: string };
  } | null;
  expect(reprojection).toEqual({
    kind: "limited_dyadic_pan_zoom_v1",
    targetScaleExponentDelta: "-1",
    maximumSourceCenterOffset: { numerator: "11", exponent: "-3" },
  });
  await expect(page.locator("#preview")).not.toHaveAttribute("data-snapshot-checksum", /.+/);
  const after = JSON.parse(await page.locator("#results").innerText()) as HarnessResult;
  expect(after.summary.acceptedStoreChecksum).toBe(before.summary.acceptedStoreChecksum);
  expect(after.summary.scheduledStoreChecksum).toBe(before.summary.scheduledStoreChecksum);
});

test("numerical diagnostics do not gate exact-camera input", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
  await page.locator("details.diagnostics").evaluate((details: HTMLDetailsElement) => { details.open = true; });
  const before = await readCamera(page);
  await page.getByRole("button", { name: "Run deterministic corpus" }).click();
  await expect(page.locator("#results")).toHaveAttribute("data-state", "running");
  const bounds = await page.locator("#mandelbrot").boundingBox();
  if (!bounds) throw new Error("Mandelbrot canvas has no layout bounds.");
  await page.locator("#mandelbrot").hover({ position: { x: bounds.width * 0.61, y: bounds.height * 0.41 } });
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await readCamera(page)).epoch > before.epoch).toBe(true);
  await expect(page.locator("#results")).toHaveAttribute("data-state", /passed|failed|error/, { timeout: 120_000 });
  const result = JSON.parse(await page.locator("#results").innerText()) as HarnessResult;
  expect(result.status).toBe("passed");
  expect(result.workAdmission.settled.admissionReturnsPromise).toBe(false);
});

test("held zoom consumes the latest steered pointer without restarting a transition queue", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
  const canvas = page.locator("#mandelbrot");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Mandelbrot canvas has no layout bounds.");
  const testIterationPosition = Math.round(1_000 * Math.log(5_000 / 8) / Math.log(50_000 / 8));
  await page.locator("#reference-iterations").fill(testIterationPosition.toString());
  await expect(page.locator("#reference-iterations-readout")).toHaveText("5,000");
  const camera = await readCamera(page);
  const targetReal = -0.777120613150274923773;
  const targetImaginary = 0.126857238786361887169;
  const focusX = (targetReal - approximateDyadic(camera.centerX)) / approximateDyadic(camera.viewportScale);
  const focusY = (targetImaginary - approximateDyadic(camera.centerY)) / approximateDyadic(camera.viewportScale);
  const start = {
    x: bounds.x + bounds.width / 2 + focusX * bounds.height,
    y: bounds.y + bounds.height / 2 - focusY * bounds.height,
  };
  const steered = { x: start.x + bounds.width * 0.08, y: start.y - bounds.height * 0.08 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect.poll(async () => page.locator("#preview").getAttribute("data-last-focus")).not.toBeNull();
  const firstFocus = await readLastFocus(page);
  await page.mouse.move(steered.x, steered.y);
  await expect.poll(async () => {
    const latest = await readLastFocus(page);
    return latest.x.numerator !== firstFocus.x.numerator || latest.y.numerator !== firstFocus.y.numerator;
  }).toBe(true);
  await page.mouse.up();
  const stopped = await readCamera(page);
  await page.waitForTimeout(100);
  expect(await readCamera(page)).toEqual(stopped);
  await expect(page.locator("#preview")).toHaveAttribute("data-presentation-state", "stopped");
});

test("right-button hold zooms outward continuously and stops immediately", async ({ page }) => {
  await page.goto("./");
  await waitForIsolation(page);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
  const testIterationPosition = Math.round(1_000 * Math.log(5_000 / 8) / Math.log(50_000 / 8));
  await page.locator("#reference-iterations").fill(testIterationPosition.toString());
  await expect(page.locator("#reference-iterations-readout")).toHaveText("5,000");
  const canvas = page.locator("#mandelbrot");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Mandelbrot canvas has no layout bounds.");
  const camera = await readCamera(page);
  const focusX = (-0.777120613150274923773 - approximateDyadic(camera.centerX))
    / approximateDyadic(camera.viewportScale);
  const focusY = (0.126857238786361887169 - approximateDyadic(camera.centerY))
    / approximateDyadic(camera.viewportScale);
  await page.mouse.move(
    bounds.x + bounds.width / 2 + focusX * bounds.height,
    bounds.y + bounds.height / 2 - focusY * bounds.height,
  );
  await page.mouse.down({ button: "right" });
  const scales: number[] = [];
  for (let frame = 0; frame < 4; frame += 1) {
    await page.waitForTimeout(55);
    scales.push(approximateDyadic((await readCamera(page)).viewportScale));
  }
  await page.mouse.up({ button: "right" });
  for (let index = 1; index < scales.length; index += 1) {
    expect(scales[index]).toBeGreaterThan(scales[index - 1]!);
    expect(scales[index]! / scales[index - 1]!).toBeLessThan(2);
  }
  const stopped = await readCamera(page);
  await page.waitForTimeout(100);
  expect(await readCamera(page)).toEqual(stopped);
  await expect(page.locator("#preview")).toHaveAttribute("data-presentation-state", "stopped");
});

test("exact camera preserves pointer focus, round trips, and continues through the former f32 display guard", async ({ page, browser }, testInfo) => {
  await page.goto("./");
  await waitForIsolation(page);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
  const testIterationPosition = Math.round(1_000 * Math.log(5_000 / 8) / Math.log(50_000 / 8));
  await page.locator("#reference-iterations").fill(testIterationPosition.toString());
  await expect(page.locator("#reference-iterations-readout")).toHaveText("5,000");

  const canvas = page.locator("#mandelbrot");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Mandelbrot canvas has no layout bounds.");
  const focusBits = Number(await page.locator("#preview").getAttribute("data-focus-quantization-bits"));
  expect(bounds.height / 2 ** (focusBits + 1)).toBeLessThan(0.001);
  const before = await readCamera(page);
  const target = JSON.parse((await page.locator("#preview").getAttribute("data-zoom-test-target")) ?? "null") as {
    real: string;
    imaginary: string;
  } | null;
  expect(target).toEqual({ real: "-0.777120613150274923773", imaginary: "+0.126857238786361887169" });
  const aimRecordedTarget = async () => {
    const camera = await readCamera(page);
    const focusX = (Number(target!.real) - approximateDyadic(camera.centerX)) / approximateDyadic(camera.viewportScale);
    const focusY = (Number(target!.imaginary) - approximateDyadic(camera.centerY)) / approximateDyadic(camera.viewportScale);
    const pointer = {
      x: bounds.x + bounds.width / 2 + focusX * bounds.height,
      y: bounds.y + bounds.height / 2 - focusY * bounds.height,
    };
    expect(pointer.x).toBeGreaterThan(bounds.x);
    expect(pointer.x).toBeLessThan(bounds.x + bounds.width);
    expect(pointer.y).toBeGreaterThan(bounds.y);
    expect(pointer.y).toBeLessThan(bounds.y + bounds.height);
    await page.mouse.move(pointer.x, pointer.y);
  };
  await aimRecordedTarget();
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await readCamera(page)).epoch > before.epoch).toBe(true);

  const inward = await readCamera(page);
  const inwardFocus = await readLastFocus(page);
  const invariantFocus = worldAtFocus(before, inwardFocus.x, inwardFocus.y);
  expect(worldAtFocus(inward, inwardFocus.x, inwardFocus.y)).toEqual(invariantFocus);
  const halfPointerPixelInWorld = approximateDyadic(before.viewportScale) / bounds.height;
  expect(Math.abs(approximateDyadic(invariantFocus.x) - Number(target!.real))).toBeLessThan(halfPointerPixelInWorld);
  expect(Math.abs(approximateDyadic(invariantFocus.y) - Number(target!.imaginary))).toBeLessThan(halfPointerPixelInWorld);
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await readCamera(page)).epoch > inward.epoch).toBe(true);

  const roundTrip = await readCamera(page);
  expect(await readLastFocus(page)).toEqual(inwardFocus);
  expect(roundTrip.centerX).toEqual(before.centerX);
  expect(roundTrip.centerY).toEqual(before.centerY);
  expect(roundTrip.viewportScale).toEqual(before.viewportScale);

  await page.mouse.down();
  const continuousScales: number[] = [];
  for (let frame = 0; frame < 6; frame += 1) {
    await page.waitForTimeout(55);
    continuousScales.push(approximateDyadic((await readCamera(page)).viewportScale));
  }
  await page.mouse.up();
  expect(new Set(continuousScales).size).toBeGreaterThanOrEqual(5);
  for (let index = 1; index < continuousScales.length; index += 1) {
    expect(continuousScales[index]).toBeLessThan(continuousScales[index - 1]!);
    expect(continuousScales[index]! / continuousScales[index - 1]!).toBeGreaterThan(0.5);
  }
  const heldZoom = await readCamera(page);
  expect(heldZoom.epoch - roundTrip.epoch).toBeGreaterThanOrEqual(2n);
  const heldFocus = await readLastFocus(page);
  expect(worldAtFocus(heldZoom, heldFocus.x, heldFocus.y)).toEqual(worldAtFocus(roundTrip, heldFocus.x, heldFocus.y));
  await expect(page.locator("#preview")).toHaveAttribute("data-presentation-state", "stopped");
  await expect.poll(async () => {
    const queue = JSON.parse((await page.locator("#preview").getAttribute("data-presentation-queue")) ?? "null") as {
      inFlight: number;
      pending: number;
    } | null;
    return queue?.inFlight === 0 && queue.pending === 0;
  }).toBe(true);
  const queue = JSON.parse((await page.locator("#preview").getAttribute("data-presentation-queue")) ?? "null") as {
    maximumInFlight: number;
    maximumPending: number;
    replacedPending: number;
    staleCompletions: number;
  };
  expect(queue.maximumInFlight).toBe(1);
  expect(queue.maximumPending).toBe(1);
  expect(queue.replacedPending).toBeGreaterThanOrEqual(0);
  expect(queue.staleCompletions).toBeGreaterThanOrEqual(0);
  const telemetry = JSON.parse((await page.locator("#preview").getAttribute("data-motion-telemetry")) ?? "null") as {
    frameCount: number;
    maximumFocusErrorPx: number;
    p95FrameMs: number;
    sampleCount: number;
    authority: string;
  } | null;
  expect(telemetry).not.toBeNull();
  expect(telemetry!.frameCount).toBeGreaterThanOrEqual(6);
  expect(telemetry!.sampleCount).toBeGreaterThanOrEqual(4);
  expect(telemetry!.maximumFocusErrorPx).toBeLessThan(0.75);
  expect(telemetry!.p95FrameMs).toBeLessThan(100);
  expect(telemetry!.authority).toBe("presentation-only");
  const iterationPolicy = JSON.parse(
    (await page.locator("#preview").getAttribute("data-iteration-policy")) ?? "null",
  ) as {
    requestedVisibleConvergence: { iterationTarget: number };
    effectiveConvergence: { method: string; iterationTarget: number; iterationFrontier: number; authority: string };
    requestAffectsVisibleConvergence: boolean;
  };
  expect(iterationPolicy).toMatchObject({
    requestedVisibleConvergence: { iterationTarget: 5_000 },
    effectiveConvergence: {
      method: "progressive-direct-f32-v1",
      iterationTarget: 5_000,
      authority: "presentation-only",
    },
    requestAffectsVisibleConvergence: true,
  });
  expect(iterationPolicy.effectiveConvergence.iterationFrontier).toBeGreaterThan(0);
  const scaleTelemetry = JSON.parse(
    (await page.locator("#preview").getAttribute("data-scale-telemetry")) ?? "null",
  ) as Record<string, unknown>;
  const adapter = await page.evaluate(async () => {
    const selected = await navigator.gpu.requestAdapter();
    return selected ? {
      vendor: selected.info.vendor,
      architecture: selected.info.architecture,
      device: selected.info.device,
      description: selected.info.description,
      isFallbackAdapter: selected.info.isFallbackAdapter,
    } : null;
  });
  const task11Evidence = {
    schemaVersion: 1,
    target,
    motion: telemetry,
    queue,
    viewport: {
      width: bounds.width,
      height: bounds.height,
      devicePixelRatio: await page.evaluate(() => devicePixelRatio),
    },
    zoomStepsPerSecond: await page.locator("#preview").getAttribute("data-zoom-steps-per-second"),
    requestedIterationLimit: await page.locator("#preview").getAttribute("data-reference-iteration-limit"),
    previewMode: await page.locator("#preview").getAttribute("data-preview-mode"),
    iterationPolicy,
    scaleTelemetry,
    browserVersion: browser.version(),
    playwrightProject: testInfo.project.name,
    adapter,
  };
  const task11EvidencePath = testInfo.outputPath("task-011-continuous-navigation.json");
  await writeFile(task11EvidencePath, `${JSON.stringify(task11Evidence, null, 2)}\n`, "utf8");
  await testInfo.attach("task-011-continuous-navigation", {
    path: task11EvidencePath,
    contentType: "application/json",
  });

  let previousEpoch = heldZoom.epoch;
  for (let step = 0; step < 40; step += 1) {
    await aimRecordedTarget();
    await page.mouse.wheel(0, -100);
    await expect.poll(async () => (await readCamera(page)).epoch > previousEpoch).toBe(true);
    previousEpoch = (await readCamera(page)).epoch;
    if (await page.locator("#preview").getAttribute("data-state") === "perturbation-preview") break;
  }
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "perturbation-preview");
  await expect(page.locator("#preview")).toHaveAttribute("data-preview-mode", "bounded-f64-reference-compensated-ds-v1");
  await expect.poll(async () => {
    const policy = JSON.parse(
      (await page.locator("#preview").getAttribute("data-iteration-policy")) ?? "null",
    ) as { effectiveConvergence?: { method?: string; iterationTarget?: number; iterationFrontier?: number; complete?: boolean; limitation?: string } };
    return policy.effectiveConvergence;
  }).toMatchObject({
    method: "bounded-f64-reference-compensated-ds-v1",
    iterationTarget: 5_000,
    iterationFrontier: 512,
    complete: false,
    limitation: "reference_path_iteration_limit",
  });
  const limitedCamera = await readCamera(page);
  await aimRecordedTarget();
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await readCamera(page)).epoch > limitedCamera.epoch).toBe(true);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "perturbation-preview");

  await page.getByRole("button", { name: "Reset view" }).click();
  const reset = await readCamera(page);
  expect(reset.centerX).toEqual(before.centerX);
  expect(reset.centerY).toEqual(before.centerY);
  expect(reset.viewportScale).toEqual(before.viewportScale);
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "ready");
});
