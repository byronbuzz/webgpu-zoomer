# Task 013 — Progressive Convergence Foundation

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Predecessor:** `TASK_012_SCALE_DEPTH_AND_ITERATION_TELEMETRY.md` — locally accepted; release withheld because the iteration control does not affect visible convergence
- **Source state:** explicit user direction to restore alignment with the initial two-clock architecture and to supersede Task 5's fixed 320/512 preview ceilings as product policy

## Goal

Replace the stateless fixed-cap preview policy with a persistent, epoch-versioned, progressively scheduled convergence foundation. The selected iteration limit must govern visible current-view convergence while interaction remains display-rate responsive and numerical work remains bounded, cancellable, and presentation-only until separately validated for authority.

## Authority

- `REQUIREMENTS.md`: `FR-UX-002`, `FR-NUM-003`, `FR-NUM-005`, `FR-GPU-001` through `FR-GPU-004`, `FR-PRES-001` through `FR-PRES-004`, and `FR-PERF-001` through `FR-PERF-003`.
- `INVARIANTS.md`: `I-02` through `I-06`, `I-09` through `I-11`, and `I-15`.
- `ARCHITECTURE.md`: two clocks, versioned work items, chunked/resumable GPU work, asynchronous submission, accepted-store separation, and presentation composition.
- `UI_UX.md`: numerical backlog sacrifices freshness/detail before camera responsiveness; release stops commanded navigation while convergence may continue.
- Current explicit user decision: initial documentation governs; Task 5's 320/512 limits must not constrain the target implementation.

## Constraints

- Preserve Task 11 exact continuous navigation, latest-focus steering, synchronous stop, and one-in-flight plus one-replaceable-pending presentation admission.
- Preserve Task 12 bounded scale/depth representation.
- Iteration selection is a convergence target, not a requirement to execute the full limit in one frame or dispatch.
- Numerical work is persistent and advances in bounded chunks; chunk size is an implementation budget, never a semantic iteration ceiling.
- A camera, viewport, method, precision, or iteration-policy change creates a new request identity. Stale work may finish but cannot become current presentation.
- Cap exhaustion is `unresolved`; presentation remains explicitly non-authoritative until a separate publication/error contract passes.
- No presentation/history resource may become recurrence or reference input.
- Do not introduce a fixed zoom-depth crossover, synchronous main-thread reference search, per-batch interaction-path readback, unbounded GPU allocation, commit, push, or deployment.

## Work

1. Define a versioned progressive-view request and diagnostics contract separating semantic iteration target from bounded dispatch quantum.
2. Add persistent GPU recurrence state for current-view direct convergence and advance it through bounded resumable compute chunks.
3. Add epoch/logical cancellation and latest-request scheduling without draining prior GPU work.
4. Make the logarithmic iteration control change the visible convergence target and report target, completed progress, active count, chunk size, resets, and stale completions.
5. Retain history/current provisional presentation while convergence catches up; never relabel provisional pixels as accepted numerical samples.
6. Add deterministic scheduler/policy tests and headed-browser coverage for slider effect, progressive continuation, cancellation, navigation cadence, stop semantics, bounded queues, and authority separation.
7. Run full verification, headed physical-browser validation, containment, and final-diff inspection.

## Done when

- Increasing the iteration control produces observable additional current-view convergence without a monolithic full-cap interaction render.
- Work advances across multiple bounded chunks and retains recurrence progress for the same request.
- New camera/viewport/policy requests supersede old work without waiting for a queue drain or accepting stale presentation state.
- Interaction, exact focus, steering, immediate stop, and presentation queue bounds remain passing.
- Diagnostics distinguish target iterations, dispatch quantum, completed progress, active/unresolved/escaped coverage, request identity, and presentation-only authority.
- The implementation contains no permanent 320/512 product-policy ceiling. Any retained compatibility fallback is explicitly provisional and is not reported as the effective convergence policy.

## Blocker protocol

If a stateful WebGPU path cannot satisfy stable-browser resource or cadence bounds, preserve Task 11 navigation and record the precise resource/timing failure. Do not restore fixed Task 5 ceilings as product policy. If deep precision requires a not-yet-available reference path, report that coverage as provisional/unresolved and activate the smallest Rust/WASM reference-orbit successor only after this scheduling foundation is reconciled.

## Acceptance evidence

- 2026-08-16: `npm run verify` passed fixture validation, TypeScript, 51 Vitest tests, 5 script tests, 7 Rust tests, the pinned Wasm build, and the production build.
- Headed stable Edge passed 11/11 on the non-fallback AMD RDNA-4 adapter. The new browser case proved that increasing the selected target changed canvas pixels after progressive convergence, advanced through 64-iteration dispatch quanta, measured complete escaped/unresolved pixel coverage only after settled completion, and restored the original eight-iteration pixels exactly after a lower-target reset.
- The retained persistent-target navigation trace requested and reached 5,000 direct-progressive iterations with one render in flight plus one replaceable pending request. It recorded 123 completed motion frames, P95 3.935 ms, P99 4.200 ms, maximum stall 4.250 ms, maximum focus error 0.000019 px, 27 harmless stale completions, and no queued work after release on AMD RDNA-4.
- Direct recurrence state is GPU-resident and persists across bounded dispatches for the same view. A changed camera/viewport or lower target resets state; a higher target continues it. Settled-only coverage readback is outside navigation and no per-chunk interaction-path readback was introduced.
- The former stateless 320-iteration preview shader was removed. The existing 512-entry compensated-reference path remains only as an explicitly incomplete compatibility preview: when a larger target is selected it reports `reference_path_iteration_limit`, `complete: false`, and presentation-only authority rather than defining global iteration policy.
- `npm run check:containment` and `git diff --check` passed. This is local acceptance only; no commit, push, deployment, numerical-authority promotion, or deep-reference correctness claim occurred.

## Remaining limitation

The progressive foundation currently provides persistent direct-f32 convergence. Deep views still require the separately bounded high-throughput Rust/Wasm reference-orbit and validity-driven perturbation path described by the original architecture. The compatibility perturbation preview cannot satisfy targets beyond its reference bound and is reported unresolved rather than silently capping product policy.
