# Decisions

All decisions below were accepted on 2026-08-08 unless stated otherwise.

## D-001 — Fully client-side static product
**Decision:** No required backend.  
**Rationale:** preserves the browser-native explorer goal and keeps deep calculation local.  
**Consequence:** arbitrary-precision/reference machinery must run in-browser; hosting must support required headers.

## D-002 — Desktop Chromium first
**Decision:** Optimize initial production for current stable Chromium/WebGPU on desktop discrete GPUs.  
**Alternative rejected:** cross-browser/mobile as initial constraint.  
**Consequence:** architecture may exploit Chromium-available standardized WebGPU capabilities while preserving stable API requirements.

## D-003 — Mandelbrot-first, extensible formulas
**Decision:** Mandelbrot is the first optimized formula; explicit formula boundaries prevent renderer-wide coupling.  
**Consequence:** no abstraction tax in the shader hot loop is required.

## D-004 — No fixed depth ceiling
**Decision:** mathematical representation scales with depth rather than switching to “unsupported”.  
**Consequence:** extreme depth may become slower; performance benchmarks use explicit tiers rather than claiming constant speed.

## D-005 — Display-rate-adaptive interaction
**Decision:** target current display refresh cadence.  
**Consequence:** frame-time budget drives presentation work.

## D-006 — Hybrid presentation with strict provenance
**Decision:** geometrically valid history may fill the frame; it is never numerical truth.  
**Consequence:** numerical and presentation stores are architecturally separate.

## D-007 — Vendor-neutral midrange baseline
**Decision:** acceptance uses a qualifying hardware class and both NVIDIA and AMD physical systems rather than one SKU.  
**Consequence:** qualification thresholds must be calibrated and versioned.

## D-008 — Conservative numerical authority
**Decision:** publish only when error/validity conditions justify the semantic result.  
**Consequence:** uncertainty is explicit and may cost additional work.

## D-009 — XaoS-style direct manipulation
**Decision:** continuous pointer-focused hold zoom is core.  
**Consequence:** numerical scheduling cannot control camera responsiveness.

## D-010 — Extensible shading boundary
**Decision:** minimal high-quality initial colouring, downstream of numerical result channels.  
**Consequence:** palette changes do not trigger recurrence.

## D-011 — Required cross-origin isolation
**Decision:** production hosting must enable shared-memory WASM workers.  
**Consequence:** generic hosts without header control are unsupported.

## D-012 — Rust/WASM precision boundary
**Decision:** Rust owns arbitrary-precision/reference logic; TypeScript owns browser/WebGPU orchestration.  
**Consequence:** repository and CI are mixed-language.

## D-013 — User-sovereign navigation
**Decision:** backlog degrades detail/freshness before camera motion.  
**Consequence:** presenter requires robust historical continuity and explicit coverage telemetry.

## D-014 — Three-state non-escape semantics
**Decision:** authoritative states distinguish escaped, certified interior, unresolved; unresolved may have provisional interior-like display.  
**Consequence:** cap exhaustion cannot become interior.

## D-015 — Semantic determinism
**Decision:** cross-device semantics/bounds must agree; bitwise GPU identity is unnecessary.  
**Consequence:** validation compares classifications/channels, not framebuffer hashes alone.

## D-016 — Thin product shell
**Decision:** enough UI for a real explorer, no broad application scope until renderer is proven.

## D-017 — Stable + experimental dual path
**Decision:** production correctness uses stable APIs; experimental acceleration is capability-gated and separately promoted.

## D-018 — Clean successor repository
**Decision:** do not reorganize or increment v1.4.  
**Rationale:** legacy architecture carries unresolved numerical and scheduling assumptions; selective salvage is safer than inherited coupling.

## D-019 — GitHub Pages test deployment
**Decision:** publish validated `main` builds to the project GitHub Pages site. Because Pages does not expose response-header configuration, the test deployment may use a repository-local service worker to synthesize COOP/COEP for controlled responses.  
**Constraint:** runtime `crossOriginIsolated`, shared-memory, WebGPU, and numerical gates remain authoritative. Failure stays unsupported or unresolved; the service worker's presence is not acceptance evidence.  
**Consequence:** this provides a public test surface without silently weakening D-011 or selecting the final production host.

## D-020 — First visible slice is non-authoritative
**Decision:** the first post-Phase-0 visual slice is a fixed shallow direct WebGPU Mandelbrot canvas with downstream colouring. It is presentation-only and cannot write accepted numerical state.  
**Rationale:** this exercises the stable canvas/render/shading path immediately after the numerical-spine review without pretending that exact-camera interaction, deep precision, or production convergence exists.  
**Consequence:** the next slice must bind interaction to the exact dyadic camera and its tests; this preview cannot be reused as a numerical reference or acceptance shortcut.

## D-021 — Exact camera precedes interactive presentation
**Decision:** pointer hold, wheel zoom, steering, inverse zoom, and reset mutate only the canonical `ExactCamera`. Screen input is quantized once to an observable 20-fractional-bit dyadic focus; every zoom step preserves that exact world focus.  
**Presentation contract:** binary64 and f32 camera values are derived one-way with explicit error bounds. The shallow direct canvas renders only while combined conversion/rounding error stays within half a display pixel. Bound failure reports `precision-limit`; the exact camera may continue without inventing pixels or writing approximation back into authority.  
**Consequence:** camera authority uses exact power-of-two steps. Presentation interpolation is governed separately by D-022; authoritative deep convergence remains a later slice.

## D-022 — Display-clock interpolation is one-way
**Decision:** `requestAnimationFrame` interpolates only the derived shallow presentation transform between exact camera steps. New input may replace an in-flight presentation transition, but it cannot reconstruct or mutate camera authority.  
**Evidence contract:** runtime telemetry records presentation frame count, P95 frame spacing, maximum displayed pointer-focus error, and explicit `presentation-only` provenance. Initial browser tests use generous smoke ceilings (`< 0.75 px` focus error and `< 100 ms` P95), not release performance claims.  
**Consequence:** exact interaction appears smooth at display cadence while numerical and presentation clocks remain separate. Threshold calibration and long-duration trajectory benchmarks are still required by `FR-PERF-001`.

## D-023 — Shallow direct publication requires independent exact agreement
**Decision:** the bounded shallow direct path may publish only an `escaped` sample whose f32 WebGPU candidate and independent exact-dyadic oracle agree on the escape iteration. The publication result carries canonical exact-coordinate identity, request epoch, method/oracle versions, channels, quality tier, and the executable agreement contract. Unresolved, invalid, cap-exhausted, mismatched, or unversioned work cannot construct an accepted sample.  
**Store contract:** accepted samples are keyed by canonical world identity. Equivalent newer-epoch authority may replace older authority; stale epochs and semantic/channel conflicts are rejected. Store snapshots are sorted and checksummed for evidence. Presentation types have no conversion into the branded publication result.  
**Limit:** this is an oracle-validated shallow contract, not the future production error ledger and not permission to read back GPU work on the interaction path. Perturbation, transport, rebasing, series/BLA, continuous potential, interior certification beyond the oracle, and store eviction remain later bounded slices.

## D-024 — Canonical planning starts with an exact square demand window
**Decision:** the first `View/World Planner` slice maps an immutable `ExactCamera` to a bounded square world window. It selects a power-of-two cell level using exact dyadic scale and integer density, covers half-open bounds with mathematical floor/ceiling, and emits stable `WorldKey` values in deterministic row-major order. World keys do not contain request epoch; the enclosing sample plan does.  
**Evidence contract:** plans carry the exact serialized camera, bigint level/bounds, formula and sampling versions, explicit sample count, deterministic checksum/ID, and a replay check. Equivalent camera histories reproduce the same plan, epoch-only changes preserve world keys, negative quadrants are tested, extreme exponents remain representable, and over-budget demand fails before sample allocation.  
**Limit:** the square window deliberately avoids deriving authority from CSS/presentation aspect ratios. Exact non-square viewport planning, prioritization, queues, eviction, GPU submission, and accepted-store integration are later slices.

## D-025 — First asynchronous admission is bounded and logically cancellable
**Decision:** `AsyncWorkAdmission.admit` is a synchronous, non-awaitable operation that converts an immutable sample plan into versioned work items and starts an injected background batch. Work carries canonical cell-center identity, exact request epoch, method/oracle versions, iteration progress/budget, required channels, and unresolved initial provenance. Completion is checked against the globally active epoch and all work identity/version fields before it can reach D-023 and the accepted store. Newer epochs do not wait for older batches; late old completion is counted stale and discarded.  
**Initial browser bound:** the live diagnostic path admits the 144-cell D-024 plan with an eight-iteration budget and at most 512 pending items. Only coordinates exactly representable in f32 enter the direct GPU batch; other coordinates remain unresolved. The existing awaited GPU readback is confined to this diagnostic/background executor and is absent from input and `requestAnimationFrame` functions.  
**Rejected attempt:** a 64-iteration dense-grid exact-dyadic oracle probe caused pathological numerator-growth CPU work on non-analytically-resolved interior-like cells and was terminated. It produced no acceptance evidence. This confirms that the Phase-0 exact oracle is not the production dense-grid reference engine and that iteration count alone is not a sufficient resource bound.  
**Limit:** this slice proves admission, logical cancellation, stale safety, and bounded shallow publication. It does not yet provide GPU chunk preemption, a high-throughput reference pool, production queue prioritization, packed resource arenas, or long-duration resource settling.

## D-026 — Non-square demand uses exact integer-aspect arithmetic
**Decision:** the viewport planner accepts explicit positive integer width/height and computes horizontal half-span bounds as exact rationals in world-cell units. It never rounds aspect ratio through binary64 or stores rational coordinates as sample identity; emitted samples remain canonical dyadic `WorldKey`s. The domain records kind/version and original dimensions in the deterministic plan checksum.  
**Compatibility:** `planSquareSampleGrid` remains the stable fallback and retains checksum `fnv1a64:3cd55c4427a37a3f`. Equivalent dimension ratios emit identical world keys even though their enclosing plan identities differ, preserving world-cache stability while retaining exact request provenance.  
**Browser bound:** the diagnostic path captures the canvas backing dimensions as explicit integer demand-domain inputs, uses at most 512 samples, and feeds the resulting immutable plan to D-025. Canvas pixels and transforms still cannot classify samples or become numerical recurrence/reference inputs.  
**Limit:** this establishes exact visible-domain coverage, not pixel-per-sample production density, prioritization, adaptive levels, or presentation snapshots.

## D-027 — Presentation snapshots require total one-way coverage
**Decision:** a presentation snapshot is an immutable, deterministic derivative of one exact sample plan, same-epoch accepted-store snapshots, and an explicit unresolved entry for every planned cell not accepted. Construction rejects stale or foreign accepted samples, foreign or duplicate unresolved cells, accepted/unresolved overlap, and any coverage gap. Cells remain in canonical plan order and retain the exact serialized camera, formula version, and domain used to derive them.  
**Authority boundary:** the snapshot type contains presentation display values and explicit source labels only. It cannot construct the private branded `AcceptedSample`, cannot write the accepted numerical store, and is never consumed by camera, planner, recurrence, reference, comparison, or publication code. Its checksum proves deterministic presentation content, not numerical correctness.  
**Initial browser bound:** the diagnostic path constructs the snapshot only after D-025 becomes idle. Accepted escape iterations are copied downstream for display; all other planned cells are explicitly `unresolved/not_published`. Snapshot counts must exactly match planner and work-admission accounting before the corpus may pass.  
**Limit:** this is the first current-view snapshot contract. History selection, invalid-transform rejection, monotonic cross-snapshot replacement, GPU atlas packing, shading, and compositing remain later presentation slices.

## D-028 — Current-view snapshot compositing is isolated and fail-closed
**Decision:** the first snapshot compositor is a separate transparent WebGPU canvas and package downstream of D-027. It converts exact current-view cell bounds to f32 clip rectangles only when the snapshot camera and integer backing dimensions exactly match the active view, every dyadic transform is finite and exact in binary64, each f32 clip edge stays within a 0.25-pixel encoding bound, and the 512-cell resource ceiling holds. Any failed condition clears the overlay and reports a typed rejection; it never stretches or guesses.  
**Presentation:** accepted cells receive a subtle escape-iteration tint and unresolved cells receive explicit magenta striped styling. This overlay is visually provisional: it does not replace or validate the existing shallow preview and its pixels are not numerical evidence. Exact-camera mutation or backing-size change clears the overlay synchronously.  
**Authority boundary:** camera, planner, numerical contract/work, GPU recurrence, and snapshot construction packages do not import the compositor. The compositor owns only an alpha canvas, a bounded storage buffer, and display shaders; no compositor resource is available to recurrence, oracle, comparison, publication, or accepted storage.  
**Limit:** this proves current-view downstream composition and invalidation, not geometrically valid history reprojection, monotonic replacement across snapshots, multiscale atlases, production shading, or long-duration resource settling.

## D-029 — Presentation history is bounded and quality-monotonic
**Decision:** presentation history uses a spatial view identity containing exact camera center/scale but excluding camera epoch, plus formula version, level, versioned integer viewport domain, exact bounds, and ordered cell layout. The initial store retains at most four views. Publishing a newer epoch for the same view merges cell-by-cell: accepted display coverage replaces accepted or unresolved coverage, while unresolved coverage can never replace an accepted contribution. Older epochs are rejected stale; different same-epoch snapshots are rejected as conflicts; capacity evicts the least-recently-published view deterministically.  
**Selection:** the initial validity domain is deliberately exact. A history frame may be selected only when exact spatial camera and integer backing dimensions match; other camera transforms and viewport dimensions are rejected as `invalid_transform` or `viewport_mismatch`. This establishes `AT-PRES-002` fail-closed behaviour before any pan/zoom reprojection is promoted.  
**Authority boundary:** history frames retain presentation cells, their source snapshot/epoch, and deterministic checksums only. Camera, planning, numerical, GPU recurrence, and snapshot-construction packages do not import the history store. Storing, merging, selecting, or evicting history cannot construct an accepted sample or change the accepted store.  
**Limit:** exact-match reuse is not geometric reprojection. A future slice must define and execute bounded pan/zoom transform validity before motion history may be rendered.

## RD-001 — Provisional Phase-0 oracle foundation
**Status:** assumed; Windows Rust/WASM and one physical AMD stable-Chromium run pass, while clean-commit evidence preservation and NVIDIA comparison remain pending.  
**Decision:** use a pure-Rust exact-dyadic recurrence backed by `num-bigint` for the independent deterministic oracle. Treat the direct WebGPU kernel as a candidate generator that cannot publish authority without oracle agreement.  
**Alternative not admitted in Phase 0:** Rug/GMP/MPFR, because its C-backed build does not directly satisfy the required stable `wasm32-unknown-unknown` browser path.  
**Rationale:** exact dyadic recurrence makes escape and analytic-interior decisions independently checkable, preserves cap-as-unresolved semantics, and fails insufficient precision before iteration.  
**Limit:** exact numerator growth may make this unsuitable as the eventual high-throughput reference-orbit implementation; `O-001` therefore remains open.  
**Promotion gate:** pinned Rust/WASM build, oracle fixtures, browser worker execution, benchmark evidence, and review of resource behaviour.

**Evidence update (2026-08-08):** On the primary Windows machine, Rust 1.89.0 tests passed 4/4, wasm-bindgen crate/CLI 0.2.126 built successfully, and the pure-Rust exact-dyadic benchmark completed 10,000 samples at 1,701 ns/sample on clean commit `2e810f2`. Headed stable Edge 151 on a non-fallback AMD RDNA-4 adapter passed all 10 oracle fixtures and all 4 direct WebGPU comparisons with zero mismatches; the intentional insufficient-bound case remained `unresolved`. The validated bundle is preserved at `evidence/phase-0-amd-rdna4-edge151-2026-08-08/`. This is not branded-Chrome evidence and does not establish NVIDIA/AMD cross-hardware agreement or production resource behaviour.

## D-030 — User-selected unbounded approximate direct preview
**Decision:** Beginning 2026-08-16, the shallow f32 direct preview may continue past its former half-pixel camera-encoding guard when the user explicitly prefers uninterrupted navigation over display fidelity. It must be labelled `approximate preview` and remains presentation-only; it cannot produce reference data, recurrence inputs, classifications, accepted samples, or camera state.
**Safety boundary:** Exact camera updates, bounded reference/oracle work, direct GPU publication, presentation-history provenance, and all numerical acceptance conditions retain their existing guards. This decision removes a display stop, not an authority limit.
**Consequence:** Task 004 adds a bounded perturbation/reference-orbit preview to improve deep visual fidelity. The direct f32 path remains the fallback when that path is unavailable or invalid; visible approximation is not evidence.
