import { compare, deserializeCamera, dyadic, negate, serializeCamera, serializeDyadic, subtract, type ExactCamera, type SerializedCamera } from "@webgpu-zoomer/exact-camera";
import type { PresentationCell, PresentationSnapshot } from "@webgpu-zoomer/presentation-snapshot";

export type HistoryCell = (PresentationCell & Readonly<{
  sourceSnapshotId: string;
  sourceEpoch: string;
}>);

export type PresentationHistoryFrame = Readonly<{
  schemaVersion: 1;
  frameId: string;
  checksum: string;
  authority: "presentation-history-only";
  viewKey: string;
  latestSnapshotId: string;
  camera: SerializedCamera;
  requestEpoch: string;
  formulaVersion: number;
  level: string;
  domain: NonNullable<PresentationSnapshot["domain"]>;
  bounds: PresentationSnapshot["bounds"];
  counts: Readonly<{ total: number; accepted: number; unresolved: number }>;
  cells: readonly HistoryCell[];
}>;

export type HistoryPublishResult = Readonly<{
  status: "inserted" | "merged" | "unchanged" | "rejected";
  reason: "accepted" | "duplicate" | "stale_epoch" | "conflict" | "invalid_snapshot";
  viewKey?: string;
  evictedViewKey?: string;
}>;

export type HistoryReprojection = Readonly<{
  kind: "limited_dyadic_pan_zoom_v1";
  targetScaleExponentDelta: string;
  maximumSourceCenterOffset: SerializedCamera["viewportScale"];
}>;

export type HistorySelection = Readonly<{
  selected: true;
  frame: PresentationHistoryFrame;
  reprojection?: HistoryReprojection;
}> | Readonly<{
  selected: false;
  reason: "no_history" | "invalid_transform" | "viewport_mismatch";
}>;

export type PresentationHistoryDiagnostics = Readonly<{
  schemaVersion: 1;
  maximumViews: number;
  residentViews: number;
  insertedViews: number;
  mergedViews: number;
  evictedViews: number;
  staleSnapshots: number;
  conflicts: number;
}>;

type StoredFrame = { frame: PresentationHistoryFrame; sequence: number };

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function spatialCamera(camera: SerializedCamera) {
  return {
    centerX: camera.centerX,
    centerY: camera.centerY,
    viewportScale: camera.viewportScale,
  };
}

function viewIdentity(snapshot: PresentationSnapshot): string {
  const core = {
    spatialCamera: spatialCamera(snapshot.camera),
    formulaVersion: snapshot.formulaVersion,
    level: snapshot.level,
    domain: snapshot.domain,
    bounds: snapshot.bounds,
    cells: snapshot.cells.map((cell) => cell.key),
  };
  return `presentation-view:fnv1a64:${fnv1a64(JSON.stringify(core))}`;
}

function decorateCell(cell: PresentationCell, snapshot: PresentationSnapshot): HistoryCell {
  return Object.freeze({
    ...cell,
    sourceSnapshotId: snapshot.snapshotId,
    sourceEpoch: snapshot.requestEpoch,
  });
}

function finishFrame(input: Omit<PresentationHistoryFrame, "frameId" | "checksum">): PresentationHistoryFrame {
  const checksum = `fnv1a64:${fnv1a64(JSON.stringify(input))}`;
  return Object.freeze({ ...input, frameId: `presentation-history-frame:${checksum}`, checksum });
}

function frameFromSnapshot(snapshot: PresentationSnapshot, viewKey: string): PresentationHistoryFrame {
  if (!snapshot.domain) throw new Error("Presentation history requires an explicit viewport domain.");
  return finishFrame({
    schemaVersion: 1,
    authority: "presentation-history-only",
    viewKey,
    latestSnapshotId: snapshot.snapshotId,
    camera: snapshot.camera,
    requestEpoch: snapshot.requestEpoch,
    formulaVersion: snapshot.formulaVersion,
    level: snapshot.level,
    domain: snapshot.domain,
    bounds: snapshot.bounds,
    counts: snapshot.counts,
    cells: Object.freeze(snapshot.cells.map((cell) => decorateCell(cell, snapshot))),
  });
}

function validSnapshot(snapshot: PresentationSnapshot): boolean {
  if (snapshot.authority !== "presentation-only" || !snapshot.domain || snapshot.cells.length !== snapshot.counts.total
    || snapshot.counts.accepted + snapshot.counts.unresolved !== snapshot.counts.total
    || snapshot.camera.epoch !== snapshot.requestEpoch || !/^\d+$/.test(snapshot.requestEpoch)
    || !Number.isSafeInteger(snapshot.formulaVersion) || snapshot.formulaVersion < 0) return false;
  const keys = snapshot.cells.map((cell) => JSON.stringify(cell.key));
  return new Set(keys).size === keys.length
    && snapshot.cells.filter((cell) => cell.source === "accepted").length === snapshot.counts.accepted
    && snapshot.cells.filter((cell) => cell.source === "unresolved").length === snapshot.counts.unresolved;
}

function sameSpatialCamera(left: SerializedCamera, right: SerializedCamera): boolean {
  return JSON.stringify(spatialCamera(left)) === JSON.stringify(spatialCamera(right));
}

function withinClosedDyadicRange(value: ExactCamera["centerX"], limit: ExactCamera["centerX"]): boolean {
  return compare(value, limit) <= 0 && compare(value, negate(limit)) >= 0;
}

export function historyReprojectionFor(
  frame: PresentationHistoryFrame,
  target: ExactCamera,
): HistoryReprojection | undefined {
  try {
    const source = deserializeCamera(frame.camera);
    if (source.viewportScale.numerator !== target.viewportScale.numerator) return undefined;
    const targetScaleExponentDelta = target.viewportScale.exponent - source.viewportScale.exponent;
    if (targetScaleExponentDelta < -1n || targetScaleExponentDelta > 1n) return undefined;
    const maximumSourceCenterOffset = dyadic(source.viewportScale.numerator, source.viewportScale.exponent - 1n);
    const offsetX = subtract(target.centerX, source.centerX);
    const offsetY = subtract(target.centerY, source.centerY);
    if (!withinClosedDyadicRange(offsetX, maximumSourceCenterOffset)
      || !withinClosedDyadicRange(offsetY, maximumSourceCenterOffset)) return undefined;
    return Object.freeze({
      kind: "limited_dyadic_pan_zoom_v1",
      targetScaleExponentDelta: targetScaleExponentDelta.toString(),
      maximumSourceCenterOffset: serializeDyadic(maximumSourceCenterOffset),
    });
  } catch {
    return undefined;
  }
}

export class PresentationHistoryStore {
  readonly #maximumViews: number;
  readonly #views = new Map<string, StoredFrame>();
  #sequence = 0;
  #insertedViews = 0;
  #mergedViews = 0;
  #evictedViews = 0;
  #staleSnapshots = 0;
  #conflicts = 0;

  constructor(maximumViews: number) {
    if (!Number.isSafeInteger(maximumViews) || maximumViews < 1) {
      throw new RangeError("maximumViews must be a positive safe integer.");
    }
    this.#maximumViews = maximumViews;
  }

  publish(snapshot: PresentationSnapshot): HistoryPublishResult {
    if (!validSnapshot(snapshot)) return { status: "rejected", reason: "invalid_snapshot" };
    const viewKey = viewIdentity(snapshot);
    const current = this.#views.get(viewKey);
    if (!current) {
      let evictedViewKey: string | undefined;
      if (this.#views.size >= this.#maximumViews) {
        const oldest = [...this.#views.entries()].sort((left, right) => left[1].sequence - right[1].sequence)[0];
        if (oldest) {
          evictedViewKey = oldest[0];
          this.#views.delete(evictedViewKey);
          this.#evictedViews += 1;
        }
      }
      this.#sequence += 1;
      this.#views.set(viewKey, { frame: frameFromSnapshot(snapshot, viewKey), sequence: this.#sequence });
      this.#insertedViews += 1;
      return { status: "inserted", reason: "accepted", viewKey, ...(evictedViewKey ? { evictedViewKey } : {}) };
    }
    const currentEpoch = BigInt(current.frame.requestEpoch);
    const incomingEpoch = BigInt(snapshot.requestEpoch);
    if (incomingEpoch < currentEpoch) {
      this.#staleSnapshots += 1;
      return { status: "rejected", reason: "stale_epoch", viewKey };
    }
    if (incomingEpoch === currentEpoch) {
      if (snapshot.snapshotId === current.frame.latestSnapshotId) {
        return { status: "unchanged", reason: "duplicate", viewKey };
      }
      this.#conflicts += 1;
      return { status: "rejected", reason: "conflict", viewKey };
    }

    if (snapshot.cells.length !== current.frame.cells.length
      || snapshot.cells.some((cell, index) => JSON.stringify(cell.key) !== JSON.stringify(current.frame.cells[index]!.key))) {
      this.#conflicts += 1;
      return { status: "rejected", reason: "conflict", viewKey };
    }
    const cells = snapshot.cells.map((incoming, index): HistoryCell => {
      const existing = current.frame.cells[index]!;
      if (incoming.source === "accepted" || existing.source === "unresolved") return decorateCell(incoming, snapshot);
      return existing;
    });
    const accepted = cells.filter((cell) => cell.source === "accepted").length;
    const frame = finishFrame({
      schemaVersion: 1,
      authority: "presentation-history-only",
      viewKey,
      latestSnapshotId: snapshot.snapshotId,
      camera: snapshot.camera,
      requestEpoch: snapshot.requestEpoch,
      formulaVersion: snapshot.formulaVersion,
      level: snapshot.level,
      domain: snapshot.domain!,
      bounds: snapshot.bounds,
      counts: Object.freeze({ total: cells.length, accepted, unresolved: cells.length - accepted }),
      cells: Object.freeze(cells),
    });
    this.#sequence += 1;
    this.#views.set(viewKey, { frame, sequence: this.#sequence });
    this.#mergedViews += 1;
    return { status: "merged", reason: "accepted", viewKey };
  }

  select(camera: ExactCamera, viewportWidth: number, viewportHeight: number): HistorySelection {
    if (this.#views.size === 0) return { selected: false, reason: "no_history" };
    if (!Number.isSafeInteger(viewportWidth) || viewportWidth < 1
      || !Number.isSafeInteger(viewportHeight) || viewportHeight < 1) {
      return { selected: false, reason: "viewport_mismatch" };
    }
    const stored = [...this.#views.values()];
    const serialized = serializeCamera(camera);
    const spatialMatches = stored.filter(({ frame }) => sameSpatialCamera(frame.camera, serialized));
    const exactViewportMatches = spatialMatches.filter(({ frame }) => frame.domain.width === viewportWidth
      && frame.domain.height === viewportHeight);
    exactViewportMatches.sort((left, right) => {
      const epochOrder = BigInt(right.frame.requestEpoch) - BigInt(left.frame.requestEpoch);
      return epochOrder < 0n ? -1 : epochOrder > 0n ? 1 : left.frame.viewKey.localeCompare(right.frame.viewKey);
    });
    if (exactViewportMatches.length > 0) return Object.freeze({ selected: true, frame: exactViewportMatches[0]!.frame });
    if (spatialMatches.length > 0) return { selected: false, reason: "viewport_mismatch" };

    const viewportMatches = stored.filter(({ frame }) => frame.domain.width === viewportWidth
      && frame.domain.height === viewportHeight);
    if (viewportMatches.length === 0) return { selected: false, reason: "viewport_mismatch" };
    const reprojectable = viewportMatches.flatMap(({ frame }) => {
      const reprojection = historyReprojectionFor(frame, camera);
      return reprojection ? [{ frame, reprojection }] : [];
    });
    reprojectable.sort((left, right) => {
      const epochOrder = BigInt(right.frame.requestEpoch) - BigInt(left.frame.requestEpoch);
      return epochOrder < 0n ? -1 : epochOrder > 0n ? 1 : left.frame.viewKey.localeCompare(right.frame.viewKey);
    });
    if (reprojectable.length === 0) return { selected: false, reason: "invalid_transform" };
    return Object.freeze({
      selected: true,
      frame: reprojectable[0]!.frame,
      reprojection: reprojectable[0]!.reprojection,
    });
  }

  snapshot(): readonly PresentationHistoryFrame[] {
    return Object.freeze([...this.#views.values()].map(({ frame }) => frame)
      .sort((left, right) => left.viewKey.localeCompare(right.viewKey)));
  }

  checksum(): string {
    return `fnv1a64:${fnv1a64(JSON.stringify(this.snapshot()))}`;
  }

  diagnostics(): PresentationHistoryDiagnostics {
    return Object.freeze({
      schemaVersion: 1,
      maximumViews: this.#maximumViews,
      residentViews: this.#views.size,
      insertedViews: this.#insertedViews,
      mergedViews: this.#mergedViews,
      evictedViews: this.#evictedViews,
      staleSnapshots: this.#staleSnapshots,
      conflicts: this.#conflicts,
    });
  }
}
