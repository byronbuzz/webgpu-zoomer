import { createDirectHarness, type DirectSample } from "@webgpu-zoomer/gpu-engine";
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
};

const capabilityNode = document.querySelector<HTMLElement>("#capabilities")!;
const resultNode = document.querySelector<HTMLElement>("#results")!;
const runButton = document.querySelector<HTMLButtonElement>("#run")!;

const capabilities = {
  crossOriginIsolated,
  sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
  webGpu: "gpu" in navigator,
};
capabilityNode.textContent = JSON.stringify(capabilities, null, 2);

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
  try {
    if (!capabilities.crossOriginIsolated || !capabilities.sharedArrayBuffer) {
      throw new Error("Cross-origin isolation/shared memory requirement is not satisfied.");
    }
    if (!("gpu" in navigator)) throw new Error("WebGPU is unavailable.");
    const response = await fetch("/fixtures/oracle-corpus-v1.json");
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

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("WebGPU adapter request returned null.");
      const device = await adapter.requestDevice();
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
        return {
          id: corpus.cases[index]!.id,
          gpu,
          oracle: oracle[index],
          comparison: compareGpuCandidate(gpu.candidate, oracle[index]!),
        };
      });
      resultNode.textContent = JSON.stringify({ capabilities, oracle, differential }, null, 2);
    } finally {
      worker.terminate();
    }
  } catch (error) {
    resultNode.textContent = JSON.stringify({ capabilities, error: error instanceof Error ? error.message : String(error) }, null, 2);
  } finally {
    runButton.disabled = false;
  }
});
