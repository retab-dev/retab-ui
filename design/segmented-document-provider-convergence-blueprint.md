# Segmented Document Provider Convergence Blueprint

## Objective

Define the ideal shared abstraction behind split, partition, OCR, sources, and
bbox-style document viewers.

The center is not `SplitViewer`, `PartitionViewer`, `FileViewer`, or a generic
visual `<SegmentedViewer>`.

The center is a document annotation and navigation primitive:

```tsx
<SegmentedDocumentProvider model={model}>{children}</SegmentedDocumentProvider>
```

It owns shared behavior. Domain viewers keep their own visible composition.

This blueprint supersedes the parts of
`design/partition-viewer-segmented-model-blueprint.md` that preserve
`scrollRequest.version` as an acceptable final shape. That protocol is now
considered stale. Split's registered document-handle model is the better
direction.

## Core Judgment

Converge at the mechanics layer, not at the taste layer.

Shared:

```txt
current page
scroll progress
hover / preview interaction
document handle registration
scroll to page
scroll to segment start
scroll to anchor / bounds
synchronized legend, rail, ribbon, sidebar, and overlays
```

Domain-specific:

```txt
split subdocument language
partition output/vote semantics
OCR text
source provenance
extraction schemas
email MIME structure
file-system trees
layout taste
empty-state copy
```

Do not build a giant visual component that accepts flags such as
`partitionMode`, `splitMode`, `showConsensusVotes`, or `ocrBehavior`.

That would mean the abstraction failed.

## The Important Distinction

Do not collapse semantic segments and page-local anchors.

They are different concepts:

```txt
DocumentSegment = semantic thing
SegmentAnchor = page-local visual / scroll target
```

For split and partition, the first-class object is semantic:

```ts
{
  id: "appendix",
  label: "Appendix",
  pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  color: "var(--chart-4)",
}
```

For OCR, sources, and bboxes, the visual target is page-local:

```ts
{
  id: "anchor:invoice-total:2",
  segmentId: "invoice-total",
  pageNumber: 2,
  bounds: { x: 0.6, y: 0.7, width: 0.2, height: 0.04 },
}
```

If every segment becomes page-local, split and partition get worse. Legend,
rail, and ribbon surfaces would constantly need to regroup anchors back into
semantic segments. That is the wrong direction.

## Ideal Data Model

The shared model should describe a segmented document, not a viewer.

```ts
export type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}

export type SegmentedPage = {
  pageNumber: number
  width?: number
  height?: number
}

export type DocumentSegment = {
  id: string
  label: string
  color: string
  pages: number[]
  sourceId?: string
}

export type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}

export type SegmentBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type SegmentRow = {
  id: string
  label?: string
  segments: DocumentSegment[]
}
```

### Mapping

Split:

```txt
segments
```

Partition:

```txt
segments + rows
```

Sources:

```txt
segments + anchors
```

OCR:

```txt
segments + anchors
```

Extraction bboxes:

```txt
segments + anchors
```

## Provider Contract

The provider owns interaction and navigation, not domain derivation.

```ts
export type SegmentedDocumentContextValue = {
  model: SegmentedDocumentModel
  viewport: SegmentedDocumentViewport
}
```

Viewport:

```ts
export type SegmentedDocumentViewport = {
  model: SegmentedDocumentViewportModel
  interaction: SegmentInteraction
  documentHandlers: SegmentedDocumentHandlers
  navigation: SegmentedDocumentNavigation
}
```

Viewport model:

```ts
export type SegmentedDocumentViewportModel = {
  currentPage: number | null
  scrollProgress: number
  currentSegmentId: string | null
  previewSegmentId: string | null
  highlightedSegmentId: string | null
}
```

Document handlers:

```ts
export type SegmentedDocumentHandlers = {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  setDocumentHandle: (handle: SegmentedDocumentHandle | null) => void
}
```

Document handle:

```ts
export type SegmentedDocumentHandle = {
  getViewportElement?: () => HTMLElement | null
  scrollToPage: (page: number, options?: ScrollToOptions) => void
  scrollToAnchor?: (anchor: SegmentAnchor, options?: ScrollToOptions) => void
  scrollToPageArea?: (
    target: {
      pageNumber: number
      top: number
      left?: number
      width?: number
      height?: number
    },
    options?: ScrollToOptions
  ) => void
}
```

Navigation:

```ts
export type SegmentedDocumentNavigation = {
  scrollToPage: (page: number) => void
  scrollToSegmentStart: (segment: DocumentSegment) => void
  scrollToAnchor: (anchor: SegmentAnchor) => void
}
```

This is the generalized version of split's current `SegmentViewportController`.

## What Exists Today

Split is closest to the target:

```txt
SplitView
  -> SplitViewerModel
  -> SegmentViewportController
  -> named visible parts
```

Partition already has a pure model, but its live state is still custom:

```txt
currentPdfPage
scrollProgress
scrollRequest.version
requestPageScroll
```

That should converge.

Partition should stop replaying imperative scroll requests through parent
effects. The provider should own a registered document handle, the same way
split does.

## Partition Convergence

Partition has multiple projections, and they should be named by purpose.

```ts
export type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  viewportSegments: DocumentSegment[]
  legendSegments: DocumentSegment[]
  ribbonRows: PartitionRibbonRow[]
}
```

Do not feed `legendSegments` to the viewport controller by convention.

Use:

```ts
const viewport = useSegmentViewportController({
  segments: model.viewportSegments,
})
```

or, after the generic provider exists:

```ts
const model = createPartitionSegmentedDocumentModel(result)
```

`viewportSegments` means:

```txt
the semantic segments used for current-page ownership and navigation
```

`legendSegments` means:

```txt
the semantic segments rendered by the legend
```

`ribbonRows` means:

```txt
the concrete output/vote row projection rendered by the horizontal ribbon
```

They may share objects today, but they are not the same concept.

### Partition Should Share

```txt
SegmentViewportController
SegmentDocumentHandle
currentPage
scrollProgress
hover / preview interaction
scrollToPage
scrollToSegmentStart
```

### Partition Should Keep

```txt
createPartitionViewerModel
viewportSegments
legendSegments
ribbonRows
output/vote row semantics
horizontal PageRibbon layout
partition header layout
partition empty/loading states
```

## Split Mapping

Split can remain simple:

```ts
export type SplitViewerModel = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: DocumentSegment[]
}
```

Adapter:

```ts
function createSplitSegmentedDocumentModel(
  result: SplitView | null
): SegmentedDocumentModel {
  return {
    pages: pagesFromSegments(segments),
    segments: createSplitSegments(result),
  }
}
```

Composition remains split-specific:

```tsx
<SplitViewerProvider result={result}>
  <SplitViewerRoot>
    <SplitViewerHeader />
    <SplitViewerBody>
      <SplitViewerSidebar>
        <SegmentedPageRail />
      </SplitViewerSidebar>
      <SplitViewerSurface>
        <SegmentedLegend />
        <SplitViewerDocument>{document}</SplitViewerDocument>
      </SplitViewerSurface>
    </SplitViewerBody>
  </SplitViewerRoot>
</SplitViewerProvider>
```

The visual grammar stays split-owned. The mechanics are shared.

## Sources / OCR / Bbox Mapping

Sources and OCR should not invent a different evidence model.

They should produce:

```ts
segments: DocumentSegment[]
anchors: SegmentAnchor[]
```

Examples:

```txt
field path -> DocumentSegment
source bbox -> SegmentAnchor
OCR text block -> SegmentAnchor
provenance item -> SegmentAnchor
```

The overlay reads `anchors`.

The sidebar/list/legend reads `segments`.

Clicking a field or source item calls:

```ts
navigation.scrollToAnchor(anchor)
```

or:

```ts
navigation.scrollToSegmentStart(segment)
```

depending on the UI intent.

## Named Parts

The shared primitive should export small named parts, not one visual viewer.

Possible shared parts:

```tsx
<SegmentedLegend />
<SegmentedPageRail />
<SegmentedRibbon />
<SegmentedSidebar />
<SegmentedOverlay />
```

These parts should be optional consumers of the provider.

They must not know about:

```txt
split
partition
OCR
sources
schemas
workflow runs
files
email
file-system
```

Domain viewers compose them:

```tsx
function PartitionViewer({ result }) {
  const model = createPartitionSegmentedDocumentModel(result)

  return (
    <SegmentedDocumentProvider model={model}>
      <PartitionHeader />
      <ViewerBody>
        <ViewerSurface>
          <SegmentedRibbon />
          <PartitionDocument />
        </ViewerSurface>
      </ViewerBody>
    </SegmentedDocumentProvider>
  )
}
```

This is acceptable because layout remains visible and domain-owned.

## What Not To Build

Do not build:

```tsx
<SegmentedViewer
  mode="partition"
  showVotes
  showPageRail={false}
  overlayMode="bbox"
/>
```

Do not put these into the shared provider:

```txt
partition consensus
split output names
OCR text parsing
source schema paths
email attachments
file trees
workflow result status
```

Do not make every segment page-local.

Do not make every anchor a segment.

Do not require split or partition to rebuild semantic page groups from anchors.

## Migration Strategy

### Step 1: Prove Partition On Split Mechanics

Before building the full generic provider, migrate partition from:

```txt
scrollRequest.version
```

to:

```txt
setDocumentHandle
SegmentViewportController
viewportSegments
```

Target partition context:

```ts
type PartitionViewerContextValue = {
  isProcessing: boolean
  model: PartitionViewerModel
  viewport: SegmentViewportController
}
```

Target document hook:

```ts
function usePartitionViewerDocumentControls(): SegmentDocumentHandlers
```

Target PDF child:

```tsx
<PdfViewerPages
  ref={controls.setDocumentHandle}
  bare
  onVisiblePageChange={controls.onCurrentPageChange}
  onScrollProgressChange={controls.onScrollProgressChange}
/>
```

This removes the custom scroll replay protocol.

### Step 2: Extract Shared Names

Once split and partition both use the same controller, rename the underlying
types toward the document abstraction:

```txt
SegmentViewportController -> SegmentedDocumentViewport
SegmentDocumentHandle -> SegmentedDocumentHandle
Segment -> DocumentSegment
```

Do this only when it reduces confusion. Do not rename for aesthetics before the
behavior is proven.

### Step 3: Add Anchors

Introduce `SegmentAnchor` when migrating sources/OCR/bbox surfaces.

This should be driven by a real overlay/source use case, not speculative API
design.

### Step 4: Introduce `SegmentedDocumentProvider`

After split, partition, and one anchor-based viewer all use the same mental
model, introduce:

```tsx
<SegmentedDocumentProvider model={model}>{children}</SegmentedDocumentProvider>
```

At that point the provider is proven by three families:

```txt
page groups
partition rows
page-local anchors
```

## Success Criteria

The abstraction is correct when:

```txt
split adapter creates semantic document segments
partition adapter creates viewport segments, legend segments, and rows
sources/OCR adapters create semantic segments plus anchors
one shared engine owns current page, scroll progress, preview, and navigation
document renderers register handles instead of receiving replayed scroll events
shared parts do not contain domain flags
domain viewers remain named and visibly composed
```

The abstraction is wrong if:

```txt
split has to regroup page-local objects into sections
partition has to keep scrollRequest.version
SegmentedDocumentProvider accepts partition/split/OCR flags
shared parts import domain result types
domain viewers become wrappers around a hidden mega-viewer
```

## Testing Requirements

Model tests:

- split model creates semantic `DocumentSegment[]`.
- partition model creates `viewportSegments`, `legendSegments`, and
  `ribbonRows`.
- partition duplicate keys can merge in `legendSegments` without losing row
  detail.
- anchors link to existing segment ids.
- invalid anchors are rejected or ignored deterministically.

Controller tests:

- current page updates from document callbacks.
- scroll progress clamps to `0..1`.
- navigation ignores invalid pages.
- `scrollToSegmentStart` uses the first normalized segment page.
- `scrollToAnchor` calls the best available document handle method.
- result/model change resets current page, progress, and preview.

Composition tests:

- split easy API is visible named-part composition.
- partition easy API is visible named-part composition.
- partition uses `viewportSegments` for current-page ownership.
- ribbon rows render from `ribbonRows`, not from viewport state.
- overlay renders from `anchors`, not from semantic segments.

Architecture tests:

- shared provider imports no split, partition, OCR, source, file, email, or
  workflow result types.
- domain adapters import shared segment model types.
- domain viewers compose shared parts but keep domain headers and empty states.
- no `scrollRequest.version` remains in split or partition.

## Final Position

The platonic ideal is:

```txt
one small semantic document annotation model
one shared interaction/navigation engine
many explicit domain compositions
```

Not:

```txt
one hidden mega-viewer
```

And not:

```txt
many duplicated hover/scroll/navigation systems
```

The next implementation proof should be partition convergence:

```txt
PartitionViewerModel gains viewportSegments.
PartitionViewerProvider uses SegmentViewportController.
PartitionSourceDocument registers a document handle.
scrollRequest.version disappears.
```

Only after that should the system graduate from `SegmentViewportController` to a
formal `SegmentedDocumentProvider`.
