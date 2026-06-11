# Image Viewer TIFF Blueprint

This is the hardening blueprint for the TIFF path inside `ImageViewer`.
The current design is directionally right: TIFF parsing is worker-backed,
frames decode lazily near the viewport, decoded `ImageBitmap`s are capped, and
UTIF frame buffers are released after decode. The remaining work is about
lifecycle ownership, retry behavior, source overlays, and verification.

## North Star

`ImageViewer` should render native browser images and multi-page TIFF scans
through one frame model.

```tsx
<ImageViewer src="/samples/scan.tiff" className="h-[600px]" />
```

Rules:

- A normal image is one frame.
- A multi-page TIFF is many frames.
- Frame dimensions are known before pixel decode, so scroll height is stable.
- Pixel decode happens off the main thread.
- Hidden frames are cheap placeholders.
- Visible frames hold decoded pixels only while needed.
- Closing a viewer or switching files must release workers, bitmaps, and pending
  decode promises deterministically.

## Current Assessment

The implementation in `registry/new-york-v4/ui/image-viewer.tsx` and
`registry/new-york-v4/ui/image-viewer.worker.ts` has strong foundations:

- TIFF detection uses extension, content type, and magic bytes.
- UTIF runs in a module Web Worker.
- The file buffer is transferred into the worker once.
- TIFF frame metadata is available up front from IFDs.
- Per-frame decode returns transferred `ImageBitmap`s.
- The main thread draws into a DPR-aware canvas.
- Decoded bitmaps are capped with an LRU-ish eviction list.
- UTIF's retained `ifd.data` buffer is deleted after every decode.
- `IntersectionObserver` keeps far-off frames as skeletons.

It is not yet the final design.

Remaining concerns:

- `sourceCache` keeps `ImageSource` promises forever, so TIFF workers and source
  buffers can live for the lifetime of the page.
- The source model has no `dispose()` method, so callers cannot intentionally
  close cached bitmaps, reject pending requests, or terminate the worker.
- Worker errors after initialization do not reject pending frame decode promises.
- Failed frame decodes remain in the `inflight` cache, so a retry reuses the same
  rejected promise.
- A decode that resolves after its canvas unmounts is released only through the
  callback-ref cleanup path; this relies on React 19 semantics.
- `renderImageSourceOverlay` maps normalized boxes as raw percentages and does
  not account for rotation.
- The cache key is only `src`; that is probably correct today, but the cache
  policy is implicit rather than documented and bounded.
- There are no focused tests for TIFF source lifecycle, worker failure, retry, or
  rotated overlay geometry.

## Invariants

These rules should be true after hardening:

1. A worker created for one TIFF must be terminated when the cached source is
   disposed or evicted.
2. Every decoded bitmap must be closed exactly once when it leaves the cache.
3. Pending decode promises must resolve, reject, or be cancelled; they must never
   hang forever.
4. A failed frame decode must not poison future attempts for that frame.
5. A source cache entry must be bounded by an explicit eviction policy.
6. Evicting a source must close all cached bitmaps and terminate its worker.
7. Switching `src` must never draw a bitmap from the previous file.
8. Overlay boxes must remain correct across zoom and rotation.
9. Lazy frame mounting must not depend on implementation details that break for
   registry consumers unless the component explicitly requires React 19.
10. TIFF support must fail as a viewer error, not as an unhandled promise
    rejection.

## Source Lifecycle

Extend the internal source contract with ownership APIs.

```ts
interface ImageSource {
  kind: "image" | "tiff"
  frames: FrameMeta[]
  acquire(i: number): Promise<ImageBitmap>
  release(i: number): void
  dispose(): void
}
```

`dispose()` rules:

- Close every cached bitmap.
- Clear `cache`, `pins`, `recency`, and `inflight`.
- Reject every pending decode with a disposal error.
- Terminate the TIFF worker.
- Become idempotent, so repeated cleanup is harmless.

Plain images should also implement `dispose()` so the viewer can treat every
source uniformly. For plain images this mostly means closing cached bitmaps and
clearing in-flight decode bookkeeping.

## Bounded Source Cache

Replace the unbounded `Map<string, Promise<ImageSource>>` with a small cache
that owns eviction.

Target behavior:

- Cache by `src`.
- Keep a small number of loaded sources, for example 4.
- Touch a source when it is read.
- Evict least-recently-used sources past the cap.
- Call `dispose()` before removing an entry.
- Remove rejected load promises so a transient fetch or worker error can retry.

Sketch:

```ts
const MAX_SOURCES = 4

interface SourceCacheEntry {
  promise: Promise<ImageSource>
  source?: ImageSource
}
```

Rules:

- `getImageSource(src)` may return a stable promise while the entry is cached.
- Once the promise resolves, attach the source to the entry.
- On rejection, delete the cache entry.
- When eviction removes a resolved entry, call `source.dispose()`.
- When eviction removes a still-loading entry, mark it disposed and dispose the
  source immediately if it later resolves.

## Decode Retry Semantics

`createSource` should never leave stale rejected promises in `inflight`.

Target pattern:

```ts
p = decode(i)
  .then((bitmap) => {
    inflight.delete(i)
    cache.set(i, bitmap)
    evictBitmaps()
    return bitmap
  })
  .catch((err) => {
    inflight.delete(i)
    pins.delete(i)
    throw err
  })
```

Rules:

- Retry after failure starts a fresh worker decode.
- `release(i)` must be safe even if the decode never resolved.
- If a decode resolves after the frame was released, the bitmap may enter the
  cache briefly, then normal eviction should be able to close it.
- If a decode resolves after source disposal, close the bitmap immediately and
  reject or ignore the caller according to the source's disposed state.

## Worker Protocol

Make worker failure explicit and drain all pending requests.

Main-thread rules:

- Keep `pending` decode requests inside the TIFF source.
- On `worker.onerror` or `worker.onmessageerror`, reject all pending requests.
- Mark the source as failed or disposed.
- Terminate the worker.
- Delete the source cache entry so a later mount can retry from the URL.

Worker rules:

- Validate decode indexes before reading `ifds[msg.index]`.
- Reject zero-width or zero-height frames before creating `ImageData`.
- Always delete `ifd.data` in a `finally` block after `decodeImage` succeeds,
  even if `toRGBA8`, `ImageData`, or `createImageBitmap` fails.
- Return structured error messages that identify the frame index.

Target worker decode shape:

```ts
let decoded = false
try {
  utif.decodeImage(buf, ifd)
  decoded = true
  // build ImageBitmap
} finally {
  if (decoded) delete ifd.data
}
```

## React Compatibility

This repo currently uses React 19, where callback-ref cleanup functions are
valid. Registry consumers may not.

Choose one explicit policy:

1. Keep the no-`useEffect` implementation and document React 19 as a requirement.
2. Or move observer and canvas acquire/release cleanup to effects for React 18
   compatibility.

If the registry intends to support React 18 consumers, prefer compatibility over
the no-effect constraint:

- Use a normal DOM ref plus `useEffect` for `ResizeObserver`.
- Use a normal DOM ref plus `useEffect` for `IntersectionObserver`.
- Use a normal canvas ref plus `useEffect` for acquire/draw/release.

If React 19 is the explicit target, add that requirement to docs and tests so
the callback-ref cleanup dependency is not accidental.

## Overlay Geometry

`PageOverlayProps` already includes `rotation`, but the built-in image source
overlay ignores it.

Target options:

- Prefer rendering overlays in the same coordinate plane as the unrotated image,
  then rotate the entire image-plus-overlay layer together.
- If overlays remain in the outer rotated box, convert normalized boxes through
  a rotation-aware transform.

Rotation transform for normalized coordinates:

```ts
type Box = { left: number; top: number; width: number; height: number }

function rotateBox(box: Box, rotation: number): Box {
  if (rotation === 90) {
    return {
      left: 1 - box.top - box.height,
      top: box.left,
      width: box.height,
      height: box.width,
    }
  }
  if (rotation === 180) {
    return {
      left: 1 - box.left - box.width,
      top: 1 - box.top - box.height,
      width: box.width,
      height: box.height,
    }
  }
  if (rotation === 270) {
    return {
      left: box.top,
      top: 1 - box.left - box.width,
      width: box.height,
      height: box.width,
    }
  }
  return box
}
```

Rules:

- Keep public anchors normalized to the original image coordinate space.
- Convert only at render time.
- Add tests for all four rotations.

## Public API

Keep the public API stable for now:

```ts
export interface ImageViewerProps {
  src: string
  className?: string
  scale?: number
  toolbar?: boolean
  downloadFileName?: string
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode
  onVisiblePageChange?: (page: number) => void
  onScrollProgressChange?: (progress: number) => void
  bare?: boolean
  header?: React.ReactNode
  aside?: React.ReactNode
}
```

Possible internal-only additions:

- `dispose()` on `ImageSource`.
- `sourceCacheKey(src)`.
- `clearImageSourceCacheForTests()`.
- Pure helper exports for tests:
  - `looksLikeTiff`
  - `rotateImageBox`
  - cache key helpers

Avoid adding new public props until lifecycle and geometry are correct.

## Tests

Add focused tests before broad visual work.

### Pure Tests

Create tests for:

- TIFF detection by extension.
- TIFF detection by `image/tiff` content type.
- TIFF detection by little-endian and big-endian magic bytes.
- non-TIFF images not matching the magic check.
- failed decode clearing `inflight`.
- LRU bitmap eviction closing unpinned bitmaps.
- source cache eviction calling `dispose()`.
- rotation-aware bbox transforms.

### Worker Protocol Tests

Use a small fake worker/source harness rather than real UTIF for most lifecycle
tests:

- init failure rejects the source promise and removes the cache entry.
- frame decode failure rejects the acquire promise and allows retry.
- worker error rejects every pending decode.
- disposal rejects every pending decode.
- disposal after a decode closes cached bitmaps.

### Component Tests

Add React tests for:

- switching `src` while a decode is pending does not draw the old bitmap.
- unmounting a visible frame releases the frame.
- unmounting the viewer disposes the source when it is no longer cached.
- rotated source overlay remains aligned.
- error boundary recovers after changing `src`.

### Browser Verification

Use docs/demo samples to verify:

- PNG/JPEG/WebP still render through the native image path.
- A multi-page TIFF scrolls with stable page count and no visible layout jumps.
- Scrolling through a large TIFF does not monotonically increase decoded bitmap
  count.
- Zoom and rotate redraw visible frames cleanly.
- Source highlights align before and after rotation.
- Closing or navigating away from the demo terminates TIFF workers.

## Implementation Plan

1. Add `dispose()` to `ImageSource` and implement it for plain images and TIFFs.
2. Move TIFF `pending` decode ownership into the source so it can be drained.
3. Make worker errors and message errors reject all pending decodes.
4. Clear `inflight` entries on decode rejection.
5. Add explicit source-cache LRU eviction and dispose evicted sources.
6. Remove rejected source promises from the cache to permit retry.
7. Decide and document the React 19 callback-ref cleanup policy.
8. Add rotation-aware bbox transform helpers.
9. Wire `renderImageSourceOverlay` through the rotation-aware transform.
10. Add pure lifecycle and geometry tests.
11. Add component tests for src switching, error recovery, and release behavior.
12. Run browser verification on the image viewer docs demo and sample TIFF.
13. Rebuild the registry output after source changes.

## Non-Goals

- Do not split TIFF into a separate public `TiffViewer` component.
- Do not move TIFF decoding onto the main thread.
- Do not rasterize TIFFs server-side in this component.
- Do not add thumbnail generation here; `DocumentThumbnail` owns thumbnails.
- Do not replace UTIF without evidence from unsupported samples or performance.
- Do not redesign the viewer toolbar or page chrome while hardening lifecycle.
- Do not add a broad file-router API; `FileViewer` owns routing.

## Acceptance Criteria

- Multi-page TIFF files render with lazy frame decode and stable scroll height.
- Worker failure, frame failure, and source disposal do not leave hung promises.
- Retrying a failed frame starts a fresh decode.
- Source cache size is bounded and eviction terminates TIFF workers.
- All cached `ImageBitmap`s are closed on bitmap eviction or source disposal.
- Source overlays align correctly at 0, 90, 180, and 270 degrees.
- Tests cover TIFF detection, decode retry, disposal, cache eviction, and rotated
  overlay geometry.
- Browser verification shows no console errors for native images or sample TIFFs.
