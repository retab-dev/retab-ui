# Markdown Document Viewer Platonic Ideal Blueprint

## Purpose

Bring the Markdown document viewer from "feature-complete and fast" to the
smallest, sharpest version of itself.

The target is not more features. The target is inevitability:

- simple boundaries
- fast scrolling
- complete Markdown behavior
- no duplicated rendering policy
- no speculative abstractions
- names that mean one thing everywhere
- tests that lock the contract without testing implementation trivia

## Current State

The viewer is now a real document viewer:

- File Viewer routes Markdown through `MarkdownDocumentViewer`.
- Rendering uses `react-markdown`.
- GFM, hard breaks, math, callouts, footnotes, safe HTML, safe links, images,
  tables, and highlighted code are supported.
- Virtualization is custom and page-based.
- Table accessibility is patched after async Markdown rendering.
- The File Viewer Markdown sample exercises rich syntax.

This is a strong component, but not yet the platonic version.

## Remaining Imperfections

### `markdown-document-components.tsx` Owns Too Much

It currently owns:

- Markdown plugin lists
- sanitizer schema
- callout directive transform
- every rendered Markdown component
- copy button implementation
- URL policy
- image fallback policy
- heading id fallback logic
- text extraction helpers
- code-language extraction helpers

This is dense, but the module boundary is not precise.

### Async Rendering Is Correct But Implicit

`rehype-pretty-code` is async, so the viewer uses `MarkdownHooks`.

That is the right API, but the component currently treats async rendering as an
incidental detail. The ideal version makes this explicit:

- one renderer component owns the async Markdown lifecycle
- empty first paint is intentional and tested
- measurement sync is tied to renderer readiness and DOM mutation

### Sanitization Policy Is Hidden Inside Rendering

Safe raw HTML is a product decision and a security boundary. It should not live
as an inline helper beside visual JSX.

The ideal version gives sanitization a named module and a focused test file.

### Plugin Policy Is Hidden Inside Rendering

The Markdown language contract should be inspectable in one place:

- GFM
- hard breaks
- math
- directives
- raw HTML
- sanitize
- slug
- KaTeX
- Pretty Code

The renderer should consume this policy, not define it.

### Height Estimation Is Useful But Not Formal

The virtualizer is fast because it estimates page heights, measures mounted
pages, and preserves scroll anchors.

The ideal version makes the estimation contract explicit:

- estimates are allowed to be wrong
- measurements are authoritative
- scroll anchor preservation is mandatory
- source-line navigation lands deterministically even before measurement

### Naming Is Good But Not Perfect

Some concepts need stricter names:

- `sourceLine`: 1-based line in the full Markdown source
- `relativeLine`: 1-based line inside the rendered page Markdown
- `pageStartLine`: first source line owned by a page
- `pageEndLine`: last source line owned by a page
- `pageKey`: stable measurement key for one page in one render mode
- `pageId`: stable semantic page identity
- `virtualItem`: offset/height/window projection, not document data

No name should drift across modules.

## Target Architecture

```text
markdown-document-viewer.tsx
  owns shell state, scrolling, measurement, toolbar integration

markdown-document-model.ts
  owns source parsing, block records, page grouping, heading ids

markdown-document-virtualizer.ts
  owns offset math, visible window, anchor preservation

markdown-document-renderer.tsx
  owns one rendered page lifecycle and React Markdown invocation

markdown-document-renderers.tsx
  owns React component overrides for Markdown tags

markdown-document-plugins.ts
  owns remark/rehype plugin lists and ordering

markdown-document-sanitize.ts
  owns raw HTML sanitizer schema

markdown-document-callouts.ts
  owns directive transform, callout kinds, labels, and UI

markdown-document-copy.ts
  owns code/table copy helpers and copy buttons

markdown-document-url-policy.ts
  owns safe link and image URL handling
```

## Module Contracts

### `markdown-document-model.ts`

Owns document data.

Must export:

- `createMarkdownDocument(text)`
- `findMarkdownPageForLine(pages, sourceLine)`
- `markdownPageIntersectsLineRange({ page, range })`
- `serializeMarkdownTableForClipboard(markdown)`
- document, page, and block types

Must not import React.

Must not know about DOM measurement.

Must not know about viewport size.

### `markdown-document-virtualizer.ts`

Owns scroll math.

Must export:

- visible window calculation
- page offset lookup
- scroll anchor capture
- scroll anchor restore

Must not import React.

Must not parse Markdown.

Must not inspect DOM.

### `markdown-document-viewer.tsx`

Owns viewer orchestration.

Must own:

- resource read
- bounds errors
- rendered/text mode
- scale
- fit width
- scroll area
- page measurement
- table accessibility sync
- viewer handle

Must not define Markdown tag rendering.

Must not define sanitizer schema.

Must not define parser plugins.

### `markdown-document-renderer.tsx`

Owns async page rendering.

Must own:

- `MarkdownHooks`
- renderer fallback while async plugins resolve
- call to `MarkdownDocumentPageContent`
- mutation and measurement notification surface

Must keep each rendered page isolated.

### `markdown-document-renderers.tsx`

Owns Markdown element rendering.

Must own components for:

- headings
- paragraphs and hard breaks
- lists and task inputs
- blockquotes
- links
- images
- code and pre
- tables
- footnotes
- details, summary, kbd, mark, sub, sup
- horizontal rules

Must not define plugin order.

Must not define sanitizer schema.

### `markdown-document-plugins.ts`

Owns Markdown language policy.

Recommended order:

```text
remark-gfm
remark-breaks
remark-math
remark-directive
remark-callouts
rehype-raw
rehype-sanitize
rehype-slug
rehype-katex
rehype-pretty-code
```

Rules:

- User-authored raw HTML is sanitized before renderer-generated KaTeX and Shiki
  markup is added.
- Pretty Code stays async and is rendered through `MarkdownHooks`.
- Plugin arrays are stable constants.

### `markdown-document-sanitize.ts`

Owns safe HTML.

Must allow:

- basic document tags already allowed by `rehype-sanitize`
- GFM footnote attributes
- task-list checkboxes
- safe `details` and `summary`
- `kbd`, `mark`, `sub`, `sup`
- callout data attributes generated by our directive transform
- tightly scoped Pretty Code and KaTeX generated attributes if needed

Must not allow:

- script tags
- event handler attributes
- unsafe URL protocols
- arbitrary inline `style` from user HTML
- arbitrary user-authored class names

### `markdown-document-callouts.ts`

Owns callout semantics.

Supported directive names:

- `note`
- `info`
- `tip`
- `success`
- `warning`
- `caution`
- `danger`
- `error`
- `failure`

Normalized kinds:

- `note`
- `info`
- `tip`
- `warning`
- `danger`

Syntax:

```md
:::warning{title="Migration note"}
This is rendered as a warning callout.
:::
```

The transform must generate neutral HAST properties:

- `dataCalloutKind`
- `dataCalloutTitle`

The React renderer converts those into the final visual component.

## Rendering Policy

### Markdown Is A Document

Markdown should wrap naturally. Do not virtualize wrapped text lines.

Virtualize pages first. A page is a display unit, not a source unit.

### Code Is A Tool Surface

Code blocks need:

- syntax highlighting
- language label
- horizontal scroll
- copy button
- stable measured height

Inline code stays lightweight.

### Tables Are Documents And Data

Tables need:

- native table semantics
- horizontal overflow
- deterministic header ids
- `scope="col"`
- `headers` on data cells after async render
- copy button that copies the source table as TSV

### Raw HTML Is Allowed Only After Sanitization

Raw HTML is useful for imported Markdown documents, but it is never trusted.

Allowed safe examples:

```md
<details>
  <summary>More</summary>
  <mark>Safe text</mark>
</details>
```

Blocked examples:

```md
<script>alert(1)</script>
<img src="x" onerror="alert(1)">
[bad](javascript:alert(1))
```

## Virtualization Policy

### Inputs

- page count
- estimated page height
- measured page height map
- scroll top
- viewport height
- overscan pixels

### Outputs

- visible virtual items
- total canvas height
- stable item top/bottom

### Invariants

- Mounted page count remains bounded for large files.
- Measurements replace estimates without scroll jumps.
- Zoom changes preserve the user's relative position.
- Switching documents resets page measurements.
- Switching render/text mode resets measurements but keeps behavior predictable.
- `scrollToLineRange` works before and after measurement.

## Performance Budget

For a 6,000-line Markdown file:

- initial mount should render only the first virtual window
- mounted page count should remain small
- scroll should not mount the full document
- async code highlighting must not block shell/chrome rendering
- measurement updates must not cause repeated full-page reflows
- table accessibility patching must run only for mounted pages

## Tests

### Pure Model Tests

Cover:

- frontmatter conversion
- heading ids and duplicate suffixes
- line counting
- page grouping
- table serialization
- math/callout estimate classification

### Pure Virtualizer Tests

Cover:

- visible window calculation
- overscan
- measured height replacement
- anchor capture/restore
- scroll-to-page/line offset

### Sanitizer Tests

Cover:

- script removal
- event handler removal
- unsafe protocol removal
- safe `details` rendering
- safe callout data attributes
- footnote attributes
- no arbitrary user class/style leakage

### Renderer Tests

Cover:

- GFM tables
- task lists
- hard breaks
- math
- callouts
- footnotes
- safe HTML
- highlighted code
- code copy
- table copy
- image blocked and failed states
- local fragment links

### File Viewer Contract Tests

Cover:

- Markdown routes to `MarkdownDocumentViewer`
- prose text routes to text viewer
- logs and JSON route to code viewer
- stale async text loads do not win after source changes

## Implementation Plan

### Phase 1: Extract Policy Modules

Create:

- `markdown-document-plugins.ts`
- `markdown-document-sanitize.ts`
- `markdown-document-callouts.ts`
- `markdown-document-url-policy.ts`

Move code without changing behavior.

Run focused tests after each move.

### Phase 2: Extract Renderers

Create:

- `markdown-document-renderers.tsx`
- `markdown-document-copy.tsx`
- `markdown-document-renderer.tsx`

Keep `markdown-document-components.tsx` as a temporary composition module only
if needed, then delete it once call sites are updated.

### Phase 3: Formalize Async Rendering

Make `MarkdownDocumentPageRenderer` expose a single readiness path:

- initial placeholder
- rendered content
- measurement callback after content mutation

Ensure page measurement and table accessibility patching are triggered by the
same page lifecycle.

### Phase 4: Tighten Naming

Rename concepts consistently:

- `sourceStartLine` -> `pageStartLine` on pages
- `sourceEndLine` -> `pageEndLine` on pages
- `sourceStartLine` -> `blockStartLine` on blocks
- `sourceEndLine` -> `blockEndLine` on blocks
- `measurementKey` -> `pageMeasurementKey`
- `item` -> `virtualItem`

Only do this when tests are already green. This is mechanical but high-risk
because it touches many call sites.

### Phase 5: Remove Transitional Surfaces

Delete any compatibility wrappers introduced during extraction.

No legacy adapters.

No duplicate plugin arrays.

No fallback Markdown renderer.

## Acceptance Criteria

The component reaches the target when all of this is true:

- `markdown-document-components.tsx` no longer exists or is only a tiny barrel
  removed before merge.
- Plugin order is declared once.
- Sanitizer schema is declared once and has dedicated tests.
- Callout syntax is declared once and has dedicated tests.
- Rendering components are visual only.
- Viewer orchestration contains no Markdown syntax policy.
- Model and virtualizer import no React.
- Large Markdown files mount a bounded number of pages.
- Tables remain accessible after async rendering.
- Raw HTML is useful but not dangerous.
- File Viewer uses this path for Markdown.
- Focused tests, registry build, and typecheck pass.

## Non-Goals

- Full MDX support.
- User-authored React components.
- Mermaid execution.
- Arbitrary raw HTML styling.
- Exact browser pagination.
- Line-level virtualization for wrapped prose.
- Replacing the parse viewer.

## Final Shape

The final viewer should feel boring in the best way:

- one parser policy
- one sanitizer policy
- one renderer surface
- one virtualizer
- one viewer orchestration component
- no surprising fallbacks
- no duplicated Markdown semantics

The code should read as if there was no other reasonable place for any line to
go.
