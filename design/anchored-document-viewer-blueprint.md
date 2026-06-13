# Anchored Document Viewer Blueprint

## Objective

Unify source bounding-box viewers, OCR layout-block viewers, and edit-style
document overlays under one shared composition model.

The goal is not to create separate abstractions for extraction, OCR, citations,
and field editing. Those are domain projections of the same primitive:

```txt
document surface
+ anchored items
+ side inspector
+ hover/selection state
+ scroll-to-anchor
+ overlay/highlight rendering
```

Extraction sources and OCR blocks should feel like the same component family.
They should differ by item model and labels, not by architecture.

## Position

The shared abstraction should be `AnchoredDocumentViewer`.

It is a domain-state layer composed with the generic viewer primitives:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <AnchoredDocumentSurface />
      </ViewerSurface>
      <ViewerSidebar>
        <AnchoredItemList />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

The viewer primitives own space.

`AnchoredDocumentProvider` owns item state.

The target adapter owns format-specific navigation and overlay conversion.

The product viewer owns domain copy and item projection.

## Same Family

These should share the same core:

```txt
Extraction source viewer
OCR layout-block viewer
Edit field viewer
Citation viewer
Validation issue viewer
Review finding viewer
```

They all answer the same interaction question:

```txt
Which derived item is active, and where is it in the document?
```

## Non-Goal

Do not make separate layout systems:

```txt
ExtractionShell
DocumentAiLayoutBlocks shell
EditViewer shell
SourceBboxViewer shell
OcrViewer shell
```

Those names may exist as thin domain adapters, but they should not own distinct
layout grammars.

## Data Model

The core item should be domain-neutral:

```ts
type AnchoredItemId = string

type AnchoredItem = {
  id: AnchoredItemId
  label: React.ReactNode
  value?: React.ReactNode
  description?: React.ReactNode
  metadata?: React.ReactNode
  anchor: DocumentAnchor | null
  disabled?: boolean
}
```

The `anchor` is the important part. Everything else is presentation.

## Anchor Model

The anchor model must cover current source-link and OCR cases without becoming
format-specific UI.

```ts
type NormalizedBBox = {
  left: number
  top: number
  width: number
  height: number
}

type DocumentAnchor =
  | {
      kind: "pdf-bbox"
      page: number
      bbox: NormalizedBBox
    }
  | {
      kind: "image-bbox"
      frame?: number
      bbox: NormalizedBBox
    }
  | {
      kind: "text-range"
      startLine: number
      endLine: number
    }
  | {
      kind: "csv-cell"
      row: number
      column: number
    }
  | {
      kind: "xlsx-cell"
      sheet: number
      row: number
      column: number
    }
  | {
      kind: "docx-target"
      target: unknown
    }
```

The first implementation can reuse existing `Source` types internally, but the
public anchored model should describe intent, not Retab response shape.

## Target Adapter

The format-specific part should be isolated in an adapter:

```ts
type AnchoredDocumentTarget = {
  scrollToAnchor: (
    anchor: DocumentAnchor,
    options?: ScrollToOptions
  ) => void
  renderOverlay?: (state: AnchoredDocumentState) => React.ReactNode
  toLeafHighlight?: (state: AnchoredDocumentState) => unknown
}
```

Examples:

```txt
PDF target:
- scrollToAnchor uses PdfViewerHandle.scrollToPageArea
- renderOverlay draws normalized page boxes

Image target:
- scrollToAnchor pans/zooms or scrolls to frame area
- renderOverlay draws image boxes

Text target:
- scrollToAnchor calls TextViewerHandle.scrollToLine
- toLeafHighlight returns a line range

CSV/XLSX target:
- scrollToAnchor scrolls to cell
- toLeafHighlight returns active cell coordinates

DOCX target:
- scrollToAnchor resolves a document target
- toLeafHighlight returns the docx highlight target
```

This keeps the provider generic and prevents `AnchoredDocumentProvider` from
knowing every file format.

## Provider State

The provider should own only shared interaction state:

```ts
type AnchoredDocumentState = {
  items: readonly AnchoredItem[]
  activeItemId: AnchoredItemId | null
  selectedItemId: AnchoredItemId | null
  activeItem: AnchoredItem | null
  selectedItem: AnchoredItem | null
}
```

Actions:

```ts
type AnchoredDocumentActions = {
  previewItem: (id: AnchoredItemId | null) => void
  selectItem: (id: AnchoredItemId | null) => void
  activateItem: (id: AnchoredItemId, options?: ScrollToOptions) => void
  clearPreview: () => void
}
```

Selection should persist.

Hover/focus should preview.

Preview should temporarily override selected highlight.

Click should select and navigate.

Keyboard activation should select and navigate.

## Active Anchor Rule

The active anchor is:

```txt
hovered/focused item anchor
else selected item anchor
else null
```

This should be one rule shared by source fields, OCR blocks, edit fields, and
citations.

Do not duplicate hover-vs-selected semantics in each domain viewer.

## Public Parts

The core should expose named parts:

```txt
AnchoredDocumentProvider
useAnchoredDocument
AnchoredDocumentSurface
AnchoredItemList
AnchoredItemRow
AnchoredDocumentCount
```

Potentially useful but not mandatory:

```txt
AnchoredDocumentHeader
AnchoredDocumentFilters
AnchoredDocumentEmptyState
```

Do not add these until extraction and OCR both prove the same part is needed.

## Product Adapters

### Source Viewer

Extraction/source bboxes become a projection:

```tsx
<SourceDocumentViewer
  source={pdfSource}
  fields={fields}
  values={values}
/>
```

Internally:

```tsx
const items = extractionFieldsToAnchoredItems(fields)
const target = usePdfAnchoredTarget(viewerRef)

return (
  <AnchoredDocumentProvider items={items} target={target}>
    <ViewerRoot>
      <ViewerHeader>Extracted data</ViewerHeader>
      <ViewerBody>
        <ViewerSurface>
          <PdfViewer
            ref={viewerRef}
            bare
            renderPageOverlay={target.renderOverlay}
            source={source}
          />
        </ViewerSurface>
        <ViewerSidebar>
          <JsonForm sourceLink={anchoredJsonFormLink} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </AnchoredDocumentProvider>
)
```

The JSON form remains a domain-specific side panel.

The selection and document highlighting become generic anchored state.

### OCR Viewer

OCR becomes another projection:

```tsx
<OcrDocumentViewer output={documentAiOutput} />
```

Internally:

```tsx
const items = documentAiBlocksToAnchoredItems(output)
const target = usePdfAnchoredTarget(viewerRef)

return (
  <AnchoredDocumentProvider items={items} target={target}>
    <ViewerRoot>
      <ViewerHeader>
        <OcrSummary />
        <OcrConfidenceFilter />
      </ViewerHeader>
      <ViewerBody>
        <ViewerSurface>
          <PdfViewer
            ref={viewerRef}
            bare
            renderPageOverlay={target.renderOverlay}
            source={pdfSource}
          />
        </ViewerSurface>
        <ViewerSidebar>
          <LayoutBlocksPanel />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </AnchoredDocumentProvider>
)
```

The panel can still be OCR-specific.

The interaction model should not be OCR-specific.

### Edit Viewer

Edit fields probably belong here too:

```txt
input fields -> AnchoredItem[]
field bbox -> DocumentAnchor
field panel -> AnchoredItemList variant
PDF overlays -> same active-anchor overlay layer
```

Edit may need additional state for modes and filled values, but the anchor
selection model should be shared.

## Relationship To Existing Source Link

Existing `useSourceLink` is close to this abstraction, but it is narrower:

```txt
source map + field path + target
```

Anchored documents should generalize it:

```txt
items + item id + anchor + target
```

`useSourceLink` can either become:

```txt
a thin adapter over AnchoredDocumentProvider
```

or be replaced by:

```txt
sourceMapToAnchoredItems
JsonFormAnchoredAdapter
```

The ideal version has one hover/select implementation, not one for source links
and one for OCR blocks.

## Relationship To Viewer Primitives

`AnchoredDocumentProvider` must not render layout by itself.

Correct:

```tsx
<AnchoredDocumentProvider>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSurface />
      <ViewerSidebar />
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

Wrong:

```tsx
<AnchoredDocumentViewer layout="sidebar-right" />
```

Wrong:

```tsx
<AnchoredDocumentProvider sidebar={...} surface={...} />
```

The layout should stay visible in JSX.

## Side Placement

Extraction and OCR currently use right-side panels.

That is fine. `ViewerSidebar` should support side by composition, not by a slot
object:

```tsx
<ViewerBody>
  <ViewerSurface />
  <ViewerSidebar />
</ViewerBody>
```

Left sidebar:

```tsx
<ViewerBody>
  <ViewerSidebar />
  <ViewerSurface />
</ViewerBody>
```

No `side="right"` prop is needed unless repeated CSS proves it worthwhile.

## Filtering

OCR needs low-confidence filtering.

Extraction may later need missing-field filtering.

Validation may need severity filtering.

The generic layer should support filtered item input but should not own filter
semantics:

```tsx
const visibleItems = applyOcrFilters(items, filters)

<AnchoredDocumentProvider items={visibleItems} ...>
```

Domain filters belong in domain components.

The provider should only handle the case where the selected item disappears:

```txt
if selected item is no longer present, clear selection
if active item is no longer present, clear preview
```

## Overlay Rendering

The overlay should be generated from active state and visible items.

For PDF/OCR/source bboxes, overlay needs:

```txt
all visible boxes for current page
active item id
selected item id
hover/click handlers
```

The same overlay should support:

- passive source highlight;
- interactive OCR block selection;
- edit-field click targets.

That suggests two modes:

```ts
type OverlayInteractionMode = "passive" | "interactive"
```

Passive:

- draw active selected source;
- no per-box pointer handlers.

Interactive:

- draw all visible items;
- hover updates active item;
- click selects item.

## Accessibility

The side list should be keyboard navigable:

- `button` rows or roving focus;
- `Enter` / `Space` selects and navigates;
- active state reflected with `aria-current` or `aria-selected`;
- unavailable anchors disabled;
- count and filter controls accessible in header.

The document overlay should not trap keyboard focus unless interactive overlays
are intentionally focusable.

For extraction, the form fields are already the accessible item list. The
anchored adapter should let `JsonForm` emit preview/select events without
duplicating a second list.

## Naming

Use one concept name everywhere:

```txt
item
anchor
target
active
selected
preview
select
activate
```

Avoid mixing these names:

```txt
field vs item
source vs anchor
block vs item
hovered vs active
focused vs active
current vs selected
```

Domain code can say field/block/citation at its boundary, but the shared
provider should use item/anchor.

## Proposed Files

Core:

```txt
registry/new-york-v4/ui/anchored-document-viewer.tsx
registry/new-york-v4/ui/anchored-document-types.ts
registry/new-york-v4/ui/anchored-document-targets.ts
```

Adapters:

```txt
registry/new-york-v4/ui/pdf-anchor-target.tsx
registry/new-york-v4/ui/image-anchor-target.tsx
registry/new-york-v4/ui/text-anchor-target.tsx
registry/new-york-v4/ui/table-anchor-target.ts
registry/new-york-v4/ui/docx-anchor-target.ts
```

Domain projections:

```txt
registry/new-york-v4/blocks/extract-viewer-block.tsx
registry/new-york-v4/blocks/extraction-viewer-block.tsx
registry/new-york-v4/blocks/ocr-block.tsx
registry/new-york-v4/ui/layout-blocks.tsx
```

Do not create separate generic shells under each domain.

## Ideal API Sketch

```tsx
function OcrBlock() {
  const source = useDocumentAiPdfSource(output)
  const items = useDocumentAiAnchoredItems(output)
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={items} target={target}>
      <ViewerRoot bare className="h-full">
        <ViewerHeader>
          <OcrHeader />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSurface>
            <PdfViewer
              ref={viewerRef}
              bare
              className="h-full"
              source={source}
              renderPageOverlay={target.renderOverlay}
            />
          </ViewerSurface>
          <ViewerSidebar className="border-l">
            <OcrItemList />
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>
    </AnchoredDocumentProvider>
  )
}
```

```tsx
function ExtractViewerBlock() {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfAnchoredTarget(viewerRef)
  const items = useExtractionAnchoredItems(fields)

  return (
    <AnchoredDocumentProvider items={items} target={target}>
      <ViewerRoot bare className="h-full">
        <ViewerHeader>
          <ExtractionHeader />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSurface>
            <PdfViewer
              ref={viewerRef}
              bare
              className="h-full"
              source={source}
              renderPageOverlay={target.renderOverlay}
            />
            <AnchoredDocumentIndicator />
          </ViewerSurface>
          <ViewerSidebar className="border-l">
            <ExtractionJsonForm />
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>
    </AnchoredDocumentProvider>
  )
}
```

## Implementation Order

1. Extract the domain-neutral item and anchor types.
2. Build `AnchoredDocumentProvider` and `useAnchoredDocument`.
3. Build a PDF target adapter first, because extraction and OCR both need it.
4. Migrate `ExtractViewerBlock`.
5. Migrate `DocumentAiLayoutBlocks` / `OcrBlock`.
6. Only then generalize image/text/csv/xlsx/docx adapters for the multi-format
   `ExtractionViewerBlock`.
7. Revisit `EditViewer` after extraction and OCR converge.

Do not start with the multi-format extraction viewer. Start with PDF extraction
and OCR because they prove the shared geometry path.

## Tests

Core provider tests:

- hover sets active item;
- leaving clears active item without clearing selected item;
- click selects and activates item;
- active anchor prefers hover over selection;
- disappearing selected item clears selection;
- disabled item cannot activate;
- keyboard activation calls target navigation.

PDF target tests:

- `pdf-bbox` calls `scrollToPageArea`;
- overlay receives active and selected ids;
- passive overlay does not attach item interaction handlers;
- interactive overlay previews and selects items.

Extraction tests:

- field hover previews source bbox;
- field click pins source bbox;
- selected field survives unrelated hover;
- missing source shows indicator but does not crash.

OCR tests:

- block hover previews box;
- block click selects and scrolls to box;
- low-confidence filter updates visible items;
- selected filtered-out block clears selection.

Architecture tests:

- extraction and OCR import `ViewerRoot`, `ViewerBody`, `ViewerSurface`, and
  `ViewerSidebar`;
- extraction and OCR do not define separate raw flex shells;
- no `ExtractionShell` public abstraction;
- no `DocumentAiLayoutBlocks` bespoke root layout outside viewer primitives.

## Success Criteria

The design is right when these are true:

- extraction and OCR use the same provider;
- extraction and OCR use the same PDF anchor target;
- extraction and OCR render the same overlay component or overlay adapter;
- side panels are domain-specific, but interaction state is shared;
- `ViewerRoot/Header/Body/Surface/Sidebar` is visible in JSX;
- no slot objects;
- no separate shell abstractions;
- no duplicated hover/select/scroll semantics.

## Final Shape

The platonic model is:

```txt
Viewer primitives define layout.
AnchoredDocumentProvider defines item interaction.
Anchor targets adapt document formats.
Domain viewers project their data into anchored items.
Leaf viewers render the document.
```

Sources and OCR are not siblings with different skeletons.

They are the same skeleton wearing different data.
