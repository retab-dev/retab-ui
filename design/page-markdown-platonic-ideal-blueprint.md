# Page Markdown Platonic Ideal Blueprint

## Objective

Turn the current Parse/PageMarkdown viewer from a strong implementation into the
smallest, fastest, most inevitable version of itself.

The current viewer is close: it has PDF-style layout math, scroll ownership,
virtualized page slots, measured page frames, rendered/text modes, and source
document sync. The remaining work is not another rewrite. It is a purification
pass:

- fewer responsibilities per module
- one vocabulary for the same concept everywhere
- no stale DOM-scanning paths in the markdown pane
- stronger large-document proof
- sharper tests around behavior rather than implementation details
- no compatibility surface that does not serve the final design

## Non-Goals

- Do not create a generic viewer abstraction.
- Do not merge Parse Viewer, Text Viewer, and Markdown Document Viewer.
- Do not replace React Markdown rendering with Pretext in this component.
- Do not make document-pane children conform to markdown internals.
- Do not preserve legacy APIs if all call sites can be updated cleanly.

## Current State

The component now follows the same broad grammar as PDF:

```txt
page-markdown-layout.ts           pure page height, offset, and window math
page-markdown-scale.ts            fit-width and zoom state
page-markdown-scroll.ts           viewport, current page, progress, scrollToPage
page-markdown-virtualization.ts   RAF-coalesced visible page numbers
page-markdown-pane.tsx            toolbar + scroll area + virtual page slots
page-markdown-page-frame.tsx      measured paper frame
page-markdown-content.tsx         rendered/text content
page-markdown-viewer.tsx          split-pane coordination
parse-viewer.tsx                  Parse-specific adapter
```

This is the correct direction. The remaining problem is density and finality:
some boundaries are still soft, and the proof surface is not yet as strong as
PDF's.

## Ideal Shape

The final component should read as four layers:

```txt
Adapter layer:
  parse-viewer.tsx

Coordinator layer:
  page-markdown-viewer.tsx
  page-markdown-sync.ts

Document pane layer:
  page-markdown-pane.tsx
  page-markdown-scroll.ts
  page-markdown-virtualization.ts
  page-markdown-measurements.ts

Primitive layer:
  page-markdown-layout.ts
  page-markdown-scale.ts
  page-markdown-page-frame.tsx
  page-markdown-content.tsx
  page-markdown-components.tsx
  page-markdown-toolbar.tsx
  page-markdown-actions.tsx
  page-markdown-empty-state.tsx
```

Each layer owns one kind of decision:

- Adapter: translate product data into page markdown props.
- Coordinator: sync source document page and markdown page.
- Document pane: manage the scrolling page document.
- Primitive: render content or compute pure state.

## Module Refinements

### `page-markdown-viewer.tsx`

Target responsibility:

- Own rendered/text mode.
- Own split-pane composition.
- Wire document-pane page reports to markdown-pane commands.
- Wire markdown-pane visible page reports to document-pane commands.

It should not know:

- page layout details
- scroll offsets
- measurement cache details
- page frame sizing

Action:

- Move `usePagePaneSync` out of `page-markdown-hooks.ts` into
  `page-markdown-sync.ts`.
- Rename callback concepts consistently:
  - source document reports: `onDocumentPageChange`
  - markdown reports: `onMarkdownPageChange`
  - external consumer: `onVisiblePageChange`
- Keep the rule that confirmed programmatic syncs are not republished as user
  markdown navigation.

### `page-markdown-pane.tsx`

Target responsibility:

- Compose toolbar and scroll area.
- Build layout from pages, mode, scale, and measured heights.
- Render only virtual page slots.
- Expose `scrollToPage`.

It should not directly own all measurement cache mechanics.

Action:

- Extract measurement state into `page-markdown-measurements.ts`.
- Extract scroll anchor preservation into the same module or a small
  `page-markdown-scroll-anchor.ts` if it remains nontrivial.
- Keep `PageMarkdownPane` visually similar to `PdfViewerInner`'s document
  column.

Target pane composition:

```tsx
const measurements = usePageMarkdownMeasurements({ pages, mode, scale })
const layout = usePageMarkdownLayoutModel({ pages, mode, scale, measurements })
const scroll = usePageMarkdownScroll({ layout, ... })
const virtualPages = usePageMarkdownPageVirtualization({ layout, ... })
```

The render should then be almost declarative:

```tsx
<PageMarkdownToolbar ... />
<PageMarkdownCanvas layout={layout} virtualPages={virtualPages}>
  <PageMarkdownPageFrame ... />
</PageMarkdownCanvas>
```

Only introduce `PageMarkdownCanvas` if it removes real code from the pane. Do
not add it as ceremony.

### `page-markdown-layout.ts`

Target responsibility:

- Pure page geometry.
- Pure height estimation.
- Pure visible-window math.

Action:

- Keep all functions deterministic and browser-free.
- Keep page-number inputs 1-based everywhere.
- Keep arrays indexed internally only where the code is obviously converting
  page number to index.
- Rename any remaining `page` variable to `pageNumber` when it means a number.
- Reserve `pageLayout` for `{ pageNumber, height, width, offsetTop }`.
- Consider exporting `getPageMarkdownPageOffsetTop` only if tests or hooks need
  it directly; otherwise keep it private.

Estimator target:

- Keep it heuristic.
- Keep it cheap.
- Make it monotonic enough that large scroll jumps land near the right page
  before measurement.
- Do not try to perfectly emulate CSS layout. Measurement corrects estimates.

### `page-markdown-scroll.ts`

Target responsibility:

- Own viewport element.
- Report current page and progress.
- Expose imperative layout-based scroll targets.

Action:

- Match `pdf-viewer-scroll.ts` naming where possible.
- Add focused tests for:
  - 20% marker page detection
  - progress clamping
  - reset-key scroll reset
  - `scrollToPage` for unmounted pages
- Consider returning `scrollToPage` that synchronously measures after setting
  scroll, or document that the pane wrapper performs this. Prefer one owner.

### `page-markdown-virtualization.ts`

Target responsibility:

- Convert viewport scroll position into visible page numbers.
- Coalesce updates with `requestAnimationFrame`.
- Reset visible window on document reset.

Action:

- Keep this nearly identical to `pdf-viewer-virtualization.ts`.
- Add a large-document integration test proving a 1,000-page input mounts a
  small bounded number of page frames.
- Keep the default overscan value in layout/window math, not spread across
  callers.

### `page-markdown-page-frame.tsx`

Target responsibility:

- Render one paper frame.
- Report measured height.

Action:

- Keep no virtualization logic here.
- Keep no markdown sync logic here.
- Keep the `ResizeObserver` path and no-observer fallback.
- Use a single page identity prop name: `pageNumber`.
- Use `data-page-number` only on the virtual slot. Use `data-page` or no page
  attribute on inner visual frame to avoid duplicate page targets.

### `page-markdown-content.tsx`

Target responsibility:

- Render one page's content in either rendered mode or text mode.

Action:

- Keep GFM behavior here.
- Keep sanitization/link hardening tests close to this component.
- Keep text mode naturally wrapped.
- Do not introduce Pretext here unless this component becomes a text editor.
  This viewer is for rendered page markdown, not character-level editing.

## Naming Canon

Use these names everywhere:

```txt
pageNumber        1-based page identity
pageIndex         0-based array index
pageLayout        geometry for one page
layout            full PageMarkdownLayoutModel
viewportElement   scroll viewport DOM element
visiblePageNumbers virtualized page numbers
measuredHeightByPageNumber Map<number, number>
measurementKey    mode + scale + markdown signature
resetKey          document identity boundary
mode              "rendered" | "text"
scale             resolved numeric scale
```

Avoid:

```txt
page              when it means pageNumber
item              for page layouts
row               for pages
frame             for virtual slots
target            without saying document or markdown
current           without saying currentPage/currentMode/currentScale
```

## Performance Contract

The final component must satisfy these constraints:

- Initial render for 1,000 pages mounts only the visible window plus overscan.
- Scroll does not query all page DOM nodes.
- Scroll current-page calculation is `O(log n)` in page count.
- Visible-window calculation is `O(log n + windowSize)`.
- Measurement updates do not remount unrelated pages.
- No per-scroll markdown parsing.
- No per-scroll React state update if visible page/window did not change.
- No `scrollIntoView` for markdown pages.
- No TanStack Virtual in this component.

## Behavioral Contract

The final component must preserve:

- Rendered markdown mode with GFM tables, task lists, code, links, and images.
- Text mode with wrapped source text.
- Copy and download of canonical full markdown text.
- Fit width and manual zoom.
- Source document to markdown page sync.
- Markdown page to source document sync.
- Reset to page 1 and rendered mode when document identity changes.
- Clamp out-of-range source document page reports.
- No source document bounce during pending programmatic markdown sync.

## Test Plan

### Pure Layout

- Empty layout has no visible pages.
- Estimated offsets are deterministic.
- Measured height deltas update downstream offsets.
- Binary search finds the page at or before an offset.
- Visible page windows overscan and clip at document edges.
- Rendered estimator accounts for block shape.
- Text estimator remains line based.

### Scroll

- 20% viewport marker reports the expected page.
- Progress is clamped to `[0, 1]`.
- `scrollToPage` uses layout offsets for unmounted pages.
- Reset key resets scroll and current page.
- RAF fallback works when `requestAnimationFrame` is unavailable.

### Virtualization

- Empty layout exposes no page.
- Multiple scroll measurements coalesce into one animation frame.
- Reset key ignores previous scroll offset during render.
- 1,000 pages mount a bounded page-slot count.
- Scrolling near page 500 mounts only a bounded window around page 500.

### Measurement

- `PageMarkdownPageFrame` reports height with `ResizeObserver`.
- Missing `ResizeObserver` reports a best-effort height.
- Rendered and text measurements are isolated by key.
- Zoom measurements are isolated by key.
- Measurement changes preserve scroll anchor.

### Integration

- Parse Viewer empty/loading/rendered states still pass.
- Source document report scrolls markdown viewport by layout offset.
- Markdown user scroll reports to consumer and source document.
- Programmatic sync confirmation does not call external
  `onVisiblePageChange`.
- Copy/download use canonical `text`, not visible page content.
- Large Parse demo route proves real DOM slot count stays bounded.

## Browser Verification

Add or update a docs/demo fixture with at least 1,000 generated markdown pages.

Required browser checks:

- Route loads without console errors.
- Initial `page-markdown-page-slot` count is bounded.
- Scrolling near the middle changes the mounted page-number window.
- Toolbar page label updates.
- Rendered/text toggle keeps slot count bounded.
- Zoom in/out keeps slot count bounded and does not blank the viewport.

The current Parse docs sample is only one page, so it cannot prove
virtualization in the browser.

## Cleanup Plan

1. Create `page-markdown-sync.ts` and move pane sync logic there.
2. Create `page-markdown-measurements.ts` for measured heights and scroll
   anchor preservation.
3. Rename page identity props from `page` to `pageNumber`.
4. Add scroll-hook tests.
5. Add measurement-hook/frame tests.
6. Add 1,000-page integration test.
7. Add large Parse docs/demo fixture.
8. Remove any markdown-pane test that relies on page `getBoundingClientRect`.
9. Keep `page-markdown-dom.ts` only for source document pane behavior, or move
   it under a document-pane-specific name.
10. Run focused tests, scoped lint, scoped typecheck, and browser verification.

## Acceptance Criteria

This component reaches the target when:

- `PageMarkdownPane` can be understood in one read as composition, not
  mechanics.
- Every non-render module can be tested without React except hooks that must
  own browser state.
- A 1,000-page Parse output mounts a small bounded number of markdown pages.
- There is no markdown-page DOM scan during scroll.
- There is no markdown-page `scrollIntoView`.
- All names match the naming canon.
- Tests describe behavior, not incidental DOM implementation.
- The full relevant suite is green.
- The docs/demo route proves the large-document behavior visually and through
  DOM slot counts.

## Final Standard

The ideal PageMarkdown viewer is not the most abstract viewer. It is the most
obvious one:

- PDF-like where page math matters.
- DOCX-like where browser layout owns rich content.
- Image-like where frame rendering is isolated.
- Parse-specific where source/markdown page sync is product behavior.

Everything else should be removed.
