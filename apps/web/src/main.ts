import {
  createDirectHarness,
  createMandelbrotPreview,
  createPerturbationPreviewView,
  maximumProgressivePixels,
  perturbationPreviewIterationCap,
  type DirectHarnessResult,
  type DirectSample,
  type MandelbrotPreviewView,
  type ProgressiveRenderResult,
} from "@webgpu-zoomer/gpu-engine";
import {
  add,
  createCamera,
  deserializeCamera,
  deserializeDyadic,
  dyadic,
  interpolateOctaveScale,
  multiply,
  serializeCamera,
  serializeDyadic,
  zoomAbout,
  zoomAboutScale,
  type ExactCamera,
  type ExactDyadic,
} from "@webgpu-zoomer/exact-camera";
import { approximateDyadic, boundedPositiveDyadic } from "@webgpu-zoomer/exact-camera/approximate";
import {
  AcceptedNumericalStore,
  canonicalSampleKey,
  compareGpuCandidate,
  evaluateShallowDirectPublication,
  type OracleResult,
} from "@webgpu-zoomer/numerical-contract";
import {
  AsyncWorkAdmission,
  workItemsFromPlan,
  type AdmissionPolicy,
  type NumericalWorkItem,
  type WorkCompletion,
} from "@webgpu-zoomer/numerical-work";
import {
  createSnapshotCompositor,
  prepareHistoryComposite,
  prepareSnapshotComposite,
  type SnapshotCompositor,
} from "@webgpu-zoomer/presentation-compositor";
import { PresentationHistoryStore } from "@webgpu-zoomer/presentation-history";
import { createPresentationSnapshot, type PresentationSnapshot } from "@webgpu-zoomer/presentation-snapshot";
import { SamplePlanBudgetExceeded, planViewportSampleGrid, serializeSamplePlan, type SamplePlan } from "@webgpu-zoomer/view-planner";
import "./style.css";

type Fixture = {
  id: string;
  cRe: { numerator: string; exponent: string };
  cIm: { numerator: string; exponent: string };
  iterationCap: number;
  precisionBits: number;
  bailoutSquared: number;
  gpuDirect?: { cRe: number; cIm: number };
  expected: {
    status: OracleResult["status"];
    reason: OracleResult["reason"];
    iterations: number;
  };
};

type FixtureCorpus = {
  schemaVersion: number;
  oracleVersion: string;
  cases: Fixture[];
};

type AdapterEvidence = Readonly<{
  info: Readonly<{
    vendor: string;
    architecture: string;
    device: string;
    description: string;
    isFallbackAdapter: boolean;
  }>;
  features: string[];
  limits: Record<string, number>;
}>;

const capabilityNode = document.querySelector<HTMLElement>("#capabilities")!;
const resultNode = document.querySelector<HTMLElement>("#results")!;
const runButton = document.querySelector<HTMLButtonElement>("#run")!;
const previewNode = document.querySelector<HTMLElement>("#preview")!;
const previewStatusNode = document.querySelector<HTMLElement>("#preview-status")!;
const canvas = document.querySelector<HTMLCanvasElement>("#mandelbrot")!;
const snapshotCanvas = document.querySelector<HTMLCanvasElement>("#snapshot-overlay")!;
const cameraReadout = document.querySelector<HTMLElement>("#camera-readout")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-view")!;
const zoomSpeedInput = document.querySelector<HTMLInputElement>("#zoom-speed")!;
const zoomSpeedReadout = document.querySelector<HTMLOutputElement>("#zoom-speed-readout")!;
const referenceIterationsInput = document.querySelector<HTMLInputElement>("#reference-iterations")!;
const referenceIterationsReadout = document.querySelector<HTMLOutputElement>("#reference-iterations-readout")!;

const initialCamera = createCamera(dyadic(-1n, -1n), dyadic(0n, 0n), dyadic(11n, -2n));
const pointerFocusFractionBits = 20;
const maximumReferenceIterations = 50_000;
const maximumReferenceBatchItems = 64;
const maximumReferenceBatchIterations = 100_000;
const maximumReferenceNumeratorBits = 4_096;
const maximumReferenceBatchElapsedMs = 1_000;
const maximumDirectCandidateIterations = 512;
const navigationProgressBits = 30n;
const navigationProgressUnit = 1n << navigationProgressBits;
const maximumNavigationElapsedMicros = 50_000n;
const zoomTestTarget = Object.freeze({
  real: "-0.777120613150274923773",
  imaginary: "+0.126857238786361887169",
});
let zoomStepsPerSecond = Number(zoomSpeedInput.value);
let zoomRateTenths = 56n;
let requestedReferenceIterations = 8;
let presentationStepDurationMs = Math.round(1_000 / zoomStepsPerSecond);
const presentationHistory = new PresentationHistoryStore(4);
let cameraAuthority: ExactCamera = initialCamera;
let latestExactReferenceCoordinate: { x: ExactDyadic; y: ExactDyadic } | undefined;
let renderPreview = () => {};
let currentPresentationView: MandelbrotPreviewView | undefined;
let drawPresentationView = (_view: MandelbrotPreviewView) => {};
let latestConvergenceResult: ProgressiveRenderResult | undefined;
let transitionFrame = 0;
let snapshotCompositor: SnapshotCompositor | undefined;
let snapshotCompositorReady: Promise<SnapshotCompositor> | undefined;
let activePresentationComposite = false;
const motionFrameDurations: number[] = [];
let motionFrameCount = 0;
let maximumFocusErrorPx = 0;
let lastCompletedPresentationTime: number | undefined;
let navigationActive = false;
previewNode.dataset.focusQuantizationBits = pointerFocusFractionBits.toString();
previewNode.dataset.presentationAuthority = "presentation-only";
previewNode.dataset.snapshotState = "none";
previewNode.dataset.zoomTestTarget = JSON.stringify(zoomTestTarget);

function iterationForSliderPosition(position: number): number {
  const normalized = Math.min(1, Math.max(0, position / 1_000));
  const raw = 8 * (maximumReferenceIterations / 8) ** normalized;
  const rounded = raw >= 1_000 ? Math.round(raw / 100) * 100
    : raw >= 100 ? Math.round(raw / 10) * 10
      : Math.round(raw);
  return Math.min(maximumReferenceIterations, Math.max(1, rounded));
}

function sliderPositionForIteration(iterations: number): number {
  return Math.round(1_000 * Math.log(iterations / 8) / Math.log(maximumReferenceIterations / 8));
}

function parseZoomRateTenths(value: string): bigint {
  const match = /^(\d+)(?:\.(\d))?$/.exec(value);
  if (!match) return 56n;
  const tenths = BigInt(match[1]!) * 10n + BigInt(match[2] ?? "0");
  return tenths < 5n ? 5n : tenths > 100n ? 100n : tenths;
}

function publishIterationPolicy(result: ProgressiveRenderResult | null | undefined = latestConvergenceResult): void {
  previewNode.dataset.iterationPolicy = JSON.stringify({
    schemaVersion: 2,
    requestedVisibleConvergence: {
      iterationTarget: requestedReferenceIterations,
      purpose: "visible-current-view-convergence",
    },
    effectiveConvergence: result ? {
      ...result,
      policyVersion: "progressive-convergence-v1",
    } : {
      method: "unresolved",
      iterationTarget: requestedReferenceIterations,
      iterationFrontier: 0,
      dispatchQuantum: null,
      complete: false,
      canContinue: false,
      limitation: "not_started",
      authority: "presentation-only",
      policyVersion: "progressive-convergence-v1",
    },
    requestAffectsVisibleConvergence: true,
    capExhaustionClassification: "unresolved",
  });
}

function updateExplorationControls(): void {
  zoomStepsPerSecond = Number(zoomSpeedInput.value);
  zoomRateTenths = parseZoomRateTenths(zoomSpeedInput.value);
  presentationStepDurationMs = Math.round(1_000 / zoomStepsPerSecond);
  requestedReferenceIterations = iterationForSliderPosition(Number(referenceIterationsInput.value));
  zoomSpeedReadout.value = `${zoomStepsPerSecond.toFixed(1)} steps/s`;
  referenceIterationsReadout.value = requestedReferenceIterations.toLocaleString();
  previewNode.dataset.zoomStepsPerSecond = zoomStepsPerSecond.toFixed(1);
  previewNode.dataset.referenceIterationLimit = requestedReferenceIterations.toString();
  latestConvergenceResult = undefined;
  publishIterationPolicy(null);
  renderPreview();
}

referenceIterationsInput.value = sliderPositionForIteration(requestedReferenceIterations).toString();
zoomSpeedInput.addEventListener("input", updateExplorationControls);
referenceIterationsInput.addEventListener("input", updateExplorationControls);
updateExplorationControls();

const capabilities = {
  crossOriginIsolated,
  sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
  webGpu: "gpu" in navigator,
  userAgent: navigator.userAgent,
};
capabilityNode.textContent = JSON.stringify(capabilities, null, 2);

let gpuSession: Promise<{ adapter: GPUAdapter; device: GPUDevice; environment: AdapterEvidence }> | undefined;

function getGpuSession(): Promise<{ adapter: GPUAdapter; device: GPUDevice; environment: AdapterEvidence }> {
  gpuSession ??= (async () => {
    if (!("gpu" in navigator)) throw new Error("WebGPU is unavailable.");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("WebGPU adapter request returned null.");
    const device = await adapter.requestDevice();
    return { adapter, device, environment: adapterEvidence(adapter) };
  })();
  return gpuSession;
}

function getSnapshotCompositor(): Promise<SnapshotCompositor> {
  snapshotCompositorReady ??= getGpuSession()
    .then(({ device }) => createSnapshotCompositor(device, snapshotCanvas))
    .then((compositor) => {
      snapshotCompositor = compositor;
      return compositor;
    });
  return snapshotCompositorReady;
}

function clearPresentationSnapshot(state: "none" | "invalidated" = "none"): void {
  activePresentationComposite = false;
  snapshotCompositor?.clear();
  previewNode.dataset.snapshotState = state;
  delete previewNode.dataset.snapshotChecksum;
  delete previewNode.dataset.historyFrameId;
  delete previewNode.dataset.historyChecksum;
  delete previewNode.dataset.historyReprojection;
}

async function compositePresentationSnapshot(snapshot: PresentationSnapshot) {
  const prepared = prepareSnapshotComposite(snapshot, cameraAuthority, canvas.width, canvas.height);
  if (!prepared.accepted) {
    clearPresentationSnapshot("invalidated");
    return Object.freeze({ status: "dropped" as const, reason: prepared.reason });
  }
  const compositor = await getSnapshotCompositor();
  compositor.render(prepared);
  activePresentationComposite = true;
  previewNode.dataset.snapshotState = "composited";
  previewNode.dataset.snapshotChecksum = snapshot.checksum;
  delete previewNode.dataset.historyFrameId;
  delete previewNode.dataset.historyChecksum;
  delete previewNode.dataset.historyReprojection;
  return Object.freeze({
    status: "composited" as const,
    snapshotId: prepared.snapshotId,
    checksum: prepared.checksum,
    cellCount: prepared.cellCount,
    acceptedCount: prepared.acceptedCount,
    unresolvedCount: prepared.unresolvedCount,
    transformErrorLimitPx: prepared.transformErrorLimitPx,
  });
}

async function compositePresentationHistory(): Promise<void> {
  const viewportWidth = canvas.width;
  const viewportHeight = canvas.height;
  const selectedCamera = serializeCamera(cameraAuthority);
  const selection = presentationHistory.select(cameraAuthority, viewportWidth, viewportHeight);
  if (!selection.selected) {
    clearPresentationSnapshot("invalidated");
    previewNode.dataset.historySelection = selection.reason;
    return;
  }
  const prepared = prepareHistoryComposite(
    selection.frame,
    selection.reprojection,
    cameraAuthority,
    viewportWidth,
    viewportHeight,
  );
  if (!prepared.accepted) {
    clearPresentationSnapshot("invalidated");
    previewNode.dataset.historySelection = prepared.reason;
    return;
  }
  const compositor = await getSnapshotCompositor();
  if (canvas.width !== viewportWidth || canvas.height !== viewportHeight
    || JSON.stringify(serializeCamera(cameraAuthority)) !== JSON.stringify(selectedCamera)) return;
  compositor.render(prepared);
  activePresentationComposite = true;
  previewNode.dataset.snapshotState = selection.reprojection ? "history-reprojected" : "history-exact";
  previewNode.dataset.historySelection = "selected";
  previewNode.dataset.historyFrameId = selection.frame.frameId;
  previewNode.dataset.historyChecksum = selection.frame.checksum;
  if (selection.reprojection) {
    previewNode.dataset.historyReprojection = JSON.stringify(selection.reprojection);
  } else {
    delete previewNode.dataset.historyReprojection;
  }
  delete previewNode.dataset.snapshotChecksum;
}

function recordLimits(limits: GPUSupportedLimits): Record<string, number> {
  const output: Record<string, number> = {};
  const keys = new Set([
    ...Object.keys(limits),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(limits) as object),
  ]);
  keys.delete("constructor");
  for (const key of [...keys].sort()) {
    const value = limits[key as keyof GPUSupportedLimits];
    if (typeof value === "number") output[key] = value;
  }
  return output;
}

function adapterEvidence(adapter: GPUAdapter): AdapterEvidence {
  const { vendor, architecture, device, description, isFallbackAdapter } = adapter.info;
  return {
    info: { vendor, architecture, device, description, isFallbackAdapter },
    features: [...adapter.features].sort(),
    limits: recordLimits(adapter.limits),
  };
}

function presentationView(camera: ExactCamera): MandelbrotPreviewView | null {
  const centerX = approximateDyadic(camera.centerX);
  const centerY = approximateDyadic(camera.centerY);
  const viewportScale = approximateDyadic(camera.viewportScale);
  if (!centerX || !centerY || !viewportScale || viewportScale.value <= 0) return null;

  const centerX32 = Math.fround(centerX.value);
  const centerY32 = Math.fround(centerY.value);
  const viewportScale32 = Math.fround(viewportScale.value);
  if (!Number.isFinite(viewportScale32) || viewportScale32 <= 0) return null;

  const halfPixelBudget = viewportScale.value / Math.max(2, canvas.height * 2);
  const centerXError = centerX.absoluteError + Math.abs(centerX.value - centerX32);
  const centerYError = centerY.absoluteError + Math.abs(centerY.value - centerY32);
  const scaleError = viewportScale.absoluteError + Math.abs(viewportScale.value - viewportScale32);
  const directApproximate = !Number.isFinite(centerX32) || !Number.isFinite(centerY32)
    || centerXError > halfPixelBudget || centerYError > halfPixelBudget || scaleError > halfPixelBudget;
  if (directApproximate) {
    const referenceX = latestExactReferenceCoordinate ? approximateDyadic(latestExactReferenceCoordinate.x) : centerX;
    const referenceY = latestExactReferenceCoordinate ? approximateDyadic(latestExactReferenceCoordinate.y) : centerY;
    if (referenceX && referenceY) {
      const perturbation = createPerturbationPreviewView({
        centerX: referenceX.value,
        centerY: referenceY.value,
        viewportScale: viewportScale.value,
        referenceOffsetX: centerX.value - referenceX.value,
        referenceOffsetY: centerY.value - referenceY.value,
        iterationCap: perturbationPreviewIterationCap(requestedReferenceIterations),
      });
      if (perturbation) return perturbation;
    }
  }
  if (!Number.isFinite(centerX32) || !Number.isFinite(centerY32)) return null;
  return {
    kind: "direct",
    centerX: centerX32,
    centerY: centerY32,
    viewportScale: viewportScale32,
    approximate: directApproximate,
  };
}

function publishMotionTelemetry(): void {
  const sorted = [...motionFrameDurations].sort((left, right) => left - right);
  const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  previewNode.dataset.motionTelemetry = JSON.stringify({
    schemaVersion: 2,
    frameCount: motionFrameCount,
    maximumFocusErrorPx,
    p95FrameMs: percentile(0.95),
    p99FrameMs: percentile(0.99),
    maximumStallMs: sorted.at(-1) ?? 0,
    sampleCount: sorted.length,
    timingSource: "gpu-queue-completion",
    authority: "presentation-only",
  });
}

function recordCompletedPresentation(time: number): void {
  motionFrameCount += 1;
  if (lastCompletedPresentationTime !== undefined) {
    motionFrameDurations.push(time - lastCompletedPresentationTime);
    if (motionFrameDurations.length > 512) motionFrameDurations.shift();
  }
  lastCompletedPresentationTime = time;
  publishMotionTelemetry();
}

function startPresentationTransition(focus: { x: ExactDyadic; y: ExactDyadic }): void {
  const target = presentationView(cameraAuthority);
  updateCameraReadout();
  if (!target) {
    cancelAnimationFrame(transitionFrame);
    previewStatusNode.textContent = "Exact camera active · preview representation unavailable";
    previewNode.dataset.state = "preview-unavailable";
    previewNode.dataset.presentationState = "unresolved";
    return;
  }

  const start = currentPresentationView ?? target;
  if (start.kind !== "direct" || target.kind !== "direct") {
    cancelAnimationFrame(transitionFrame);
    drawPresentationView(target);
    previewNode.dataset.presentationState = "settled";
    return;
  }
  const focusX = approximateDyadic(focus.x);
  const focusY = approximateDyadic(focus.y);
  if (!focusX || !focusY) {
    drawPresentationView(target);
    return;
  }
  const focusWorldX = start.centerX + focusX.value * start.viewportScale;
  const focusWorldY = start.centerY + focusY.value * start.viewportScale;
  const scaleRatio = target.viewportScale / start.viewportScale;
  const startedAt = performance.now();
  cancelAnimationFrame(transitionFrame);
  previewNode.dataset.presentationState = "interpolating";

  const animate = (time: number) => {
    const progress = Math.min(1, (time - startedAt) / presentationStepDurationMs);
    const scale = start.viewportScale * scaleRatio ** progress;
    const view = progress === 1 ? target : {
      kind: "direct" as const,
      centerX: focusWorldX - focusX.value * scale,
      centerY: focusWorldY - focusY.value * scale,
      viewportScale: scale,
      approximate: start.approximate || target.approximate,
    };
    const displayedCenterX = Math.fround(view.centerX);
    const displayedCenterY = Math.fround(view.centerY);
    const displayedScale = Math.fround(view.viewportScale);
    const actualFocusX = displayedCenterX + focusX.value * displayedScale;
    const actualFocusY = displayedCenterY + focusY.value * displayedScale;
    const focusErrorPx = Math.hypot(actualFocusX - focusWorldX, actualFocusY - focusWorldY)
      * canvas.clientHeight / displayedScale;
    maximumFocusErrorPx = Math.max(maximumFocusErrorPx, focusErrorPx);
    drawPresentationView(view);

    if (progress < 1) {
      transitionFrame = requestAnimationFrame(animate);
    } else {
      previewNode.dataset.presentationState = "settled";
    }
  };
  transitionFrame = requestAnimationFrame(animate);
}

function updateCameraReadout(): void {
  const encoded = serializeCamera(cameraAuthority);
  previewNode.dataset.camera = JSON.stringify(encoded);
  const scale = boundedPositiveDyadic(cameraAuthority.viewportScale);
  const initialScale = boundedPositiveDyadic(initialCamera.viewportScale);
  if (!scale || !initialScale) {
    previewNode.dataset.scaleTelemetry = JSON.stringify({ schemaVersion: 1, state: "unavailable" });
    cameraReadout.textContent = "Exact camera active · bounded scale unavailable";
    return;
  }
  const depthExponent = initialScale.binaryExponent - scale.binaryExponent;
  const depthOctaves = depthExponent >= BigInt(Number.MIN_SAFE_INTEGER)
    && depthExponent <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(depthExponent) + Math.log2(initialScale.significand / scale.significand)
    : null;
  const magnification = depthOctaves !== null && Math.abs(depthOctaves) < 40
    ? `${(2 ** depthOctaves).toLocaleString(undefined, { maximumFractionDigits: 2 })}×`
    : depthOctaves !== null
      ? `2^${depthOctaves.toLocaleString(undefined, { maximumFractionDigits: 2 })}×`
      : `2^${depthExponent.toString()}× (bounded)`;
  const scaleLabel = `${scale.significand.toPrecision(8)} × 2^${scale.binaryExponent.toString()}`;
  previewNode.dataset.scaleTelemetry = JSON.stringify({
    schemaVersion: 1,
    state: "bounded",
    scale: {
      significand: scale.significand,
      binaryExponent: scale.binaryExponent.toString(),
      significandError: scale.significandError,
    },
    depth: {
      octaves: depthOctaves,
      integerExponentDifference: depthExponent.toString(),
    },
    authority: "presentation-only",
  });
  cameraReadout.textContent = `${magnification} · scale ${scaleLabel}`;
}

function exactPointerFocus(event: PointerEvent | WheelEvent): { x: ExactDyadic; y: ExactDyadic } {
  const bounds = canvas.getBoundingClientRect();
  const focusGrid = 2 ** pointerFocusFractionBits;
  const x = (event.clientX - bounds.left - bounds.width / 2) / bounds.height;
  const y = (bounds.height / 2 - (event.clientY - bounds.top)) / bounds.height;
  return {
    x: dyadic(BigInt(Math.round(x * focusGrid)), BigInt(-pointerFocusFractionBits)),
    y: dyadic(BigInt(Math.round(y * focusGrid)), BigInt(-pointerFocusFractionBits)),
  };
}

function worldAtFocus(camera: ExactCamera, focus: { x: ExactDyadic; y: ExactDyadic }): { x: ExactDyadic; y: ExactDyadic } {
  return {
    x: add(camera.centerX, multiply(focus.x, camera.viewportScale)),
    y: add(camera.centerY, multiply(focus.y, camera.viewportScale)),
  };
}

function applyExactZoom(focus: { x: ExactDyadic; y: ExactDyadic }, exponentDelta: -1n | 1n): void {
  clearPresentationSnapshot("invalidated");
  previewNode.dataset.lastFocus = JSON.stringify({
    x: serializeDyadic(focus.x),
    y: serializeDyadic(focus.y),
  });
  const invariantFocus = worldAtFocus(cameraAuthority, focus);
  latestExactReferenceCoordinate = invariantFocus;
  cameraAuthority = zoomAbout(cameraAuthority, focus.x, focus.y, exponentDelta);
  void compositePresentationHistory();
  const nextFocus = worldAtFocus(cameraAuthority, focus);
  if (invariantFocus.x.numerator !== nextFocus.x.numerator
    || invariantFocus.x.exponent !== nextFocus.x.exponent
    || invariantFocus.y.numerator !== nextFocus.y.numerator
    || invariantFocus.y.exponent !== nextFocus.y.exponent) {
    throw new Error("Exact pointer-focus invariant failed.");
  }
  startPresentationTransition(focus);
}

function applyContinuousScale(focus: { x: ExactDyadic; y: ExactDyadic }, nextScale: ExactDyadic): void {
  previewNode.dataset.lastFocus = JSON.stringify({
    x: serializeDyadic(focus.x),
    y: serializeDyadic(focus.y),
  });
  const invariantFocus = worldAtFocus(cameraAuthority, focus);
  latestExactReferenceCoordinate = invariantFocus;
  cameraAuthority = zoomAboutScale(cameraAuthority, focus.x, focus.y, nextScale);
  const nextFocus = worldAtFocus(cameraAuthority, focus);
  if (invariantFocus.x.numerator !== nextFocus.x.numerator
    || invariantFocus.x.exponent !== nextFocus.x.exponent
    || invariantFocus.y.numerator !== nextFocus.y.numerator
    || invariantFocus.y.exponent !== nextFocus.y.exponent) {
    throw new Error("Exact continuous pointer-focus invariant failed.");
  }
  updateCameraReadout();
  const view = presentationView(cameraAuthority);
  if (!view) {
    previewNode.dataset.presentationState = "unresolved";
    return;
  }
  if (view.kind === "direct") {
    const focusX = approximateDyadic(focus.x);
    const focusY = approximateDyadic(focus.y);
    const worldX = approximateDyadic(invariantFocus.x);
    const worldY = approximateDyadic(invariantFocus.y);
    if (focusX && focusY && worldX && worldY) {
      const actualX = Math.fround(view.centerX) + focusX.value * Math.fround(view.viewportScale);
      const actualY = Math.fround(view.centerY) + focusY.value * Math.fround(view.viewportScale);
      maximumFocusErrorPx = Math.max(maximumFocusErrorPx,
        Math.hypot(actualX - worldX.value, actualY - worldY.value) * canvas.clientHeight / view.viewportScale);
    }
  }
  drawPresentationView(view);
  previewNode.dataset.presentationState = "navigating";
}

function installCameraInteraction(): void {
  type HoldState = {
    pointerId: number;
    direction: -1n | 1n;
    focus: { x: ExactDyadic; y: ExactDyadic };
    octaveScale: ExactDyadic;
    progress: bigint;
    lastTime: number;
    frame: number;
  };
  let hold: HoldState | undefined;

  const continueHold = (time: number) => {
    const active = hold;
    if (!active) return;
    const elapsedMicros = BigInt(Math.max(0, Math.round((time - active.lastTime) * 1_000)));
    const boundedElapsed = elapsedMicros > maximumNavigationElapsedMicros
      ? maximumNavigationElapsedMicros
      : elapsedMicros;
    active.lastTime = time;
    active.progress += boundedElapsed * zoomRateTenths * navigationProgressUnit / 10_000_000n;

    while (active.progress >= navigationProgressUnit) {
      const endpoint = interpolateOctaveScale(
        active.octaveScale,
        navigationProgressUnit,
        navigationProgressBits,
        active.direction,
      );
      applyContinuousScale(active.focus, endpoint);
      active.octaveScale = endpoint;
      active.progress -= navigationProgressUnit;
    }
    if (active.progress > 0n) {
      applyContinuousScale(active.focus, interpolateOctaveScale(
        active.octaveScale,
        active.progress,
        navigationProgressBits,
        active.direction,
      ));
    }
    active.frame = requestAnimationFrame(continueHold);
  };

  const stopHold = (event: PointerEvent) => {
    if (!hold || event.pointerId !== hold.pointerId) return;
    cancelAnimationFrame(hold.frame);
    hold = undefined;
    navigationActive = false;
    previewNode.dataset.presentationState = "stopped";
    if (currentPresentationView) drawPresentationView(currentPresentationView);
    void compositePresentationHistory();
  };

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    cancelAnimationFrame(transitionFrame);
    motionFrameDurations.length = 0;
    motionFrameCount = 0;
    maximumFocusErrorPx = 0;
    lastCompletedPresentationTime = undefined;
    clearPresentationSnapshot("invalidated");
    navigationActive = true;
    canvas.setPointerCapture(event.pointerId);
    hold = {
      pointerId: event.pointerId,
      direction: event.button === 2 || event.shiftKey ? 1n : -1n,
      focus: exactPointerFocus(event),
      octaveScale: cameraAuthority.viewportScale,
      progress: 0n,
      lastTime: performance.now(),
      frame: requestAnimationFrame(continueHold),
    };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (hold && event.pointerId === hold.pointerId) hold.focus = exactPointerFocus(event);
  });
  canvas.addEventListener("pointerup", stopHold);
  canvas.addEventListener("pointercancel", stopHold);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    applyExactZoom(exactPointerFocus(event), event.deltaY < 0 ? -1n : 1n);
  }, { passive: false });
  resetButton.addEventListener("click", () => {
    if (hold) {
      cancelAnimationFrame(hold.frame);
      hold = undefined;
    }
    navigationActive = false;
    cancelAnimationFrame(transitionFrame);
    clearPresentationSnapshot("invalidated");
    latestExactReferenceCoordinate = undefined;
    cameraAuthority = createCamera(
      initialCamera.centerX,
      initialCamera.centerY,
      initialCamera.viewportScale,
      cameraAuthority.epoch + 1n,
    );
    renderPreview();
    void compositePresentationHistory();
  });
}

async function initializePreview(): Promise<void> {
  try {
    const { device, environment } = await getGpuSession();
    const [preview] = await Promise.all([
      createMandelbrotPreview(device, canvas),
      getSnapshotCompositor(),
    ]);
    const adapterLabel = `${environment.info.vendor || "WebGPU"} ${environment.info.architecture}`.trim();
    type PresentationRequest = Readonly<{
      id: number;
      view: MandelbrotPreviewView;
      iterationTarget: number;
      collectCoverage: boolean;
      requestedAt: number;
    }>;
    let nextRequestId = 0;
    let latestRequestId = 0;
    let renderInFlight = false;
    let pendingRequest: PresentationRequest | undefined;
    const queueTelemetry = {
      submitted: 0,
      completed: 0,
      replacedPending: 0,
      staleCompletions: 0,
      maximumInFlight: 0,
      maximumPending: 0,
      maximumRequestLatencyMs: 0,
    };
    const publishQueueTelemetry = () => {
      previewNode.dataset.presentationQueue = JSON.stringify({
        ...queueTelemetry,
        inFlight: renderInFlight ? 1 : 0,
        pending: pendingRequest ? 1 : 0,
      });
    };
    const publishViewState = (view: MandelbrotPreviewView, result: ProgressiveRenderResult) => {
      latestConvergenceResult = result;
      publishIterationPolicy(result);
      if (view.kind === "perturbation") {
        previewStatusNode.textContent = result.complete
          ? "Compensated perturbation preview · non-authoritative"
          : "Compensated perturbation compatibility preview · stronger reference path unresolved";
        previewNode.dataset.state = "perturbation-preview";
        previewNode.dataset.previewMode = view.previewMode;
      } else if (view.approximate) {
        previewStatusNode.textContent = `Progressive approximate direct preview · ${result.iterationFrontier.toLocaleString()}/${result.iterationTarget.toLocaleString()} iterations`;
        previewNode.dataset.state = "approximate-preview";
        previewNode.dataset.previewMode = result.method;
      } else {
        previewStatusNode.textContent = `${adapterLabel} · progressive ${result.iterationFrontier.toLocaleString()}/${result.iterationTarget.toLocaleString()}`;
        previewNode.dataset.state = "ready";
        previewNode.dataset.previewMode = result.method;
      }
    };
    const submitLatestPresentation = () => {
      if (renderInFlight || !pendingRequest) return;
      const request = pendingRequest;
      pendingRequest = undefined;
      renderInFlight = true;
      queueTelemetry.submitted += 1;
      queueTelemetry.maximumInFlight = Math.max(queueTelemetry.maximumInFlight, 1);
      publishQueueTelemetry();
      void preview.render(request.view, request.iterationTarget, request.collectCoverage).then((result) => {
        const completedAt = performance.now();
        renderInFlight = false;
        queueTelemetry.completed += 1;
        queueTelemetry.maximumRequestLatencyMs = Math.max(
          queueTelemetry.maximumRequestLatencyMs,
          completedAt - request.requestedAt,
        );
        if (navigationActive) recordCompletedPresentation(completedAt);
        if (request.id === latestRequestId) {
          currentPresentationView = request.view;
          publishViewState(request.view, result);
        } else {
          queueTelemetry.staleCompletions += 1;
        }
        publishQueueTelemetry();
        if (request.id === latestRequestId && result.canContinue) drawPresentationView(request.view);
        submitLatestPresentation();
      }).catch((error: unknown) => {
        renderInFlight = false;
        previewStatusNode.textContent = error instanceof Error ? error.message : String(error);
        previewNode.dataset.state = "error";
        publishQueueTelemetry();
        submitLatestPresentation();
      });
    };
    drawPresentationView = (view) => {
      const cssPixels = Math.max(1, canvas.clientWidth * canvas.clientHeight);
      const resourceDensity = Math.sqrt(maximumProgressivePixels / cssPixels);
      const density = Math.min(window.devicePixelRatio, 2, resourceDensity);
      const width = Math.max(1, Math.round(canvas.clientWidth * density));
      const height = Math.max(1, Math.round(canvas.clientHeight * density));
      if (canvas.width !== width || canvas.height !== height) {
        if (activePresentationComposite) clearPresentationSnapshot("invalidated");
        canvas.width = width;
        canvas.height = height;
        snapshotCanvas.width = width;
        snapshotCanvas.height = height;
      }
      if (pendingRequest) queueTelemetry.replacedPending += 1;
      const request = {
        id: ++nextRequestId,
        view,
        iterationTarget: requestedReferenceIterations,
        collectCoverage: !navigationActive,
        requestedAt: performance.now(),
      };
      latestRequestId = request.id;
      pendingRequest = request;
      queueTelemetry.maximumPending = Math.max(queueTelemetry.maximumPending, 1);
      publishQueueTelemetry();
      submitLatestPresentation();
    };
    renderPreview = () => {
      cancelAnimationFrame(transitionFrame);
      const view = presentationView(cameraAuthority);
      updateCameraReadout();
      if (!view) {
        latestConvergenceResult = undefined;
        publishIterationPolicy(null);
        previewStatusNode.textContent = "Exact camera active · preview representation unavailable";
        previewNode.dataset.state = "preview-unavailable";
        previewNode.dataset.presentationState = "unresolved";
        return;
      }
      drawPresentationView(view);
      previewNode.dataset.presentationState = "settled";
    };
    new ResizeObserver(() => currentPresentationView ? drawPresentationView(currentPresentationView) : renderPreview()).observe(canvas);
    installCameraInteraction();
    renderPreview();
  } catch (error) {
    previewStatusNode.textContent = error instanceof Error ? error.message : String(error);
    previewNode.dataset.state = "error";
  }
}

void initializePreview();

let messageId = 0;
function evaluateInWorker(worker: Worker, request: unknown): Promise<OracleResult> {
  const id = messageId++;
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<{ id: number; response: OracleResult }>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener("message", listener);
      resolve(event.data.response);
    };
    worker.addEventListener("message", listener);
    worker.addEventListener("error", reject, { once: true });
    worker.postMessage({ id, request });
  });
}

function exactF32Coordinate(value: { numerator: string; exponent: string }): number | undefined {
  const approximation = approximateDyadic(deserializeDyadic(value));
  if (!approximation || approximation.absoluteError !== 0) return undefined;
  const f32 = Math.fround(approximation.value);
  return Object.is(f32, approximation.value) ? f32 : undefined;
}

type BoundedReferenceRequest = Readonly<{
  schemaVersion: 1;
  cRe: { numerator: string; exponent: string };
  cIm: { numerator: string; exponent: string };
  iterationCap: number;
  precisionBits: number;
  bailoutSquared: number;
}>;

function unresolvedReference(workingPrecisionBits = 64): OracleResult {
  return {
    status: "unresolved",
    reason: "resource_budget_exhausted",
    iterations: 0,
    workingPrecisionBits,
  };
}

function partitionBoundedReferenceRequests(
  requests: readonly BoundedReferenceRequest[],
): readonly (readonly BoundedReferenceRequest[])[] {
  const batches: BoundedReferenceRequest[][] = [];
  let batch: BoundedReferenceRequest[] = [];
  let totalIterations = 0;
  for (const request of requests) {
    if (request.iterationCap > maximumReferenceIterations) {
      batches.push([request]);
      continue;
    }
    if (batch.length === maximumReferenceBatchItems
      || totalIterations + request.iterationCap > maximumReferenceBatchIterations) {
      if (batch.length > 0) batches.push(batch);
      batch = [];
      totalIterations = 0;
    }
    batch.push(request);
    totalIterations += request.iterationCap;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

function evaluateBoundedBatchInWorker(
  worker: Worker,
  requests: readonly BoundedReferenceRequest[],
): Promise<readonly OracleResult[] | undefined> {
  const id = messageId++;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: readonly OracleResult[] | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.removeEventListener("message", messageListener);
      worker.removeEventListener("error", errorListener);
      resolve(result);
    };
    const messageListener = (event: MessageEvent<{ id: number; response: unknown }>) => {
      if (event.data.id !== id) return;
      finish(Array.isArray(event.data.response) ? event.data.response as OracleResult[] : undefined);
    };
    const errorListener = () => finish(undefined);
    const timeout = setTimeout(() => finish(undefined), maximumReferenceBatchElapsedMs);
    worker.addEventListener("message", messageListener);
    worker.addEventListener("error", errorListener, { once: true });
    try {
      worker.postMessage({
        id,
        kind: "batch",
        request: {
          schemaVersion: 1,
          requests,
          limits: {
            maximumItems: maximumReferenceBatchItems,
            maximumTotalIterations: maximumReferenceBatchIterations,
            maximumNumeratorBits: maximumReferenceNumeratorBits,
          },
        },
      });
    } catch {
      finish(undefined);
    }
  });
}

async function evaluateBoundedReference(
  requests: readonly BoundedReferenceRequest[],
): Promise<readonly OracleResult[]> {
  let worker = new Worker(new URL("./oracle.worker.ts", import.meta.url), { type: "module" });
  const results: OracleResult[] = [];
  try {
    for (const batch of partitionBoundedReferenceRequests(requests)) {
      const response = await evaluateBoundedBatchInWorker(worker, batch);
      if (!response || response.length !== batch.length) {
        worker.terminate();
        results.push(...batch.map((request) => unresolvedReference(request.precisionBits)));
        worker = new Worker(new URL("./oracle.worker.ts", import.meta.url), { type: "module" });
      } else {
        results.push(...response);
      }
    }
    return results;
  } finally {
    worker.terminate();
  }
}

function planBoundedReferenceGrid(camera: ExactCamera): SamplePlan {
  const maximumSamples = Math.max(8, Math.floor(maximumReferenceBatchIterations / requestedReferenceIterations));
  let lastBudgetError: SamplePlanBudgetExceeded | undefined;
  for (const samplesPerAxis of [8, 4, 2, 1]) {
    try {
      return planViewportSampleGrid(camera, {
        formulaId: "mandelbrot",
        formulaVersion: 1,
        samplingVersion: 1,
        samplesPerAxis,
        maximumSamples,
        viewportWidth: Math.max(1, canvas.width),
        viewportHeight: Math.max(1, canvas.height),
      });
    } catch (error) {
      if (error instanceof SamplePlanBudgetExceeded) {
        lastBudgetError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastBudgetError ?? new Error("No bounded reference sample grid is available.");
}

async function executePlannedShallowBatch(
  items: readonly NumericalWorkItem[],
  runDirect: (samples: readonly DirectSample[]) => Promise<DirectHarnessResult[]>,
): Promise<readonly WorkCompletion[]> {
  const oraclePromise = evaluateBoundedReference(items.map((item) => ({
    schemaVersion: 1,
    cRe: item.identity.cRe,
    cIm: item.identity.cIm,
    iterationCap: item.progress.iterationBudget,
    precisionBits: 64,
    bailoutSquared: 4,
  })));
  const directIndexes: number[] = [];
  const directSamples: DirectSample[] = [];
  const plannedIterationBudget = items[0]?.progress.iterationBudget;
  if (plannedIterationBudget !== undefined && plannedIterationBudget <= maximumDirectCandidateIterations) {
    items.forEach((item, index) => {
      const cRe = exactF32Coordinate(item.identity.cRe);
      const cIm = exactF32Coordinate(item.identity.cIm);
      if (cRe === undefined || cIm === undefined) return;
      directIndexes.push(index);
      directSamples.push({ cRe, cIm, iterationCap: item.progress.iterationBudget, bailoutSquared: 4 });
    });
  }
  const [oracle, gpuResults] = await Promise.all([oraclePromise, runDirect(directSamples)]);
  const gpuByIndex = new Map(directIndexes.map((itemIndex, offset) => [itemIndex, gpuResults[offset]!]));
  return items.map((item, index) => ({
    workId: item.id,
    key: item.key,
    requestEpoch: item.requestEpoch,
    methodVersion: item.method.version,
    oracleVersion: item.reference.version,
    candidate: gpuByIndex.get(index)?.candidate
      ?? { status: "unresolved", iterations: 0, reason: "gpu_candidate_only" },
    oracle: oracle[index] ?? unresolvedReference(),
  }));
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  resultNode.dataset.state = "running";
  try {
    if (!capabilities.crossOriginIsolated || !capabilities.sharedArrayBuffer) {
      throw new Error("Cross-origin isolation/shared memory requirement is not satisfied.");
    }
    if (!("gpu" in navigator)) throw new Error("WebGPU is unavailable.");
    const response = await fetch(`${import.meta.env.BASE_URL}fixtures/oracle-corpus-v1.json`);
    const corpus = await response.json() as FixtureCorpus;
    const worker = new Worker(new URL("./oracle.worker.ts", import.meta.url), { type: "module" });
    try {
      const oracle = await Promise.all(corpus.cases.map((fixture) => evaluateInWorker(worker, {
        schemaVersion: 1,
        cRe: fixture.cRe,
        cIm: fixture.cIm,
        iterationCap: fixture.iterationCap,
        precisionBits: fixture.precisionBits,
        bailoutSquared: fixture.bailoutSquared,
      })));

      const samplePlan = planBoundedReferenceGrid(cameraAuthority);

      const { device, environment } = await getGpuSession();
      const runDirect = await createDirectHarness(device);
      const directIndexes = corpus.cases.flatMap((fixture, index) => fixture.gpuDirect ? [index] : []);
      const directSamples: DirectSample[] = directIndexes.map((index) => {
        const fixture = corpus.cases[index]!;
        return {
          cRe: fixture.gpuDirect!.cRe,
          cIm: fixture.gpuDirect!.cIm,
          iterationCap: fixture.iterationCap,
          bailoutSquared: fixture.bailoutSquared,
        };
      });
      const gpuResults = await runDirect(directSamples);
      const acceptedStore = new AcceptedNumericalStore();
      const differential = gpuResults.map((gpu, offset) => {
        const index = directIndexes[offset]!;
        const fixture = corpus.cases[index]!;
        const oracleResult = oracle[index]!;
        const publication = evaluateShallowDirectPublication({
          identity: {
            formulaId: "mandelbrot",
            formulaVersion: 1,
            cRe: fixture.cRe,
            cIm: fixture.cIm,
            samplingVersion: 1,
          },
          requestEpoch: cameraAuthority.epoch,
          candidate: gpu.candidate,
          oracle: oracleResult,
          oracleVersion: corpus.oracleVersion,
          methodVersion: "gpu-direct-f32-v1",
        });
        const storeWrite = publication.accepted ? acceptedStore.publish(publication.sample) : undefined;
        return {
          id: fixture.id,
          gpu,
          oracle: oracleResult,
          comparison: compareGpuCandidate(gpu.candidate, oracleResult),
          publication: publication.accepted
            ? { accepted: true, key: publication.sample.key, storeWrite }
            : publication,
        };
      });
      const oracleChecks = corpus.cases.map((fixture, index) => {
        const actual = oracle[index]!;
        const matches = actual.status === fixture.expected.status
          && actual.reason === fixture.expected.reason
          && actual.iterations === fixture.expected.iterations;
        return { id: fixture.id, expected: fixture.expected, actual, matches };
      });
      const differentialChecks = differential.map((entry) => ({
        ...entry,
        matches: entry.gpu.candidate.status === entry.oracle.status
          && entry.gpu.candidate.iterations === entry.oracle.iterations,
      }));
      const intentionalInsufficient = oracleChecks.find((entry) => entry.id === "intentional-insufficient-bound");
      const scheduledStore = new AcceptedNumericalStore();
      const scheduledPolicy: AdmissionPolicy = {
        maximumPendingItems: 512,
        iterationBudget: requestedReferenceIterations,
        methodVersion: "gpu-direct-f32-v1",
        oracleVersion: corpus.oracleVersion,
      };
      const workAdmission = new AsyncWorkAdmission(scheduledStore, scheduledPolicy);
      const admissionStart = performance.now();
      const admission = workAdmission.admit(
        samplePlan,
        (items) => executePlannedShallowBatch(items, runDirect),
      );
      const admissionCallMs = performance.now() - admissionStart;
      const workImmediatelyAfterAdmission = workAdmission.diagnostics();
      await workAdmission.whenIdle();
      const workDiagnostics = workAdmission.diagnostics();
      const acceptedSnapshot = acceptedStore.snapshot();
      const scheduledAcceptedSnapshot = scheduledStore.snapshot();
      const scheduledAcceptedKeys = new Set(scheduledAcceptedSnapshot.map((sample) => sample.key));
      const unresolvedCoverage = workItemsFromPlan(samplePlan, scheduledPolicy)
        .filter((item) => !scheduledAcceptedKeys.has(canonicalSampleKey(item.identity)))
        .map((item) => Object.freeze({ key: item.key, reason: "not_published" as const }));
      const presentationSnapshot = createPresentationSnapshot({
        plan: samplePlan,
        acceptedSamples: scheduledAcceptedSnapshot,
        unresolvedCoverage,
      });
      const presentationComposite = await compositePresentationSnapshot(presentationSnapshot);
      const historyPublish = presentationHistory.publish(presentationSnapshot);
      const historySelection = presentationHistory.select(cameraAuthority, canvas.width, canvas.height);
      const invalidHistoryProbe = new PresentationHistoryStore(1);
      invalidHistoryProbe.publish(presentationSnapshot);
      const invalidHistoryCamera = zoomAbout(
        deserializeCamera(presentationSnapshot.camera),
        dyadic(0n, 0n),
        dyadic(0n, 0n),
        -2n,
      );
      const invalidHistorySelection = invalidHistoryProbe.select(invalidHistoryCamera, canvas.width, canvas.height);
      const historyDiagnostics = presentationHistory.diagnostics();
      const historyChecksum = presentationHistory.checksum();
      const summary = {
        fixtureCount: corpus.cases.length,
        selectedReferenceIterationLimit: requestedReferenceIterations,
        referenceBatchLimits: {
          maximumItems: maximumReferenceBatchItems,
          maximumTotalIterations: maximumReferenceBatchIterations,
          maximumNumeratorBits: maximumReferenceNumeratorBits,
          maximumElapsedMs: maximumReferenceBatchElapsedMs,
        },
        oracleMismatchCount: oracleChecks.filter((entry) => !entry.matches).length,
        gpuDifferentialCount: differentialChecks.length,
        gpuMismatchCount: differentialChecks.filter((entry) => !entry.matches).length,
        acceptedGpuEscapes: acceptedStore.size,
        acceptedStoreChecksum: acceptedStore.checksum(),
        plannedSampleCount: samplePlan.samples.length,
        samplePlanChecksum: samplePlan.checksum,
        samplePlanLevel: samplePlan.level.toString(),
        scheduledAcceptedCount: scheduledStore.size,
        scheduledStoreChecksum: scheduledStore.checksum(),
        presentationSnapshotChecksum: presentationSnapshot.checksum,
        presentationAcceptedCount: presentationSnapshot.counts.accepted,
        presentationUnresolvedCount: presentationSnapshot.counts.unresolved,
        presentationHistoryChecksum: historyChecksum,
        presentationHistoryResidentViews: historyDiagnostics.residentViews,
        intentionalInsufficientBoundPassed: intentionalInsufficient?.actual.status === "unresolved"
          && intentionalInsufficient.actual.reason === "insufficient_precision",
        fallbackAdapter: environment.info.isFallbackAdapter,
      };
      const scheduledPassed = admission.accepted
        && workDiagnostics.completedItems === samplePlan.samples.length
        && workDiagnostics.publishedItems + workDiagnostics.unresolvedItems === samplePlan.samples.length
        && workDiagnostics.publishedItems === scheduledStore.size
        && workDiagnostics.staleItems === 0
        && workDiagnostics.conflictItems === 0
        && workDiagnostics.failedItems === 0
        && workDiagnostics.budgetRejectedItems === 0;
      const presentationPassed = presentationSnapshot.sourcePlanId === samplePlan.planId
        && presentationSnapshot.authority === "presentation-only"
        && presentationSnapshot.counts.total === samplePlan.samples.length
        && presentationSnapshot.counts.accepted === scheduledStore.size
        && presentationSnapshot.counts.unresolved === workDiagnostics.unresolvedItems
        && presentationSnapshot.counts.accepted + presentationSnapshot.counts.unresolved
          === presentationSnapshot.counts.total;
      const presentationCompositePassed = presentationComposite.status === "composited"
        ? presentationComposite.checksum === presentationSnapshot.checksum
          && presentationComposite.cellCount === presentationSnapshot.counts.total
          && presentationComposite.acceptedCount === presentationSnapshot.counts.accepted
          && presentationComposite.unresolvedCount === presentationSnapshot.counts.unresolved
        : presentationComposite.reason === "camera_mismatch" || presentationComposite.reason === "viewport_mismatch";
      const historyPassed = historyPublish.status !== "rejected"
        && invalidHistorySelection.selected === false
        && invalidHistorySelection.reason === "invalid_transform"
        && (historySelection.selected
          ? historySelection.frame.counts.accepted >= presentationSnapshot.counts.accepted
            && historySelection.frame.counts.unresolved <= presentationSnapshot.counts.unresolved
          : presentationComposite.status === "dropped" && historySelection.reason === "invalid_transform");
      const passed = summary.oracleMismatchCount === 0
        && summary.gpuMismatchCount === 0
        && summary.intentionalInsufficientBoundPassed
        && scheduledPassed
        && presentationPassed
        && presentationCompositePassed
        && historyPassed
        && !summary.fallbackAdapter;
      resultNode.textContent = JSON.stringify({
        schemaVersion: 1,
        status: passed ? "passed" : "failed",
        capabilities,
        environment,
        summary,
        samplePlan: serializeSamplePlan(samplePlan),
        workAdmission: {
          admission: { ...admission, requestEpoch: admission.requestEpoch.toString() },
          admissionCallMs,
          immediatelyAfterAdmission: workImmediatelyAfterAdmission,
          settled: workDiagnostics,
          acceptedStore: scheduledAcceptedSnapshot,
        },
        presentationSnapshot,
        presentationComposite,
        presentationHistory: {
          publish: historyPublish,
          selection: historySelection.selected
            ? {
                selected: true,
                viewKey: historySelection.frame.viewKey,
                frameId: historySelection.frame.frameId,
                requestEpoch: historySelection.frame.requestEpoch,
                counts: historySelection.frame.counts,
              }
            : historySelection,
          invalidTransformSelection: invalidHistorySelection,
          diagnostics: historyDiagnostics,
          checksum: historyChecksum,
        },
        acceptedStore: acceptedSnapshot,
        oracleChecks,
        differentialChecks,
      }, null, 2);
      resultNode.dataset.state = passed ? "passed" : "failed";
    } finally {
      worker.terminate();
    }
  } catch (error) {
    resultNode.textContent = JSON.stringify({ capabilities, error: error instanceof Error ? error.message : String(error) }, null, 2);
    resultNode.dataset.state = "error";
  } finally {
    runButton.disabled = false;
  }
});
