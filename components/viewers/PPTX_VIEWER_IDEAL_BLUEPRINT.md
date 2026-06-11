# PPTX Viewer Ideal Blueprint

This is the target design for the ideal `PptxViewer`: everything needed,
nothing extra, with clear module boundaries and names that make the code read as
if there was only one possible way to write it.

The current implementation is robust enough to ship, but it is not the final
form. It mixes loading, parser adaptation, cache lifecycle, render scheduling,
toolbar state, slide layout, and React composition in one file. The ideal design
separates those concerns until each module has a single reason to exist.

## North Star

`PptxViewer` should be a small React shell around a presentation source:

```tsx
<PptxViewer src="/samples/deck.pptx" className="h-[600px]" />
```

The component should make these guarantees:

- The browser does all parsing and rendering.
- The viewer never keeps unbounded deck or bitmap memory.
- A stale render never mutates a current canvas.
- A failed slide never breaks the rest of the deck.
- Public props are controlled or uncontrolled in the usual React sense.
- Test hooks do not leak into the public UI module.
- Every helper lives at the abstraction level where it belongs.

## Public API

Keep the API boring and explicit:

```ts
export interface PptxViewerProps {
  src: string
  className?: string
  scale?: number
  defaultScale?: number
  onScaleChange?: (scale: number | null) => void
  toolbar?: boolean
  downloadFileName?: string
  renderSlideOverlay?: (props: PptxPageOverlayProps) => React.ReactNode
  /** @deprecated Use `renderSlideOverlay`. */
  renderPageOverlay?: (props: PptxPageOverlayProps) => React.ReactNode
  onVisiblePageChange?: (page: number) => void
  onScrollProgressChange?: (progress: number) => void
  bare?: boolean
  header?: React.ReactNode
  aside?: React.ReactNode
  eager?: boolean
}
```

Rules:

- `scale` is controlled.
- `defaultScale` is uncontrolled initial state.
- `scale={undefined}` means use internal state; internal `null` means fit width.
- `onScaleChange(null)` means fit width.
- Zoom controls are enabled when uncontrolled or when `onScaleChange` exists.
- `renderSlideOverlay` receives the visible rotated slide box.
- `renderPageOverlay` is a deprecated compatibility alias.
- If both overlay props are present, `renderSlideOverlay` wins.
- No prop exposes implementation details of `pptxviewjs`.

## File Layout

Split the current monolith into these files:

```txt
registry/new-york-v4/ui/pptx-viewer.tsx
registry/new-york-v4/ui/pptx-viewer-core.ts
registry/new-york-v4/ui/pptx-viewer-presentation.ts
registry/new-york-v4/ui/pptx-viewer-source.ts
registry/new-york-v4/ui/pptx-viewer-renderer.ts
registry/new-york-v4/ui/pptx-viewer-cache.ts
registry/new-york-v4/ui/pptx-viewer-hooks.ts
registry/new-york-v4/ui/pptx-viewer-scroll.ts
registry/new-york-v4/ui/pptx-viewer-viewport.ts
registry/new-york-v4/ui/pptx-viewer-visible-slide.ts
registry/new-york-v4/ui/pptx-viewer-zoom.ts
registry/new-york-v4/ui/pptx-viewer-toolbar.tsx
registry/new-york-v4/ui/pptx-viewer-slide.tsx
registry/new-york-v4/ui/pptx-viewer-fallback.tsx
registry/new-york-v4/ui/pptx-viewer-error-boundary.tsx
registry/new-york-v4/ui/pptx-viewer-test-utils.ts
```

Responsibilities:

- `pptx-viewer.tsx`: React UI only.
- `pptx-viewer-core.ts`: pure math and descriptor helpers.
- `pptx-viewer-presentation.ts`: browser XML parsing for presentation metadata.
- `pptx-viewer-renderer.ts`: adapter around `pptxviewjs` and `jszip`.
- `pptx-viewer-source.ts`: `PptxSource` creation and render queue.
- `pptx-viewer-cache.ts`: bounded LRU and disposal.
- `pptx-viewer-hooks.ts`: React ownership hooks.
- `pptx-viewer-scroll.ts`: scroll-idle scheduling.
- `pptx-viewer-viewport.ts`: viewport width measurement.
- `pptx-viewer-visible-slide.ts`: scroll progress and visible slide tracking.
- `pptx-viewer-zoom.ts`: controlled/uncontrolled zoom state.
- `pptx-viewer-toolbar.tsx`: toolbar and toolbar skeleton.
- `pptx-viewer-slide.tsx`: slide scroller, frame, canvas, and overlay.
- `pptx-viewer-fallback.tsx`: Suspense fallback.
- `pptx-viewer-error-boundary.tsx`: load failure boundary.
- `pptx-viewer-test-utils.ts`: cache reset and mocks used only by tests.

No React component should import test utilities. No cache module should import
React. No renderer adapter should import UI components.

## Naming

Use one vocabulary everywhere.

Preferred names:

- `source`: parsed deck plus render methods.
- `slideIndex`: zero-based index.
- `pageNumber`: one-based public display number.
- `baseSize`: intrinsic slide size in CSS pixels.
- `visibleSize`: rotated slide box in CSS pixels.
- `renderScale`: effective canvas render scale, including DPR.
- `zoomScale`: user-facing logical scale.
- `fitScale`: scale derived from container width.
- `zoomState`: `{ mode: "fit" }` or `{ mode: "manual"; value: number }`.
- `viewportWidth`: available width used to derive fit scale.
- `isLive`: callback used to ignore stale queued render attempts.
- `dispose`: release owned resources permanently.
- `retain` / `release`: mounted-viewer ownership.

Avoid names like `fixedScale`, `manualScale`, `cssW`, `boxW`, and `effScale`.
They are locally understandable but not Flaubertian: they make the reader hold
too much context.

## Core Module

`pptx-viewer-core.ts` should be pure and directly tested.

```ts
export const DEFAULT_PPTX_SLIDE_SIZE = {
  width: 960,
  height: 720,
} satisfies PptxSize

export interface PptxSize {
  width: number
  height: number
}

export function getPptxFitScale(
  containerWidth: number | null,
  baseWidth: number
): number
export function getPptxResetKey(input: PptxResetInput): string
export function getPptxBitmapCacheKey(input: PptxBitmapCacheInput): string
export function getScaledSlideSize(
  baseSize: PptxSize,
  zoomScale: number
): PptxSize
export function getVisibleSlideSize(
  slideSize: PptxSize,
  rotation: number
): PptxSize
export function getRotatedSize(size: PptxSize, rotation: number): PptxSize
```

Rules:

- All functions are deterministic.
- No dynamic imports.
- No `React`.
- No test-only branches.

## Presentation Module

`pptx-viewer-presentation.ts` owns browser parsing of PowerPoint metadata.

```ts
export function parsePptxSlideSize(
  xml: string | null | undefined,
  parseXml?: PptxXmlParser
): PptxSize
```

Rules:

- XML parsing uses `DOMParser`, not string-pattern matching.
- The XML parser is injectable for tests and non-browser hosts.
- Namespace prefixes and attribute order do not matter.
- Missing or invalid slide sizes fall back to `DEFAULT_PPTX_SLIDE_SIZE`.
- No React imports.

## Renderer Adapter

`pptx-viewer-renderer.ts` should be the only module that knows about
`pptxviewjs`.

```ts
export interface PptxRenderer {
  slideCount: number
  baseSize: PptxSize
  renderSlide(input: PptxRenderInput): Promise<void>
  dispose(): void
}
```

Adapter rules:

- Lazy-load `pptxviewjs` and `jszip`.
- Disable third-party delayed rerenders.
- Read slide size before constructing `PptxSource`.
- Wrap library errors in typed errors.
- Call `destroy()` on disposal when available.
- Do not expose the raw `PPTXViewer` instance.

Typed error shape:

```ts
export type PptxRendererErrorKind =
  | "fetch_failed"
  | "load_failed"
  | "render_failed"
  | "disposed"
```

## Source Module

`pptx-viewer-source.ts` owns render scheduling.

```ts
export interface PptxSource {
  slideCount: number
  baseSize: PptxSize
  renderSlide(input: PptxSourceRenderInput): Promise<PptxRenderResult>
  hasBitmap(input: PptxBitmapCacheInput): boolean
  retain(): PptxSourceRelease
  dispose(): void
}
```

Rules:

- Renders are serialized.
- Every queued render checks `isLive` before rendering, after rendering, and
  before caching.
- Cached redraws still honor liveness.
- Source disposal rejects future renders with `disposed`.
- Source disposal closes all bitmaps and disposes the renderer.

Return a result instead of encoding everything as exceptions:

```ts
export type PptxRenderResult =
  | { status: "rendered" }
  | { status: "cancelled" }
  | { status: "failed"; error: PptxRendererError }
```

## Cache Module

`pptx-viewer-cache.ts` should contain one generic disposable LRU.

```ts
export interface Disposable {
  dispose(): void
}

export class DisposableLruCache<K, V extends Disposable> {
  constructor(limit: number)
  get(key: K): V | undefined
  set(key: K, value: V): void
  delete(key: K): void
  clear(): void
}
```

Then wrap `ImageBitmap`:

```ts
export class PptxBitmapEntry implements Disposable {
  constructor(readonly bitmap: ImageBitmap) {}
  dispose() {
    this.bitmap.close()
  }
}
```

Rules:

- LRU owns disposal.
- Callers never close entries they have handed to the cache.
- Entries created after cancellation are closed immediately and never cached.

## React State

`pptx-viewer.tsx` should own only composition state:

- rotation

It should not own:

- raw parser instances
- bitmap maps
- source LRU implementation
- viewport measurement implementation
- visible slide detection implementation
- controlled/uncontrolled zoom state implementation
- XML parsing
- source retain/release wiring
- scroll-idle scheduling internals
- test cache resets

Zoom hook target:

```ts
type ZoomState = { mode: "fit" } | { mode: "manual"; value: number }
```

Rules:

- Controlled `scale` bypasses internal `ZoomState`.
- Uncontrolled zoom changes `ZoomState`.
- Fit width means `{ mode: "fit" }`.
- Displayed percent is always derived from the final resolved scale.

## Component Tree

Target tree:

```txt
PptxViewer
  PptxErrorBoundary
    PptxViewerContent
      PptxToolbar
      PptxBody
        aside
        PptxSlideScroller
          PptxSlideFrame
            PptxSlideCanvas
            PptxPageOverlay
```

Responsibilities:

- `PptxViewer`: client gate, Suspense, error boundary.
- `PptxViewerContent`: source lookup and high-level state.
- `PptxToolbar`: all toolbar rendering and events.
- `PptxSlideScroller`: scroll handling and visible-page reporting.
- `PptxSlideFrame`: size, rotation, and lazy in-view state.
- `PptxSlideCanvas`: canvas ref, render status, slide error UI.
- `PptxPageOverlay`: overlay coordinate contract.

## Error UI

Use two error levels.

Source error:

- Replaces the whole viewer body.
- Keeps outer chrome stable when possible.
- Includes download access.

Slide error:

- Replaces only the failed slide canvas.
- Keeps the slide box size unchanged.
- Does not prevent overlays on other slides.

Slide render state:

```ts
type SlideRenderState = "idle" | "rendering" | "rendered" | "failed"
```

## Tests

Use three test groups.

### Pure Tests

For `pptx-viewer-core.ts`:

- slide size parsing
- fallback slide size
- fit-scale clamping
- rotated size
- bitmap cache key
- reset key

### Source Tests

For `pptx-viewer-source.ts` and `pptx-viewer-cache.ts`:

- source LRU eviction disposes sources
- bitmap LRU closes old bitmaps
- rejected source loads are evicted
- cancelled renders do not cache bitmaps
- disposed sources reject future renders
- queued renders are serialized

### Component Tests

For `pptx-viewer.tsx`:

- Suspense fallback then loaded toolbar
- controlled scale update
- uncontrolled zoom update
- controlled `onScaleChange`
- fit width action
- per-slide error UI
- source error recovery on reset key change
- visible page callback
- scroll progress callback
- download link

Test-only cache reset belongs in `pptx-viewer-test-utils.ts`, not the public
viewer module.

## Migration Plan

1. Extract pure helpers into `pptx-viewer-core.ts`.
2. Move cache logic into `pptx-viewer-cache.ts`.
3. Move `pptxviewjs` and `jszip` loading into `pptx-viewer-renderer.ts`.
4. Move source lifecycle and render queue into `pptx-viewer-source.ts`.
5. Replace public test-only exports with `pptx-viewer-test-utils.ts`.
6. Rename ambiguous variables to the shared vocabulary.
7. Split React components inside `pptx-viewer.tsx`.
8. Update docs and registry artifacts.
9. Move tests to match the new modules.
10. Run focused tests before broad integration checks.

## Definition Of Done

The ideal implementation is done when:

- `pptx-viewer.tsx` is mostly React composition.
- Pure helpers can be read without knowing React or `pptxviewjs`.
- The renderer adapter can be replaced without touching UI code.
- Source lifecycle can be tested without jsdom.
- No test-only function is exported from the public viewer module.
- Every cached resource has one owner and one disposal path.
- Every variable name matches the shared vocabulary.
- The docs describe behavior, not implementation trivia.
- A reader can predict where any future change belongs.

## Non-Goals

- Do not build a PowerPoint editor.
- Do not make `pptxviewjs` pixel-perfect.
- Do not add server-side conversion here.
- Do not invent a generic document-viewer framework.
- Do not abstract before there are clear module boundaries.
