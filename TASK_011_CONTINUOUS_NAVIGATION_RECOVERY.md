# Task 011 — Continuous Navigation Recovery

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Predecessor:** `TASK_010_BOUNDED_LONG_LIVED_REFERENCE_SELECTION.md` — blocked before integration
- **Source state:** user-confirmed hundred-millisecond freezes, discontinuous zoom, apparent reverse motion, pointer lag, and failure to stop cleanly

## Goal

Restore genuinely continuous pointer-focused zooming at active display cadence. Input and presentation remain responsive under backlog, steering follows the latest pointer, and release stops navigation immediately. Task 5 remains the numerical-preview baseline.

## Authority

- `REQUIREMENTS.md`: `FR-UX-001`, `FR-UX-002`, `FR-CAM-001`, `FR-GPU-001` through `FR-GPU-003`, `FR-PRES-001`, and `FR-PERF-001` through `FR-PERF-003`.
- `INVARIANTS.md`: `I-01`, `I-04`, `I-06`, `I-09` through `I-11`, and `I-15`.
- `ACCEPTANCE_TESTS.md`: `AT-UX-001`, `AT-UX-002`, `AT-GPU-001`, and `AT-PERF-001`.

## Constraints

- Preserve exact camera authority, the persistent target, no-display-stop policy, Task 5 preview, numerical stores, history provenance, and authority boundaries.
- Presentation is time-continuous, not visibly whole-octave stepped. Exact checkpoints cannot cause scale reversal or snapping.
- Coalesce pointer input to the latest focus; pointer events cannot create independent transition or render queues.
- Allow at most one render in flight plus one replaceable latest request. Stale completion cannot become current presentation state.
- Release/cancel stops camera evolution synchronously. Completed stale work cannot restart motion.
- Preserve the existing bounded Task 5 preview policy during motion. The logarithmic 50,000 control continues to govern reference work; changing preview caps or adding progressive settled refinement is a separate numerical-scheduling task.
- Preserve the requested zoom-speed range of 0.5–10 steps/s as a continuous logarithmic rate.
- Do not change numerical methods, reintroduce Tasks 006–010 renderers, promote authority, commit, push, deploy, or activate a successor.

## Work

1. Separate time-based navigation from exact camera checkpoints while preserving exact pointer focus.
2. Use one animation loop consuming latest focus and elapsed time.
3. Add a latest-frame scheduler with one in-flight render, stale rejection, and queue telemetry.
4. Stop synchronously on release and prevent subsequent displayed continuation.
5. Record requested and effective iteration policies explicitly; do not imply that the Task 5 preview cap equals the reference-work request.
6. Test continuous scale, steering, coalescing, submission bounds, release, stale completion, exact focus, and unchanged numerical authority.
7. Run full verification and a headed persistent-target trace using completed-work timing.

## Done when

- Sustained hold changes displayed scale continuously without octave pauses, snaps, or reversal.
- Steering follows latest pointer without accumulated transitions.
- Release causes no subsequent camera evolution or accepted stale presentation.
- Instrumentation proves one render in flight and one replaceable pending request.
- The 0.5–10 speed control is continuous, and evidence distinguishes the 5,000 reference-work request from the unchanged Task 5 motion-preview policy.
- The headed trace records P95/P99 completed-frame cadence, maximum stall, input and release latency, queue depth, method/iteration policy, viewport/DPR, browser, adapter, and diagnostics.
- Exact focus and accepted-store checksums are unchanged.

## Blocker protocol

If Task 5 cannot render within the interaction budget, retain exact camera responsiveness and use valid reprojection or lower-detail provisional frames. Never restore an unbounded render queue or relax numerical authority.

## Acceptance evidence

- 2026-08-16: `npm run verify` passed fixture validation, TypeScript, 47 Vitest tests, 5 script tests, 7 Rust tests, the pinned Wasm build, and the production build.
- Headed stable Edge passed 10/10 on the non-fallback AMD RDNA-4 adapter, including continuous-scale sampling, latest-pointer steering, exact focus, synchronous stop, queue bounds, history, and numerical-authority checks.
- The persistent target `-0.777120613150274923773 + 0.126857238786361887169i` was selected with a 5,000 reference-work request. The hold trace recorded 25 completed frames at 1186.4×516.8 CSS pixels and DPR 1: P95 19.16 ms, P99/max stall 19.55 ms, and maximum displayed focus error 0.000019 px.
- Queue evidence recorded maximum one render in flight and one replaceable pending request, with zero work remaining after release. Six sampled hold scales were strictly monotonic; steering consumed the new pointer focus without restarting a transition, and camera state remained unchanged for 100 ms after release.
- Camera scale interpolation uses fixed-point bigint arithmetic and exact dyadic updates. The authoritative module still contains no `Number`, `parseFloat`, or `Math` reconstruction.
- `npm run check:containment` and `git diff --check` passed. This is local acceptance only; it does not commit, push, deploy, change Task 5 numerical preview methods, or claim that the 5,000 reference request is the effective motion-preview cap.
- Release update: Task 011 shipped with Tasks 012 and 013 in commit `735897cd811f209bf09d084e0a4f3b6be7b6deb9`. GitHub Pages workflow `31927230330` passed, live asset readback confirmed the progressive release, and the live-origin headed Edge suite passed 11/11 on AMD RDNA-4. Task 013 supersedes the temporary Task 5 iteration-policy limitation described above while preserving this task's navigation contract.

## Remaining limitation

The visible motion renderer remains Task 5: direct f32 uses its existing shallow bound and compensated perturbation remains bounded to 320/512 iterations. Making the 1–50,000 control drive progressive preview refinement without blocking navigation requires a separate bounded scheduling task.
