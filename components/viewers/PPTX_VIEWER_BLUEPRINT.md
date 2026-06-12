# PPTX Viewer Blueprint

This is the target design for hardening `PptxViewer`. The current component is
directionally good: it keeps PowerPoint rendering client-side, lazy-loads
`pptxviewjs`, renders slides only near the viewport, serializes canvas work, and
caches recent slide bitmaps. The remaining work is about making ownership of
async renders, memory, and props explicit enough to trust in long sessions.

## North Star

`PptxViewer` should be a reliable, client-only continuous-scroll presentation
viewer:

```tsx
<PptxViewer src="/samples/deck.pptx" className="h-[600px]" />
```

It should reserve correct slide boxes before rendering, render lazily without
blocking scroll, expose slide-level overlays for citations, and recover cleanly
when the source or viewer inputs change.

It should not promise pixel-perfect PowerPoint fidelity. If a caller needs exact
Office output, the recommended path remains server-side conversion to PDF plus
`PdfViewer`.

## Current Assessment

The implementation in `registry/new-york-v4/ui/pptx-viewer.tsx` has good
foundations:

- `pptxviewjs` and `jszip` are imported lazily on the client.
- React `use()` and Suspense make the deck resource stable.
- Slide dimensions are read from `ppt/presentation.xml`, so layout is reserved
  before the first slide renders.
- Slides mount lazily with `IntersectionObserver`.
- Heavy slide renders are serialized through a queue.
- Queued renders can be skipped when their slide has scrolled away.
- Recent rendered slides are cached as `ImageBitmap`s.
- Scroll-aware deferral keeps fast flings from competing with uncached renders.
- The toolbar supports slide count, zoom, fit width, rotate, and download.
- The API is slide-native through `renderSlideOverlay`,
  `onVisibleSlideChange`, and `onScrollProgressChange`.

It is not yet the final design.

Remaining concerns:

- `sourceCache` is unbounded and keeps deck processors plus bitmap caches alive
  for every unique URL.
- Cached `ImageBitmap`s are not closed when an entire deck source is evicted,
  because there is currently no source eviction.
- `pptxviewjs` schedules a delayed chart re-render by default. That re-render is
  outside this component's queue, cancellation, and bitmap-cache model.
- The `scale` prop is treated as initial state only. Parent updates do not affect
  the viewer after mount.
- Fit-width scale can become zero or negative in very narrow containers.
- Slide render failures are swallowed, leaving the slide skeleton visible
  indefinitely.
- The error boundary resets on `src` only, even though other inputs can affect
  the visible state.
- There are no focused regression tests for `PptxViewer`.

## Invariants

These rules should be true after hardening:

1. A render for one source, slide, scale, and rotation must never mutate another
   active view.
2. Every async render continuation must be cancellable or guarded by a live
   identity check.
3. Third-party delayed work must either be disabled or integrated into the
   component's own queue.
4. Every `ImageBitmap` created by the viewer must have a clear owner and must be
   closed on eviction.
5. Source-level caches must be bounded.
6. Cache keys must include every input that changes the bitmap output.
7. Prop names must match behavior. Controlled props should update after mount;
   initial-only props should say so.
8. Fit-width must always resolve to a finite positive scale.
9. A single slide render failure must not break the whole deck, but it must leave
   visible error UI for that slide.
10. Error boundaries must recover when the source identity or render-affecting
    inputs change.

## Public API

Keep the API narrow and slide-native:

```ts
export interface PptxViewerProps {
  src: string
  className?: string
  scale?: number
  toolbar?: boolean
  downloadFileName?: string
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  onVisibleSlideChange?: (slide: number) => void
  onScrollProgressChange?: (progress: number) => void
  bare?: boolean
  header?: React.ReactNode
  aside?: React.ReactNode
  eager?: boolean
}
```

Rules:

- `src` is the deck identity.
- `scale` should be either a controlled scale or renamed to `initialScale`.
- `renderSlideOverlay` receives final rendered slide-box dimensions, including
  rotation.
- `header` and `aside` are layout slots only; they should not change parsing or
  render semantics.
- `eager` only changes render scheduling. It must not change which slides render
  or how they are cached.

## Source Lifecycle

Replace the unbounded source cache with a small LRU.

Target shape:

```ts
interface PptxSource {
  slideCount: number
  baseWidth: number
  baseHeight: number
  render(...): Promise<void>
  hasCached(index: number, scale: number): boolean
  dispose(): void
}
```

Rules:

- Keep a source cache cap, for example `PPTX_SOURCE_CACHE_MAX = 4`.
- Evict least-recently-used sources.
- `dispose()` closes every cached `ImageBitmap`.
- If `pptxviewjs` exposes a `destroy()` method on the viewer, call it from
  `dispose()`.
- Failed source promises should not poison the cache forever. Either evict on
  rejection or cache failures only briefly.

## Render Ownership

All slide rendering should flow through the component's queue.

Rules:

- Construct `PPTXViewer` with delayed automatic chart rerenders disabled if the
  library supports it:

```ts
new PPTXViewer({
  canvas: offscreen,
  slideSizeMode: "actual",
  autoChartRerenderDelayMs: 0,
})
```

- If charts need a second pass, schedule that pass explicitly through
  `PptxSource.render`.
- Do not let third-party timers mutate a canvas after the slide unmounts.
- Include a render generation in each request so stale queued work can bail
  before and after the third-party render.
- Cache only after confirming the render is still live.

## Bitmap Cache

The current per-source bitmap cache is the right idea, but ownership should be
more explicit.

Rules:

- Cache key includes slide index and effective render scale.
- If rotation ever changes the rendered bitmap instead of CSS transform only,
  include rotation in the key.
- Close the evicted bitmap immediately.
- Close all remaining bitmaps on source disposal.
- Avoid caching canvases that rendered a known error placeholder.

## Scale Semantics

Choose one of two valid designs.

### Controlled Scale

`scale` is controlled by the parent:

- `scale={undefined}` means fit width.
- A numeric `scale` always wins over internal zoom state.
- Zoom buttons call `onScaleChange`, if added, or switch to internal state only
  when uncontrolled.

### Initial Scale

`initialScale` seeds internal zoom state:

- Rename the prop from `scale` to `initialScale`.
- Keep the current `manualScale` behavior.
- Document that later prop changes do not affect the viewer.

Prefer controlled scale if this viewer is expected to sync with thumbnails,
split panes, or shared viewer chrome. Prefer `initialScale` if the component
should remain standalone.

Fit-width must be clamped in either model:

```ts
const fitScale = clamp((containerWidth - 32) / baseWidth, 0.1, 5)
```

## Error States

The viewer should distinguish source errors from slide errors.

Source errors:

- Fetch failure
- Invalid zip
- Missing or unreadable presentation
- `pptxviewjs` load failure

Render as the existing whole-viewer error boundary.

Slide errors:

- A single slide render throws.
- A queued render completes with a known error placeholder.
- `createImageBitmap` fails after a successful render.

Render a per-slide error panel inside the slide box, with the deck still
scrollable.

## Overlay Semantics

`renderSlideOverlay` receives the visible slide box:

```ts
export interface PptxSlideOverlayProps {
  slideNumber: number
  width: number
  height: number
  scale: number
  rotation: number
}
```

Rules:

- Coordinates are relative to the rotated visible box.
- Normalized overlays can use percentages.
- The overlay container stays `pointer-events-none` by default.
- If interactive overlays are added later, make that an explicit prop rather
  than changing the default behavior.

## Tests

Add focused tests before broad browser work.

### Pure Tests

Create tests for:

- parsing slide size from `presentation.xml`
- default slide size fallback
- source cache LRU eviction
- bitmap cache eviction closing old bitmaps
- fit-width clamp for narrow containers
- reset key generation

### Component Tests

Use mocked `pptxviewjs` and `jszip` modules.

Test:

- the viewer lazy-loads and renders slide chrome after Suspense
- `src` changes recover from a previous error
- prop scale behavior matches the chosen controlled or initial-only design
- a single slide render failure shows per-slide error UI
- unmounted slides do not set rendered state after cancellation
- `onVisibleSlideChange` and `onScrollProgressChange` fire from scroll events
- download uses `downloadFileName`

### Browser Verification

Use the docs demo sample decks.

Verify:

- first slide renders without console errors
- fast scrolling does not freeze the page
- scroll-back redraws cached slides quickly
- zoom in, zoom out, fit width, and rotate keep the slide centered
- narrow containers keep toolbar controls accessible
- overlays remain aligned at 100%, zoomed, and rotated states
- repeated navigation across several different PPTX URLs does not grow memory
  without bound

## Implementation Plan

1. Add `dispose()` to `PptxSource` and close all cached bitmaps there.
2. Replace `sourceCache` with a bounded LRU and call `dispose()` on eviction.
3. Evict rejected source promises so transient failures can recover.
4. Disable `pptxviewjs` automatic delayed chart rerenders, or route any second
   pass through the component's render queue.
5. Decide whether `scale` is controlled or initial-only, then update the API,
   implementation, docs, and registry JSON together.
6. Clamp fit-width scale.
7. Add per-slide render error state.
8. Expand the error-boundary reset key to include render-affecting inputs.
9. Add unit tests for source/cache utilities.
10. Add mocked component tests for source changes, slide errors, and prop
    semantics.
11. Run browser verification on `/docs/viewers/pptx-viewer` and the file-viewer
    PPTX path.

## Non-Goals

- Do not build a PowerPoint editor.
- Do not add server-side conversion to this component.
- Do not claim pixel-perfect fidelity for complex Office features.
- Do not move generic `FileViewer` chrome into `PptxViewer`.
- Do not optimize every possible deck size before source ownership and render
  correctness are nailed down.
