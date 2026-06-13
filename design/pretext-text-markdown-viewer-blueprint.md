# Fast Pretext Text And Markdown Viewer Blueprint

## Problem

The current text viewer is too slow because it treats a document as a long list
of source lines and runs layout work across that list. That model is acceptable
for code, but it is the wrong primitive for prose and Markdown.

For prose, source lines are an implementation detail. The visual document is a
sequence of paragraphs, headings, list items, quotes, rules, and code blocks.
For Markdown, this is even more obvious: one paragraph can span multiple source
lines, and one list item can contain several nested blocks. A fast viewer should
virtualize those semantic blocks, not raw lines.

The Pretext markdown-chat demo points to the better architecture:

- parse content into block templates
- prepare text once
- compute exact frames for the current width
- binary-search visible frames
- materialize DOM only for the visible window
- reuse mounted DOM rows across scroll changes

## Goal

Build one fast viewer foundation for `.txt` and Markdown:

- `.txt` renders as prose paragraphs with natural wrapping.
- Markdown renders semantic blocks.
- The viewer uses Pretext for text layout and custom virtualization for visible
  frame projection.
- The virtualizer never measures DOM for row height.
- Width changes rebuild layout frames without reparsing or re-preparing all text.
- Scroll remains anchored when width or zoom changes.

This should replace the slow line-height-per-source-line approach for prose.
Code/log viewers stay separate.

## Non-Goals

- Do not replace the Code Viewer.
- Do not use TanStack Virtual for this viewer.
- Do not implement a complete browser Markdown/CSS layout engine.
- Do not support arbitrary HTML execution in Markdown.
- Do not virtualize individual visual lines as the primary model.

## Core Idea

The viewer should have two phases:

1. Preparation phase, independent of viewport scroll:
   - parse or segment document
   - build semantic templates
   - call Pretext `prepareWithSegments`, `prepareRichInline`, or `prepare`
   - cache prepared text by content and style

2. Frame phase, dependent on width and zoom:
   - compute block height and top/bottom offsets
   - compute total document height
   - binary-search visible block/message range
   - materialize only visible block DOM

Pretext provides the exact text layout data. The virtualizer uses that data as
geometry.

```txt
source
-> document template
-> prepared text runs
-> width-specific frame
-> visible frame range
-> mounted DOM
```

## Chenglou Tricks To Carry Over

The markdown-chat demo is fast because it keeps layout, virtualization, and DOM
projection separate. The viewer should copy these concrete tricks:

- Prepare once, layout many times. `prepare`, `prepareWithSegments`, and
  `prepareRichInline` belong to the source/style phase. Width changes should
  rerun only frame layout over prepared handles.
- Wait for `document.fonts.ready` before first measurement when web fonts are
  involved, or guarantee the measured fonts are already stable. Use explicit
  named font stacks. Do not measure with `system-ui` on macOS if CSS uses a
  different resolved font.
- Keep CSS and Pretext style inputs identical: font shorthand, line height,
  letter spacing, tab behavior, `white-space`, and `word-break`.
- Prefer zero letter spacing. If a style needs letter spacing, pass the exact
  numeric CSS-pixel value into Pretext. Do not use `em` letter-spacing in CSS
  without a matching numeric Pretext input.
- Build a semantic Markdown template once with `marked.lexer(markdown, options)`,
  where `options` includes GFM. Do not parse Markdown while scrolling.
- Normalize Markdown into a small internal block set: inline block, code block,
  rule, list decoration, quote rail, and safe fallbacks.
- Use `prepareRichInline` for mixed inline Markdown. Inline text, bold, italic,
  strike, links, inline code, task markers, and image chips should be fragments
  in one rich-inline flow, not separate measured spans.
- Feed raw inline item text, including leading and trailing spaces, into
  `prepareRichInline`. Let the helper own boundary whitespace collapse and
  `gapBefore`; do not pre-trim and reinsert spaces in renderer code.
- Preserve source item indexes for rich-inline fragments. Empty whitespace-only
  items can disappear during prepare, so rendered fragments must map back by
  source item index, not by dense prepared-item index.
- Merge adjacent inline fragments when they have the same font, class, href,
  break mode, and extra width. This lowers line-wrapping and DOM work.
- Use rich-inline `extraWidth` for visual chrome such as inline-code padding and
  image-chip padding, so measured text width matches rendered width.
- Treat `extraWidth` as horizontal chrome on each emitted rich-inline fragment.
  If an inline-code token is allowed to wrap, its rendered padding must also be
  per fragment. If that is undesirable, make the token `break: "never"`.
- Use rich-inline `break: "never"` for atomic chips such as image placeholders.
- Accept that an atomic `break: "never"` item can overflow if it is wider than
  an otherwise empty line. Use it only for genuinely atomic short chips.
- Sanitize Markdown links during parsing; keep only `http:` and `https:` hrefs.
- Cache list marker widths with `measureNaturalWidth(prepareWithSegments(...))`
  instead of measuring markers in the DOM.
- Convert tables and block HTML to code/plain fallback blocks at first. That
  gives deterministic layout without pretending to support arbitrary HTML.
- For inline block frame layout, use `measureRichInlineStats(flow, width)` to
  get `lineCount` and `maxLineWidth` without materializing strings.
- For code block frame layout, use `measureLineStats(prepared, width)` on
  `whiteSpace: "pre-wrap"` prepared text.
- Strip exactly one trailing newline from fenced code before preparation so a
  Markdown fence ending newline does not create a surprising blank final row.
- Clamp all Pretext layout widths with `Math.max(1, width)`.
- Materialize only visible blocks. Use `walkRichInlineLineRanges` plus
  `materializeRichInlineLineRange` for visible rich-inline blocks, and
  `layoutWithLines` only for visible code blocks.
- Store frame geometry explicitly: `top`, `height`, `bottom`, content left,
  marker position, quote rail positions, used width, and line height.
- Compute block indentation and quote/list chrome in the frame model, not by
  asking CSS layout what happened.
- Use max-line width from Pretext to shrink-wrap narrow/user-style blocks when
  the design calls for it.
- Add runtime development assertions that prepared block kind and frame kind
  match before materialization. A mismatched frame should fail loudly.
- Keep a frame cache keyed by source template, width, zoom, chrome occlusion,
  and style version. Reuse the previous frame when those keys are unchanged.
- Find the visible range with two binary searches: first item whose
  `bottom > minY`, then first item whose `top >= maxY`.
- Include top and bottom occlusion in the range query so sticky chrome does not
  cause invisible rows to be rendered as visible.
- Overscan in pixels, not item count.
- Schedule scroll and resize projection through one `requestAnimationFrame`.
  Multiple scroll events should collapse into one projection pass.
- Preserve mounted row shells in the visible overlap. Remove rows leaving the
  window, update rows that remain visible, and insert only rows entering the
  window. Add a row pool only if profiling shows churn after this overlap
  projection is still too high.
- When replacing a block's content after relayout, build into a
  `DocumentFragment`-equivalent and replace children once.
- Render visual lines as absolutely positioned rows with precomputed `top` and
  `height`. The browser should paint text, not decide wrapping.
- Render fragments as `white-space: pre` inline boxes. Apply `gapBefore` as an
  explicit leading margin so browser inline whitespace collapse cannot diverge
  from Pretext's line model.
- Keep all rendered text assignment on `textContent` or React text children.
  Raw Markdown HTML must never become `dangerouslySetInnerHTML` in this viewer.
- Never use `getBoundingClientRect`, `offsetHeight`, or hidden probe DOM to
  compute virtual heights.
- Treat `LayoutCursor` values as Pretext segment/grapheme cursors, not source
  string offsets.
- Clamp empty visual blocks deliberately if product behavior requires one blank
  line; Pretext's empty text layout can be height zero.
- Remember the demo virtualizes messages whose internal blocks are small. Our
  document viewer must add a secondary line-window path for oversized
  paragraphs, huge list items, and huge fenced code blocks, while keeping block
  frames as the primary virtualization model.

## Architecture

### Modules

Create a new viewer stack rather than stretching the current line viewer:

- `prose-viewer.tsx`
  - public component and error/suspense shell
  - accepts text or Markdown source
  - owns zoom, width, scroll container, and download chrome

- `prose-document-resource.ts`
  - reads bounded text
  - preserves source identity and download behavior
  - shared by text and Markdown modes

- `prose-document-model.ts`
  - turns raw `.txt` into paragraph/block templates
  - turns Markdown into semantic block templates
  - owns source-line mapping for highlights

- `prose-pretext-layout.ts`
  - wraps Pretext calls
  - prepares inline text, rich inline fragments, and pre-wrap code blocks
  - caches prepared handles

- `prose-frame.ts`
  - computes width-specific block frames
  - stores `top`, `bottom`, `height`, `kind`, and source range
  - computes total document height

- `prose-virtualization.ts`
  - binary-searches frame ranges
  - applies overscan
  - caps hostile windows
  - captures/restores scroll anchors

- `prose-renderer.tsx`
  - materializes visible frames
  - renders paragraph lines, Markdown block shells, code blocks, quotes, lists
  - avoids DOM height measurement

### Data Model

The prepared document should be immutable for a given source.

```ts
type ProseDocumentTemplate = {
  blocks: PreparedBlock[]
  sourceLineCount: number
}

type PreparedBlock =
  | PreparedParagraphBlock
  | PreparedHeadingBlock
  | PreparedListItemBlock
  | PreparedQuoteBlock
  | PreparedCodeBlock
  | PreparedRuleBlock

type ProseFrame = {
  blocks: BlockFrame[]
  totalHeight: number
  width: number
  zoom: number
}

type BlockFrame = {
  index: number
  kind: PreparedBlock["kind"]
  top: number
  bottom: number
  height: number
  sourceStartLine: number
  sourceEndLine: number
}
```

The frame is the virtualizer input. Rendering should not recalculate block
height.

## Text Mode

Plain text should not be split into thousands of independently measured source
lines unless the file is actually line-oriented.

Instead:

1. Detect paragraph breaks.
   - split on blank-line runs
   - preserve source-line ranges
   - keep very long single-line files as paragraphs, not as code

2. Build paragraph templates.
   - normal paragraph text uses `prepareWithSegments` or `prepare`
   - hard line breaks inside a paragraph can be modeled with Pretext
     `whiteSpace: "pre-wrap"` only when needed

3. Frame paragraphs.
   - call Pretext layout for width + font + line-height
   - block height = line count \* line height + margins

4. Virtualize paragraphs.
   - visible range is a binary search over paragraph `top`/`bottom`

This dramatically reduces work for normal prose. A 10,000-line text file that is
actually 200 paragraphs should behave like 200 virtual items, not 10,000.

## Markdown Mode

Markdown should follow the markdown-chat model.

1. Parse Markdown with `marked`.
2. Normalize tokens into prepared blocks:
   - paragraph
   - heading
   - list item
   - blockquote
   - fenced code
   - horizontal rule
   - table fallback
   - raw HTML fallback
3. Inline Markdown becomes rich inline fragments:
   - text
   - strong/em/del
   - links
   - inline code
   - image placeholder/chip
   - task checkbox text or marker
4. Use Pretext rich inline helpers for inline flow.
5. Use Pretext pre-wrap layout for fenced code.
6. Compute exact block frames before rendering.

Tables and raw HTML should initially fall back to code/plain blocks. That is
better than pretending we support full browser layout.

Hard Markdown line breaks should become separate inline blocks with a small
hard-break gap, not raw `<br>` inside browser inline layout.

Headings should have a constrained style scale: depth 1 and 2 get heading
styles; deeper headings can reuse body-sized text if that keeps the viewer
simple and predictable.

## Virtualization Engine

The custom virtualizer should operate over `BlockFrame[]`.

Required APIs:

```ts
function findVisibleFrameRange(options: {
  frames: readonly BlockFrame[]
  scrollTop: number
  viewportHeight: number
  overscanPx: number
}): { start: number; end: number }

function captureFrameScrollAnchor(options: {
  frames: readonly BlockFrame[]
  scrollTop: number
}): FrameScrollAnchor | null

function restoreFrameScrollTop(options: {
  anchor: FrameScrollAnchor
  frames: readonly BlockFrame[]
}): number
```

Use binary search:

- first frame whose `bottom > minY`
- first frame whose `top >= maxY`

Use pixel overscan, not item-count overscan. Blocks can have very different
heights.

Cap mounted frames for hostile cases, but the cap should be high enough to cover
the viewport plus overscan. If the cap is hit, reduce overscan before dropping
visible content.

## Rendering Strategy

Do not render one React component per visual line for the whole document.

Only render visible blocks. Within a visible block:

- paragraph/heading lines can be materialized from Pretext line ranges
- code block lines can be materialized for that visible block
- list/quote/rule chrome is positioned from frame geometry

For performance-sensitive paths, consider the markdown-chat approach:

- preserve mounted row shells in the previous/current visible overlap
- insert/remove only rows entering/leaving the visible range
- update style top/height/width on existing rows

In React, start with keyed visible blocks. If profiling shows reconciliation cost
is still high, introduce a small row-shell cache inside the renderer.

## Accessibility Strategy

The markdown-chat demo optimizes projection speed and renders Markdown semantics
mostly as visual divs/spans. The viewer should not inherit that accidentally.

Choose one explicit accessibility mode:

1. Semantic visible DOM:
   - visible headings render as heading elements or labelled equivalents
   - visible code blocks expose `pre`/`code` semantics
   - visible links are real anchors with sanitized `http:`/`https:` hrefs
   - list markers and quote rails have accessible text or labels where useful

2. Document outline companion:
   - the virtualized surface remains projection-only
   - a hidden or side-channel outline exposes headings and navigable source
     ranges

For the first implementation, use semantic visible DOM where it does not break
the projection model, and add tests for focusable links inside visible blocks.

## Caching

Use three cache layers:

1. Source cache:
   - raw text by resource identity and bounds

2. Template cache:
   - parsed Markdown or paragraph model by text hash
   - Pretext prepared handles by text + style

3. Frame cache:
   - width/zoom-specific frames
   - LRU by `{ templateKey, width, zoom }`

Important: do not rerun Pretext `prepare*` on every resize. Resize should
rerun layout/frame computation over existing prepared handles.

## Scroll Anchoring

When width or zoom changes:

1. Capture the block at current `scrollTop`.
2. Store the offset inside that block.
3. Rebuild the frame for the new width/zoom.
4. Restore `scrollTop = newBlock.top + oldOffsetWithinBlock`.

For highlights:

- source-line range maps to one or more blocks
- scroll to the first matching block frame
- render highlight overlay inside visible blocks only

## File Viewer Routing

The File Viewer should route:

- `.txt`, `.text`, `text/plain` extensionless -> Prose/Text mode
- `.md`, `.markdown`, `text/markdown` -> Markdown mode
- `.mdx`, `.log`, `.json`, language extensions -> Code Viewer or code-like preview

Do not let `.log` use the prose pipeline. Logs need fixed rows, line numbers,
and streaming.

## Performance Targets

Use the markdown-chat demo as the bar:

- 10,000 paragraph/message-sized blocks
- no DOM reads for layout height
- no full-document DOM mount
- smooth scroll after warm layout
- stable scroll position on resize
- visible block count bounded by viewport height and overscan

Concrete targets:

- initial parse + prepare for 1 MB text: under 250 ms on modern laptop
- scroll handler work: under 2 ms in common case
- mounted DOM nodes: proportional to visible blocks, not document length
- resize relayout: no reparsing, no re-prepare for unchanged text/style

## Migration Plan

1. Build the model and frame pipeline behind a new internal component.
2. Add unit tests for paragraph grouping, Markdown token normalization, frame
   geometry, visible range search, and scroll anchoring.
3. Add a demo fixture with:
   - long prose
   - 10k repeated Markdown blocks
   - long code fences
   - lists and blockquotes
4. Route `.txt` demo through the new prose pipeline.
5. Route Markdown viewer through the same frame pipeline.
6. Keep Code Viewer unchanged.
7. Profile before deleting the old line-based prose path.

## Acceptance Tests

- A 10,000 paragraph `.txt` file does not mount 10,000 block nodes.
- A 10,000 block Markdown file does not mount 10,000 block nodes.
- Resizing preserves scroll anchor within the same semantic block.
- Zooming preserves scroll anchor within the same semantic block.
- Markdown headings, lists, quotes, inline code, links, and fenced code render
  from prepared frames.
- No test uses `getBoundingClientRect`, `offsetHeight`, or DOM measurement to
  compute virtual row height.
- `.log` still renders in the code-like viewer with line numbers.

## Main Design Decision

The fast viewer should virtualize **frames**, not **lines**.

Pretext gives us exact-enough frame geometry. Once we have that geometry,
virtualization is a cheap range query over `top` and `bottom`.

That is the core lesson from markdown-chat.
