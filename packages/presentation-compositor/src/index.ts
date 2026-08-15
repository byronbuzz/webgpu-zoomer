import {
  deserializeCamera,
  dyadic,
  serializeCamera,
  subtract,
  type ExactCamera,
  type ExactDyadic,
} from "@webgpu-zoomer/exact-camera";
import { approximateDyadic } from "@webgpu-zoomer/exact-camera/approximate";
import { historyReprojectionFor, type HistoryReprojection, type PresentationHistoryFrame } from "@webgpu-zoomer/presentation-history";
import type { PresentationCell, PresentationSnapshot } from "@webgpu-zoomer/presentation-snapshot";
import { presentationCompositeShader } from "./composite.wgsl.js";

const floatsPerCell = 8;
const maximumCompositeCells = 512;
const maximumTransformErrorPx = 0.25;

export type PreparedSnapshotComposite = Readonly<{
  accepted: true;
  snapshotId: string;
  checksum: string;
  historyFrameId?: string;
  reprojection?: HistoryReprojection;
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

type CompositeSource = Readonly<{
  snapshotId: string;
  checksum: string;
  authority: "presentation-only" | "presentation-history-only";
  camera: PresentationSnapshot["camera"];
  level: string;
  domain: NonNullable<PresentationSnapshot["domain"]> | undefined;
  counts: Readonly<{ total: number; accepted: number; unresolved: number }>;
  cells: readonly PresentationCell[];
}>;

function sameCamera(serialized: PresentationSnapshot["camera"], camera: ExactCamera): boolean {
  return JSON.stringify(serialized) === JSON.stringify(serializeCamera(camera));
}

function sourceFromSnapshot(snapshot: PresentationSnapshot): CompositeSource {
  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    checksum: snapshot.checksum,
    authority: snapshot.authority,
    camera: snapshot.camera,
    level: snapshot.level,
    domain: snapshot.domain,
    counts: snapshot.counts,
    cells: snapshot.cells,
  });
}

function sourceFromHistory(frame: PresentationHistoryFrame): CompositeSource {
  return Object.freeze({
    snapshotId: frame.latestSnapshotId,
    checksum: frame.checksum,
    authority: frame.authority,
    camera: frame.camera,
    level: frame.level,
    domain: frame.domain,
    counts: frame.counts,
    cells: frame.cells,
  });
}

function prepareComposite(
  source: CompositeSource,
  camera: ExactCamera,
  viewportWidth: number,
  viewportHeight: number,
): SnapshotCompositePreparation {
  if (!Number.isSafeInteger(viewportWidth) || viewportWidth < 1
    || !Number.isSafeInteger(viewportHeight) || viewportHeight < 1) {
    return Object.freeze({ accepted: false, reason: "viewport_mismatch" });
  }
  if (!source.domain || source.domain.kind !== "integer-aspect" || source.domain.version !== 1
    || source.domain.width !== viewportWidth || source.domain.height !== viewportHeight) {
    return Object.freeze({ accepted: false, reason: "viewport_mismatch" });
  }
  if (source.cells.length > maximumCompositeCells) {
    return Object.freeze({ accepted: false, reason: "resource_budget_exhausted" });
  }
  if (source.cells.length !== source.counts.total
    || source.counts.accepted + source.counts.unresolved !== source.counts.total
    || (source.authority !== "presentation-only" && source.authority !== "presentation-history-only")) {
    return Object.freeze({ accepted: false, reason: "invalid_snapshot" });
  }

  const targetScale = exactFinite(camera.viewportScale);
  if (targetScale === undefined || targetScale <= 0) return Object.freeze({ accepted: false, reason: "precision_limit" });
  const aspect = viewportWidth / viewportHeight;
  const instances = new Float32Array(source.cells.length * floatsPerCell);
  let acceptedCount = 0;
  let unresolvedCount = 0;
  for (let index = 0; index < source.cells.length; index += 1) {
    const cell = source.cells[index]!;
    if (cell.key.level !== source.level) return Object.freeze({ accepted: false, reason: "invalid_snapshot" });
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
    const minimumX = exactFinite(subtract(dyadic(x, level), camera.centerX));
    const maximumX = exactFinite(subtract(dyadic(x + 1n, level), camera.centerX));
    const minimumY = exactFinite(subtract(dyadic(y, level), camera.centerY));
    const maximumY = exactFinite(subtract(dyadic(y + 1n, level), camera.centerY));
    if (minimumX === undefined || maximumX === undefined || minimumY === undefined || maximumY === undefined) {
      return Object.freeze({ accepted: false, reason: "precision_limit" });
    }
    const clipMinimumX = boundedF32(2 * minimumX / (aspect * targetScale), viewportWidth);
    const clipMaximumX = boundedF32(2 * maximumX / (aspect * targetScale), viewportWidth);
    const clipMinimumY = boundedF32(-2 * maximumY / targetScale, viewportHeight);
    const clipMaximumY = boundedF32(-2 * minimumY / targetScale, viewportHeight);
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
  if (acceptedCount !== source.counts.accepted || unresolvedCount !== source.counts.unresolved) {
    return Object.freeze({ accepted: false, reason: "invalid_snapshot" });
  }
  return Object.freeze({
    accepted: true,
    snapshotId: source.snapshotId,
    checksum: source.checksum,
    cellCount: source.cells.length,
    acceptedCount,
    unresolvedCount,
    transformErrorLimitPx: maximumTransformErrorPx,
    instances,
  });
}

export function prepareSnapshotComposite(
  snapshot: PresentationSnapshot,
  camera: ExactCamera,
  viewportWidth: number,
  viewportHeight: number,
): SnapshotCompositePreparation {
  if (!sameCamera(snapshot.camera, camera)) return Object.freeze({ accepted: false, reason: "camera_mismatch" });
  return prepareComposite(sourceFromSnapshot(snapshot), camera, viewportWidth, viewportHeight);
}

export function prepareHistoryComposite(
  frame: PresentationHistoryFrame,
  reprojection: HistoryReprojection | undefined,
  camera: ExactCamera,
  viewportWidth: number,
  viewportHeight: number,
): SnapshotCompositePreparation {
  if (reprojection) {
    const validated = historyReprojectionFor(frame, camera);
    if (!validated || JSON.stringify(validated) !== JSON.stringify(reprojection)) {
      return Object.freeze({ accepted: false, reason: "camera_mismatch" });
    }
  } else if (!sameCamera(frame.camera, camera)) {
    return Object.freeze({ accepted: false, reason: "camera_mismatch" });
  }
  const prepared = prepareComposite(sourceFromHistory(frame), camera, viewportWidth, viewportHeight);
  return prepared.accepted
    ? Object.freeze({ ...prepared, historyFrameId: frame.frameId, ...(reprojection ? { reprojection } : {}) })
    : prepared;
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
