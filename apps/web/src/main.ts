import {
  createDirectHarness,
  createMandelbrotPreview,
  type DirectSample,
  type MandelbrotPreviewView,
} from "@webgpu-zoomer/gpu-engine";
import {
  add,
  createCamera,
  dyadic,
  multiply,
  serializeCamera,
  serializeDyadic,
  zoomAbout,
  type ExactCamera,
  type ExactDyadic,
} from "@webgpu-zoomer/exact-camera";
import { approximateDyadic } from "@webgpu-zoomer/exact-camera/approximate";
import { compareGpuCandidate, type OracleResult } from "@webgpu-zoomer/numerical-contract";
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
const cameraReadout = document.querySelector<HTMLElement>("#camera-readout")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-view")!;

const initialCamera = createCamera(dyadic(-1n, -1n), dyadic(0n, 0n), dyadic(11n, -2n));
const pointerFocusFractionBits = 20;
const presentationStepDurationMs = 180;
let cameraAuthority: ExactCamera = initialCamera;
let renderPreview = () => {};
let currentPresentationView: MandelbrotPreviewView | undefined;
let drawPresentationView = (_view: MandelbrotPreviewView) => {};
let transitionFrame = 0;
const motionFrameDurations: number[] = [];
let motionFrameCount = 0;
let maximumFocusErrorPx = 0;
previewNode.dataset.focusQuantizationBits = pointerFocusFractionBits.toString();
previewNode.dataset.presentationAuthority = "presentation-only";

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
  const halfPixelBudget = viewportScale.value / Math.max(2, canvas.height * 2);
  const centerXError = centerX.absoluteError + Math.abs(centerX.value - centerX32);
  const centerYError = centerY.absoluteError + Math.abs(centerY.value - centerY32);
  const scaleError = viewportScale.absoluteError + Math.abs(viewportScale.value - viewportScale32);
  if (!Number.isFinite(viewportScale32)
    || viewportScale32 <= 0
    || centerXError > halfPixelBudget
    || centerYError > halfPixelBudget
    || scaleError > halfPixelBudget) {
    return null;
  }
  return { centerX: centerX32, centerY: centerY32, viewportScale: viewportScale32 };
}

function publishMotionTelemetry(): void {
  const sorted = [...motionFrameDurations].sort((left, right) => left - right);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  previewNode.dataset.motionTelemetry = JSON.stringify({
    schemaVersion: 1,
    frameCount: motionFrameCount,
    maximumFocusErrorPx,
    p95FrameMs: sorted[p95Index] ?? 0,
    sampleCount: sorted.length,
    authority: "presentation-only",
  });
}

function startPresentationTransition(focus: { x: ExactDyadic; y: ExactDyadic }): void {
  const target = presentationView(cameraAuthority);
  updateCameraReadout();
  if (!target) {
    cancelAnimationFrame(transitionFrame);
    previewStatusNode.textContent = "Exact camera active · direct preview precision exhausted";
    previewNode.dataset.state = "precision-limit";
    previewNode.dataset.presentationState = "unresolved";
    return;
  }

  const start = currentPresentationView ?? target;
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
  let previousFrameTime: number | undefined;
  cancelAnimationFrame(transitionFrame);
  previewNode.dataset.presentationState = "interpolating";

  const animate = (time: number) => {
    const progress = Math.min(1, (time - startedAt) / presentationStepDurationMs);
    const scale = start.viewportScale * scaleRatio ** progress;
    const view = progress === 1 ? target : {
      centerX: focusWorldX - focusX.value * scale,
      centerY: focusWorldY - focusY.value * scale,
      viewportScale: scale,
    };
    const displayedCenterX = Math.fround(view.centerX);
    const displayedCenterY = Math.fround(view.centerY);
    const displayedScale = Math.fround(view.viewportScale);
    const actualFocusX = displayedCenterX + focusX.value * displayedScale;
    const actualFocusY = displayedCenterY + focusY.value * displayedScale;
    const focusErrorPx = Math.hypot(actualFocusX - focusWorldX, actualFocusY - focusWorldY)
      * canvas.clientHeight / displayedScale;
    maximumFocusErrorPx = Math.max(maximumFocusErrorPx, focusErrorPx);
    motionFrameCount += 1;
    if (previousFrameTime !== undefined) {
      motionFrameDurations.push(time - previousFrameTime);
      if (motionFrameDurations.length > 512) motionFrameDurations.shift();
    }
    previousFrameTime = time;
    drawPresentationView(view);
    publishMotionTelemetry();

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
  const scale = approximateDyadic(cameraAuthority.viewportScale);
  const initialScale = approximateDyadic(initialCamera.viewportScale)!;
  const magnification = scale ? initialScale.value / scale.value : Number.POSITIVE_INFINITY;
  cameraReadout.textContent = `${magnification.toLocaleString(undefined, { maximumFractionDigits: 0 })}× · scale 2^${cameraAuthority.viewportScale.exponent}`;
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
  previewNode.dataset.lastFocus = JSON.stringify({
    x: serializeDyadic(focus.x),
    y: serializeDyadic(focus.y),
  });
  const invariantFocus = worldAtFocus(cameraAuthority, focus);
  cameraAuthority = zoomAbout(cameraAuthority, focus.x, focus.y, exponentDelta);
  const nextFocus = worldAtFocus(cameraAuthority, focus);
  if (invariantFocus.x.numerator !== nextFocus.x.numerator
    || invariantFocus.x.exponent !== nextFocus.x.exponent
    || invariantFocus.y.numerator !== nextFocus.y.numerator
    || invariantFocus.y.exponent !== nextFocus.y.exponent) {
    throw new Error("Exact pointer-focus invariant failed.");
  }
  startPresentationTransition(focus);
}

function installCameraInteraction(): void {
  type HoldState = {
    pointerId: number;
    direction: -1n | 1n;
    focus: { x: ExactDyadic; y: ExactDyadic };
    lastStep: number;
    frame: number;
  };
  let hold: HoldState | undefined;
  const stepIntervalMs = presentationStepDurationMs;

  const continueHold = (time: number) => {
    if (!hold) return;
    if (time - hold.lastStep >= stepIntervalMs) {
      applyExactZoom(hold.focus, hold.direction);
      hold.lastStep = time;
    }
    hold.frame = requestAnimationFrame(continueHold);
  };
  const stopHold = (event: PointerEvent) => {
    if (!hold || event.pointerId !== hold.pointerId) return;
    cancelAnimationFrame(hold.frame);
    hold = undefined;
  };

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const direction = event.button === 2 || event.shiftKey ? 1n : -1n;
    hold = {
      pointerId: event.pointerId,
      direction,
      focus: exactPointerFocus(event),
      lastStep: performance.now() - stepIntervalMs,
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
    cancelAnimationFrame(transitionFrame);
    cameraAuthority = createCamera(
      initialCamera.centerX,
      initialCamera.centerY,
      initialCamera.viewportScale,
      cameraAuthority.epoch + 1n,
    );
    renderPreview();
  });
}

async function initializePreview(): Promise<void> {
  try {
    const { device, environment } = await getGpuSession();
    const preview = await createMandelbrotPreview(device, canvas);
    const adapterLabel = `${environment.info.vendor || "WebGPU"} ${environment.info.architecture}`.trim();
    drawPresentationView = (view) => {
      const density = Math.min(window.devicePixelRatio, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * density));
      const height = Math.max(1, Math.round(canvas.clientHeight * density));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const f32View = {
        centerX: Math.fround(view.centerX),
        centerY: Math.fround(view.centerY),
        viewportScale: Math.fround(view.viewportScale),
      };
      const halfPixelBudget = view.viewportScale / Math.max(2, canvas.height * 2);
      if (!Number.isFinite(f32View.viewportScale)
        || f32View.viewportScale <= 0
        || Math.abs(view.centerX - f32View.centerX) > halfPixelBudget
        || Math.abs(view.centerY - f32View.centerY) > halfPixelBudget
        || Math.abs(view.viewportScale - f32View.viewportScale) > halfPixelBudget) {
        previewStatusNode.textContent = "Exact camera active · direct preview precision exhausted";
        previewNode.dataset.state = "precision-limit";
        previewNode.dataset.presentationState = "unresolved";
        return;
      }
      currentPresentationView = view;
      preview.render(f32View);
      previewStatusNode.textContent = adapterLabel;
      previewNode.dataset.state = "ready";
    };
    renderPreview = () => {
      cancelAnimationFrame(transitionFrame);
      const view = presentationView(cameraAuthority);
      updateCameraReadout();
      if (!view) {
        previewStatusNode.textContent = "Exact camera active · direct preview precision exhausted";
        previewNode.dataset.state = "precision-limit";
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

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  resultNode.dataset.state = "running";
  try {
    if (!capabilities.crossOriginIsolated || !capabilities.sharedArrayBuffer) {
      throw new Error("Cross-origin isolation/shared memory requirement is not satisfied.");
    }
    if (!("gpu" in navigator)) throw new Error("WebGPU is unavailable.");
    const response = await fetch(`${import.meta.env.BASE_URL}fixtures/oracle-corpus-v1.json`);
    const corpus = await response.json() as { cases: Fixture[] };
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

      const { device, environment } = await getGpuSession();
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
      const gpuResults = await (await createDirectHarness(device))(directSamples);
      const differential = gpuResults.map((gpu, offset) => {
        const index = directIndexes[offset]!;
        const oracleResult = oracle[index]!;
        return {
          id: corpus.cases[index]!.id,
          gpu,
          oracle: oracleResult,
          comparison: compareGpuCandidate(gpu.candidate, oracleResult),
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
      const summary = {
        fixtureCount: corpus.cases.length,
        oracleMismatchCount: oracleChecks.filter((entry) => !entry.matches).length,
        gpuDifferentialCount: differentialChecks.length,
        gpuMismatchCount: differentialChecks.filter((entry) => !entry.matches).length,
        acceptedGpuEscapes: differentialChecks.filter((entry) => entry.comparison.accepted).length,
        intentionalInsufficientBoundPassed: intentionalInsufficient?.actual.status === "unresolved"
          && intentionalInsufficient.actual.reason === "insufficient_precision",
        fallbackAdapter: environment.info.isFallbackAdapter,
      };
      const passed = summary.oracleMismatchCount === 0
        && summary.gpuMismatchCount === 0
        && summary.intentionalInsufficientBoundPassed
        && !summary.fallbackAdapter;
      resultNode.textContent = JSON.stringify({
        schemaVersion: 1,
        status: passed ? "passed" : "failed",
        capabilities,
        environment,
        summary,
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
