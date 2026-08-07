# Requirements

Status values: **accepted**, **assumed**, **research**, **deferred**.

## Product and interaction

### FR-PROD-001
- **Statement:** The product shall be a self-contained static web Mandelbrot explorer requiring no backend service for correctness or operation.
- **Type:** constraint
- **Priority:** P0
- **Source:** H-2026-08-08
- **Observable evidence:** successful offline-after-load run on a correctly hosted production build.
- **Acceptance:** `AT-DEPLOY-001`.
- **Status:** accepted

### FR-UX-001
- **Statement:** Pointer press/hold shall continuously zoom toward the pointer focus; the inverse action shall continuously zoom outward, with steering during motion.
- **Type:** functional
- **Priority:** P0
- **Source:** H-2026-08-08
- **Observable evidence:** deterministic browser interaction trace and focus-error measurement.
- **Acceptance:** `AT-UX-001`, `AT-UX-002`.
- **Status:** accepted

### FR-UX-002
- **Statement:** Interaction/presentation shall target the active display cadence; numerical backlog shall reduce freshness/detail before it suppresses camera responsiveness.
- **Type:** quality
- **Priority:** P0
- **Source:** H-2026-08-08
- **Observable evidence:** frame timing and input-to-presentation telemetry during sustained zoom trajectories.
- **Acceptance:** `AT-PERF-001`.
- **Status:** accepted

### FR-UX-003
- **Statement:** The initial product shell shall provide essential coordinate/depth/status display, palette selection, bookmarks/shareable state, reset/home, and diagnostics without broad non-core features.
- **Type:** functional
- **Priority:** P1
- **Source:** H-2026-08-08
- **Acceptance:** `AT-UX-003`.
- **Status:** accepted

## Camera and world

### FR-CAM-001
- **Statement:** Authoritative camera center and scale shall remain exactly representable at arbitrary practical depth and shall not be rounded through binary64 during canonical state updates.
- **Type:** quality
- **Priority:** P0
- **Source:** legacy surviving principle + H-2026-08-08 no-ceiling decision
- **Acceptance:** `AT-CAM-001`, `AT-CAM-002`.
- **Status:** accepted

### FR-CAM-002
- **Statement:** World sample/tile identity shall be canonical and stable under pan/zoom history; negative coordinates shall use mathematically correct floor semantics.
- **Type:** quality
- **Priority:** P0
- **Source:** surviving v1.4 architecture
- **Acceptance:** `AT-CAM-003`.
- **Status:** accepted

### FR-CAM-003
- **Statement:** Shareable state/bookmarks shall round-trip authoritative coordinates and scale without precision loss.
- **Type:** functional
- **Priority:** P1
- **Source:** thin product shell + exact camera
- **Acceptance:** `AT-CAM-004`.
- **Status:** accepted

## Numerical authority

### FR-NUM-001
- **Statement:** The renderer shall have no hardcoded mathematical magnification ceiling. Precision, exponent representation, reference generation, and work cost shall scale with requested coordinates and error needs.
- **Type:** quality
- **Priority:** P0
- **Source:** H-2026-08-08
- **Acceptance:** `AT-NUM-001`.
- **Status:** accepted

### FR-NUM-002
- **Statement:** Every authoritative sample shall carry semantic provenance sufficient to distinguish at least `escaped`, `certified_interior`, and `unresolved`, plus invalid/error conditions used internally.
- **Type:** functional
- **Priority:** P0
- **Source:** H-2026-08-08 + legacy provenance work
- **Acceptance:** `AT-NUM-002`.
- **Status:** accepted

### FR-NUM-003
- **Statement:** Reaching an iteration/work cap shall never by itself produce `certified_interior`.
- **Type:** invariant
- **Priority:** P0
- **Source:** H-2026-08-08
- **Acceptance:** `AT-NUM-003`.
- **Status:** accepted

### FR-NUM-004
- **Statement:** An approximate GPU result may be published as authoritative only when its reference, coordinate transport, recurrence, scaling/rebasing, escape decision, and approximation validity conditions are satisfied within a declared conservative error budget.
- **Type:** quality
- **Priority:** P0
- **Source:** H-2026-08-08
- **Acceptance:** `AT-NUM-004` through `AT-NUM-007`.
- **Status:** accepted

### FR-NUM-005
- **Statement:** A stronger computation path shall be able to consume `unresolved` work without treating its provisional colour as input evidence.
- **Type:** functional
- **Priority:** P0
- **Acceptance:** `AT-NUM-008`.
- **Status:** accepted

### FR-NUM-006
- **Statement:** Independent supported machines may differ in intermediate floating-point values and final colour pixels, but authoritative semantic classifications and numerical observables shall agree within declared bounds.
- **Type:** quality
- **Priority:** P0
- **Source:** H-2026-08-08
- **Acceptance:** `AT-NUM-009`.
- **Status:** accepted

### FR-NUM-007
- **Statement:** A browser-side arbitrary-precision authority/reference implementation shall exist independently of WebGPU shader arithmetic.
- **Type:** constraint
- **Priority:** P0
- **Source:** fully-client-side + conservative correctness
- **Acceptance:** oracle fixture suite and differential tests.
- **Status:** accepted

## GPU convergence and resources

### FR-GPU-001
- **Statement:** Numerical work shall be resumable and cancellable by version/epoch without draining the GPU queue to begin a newer camera request.
- **Type:** quality
- **Priority:** P0
- **Source:** surviving v1.4 principle + continuous interaction goal
- **Acceptance:** `AT-GPU-001`.
- **Status:** accepted

### FR-GPU-002
- **Statement:** Stale work shall never overwrite newer authoritative state.
- **Type:** invariant
- **Priority:** P0
- **Acceptance:** `AT-GPU-002`.
- **Status:** accepted

### FR-GPU-003
- **Statement:** The production scheduling path shall not require synchronous or awaited per-batch GPU-to-CPU readback in the interaction-critical loop.
- **Type:** quality
- **Priority:** P0
- **Source:** legacy bottleneck finding
- **Acceptance:** architecture inspection + browser trace `AT-GPU-003`.
- **Status:** accepted

### FR-GPU-004
- **Statement:** Numerical storage shall use bounded pooled/packed resources rather than an unbounded collection of large per-tile textures/buffers.
- **Type:** quality
- **Priority:** P0
- **Source:** legacy resource finding
- **Acceptance:** resource telemetry `AT-GPU-004`.
- **Status:** accepted

### FR-GPU-005
- **Statement:** Candidate GPU acceleration mechanisms shall have a stable baseline path and capability-detected optimized paths; optional features are not assumed.
- **Type:** constraint
- **Priority:** P0
- **Source:** H-2026-08-08
- **Acceptance:** `AT-GPU-005`.
- **Status:** accepted

## Presentation

### FR-PRES-001
- **Statement:** Presentation history and numerical truth shall be distinct stores with one-way flow from accepted numerical state to presentation snapshots.
- **Type:** invariant
- **Priority:** P0
- **Source:** H-2026-08-08 + surviving legacy principle
- **Acceptance:** `AT-PRES-001`.
- **Status:** accepted

### FR-PRES-002
- **Statement:** Historical imagery may be reprojected only while its transform is finite and geometrically valid for the current camera; invalid history shall be dropped rather than stretched arbitrarily.
- **Type:** quality
- **Priority:** P0
- **Acceptance:** `AT-PRES-002`.
- **Status:** accepted

### FR-PRES-003
- **Statement:** Fresh accepted samples shall monotonically supersede older presentation estimates for the same visible region.
- **Type:** quality
- **Priority:** P0
- **Acceptance:** `AT-PRES-003`.
- **Status:** accepted

### FR-PRES-004
- **Statement:** `unresolved` samples may receive provisional interior-like presentation without altering provenance.
- **Type:** functional
- **Priority:** P1
- **Source:** H-2026-08-08
- **Acceptance:** `AT-PRES-004`.
- **Status:** accepted

## Formula and shading boundaries

### FR-FORM-001
- **Statement:** Mandelbrot may be highly specialized, but formula recurrence/reference generation/bailout/analytic proofs/result-channel production shall cross explicit interfaces so additional formulas do not require rewriting camera, scheduling, presentation, or product shell.
- **Type:** quality
- **Priority:** P1
- **Source:** H-2026-08-08
- **Acceptance:** interface inspection + dummy second-formula contract test.
- **Status:** accepted

### FR-SHADE-001
- **Statement:** Convergence shall emit stable result channels independent of palette choice; recolouring shall not trigger numerical recomputation.
- **Type:** quality
- **Priority:** P1
- **Source:** H-2026-08-08
- **Acceptance:** `AT-SHADE-001`.
- **Status:** accepted

## Runtime/deployment

### FR-PLAT-001
- **Statement:** Production shall run on current stable Chromium/WebGPU without browser flags.
- **Type:** constraint
- **Priority:** P0
- **Source:** H-2026-08-08
- **Acceptance:** `AT-DEPLOY-002`.
- **Status:** accepted

### FR-PLAT-002
- **Statement:** Cross-origin isolation shall be a deployment requirement and shall be verified at runtime before enabling the shared-memory numerical worker pool.
- **Type:** constraint
- **Priority:** P0
- **Source:** H-2026-08-08
- **Acceptance:** `AT-DEPLOY-003`.
- **Status:** accepted

### FR-PLAT-003
- **Statement:** Unsupported/missing WebGPU or required production capabilities shall fail explicitly with diagnostics rather than silently switch to a materially different renderer.
- **Type:** functional
- **Priority:** P1
- **Acceptance:** `AT-DEPLOY-004`.
- **Status:** accepted

## Performance and evidence

### FR-PERF-001
- **Statement:** On qualified midrange reference hardware, presentation during benchmark continuous-zoom trajectories shall meet the current display frame budget at P95, with no repeated long interaction stalls; exact numeric thresholds are calibrated and frozen before first performance release.
- **Type:** quality
- **Priority:** P0
- **Source:** H-2026-08-08
- **Acceptance:** `AT-PERF-001`.
- **Status:** accepted

### FR-PERF-002
- **Statement:** Performance shall be reported with scene, trajectory, viewport, DPR, iteration policy, precision method, browser version, OS, adapter, driver, feature set, duration, memory telemetry, and work counters.
- **Type:** operational
- **Priority:** P0
- **Acceptance:** schema validation.
- **Status:** accepted

### FR-PERF-003
- **Statement:** A performance optimization cannot be accepted if it increases semantic conflicts, unresolved rate beyond the declared policy, or oracle mismatches.
- **Type:** invariant
- **Priority:** P0
- **Acceptance:** combined benchmark/correctness gate.
- **Status:** accepted
