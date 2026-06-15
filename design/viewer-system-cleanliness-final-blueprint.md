# Viewer System Cleanliness Final Blueprint

## Purpose

This blueprint answers the current question:

```txt
Is the viewer system clean now, and if not, what exactly remains?
```

The answer is:

```txt
The system is now architecturally coherent.
It is not yet perfectly clean.
```

The remaining work is no longer about inventing the architecture. The center is
right:

```txt
ViewerRoot
  spatial shell, frame, body, sidebar state, sidebar trigger

FileViewer
  one ViewerSource rendered through one leaf viewer

SegmentedDocumentProvider
  semantic document segments, page-local anchors, viewport/navigation mechanics

Domain viewers
  email, split, partition, parse, sources, edit, upload, file-system consumers
```

The remaining work is vocabulary and proof. The system needs fewer duplicate
words, fewer parallel interaction paths, and stronger tests that prevent drift.

File-system internals are out of scope. File-system may consume viewer
primitives, but this blueprint must not edit file-system implementation details.

## Verdict

The design direction is correct.

The provider approach is not a dead end. It works when each provider owns one
state machine:

```txt
ViewerRoot                 -> viewer-local spatial/sidebar state
FileViewerProvider          -> source descriptor and resolved resource
SegmentedDocumentProvider   -> segment/page/anchor viewport mechanics
EmailViewerProvider         -> MIME tree and selected part
SplitViewerProvider         -> split result selection/projection
PartitionViewerProvider     -> partition output/vote projections
PageMarkdownViewerProvider  -> page markdown sync and scale
```

It fails only when providers become wrappers for layout or compatibility. That
is no longer the core problem.

The current system is good because JSX now reveals the hierarchy:

```tsx
<DomainProvider>
  <ViewerRoot>
    <DomainHeader />
    <ViewerBody>
      <ViewerSidebar>
        <DomainSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewer source={source} bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DomainProvider>
```

The current system is not perfect because evidence, edit, and source
interaction still use overlapping words and controllers.

## Clean Current Centers

### ViewerRoot

`ViewerRoot` should stay exactly what it has become:

```txt
one spatial viewer root
one primary sidebar state
nearest-root sidebar trigger behavior
no MIME/file/split/partition/evidence knowledge
```

This is shadcn-compliant. Like `SidebarProvider`, `ViewerRoot` owns the local
state required by its visible parts. It is not a domain provider.

Good:

```tsx
<ViewerRoot defaultOpen sidebarSide="right">
  <ViewerHeader />
  <ViewerBody>
    <ViewerSurface />
    <ViewerSidebar />
  </ViewerBody>
</ViewerRoot>
```

Bad:

```tsx
<ViewerRoot file={file} mimePart={part} split={split} />
```

### FileViewer

`FileViewer` deserves to exist separately from `ViewerRoot`.

`ViewerRoot` answers:

```txt
Where do header, body, sidebar, and surface go?
```

`FileViewer` answers:

```txt
Given one source, what renderer should display it?
```

Those are different responsibilities.

`FileViewer` should remain:

```txt
source descriptor
resource resolution
file category detection
header model
format route
leaf viewer selection
```

It should not gain:

```txt
sidebars
split panes
email MIME state
file-system tree state
source/evidence selection state
```

### SegmentedDocumentProvider

`SegmentedDocumentProvider` is the correct convergence point for split,
partition, bbox sources, layout blocks, and future OCR when the data is
page-local.

It should own:

```txt
current page
scroll progress
preview segment
document handle
scroll to page
scroll to segment start
scroll to anchor
```

It should not own:

```txt
partition votes
split job status
OCR text semantics
source provenance labels
field validation
email MIME parts
file downloads
```

The semantic split is right:

```ts
type DocumentSegment = {
  id: string
  label: string
  color: string
  pages: number[]
  sourceId?: string
}

type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}
```

Do not collapse semantic segments and page-local anchors into one object.

## Remaining Problems

### 1. Evidence Target Vocabulary Is Still Not Final

This is the biggest remaining design gap.

The current system has:

```txt
DocumentAnchor
SegmentAnchor
AnchorResolution
EvidenceItem
SourceEvidenceItem
SourceField
SourceFieldLink
SegmentedSourceFieldLink
AnchoredDocumentProvider
SegmentedDocumentProvider
```

That is understandable historically, but it is not Flaubertian.

The system needs one canonical word for a typed place in a document.

The final choice should be one of these:

```txt
Option A: keep DocumentAnchor as the canonical typed target vocabulary
Option B: hard-rename DocumentAnchor to DocumentTarget
```

Do not keep both public concepts long-term.

The canonical type must be typed, not metadata-backed:

```ts
type DocumentTarget =
  | PageBoundsTarget
  | TextRangeTarget
  | CsvCellTarget
  | XlsxCellTarget
  | DocxRangeTarget
```

or, if the existing name wins:

```ts
type DocumentAnchor =
  | PageBoundsAnchor
  | TextRangeAnchor
  | CsvCellAnchor
  | XlsxCellAnchor
  | DocxRangeAnchor
```

Forbidden:

```ts
type SegmentAnchor = {
  pageNumber?: number
  bounds?: SegmentBounds
  metadata?: Record<string, unknown>
}
```

That would make the model flexible by making it vague.

### 2. Source Evidence Has Two Interaction Paths

Page-backed evidence now fits the segmented system well:

```txt
source -> page-bounds target -> DocumentSegment + SegmentAnchor
```

Non-page evidence still needs anchored document handles:

```txt
source -> text/cell/docx target -> document-specific handle
```

That is not wrong. It is only dirty because the public words do not explain the
split.

The clean sentence should be:

```txt
SegmentedDocumentProvider handles page-local targets.
DocumentTarget handles name every target.
Non-page targets register typed document handles.
```

If the code cannot say that simply, the names are not done.

### 3. Edit Viewer Should Share Targets, Not Semantics

Edit and source evidence are close, but not identical.

They should share:

```txt
typed document target
selected item id
preview item id
scroll to item
highlight item
page-bound overlay projection
```

Edit must keep:

```txt
value
validation
dirty state
permissions
commit/revert
field grouping
edit toolbar
```

The correct move is not to make edit fields generic evidence items. The correct
move is:

```txt
EditField.target uses the same canonical DocumentTarget/DocumentAnchor union.
EditViewerProvider owns edit state.
A shared target controller owns navigation mechanics.
```

### 4. Email Public Hooks Are Still Too Wide

Email composition is now structurally right:

```txt
EmailHeader
ViewerBody
EmailPartsSidebar
FileViewer bare
```

The remaining issue is API surface.

`useEmailViewer()` currently exposes the full context:

```ts
{
  ;(model, selectPart)
}
```

That is convenient, but too broad for a public primitive API. The full hook
should be private:

```ts
function useEmailViewerContext(): EmailViewerContextValue
```

Public hooks should be narrow:

```ts
useEmailHeader()
useEmailPartsSidebar()
useEmailContent()
useEmailSelection()
```

If `useEmailViewer()` remains public, it should return a narrow stable state,
not the full internal model.

### 5. Leaf Viewer Chrome Must Prove It Does Not Duplicate FileViewer

The model is right:

```txt
Full FileViewer shows file header/download.
Nested FileViewer bare shows only content.
Leaf viewers can still have toolbar controls.
```

The remaining proof is subtle: when `FileViewer` owns the download affordance,
resource-backed leaf viewers must not show a second download action.

Every heavy route must respect:

```tsx
<LeafResourceContent download={showLeafDownload} />
```

for:

```txt
PDF
DOCX
Image
PPTX
XLSX
```

This is polish, but it matters because duplicate chrome is the fastest way for
the abstraction to feel fake.

### 6. Segment Primitive Names Are Acceptable, But Types Must Be Exact

Do not rename everything now.

These names can stay:

```txt
SegmentLegend
SegmentSidebar
SegmentPageRail
PageRibbon
```

The cleanup is type precision.

Public props that mean semantic document segments should say:

```ts
DocumentSegment[]
```

not:

```ts
Segment[]
```

`SegmentAnchor` must always mean page-local anchor.

### 7. Thumbnail Tokens Need Completion, Not Reinvention

`FileThumbnail` has the right public controls:

```ts
thumbnailShape?: "document" | "square"
thumbnailSize?: "xs" | "sm" | "md" | "lg" | "xl"
```

The remaining cleanup is usage migration:

```tsx
<FileThumbnail thumbnailShape="square" thumbnailSize="md" />
```

instead of common one-off geometry:

```tsx
<FileThumbnail previewAspectRatio={1} className="size-12" />
```

Do not merge `PdfThumbnailRail` into `FileThumbnail`. PDF rails are document
navigation, not generic file thumbnails.

### 8. Page Markdown Must Stay Separate From Segmented Documents

Page markdown owns:

```txt
page-by-page markdown rendering
current page sync
scale
page scroll handle
```

Segmented documents own:

```txt
semantic segments
page-local anchors
segment hover/preview
segment navigation
```

Those can bridge later, but they should not be collapsed.

Correct future bridge:

```tsx
<SegmentedDocumentProvider model={model}>
  <PageMarkdownViewerProvider source={source}>
    <SegmentedPageMarkdownBridge />
    <PageMarkdownViewerContent />
  </PageMarkdownViewerProvider>
</SegmentedDocumentProvider>
```

Wrong:

```txt
PageMarkdownViewer imports segmented primitives by default.
SegmentedDocumentProvider learns markdown page sync.
```

## Final Shape By Component Family

### Email

Final structure:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot sidebarSide="right">
    <EmailHeader />
    <ViewerBody>
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
      <ViewerSidebar>
        <EmailPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

Email owns MIME selection. `ViewerRoot` owns space. `FileViewer` renders the
selected part.

### Split

Final structure:

```tsx
<SplitViewerProvider result={result}>
  <SegmentedDocumentProvider model={model}>
    <ViewerRoot>
      <SplitViewerHeader />
      <ViewerBody>
        <ViewerSidebar>
          <SplitViewerSidebar />
        </ViewerSidebar>
        <ViewerSurface>
          <SplitViewerDocument />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </SegmentedDocumentProvider>
</SplitViewerProvider>
```

Split owns split result projection. Segmented document owns viewport mechanics.

### Partition

Final structure:

```tsx
<PartitionViewerProvider result={result}>
  <SegmentedDocumentProvider model={model.segmentedModel}>
    <ViewerRoot>
      <PartitionViewerHeader />
      <ViewerBody>
        <ViewerSidebar>
          <PartitionLegend />
        </ViewerSidebar>
        <ViewerSurface>
          <PartitionDocument />
          <PartitionRibbon rows={model.ribbonRows} />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </SegmentedDocumentProvider>
</PartitionViewerProvider>
```

Partition-specific model can keep:

```ts
type PartitionViewerModel = {
  segmentedModel: SegmentedDocumentModel
  legendSegments: DocumentSegment[]
  ribbonRows: PartitionRibbonRow[]
}
```

The generic provider must not learn partition votes.

### Sources / OCR / Bboxes

Final page-backed shape:

```tsx
<SegmentedDocumentProvider model={sourceSegmentedModel}>
  <ViewerRoot>
    <SourcesHeader />
    <ViewerBody>
      <ViewerSidebar>
        <SourceFieldList />
      </ViewerSidebar>
      <ViewerSurface>
        <SourceDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SegmentedDocumentProvider>
```

Final non-page-backed shape:

```tsx
<DocumentTargetProvider items={items}>
  <ViewerRoot>
    <SourcesHeader />
    <ViewerBody>
      <ViewerSidebar>
        <SourceFieldList />
      </ViewerSidebar>
      <ViewerSurface>
        <TargetDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DocumentTargetProvider>
```

The exact provider name depends on the target-vocabulary decision. The
important rule is that non-page targets stay typed.

### Dropzone / Upload

Dropzone is outside the viewer center.

It owns:

```txt
file acquisition
drag/drop state
upload queue
validation
```

It composes `FileViewer` after acquisition:

```tsx
<DropzoneProvider>
  <DropzoneSurface />
  {selectedSource ? <FileViewer source={selectedSource} /> : null}
</DropzoneProvider>
```

Dropzone must not become a file viewer provider. File viewer must not become a
dropzone.

### File-System

File-system owns:

```txt
tree state
directory lifecycle
selection
file operations
preview choice
```

It may compose:

```tsx
<ViewerRoot>
  <FileSystemHeader />
  <ViewerBody>
    <ViewerSidebar>
      <FileSystemTree />
    </ViewerSidebar>
    <ViewerSurface>
      <FileViewer source={selectedSource} />
    </ViewerSurface>
  </ViewerBody>
</ViewerRoot>
```

Do not move file-system state into viewer primitives. Do not edit file-system
internals as part of viewer-system cleanup.

## Implementation Order

### Cut 1: Chrome Exactness

Finish leaf download suppression and prove full `FileViewer` has one download
affordance.

Files likely involved:

```txt
registry/new-york-v4/ui/file-viewer.tsx
registry/new-york-v4/ui/pdf-viewer.tsx
registry/new-york-v4/ui/docx-viewer-content.tsx
registry/new-york-v4/ui/image-viewer-content.tsx
registry/new-york-v4/ui/pptx-viewer.tsx
registry/new-york-v4/ui/xlsx-viewer-session.tsx
tests/file-viewer.test.tsx
tests/viewer-architecture.test.ts
```

### Cut 2: Email Hook Surface

Make full email context private and expose only narrow public hooks.

Required proof:

```txt
useEmailViewerContext is private
useEmailHeader is public
useEmailPartsSidebar is public
useEmailContent is public
useEmailSelection is public if selection is needed externally
architecture tests reject public full-context leakage
```

### Cut 3: Segment Type Exactness

Replace public semantic segment props with `DocumentSegment[]` where that is
what the component means.

Do not rename components in this cut.

### Cut 4: Thumbnail Token Completion

Move common examples and blocks to `thumbnailShape` and `thumbnailSize`.

Do not touch bespoke media layouts or file-system internals.

### Cut 5: Page Markdown Boundary Proof

Add or strengthen tests that prove:

```txt
page markdown does not import segmented primitives
parse composes page markdown intentionally
scroll options flow through page markdown handles
```

### Cut 6: Canonical Target Vocabulary

Decide:

```txt
DocumentAnchor stays
```

or:

```txt
DocumentAnchor hard-renames to DocumentTarget
```

Then remove duplicate public vocabulary.

This is the highest-leverage cut and should not be mixed with UI polish.

### Cut 7: Edit / Evidence Target Controller

Only after Cut 6, extract or share a target controller that owns:

```txt
selected item
preview item
registered document handle
scroll to target
highlight target
```

Keep edit values and validation out of it.

## Proof Matrix

The system is clean only when these are mechanically true.

### Import Boundaries

```txt
Viewer primitives import no domain viewers.
FileViewer imports leaf viewers, not email/split/partition/upload/file-system.
SegmentedDocumentProvider imports no source/edit/email/file-system domain code.
Email imports ViewerRoot and FileViewer, not segmented internals.
Split imports segmented mechanics.
Partition imports segmented mechanics.
PageMarkdown does not import segmented mechanics by default.
File-system imports viewer primitives as a consumer only.
```

### Public API Boundaries

```txt
Every exported hook returns the smallest useful slice.
Every provider owns one state machine.
Every easy API is composed from the same named parts as the manual API.
No generic provider takes domain flags such as partitionMode or emailMode.
No public component exposes metadata bags for typed document targets.
```

### Visual / Chrome Boundaries

```txt
Full FileViewer has one header and one download affordance.
Nested FileViewer bare has no duplicate shell.
ViewerHeader is outside ViewerBody.
ViewerSidebarTrigger targets the nearest ViewerRoot.
PDF thumbnail rail remains navigation, not generic thumbnail display.
Email attachments use FileViewer bare inside the viewer surface.
```

### Interaction Boundaries

```txt
Split and partition share segmented viewport mechanics.
Partition keeps vote/output semantics outside segmented primitives.
Page bboxes can become SegmentAnchor.
Text/cell/DOCX targets do not become fake SegmentAnchor metadata.
Edit shares target navigation, not edit semantics.
Source evidence shares target navigation, not edit semantics.
```

## Anti-Blueprint

Do not do these:

```txt
Do not build a generic <SegmentedViewer>.
Do not merge ViewerRoot and FileViewer.
Do not make FileViewer own sidebars.
Do not put MIME parts into FileViewer.
Do not put file-system tree state into ViewerRoot.
Do not put partition votes into SegmentedDocumentProvider.
Do not force non-page targets into SegmentAnchor.
Do not add metadata bags to avoid hard target modeling.
Do not rename every segment component before type precision is fixed.
Do not merge PdfThumbnailRail and FileThumbnail.
Do not collapse page markdown into segmented documents.
Do not keep public full-context hooks when narrow hooks exist.
```

## Final Cleanliness Test

The viewer system reaches the platonic target when this paragraph is true
without caveats:

```txt
ViewerRoot renders space.
FileViewer renders one source.
Leaf viewers render one format.
SegmentedDocumentProvider coordinates page-local document interaction.
Domain viewers own domain state and compose named primitives.
One typed target vocabulary names every evidence/edit location.
SegmentAnchor means only page-local segment anchor.
No component exports a larger hook, provider, prop, or model than its job needs.
```

Until then, the system is no longer confused, but it is not finished.
