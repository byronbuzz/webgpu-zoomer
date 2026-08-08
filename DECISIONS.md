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

## RD-001 — Provisional Phase-0 oracle foundation
**Status:** assumed; Windows Rust/WASM and one physical AMD stable-Chromium run pass, while clean-commit evidence preservation and NVIDIA comparison remain pending.  
**Decision:** use a pure-Rust exact-dyadic recurrence backed by `num-bigint` for the independent deterministic oracle. Treat the direct WebGPU kernel as a candidate generator that cannot publish authority without oracle agreement.  
**Alternative not admitted in Phase 0:** Rug/GMP/MPFR, because its C-backed build does not directly satisfy the required stable `wasm32-unknown-unknown` browser path.  
**Rationale:** exact dyadic recurrence makes escape and analytic-interior decisions independently checkable, preserves cap-as-unresolved semantics, and fails insufficient precision before iteration.  
**Limit:** exact numerator growth may make this unsuitable as the eventual high-throughput reference-orbit implementation; `O-001` therefore remains open.  
**Promotion gate:** pinned Rust/WASM build, oracle fixtures, browser worker execution, benchmark evidence, and review of resource behaviour.

**Evidence update (2026-08-08):** On the primary Windows machine, Rust 1.89.0 tests passed 4/4, wasm-bindgen crate/CLI 0.2.126 built successfully, and the pure-Rust exact-dyadic benchmark completed 10,000 samples at 1,701 ns/sample on clean commit `2e810f2`. Headed stable Edge 151 on a non-fallback AMD RDNA-4 adapter passed all 10 oracle fixtures and all 4 direct WebGPU comparisons with zero mismatches; the intentional insufficient-bound case remained `unresolved`. The validated bundle is preserved at `evidence/phase-0-amd-rdna4-edge151-2026-08-08/`. This is not branded-Chrome evidence and does not establish NVIDIA/AMD cross-hardware agreement or production resource behaviour.
