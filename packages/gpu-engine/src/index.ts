import type { GpuCandidate } from "@webgpu-zoomer/numerical-contract";
import { directMandelbrotShader } from "./direct.wgsl.js";
import { mandelbrotPerturbationPreviewShader, maximumPerturbationIterations } from "./perturbation.wgsl.js";
import {
  mandelbrotProgressiveComputeShader,
  mandelbrotProgressivePresentShader,
  progressiveDispatchQuantum,
} from "./progressive.wgsl.js";

export type DirectSample = Readonly<{
  cRe: number;
  cIm: number;
  iterationCap: number;
  bailoutSquared: number;
}>;

export type DirectHarnessResult = Readonly<{
  candidate: GpuCandidate;
  radiusSquared: number;
}>;

const stride = 16;
const perturbationOrbitStride = 4;
const perturbationReferenceMagnitudeLimit = 1e30;
const perturbationGlitchThreshold = 0.25;
const maximumPerturbationTransportError = 2 ** -40;
export const maximumProgressiveIterations = 50_000;
export const maximumProgressivePixels = 4_194_304;

export function nextProgressiveIterationFrontier(current: number, target: number): number {
  if (!Number.isSafeInteger(current) || current < 0) throw new RangeError("current must be a non-negative safe integer");
  if (!Number.isSafeInteger(target) || target < 1 || target > maximumProgressiveIterations) {
    throw new RangeError(`target must be in [1, ${maximumProgressiveIterations}]`);
  }
  if (current > target) return Math.min(target, progressiveDispatchQuantum);
  return Math.min(target, current + progressiveDispatchQuantum);
}

export type DirectMandelbrotPreviewView = Readonly<{
  kind: "direct";
  centerX: number;
  centerY: number;
  viewportScale: number;
  approximate: boolean;
}>;

export type PerturbationMandelbrotPreviewView = Readonly<{
  kind: "perturbation";
  centerX: number;
  centerY: number;
  viewportScale: number;
  iterationCap: number;
  glitchThreshold: number;
  previewMode: "bounded-f64-reference-compensated-ds-v1";
  transportError: number;
  transportLimit: number;
  referenceOffsetX: number;
  referenceOffsetY: number;
  referenceOrbit: Float32Array;
}>;

export type MandelbrotPreviewView = DirectMandelbrotPreviewView | PerturbationMandelbrotPreviewView;

export type PerturbationPreviewRequest = Readonly<{
  centerX: number;
  centerY: number;
  viewportScale: number;
  referenceOffsetX?: number;
  referenceOffsetY?: number;
  iterationCap?: number;
  transportErrorLimit?: number;
}>;

export function perturbationPreviewIterationCap(requestedIterations: number): number {
  if (!Number.isSafeInteger(requestedIterations) || requestedIterations < 1) {
    throw new RangeError("requestedIterations must be a positive safe integer");
  }
  return Math.min(requestedIterations, maximumPerturbationIterations);
}

export type ProgressiveRenderResult = Readonly<{
  schemaVersion: 1;
  method: "progressive-direct-f32-v1" | "bounded-f64-reference-compensated-ds-v1";
  iterationTarget: number;
  iterationFrontier: number;
  dispatchQuantum: number;
  complete: boolean;
  canContinue: boolean;
  requestReset: boolean;
  limitation: "none" | "reference_path_iteration_limit";
  coverage: Readonly<{
    status: "measured" | "deferred";
    activePixels: number | null;
    escapedPixels: number | null;
    unresolvedPixels: number | null;
  }>;
  authority: "presentation-only";
}>;

function splitFloat64(value: number): readonly [number, number] | undefined {
  const high = Math.fround(value);
  if (!Number.isFinite(high)) return undefined;
  const low = Math.fround(value - high);
  return Number.isFinite(low) ? [high, low] : undefined;
}

/**
 * Generates a bounded f64 local reference orbit for presentation only. It has
 * no numerical-publication type and never consumes presentation-derived data.
 */
export function createPerturbationPreviewView(
  request: PerturbationPreviewRequest,
): PerturbationMandelbrotPreviewView | undefined {
  const iterationCap = request.iterationCap ?? maximumPerturbationIterations;
  const referenceOffsetX = request.referenceOffsetX ?? 0;
  const referenceOffsetY = request.referenceOffsetY ?? 0;
  const transportLimit = request.transportErrorLimit ?? maximumPerturbationTransportError;
  if (!Number.isSafeInteger(iterationCap) || iterationCap < 1 || iterationCap > maximumPerturbationIterations
    || !Number.isFinite(request.centerX) || !Number.isFinite(request.centerY)
    || !Number.isFinite(request.viewportScale) || request.viewportScale <= 0
    || !Number.isFinite(referenceOffsetX) || !Number.isFinite(referenceOffsetY)
    || Math.max(Math.abs(referenceOffsetX), Math.abs(referenceOffsetY)) > perturbationGlitchThreshold
    || !Number.isFinite(transportLimit) || transportLimit <= 0 || transportLimit > maximumPerturbationTransportError) return undefined;

  const referenceOrbit = new Float32Array((iterationCap + 1) * perturbationOrbitStride);
  let real = 0;
  let imaginary = 0;
  let transportError = 0;
  for (let iteration = 0; iteration <= iterationCap; iteration += 1) {
    if (!Number.isFinite(real) || !Number.isFinite(imaginary)
      || Math.max(Math.abs(real), Math.abs(imaginary)) > perturbationReferenceMagnitudeLimit) return undefined;
    const realTransport = splitFloat64(real);
    const imaginaryTransport = splitFloat64(imaginary);
    if (!realTransport || !imaginaryTransport) return undefined;
    transportError = Math.max(
      transportError,
      Math.abs(real - (realTransport[0] + realTransport[1])),
      Math.abs(imaginary - (imaginaryTransport[0] + imaginaryTransport[1])),
    );
    if (transportError > transportLimit) return undefined;
    const offset = iteration * perturbationOrbitStride;
    referenceOrbit[offset] = realTransport[0];
    referenceOrbit[offset + 1] = realTransport[1];
    referenceOrbit[offset + 2] = imaginaryTransport[0];
    referenceOrbit[offset + 3] = imaginaryTransport[1];
    if (iteration === iterationCap) break;
    const nextReal = real * real - imaginary * imaginary + request.centerX;
    imaginary = 2 * real * imaginary + request.centerY;
    real = nextReal;
  }

  return Object.freeze({
    kind: "perturbation",
    centerX: request.centerX,
    centerY: request.centerY,
    viewportScale: request.viewportScale,
    iterationCap,
    glitchThreshold: perturbationGlitchThreshold,
    previewMode: "bounded-f64-reference-compensated-ds-v1",
    transportError,
    transportLimit,
    referenceOffsetX,
    referenceOffsetY,
    referenceOrbit,
  });
}

export type MandelbrotPreview = Readonly<{
  render: (view: MandelbrotPreviewView, iterationTarget: number, collectCoverage: boolean) => Promise<ProgressiveRenderResult>;
  destroy: () => void;
}>;

async function assertCompiles(module: GPUShaderModule): Promise<void> {
  const compilation = await module.getCompilationInfo();
  const errors = compilation.messages.filter((message) => message.type === "error");
  if (errors.length > 0) throw new Error(errors.map((error) => `${error.lineNum}:${error.linePos} ${error.message}`).join("\n"));
}

export async function createMandelbrotPreview(device: GPUDevice, canvas: HTMLCanvasElement): Promise<MandelbrotPreview> {
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU canvas context is unavailable.");

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const perturbationModule = device.createShaderModule({ label: "bounded-perturbation-preview", code: mandelbrotPerturbationPreviewShader });
  const progressiveComputeModule = device.createShaderModule({
    label: "progressive-direct-mandelbrot-compute",
    code: mandelbrotProgressiveComputeShader,
  });
  const progressivePresentModule = device.createShaderModule({
    label: "progressive-direct-mandelbrot-present",
    code: mandelbrotProgressivePresentShader,
  });
  await Promise.all([
    assertCompiles(perturbationModule),
    assertCompiles(progressiveComputeModule),
    assertCompiles(progressivePresentModule),
  ]);

  const perturbationPipeline = device.createRenderPipeline({
    label: "bounded-perturbation-preview",
    layout: "auto",
    vertex: { module: perturbationModule, entryPoint: "vertexMain" },
    fragment: { module: perturbationModule, entryPoint: "fragmentMain", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const progressiveComputePipeline = device.createComputePipeline({
    label: "progressive-direct-mandelbrot-compute",
    layout: "auto",
    compute: { module: progressiveComputeModule, entryPoint: "main" },
  });
  const progressivePresentPipeline = device.createRenderPipeline({
    label: "progressive-direct-mandelbrot-present",
    layout: "auto",
    vertex: { module: progressivePresentModule, entryPoint: "vertexMain" },
    fragment: { module: progressivePresentModule, entryPoint: "fragmentMain", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const perturbationUniformBuffer = device.createBuffer({
    label: "bounded-perturbation-preview-uniforms",
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const referenceBuffer = device.createBuffer({
    label: "bounded-perturbation-reference-orbit",
    size: (maximumPerturbationIterations + 1) * perturbationOrbitStride * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const progressiveUniformBuffer = device.createBuffer({
    label: "progressive-direct-mandelbrot-uniforms",
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const progressiveCoverageBuffer = device.createBuffer({
    label: "progressive-direct-mandelbrot-coverage",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const progressiveCoverageReadback = device.createBuffer({
    label: "progressive-direct-mandelbrot-coverage-readback",
    size: 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const perturbationBindGroup = device.createBindGroup({
    layout: perturbationPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: perturbationUniformBuffer } },
      { binding: 1, resource: { buffer: referenceBuffer } },
    ],
  });

  let progressiveStateBuffer: GPUBuffer | undefined;
  let progressiveTexture: GPUTexture | undefined;
  let progressiveComputeBindGroup: GPUBindGroup | undefined;
  let progressivePresentBindGroup: GPUBindGroup | undefined;
  let progressiveIdentity: string | undefined;
  let progressiveFrontier = 0;

  const releaseProgressiveResources = () => {
    progressiveStateBuffer?.destroy();
    progressiveTexture?.destroy();
    progressiveStateBuffer = undefined;
    progressiveTexture = undefined;
    progressiveComputeBindGroup = undefined;
    progressivePresentBindGroup = undefined;
    progressiveIdentity = undefined;
    progressiveFrontier = 0;
  };

  const ensureProgressiveResources = () => {
    const pixelCount = canvas.width * canvas.height;
    if (!Number.isSafeInteger(pixelCount) || pixelCount < 1 || pixelCount > maximumProgressivePixels) {
      throw new RangeError(`Progressive canvas exceeds ${maximumProgressivePixels} pixels.`);
    }
    const requiredSize = pixelCount * 16;
    if (progressiveStateBuffer && progressiveTexture
      && progressiveStateBuffer.size === requiredSize
      && progressiveTexture.width === canvas.width && progressiveTexture.height === canvas.height) return;
    releaseProgressiveResources();
    progressiveStateBuffer = device.createBuffer({
      label: "progressive-direct-mandelbrot-state",
      size: requiredSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    progressiveTexture = device.createTexture({
      label: "progressive-direct-mandelbrot-output",
      size: { width: canvas.width, height: canvas.height },
      format: "rgba8unorm",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    progressiveComputeBindGroup = device.createBindGroup({
      layout: progressiveComputePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: progressiveUniformBuffer } },
        { binding: 1, resource: { buffer: progressiveStateBuffer } },
        { binding: 2, resource: progressiveTexture.createView() },
        { binding: 3, resource: { buffer: progressiveCoverageBuffer } },
      ],
    });
    progressivePresentBindGroup = device.createBindGroup({
      layout: progressivePresentPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: progressiveTexture.createView() }],
    });
  };

  const render = (
    view: MandelbrotPreviewView,
    iterationTarget: number,
    collectCoverage: boolean,
  ): Promise<ProgressiveRenderResult> => {
    if (!Number.isSafeInteger(iterationTarget) || iterationTarget < 1 || iterationTarget > maximumProgressiveIterations) {
      throw new RangeError(`iterationTarget must be in [1, ${maximumProgressiveIterations}]`);
    }
    let pipeline: GPURenderPipeline;
    let bindGroup: GPUBindGroup;
    if (view.kind === "direct") {
      ensureProgressiveResources();
      const identity = JSON.stringify([
        canvas.width, canvas.height, view.centerX, view.centerY, view.viewportScale, view.approximate,
      ]);
      const requestReset = progressiveIdentity !== identity || iterationTarget < progressiveFrontier;
      if (requestReset) {
        if (!progressiveStateBuffer) throw new Error("Progressive state buffer is unavailable.");
        const clearEncoder = device.createCommandEncoder({ label: "progressive-direct-mandelbrot-reset" });
        clearEncoder.clearBuffer(progressiveStateBuffer);
        device.queue.submit([clearEncoder.finish()]);
        progressiveIdentity = identity;
        progressiveFrontier = 0;
      }
      const nextFrontier = nextProgressiveIterationFrontier(progressiveFrontier, iterationTarget);
      device.queue.writeBuffer(progressiveUniformBuffer, 0, new Float32Array([
        canvas.width, canvas.height, view.centerX, view.centerY,
        view.viewportScale, nextFrontier, progressiveDispatchQuantum, 0,
      ]));
      const encoder = device.createCommandEncoder({ label: "progressive-direct-mandelbrot-command" });
      encoder.clearBuffer(progressiveCoverageBuffer);
      const compute = encoder.beginComputePass({ label: "progressive-direct-mandelbrot-compute" });
      compute.setPipeline(progressiveComputePipeline);
      compute.setBindGroup(0, progressiveComputeBindGroup!);
      compute.dispatchWorkgroups(Math.ceil(canvas.width / 8), Math.ceil(canvas.height / 8));
      compute.end();
      const present = encoder.beginRenderPass({
        label: "progressive-direct-mandelbrot-present",
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.004, g: 0.008, b: 0.018, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      present.setPipeline(progressivePresentPipeline);
      present.setBindGroup(0, progressivePresentBindGroup!);
      present.draw(3);
      present.end();
      const completesTarget = nextFrontier >= iterationTarget;
      if (collectCoverage && completesTarget) {
        encoder.copyBufferToBuffer(progressiveCoverageBuffer, 0, progressiveCoverageReadback, 0, 16);
      }
      device.queue.submit([encoder.finish()]);
      progressiveFrontier = nextFrontier;
      return device.queue.onSubmittedWorkDone().then(async () => {
        let coverage: ProgressiveRenderResult["coverage"] = Object.freeze({
          status: "deferred" as const,
          activePixels: null,
          escapedPixels: null,
          unresolvedPixels: null,
        });
        if (collectCoverage && completesTarget) {
          await progressiveCoverageReadback.mapAsync(GPUMapMode.READ);
          const values = new Uint32Array(progressiveCoverageReadback.getMappedRange());
          coverage = Object.freeze({
            status: "measured" as const,
            activePixels: values[0]!,
            escapedPixels: values[1]!,
            unresolvedPixels: values[2]!,
          });
          progressiveCoverageReadback.unmap();
        }
        return Object.freeze({
          schemaVersion: 1 as const,
          method: "progressive-direct-f32-v1" as const,
          iterationTarget,
          iterationFrontier: progressiveFrontier,
          dispatchQuantum: progressiveDispatchQuantum,
          complete: progressiveFrontier >= iterationTarget,
          canContinue: progressiveFrontier < iterationTarget,
          requestReset,
          limitation: "none" as const,
          coverage,
          authority: "presentation-only" as const,
        });
      });
    } else {
      device.queue.writeBuffer(referenceBuffer, 0, view.referenceOrbit);
      device.queue.writeBuffer(perturbationUniformBuffer, 0, new Float32Array([
        canvas.width, canvas.height, view.viewportScale, view.iterationCap,
        view.glitchThreshold, view.referenceOffsetX, view.referenceOffsetY, 0,
      ]));
      pipeline = perturbationPipeline;
      bindGroup = perturbationBindGroup;
    }
    const encoder = device.createCommandEncoder({ label: "mandelbrot-preview-command" });
    const pass = encoder.beginRenderPass({
      label: "mandelbrot-preview-pass",
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.004, g: 0.008, b: 0.018, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    return device.queue.onSubmittedWorkDone().then(() => Object.freeze({
      schemaVersion: 1 as const,
      method: view.previewMode,
      iterationTarget,
      iterationFrontier: view.iterationCap,
      dispatchQuantum: view.iterationCap,
      complete: view.iterationCap >= iterationTarget,
      canContinue: false,
      requestReset: true,
      limitation: view.iterationCap >= iterationTarget ? "none" as const : "reference_path_iteration_limit" as const,
      coverage: Object.freeze({
        status: "deferred" as const,
        activePixels: null,
        escapedPixels: null,
        unresolvedPixels: null,
      }),
      authority: "presentation-only" as const,
    }));
  };

  return {
    render,
    destroy: () => {
      perturbationUniformBuffer.destroy();
      referenceBuffer.destroy();
      progressiveUniformBuffer.destroy();
      progressiveCoverageBuffer.destroy();
      progressiveCoverageReadback.destroy();
      releaseProgressiveResources();
    },
  };
}
export async function createDirectHarness(device: GPUDevice): Promise<(samples: readonly DirectSample[]) => Promise<DirectHarnessResult[]>> {
  const module = device.createShaderModule({ label: "phase-0-direct-mandelbrot", code: directMandelbrotShader });
  const compilation = await module.getCompilationInfo();
  const errors = compilation.messages.filter((message) => message.type === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((error) => `${error.lineNum}:${error.linePos} ${error.message}`).join("\n"));
  }
  const pipeline = device.createComputePipeline({
    label: "phase-0-direct-mandelbrot",
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });

  return async (samples) => {
    if (samples.length === 0) return [];
    const byteLength = stride * samples.length;
    const input = new ArrayBuffer(byteLength);
    const inputView = new DataView(input);
    samples.forEach((sample, index) => {
      const offset = index * stride;
      inputView.setFloat32(offset, sample.cRe, true);
      inputView.setFloat32(offset + 4, sample.cIm, true);
      inputView.setUint32(offset + 8, sample.iterationCap, true);
      inputView.setFloat32(offset + 12, sample.bailoutSquared, true);
    });

    const inputBuffer = device.createBuffer({
      label: "phase-0-direct-input",
      size: byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const outputBuffer = device.createBuffer({
      label: "phase-0-direct-output",
      size: byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readback = device.createBuffer({
      label: "phase-0-direct-readback",
      size: byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    try {
      device.queue.writeBuffer(inputBuffer, 0, input);
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } },
        ],
      });
      const encoder = device.createCommandEncoder({ label: "phase-0-direct-command" });
      const pass = encoder.beginComputePass({ label: "phase-0-direct-pass" });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(samples.length / 64));
      pass.end();
      encoder.copyBufferToBuffer(outputBuffer, 0, readback, 0, byteLength);
      device.queue.submit([encoder.finish()]);

      // This awaited readback exists only in the offline experimental differential harness.
      await readback.mapAsync(GPUMapMode.READ);
      const view = new DataView(readback.getMappedRange());
      return samples.map((_, index) => {
        const offset = index * stride;
        const status = view.getUint32(offset, true);
        const iterations = view.getUint32(offset + 4, true);
        const radiusSquared = view.getFloat32(offset + 8, true);
        const candidate: GpuCandidate = status === 1
          ? { status: "escaped", iterations, reason: "gpu_candidate_only" }
          : { status: "unresolved", iterations, reason: "gpu_candidate_only" };
        return { candidate, radiusSquared };
      });
    } finally {
      if (readback.mapState === "mapped") readback.unmap();
      inputBuffer.destroy();
      outputBuffer.destroy();
      readback.destroy();
    }
  };
}
