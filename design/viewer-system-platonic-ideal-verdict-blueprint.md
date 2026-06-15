# Viewer System Platonic Ideal Verdict Blueprint

## Purpose

This blueprint is the current verdict on the viewer system.

The standard is intentionally severe:

```txt
Simplicity
Speed
Everything needed
Nothing more
Perfect modularization
High-entropy code
Perfectly consistent variable names
Flaubertian precision
shadcn-grade taste
```

The question is not whether the viewer system is good.

The question is whether the system has become inevitable.

## Verdict

No.

The viewer system has reached a good architecture.

It has not reached the platonic ideal.

The remaining work is not a new abstraction. The remaining work is subtraction,
proof, and exactness.

The correct direction is now clear:

```txt
ViewerRoot owns spatial layout and sidebar state.
FileViewer renders a file.
Domain viewers compose ViewerRoot, FileViewer, PDF, and segmented document parts.
Domain providers own real domain state.
SegmentedDocumentProvider owns document annotation navigation.
Public hooks expose only external composition seams.
Internal contexts stay private.
```

The provider pattern is not a dead end.

Provider sprawl is a dead end.

The difference is simple:

```txt
good provider = one real state machine
bad provider = ceremony around props
```

## Non-Goals

Do not touch the file-system implementation.

Do not add:

- a generic `SegmentedViewer`;
- a generic `DocumentWorkflowViewer`;
- another `FileViewer` layer;
- compatibility wrappers;
- slot-object APIs;
- render-prop anatomy;
- public aggregate viewer-state hooks;
- domain props on shared primitives;
- symmetric APIs with no consumer evidence.

Do not chase historical blueprints.

Source, tests, public docs, registry output, and
[`viewer-system-design-index.md`](./viewer-system-design-index.md) are the
authority.

## The Ideal Grammar

The only shared spatial grammar should remain:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

That is the shadcn-grade primitive.

It is not a file viewer.

It is not a document viewer.

It is not an email viewer.

It is the spatial shell plus sidebar state.

The sidebar trigger belongs to this primitive:

```tsx
<ViewerSidebarTrigger />
```

It should work anywhere under the matching `ViewerRoot`, exactly because
`ViewerRoot` owns sidebar state.

## The Correct Component Boundaries

### ViewerRoot

Owns:

```txt
layout
sidebar open state
sidebar registration
inline or overlay mode
focus return
escape close
outside click close
trigger state
```

Does not own:

```txt
files
PDF pages
email MIME parts
edit fields
partition votes
split results
OCR text
source bboxes
file-system trees
```

### FileViewer

Owns:

```txt
source dispatch
leaf viewer selection
common file chrome
fallbacks for unsupported file types
```

Does not own:

```txt
sidebar layout
file-system navigation
email attachment state
split state
partition state
workflow state
```

`ViewerRoot` and `FileViewer` both deserve to exist.

They are different levels:

```txt
ViewerRoot = spatial primitive
FileViewer = file rendering primitive
```

Folding them together would make simple file rendering carry layout state, and
would make layout composition carry file dispatch. That is not simpler. It is
blurrier.

### PdfViewer

Owns:

```txt
PDF resource
PDF page rendering
PDF page handle
PDF toolbar state
PDF thumbnails
PDF scroll and zoom behavior
```

Does not own:

```txt
generic viewer sidebar semantics
domain workflow state
external document annotation state
```

The public shape should stay anatomy-first:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

The easy API may remain:

```tsx
<PdfViewer source={source} />
```

But it is a convenience assembly, not the conceptual center.

### SegmentedDocumentProvider

Owns:

```txt
semantic document segments
page-local anchors
current page
scroll progress
hover and preview interaction
document handle registration
scrollToPage
scrollToSegmentStart
scrollToAnchor
rail follow behavior
```

Does not own:

```txt
partition output semantics
partition votes
split jobs
OCR text
source payloads
schemas
emails
files
workflows
```

The model boundary is correct:

```ts
type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}
```

The key distinction must stay intact:

```txt
DocumentSegment = semantic document section
SegmentAnchor = page-local target
```

If a bbox viewer makes every box a semantic segment, the abstraction failed.

If split has to regroup page-local anchors into semantic sections, the
abstraction failed.

## What Is Already Right

### ViewerRoot Is The Right Primitive

The primitive is expressive without becoming a domain system.

The current vocabulary is the right one:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
useViewerSidebar
useOptionalViewerSidebar
```

This list should be treated as nearly frozen.

Any new primitive must remove more concepts than it adds.

### Split And Partition Converge At The Behavior Layer

Split and partition should not share taste.

They should share mechanics:

```txt
currentPage
scrollProgress
interaction
documentHandlers
navigation
rail
```

The convergence point is correctly named:

```txt
SegmentedDocumentProvider
useSegmentedDocumentViewport
```

Not:

```txt
SegmentedViewer
```

The current direction is right because split and partition remain named domain
viewers, while the hard interaction machinery is shared.

### Partition Has The Right Three Projections

Partition should keep these separate:

```txt
viewportSegments
legendSegments
ribbonRows
```

They are not accidental duplication.

They answer different questions:

```txt
viewportSegments = what owns the current page and navigation
legendSegments = what the user selects semantically
ribbonRows = what the ribbon displays
```

Collapsing them into one `segments` prop would make the code shorter and less
true.

### Public Broad Hooks Are Gone From The Important Surfaces

The right public hook rule is:

```txt
Expose intent hooks, not context dumps.
```

Good:

```ts
usePdfViewerThumbnails()
useSplitViewerDocumentControls()
usePartitionViewerDocumentControls()
```

Bad:

```ts
usePdfViewer()
useSplitViewer()
usePartitionViewer()
useEditViewer()
```

The current tests correctly defend that boundary.

## What Is Still Not Perfect

### 1. PDF Still Has Visible Internal Coordination Machinery

Current PDF composition is good.

The internal coordination is still not perfectly obvious:

```txt
PdfViewerProvider owns resource, current page, viewport controls, and handle.
PdfViewerPages renders PdfResourceContent.
PdfResourceContent computes viewport controls.
PdfResourceContent registers those controls through same-folder context.
PdfViewerHeader consumes the registered controls.
PdfViewerThumbnails consumes the viewer handle.
```

This is acceptable React.

It is not yet inevitable.

The danger is not public API bloat. The public API is clean enough.

The danger is that a reader sees two internal state mechanisms:

```txt
PdfViewerContext
PdfDocumentViewportRegistrationProvider
```

The perfect PDF system would either:

1. make this registration layer feel obviously first-party and private; or
2. remove it by replacing both concepts with one smaller document viewport
   handle.

Do not replace it unless the replacement reduces named concepts.

Bad replacement:

```txt
PdfViewerHandle
PdfDocumentViewportHandle
PdfToolbarHandle
```

Good replacement, if proven:

```txt
one document viewport handle
one provider context
no transport props
same detached header behavior
same thumbnail behavior
same imperative scroll behavior
```

Until then, the registration layer should stay private, guarded, and
documented as an implementation decision.

### 2. PDF Internals Are Smaller But Still Wide

`pdf-viewer-content.tsx` now has useful internal names:

```txt
usePdfDocumentResourceLifecycle
usePdfFirstPageSize
usePdfDocumentRotation
usePdfDocumentViewportControls
PdfDocumentPagesLayer
```

That is better.

The center still spans many concerns:

```txt
resource lifecycle
first page measurement
scale
rotation
page size cache
layout
scroll
viewport registration
virtualization
imperative handle
toolbar fallback
page rendering
```

The next improvement should not be more files by reflex.

The next improvement should be a reader test:

```txt
Can PdfViewerInner be understood top-to-bottom without holding implementation
details of page rendering, resource lifecycle, and toolbar registration in
working memory?
```

If not, extract one more private unit.

If yes, stop.

### 3. Split And Partition Still Repeat Local Context Slices

Current split:

```txt
useSplitViewerHeader
useSplitViewerSidebar
useSplitViewerPageRail
useSplitViewerLegend
useSplitViewerDocument
```

Current partition:

```txt
usePartitionViewerHeader
usePartitionViewerRibbon
usePartitionViewerDocument
usePartitionViewerEmpty
```

This is not automatically bad.

The names are domain-specific and readable.

The risk is that every future domain viewer copies the same miniature context
grammar and creates boilerplate by tradition.

Do not create a generic hook just to remove repetition.

The acceptable rule is:

```txt
Duplicate small named selectors until the duplication obscures the domain.
Extract only when the extraction has a better name than the duplicated code.
```

For now, split and partition should stay explicit.

The architecture test should defend against a generic visual segmented viewer,
not against all local repetition.

### 4. Segmented Document Is Proven For Split And Partition, Not Fully For OCR

The model is conceptually right for sources and OCR:

```txt
semantic field or source -> DocumentSegment
page-local bbox -> SegmentAnchor
```

But the proof is still mostly architectural.

The system becomes closer to ideal when a real OCR/source viewer can be
implemented as:

```ts
const model = createSourcesSegmentedDocumentModel(result)
```

Then rendered with:

```tsx
<SegmentedDocumentProvider model={model}>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSidebar>{/* source list */}</ViewerSidebar>
      <ViewerSurface>{/* document with anchors */}</ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SegmentedDocumentProvider>
```

The provider must not learn `ocrMode`, `sourceMode`, `schema`, `field`, or
`confidence`.

Those belong in adapters and domain parts.

### 5. ViewerRoot Is Powerful Enough, So It Must Be Kept Small

`ViewerRoot` is doing real work:

```txt
controlled and uncontrolled sidebar state
auto inline or overlay mode
sidebar registration
single primary sidebar invariant
focus return
escape close
outside click close
trigger scoping
CSS variable width
```

That is the correct amount of behavior for the primitive.

It is also close to the maximum.

The next `ViewerRoot` feature needs exceptional proof.

Reject by default:

```txt
purpose props
role props
kind props
panel aliases
slot maps
domain data attributes
secondary sidebars
global sidebar stores
```

Nested viewers are the answer for nested complete viewers.

Secondary content inside `ViewerSurface` is the answer for local panels.

### 6. Architecture Tests Are Guardrails, Not Beauty

The architecture test suite is valuable because this system has gone through
many shapes.

It is also heavier than a perfect system should need.

The right direction is:

```txt
less text-search archaeology
more public export contracts
more import-boundary checks
more small behavior tests
```

Historical name assertions should expire once the old names stop being likely
regressions.

The test should read like an API constitution, not like a museum label.

### 7. The Design Directory Needs A Stronger Authority Chain

There are many viewer blueprints.

That is useful history and dangerous current guidance.

The design index is the right solution, but it must stay current.

Every new viewer-system blueprint must do one of two things:

```txt
add itself to the current authority list
or explicitly mark itself historical
```

Otherwise the design folder becomes entropy.

## The Final Cut Plan

### Cut 1: Freeze Public Viewer Vocabulary

Do not add public viewer primitives.

Lock the grammar to:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
useViewerSidebar
useOptionalViewerSidebar
```

Acceptance:

- no `ViewerShell`;
- no `ViewerPanel`;
- no `ViewerMain`;
- no `ViewerAside`;
- no slot object API;
- no domain props on `ViewerRoot`.

### Cut 2: Keep PDF Registration Or Kill It Completely

No half-step.

Either keep:

```txt
PdfDocumentViewportRegistrationProvider
```

as private same-folder machinery, or replace it with a single strictly smaller
PDF document viewport concept.

Acceptance:

- no public setter prop returns;
- detached header still updates on zoom and rotation;
- thumbnails still select and follow pages;
- `FileViewer` PDF rendering still works;
- `PdfViewerProvider` and `PdfViewerPages` stay understandable.

### Cut 3: Keep Split And Partition Explicit

Do not add a generic segmented viewer.

Do not add an abstract domain segmented hook unless it has a precise name and
removes more code than it hides.

Acceptance:

- split keeps split vocabulary;
- partition keeps partition vocabulary;
- both use `SegmentedDocumentProvider`;
- both expose only document-control hooks publicly;
- no generic visual segmented component appears.

### Cut 4: Prove Sources And OCR Through Adapters

The proof should be an adapter and a test, not a new primitive.

Target:

```txt
createSourcesSegmentedDocumentModel
createOcrSegmentedDocumentModel
```

Acceptance:

- semantic evidence becomes `DocumentSegment`;
- page-local boxes become `SegmentAnchor`;
- provider stays domain-blind;
- no source or OCR mode prop enters shared segmented code.

### Cut 5: Reduce Architecture Tests To Contracts

Keep the protection.

Remove historical drag.

Acceptance:

- public exports checked structurally;
- docs/examples checked through import parsing;
- registry payloads checked for dependency shape;
- behavior tests cover the important runtime risks;
- old-name negative checks are kept only where the regression is plausible.

### Cut 6: Keep The Design Index Honest

Every implementation blueprint must be classified.

Acceptance:

- current authority list contains only live guidance;
- historical notes are clearly historical;
- file-system documents remain outside this viewer pass;
- new blueprint files update the index.

## Proof Commands

The system is not allowed to call itself ideal without proof.

Run:

```bash
pnpm registry:build
pnpm exec vitest run tests/viewer-architecture.test.ts --reporter=dot
pnpm exec vitest run tests/pdf-viewer.test.tsx tests/edit-viewer-model.test.ts tests/edit-viewer-render.test.tsx --reporter=dot
pnpm exec vitest run tests/page-markdown-render.test.tsx tests/parse-viewer.test.tsx tests/parse-viewer-adapter.test.tsx --reporter=dot
pnpm exec vitest run tests/sources.test.tsx tests/layout-blocks-document-ai.test.ts --reporter=dot
pnpm exec tsc --noEmit --pretty false
git diff --check
```

And audit:

```bash
rg -n "ViewerShell|ViewerPanel|ViewerMain|ViewerAside|slot.*viewer" registry/new-york-v4/ui components/ui components/viewers tests
rg -n "partitionMode|splitMode|ocrMode|sourceMode" registry/new-york-v4/ui/segmented-document* components/ui/segmented-document*
rg -n "export function use.*Viewer\\(" registry/new-york-v4/ui components/viewers tests
rg -n "setViewportControls|setHeaderControls|PdfViewerHeaderControls" registry/new-york-v4/ui components/ui content tests public/r
```

Historical design documents may still contain old names.

Current source, tests, docs, and registry payloads should not.

## Definition Of Done

The viewer system reaches the platonic ideal only when all of this is true:

- `ViewerRoot` is the only spatial/sidebar primitive center.
- `FileViewer` is a leaf file-rendering primitive, not a layout system.
- PDF has one obvious internal coordination story.
- Split and partition share behavior, not visual taste.
- Sources and OCR are proven through segmented document adapters.
- Public hooks are narrow and intention-revealing.
- Internal contexts do not leak through public APIs.
- Architecture tests read like contracts, not historical cleanup.
- The design index prevents contradictory blueprint drift.
- No file-system code is changed as part of this viewer-system pass.

Until then, the honest answer is:

```txt
Good design.
Correct direction.
Not perfection.
```
