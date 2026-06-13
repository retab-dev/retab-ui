# Viewer Performance Fixes Complete Inventory

## Purpose

This file is the complete inventory of Chenglou-style performance fixes for the
viewer surfaces.

The pattern is not "use virtualization" in the abstract. The pattern is:

1. Build predictable geometry from rows, lines, pages, slides, or frames.
2. Compute visible content from scroll math.
3. Keep React out of the hot scroll projection path.
4. Reuse mounted shells when the content shape is stable.
5. Patch only position, text, classes, selection, and aria state during scroll.
6. Let React own semantic changes: file changes, zoom, rotation, editing,
   schema changes, active overlays, and error/loading state.

The text viewer work proved the point: Chenglou's speed comes from separating
document state from viewport projection. The same idea applies wherever we have
large, repeatable units.

## Status Legend

- `done`: implemented or already architecturally sound.
- `high`: likely high-value work.
- `medium`: useful, but only after the high-value surfaces.
- `conditional`: only do it if profiling proves it matters.
- `non-target`: do not apply this pattern here.

## Summary Table

| Surface | Status | Main Fix |
| --- | --- | --- |
| Text viewer | done | Custom Pretext/Chenglou-style projector, no line numbers in prose mode |
| Code viewer | high | Fixed-line projector should be the canonical code path |
| CSV viewer | done | CSV-style row patching is the reference grid implementation |
| XLSX viewer | high | Add CSV-style row patching |
| JSON inspector | high | Virtualize large JSON by line |
| JSON table | medium | Patch read-only rows only |
| Image/TIFF viewer | high | Virtualize multi-frame TIFF/image frames |
| PDF viewer | done | Main page surface already uses math-based visible pages |
| PDF thumbnail rail | conditional | Imperative thumbnail shell projection if profiling justifies it |
| PPTX viewer | high | Math-based current slide, then slide shell virtualization |
| Markdown document viewer | high | Imperative page projection with measured page heights |
| Page Markdown viewer | high | Consolidate onto the same Markdown page projector |
| DOCX viewer | conditional | Page virtualization only if reliable page boundaries exist |
| HTML viewer | non-target | Keep isolated browser/iframe-style rendering |
| Email viewer | conditional | Virtualize only long attachment/body sections if profiling proves it |
| File viewer router | medium | Keep routing explicit: code vs text/prose vs table vs page viewers |
| Parse viewer | medium | Virtualize long parse page/field lists |
| Split viewer | medium | Geometry-based segment/page rail projection |
| Partition viewer | medium | Geometry-based page/partition projection |
| Classification viewer | medium | Geometry-based label/page projection |
| Edit viewer | conditional | Do not patch active editors; optimize static overlays only |

## Core Infrastructure

### Fixed Grid Virtualization

Files:

- `registry/new-york-v4/ui/fixed-grid-virtualization.ts`
- `registry/new-york-v4/ui/csv-viewer-row-patcher.ts`
- `components/json-table/read-only-json-row-patcher.ts`
- `registry/new-york-v4/ui/xlsx-viewer-row-patcher.ts`

Status: `done` as a base, but should become the canonical grid substrate.

What it gives us:

- fixed-size row and column math;
- RAF-coalesced viewport reads;
- optional `rowScrollStrategy` for imperative row patching;
- a clean fallback to React when geometry or content shape changes.

Rule:

- Grids with fixed row height should use this infrastructure before considering
  TanStack Virtual.

Acceptance:

- The grid hot path reads scroll metrics once per frame.
- Simple vertical scroll can be handled without a React commit.
- Fallbacks are explicit and narrow.

## Text And Code

### Text Viewer

Files:

- `registry/new-york-v4/ui/text-viewer.tsx`
- `registry/new-york-v4/ui/text-viewer-chenglou.tsx`
- `registry/new-york-v4/ui/text-viewer-chenglou-content.tsx`
- `registry/new-york-v4/ui/text-viewer-vanillacheng.tsx`
- `registry/new-york-v4/ui/text-viewer-virtualization.ts`
- `registry/new-york-v4/ui/plain-text-viewer-shell.tsx`

Status: `done`.

Current shape:

- Prose/text is treated differently from code.
- Text wraps naturally.
- Line numbers are not displayed in the text viewer.
- Projection is custom and not TanStack-based.
- The Chenglou idea is used where it belongs: variable-height wrapped text
  blocks with browser layout measurement and a small rendered window.

Remaining fixes:

- Keep the "vanillacheng" implementation as a profiling reference only if it is
  actively useful.
- Remove duplicate experimental paths once the canonical projector is fully
  proven.

Acceptance:

- Long text and Markdown-like prose scroll smoothly.
- Wrapped paragraphs keep natural browser layout.
- Code-like files route to Code Viewer, not Text Viewer.

### Code Viewer

Files:

- `registry/new-york-v4/ui/code-viewer.tsx`
- `registry/new-york-v4/ui/code-viewer-content.tsx`
- `registry/new-york-v4/ui/code-viewer-virtualization.ts`
- `registry/new-york-v4/ui/code-viewer-layout.ts`

Status: `high`.

Current shape:

- Code is a fixed-line workload.
- It does not need paragraph measurement or Pretext-style block layout.
- It should use deterministic line-height math and row reuse.

Fix:

- Make the fixed-line projector the canonical Code Viewer path.
- Precompute line count, gutter width, line height, total height, and highlight
  ranges.
- Use a passive scroll listener plus one `requestAnimationFrame` scheduler.
- Reuse row shells and patch:
  - transform;
  - line number;
  - highlighted-line class;
  - tokenized line content;
  - aria/current-line attributes.
- Keep syntax tokenization cached by line text and language.
- Remove any remaining dependency on `@tanstack/react-virtual` from this
  surface.

Acceptance:

- Large code files do not cause React commits on every wheel tick.
- Highlighted line scrolling still works.
- Zoom preserves scroll anchor.
- Syntax highlighting remains stable.

## Tables

### CSV Viewer

Files:

- `registry/new-york-v4/ui/csv-viewer.tsx`
- `registry/new-york-v4/ui/csv-viewer-grid.tsx`
- `registry/new-york-v4/ui/csv-viewer-row-patcher.ts`
- `registry/new-york-v4/ui/csv-viewer-worker.ts`
- `registry/new-york-v4/ui/csv-viewer-sort.ts`

Status: `done`.

Current shape:

- CSV is the reference implementation for fixed-grid performance.
- It uses row patching during simple vertical scroll.
- React owns sort, file, column, and semantic state changes.

Remaining fixes:

- Extend row patching to more horizontal-scroll cases only if profiling proves
  horizontal scroll is still expensive.
- Tighten active-cell patching only if active-cell profiling shows it matters.

Acceptance:

- Large CSV vertical scroll is bounded by visible rows.
- Sort, active cell, selection, zoom, and column virtualization remain correct.

### XLSX Viewer

Files:

- `registry/new-york-v4/ui/xlsx-viewer.tsx`
- `registry/new-york-v4/ui/xlsx-grid.tsx`
- `registry/new-york-v4/ui/xlsx-grid-row.tsx`
- `registry/new-york-v4/ui/xlsx-viewer-row-patcher.ts`
- `registry/new-york-v4/ui/xlsx-viewer.worker.ts`
- `registry/new-york-v4/lib/xlsx-sheetjs-flattener.ts`

Status: `high`.

Fix:

- Use the same row-patching strategy as CSV for simple vertical scroll.
- Reuse mounted row shells.
- Patch:
  - row number;
  - cell text/title;
  - numeric alignment;
  - active-cell state;
  - aria row metadata;
  - row transform.
- Fall back to React when:
  - horizontal columns change;
  - active cell changes outside the patched range;
  - sheet changes;
  - scale/row height changes;
  - merged/frozen geometry changes;
  - row or cell shape is unsafe to patch.

Acceptance:

- Large XLSX sheets scroll like CSV on vertical scroll.
- Active cell and numeric alignment remain correct.
- Sheet switching and horizontal scrolling remain React-owned.

### JSON Table

Files:

- `components/json-table/single-file-virtualized-table.tsx`
- `components/json-table/single-file-form-row.tsx`
- `components/json-table/read-only-json-row-patcher.ts`
- `components/json-table/read-only-json-table-cell.tsx`
- `components/json-table/editable-json-table-cell.tsx`

Status: `medium`.

Fix:

- Patch read-only rows only.
- Reuse row shells in read-only mode.
- Patch:
  - row transform;
  - row index;
  - visible read-only cell text;
  - simple class/aria state.
- Keep editable mode on React identity-preserving rows.
- Disable patching when:
  - a primitive editor is active;
  - a structured editor is active;
  - a picker/dropdown is open;
  - schema changes;
  - row selection changes;
  - active-cell ownership changes;
  - a cell uses non-text interactive content.

Acceptance:

- Large read-only JSON tables scroll without React churn.
- Editing behavior is unchanged.
- Active editors are never moved by imperative row reuse.

## Structured Text And JSON

### JSON Inspector

Files:

- `registry/new-york-v4/ui/json-inspector.tsx`

Status: `high`.

Fix:

- Keep the simple full renderer for small JSON.
- For large JSON:
  - stringify once;
  - split lines once;
  - virtualize fixed-height lines;
  - cache colored fragments by line text;
  - render only visible and near-visible lines.

Acceptance:

- Large JSON payloads open without thousands of DOM nodes.
- Scroll cost is proportional to visible lines.
- Token coloring matches the current inspector.

### Markdown Document Viewer

Files:

- `registry/new-york-v4/ui/markdown-document-viewer.tsx`
- `registry/new-york-v4/ui/markdown-document-renderer.tsx`
- `registry/new-york-v4/ui/markdown-document-model.ts`
- `registry/new-york-v4/ui/markdown-document-virtualizer.ts`
- `registry/new-york-v4/ui/markdown-document-layout.ts`
- `registry/new-york-v4/ui/markdown-document-plugins.ts`

Status: `high`.

Fix:

- Treat Markdown documents as measured page/block projection, not fixed-line
  code.
- Keep browser layout for rich Markdown inside mounted pages.
- Use passive scroll plus RAF to compute the visible page window.
- Maintain a page shell cache keyed by measurement/render key.
- Imperatively insert, remove, move, and measure page shells.
- Let React render a page only when it is first materialized or its render key
  changes.
- Split sync and async Markdown plugin paths:
  - simple Markdown can render synchronously;
  - fenced code can use the async highlighter path.

Acceptance:

- Long Markdown documents scroll without root React updates per scroll frame.
- Measured-height corrections preserve scroll anchor.
- Rendered/text mode, fragment links, and line-range scrolling remain correct.

### Page Markdown Viewer

Files:

- `components/viewers/page-markdown/page-markdown-viewer.tsx`
- `components/viewers/page-markdown/page-markdown-pane.tsx`
- `components/viewers/page-markdown/page-markdown-virtualization.ts`
- `components/viewers/page-markdown/page-markdown-measurements.ts`
- `components/viewers/page-markdown/page-markdown-layout.ts`

Status: `high`.

Fix:

- Consolidate with the registry Markdown Document Viewer projection engine.
- Keep one page layout model and one page measurement correction path.
- Avoid a second, divergent Markdown virtualizer.

Acceptance:

- Page Markdown and Markdown Document Viewer behave the same under long
  documents.
- Measurement fixes land in one place.
- Fragment/page scrolling stays deterministic.

## Page, Slide, Frame, And Image Viewers

### PDF Viewer

Files:

- `registry/new-york-v4/ui/pdf-viewer.tsx`
- `registry/new-york-v4/ui/pdf-viewer-scroll.ts`
- `registry/new-york-v4/ui/pdf-viewer-virtualization.ts`
- `registry/new-york-v4/ui/pdf-viewer-page.tsx`
- `registry/new-york-v4/ui/pdf-viewer-layout.ts`

Status: `done`.

Current shape:

- RAF-coalesced scroll measurement.
- Math-based current page.
- Visible page window.
- Only visible page canvases mounted.

Remaining fixes:

- No main-surface rewrite.
- Keep this architecture.

Acceptance:

- Do not replace it unless profiling shows a concrete bottleneck.

### PDF Thumbnail Rail

Files:

- `registry/new-york-v4/ui/pdf-thumbnail-sidebar.tsx`
- `registry/new-york-v4/ui/pdf-thumbnail-rail.tsx`
- `registry/new-york-v4/ui/pdf-thumbnail-item.tsx`
- `registry/new-york-v4/ui/use-pdf-thumbnail-window.ts`
- `registry/new-york-v4/ui/pdf-thumbnail-layout.ts`

Status: `conditional`.

Fix:

- Only implement if profiling shows the rail is material.
- Reuse thumbnail shells.
- Patch current-page highlight separately from scroll projection.
- Keep canvas resources keyed by page number and thumbnail size.

Acceptance:

- Large PDF rails scroll without React commits per wheel tick.
- Current-page highlight changes do not remount the rail.
- Keyboard and click page selection remain accessible.

### Image/TIFF Viewer

Files:

- `registry/new-york-v4/ui/image-viewer.tsx`
- `registry/new-york-v4/ui/image-viewer-content.tsx`
- `registry/new-york-v4/ui/image-viewer-frame.tsx`
- `registry/new-york-v4/ui/image-viewer-hooks.ts`
- `registry/new-york-v4/ui/image-viewer-virtualization.ts`
- `registry/new-york-v4/lib/image-tiff-source.ts`

Status: `high`.

Fix:

- Build a frame layout model from:
  - intrinsic size;
  - scale;
  - rotation;
  - padding;
  - gap.
- Render one fixed-height virtual canvas.
- Mount only visible and near-visible frames.
- Compute current frame from scroll math instead of scanning DOM.
- Decode/acquire frame resources only when a frame enters the virtual window.

Acceptance:

- Large TIFF files mount a bounded number of frames.
- Current-frame tracking is geometry-based.
- Zoom and rotation preserve layout.
- Imperative scroll-to-frame behavior works for unmounted frames.

### PPTX Viewer

Files:

- `registry/new-york-v4/ui/pptx-viewer.tsx`
- `registry/new-york-v4/ui/pptx-viewer-slide.tsx`
- `registry/new-york-v4/ui/pptx-viewer-visible-slide.ts`
- `registry/new-york-v4/ui/pptx-viewer-viewport.ts`
- `registry/new-york-v4/ui/pptx-viewer-renderer.ts`

Status: `high`.

Fix 1: visible-slide geometry.

- Build a slide layout model from:
  - base slide size;
  - zoom;
  - rotation;
  - padding;
  - gap.
- Compute current slide from `scrollTop`.
- Stop scanning slide DOM on scroll.

Fix 2: slide shell virtualization.

- Use the same layout model to compute a virtual slide window.
- Render one fixed-height virtual canvas.
- Mount only visible plus near-visible slide shells.
- Replace per-slide observer setup with virtual-window membership when that
  proves faster.
- Preserve eager and non-eager render behavior.

Acceptance:

- Current slide tracking does not call layout reads on every scroll frame.
- Large decks mount a bounded number of slide frames.
- Rotation, zoom, overlays, and bitmap cache behavior remain correct.

### DOCX Viewer

Files:

- `registry/new-york-v4/ui/docx-viewer.tsx`
- `registry/new-york-v4/ui/docx-viewer-content.tsx`
- `registry/new-york-v4/ui/docx-viewer-render.ts`
- `registry/new-york-v4/ui/docx-viewer-scroll.ts`

Status: `conditional`.

Current constraint:

- `docx-preview` commits an opaque DOM tree.
- We do not own reliable page geometry before render.

Fix:

- Do not apply Chenglou-style projection unless page boundaries can be indexed
  reliably after render.
- If reliable page boundaries exist:
  - index rendered page sections;
  - build a page layout model;
  - virtualize page shells;
  - preserve scroll anchors during measurement correction.

Acceptance:

- No partial virtualization that breaks document flow.
- No custom DOCX layout engine.
- No DOM patching inside opaque DOCX content.

## HTML And Email

### HTML Viewer

Files:

- `registry/new-york-v4/ui/file-viewer-html-viewer.tsx`

Status: `non-target`.

Decision:

- Do not apply Chenglou-style projection to arbitrary HTML.
- Arbitrary HTML can include CSS, images, embeds, tables, and unknown layout.
- Browser layout should own this surface.

Allowed work:

- Keep rendering isolated.
- Prefer iframe/sandbox ownership for very large HTML.
- Avoid resize loops.
- Avoid placing huge arbitrary HTML trees under frequently updating React
  parents.

Acceptance:

- Security and isolation remain more important than scroll micro-optimization.

### Email Viewer

Files:

- `registry/new-york-v4/ui/email-viewer.tsx`

Status: `conditional`.

Fix:

- Only optimize if profiling shows large emails are slow.
- Keep header/metadata rendering simple.
- Consider section virtualization only for:
  - very long plain-text bodies;
  - very long attachment lists;
  - repeated message/thread sections.
- Do not imperatively patch arbitrary HTML email bodies.

Acceptance:

- Common email rendering remains simple.
- Long plain-text bodies can reuse the Text Viewer projector.
- HTML email remains isolated and safe.

## File Routing And Demo Surfaces

### File Viewer Router

Files:

- `registry/new-york-v4/ui/file-viewer.tsx`
- `registry/new-york-v4/ui/file-viewer-core.ts`
- `registry/new-york-v4/ui/file-viewer-text-resource.ts`
- `components/file-viewer-demo.tsx`

Status: `medium`.

Fix:

- Keep routing explicit and non-overlapping:
  - code/source/log-like files go to Code Viewer;
  - prose/text/Markdown goes to Text or Markdown Document Viewer;
  - CSV/XLSX/JSON table data goes to table viewers;
  - PDF/PPTX/DOCX/image files go to page/frame viewers;
  - arbitrary HTML goes to the HTML viewer.
- Keep demo tabs named by viewer role, not incidental fixture names.
- Avoid legacy aliases that send the same file shape to multiple viewers.

Acceptance:

- A file type has one canonical viewer unless a user explicitly chooses another.
- Demo labels match the actual viewer architecture.

### Viewer Docs And Registry

Files:

- `content/docs/viewers/index.mdx`
- `content/docs/viewers/*.mdx`
- `registry.json`
- `public/r/registry.json`
- `public/r/*.json`

Status: `medium`.

Fix:

- Keep docs and registry names aligned with the actual components:
  - Code Viewer means fixed-line code/source/log viewer.
  - Text Viewer means wrapped prose/plain text viewer.
  - Markdown Document Viewer means rich Markdown document/page viewer.
- Regenerate registry output after component API changes.

Acceptance:

- Docs sidebar, registry entries, demo tabs, and exported component names do not
  contradict each other.

## Retab Workflow Viewers

### Parse Viewer

Files:

- `components/viewers/parse/parse-viewer.tsx`
- `components/viewers/viewers-demo.tsx`

Status: `medium`.

Fix:

- Profile large parse results.
- If large result trees are slow, virtualize repeated page/field blocks.
- Keep individual field rendering React-owned.
- Use geometry for repeated rows/cards rather than measuring every card during
  scroll.

Acceptance:

- Large parse responses open quickly.
- Scrolling cost is proportional to visible pages/fields.
- Source links and selection remain correct.

### Split Viewer

Files:

- `components/viewers/split/split-viewer.tsx`
- `components/viewers/split/use-segment-viewport-controller.ts`
- `components/viewers/split/segment-page-rail.tsx`

Status: `medium`.

Fix:

- Replace DOM-target scroll tracking with page/segment geometry where possible.
- Virtualize long segment lists or page rails.
- Avoid repeated `getBoundingClientRect()` scans during scroll.

Acceptance:

- Large split outputs do not scan segment/page DOM on every scroll.
- Segment highlighting and page navigation remain deterministic.

### Partition Viewer

Files:

- `components/viewers/partition/partition-viewer.tsx`

Status: `medium`.

Fix:

- Avoid `querySelector`-based page jumps when a page layout model is available.
- Use PDF/page geometry for page navigation.
- Virtualize long partition/section lists if profiling shows list cost.

Acceptance:

- Page navigation works for unmounted or far-away pages.
- Long partition results avoid large static DOM lists.

### Classification Viewer

Files:

- `components/viewers/classify/classifier-viewer.tsx`

Status: `medium`.

Fix:

- Use page geometry from the PDF viewer instead of querying page DOM where
  possible.
- Virtualize long label/result lists if profiling shows they matter.

Acceptance:

- Page navigation remains correct.
- Long classification result sets stay cheap.

### Edit Viewer

Files:

- `components/viewers/edit/edit-viewer.tsx`
- `components/viewers/edit/edit-viewer-document-pane.tsx`
- `components/viewers/edit/edit-viewer-field-panel.tsx`
- `components/viewers/edit/edit-viewer-overlays.tsx`
- `components/viewers/edit/use-edit-viewer-controller.ts`

Status: `conditional`.

Fix:

- Do not imperatively patch active editors.
- Optimize static overlays and long field panels only after profiling.
- If field panels are slow, virtualize repeated field rows.
- If overlays are slow, derive visible overlays from page geometry.

Acceptance:

- Editing correctness beats scroll micro-optimization.
- Focus, caret, validation, and active field state are never moved by shell reuse.

## Explicit Non-Targets

### Arbitrary DOM Trees

Do not Chenglou-virtualize arbitrary DOM trees where we do not own geometry or
content shape:

- HTML bodies;
- HTML email bodies;
- opaque DOCX content;
- third-party-rendered embeds.

Allowed optimization:

- isolate them;
- render them once;
- avoid putting them below hot React state;
- virtualize only outer, repeatable containers if geometry is reliable.

### Editable Surfaces

Do not imperatively reuse rows or blocks that currently own:

- focus;
- text selection;
- a caret;
- an open popover;
- a drag operation;
- a composition event;
- validation state tied to a mounted editor.

Editable surfaces can still use geometry, but React must own active editing
identity.

## Recommended Implementation Order

1. XLSX row patcher.
2. Image/TIFF frame virtualization.
3. JSON inspector line virtualization.
4. Code Viewer fixed-line projector.
5. JSON table read-only row patching.
6. PPTX visible-slide geometry.
7. PPTX slide shell virtualization.
8. Markdown Document Viewer imperative page projection.
9. Page Markdown consolidation.
10. File Viewer routing cleanup.
11. Parse/Split/Partition/Classification geometry cleanup.
12. PDF thumbnail rail projection only if profiling justifies it.
13. DOCX page virtualization only if reliable page boundaries exist.
14. Email long-section virtualization only if profiling justifies it.
15. Edit Viewer static-overlay/field-panel optimization only if profiling
    justifies it.

## Verification Matrix

### Focused Tests

- Text: `tests/text-viewer-virtualization.test.ts`,
  `tests/text-viewer-markdown.test.tsx`,
  `tests/markdown-text-viewer-contract.test.tsx`
- Code: `tests/code-viewer.test.tsx`,
  `tests/code-viewer-edge-cases.test.tsx`
- CSV: `tests/csv-viewer.test.tsx`, `tests/csv-row-patcher.test.tsx`
- XLSX: `tests/xlsx-row-patcher.test.tsx`,
  `tests/xlsx-components.test.tsx`,
  `tests/xlsx-viewer-integration.test.tsx`
- JSON inspector/table: `tests/json-inspector-virtualization.test.tsx`,
  `tests/read-only-json-row-patcher.test.tsx`,
  `tests/json-table-session-virtualization-hardening.test.tsx`,
  `tests/json-table-virtualization-stress-hardening.test.tsx`
- Image/TIFF: `tests/image-viewer.test.tsx`,
  `tests/image-viewer-probes.test.tsx`,
  `tests/image-viewer-edge-cases.test.tsx`
- PDF: `tests/pdf-viewer-virtualization.test.tsx`,
  `tests/pdf-viewer-scroll.test.tsx`,
  `tests/pdf-viewer-layout.test.ts`
- PPTX: `tests/pptx-viewer-units.test.tsx`,
  `tests/pptx-viewer.test.tsx`
- Markdown: `tests/markdown-document-viewer.test.tsx`,
  `tests/markdown-document-virtualizer.test.ts`,
  `tests/page-markdown-virtualization.test.tsx`
- DOCX: `tests/docx-viewer.test.tsx`,
  `tests/docx-viewer-edge-cases.test.tsx`
- File Viewer: `tests/file-viewer.test.tsx`
- Workflow viewers: `tests/parse-viewer.test.tsx`,
  `tests/parse-viewer-adapter.test.tsx`,
  `tests/edit-viewer-model.test.ts`,
  `tests/edit-viewer-render.test.tsx`

### Global Checks

- `pnpm typecheck`
- `pnpm registry:build`
- Browser smoke test for File Viewer after routing or visual changes.
- Profiling run for any surface before implementing a `conditional` item.

## Definition Of Done

A viewer performance fix is complete only when:

1. The hot scroll path is documented.
2. The geometry model is explicit.
3. The fallback conditions are explicit.
4. Tests cover the fast path and fallback path.
5. The docs/registry/demo names match the final component behavior.
6. Profiling shows the work removed real scroll/render cost.
