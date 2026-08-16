# Task 006 — Bounded Local-Reference Atlas Preview

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Predecessor:** `TASK_005_COMPENSATED_PERTURBATION_PREVIEW.md` — accepted and deployed
- **Source state:** the user-reported block artifacts beyond roughly `2^21`, `PROJECT_STATE.md` N-006/O-006, and `INVARIANTS.md` I-06 through I-08

## Goal

Replace the single local perturbation reference with a small fixed atlas of nearby references, selecting the nearest reference per pixel. This is a bounded spatial rebase-like preview improvement intended to reduce perturbation deltas and visible block artifacts at the persistent target. It remains presentation-only.

## Constraints

- Preserve exact camera, user-selected no-display-stop policy, and all numerical authority boundaries.
- The atlas must have a fixed, versioned maximum reference count, orbit length, GPU-buffer size, and CPU setup work. No unbounded reference scheduling.
- Every reference derives afresh from exact-camera-derived coordinates; history/compositor data cannot be a reference input.
- Per-pixel selection is presentation-only. It cannot publish classifications or accepted samples.
- A missing, invalid, oversized, or glitching atlas must fall back to the existing labelled approximate path; no numerical authority may be written.
- Preserve the persistent test aim: real `-0.777120613150274923773`, imaginary `+0.126857238786361887169`.
- Do not add arbitrary-precision reference generation, dynamic recurrence rebasing, series/BLA, accepted perturbation publication, host readback gating, commit, push, deploy, or successor activation in this task.

## Work

1. Define a versioned 3×3 bounded local-reference atlas transport and fixed GPU storage layout.
2. Generate each local orbit independently from the current exact-camera-derived viewport coordinates.
3. Select the nearest atlas reference per fragment and apply the existing compensated perturbation recurrence to its local delta.
4. Add deterministic atlas layout/resource/failure tests and a deep-target browser check that selects the atlas mode without changing exact focus or authority.
5. Run focused, complete local, and headed-browser verification; record actual evidence only.

## Done when

- The deep target selects the bounded local-reference-atlas preview mode.
- Reference selection, transport, orbit size, storage, and failure modes are explicit and bounded.
- Existing exact camera, shallow authority, and history invariants remain unchanged.
- No high-precision-orbit, dynamic-rebase, series/BLA, or perturbation authority claim is introduced.

## Deferred interaction note

The user-reported cursor/trajectory lag is recorded in `PROJECT_STATE.md` N-008. It is a separate active-animation retargeting task and is not changed here.

## Acceptance evidence

- 2026-08-16: `npm run verify` passed fixture validation, TypeScript, 46 Vitest tests, 5 script tests, 7 Rust tests, the pinned Wasm build, and the production build.
- 2026-08-16: headed stable Edge with `WEBGPU_ZOOMER_BROWSER_CHANNEL=msedge` passed 8/8. The persistent deep-target trajectory selected `bounded-f64-reference-atlas-3x3-compensated-ds-v1` while preserving exact pointer focus and presentation-only authority.
- The atlas has exactly 3×3 independently derived high/low f32 reference orbits, each at most 513 entries and in one fixed GPU buffer. Per-pixel selection is bounded by the fixed map. Escaped references stop their own host orbit and lead to a presentation-only escape return; invalid coordinates, transport, or sizing reject the atlas.
- `git diff --check` passed. This is local acceptance only: it does not quantify visual improvement, make a numerical-accuracy claim, commit, push, or deploy the change.

## Blocker protocol

If the atlas cannot materially reduce the observed artifact, record the result and activate the smaller next reference-precision or dynamic-rebase task. Do not relabel the image as accurate.