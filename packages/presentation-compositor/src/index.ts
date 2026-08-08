import {
  deserializeCamera,
  dyadic,
  serializeCamera,
  subtract,
  type ExactCamera,
  type ExactDyadic,
} from "@webgpu-zoomer/exact-camera";
import { approximateDyadic } from "@webgpu-zoomer/exact-camera/approximate";
import type { PresentationSnapshot } from "@webgpu-zoomer/presentation-snapshot";
import { presentationCompositeShader } from "./composite.wgsl.js";

const floatsPerCell = 8;
const maximumCompositeCells = 512;
const maximumTransformErrorPx = 0.25;

export type PreparedSnapshotComposite = Readonly<{
  accepted: true;
  snapshotId: string;
  checksum: string;
  cellCount: number;
  acceptedCount: number;
  unresolvedCount: number;
  transformErrorLimitPx: number;
  instances: Float32Array;
}>;

export type RejectedSnapshotComposite = Readonly<{
  accepted: false;
  reason: "camera_mismatch" | "viewport_mismatch" | "resource_budget_exhausted" | "invalid_snapshot" | "precision_limit";
}>;

export type SnapshotCompositePreparation = PreparedSnapshotComposite | RejectedSnapshotComposite;

export type SnapshotCompositor = Readonly<{
  render: (prepared: PreparedSnapshotComposite) => void;
  clear: () => void;
  destroy: () => void;
}>;

function exactFinite(value: ExactDyadic): number | undefined {
  const approximation = approximateDyadic(value);
  return approximation && approximation.absoluteError === 0 ? approximation.value : undefined;
}

function boundedF32(value: number, pixelExtent: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const encoded = Math.fround(value);
  if (Math.abs(encoded - value) * pixelExtent / 2 > maximumTransformErrorPx) return undefined;
  return Object.is(encoded, -0) ? 0 : encoded;
}

function sameCamera(snapshot: PresentationSnapshot, camera: ExactCamera): boolean {
  return JSON.stringify(snapshot.camera) === JSON.stringify(serializeCamera(camera));
}

export function prepareSnapshotComposite(
  snapshot: PresentationSnapshot,
  camera: ExactCamera,
  viewportWidth: number,
  viewportHeight: number,
): SnapshotCompositePreparation {
  if (!Number.isSafeInteger(viewportWidth) || viewportWidth < 1
    || !Number.isSafeInteger(viewportHeight) || viewportHeight < 1) {
    return Object.freeze({ accepted: false, reason: "viewport_mismatch" });
  }
  if (!sameCamera(snapshot, camera)) return Object.freeze({ accepted: false, reason: "camera_mismatch" });
  if (!snapshot.domain || snapshot.domain.kind !== "integer-aspect" || snapshot.domain.version !== 1
    || snapshot.domain.width !== viewportWidth || snapshot.domain.height !== viewportHeight) {
    return Object.freeze({ accepted: false, reason: "viewport_mismatch" });
  }
  if (snapshot.cells.length > maximumCompositeCells) {
    return Object.freeze({ accepted: false, reason: "resource_budget_exhausted" });
  }
  if (snapshot.cells.length !== snapshot.counts.total
    || snapshot.counts.accepted + snapshot.counts.unresolved !== snapshot.counts.total
    || snapshot.authority !== "presentation-only") {
    return Object.freeze({ accepted: false, reason: "invalid_snapshot" });
  }

  const snapshotCamera = deserializeCamera(snapshot.camera);
  const scale = exactFinite(snapshotCamera.viewportScale);
  if (scale === undefined || scale <= 0) return Object.freeze({ accepted: false, reason: "precision_limit" });
  const aspect = viewportWidth / viewportHeight;
  const instances = new Float32Array(snapshot.cells.length * floatsPerCell);
  let acceptedCount = 0;
  let unresolvedCount = 0;
  for (let index = 0; index < snapshot.cells.length; index += 1) {
    const cell = snapshot.cells[index]!;
    if (cell.key.level !== snapshot.level) return Object.freeze({ accepted: false, reason: "invalid_snapshot" });
    let x: bigint;
    let y: bigint;
    let level: bigint;
    try {
      x = BigInt(cell.key.x);
      y = BigInt(cell.key.y);
      level = BigInt(cell.key.level);
    } catch {
      return Object.freeze({ accepted: false, reason: "invalid_snapshot" });
    }
    const minimumX = exactFinite(subtract(dyadic(x, level), snapshotCamera.centerX));
    const maximumX = exactFinite(subtract(dyadic(x + 1n, level), snapshotCamera.centerX));
    const minimumY = exactFinite(subtract(dyadic(y, level), snapshotCamera.centerY));
    const maximumY = exactFinite(subtract(dyadic(y + 1n, level), snapshotCamera.centerY));
    if (minimumX === undefined || maximumX === undefined || minimumY === undefined || maximumY === undefined) {
      return Object.freeze({ accepted: false, reason: "precision_limit" });
    }
    const clipMinimumX = boundedF32(2 * minimumX / (aspect * scale), viewportWidth);
    const clipMaximumX = boundedF32(2 * maximumX / (aspect * scale), viewportWidth);
    const clipMinimumY = boundedF32(-2 * maximumY / scale, viewportHeight);
    const clipMaximumY = boundedF32(-2 * minimumY / scale, viewportHeight);
    if (clipMinimumX === undefined || clipMaximumX === undefined
      || clipMinimumY === undefined || clipMaximumY === undefined) {
      return Object.freeze({ accepted: false, reason: "precision_limit" });
    }
    const offset = index * floatsPerCell;
    instances[offset] = clipMinimumX;
    instances[offset + 1] = clipMinimumY;
    instances[offset + 2] = clipMaximumX;
    instances[offset + 3] = clipMaximumY;
    if (cell.source === "accepted") {
      instances[offset + 4] = Math.fround(cell.displayValue.escapeIterations);
      instances[offset + 5] = 0;
      acceptedCount += 1;
    } else {
      instances[offset + 4] = 0;
      instances[offset + 5] = 1;
      unresolvedCount += 1;
    }
  }
  if (acceptedCount !== snapshot.counts.accepted || unresolvedCount !== snapshot.counts.unresolved) {
    return Object.freeze({ accepted: false, reason: "invalid_snapshot" });
  }
  return Object.freeze({
    accepted: true,
    snapshotId: snapshot.snapshotId,
    checksum: snapshot.checksum,
    cellCount: snapshot.cells.length,
    acceptedCount,
    unresolvedCount,
    transformErrorLimitPx: maximumTransformErrorPx,
    instances,
  });
}

export async function createSnapshotCompositor(device: GPUDevice, canvas: HTMLCanvasElement): Promise<SnapshotCompositor> {
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("Presentation overlay WebGPU context is unavailable.");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });
  const module = device.createShaderModule({ label: "presentation-snapshot-compositor", code: presentationCompositeShader });
  const compilation = await module.getCompilationInfo();
  const errors = compilation.messages.filter((message) => message.type === "error");
  if (errors.length > 0) throw new Error(errors.map((error) => `${error.lineNum}:${error.linePos} ${error.message}`).join("\n"));
  const pipeline = device.createRenderPipeline({
    label: "presentation-snapshot-compositor",
    layout: "auto",
    vertex: { module, entryPoint: "vertexMain" },
    fragment: {
      module,
      entryPoint: "fragmentMain",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });
  const instanceBuffer = device.createBuffer({
    label: "presentation-snapshot-compositor-cells",
    size: maximumCompositeCells * floatsPerCell * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: instanceBuffer } }],
  });

  const begin = (label: string) => {
    const encoder = device.createCommandEncoder({ label });
    const pass = encoder.beginRenderPass({
      label,
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    return { encoder, pass };
  };
  const clear = () => {
    const { encoder, pass } = begin("presentation-snapshot-clear");
    pass.end();
    device.queue.submit([encoder.finish()]);
  };
  const render = (prepared: PreparedSnapshotComposite) => {
    device.queue.writeBuffer(instanceBuffer, 0, prepared.instances);
    const { encoder, pass } = begin("presentation-snapshot-composite");
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6, prepared.cellCount);
    pass.end();
    device.queue.submit([encoder.finish()]);
  };
  clear();
  return { render, clear, destroy: () => instanceBuffer.destroy() };
}
