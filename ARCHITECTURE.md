# Architecture

## 1. Design objective

Build the least complex browser architecture capable of:

- exact, indefinite-depth navigation;
- conservative deep Mandelbrot evaluation;
- high-throughput WebGPU convergence;
- display-rate XaoS-like motion despite asynchronous convergence;
- bounded client resources;
- independent falsification of numerical and performance claims.

The system has **two clocks** and **three truth domains**.

### Clocks

1. **Interaction/presentation clock** — `requestAnimationFrame`, follows display cadence.
2. **Numerical convergence clock** — asynchronous CPU/WASM and GPU work, bounded by budgets.

### Truth domains

1. **Exact navigation authority** — exact dyadic camera/world state.
2. **Numerical authority** — accepted mathematical samples with provenance/error metadata.
3. **Presentation estimates** — derived pixels/history; never feed upstream.

## 2. Component model

```text
Input
  │
  ▼
Exact Camera ───────► View/World Planner ───────► Numerical Demand Queue
  │                         │                           │
  │                         │                           ├────► Rust/WASM Precision Pool
  │                         │                           │        reference orbits
  │                         │                           │        exact transforms
  │                         │                           │        error metadata
  │                         │                           │        oracle/fallback
  │                         │                           │
  │                         │                           └────► WebGPU Convergence Engine
  │                         │                                    packed state
  │                         │                                    active work queues
  │                         │                                    perturbation/direct/etc.
  │                         │                                             │
  │                         └─────────────────────────────────────────────┤
  │                                                                       ▼
  └─────────────────────────────────────────────────────────────► Accepted Numerical Store
                                                                          │
                                                                          ▼
                                                               Presentation Snapshot Store
                                                                          │
                                                                          ▼
                                                                  Reprojection/Compositor
                                                                          │
                                                                          ▼
                                                                        Canvas
```

## 3. Exact camera and world model

Represent center coordinates as signed arbitrary integers with a shared/fixed dyadic exponent or equivalent exact binary rational representation. Represent viewport scale as a normalized dyadic value whose exponent range is not tied to JS floating-point magnitude.

Pointer input arrives as finite screen-space floating values. Convert pointer deltas to exact world deltas using the current exact camera state and an explicitly bounded conversion. The pointer itself need not be arbitrary precision; the **updated authoritative camera must be**.

World sample/tile keys use integer coordinates plus level/exponent. Tile planning must implement mathematical floor for negative coordinates. Identity is independent of viewport history.

## 4. Rust/WASM precision subsystem

### Responsibilities

- arbitrary-precision complex arithmetic;
- exact camera/world conversion helpers that are awkward/expensive in JS;
- reference orbit generation;
- reference error estimates;
- deterministic CPU oracle for fixtures and differential tests;
- optional certified fallback computation for pixels/blocks that GPU methods cannot safely resolve;
- serialization into bounded, versioned GPU transport formats.

### Concurrency

Use a shared-memory worker pool under required cross-origin isolation. The main thread never waits synchronously for orbit completion. Requests use immutable IDs/epochs and cancellation flags.

### Library policy

Do not choose a multiprecision library by familiarity. Prototype at least:

- a pure-Rust arbitrary-precision approach suitable for WASM;
- an MPFR-class binding path if build/licensing/binary-size/runtime characteristics permit.

Selection criteria: correctness confidence, deterministic testability, exponent range, precision scalability, WASM threading, orbit throughput, memory, binary size, maintenance.

## 5. Numerical method stack

The architecture specifies **contracts**, not a premature fixed cascade.

### Mandatory baseline

1. analytic interior proofs where exact/conservative;
2. direct GPU iteration for numerically safe shallow/local cases;
3. arbitrary-precision CPU oracle/reference generation;
4. perturbation-based GPU recurrence for deep regions;
5. escalation to stronger reference/precision or CPU fallback on failed bounds.

### Candidate accelerations

- scaled perturbation;
- rebasing;
- series approximation / BLA-class skipping;
- reference reuse over proven validity regions;
- active-pixel compaction;
- indirect dispatch;
- subgroup-assisted scans/compaction where capability and benchmarks justify it.

Each candidate lives behind an interface and feature flag until it passes differential correctness and benchmark gates.

## 6. Error model

A numerical work item carries an error ledger with components such as:

- exact-to-transport coordinate error;
- reference-orbit error;
- transported-reference reconstruction error;
- perturbation state error;
- floating-point rounding envelope;
- scaling/rebase transform error;
- approximation truncation error;
- escape-decision margin.

The exact representation may change. The contract does not: publication requires a conservative bound showing that the reported semantic result cannot be changed by permitted error.

For an escape classification, the implementation must establish sufficient margin around the bailout decision. If the bound overlaps the decision boundary, the sample remains unresolved or escalates.

## 7. GPU convergence engine

### Resource topology

Use pooled/packed buffers and textures:

- numerical state arena;
- result/provenance arena;
- active-index/work queues;
- reference orbit buffers/atlas;
- accepted result atlas/store.

Do not allocate a large independent resource set per world tile.

### Work topology

A work item includes:

- canonical world region/sample identity;
- request epoch;
- formula/method ID;
- precision/reference ID;
- current iteration/progress;
- error/provenance state.

GPU work is chunked and resumable. Active pixels should be compacted or otherwise prevented from consuming full-tile work after convergence when benchmarks show material benefit.

### CPU/GPU synchronization

The host submits bounded work and samples telemetry asynchronously. Per-batch awaited readback is forbidden on the interaction-critical path. GPU timestamps are optional measurement capabilities, not correctness dependencies.

### Publication

GPU results go through a publication pass/check:

- epoch valid;
- reference/method version valid;
- no bound failure;
- semantic status legal;
- quality monotonic.

Only then do they enter accepted numerical state.

## 8. Accepted numerical store

This store is the authoritative cache visible to presentation. It is keyed by canonical world identity and includes:

- classification/provenance;
- iteration/continuous-potential channels as applicable;
- quality/precision/reference version;
- freshness/epoch;
- optional error summary.

Eviction is allowed; mutation from presentation is not.

## 9. Presentation system

Maintain immutable or logically immutable multiscale snapshots derived from accepted numerical results. During motion:

1. compute exact current camera transform;
2. select geometrically valid history;
3. reproject it;
4. overlay freshest accepted current-view samples;
5. optionally show provisional styling for unresolved regions;
6. drop history whose transform/scale validity fails.

Avoid repeatedly filtering one rolling framebuffer as the sole history because this compounds blur and stale detail.

## 10. Shading

Numerical results expose formula-independent channels where practical:

```text
classification
smooth_escape_value?
distance_or_auxiliary?   (future/optional)
quality/provenance
```

Palette selection and most shading execute downstream on GPU. Recolouring does not trigger recurrence.

## 11. Formula boundary

Define a `FormulaModule` contract with:

- identity/version;
- direct recurrence shader fragment/module;
- arbitrary-precision reference/oracle implementation;
- bailout semantics;
- analytic interior proofs;
- perturbation/approximation implementation and validity model;
- result channels.

Mandelbrot may bypass generic dispatch in hot loops. The boundary exists at build/architecture level, not necessarily as runtime virtual calls.

## 12. Product shell

TypeScript UI owns:

- canvas lifecycle;
- primary pointer/keyboard navigation;
- status and diagnostics;
- palette state;
- bookmarks/shareable state;
- adapter/capability reporting.

It does not own arbitrary-precision math.

## 13. Capability tiers

### Stable production tier

Current stable Chromium, WebGPU, required cross-origin isolation, baseline compute/storage capabilities.

### Stable optional tier

Adapter-reported features such as timestamp queries or other standardized optional features may improve instrumentation/performance.

### Experimental tier

Browser-origin-trial/flag/development capabilities live in separate modules/build flags, are never necessary for product correctness, and cannot be enabled silently in release acceptance.

## 14. Recovery

- GPU device loss: stop publication, retain exact camera/bookmarks, reacquire adapter/device where possible, rebuild ephemeral GPU state, resume.
- Worker failure: recreate worker, invalidate dependent reference IDs, requeue unresolved work.
- OOM/resource pressure: evict presentation history first, then non-visible numerical cache; preserve exact state.
- Invalid numerical bound: quarantine work as unresolved; do not crash or colour as authoritative interior.
