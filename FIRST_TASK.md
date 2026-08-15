# First Task — Build the Numerical Authority and Experimental Spine

## Lifecycle

- **Status:** `accepted`
- **Controlling state:** `PROJECT_STATE.md`
- **Completion review:** `docs/FIRST_TASK_COMPLETION_REPORT.md`
- **Primary acceptance evidence:** `evidence/phase-0-amd-rdna4-edge151-2026-08-08/`

```yaml
Goal:
  Create the clean successor repository and establish an executable, independently
  checkable numerical spine before implementing the explorer renderer.

Context:
  The legacy code demonstrates useful exact-camera, persistent-world, provenance,
  and presentation concepts, but does not establish end-to-end arbitrary-depth
  numerical correctness and carries a resource/readback-heavy GPU topology.
  The project now requires conservative correctness, no fixed depth ceiling,
  Rust/WASM precision, and a stable WebGPU production path.

Constraints:
  - Do not port or reorganize v1.4 wholesale.
  - No backend.
  - Stable current Chromium/WebGPU path; no flags required.
  - Cross-origin isolation is required in the dev/preview harness.
  - Rust/WASM is the precision/oracle boundary.
  - Canonical camera authority must not round through JS number.
  - Iteration cap is unresolved, not interior.
  - Every GPU mismatch/bound failure must be observable.
  - Performance claims are secondary to oracle correctness in this task.

Relevant_files:
  - PROJECT_INSTRUCTIONS.md
  - REQUIREMENTS.md
  - INVARIANTS.md
  - ARCHITECTURE.md
  - INTERFACES.md
  - VALIDATION.md
  - ACCEPTANCE_TESTS.md
  - RESEARCH_NOTES.md
  - supplied legacy archives only for named fixture/mechanism inspection

Output:
  1. Clean TS + Rust/WASM repository scaffold with reproducible setup.
  2. Exact dyadic camera/world primitive package with property tests.
  3. Rust arbitrary-precision Mandelbrot oracle API running in browser worker/WASM.
  4. Initial deterministic fixture corpus, including shallow, boundary, deep,
     insufficient-precision, negative-world-coordinate, and extreme-exponent cases.
  5. Minimal WebGPU compute harness for direct Mandelbrot samples, not a product UI.
  6. Differential runner comparing WebGPU direct output against the Rust oracle.
  7. Evidence bundle schema + script that validates JSON/checksums/archive integrity.
  8. Prototype benchmark for two Rust multiprecision implementation candidates, or
     a documented reason one candidate cannot be built/licensed/used.
  9. Updated PROJECT_STATE/DECISION record for the chosen precision foundation.

Done_when:
  - setup works from a clean checkout;
  - exact camera property tests pass over extreme exponents;
  - browser reports cross-origin isolation and threaded WASM capability;
  - oracle fixtures are deterministic and versioned;
  - WebGPU direct shallow/adversarial samples satisfy declared oracle comparison;
  - cap-exhausted cases remain unresolved;
  - an intentional insufficient-bound case fails safely;
  - evidence validator rejects malformed JSON/ZIP/checksum artefacts;
  - exact commands, versions, failures, repairs, and results are captured;
  - no product-renderer architecture has been imported from v1.4.

Do_not_do:
  - Do not implement the full presenter.
  - Do not add series/BLA/rebasing before the baseline oracle/error contract exists.
  - Do not claim arbitrary-depth GPU correctness from limb count.
  - Do not create per-tile production resource architecture.
  - Do not optimize based on FPS screenshots.
  - Do not classify non-escape at the iteration cap as interior.
```

## Suggested first fixture imports

Inspect legacy fixtures as candidate *inputs*, then regenerate their expected outputs with the new oracle:

- shallow direct fixture;
- precision overlap boundary;
- rebase boundary;
- deep repair storm;
- user deep-precision failure cases.

Retain legacy provenance but not legacy expected “pass” status.

## Evidence required in the task completion report

- repository tree;
- toolchain versions;
- build/test commands with exit codes;
- Rust oracle test summary;
- exact-camera property-test summary;
- browser/WebGPU environment manifest;
- differential results;
- intentionally failing/uncertain fixture result;
- precision-candidate benchmark table;
- known limitations;
- next recommended task.
