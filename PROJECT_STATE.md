# Project State

**State date:** 2026-08-08  
**Project phase:** `FIRST_TASK.md` is reviewed complete on the primary AMD validation machine. The completion review is preserved in `docs/FIRST_TASK_COMPLETION_REPORT.md`; clean-commit evidence is under `evidence/phase-0-amd-rdna4-edge151-2026-08-08/`. The live shallow explorer at `https://byronbuzz.github.io/webgpu-zoomer/` has exact pointer-focused interaction, display-rate presentation-only interpolation, and a separately exercised conservative shallow publication gate with a canonical accepted numerical store. The next bounded slice is canonical world/sample planning from the exact camera; deep perturbation and production scheduling remain later tasks. Branded Chrome and NVIDIA cross-hardware comparison remain open.

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
- S-021 — GitHub Pages Actions deployment is enabled at `https://byronbuzz.github.io/webgpu-zoomer/`. Workflow run `31238819356` built merge commit `e790835` only after `npm run verify` passed, then deployed successfully. The live-origin PowerShell command `$env:WEBGPU_ZOOMER_BASE_URL='https://byronbuzz.github.io/webgpu-zoomer/'; $env:WEBGPU_ZOOMER_BROWSER_CHANNEL='msedge'; npm run test:browser` passed 2/2: `crossOriginIsolated`, shared memory, and non-fallback AMD RDNA-4 WebGPU were true; all 10 oracle fixtures and 4 GPU differentials matched; cap exhaustion and intentional insufficient precision remained `unresolved`.
- S-022 — `FIRST_TASK.md` completion criteria and required evidence were reviewed against the clean repository, physical bundle, deployed-origin result, and remaining limitations. Phase 0 is complete on the primary AMD machine; this does not promote branded-Chrome or NVIDIA cross-hardware claims. The next task is the bounded shallow visual slice defined in `docs/FIRST_TASK_COMPLETION_REPORT.md`.
- S-023 — The bounded shallow visual slice is deployed from commit `3f6860c`. GitHub Pages workflow `31239691982` passed the complete deterministic build gate. Live visual inspection shows the Mandelbrot canvas on the AMD RDNA-4 adapter with no browser warnings/errors, and the live-origin headed Edge suite passes 2/2, including the unchanged ten-fixture oracle and four-case GPU differential corpus. The canvas is presentation-only and does not write accepted numerical state.
- S-024 — Exact-camera interaction is deployed from commit `6a759d0` by workflow `31242417036`. Pointer input is quantized once to an observable 20-fractional-bit dyadic focus; hold, steering, wheel, inverse zoom, and reset mutate only `ExactCamera`. The live-origin headed Edge suite passes 3/3: exact focus is invariant, inverse wheel steps round-trip center/scale, held zoom advances continuously, and f32 half-pixel bound exhaustion reports `precision-limit` while exact camera epochs continue. Manual live inspection confirmed pointer-directed 1× to 2× zoom with no browser warnings/errors.
- S-025 — Display-rate presentation interpolation is deployed from commit `99044fc` by workflow `31242880102`. The live-origin headed Edge suite passes 3/3. A manual live wheel step produced 11 animation frames with 16.785 ms P95 spacing and maximum displayed pointer-focus error `0.000009869363165103379` px; the runtime declared `presentation-only` authority and settled cleanly with no browser diagnostics. Interpolated transforms are derived from exact camera endpoints, are independently f32-gated, and never feed camera or numerical authority.
- S-026 — The bounded shallow direct publication contract is deployed from commit `56f1bfd` by Pages workflow `31243419790`. Only matching f32 WebGPU/exact-oracle escapes can construct branded accepted samples; canonical dyadic identities normalize equivalent coordinates, and the store rejects stale epochs, conflicts, unresolved work, and cap exhaustion. `npm run verify` passed 12 Vitest tests, 4 evidence tests, 4 Rust tests, the pinned Wasm build, and the production build. Both local and live-origin headed Edge suites passed 3/3 on the non-fallback AMD RDNA-4 adapter. The live store contains three oracle-agreed escapes with checksum `fnv1a64:8b572dbed2b4b438`; the cap-exhausted direct sample remains `unresolved` outside the store. This offline differential readback contract is not permission for interaction-path readback or a substitute for the future production error ledger.

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

## Open

- O-001 — The high-throughput Rust reference implementation remains open. Exact dyadic `num-bigint` is the provisional oracle foundation; Rug/MPFR is not Phase-0 browser-build-admitted and may be reconsidered only through a separate WASM feasibility task.
- O-002 — Best GPU deep-zoom algorithm stack and crossover policy after measured prototypes: full perturbation, scaled perturbation, rebasing, series approximation/BLA, or a subset.
- O-003 — Final packed numerical state layout and whether active-pixel work uses compaction, indirect dispatch, persistent queues, or a capability-dependent combination.
- O-004 — Concrete hardware qualification thresholds defining “midrange class”.
- O-005 — Maximum resident GPU memory budget as a fraction/absolute cap on reference systems.
- O-006 — Exact conservative error model for GPU recurrence and reference transport.
- O-007 — Whether certified interior beyond analytic cardioid/bulb tests will include additional proof methods in v1.
- O-009 — The default branded-Chrome run remains unexecuted because Chrome is absent and its system installer could not elevate from the agent session. Stable Edge 151 passed the same Chromium/WebGPU gate without experimental flags; preserve this distinction in evidence.

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

- N-001 — Run the default branded-Chrome channel when Chrome can be installed. Do not relabel the passing Edge 151 result as Chrome evidence.
- N-002 — Run the same frozen browser corpus on a qualifying NVIDIA system and compare semantic results before any `AT-NUM-009` cross-hardware correctness claim.
- N-004 — Define and test canonical `WorldKey`/sample-grid planning from `ExactCamera`, including negative coordinates, exact epoch identity, deterministic replay, and bounded request size. Planning must emit numerical demand only; it cannot consume presentation transforms or introduce a fixed depth ceiling.
- N-005 — After the canonical planner exists, connect one bounded asynchronous shallow-direct work path to the publication gate without per-batch awaited readback on the interaction clock. Perturbation, rebasing, series/BLA, and production scheduling remain separate later promotion tasks.
- N-006 — Calibrate production interaction and convergence thresholds with longer representative trajectories after the authoritative publication path exists; the current interpolation ceilings are smoke-test limits, not release performance claims.
