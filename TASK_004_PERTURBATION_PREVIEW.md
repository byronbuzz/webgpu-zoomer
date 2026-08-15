# Task 004 — Bounded Perturbation Preview

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Predecessor:** `TASK_003_BOUNDED_REFERENCE_CONTROLS.md` — accepted
- **Source state:** `PROJECT_STATE.md` N-006 and the explicit user direction of 2026-08-16

## Goal

Remove the f32 display stop as a user-directed, presentation-only policy change, then introduce a bounded local-reference perturbation preview that improves visual fidelity beyond the shallow direct path. Exact camera and all numerical authority remain unchanged and independent.

## Authority

- `PROJECT_STATE.md` — current workflow position.
- `REQUIREMENTS.md` — `FR-CAM-001`, `FR-NUM-001`, `FR-NUM-004`, `FR-GPU-005`, `FR-PRES-001`, `FR-PERF-003`.
- `INVARIANTS.md` — `I-01`, `I-02`, `I-03`, `I-04`, `I-06`, `I-07`, `I-08`, `I-09`, `I-10`.
- `ACCEPTANCE_TESTS.md` — `AT-CAM-001`, `AT-NUM-005`, `AT-NUM-006`, `AT-NUM-007`, `AT-PRES-001`, `AT-UX-001`.
- `DECISIONS.md` — `D-021`, `D-022`, `D-023`, and `D-030`.

## Constraints

- Do not restore a fixed mathematical zoom-depth ceiling. Exact camera interaction continues at every depth.
- The f32 direct path may now display beyond its former half-pixel guard only as visibly labelled, non-authoritative approximation under `D-030`.
- The perturbation path consumes only a newly generated reference orbit and exact-camera-derived coordinates; no presentation/history image or buffer can be a reference input.
- Reference transport, orbit size, iterations, GPU storage, worker time, and glitch escalation each require explicit bounds.
- A perturbation transport/glitch/resource failure cannot publish an authoritative result. It may fall back to the approximate direct preview, but must report its mode distinctly.
- Preserve the current user-supplied zoom-test aim: real `-0.777120613150274923773`, imaginary `+0.126857238786361887169`.
- Do not add rebasing, series/BLA, accepted perturbation publication, host-readback interaction gating, commit, push, deploy, or successor activation in this task.

## Work

1. Replace `precision-limit` presentation stop with the explicit approximate-direct preview state described by `D-030`.
2. Define a versioned bounded reference-orbit/transport type, generated independently of presentation history.
3. Implement local-reference GPU perturbation rendering with a conservative glitch/transport validity diagnostic and non-authoritative output.
4. Preserve the shallow direct renderer as a stable fallback and preserve exact interaction/interpolation semantics where representable.
5. Add deterministic transport/orbit tests, deep-target browser checks, explicit glitch/fallback checks, and one-way-provenance inspection.
6. Run focused, complete local, and headed-browser verification; record only actual evidence.

## Done when

- Zoom no longer stops rendering at the former f32 half-pixel threshold; the fallback is visibly labelled approximate and remains non-authoritative.
- A bounded perturbation preview path is selected beyond the shallow direct range for the recorded target trajectory.
- Reference-orbit transport and glitch/resource failures are explicit and cannot write numerical authority.
- Existing exact camera, numerical publication, history, and default corpus evidence remain stable.
- No fixed depth ceiling, rebasing, series/BLA, or accepted perturbation result is introduced.

## Acceptance evidence

- 2026-08-16: `npm run verify` passed fixture validation, TypeScript, 45 Vitest tests, 5 script tests, 7 Rust tests, the pinned Wasm build, and the production build.
- 2026-08-16: headed stable Edge suite with `WEBGPU_ZOOMER_BROWSER_CHANNEL=msedge` passed 8/8. The target trajectory repeatedly aimed at `-0.777120613150274923773 + 0.126857238786361887169i`, crossed the former direct-f32 guard, selected `bounded-f64-reference-perturbation-v1`, and preserved exact pointer focus.
- Bounded transport tests verify finite high/low orbit storage and reject invalid/oversized iterations, invalid reference offsets, and invalid transport limits before GPU submission. `git diff --check` passed.
- This acceptance is local only. No commit, push, deployment, or successor activation occurred.
## Blocker protocol

If a safe bounded perturbation implementation cannot be completed, record the failing contract, exact evidence, preserved state, and the smallest next bounded capability needed. Do not disguise the failure as a valid deep render.
