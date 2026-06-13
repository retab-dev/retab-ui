# Anchored Document Containment Blueprint

## Objective

Define the boundary that lets anchored document interactions exist without
polluting the rest of the viewer system.

The anchored model is useful only for experiences where domain items point into
a document:

```txt
extracted fields
OCR blocks
edit fields
citations
validation issues
review findings
```

It must not become a tax on ordinary viewers.

## Position

`AnchoredDocumentProvider` should sit above leaf viewers and below domain
adapters.

Correct layering:

```txt
Viewer primitives
  -> layout only

Leaf viewers
  -> render files

Anchored document provider
  -> shared item/anchor interaction

Domain adapters
  -> extraction, OCR, edit, citations, validation
```

Incorrect layering:

```txt
Viewer primitives know anchors
Leaf viewers own anchored items
FileViewer routes source links
PdfViewer accepts anchoredItems
```

The abstraction is good only if it remains optional and external.

## Hard Rule

If a component can render a file without a semantic side list, it must not
import anchored-document code.

Allowed:

```txt
ExtractViewerBlock imports AnchoredDocumentProvider
OcrBlock imports AnchoredDocumentProvider
EditViewer imports AnchoredDocumentProvider
```

Forbidden:

```txt
PdfViewer imports AnchoredDocumentProvider
ImageViewer imports AnchoredDocumentProvider
TextViewer imports AnchoredDocumentProvider
FileViewer imports AnchoredDocumentProvider
ViewerRoot imports AnchoredDocumentProvider
```

## Dependency Direction

Dependencies must point one way:

```txt
domain viewer
  imports anchored-document
  imports viewer primitives
  imports leaf viewer

anchored-document
  imports no domain viewer
  imports no leaf viewer
  imports no viewer primitive unless rendering generic list parts

leaf viewer
  imports no anchored-document

viewer primitives
  import no anchored-document
```

The graph should look like this:

```txt
ExtractionViewer -> AnchoredDocumentProvider
ExtractionViewer -> ViewerRoot
ExtractionViewer -> PdfViewer

OcrViewer -> AnchoredDocumentProvider
OcrViewer -> ViewerRoot
OcrViewer -> PdfViewer

PdfViewer -> never AnchoredDocumentProvider
FileViewer -> never AnchoredDocumentProvider
ViewerRoot -> never AnchoredDocumentProvider
```

## Public API Boundary

Do not add these props to leaf viewers:

```ts
anchoredItems?: AnchoredItem[]
anchors?: DocumentAnchor[]
selectedItemId?: string
activeItemId?: string
onItemSelect?: (id: string) => void
sourceMap?: SourceMap
```

Leaf viewers may keep format-native highlight/overlay props:

```ts
PdfViewer.renderPageOverlay
ImageViewer.renderFrameOverlay
TextViewer.highlight
CodeViewer.highlight
CsvViewer.activeCell
XlsxViewer.activeCell
DocxViewer.highlight
```

Those props are rendering adapters, not anchored-document ownership.

## Correct Composition

PDF extraction:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSurface>
        <PdfViewer
          ref={viewerRef}
          bare
          source={source}
          renderPageOverlay={target.renderOverlay}
        />
      </ViewerSurface>
      <ViewerSidebar>
        <ExtractionFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

OCR:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerHeader>
      <OcrControls />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSurface>
        <PdfViewer
          ref={viewerRef}
          bare
          source={source}
          renderPageOverlay={target.renderOverlay}
        />
      </ViewerSurface>
      <ViewerSidebar>
        <OcrBlocks />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

Wrong:

```tsx
<PdfViewer source={source} anchoredItems={items} />
```

Wrong:

```tsx
<FileViewer source={source} sourceMap={sourceMap} />
```

Wrong:

```tsx
<ViewerRoot activeItemId={activeItemId}>
```

## What AnchoredDocumentProvider Owns

It owns:

```txt
items
active item id
selected item id
active anchor resolution
preview/select/activate actions
navigation through a target adapter
```

It does not own:

```txt
layout
header content
sidebar placement
filters
file loading
PDF rendering
image rendering
text rendering
JSON form rendering
OCR block data extraction
```

If the provider starts owning layout or domain filtering, it is too low-level
and too broad.

## Target Adapter Boundary

Targets translate anchors into leaf viewer behavior.

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

Targets can know leaf viewer handles.

Targets should not know domain item shape.

Good:

```txt
usePdfAnchoredTarget(viewerRef)
useImageAnchoredTarget(viewerRef)
useTextAnchoredTarget(viewerRef)
```

Bad:

```txt
useExtractionPdfTarget(fields)
useOcrPdfTarget(blocks)
```

Domain data becomes `AnchoredItem[]` before it reaches the target.

## Domain Adapter Boundary

Domain adapters convert domain objects into anchored items.

Extraction:

```ts
function extractionFieldsToAnchoredItems(fields): AnchoredItem[]
```

OCR:

```ts
function documentAiBlocksToAnchoredItems(blocks): AnchoredItem[]
```

Edit:

```ts
function editFieldsToAnchoredItems(fields): AnchoredItem[]
```

These adapters may know domain-specific labels, confidence, value formatting,
missing-state semantics, and grouping.

They should not know viewer layout.

## Viewer Primitives Boundary

Viewer primitives remain dumb:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

They should never receive:

```txt
items
anchors
sources
fields
blocks
selected item
active source
```

They may receive only ordinary layout props:

```txt
className
style
children
bare
```

## Leaf Viewer Boundary

Leaf viewers should remain useful alone:

```tsx
<PdfViewer source={source} />
<ImageViewer source={source} />
<TextViewer source={source} />
<FileViewer source={source} />
```

They should not require an anchored provider.

They should not branch on anchored context.

They should not render anchored side panels.

They should expose enough format-native hooks for composition:

```txt
imperative scroll handles
overlay render callbacks
highlight props
active cell props
```

That is the only integration point.

## Naming Containment

Inside anchored-document code, use:

```txt
item
anchor
target
active
selected
preview
activate
```

Inside extraction code, domain names are allowed:

```txt
field
source
value
schema
```

Inside OCR code:

```txt
block
confidence
layout item
polygon
```

Do not leak domain names into core anchored types.

Do not leak `Source` into core anchored names unless the type is explicitly an
adapter.

## Registry Containment

The registry item for a leaf viewer must not depend on anchored-document:

```txt
pdf-viewer -> no anchored-document
image-viewer -> no anchored-document
text-viewer -> no anchored-document
file-viewer -> no anchored-document
```

Anchored-document can depend on:

```txt
utils
button
scroll-area
viewer primitives, if generic UI parts are exported
```

Blocks can depend on both:

```txt
extract-viewer-block -> anchored-document + pdf-viewer + json-form
ocr-block -> anchored-document + pdf-viewer + layout-blocks
```

## Test Gates

Architecture tests should enforce containment:

```txt
PdfViewer does not import anchored-document
ImageViewer does not import anchored-document
TextViewer does not import anchored-document
FileViewer does not import anchored-document
Viewer primitives do not import anchored-document
```

Positive tests:

```txt
ExtractViewerBlock uses AnchoredDocumentProvider
OcrBlock or DocumentAiLayoutBlocks uses AnchoredDocumentProvider
EditViewer can use AnchoredDocumentProvider after migration
```

Behavior tests:

```txt
leaf viewers render without provider
anchored viewers render with provider
target adapters work through leaf viewer public handles only
```

## Migration Order

1. Add the anchored-document core with architecture tests proving no leaf viewer
   imports it.
2. Migrate PDF extraction first.
3. Migrate OCR second.
4. Compare their code. If they do not delete duplicate hover/select/scroll
   logic, the abstraction is wrong.
5. Migrate multi-format extraction adapters only after PDF extraction and OCR
   converge.
6. Revisit edit viewer last.

Do not migrate every viewer.

Do not touch leaf viewer APIs unless an existing format-native hook is missing.

## Success Criteria

The abstraction is contained if:

- ordinary `PdfViewer` usage remains unchanged;
- ordinary `FileViewer` usage remains unchanged;
- no leaf viewer imports anchored-document code;
- extraction and OCR share the same provider;
- extraction and OCR share the same active/selected semantics;
- extraction and OCR use target adapters instead of bespoke scroll logic;
- layout remains visible through `ViewerRoot`, `ViewerBody`, `ViewerSurface`,
  and `ViewerSidebar`;
- domain panels remain domain-specific.

## Failure Signs

The abstraction is polluting the system if:

- `FileViewerProps` gains anchored or source-map props;
- `PdfViewerProps` gains anchored item props;
- `ViewerRoot` knows selection state;
- leaf viewers branch on anchored context;
- anchored-document exports file-format renderers;
- extraction/OCR still duplicate hover/select/scroll semantics after migration;
- every viewer starts importing anchored-document "just in case."

## Final Rule

Anchored-document is not a viewer primitive.

It is not a file renderer.

It is not a shell.

It is an optional interaction layer for one class of product experiences:

```txt
semantic items anchored into a document
```

Keep it there.
