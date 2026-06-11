# File Viewer Blueprint

This is the target design for `FileViewer` after the current implementation is
hardened. The component is already directionally strong: it detects file types,
code-splits heavy viewers, streams large text files, uses bounded caches, and
keeps untrusted markdown/HTML contained. The remaining work is mostly about
making async state, cache ownership, and verification as rigorous as the design.

## North Star

`FileViewer` should be a small, reliable router from a file descriptor to the
right specialized viewer.

```tsx
<FileViewer src="/samples/report.pdf" fileName="report.pdf" />
```

It should provide consistent chrome, download behavior, loading behavior, and
error recovery across formats while letting the leaf viewers own format-specific
layout and parsing.

## Public API

Keep the public API narrow:

```ts
export interface FileViewerProps {
  src: string
  fileName?: string
  mimeType?: string
  as?: FileCategory
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}
```

Rules:

- `src` is the resource identity.
- `fileName`, `mimeType`, and `as` are viewer-selection inputs.
- `bare` only changes outer chrome density.
- `isolateStyles` only affects dense virtualized grids.
- New format-specific controls belong in the leaf viewer first. Add them to
  `FileViewer` only when the same concept applies across formats.

## Current Assessment

The implementation in `registry/new-york-v4/ui/file-viewer.tsx` has good
foundations:

- Heavy viewers are `React.lazy` loaded by category.
- `ViewerFallback` mirrors the final chrome instead of flashing a generic block.
- Markdown is sanitized before inline rendering.
- HTML is rendered in a sandboxed iframe.
- Large text/log files load by byte range and virtualize visible rows.
- JSON syntax highlighting is visible-line scoped.
- Resource caches are bounded for text and markdown.
- Style isolation is available for dense virtualized viewers under hostile host
  CSS, especially broad `:has()` selectors.

It is not yet the final design.

Remaining concerns:

- A stale text range request can update state after the mounted viewer has moved
  to a different file.
- The text first-chunk cache is keyed only by `src`, even though behavior also
  depends on whether the caller needs the whole file (`loadAll` for JSON).
- The top-level error boundary resets only on `src`, not on other
  viewer-selection inputs.
- Toolbar layout can degrade in narrow containers with long filenames.
- There are no focused `FileViewer` regression tests for detection, prop changes,
  cache modes, or error-boundary recovery.

## Invariants

These rules should be true after hardening:

1. A result fetched for one file must never render into another file.
2. Cache keys must include every input that changes fetch or parse semantics.
3. Error boundaries must recover when any viewer-selection input changes.
4. The fallback category and mounted category must be computed from the same
   normalized descriptor.
5. Download labels must be stable and predictable for every format.
6. Leaf viewers own parsing, document layout, and format-specific controls.
7. Shared chrome owns filename, meta, zoom cluster placement, and download.
8. Text streaming must stay incremental for large logs.
9. JSON rendering may load the whole file, but that mode must not poison text
   streaming cache entries for the same URL.
10. Style isolation must be opt-in and must not be required for correct visuals.

## File Descriptor

Introduce a tiny internal descriptor so detection, fallback, reset keys, and
downloads do not each recompute slightly different state.

```ts
interface FileDescriptor {
  src: string
  displayName: string
  downloadName: string
  mimeType?: string
  category: FileCategory
}

function resolveFileDescriptor(props: FileViewerProps): FileDescriptor
```

`resolveFileDescriptor` should be pure and directly tested.

Rules:

- `displayName = fileName ?? src`
- `downloadName = fileName ?? extractName(src)`
- `category = as ?? detectCategory(displayName, mimeType)`
- The error-boundary reset key should include `src`, `displayName`, `mimeType`,
  and `category`.

## Async State Rules

Text loading should guard every async continuation with a request identity.

Target pattern:

```ts
const requestKey = textRequestKey(src, mode)

void loadNextChunk(requestKey).then((next) => {
  if (currentRequestKeyRef.current !== requestKey) return
  setSnap(next)
  setLoadingMore(false)
})
```

Rules:

- Do not call `setSnap` from a stale request.
- Clear `loadingMore` for the current request only.
- Use `try/finally` or a rejection path so failed range requests do not leave the
  viewer permanently busy.
- Reset token caches when the text mode or displayed file changes, not only when
  `src` changes.

## Cache Keys

The text cache needs an explicit mode.

```ts
type TextLoadMode = "stream" | "full"

function textCacheKey(src: string, mode: TextLoadMode): string
```

Rules:

- Plain text, logs, and code use `stream`.
- JSON uses `full`.
- `firstChunkCache` and `textLoaderCache` use the same key.
- Eviction of the first-chunk entry also evicts the paired streaming loader.
- Cache entries should not be shared across incompatible modes.

Markdown and HTML may keep their existing URL caches, because their semantics are
single-mode per helper.

## Shared Chrome

`DocShell` should stay small and boring.

Responsibilities:

- Render title, optional meta, actions, separator, and download.
- Guarantee title truncation in narrow containers.
- Keep toolbar height stable between fallback and hydrated viewer.

Target toolbar behavior:

- Filename span has `min-w-0` and flex shrink semantics.
- Actions remain visible when possible.
- Long meta text truncates or yields before actions do.
- Icon buttons keep stable square dimensions.

## Format Boundaries

`FileViewer` should route only. Leaf viewers should continue to own these areas:

- `PdfViewer`: PDF loading, pages, page overlays, page scrolling.
- `DocxViewer`: DOCX rendering, target resolution, highlighting.
- `ImageViewer`: image/TIFF detection, frame decoding, bitmap lifecycle.
- `PptxViewer`: slide rendering and navigation.
- `XlsxViewer`: workbook loading, sheet state, table virtualization.
- `CsvViewer`: CSV streaming/parsing, table virtualization.
- `TextDocViewer`: byte-range loading, line virtualization, JSON display.
- `MarkdownDocViewer`: markdown fetch, parse, sanitize, prose styling.
- `HtmlDocViewer`: text fetch and sandboxed iframe rendering.

Avoid moving leaf-viewer internals into `FileViewer` just to make routing look
uniform.

## Tests

Add focused tests before broad visual work.

### Pure Tests

Create tests for:

- `detectCategory`
- `extensionOf` behavior through `detectCategory`
- MIME fallback when extension is absent
- extension precedence over MIME
- `resolveFileDescriptor`
- text cache key mode separation

### Component Tests

Add React tests for:

- same mounted `FileViewer` switching from one text `src` to another while a
  range request is pending
- same `src` rendered once as text and once as JSON
- error boundary recovery when `as`, `mimeType`, or `fileName` changes
- long filename toolbar truncation preserving the download action
- unsupported files rendering the download fallback

### Browser Verification

Use the docs demo samples to verify:

- PDF, image, TIFF, XLSX, PPTX, DOCX, CSV, markdown, HTML, JSON, and log all
  render without console errors.
- Zoom controls stay stable in the toolbar.
- `isolateStyles` does not visibly change dense text/CSV/XLSX rendering.
- Narrow containers keep actions accessible.

## Implementation Plan

1. Extract `resolveFileDescriptor` and use it in `FileViewer`,
   `FileViewerInner`, and `ViewerFallback`.
2. Expand the error-boundary reset key to cover every viewer-selection input.
3. Add explicit text load modes and mode-aware cache keys.
4. Guard text range request continuations against stale mounted state.
5. Make text range failure clear `loadingMore` and surface through the existing
   error boundary.
6. Tighten `DocShell` toolbar flex behavior for long filenames and meta text.
7. Add pure tests for detection, descriptors, and text cache keys.
8. Add component regression tests for same-mounted prop changes.
9. Run the local docs demo and do a browser pass over every sample format.

## Non-Goals

- Do not rewrite the leaf viewers.
- Do not add a plugin system for file types.
- Do not add server-side conversion to `FileViewer`.
- Do not make `FileViewer` responsible for source-link highlighting.
- Do not replace the byte-range text path with whole-file fetches.
- Do not turn `isolateStyles` on by default without performance evidence.
- Do not redesign the viewer visuals while hardening state behavior.

## Acceptance Criteria

The implementation is ready when:

- Switching files in one mounted `FileViewer` cannot show stale content.
- Text and JSON modes cannot share incompatible cache entries.
- Error boundaries recover on any relevant prop change.
- Toolbar controls remain visible with long filenames in small containers.
- Focused tests cover the async and cache regressions above.
- The sample demo renders every advertised format without console errors.
