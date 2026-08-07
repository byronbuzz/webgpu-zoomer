# UI / UX Contract

## Primary experience

The product should feel like navigating a mathematical place, not requesting a succession of rendered screenshots.

### Direct zoom

- Primary pointer press/hold: continuously zoom inward about current pointer focus.
- Inverse action (secondary button/modifier/configured gesture): continuously zoom outward about current pointer focus.
- Moving the pointer while held steers the zoom focus continuously.
- Release stops commanded zoom immediately; numerical convergence may continue.
- Focus preservation is a tested geometric property, not only a visual impression.

Exact input bindings may be refined, but the hold-to-zoom model is not optional.

## Responsiveness policy

Order of sacrifice under load:

1. reduce fresh numerical coverage rate;
2. reduce numerical detail/priority outside focus;
3. reduce history/snapshot quality or count;
4. simplify optional shading/diagnostics;
5. only if presentation geometry itself becomes invalid, constrain the visual transform.

Do not slow camera motion merely because the numerical queue is behind.

## Presentation states

The user-facing image may combine:

- **authoritative fresh** — accepted samples for current view;
- **authoritative reused** — accepted world samples still geometrically applicable;
- **historical estimate** — reprojected prior presentation;
- **provisional unresolved** — unresolved sample shown with a non-authoritative style.

Normal mode should not become visually noisy with debug overlays. Diagnostics mode exposes these distinctions.

## Thin shell

Required:

- full-window/primary canvas;
- coordinate and zoom/depth readout that does not lose exact state when copied/shared;
- current numerical mode/status summary;
- palette selection/phase controls;
- home/reset;
- bookmark current location;
- load bookmark/shareable state;
- diagnostics toggle.

Deferred:

- galleries/community;
- accounts/cloud sync;
- server rendering;
- mobile UX;
- elaborate theming;
- animation recording/export;
- broad formula editor;
- large palette authoring system.

## Accessibility

- Core controls have keyboard equivalents.
- UI controls are operable without holding a precision pointer gesture.
- Diagnostics text is selectable/copyable.
- Motion sensitivity control may reduce commanded zoom acceleration without changing numerical semantics.

## Visual acceptance

Presentation history must not produce persistent seams, frozen tiles, obvious repeating low-resolution smears, or old detail that remains after newer authoritative data exists. These are acceptance failures even if frame rate is high.
