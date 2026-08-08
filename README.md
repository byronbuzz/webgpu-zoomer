# WebGPU Zoomer

Clean successor repository for a browser-native Mandelbrot explorer with exact navigation, conservative numerical authority, and a stable WebGPU production path.

Public early preview and validation harness: https://byronbuzz.github.io/webgpu-zoomer/

This repository begins with the numerical and experimental spine defined by `FIRST_TASK.md`. It is not a port or reorganisation of the v1.4/V4/V5/V6 code.

## Setup

Requirements are pinned in `.nvmrc` and `rust-toolchain.toml`.

```sh
npm ci
npm run doctor
npm run build:wasm
npm run verify
```

Run the isolated development server with `npm run dev`. The Vite server supplies COOP/COEP headers. The browser harness reports cross-origin isolation, shared-memory availability, and WebGPU capability before enabling tests.

On a physical AMD or NVIDIA validation machine with current stable Google Chrome and the pinned Rust/WASM tooling installed, run `npm run gate:physical`. This uses headed stable Chrome without experimental WebGPU flags, rejects fallback adapters, executes the complete Phase-0 WASM-oracle/WebGPU differential corpus, and writes evidence under `test-results/`.

## Authority

Read `00_START_HERE.md`, `PROJECT_STATE.md`, and `FIRST_TASK.md` first. `AUTHORITY_REGISTER.md` and `MIGRATION.md` govern all use of legacy evidence.
