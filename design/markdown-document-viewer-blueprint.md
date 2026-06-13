# Markdown Document Viewer Blueprint

## Goal

Build a Markdown document viewer that combines the visual quality of the parse
viewer with the speed discipline of the Chenglou text viewer.

The viewer should render Markdown as a document surface, not as a code-like text
file, while still handling large files without mounting the full document.

## Current Rendering Models

### Parse Viewer

The parse viewer renders parsed document output through `PageMarkdownViewer`.

Its strengths:

- Page-based document composition.
- Natural browser Markdown layout.
- `react-markdown` plus `remark-gfm` for Markdown rendering.
- Dedicated Markdown component styling.
- Lazy page mounting with reserved measured heights.
- Synchronized document and Markdown panes.

Why it looks good:

- Markdown lives inside page frames with stable width, padding, and shadow.
- Browser layout owns typography, wrapping, tables, and inline flow.
- The content is already page-scoped, so each page has strong document context.

### Chenglou Text Viewer

The Chenglou text viewer renders text and Markdown through a custom
Pretext-backed layout and virtual projection engine.

Its strengths:

- Fast rendering for large text resources.
- Custom virtualization with no TanStack dependency.
- Precomputed document frames.
- RAF-batched scroll projection.
- Imperative DOM reuse.
- Source-line metadata, highlighting, zoom, and scroll-to-line support.

Why it looks less document-like:

- It is optimized as an infinite text surface.
- Markdown blocks are manually materialized into absolute-positioned rows.
- Browser layout does not own the full Markdown document.
- The visual language is closer to a tool surface than a page renderer.

## Desired Hybrid

Use React/GFM rendering for Markdown semantics and presentation, but use a
Pretext-style custom virtualizer for scroll performance.

The key boundary:

- React Markdown owns visible block/page rendering.
- The custom virtualizer owns which blocks/pages are mounted.
- Browser layout owns final typography inside mounted blocks/pages.

Do not try to make Pretext render every Markdown element itself. That recreates a
large Markdown renderer and fights the browser.

## Pipeline

```text
Markdown source
  -> parse Markdown/GFM AST
  -> normalize into block records
  -> group blocks into visual pages when appropriate
  -> estimate page/block heights
  -> custom virtualizer computes visible window
  -> render visible pages/blocks with React Markdown components
  -> measure actual heights with ResizeObserver
  -> update offsets while preserving scroll anchor
```

## Core Modules

### `markdown-document-model.ts`

Owns parsing and normalization.

Responsibilities:

- Parse Markdown using a `react-markdown` compatible GFM pipeline.
- Normalize content into stable block records.
- Preserve source-line metadata where possible.
- Assign stable block ids.
- Generate GitHub-style heading ids with duplicate suffixes.
- Treat YAML frontmatter as inert metadata/code, not live Markdown structure.
- Preserve enough original Markdown text for copy operations.
- Identify block types:
  - heading
  - paragraph
  - list
  - blockquote
  - code block
  - table
  - image
  - thematic break
- Optionally group blocks into visual pages.

### `markdown-document-virtualizer.ts`

Owns custom virtualization.

Responsibilities:

- Store estimated and measured heights.
- Maintain cumulative offsets.
- Given `scrollTop`, `viewportHeight`, and `overscanPx`, return the visible
  page/block window.
- Support scroll-to-block and scroll-to-source-line.
- Preserve scroll anchors when measurements change.
- Stay React-free.

### `markdown-document-viewer.tsx`

Owns viewer state and composition.

Responsibilities:

- Read the text resource.
- Enforce the same `maxBytes` and `maxLines` bounds as the text viewer.
- Build the normalized Markdown document.
- Maintain virtualizer state.
- Render toolbar, scroll area, and virtual canvas.
- Mount only visible pages/blocks.
- Measure rendered items with `ResizeObserver`.
- Expose the existing viewer handle contract.
- Reuse the existing viewer error boundary, retry, and download behavior.
- Support `bare`, `className`, `highlight`, and `mode` compatibility where the
  FileViewer route needs it.

### `markdown-document-block.tsx`

Owns visible Markdown rendering.

Responsibilities:

- Render one Markdown block or one visual page.
- Use `react-markdown` and `remark-gfm`.
- Reuse the parse viewer Markdown components where possible.
- Keep unsafe HTML and unsafe URL protocols inert.
- Avoid absolute positioning inside the rendered Markdown content.
- Add copy controls for fenced code blocks.
- Add copy controls for tables that copy the complete source table, not only the
  mounted or visible rows.
- Preserve accessible table structure: `th`, `scope`, deterministic header ids,
  and `headers` on data cells where needed.
- Preserve accessible list and heading semantics.
- Render image loading and failure states without layout collapse.

### `markdown-document-toolbar.tsx`

Owns top-level viewer controls.

Responsibilities:

- Show document/page position.
- Switch between rendered and raw text modes.
- Provide zoom out, zoom in, and fit-width.
- Provide copy-all-Markdown and download actions.
- Collapse secondary actions into a menu on narrow widths.

## Virtualization Unit

Do not virtualize wrapped text lines.

Markdown is document content. Natural browser layout matters more than exact
wrapped-line ownership.

Use one of these units:

### Block Virtualization

Best for arbitrary Markdown files.

Each top-level Markdown block is independently mounted and measured.

Pros:

- Fine-grained mounting.
- Better for very large generated Markdown files.
- Easier source-line mapping.

Cons:

- Harder to make the result feel like a composed document.
- Tables, lists, and nested structures need careful grouping.

### Page Virtualization

Best for document-like viewing.

Blocks are grouped into soft pages with fixed readable width and measured
height.

Pros:

- Closest to the parse viewer visual quality.
- Strong document feel.
- Natural place for page padding, width, and shadows.
- Fewer mounted roots.

Cons:

- Coarser virtualization.
- Source-line scrolling lands on a page first, then a block inside it.

Recommendation: start with page virtualization, then keep the model flexible
enough to support block virtualization later.

## Page Grouping

Page grouping should be deterministic and content-aware.

Initial rules:

- Start a new page at explicit parse page boundaries when provided.
- For ordinary Markdown files, group blocks by estimated height.
- Keep a heading with the following block when possible.
- Do not split a table across pages in the first implementation.
- Do not split fenced code blocks.
- Do not split list containers unless they exceed the target page height.
- Allow over-height pages for very large tables, code blocks, or images.

This keeps document composition stable while avoiding surprising cuts through
semantic structures.

## Rendering Shape

Use a virtual canvas:

```tsx
<div style={{ height: totalHeight }}>
  {visibleItems.map((item) => (
    <MarkdownDocumentPage
      key={item.id}
      page={item}
      style={{ transform: `translateY(${item.top}px)` }}
      onMeasure={measureItem}
    />
  ))}
</div>
```

Inside each mounted page, use normal Markdown rendering:

```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
  {page.markdown}
</ReactMarkdown>
```

The outer layer is virtualized. The inner layer is normal browser layout.

## Height Handling

Use three phases.

### 1. Estimate

Before rendering, estimate height from content shape:

- heading: fixed line estimate
- paragraph: character count and container width
- list: item count and paragraph estimates
- table: header height plus row estimate
- code: line count times code line height
- image: placeholder height

### 2. Render

Mount only visible pages/blocks plus overscan.

Use estimated offsets for first paint.

### 3. Measure

Attach `ResizeObserver` to mounted pages/blocks.

When actual height changes:

- update the measured height cache
- recompute offsets
- preserve the current scroll anchor
- schedule the next projection through RAF

Measurement cache keys must include:

- source identity
- mode
- scale
- container width
- page/block id
- Markdown content hash

Changing any of those should invalidate the affected measurements.

## Scroll Anchor Preservation

Before changing measurements or scale, capture:

- the first visible virtual item
- its offset from the viewport top

After recalculating offsets, restore:

```text
scrollTop = newItemTop + oldOffsetWithinItem
```

This prevents jumps when images load, tables measure, fonts settle, or zoom
changes.

## Feature Requirements

The viewer should support:

- GFM tables.
- Complete table copy.
- Fenced code blocks.
- Code block language labels.
- Code block copy.
- Lists and nested lists.
- Blockquotes.
- Images with safe URL handling.
- Image loading and failure placeholders.
- Safe links with local fragment support.
- Raw HTML rendered inert.
- Copy/download actions.
- Zoom and fit-width.
- Rendered/raw text mode switch.
- Source-line metadata.
- Highlight by source line.
- Scroll-to-source-line.
- Local heading fragment scrolling.
- Stable generated heading ids.
- YAML frontmatter.
- Large file bounds and viewer error states.
- Loading, empty, and error states.

## Public Contract

The Markdown document viewer should preserve the relevant `TextViewer` contract:

```ts
interface TextViewerHandle {
  scrollToLineRange(range: TextLineRange, options?: ScrollToOptions): void
  getViewportElement(): HTMLElement | null
}
```

Props should support:

- `source`
- `className`
- `toolbar`
- `highlight`
- `bare`
- `maxBytes`
- `maxLines`

FileViewer should be able to route Markdown to the new viewer without changing
its public API.

## Security Requirements

Do not render raw HTML as live DOM.

Unsafe protocols should stay inert:

- `javascript:`
- unsafe `data:` URLs
- malformed protocols
- protocol-relative URLs if the policy decides to disallow them

External links should use:

```html
target="_blank" rel="noopener noreferrer"
```

Local fragment links should remain local and should not get external-link
attributes.

Images should use the same URL policy as links, with a narrower allowlist if
needed. Unsafe images should render as inert placeholders, not hidden broken DOM.

## Accessibility Requirements

The viewer should keep:

- Real heading elements or equivalent heading roles.
- Real lists and list items.
- Real tables with headers.
- Keyboard-focusable links and controls.
- Button labels and titles for icon-only controls.
- `aria-current` or equivalent state for current page where useful.
- No hidden duplicate rich content for offscreen pages.

## Migration Plan

1. Keep Chenglou for plain text, logs, and code-like files.
2. Add `MarkdownDocumentViewer` separately.
3. Reuse parse viewer Markdown components.
4. Implement page-level custom virtualization.
5. Add source-line metadata and scroll-to-line support.
6. Add rendered/raw mode, zoom, copy, download, and error states.
7. Wire FileViewer Markdown to the new viewer.
8. Keep Chenglou available as a profiling baseline.
9. Update registry metadata and generated `public/r` artifacts.
10. Profile against:
   - current Chenglou Markdown viewer
   - parse viewer
   - large synthetic Markdown files

## Tests

Add tests for:

- GFM table rendering.
- Complete table copy.
- Accessible table headers.
- Fenced code language and copy.
- Large Markdown virtualization.
- Offscreen pages not mounting rich content.
- Height measurement updates.
- Scroll anchor preservation after measurement.
- Source-line metadata.
- Highlight by source line.
- Scroll-to-line.
- Local fragment links.
- Heading id generation and duplicate headings.
- Safe external links.
- Unsafe image URLs and image load failure.
- YAML frontmatter rendering.
- Unsafe HTML and URL hardening.
- Zoom and fit-width.
- Rendered/raw mode switching.
- Bounds errors for `maxBytes` and `maxLines`.
- FileViewer Markdown routing.

## Performance Checks

Profile at least:

- A short Markdown note.
- A long prose Markdown file.
- A large table.
- A long code-heavy Markdown file.
- Parse-style page output.
- A file with many images.

Track:

- first useful paint
- scroll smoothness
- mounted page/block count
- measurement churn
- memory retained after scrolling
- time to jump to a source line or heading fragment

The viewer does not need line-level Chenglou precision, but it should avoid
full-document React mounting for large files.

## Non-Goals

This viewer should not replace:

- `CodeViewer` for code, logs, JSON, or fixed-width inspection.
- Chenglou text mode for huge plain text.
- Parse Viewer document sync behavior, except where FileViewer explicitly needs
  standalone Markdown display.

It should also avoid:

- Reimplementing a full Markdown renderer by hand.
- Virtualizing individual wrapped lines.
- Adding TanStack Virtual.

## Expected Result

The final viewer should feel like the parse viewer visually and like the
Chenglou viewer operationally.

In short:

- React/GFM for Markdown correctness and visual rendering.
- Browser layout for typography.
- Custom Pretext-style virtualization for speed.
- Page/document visual language for quality.
