# Image Viewer Platonic Closure Blueprint

This blueprint covers the last objections after the final perfection pass. The
component is now clean, modular, tested, and registry-safe. What remains is not a
rewrite. It is closure.

Platonic closure means every remaining edge is either:

- Removed by code.
- Proven by a test.
- Documented as intentional compatibility.

No new features are allowed.

## Current State

The component now satisfies the core architecture:

- Public types live in `image-viewer-types.ts`.
- `image-viewer.tsx` is a small public shell.
- `image-viewer-content.tsx` owns viewer state and public-to-internal mapping.
- `image-viewer-frame.tsx` owns lazy frame rendering.
- `image-frame-source.ts` owns decoded bitmap lifetime.
- `image-source-cache.ts` owns source load deduplication and mounted lifetime.
- `image-tiff-source.ts` owns main-thread worker protocol.
- `image-viewer.worker.ts` owns UTIF decode.
- `image-geometry.ts` owns rotation math.

Focused unit tests cover worker protocol, frame-source ownership,
source-manager lifecycle, scale semantics, and overlay geometry. Registry build
passes. The docs route returns 200.

The remaining objections are specific:

1. A source loaded during a render that never commits can resolve without being
   retained or disposed.
2. Mounted-source release relies on callback-ref cleanup semantics.
3. Worker tests use a fake worker, not a real TIFF fixture.
4. Smoke verification proves the docs route responds, but not that an actual
   TIFF paints pixels.
5. Public compatibility uses `page` vocabulary while internals use `frame`.
6. Registry root shims are necessary but should stay deliberately minimal.

## Non-Goals

Do not add:

- New props.
- New toolbar controls.
- New layout modes.
- A generic resource framework.
- Virtualization.
- Thumbnail rails.
- Annotation APIs.
- Any shared abstraction with PDF/PPTX.

Do not rename public props unless a compatibility alias preserves the old API.

## 1. Abandoned Load Ownership

Problem:

`React.use(getImageSource(src))` can start source loading during render. If the
render is abandoned before `ImageViewerContent` commits, the current callback ref
never retains the source, so the manager may keep a resolved source indefinitely.

Target invariant:

Every source loaded by `FrameSourceManager` has a deterministic owner:

- A committed viewer lease.
- A pending load entry.
- Or a disposal path when no commit claims it.

Preferred solution:

Make `FrameSourceManager.load()` support an explicit unclaimed-source timeout.

```ts
interface FrameSourceManagerOptions {
  maxDecodedFrames?: number
  unclaimedSourceTimeoutMs?: number
}
```

Behavior:

- New entries start with `leaseCount = 0`.
- When a source resolves with `leaseCount = 0`, schedule disposal.
- `retain(src, source)` cancels the unclaimed disposal timer.
- Last `release()` disposes immediately.
- `clear()` cancels timers and disposes/marks every entry.
- Rejected loads still delete the entry immediately.

Use a short default, for example `30_000`, so a legitimate React commit has time
to retain the source. In tests, use `0` or fake timers.

Required tests:

1. Resolved-but-unretained sources are disposed after the unclaimed timeout.
2. `retain()` before the timeout cancels unclaimed disposal.
3. `clear()` cancels unclaimed timers.
4. A source disposed as unclaimed is removed so a later `load()` retries.

Naming:

- `unclaimedSourceTimeoutMs`
- `unclaimedDisposeTimer`
- `scheduleUnclaimedDispose`
- `cancelUnclaimedDispose`

Avoid `cacheTimeout`, `gc`, or generic `timer`.

## 2. Mounted Lifetime Without Callback-Ref Dependence

Problem:

The current mounted lifetime is bound to a callback ref cleanup. That is valid
for React 19, but the ideal version should make the dependency explicit and
localized.

Target shape:

Create a tiny local hook:

```ts
function useFrameSourceLease(src: string, source: FrameSource): void
```

Implementation may still use callback-ref cleanup or `useEffectEvent`-style
patterns available in this project, but the public component should not carry
raw lease mechanics inline.

Rules:

- The hook lives in `image-viewer-content.tsx` unless it exceeds 30 lines.
- It must be named for ownership, not React mechanics.
- `ImageViewerContent` should read as viewer orchestration.

Required tests:

- Existing manager tests should remain the primary proof.
- Component smoke tests should still show the viewer releases on unmount if that
  can be asserted without brittle internals.

## 3. Real TIFF Fixture Test

Problem:

Fake-worker tests prove protocol behavior, but not that UTIF can decode an
actual TIFF through the worker implementation.

Target:

Add one tiny TIFF fixture and one integration-style test.

Fixture requirements:

- Smallest practical valid TIFF.
- Checked into an existing test fixture location, not generated at runtime.
- Prefer a 1x1 or 2x2 uncompressed TIFF.
- Keep the file under 1 KB if possible.

Test options:

### Option A: Worker Unit Test

Import the worker module in a test harness that provides a fake `self` and
`createImageBitmap`.

Assert:

- `init` returns one frame with expected dimensions.
- `decodeFrame` returns a bitmap-like object.
- Invalid frame index returns `decodeFrameError`.

### Option B: Browser Smoke Test

Use the local docs/demo page with a fixture TIFF and verify canvas pixels in a
real browser.

This is stronger but heavier. Prefer this only if the repo already has a stable
browser verification harness.

Required acceptance:

- At least one real TIFF byte sequence is decoded by the real UTIF worker code
  path or by a browser smoke test that exercises the shipped worker.

## 4. Canvas Pixel Verification

Problem:

HTTP 200 proves route health, not rendering correctness.

Target:

Add a browser verification step for `ImageViewer` that proves a decoded frame
paints nonblank pixels.

Minimum check:

- Start the docs/demo app.
- Open the image viewer docs/demo route.
- Wait for a canvas inside `[data-slot="image-frame"]`.
- Read canvas pixels.
- Assert at least one pixel has nonzero alpha or nonwhite RGB, depending on the
  fixture.

If no browser tool is available in the current environment, document that the
verification is blocked and keep the unit tests as the fallback. Do not pretend
HTTP 200 is visual verification.

## 5. Public `page` Compatibility

Problem:

The public API keeps PDF-compatible names:

- `renderPageOverlay`
- `onVisiblePageChange`
- `PageOverlayProps`
- `pageNumber`

Internally the domain is `frame`.

Target:

Make compatibility explicit without breaking users.

Add frame-first aliases:

```ts
export interface FrameOverlayPublicProps {
  frameNumber: number
  width: number
  height: number
  scale: number
  rotation: number
}

export type PageOverlayProps = FrameOverlayPublicProps & {
  pageNumber: number
}
```

Or, if that shape is awkward, document in `image-viewer-types.ts` that `page`
names are public compatibility with the PDF viewer and map to frames internally.

Acceptance:

- Internal files use `frame` vocabulary.
- Public `page` names are documented as compatibility.
- No ambiguous internal `page` variables remain outside the public adapter
  boundary.

## 6. Registry Shim Minimalism

Problem:

Root shims are required by the repo's registry pattern, but they should not
become architecture.

Rules:

- Root shim files contain only `export * from ...`.
- No logic in `components/ui/image-viewer-types.ts`.
- No new barrels.
- Registry item includes exactly the files required by consumers.

Acceptance:

- `components/ui/image-viewer-types.ts` remains one line.
- `components/ui/image-viewer-content.tsx`, `image-viewer-frame.tsx`, and
  `image-viewer-chrome.tsx` remain one-line shims.
- `lib/image-*.ts` shims remain one-line shims.

## Verification Checklist

Run:

```bash
./node_modules/.bin/vitest run tests/image-viewer.test.tsx
./node_modules/.bin/shadcn build --output public/r
./node_modules/.bin/tsc --noEmit --pretty false 2>&1 | rg 'image-viewer|image-source|image-frame-source|image-source-cache|image-tiff-source|image-geometry|tests/image-viewer'
```

Expected:

- Focused tests pass.
- Registry build passes.
- Filtered typecheck has no image-viewer/source diagnostics.

Also run a docs/browser smoke test:

```bash
./node_modules/.bin/next dev --port 3101
curl -I http://localhost:3101/docs/viewers/image-viewer
```

Expected:

- HTTP 200.
- If browser tooling is available, canvas pixel verification passes.

Full `tsc --noEmit` may still fail on unrelated repo-wide issues. If it does,
record the first unrelated paths and do not attribute them to `ImageViewer`.

## Acceptance Criteria

This blueprint is complete only when:

1. Resolved unclaimed sources cannot live forever.
2. Source retention mechanics are hidden behind a named ownership hook.
3. Worker protocol is tested with fake workers and at least one real TIFF path.
4. A canvas pixel smoke test exists, or the lack of browser tooling is explicitly
   documented.
5. Public `page` vocabulary is either aliased to frame-first names or documented
   as compatibility.
6. Registry shims remain logic-free.
7. Focused tests, registry build, and filtered typecheck pass.
8. The docs route returns 200.

After this, any remaining imperfection should be outside this component: repo
registry mechanics, public compatibility promises, or broader app health.
