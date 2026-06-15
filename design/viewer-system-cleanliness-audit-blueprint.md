# Viewer System Cleanliness Audit Blueprint

## Verdict

The viewer system is now structurally good and clean for this audit scope.

The viewer/file-viewer layer has mostly converged:

```txt
ViewerRoot
  spatial shell
  sidebar state
  sidebar trigger
  no file knowledge

FileViewer
  source renderer
  complete chrome by default
  bare nested content form
  provider + named parts

Domain viewers
  email
  split
  partition
  parse
  edit
  upload/dropzone
```

The cleanup work resolved the remaining chrome, target-vocabulary,
source/evidence, edit, thumbnail, and page-markdown boundary gaps covered by
this audit.

## Current Good Shape

The following decisions should hold.

### Viewer

`ViewerRoot` is the spatial primitive.

It owns:

```txt
root frame
body layout
sidebar state
sidebar trigger
surface layout
responsive sidebar behavior
```

It must not own:

```txt
files
MIME parts
split jobs
partition semantics
OCR fields
source evidence
file-system tree state
```

### FileViewer

`FileViewer` is the source-rendering primitive.

It owns:

```txt
ViewerSource
resource resolution
file category detection
file header
format route
leaf resource/content renderer selection
```

It must not own:

```txt
email MIME state
split state
partition state
file-system tree state
dropzone acquisition state
source/evidence selection state
```

### Domain Viewers

Domain viewers compose primitives.

They should look like:

```tsx
<DomainProvider>
  <ViewerRoot>
    <DomainHeader />
    <ViewerBody>
      <ViewerSidebar>
        <DomainSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewer source={selectedSource} bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DomainProvider>
```

The domain owns domain state. `ViewerRoot` owns space. `FileViewer` owns source
rendering.

## Implemented Gaps

### 1. Canonical Document Target Vocabulary

This was the central vocabulary problem.

Current vocabulary:

```txt
DocumentAnchor
SegmentAnchor
AnchoredDocumentProvider
SegmentedDocumentProvider
edit bbox fields
source evidence anchors
```

The canonical decision is to keep `DocumentAnchor` as the typed document target
vocabulary. A new `DocumentTarget` type should not be added beside it. The
codebase already has `DocumentAnchor`; adding `DocumentTarget` beside it would
create three competing target words:

```txt
DocumentAnchor
DocumentTarget
SegmentAnchor
```

That would not be clean.

The final system uses:

```txt
DocumentAnchor
```

not:

```txt
DocumentAnchor + DocumentTarget
```

The canonical union must stay typed:

```ts
type DocumentAnchor =
  | PageBoundsAnchor
  | TextRangeAnchor
  | CsvCellAnchor
  | XlsxCellAnchor
  | DocxRangeAnchor
```

Avoid:

```ts
metadata?: Record<string, unknown>
```

#### Implemented Cleanup

1. `DocumentAnchor` is the canonical typed target name.
2. Source/evidence projection produces canonical `DocumentAnchor` resolution.
3. `SourceFieldList` consumes a single evidence item shape.
4. `SegmentAnchor` remains page-local.
5. Page-bound source targets adapt into `SegmentedDocumentProvider`.
6. Non-page targets stay on typed document handles until a shared target
   controller exists.
7. Architecture tests reject metadata-backed target drift and verify the
   source/evidence boundary.

### 2. Edit Viewer Target Convergence

Edit should converge with source/evidence at the document-target layer only.

It should share:

```txt
item id
active item
preview item
selected item
target resolution
scroll to target
highlight target
page-bound geometry
```

It should keep:

```txt
value
validation
dirty state
permissions
field grouping
toolbar behavior
edit-specific overlays
commit/revert
```

Edit state now uses canonical typed target data for field locations while
keeping edit-specific state in edit.

#### Implemented Cleanup

1. Normalized edit fields include `target: DocumentAnchor | null`.
2. Edit fields preserve target state with resolved, missing, and invalid states.
3. `bbox` remains input compatibility and normalization input only.
4. PDF overlays read page-bound `DocumentAnchor` targets, not raw `bbox`.
5. Edit still reuses `AnchoredDocumentProvider` for target interaction.
6. Edit-specific rendering remains separate from source/evidence rendering.
7. Architecture and model tests enforce the boundary.

### 3. Email Viewer Public Hooks

Email is close. The remaining smell is the public full-context hook.

The full context is private:

```ts
function useEmailViewerContext(): EmailViewerContextValue
```

The public API exposes narrow slices:

```ts
useEmailViewer(): EmailViewerState
useEmailHeader(): EmailHeaderModel
useEmailPartsSidebar(): EmailPartsSidebarState
useEmailContent(): EmailContentModel
useEmailSelection(): EmailSelectionState
```

#### Implemented Cleanup

1. The full hook is private `useEmailViewerContext`.
2. Public `useEmailViewer` returns a narrow aggregate state.
3. `useEmailSelection` exposes selected MIME part state and `selectPart`.
4. Architecture and runtime tests reject public full-context leakage.
5. Nested message rendering remains unchanged.

Nested messages can remain full bare nested viewers for now. That behavior is
already coherent if documented as independent embedded email viewers.

### 4. FileViewer Leaf Download Polish

Full `FileViewer` now renders a header download action.

Text-like routes respect `showLeafDownload={false}` in the full viewer.
Resource-backed leaf viewers now receive the same `download` ownership flag, so
the full `FileViewer` does not duplicate its header download action inside leaf
toolbars.

This cleanup covers:

```txt
PDF
DOCX
Image
PPTX
XLSX
```

#### Implemented Cleanup

Resource-backed leaf viewers expose:

```ts
download?: boolean
```

with this default:

```ts
download = true
```

`FileViewer` routes:

```tsx
<PdfResourceContent download={showLeafDownload} />
<DocxResourceContent download={showLeafDownload} />
<ImageResourceContent download={showLeafDownload} />
<PptxResourceContent download={showLeafDownload} />
<XlsxResourceContent download={showLeafDownload} />
```

Toolbars remain enabled. Only download actions are hidden when
`download === false`.

Do not:

```txt
remove toolbars
rewrite resource caches
touch file-system
add generic slot/fallback APIs
collapse markdown viewers
```

### 5. Segment Type Precision

Do not rename exported segment components now.

Keep:

```txt
SegmentLegend
SegmentSidebar
SegmentPageRail
PageRibbon
```

The real cleanup is type precision.

Where a public prop means semantic document segments, it now says:

```ts
DocumentSegment[]
```

not:

```ts
Segment[]
```

`SegmentAnchor` must remain page-local.

#### Implemented Cleanup

1. Public props for legend/sidebar/page rail/ribbon use
   `DocumentSegment`.
2. `RibbonRow.segments` is aligned with `SegmentRow.segments`.
3. Architecture tests enforce:

```txt
SegmentLegend, SegmentSidebar, SegmentPageRail, and PageRibbon expose semantic
DocumentSegment[] props, not raw Segment[] props.
```

4. Component names remain unchanged.

### 6. Thumbnail Token Completion

`FileThumbnail` now has the right primitive-level tokens:

```ts
thumbnailShape?: "document" | "square"
thumbnailSize?: "xs" | "sm" | "md" | "lg" | "xl"
```

The remaining cleanup is implemented for the common viewer-system cases.

#### Implemented Cleanup

Docs and common workflow thumbnails should prefer:

```tsx
<FileThumbnail thumbnailShape="square" thumbnailSize="md" />
```

instead of:

```tsx
<FileThumbnail previewAspectRatio={1} className="size-12" />
```

Good candidates:

```txt
file-thumbnail docs
file-thumbnail demos
non-bespoke dropzone workflow blocks
attachment sidebar
```

For `AttachmentSidebar`, preserve existing geometry:

```tsx
thumbnailShape = "document"
thumbnailSize = "md"
```

not `lg`.

This cleanup is now covered by:

```txt
file-thumbnail docs
file-thumbnail demos
dropzone media transcript queue
dropzone intake router
dropzone required packet slots
dropzone evidence timeline
dropzone comparison pair upload
attachment sidebar
```

Architecture tests enforce that these common surfaces do not teach raw square
aspect-ratio props.

#### Should Stay Bespoke

Keep raw geometry in:

```txt
custom visual demos
avatar/circular thumbnails
pinboard rotated thumbnails
primitive cards with source-coordinate overlays
run-card media frames
PDF thumbnail rail
file-system internals
```

Do not merge `PdfThumbnailRail` with `FileThumbnail`.

### 7. Page Markdown Boundary

Page markdown should stay separate from `SegmentedDocumentProvider`.

Its primitive is:

```txt
page-by-page markdown rendering
current page sync
scale
page scroll handle
```

It is not:

```txt
semantic segment state
anchor overlays
evidence hover/preview
segment rail navigation
```

#### Implemented Cleanup

1. Declare Parse as an embedded result surface, unless intentionally promoted to
   standalone viewer chrome.
2. Architecture tests prove page-markdown and parse do not import segmented
   primitives.
3. `PageMarkdownPaneHandle.scrollToPage` forwards scroll options.
4. Page-markdown sync state is structural and no longer exposes a public
   `version` replay field.
5. Do not split toolbar/content or merge providers as part of segmented
   convergence.

Converge later only through a bridge:

```tsx
<SegmentedDocumentProvider model={model}>
  <PageMarkdownViewerProvider source={source}>
    <SegmentedPageMarkdownBridge />
    <PageMarkdownViewerContent />
  </PageMarkdownViewerProvider>
</SegmentedDocumentProvider>
```

## Implemented Order

### Phase 1: Small Clean Cuts

These bounded cuts are implemented.

1. FileViewer resource-backed duplicate download fix.
2. Email public hook cleanup.
3. Segment type precision cleanup.
4. Thumbnail docs/block token completion.
5. Page markdown boundary tests and handle option cleanup.

### Phase 2: Canonical Target Vocabulary

This hard architectural cut is implemented.

1. Decide `DocumentAnchor` vs `DocumentTarget` naming.
2. Make the chosen type the canonical typed target model.
3. Update source/evidence projection.
4. Move `SourceFieldList` toward evidence items.
5. Keep `SegmentAnchor` page-local.
6. Keep non-page targets typed.

### Phase 3: Edit Convergence

This cut was implemented after the target vocabulary was canonical.

1. Normalize edit fields to canonical targets.
2. Move PDF overlays from raw `bbox` to page-bound targets.
3. Extract/reuse a target controller.
4. Keep edit-specific value/validation/toolbar state separate.

## What Not To Do

Do not:

```txt
add DocumentTarget beside DocumentAnchor indefinitely
put text/cell/DOCX data into SegmentAnchor metadata
touch file-system internals
merge FileThumbnail with PdfThumbnailRail
collapse page markdown into SegmentedDocumentProvider
rename SegmentLegend/SegmentSidebar/PageRibbon before type cleanup proves need
add generic slot systems to FileViewerContent
change nested email behavior while cleaning hooks
```

## Cleanliness Test

The system is clean for this audit because these sentences are true:

```txt
Viewer renders space.
FileViewer renders sources.
Domain viewers compose viewer and file viewer primitives.
DocumentAnchor names one typed target vocabulary.
SegmentAnchor means page-local segment anchor only.
Edit shares target mechanics but owns editing semantics.
Source/evidence shares target mechanics but owns provenance semantics.
Page markdown owns page sync only.
Thumbnail tokens cover common geometry without replacing bespoke media layouts.
```

The remaining viewer-system work, if any, belongs to future audits outside this
blueprint's seven explicit gaps.
