# Viewer Primitives Composition Blueprint

## Objective

Define the component-library direction for document viewers after the sidebar,
email, PDF thumbnail, split viewer, and file-system viewer discussions.

The core decision is:

```txt
Viewer primitives are the primitive family.
EmailViewer, PdfViewer, SplitViewer, FileSystemViewer, and future viewers are
compositions over Viewer primitives.
```

This should feel similar to the shadcn sidebar philosophy: provide a small,
expressive grammar of primitives, then build opinionated blocks on top.

## Position

`Viewer` is the document-viewer layout language.

It should provide the structural vocabulary shared by all compound viewers:

- root frame;
- full-width header;
- body region;
- sidebars;
- surfaces;
- rails;
- toolbars;
- overlays;
- loading, empty, and error states.

Domain viewers do not extend `Viewer`. They compose it.

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

Domain-specific state lives in domain-specific roots:

```tsx
<EmailViewerProvider email={email}>
  <ViewerRoot>
    <EmailViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <EmailViewerPartsList />
      </ViewerSidebar>
      <ViewerSurface>
        <EmailViewerSelectedPart />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

The important rule:

```txt
Viewer owns layout grammar.
Domain roots own domain state.
Leaf renderers own format rendering.
```

## Non-Goals

Do not create a universal `FileViewerProvider` that knows about every possible
document workflow.

Do not make `ViewerRoot` understand MIME, PDF pages, file-system paths,
segment legends, split panes, tables, sheets, or attachments.

Do not make `FileViewer` recursive. `FileViewer` remains a leaf dispatcher for
file-like sources.

Do not expose raw internal models as UI just because the model is available.
The UI should be a product projection.

## Primitive Layer

The generic primitive family should look like this:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerToolbar />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerRail />
    <ViewerSurface />
    <ViewerAside />
  </ViewerBody>
  <ViewerFooter />
  <ViewerOverlay />
</ViewerRoot>
```

Not every viewer uses every slot. The primitives exist so complex viewers can
share one layout grammar without forcing every product surface into one rigid
component.

### ViewerRoot

Owns only generic viewer-frame concerns:

- frame border/background/radius;
- height and overflow policy;
- CSS variables for header height, sidebar width, and surface constraints;
- optional controlled layout state if the state is generic;
- accessibility landmarks where generic;
- data attributes for styling descendant states.

It should not own domain selection.

### ViewerHeader

The full-width document header.

This is the corrected hierarchy:

```tsx
<ViewerHeader />
<ViewerBody>
  <ViewerSidebar />
  <ViewerSurface />
</ViewerBody>
```

The header describes the compound document, not just the active leaf.

Examples:

- email subject/from/to/date;
- file-system current folder/path;
- split viewer active comparison title;
- PDF file title and global document controls.

### ViewerBody

The flex container below the header.

It owns the structural relationship between sidebars and surfaces:

```tsx
<div className="flex min-h-0 flex-1">
  {sidebar}
  {surface}
</div>
```

This is the primitive that prevents accidental double nesting and local card
wrappers around leaf viewers.

### ViewerSidebar

Generic sidebar shell for viewer-local navigation.

It should be compatible with embedded sidebar primitives, not global app
sidebar behavior. In particular, embedded viewer sidebars should avoid global
keyboard shortcuts and persistent app-level cookies.

The sidebar is visual structure only. Its children decide the domain projection:

- `EmailViewerPartsList`;
- `PdfViewerThumbnails`;
- `FileSystemViewerTree`;
- `SegmentViewerLegend`;
- `SplitViewerPaneList`.

### ViewerSurface

The main rendering area.

It should accept any leaf renderer or domain content component:

```tsx
<ViewerSurface>
  <FileViewer source={source} bare />
</ViewerSurface>
```

`ViewerSurface` owns layout constraints. The child owns rendering.

## Domain Composition Layer

Domain viewers are compound components that speak the Viewer primitive language.

They may have their own root provider, but that provider owns only domain state.

### EmailViewer

Email is a recursive MIME document. The model can be recursive, but the visible
sidebar should be projected into useful sections.

Canonical shape:

```tsx
<EmailViewerProvider email={email}>
  <ViewerRoot>
    <EmailViewerHeader />

    <ViewerBody>
      <ViewerSidebar>
        <EmailViewerPartsList />
      </ViewerSidebar>

      <ViewerSurface>
        <EmailViewerSelectedPart />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

`EmailViewerProvider` owns:

- MIME normalization;
- body versus attachment projection;
- selected part;
- CID resource resolution;
- controlled/uncontrolled selection;
- conversion from selected MIME part to file-like viewer source.

`EmailViewerHeader` consumes email context and renders through viewer header
semantics.

`EmailViewerPartsList` should not show the raw MIME tree by default. The
default projection should be:

```txt
Body
  Text body
  HTML body

Attachments
  contract.pdf
  sales.csv
  review-note.html
```

`EmailViewerSelectedPart` usually renders:

```tsx
const part = useSelectedEmailPart()

return <FileViewer source={part.source} bare />
```

### PdfViewer

PDF is a domain composition over the viewer primitives.

Canonical shape:

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

`PdfViewerProvider` owns:

- PDF loading state;
- page count;
- current page;
- zoom;
- rotation;
- search state if local to the PDF;
- thumbnail rendering/cache state;
- controlled/uncontrolled current page.

`PdfViewerThumbnails` is a domain projection. It is not a generic sidebar
menu, even if it uses `ViewerSidebar` for placement.

`PdfViewerPages` is the PDF leaf rendering surface.

### SplitViewer

Split viewer is a layout composition over the viewer primitives.

It should not understand PDFs, emails, MIME, or file-system nodes. It owns pane
state and lets panes contain any viewer.

Canonical shape:

```tsx
<SplitViewerProvider value={layout} onValueChange={setLayout}>
  <ViewerRoot>
    <SplitViewerHeader />

    <ViewerBody>
      <SplitViewerPane id="left">
        <FileViewer source={leftSource} bare />
      </SplitViewerPane>

      <SplitViewerHandle />

      <SplitViewerPane id="right">
        <EmailViewer email={email} />
      </SplitViewerPane>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

`SplitViewerProvider` owns:

- pane ids;
- pane sizes;
- active pane;
- resize state;
- pane close/open;
- optional synchronized commands if explicitly enabled.

It does not own leaf rendering.

### FileSystemViewer

File-system browsing is a domain composition over the viewer primitives.

Canonical shape:

```tsx
<FileSystemViewerProvider tree={tree}>
  <ViewerRoot>
    <FileSystemViewerHeader />

    <ViewerBody>
      <ViewerSidebar>
        <FileSystemViewerTree />
      </ViewerSidebar>

      <ViewerSurface>
        <FileSystemViewerSelectedFile />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemViewerProvider>
```

`FileSystemViewerProvider` owns:

- tree normalization;
- expanded folders;
- selected file;
- preview source resolution;
- folder/file actions;
- controlled/uncontrolled selection.

The selected file usually becomes a `FileViewer` source.

### Dropzone And Uploadable Viewers

Dropzone is not a viewer primitive, a domain viewer, or a renderer.

It is a source-acquisition primitive.

The data flow is:

```txt
browser file intake
  -> useDropzone
  -> DropzoneFileItem
  -> BlobViewerSource
  -> Viewer primitives
  -> FileViewer
```

`useDropzone` owns:

- drag state;
- focus state;
- browser input wiring;
- file validation;
- controlled/uncontrolled selected files;
- file dialog opening;
- root/input/trigger/button prop getters.

It should not know:

- `ViewerRoot`;
- `ViewerSidebar`;
- `FileViewer`;
- thumbnails;
- upload progress;
- server persistence;
- workflow routing;
- product copy beyond accessibility defaults.

`FileUploader` remains the standalone component for the job "collect files."
It owns upload prompt copy, accepted file type visuals, rejection messages, and
selected file thumbnail presentation.

Do not embed `FileUploader` wholesale inside a viewer by default. A viewer
already has a header, sidebar, and surface. Putting the complete uploader card
inside `ViewerSurface` creates double framing.

The viewer-specific easy path should be an opinionated composition:

```tsx
<UploadableFileViewer accept=".pdf,image/*" />
```

Its internal shape should be:

```tsx
function UploadableFileViewer({
  accept,
  renderViewer = (source) => <FileViewer source={source} bare />,
}: UploadableFileViewerProps) {
  const dropzone = useDropzone({
    accept,
    maxFiles: 1,
    multiple: false,
  })
  const selectedFile = dropzone.files[0]
  const source = selectedFile
    ? blobSource(selectedFile.file, {
        fileName: selectedFile.file.name,
        identityKey: selectedFile.id,
        mimeType: selectedFile.file.type || undefined,
      })
    : null

  return (
    <section {...dropzone.getRootProps()}>
      <input {...dropzone.getInputProps({ className: "hidden" })} />

      <ViewerRoot data-dragging={dropzone.isDragging ? "" : undefined}>
        <UploadableFileViewerHeader
          dropzone={dropzone}
          selectedFile={selectedFile}
        />

        <ViewerBody>
          <ViewerSidebar>
            <UploadableFileViewerFileSummary
              dropzone={dropzone}
              selectedFile={selectedFile}
            />
          </ViewerSidebar>

          <ViewerSurface>
            {source ? (
              renderViewer(source)
            ) : (
              <UploadableFileViewerEmptyState dropzone={dropzone} />
            )}
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </section>
  )
}
```

Upload-related named exports may include:

```txt
UploadableFileViewer
UploadableFileViewerHeader
UploadableFileViewerFileSummary
UploadableFileViewerEmptyState
```

The drop root should wrap the largest area that should accept file drops. For a
single-file uploadable viewer, that is usually the whole viewer frame. For
multi-slot workflows, each upload slot should own its own dropzone.

Drag state is viewer chrome, not document content. It can style `ViewerRoot` or
an overlay, but it should not unmount or replace the rendered document while a
drag is active.

Email attachments and file-system selections are not dropzone files. They may
all resolve to a `ViewerSource`, but the acquisition paths are different:

```txt
uploaded file
  -> DropzoneFileItem
  -> BlobViewerSource

email attachment
  -> MIME part
  -> BlobViewerSource

file-system row
  -> file node
  -> ViewerSource
```

The common abstraction is the viewer source, not the acquisition mechanism.

## Easy API and Primitive API

Every important domain viewer should have two layers.

### Easy API

For common use:

```tsx
<EmailViewer email={email} />
<PdfViewer source={source} />
<SplitViewer sources={[leftSource, rightSource]} />
<FileSystemViewer tree={tree} />
```

This should render the complete, polished default composition.

### Primitive API

For custom composition:

```tsx
<EmailViewerProvider email={email}>
  <ViewerRoot>
    <CustomHeader />
    <ViewerBody>
      <ViewerSidebar>
        <EmailViewerPartsList />
        <CustomReviewPanel />
      </ViewerSidebar>
      <ViewerSurface>
        <EmailViewerSelectedPart />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

The easy API should be built from the primitive API. There should not be two
separate implementations.

## State Ownership Rule

Use a provider/root only when multiple compound parts need shared state.

Correct:

- `EmailViewerProvider` because header, parts list, and selected part share MIME
  state.
- `PdfViewerProvider` because header, thumbnails, and pages share current page and
  zoom state.
- `SplitViewerProvider` because panes and handles share layout state.
- `FileSystemViewerProvider` because tree and selected file share selection state.

Incorrect:

- `ViewerRoot` owning MIME state.
- `FileViewer` owning split panes.
- `ViewerSidebar` owning PDF thumbnails.
- `EmailViewerPartsList` privately owning selection that
  `EmailViewerSelectedPart` also needs.

## Projection Rule

Domain models can be technical. Product UI should be conceptual.

Examples:

- MIME tree projects to body and attachments.
- PDF page objects project to square thumbnails.
- file-system nodes project to folders/files.
- split pane config projects to panes and handles.
- extraction segments project to legends and ranges.

The projection layer belongs to the domain viewer, not to the viewer
primitives.

## Naming Rule

Use named exports for generic viewer primitives:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerToolbar
ViewerOverlay
```

Use named exports for domain/layout compositions:

```txt
EmailViewer
EmailViewerProvider
EmailViewerHeader
EmailViewerPartsList
EmailViewerSelectedPart

PdfViewer
PdfViewerProvider
PdfViewerHeader
PdfViewerThumbnails
PdfViewerPages

SplitViewer
SplitViewerProvider
SplitViewerHeader
SplitViewerPane
SplitViewerHandle

FileSystemViewer
FileSystemViewerProvider
FileSystemViewerHeader
FileSystemViewerTree
FileSystemViewerSelectedFile
```

Avoid names that imply inheritance:

```txt
EmailHeader extends ViewerHeader
PdfSidebar extends ViewerSidebar
```

Prefer names that imply composition:

```txt
EmailViewerHeader renders inside ViewerHeader semantics
PdfViewerThumbnails renders inside ViewerSidebar
SplitViewerPane renders inside ViewerBody
```

## Implementation Direction

1. Introduce named viewer primitives with the minimum useful surface:
   `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`,
   `ViewerSurface`, `ViewerToolbar`, `ViewerOverlay`.
2. Rebuild the easy `EmailViewer` composition from `EmailViewerProvider` plus
   named viewer primitives.
3. Move PDF thumbnail layout to `ViewerSidebar` and `ViewerSurface` while
   keeping PDF page state inside `PdfViewerProvider`.
4. Model split view as pane composition inside `ViewerBody`.
5. Keep `FileViewer` focused on file-like leaf rendering.
6. Document one canonical hierarchy and enforce it in examples:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

## Final Principle

`Viewer` should be the primitive language.

Every specialized viewer should speak that language instead of inventing its
own frame, header, sidebar, and surface hierarchy.
