# Split Viewer Remaining Perfection Blueprint

## Objective

Describe the last real gaps between `SplitViewer` and the platonic ideal, and
separate the gaps that are now closed from the decisions that still matter.

This document started as a precision plan for the implementation pass. It now
also records what the pass proved.

`SplitViewer` is already close. Its core shape is correct:

```txt
SplitView
  -> Segment[]
  -> SegmentViewportController
  -> ViewerRoot composition
```

The work is not a rewrite. It is naming, boundary sharpening, registry
correctness, and extracting only the segment pieces that are genuinely generic.

## Implementation Status

Closed in the first pass:

- `SplitViewerContextValue` now has the exact two-part shape:
  `model: SplitViewerModel` and `viewport: SegmentViewportController`.
- Exported split state types use `Segment[]`, not
  `ReturnType<typeof toSegments>`.
- Split model derivation is pure and testable through
  `createSplitViewerModel`.
- The empty/loading branch is named as `SplitViewerEmptyState`.
- `SegmentPageRail` moved out of the split directory into the shared segment UI
  layer.
- `useSegmentViewportController` no longer imports `PdfViewerHandle`; it accepts
  a structural `SegmentDocumentHandle`.
- Split call sites now use `setDocumentHandle`, which describes the contract
  instead of the current PDF implementation.
- The registry now has a first-class `segment-page-rail` item, and the split
  block ships its local viewport controller file.

Still separating split from perfection:

- Nothing split-specific remains in this blueprint. The only observed verification
  blockers are unrelated `data-cell` errors outside the split surface.

Closed in the second pass:

- Public part policy is now full named-part composition:
  `SplitViewerRoot`, `SplitViewerBody`, `SplitViewerSidebar`,
  `SplitViewerSurface`, `SplitViewerPageRail`, `SplitViewerLegend`, and
  `SplitViewerDocument`.
- `SplitViewer` is a pure easy API assembled from those named parts.
- Docs now teach the document child contract directly:
  `useSplitViewerDocumentControls` connects the child document to split
  navigation.
- Partition convergence is a boundary decision: share segment model/controller
  concepts only; do not introduce a visual `SegmentedViewer` mega-component.
- Browser verification of `/blocks#split-viewer` confirmed the split block
  renders root/header/body/sidebar/surface, rail, legend, and PDF canvases;
  rail navigation updates the current segment; the sidebar trigger collapses and
  expands the rail.

## Current Strengths

Preserve these.

### Split Uses The Right Core Model

The best part of the current design is that split does not invent a private
rendering model. It normalizes API data into the shared `Segment[]` model:

```ts
const segments = toSegments(result?.output ?? [])
```

That is the right abstraction.

`Segment` is the semantic bridge between:

```txt
split output
partition output
legend entries
page rail
ribbon rows
hover / preview interaction
document navigation
```

This is the right compression point. Do not replace it with a split-specific
shape.

### Split Has The Right Controller Boundary

`useSegmentViewportController` is the best thing in the current segment viewer
family.

It owns:

```txt
current page
scroll progress
document handle registration
scroll-to-page
scroll-to-segment-start
segment hover / preview interaction
rail follow behavior
rail DOM registration
```

This is much cleaner than putting scroll state directly into the viewer provider.

### Split Composes Viewer Primitives Correctly

Current composition is conceptually right:

```tsx
<SplitViewerProvider>
  <ViewerRoot>
    <SplitViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerPageRail />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerLegend />
        <SplitViewerDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

The viewer primitive is used for spatial state. Split owns only split semantics.
That is the right separation.

## Gap 1: The Context Shape Is Not Perfectly Named

### Current Shape

The context currently stores these values side by side:

```ts
type SplitViewerContextValue = {
  controller: ReturnType<typeof useSegmentViewportController>
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: ReturnType<typeof toSegments>
}
```

This works, but the shape is not conceptually exact.

There are two different things mixed together:

```txt
derived split model
interactive viewport controller
```

### Why This Matters

When the shape is flat, downstream hooks have to remember which values are
derived model facts and which values are interactive controller facts.

That makes the API feel slightly accidental:

```ts
const { controller, hasOutput, pageCount, segments } = useSplitViewer()
```

The reader has to infer the boundary.

### Platonic Target

Make the boundary explicit:

```ts
type SplitViewerContextValue = {
  model: SplitViewerModel
  viewport: SegmentViewportController
}

type SplitViewerModel = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: Segment[]
}
```

The read becomes self-documenting:

```ts
const { model, viewport } = useSplitViewer()
```

Then part hooks expose only what each part needs:

```ts
useSplitViewerHeader() -> SplitViewerHeaderState
useSplitViewerPageRail() -> SplitViewerPageRailState
useSplitViewerLegend() -> SplitViewerLegendState
useSplitViewerDocument() -> SplitViewerDocumentState
useSplitViewerDocumentControls() -> SplitDocumentHandlers
```

### Success Criteria

No component consumes a shapeless blend of model and controller fields.

The split context vocabulary is:

```txt
model
viewport
```

not:

```txt
controller + loose model fields
```

## Gap 2: `ReturnType<typeof toSegments>` Is Leaky

### Current Shape

Several types use:

```ts
segments: ReturnType<typeof toSegments>
```

This is technically correct, but aesthetically weak.

### Why This Matters

The concept is not “whatever `toSegments` returns.” The concept is `Segment[]`.

Using `ReturnType` here couples the public viewer state to one implementation
function. It also makes the type harder to read.

### Platonic Target

Use the direct domain name:

```ts
import type { Segment } from "@/lib/segments"

type SplitViewerModel = {
  segments: Segment[]
}
```

`toSegments` remains an implementation detail inside the provider/model
factory.

### Success Criteria

No exported split viewer state type includes:

```ts
ReturnType<typeof toSegments>
```

All exported state types say:

```ts
Segment[]
```

## Gap 3: Split Model Derivation Deserves A Function

### Current Shape

`SplitViewerProvider` derives the model inline:

```ts
const hasOutput = !!result && result.output.length > 0
const segments = React.useMemo(() => toSegments(result?.output ?? []), ...)
const pageCount = React.useMemo(() => segmentsPageCount(segments), ...)
```

This is simple enough today. But it is still provider logic.

### Why This Matters

Provider code should read as state wiring, not model construction.

The split viewer model is a reusable pure transformation:

```txt
SplitView + isProcessing -> SplitViewerModel
```

It can be tested without React. It can be shared conceptually with partition. It
can become the first piece of a future `SegmentedViewerModel`.

### Platonic Target

Introduce a pure model constructor:

```ts
export type SplitViewerModel = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: Segment[]
}

export function createSplitViewerModel({
  result,
  isProcessing,
}: {
  result: SplitView | null
  isProcessing: boolean
}): SplitViewerModel {
  const segments = toSegments(result?.output ?? [])

  return {
    hasOutput: Boolean(result && result.output.length > 0),
    isProcessing,
    pageCount: segmentsPageCount(segments),
    segments,
  }
}
```

Then provider reads:

```ts
const model = React.useMemo(
  () => createSplitViewerModel({ result, isProcessing }),
  [result, isProcessing]
)
const viewport = useSegmentViewportController({ segments: model.segments })
```

### Success Criteria

`SplitViewerProvider` becomes a small composition of:

```txt
create model
create viewport controller
publish context
```

No model derivation is hidden inside JSX-facing components.

## Gap 4: The Shared Segment Viewer Layer Is Still Implicit

### Current Reality

Split and partition are the same family:

```txt
source document + page-owned segments + navigation surfaces
```

But split and partition do not yet share the same controller/model layer.

Split has:

```txt
Segment[]
SegmentViewportController
SegmentPageRail
SegmentLegend
```

Partition has:

```txt
PartitionResult
Segment[]
PageRibbon rows
SegmentLegend
document scroll request state
```

The overlap is obvious, but the abstraction does not exist yet.

### Why This Matters

If split and partition continue to diverge, every improvement will be duplicated:

```txt
current page synchronization
hover interaction
scroll request semantics
page count normalization
segment selection
empty/loading states
legend behavior
test coverage
```

Split is currently the better design. Partition should move toward it.

### Platonic Target

Create a shared segment-viewer model/controller layer, not a visual mega
component.

The shared layer should be data and behavior:

```ts
type SegmentViewerModel = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: Segment[]
}

type SegmentViewerViewport = SegmentViewportController
```

Split remains a domain adapter:

```txt
SplitView -> SegmentViewerModel
```

Partition becomes a domain adapter:

```txt
PartitionResult -> PartitionViewerModel
PartitionViewerModel includes SegmentViewerModel + ribbon rows
```

Do not create a giant `<SegmentedViewer>` that owns every layout. The layouts are
different enough that the JSX should stay explicit.

### Success Criteria

Shared:

```txt
segment model types
viewport controller
document controls
interaction state
page navigation
```

Domain-specific:

```txt
split header copy
split vertical page rail
partition waterfall rows
partition keyed chunk language
empty state copy
```

## Gap 5: Public Parts Policy

### Former Shape

Split previously exported some split parts:

```ts
SplitViewerHeader
SplitViewerPageRail
SplitViewerLegend
SplitViewerDocument
useSplitViewerDocumentControls
```

Some parts are private:

```ts
SplitViewerBody
SplitViewerSidebar
```

This was not wrong, but it was not intentional enough.

### Why This Matters

The component library needs a consistent answer:

```txt
Is SplitViewer a high-level block with a few extension hooks?
Or is it a shadcn-style family of named composable parts?
```

Right now it sits in the middle.

### Platonic Target

Export a full named-part family:

```ts
SplitViewerProvider
SplitViewerRoot
SplitViewerHeader
SplitViewerBody
SplitViewerSidebar
SplitViewerPageRail
SplitViewerSurface
SplitViewerLegend
SplitViewerDocument
```

Then the easy API becomes a pure composition of those parts.

### Decision

Split is part of a component library, and the surrounding viewer work has
settled on shadcn-style named parts. The easy API remains, but it is a visible
composition of public parts, not a private special case.

The exact public family is:

```ts
SplitViewerProvider
SplitViewerRoot
SplitViewerHeader
SplitViewerBody
SplitViewerSidebar
SplitViewerPageRail
SplitViewerSurface
SplitViewerLegend
SplitViewerDocument
SplitViewer
```

### Success Criteria

No accidental exports.

Every exported part has a reason.

Every private part is private by design, not because it was forgotten.

## Gap 6: `children` Is Powerful But Under-Named

### Current Shape

`SplitViewer` accepts:

```ts
children?: ReactNode
```

The child is the document surface.

### Why This Matters

`children` works, but it hides the contract. The child is not arbitrary. It is
expected to be a document viewer that calls:

```ts
useSplitViewerDocumentControls()
```

or otherwise connects current page and scroll progress.

### Platonic Target

Keep `children` if we value JSX ergonomics, but document and type the contract
clearly:

```txt
children is the document surface.
The document surface should use useSplitViewerDocumentControls().
```

Alternative if the API wants more explicitness:

```ts
document: ReactNode
```

But this is less React-native than children.

### Recommendation

Keep `children`.

Rename only in internal state and docs:

```txt
document child
document surface
document controls
```

Do not introduce a render prop unless there is a concrete need.

### Success Criteria

Docs show:

```tsx
<SplitViewer result={result}>
  <PdfViewerProvider source={source}>
    <PdfViewerPages {...useSplitViewerDocumentControls()} />
  </PdfViewerProvider>
</SplitViewer>
```

No one has to infer what `children` is for.

## Gap 7: Empty State Is Split-Specific UI Inside Core Composition

### Current Shape

`SplitViewerDocument` renders empty and processing states inline.

This is acceptable, but not perfect.

### Why This Matters

The document part has two jobs:

```txt
render the connected document child when output exists
render the split empty/loading state when output does not exist
```

That is not egregious, but the empty state copy and icon are domain chrome.

### Platonic Target

Keep the domain empty state in split, but make the boundary explicit:

```ts
SplitViewerEmptyState
SplitViewerDocument
```

`SplitViewerDocument` becomes:

```tsx
if (!model.hasOutput) return <SplitViewerEmptyState />
return document child or no-document placeholder
```

### Success Criteria

The empty/loading branch has a named component.

Tests can target:

```txt
processing state
idle empty state
output with missing document child
output with document child
```

## Gap 8: Segment Rail Is Slightly Split-Specific By Location

### Current Shape

The vertical rail component lives under:

```txt
components/viewers/split/segment-page-rail.tsx
```

But it accepts generic segment props and uses `PageRibbon`.

### Why This Matters

`SegmentPageRail` is not inherently split-specific. It is a segment surface.

It could be useful for partition, extraction, OCR, or any future page-segmented
document workflow.

### Platonic Target

Move generic segment surfaces together:

```txt
registry/new-york-v4/ui/segment-page-rail.tsx
registry/new-york-v4/ui/segment-legend.tsx
registry/new-york-v4/ui/segment-sidebar.tsx
registry/new-york-v4/ui/page-ribbon.tsx
```

Split imports it from the shared UI layer.

### Success Criteria

No generic segment surface lives under `components/viewers/split`.

The split directory owns only split adapter code.

## Gap 9: The Viewport Controller Depends On `PdfViewerHandle`

### Current Shape

`useSegmentViewportController` stores:

```ts
PdfViewerHandle | null
```

and calls:

```ts
viewerHandle?.scrollToPage(page)
```

### Why This Matters

The controller is otherwise generic over page-segmented documents. The only PDF
specific thing is the handle type.

The behavior it needs is smaller:

```ts
type PageScrollHandle = {
  scrollToPage: (page: number) => void
}
```

### Platonic Target

Replace the PDF-specific handle dependency with a structural type:

```ts
export type SegmentDocumentHandle = {
  scrollToPage: (page: number) => void
}
```

Then:

```ts
setDocumentHandle: (handle: SegmentDocumentHandle | null) => void
```

Split can still pass a `PdfViewerHandle` because it satisfies the shape.

### Success Criteria

`useSegmentViewportController` does not import from `pdf-viewer`.

It becomes useful for non-PDF page viewers.

## Gap 10: Naming Should Converge On `viewport`, Not `controller`

### Current Shape

The main object is called:

```ts
controller
```

Its type is:

```ts
SegmentViewportController
```

### Why This Matters

`controller` is vague. The meaningful concept is viewport synchronization:

```txt
document viewport
rail viewport
current page
scroll progress
navigation
```

### Platonic Target

Inside split:

```ts
const viewport = useSegmentViewportController(...)
```

And state types use:

```ts
viewport: SegmentViewportController
```

This small rename pays off because partition can also own a `viewport`.

### Success Criteria

The same concept has the same name everywhere:

```txt
viewport
documentControls
segments
model
```

Avoid mixing:

```txt
controller
railApi
documentHandlers
```

unless those are intentionally distinct sub-objects.

## Final Target Shape

The ideal split viewer shape:

```ts
type SplitViewerModel = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: Segment[]
}

type SplitViewerContextValue = {
  model: SplitViewerModel
  viewport: SegmentViewportController
}
```

Provider:

```tsx
function SplitViewerProvider({ result, isProcessing, children }) {
  const model = useMemo(
    () => createSplitViewerModel({ result, isProcessing }),
    [result, isProcessing]
  )
  const viewport = useSegmentViewportController({ segments: model.segments })

  return (
    <SplitViewerContext.Provider value={{ model, viewport }}>
      {children}
    </SplitViewerContext.Provider>
  )
}
```

Easy API:

```tsx
function SplitViewer({ result, isProcessing, children }) {
  return (
    <SplitViewerProvider result={result} isProcessing={isProcessing}>
      <ViewerRoot bare defaultSidebarOpen>
        <SplitViewerHeader />
        <SplitViewerBody>{children}</SplitViewerBody>
      </ViewerRoot>
    </SplitViewerProvider>
  )
}
```

Document connection:

```tsx
function SplitViewerPdfDocument() {
  const controls = useSplitViewerDocumentControls()

  return (
    <PdfViewerProvider source={source}>
      <PdfViewerPages
        ref={controls.setDocumentHandle}
        bare
        onVisiblePageChange={controls.onCurrentPageChange}
        onScrollProgressChange={controls.onScrollProgressChange}
      />
    </PdfViewerProvider>
  )
}
```

## What Not To Do

Do not build a giant `SegmentedViewer` component that hides layout decisions.

Do not make split depend on partition concepts.

Do not put viewer primitive state into split.

Do not invent a new segment shape.

Do not make `SplitViewer` own file rendering. The document child remains the
extension point.

Do not touch file-system code while doing this work.

## Remaining Implementation Order

No split-specific implementation work remains in this blueprint.

Keep the model, controller, registry, and browser checks as the regression net
for future edits.

## Test Plan

### Pure Model Tests

Verify:

```txt
null result -> no output, zero pages, empty segments
empty output -> no output, zero pages, empty segments
valid output -> normalized Segment[] and max page count
invalid pages -> filtered by toSegments
processing flag is preserved independently from output
```

### Controller Tests

Verify:

```txt
current page updates from document callback
scroll progress clamps to 0..1
scrollToPage ignores invalid pages
scrollToSegmentStart chooses first normalized page
segment interaction clears preview before navigation
result change resets current page, progress, and preview
```

### Composition Tests

Verify:

```txt
SplitViewer renders ViewerRoot
SplitViewer renders ViewerSidebar only when output has pages
SplitViewerHeader trigger appears only when the sidebar exists
SplitViewerLegend receives shared interaction state
SplitViewerPageRail receives shared viewport state
document child receives controls through useSplitViewerDocumentControls
```

### Browser Tests

Verify:

```txt
clicking legend segment scrolls document to first page
clicking rail page scrolls document to that page
current document page updates rail and legend highlighting
rail follows current page unless user is interacting with rail
sidebar trigger collapses and expands the rail
```

## Definition Of Done

Split reaches the platonic version when:

```txt
The API data shape is separate from the viewer model.
The viewer model is pure and testable.
The viewport controller is generic over page documents.
The split provider only wires model + viewport.
The split JSX is visible, direct, and composed from primitives.
The segment surfaces are shared and not split-owned unless truly split-specific.
All exported names are intentional.
The same concept has the same name everywhere.
```
