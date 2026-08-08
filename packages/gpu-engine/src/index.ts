import type { GpuCandidate } from "@webgpu-zoomer/numerical-contract";
import { directMandelbrotShader } from "./direct.wgsl.js";
import { mandelbrotPreviewShader } from "./preview.wgsl.js";

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

export type MandelbrotPreview = Readonly<{
  render: () => void;
  destroy: () => void;
}>;

export async function createMandelbrotPreview(device: GPUDevice, canvas: HTMLCanvasElement): Promise<MandelbrotPreview> {
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU canvas context is unavailable.");

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const module = device.createShaderModule({ label: "shallow-mandelbrot-preview", code: mandelbrotPreviewShader });
  const compilation = await module.getCompilationInfo();
  const errors = compilation.messages.filter((message) => message.type === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((error) => `${error.lineNum}:${error.linePos} ${error.message}`).join("\n"));
  }

  const pipeline = device.createRenderPipeline({
    label: "shallow-mandelbrot-preview",
    layout: "auto",
    vertex: { module, entryPoint: "vertexMain" },
    fragment: { module, entryPoint: "fragmentMain", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const uniformBuffer = device.createBuffer({
    label: "shallow-mandelbrot-preview-uniforms",
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const render = () => {
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
      canvas.width,
      canvas.height,
      -0.5,
      0,
      2.75,
      0,
      0,
      0,
    ]));
    const encoder = device.createCommandEncoder({ label: "shallow-mandelbrot-preview-command" });
    const pass = encoder.beginRenderPass({
      label: "shallow-mandelbrot-preview-pass",
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
  };

  return { render, destroy: () => uniformBuffer.destroy() };
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
