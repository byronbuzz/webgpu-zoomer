# Project Instructions

## Authority

Use `AUTHORITY_REGISTER.md` to resolve conflicts. Current explicit human decisions and this project contract govern intended behaviour. Supplied repositories govern only observed legacy mechanics unless a mechanism is deliberately salvaged.

## State

Maintain `PROJECT_STATE.md` under **Control · Settled · Assumed · Open · Superseded · Next**. Never silently promote an assumption to settled.

`PROJECT_STATE.md` is canonical for current workflow position and active-task identity. Task files are bounded execution/acceptance contracts. Preserve accepted task files as historical evidence; do not overwrite them into the next task. Advance the active-task pointer only after acceptance evidence exists or an explicit blocker is recorded. Resolve state/evidence disagreement by inspection, never optimistic status editing.

## Persistent location

`F:\Coding\WebGPU-Zoomer` is the sole persistent repository location for this project.

- Keep persistent Git worktrees under `F:\Coding\WebGPU-Zoomer\.worktrees\` and manage them with `git worktree` commands.
- Keep local-only persistent artifacts under `F:\Coding\WebGPU-Zoomer\.local\`.
- Keep dependency installations and validation on the local SSD. Use `npm ci --no-audit --no-fund` for clean Node dependency installation.
- Use the system temporary directory for disposable validation artifacts and remove them after validation.
- Do not leave WebGPU-Zoomer repositories, worktrees, dependency trees, archives, caches, or validation copies elsewhere.
- Run `npm run check:containment` after relocation, worktree cleanup, or local validation cleanup. A reported outside artifact is a failure to reconcile, not a warning to ignore.

## Work loop

For every material change:

1. inspect relevant canonical files, code, tests, and current evidence;
2. state affected requirements and invariants;
3. implement one cohesive change;
4. run deterministic local checks;
5. run relevant oracle/benchmark/browser checks;
6. review the final diff;
7. repair confirmed findings;
8. record exact commands and captured outcomes.

## Numerical rule

Numerical authority must be conservative. Any approximation, perturbation, reference transport, rebasing, skipping, interpolation, or precision transition needs an executable validity contract. Failure of that contract produces `unresolved`, never invented certainty.

## Presentation rule

Presentation history may improve continuity only. It cannot write numerical state, establish escape/interior status, or become a future numerical reference.

## Performance rule

Optimize accepted outcomes, not synthetic counters. Preserve display-rate interaction before numerical freshness, but never hide correctness defects behind presentation continuity.

## Legacy rule

Do not build the successor by reorganising the v1.4/V4/V5/V6 code. Extract only a small mechanism whose necessity and correctness are demonstrated by a dedicated test or benchmark. New code should use the target architecture in `ARCHITECTURE.md`.

## Platform rule

The production path must use stable Chromium/WebGPU APIs without browser flags. Experimental features are isolated behind capability gates, have a stable fallback, and require independent promotion evidence.

## Human approval

Explicit approval is required before introducing production network services, authentication, telemetry that leaves the device, secrets, billing, destructive migrations, or other irreversible/external effects.

## Canonical locations

- requirements: `REQUIREMENTS.md`
- invariants: `INVARIANTS.md`
- architecture: `ARCHITECTURE.md`
- interfaces: `INTERFACES.md`
- decisions: `DECISIONS.md`
- validation: `VALIDATION.md`, `ACCEPTANCE_TESTS.md`
- current workflow position and active-task pointer: `PROJECT_STATE.md`; bounded task contract: the file named there
- risks/open matters: `RISKS_AND_OPEN_QUESTIONS.md`
