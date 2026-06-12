# Text Viewer Blueprint

This is the target design for the standalone `TextViewer` used by source
linking. It is intentionally separate from the streamed text viewer inside
`FileViewer`: `TextViewer` loads and renders the whole text document so every
line can be highlighted and scrolled to by source anchors.

## North Star

`TextViewer` should be a reliable source-linked plain text viewer.

```tsx
<TextViewer
  source={{
    kind: "url",
    url: "/samples/extraction-run.log",
    fileName: "extraction-run.log",
  }}
  highlight={{ start: 21, end: 24 }}
/>
```

It should make line ranges addressable, keep the viewer chrome predictable, and
fail locally when a text resource cannot be loaded.

## Non-Goals

- Do not merge this viewer with the virtualized text implementation in
  `file-viewer.tsx`.
- Do not optimize for arbitrary 200 MB logs here.
- Do not add syntax highlighting unless source-linked plain text needs it.
- Do not turn this into a document router. `FileViewer` owns that boundary.

## Current Assessment

The implementation in `registry/new-york-v4/ui/text-viewer.tsx` has the right
basic shape:

- It supports URL, Blob, and text sources through one `source` prop.
- It uses Suspense with a stable promise cache for fetched text.
- It renders explicit line nodes with `data-line`, which makes source anchors
  addressable.
- It exposes an imperative `scrollToLines` handle.
- It keeps the whole-file tradeoff documented near the component.

It is not yet final.

Remaining concerns:

- Fetch failures are cached permanently and are not caught by a local error
  boundary.
- `scrollToLines(lineStart, lineEnd)` ignores `lineEnd`.
- The loading fallback always renders toolbar chrome, even when
  `toolbar={false}`.
- `highlight` and source anchors are not normalized, so invalid ranges silently
  produce inconsistent behavior.
- There are no focused tests for loading, error recovery, toolbar fallback, or
  range scrolling.

## Public API

Keep the API narrow and source-link focused.

```ts
export interface TextViewerHandle {
  scrollToLines: (
    lineStart: number,
    lineEnd: number,
    options?: ScrollToOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export interface TextViewerProps {
  source: TextDocumentSource
  className?: string
  toolbar?: boolean
  highlight?: { start: number; end: number } | null
  bare?: boolean
  maxBytes?: number
  maxLines?: number
}
```

Rules:

- `source` is the file identity and error-boundary reset input.
- `toolbar={false}` affects both fallback and loaded states.
- `highlight` is a 1-based inclusive line range.
- Invalid ranges should normalize to a no-op, not create impossible DOM queries.

## Invariants

These rules should be true after hardening:

1. A failed fetch renders a local text-viewer error state.
2. Changing `source` after an error gives the new resource a fresh attempt.
3. A rejected fetch promise is not cached forever.
4. `scrollToLines(start, end)` reveals the requested range, not only the first
   line.
5. `highlight` and `scrollToLines` use the same range normalization.
6. The fallback toolbar matches the requested toolbar state.
7. Text sources render during SSR/hydration without needing client fetch.
8. Download is derived from `resource.getOriginalDownload()`.
9. Large-file behavior is explicitly bounded or documented at call sites.
10. `TextViewer` never imports or depends on `FileViewer`.

## Range Normalization

Add a small pure helper and use it everywhere a line range enters the viewer.

```ts
interface LineRange {
  start: number
  end: number
}

function normalizeLineRange(
  range: LineRange | null | undefined,
  lineCount: number
): LineRange | null
```

Rules:

- Clamp to `1..lineCount`.
- Swap `start` and `end` if callers pass them reversed.
- Reject non-finite values.
- Reject empty documents only if the rendered line count is truly zero.
- Use the normalized range for both highlighting and scroll.

## Range Scrolling

`scrollToLines` should reveal the full range when practical.

Target behavior:

- If the full range fits in the viewport, center it with modest headroom.
- If the range is taller than the viewport, align the first line near the top.
- Respect caller-provided `behavior`.
- Do nothing when the normalized range has no matching row.

Implementation can stay DOM-based because this viewer renders all lines.

## Async And Cache Rules

The text resource cache should remain small and explicit.

Target cache entry:

```ts
interface TextResource {
  promise: Promise<string>
  status: "pending" | "fulfilled" | "rejected"
}
```

Rules:

- Cache by `resource.cacheKey`, bounds, and retry version.
- Delete or replace rejected entries so retry is possible.
- Keep fulfilled entries reusable for the same source and bounds.
- Do not add global eviction unless this viewer starts handling unbounded user
  files.

## Error Boundary

Mirror the other leaf viewers (`PdfViewer`, `ImageViewer`, `DocxViewer`,
`XlsxViewer`) with a local error boundary.

Rules:

- Wrap the Suspense body in `TextViewerErrorBoundary`.
- Reset on source identity and retry version.
- Render a compact local message: `Couldn’t load this text file.`
- Preserve `className` and `bare` layout semantics in the error state.
- Do not let a failed text fetch take down the whole route.

## Layout And Chrome

The toolbar should stay simple:

- Left side: line count.
- Right side: zoom controls and optional download.
- Icon buttons stay square and fixed-size.
- The fallback mirrors only the chrome that will exist in the loaded viewer.
- `bare` changes the outer frame only.

Avoid adding filename display to this component unless it becomes a repeated
consumer need. `FileViewer` already owns filename chrome for routed documents.

## Source-Link Adapter

`text-source.tsx` should stay tiny.

Responsibilities:

- Convert a `text_span` anchor into a 1-based line range.
- Build a stable `SourceTarget` from `TextViewerHandle`.
- Convert active source to `TextViewer` highlight props.

Do not move range normalization into `text-source.tsx`; the viewer owns its DOM
line count and should be the final authority.

## Tests

Add focused tests before broad visual work.

Pure tests:

- `normalizeLineRange` clamps ranges.
- Reversed ranges are swapped.
- Non-finite values return `null`.
- Out-of-document ranges return a valid clamped range or `null` consistently.

Component tests:

- Text sources render line numbers and text.
- `toolbar={false}` hides toolbar in fallback and loaded states.
- `highlight` marks every line in a multi-line range.
- `scrollToLines` uses both `lineStart` and `lineEnd`.
- Failed URL sources render the local error state.
- Changing `source` after an error retries with the new resource.

Manual verification:

- Open the text sources block and hover fields.
- Confirm highlighted lines remain visible after zoom changes.
- Confirm download still points at the original source.

## Migration Plan

1. Add `normalizeLineRange` and tests.
2. Update highlight rendering to use normalized ranges.
3. Update `scrollToLines` to reveal the normalized full range.
4. Add `TextViewerErrorBoundary` with source reset behavior.
5. Change the cache so rejected fetches do not poison future renders.
6. Make `TextViewerFallback` accept and honor `toolbar`.
7. Add component tests for failure, retry, fallback chrome, and range behavior.
8. Rebuild registry artifacts after the source component is final.

## Done Criteria

`TextViewer` is done when it is boring under failure:

- Missing files produce a local error.
- Source changes recover.
- Multi-line spans highlight and scroll correctly.
- Fallback chrome matches loaded chrome.
- The component remains separate from streamed large-text viewing.
