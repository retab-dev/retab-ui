# Blueprint - Layout Blocks

Status: **draft / architecture blueprint**
Scope: build a better layout-block review component than Extend UI's current
Layout Blocks block, while keeping the Retab version simple, fast, complete,
minimal, modular, and exact.

---

## 1. Standard

Platonic ideal means:

- Simple: one concept, one name, one owner.
- Fast: no large demo payloads in production components, no repeated full-list
  scans in render, no heavy renderers on the hot path.
- Complete: block, line, and word inspection; geometry; confidence; empty,
  loading, error, keyboard, and accessibility states.
- Minimal: no sample data in installable UI, no markdown dependency by default,
  no backend-shaped component API.
- Modular: data normalization, geometry, selection, overlay rendering, and panel
  rendering are separate.
- High entropy: every exported type and prop does real work.
- Consistent: use `layout`, `item`, `kind`, `level`, `target`, `highlight`, and
  `overlay` everywhere.
- Exact: docs and implementation must describe the same behavior.

---

## 2. Baseline Finding

Extend got the product shape right: a document viewer with a structured layout
panel beside it. The composed block is clean and useful.

The core failure is packaging and abstraction:

- The installable `layout-blocks.tsx` ships the demo OCR payload inline. In the
  inspected clone it was `8,364` lines / `252 KB`, while the composed block was
  only `98` lines.
- The public API is OCR-specific (`OcrBlock`, `ParsedOcrOutput`,
  `chunks.blocks`) instead of layout-generic.
- The docs promise block, line, and word overlays, but the implementation only
  renders block overlays.
- Geometry reduces polygons to axis-aligned boxes, ignores rotation, does not
  clamp coordinates, and does not validate missing geometry.
- Hovering a row scrolls the PDF immediately. There is no clear hover vs. pinned
  selection model.
- Markdown rendering and HTML sanitization dependencies sit in the default
  install path, even though most rows need only plain text.

The Retab version should preserve the good product idea and delete the rest.

---

## 3. First Use Case - Google Document AI OCR

Use `sample/documentai-output.json` as the first real fixture.

The sample is a one-page bank statement with:

- `text`: one global UTF-8 text buffer, length `1171`.
- `pages`: one page.
- `pages[0].dimension`: `1758 x 2275` pixels.
- `pages[0].blocks`: `59`.
- `pages[0].paragraphs`: `68`.
- `pages[0].lines`: `73`.
- `pages[0].tokens`: `194`.
- confidence range across layout nodes: roughly `0.539..0.999`.

This is the right starting point because it gives us real document-review
pressure:

- header and address zones,
- account identifiers,
- summary label/value pairs,
- transaction tables,
- low-confidence tokens,
- repeated values,
- dense text near numeric columns.

### Document AI Shape

Document AI layout nodes all share the same core shape:

```ts
type DocumentAiLayoutNode = {
  layout: {
    textAnchor?: {
      textSegments?: Array<{
        startIndex?: string
        endIndex?: string
      }>
    }
    confidence?: number
    boundingPoly?: {
      vertices?: Array<{ x?: number; y?: number }>
      normalizedVertices?: Array<{ x?: number; y?: number }>
    }
    orientation?: number
  }
}
```

Important details:

- Text is not duplicated on nodes. A node points into the global `document.text`
  through `textAnchor.textSegments`.
- `startIndex` may be missing; missing means `0`.
- Indices are strings in the JSON payload and must be parsed.
- Each node has both pixel vertices and normalized vertices.
- Tokens may include `detectedBreak`, which is useful for reconstructing text
  when only tokens are available.
- In this fixture every layout node has one text segment.

### Adapter Contract

Add a focused adapter:

```txt
components/ui/layout-blocks-document-ai.ts
```

It owns every Google-specific concern:

```ts
function documentAiToLayoutDocument(input: DocumentAiDocument): LayoutDocument
```

Output:

```ts
type LayoutDocument = {
  text: string
  pages: LayoutPage[]
  items: LayoutItem[]
}
```

Rules:

- `blocks` become `LayoutItem` with `level: "block"`.
- `paragraphs` become `LayoutItem` with `level: "paragraph"` only inside the
  adapter, then map to the public inspection level closest to the UI mode. If
  the product UI only exposes `block | line | word`, paragraphs are an optional
  intermediate level, not a required visible mode.
- `lines` become `LayoutItem` with `level: "line"`.
- `tokens` become `LayoutItem` with `level: "word"`.
- Text is sliced from `document.text` by text anchor.
- Geometry uses `boundingPoly.vertices` first and falls back to
  `normalizedVertices * page.dimension`.
- `parentId` is derived by text-span containment, not by visual containment.

Hierarchy derivation:

```txt
block span contains paragraph span
paragraph span contains line span
line span contains token span
```

This avoids fragile geometry joins and gives stable parentage even when boxes
touch or overlap.

### Concrete Iteration

Iteration 1 should be deliberately narrow:

1. Load `sample/documentai-output.json`.
2. Normalize it to `LayoutDocument`.
3. Render the page image or PDF page.
4. Show `Blocks`, `Lines`, and `Words` as levels.
5. Pin a row and scroll/highlight the corresponding page region.
6. Add a `Low confidence` filter that immediately surfaces the questionable
   tokens in this fixture, for example the Greek-looking `ΜΟ`, `#`, and `MO`
   tokens below `0.9`.

This creates a use case we can iterate on without inventing fake OCR data.

Acceptance for the first use case:

- The adapter produces `59 + 73 + 194` visible items when paragraphs are hidden.
- The adapter can optionally produce paragraph items for debugging.
- Every item has stable text, confidence, page number, and geometry.
- Low-confidence filtering returns the expected low-confidence tokens from the
  fixture.
- Parent IDs are deterministic and tested.

---

## 4. Core Abstraction

The component is not "OCR blocks." It is **layout inspection**.

The canonical entity is a `LayoutItem`.

```ts
type LayoutLevel = "block" | "paragraph" | "line" | "word"

type LayoutKind =
  | "title"
  | "heading"
  | "paragraph"
  | "list"
  | "table"
  | "figure"
  | "header"
  | "footer"
  | "pageNumber"
  | "other"

type LayoutPoint = {
  x: number
  y: number
}

type LayoutRect = {
  left: number
  top: number
  width: number
  height: number
}

type LayoutQuad = [
  LayoutPoint,
  LayoutPoint,
  LayoutPoint,
  LayoutPoint,
]

type LayoutItem = {
  id: string
  pageNumber: number
  level: LayoutLevel
  kind: LayoutKind
  text: string
  confidence?: number
  rect?: LayoutRect
  quad?: LayoutQuad
  parentId?: string
}

type LayoutPage = {
  pageNumber: number
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
}
```

Rules:

- `LayoutItem` is viewer-ready, not backend-shaped.
- Backend adapters may produce it, but components never depend on backend output
  structure.
- `rect` and `quad` are in page coordinates, not percentages. Percent conversion
  belongs in geometry helpers.
- `quad` wins over `rect` for overlays. `rect` is a fallback.
- `confidence` is `0..1`; missing means unknown, not perfect.

---

## 5. Layers

### Layer 1 - Data Normalization

Pure functions. No React.

Suggested files:

```txt
components/ui/layout-blocks-types.ts
components/ui/layout-blocks-normalize.ts
components/ui/layout-blocks-geometry.ts
components/ui/layout-blocks-index.ts
```

Responsibilities:

- Convert Retab extraction/OCR/layout output into `LayoutItem[]`.
- Validate page dimensions.
- Normalize backend type names into `LayoutKind`.
- Preserve unknown types as `other`; do not silently drop them.
- Index items by page and level.
- Produce stable item IDs when the backend does not.

Acceptance:

- Sample/demo payloads live in fixtures, demos, or docs files only.
- The installable UI component imports no sample OCR output.
- Unknown types are visible as `other` unless explicitly filtered.

### Layer 2 - Geometry

Geometry must be exact before the UI is polished.

Required helpers:

```ts
normalizeRect(rect, page): LayoutRect | null
quadToRect(quad): LayoutRect
rotatePoint(point, page): LayoutPoint
rotateQuad(quad, page): LayoutQuad
toPercentRect(rect, page): CSSProperties
toSvgPoints(quad, page): string
getScrollTarget(item, page): { pageNumber: number; x: number; y: number }
```

Rules:

- Clamp coordinates to page bounds.
- Return `null` for invalid geometry; never return `Infinity` or `NaN`.
- Rotation is handled once, in geometry, not ad hoc in overlay components.
- Tests cover 0, 90, 180, and 270 degree pages.

### Layer 3 - Selection Controller

Headless hook. No PDF dependency.

```ts
function useLayoutBlockSelection({
  items,
  activeItemId,
  selectedItemId,
  onActiveItemIdChange,
  onSelectedItemIdChange,
}: UseLayoutBlockSelectionOptions): LayoutBlockSelection
```

State model:

- `activeItemId`: transient hover/focus preview.
- `selectedItemId`: pinned click/keyboard selection.
- Effective item is `activeItemId ?? selectedItemId`.
- Hover may preview without destroying the pinned item.
- Click pins.
- Escape clears transient active state first, then pinned selection.

No row should scroll the viewer just because the mouse passed over it unless the
caller opts into hover navigation.

### Layer 4 - Overlay

Viewer-facing but document-format-agnostic.

```tsx
<LayoutOverlayLayer
  items={pageItems}
  page={page}
  activeItemId={activeItemId}
  selectedItemId={selectedItemId}
  visibleLevels={visibleLevels}
  onItemPointerEnter={setActiveItemId}
  onItemClick={setSelectedItemId}
/>
```

Rendering strategy:

- Use one SVG per page for polygons and many overlays.
- Use CSS rectangles only for small/simple rect-only cases if cheaper.
- Keep pointer events optional. Review mode may want clickable overlays; passive
  preview mode may not.
- Use confidence severity for visual weight. Type color is secondary.

### Layer 5 - Panel

```tsx
<LayoutBlocksPanel
  items={items}
  activeItemId={activeItemId}
  selectedItemId={selectedItemId}
  visibleLevels={visibleLevels}
  onActiveItemIdChange={setActiveItemId}
  onSelectedItemIdChange={setSelectedItemId}
  onNavigateItem={scrollToItem}
  renderItemContent={renderItemContent}
/>
```

Panel requirements:

- Virtualized list.
- Keyboard navigation with roving focus.
- `aria-selected` on the pinned item.
- `aria-current` or equivalent for the active preview item.
- Compact metadata: kind, confidence, page.
- Plain text by default.
- Optional content renderer for markdown/table-rich blocks.
- Empty state, invalid-geometry state, and filtered-empty state.

### Layer 6 - Retab Composition

Thin composition over Retab's document viewer.

```tsx
<RetabLayoutBlocks
  document={document}
  pages={pages}
  items={items}
  defaultVisibleLevels={["block"]}
/>
```

Responsibilities:

- Own the split-view layout.
- Bridge `onNavigateItem` to the viewer scroll handle.
- Render one `LayoutOverlayLayer` per visible page.
- Persist panel size only if the hosting viewer already supports layout
  persistence.

Non-responsibilities:

- It does not normalize raw backend output.
- It does not ship fixtures.
- It does not parse markdown.
- It does not know about API response shapes.

---

## 6. Interaction Model

Default controls:

- Segmented control: `Blocks`, `Lines`, `Words`.
- Confidence filter: `All`, `Low confidence`.
- Type filter only if there are at least three distinct kinds.
- Search only when item count is high enough to justify it.

Do not add explanatory text inside the component. The UI should be self-evident.

Navigation:

- Hover/focus previews.
- Click/Enter pins.
- Arrow keys move through rows.
- Home/End jump to first/last visible item.
- Escape clears preview, then pinned selection.
- `onNavigateItem` fires on pin by default, not on hover.

Visual hierarchy:

- Low confidence is the strongest visual signal.
- Active preview is second.
- Pinned selection is persistent and visible.
- Type is present but restrained.

---

## 7. Performance Rules

Hard rules:

- No demo data in production component bundles.
- No markdown renderer in the default row path.
- No `items.filter(...)` per rendered page on every render. Build
  `itemsByPage` once with `useMemo`.
- No `items.find(...)` on every row render. Use an `itemsById` map.
- Overlay rendering is bounded to visible pages.
- Row rendering is bounded by virtualization.
- Geometry conversion is memoized by item/page identity.

Targets:

- 10,000 layout items should keep row rendering bounded to visible rows.
- 1,000 visible overlays on one page should render through one SVG layer.
- Selection changes should not renormalize backend output.
- Hover changes should update only affected rows and overlays.

---

## 8. Accessibility

Panel:

- `role="listbox"` or a documented equivalent.
- Rows expose selection state.
- Keyboard path covers preview and pin.
- Row labels include kind, page, confidence, and text excerpt.

Overlay:

- Passive overlays are `aria-hidden`.
- Interactive overlays expose a label and can receive focus only when overlay
  interaction is enabled.
- Color is never the only confidence signal; low-confidence rows also show text
  or icon state.

Viewer composition:

- Split handles remain keyboard-resizable if the base split component supports
  it.
- Focus does not jump unexpectedly when scrolling to a page region.

---

## 9. Documentation Contract

Docs must not promise behavior before it exists.

Required sections:

- What it renders: layout items over a document.
- Supported levels: block, line, word.
- Data model.
- Controlled selection API.
- Geometry requirements.
- Viewer integration example.
- Retab output adapter example.
- Performance notes for large documents.

Manual install should list only dependencies used by the default path. Optional
renderers must be documented as optional.

---

## 10. Tests

Unit tests:

- Type normalization.
- Invalid geometry handling.
- Rect clamping.
- Quad-to-SVG conversion.
- Rotation at 0, 90, 180, 270 degrees.
- Page/item indexing.
- Selection state machine.

Component tests:

- Empty state.
- Filtered-empty state.
- Keyboard navigation.
- Click-to-pin.
- Hover preview without pin destruction.
- Low-confidence rendering.
- Virtualization keeps rendered rows bounded.

Integration tests:

- Selecting a row scrolls the document viewer to the correct page region.
- Rotated PDF pages highlight the correct region.
- Large output does not mount every row or every page overlay.

Visual checks:

- Dense table page.
- Scanned page with low-confidence words.
- Rotated page.
- Mobile vertical split.
- High zoom and low zoom.

---

## 11. Build Plan

### Phase 1 - Pure Foundation

1. Add layout item types.
2. Add Google Document AI normalizer for `sample/documentai-output.json`.
3. Add geometry helpers.
4. Add indexing helpers.
5. Add unit tests.

Acceptance:

- Pure helpers pass tests without React.
- No viewer code imports backend response types.

### Phase 2 - UI Primitives

1. Add `useLayoutBlockSelection`.
2. Add `LayoutBlocksPanel`.
3. Add `LayoutOverlayLayer`.
4. Add component tests.

Acceptance:

- Panel works without a PDF viewer.
- Overlay works from `LayoutItem[]` and `LayoutPage`.
- Markdown is not required.

### Phase 3 - Viewer Composition

1. Add `RetabLayoutBlocks`.
2. Bridge row pin to document scroll.
3. Render overlays only for visible pages.
4. Add integration tests.

Acceptance:

- Blocks, lines, and words can be inspected.
- Rotation-correct highlights pass.
- Large fixture remains responsive.

### Phase 4 - Polish and Docs

1. Add docs.
2. Add demo fixture outside production UI.
3. Add visual checks.
4. Run typecheck and focused tests.

Acceptance:

- Docs match implementation.
- Installable component contains no sample payload.
- Public API has no OCR-specific names.

---

## 12. Final Shape

The finished system should read like this:

```txt
layout-blocks-types.ts        public layout data model
layout-blocks-normalize.ts    Retab/raw output -> LayoutItem[]
layout-blocks-document-ai.ts  Google Document AI -> LayoutDocument
layout-blocks-geometry.ts     rect/quad/rotation/scroll math
layout-blocks-index.ts        itemsById/itemsByPage/itemsByLevel
use-layout-block-selection.ts hover/pin/keyboard state
layout-overlay-layer.tsx      page overlay renderer
layout-blocks-panel.tsx       virtualized inspector panel
retab-layout-blocks.tsx       document viewer composition
layout-blocks-demo-data.ts    demo-only fixture
```

No file owns more than one responsibility. No installable file contains demo
payloads. No component name says OCR unless it is an adapter from an OCR API.
