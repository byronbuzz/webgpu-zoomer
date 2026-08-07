# Authority Register

## Precedence

For **intended behaviour**:

1. explicit current human decision;
2. this project package;
3. subsequently approved decision records;
4. executable acceptance tests that encode the approved requirement;
5. legacy documentation;
6. legacy code;
7. inference.

For **legacy mechanics**:

1. directly inspected legacy code;
2. executable legacy tests/runtime evidence;
3. legacy documentation;
4. inference.

For **deployed reality**, measured runtime evidence outranks prose but does not rewrite intended behaviour.

## Sources

| ID | Source | Type | Scope | Status | Authority / use |
|---|---|---|---|---|---|
| H-2026-08-08 | User decisions in formation dialogue | human decisions | product/deployment/correctness/UX | current | Highest authority for settled choices in `PROJECT_STATE.md`. |
| PFP-1 | This Project Forge package | specification | successor project | current | Governs intended successor behaviour until explicitly amended. |
| L14-ZIP | `WebGPU_Fractal_Zoomer_v1.4.0_PRODUCTION_3986704.zip` | code/tests/evidence | legacy v1.4 mechanics | historical, partially conflicted | Salvage/evidence only. SHA-256 in `ASSET_MANIFEST.md`. |
| L14-SPEC | `WebGPU_Fractal_Zoomer_Technical_Specification_3986704.md` | documentation | legacy as-built intent/mechanics | historical | Useful map; cannot override inspected code or successor decisions. |
| L14-SUM | `WebGPU_Fractal_Zoomer_Development_Summary_3986704.md` | documentation | legacy history | historical | Context on evolution/failures. |
| L14-RMAP | `docs/webgpu-fractal-zoomer-technical-specification-and-roadmap.md` inside production ZIP | roadmap/spec | legacy future direction | historical/proposal | Candidate ideas only. |
| L456-ZIP | `Mandelbrot_Zoomer_V4_V5_V6_LINEAGE_eb79d29.zip` | code | earlier lineage | historical | Failure/salvage evidence; never current architecture. |
| E-NUM | v1.4 numerical browser evidence under `docs/evidence/numerical/...` | runtime artefacts | selected legacy numerical scenes | conflicted | Informative but not release authority; supplied trace/report integrity problems were observed. |
| E-PERF | v1.4 performance evidence under `docs/evidence/performance/...` | runtime artefacts | selected legacy throughput comparison | provisional | Useful directional evidence; workload equivalence is not sufficient for universal throughput claims. |
| E-OVER | `docs/evidence/precision/overlap-amd/report.json` | runtime report | direct/perturbation overlap | conflicted | Records 538 semantic-conflict events; blocks treating the corresponding run as correctness proof. |
| WGPU-2026 | WebGPU specification, consulted 2026-08-08 | external primary spec | platform semantics/features | current external | Platform mechanics only; re-verify when implementation/release changes browser version. |
| CHROME-WGPU | Chrome for Developers WebGPU material, consulted 2026-08-08 | browser vendor docs | Chromium implementation/features | current external | Capability planning; never assume optional feature availability without adapter detection. |
| COI | Cross-origin isolation platform docs, consulted 2026-08-08 | platform docs | SharedArrayBuffer deployment | current external | Deployment requirement; verify headers in end-to-end gate. |

## Legacy conflicts that must remain visible

### Precision claim vs effective arithmetic

Legacy code can retain very large exact camera integers while selected reference-generation and GPU recurrence paths convert through JavaScript `number` and `f32` expansions. Therefore nominal camera/reference bit counts do not establish end-to-end precision.

**Resolution:** successor requires explicit end-to-end error accounting and independent oracle comparison.

### “Pass” summaries vs captured conflicts

The overlap evidence records semantic conflicts. Some browser evidence artefacts are malformed/truncated.

**Resolution:** labels and README summaries are not accepted as proof; machine-readable evidence must itself pass integrity and semantic gates.

### Smooth presentation vs numerical truth

Legacy presentation work demonstrates useful continuity mechanisms, but reprojected history can only be a display estimate.

**Resolution:** successor makes provenance a cross-system invariant.

## Supersession rule

No legacy file is “superseded” as historical evidence. It is superseded only as operative architecture or product authority. If a specific legacy algorithm is salvaged, record:

- exact source path and commit/archive hash;
- the new requirement it serves;
- tests that independently establish behaviour;
- modifications made;
- why a fresh implementation was not preferable.
