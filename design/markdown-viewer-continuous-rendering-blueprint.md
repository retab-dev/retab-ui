# Markdown Viewer Continuous Rendering Blueprint

## Verdict

The Markdown Document Viewer should not expose pages.

The current implementation uses page-like chunks for virtualization, then leaks
those chunks into the product surface as visible pages: page count, page borders,
page shadows, page gaps, and page-height floors. That is the wrong model for
Markdown. Markdown is prose, not a fixed-page document format.

The correct model is:

- continuous rendered document
- internal virtual chunks
- invisible chunk boundaries
- stable scroll anchoring
- source-faithful Text mode
- rich Markdown rendering without page chrome

Virtualization remains important. Pagination does not.

## Problem

The current viewer conflates two concepts:

| Concept | Correct Role | Current Problem |
| --- | --- | --- |
| Virtual chunk | Internal performance unit | Exposed as a page |
| Page | User-facing fixed document unit | Invented for Markdown |
| Page number | Useful for PDF/DOCX/image stacks | Misleading for Markdown |
| Page shell | Measurement/positioning container | Styled as visible paper |
| Page height | Estimate for virtualization | Treated as real layout boundary |

This creates visible defects:

- gray delimiters between chunks
- artificial whitespace
- apparent page overflow
- flicker/jump when measured heights update
- toolbar says `Page N of M` for a non-paged document
- Mermaid and other async content make chunk boundaries visible
- users perceive virtualization artifacts as document layout

## Product Target

The Markdown viewer should feel like reading a normal rendered Markdown
document.

Required behavior:

- The document scrolls continuously.
- There are no visible page boundaries.
- There is no page count in the toolbar.
- Chunk boundaries are never perceptible.
- Zoom affects the continuous document scale.
- Rendered/Text toggle remains.
- Copy/download controls remain.
- Fragment navigation and source-line navigation remain stable.
- Large documents remain virtualized.
- Async renderers do not cause visible jumps.

Non-goals:

- Do not make Markdown behave like PDF.
- Do not introduce print-preview pagination.
- Do not preserve blank page space to avoid jumps.
- Do not expose chunk numbers as pages.
- Do not add page rails, page thumbnails, or page separators.

## Desired UI

Toolbar:

```txt
Rendered | Text                                      - 75% +  fit  copy  download
```

Remove:

```txt
Page 2 of 5
```

Possible future replacement:

```txt
Line 120
Section 6
42%
```

Do not add this now unless there is a concrete workflow. A quiet toolbar is
better than misleading progress.

Document surface:

- one centered readable column
- no page ring
- no page shadow
- no page background distinct from document body unless needed for contrast
- no forced minimum page height
- no artificial page breaks
- chunk spacing should be normal block flow spacing

## Architecture Target

Keep the existing model split, but rename and reframe it mentally:

| Current Name | Target Meaning |
| --- | --- |
| `MarkdownDocumentPage` | `MarkdownDocumentChunk` |
| `document.pages` | `document.chunks` |
| `pageNumber` | internal chunk index |
| `markdown-document-page` | `markdown-document-chunk` |
| page shell | virtual chunk shell |
| page measurement | chunk measurement |

The rename can happen in a dedicated cleanup pass. The first functional pass can
keep names if needed, but no user-visible behavior should depend on page
semantics.

## Rendering Model

Use a single virtual canvas inside the scroll viewport.

Each rendered chunk:

- is absolutely positioned for virtualization
- has a width matching the readable column
- has no visible border/ring/shadow
- has no page-like min-height
- measures its actual rendered content height
- includes only enough padding/margin to preserve continuous prose rhythm

The canvas:

- owns top/bottom breathing room
- owns total virtual height
- is centered in the viewport
- does not draw page boundaries

The chunk shell should be visually neutral:

```txt
absolute text-card-foreground
```

Avoid:

```txt
shadow-sm ring-1 ring-border bg-card
```

## Measurement Policy

Measurements should represent actual content flow, not fixed pages.

Rules:

- Initial estimates may be approximate.
- Measured heights replace estimates.
- Measured heights may shrink or grow.
- Scroll anchoring must compensate for height changes above the viewport.
- There should be no minimum chunk height beyond `1px`.
- There should be a small virtual gap only if needed to avoid margin collapse or
  measurement ambiguity.
- Gap must not read visually as a page break.

The earlier no-shrink rule is wrong for continuous Markdown. It hides jumps by
preserving artificial whitespace. The correct fix is better scroll anchoring,
not page-height floors.

## Scroll Anchoring

When chunk measurements change, preserve the reader's visual anchor.

Current strategy:

- capture virtual item index + offset
- update measurements
- restore scrollTop from new geometry

Required refinement:

- capture the first visible content-bearing chunk, not merely the item at raw
  scrollTop
- include canvas top padding in the anchor consistently
- restore before paint where possible
- ignore measurement changes for chunks below the viewport
- batch measurement updates in one animation frame to avoid multi-step settling

Acceptance:

- async diagram render above the viewport does not move visible content
- async diagram render inside the viewport does not move the top of the current
  paragraph unexpectedly
- repeated measurement passes settle without oscillation
- scrollTop and visual content are stable after idle

## Async Content Policy

Async renderers must reserve stable space.

Mermaid:

- render supported graph/flowchart diagrams synchronously with the built-in safe
  SVG renderer when possible
- do not show a loading placeholder for supported local diagrams
- if a third-party Mermaid renderer is available, it may enhance only when the
  resulting dimensions are stable
- invalid diagrams render a fixed-height error state

Images/video/component blocks:

- reserve dimensions from explicit width/height/aspect ratio when available
- otherwise use a conservative placeholder height
- update measurement once loaded
- rely on scroll anchoring, not page floors

## Text Mode

Text mode should also be continuous.

Requirements:

- preserve exact source text
- no chunk delimiters
- no page labels
- no artificial page whitespace
- virtualize by source-line/chunk windows internally
- keep copy-all using the original document source

Text chunks can still be internal, but the user should see a continuous source
document.

## Source Linking And Navigation

Keep line and fragment navigation.

Requirements:

- heading anchors resolve to the correct DOM heading
- fragment links scroll to the heading in the continuous document
- source-line highlights apply to the relevant rendered block
- scroll-to-line positions the relevant block near the top of the viewport
- no page number is needed for these operations

The viewer may continue using internal chunk indices to find the target quickly.
That index must not be presented as a page.

## Accessibility

Continuous Markdown should expose document semantics, not page semantics.

Requirements:

- no `Page N` text for chunks
- no page landmark roles
- headings remain real headings
- tables remain real tables
- footnotes remain accessible
- code copy buttons remain labelled
- diagram surfaces have clear labels
- virtualized offscreen content should not confuse keyboard navigation

If virtualization unmounts focused content, focus must be handled deliberately.
Do not let focus disappear silently during scroll-window changes.

## Implementation Plan

### Phase 1: Stop Leaking Page UI

- Remove `Page N of M` from `MarkdownDocumentToolbar`.
- Rename toolbar mental model to document controls.
- Keep Rendered/Text, zoom, fit width, copy, download.
- Browser verify that the toolbar no longer describes pages.

### Phase 2: Remove Page Chrome

- Remove visible ring, shadow, and page background from chunk shells.
- Remove forced page-like min-height after measurement.
- Reduce chunk gap to a technical spacing value only.
- Keep highlight ring only for source-highlighted chunks if needed, but make it
  block-level and subtle.

### Phase 3: Restore Continuous Measurement

- Allow measured heights to shrink below estimates again.
- Replace the no-shrink virtualizer rule with stronger scroll anchoring.
- Batch measurements to avoid multiple visible correction passes.
- Add regression tests for shrinking measurements above the viewport.

### Phase 4: Rename Internals

Hard cutover, no compatibility aliases:

- `MarkdownDocumentPage` -> `MarkdownDocumentChunk`
- `pages` -> `chunks`
- `pageNumber` -> `chunkIndex` or `chunkNumber`
- `markdown-document-page` -> `markdown-document-chunk`
- `currentPage` -> remove, or replace with internal `currentChunk`

Update all call sites and tests in one pass.

### Phase 5: Async Content Stability

- Keep synchronous Mermaid fallback as the first render path.
- Add stable placeholder dimensions for async component/image/video blocks.
- Ensure measurement changes do not create visible jumps.

### Phase 6: Documentation

- Update Markdown Viewer docs to describe continuous rendering.
- Remove any claim that Markdown is paged.
- Mention that large documents are virtualized internally.
- Keep supported Markdown feature matrix.

## Tests

Add or update focused tests:

- toolbar does not render `Page N of M`
- rendered mode has no visible page shell classes
- chunk measurements may shrink estimates
- shrinking a chunk above the viewport preserves visual anchor
- growing a chunk above the viewport preserves visual anchor
- Mermaid supported graph renders without loading placeholder
- repeated diagram measurement does not move visible content after idle
- Text mode shows continuous source text without page delimiters
- fragment navigation works without page UI
- source-line scroll works without page UI

Browser verification:

- open `/docs/viewers/markdown-viewer`
- scroll from top to bottom
- confirm no visible page boundaries
- confirm no large blank page-like gaps
- confirm no `Page N of M`
- confirm Mermaid renders without flicker
- confirm scroll position is stable after idle
- confirm Text mode is continuous
- confirm no console errors

## Definition Of Done

The Markdown viewer is correct when:

- virtualization is invisible
- the document reads as one continuous Markdown surface
- no page count or page chrome remains
- no artificial page whitespace remains
- internal chunk measurement can change without visible jumps
- source Text mode remains faithful and continuous
- all Markdown feature tests still pass
- registry output matches source
- browser verification passes on the docs route

