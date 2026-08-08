import { createDirectHarness, createMandelbrotPreview, type DirectSample } from "@webgpu-zoomer/gpu-engine";
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

async function initializePreview(): Promise<void> {
  try {
    const { device, environment } = await getGpuSession();
    const preview = await createMandelbrotPreview(device, canvas);
    const renderAtDisplaySize = () => {
      const density = Math.min(window.devicePixelRatio, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * density));
      const height = Math.max(1, Math.round(canvas.clientHeight * density));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      preview.render();
    };
    new ResizeObserver(renderAtDisplaySize).observe(canvas);
    renderAtDisplaySize();
    previewStatusNode.textContent = `${environment.info.vendor || "WebGPU"} ${environment.info.architecture}`.trim();
    previewNode.dataset.state = "ready";
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
