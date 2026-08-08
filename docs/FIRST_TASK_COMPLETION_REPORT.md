# First Task Completion Report

**Date:** 2026-08-08  
**Reviewed commit:** `6169dc9` (`main`)  
**Status:** complete on the primary AMD validation machine; broader Chrome-brand and NVIDIA qualification remain open project validation, not hidden Phase-0 passes.

## Scope review

`FIRST_TASK.md` required the numerical authority and experimental spine before explorer-renderer work. The delivered tree contains independent exact-camera, numerical-contract, GPU-harness, Rust precision, WASM worker, fixture, evidence, and browser-gate boundaries. No v1.4 renderer source or production resource topology was imported.

Top-level implementation locations:

- `packages/exact-camera/` — exact dyadic camera/world primitives and property tests;
- `packages/numerical-contract/` — conservative candidate/publication semantics;
- `packages/gpu-engine/` — minimal direct-sample WebGPU compute harness;
- `crates/precision/` — pure-Rust exact-dyadic oracle and benchmark;
- `crates/precision-wasm/` — browser/WASM JSON boundary;
- `apps/web/` — isolated worker/browser differential harness;
- `tests/fixtures/` — versioned ten-case corpus;
- `scripts/` — deterministic verification, physical gate, and evidence validation;
- `evidence/phase-0-amd-rdna4-edge151-2026-08-08/` — clean-commit physical evidence.

## Completion gates

| `FIRST_TASK.md` gate | Result | Executable evidence |
|---|---|---|
| clean-checkout setup | pass | GitHub Pages run `31238819356` checked out merge commit `e790835`, installed pinned dependencies, and passed `npm run verify` before deployment |
| exact camera properties at extreme exponents | pass | `npm run test`: 7/7 Vitest tests, including inverse power-of-two zoom at extreme exponents, exact serialization, and negative floor semantics |
| browser isolation and shared-memory capability | pass | live-origin headed Edge test reports `crossOriginIsolated: true` and `sharedArrayBuffer: true` |
| deterministic versioned oracle corpus | pass | 10/10 Rust/WASM fixtures match across all six required categories |
| direct WebGPU comparison | pass on primary AMD | 4/4 GPU differentials match the independent oracle with zero mismatches |
| cap exhaustion stays unresolved | pass | `cap-exhausted-minus-two` returns `unresolved / iteration_budget_exhausted` |
| intentional insufficient bound fails safely | pass | fixture returns `unresolved / insufficient_precision` before iteration |
| malformed evidence is rejected | pass | 4/4 Node evidence tests, including malformed JSON, checksum mismatch, safe archive contents, and ZIP integrity |
| commands, versions, repairs, and results captured | pass | physical evidence bundle, decision record, project state, Git history, and this report |
| no legacy renderer import | pass by tree/diff inspection | only named fixture inputs/provenance were retained; successor implementation uses the target package boundaries |

## Toolchain and physical environment

| Component | Version/evidence |
|---|---|
| Git | `2.55.0.windows.3` |
| Node.js | `24.19.0` |
| npm | `11.17.0` |
| Rust / Cargo | `1.89.0` |
| wasm-bindgen crate/CLI | `0.2.126` |
| Browser | stable Edge `151.0.4129.72`, headed, no experimental flags |
| Machine | Intel Core Ultra 9 285K, 64 GiB RAM |
| GPU | AMD Radeon RX 9070 XT, non-fallback `rdna-4`, driver `32.0.31019.2002` |

## Recorded commands and outcomes

| Command | Exit | Outcome |
|---|---:|---|
| `npm ci --no-audit --no-fund` | 0 | 55 packages installed in 3 seconds in the SSD checkout |
| `npm run verify` | 0 | fixture validation, TypeScript, 7 Vitest tests, 4 evidence tests, Rust formatting, 4 Rust tests, pinned WASM build, and production Vite build passed |
| `cargo run --release -p precision --example benchmark` | 0 | 10,000 exact-dyadic samples at 1,701 ns/sample |
| `$env:WEBGPU_ZOOMER_BROWSER_CHANNEL='msedge'; npm run gate:physical` | 0 | clean-commit headed AMD corpus passed |
| `$env:WEBGPU_ZOOMER_BASE_URL='https://byronbuzz.github.io/webgpu-zoomer/'; $env:WEBGPU_ZOOMER_BROWSER_CHANNEL='msedge'; npm run test:browser` | 0 | deployed-origin isolation and corpus passed 2/2 |

## Precision candidate decision

| Candidate | Phase-0 disposition | Evidence |
|---|---|---|
| pure-Rust exact dyadic using `num-bigint` | provisionally admitted as independent oracle | reproducible native/WASM build, 4/4 Rust tests, browser corpus, 10,000-sample benchmark |
| Rug / GMP / MPFR | not build-admitted for Phase 0 | the C-backed stack has no established direct `wasm32-unknown-unknown` path; a native-only speed result would not answer the browser deployment question |

The second candidate may be revisited only as a separate Emscripten/MPFR feasibility task covering binary size, LGPL relinking, threading, deterministic builds, and stable-Chromium operation.

## Known limitations

- Evidence is stable Edge/AMD, not branded-Chrome evidence.
- NVIDIA/AMD semantic comparison required by `AT-NUM-009` remains open.
- The exact-dyadic oracle is correctness-first and is not promoted as the eventual high-throughput reference-orbit engine.
- No perturbation, rebasing, series/BLA, production scheduling, accepted numerical atlas, exact interactive camera binding, or performance-qualified presenter exists yet.
- GitHub Pages cross-origin isolation uses a same-origin service-worker bootstrap; runtime isolation checks remain authoritative.

## Next recommended task

Implement one deliberately narrow visible slice: a shallow direct WebGPU Mandelbrot canvas with downstream colouring and explicit non-authoritative provenance. It must not write accepted numerical state, claim deep correctness, or introduce production scheduling. After that visual smoke slice, bind interaction to the existing exact camera with focus/round-trip tests before attempting perturbation or other deep methods.
