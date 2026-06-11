# Image Viewer Platonic Ideal Blueprint

This blueprint describes the ideal final form of `ImageViewer`: everything
needed, nothing extra, clean module boundaries, exact names, and behavior that
is easy to prove.

The current implementation is production-solid, but it is not the ideal. It
still concentrates resource ownership, TIFF protocol, cache semantics, canvas
drawing, toolbar UI, and source-overlay geometry in too few files.

## North Star

`ImageViewer` is a frame viewer.

```tsx
<ImageViewer src="/samples/scan.tiff" className="h-[600px]" />
```

It accepts an image URL and renders one or more raster frames:

- PNG/JPEG/WebP/GIF/AVIF: one frame, browser-native decode.
- TIFF: one frame per IFD, worker-backed decode.

Everything else is implementation detail.

The public component should read like orchestration:

```tsx
export const ImageViewer = React.forwardRef<
  ImageViewerHandle,
  ImageViewerProps
>(function ImageViewer(props, ref) {
  return (
    <ClientOnly fallback={<ImageViewerFallback {...props} />}>
      <ImageViewerBoundary resetKey={props.src} className={props.className}>
        <React.Suspense fallback={<ImageViewerFallback {...props} />}>
          <ImageViewerContent {...props} forwardedRef={ref} />
        </React.Suspense>
      </ImageViewerBoundary>
    </ClientOnly>
  )
})
```

No TIFF protocol code, cache code, canvas drawing code, or geometry math should
live in the public shell.

## Ideal File Layout

Target files:

```txt
registry/new-york-v4/ui/image-viewer.tsx
registry/new-york-v4/ui/image-viewer-frame.tsx
registry/new-york-v4/ui/image-viewer-chrome.tsx
registry/new-york-v4/lib/image-frame-source.ts
registry/new-york-v4/lib/image-source-cache.ts
registry/new-york-v4/lib/image-tiff-source.ts
registry/new-york-v4/lib/image-geometry.ts
registry/new-york-v4/ui/image-viewer.worker.ts
registry/new-york-v4/ui/image-source.tsx
```

Responsibilities:

- `image-viewer.tsx`: public props, ref handle, Suspense boundary, viewer layout.
- `image-viewer-frame.tsx`: lazy frame slot and canvas drawing.
- `image-viewer-chrome.tsx`: toolbar, skeletons, error fallback.
- `image-frame-source.ts`: source interface, bitmap cache, acquire/release,
  disposal.
- `image-source-cache.ts`: URL-scoped source manager and retention lifecycle.
- `image-tiff-source.ts`: TIFF worker client protocol only.
- `image-geometry.ts`: dimensions, rotation, normalized box transforms.
- `image-viewer.worker.ts`: worker-side UTIF decode.
- `image-source.tsx`: document-source adapter and source highlight rendering.

Rule: a file should have one reason to change.

## Vocabulary

Use these names consistently:

- `frame`: one rendered raster unit.
- `frameIndex`: zero-based internal index.
- `frameNumber`: one-based public/indexed display number.
- `frameSize`: intrinsic unrotated pixel size.
- `viewport`: scrollable element.
- `source`: object that owns frame decode and bitmap lifecycle.
- `sourceHandle`: retained cache lease for a mounted viewer.
- `bitmapCache`: decoded `ImageBitmap` cache inside one source.
- `sourceManager`: URL-to-source retention cache.
- `rotation`: degrees, normalized to `0 | 90 | 180 | 270`.

Avoid:

- Mixing `page` and `frame` internally.
- Generic `cache` when the cache owns resources.
- Boolean names that hide ownership, such as `hasRetained`.

Public API may keep `pageNumber` for compatibility with the PDF viewer, but
internals should use `frameNumber`.

## Public API

Keep the public API stable:

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

Do not add props until internals are ideal.

The internal API should be more precise:

```ts
export interface FrameOverlayProps {
  frameNumber: number
  frameRect: Size
  scale: number
  rotation: QuarterTurn
}
```

`PageOverlayProps` can be mapped from `FrameOverlayProps` at the public boundary.

## Source Model

Target source contract:

```ts
export interface FrameSource {
  kind: "native-image" | "tiff"
  frames: readonly FrameDescriptor[]
  acquire(frameIndex: number): Promise<ImageBitmap>
  release(frameIndex: number): void
  dispose(reason?: Error): void
}

export interface FrameDescriptor {
  intrinsicSize: Size
}
```

Rules:

- `FrameSource` owns decoded bitmap lifetime.
- `FrameSource` does not know React exists.
- `FrameSource` does not know scroll, toolbar, overlays, or DOM.
- `acquire` pins a frame.
- `release` unpins a frame.
- `dispose` closes all bitmaps and rejects pending work.

`createFrameSource` should route only by bytes:

```ts
export async function createFrameSource(request: FrameSourceRequest) {
  const bytes = await fetchImageBytes(request.src)
  if (isTiff(bytes)) return createTiffFrameSource(bytes.buffer)
  return createNativeImageFrameSource(bytes)
}
```

## Bitmap Cache

The decoded frame cache should be a small, named object instead of inline maps.

```ts
interface BitmapCache {
  get(frameIndex: number): ImageBitmap | undefined
  set(frameIndex: number, bitmap: ImageBitmap): void
  pin(frameIndex: number): void
  unpin(frameIndex: number): void
  dispose(): void
}
```

Rules:

- `BitmapCache` is responsible for closing bitmaps.
- `FrameSource` is responsible for deciding when to use it.
- No component should call `ImageBitmap.close()` directly.
- Eviction policy should be explicit: `maxDecodedFrames`.

## Source Manager

The current `sourceCache` should become `FrameSourceManager`.

Target shape:

```ts
interface FrameSourceLease {
  source: FrameSource
  release(): void
}

interface FrameSourceManager {
  load(src: string): Promise<FrameSource>
  retain(src: string, source: FrameSource): FrameSourceLease
  clear(): void
}
```

Naming rules:

- `retain` means "a mounted viewer is using this source."
- `release` means "that viewer no longer uses it."
- `evict` means "the manager removed an unused source."
- `dispose` means "the source released owned resources."

Avoid `activeCount` leaking into component code.

Policy:

- Unmounted sources are disposed immediately unless there is a clear UX reason
  to preserve them.
- If preserved, retention and eviction must be explicit and tested.
- Loading entries are not eviction candidates until they resolve or reject.
- Rejected loads are removed so retry is possible.

## TIFF Protocol

Move main-thread worker client code into `image-tiff-source.ts`.

Target client concepts:

```ts
interface TiffWorkerClient {
  init(buffer: ArrayBuffer): Promise<readonly FrameDescriptor[]>
  decode(frameIndex: number): Promise<ImageBitmap>
  dispose(reason?: Error): void
}
```

Rules:

- `TiffWorkerClient` owns request ids and pending request maps.
- `TiffWorkerClient` rejects all pending requests on worker failure.
- `TiffWorkerClient` closes late decoded bitmaps with no pending request.
- `TiffFrameSource` composes `TiffWorkerClient` and `BitmapCache`.
- React components never call `worker.postMessage`.

Worker messages should be named and typed:

```ts
type TiffWorkerRequest =
  | { type: "init"; buffer: ArrayBuffer }
  | { type: "decodeFrame"; requestId: number; frameIndex: number }

type TiffWorkerResponse =
  | { type: "initOk"; frames: FrameDescriptor[] }
  | { type: "initError"; message: string }
  | { type: "decodeFrameOk"; requestId: number; bitmap: ImageBitmap }
  | { type: "decodeFrameError"; requestId: number; message: string }
```

Avoid ambiguous message names like `"decoded"` or `"error"`.

## Geometry

All geometry belongs in `image-geometry.ts`.

Target types:

```ts
export type QuarterTurn = 0 | 90 | 180 | 270

export interface Size {
  width: number
  height: number
}

export interface NormalizedBox {
  left: number
  top: number
  width: number
  height: number
}
```

Functions:

```ts
normalizeRotation(rotation: number): QuarterTurn
rotatedSize(size: Size, rotation: QuarterTurn): Size
rotateNormalizedBox(box: NormalizedBox, rotation: QuarterTurn): NormalizedBox
frameCssSize(size: Size, scale: number, rotation: QuarterTurn): Size
```

Rules:

- Store source boxes in the unrotated source coordinate space.
- Convert once at render time.
- Do not duplicate rotation math in overlay adapters.
- Tests must cover all quarter turns.

Ideal rendering model:

- Canvas and overlay are siblings inside the same rotated frame coordinate
  system, or both are transformed through the same geometry helper.
- There should be no special-case overlay math outside `image-geometry.ts`.

## React Lifecycle

Choose one policy and make it unambiguous:

### Preferred For This Repo

React 19 only.

Rules:

- Use callback-ref cleanup for DOM-bound resources.
- Document React 19 as a registry requirement.
- Tests should assume React 19 behavior.

### Alternative For Wider Registry Use

React 18 compatible.

Rules:

- Use `useEffect` for observers and canvas acquire/release.
- Drop the "no useEffect" marketing claim.
- Keep source/model code unchanged.

Do not half-support both.

## Frame Rendering

`ImageFrame` should be boring.

Ideal responsibilities:

- Reserve the correct rotated CSS box.
- Observe near-viewport state.
- Render skeleton or `ImageFrameCanvas`.
- Render overlay slot with geometry props.

`ImageFrameCanvas` should:

- Acquire bitmap.
- Size canvas by CSS size and DPR.
- Draw exactly once per source/index/scale/rotation/DPR tuple.
- Release on cleanup.
- Surface decode errors to the nearest error boundary.

It should not know:

- TIFF.
- Source cache.
- Toolbar.
- Download.
- Source-link highlight semantics.

## Error Model

Use typed internal errors.

```ts
class ImageLoadError extends Error {}
class ImageDecodeError extends Error {}
class ImageSourceDisposedError extends Error {}
class TiffWorkerError extends Error {}
```

Rules:

- Internal errors should preserve cause.
- The user-facing fallback stays calm and generic.
- Test assertions should use error classes, not string fragments.
- Dev-only logging can expose details if needed.

## Tests

Ideal test layout:

```txt
tests/image-geometry.test.ts
tests/image-frame-source.test.ts
tests/image-source-manager.test.ts
tests/image-tiff-source.test.ts
tests/image-source-overlay.test.tsx
tests/image-viewer-render.test.tsx
```

Required coverage:

- TIFF detection by extension, MIME, and magic bytes.
- Native image source creation.
- TIFF source creation through fake worker client.
- Frame acquire/release pins and unpins.
- Failed decode retries.
- Disposal rejects pending decodes.
- Late decoded bitmaps are closed.
- Bitmap cache evicts only unpinned frames.
- Source manager retain/release semantics.
- Source manager retry after failed load.
- Source manager eviction/disposal.
- Geometry transforms for all quarter turns.
- Overlay rendering uses geometry helpers.
- Viewer source switch does not draw old bitmaps.
- Viewer unmount releases source lease.

Browser verification:

- Native image docs demo renders.
- Multi-page TIFF sample renders.
- Large TIFF scrolling does not grow decoded bitmap count unboundedly.
- Rotation keeps highlights aligned.
- Worker count returns to baseline after unmount/navigation.

## Implementation Plan

1. Extract pure geometry into `registry/new-york-v4/lib/image-geometry.ts`.
2. Move bitmap cache and source core into
   `registry/new-york-v4/lib/image-frame-source.ts`.
3. Move URL-level source management into
   `registry/new-york-v4/lib/image-source-cache.ts`.
4. Move the main-thread TIFF worker protocol into
   `registry/new-york-v4/lib/image-tiff-source.ts`.
5. Rename worker messages to explicit `initOk`, `decodeFrameOk`, etc.
6. Move frame slot/canvas rendering into
   `registry/new-york-v4/ui/image-viewer-frame.tsx`.
7. Move toolbar/skeleton/error fallback into
   `registry/new-york-v4/ui/image-viewer-chrome.tsx`.
8. Shrink `image-viewer.tsx` to public API, layout, ref handle, and composition.
9. Update `image-source.tsx` to use `rotateNormalizedBox`.
10. Split current focused tests into pure module tests.
11. Add component tests for source switching and unmount lease release.
12. Rebuild registry outputs.
13. Run browser verification on docs samples.

## Non-Goals

- Do not create a public `TiffViewer`.
- Do not add server-side conversion.
- Do not add editing/annotation tools.
- Do not add new visual design.
- Do not add more public props during the idealization pass.
- Do not optimize before source ownership and naming are exact.

## Acceptance Criteria

- `image-viewer.tsx` is under 250 lines and contains no worker protocol code.
- No React component imports UTIF, Worker protocol types, or bitmap cache
  internals.
- Every module has one clear responsibility.
- Every exported helper has focused tests.
- No variable name conflates source/frame/page/cache/lease/disposal concepts.
- Worker messages are explicit and symmetric.
- All source-owned resources have deterministic disposal.
- Rotated overlays are correct by shared geometry, not duplicated math.
- Registry docs state the React lifecycle requirement clearly.
- Focused tests and browser verification pass.
