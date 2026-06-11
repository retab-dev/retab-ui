# Image Viewer Final Perfection Blueprint

This blueprint is the finishing pass for `ImageViewer` after the TIFF refactor.
The implementation is now modular and robust; this document names the remaining
work required before calling it ideal.

Platonic ideal means:

- Everything needed.
- Nothing more.
- Exact ownership boundaries.
- Exact variable names.
- Behavior that can be proved by focused tests.

This is not a request for new features. It is a request to remove ambiguity.

## Current State

The component now has the right large-scale shape:

- `image-viewer.tsx`: public shell, public types, Suspense, error boundary.
- `image-viewer-content.tsx`: viewer orchestration and scroll behavior.
- `image-viewer-frame.tsx`: viewport-aware frame rendering and canvas drawing.
- `image-viewer-chrome.tsx`: toolbar, loading, error UI.
- `image-frame-source.ts`: frame source contract, bitmap cache, disposal.
- `image-source-cache.ts`: URL-scoped source loading and retention.
- `image-tiff-source.ts`: main-thread TIFF worker client.
- `image-viewer.worker.ts`: worker-side UTIF decode.
- `image-geometry.ts`: rotation and frame geometry.
- `image-source.tsx`: document-source overlay adapter.

The public shell is small enough. The worker protocol is explicit. Decoded
bitmaps are owned by `FrameSource`. Registry artifacts build. Focused tests pass.

The remaining imperfections are smaller but real:

- Public types live in a file that imports the content component, while the
  content component type-imports those public types.
- `scale` behaves like an initial value, not a precise controlled prop.
- `FrameSourceManager` names imply retained idle caching, but zero-lease release
  currently disposes immediately.
- TIFF worker-client behavior lacks direct tests.
- Some naming still carries compatibility vocabulary (`page`) through internal
  paths where `frame` is the real domain term.
- End-to-end visual smoke testing is blocked by unrelated docs app breakage.

## Non-Goals

Do not add:

- New viewer props.
- New toolbar controls.
- A plugin system.
- A second rendering strategy.
- TIFF editing, annotations, thumbnails, or virtualized page navigation.
- A global image prefetcher.
- Any abstraction shared with PDF/PPTX unless this component independently needs
  it today.

Perfection here is not extensibility theater. It is precise sufficiency.

## Target File Layout

Final target:

```txt
registry/new-york-v4/ui/image-viewer.tsx
registry/new-york-v4/ui/image-viewer-types.ts
registry/new-york-v4/ui/image-viewer-content.tsx
registry/new-york-v4/ui/image-viewer-frame.tsx
registry/new-york-v4/ui/image-viewer-chrome.tsx
registry/new-york-v4/lib/image-frame-source.ts
registry/new-york-v4/lib/image-source-cache.ts
registry/new-york-v4/lib/image-tiff-source.ts
registry/new-york-v4/lib/image-geometry.ts
registry/new-york-v4/ui/image-viewer.worker.ts
registry/new-york-v4/ui/image-source.tsx
```

Add root shims for registry consumers:

```txt
components/ui/image-viewer-types.ts
```

Only add this file. Do not add another shared barrel.

## Boundary Rules

### `image-viewer-types.ts`

Owns public viewer types only:

```ts
export interface PageOverlayProps
export interface ImageViewerHandle
export interface ImageViewerProps
```

Rules:

- No React component exports.
- No imports from `image-viewer.tsx`.
- No imports from `image-viewer-content.tsx`.
- Type-only imports are allowed only if needed for `React.ReactNode`.

### `image-viewer.tsx`

Owns only:

- Public `ImageViewer` component.
- Public compatibility exports.
- Suspense and client-only fallback wiring.

It should import public types from `image-viewer-types.ts`.

It should not define:

- `PageOverlayProps`
- `ImageViewerHandle`
- `ImageViewerProps`
- Worker creation.
- Source loading.
- Frame geometry.

### `image-viewer-content.tsx`

Owns:

- Scale state.
- Rotation state.
- Scroll progress.
- Visible frame detection.
- Mapping public overlay props to internal frame overlay props.
- Retaining and releasing a loaded source while mounted.

It should import public types from `image-viewer-types.ts`, not from
`image-viewer.tsx`.

### `image-source-cache.ts`

Owns:

- Loading sources by URL.
- Sharing an in-flight source promise for a URL.
- Retaining a loaded source while a mounted viewer uses it.
- Disposing sources according to its documented policy.

Its names must match its behavior exactly.

## Scale Semantics

The current `scale?: number` prop must become exact.

Choose one of two semantics and encode it in code and tests.

### Preferred Semantics

`scale` is controlled when provided.

Rules:

- If `scale` is a number, rendered scale is exactly that value.
- Toolbar zoom buttons should either be hidden/disabled for controlled scale, or
  call an explicitly named internal transition only when uncontrolled.
- If `scale` changes from parent, the viewer follows it on the next render.
- If `scale` changes from `undefined` to a number, fit-to-width stops and the
  provided scale wins.
- If `scale` changes from a number to `undefined`, fit-to-width resumes unless
  the user has manually zoomed in uncontrolled mode.

Suggested state:

```ts
const isScaleControlled = fixedScale !== undefined
const [uncontrolledScale, setUncontrolledScale] = React.useState<number | null>(
  null
)

const scale = fixedScale ?? uncontrolledScale ?? fitWidthScale
```

Toolbar callbacks:

```ts
function setViewerScale(nextScale: number | null) {
  if (isScaleControlled) return
  setUncontrolledScale(nextScale)
}
```

Rename local variables:

- `fixedScale` -> `controlledScale`
- `manualScale` -> `uncontrolledScale`
- `baseWidth` -> `firstFrameWidth`
- `containerWidth` -> `viewportContentWidth` or `frameListWidth`

Avoid names that encode implementation history rather than behavior.

## Source Manager Semantics

Make `FrameSourceManager` honest.

There are two acceptable policies.

### Policy A: Immediate Disposal

If zero leases means immediate disposal, rename accordingly:

- `maxRetainedSources` should be removed.
- `evictUnusedSources` should be removed or renamed to `disposeUnleasedSource`.
- `wasLeased` should disappear.
- The manager is not a retained source cache; it is an in-flight load deduper and
  mounted-source lifetime owner.

This is simpler and likely ideal.

### Policy B: Retained Idle Cache

If retaining idle sources is desired, implement it fully:

- On zero leases, keep the source in the manager.
- Evict only when `entries.size > maxRetainedSources`.
- Dispose only evicted idle sources.
- Make the policy visible in tests.

Do not keep today's hybrid. A name that suggests retention while the code
immediately disposes is not acceptable.

Preferred final shape:

```ts
export class FrameSourceManager {
  load(src: string, createTiffWorker: TiffWorkerFactory): Promise<FrameSource>
  retain(src: string, source: FrameSource): FrameSourceLease | null
  clear(): void
}
```

If policy A is chosen, document that `retain` exists to bind a loaded source to
the mounted component lifetime, not to keep idle sources alive.

## Worker-Client Tests

Add direct tests for `TiffWorkerClient` and `createTiffFrameSource`.

Required cases:

1. `init` posts bytes with transfer and resolves frame descriptors from
   `initOk`.
2. `initError` rejects with `TiffWorkerError`.
3. `decodeFrame` posts a unique request id and resolves the matching bitmap.
4. `decodeFrameError` rejects only the matching request.
5. `worker.onerror` rejects init and all pending decodes.
6. `worker.onmessageerror` rejects pending decodes.
7. `dispose()` rejects pending work and calls `terminate()`.
8. An unexpected late `decodeFrameOk` closes its bitmap instead of leaking it.

Use a small fake worker class. Do not spin up a real browser worker in unit
tests.

## Frame Source Tests

Add direct tests for `createFrameSource`.

Required cases:

1. Concurrent `acquire(frameIndex)` calls share one decode.
2. Failed decode is removed from the in-flight map and can retry.
3. `release(frameIndex)` unpins and allows eviction.
4. Eviction closes only unpinned bitmaps.
5. `dispose()` closes cached bitmaps.
6. `dispose()` rejects pending decodes.
7. A decode resolving after disposal closes the bitmap.

This is where resource ownership becomes provable.

## Source Manager Tests

Add direct tests for `FrameSourceManager`.

Required cases depend on the chosen policy.

For immediate disposal:

1. Multiple `load(src)` calls share one in-flight promise.
2. Rejected load deletes the entry so a later call retries.
3. `retain()` increments lease count.
4. Last `release()` disposes the source and deletes the entry.
5. `clear()` disposes resolved sources and marks pending sources for disposal.

For retained idle cache:

1. Zero-lease release does not dispose immediately.
2. LRU overflow disposes the least-recently-touched idle source.
3. Active leased sources are never evicted.
4. `clear()` disposes every resolved source.

Choose one policy before writing tests.

## Vocabulary Cleanup

Use `frame` internally.

Allowed public compatibility names:

- `PageOverlayProps`
- `renderPageOverlay`
- `onVisiblePageChange`
- `pageNumber` inside `PageOverlayProps`

Internal preferred names:

- `frameIndex`: zero-based.
- `frameNumber`: one-based.
- `currentFrameNumber`.
- `visibleFrameNumber`.
- `frameRect`.
- `frameListWidth`.
- `rotationQuarterTurn`.

Avoid internal names:

- `page`
- `pageNumber`, except at public adapter boundary.
- `fixedScale`.
- `manualScale`.
- `baseWidth`.
- `cache`, when `bitmapCache` or `sourceManager` is meant.

## Geometry Invariants

`image-geometry.ts` should remain the only place that knows rotation math.

Tests should prove:

- `normalizeRotation()` maps arbitrary degrees into `0 | 90 | 180 | 270`.
- `frameCssSize()` swaps width/height only for sideways rotations.
- `rotateNormalizedBox()` preserves area.
- Four clockwise quarter turns returns the original box.
- `rotateImageArea()` returns stable percentage values without floating-point
  noise.

Do not duplicate geometry formulas inside React components.

## Registry Requirements

Update all registry surfaces:

- `registry.json`
- `public/r/registry.json`
- `public/r/image-viewer.json`
- `public/r/image-source.json` if imports change
- root shims in `components/ui/*` and `lib/*`

`shadcn build --output public/r` must pass after the change.

Generated artifacts must include:

- `image-viewer-types.ts`
- `image-viewer-content.tsx`
- all image lib files used by the viewer

## Acceptance Criteria

The finishing pass is complete only when all of these are true:

1. `image-viewer.tsx` does not export or define public interfaces inline; it
   imports them from `image-viewer-types.ts`.
2. There is no type import cycle between `image-viewer.tsx` and
   `image-viewer-content.tsx`.
3. `scale` has exact controlled/uncontrolled semantics and tests.
4. `FrameSourceManager` names match its disposal/retention behavior.
5. Worker-client behavior has direct unit tests.
6. Frame-source resource ownership has direct unit tests.
7. Source-manager lifecycle has direct unit tests.
8. Internal code uses `frame` vocabulary consistently, except public compatibility
   adapters.
9. `shadcn build --output public/r` passes.
10. `vitest run tests/image-viewer.test.tsx` passes.
11. A filtered typecheck for image viewer/source files reports no diagnostics.
12. If the docs app is still broken, the failure is documented with the unrelated
    file path and error; do not claim visual end-to-end verification.

## Suggested Implementation Order

1. Extract `image-viewer-types.ts` and update imports.
2. Fix scale semantics and rename scale variables.
3. Choose source-manager policy A or B; prefer policy A unless a caller needs
   idle source retention.
4. Rename source-manager variables to match the chosen policy.
5. Add worker-client tests.
6. Add frame-source tests.
7. Add source-manager tests.
8. Sweep internal `page` vocabulary.
9. Rebuild registry artifacts.
10. Run focused tests, filtered typecheck, registry build, and docs smoke test.

## Definition Of Done

The final code should read this way:

- Public shell says what the component is.
- Content says how React wires viewer state to source frames.
- Frame says how one frame appears.
- Source says how pixels are owned.
- Worker client says how TIFF decode requests move across the boundary.
- Geometry says how boxes rotate.
- Tests say why each ownership claim is true.

Nothing else belongs in the component.
