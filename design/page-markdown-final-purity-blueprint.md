# Page Markdown Final Purity Blueprint

## Verdict

No, the component is not yet at the platonic ideal.

It is close in the important ways: the markdown pane now has PDF-style page
math, custom virtualization, measured page frames, source-document sync, and a
clear split between Parse-specific data and PageMarkdown rendering. The
remaining gap is not capability. The remaining gap is finality:

- the module boundaries must become as predictable as PDF's
- the naming must be one vocabulary everywhere
- the registry/demo surface must prove the same implementation users import
- large-document behavior must be verified in tests and browser
- the source document pane and markdown pane must stop sharing ambiguous page
  helpers

The target is not more abstraction. The target is less ambiguity.

## Reference Standard

Use the existing viewer family as the standard, but copy the right part of each
viewer.

### PDF Viewer

PDF is the closest architectural reference.

Keep these ideas:

- pure layout model for page sizes, offsets, total height, and visible windows
- binary-search page lookup from scroll offset
- dedicated scroll hook with current page, progress, `scrollToPage`, and
  viewport ownership
- RAF-coalesced virtualization hook
- separate scale module
- page component only renders one page
- toolbar is chrome, not state math

Do not copy PDF-specific ideas:

- PDF page area targeting unless Parse needs field-level target scroll
- canvas/render-task lifecycle
- thumbnail rail concerns

### Image Viewer

Image is the frame/content reference.

Keep these ideas:

- stable `data-slot` names for test and integration hooks
- frame rendering isolated from chrome and controls
- imperative handle exposes viewport access
- 20% viewport marker for visible frame/page semantics
- expensive content work is gated by visibility

Do not copy Image's scaling limit:

- Image mounts all frame shells. PageMarkdown must not. It must virtualize the
  page shells themselves.

### DOCX Viewer

DOCX is the browser-layout reference.

Keep these ideas:

- source document DOM can remain browser-layout-owned
- source page detection can use `[data-page-number]` when no layout model
  exists
- fit-width and reset semantics should feel identical

Do not copy DOCX's markdown-pane strategy:

- no full DOM page scan for markdown pages
- no markdown-page `scrollIntoView`
- no scroll calculation that is linear in page count

## Ideal Module Map

The final component should have four layers and no cross-layer leakage.

```txt
Adapter:
  parse-viewer.tsx

Coordinator:
  page-markdown-viewer.tsx
  page-markdown-sync.ts

Markdown document pane:
  page-markdown-pane.tsx
  page-markdown-scroll.ts
  page-markdown-virtualization.ts
  page-markdown-measurements.ts

Primitives:
  page-markdown-layout.ts
  page-markdown-scale.ts
  page-markdown-page-frame.tsx
  page-markdown-content.tsx
  page-markdown-components.tsx
  page-markdown-toolbar.tsx
  page-markdown-actions.tsx
  page-markdown-empty-state.tsx
  page-markdown-document-dom.ts
```

Responsibilities:

- `parse-viewer.tsx` translates Retab Parse output into PageMarkdown props.
- `page-markdown-viewer.tsx` composes split panes and owns rendered/text mode.
- `page-markdown-sync.ts` owns document-to-markdown and markdown-to-document
  synchronization.
- `page-markdown-pane.tsx` composes toolbar, viewport, layout, scroll,
  virtualization, and page frames.
- `page-markdown-layout.ts` is pure geometry.
- `page-markdown-scroll.ts` owns viewport scroll state and page reports.
- `page-markdown-virtualization.ts` owns mounted page numbers.
- `page-markdown-measurements.ts` owns measured heights and scroll anchor
  restoration.
- `page-markdown-page-frame.tsx` owns one measured paper frame.
- `page-markdown-content.tsx` owns rendered markdown vs wrapped source text.
- `page-markdown-document-dom.ts` is only for the source document pane.

No module should be both a policy module and a rendering module.

## Non-Negotiable Runtime Contract

The final viewer must satisfy these constraints:

- 1,000 markdown pages mount only a bounded visible window plus overscan.
- Scroll current-page calculation is `O(log n)`.
- Visible-window calculation is `O(log n + visiblePageCount)`.
- No per-scroll React state update when current page and window are unchanged.
- No per-scroll markdown parsing.
- No markdown-pane DOM query over all pages.
- No markdown-pane `scrollIntoView`.
- Measurement updates do not remount unrelated pages.
- Rendered mode and text mode do not share measured heights.
- Zoom levels do not share measured heights.
- Source-document sync does not bounce events back to the external consumer.
- No TanStack Virtual in this component.

## Naming Canon

Use one vocabulary everywhere:

```txt
pageNumber                 1-based page identity
pageIndex                  0-based array index
pageLayout                 one page's geometry
layout                     full PageMarkdownLayoutModel
viewportElement            scroll viewport DOM element
visiblePageNumbers         virtualized page numbers
measuredHeightByPageNumber Map<number, number>
measurementKey             mode + scale + markdown signature
resetKey                   document identity boundary
mode                       "rendered" | "text"
scale                      resolved numeric scale
```

Avoid:

```txt
page        when it means pageNumber
item        for page geometry
frame       for virtual page slots
target      without document/markdown qualifier
current     without currentPage/currentMode/currentScale
```

This is not cosmetic. In a component with sync, virtualization, and
measurement, inconsistent nouns create bugs.

## Required Hard Cutovers

Do these as hard cutovers, not compatibility shims.

1. `page-markdown-sync.ts`
   - Own all pane sync state.
   - Expose `usePageMarkdownSync`.
   - Delete stale hook names.
   - Use `pageNumber` in state, transitions, and callback names.

2. `page-markdown-measurements.ts`
   - Own the measurement cache.
   - Own scroll-anchor capture and restoration.
   - Key measurements by markdown identity, mode, and scale.

3. `page-markdown-document-dom.ts`
   - Keep DOM page scrolling only for the source document pane.
   - Make the name explicit so markdown virtualization never imports it by
     accident.

4. Registry files
   - The public registry entry must include the same files the local docs use.
   - Remove deleted files from registry metadata and generated blocks.
   - No registry snapshot should mention removed modules.

5. Demo fixture
   - Add a 1,000-page Parse/PageMarkdown demo section.
   - Give it a stable test hook.
   - Browser verification must inspect the real docs route, not only unit tests.

## Rendering Contract

The viewer has two rendering modes and both must remain first-class.

Rendered mode:

- uses React Markdown with GFM behavior
- supports tables, task lists, code, headings, links, and images
- preserves the Parse page model
- renders only virtualized pages
- measures actual DOM height after render

Text mode:

- renders wrapped source markdown text
- does not show line numbers
- preserves page boundaries
- virtualizes page shells exactly like rendered mode
- has independent height measurements

Pretext is not the renderer for this component. Pretext is useful for text
editing and efficient text-document layout, but Parse Viewer is a page-based
rendered markdown viewer. The right architecture here is React Markdown
rendering inside PDF-style page virtualization.

## Sync Contract

Source document and markdown pane are peers, not parent/child scroll mirrors.

Rules:

- Source document page reports call `reportDocumentPage(pageNumber)`.
- Markdown user scroll reports call `reportMarkdownPage(pageNumber)`.
- Programmatic markdown scroll confirmation must not call external
  `onVisiblePageChange`.
- Out-of-range page reports are clamped once at the sync boundary.
- Pending sync state has one owner.
- The markdown pane scrolls by layout offset, not DOM element lookup.
- The source document pane may use DOM lookup because it does not own a
  source-document layout model.

## Test Contract

The tests should prove behavior, not incidental implementation.

Pure layout:

- empty layout has no visible pages
- estimated offsets are deterministic
- measured deltas update downstream offsets
- page lookup by offset is binary-search correct
- visible windows overscan and clip at boundaries
- rendered and text estimators produce different plausible heights

Scroll:

- 20% viewport marker reports the expected page
- progress is clamped to `[0, 1]`
- `scrollToPage` works for unmounted pages
- reset key restores page 1 and scroll top 0
- RAF fallback does not break scroll measurement

Virtualization:

- empty layout mounts no pages
- repeated scroll events coalesce into one frame
- reset ignores stale scroll position
- 1,000 pages mount a bounded page-slot count
- scrolling near page 500 mounts a bounded window around page 500

Measurement:

- `ResizeObserver` path reports height
- no-`ResizeObserver` fallback reports height
- rendered/text measurements are isolated
- zoom measurements are isolated
- measurement changes preserve scroll anchor

Integration:

- Parse empty/loading/rendered states pass
- copy/download use canonical full markdown text
- source document scroll drives markdown pane
- markdown user scroll drives source document
- programmatic sync confirmation is not republished externally
- docs large-demo route keeps DOM slot count bounded while scrolling, toggling
  mode, and zooming

## Browser Verification

The browser proof should run against:

```txt
http://localhost:3100/docs/viewers/parse-viewer
```

Required checks:

- page loads without console errors
- large demo initially mounts a bounded number of
  `[data-slot="page-markdown-page-slot"]` nodes
- inner viewport scroll near the middle changes mounted page numbers
- toolbar page label updates
- rendered/text toggle keeps mounted page count bounded
- zoom in/out keeps mounted page count bounded
- viewport is never blank after scroll, mode toggle, or zoom

Unit tests can prove math. Browser verification proves the assembled viewer.

## Acceptance Criteria

The component reaches the target only when all of this is true:

- `PageMarkdownPane` reads as composition, not mechanics.
- Every pure concern is tested without React.
- Browser-state hooks have focused tests.
- The 1,000-page test and demo are both present.
- No markdown-pane scroll path scans all page DOM nodes.
- No markdown-pane scroll path uses `scrollIntoView`.
- Registry output matches local source.
- Naming matches the canon.
- Focused tests are green.
- Scoped lint/typecheck either pass or have explicitly identified unrelated
  pre-existing failures.

## Final Shape

The ideal PageMarkdown viewer is:

- PDF-like for page math and virtualization
- Image-like for frame/content isolation
- DOCX-like only where browser-owned source-document layout is unavoidable
- Parse-specific only at the adapter and sync boundary

Everything else should be deleted.
