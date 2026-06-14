# Text Viewer Native Chunk Prose Blueprint

## Purpose

Make prose text feel as fast as the Pretext Markdown Viewer by moving normal
text rendering from line-owned React layout to chunk-owned browser layout.

The current Text Viewer is precise but too eager to own visual lines. The
Pretext Markdown Viewer feels faster because it virtualizes coarse semantic
chunks, lets the browser lay out each mounted chunk, measures the resulting
height, and keeps scroll anchors stable while corrections arrive.

This blueprint defines the same strategy for plain prose without weakening the
Code Viewer or line-oriented text behavior.

## Current Truth

Text Viewer currently:

- reads bounded text through the shared text resource path
- prepares a source document with `createPreparedTextDocument`
- computes block frames with `layoutTextDocument`
- virtualizes frame windows with `getTextFrameVirtualItems`
- materializes visible wrapped lines with `materializeInlineVisibleLines`
- renders each visible visual line and inline fragment as positioned React DOM
- keeps `highlight` and `scrollToLineRange` source-line addressed

That architecture is strong for exact source-line behavior. It is also more
work than prose usually needs. For ordinary prose, the browser is already very
good at wrapping text, painting selections, and laying out paragraphs.

Pretext Markdown Viewer currently:

- parses source into semantic chunks
- estimates chunk heights with Pretext-informed layout
- mounts only visible chunks
- lets React Markdown and browser layout render inside those chunks
- records real mounted heights with `ResizeObserver`
- preserves scroll anchors when estimates become measurements

The performance difference comes from the unit of ownership:

- Text Viewer owns visual lines.
- Markdown Viewer owns document chunks.

## Goal

Add a native chunk prose path to Text Viewer.

For prose-like text, Text Viewer should:

- split the source into stable chunks
- estimate each chunk height before mount
- render only visible chunks
- let browser layout wrap text inside each mounted chunk
- measure mounted chunks and feed heights back into the virtual frame
- preserve scroll position across measurement, width, font, and zoom changes
- keep source-line `highlight` and `scrollToLineRange` useful

The target is not perfect source-line geometry. The target is fast, stable,
native prose reading.

## Non-Goals

- Do not replace Code Viewer.
- Do not use this path for logs, JSON, source files, stack traces, or other
  line-oriented content.
- Do not remove the current exact Text Viewer path until the native prose path
  is proven.
- Do not render arbitrary Markdown or HTML in this path.
- Do not preserve exact visual-line DOM identity for plain prose.
- Do not build a second Markdown Viewer inside Text Viewer.

## Routing Policy

Text input should choose a renderer by content intent:

- `code` and source-like text: Code Viewer
- logs and line-oriented diagnostics: Code Viewer
- `.md`, `.markdown`, `text/markdown`: Pretext Markdown Viewer
- prose `.txt`, pasted notes, natural-language documents: native chunk prose
- unknown short text: native chunk prose
- unknown very line-dense text: current exact Text Viewer or Code Viewer

The routing rule must be explicit. Fast prose cannot come at the cost of making
logs or code harder to inspect.

## Architecture

```text
TextViewer
  resource + toolbar + mode selection

NativeProseTextViewerContent
  viewport, zoom, highlight, scroll API

native-prose-document-model.ts
  source -> chunks with source line ranges

native-prose-layout.ts
  chunk estimates, measured-height frame, total height

native-prose-virtualizer.ts
  visible chunk window, source-line lookup, scroll anchors

native-prose-renderer.tsx
  mounted chunk DOM, source-line markers, measured height reporting
```

The existing line-materialized path should remain available as
`ExactTextViewerContent` or equivalent. The public `TextViewer` chooses between
the native prose content and exact content.

## Chunk Model

A native prose chunk is the unit of virtualization and measurement.

```ts
type NativeProseChunk = {
  index: number
  id: string
  text: string
  sourceStartLine: number
  sourceEndLine: number
  kind: "paragraph" | "blank-run" | "preformatted"
  isHostile: boolean
}
```

Chunking rules:

- Consecutive nonblank prose lines form a paragraph chunk.
- Blank runs become cheap spacing chunks.
- Indented or tabular-looking runs become preformatted chunks.
- Extremely long paragraphs are split by source-line count or character budget.
- Very long unbroken tokens mark the chunk hostile.
- Chunk ids must be deterministic from chunk index and source start line.

Suggested initial limits:

- paragraph max source lines: `24`
- paragraph max chars: `8_000`
- hostile token length: `2_000`
- hostile chunk max chars before forced split: `12_000`

These are product constants, not hidden magic. Keep them named and tested.

## Layout Model

The frame model mirrors Pretext Markdown:

```ts
type NativeProseChunkFrame = {
  index: number
  top: number
  height: number
  bottom: number
  estimatedHeight: number
  measuredHeight: number | null
  sourceStartLine: number
  sourceEndLine: number
  isHostile: boolean
}
```

Estimation should use Pretext where it helps:

- normal paragraph chunks use `prepareWithSegments` / `measureLineStats`
- preformatted chunks use `whiteSpace: "pre-wrap"` estimation
- blank runs use deterministic line-height spacing
- hostile chunks use bounded deterministic heuristics

Measured heights override estimates after mount, clamped to a small minimum.
The virtual canvas height is the sum of current frame heights plus document
padding.

## Rendering

Mounted prose chunks should use native browser layout.

Normal paragraph chunk:

```tsx
<div data-native-prose-chunk data-source-start-line data-source-end-line>
  <p className="whitespace-pre-wrap break-words">{chunk.text}</p>
</div>
```

Preformatted chunk:

```tsx
<pre data-native-prose-chunk>
  <code>{chunk.text}</code>
</pre>
```

No visual line rows are created in the default prose path. Browser wrapping is
the source of truth for mounted content.

Each mounted chunk gets a `ResizeObserver`. Height changes update
`measuredHeights`. Before writing a new measured height, capture the current
scroll anchor. After layout recomputes, resolve the anchor in the new frame and
restore `scrollTop`.

## Source-Line APIs

### Highlight

Source-line highlighting remains chunk-scoped first.

Initial behavior:

- highlight the owning chunk when the range intersects it
- expose `data-source-highlight-start` and `data-source-highlight-end`
- set `role="region"` and an accessible label for highlighted chunks

Optional refinement:

- for small chunks, render per-source-line spans only when highlighted
- for large chunks, keep chunk-level highlight only
- avoid turning every prose line into persistent DOM just to support rare
  highlights

### `scrollToLineRange`

`scrollToLineRange` should:

1. find the chunk containing `range.start`
2. compute a coarse intra-chunk ratio from source line offset
3. scroll to `frame.top + ratio * frame.height`
4. clamp with viewport lead/headroom
5. if the chunk becomes mounted and a refined target is available, correct once
   with `behavior: "auto"`

This is less exact than current line materialization, but it is correct for
prose navigation. Exact line navigation remains available through the exact
path.

## Scroll Behavior

Native prose should copy the repaired Pretext Markdown scroll rules:

- automatic highlight scroll runs once per document/range
- measurement updates do not retrigger highlight autoscroll
- width and zoom changes capture and restore a chunk anchor
- scroll events update visible window state without doing DOM reads
- visible range is found with binary search over frame `top` / `bottom`
- overscan is pixel-based

Use `requestAnimationFrame` coalescing for viewport reads unless profiling
shows direct state updates are cheaper for this path.

## Performance Shape

Expected runtime shape:

- one scroll viewport
- one virtual canvas
- around 1 to 6 mounted chunks for normal prose
- no per-visual-line React DOM in the native path
- `ResizeObserver` only on mounted chunks
- no `getBoundingClientRect` for layout height
- no hidden probe DOM
- no Markdown parsing

This should make prose scrolling resemble Pretext Markdown scrolling:

```text
scrollTop
-> binary-search visible chunk frames
-> mount/unmount a few chunks
-> browser paints wrapped text
-> measured heights correct future geometry
```

## Compatibility Cutover

Do not add legacy adapters. Make the renderer choice explicit.

Suggested public prop:

```ts
type TextViewerRenderMode = "auto" | "native-prose" | "exact-lines"
```

Default:

- `auto`

Rules:

- `auto` chooses `native-prose` for prose-like text
- `auto` chooses `exact-lines` only when source-line precision is required or
  the content is line-oriented
- tests lock the routing matrix

After native prose is proven, remove any duplicate prose handling from the exact
line path.

## Tests

Add focused tests before broad integration:

- chunks preserve source line ranges
- prose paragraphs split deterministically
- hostile paragraphs are isolated or split
- layout estimates are finite and monotonic
- measured heights replace estimates
- scroll anchor survives measured height updates
- highlight autoscroll runs once per document/range
- `scrollToLineRange` reaches the owning chunk when it is not mounted
- width changes preserve visible chunk
- zoom changes preserve visible chunk
- native prose mounts a bounded chunk window for a large document
- line-oriented input routes away from native prose
- Markdown input routes to Pretext Markdown Viewer, not native prose

Add one browser smoke test:

- open Text Viewer docs demo
- scroll through a large prose sample
- assert inner viewport scrolls monotonically
- assert mounted chunk count stays bounded
- assert no delayed correction reverses user scroll

## Implementation Plan

1. Extract renderer selection in `TextViewer`.
2. Add `native-prose-document-model.ts`.
3. Add model/layout/virtualizer unit tests.
4. Build `NativeProseTextViewerContent` with toolbar parity.
5. Implement chunk rendering and measured-height feedback.
6. Implement highlight and `scrollToLineRange`.
7. Add the one-shot highlight autoscroll guard from Pretext Markdown.
8. Route prose-like text to native prose behind `renderMode="auto"`.
9. Keep current exact path for line-oriented content.
10. Browser-verify the docs demo and compare DOM/scroll metrics.

## Acceptance Criteria

- Plain prose demo feels as smooth as the Pretext Markdown demo.
- Large prose documents mount bounded chunks, not source-line rows.
- Scroll never moves opposite the user gesture because of measurement churn.
- Highlight changes scroll once, not once per measurement correction.
- `scrollToLineRange` works for unmounted source lines.
- Code/log-like text does not use native prose.
- Markdown still routes to Pretext Markdown Viewer.
- Focused tests pass.
- Relevant browser smoke passes.

## Main Risk

The native path gives up exact visual-line ownership. That is the right trade
for prose, but wrong for code and logs. The success of this design depends on a
clean routing boundary, not on making one renderer perfect for every text file.
