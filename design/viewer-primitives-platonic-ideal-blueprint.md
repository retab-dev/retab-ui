# Viewer Primitives Platonic Ideal Blueprint

## Objective

Define the ideal viewer component architecture without considering backward
compatibility, migration convenience, or existing implementation inertia.

The standard is perfection:

- simplicity;
- speed;
- everything needed;
- nothing more;
- perfect modularization;
- high-entropy code;
- perfectly consistent names;
- one precise composition grammar.

## Position

The viewer system should have one public layout grammar:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

This grammar should replace slot-object composition.

`ViewerShell` should not exist in the ideal API.

`slots={{ header, left, right, top, bottom, overlay }}` should not exist in the
ideal API.

The hierarchy should be visible in JSX. The component tree should say exactly
what the rendered layout is.

## Core Rule

```txt
Viewer primitives own layout.
Domain providers own domain state.
Leaf renderers own rendering.
Source-acquisition primitives own acquisition.
```

No layer should compensate for another layer's unclear boundary.

## Public Viewer Primitives

The ideal primitive set is intentionally small:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not add more primitives until a real component proves they are necessary.

Suspicious until proven:

```txt
ViewerToolbar
ViewerRail
ViewerAside
ViewerFooter
ViewerOverlay
```

These may be useful later, but they should not enter the public grammar by
default. A primitive earns its place only when multiple viewers need the same
semantic region.

## Primitive Responsibilities

### ViewerRoot

Owns the generic viewer frame:

- dimensions;
- overflow policy;
- border/radius/background;
- CSS variables for viewer layout;
- generic data attributes;
- generic accessibility landmarks.

Does not own:

- selected file;
- selected MIME part;
- PDF page;
- split pane state;
- file-system selection;
- upload state.

### ViewerHeader

Owns the full-width document header position.

It is always above `ViewerBody`.

It describes the compound viewer, not merely the active leaf renderer.

Examples:

- email subject/from/to/date;
- PDF file name and global PDF controls;
- file-system path;
- uploadable viewer file name and replace action;
- workflow title if the workflow genuinely has viewer-level chrome.

### ViewerBody

Owns the structural relationship below the header.

The essential layout is:

```tsx
<ViewerBody>
  <ViewerSidebar />
  <ViewerSurface />
</ViewerBody>
```

It should prevent double framing, nested cards, and local one-off flex wrappers.

### ViewerSidebar

Owns viewer-local sidebar placement.

It does not own sidebar interaction grammar. If a sidebar needs menu behavior,
group labels, collapsed state, or sidebar-specific buttons, it composes the
sidebar primitive family inside `ViewerSidebar`.

Correct:

```tsx
<ViewerSidebar>
  <EmbeddedSidebarProvider>
    <SidebarContent>
      <SidebarGroup />
    </SidebarContent>
  </EmbeddedSidebarProvider>
</ViewerSidebar>
```

Wrong:

```tsx
<ViewerSidebar selectedAttachmentId="..." attachments={...} />
```

### ViewerSurface

Owns the main rendering surface.

It accepts leaf renderers or domain-selected content:

```tsx
<ViewerSurface>
  <FileViewer source={source} bare />
</ViewerSurface>
```

It should not parse, fetch, route, or select sources.

## Domain Providers

Providers exist only when multiple named parts need shared state.

Correct providers:

```txt
EmailViewerProvider
PdfViewerProvider
SplitViewerProvider
FileSystemViewerProvider
UploadableFileViewerProvider
```

But a provider is not required for symmetry. It is required only for shared
state.

Provider responsibilities:

- normalize domain input;
- derive product projections;
- own controlled/uncontrolled domain state;
- expose hooks for related named parts;
- convert selected domain objects into viewer sources.

Provider non-responsibilities:

- layout;
- generic sidebar behavior;
- file rendering;
- browser file intake;
- compatibility with old slots.

## Email Viewer Ideal

Email is a recursive MIME document internally.

The visible UI is not the raw MIME tree. The visible UI is the user's task
projection:

```txt
Body
  Text body
  HTML body

Attachments
  contract.pdf
  sales.csv
  review-note.html
```

Ideal composition:

```tsx
<EmailViewerProvider message={message}>
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

Named exports:

```txt
EmailViewer
EmailViewerProvider
useEmailViewer
EmailViewerHeader
EmailViewerPartsList
EmailViewerSelectedPart
```

`EmailViewer` is the easy API. It is implemented from the named parts. It does
not have a second internal layout.

## PDF Viewer Ideal

The current PDF renderer is mature, but the ideal API should still speak the
same viewer grammar.

Ideal composition:

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

Named exports:

```txt
PdfViewer
PdfViewerProvider
usePdfViewer
PdfViewerHeader
PdfViewerThumbnails
PdfViewerPages
```

No public `slots.left`.

No public `slots.top`.

No public `PdfViewerSlots`.

If PDF needs a document legend, page rail, overlay, or search panel, those are
explicit children in the viewer grammar, not hidden keys in a slot object.

## Split Viewer Ideal

Split viewer is a workflow/layout composition, not a file renderer.

It owns split result state and coordinates segment navigation. It does not own
the document renderer.

Ideal composition:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot>
    <SplitViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerPageRail />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerLegend />
        <SplitViewerDocument>
          <PdfViewer source={source} />
        </SplitViewerDocument>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

This hierarchy is part of the contract:

- `SplitViewerHeader` spans the viewer title row above the body.
- `ViewerSidebar` is body-scoped, so the page rail starts below the header.
- `SplitViewerLegend` lives in `ViewerSurface` above the document, so the rail
  dominates the legend and document body rather than the header.

The same structure can be assembled manually from named parts:

```tsx
<SplitViewerProvider result={result}>
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

No hidden `renderDocument({ slots })` contract in the ideal API.

The document composition should be visible.

## File-System Viewer Ideal

File-system browsing is a domain composition over viewer primitives.

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

The selected file resolves to a `ViewerSource`.

`FileViewer` renders the selected source.

The file-system provider owns tree state, expanded folders, selection, and
source resolution.

## Uploadable Viewer Ideal

Dropzone is source acquisition, not viewer layout.

```txt
browser file intake
  -> useDropzone
  -> DropzoneFileItem
  -> ViewerSource
  -> FileViewer
```

Ideal composition:

```tsx
<UploadableFileViewerProvider accept=".pdf,image/*">
  <ViewerRoot>
    <UploadableFileViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <UploadableFileViewerSummary />
      </ViewerSidebar>
      <ViewerSurface>
        <UploadableFileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</UploadableFileViewerProvider>
```

`FileUploader` remains a standalone upload component for "collect files."

It should not be embedded wholesale into `ViewerSurface` by default.

## Leaf Renderers

Leaf renderers render known sources.

Examples:

```txt
FileViewer
PdfViewerPages
HtmlViewer
ImageViewer
CsvViewer
XlsxViewer
DocxViewer
PptxViewer
TextViewer
```

Leaf renderers do not own:

- sidebars;
- email selection;
- file-system selection;
- upload state;
- split pane state;
- MIME projection.

## Source Abstraction

The common abstraction is `ViewerSource`, not the acquisition path.

Different paths can produce the same source type:

```txt
uploaded file
  -> DropzoneFileItem
  -> ViewerSource

email attachment
  -> MIME part
  -> ViewerSource

file-system row
  -> file node
  -> ViewerSource

URL sample
  -> UrlViewerSource
```

Do not make dropzone, email, file-system, and samples share a fake universal
intake abstraction.

They only need to converge at `ViewerSource`.

## Naming Rules

Use separate named exports, matching shadcn style:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not use dotted APIs:

```txt
Viewer.Root
EmailViewer.Header
```

Do not use inheritance names:

```txt
EmailHeader extends ViewerHeader
PdfSidebar extends ViewerSidebar
```

Use composition names:

```txt
EmailViewerHeader
PdfViewerThumbnails
SplitViewerPageRail
UploadableFileViewerSummary
```

## Deletion List

In the ideal architecture, remove:

```txt
ViewerShell
ViewerShellSlots
ViewerSlots
PdfViewerSlots
slots.left
slots.right
slots.top
slots.bottom
slots.overlay
renderDocument({ slots })
```

Replace them with explicit JSX composition.

## Acceptance Tests

The architecture is correct when tests prove:

- every compound viewer renders one `ViewerRoot`;
- `ViewerHeader` is a sibling before `ViewerBody`;
- `ViewerSidebar` and `ViewerSurface` are siblings inside `ViewerBody`;
- `ViewerRoot` does not receive domain props;
- `FileViewer` does not receive upload/dropzone props;
- email sidebar shows a product projection, not the raw MIME tree;
- PDF thumbnails are explicit children, not `slots.left`;
- split legends and page rails are explicit children, not slot payloads;
- split legends render in `ViewerSurface`, while split page rails render in the
  body-scoped `ViewerSidebar`;
- `ViewerShell` is absent from public docs and implementation.

## Final Shape

The perfect viewer system has one sentence:

> Domain viewers compose explicit viewer primitives; leaf renderers render
> selected sources.

And one canonical tree:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```
