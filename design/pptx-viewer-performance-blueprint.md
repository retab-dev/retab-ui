# PPTX Viewer Performance Blueprint

## Purpose

Make the PPTX viewer faster without changing its product contract.

The viewer should remain a client-side, canvas-backed PowerPoint viewer with:

- continuous scroll;
- fit-width and manual zoom;
- rotation;
- download;
- per-slide overlays;
- bounded mounted slide shells;
- cached rendered bitmaps;
- contained slide-level failures.

The remaining performance work is not basic virtualization. The current
implementation already has math-based current-slide tracking and a virtual slide
window. The remaining cost is in first load, high-DPI canvas raster work,
serialized render ordering, and duplicate PPTX parsing between thumbnails and
the full viewer.

## Current State

Primary files:

| Responsibility                                | File                                                     |
| --------------------------------------------- | -------------------------------------------------------- |
| Public viewer wrapper and shell               | `registry/new-york-v4/ui/pptx-viewer.tsx`                |
| Geometry, reset keys, cache keys              | `registry/new-york-v4/ui/pptx-viewer-core.ts`            |
| PPTX source cache, render queue, bitmap cache | `registry/new-york-v4/ui/pptx-viewer-source.ts`          |
| `pptxviewjs` adapter and source load timing   | `registry/new-york-v4/ui/pptx-viewer-renderer.ts`        |
| Slide size XML parsing                        | `registry/new-york-v4/ui/pptx-viewer-presentation.ts`    |
| Virtual slide projection and slide canvases   | `registry/new-york-v4/ui/pptx-viewer-slide.tsx`          |
| Layout and visible-slide math                 | `registry/new-york-v4/ui/pptx-viewer-visible-slide.ts`   |
| Scroll idle tracking                          | `registry/new-york-v4/ui/pptx-viewer-scroll.ts`          |
| Fit-width viewport measurement                | `registry/new-york-v4/ui/pptx-viewer-viewport.ts`        |
| FileViewer lazy route                         | `registry/new-york-v4/ui/file-viewer-route.tsx`          |
| PPTX thumbnail renderer                       | `components/file-thumbnail/renderers/pptx-thumbnail.tsx` |
| Benchmark surface                             | `app/(view)/scrollbench/*`                               |

What is already right:

- `PptxViewer` creates a stable `ViewerResource` and loads the source through
  Suspense.
- `getPptxSource` caches loaded deck renderers by content key.
- pending source loads are pinned so eviction cannot leak a renderer.
- loaded sources are retained while mounted and disposed after release plus LRU
  eviction.
- current slide and scroll progress are computed from geometry, not DOM scans.
- `PptxSlideScroller` uses one fixed-height virtual canvas and mounts only the
  visible plus near-visible slide shells.
- uncached renders can be deferred until scroll idle with `eager={false}`.
- cached slide bitmaps draw synchronously.
- queued renders are skipped if their slide shell is no longer live before the
  render starts.
- slide render and source load timings already exist for profiling.

## Performance Diagnosis

### 1. Source Load Does A Duplicate ZIP Parse

`createPptxRenderer` reads the source bytes, then `readSlideSize` imports JSZip,
loads the full PPTX zip, and reads `ppt/presentation.xml`. After that,
`pptxviewjs` loads and parses the same `ArrayBuffer` again in `viewer.loadFile`.

The viewer cannot show the real slide layout until the Suspense source resolves
anyway. That means the separate slide-size zip pass is pure overhead during
first open.

Expected symptoms:

- extra first-open latency in `readSlideSizeMs`;
- extra memory pressure while JSZip holds another archive representation;
- extra dynamic import work when the app has not already loaded JSZip.

### 2. High-DPI Rendering Scales Pixel Work Quadratically

`PptxSlideCanvas` renders at `zoomScale * window.devicePixelRatio`. The library
then sizes the backing canvas from CSS pixels times its own pixel ratio.

On high-DPI displays:

- DPR 2 costs 4x the pixels of DPR 1;
- DPR 3 costs 9x the pixels of DPR 1;
- zooming compounds the cost;
- large slides can become multi-megapixel canvas renders even at fit width.

This is likely one of the biggest costs after the PPTX is loaded.

### 3. Eager Rendering Starts Work While The User Is Still Scrolling

The public default is eager rendering. In eager mode, an uncached slide starts
rendering as soon as its shell enters the virtual window.

Fast scrolls can therefore start render work for slides the user does not intend
to inspect. The queue skips stale renders before they start, but it cannot cancel
an active `pptxviewjs` render once it has begun.

### 4. Render Queue Is FIFO, Not Visibility-Prioritized

`RendererSource` serializes all uncached renders through one promise chain.
Serialization is a reasonable guard around `pptxviewjs`, but the order matters.

`PptxSlideScroller` currently projects virtual slides in window order. With
overscan, earlier near slides can enter the queue before the slide closest to
the reading marker. The user sees skeletons while the renderer spends time on
less important slides.

### 5. Bitmap Snapshotting Blocks The Next Render

After `pptxviewjs` paints a slide, `RendererSource.renderSlide` awaits
`createImageBitmap(input.canvas)` and inserts the bitmap into the LRU before the
queued render resolves.

That makes scroll-back faster, but it puts snapshot creation on the critical
path for the next slide render.

### 6. Bitmap Cache Is Count-Based Instead Of Budget-Based

The per-source bitmap cache keeps eight `ImageBitmap` entries regardless of
slide size, zoom, or DPR.

Eight small 4:3 slides at DPR 1 are cheap. Eight wide, zoomed, DPR 3 slides can
be expensive. The same count can be too small for normal scroll-back and too
large for memory-constrained high-DPI sessions.

### 7. PPTX Thumbnails And Full Viewer Do Not Share A Source

`components/file-thumbnail/renderers/pptx-thumbnail.tsx` imports `pptxviewjs`,
loads the deck, reads slide size, and renders the first slide into a thumbnail
cache. Opening the full viewer later repeats the deck load through
`getPptxSource`.

When the UI shows thumbnails before opening a file, the user pays duplicate
parse cost.

### 8. First Open Waits For The Heavy Viewer Chunk

`file-viewer-route.tsx` lazy-loads the PPTX viewer only when the PPTX route is
rendered. That is correct for bundle hygiene, but it means first open waits for
the heavy `pptxviewjs` chunk, including its JSZip and Chart dependencies.

The route already knows the selected file category before mounting the concrete
viewer, so chunk preloading can hide part of this cost.

## Target Architecture

Keep the current viewer API. Sharpen the pipeline:

| Work                | Current Owner            | Target Owner                                       |
| ------------------- | ------------------------ | -------------------------------------------------- |
| Slide size          | Separate JSZip read      | Loaded `pptxviewjs` presentation                   |
| PPTX chunk import   | Concrete viewer mount    | Preload on known PPTX intent                       |
| Render start policy | Eager by default         | Adaptive: visible first, uncached overscan on idle |
| Render queue order  | FIFO request order       | Priority by visibility and distance                |
| Bitmap snapshot     | Inside render queue      | Post-render idle or separate cache task            |
| Render pixel ratio  | Full device DPR          | Capped or progressive DPR                          |
| Bitmap cache size   | Entry count              | Pixel or byte budget                               |
| Thumbnail source    | Separate thumbnail cache | Shared source or promoted parsed deck              |

## Phase 1: Measurement Baseline

Before changing behavior, make the existing timing evidence easy to compare.

Use the existing callbacks:

- `onSourceLoadTiming`
- `onSlideRenderTiming`

Extend the PPTX scrollbench result with:

- source load total;
- `importPptxMs`;
- `readSlideSizeMs`;
- `loadFileMs`;
- first visible slide render duration;
- median uncached render duration;
- median cached draw duration;
- max render scale;
- rendered bitmap count;
- failed or cancelled render count.

Acceptance:

- `/scrollbench?viewer=pptx` reports source and slide render timings.
- benchmark output distinguishes first-open, scroll, cached scroll-back, and
  zoom-change costs.
- timing output is serializable so it can be checked into `tmp/` only during
  local profiling and ignored by git.

## Phase 2: Remove Duplicate Slide-Size ZIP Read

Change `createPptxRenderer` so it no longer calls `readSlideSize(buffer)`.

After `viewer.loadFile(buffer)` resolves, derive base size from the loaded
viewer:

```ts
type PptxProcessorWithDimensions = {
  getSlideDimensions?: () => { cx: number; cy: number }
  presentation?: {
    slideSize?: { cx: number; cy: number }
  }
}
```

Rules:

- prefer a loaded processor dimension method when available;
- fall back to `viewer.presentation.slideSize` if exposed;
- convert EMU to CSS pixels with the existing `EMU_PER_PX` rule;
- keep `DEFAULT_PPTX_SLIDE_SIZE` fallback;
- replace `readSlideSizeMs` with `readLoadedSlideSizeMs` or keep the timing
  field name with near-zero duration for API stability if required.

Acceptance:

- first source load does not import `jszip` only for slide-size inspection;
- `PptxSource.baseSize` matches the current parser for standard decks;
- invalid or missing loaded dimensions still fall back to 960x720;
- tests cover loaded dimensions, missing dimensions, and malformed dimensions.

## Phase 3: Adaptive Render Policy

Make eager rendering a policy, not a boolean default that treats every virtual
slide equally.

Target policy:

```ts
type PptxRenderPolicy = {
  renderVisibleImmediately: boolean
  renderCachedImmediately: boolean
  renderOverscanWhileScrolling: boolean
  renderOverscanOnIdle: boolean
}
```

Default behavior:

- first visible slide renders immediately;
- cached slides draw immediately;
- the current slide and actual viewport slides render before overscan;
- uncached overscan waits until scroll idle;
- large decks default to settled overscan rendering;
- small decks can keep eager overscan if profiling proves it feels better.

Implementation notes:

- preserve the public `eager` prop as an override;
- consider `eager={true}` as "render overscan while scrolling";
- consider `eager={false}` as "render uncached work after idle except visible";
- do not delay cached bitmap draws.

Acceptance:

- fast scroll does not enqueue uncached renders for pass-through overscan slides;
- first visible slide still appears immediately on initial open;
- cached scroll-back remains immediate;
- existing eager and non-eager tests remain meaningful.

## Phase 4: Visibility-Prioritized Queue

Replace FIFO request order with a tiny scheduler inside `RendererSource`.

Priority inputs:

```ts
type PptxSlideRenderPriority = {
  slideIndex: number
  isCurrentSlide: boolean
  isInViewport: boolean
  distanceFromReadingMarker: number
  sequence: number
}
```

Rules:

- one `pptxviewjs` render remains active at a time;
- duplicate requests for the same slide and render scale coalesce;
- current slide wins;
- visible slides beat overscan;
- nearer slides beat farther slides;
- older requests break ties;
- stale requests are skipped before render start.

Acceptance:

- jumping to slide N renders N before N-2 overscan;
- scrolling forward prioritizes forward near slides;
- cancelled stale requests do not surface errors;
- no concurrent calls enter the same `pptxviewjs` renderer.

## Phase 5: Move Bitmap Snapshot Off The Critical Queue

Do not block the next slide render on `createImageBitmap`.

Target flow:

1. `pptxviewjs` paints the live canvas.
2. `renderSlide` resolves `{ status: "rendered" }`.
3. bitmap snapshot is scheduled as a cache task.
4. cache task checks source disposal and render liveness before storing.

Open decision:

- If the slide is no longer live after render, either skip snapshot for fastest
  forward progress or snapshot anyway for better scroll-back. Default to skip
  until profiling proves otherwise.

Acceptance:

- render timing separates paint time from bitmap snapshot time;
- queue starts the next uncached slide before snapshot completion;
- cache failures do not affect rendered slides;
- bitmap entries still close on eviction.

## Phase 6: Cap Or Progressively Upgrade DPR

Add an internal render pixel ratio policy.

Options:

```ts
type PptxRenderPixelRatioPolicy = {
  maxPixelRatio: number
  upgradeOnIdle: boolean
}
```

Default target:

- cap main slide rendering at DPR 2;
- use DPR 1 during active scroll for uncached slides;
- upgrade the settled visible slide to the capped DPR after idle;
- keep overlays in CSS pixels, independent of bitmap DPR.

Implementation notes:

- `pptxviewjs` uses its processor render context pixel ratio when initializing
  the drawing document;
- the wrapper may need a narrow internal adapter around the loaded viewer to set
  pixel ratio before each render;
- keep the public API clean unless consumers need a documented
  `maxRenderPixelRatio`.

Acceptance:

- DPR 3 displays do not render 9x CSS pixels by default;
- fit-width text remains acceptable on common Retina displays;
- zoomed slides still cap pixel count;
- cached bitmap keys include the effective pixel ratio.

## Phase 7: Budget-Based Bitmap Cache

Replace the fixed eight-entry bitmap cache with a pixel budget.

Suggested model:

```ts
type PptxBitmapBudget = {
  maxPixels: number
  maxEntries: number
}
```

Rules:

- estimate pixels as `bitmap.width * bitmap.height`;
- evict least-recently-used entries until both count and pixel budgets pass;
- keep active or currently drawing entries pinned;
- default budget should hold the current viewport plus a small scroll-back range
  at capped DPR.

Acceptance:

- cache does not keep eight huge DPR 3 bitmaps by accident;
- normal slide decks keep enough cache for short scroll-back;
- evicted bitmaps always call `ImageBitmap.close()`;
- tests cover count eviction and pixel-budget eviction.

## Phase 8: Share Thumbnail And Viewer Source Work

Unify the PPTX thumbnail and full viewer load path.

Options:

1. Make thumbnail rendering use `getPptxSource` and render slide 0 through the
   shared source.
2. Let thumbnail cache promote a parsed source into the viewer source cache.
3. Keep separate caches, but share the loaded bytes and the loaded slide-size
   result.

Preferred first step:

- use `getPptxSource` for thumbnails only when the resource is small enough or
  the full viewer is likely to open;
- otherwise keep thumbnail-specific loading to avoid retaining too many full
  deck renderers in file grids.

Acceptance:

- opening a PPTX after its thumbnail rendered does not call `loadFile` twice for
  the same content key in the common path;
- thumbnail rendering remains bounded by the thumbnail decode queue;
- thumbnail failures stay contained;
- full viewer source cache limits still apply.

## Phase 9: Preload PPTX On Intent

Expose a small preload function from the PPTX viewer module:

```ts
export function preloadPptxViewer() {
  void import("pptxviewjs")
}
```

Then call it from the file-viewer route or file picker when:

- the selected descriptor category is `pptx`;
- the user hovers or focuses a PPTX row;
- the app is idle after a PPTX upload finishes.

Acceptance:

- non-PPTX routes do not eagerly load `pptxviewjs`;
- PPTX first-open `importPptxMs` drops when preload had time to finish;
- preload never starts parsing a document by itself.

## Non-Goals

- Do not replace the current slide layout model.
- Do not reintroduce per-slide `IntersectionObserver`.
- Do not render every slide shell.
- Do not make PPTX rendering concurrent inside one `pptxviewjs` instance.
- Do not move `pptxviewjs` into a worker unless the renderer dependency changes
  or a separate proof shows its DOM, canvas, Chart, and global usage can be
  isolated safely.
- Do not optimize PPTX fidelity in this workstream.
- Do not make server conversion part of the client-side viewer component.

## Server Conversion Escape Hatch

For large, frequently viewed, or pixel-critical decks, the fastest product path
is cached server-side conversion to PDF or images.

That is separate from this viewer's client-side contract. It belongs at the file
pipeline or document-resource layer:

- convert PPTX to PDF/images once;
- cache by file hash;
- route the converted artifact through `PdfViewer` or `ImageViewer`;
- keep the client-side PPTX viewer as the no-server fallback.

## Test Plan

Focused tests:

- `tests/pptx-viewer-units.test.tsx`
- `tests/pptx-viewer.test.tsx`
- `tests/thumbnail-regressions.test.tsx`
- `tests/file-viewer.test.tsx`

New coverage:

- loaded slide dimensions replace JSZip slide-size parsing;
- render priority renders current slide before overscan;
- non-eager/adaptive scrolling skips pass-through uncached overscan;
- bitmap snapshot does not block the next queued render;
- DPR cap changes render scale and bitmap cache key;
- pixel-budget cache evicts large bitmaps;
- thumbnail and full viewer avoid duplicate load in the shared-source path;
- preload lowers import timing without parsing content.

Verification commands:

```bash
pnpm test tests/pptx-viewer-units.test.tsx tests/pptx-viewer.test.tsx
pnpm test tests/thumbnail-regressions.test.tsx tests/file-viewer.test.tsx
```

Manual profiling:

```bash
# Requires an already-running dev server.
# Do not start or restart the dev server from an agent task unless explicitly asked.
open http://localhost:3100/scrollbench?viewer=pptx
```

## Rollout Order

1. Add measurement output for PPTX source and slide timing.
2. Remove duplicate slide-size zip parsing.
3. Add adaptive render policy while preserving the `eager` prop.
4. Prioritize visible slide render requests.
5. Move bitmap snapshotting off the render queue.
6. Add render pixel ratio cap or progressive DPR upgrade.
7. Replace count-only bitmap cache with a pixel budget.
8. Share thumbnail and full viewer source work where it is clearly beneficial.
9. Add PPTX chunk preload on user intent.

This order keeps each change measurable, small, and reversible.
