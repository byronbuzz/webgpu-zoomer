# Development Harness

## 1. Repository shape

Create a clean successor repository approximately like:

```text
README.md
AGENTS.md
docs/
  PROJECT_STATE.md
  REQUIREMENTS.md
  ARCHITECTURE.md
  INVARIANTS.md
  VALIDATION.md
  DECISIONS/
apps/web/
  src/
crates/
  precision/
  precision-wasm/
packages/
  exact-camera/
  numerical-contract/
  gpu-engine/
  presentation/
  formula-mandelbrot/
tests/
  fixtures/
  oracle/
  browser/
  cross-hardware/
benchmarks/
  scenes/
  trajectories/
  schemas/
scripts/
  setup
  verify
  benchmark
  package-evidence
legacy-evidence/README.md
```

Tailor after scaffolding; do not create empty abstractions.

## 2. Ownership

Default: one implementation owner for a cohesive change.

Use independent specialist work only for:

- numerical-method research that can be compared independently;
- Rust/WASM build/performance investigation;
- WebGPU kernel performance experiments;
- independent correctness verification;
- cross-hardware benchmark execution.

Do not run several agents editing the same renderer.

## 3. Required local toolchain

Pin after the first scaffold:

- Node/pnpm (or selected JS package manager);
- Rust stable toolchain;
- WASM target/tooling;
- current stable Chromium for acceptance;
- Playwright or equivalent browser automation;
- WebGPU TypeScript definitions;
- formatting/lint/type checking;
- Rust tests/clippy/format;
- benchmark/evidence scripts.

Tool versions are operational facts and must live in lock/config files, not this durable specification.

### Phase-0 physical GPU gate

The checked-in gate targets an installed current-stable Google Chrome, launches it headed so the physical adapter is exercised, and does not add experimental WebGPU flags. Install the pinned Rust toolchain through rustup, then install the matching WASM binding CLI:

```sh
cargo install wasm-bindgen-cli --version 0.2.126 --locked
npm ci
npm run gate:physical
```

`rust-toolchain.toml` supplies Rust `1.89.0`, `rustfmt`, and the `wasm32-unknown-unknown` target. The gate runs the deterministic verifier, native precision benchmark, WASM/browser oracle corpus, and direct WebGPU differential. It rejects a fallback/software adapter and writes machine-readable results below `test-results/`.

Run the same commit and corpus on the AMD and NVIDIA reference machines. A successful AMD result alone does not establish `AT-NUM-009`.

## 4. Context routing

Before work, read:

1. `PROJECT_INSTRUCTIONS.md`;
2. current `PROJECT_STATE.md`;
3. requirements/invariants affected by the task;
4. exact implementation files;
5. relevant tests/evidence.

Load legacy archives only for a named salvage/research question.

## 5. Material change contract

Every substantive task names:

```yaml
goal:
requirements:
invariants:
relevant_files:
risk:
expected_evidence:
rollback:
```

Completion report:

```yaml
task:
commit_or_patch:
files_changed:
requirements_satisfied:
commands_executed:
tests_passed:
tests_failed:
browser_runs:
performance_results:
oracle_results:
cross_hardware_results:
assumptions:
known_limitations:
rollback:
evidence_locations:
```

No unexecuted command appears under `commands_executed`.

### Task transition protocol

1. Reconcile `PROJECT_STATE.md`, the active task, repository state, and relevant evidence before work.
2. Execute only the bounded active task.
3. Run claim-scoped verification and map each live completion claim to actual evidence.
4. If accepted, preserve completion evidence and update `PROJECT_STATE.md`.
5. Only then advance **Active task** to a successor contract.
6. If blocked, record the blocker evidence and make the blocked state explicit.
7. Stop when the active acceptance contract is satisfied; do not add unrelated post-acceptance work.

## 6. Numerical development loop

For each new numerical method:

```text
derive validity condition
→ implement CPU/oracle form
→ add adversarial fixtures
→ implement GPU form
→ differential test
→ inject near-bound failures
→ verify unresolved/escalation behavior
→ benchmark
→ independent review
→ enable behind feature flag
→ promote only after cross-hardware evidence
```

Performance work begins only after a method can fail safely.

## 7. GPU optimization loop

Use:

```text
measure bottleneck
→ form one hypothesis
→ change one material scheduling/storage mechanism
→ capture GPU/CPU/frame counters
→ run same deterministic trajectories
→ run numerical gates
→ compare accepted work per wall-clock and interaction frame budget
```

Reject “faster” changes that alter workload admission or correctness without normalization.

## 8. Evidence bundles

Each benchmark run creates an immutable directory:

```text
manifest.json
environment.json
settings.json
trajectory.json
results.json
correctness.json
checksums.sha256
optional-trace/
optional-screenshots/
```

Manifest records commit, dirty state, browser, OS, GPU adapter, driver if available, viewport, DPR, display refresh, feature set, method versions, scene, duration.

Evidence packaging must verify JSON parseability and ZIP integrity.

## 9. CI

Fast PR gate:

- formatting;
- JS/TS typecheck/unit tests;
- Rust format/test/clippy;
- deterministic oracle fixtures;
- shader parsing/compilation checks where feasible;
- architecture-contract/static checks that test genuine contracts, not version-name strings.

Browser gate on supported runner:

- exact-camera round trips;
- WebGPU smoke;
- provenance;
- cancellation/stale publication;
- direct-vs-oracle;
- perturbation-vs-oracle;
- presentation continuity.

Physical GPU release gate:

- NVIDIA reference machine;
- AMD reference machine;
- fixed benchmark corpus;
- cross-hardware semantic comparison.

## 10. Release policy

A release is blocked by:

- any oracle mismatch outside declared bound;
- unexplained semantic conflict;
- malformed evidence artefact;
- stale-publication failure;
- missing cross-origin isolation;
- unsupported stable Chromium path;
- interaction benchmark regression beyond threshold;
- unresolved P0 risk marked blocker.

## 11. Rollback

All experimental/candidate numerical accelerations and capability paths require kill switches/build flags. A release rollback must be able to return to the last validated stable algorithm set without changing bookmark/state format.
