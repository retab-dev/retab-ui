# PDF Header Subtraction Blueprint

## Purpose

Define the final direction after removing `PdfViewerHeader`.

This is not a cosmetic rename.

It is a boundary correction:

```txt
FileHeader owns visible file chrome.
PdfViewer owns PDF document behavior.
ViewerRoot owns layout and sidebar state.
```

The goal is fewer headers, fewer concepts, and one obvious top row for every
file-backed viewer.

## Verdict

Killing the PDF header is the right subtraction.

`PdfViewerHeader` is not fundamentally PDF state. It is file chrome:

```txt
file title
file metadata
page position
zoom controls
fit controls
rotate
download
optional custom children wrapper
```

Those now belong to `FileHeader`.

The PDF-specific part is the document engine:

```txt
PDF resource
PDF pages
current page
zoom state
rotation state
scroll handle
thumbnail navigation
toolbar contribution
```

That belongs to `PdfViewerProvider`, `PdfViewerPages`, and
`PdfViewerThumbnails`.

The old shape made PDF a composed viewer with its own chrome:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

The new shape should make PDF a document engine under universal file chrome:

```tsx
<FileViewerProvider source={source}>
  <PdfViewerProvider source={source}>
    <ViewerRoot>
      <FileHeader>
        <ViewerSidebarTrigger />
        <FileHeaderTitle />
        <FileHeaderMeta />
        <FileHeaderControls />
      </FileHeader>

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
</FileViewerProvider>
```

That is simpler because there is only one visible file header.

The provider order should be:

```tsx
<FileViewerProvider source={source}>
  <PdfViewerProvider source={source}>
    ...
  </PdfViewerProvider>
</FileViewerProvider>
```

The outer concept is file identity and file chrome.

PDF is the active document renderer.

Avoid the reverse order unless a concrete implementation constraint proves it
necessary.

## Non-Goals

Do not touch file-system implementation.

Do not add:

- a `PdfHeader`;
- a `PdfToolbar`;
- a `PdfViewerHeader` compatibility wrapper;
- a `showPdfControls` prop on `FileHeader`;
- PDF-specific props on `ViewerRoot`;
- PDF-specific props on `FileHeaderControls`;
- domain state in `FileViewerProvider`;
- workflow state in PDF primitives.

Do not preserve `PdfViewerHeader` for compatibility. This is a hard cut.

## Final Public PDF Vocabulary

Keep PDF vocabulary document-centered:

```txt
PdfViewerProvider
PdfViewerPages
PdfViewerThumbnails
PdfThumbnailRail
PdfHighlight
PdfViewer
PdfResourceContent
```

Remove visible chrome vocabulary:

```txt
PdfViewerHeader
PdfViewerHeaderControls
usePdfViewerHeader
useOptionalPdfViewerHeaderControls
```

If `PdfResourceContent` remains exported, it is a low-level resource renderer,
not a composed viewer header API.

## Final File Header Vocabulary

The top row vocabulary is file-level:

```txt
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
```

The sidebar trigger remains layout-level:

```txt
ViewerSidebarTrigger
```

The correct composition is:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

No PDF-specific visible component belongs in that row.

Domain viewers may insert small domain metadata:

```tsx
<FileHeader>
  <FileHeaderTitle />
  <SplitViewerHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

That metadata must be passive. Domain interaction belongs below the header.

## PDF Responsibilities After The Cut

`PdfViewerProvider` owns:

```txt
PDF resource
current page
viewer handle
thumbnail navigation
document-handle registration for PDF parts
```

`PdfViewerPages` owns:

```txt
page rendering
visible-page reporting
scroll progress reporting
zoom
fit width
rotation
imperative scroll handle
toolbar contribution to FileViewer
```

`PdfViewerThumbnails` owns:

```txt
thumbnail rendering
current-page highlight
thumbnail click -> PDF page navigation
```

`PdfViewer` owns only the easy assembly:

```tsx
function PdfViewer({ source }) {
  return (
    <FileViewerProvider source={source}>
      <PdfViewerProvider source={source}>
        <ViewerRoot>
          <FileHeader />
          <ViewerBody>
            <ViewerSurface>
              <PdfViewerPages />
            </ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      </PdfViewerProvider>
    </FileViewerProvider>
  )
}
```

The easy component is convenience, not the conceptual center.

## When Not To Use `FileHeader`

Do not blindly add `FileHeader` to every PDF-backed surface.

Use `FileHeader` when the primary object is a file:

```txt
standalone PDF viewer
PDF thumbnail viewer
split viewer over a file
partition viewer over a file
file preview
selected email attachment
```

Do not use `FileHeader` as the top row when the primary object is a domain
workflow and the file is only an inner surface:

```txt
source-linked extraction workbench
OCR inspection workbench
multi-file comparison
email message shell
workflow run review
```

In those cases the domain shell may own the top row, and the file header may be
absent or nested only around the selected file/attachment.

The test is:

```txt
If the user's answer to "what am I looking at?" is a file, use FileHeader.
If the answer is a workflow/domain object, do not force FileHeader into the top
row.
```

## The Control Flow After The Cut

The ideal control flow is:

```txt
PdfViewerPages computes PDF document controls.
PdfViewerPages registers generic toolbar state upward to FileViewerProvider.
FileHeaderControls renders registered toolbar state.
PdfViewerProvider stores only PDF state needed by PDF parts.
PdfViewerThumbnails reads current page and viewer handle from PdfViewerProvider.
```

The visible chrome path is:

```txt
PDF state -> ViewerToolbarState -> FileHeaderControls
```

The PDF document path is:

```txt
PDF state -> PdfViewerProvider -> PdfViewerThumbnails / PDF parts
```

Those are different projections. They should be named as projections, not
competing headers.

## What Should Die With `PdfViewerHeader`

If `PdfViewerHeader` is removed, this state becomes wrong unless another
non-header PDF consumer proves it still needs the full control object:

```ts
viewportControls: PdfDocumentViewportControls | null
```

It existed primarily so a detached PDF header could render page, zoom, fit,
rotate, and download controls.

After the cut, header controls are rendered by `FileHeaderControls`, so PDF
should not need to store viewport controls for a PDF header.

Target `PdfViewerContextValue` should be closer to:

```ts
type PdfViewerContextValue = {
  currentPage: number | null
  resource: ViewerResource
  setCurrentPage: (page: number | null) => void
  setViewerHandle: (handle: PdfViewerHandle | null) => void
  viewerHandle: PdfViewerHandle | null
}
```

If a field remains only for a removed header, delete it.

If a future PDF part needs one command, expose that command narrowly. Do not keep
the whole `PdfDocumentViewportControls` object around as a memorial to the
removed header.

Examples:

```txt
PdfViewerThumbnails needs currentPage and scrollToPage.
External segmented-document adapters need setDocumentHandle callbacks.
FileHeaderControls needs generic ViewerToolbarState.
```

None of those require `viewportControls` in `PdfViewerContextValue`.

## The Remaining Registration Question

The current direction has a useful concept:

```txt
active renderer contributes controls to the file header
```

The current implementation may expose that as:

```txt
ViewerToolbarRegistrationProvider
useViewerToolbarRegistration
```

That is acceptable as an internal transport.

But the platonic internal name might be more file-renderer specific:

```txt
FileRendererControlsProvider
useFileRendererControlsRegistration
```

Do not rename for taste alone.

Rename only if it makes ownership clearer:

```txt
ViewerToolbar = visible toolbar primitive
FileRendererControls = active renderer contribution to FileHeader
```

The important rule is not the exact name.

The important rule is that this registration carries only generic file-control
capabilities:

```ts
type ViewerToolbarState = {
  position?: ViewerToolbarPosition | null
  zoom?: ViewerToolbarZoom | null
  rotate?: ViewerToolbarRotate | null
  downloads?: ViewerDownloadAction[]
  extra?: React.ReactNode
}
```

It must not grow:

```txt
pdfPage
splitSegments
partitionRows
ocrBlocks
sourceFields
emailParts
workflowRun
```

## Why This Is Better

The old system had two visible chrome centers:

```txt
PdfViewerHeader
FileHeader
```

The new system has one:

```txt
FileHeader
```

The old system had two ways to answer "where do PDF controls render?"

```txt
PdfViewerHeader renders them.
FileHeaderControls can render them.
```

The new system has one:

```txt
PDF contributes controls, FileHeaderControls renders them.
```

The old system made `PdfViewerProvider` store controls for detached chrome.

The new system lets `PdfViewerProvider` store PDF document state, while
`FileViewerProvider` stores active renderer chrome contribution.

That is a cleaner separation:

```txt
PDF state for PDF parts.
File renderer controls for file chrome.
```

## Domain Viewer Composition

### Split

```tsx
<SplitViewerProvider result={result}>
  <FileViewerProvider source={source}>
    <PdfViewerProvider source={source}>
      <ViewerRoot defaultOpen>
        <FileHeader>
          <ViewerSidebarTrigger />
          <FileHeaderTitle />
          <SplitViewerHeaderMeta />
          <FileHeaderControls />
        </FileHeader>

        <ViewerBody>
          <SplitViewerSidebar />
          <ViewerSurface>
            <SplitViewerLegend />
            <PdfViewerPages />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PdfViewerProvider>
  </FileViewerProvider>
</SplitViewerProvider>
```

Split owns split state and split parts.

PDF owns PDF pages.

FileViewer owns the file header.

### Partition

```tsx
<PartitionViewerProvider result={result}>
  <FileViewerProvider source={source}>
    <PdfViewerProvider source={source}>
      <ViewerRoot>
        <FileHeader>
          <FileHeaderTitle />
          <PartitionViewerHeaderMeta />
          <FileHeaderControls />
        </FileHeader>

        <ViewerBody>
          <ViewerSurface>
            <PartitionViewerLegend />
            <PartitionViewerRibbon />
            <PdfViewerPages />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PdfViewerProvider>
  </FileViewerProvider>
</PartitionViewerProvider>
```

Partition owns legend/ribbon semantics.

PDF owns document rendering.

FileViewer owns file chrome.

### Sources And OCR

Sources/OCR should follow the same rule:

```txt
FileHeader on top.
Evidence/blocks/fields in sidebar or surface.
PDF pages in surface.
SegmentedDocumentProvider owns navigation and anchors.
```

No OCR or source control should enter `FileHeaderControls`.

Only file manipulation controls belong there.

## Tests And Audits

### Required Tests

Run:

```txt
pnpm registry:build
pnpm exec vitest run tests/viewer-architecture.test.ts --reporter=dot
pnpm exec vitest run tests/pdf-viewer.test.tsx tests/file-viewer.test.tsx --reporter=dot
pnpm exec vitest run tests/sources.test.tsx tests/layout-blocks-document-ai.test.ts --reporter=dot
pnpm exec tsc --noEmit --pretty false
git diff --check
```

### Required Audits

Run:

```txt
rg -n "PdfViewerHeader|PdfViewerHeaderControls|usePdfViewerHeader|useOptionalPdfViewerHeaderControls" registry/new-york-v4 components content public/r tests
rg -n "showPdfControls|showSidebarTrigger|pdfMode|splitMode|partitionMode|ocrMode|sourceMode" registry/new-york-v4/ui components/ui content public/r
rg -n "setViewportControls|setHeaderControls|PdfViewerHeaderControls" registry/new-york-v4/ui components/ui content public/r tests
git diff --name-only | rg "file-system" || true
```

Expected:

- no public `PdfViewerHeader`;
- no docs teaching `PdfViewerHeader`;
- no compatibility alias for `PdfViewerHeader`;
- no PDF-specific props on `FileHeader`;
- no domain mode props in shared viewer primitives;
- no file-system changes.

## Definition Of Done

This cut is complete when the answer to each question is singular:

```txt
Where is the top row? FileHeader.
Where do file controls render? FileHeaderControls.
Where do PDF pages render? PdfViewerPages.
Where do PDF thumbnails render? PdfViewerThumbnails.
Where does PDF state live? PdfViewerProvider.
Where does sidebar state live? ViewerRoot.
```

And no source file gives a second answer.
