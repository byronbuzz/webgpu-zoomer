# Task 012 — Scale/Depth Correction and Iteration-Policy Telemetry

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Predecessor:** `TASK_011_CONTINUOUS_NAVIGATION_RECOVERY.md` — locally accepted and preserved
- **Source state:** approved correction to misleading scale/depth display, binary64-underflow-prone scale representation, and ambiguous requested-versus-effective iteration telemetry

## Goal

Report exact-camera scale and depth from a bounded representation that remains usable beyond binary64 exponent range, and expose the requested reference-work policy separately from the effective Task 5 motion-preview policy.

## Authority

- `REQUIREMENTS.md`: `FR-UX-003`, `FR-CAM-001`, `FR-NUM-001`, `FR-NUM-003`, and `FR-PERF-002`.
- `INVARIANTS.md`: `I-01`, `I-03`, `I-08`, `I-09`, `I-10`, and `I-15`.
- `ACCEPTANCE_TESTS.md`: `AT-CAM-001`, `AT-NUM-001`, `AT-NUM-003`, and `AT-PERF-002`.

## Constraints

- Preserve all accepted Task 11 navigation, exact-focus, stop, latest-frame scheduling, queue telemetry, and completed-work timing behaviour.
- Preserve Task 5 direct and compensated-perturbation shaders, selection thresholds, iteration caps, and presentation-only authority.
- Bounded scale/depth representation may derive presentation telemetry from exact state but cannot feed canonical camera state or numerical authority.
- Do not claim a requested reference-work limit is the active motion-preview cap.
- Do not introduce a fixed depth ceiling, new numerical method, progressive-refinement scheduler, commit, push, or deployment.

## Work

1. Add a bounded positive-dyadic decomposition whose significand remains finite while its binary exponent remains bigint.
2. Derive scale and depth display from the complete dyadic value, not the raw stored exponent or an underflowed binary64 value.
3. Publish versioned scale telemetry that remains finite and meaningful at exponents far beyond binary64.
4. Publish versioned iteration-policy telemetry separating the requested reference-work cap from the effective motion-preview method and cap.
5. Add deterministic unit and headed-browser coverage, including an extreme-depth camera and the persistent-target 5,000 request.
6. Run full verification, the headed persistent-target gate, containment, and final-diff inspection.

## Done when

- Equivalent normalized dyadics produce the same bounded scale representation.
- A scale thousands of binary exponents deep yields finite bounded significand telemetry and an exact bigint exponent, without displaying `Infinity×` or treating the raw dyadic exponent as the complete scale.
- The persistent-target trace records requested reference work separately from the effective 320/512-iteration Task 5 preview policy and active method.
- Task 11 continuous motion, exact focus, immediate stop, and one-in-flight plus one-replaceable-pending gates remain passing.
- Numerical authority and accepted-store checksums remain unchanged.

## Blocker protocol

If scale cannot be represented within the bounded presentation contract, report it explicitly as unavailable while retaining exact camera authority. If the effective iteration policy cannot be derived from the submitted view, report `unresolved`; never infer it from the slider request.

## Acceptance evidence

- 2026-08-16: `npm run verify` passed fixture validation, TypeScript, 49 Vitest tests, 5 script tests, 7 Rust tests, the pinned Wasm build, and the production build.
- Headed stable Edge passed 10/10 on the non-fallback AMD RDNA-4 adapter. The retained Task 11 persistent-target trace recorded 24 completed frames, P95 19.245 ms, P99/max 19.720 ms, maximum focus error 0.000019 px, and queue depth one plus one.
- The initial exact scale `11 × 2^-2` read back as bounded `1.375 × 2^1` at depth zero. The deterministic extreme-depth case `11 × 2^-20004` read back with the same finite `1.375` significand and exact binary exponent `-20001`, without converting the complete value to binary64.
- With a 5,000-iteration reference-work request, runtime evidence reported the effective submitted motion preview separately as `direct-f32`, 320 iterations, `presentation-only`, with `requestAffectsMotionPreview: false` and cap exhaustion classified `unresolved`. Unit coverage separately confirmed the compensated perturbation 512-iteration tier.
- `npm run check:containment` and `git diff --check` passed. Task 11 exact navigation, immediate stop, one-in-flight plus one-replaceable-pending scheduling, Task 5 numerical methods, and numerical-authority gates remain unchanged. This is local acceptance only; it does not commit, push, or deploy.
