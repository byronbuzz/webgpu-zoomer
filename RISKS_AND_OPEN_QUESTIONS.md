# Risks and Open Questions

## R-001 — False deep-precision confidence
- **Likelihood:** high
- **Impact:** critical
- **Severity:** critical
- **Evidence:** legacy nominal bit widths do not establish end-to-end precision.
- **Mitigation:** independent arbitrary-precision oracle; explicit error ledger; adversarial differential tests.
- **Contingency:** mark work unresolved and use stronger CPU/reference path.
- **Owner:** numerical lead
- **Trigger:** any oracle mismatch or unbounded precision transition.
- **Status:** active

## R-002 — Error accounting becomes too conservative or too expensive
- **Likelihood:** medium
- **Impact:** high
- **Severity:** high
- **Mitigation:** prototype bound representations; compare acceptance rate and overhead; separate detailed CPU metadata from compact GPU envelope.
- **Contingency:** ship simpler full-step method before advanced approximation.
- **Owner:** numerical lead
- **Status:** active

## R-003 — Browser GPU scheduling overhead dominates
- **Likelihood:** high
- **Impact:** high
- **Severity:** high
- **Evidence:** legacy per-tile/per-batch orchestration is CPU/resource heavy.
- **Mitigation:** packed resources; reusable bindings; active-work compaction; minimize host readback; measure physical GPUs.
- **Owner:** GPU lead
- **Status:** active

## R-004 — Presentation continuity hides real numerical regression
- **Likelihood:** medium
- **Impact:** critical
- **Severity:** high
- **Mitigation:** provenance overlays, accepted-store checksums, oracle gates independent of displayed image.
- **Owner:** verifier
- **Status:** active

## R-005 — Extreme-depth reference generation stalls perceived product
- **Likelihood:** high
- **Impact:** medium
- **Severity:** high
- **Mitigation:** asynchronous worker pool; reference prioritization; reusable references when validity proves it; honest convergence diagnostics.
- **Contingency:** preserve motion with history while unresolved coverage remains explicit.
- **Owner:** numerical/runtime
- **Status:** active

## R-006 — Cross-hardware floating behaviour creates semantic divergence
- **Likelihood:** medium
- **Impact:** high
- **Severity:** high
- **Mitigation:** conservative margins; cross-hardware corpus; optional stronger path on marginal cases.
- **Owner:** verifier
- **Status:** active

## R-007 — WASM multiprecision dependency/build complexity
- **Likelihood:** medium
- **Impact:** medium
- **Severity:** medium
- **Mitigation:** benchmark two candidates in Phase 0; pin toolchain; automate build; license/security review.
- **Owner:** precision implementation
- **Status:** active

## R-008 — Arbitrary-depth promise causes unbounded resources
- **Likelihood:** medium
- **Impact:** high
- **Severity:** high
- **Mitigation:** distinguish representational support from realtime throughput; hard resource budgets with evictions.
- **Owner:** architecture
- **Status:** active

## R-009 — Benchmark gaming / incomparable work
- **Likelihood:** high
- **Impact:** high
- **Severity:** high
- **Evidence:** legacy performance evidence admitted differing work volumes.
- **Mitigation:** frozen exact trajectories, settings schema, workload counters, correctness-coupled gate.
- **Owner:** performance verifier
- **Status:** active

## R-010 — Experimental API dependency leaks into production
- **Likelihood:** medium
- **Impact:** high
- **Severity:** high
- **Mitigation:** module/build isolation, capability flags, stable path release gate.
- **Owner:** WebGPU lead
- **Status:** active

## Open questions

### O-001 Multiprecision library
Research decision. Compare pure-Rust and MPFR-class WASM paths against fixed oracle/reference benchmarks.

### O-002 Numerical acceleration stack
Research decision. Begin with full-step direct/perturbation; promote scaling/rebasing/series/BLA only after conservative validity and measured benefit.

### O-003 GPU active-work topology
Research decision. Compare compacted index lists, atomic queues, indirect dispatch, and hybrid approaches.

### O-004 Hardware qualification
Before performance release, freeze minimum WebGPU limits/memory/throughput criteria and physical NVIDIA/AMD reference systems.

### O-005 Resource budgets
Set app-managed GPU/WASM/history/reference budgets after measurement on qualified hardware.

### O-006 Error ledger mathematics
Highest-priority research deliverable after exact oracle exists.

### O-007 Interior proofs
Analytic cardioid/bulb proofs are expected; additional conservative proof methods are optional until justified by boundary workload.

None of O-001..O-007 changes the settled product contract.
