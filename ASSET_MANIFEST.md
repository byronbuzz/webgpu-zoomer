# Asset Manifest

Supplied source archives are **not embedded in this project package**. Upload them to the ChatGPT Project when legacy evidence is needed. Keep them read-only.

| ID | Asset | SHA-256 | Status | Purpose | Upload to Project? | Included in package? |
|---|---|---|---|---|---|---|
| A-001 | `WebGPU_Fractal_Zoomer_v1.4.0_PRODUCTION_3986704.zip` | `8a5a213128d4df81ae009ab3d21fa16d6d05da6fba108a1b508ec94cac5f19a5` | historical/conflicted evidence | latest legacy code, tests, fixtures, runtime evidence; salvage source | Yes | No |
| A-002 | `WebGPU_Fractal_Zoomer_Documentation_3986704.zip` | `6289550cc01b5b382a83eab3883abf1b2b0be8ff80a7f1bccd6df63e6605664b` | historical documentation | as-built specification and development history | Yes | No |
| A-003 | `Mandelbrot_Zoomer_V4_V5_V6_LINEAGE_eb79d29.zip` | `d3bad77132578b44831a32110190ad59fa94a6e229dca3a15ab6c86305048aa0` | historical lineage | earlier renderer/reference/scheduling approaches and failure evidence | Yes | No |

## Asset authority

These archives do not govern successor intent. `AUTHORITY_REGISTER.md` defines their evidence role.

## Legacy evidence locations of special interest

Within A-001:

- `src/presentation/progressiveTileFieldRenderer.ts`
- `src/numerical/precisionPolicy.ts`
- `src/numerical/tileFieldShadersV13.ts`
- `src/references/tileReferenceAtlasV13.ts`
- `src/tiles/worldTilePlanner.ts`
- `src/v4/referenceWorker.ts`
- `tests/fixtures/`
- `scripts/run-*-browser-gate.mjs`
- `docs/evidence/numerical/`
- `docs/evidence/performance/`
- `docs/evidence/precision/overlap-amd/`

## Package-generated files

All Markdown files in this ZIP are current successor project authority as a set. Do not upload only one without the others unless the Project already contains the complete matching version.
