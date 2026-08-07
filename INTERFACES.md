# Material Interfaces

Interfaces are conceptual contracts; exact language-level shapes may change after the first prototype.

## ExactCamera

```ts
type ExactCamera = {
  centerX: ExactDyadic;
  centerY: ExactDyadic;
  viewportScale: ExactDyadic;
  epoch: bigint;
}
```

Operations:

- zoom about screen focus;
- pan/steer;
- serialize/deserialize losslessly;
- derive bounded approximate transforms for GPU/presentation;
- never expose “convert entire canonical camera to number and write it back”.

## WorldKey

```ts
type WorldKey = {
  formulaId: string;
  level: bigint | number;   // representation must not impose zoom ceiling
  x: bigint;
  y: bigint;
  samplingVersion: number;
}
```

Keys are canonical, immutable, and independent of viewport request IDs.

## PrecisionRequest / ReferenceResult

Request includes:

- formula ID/version;
- exact reference point;
- requested iterations/work;
- target error budget;
- requested transport profile;
- cancellation epoch.

Result includes:

- exact request identity;
- working precision;
- orbit/auxiliary data;
- conservative reference error metadata;
- transport encoding/version;
- checksum/length;
- status: complete | cancelled | failed.

Nominal “bits” without measured/derived error metadata are insufficient.

## NumericalWorkItem

Must identify:

- world/sample region;
- request epoch;
- method;
- reference ID/version;
- progress;
- required result channels;
- current validity/error state.

It must be serializable enough for diagnostics and deterministic replay.

## SampleProvenance

Minimum authoritative states:

```text
escaped
certified_interior
unresolved
invalid
```

Internal reasons should include at least:

```text
analytic_interior
escape_bound_proved
iteration_budget_exhausted
reference_exhausted
reference_error
transport_error
perturbation_glitch
rebase_invalid
approximation_bound_failed
nonfinite
stale_epoch
conflict
```

## ErrorLedger

Exact schema is research work. It must support:

- additive/composed conservative bounds;
- method/version identification;
- decision margin query;
- compact GPU-compatible representation where needed;
- detailed CPU diagnostic representation.

## AcceptedSample

Contains:

- canonical key/sample position;
- provenance;
- result channels;
- quality tier;
- numerical method/reference version;
- error summary sufficient to justify publication;
- accepted epoch/freshness.

## PresentationSnapshot

Contains only derived display data plus:

- exact camera snapshot used to produce it;
- transform domain/validity;
- age/level;
- no numerical-authority flag.

No interface permits converting a `PresentationSnapshot` into an `AcceptedSample`.

## FormulaModule

Build-time/module contract:

```text
id/version
analytic proofs
CPU arbitrary-precision oracle/reference
GPU direct recurrence
GPU perturbation/acceleration paths
bailout semantics
result channel definitions
validity/error composition
```

## DiagnosticsSnapshot

Must be cheap to produce and include at minimum:

- display refresh estimate / frame timing;
- camera epoch and zoom/depth representation;
- authoritative coverage vs provisional/history coverage;
- numerical queue depth;
- active/converged/unresolved counts;
- method mix;
- reference pool status/working precision;
- GPU memory/resource counters available to the app;
- worker utilization;
- optional adapter timestamps if supported;
- conflicts/bound failures;
- capability tier.

Diagnostics collection itself must not create a steady interaction stall.
