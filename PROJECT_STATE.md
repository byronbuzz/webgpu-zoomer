# Project State

**State date:** 2026-08-08  
**Project phase:** `FIRST_TASK.md` implementation is executing on physical Windows hardware. Deterministic Node/TypeScript and Rust gates, the pinned WASM build, the exact-dyadic benchmark, and the headed stable-Chromium WebGPU corpus pass on the primary AMD RDNA-4 machine using Edge 151. Clean-commit evidence is preserved under `evidence/phase-0-amd-rdna4-edge151-2026-08-08/`; branded Chrome and NVIDIA cross-hardware comparison remain open.

## Settled

- S-001 — Product is a fully client-side static web application; no backend is required for correctness or basic operation.
- S-002 — Initial production target is desktop current-stable Chromium with WebGPU on contemporary discrete GPUs.
- S-003 — Mandelbrot is the first complete formula; architecture exposes explicit formula boundaries for later extension.
- S-004 — No fixed mathematical zoom-depth ceiling is permitted in the architecture.
- S-005 — Interaction targets the active display cadence and degrades detail before responsiveness.
- S-006 — XaoS-style continuous pointer-focused direct zoom is the primary interaction.
- S-007 — History/reprojection may fill presentation gaps but remains non-authoritative.
- S-008 — Minimum performance tier is a vendor-neutral contemporary midrange discrete desktop GPU class; validation includes NVIDIA and AMD.
- S-009 — Numerical publication is conservative and error-bound driven.
- S-010 — Authoritative sample states distinguish `escaped`, `certified_interior`, and `unresolved`.
- S-011 — Unresolved samples may be rendered provisionally but cannot be promoted by appearance.
- S-012 — Cross-device requirement is semantic determinism within declared bounds, not bitwise identity.
- S-013 — First product shell is intentionally thin.
- S-014 — Cross-origin isolation is required.
- S-015 — Rust/WASM owns arbitrary-precision/reference arithmetic; TypeScript owns browser/WebGPU orchestration.
- S-016 — Numerical backlog does not itself throttle navigation.
- S-017 — Stable production API path plus capability-gated experimental acceleration.
- S-018 — Legacy repositories are evidence/salvage sources, not the successor repository architecture.
- S-019 — The clean successor repository is the public GitHub repository `byronbuzz/webgpu-zoomer`; the legacy `byronbuzz/mandelbrot-zoomer` repository remains separate.
- S-020 — The primary physical-validation machine is an Intel Core Ultra 9 285K system with 64 GB RAM and an AMD Radeon RX 9070 XT. Windows reports driver `32.0.31019.2002`; the headed browser gate independently confirms a non-fallback AMD `rdna-4` WebGPU adapter.

## Assumed

- A-001 — The first implementation will use a Rust arbitrary-precision library or binding whose WASM behaviour can be independently validated; exact library choice remains benchmark-driven.
- A-002 — A dyadic coordinate system remains the canonical camera/world representation because it naturally supports exact scale powers and persistent tile identity.
- A-003 — Initial colour output uses smooth escape-time colouring plus one alternate palette/shading mode.
- A-004 — Production UI targets mouse/trackpad and keyboard; pen/touch are deferred with mobile.
- A-005 — Static hosting will permit the required COOP/COEP headers.
- A-006 — A clean TypeScript + Rust workspace with Vite-class development tooling is adequate; tool choice is reversible and not product authority.
- A-007 — Performance thresholds will be expressed in frame budgets and normalized workload metrics, then calibrated on two physical reference systems before release.
- A-008 — Phase-0 numerical authority uses a pure-Rust exact-dyadic recurrence built on `num-bigint`; this is provisionally chosen as the deterministic oracle, not yet as the production high-throughput reference generator.
- A-009 — The direct WebGPU Phase-0 kernel produces non-authoritative candidates. Only exact oracle agreement can accept an escaped result in this experimental harness.
- A-011 — Active dependency installation and development should use a non-synchronised local SSD checkout. On this machine, `npm ci` in the Google Drive-backed checkout entered an unkillable CPU-bound state, while the same lockfile installed 55 packages in 3 seconds in `C:\Users\Admin\Documents\GitHub\webgpu-zoomer`.

- A-012 — GitHub Pages is suitable as the current public test host if its same-origin service-worker bootstrap produces a genuinely cross-origin-isolated runtime. Live runtime verification is required before this assumption can be promoted.

## Open

- O-001 — The high-throughput Rust reference implementation remains open. Exact dyadic `num-bigint` is the provisional oracle foundation; Rug/MPFR is not Phase-0 browser-build-admitted and may be reconsidered only through a separate WASM feasibility task.
- O-002 — Best GPU deep-zoom algorithm stack and crossover policy after measured prototypes: full perturbation, scaled perturbation, rebasing, series approximation/BLA, or a subset.
- O-003 — Final packed numerical state layout and whether active-pixel work uses compaction, indirect dispatch, persistent queues, or a capability-dependent combination.
- O-004 — Concrete hardware qualification thresholds defining “midrange class”.
- O-005 — Maximum resident GPU memory budget as a fraction/absolute cap on reference systems.
- O-006 — Exact conservative error model for GPU recurrence and reference transport.
- O-007 — Whether certified interior beyond analytic cardioid/bulb tests will include additional proof methods in v1.
- O-009 — The default branded-Chrome run remains unexecuted because Chrome is absent and its system installer could not elevate from the agent session. Stable Edge 151 passed the same Chromium/WebGPU gate without experimental flags; preserve this distinction in evidence.

- O-010 — The GitHub Pages service-worker isolation path remains unaccepted until the deployed site reports `crossOriginIsolated`, shared memory, non-fallback WebGPU, and a passing deterministic corpus on the live origin.

These are research/implementation questions, not reasons to change the product contract.

## Superseded

- SP-001 — Viewport-relative full-frame rendering as the authoritative world model.
- SP-002 — Fixed direct/perturbation zoom thresholds as correctness policy.
- SP-003 — Iteration-cap exhaustion interpreted as “inside”.
- SP-004 — Deep precision claims based on camera bit width or nominal reference transport width alone.
- SP-005 — v1.4 and V4/V5/V6 renderer generations as cumulative product architecture.
- SP-006 — Per-tile resource-heavy topology as the presumed target.
- SP-007 — Host readback-driven scheduling as a required convergence mechanism.

## Next

- N-000 — Deploy the validated `main` build to GitHub Pages and run the live-origin capability and deterministic-corpus check. Preserve failure as unsupported rather than weakening the gates.
- N-001 — Run the default branded-Chrome channel when Chrome can be installed. Do not relabel the passing Edge 151 result as Chrome evidence.
- N-002 — Run the same frozen browser corpus on a qualifying NVIDIA system and compare semantic results before any `AT-NUM-009` cross-hardware correctness claim.
- N-003 — Review the preserved AMD bundle and remaining `FIRST_TASK.md` completion criteria, then select the next executable numerical-spine task.
- N-004 — Do not begin the explorer presenter, perturbation, rebasing, series/BLA, or production scheduling until the remaining `FIRST_TASK.md` completion evidence is preserved and reviewed.
