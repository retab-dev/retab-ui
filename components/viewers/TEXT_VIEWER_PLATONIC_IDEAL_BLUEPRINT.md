# Text Viewer Platonic Ideal Blueprint

This document defines the ideal `TextViewer`: everything needed for source-linked
plain text viewing, nothing more.

The current component is good. This blueprint is stricter. It describes the
version that should feel inevitable after every line is questioned.

## Purpose

`TextViewer` exists for one job:

Render a bounded plain-text document so 1-based line ranges can be highlighted
and scrolled into view.

```tsx
<TextViewer
  src="/samples/extraction-run.log"
  highlight={{ start: 21, end: 24 }}
/>
```

It is not a general log viewer. It is not a code editor. It is not the text arm
of `FileViewer`. It is the source-linking viewer for text anchors.

## Non-Negotiables

1. Every rendered line is addressable.
2. Line ranges are normalized once, consistently.
3. Failed loads stay local to the viewer.
4. Retry behavior is explicit.
5. Loading, loaded, and error states share the same frame contract.
6. Public API contains only user-facing behavior.
7. Test-only helpers do not leak from the component module.
8. Whole-file loading is bounded by policy, not comments.
9. The component has no dependency on `FileViewer`.
10. Variable names use one vocabulary everywhere.

## Public API

The ideal API is small and exact.

```ts
export interface TextViewerHandle {
  scrollToLineRange: (
    range: TextLineRange,
    options?: ScrollToOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export interface TextViewerProps {
  src?: string
  value?: string
  className?: string
  toolbar?: boolean
  downloadName?: string
  highlight?: TextLineRange | null
  bare?: boolean
  maxBytes?: number
  maxLines?: number
}

export interface TextLineRange {
  start: number
  end: number
}
```

Rules:

- `value` and `src` are mutually exclusive in spirit. If both are passed, `value`
  wins, but tests document that behavior.
- `downloadName`, not `downloadFileName`, is the public name. It matches the
  action.
- `scrollToLineRange` takes the same shape as `highlight`; no parallel
  `(lineStart, lineEnd)` vocabulary.
- `maxBytes` and `maxLines` make whole-file loading an enforced contract.
- No exported cache-clearing function exists on the public component module.

## Vocabulary

Use these names everywhere:

| Concept | Name |
| --- | --- |
| 1-based inclusive range | `TextLineRange` |
| Normalized range | `NormalizedTextLineRange` |
| Text lines array | `textLines` |
| Scroll container | `viewportElement` |
| First line element | `startLineElement` |
| Last line element | `endLineElement` |
| Download filename | `downloadName` |
| Fetch/cache identity | `resourceKey` |

Avoid aliases like `lineStart`, `lineEnd`, `row`, `lit`, `srcKey`, or
`downloadFileName` inside the ideal implementation.

## Module Shape

Perfect modularization is three small modules plus one component.

### `text-viewer-ranges.ts`

Pure, React-free.

Owns:

- `TextLineRange`
- `NormalizedTextLineRange`
- `normalizeTextLineRange`
- `isLineInRange`

Rules:

- No DOM.
- No React.
- No viewer props.
- Fully tested.

### `text-viewer-resource.ts`

React-free resource loading.

Owns:

- bounded text fetch
- resource cache
- same-resource retry
- cache disposal for tests through an internal test import path

Rules:

- Cache key is `src`.
- Rejected resources are not permanently cached.
- Same-`src` retry is represented by a resource version/nonce, not by remounting.
- `maxBytes` is enforced before reading the whole body when possible.
- `maxLines` is enforced after decoding.

### `text-viewer-layout.ts`

DOM geometry helpers.

Owns:

- locating line elements
- computing scroll target
- deciding center vs top alignment

Rules:

- Pure functions receive DOM rectangles and dimensions.
- Imperative DOM lookup stays minimal in the component.
- Geometry is tested without rendering the full component.

### `text-viewer.tsx`

Composition only.

Owns:

- props
- refs
- toolbar/fallback/error composition
- rendering line elements

Forbidden:

- raw range math
- raw fetch logic
- cache mutation
- test-only exports

## State Model

The viewer has exactly four states:

```ts
type TextViewerState =
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "too_large"; reason: "bytes" | "lines" }
  | { status: "error" }
```

Suspense may still be used internally, but the user-facing states must map to
this model exactly.

## Error And Retry

The error state must be local and recoverable.

Requirements:

- Failed fetch renders `Could not load this text file.`
- Same-`src` retry is available when `src` is present.
- Changing `src` automatically resets the error state.
- Inline `value` cannot enter fetch error state.
- Error boundaries reset by `{ src, resourceVersion }`, not `src` alone.

The retry button belongs in the error state, not the toolbar.

## Bounds

The ideal component refuses inputs that violate its purpose.

Defaults:

```ts
const DEFAULT_MAX_BYTES = 1_000_000
const DEFAULT_MAX_LINES = 10_000
```

Rules:

- `value` is checked by byte length and line count.
- `src` is checked against `Content-Length` when available.
- If `Content-Length` is missing, the reader aborts once the byte limit is
  exceeded.
- Exceeding bounds renders a local too-large state with a download action when
  `src` is present.
- The component never silently tries to render an unbounded log.

## Rendering

Line rendering should be dense and predictable.

Rules:

- Empty documents render one empty line only if `text.split("\n")` produces one.
- Trailing newline behavior is documented and tested.
- Each line element has `data-line-number`.
- Highlight class is based only on `isLineInRange`.
- Gutter width is derived from `textLines.length`.
- No line rendering branch contains range math.

Target shape:

```tsx
{textLines.map((textLine, index) => {
  const lineNumber = index + 1
  return (
    <TextLine
      key={lineNumber}
      lineNumber={lineNumber}
      text={textLine}
      isHighlighted={isLineInRange(lineNumber, highlightRange)}
      gutterWidth={gutterWidth}
    />
  )
})}
```

`TextLine` may stay in the same file if it remains tiny.

## Toolbar

The toolbar owns only viewer controls.

Contents:

- line count
- zoom out
- zoom percentage
- zoom in
- reset zoom
- download, only for `src`

Rules:

- Fallback toolbar appears only when `toolbar !== false`.
- Error state does not show inert zoom controls.
- Download uses `downloadName` when provided.
- Download without a provided name uses browser default behavior.
- Toolbar button labels use one vocabulary: `Zoom out`, `Zoom in`, `Reset zoom`,
  `Download`.

## Scrolling

`scrollToLineRange` reveals the normalized full range.

Rules:

- If the range fits, center it.
- If the range does not fit, align its start near the top.
- Respect caller `behavior`.
- Do nothing for invalid ranges.
- Do nothing before content is ready.
- Never query for unsanitized selector strings.

Line lookup should use a helper:

```ts
function findLineElement(
  viewportElement: HTMLElement,
  lineNumber: number
): HTMLElement | null
```

## Tests

### Pure Range Tests

- clamps valid ranges
- swaps reversed ranges
- rejects non-finite values
- rejects fully out-of-document ranges
- handles trailing newline line counts
- `isLineInRange` returns false for `null`

### Resource Tests

- successful `src` load caches fulfilled text
- failed load can be retried for the same `src`
- changing `src` uses a distinct resource
- `maxBytes` rejects by `Content-Length`
- `maxBytes` rejects during stream read
- `maxLines` rejects after decoding
- inline `value` path enforces bounds

### Geometry Tests

- fitting range centers
- oversized range top-aligns
- scroll target clamps to zero
- caller behavior overrides default behavior

### Component Tests

- inline `value` renders line numbers and text
- `toolbar={false}` hides toolbar in fallback and loaded states
- multi-line highlight marks every included line
- invalid highlight marks no lines
- fetch error renders local error
- retry button retries same `src`
- changing `src` recovers from error
- too-large state renders locally
- download exists for `src`, not for `value`

## Visual Verification

Before calling the component ideal:

- Open `/view/blocks/text-sources`.
- Hover fields with single-line sources.
- Add a sample field with a multi-line source and verify full-range highlight.
- Test at 100%, zoomed in, and zoomed out.
- Test narrow container width.
- Test missing `src`.
- Test too-large `src`.

If browser automation is blocked, record that explicitly and do not claim visual
verification.

## Removal List

The ideal removes:

- public `clearTextViewerResourceCache`
- ambiguous `downloadFileName`
- positional `scrollToLines(lineStart, lineEnd)`
- comments as the only large-file guard
- test logic coupled to component internals
- cache retry behavior hidden inside the error boundary

## Done Criteria

The component reaches this ideal when:

- The public API is minimal and symmetric.
- Range, resource, and geometry logic are separate and directly tested.
- Same-`src` retry works without remounting.
- Whole-file bounds are enforced.
- Generated registry output is in sync.
- Focused unit tests, component tests, lint, and relevant type checks pass.
- Browser verification has been completed or honestly reported as blocked.

At that point, the implementation should read like it had only one possible
shape.
