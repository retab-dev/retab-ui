# Viewer Performance Fixes Audit

## Context

The text viewer work showed that the expensive part is not just deciding what is visible. The larger win comes from keeping React out of hot scroll projection paths, reusing DOM rows, and only mutating the small set of nodes whose content or position actually changes.

This audit applies that same lens to the other viewers.

## Highest Value Fixes

### 1. XLSX Grid: Add CSV-Style DOM Row Patching

The CSV viewer already has the right shape:

- `registry/new-york-v4/ui/csv-viewer-row-patcher.ts`
- `registry/new-york-v4/ui/csv-viewer-grid.tsx`

It patches row transforms and text nodes directly during simple vertical scrolling, then lets React settle after the scroll path cools down.

The XLSX grid still maps `virtualRows` directly to React rows:

- `registry/new-york-v4/ui/xlsx-grid.tsx`
- `registry/new-york-v4/ui/xlsx-grid-row.tsx`

Fix:

- Add an `xlsx-viewer-row-patcher.ts`.
- Reuse mounted row shells during vertical-only scroll.
- Patch row number, cell text, numeric alignment, active-cell state, and row transform directly.
- Fall back to React when horizontal columns change, active cell changes, scale changes, or sheet changes.

Expected result:

- Less React work while scrolling large sheets.
- Better parity with CSV.
- More headroom for large XLSX files.

### 2. Image/TIFF Viewer: Virtualize Frames

The image viewer currently renders every frame:

- `registry/new-york-v4/ui/image-viewer-content.tsx`
- `registry/new-york-v4/ui/image-viewer-frame.tsx`

For single images this is fine. For multi-page TIFFs it means every frame gets a canvas and decode/acquire path.

Fix:

- Build a frame layout model from intrinsic sizes, scale, rotation, and gap.
- Render a fixed-height virtual canvas.
- Mount only visible and near-visible frames.
- Keep current-frame detection math-based instead of scanning DOM.
- Decode/acquire frames only when they enter the virtual window.

Expected result:

- Large TIFFs stop paying upfront canvas/decode cost for every page.
- Scroll behaves more like PDF/PPTX.

### 3. JSON Inspector: Virtualize Lines

The JSON inspector currently stringifies the entire object, splits all lines, and regex-colorizes every line in React:

- `registry/new-york-v4/ui/json-inspector.tsx`

Fix:

- For small JSON, keep the current simple renderer.
- For large JSON, route through the Code Viewer or a dedicated fixed-line virtual projector.
- Cache tokenized/colorized line fragments by line text.
- Avoid rendering thousands of line nodes at once.

Expected result:

- Large JSON payloads open faster.
- Scrolling large JSON becomes proportional to visible lines, not total lines.

## Medium Value Fixes

### 4. JSON Table: Add Read-Only Row Patching

The JSON table already has useful memoization:

- `components/json-table/single-file-form-row.tsx`
- `components/json-table/json-table-cell-memo.ts`

But the parent still updates React virtual rows while scrolling:

- `components/json-table/single-file-virtualized-table.tsx`

Fix:

- Add a read-only row patcher modeled after CSV.
- Patch row position and read-only cell text directly.
- Keep editable mode on React identity-preserving rows, because active editors, focus, and structured overlays must not move under the user.

Expected result:

- Faster read-only browsing of large JSON tables.
- No risk to editing correctness if limited to read-only mode.

### 5. PPTX Viewer: Replace Scroll DOM Scan With Geometry

PPTX already lazy-renders slide canvases with `IntersectionObserver`:

- `registry/new-york-v4/ui/pptx-viewer-slide.tsx`

But visible-slide tracking scans slide DOM and calls `getBoundingClientRect()` on scroll:

- `registry/new-york-v4/ui/pptx-viewer-visible-slide.ts`

Fix:

- Build a slide layout model from base slide size, zoom, rotation, gap, and padding.
- Compute current slide from `scrollTop` using layout math.
- Keep the `IntersectionObserver` canvas render gate, unless the slide virtualizer replaces it later.

Expected result:

- Lower scroll work for large decks.
- Cleaner parity with PDF's math-based current-page tracking.

## Lower Priority / Already Mostly Fine

### PDF Viewer

The PDF viewer already has the right architecture:

- RAF-coalesced scroll measurement.
- Math-based current page.
- Visible page window.
- Only visible page canvases mounted.

Relevant files:

- `registry/new-york-v4/ui/pdf-viewer.tsx`
- `registry/new-york-v4/ui/pdf-viewer-scroll.ts`
- `registry/new-york-v4/ui/pdf-viewer-virtualization.ts`
- `registry/new-york-v4/ui/pdf-viewer-page.tsx`

No major Chenglou-style rewrite is needed.

### CSV Viewer

CSV is currently the strongest grid implementation.

Relevant files:

- `registry/new-york-v4/ui/csv-viewer-grid.tsx`
- `registry/new-york-v4/ui/csv-viewer-row-patcher.ts`

Possible future improvements:

- Extend row patching to more horizontal-scroll cases.
- Tighten active-cell patching if profiling shows it matters.

### DOCX Viewer

DOCX is harder to optimize with this exact pattern because `docx-preview` commits an opaque DOM tree.

Relevant files:

- `registry/new-york-v4/ui/docx-viewer-content.tsx`
- `registry/new-york-v4/ui/docx-viewer-render.ts`

Possible future improvement:

- Page-level virtualization, but only if page boundaries can be indexed reliably after render.

## Recommended Order

1. XLSX row patcher.
2. Image/TIFF frame virtualization.
3. JSON inspector line virtualization.
4. JSON table read-only row patching.
5. PPTX math-based visible-slide tracking.

