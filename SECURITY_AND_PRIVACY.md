# Security and Privacy

## Deployment boundary

The application is fully client-side and static. No backend is part of the required architecture.

## Cross-origin isolation

Production hosting must deliver headers/configuration sufficient for a cross-origin-isolated context and verify `crossOriginIsolated` at runtime before starting the shared-memory WASM worker pool.

If isolation is missing, production should present a clear unsupported-deployment diagnostic. Do not silently fall back to a materially different unthreaded product and claim normal acceptance.

## Network policy

After the application and its static assets are loaded, fractal calculation must require no network access.

Any future:

- telemetry upload,
- shared bookmark service,
- crash reporting,
- analytics,
- remote orbit cache,
- account system

is a product-boundary change requiring explicit human approval and updates to this document.

## Third-party assets

Prefer self-hosted build artefacts. Cross-origin embedded assets complicate isolation and should be avoided unless necessary and explicitly configured.

## WASM/native dependencies

- pin versions and checksums in the lockfile/build;
- record licenses;
- run dependency/security audit appropriate to Rust and JS ecosystems;
- avoid dynamic code download;
- no secrets are needed by the runtime.

## Browser data

Bookmarks/settings may use local storage/IndexedDB if useful. Store no sensitive personal data. Shareable URLs must contain only explicit fractal state/configuration, never device identifiers or hidden telemetry.

## Denial-of-service / resource safety

User input can request extreme depth or iteration work. Treat that as ordinary product use, but enforce bounded:

- worker count;
- WASM memory;
- GPU resident memory;
- queue size;
- per-frame scheduling budget;
- history/reference caches.

“Arbitrary depth” does not mean unbounded immediate allocation.

## Experimental path

Experimental browser capabilities must be explicitly labeled in diagnostics and disabled by default in production acceptance unless promoted by decision record.
