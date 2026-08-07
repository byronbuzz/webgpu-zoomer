# Fractal Zoomer — Start Here

## Purpose

This package defines a new browser-native realtime fractal zoomer whose first complete product is a Mandelbrot explorer with XaoS-style continuous direct manipulation, conservative numerical authority, display-rate-adaptive presentation, and no fixed mathematical zoom ceiling.

This is **not** a specification for revising WebGPU Fractal Zoomer v1.4 or merging the V4/V5/V6 lineage. Those repositories are evidence and salvage sources. The new implementation starts from a clean repository and imports legacy mechanisms only when they pass the acceptance and authority rules in this package.

## Current state

**Specification state:** frozen enough to begin implementation.

**Settled product choices**

- Fully client-side and statically deployable; no required backend.
- Desktop-first; current stable Chromium/WebGPU-class environment is the initial production target.
- Mandelbrot-first, with explicit boundaries for later formulas.
- No fixed depth ceiling; precision and cost scale with magnification and scene difficulty.
- Display-rate-adaptive interaction.
- XaoS-style press/hold direct zoom toward or away from the pointer focus is core.
- Presentation may reuse valid history, but history is never numerical truth.
- Midrange discrete desktop GPU class is the minimum performance tier; validation is vendor-neutral and includes NVIDIA and AMD.
- Conservative numerical correctness.
- `escaped`, `certified interior`, and `unresolved` are distinct authoritative states; unresolved may receive provisional interior-like presentation only.
- Semantic, not bitwise, determinism across supported hardware.
- Thin product shell: navigation, essential coordinates/depth/status, palette selection, bookmarks/shareable state, diagnostics.
- Cross-origin isolation is required so browser-side shared-memory WASM and workers are available.
- Rust + WebAssembly owns arbitrary-precision/reference arithmetic; TypeScript owns browser orchestration and WebGPU integration.
- User navigation remains sovereign under numerical backlog; quality may degrade before interaction is throttled.
- Stable production API path plus capability-gated experimental acceleration paths.

## Package map

1. `PROJECT_INSTRUCTIONS.md` — routing and execution policy.
2. `PROJECT_STATE.md` — Settled · Assumed · Open · Superseded · Next.
3. `AUTHORITY_REGISTER.md` — source precedence and legacy evidence status.
4. `REQUIREMENTS.md` — observable product and engineering requirements.
5. `INVARIANTS.md` — properties no optimization may violate.
6. `ARCHITECTURE.md` — target system design.
7. `INTERFACES.md` — material boundaries and contracts.
8. `UI_UX.md` — thin product and XaoS-like interaction contract.
9. `SECURITY_AND_PRIVACY.md` — static deployment and browser capability controls.
10. `DEVELOPMENT_HARNESS.md` — repository, tools, runtime, verification, CI, evidence.
11. `VALIDATION.md` — verification strategy and release gates.
12. `ACCEPTANCE_TESTS.md` — falsifiable acceptance catalogue.
13. `MIGRATION.md` — clean-room successor and legacy salvage policy.
14. `DECISIONS.md` — accepted architectural/product decisions.
15. `RESEARCH_NOTES.md` — evidence-derived findings and current platform facts.
16. `RISKS_AND_OPEN_QUESTIONS.md` — unresolved matters and ranked risks.
17. `FIRST_TASK.md` — first executable engineering task.
18. `ASSET_MANIFEST.md` — supplied asset inventory.
19. `AGENTS.md` — concise agent routing.
20. `SKILLS_PLAN.md` — repository-native procedures to create only when useful.

## Immediate next action

Execute `FIRST_TASK.md`. Do **not** begin by porting the v1.4 renderer.

The first implementation milestone is a trustworthy numerical-and-benchmark spine: exact camera/world coordinates, a Rust/WASM arbitrary-precision oracle/reference path, a deterministic fixture corpus, and a WebGPU kernel harness capable of proving or rejecting candidate perturbation/compaction strategies against that oracle.

## Critical warnings

- A large camera bit width is not proof of end-to-end deep precision.
- Reaching an iteration cap is never authoritative evidence of interior membership.
- Reprojected pixels are presentation estimates, not numerical samples.
- A source-text validator is not runtime proof.
- A GPU optimization is unacceptable if its validity conditions cannot be tested.
- No performance claim is authoritative without scene, browser, adapter, settings, duration, counters, command evidence, and comparison methodology.
- Legacy code is not authoritative merely because it already works in some scenes.
