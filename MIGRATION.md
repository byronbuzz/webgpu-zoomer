# Legacy Salvage / Successor Policy

## This is not a migration project

The successor repository starts clean. The objective is not source compatibility with WebGPU Fractal Zoomer v1.4 or the V4/V5/V6 lineage.

Legacy archives remain available as:

- evidence of attempted architectures;
- sources of useful fixtures;
- sources of failure cases;
- candidates for narrowly salvaged algorithms;
- historical comparison baselines.

## Presumptive salvage candidates

These concepts are strong enough to reimplement or extract after tests:

- exact immutable camera concepts (`BigFixed`/exponent-separated scale lineage);
- exact dyadic world/tile identity and negative floor handling;
- epoch/lease monotonic publication;
- semantic provenance;
- accepted numerical atlas/store concept;
- immutable multiscale presentation history;
- deterministic camera/precision fixtures;
- browser evidence capture patterns.

“Candidate” does not mean copy the existing class/module.

## Presumptive reject/research candidates

Do not carry forward without new evidence:

- per-tile bundles of multiple textures/buffers/uniforms;
- per-batch host counter readback as scheduler authority;
- full-tile redispatch after most pixels are inactive;
- hard depth thresholds as correctness transitions;
- nominal multi-limb reference bit counts without end-to-end error analysis;
- fixed perturbation scale/rebase heuristics without conservative bound;
- v1.4/V4/V5/V6 version-specific renderer layers;
- generated source/version duplication;
- validation scripts that primarily search source text for expected tokens.

## Salvage procedure

A legacy mechanism may enter the successor only through a dedicated task:

1. identify exact source archive/path;
2. state requirement/invariant served;
3. state observed legacy behaviour and known failures;
4. write independent test/benchmark first;
5. choose fresh implementation vs extraction;
6. if extracted, minimize dependency closure;
7. run successor gates;
8. record decision and provenance.

## Fixture import

Legacy fixtures are especially valuable. Import only after:

- documenting what each fixture represents;
- confirming coordinates/settings;
- recalculating expected results with the new oracle;
- renaming version-bound fixtures to semantic names where appropriate;
- retaining original source provenance.

Do not import a “pass” expectation blindly.

## Evidence preservation

Keep the original ZIPs outside the successor source tree or under a non-built archival/evidence location if needed. Do not unpack 150+ legacy files into the new production tree merely for convenience.
