# Repository Skills Plan

Do not create a large agent framework initially. Add these procedures only when their trigger appears repeatedly.

## inspect-legacy-mechanism

**Trigger:** a task proposes salvaging code/fixtures from supplied archives.  
**Output:** exact source path/hash, behaviour, dependencies, known defects, served requirement, recommendation: reimplement/extract/reject.

## reproduce-numerical-failure

**Trigger:** oracle mismatch, semantic conflict, nonfinite/glitch, or cross-hardware disagreement.  
**Procedure:** freeze camera/settings/reference/method/environment -> minimize sample set -> compare oracle/intermediates -> classify error source -> create fixture before repair.

## verify-numerical-method

**Trigger:** direct/perturbation/rebase/series/other numerical change.  
**Output:** validity contract, fixture coverage, differential results, fail-safe tests, performance delta, unresolved limitations.

## benchmark-gpu-change

**Trigger:** storage/scheduling/shader optimization claim.  
**Procedure:** identical trajectory/settings -> integrity checks -> physical NVIDIA/AMD where promotion-relevant -> normalized accepted work + frame timing -> correctness gate.

## package-evidence

**Trigger:** benchmark/release evidence capture.  
**Output:** schema-valid manifest/environment/settings/trajectory/results/correctness/checksums and verified optional archives.

## release

**Trigger:** candidate production release.  
**Checks:** stable Chromium/no flags, cross-origin isolation, oracle/cross-hardware gates, benchmark thresholds, evidence integrity, no blocker risks, rollback path.

## rollback

**Trigger:** production regression/device compatibility/numerical conflict.  
**Goal:** disable candidate acceleration or revert release without changing exact bookmark/state format.
