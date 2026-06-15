# Viewer System Absolute Platonic Blueprint

## Purpose

This blueprint is the current standard for judging the viewer system.

It answers one question:

```txt
What still separates the viewer system from the platonic ideal?
```

Platonic ideal means:

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

This document supersedes older viewer-system judgment documents when they
conflict. Source, tests, registry output, public docs, and
[`viewer-system-design-index.md`](./viewer-system-design-index.md) remain the
operational authority.

## Verdict

No, the viewer system has not reached perfection.

It has reached the right direction.

The remaining work is not another conceptual architecture. The remaining work is
subtraction, naming exactness, and proof.

The center is now correct:

```txt
ViewerRoot = spatial primitive and sidebar state
FileViewer = file-source router and leaf renderer selector
PdfViewer = PDF resource, pages, controls, thumbnails
SegmentedDocumentProvider = semantic document navigation and anchors
Domain viewers = named composition over those primitives
```

The provider pattern is not the enemy.

Provider sprawl is the enemy.

A provider is justified only when it owns a real shared state machine:

```txt
sidebar open state
PDF document controls
segmented document viewport
edit viewer selection/search state
email MIME selection
split or partition domain navigation
```

A provider is unjustified when it only avoids prop passing.

## Hard Non-Goals

Do not touch the file-system implementation as part of this pass.

Do not introduce:

- a generic `SegmentedViewer`;
- a generic `DocumentViewer`;
- another `FileViewer` wrapper layer;
- compatibility adapters;
- slot-object APIs;
- render-prop anatomy;
- public aggregate viewer hooks;
- domain props on shared primitives;
- symmetrical hooks without a real external composition seam.

Do not optimize for backward compatibility. The ideal is allowed to make hard
cuts.

## Final Shared Grammar

The shared spatial grammar is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The shared trigger is:

```tsx
<ViewerSidebarTrigger />
```

It works anywhere under the nearest `ViewerRoot` because `ViewerRoot` owns the
sidebar state and sidebar registration.

This grammar is intentionally small.

It does not know about:

```txt
files
PDF pages
email parts
edit fields
split segments
partition votes
OCR blocks
source boxes
workflow runs
file-system trees
```

That ignorance is the design.

## Final Layer Boundaries

### ViewerRoot

Owns:

```txt
layout
sidebar open state
controlled/uncontrolled sidebar state
inline or overlay sidebar mode
sidebar registration
single primary sidebar invariant
escape close
outside click close
focus return
trigger disabled state
```

Does not own:

```txt
file rendering
file selection
document parsing
PDF resource loading
domain selection
domain navigation
source evidence
OCR text
```

The current `ViewerRoot` is not tiny, but it is coherent. Do not split it unless
the split removes concepts from the reader's head.

### FileViewer

Owns:

```txt
source normalization
file category dispatch
lazy leaf renderer loading
unsupported file fallback
common leaf options such as bare/download/isolation
```

Does not own:

```txt
ViewerRoot
ViewerHeader
ViewerSidebar
selected file state
file-system state
email attachment state
upload queue state
split or partition state
```

`ViewerRoot` and `FileViewer` both deserve to exist.

They are different primitives:

```txt
ViewerRoot = spatial composition
FileViewer = source rendering
```

Folding them together would make the API shorter and the concept blurrier.

### PdfViewer

Owns:

```txt
PDF source/resource
page rendering
current page
zoom
rotation
fit width
download action
document handle
thumbnail state
detached header coordination
```

The ideal public PDF anatomy is:

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

The convenience component may remain:

```tsx
<PdfViewer source={source} />
```

But it is assembly, not the conceptual center.

### SegmentedDocumentProvider

Owns:

```txt
semantic document segments
page-local anchors
current page
scroll progress
hover/preview interaction
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
extraction schemas
files
emails
workflows
```

The core model is right:

```ts
type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}
```

The central distinction must stay intact:

```txt
DocumentSegment = semantic item
SegmentAnchor = page-local target
```

Split and partition should mostly produce semantic segments.

Sources and OCR should produce semantic segments plus page-local anchors.

If a bbox viewer turns every box into a primary semantic segment, the model is
wrong. If split must regroup anchors back into sections, the model is wrong.

## What Is Already Right

### The Public Viewer Vocabulary Is Small

The correct public spatial vocabulary is:

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

This list should be treated as frozen unless a new name removes more than it
adds.

### Broad Domain Hooks Are Gone

The desired pattern is:

```txt
private context hook
narrow public composition hook only when an external part truly needs it
```

Good examples:

```txt
useSegmentedDocumentViewport
useSegmentedDocumentModel
usePdfViewerThumbnails
```

Bad examples to keep out:

```txt
useEmailViewer()
useEditViewer()
usePartitionViewer()
useParseViewer()
usePageMarkdownViewer()
```

The broad hook smell is not that hooks exist. The smell is returning a full
provider context as public API.

### Split, Partition, Sources, And OCR Converge Correctly

The convergence point is behavior, not taste.

Shared:

```txt
SegmentedDocumentModel
SegmentViewportController
SegmentDocumentHandle
current page
scroll progress
hover/preview interaction
scrollToPage
scrollToSegmentStart
scrollToAnchor
```

Domain-specific:

```txt
split result semantics
partition viewportSegments / legendSegments / ribbonRows
source evidence labels
OCR item text and layout kinds
domain empty and loading states
domain headers and sidebars
```

This is the correct pressure line. Do not create a generic visual
`SegmentedViewer`.

### Sources And OCR Now Prove The Segment Model

The canonical adapter names are:

```txt
createSourcesSegmentedDocumentModel
createOcrSegmentedDocumentModel
```

Those names matter. They say the domain is projected into a shared document
annotation model.

The old names should stay dead:

```txt
sourceFieldsToSegmentedDocumentModel
sourceMapToSegmentedDocumentModel
layoutItemsToSegmentedDocumentModel
```

No aliases. No compatibility exports.

## Remaining Cut 1: PDF Still Leaks A Resource-Level Name

Current public PDF exports include the right anatomy:

```txt
PdfViewerProvider
PdfViewerHeader
PdfViewerPages
PdfViewerThumbnails
PdfThumbnailRail
PdfHighlight
PdfViewer
usePdfViewerThumbnails
```

But the facade also exposes:

```txt
PdfResourceContent
PdfResourceContentProps
```

That name is useful internally because `FileViewer` needs a resource-level leaf
renderer.

It is less good as public anatomy. It asks the user to understand the library's
resource layer.

### Ideal Cut

Choose one final rule:

```txt
Option A: keep PdfResourceContent as a low-level documented leaf primitive.
Option B: stop re-exporting it from pdf-viewer.tsx and let FileViewer import
          the same-folder implementation directly.
```

The platonic preference is Option B.

The public PDF facade should teach anatomy, not resource plumbing.

### Acceptance

PDF is closer to ideal when:

- public docs do not teach `PdfResourceContent`;
- `FileViewer` still lazy-loads the PDF leaf renderer;
- `PdfViewerPages` remains the public composed pages part;
- detached header and thumbnails keep working;
- no setter props such as `setViewportControls` return.

## Remaining Cut 2: PDF Has Two Internal Coordination Concepts

PDF currently coordinates detached header/pages through:

```txt
PdfViewerContext
PdfDocumentViewportRegistrationProvider
```

This is far better than public setter props.

It is still not mathematically minimal.

The current shape says:

```txt
pages compute viewport controls
pages register viewport controls
provider stores viewport controls
header reads viewport controls
thumbnails read document handle state
```

That is honest React.

It is not invisible.

### Ideal Cut

Do not replace this unless the replacement has fewer concepts.

A possible better shape is a single document viewport handle registered by
`PdfViewerPages`, consumed by header and thumbnails.

But if the result creates both:

```txt
PdfViewerHandle
PdfDocumentViewportHandle
```

then it is worse.

### Acceptance

Keep the registration layer unless a new design proves:

- fewer exported names;
- fewer internal names;
- no public API expansion;
- no header-specific transport types;
- detached header, thumbnails, zoom, rotate, scroll, and download stay green.

## Remaining Cut 3: Segmented Document Rows Are Still Lightly Proven

The semantic segment and anchor split is proven by:

```txt
split
partition
sources
OCR/layout blocks
```

The weakest part is `rows`.

Rows are necessary for partition-like ribbons, but they are still generic.

That is acceptable only while they remain display grouping, not domain state.

### Ideal Rule

`SegmentRow` may describe visual grouping.

It must not grow fields like:

```txt
votes
output
schemaPath
ocrKind
partitionMode
splitMode
sourceMode
```

Domain viewers can adapt rows before rendering. The shared model stays boring.

### Acceptance

Rows are ideal enough when:

- partition can render ribbon rows from domain-specific model code;
- split can ignore rows completely;
- sources and OCR can ignore rows completely;
- shared segmented primitives never branch on a domain mode.

## Remaining Cut 4: Architecture Tests Are Valuable But Heavy

The architecture tests are doing real work. They guard:

```txt
public vocabulary
private context boundaries
absence of old broad hooks
absence of setter props
segmented adapter names
source/OCR convergence
PDF detached header behavior
```

But some assertions are textual and historically motivated.

That is acceptable as a ratchet.

It is not beautiful.

### Ideal Cut

Keep contract tests that protect real design boundaries.

Remove assertions that only memorialize old mistakes once the old names are no
longer plausible.

Prefer testing:

```txt
what is exported
what examples import
what docs teach
what behavior works
```

Over testing:

```txt
every old name that once existed
every string that once caused trouble
```

### Acceptance

The tests are closer to ideal when a new contributor can read them and learn the
current system, not the entire history of previous wrong turns.

## Remaining Cut 5: The Design Folder Needs Active Curation

The design folder has many viewer blueprints.

That history is useful.

It is also dangerous.

The active source of truth must remain small:

```txt
this blueprint
viewer-system-design-index.md
segmented-document-convergence-blueprint.md
viewer-root-sidebar-final-blueprint.md
pdf-viewer-viewport-registration-decision.md
```

Everything else is historical unless the index says otherwise.

### Acceptance

The design folder is healthy when:

- the index points to the current authority;
- superseded docs clearly say they are superseded or are listed as historical;
- no implementation task starts from an unindexed older blueprint;
- file-system documents remain outside viewer-system cleanup.

## Final Public API Target

The public API should feel like shadcn:

```txt
small anatomy
obvious names
plain props
private machinery
escape hatches only where proven
```

The target viewer API is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The target PDF API is:

```tsx
<PdfViewerProvider source={source}>
  <PdfViewerHeader />
  <PdfViewerPages />
  <PdfViewerThumbnails />
</PdfViewerProvider>
```

The target segmented API is:

```tsx
<SegmentedDocumentProvider model={model}>
  <SegmentLegend />
  <SegmentPageRail />
  <PageRibbon />
</SegmentedDocumentProvider>
```

The target domain viewer is:

```tsx
function DomainViewer({ result }: DomainViewerProps) {
  const model = createDomainViewerModel(result)

  return (
    <DomainViewerProvider model={model}>
      <ViewerRoot>
        <DomainViewerHeader />
        <ViewerBody>
          <ViewerSurface>
            <DomainDocument />
          </ViewerSurface>
          <ViewerSidebar>
            <DomainSidebar />
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>
    </DomainViewerProvider>
  )
}
```

The provider exists because domain parts share domain state. The layout exists
because the viewer parts compose space. The document renderer exists because one
file must be rendered.

No layer steals another layer's job.

## Proof Contract

Run these after any implementation of this blueprint:

```txt
pnpm registry:build
pnpm exec vitest run tests/viewer-architecture.test.ts --reporter=dot
pnpm exec vitest run tests/pdf-viewer.test.tsx tests/edit-viewer-model.test.ts tests/edit-viewer-render.test.tsx --reporter=dot
pnpm exec vitest run tests/page-markdown-render.test.tsx tests/parse-viewer.test.tsx tests/parse-viewer-adapter.test.tsx --reporter=dot
pnpm exec vitest run tests/sources.test.tsx tests/layout-blocks-document-ai.test.ts --reporter=dot
pnpm exec tsc --noEmit --pretty false
git diff --check
```

Run these audits:

```txt
rg -n "ViewerShell|ViewerPanel|ViewerMain|ViewerAside|ViewerSlots|PdfViewerSlots|slots=\\{|slot object" registry/new-york-v4/ui components/ui components/viewers content public/r
rg -n "partitionMode|splitMode|ocrMode|sourceMode|emailMode|workflowMode" registry/new-york-v4/ui/segmented-document* components/ui/segmented-document*
rg -n "export function use.*Viewer\\(" registry/new-york-v4/ui components/viewers public/r content
rg -n "setViewportControls|setHeaderControls|PdfViewerHeaderControls" registry/new-york-v4/ui components/ui content tests public/r
rg -n "sourceFieldsToSegmentedDocumentModel|sourceMapToSegmentedDocumentModel|layoutItemsToSegmentedDocumentModel" registry/new-york-v4 components public/r content tests
git diff --name-only | rg "file-system" || true
```

Expected result:

- no file-system source changes;
- no broad public viewer hooks;
- no old segmented adapter names except negative assertions in tests;
- no setter transport props;
- no domain mode props on shared segmented primitives;
- registry output matches source.

## Done Definition

The viewer system reaches the platonic ideal when a reader can answer these
questions without searching history:

```txt
Where does layout live? ViewerRoot.
Where does file dispatch live? FileViewer.
Where does PDF state live? PdfViewerProvider.
Where does document annotation navigation live? SegmentedDocumentProvider.
Where does domain meaning live? Domain viewer model/provider.
Where does file-system state live? Outside this viewer-system pass.
```

And when the code has no extra answer.

