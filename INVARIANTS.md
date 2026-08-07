# Architectural and Numerical Invariants

These invariants outrank local performance goals.

## I-01 Exact authority

Canonical camera center, scale, bookmark, world-coordinate, and tile/sample identity operations do not round through JavaScript `number`.

## I-02 Truth has provenance

Every accepted numerical sample has explicit semantic state. `unresolved`, `invalid`, or conflicted work cannot be relabelled by presentation logic.

## I-03 Cap is not interior proof

Iteration/work exhaustion never means certified interior.

## I-04 Presentation cannot become evidence

No texture/buffer containing reprojected, filtered, colour-mapped, or otherwise presentation-derived values may be consumed as numerical recurrence state, reference orbit authority, or classification evidence.

## I-05 Monotonic authority

A result may replace an existing authoritative result only if it belongs to the same/newer request epoch and is at least as authoritative under the defined quality/provenance ordering.

## I-06 Approximation has a validity region

Perturbation, rebasing, scaling, series/BLA, interpolation, or skipped iteration is legal only while its executable bound holds. Bound failure routes to unresolved/stronger work.

## I-07 Reference is independently checkable

GPU work never becomes the sole authority for its own reference data. The Rust/WASM precision path can reproduce/validate representative cases independently.

## I-08 No fixed depth crossover

Depth may influence required precision and chosen algorithms but not trigger a hard “unsupported beyond here” mathematical representation boundary.

## I-09 Interaction does not wait for convergence

The render/input loop never blocks on arbitrary-precision reference generation, per-batch GPU readback, or full numerical completion.

## I-10 Bounded resources

CPU, WASM, GPU, history, reference, and fixture caches have explicit budgets and eviction policies. Eviction cannot corrupt authoritative state.

## I-11 Stale work is harmless

Cancellation is logical/epoch-based. Work already submitted may finish, but publication checks prevent stale mutation.

## I-12 Stable path exists

Every production-required capability has a path using current stable APIs. Experimental acceleration is removable without changing correctness.

## I-13 Colour is downstream

Palette/shading parameters cannot influence escape/interior classification or require recurrence recomputation unless a future shading method explicitly becomes a numerical observable with its own requirement.

## I-14 Cross-hardware semantics

Different supported adapters may produce different low-level floating results, but accepted semantic classifications and declared numerical channels remain within specified comparison bounds.

## I-15 Evidence beats labels

A `PASS` string, README, agent statement, or source invariant is not proof unless the required command/runtime artefact exists and its contents satisfy the gate.
