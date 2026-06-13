# Markdown Document Viewer Final Ideal Blueprint

## Purpose

Define the remaining work required for the Markdown document viewer to approach
the platonic ideal:

- simplicity
- speed
- complete behavior
- no unnecessary surface
- exact module ownership
- consistent names
- high signal code
- measured confidence instead of vibes

The viewer is already shippable. This blueprint is about moving from strong to
inevitable.

## Current Truth

The current viewer has the right broad shape:

- Markdown routes through `MarkdownDocumentViewer`.
- React Markdown owns visible Markdown rendering.
- Plugin, sanitizer, callout, URL, copy, renderer, model, and virtualizer
  policy are split.
- The custom virtualizer mounts only visible pages.
- Measured heights replace estimates.
- Scroll anchors preserve position while measurements arrive.
- Focused tests, typecheck, and registry build pass.

The remaining imperfections are not feature gaps. They are precision gaps.

## North Star

The final component should have one clean sentence:

React/GFM renders the visible Markdown document; Pretext-informed geometry gives
the virtualizer accurate starting frames; the custom virtualizer keeps mounted
content bounded and scroll-stable.

Anything that does not support that sentence should be removed.

## Remaining Gaps

### Estimates Are Still Heuristic

Current page estimates are useful but approximate. They do not understand actual
font metrics, wrapping, code line geometry, or width changes deeply enough.

Final state:

- block estimates are width-aware
- text and code estimates use Pretext
- estimates are deterministic for a source, width, zoom, and style version
- estimates are close enough that measurement corrections rarely move the page

### Async Rendering Is Correct But Too Implicit

`MarkdownHooks` renders nothing on first paint while async plugins resolve. The
page root currently observes mutation and resize, which works, but readiness is
not modeled as a first-class lifecycle.

Final state:

- every page has a render lifecycle state
- initial empty render is intentional
- async readiness triggers one measurement path
- table accessibility sync and measurement share the same readiness event

### Table Accessibility Is A DOM Patch

The current DOM patch is pragmatic. It gives tables deterministic header
relationships after async render, but the ownership is still in the viewer.

Final state:

- table accessibility logic lives in its own module
- the renderer marks tables with stable source metadata
- a single mounted-page lifecycle calls the patch
- tests prove header ids and cell `headers` after async render

### Renderer Module Is Still Dense

Markdown has many visual cases, so `markdown-document-renderers.tsx` will never
be tiny. But it can still be sharper.

Final state:

- rendering helpers are grouped by semantic family
- code, table, image, heading, and callout rendering remain visually explicit
- no helper mixes visual styling with syntax policy
- no helper calculates virtual geometry

### Hostile Blocks Need A Deliberate Story

Large Markdown is not always many ordinary blocks. It can be one enormous code
block, table, paragraph, or generated list.

Final state:

- hostile blocks are detected in the model
- hostile pages are isolated
- hostile code blocks have an internal line window if profiling requires it
- hostile tables either stay whole by design or get a table-specific row window
- ordinary pages remain simple

### Performance Is Not Yet Quantified

The tests prove bounded mounting behavior, but they do not quantify render time,
mount count, measurement churn, or scroll stability under load.

Final state:

- there is a repeatable performance fixture
- results are recorded in tests or a benchmark script
- regressions have thresholds
- the 6,000-line budget is measured, not assumed

## Final Architecture

```text
markdown-document-viewer.tsx
  shell state, resource reading, toolbar, scroll viewport, mounted pages

markdown-document-model.ts
  source parsing, block records, page grouping, source-line mapping

markdown-document-layout.ts
  Pretext-informed block and page estimates

markdown-document-virtualizer.ts
  geometry, offsets, visible window, anchors, scroll-to-index

markdown-document-renderer.tsx
  one mounted page lifecycle, MarkdownHooks, readiness notification

markdown-document-renderers.tsx
  visual Markdown component overrides

markdown-document-plugins.ts
  remark/rehype language policy

markdown-document-sanitize.ts
  raw HTML sanitizer policy

markdown-document-callouts.tsx
  callout directive transform and callout UI

markdown-document-copy.tsx
  copy buttons and clipboard serialization

markdown-document-url-policy.ts
  link and image URL policy

markdown-document-table-accessibility.ts
  mounted table header/cell relationship patching

markdown-document-performance.ts
  optional test/benchmark helpers, not runtime product code
```

## Module Contracts

### `markdown-document-layout.ts`

Owns estimates only.

Must export:

- `createMarkdownLayoutStyle(options)`
- `estimateMarkdownBlockHeight(block, style)`
- `estimateMarkdownPageHeight(page, style)`
- `createMarkdownPageEstimates(document, style)`

Must use:

- Pretext for prose-like text flow
- Pretext for pre-wrap code line estimation
- explicit CSS-matching font inputs
- explicit line heights
- explicit page content width

Must not:

- import React
- touch DOM
- parse Markdown
- know about scroll position

### `markdown-document-renderer.tsx`

Owns async rendering.

Must expose:

- empty first render state
- ready render state
- page mutation notification
- page measurement notification

The viewer should not need to know why Markdown became ready. It should only
receive a mounted-page readiness signal.

### `markdown-document-table-accessibility.ts`

Owns table post-processing.

Must export:

- `patchMarkdownPageTables(root)`
- `markdownTableHeaderId(pageId, tableIndex, columnIndex)`

Must guarantee:

- `th` has deterministic id
- `th` has `scope="col"`
- matching `td` has `headers`
- repeated patching is idempotent

### `markdown-document-virtualizer.ts`

Owns geometry.

Must keep:

- `createMarkdownVirtualGeometry`
- `getMarkdownVirtualItems`
- `getMarkdownScrollAnchor`
- `scrollTopForMarkdownAnchor`
- `topForMarkdownIndex`

Must preserve:

- binary-search visible projection
- pixel overscan
- measured heights as authoritative
- stable anchors when measurements change
- no React or DOM imports

## Pretext Estimate Policy

Pretext should be used only where it makes the first frame better:

- paragraphs
- headings
- list item text
- blockquote text
- callout body text
- pre-wrap code

Pretext should not render:

- tables
- raw HTML
- math DOM
- footnotes
- full nested Markdown

For those, use deterministic conservative estimates and let measurement correct
them.

## Hostile Block Policy

A hostile block is any block that can dominate mount or layout cost by itself.

Detection examples:

- code block over 400 source lines
- table over 200 rows
- paragraph over 20,000 characters
- list over 500 source lines
- raw HTML block over 20,000 characters

Initial behavior:

- isolate hostile block into its own page
- estimate conservatively
- render only when page is visible
- keep ordinary page virtualization unchanged

Escalation behavior:

- code gets internal line-window virtualization first
- table row-window virtualization is added only after profiling proves need
- paragraph chunking is added only for pathological unbroken text

## Performance Budget

For a 6,000-line mixed Markdown file:

- initial mounted pages: bounded by viewport and overscan
- initial shell paint: not blocked by Pretty Code
- scroll projection: one RAF-batched update per frame
- visible range projection: binary search over geometry
- measured-height correction: no visible jump from current anchor
- table patching: only mounted pages
- full document React render: never

For a hostile document:

- no full document mount
- no hidden full document measurement
- no synchronous render of all code lines unless the hostile page is visible

## Tests

### Layout Tests

- paragraph estimate changes with width
- code estimate changes with wrapping width
- width clamps to at least 1 pixel
- same style/source inputs return stable estimates
- style inputs match viewer CSS constants

### Renderer Lifecycle Tests

- first async render may be empty
- ready render calls measurement path
- mutation after Pretty Code calls measurement path
- table patch runs after async content appears

### Table Accessibility Tests

- deterministic header ids
- idempotent patching
- `scope="col"` on headers
- `headers` on body cells
- multiple tables on one page do not collide

### Hostile Block Tests

- huge code block becomes isolated page
- huge table becomes isolated page
- huge paragraph does not force full document mount
- scroll-to-line lands on hostile page before measurement

### Performance Tests

- 6,000-line fixture mounts bounded pages
- repeated scroll does not increase mounted root count
- zoom preserves relative anchor
- measurement corrections do not reset scroll to top

## Implementation Plan

### Phase 1: Extract Table Accessibility

Move table patching out of the viewer into
`markdown-document-table-accessibility.ts`.

Add idempotence and multi-table tests.

### Phase 2: Add Layout Module

Create `markdown-document-layout.ts`.

Move current estimation constants and functions there first, without changing
behavior.

Then introduce Pretext for prose and code estimates.

### Phase 3: Formalize Page Readiness

Make `MarkdownDocumentPageRenderer` expose an explicit readiness callback.

The mounted page should call one lifecycle function:

```text
page mounted or mutated
  -> patch tables
  -> measure page
  -> report height
```

### Phase 4: Add Hostile Block Classification

Detect hostile blocks in the model.

Isolate hostile blocks into single pages.

Do not add internal virtualization until profiling requires it.

### Phase 5: Add Performance Fixture

Create a deterministic 6,000-line Markdown fixture.

Test:

- mounted page count
- scroll projection behavior
- no full document mount
- table patch bounded to mounted pages

## Acceptance Criteria

The component reaches the next ideal when all are true:

- estimates live in `markdown-document-layout.ts`
- table accessibility lives in `markdown-document-table-accessibility.ts`
- page render readiness is explicit
- Pretext informs paragraph and code estimates
- browser layout still owns final Markdown rendering
- hostile blocks are identified and isolated
- virtualizer remains React-free and DOM-free
- viewer contains no Markdown syntax policy
- renderer contains no scroll math
- sanitizer strips unsafe HTML, event handlers, user classes, and user styles
- File Viewer routes Markdown through this component
- focused tests pass
- typecheck passes
- registry build passes
- performance fixture proves bounded mounting for 6,000-line Markdown

## Non-Goals

- MDX
- arbitrary React components
- Mermaid execution
- line-level virtualization for ordinary prose
- replacing the parse viewer
- making Pretext render complete Markdown
- supporting arbitrary raw HTML styling

## Final Judgment

The current viewer is good when it is modular and green.

The final viewer is ideal when its speed is measured, its estimates are
geometry-aware, its async lifecycle is explicit, and every remaining line has a
single obvious home.

