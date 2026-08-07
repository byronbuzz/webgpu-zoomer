# Acceptance Tests

IDs below are contracts; implementation may split them into multiple automated cases.

## Camera / world

### AT-CAM-001 — exact zoom round trip
Generate random exact cameras over a wide exponent range. Apply zoom-in and mathematically inverse zoom-out about the same focus. Canonical state returns exactly, modulo explicitly defined normalization.

### AT-CAM-002 — no binary64 authority leak
Property/static test verifies canonical camera update/serialization path does not convert exact center/scale to `number` and reconstruct authority from it.

### AT-CAM-003 — world key stability
Equivalent world regions reached through different pan/zoom histories yield identical canonical keys, including negative quadrants and boundary coordinates.

### AT-CAM-004 — bookmark round trip
Serialize -> reload -> serialize produces identical canonical state for fixtures spanning shallow through extreme exponents.

## Numerical

### AT-NUM-001 — no representational depth ceiling
Construct valid cameras at a sequence of exponents far beyond binary64 range (including at least thousands of decimal digits of magnification). Camera, planner, serialization, reference request, and oracle accept them without overflow/underflow-based loss. This does not require realtime convergence at all depths.

### AT-NUM-002 — provenance exhaustiveness
Every numerical output maps to a legal explicit provenance state; no default zero/colour value is interpreted as interior.

### AT-NUM-003 — iteration cap semantics
Known hard non-escaping-within-budget fixtures remain `unresolved` when no proof fires.

### AT-NUM-004 — direct differential
GPU direct method agrees with arbitrary-precision oracle for classification and declared channels over deterministic shallow/adversarial corpus.

### AT-NUM-005 — perturbation differential
GPU perturbation agrees with oracle over deterministic deep corpus; fixtures intentionally exceeding validity become unresolved rather than mismatching.

### AT-NUM-006 — reference transport
Transport/reconstruction error is measured/bounded for adversarial orbit values and is included in publication eligibility.

### AT-NUM-007 — boundary decision margin
Near-bailout fixtures with insufficient error margin remain unresolved/escalate. Increasing precision/work eventually resolves cases where mathematically decidable within test budget.

### AT-NUM-008 — escalation
Injected glitch/reference/approximation failures transition work to a stronger path without using provisional presentation data.

### AT-NUM-009 — semantic cross-hardware
NVIDIA and AMD reference runs produce matching authoritative classifications and bounded numerical channel differences for the frozen corpus.

## GPU lifecycle

### AT-GPU-001 — new request without drain
During long-running numerical work, issue rapid camera epochs. Interaction/presentation continues and new work is admitted without awaiting completion/readback of all old work.

### AT-GPU-002 — stale publication
Delay old-epoch completion so it finishes after new results. Accepted store never regresses to stale state.

### AT-GPU-003 — no critical readback wait
Browser trace/instrumentation shows no recurring awaited GPU map/readback in input/rAF scheduling path.

### AT-GPU-004 — bounded resources
Run a long exploratory trajectory. App-managed numerical/history/reference allocations remain under configured budgets and settle after eviction; world tile count cannot grow memory without bound.

### AT-GPU-005 — optional feature fallback
Disable each optional/experimental adapter capability in turn. Stable path remains numerically correct and usable.

## Presentation

### AT-PRES-001 — one-way provenance
Instrumentation verifies no presentation/history resource is bound to numerical recurrence/reference inputs.

### AT-PRES-002 — invalid history rejection
Construct pan/zoom transforms beyond configured geometric validity. History is discarded/replaced rather than stretched through invalid transform.

### AT-PRES-003 — monotonic replacement
When fresher accepted samples arrive, corresponding historical/provisional contribution disappears and cannot reappear from an older snapshot.

### AT-PRES-004 — provisional unresolved
Unresolved samples can be visually filled, but diagnostics and accepted numerical store remain unresolved.

## Interaction

### AT-UX-001 — focus preservation
During continuous zoom about a stationary pointer, the corresponding world focus remains within an explicit subpixel/error threshold in displayed transform over the test interval.

### AT-UX-002 — steering
Move pointer while hold-zooming; camera focus follows without discrete click steps or numerical-queue waits.

### AT-UX-003 — shell completeness
Automated smoke test covers coordinates/depth, palette, bookmark/share state, reset/home, and diagnostics.

## Shading

### AT-SHADE-001 — recolour without recurrence
Change palette/phase while numerical scheduling is frozen. Display changes immediately and accepted numerical state/checksums remain unchanged.

## Deployment

### AT-DEPLOY-001 — static/offline
Serve production assets with correct headers, load once, disable network, and continue navigating/calculating using already-loaded assets.

### AT-DEPLOY-002 — stable Chromium
Production build passes required test corpus on the declared current stable Chromium release with no flags/origin trials.

### AT-DEPLOY-003 — isolation
Production environment reports cross-origin isolation and shared-memory WASM worker pool starts successfully.

### AT-DEPLOY-004 — unsupported diagnostic
Missing WebGPU/required capability produces explicit user-visible diagnostics and no false “running” status.

## Performance

### AT-PERF-001 — sustained interaction
On each qualified midrange reference system, execute frozen continuous-zoom trajectories for the specified duration. Meet the frozen P95 frame-budget threshold; record P99, stalls, freshness, unresolved/conflict counts, numerical throughput, method mix, and memory.

### AT-PERF-002 — optimization workload equivalence
Before/after performance comparisons use identical camera trajectory, viewport, DPR, iteration/precision policy, feature set except the variable under test, duration, and admission policy. If work differs, normalize and explain.

### AT-PERF-003 — correctness-coupled performance
A performance candidate fails promotion if semantic conflicts/oracle mismatches increase beyond policy, regardless of throughput.
