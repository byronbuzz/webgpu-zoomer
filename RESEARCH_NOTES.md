# Research Notes

**Evidence cut:** 2026-08-08.

## Legacy findings

### Strong surviving ideas

Inspection of the supplied v1.4 code/documentation supports retaining the *principles* of:

- exact immutable camera state;
- exponent-separated scale;
- persistent world-space tile/sample identity;
- accepted numerical state separated from presentation history;
- semantic provenance;
- epochs/leases to prevent stale overwrite;
- multiscale presentation history;
- asynchronous numerical scheduling;
- deterministic browser fixtures/evidence capture.

### Precision concern

The v1.4 archive contains camera/reference code with nominally wide representations, but important paths convert exact fixed values through JavaScript `number`, floating expansions, and GPU `f32` reconstruction. Therefore the supplied implementation does not establish arbitrary-depth end-to-end precision merely from its camera bit width or transport-width labels.

Relevant legacy locations include:

- `src/v4/referenceWorker.ts`
- `src/numerical/precisionPolicy.ts`
- `src/numerical/tileFieldShadersV13.ts`
- `src/presentation/progressiveTileFieldRenderer.ts`

The successor must replace nominal precision tiers with explicit error accounting.

### Scheduler/resource concern

`src/presentation/progressiveTileFieldRenderer.ts` shows a tile object holding numerous buffers/textures and a scheduler with bounded in-flight batches, counter readbacks, and host-side state advancement. This is a useful working prototype but not the target topology for maximal continuous throughput.

The successor should experimentally compare packed arenas plus active-work compaction/queues against a simpler stable baseline.

### Evidence concern

The supplied v1.4 evidence set is valuable but cannot be treated as unquestioned release proof:

- the inspected numerical trace archive was malformed;
- an associated browser report was truncated/malformed;
- the precision overlap report records 538 semantic-conflict events;
- performance comparison evidence demonstrates a directional improvement on one setup but does not establish universal throughput because admitted workload differs.

The new evidence format therefore validates its own integrity.

## Current platform facts used by the specification

Re-verify these at implementation/release time.

- The WebGPU specification defines optional adapter/device features; optional capabilities must be detected rather than assumed.
- WebGPU timestamp queries are an optional feature and are suitable for GPU timing when available, but are not a correctness dependency.
- Chromium exposes WebGPU as the targeted browser platform and has progressively shipped optional features such as `shader-f16`/subgroup-related capabilities; the project must still capability-detect them.
- Shared-memory browser/WASM operation requires a cross-origin-isolated deployment context; the hosting configuration must provide the required isolation headers and runtime verification.

Primary/current references consulted:

- WebGPU specification: https://gpuweb.github.io/gpuweb/
- WebGPU CTS: https://gpuweb.github.io/cts/
- Chrome WebGPU documentation: https://developer.chrome.com/docs/web-platform/webgpu
- Chrome WebGPU update archive: https://developer.chrome.com/blog/new-in-webgpu-120 and later version notes
- Cross-origin isolation background/reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy

## Research questions that require experiments, not prose

1. Which Rust multiprecision implementation gives the best reference-orbit correctness/throughput/size tradeoff under threaded WASM?
2. What error-bound representation is conservative enough for publication while compact enough for GPU execution?
3. Which perturbation scaling/rebase scheme survives adversarial deep fixtures?
4. At what workloads does series/BLA-style approximation repay its complexity?
5. Which active-work strategy performs best across NVIDIA/AMD: prefix-sum compaction, atomic queues, indirect dispatch, hybrid tile/sample queues?
6. What packed result/state formats minimize bandwidth without losing required provenance/error information?
7. How many multiscale history snapshots maximize continuity before memory/bandwidth cost dominates?
8. What stable browser capability subset should define the first hardware qualification class?
