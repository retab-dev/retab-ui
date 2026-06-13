# Viewer Performance Uncovered Blueprint

## Context

`design/viewer-performance-fixes-audit.md` already covers the primary viewer
performance work:

- XLSX grid DOM row patching.
- Image/TIFF frame virtualization.
- JSON inspector line virtualization.
- JSON table read-only row patching.
- PPTX math-based visible-slide tracking.

This blueprint covers the remaining viewer work not covered by that audit. The
same principle applies: predictable geometry should be projected from scroll
math, hot scroll paths should stay out of React, and mounted DOM should be
reused where the content model allows it.

## 1. Code Viewer: Replace TanStack Virtual With The Shared Fixed-Line Engine

### Current State

The Code Viewer still uses TanStack Virtual directly:

- `registry/new-york-v4/ui/code-viewer-content.tsx`
- `registry/new-york-v4/ui/code-viewer-virtualization.ts`
- `registry/new-york-v4/ui/code-viewer-line.tsx`

The workload is simpler than markdown text: fixed-height source lines, stable
line count, fixed gutter width for a given file, and no wrapping. TanStack works,
but it is now the odd one out after the text viewer work.

### Problem

Every scroll range update is still a React virtualizer update. For code this is
usually acceptable, but it leaves three inconsistencies:

- The code path depends on TanStack while the text path now has custom engines.
- The render loop still maps visible rows through React during scroll.
- Prism tokenization is cached by line text, but line rendering still happens as
  React row projection.

### Fix

Build a small fixed-line code projector:

- Precompute line height, gutter width, total height, and line count.
- Use passive scroll listener plus one `requestAnimationFrame` scheduler.
- Compute visible line range with fixed-height math.
- Reuse mounted row nodes by line index or by pool slot.
- Patch row transform, line number text, highlight class, and tokenized content.
- Keep Prism token cache, but render token leaves into DOM fragments outside
  React during row materialization.

### Cutover

Replace the TanStack path outright. Do not keep a compatibility branch.

### Acceptance

- Large code files scroll without React commits per wheel tick.
- Highlight scroll-to-line still works.
- Zoom preserves anchor and reprojects visible rows.
- Syntax highlighting output matches existing tests.
- `@tanstack/react-virtual` is no longer imported by the Code Viewer.

## 2. Markdown Document Viewer: Move Page Projection Out Of React

### Current State

There are two markdown-document surfaces in active use or in flight:

- `registry/new-york-v4/ui/markdown-document-viewer.tsx`
- `components/viewers/page-markdown/page-markdown-viewer.tsx`
- `components/viewers/page-markdown/page-markdown-pane.tsx`

The registry Markdown Document Viewer already has custom page geometry and a
virtual page window. It still stores `scrollTop` in React state and maps
`virtualWindow.items` through React on scroll.

### Problem

This is the same remaining gap the text viewer had before the Chenglou work:
the virtual range math is custom, but visible projection still flows through
React. For a paged markdown document, each visible page can contain expensive
rendered markdown trees, measurements, copy controls, and syntax-highlighted
blocks.

### Fix

Split the viewer into model, scheduler, and projector:

- Keep `createMarkdownDocument` and markdown page layout as the document model.
- Keep page geometry and measured-height correction.
- Replace React `scrollTop` state as the hot path with a passive scroll listener
  and RAF scheduler.
- Maintain a DOM cache keyed by page measurement key.
- Project page shells imperatively: insert, remove, and move page containers.
- Let React render page content only when a page shell is first materialized or
  when its render key changes.
- Preserve anchor capture on zoom and after measured-height correction.

The page content can stay React-rendered inside a mounted root per page. The
important part is that scroll projection should not re-render the parent viewer.

### Page Markdown Consolidation

The `components/viewers/page-markdown/*` implementation should not grow a
separate virtualization architecture. It should either:

- consume the same markdown page projector, or
- be hard-cut over to the registry Markdown Document Viewer internals.

No duplicate page virtualizers should survive.

### Acceptance

- Scrolling a long rendered markdown document does not update React state per
  scroll frame in the root viewer.
- Page measurement still corrects estimates without jumping the reading anchor.
- Rendered/text mode switch remains correct.
- Fragment links and line-range scroll remain correct.
- Page Markdown and registry Markdown Document Viewer share the same projection
  engine or one implementation is removed.

## 3. PPTX Viewer: Virtualize Slide Shells, Not Only Canvas Rendering

### Current State

The audit covers replacing DOM scanning in visible-slide tracking. It does not
cover slide shell virtualization.

`PptxSlideScroller` currently creates one `PptxSlideFrame` per slide:

- `registry/new-york-v4/ui/pptx-viewer-slide.tsx`

Each frame installs an `IntersectionObserver`. Canvas rendering is gated by
intersection, which is good, but the wrapper DOM and observers are still created
for the whole deck.

### Problem

For ordinary decks this is fine. For very large decks, the viewer pays upfront
for:

- one React component per slide,
- one wrapper DOM subtree per slide,
- one observer target per slide,
- overlay component setup per slide when overlays are enabled.

This is not as bad as rendering every canvas, but it is still not Chenglou-style
projection.

### Fix

Build slide geometry and a virtual slide window:

- Compute slide width, height, visible width, visible height, gap, and padding
  from base size, zoom, and rotation.
- Render a fixed-height virtual canvas.
- Mount only visible plus near-visible slide shells.
- Replace per-slide `IntersectionObserver` with virtual-window membership.
- Keep `createPptxScrollActivity` so non-eager rendering can wait until scroll
  idle.
- Keep bitmap cache behavior unchanged.

### Relationship To The Audit

This complements the audit's PPTX visible-slide math. The same slide layout
model should drive both:

- current slide from `scrollTop`,
- virtual shell window from `scrollTop`,
- scroll-to-slide behavior if added later.

### Acceptance

- Large decks mount a bounded number of slide frames.
- Eager and non-eager render modes still behave correctly.
- Rotation and zoom preserve layout.
- Overlays render only for mounted slide frames.
- Current slide tracking uses the shared slide geometry model.

## 4. PDF Thumbnail Sidebar: Optional Imperative Rail Projection

### Current State

The main PDF viewer is already covered by the audit as mostly fine. The PDF
thumbnail sidebar is separate:

- `registry/new-york-v4/ui/pdf-thumbnail-sidebar.tsx`
- `registry/new-york-v4/ui/use-pdf-thumbnail-window.ts`
- `registry/new-york-v4/ui/pdf-thumbnail-rail.tsx`
- `registry/new-york-v4/ui/pdf-thumbnail-item.tsx`

It is already virtualized and RAF-coalesced, so this is not urgent.

### Problem

The thumbnail rail still updates React state for visible thumbnail items during
scroll. Each visible item can render a canvas thumbnail, and current-page follow
behavior can compete with user scroll behavior.

### Fix

Only do this if profiling shows the thumbnail rail is material:

- Keep the existing thumbnail layout model.
- Replace visible-item React state with a passive scroll plus RAF projector.
- Reuse thumbnail item shells.
- Keep canvas render resources keyed by page number and thumbnail size.
- Patch current-page state separately from scroll projection so changing the
  active page does not remount the rail.

### Acceptance

- Large PDF rails scroll with no React commits per scroll tick.
- Current-page highlight changes patch existing nodes where possible.
- Thumbnail canvas cache and cancellation behavior remain correct.
- Keyboard/click page selection remains accessible.

## 5. HTML Viewer: Explicitly Do Not Apply Chenglou Projection

### Current State

The HTML viewer is an embedded document surface:

- `registry/new-york-v4/ui/file-viewer-html-viewer.tsx`

### Decision

Do not apply Chenglou-style projection here. Browser HTML layout is not our
geometry model, and arbitrary HTML can have CSS, intrinsic layout, images, and
scripts or sandbox constraints. Virtualizing arbitrary HTML would either be
incorrect or require a full document layout engine.

### Work

The only performance work here should be containment and sandbox hygiene:

- ensure iframe or sandboxed rendering is isolated,
- avoid resizing loops,
- avoid injecting large HTML into React trees.

This is not part of the Chenglou-style viewer work.

## Recommended Order

1. Code Viewer fixed-line projector.
2. Markdown Document Viewer imperative page projector.
3. Consolidate Page Markdown onto the same projector.
4. PPTX slide shell virtualization.
5. PDF thumbnail rail imperative projection only if profiling justifies it.

## Non-Goals

- Do not duplicate work from `viewer-performance-fixes-audit.md`.
- Do not add compatibility branches or parallel runtime paths once a cutover is
  chosen.
- Do not force Chenglou projection onto viewers without predictable geometry.
- Do not optimize DOCX here; the audit already covers the only plausible DOCX
  direction.
