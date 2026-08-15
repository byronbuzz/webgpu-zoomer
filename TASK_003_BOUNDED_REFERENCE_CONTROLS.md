# Task 003 — Bounded Reference Batching and Exploration Controls

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Predecessor:** `TASK_002_HISTORY_REPROJECTION.md` — accepted
- **Source state:** `PROJECT_STATE.md` N-005

## Goal

Provide visible exact-zoom speed and reference-iteration controls while establishing a browser-side bounded exact-dyadic reference batch path. The selectable per-sample ceiling reaches 50,000 iterations, but every batch remains subject to explicit deterministic work, memory, and elapsed-time limits that resolve to `unresolved` rather than blocking interaction or inventing authority.

## Test trajectory target

Future zooming tests must aim from the current camera toward the user-supplied world coordinate, without changing the initial camera:

- real: `-0.777120613150274923773`
- imaginary: `+0.126857238786361887169`

Browser pointer input remains quantized by the existing exact focus grid; tests must derive the pointer from this target and verify the resulting exact focus invariant rather than claiming the decimal is itself an exact dyadic.

## Authority

- `PROJECT_STATE.md` — current workflow position.
- `REQUIREMENTS.md` — `FR-UX-001`, `FR-NUM-001`, `FR-NUM-002`, `FR-NUM-003`, `FR-NUM-007`, `FR-GPU-004`, `FR-PERF-003`.
- `INVARIANTS.md` — `I-01`, `I-02`, `I-03`, `I-04`, `I-05`, `I-06`.
- `ACCEPTANCE_TESTS.md` — `AT-NUM-001`, `AT-NUM-002`, `AT-NUM-003`, `AT-PERF-001`, `AT-PRES-001`.
- `DECISIONS.md` — existing exact camera, oracle, and asynchronous admission decisions.

## Constraints

- The initial camera remains unchanged.
- Zoom speed changes cadence only; every camera transition remains an exact dyadic one-step operation.
- The iteration control is logarithmic and has an exact maximum of 50,000.
- The frozen corpus retains its default eight-iteration path unless a user-selected run explicitly changes it.
- A high selected iteration ceiling must reduce planned density or reject work before it exceeds the declared batch budget.
- Exact reference results alone cannot become accepted numerical publication; existing GPU/oracle agreement rules remain unchanged.
- Batch item count, total requested iterations, numerator-bit growth, and worker elapsed time must each be bounded independently.
- A limit breach, malformed request, timeout, or unavailable GPU candidate produces explicit `unresolved`/diagnostic state, never an interior or escape claim.
- Presentation and history remain strictly downstream of numerical authority.

## Work

1. Activate this task in `PROJECT_STATE.md` before product edits.
2. Add accessible zoom-speed and logarithmic reference-iteration controls to the exploration UI.
3. Replace per-item scheduled worker messages with a versioned bounded reference-batch worker protocol.
4. Add deterministic batch item/iteration/numerator guards in Rust/WASM and a main-thread timeout that discards the batch safely.
5. Keep direct GPU comparison only within a conservative GPU iteration budget; otherwise preserve `unresolved` publication.
6. Derive planned sample density from the selected iteration ceiling and the fixed run-level work budget.
7. Add Rust, TypeScript, and headed-browser tests for limits, controls, and the specified target trajectory.
8. Run focused and complete local verification. Do not commit, push, deploy, or activate a successor without separate instruction.

## Done when

- Zoom speed visibly controls exact-step cadence.
- The logarithmic control exposes values through 50,000 and reports the selected ceiling accessibly.
- A selected high ceiling cannot expand a run beyond the declared work/memory/time limits.
- Resource/timeout limits return explicit unresolved results without stale publication or UI blockage.
- The default corpus and all existing authority/presentation assertions remain stable.
- Zoom tests aim toward the recorded coordinate while preserving exact focus invariance.
- No perturbation, rebasing, series/BLA, or general deep renderer is introduced.

## Completion evidence

- Local `npm run verify` passed 43 Vitest tests, 5 script tests, 7 Rust tests, the Wasm build, and the production build on 2026-08-15.
- Local headed Edge `npx playwright test tests/browser/capabilities.spec.ts --project=stable-msedge-headed` passed 8/8 with `WEBGPU_ZOOMER_BROWSER_CHANNEL=msedge`, including the controls, 50,000-iteration bounded run, default corpus, interaction, history, and target-trajectory assertions.
- The 50,000-iteration test retained the minimum eight-sample plan, completed with zero scheduled accepted samples and explicit unresolved presentation coverage; high-iteration GPU candidates are not run above the 512-iteration direct-comparison cap.
- `git diff --check` passed. No commit, push, deployment, PR, or successor activation occurred.

## Do not do

- Do not move the initial camera to the target coordinate.
- Do not equate an iteration ceiling with proof of interior membership.
- Do not use presentation pixels as reference or recurrence input.
- Do not permit a 50,000-iteration whole-frame GPU loop without a separate validated scheduling contract.
- Do not commit, push, deploy, or open a PR without separate instruction.
