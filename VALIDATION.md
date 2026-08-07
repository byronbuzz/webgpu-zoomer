# Validation Strategy

## Philosophy

The product is accepted by evidence, not confidence. Numerical correctness, interaction continuity, and throughput are independent axes and must be measured separately before being combined.

## Traceability

| Intent | Requirements | Invariants | Acceptance |
|---|---|---|---|
| indefinite exact navigation | FR-CAM-001..003, FR-NUM-001 | I-01, I-08 | CAM, NUM depth tests |
| conservative truth | FR-NUM-002..007 | I-02..07 | oracle/differential/adversarial tests |
| XaoS-like smoothness | FR-UX-001..002 | I-09 | interaction/frame tests |
| safe history reuse | FR-PRES-001..004 | I-04, I-05 | provenance/reprojection tests |
| throughput architecture | FR-GPU-001..005 | I-10..12 | scheduling/resource benchmarks |
| portable supported semantics | FR-NUM-006, FR-PLAT-001 | I-14 | NVIDIA/AMD comparison |
| honest performance | FR-PERF-001..003 | I-15 | evidence schema + normalized benchmark |

## Test layers

### Static/unit

- exact dyadic arithmetic/property tests;
- negative floor/world key properties;
- serialization round trips;
- provenance state machine;
- error-bound composition;
- queue/epoch ordering;
- result-quality partial ordering.

### Rust oracle

Use arbitrary-precision Mandelbrot evaluation to produce:

- escape classification;
- certified analytic interior where available;
- high-precision continuous/smooth value where appropriate;
- reference orbit values;
- independent decision margins.

Fixtures include easy interiors/exteriors, boundary points, mini-brots, high-period regions, near-bailout points, very deep coordinates, and deliberately insufficient-precision cases.

### GPU differential

For deterministic sample sets:

- direct GPU vs oracle;
- perturbation vs oracle;
- candidate acceleration vs full-step perturbation and oracle;
- transport reconstruction vs source reference;
- failure injection that must become unresolved.

### Browser end-to-end

Measure exact navigation, pointer focus, frame pacing, cancellation, history validity, recolouring, device loss recovery where automation permits, and deployment headers.

### Cross-hardware

Run identical manifests/fixtures on at least one qualifying NVIDIA and one qualifying AMD desktop system. Compare semantic states and numerical channels under declared tolerances; colour pixels need not be bitwise equal.

### Performance

Use fixed scene + exact trajectory datasets. Report:

- frame times P50/P95/P99;
- input-to-present where measurable;
- authoritative coverage over time;
- accepted numerical samples/work units per second;
- unresolved/conflict rates;
- GPU submission/work counts;
- CPU/main-thread utilization proxies;
- worker utilization;
- resident/app-managed memory counters;
- reference generation latency;
- method mix.

## Benchmark tiers

Define at least:

1. shallow/direct;
2. moderate perturbation crossover;
3. deep reference-dominated;
4. difficult boundary/high iteration;
5. sustained 30–60 s continuous zoom;
6. zoom direction reversal/steering stress;
7. extreme-depth representation smoke test.

Depth values are fixture data, not architecture limits.

## Performance threshold calibration

Before the first performance release:

1. select one qualifying NVIDIA and one qualifying AMD midrange system;
2. record hardware/browser/OS;
3. measure display refresh;
4. freeze benchmark trajectories;
5. set thresholds in versioned benchmark policy.

Initial policy goal: presentation frame time P95 should remain within one active refresh interval during standard sustained-zoom trajectories on the qualified baseline, while numerical freshness may lag. Any chosen numeric exception must be explicit and scene-specific.

## Evidence integrity

Every evidence directory must pass:

- expected files present;
- JSON parse;
- schema validation;
- checksum validation;
- trace/ZIP open test if present;
- commit/settings/environment completeness;
- no `PASS` if semantic conflict count is non-zero unless the acceptance contract explicitly permits and explains that class.

## Independent review

For a material numerical or scheduling change, reviewer receives:

- requirement IDs;
- diff/commit;
- fixture changes;
- exact commands and machine results;
- evidence bundle.

Reviewer should try to falsify validity/error handling and workload equivalence, not merely read implementation prose.
