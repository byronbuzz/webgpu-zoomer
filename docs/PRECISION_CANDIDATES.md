# Precision Foundation Candidates

## Decision scope

This Phase-0 decision serves `FR-NUM-001`, `FR-NUM-003`, and `FR-NUM-007`, under `I-03`, `I-07`, and `I-08`. It chooses an independently checkable oracle foundation, not the final high-throughput reference-orbit implementation.

## Candidate A — pure Rust exact dyadic arithmetic

Prototype: `crates/precision` using `num-bigint` with a normalized `numerator × 2^exponent` representation.

- Exact for admitted dyadic inputs and recurrence operations.
- Compiles without a C/C++ dependency and is designed for `wasm32-unknown-unknown`.
- Explicit precision admission makes an under-provisioned request `unresolved` before iteration.
- Cap exhaustion is always `unresolved`; only exact analytic tests certify interior.
- Expected weakness: exact numerator growth makes it an oracle, not necessarily the eventual production reference generator.

Benchmark command: `cargo run --release -p precision --example benchmark`. Results belong in the evidence bundle and are not claimed until executed.

## Candidate B — Rug / GMP / MPFR

Rug supplies correctly rounded MPFR-class arbitrary-precision floating point, but its stack is backed by GMP/MPFR/MPC C libraries. The Rust `wasm32-unknown-unknown` target deliberately has no equivalent C/C++ toolchain, and `gmp-mpfr-sys` cross-compilation to this browser target is not an established direct path. This conflicts with the stable, reproducible browser-WASM boundary required here.

Candidate B is therefore **not build-admitted for Phase 0**, so a misleading native-only throughput comparison was not substituted for the required browser deployment comparison. Revisit only as a separate Emscripten/MPFR feasibility task with binary-size, LGPL relinking, worker/threading, deterministic-build, and stable-Chromium evidence.

Primary references:

- https://docs.rs/rug
- https://docs.rs/gmp-mpfr-sys
- https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html

## Phase-0 choice

Adopt Candidate A as the deterministic oracle foundation. Keep `O-001` open for the eventual high-throughput arbitrary-precision reference implementation; do not promote exact dyadic recurrence to that role without measurement.
