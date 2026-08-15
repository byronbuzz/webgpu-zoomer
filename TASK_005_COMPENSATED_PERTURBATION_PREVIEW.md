# Task 005 — Compensated Perturbation Preview

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Predecessor:** `TASK_004_PERTURBATION_PREVIEW.md` — accepted and deployed
- **Source state:** the user-reported block artifacts near `2^22`, `PROJECT_STATE.md` N-006/O-006, and `INVARIANTS.md` I-06 through I-08

## Goal

Improve the visible fidelity of the bounded deep preview at the persistent target without promoting it to numerical authority. Replace the lossy high/low reference reconstruction used by Task 004 with compensated f32 arithmetic for the perturbation recurrence and display escape test, and use a bounded adaptive preview iteration tier.

## Authority

- `PROJECT_STATE.md` — workflow position.
- `REQUIREMENTS.md` — `FR-CAM-001`, `FR-NUM-001`, `FR-NUM-004`, `FR-GPU-005`, `FR-PRES-001`, `FR-PERF-003`.
- `INVARIANTS.md` — `I-01` through `I-10`, especially I-06 through I-08.
- `ACCEPTANCE_TESTS.md` — `AT-NUM-005` through `AT-NUM-008` as future authority requirements, not current promotion authority.
- `DECISIONS.md` — `D-021` through `D-023` and `D-030`.

## Constraints

- Preserve exact-camera interaction and the user-selected no-display-stop policy.
- Retain presentation-only status: no accepted perturbation samples, classifications, host readback gating, or history-as-reference input.
- Bound GPU shader iterations, reference orbit transport, temporary storage, and CPU setup work explicitly. No unbounded per-pixel loops.
- Failure of compensated transport, recurrence validity, or resource limits must remain visibly provisional and must not write authority.
- Preserve the persistent zoom-test aim: real `-0.777120613150274923773`, imaginary `+0.126857238786361887169`.
- Do not add rebasing, series/BLA, multi-reference scheduling, broad asynchronous convergence, commit, push, deploy, or successor activation in this task.

## Work

1. Specify and test compensated high/low f32 primitives for reference reconstruction, addition, multiplication, and squared magnitude used only by the preview shader.
2. Replace the Task 004 single-f32 display reconstruction and recurrence terms with those primitives.
3. Introduce one bounded adaptive preview iteration tier appropriate to the existing storage and shader limits; expose its active mode distinctly.
4. Add deterministic transport/recurrence tests and a deep-target browser trajectory check that detects the compensated mode while preserving exact focus and authority separation.
5. Run focused, complete local, and headed-browser verification. Record actual evidence only.

## Done when

- The deep target trajectory selects a compensated perturbation preview rather than the Task 004 lossy reconstruction.
- Every preview loop, reference orbit, and allocation has an explicit bound.
- The preview remains visibly and structurally non-authoritative, including every failure path.
- Existing exact-camera, shallow numerical publication, and presentation-history evidence remain stable.
- No rebasing, series/BLA, multi-reference scheduling, or accepted perturbation publication is introduced.

## Acceptance evidence

- 2026-08-16: `npm run verify` passed fixture validation, TypeScript, 46 Vitest tests, 5 script tests, 7 Rust tests, the pinned Wasm build, and the production build.
- 2026-08-16: headed stable Edge suite with `WEBGPU_ZOOMER_BROWSER_CHANNEL=msedge` passed 8/8. The persistent deep-target trajectory selected `bounded-f64-reference-compensated-ds-v1` at the bounded 512-iteration tier and preserved exact pointer focus.
- `git diff --check` and the local dev-server HTTP readback passed. This establishes typed mode selection, shader compilation, bounded resource use, and authority separation; it does not establish a numerical-accuracy claim or quantify subjective visual improvement.
- Local acceptance preceded the user-authorized release: commit `444431aaed32bd4227559931bde6c0e1e2869e8c` was pushed to `main`, GitHub Pages workflow `31910009994` passed, and live-origin HTTP readback confirmed the compensated mode and label. No successor activation occurred.
## Blocker protocol

If compensated local perturbation does not materially improve the observed artifact, record the visual/test evidence, keep it non-authoritative, and activate the smallest separate reference-orbit or rebasing task required. Do not relabel the current image as accurate.
