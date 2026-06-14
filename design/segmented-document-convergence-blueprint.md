# Segmented Document Convergence Blueprint

## Objective

Define the precise shared layer for split, partition, and future segmented
document viewers.

The target is not a generic visual viewer.

The target is a small shared document segmentation model plus one shared
viewport/navigation/interaction controller.

This blueprint intentionally excludes file-system. File-system owns a different
domain boundary and should not be pulled into this work.

## Verdict

The right convergence point is:

```txt
shared mechanics, not shared taste
```

Split, partition, OCR, and sources should be able to share:

- current page;
- scroll progress;
- preview/hover interaction;
- active/current segment resolution;
- document handle registration;
- page navigation;
- segment-start navigation;
- optional anchor/bounds navigation.

They should not be forced to share:

- layout;
- sidebar shape;
- header shape;
- legend placement;
- ribbon placement;
- empty states;
- domain result models;
- domain labels and semantics.

The mistake would be to create a blunt component like:

```tsx
<SegmentedViewer />
```

That would centralize taste. It would quickly grow props for split, partition,
OCR, sources, and every later document intelligence surface.

The stronger primitive is:

```tsx
<SegmentedDocumentProvider model={model}>
  {named domain composition}
</SegmentedDocumentProvider>
```

But even this provider should be introduced only if the model deserves to exist
across enough domains. Today, the immediate concrete step is narrower:

```txt
Partition should adopt the same SegmentViewportController contract that split
already uses.
```

## Core Distinction

The system needs two different concepts:

```txt
semantic segment
page-local anchor
```

They must not be collapsed.

### Semantic Segment

A semantic segment is the thing the user understands as one logical unit.

Examples:

- split section: `Appendix`;
- partition key: `Contract`;
- extraction field: `invoice_total`;
- OCR block group: `table_3`;
- source evidence item: `customer_name`.

For split and partition, this object naturally spans many pages:

```ts
type DocumentSegment = {
  id: string
  label: string
  pages: number[]
  color: string
  index: number
  confidence?: number | null
  sourceId?: string
}
```

This is close to the current `Segment` type and should remain the main model
for legends, rails, ribbons, and current-page ownership.

### Page-Local Anchor

A page-local anchor is where a semantic segment appears on a page.

Examples:

- OCR bounding box;
- extraction source bbox;
- field provenance region;
- table cell bbox;
- text span region.

```ts
type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}
```

Anchors are optional. Split and partition may not need them at all. OCR and
sources need them heavily.

The wrong model is:

```ts
type Segment = {
  id: string
  pageNumber: number
  bounds?: SegmentBounds
}
```

That is too region-centric. It would force split and partition to explode one
semantic segment into many page-local objects, then reassemble them for the
legend, rail, and ribbon.

The ideal model keeps semantic identity first and uses anchors only when the
domain has real page-local evidence.

## Target Shared Model

The eventual shared shape should be:

```ts
type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}

type SegmentedPage = {
  pageNumber: number
  width?: number
  height?: number
}

type DocumentSegment = {
  id: string
  label: string
  pages: number[]
  color: string
  index: number
  confidence?: number | null
  sourceId?: string
}

type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}

type SegmentRow = {
  id: string
  label?: string
  segments: DocumentSegment[]
}
```

This model is not a Retab API model.

It is a UI projection model:

```txt
domain result -> domain model factory -> segmented document projection
```

The domain result remains canonical. The segmented model is derived.

## Current Practical Shared Type

The current `Segment` type is already close to the semantic segment:

```ts
type Segment = {
  id: string
  label: string
  pages: number[]
  color: string
  index: number
  confidence?: number | null
}
```

Do not replace it with a page-local bbox type.

The near-term work should preserve `Segment` and sharpen how each viewer uses
different segment projections.

## Segment Projections

Not every `Segment[]` means the same thing.

The important correction for partition is to name projections by purpose.

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  viewportSegments: Segment[]
  legendSegments: Segment[]
  ribbonRows: PartitionRibbonRow[]
}
```

### `viewportSegments`

Behavior projection.

Used by the shared viewport controller to answer:

- which segment owns the current page?
- which segment should be highlighted when no preview is active?
- where should segment-start navigation go?

```ts
const viewport = useSegmentViewportController({
  segments: model.viewportSegments,
})
```

This should not be inferred from `legendSegments` by convention. It should be
explicit because behavior is not display.

### `legendSegments`

Legend projection.

Used by `SegmentLegend`.

For partition, this may group duplicate or whitespace-equivalent keys by display
label. It is a semantic user-facing summary.

### `ribbonRows`

Ribbon projection.

Used by `PageRibbon`.

For partition, this preserves output rows and vote rows:

```ts
type PartitionRibbonRow = RibbonRow & {
  kind: "output" | "vote"
  voteIndex?: number
}
```

The ribbon is display detail. It may include repeated rows, votes, and
occurrences that should not become the viewport's semantic truth.

## Shared Viewport Controller

The shared controller is the immediate convergence layer.

```ts
type SegmentViewportController = {
  model: SegmentViewportModel
  interaction: SegmentInteraction
  documentHandlers: SegmentDocumentHandlers
  navigation: SegmentNavigation
  rail: SegmentRailController
}
```

The important parts are:

```ts
type SegmentViewportModel = {
  currentPage: number | null
  currentSegmentId: string | null
  currentSegmentIds: readonly string[]
  previewSegmentId: string | null
  highlightedSegmentId: string | null
  highlightedSegmentIds: readonly string[]
  scrollProgress: number
}

type SegmentDocumentHandlers = {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  setDocumentHandle: (handle: SegmentDocumentHandle | null) => void
}

type SegmentNavigation = {
  scrollToPage: (page: number) => void
  scrollToSegmentStart: (segment: Segment) => void
}
```

This is the right layer to share between split and partition.

It owns behavior, not layout.

## Document Handle Contract

The document renderer registers an imperative handle with the controller:

```ts
type SegmentDocumentHandle = {
  getViewportElement?: () => HTMLElement | null
  scrollToPage: (page: number, options?: ScrollToOptions) => void
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

This kills event replay protocols like:

```ts
type ScrollRequest = {
  pageNumber: number
  version: number
}
```

`scrollRequest.version` is a smell. It means a provider emits an imperative
action as data and asks an outside component to replay it.

The better flow is:

```txt
document registers handle
viewer provider owns handle
viewer navigation calls handle.scrollToPage(...)
```

This is exactly the split direction and should become partition's direction.

## Split Target Shape

Split is already close.

The model can stay simple:

```ts
type SplitViewerModel = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: Segment[]
}
```

The provider shape is correct:

```ts
const model = createSplitViewerModel({ result, isProcessing })
const viewport = useSegmentViewportController({ segments: model.segments })
```

The composition should remain named:

```tsx
<SplitViewerProvider result={result}>
  <SplitViewerRoot>
    <SplitViewerHeader />
    <SplitViewerBody>
      <SplitViewerSidebar />
      <SplitViewerSurface>
        <SplitViewerLegend />
        <SplitViewerDocument>{document}</SplitViewerDocument>
      </SplitViewerSurface>
    </SplitViewerBody>
  </SplitViewerRoot>
</SplitViewerProvider>
```

Do not replace this with `<SegmentedViewer>`.

## Partition Target Shape

Partition should become structurally closer to split without losing its own
layout.

### Model

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  viewportSegments: Segment[]
  legendSegments: Segment[]
  ribbonRows: PartitionRibbonRow[]
}
```

`createPartitionViewerModel(result)` should produce all deterministic
projections.

The provider should not derive colors, rows, page counts, or key grouping
inline.

### Provider

```ts
type PartitionViewerContextValue = {
  model: PartitionViewerModel
  viewport: SegmentViewportController
  isProcessing: boolean
}
```

Provider:

```ts
function PartitionViewerProvider({ result, isProcessing, children }) {
  const model = React.useMemo(
    () => createPartitionViewerModel(result),
    [result]
  )
  const viewport = useSegmentViewportController({
    segments: model.viewportSegments,
  })

  return (
    <PartitionViewerContext.Provider
      value={{ model, viewport, isProcessing }}
    >
      {children}
    </PartitionViewerContext.Provider>
  )
}
```

The provider should no longer own:

```ts
currentPdfPage
scrollProgress
scrollRequest
requestPageScroll
```

Those belong to `SegmentViewportController`.

### Header

Partition keeps its own header layout:

```tsx
function PartitionViewerHeader() {
  const { model, viewport } = usePartitionViewer()

  return (
    <ViewerHeader>
      <SegmentLegend
        segments={model.legendSegments}
        currentPage={viewport.model.currentPage}
        interaction={viewport.interaction}
        onSelect={viewport.navigation.scrollToSegmentStart}
      />
      <PageRibbon
        orientation="horizontal"
        rows={model.ribbonRows}
        pageCount={model.pageCount}
        currentPage={viewport.model.currentPage}
        scrollProgress={viewport.model.scrollProgress}
        interaction={viewport.interaction}
        onSelectPage={viewport.navigation.scrollToPage}
      />
    </ViewerHeader>
  )
}
```

Important: this is not split's visual design. It only shares split's mechanics.

### Document Bridge

The PDF document should register with partition exactly like split:

```tsx
function PartitionViewerPdfDocument() {
  const controls = usePartitionViewerDocumentControls()

  return (
    <PdfViewerPages
      ref={controls.setDocumentHandle}
      bare
      onVisiblePageChange={controls.onCurrentPageChange}
      onScrollProgressChange={controls.onScrollProgressChange}
    />
  )
}
```

The hook should expose the shared document handlers:

```ts
function usePartitionViewerDocumentControls(): SegmentDocumentHandlers {
  return usePartitionViewer().viewport.documentHandlers
}
```

`usePartitionViewerDocument` should either disappear or become a narrow
read-only state hook with no scroll request protocol.

## OCR And Sources Target Shape

OCR and sources are related to segmented documents but need anchors.

They should not force split/partition to become bbox-first.

Their projection should look like:

```ts
type SourcesSegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors: SegmentAnchor[]
}
```

Examples:

```txt
SourceField -> DocumentSegment
Source bbox -> SegmentAnchor

LayoutItem group -> DocumentSegment
LayoutItem bbox  -> SegmentAnchor
```

For these viewers, shared mechanics should eventually include:

```ts
scrollToAnchor(anchorId)
scrollToSegmentAnchor(segmentId)
```

That should extend `SegmentViewportController` only when the need is concrete.
Until then, OCR/sources can continue using the anchored document layer.

The final shape may be:

```txt
SegmentedDocumentProvider
  owns segment state, page state, segment navigation

AnchoredDocumentProvider
  owns anchor activation, selection, bbox scrolling
```

or those may converge if their state machines prove identical.

Do not collapse them prematurely.

## Naming

Prefer `SegmentedDocument`, not `SegmentedViewer`.

Reason:

```txt
segmented document = semantic model + navigation state
viewer = one visual composition using that state
```

Good names:

```txt
SegmentedDocumentModel
DocumentSegment
SegmentAnchor
SegmentRow
SegmentViewportController
SegmentDocumentHandle
```

Avoid:

```txt
SegmentedViewer
GenericSegmentViewer
UniversalDocumentViewer
SmartDocumentViewer
```

Those names imply visual ownership and invite over-abstraction.

## Non-Goals

Do not create a generic visual component that owns all segmented layouts.

Do not make every segment page-local.

Do not make OCR/sources canonical data match split/partition data.

Do not add compatibility wrappers.

Do not preserve `scrollRequest.version`.

Do not touch file-system as part of this convergence.

Do not encode partition concepts in the shared controller:

```txt
vote
consensus
output row
partition key
likelihood
```

Do not encode split concepts in the shared controller:

```txt
subdocument
split candidate
appendix
```

The controller knows only pages, segments, interaction, and document handles.

## Implementation Plan

### 1. Add `viewportSegments` To Partition Model

Current:

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  legendSegments: Segment[]
  pageCount: number
  ribbonRows: PartitionRibbonRow[]
}
```

Target:

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  viewportSegments: Segment[]
  legendSegments: Segment[]
  ribbonRows: PartitionRibbonRow[]
}
```

Initial value can match `legendSegments` if that is the desired current
behavior.

The important part is the name and the boundary.

### 2. Move Partition To `useSegmentViewportController`

Replace custom provider state with:

```ts
const viewport = useSegmentViewportController({
  segments: model.viewportSegments,
})
```

Context should expose:

```ts
model
viewport
isProcessing
```

### 3. Replace Partition Document Hook

Replace:

```ts
usePartitionViewerDocument()
```

with:

```ts
usePartitionViewerDocumentControls()
```

returning:

```ts
viewport.documentHandlers
```

If a read hook remains, it should expose state, not an imperative replay event.

### 4. Update Partition Block And Demo

The PDF child should register:

```tsx
ref={controls.setDocumentHandle}
```

and report:

```tsx
onVisiblePageChange={controls.onCurrentPageChange}
onScrollProgressChange={controls.onScrollProgressChange}
```

No `useEffect` should watch `scrollRequest`.

### 5. Preserve Partition Visual Composition

Keep:

- `PartitionViewerHeader`;
- horizontal `PageRibbon`;
- `SegmentLegend`;
- partition empty state;
- partition loading state;
- output/vote ribbon semantics.

This pass is not a redesign of partition UI.

### 6. Keep Split Stable

Split should not become more generic to satisfy partition.

Only extract additional shared behavior if both split and partition need the
same exact operation.

### 7. Delay `SegmentedDocumentProvider`

Do not introduce the full provider until its API is forced by real duplicated
code.

The immediate shared primitive is already:

```ts
useSegmentViewportController
```

The eventual provider can be a thin context wrapper over that controller if the
named parts need it.

## Tests

### Partition Model Tests

Add or preserve tests proving:

- `viewportSegments` exists;
- `legendSegments` groups display-equivalent keys;
- `ribbonRows` preserves output and vote occurrences;
- `pageCount` includes vote pages when needed;
- repeated partition labels share semantic ids intentionally;
- invalid pages are removed;
- page lists are sorted and deduplicated.

### Partition Controller Tests

Add tests proving:

- partition provider uses shared viewport state;
- `usePartitionViewerDocumentControls` exposes `setDocumentHandle`;
- selecting a legend segment calls document handle `scrollToPage`;
- selecting a ribbon page calls document handle `scrollToPage`;
- `onCurrentPageChange` updates header current state;
- `onScrollProgressChange` updates ribbon cursor;
- no partition source contains `scrollRequest`.

### Architecture Tests

Add static architecture expectations:

- partition imports `useSegmentViewportController`;
- partition context contains `viewport: SegmentViewportController`;
- partition model exports `viewportSegments`;
- partition viewer no longer declares `PartitionDocumentScrollRequest`;
- partition block does not use a `scrollRequest` effect.

### Regression Tests

Keep visual/user behavior stable:

- legend still displays grouped partition labels;
- ribbon still displays output/vote rows;
- current page still highlights the correct semantic segment;
- hover still coordinates legend and ribbon;
- empty state still appears without output;
- loading state still appears while processing.

## Completion Criteria

This convergence is done when:

- split and partition both use `useSegmentViewportController`;
- partition has explicit `viewportSegments`, `legendSegments`, and
  `ribbonRows`;
- partition has no custom page/scroll request state;
- partition document children register a document handle;
- split and partition still render different layouts;
- no generic `<SegmentedViewer>` exists;
- no file-system code is touched;
- tests verify both the pure model and the shared controller path.

At that point, split and partition will share mechanics without sharing taste.

That is the correct foundation for future OCR/sources/bbox convergence.
