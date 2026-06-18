# PDF Viewer Render Performance Blueprint

## Ideal

The PDF viewer should keep its current geometry-first architecture and make the
expensive work proportional to the pages the user can actually see.

The target is not a new virtualizer. The target is a sharper render pipeline:

- scroll math decides the page slots;
- page metadata loads ahead with bounded concurrency;
- canvas rendering is prioritized, capped, and cancellable;
- high-DPI raster work happens only when it improves the visible result;
- benchmark evidence measures finished page paint, not just mounted DOM.

## Current Shape

The main page surface is already structurally sound.

Relevant files:

- `registry/new-york-v4/ui/pdf-viewer-content.tsx`
- `registry/new-york-v4/ui/pdf-viewer-layout.ts`
- `registry/new-york-v4/ui/pdf-viewer-virtualization.ts`
- `registry/new-york-v4/ui/pdf-viewer-scroll.ts`
- `registry/new-york-v4/ui/pdf-viewer-page.tsx`
- `registry/new-york-v4/lib/pdf-document-resource.ts`
- `app/(view)/pdf-viewer-benchmark/pdf-viewer-benchmark-client.tsx`

What is already right:

- `createPdfPageLayout` builds deterministic page geometry.
- `findPdfPageByOffset` and `getPdfVisiblePageNumbers` use layout math.
- scroll work is coalesced through `requestAnimationFrame`.
- only the visible page window is mounted.
- document and page proxies are cached.
- render tasks are cancelled on source, zoom, and unmount.

The remaining cost is not mostly React chrome. It is PDF.js page loading,
canvas rasterization, high-DPI pixel volume, and benchmark blind spots.

## Non-Goals

- Do not replace PDF.js.
- Do not replace the page layout model with a generic virtualizer.
- Do not apply grid row patching to PDF pages.
- Do not change the public viewer composition API unless profiling proves a
  context split is necessary.
- Do not optimize thumbnails before main-page render evidence shows they are
  material.

## Problems

### 1. Overscan Pages Render Too Eagerly

`getPdfVisiblePageNumbers` returns an overscanned page window. `PdfDocumentPagesLayer`
maps every page in that window to `PdfPage`, and `PdfPage` starts `page.render`
as soon as its canvas ref attaches.

That means overscan is not just a lightweight DOM placeholder. It is immediate
PDF.js raster work.

Fast scroll and large jumps can therefore produce:

- multiple render tasks for pages the user never sees;
- frequent task cancellation;
- visible page work competing with near-page work;
- large temporary canvas allocations.

### 2. Main Canvases Use Full Device Pixel Ratio

Thumbnails cap their DPR at `1`. Main pages use the full
`window.devicePixelRatio`.

On high-DPI displays, each page can cost 4x to 9x the pixels of a CSS-size
canvas. A few visible pages can become tens of megapixels of raster work.

### 3. Page Size Metadata Is Learned Late

The main layout starts from the first page size. Other exact page sizes are
reported only after each mounted `PdfPage` resolves its page proxy.

For mixed-size PDFs, this means the viewer discovers layout corrections while
scrolling and rendering. It also couples layout precision to canvas visibility.

### 4. Some Scroll Paths Still Read Layout

`measureScroll` reads `getBoundingClientRect()` for viewport height every scroll
frame. `scrollToPageArea` uses DOM query and rect math for horizontal area
alignment.

These are smaller costs than canvas rendering, but they are avoidable because
the layout model already owns the geometry.

### 5. Benchmark Measures DOM Existence, Not Paint Completion

The benchmark resolves when the target page slot is mounted and any canvas
exists. It does not prove the target page's PDF.js render task completed.

This makes performance changes hard to judge and can reward earlier DOM mount
without faster page paint.

## Target Architecture

### Page Windows

Split the single visible page list into three related ranges.

```ts
type PdfPageWindow = {
  slotPageNumbers: readonly number[]
  renderPageNumbers: readonly number[]
  preloadPageNumbers: readonly number[]
}
```

Rules:

- `slotPageNumbers` keeps today's overscanned placeholders and page shells.
- `renderPageNumbers` starts with actually visible pages, then near-visible
  pages in scroll direction.
- `preloadPageNumbers` requests page proxies and dimensions only.
- `renderPageNumbers` is always a subset of `slotPageNumbers`.
- `preloadPageNumbers` may extend beyond `slotPageNumbers`, but only through
  bounded async work.

The first page visible at the reading marker and the current jump target always
receive highest render priority.

### Canvas Render Budget

Move immediate canvas rendering behind a tiny scheduler.

```ts
type PdfPageRenderPriority = {
  pageNumber: number
  distanceFromViewport: number
  isCurrentPage: boolean
  isJumpTarget: boolean
}

type PdfRenderBudgetState = {
  maxRunning: number
  runningPageNumbers: ReadonlySet<number>
  queuedPageNumbers: readonly number[]
}
```

Rules:

- visible pages start before overscan pages;
- the current page starts before adjacent pages;
- jump targets start before background prefetch;
- no more than `PDF_PAGE_RENDER_CONCURRENCY` tasks run at once;
- scale, rotation, DPR, document, or page change invalidates stale work;
- unmounted pages release queue slots and cancel active tasks;
- render errors still throw to the existing viewer error boundary.

Implementation shape:

- keep page proxy access in `PdfPage`;
- extract render-task lifecycle into `usePdfPageRenderTask`;
- introduce a local `PdfPageRenderBudgetProvider` inside `PdfViewerInner`;
- have each page request permission to render its canvas;
- show the existing skeleton or an empty white page shell until permission is
  granted.

This keeps PDF.js canvas ownership local to the page while centralizing
priority and concurrency.

### DPR Policy

Add a single helper for main-page raster scale.

```ts
type PdfPageDprMode = "scrolling" | "settled"

function getPdfPageDevicePixelRatio({
  devicePixelRatio,
  mode,
}: {
  devicePixelRatio: number
  mode: PdfPageDprMode
}) {
  return Math.min(
    devicePixelRatio,
    mode === "scrolling"
      ? PDF_PAGE_SCROLLING_MAX_DEVICE_PIXEL_RATIO
      : PDF_PAGE_SETTLED_MAX_DEVICE_PIXEL_RATIO
  )
}
```

Initial constants:

```ts
const PDF_PAGE_SCROLLING_MAX_DEVICE_PIXEL_RATIO = 1
const PDF_PAGE_SETTLED_MAX_DEVICE_PIXEL_RATIO = 2
```

Rules:

- while the viewport is actively scrolling, render visible pages at the
  scrolling DPR cap;
- after scroll idle, upgrade the still-visible pages to the settled DPR cap;
- never upgrade pages that are no longer visible;
- changing DPR cancels the stale task through the existing render cleanup;
- thumbnails keep their separate DPR policy.

If the two-pass behavior feels too complex on the first cut, ship the settled
cap first and defer scroll-idle upgrades.

### Page Metrics

Create a generic main-page metric loader rather than discovering dimensions
only through mounted canvases.

```ts
type PdfPageMetric = {
  pageNumber: number
  width: number
  height: number
  rotation: number
}

type PdfPageMetrics = {
  metricByPageNumber: ReadonlyMap<number, PdfPageMetric>
  requestPageMetrics: (pageNumbers: Iterable<number>) => void
  status: "idle" | "loading"
}
```

Rules:

- use `getPdfPageResource`, not canvas rendering;
- request current, visible, adjacent, and jump-target pages first;
- bound concurrency separately from canvas render concurrency;
- dedupe loaded, queued, and loading pages;
- ignore stale completions after document switch;
- keep immutable map snapshots;
- throw errors through the existing viewer boundary.

The hook can be modeled after `usePdfThumbnailPageMetrics`, but it should live
with the main PDF viewer primitives and use names that describe page metrics,
not thumbnails.

### Scroll Geometry Cleanup

Replace avoidable DOM geometry reads:

- use `viewportElement.clientHeight` in `measureScroll`;
- keep `getBoundingClientRect()` only as a fallback if a real bug requires it;
- compute horizontal area scrolling from `layout.maxPageWidth`, page width, and
  current scroll state instead of querying `[data-slot="pdf-page-slot"]`.

This is not the biggest win, but it removes work from the scroll path and makes
the model more complete.

### Context Churn

Only do this if profiling shows page-change React commits are material.

Current provider state includes `currentPage`, `resource`, and `viewerHandle` in
one context value. A page change therefore invalidates all consumers, including
the page surface consumer.

Possible fix:

- split resource/handle setters into one stable context;
- put current-page state in a separate context consumed by thumbnails and
  controls;
- memoize `PdfDocumentPagesLayer` and `PdfPage` after the split.

This is lower priority than raster work because current-page changes happen per
page boundary, not every wheel event.

## Benchmark Plan

Extend the benchmark before judging performance changes.

Add render timing from `PdfPage`:

```ts
type PdfPageRenderTiming = {
  pageNumber: number
  scale: number
  rotation: number
  devicePixelRatio: number
  status: "rendered" | "cancelled" | "failed"
  durationMs: number
}
```

Expose it through an internal benchmark-only callback or a stable optional prop
if other viewers can use it.

Benchmark scenarios:

- first visible page rendered after initial load;
- jump to page 50, 200, 400, and 585;
- fast scroll from top to bottom;
- zoom in while a render is in flight;
- high-DPI run with DPR 2 or simulated DPR 2.

Captured fields:

- target page render duration;
- total render tasks started;
- cancelled render task count;
- mounted slot count;
- active canvas count;
- effective DPR;
- max canvas pixel dimensions;
- scroll frame p50, p95, and max.

The existing benchmark should stop resolving on "any canvas exists" and wait
for the target page render event.

## Implementation Plan

## Implemented State

Implemented on 2026-06-18:

- `PdfPageRenderTiming` is now emitted for rendered, cancelled, and failed page
  render tasks.
- The benchmark waits for the target page render event instead of resolving
  when any canvas exists.
- Main page DPR is capped through `getPdfPageDevicePixelRatio`, with a settled
  cap of `2` and a scrolling cap constant of `1`.
- Virtualization now exposes separate slot, render, and preload page windows.
- Overscan slots outside the active render window show the existing skeleton and
  do not start canvas rendering.
- `usePdfPageRenderScheduler` gates page canvas work with a concurrency budget
  of `2`.
- `usePdfPageMetrics` preloads exact page dimensions with bounded concurrency
  and feeds them into the main layout.
- Scroll measurement now uses `clientHeight`, and `scrollToPageArea` computes
  horizontal alignment from layout geometry.
- The PDF viewer registry metadata and generated `public/r/pdf-viewer.json`
  include the new helper modules.

Deferred:

- Scroll-idle DPR upgrade from `1` to `2`. The first implementation ships the
  settled cap everywhere because it is simpler, deterministic, and already
  bounds high-DPI pixel volume.
- Context splitting. The raster, metric, and scroll-path work addresses the
  highest-cost path first; context splitting should wait for profile evidence.

### Phase 1: Make Measurement Honest

1. Add `PdfPageRenderTiming`.
2. Report render completion, cancellation, and failure from `PdfPage`.
3. Update `app/(view)/pdf-viewer-benchmark` to wait for the target page render.
4. Save before numbers for the 585-page sample.

### Phase 2: Cap Pixel Work

1. Add main-page DPR policy.
2. Cap settled DPR to `2`.
3. Optionally cap active-scroll DPR to `1`.
4. Verify visual quality at 100%, 120%, and fit width.
5. Record benchmark deltas.

### Phase 3: Separate Slot And Render Windows

1. Keep `slotPageNumbers` equivalent to today's `visiblePageNumbers`.
2. Add `renderPageNumbers` for the actual visible range.
3. Render skeleton/page shell for slot pages outside `renderPageNumbers`.
4. Add tests proving overscan pages can mount without starting canvas renders.
5. Record jump and fast-scroll deltas.

### Phase 4: Add Render Budget

1. Add `PdfPageRenderBudgetProvider`.
2. Gate `page.render` behind priority and concurrency.
3. Prioritize current and jump-target pages.
4. Cancel stale queued and running work on scale, rotation, document, and
   unmount.
5. Record cancellation-rate deltas.

### Phase 5: Preload Metrics

1. Add `usePdfPageMetrics`.
2. Feed exact metrics into `usePdfPageSizes`.
3. Request metrics for visible, adjacent, and jump-target pages.
4. Keep concurrency bounded.
5. Verify mixed-size PDFs preserve scroll anchors.

### Phase 6: Clean Scroll Geometry

1. Replace viewport rect height reads with `clientHeight`.
2. Compute horizontal target scrolling from layout math.
3. Keep tests for normalized page-area scrolling.

### Phase 7: Context Split If Needed

1. Profile current-page commits after phases 1-6.
2. Split contexts only if page-surface rerenders remain visible in profiles.
3. Keep public `PdfViewerProvider`, `PdfViewerPages`, and thumbnails API intact.

## Required Tests

Unit and integration tests:

- render timing reports `rendered` with page, scale, rotation, DPR, and duration;
- render timing reports `cancelled` when scale changes;
- render timing reports `cancelled` when a page unmounts;
- render timing reports `failed` before throwing render errors;
- DPR helper clamps invalid and high values;
- active-scroll DPR and settled DPR produce different canvas pixel sizes;
- slot pages outside `renderPageNumbers` do not call `page.render`;
- current page renders before overscan pages;
- render concurrency never exceeds the configured limit;
- queued render work is dropped after document switch;
- page metrics dedupe loaded, queued, and loading pages;
- page metrics ignore stale completions after document switch;
- mixed-size PDFs keep scroll anchor after metrics resolve;
- `scrollToPageArea` still aligns vertical and horizontal targets.

Browser checks:

- initial first-page render on `big-911-report.pdf`;
- jump to pages 50, 200, 400, and 585;
- fast scroll does not start unbounded render tasks;
- high-DPI canvas dimensions are capped;
- thumbnails still follow current page;
- overlays still align after zoom and rotation.

## Success Bar

The work is complete when:

- the main PDF viewer still uses math-based page virtualization;
- overscan no longer implies immediate canvas rasterization;
- visible pages render before near-visible pages;
- high-DPI pixel work is bounded;
- page-size precision is not coupled to canvas visibility;
- fast scroll starts fewer render tasks and cancels fewer tasks;
- jump-to-page benchmark waits for the target page to finish rendering;
- mixed-size, rotated, overlay, thumbnail, zoom, and source-switch behavior stay
  covered by tests.

## Recommended First Cut

Do phases 1 through 3 first:

1. make benchmark timing honest;
2. cap main-page DPR;
3. separate slot pages from render pages.

Those changes should produce measurable speedups with limited API surface and
without committing to the full render scheduler until the benchmark proves it is
needed.
