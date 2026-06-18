# Image Viewer Performance Blueprint

## Current State

The image viewer has two very different performance profiles.

The single-image path is already fast in the current local app. The existing
scrollbench image fixture, `/samples/attention-page-1.png` at `scale={2}`,
measured about `120fps` in headless Chromium with p95 frame time around `9ms`
and no frames over `16.7ms`.

The multi-page TIFF path is the hard case. On the docs image demo
(`/samples/entropy.tiff`, 8 frames, 1275 x 1650), local headless measurements
showed:

- small sequential scroll: about `111fps`, p95 around `26ms`
- medium jumps: about `52fps`, p95 around `32ms`
- repeated top/bottom jumps: about `31fps`, p95 around `42ms`
- repeating the top/bottom run after cache warmup did not materially improve it

That points away from source loading as the primary hot path. The decoded
`ImageBitmap` cache is doing useful work, but the viewer still pays to replace
the virtual frame window, mount fresh canvases, reacquire frame bitmaps, and draw
them again.

The current architecture:

- computes a full frame layout from metadata, scale, and rotation
- stores `visibleFrameNumbers` in React state
- maps visible frame numbers to React children
- renders each visible frame as a fresh canvas
- sizes each canvas to CSS size times device pixel ratio
- draws the decoded frame bitmap into the canvas with high-quality smoothing

A temporary browser-side probe over the TIFF top/bottom jump case measured
`drawImage` at about `335ms` of roughly `1307ms` total frame time. Canvas drawing
is real work, but the broader window-swap path is the larger cost.

## Goal

Make multi-page image documents scroll and jump like a document viewer, not like
a sequence of repeatedly remounted canvases.

Target behavior:

- small scroll remains near display refresh rate
- large jumps do not repeatedly redraw already-rendered nearby pages
- fast scroll does not start decodes that will be immediately canceled
- image render timing is observable in the existing scrollbench UI
- memory stays bounded by explicit bitmap and rendered-frame budgets
- source overlays and imperative source navigation keep their current behavior

## Non-Goals

- Do not weaken TIFF memory bounds by retaining every decoded full-size bitmap.
- Do not add a second public image viewer API.
- Do not fork native image and TIFF UI behavior except where the renderer path
  truly differs.
- Do not introduce compatibility shims for React 18.
- Do not optimize the PNG single-image path at the expense of TIFF documents.
- Do not start by changing the worker library; UTIF is not yet the proven
  bottleneck for the measured warm-cache jump case.

## Phase 1: Add Image Render Timing

### Problem

The image viewer lacks the instrumentation already available in the PPTX viewer.
The scrollbench route has summary plumbing for image-like render timings, but it
only wires the data for PPTX today. That makes image work hard to split into
decode wait, cached draw, uncached draw, cancellation, and failure.

### Design

Add an optional image-frame timing callback to `ImageViewerProps`.

Candidate shape:

```ts
export interface ImageFrameRenderTiming {
  cached: boolean
  durationMs: number
  frameNumber: number
  pixelRatio: number
  renderScale: number
  status: "rendered" | "cancelled" | "failed"
}
```

Thread it through:

- `ImageViewerProps`
- `ImageViewerContent`
- `ImageFrame`
- `ImageFrameCanvas`

Measure from just before `source.acquire(frameIndex)` until the draw resolves,
cancels, or fails. To report `cached` accurately, expose a small cache query on
`FrameSource`, or change `acquire` to return metadata beside the bitmap.

Update scrollbench so `viewer === "image"` records these timings, matching the
PPTX summary panel.

### Verification

- `pnpm test -- tests/image-viewer.test.tsx tests/image-viewer-probes.test.tsx`
- image scrollbench reports render count, cached count, p95, and max
- callbacks are best-effort and cannot break rendering if they throw
- canceled frame draws report `status: "cancelled"` instead of disappearing

## Phase 2: Replace React Window Mapping With Projected Frames

### Problem

`ImageViewerContent` maps `visibleFrameNumbers` to React elements. On large
scroll jumps, the visible window changes, React unmounts old frame canvases and
mounts new ones, and every mounted canvas runs the draw lifecycle again.

This mirrors an older virtual-list shape. The PPTX viewer already uses a better
pattern: a persistent virtual canvas, imperative shell placement, per-slide
projection roots, and render keys that avoid rerendering unchanged projected
slides.

### Design

Introduce `ImageFrameScroller`, modeled on the PPTX slide scroller:

- the scroll viewport owns a persistent `div` virtual canvas
- frame shells are created once per projected frame
- shell position and dimensions are patched imperatively
- visible frame computation stays layout-based
- `root.render` only runs when the frame render key changes
- render key includes source identity, frame index, scale, rotation, DPR, and
  overlay callback identity
- projected shells are disposed only when they leave the retention window

Keep React at the frame boundary, not the scroll boundary. Scrolling should patch
the virtual canvas on `requestAnimationFrame` without forcing the image viewer
component tree to rerender.

### Verification

- large TIFF window tests still prove only a bounded number of frames are mounted
- top/bottom TIFF jump p95 should drop below the current `~42ms` baseline
- draw count during repeated top/bottom jumps should drop after warmup
- `onVisibleFrameChange` and `onScrollProgressChange` behavior stays unchanged
- source overlay tests still pass

## Phase 3: Retain Rendered Frames Within A Pixel Budget

### Problem

The decoded bitmap cache preserves full-size image pixels, but the viewer still
redraws scaled canvases after a frame shell is remounted. For the 8-frame TIFF
demo, the decoded source frames fit under the default decoded-frame cap, yet the
viewer still pays redraw and remount cost on every far jump.

### Design

Add a rendered-frame retention budget separate from the decoded bitmap cache.

Options:

- retain projected canvas shells for recently visible frames
- snapshot rendered canvases with `createImageBitmap(canvas)` and redraw the
  scaled bitmap on remount
- keep all rendered canvases mounted when the total rendered pixel count is below
  a conservative budget

Use a budget keyed by rendered pixels, not by frame count:

```ts
type RenderedImageFrameKey = {
  devicePixelRatio: number
  frameIndex: number
  rotation: number
  scale: number
  sourceKey: string
}
```

For small TIFFs, this can retain every rendered page. For 48-page scans, it
should retain only the current and recently visited windows.

### Verification

- warm top/bottom TIFF jump should avoid most repeated `drawImage` calls
- memory use remains bounded by the rendered-pixel budget
- zoom or rotation invalidates rendered-frame cache entries
- source changes dispose rendered caches
- `ImageBitmap.close()` is called for evicted rendered snapshots

## Phase 4: Add Direction-Aware Decode Prefetch

### Problem

The current virtual window overscans a fixed number of frames, and canvases only
request frames when they mount. Fast scroll can request frames that are already
behind the viewport, then cancel those decodes when the canvas unmounts.

The TIFF worker also processes decode requests serially. FIFO is simple, but it
does not know which requested frame is currently closest to the viewport.

### Design

Add a prefetch layer on `FrameSource`.

Candidate API:

```ts
interface FrameSource {
  hasDecodedFrame(frameIndex: number): boolean
  prefetch(frameIndexes: readonly number[]): void
}
```

On each visible-window update:

- decode current visible frames first
- prefetch the next likely frames in scroll direction
- keep one small reverse-direction buffer
- cancel stale queued prefetches before visible-frame decodes
- avoid duplicate queued requests for the same frame

The worker queue can stay single-threaded initially, but it should prioritize
visible frames over prefetch frames.

### Verification

- fast forward scroll reduces uncached visible-frame timings
- cancel counts do not spike during continuous scroll
- jumping directly to a far page still prioritizes the new viewport
- decoded bitmap memory remains capped by `maxDecodedFrames`

## Phase 5: Use Scroll-Aware Quality

### Problem

Every image canvas draw uses high-quality smoothing. That is the right final
quality for a settled page, but it is expensive during active scroll and jump
work where the user is not inspecting the pixels yet.

### Design

Track image scroll activity and render in two passes:

- while scrolling: draw with lower smoothing quality or skip non-cached draws
- on idle: redraw visible frames with high-quality smoothing

This should be optically stable: frames must not flicker, resize, or show blank
content while waiting for idle.

### Verification

- active-scroll p95 improves in the TIFF medium-jump benchmark
- idle redraw completes without changing layout
- screenshots before and after idle redraw remain visually aligned
- overlays stay anchored during both quality modes

## Phase 6: Relax Released Source Disposal

### Problem

Released sources are disposed immediately. That keeps memory tight, but it means
short route, tab, or provider remounts lose the loaded `FrameSource` and decoded
bitmap cache.

This is not the main in-scroll bottleneck, but it affects perceived speed when a
viewer is briefly unmounted and remounted with the same source.

### Design

Change the default released-source timeout from immediate disposal to a short
grace period, for example `5_000ms` to `30_000ms`.

This should apply only to released resolved sources. Explicit test cleanup still
uses `resetImageSourceCacheForTests()`.

### Verification

- remounting the same source inside the grace period reuses the `FrameSource`
- source disposal still happens after the grace period
- `clear()` still aborts and disposes immediately
- memory does not accumulate across unrelated source keys

## Success Criteria

The performance work is complete when the repo can prove:

- image scrollbench records image render timing, not just scroll frame timing
- PNG single-image scroll remains at the current near-refresh baseline
- TIFF small sequential scroll stays near refresh rate
- TIFF large-jump p95 is materially below the current `~42ms` top/bottom baseline
- warm repeated jumps reuse rendered work instead of redrawing every visible page
- decoded and rendered memory have explicit, tested bounds
- fast scroll prioritizes the current viewport over stale queued decodes
- source overlays, rotation, zoom, imperative scrolling, and error handling keep
  their current contracts

## Reference Files

- `registry/new-york-v4/ui/image-viewer-content.tsx`
- `registry/new-york-v4/ui/image-viewer-frame.tsx`
- `registry/new-york-v4/ui/image-viewer-virtualization.ts`
- `registry/new-york-v4/ui/image-viewer-hooks.ts`
- `registry/new-york-v4/lib/image-frame-source.ts`
- `registry/new-york-v4/lib/image-source-cache.ts`
- `registry/new-york-v4/lib/image-tiff-source.ts`
- `registry/new-york-v4/ui/image-viewer.worker.ts`
- `registry/new-york-v4/ui/pptx-viewer-slide.tsx`
- `registry/new-york-v4/ui/pptx-viewer-source.ts`
- `app/(view)/scrollbench/scrollbench-client.tsx`
- `app/(view)/scrollbench/scrollbench-core.ts`
- `tests/image-viewer.test.tsx`
- `tests/image-viewer-edge-cases.test.tsx`
- `tests/image-viewer-probes.test.tsx`
