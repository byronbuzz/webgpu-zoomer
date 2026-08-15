# Task 002 — Bounded Geometric History Reprojection

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Predecessor:** `FIRST_TASK.md` — accepted
- **Source state:** `PROJECT_STATE.md` N-004

## Goal

Establish and execute a conservative geometric validity contract for limited dyadic pan/zoom presentation-history reprojection. Render history only when the contract proves the transform valid; preserve exact-match fallback and immediately reject history outside the bound.

## Authority

- `PROJECT_STATE.md` — current workflow position.
- `REQUIREMENTS.md` — `FR-PRES-001`, `FR-PRES-002`, `FR-PRES-003`.
- `INVARIANTS.md` — `I-04`, `I-05`, `I-06`.
- `ACCEPTANCE_TESTS.md` — `AT-PRES-001`, `AT-PRES-002`, `AT-PRES-003`.
- `DECISIONS.md` — especially `D-029` and its explicit limit.
- Code/config govern mechanics; tests govern encoded contracts; runtime evidence governs what actually ran.

## Relevant files

Inspect before changing; likely scope includes:
- `packages/presentation-history/src/index.ts`
- `packages/presentation-history/src/index.test.ts`
- `packages/presentation-compositor/`
- `apps/web/src/main.ts`
- relevant browser tests under `tests/browser/`
- affected validation/evidence records

Do not assume this list is exhaustive if the live dependency graph proves otherwise.

## Constraints and invariants

- Presentation history remains presentation-only and can never become numerical recurrence/reference/classification evidence.
- Exact camera authority remains exact; approximate transforms are derived one-way.
- The allowed reprojection domain must be explicit, finite, executable, and conservative.
- Any transform outside or indeterminate under the validity contract is rejected immediately.
- Existing exact-match history reuse remains a valid fallback.
- Fresher accepted presentation data monotonically supersedes older estimates.
- Do not use visual plausibility as correctness evidence.

## Work

1. Inspect the current exact-match history selector/compositor and existing tests/evidence.
2. Define the smallest limited dyadic pan/zoom transform domain that can be proven geometrically valid.
3. Encode the validity predicate and bounded transform representation.
4. Reproject/render only selected valid history downstream.
5. Preserve exact-match behavior and fail-closed rejection outside the validity domain.
6. Add adversarial tests at, within, and just beyond transform bounds, including non-finite/invalid inputs where representable.
7. Verify one-way provenance and monotonic replacement remain intact.
8. Run focused deterministic tests plus the relevant browser/verification checks already required by the repository.
9. Record exact evidence and update `PROJECT_STATE.md` only for claims actually established.

## Done when

- A versioned executable geometric validity predicate exists for the supported limited dyadic pan/zoom domain.
- `AT-PRES-002` is exercised with transforms beyond the configured domain and invalid history is discarded rather than stretched.
- Valid in-bound transforms can select/render history without altering numerical authority.
- Exact-match history reuse still works.
- Presentation/history resources cannot feed numerical recurrence/reference inputs (`AT-PRES-001` remains satisfied).
- Fresher accepted presentation supersedes older history and older history cannot reappear for the same visible region (`AT-PRES-003` remains satisfied).
- Focused unit/browser checks for the affected path pass.
- No acceptance criterion is weakened and no unrelated numerical/presenter architecture is introduced.
- Completion evidence is recorded and `PROJECT_STATE.md` is reconciled before any successor task is activated.

## Completion evidence

- Commit `4f3ea8c08ba00ac3a9a972f6fbf417ba8de2ca4e`; GitHub Pages workflow `31884724659` deployed successfully on 2026-08-15.
- Local `npm run verify` passed 43 Vitest tests, 5 script tests, 4 Rust tests, the Wasm build, and the production build.
- Local headed Edge `npm run test:browser` passed 6/6 with `WEBGPU_ZOOMER_BROWSER_CHANNEL=msedge`.
- Live-origin headed Edge `npm run test:browser` passed 6/6 with `WEBGPU_ZOOMER_BASE_URL=https://byronbuzz.github.io/webgpu-zoomer/` and `WEBGPU_ZOOMER_BROWSER_CHANNEL=msedge`, including the one-step history reprojection assertion with unchanged numerical checksums.
- `git diff --check` passed before the implementation commit. The acceptance scope is presentation-only; branded Chrome and NVIDIA evidence remain open.

## Do not do

- Do not begin perturbation, reference transport, rebasing, series/BLA, compaction, or broader production scheduling.
- Do not broaden the task into multiscale atlas redesign or general renderer optimization unless required to satisfy the stated contract.
- Do not weaken the validity bound to make tests pass.
- Do not commit, push, deploy, or open a PR without separate human instruction.

## Blocker protocol

If safe completion is impossible, return:
- exact blocked goal;
- evidence gathered;
- failing check/error or missing authority;
- smallest decision/capability needed;
- preserved repository state;
- safe resumption point.
