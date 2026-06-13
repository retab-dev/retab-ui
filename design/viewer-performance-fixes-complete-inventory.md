# Viewer Performance Fixes Complete Inventory

## Principle

The fast viewer pattern is not just virtualization. It is predictable geometry
plus cheap projection.

The ideal path is:

1. Build a layout model from known dimensions, scale, rotation, row height,
   page height, or measured block height.
2. Compute the visible window from scroll math.
3. Keep React out of hot scroll projection.
4. Reuse mounted DOM shells where the content model is stable.
5. Patch only position, text, class, and selected state during scroll.
6. Let React handle semantic state changes, edits, resize, zoom, and document
   changes.

This inventory merges the primary audit and the remaining viewer work into one
file.

## Priority 0: Already In Good Shape

### CSV Viewer

Files:

- `registry/new-york-v4/ui/csv-viewer-grid.tsx`
- `registry/new-york-v4/ui/csv-viewer-row-patcher.ts`

Current state:

- Uses the strongest grid projection path in the codebase.
- During simple vertical scroll, row transforms and text are patched directly.
- React settles after the hot scroll path cools down.

Remaining fixes:

- Extend row patching to more horizontal-scroll cases only if profiling shows
  horizontal scroll is still expensive.
- Tighten active-cell patching only if active-cell profiling shows it matters.

Acceptance:

- Large CSV vertical scroll remains bounded by visible rows.
- No regression to selection, active cell, or column virtualization.

### PDF Viewer

Files:

- `registry/new-york-v4/ui/pdf-viewer.tsx`
- `registry/new-york-v4/ui/pdf-viewer-scroll.ts`
- `registry/new-york-v4/ui/pdf-viewer-virtualization.ts`
- `registry/new-york-v4/ui/pdf-viewer-page.tsx`

Current state:

- RAF-coalesced scroll measurement.
- Math-based current page.
- Visible page window.
- Only visible page canvases mounted.

Remaining fixes:

- None for the main PDF page surface.
- Optional thumbnail rail projection is listed separately below.

Acceptance:

- Keep the current architecture.
- Do not rewrite the main PDF viewer unless profiling finds a concrete bottleneck.

## Priority 1: Highest Value Fixes

### XLSX Grid: Add CSV-Style DOM Row Patching

Files:

- `registry/new-york-v4/ui/xlsx-grid.tsx`
- `registry/new-york-v4/ui/xlsx-grid-row.tsx`
- `registry/new-york-v4/ui/xlsx-viewer-row-patcher.ts`

Current state:

- The XLSX grid uses fixed-grid virtualization.
- It still maps `virtualRows` through React during scroll.
- This makes XLSX weaker than CSV for large sheets.

Fix:

- Add a dedicated XLSX row patcher modeled after CSV.
- Reuse mounted row shells during vertical-only scroll.
- Patch row number, cell text, numeric alignment, active-cell class, and row
  transform directly.
- Fall back to React when columns change, sheet changes, active cell changes,
  scale changes, or row shape changes.

Acceptance:

- Large XLSX vertical scroll avoids React commits per wheel tick.
- Active cell remains correct.
- Numeric alignment remains correct.
- Horizontal scroll and sheet changes still use the normal React path.

### Image/TIFF Viewer: Virtualize Frames

Files:

- `registry/new-york-v4/ui/image-viewer-content.tsx`
- `registry/new-york-v4/ui/image-viewer-frame.tsx`
- `registry/new-york-v4/ui/image-viewer-hooks.ts`
- `registry/new-york-v4/ui/image-viewer-virtualization.ts`

Current state:

- Single-image rendering is fine.
- Multi-frame TIFFs currently risk mounting too many frame shells and canvases.

Fix:

- Build a frame layout model from intrinsic size, scale, rotation, padding, and
  gap.
- Render one fixed-height virtual canvas.
- Mount only visible and near-visible frames.
- Compute current frame from scroll math instead of scanning the DOM.
- Decode/acquire frame resources only when a frame enters the virtual window.

Acceptance:

- Large TIFF files mount a bounded number of frames.
- Current-frame tracking is geometry-based.
- Zoom and rotation preserve frame layout.
- Imperative scroll-to-frame behavior works for unmounted frames.

### JSON Inspector: Virtualize Lines

Files:

- `registry/new-york-v4/ui/json-inspector.tsx`

Current state:

- The inspector stringifies the entire object, splits every line, and renders
  every colorized line in React.

Fix:

- Keep the simple renderer for small JSON.
- For large JSON, use a fixed-line virtual projector.
- Cache colorized fragments by line text.
- Render only visible and near-visible lines.
- Keep syntax coloring deterministic and independent from mounted line count.

Acceptance:

- Large JSON payloads open without rendering thousands of line nodes.
- Scroll cost is proportional to visible lines.
- Token colors match the current inspector.

### Code Viewer: Replace TanStack Virtual With Shared Fixed-Line Projection

Files:

- `registry/new-york-v4/ui/code-viewer-content.tsx`
- `registry/new-york-v4/ui/code-viewer-virtualization.ts`
- `registry/new-york-v4/ui/code-viewer-line.tsx`

Current state:

- Code uses TanStack Virtual directly.
- Source code is a fixed-line workload and does not need a general-purpose
  virtualizer.

Fix:

- Build a fixed-line code projector.
- Precompute line height, gutter width, total height, and line count.
- Use a passive scroll listener plus one `requestAnimationFrame` scheduler.
- Reuse row nodes and patch transform, line number, highlight class, and
  tokenized content.
- Keep the existing Prism token cache.
- Remove the Code Viewer dependency on `@tanstack/react-virtual`.

Acceptance:

- Large code files scroll without React commits per wheel tick.
- Highlighted line scrolling still works.
- Zoom preserves the scroll anchor.
- Syntax highlighting output remains stable.

## Priority 2: Medium Value Fixes

### JSON Table: Add Read-Only Row Patching

Files:

- `components/json-table/single-file-virtualized-table.tsx`
- `components/json-table/single-file-form-row.tsx`
- `components/json-table/json-table-cell-memo.ts`

Current state:

- JSON table has useful row and cell memoization.
- The parent still updates React virtual rows while scrolling.
- Editable mode has correctness constraints around focus, active editors, and
  overlays.

Fix:

- Add a read-only row patcher modeled after CSV.
- Patch row position and read-only cell text directly.
- Keep editable mode on React identity-preserving rows.
- Disable patching when an editor, picker, structured overlay, selection state,
  schema change, or active-cell transition is present.

Acceptance:

- Read-only browsing of large JSON tables avoids React scroll churn.
- Editing behavior remains unchanged.
- Active editors are never moved by imperative row reuse.

### PPTX Viewer: Replace Visible-Slide DOM Scan With Geometry

Files:

- `registry/new-york-v4/ui/pptx-viewer-visible-slide.ts`
- `registry/new-york-v4/ui/pptx-viewer-slide.tsx`
- `registry/new-york-v4/ui/pptx-viewer.tsx`

Current state:

- PPTX lazily renders slide canvases with `IntersectionObserver`.
- Current visible slide tracking still scans slide DOM and calls
  `getBoundingClientRect()` on scroll.

Fix:

- Build a slide layout model from base size, zoom, rotation, padding, and gap.
- Compute current slide from `scrollTop`.
- Use the same model for future scroll-to-slide and shell virtualization.
- Keep the existing canvas render gate until shell virtualization replaces it.

Acceptance:

- Current slide tracking does not scan slide DOM during scroll.
- Rotation and zoom remain correct.
- Large decks avoid avoidable layout reads on scroll.

### PPTX Viewer: Virtualize Slide Shells

Files:

- `registry/new-york-v4/ui/pptx-viewer-slide.tsx`
- `registry/new-york-v4/ui/pptx-viewer-visible-slide.ts`

Current state:

- Canvas rendering is gated by intersection.
- One React slide frame, wrapper DOM subtree, and observer target can still be
  created per slide.

Fix:

- Use the PPTX slide layout model to compute a virtual slide window.
- Render one fixed-height virtual canvas.
- Mount only visible plus near-visible slide shells.
- Replace per-slide observer setup with virtual-window membership.
- Preserve eager and non-eager render behavior.

Acceptance:

- Very large decks mount a bounded number of slide frames.
- Overlays render only for mounted slides.
- Bitmap cache behavior remains unchanged.

### Markdown Document Viewer: Move Page Projection Out Of React

Files:

- `registry/new-york-v4/ui/markdown-document-viewer.tsx`
- `registry/new-york-v4/ui/markdown-document-model.ts`
- `registry/new-york-v4/ui/markdown-document-virtualizer.ts`
- `components/viewers/page-markdown/page-markdown-viewer.tsx`
- `components/viewers/page-markdown/page-markdown-pane.tsx`

Current state:

- Markdown document surfaces now have custom geometry and page windows.
- The remaining expensive path is parent React projection on scroll.

Fix:

- Keep browser layout for rich Markdown inside mounted pages.
- Replace root scroll state as the hot path with passive scroll plus RAF.
- Maintain a page shell cache keyed by page measurement/render key.
- Imperatively insert, remove, move, and measure page shells.
- Let React render page content only when a page is first materialized or its
  render key changes.
- Consolidate Page Markdown and the registry Markdown Document Viewer onto one
  projection engine.

Acceptance:

- Long Markdown documents scroll without root React updates per scroll frame.
- Measured-height corrections preserve the scroll anchor.
- Rendered/text mode, fragment links, and line-range scrolling remain correct.

## Priority 3: Conditional Fixes

### PDF Thumbnail Sidebar: Imperative Rail Projection

Files:

- `registry/new-york-v4/ui/pdf-thumbnail-sidebar.tsx`
- `registry/new-york-v4/ui/use-pdf-thumbnail-window.ts`
- `registry/new-york-v4/ui/pdf-thumbnail-rail.tsx`
- `registry/new-york-v4/ui/pdf-thumbnail-item.tsx`

Current state:

- The thumbnail rail is already virtualized and RAF-coalesced.
- It still updates React state for visible thumbnail items.

Fix:

- Only implement if profiling shows the thumbnail rail is material.
- Reuse thumbnail shells.
- Patch current-page state separately from scroll projection.
- Keep canvas resources keyed by page number and thumbnail size.

Acceptance:

- Large PDF rails scroll without React commits per wheel tick.
- Current-page highlight changes do not remount the rail.
- Keyboard and click page selection remain accessible.

### DOCX Viewer: Page-Level Virtualization If Boundaries Become Reliable

Files:

- `registry/new-york-v4/ui/docx-viewer-content.tsx`
- `registry/new-york-v4/ui/docx-viewer-render.ts`

Current state:

- `docx-preview` commits an opaque DOM tree.
- The viewer does not own reliable page geometry before or during render.

Fix:

- Do not attempt Chenglou-style projection unless page boundaries can be
  indexed reliably after render.
- If reliable page boundaries exist, wrap rendered pages in a page layout model
  and virtualize page shells.

Acceptance:

- No partial virtualization that breaks document flow.
- No custom DOCX layout engine.

## Explicit Non-Targets

### HTML Viewer

Files:

- `registry/new-york-v4/ui/file-viewer-html-viewer.tsx`

Decision:

- Do not apply Chenglou-style projection to arbitrary HTML.
- Browser layout owns arbitrary HTML, CSS, images, and sandbox behavior.

Allowed work:

- Keep rendering isolated.
- Avoid resize loops.
- Avoid injecting huge HTML strings into React trees when an iframe or sandboxed
  document can own them.

### Fixed File Router

Files:

- `registry/new-york-v4/ui/file-viewer.tsx`
- `components/file-viewer-demo.tsx`

Decision:

- Keep routing simple and explicit.
- Text and Markdown should use the prose/text viewer.
- Code, logs, JSON, and source-like formats should use the code/fixed-line
  viewer.

Allowed work:

- Rename confusing demo tabs.
- Keep viewer names consistent.
- Avoid parallel legacy routes.

## Recommended Order

1. XLSX row patcher.
2. Image/TIFF frame virtualization.
3. JSON inspector line virtualization.
4. Code Viewer fixed-line projector.
5. JSON table read-only row patching.
6. PPTX visible-slide geometry.
7. PPTX slide shell virtualization.
8. Markdown Document Viewer imperative page projection.
9. Page Markdown consolidation.
10. PDF thumbnail rail projection only if profiling justifies it.
11. DOCX page virtualization only if reliable page boundaries exist.

## Verification Matrix

Run focused tests after each surface:

- XLSX: grid virtualization, active cell, numeric alignment, sheet switching.
- Image/TIFF: multi-frame windowing, current frame, zoom, rotation, scroll-to-frame.
- JSON Inspector: large payload render, syntax colors, scroll range.
- Code Viewer: highlight line, syntax rendering, zoom anchor, no TanStack import.
- JSON Table: read-only scroll, edit mode invariants, active overlays.
- PPTX: current slide, rotation, zoom, eager and non-eager rendering.
- Markdown Document: long document scroll, measurement correction, fragment links.
- PDF Thumbnail: thumbnail scroll, current-page highlight, keyboard selection.

Global checks:

- `pnpm vitest run` on the focused viewer suites.
- `pnpm typecheck`.
- `pnpm registry:build`.
- Browser smoke test for the File Viewer demo after routing or visual changes.

