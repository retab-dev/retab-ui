# Viewer Performance Uncovered Blueprint

## Context

`design/viewer-performance-fixes-audit.md` covers these viewer performance
tracks:

- XLSX grid DOM row patching.
- Image/TIFF frame virtualization.
- JSON inspector line virtualization.
- JSON table read-only row patching.
- PPTX math-based visible-slide tracking.
- PDF, CSV, and DOCX as lower-priority or already mostly fine surfaces.

This blueprint covers the performance and architecture work outside that audit.
It is intentionally separate so the audit can stay a narrow fix list, while
this document tracks the remaining Chenglou-style projection work, shared
instrumentation, and explicit non-goals.

The shared rule is simple: if the viewer owns predictable geometry, scrolling
should be driven by math, a passive scroll listener, one RAF scheduler, and a
small DOM projection cache. React can still own semantic content, toolbar state,
and first materialization. It should not be the hot scroll loop.

## 1. Text Viewer: Finish The Pretext Cutover As The Reference Path

### Current State

The new text viewer is the Chenglou-inspired path:

- `registry/new-york-v4/ui/text-viewer.tsx`
- `registry/new-york-v4/ui/text-viewer-layout.ts`
- `registry/new-york-v4/ui/text-viewer-chenglou.tsx`

The old fixed-line text/code surface has been renamed Code Viewer. The text
viewer is for prose, logs, and markdown-like wrapping where visual lines are not
the same thing as source lines.

### Work Not Covered By The Audit

- Make the Pretext-based text viewer the only text route in File Viewer.
- Keep line numbers out of Text Viewer. They belong to Code Viewer.
- Treat wrapping as the default text behavior, not an edge case.
- Keep virtual items as block records, not source lines.
- Keep scroll projection outside React state.
- Remove any leftover dual-path naming such as `pretext viewer` from runtime UI
  once the cutover is complete. The component can be implemented with Pretext;
  the product-facing name is Text Viewer.

### Acceptance

- Text files and markdown-like text open in Text Viewer.
- Source-code-like files open in Code Viewer.
- Text Viewer has no gutter or line-number column.
- Large wrapped files scroll with bounded DOM and no React render per wheel tick.
- Selection, copy, zoom, and download behavior remain intact.

## 2. Code Viewer: Replace TanStack Virtual With A Fixed-Line Projector

### Current State

Code still has a simpler geometry model than text:

- every source line maps to one visual row,
- line height is fixed for a given zoom,
- gutter width is fixed for a given line count,
- horizontal overflow is expected.

The audit does not cover Code Viewer, because it focuses on table and document
surfaces.

Relevant files:

- `registry/new-york-v4/ui/code-viewer-content.tsx`
- `registry/new-york-v4/ui/code-viewer-virtualization.ts`
- `registry/new-york-v4/ui/code-viewer-line.tsx`

### Work Not Covered By The Audit

- Remove `@tanstack/react-virtual` from Code Viewer.
- Add a small fixed-line projection engine.
- Precompute line height, gutter width, total height, and line count.
- Use passive scroll plus one RAF scheduler.
- Compute visible rows with fixed-height math.
- Reuse mounted row nodes by pool slot or line index.
- Patch row transform, line number, active highlight, and tokenized code DOM.
- Keep Prism tokenization cached by line text.
- Keep code-specific behavior separate from Text Viewer wrapping behavior.

### Acceptance

- Large code files scroll without React commits per wheel tick.
- Syntax highlighting output remains stable.
- Scroll-to-line and active-line highlighting still work.
- Zoom preserves the viewport anchor.
- No Code Viewer module imports TanStack Virtual.

## 3. Markdown Document Viewer: Move Page Projection Out Of React

### Current State

The markdown document surfaces already have page geometry and virtual windows,
but the remaining performance question is whether visible page projection still
flows through React on scroll.

Relevant files:

- `registry/new-york-v4/ui/markdown-document-viewer.tsx`
- `registry/new-york-v4/ui/markdown-document-model.ts`
- `registry/new-york-v4/ui/markdown-document-renderers.tsx`
- `components/viewers/page-markdown/page-markdown-viewer.tsx`
- `components/viewers/page-markdown/page-markdown-pane.tsx`

### Work Not Covered By The Audit

- Keep the markdown document model pure: parsing, source-line mapping, page
  grouping, and estimated heights.
- Keep page geometry pure: offsets, visible windows, anchors, and scroll targets.
- Replace root viewer scroll state with passive scroll plus RAF projection where
  it still exists.
- Project page shells imperatively.
- Mount a React root inside a page shell only when the page first materializes or
  its render key changes.
- Reuse page roots while the page remains in the cache.
- Preserve scroll anchors through zoom and measured-height correction.
- Consolidate Page Markdown and Markdown Document onto one page projection
  model. Do not keep two virtualizers for the same concept.

### Acceptance

- Scrolling long rendered markdown does not update root React state per frame.
- Mounted pages remain bounded.
- Measured page heights correct estimates without jumping the reader.
- Rendered/text mode switching stays correct.
- Fragment links, source-line ranges, and scroll-to-page work for unmounted
  pages.
- Page Markdown and Markdown Document share the same projector or one path is
  removed.

## 4. PPTX Viewer: Virtualize Slide Shells

### Current State

The audit covers replacing DOM scans in visible-slide tracking with geometry.
It does not cover the larger shell-level issue: `PptxSlideScroller` can still
create one wrapper component and observer target per slide.

Relevant files:

- `registry/new-york-v4/ui/pptx-viewer.tsx`
- `registry/new-york-v4/ui/pptx-viewer-slide.tsx`
- `registry/new-york-v4/ui/pptx-viewer-visible-slide.ts`

### Work Not Covered By The Audit

- Build one slide layout model from slide size, zoom, rotation, gap, and
  viewport padding.
- Use that model for current-slide math, virtual slide windows, and future
  scroll-to-slide behavior.
- Render a fixed-height slide canvas.
- Mount only visible plus overscanned slide shells.
- Replace per-slide `IntersectionObserver` with virtual-window membership.
- Keep non-eager rendering tied to scroll-idle activity.
- Keep bitmap cache and cancellation behavior unchanged.
- Render overlays only for mounted slide shells.

### Acceptance

- Large decks mount a bounded number of slide shells.
- Eager and non-eager rendering remain correct.
- Fast scrolls do not surface stale render errors from slides that left the
  window.
- Rotation and zoom preserve slide layout and current-slide reporting.
- No per-slide `IntersectionObserver` is required for slide membership.

## 5. PDF Thumbnail Rail: Optional Imperative Projection

### Current State

The main PDF viewer is already strong. The thumbnail rail is separate and
already virtualized, but its visible thumbnail window can still be React state
driven during scroll.

Relevant files:

- `registry/new-york-v4/ui/pdf-thumbnail-sidebar.tsx`
- `registry/new-york-v4/ui/use-pdf-thumbnail-window.ts`
- `registry/new-york-v4/ui/pdf-thumbnail-rail.tsx`
- `registry/new-york-v4/ui/pdf-thumbnail-item.tsx`

### Work Not Covered By The Audit

Only do this after profiling proves the rail is material:

- Keep the existing thumbnail layout model.
- Replace visible-item React state with a passive scroll plus RAF projector.
- Reuse thumbnail item shells.
- Keep thumbnail canvas resources keyed by page number and thumbnail size.
- Patch current-page state separately from scroll projection.

### Acceptance

- Large PDF thumbnail rails scroll with no React commit per wheel tick.
- Current-page highlight patches existing nodes where possible.
- Thumbnail cache, cancellation, keyboard navigation, and click selection remain
  correct.

## 6. Performance Harness: Add Shared Viewer Profiling Fixtures

### Current State

The audit names fixes, but it does not define a repeatable proof harness across
viewers.

### Work Not Covered By The Audit

- Add deterministic large fixtures for:
  - wrapped text,
  - fixed-line code,
  - markdown document,
  - large PPTX,
  - large PDF thumbnail rail.
- Measure:
  - initial open time,
  - mounted node count,
  - scroll-frame React commits,
  - scroll scripting time,
  - peak mounted canvas count,
  - cache hit/miss behavior where relevant.
- Keep the measurement harness outside production viewer code.
- Prefer browser-level profiling for scroll behavior, because jsdom cannot
  prove frame-time behavior.

### Acceptance

- Each uncovered viewer has one repeatable large-file scenario.
- The harness can compare before/after projection changes.
- Results are stored as short artifacts or console summaries, not committed
  screenshots unless visually useful.

## 7. HTML Viewer: Keep It Out Of The Projection Program

### Current State

The HTML viewer renders arbitrary document content:

- `registry/new-york-v4/ui/file-viewer-html-viewer.tsx`

### Decision

Do not apply Chenglou-style projection to arbitrary HTML. Browser layout owns
the geometry, and arbitrary HTML can include images, intrinsic sizing, CSS, and
sandbox constraints. Pretending we own that layout would make virtualization
incorrect.

### Work Not Covered By The Audit

- Keep HTML isolated in an iframe or sandboxed surface.
- Avoid injecting large HTML trees directly into React.
- Avoid resize loops.
- Keep security and containment policies explicit.

### Acceptance

- HTML Viewer does not participate in custom geometry projection.
- Large HTML documents do not create React-owned document trees.
- Sandbox and sizing behavior remain predictable.

## Recommended Order

1. Finish Text Viewer routing and naming cleanup.
2. Replace Code Viewer TanStack usage with a fixed-line projector.
3. Move Markdown Document and Page Markdown projection fully out of React.
4. Virtualize PPTX slide shells using the shared slide layout model.
5. Add shared profiling fixtures for the uncovered viewers.
6. Consider PDF thumbnail imperative projection only if the fixture proves it
   matters.
7. Leave HTML Viewer as a containment surface, not a virtualized document model.

## Non-Goals

- Do not duplicate work from `viewer-performance-fixes-audit.md`.
- Do not add compatibility shims or parallel runtime paths after a cutover.
- Do not force line-based virtualization onto wrapped prose.
- Do not force Chenglou projection onto content whose layout is owned by the
  browser or an opaque renderer.
- Do not keep old labels such as `pretext viewer` in user-facing navigation
  after Text Viewer becomes the Pretext implementation.

