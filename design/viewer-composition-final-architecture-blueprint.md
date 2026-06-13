# Viewer Composition Final Architecture Blueprint

## Objective

Define the core composition architecture for the component library's document
viewer system.

The goal is to support complex viewers such as email, file-system browsing,
PDF thumbnail rails, split/partition sidebars, and future workflow viewers
without turning `FileViewer` into a universal provider or leaking raw domain
models directly into the UI.

## Position

The center of the architecture should be `ViewerShell`, not a global
`FileViewerProvider`.

`FileViewer` should remain a leaf renderer:

```tsx
<FileViewer source={source} bare />
```

Compound experiences should compose around it:

```tsx
<ViewerShell
  slots={{
    header: <DomainHeader />,
    left: <DomainNavigation />,
  }}
>
  <FileViewer source={selectedSource} bare />
</ViewerShell>
```

The correct model is:

```txt
domain model
  -> domain projection
  -> ViewerShell layout
  -> FileViewer / concrete viewer leaf rendering
```

Not:

```txt
FileViewerProvider
  -> every possible file, page, cell, sheet, segment, part, attachment state
```

## Architectural Layers

### 1. Renderer Layer

Renderers display one source or one loaded document format.

Examples:

- `FileViewer`
- `PdfViewer`
- `ImageViewer`
- `CsvViewer`
- `XlsxViewer`
- `DocxViewer`
- `PptxViewer`
- `TextViewer`
- `HtmlViewer` through the file-viewer route

Renderer responsibilities:

- parse/load/render the source;
- own format-specific mechanics;
- own format-specific toolbar commands;
- own format-specific errors and loading states;
- expose imperative handles where the format needs them;
- accept `bare` so a parent shell can own the surrounding frame.

Renderer non-responsibilities:

- MIME tree navigation;
- file-system browsing;
- extraction review panels;
- split/partition output semantics;
- arbitrary application sidebars;
- universal workflow state.

`FileViewer` remains the generic router for file-like leaves. It should not
become the owner of compound document workflows.

### 2. Shell Layer

`ViewerShell` is the layout primitive for compound document experiences.

It owns:

- full-width header;
- optional toolbar strip;
- left and right rails;
- top and bottom document strips;
- overlay slot;
- main content slot;
- border/background/overflow policy;
- responsive body direction.

It should not own:

- MIME parts;
- PDF pages;
- file-system paths;
- segment ranges;
- attachment semantics;
- source resolution;
- renderer commands.

Canonical shape:

```tsx
<ViewerShell
  slots={{
    header,
    left,
    right,
    top,
    bottom,
    overlay,
  }}
>
  {viewer}
</ViewerShell>
```

The most important structural rule:

```tsx
<header />
<div className="flex">
  <sidebar />
  <viewer />
</div>
```

The header should span the whole compound viewer when it describes the compound
document. The sidebar should sit beside the viewer below that header.

### 3. Domain Navigation Layer

Domain navigation components are sidebars or rails, but they are not the same
component.

Examples:

- `MimePartSidebar`
- `AttachmentSidebar`
- `PdfThumbnailSidebar`
- `SegmentSidebar`
- `SegmentPageRail`
- file-system preview/navigation panes

They may reuse `Sidebar` primitives for visual grammar, but each owns its own
domain model.

Rules:

- Do not push domain concepts into `Sidebar`.
- Do not make `SegmentSidebar` handle attachments.
- Do not make `AttachmentSidebar` handle recursive MIME.
- Do not make `PdfThumbnailSidebar` pretend to be a normal menu list.
- Do not expose raw recursive trees just because the data model is recursive.

The visual sidebar should be a product projection, not necessarily the raw
domain model.

### 4. Workflow / Domain Viewer Layer

Workflow viewers compose shell, navigation, and renderers.

Examples:

- `EmailViewer`
- `FileSystem`
- `SplitViewer`
- `PartitionViewer`
- `ClassifierViewer`
- `EditViewer`

They own:

- domain state;
- selection;
- source resolution;
- projection from domain model to UI surfaces;
- callbacks and controlled/uncontrolled behavior;
- wiring renderer handles to domain navigation.

They should not own:

- low-level PDF rendering;
- thumbnail generation internals;
- HTML sandboxing;
- CSV parsing;
- DOCX/PPTX/XLSX rendering.

## Projection Rule

The internal domain model can be rich, recursive, or technical. The visible UI
should be the simplest useful projection.

This is the main lesson from the email viewer.

Correct:

```txt
Internal MIME tree:
  multipart/mixed
    multipart/alternative
      text/plain
      multipart/related
        text/html
        image/svg+xml cid:logo
    application/pdf attachment
    text/csv attachment

Visible sidebar:
  Body
    Text body
    HTML body
  Attachments
    spacex-prospectus.pdf
    sales.csv
```

Wrong:

```txt
Visible sidebar:
  multipart/mixed
  multipart/alternative
  text/plain
  multipart/related
  text/html
  image/svg+xml cid:logo
  application/pdf
  text/csv
```

The raw model remains available internally for correctness. The UI should show
the user's conceptual task surface.

## Component-Specific Conclusions

### Email Viewer

Email is a recursive MIME document. The data model should be recursive.

The visible layout should be:

```tsx
<ViewerShell
  slots={{
    header: <MimeMessageHeader />,
    left: <MimePartSidebar />,
  }}
>
  <FileViewer source={selectedLeaf.source} bare />
</ViewerShell>
```

The sidebar should project MIME into:

- `Body`
- `Attachments`

It should not show multipart containers as first-class rows by default.
Inline CID resources should support HTML rendering but should not appear as
primary navigation unless an explicit advanced/debug mode exists.

The selected leaf viewer should take the full content area. Do not wrap it in a
second card or part header. The leaf viewer already has its own toolbar and
frame policy.

### File System

`FileSystem` is not a `FileViewer` provider. It is a browser/workspace.

It owns:

- toolbar;
- filtering;
- path navigation;
- list/grid/columns/gallery modes;
- selected item;
- preview pane;
- open dialog;
- lazy child loading;
- source resolution.

It uses `FileViewer` only to preview a selected file.

The file-system preview panel is a relationship panel, not a document-internal
rail. It should stay at the file-system layer.

### PDF Thumbnail Sidebar

`PdfThumbnailSidebar` is PDF-internal navigation.

It owns:

- PDF document thumbnail loading;
- page metrics;
- virtualized thumbnail rows;
- current-page following;
- page selection.

It should compose with `PdfViewer` through PDF slots or a future PDF compound
API. It should not be generalized into `AttachmentSidebar` or app `Sidebar`
semantics.

### Split / Partition Sidebar

Split and partition viewers are workflow/domain viewers.

They should:

- compute segment models;
- expose current-page and scroll-progress handlers;
- pass `slots.top` and `slots.left` into the document renderer;
- use `SegmentLegend`, `SegmentSidebar`, or `SegmentPageRail` as domain
  navigation.

They should not make PDF understand split semantics.

The current render-prop shape is directionally correct:

```tsx
<SplitViewer
  result={result}
  renderDocument={(handlers) => (
    <PdfViewer
      source={source}
      ref={handlers.setViewerHandle}
      slots={handlers.slots}
      onVisiblePageChange={handlers.onCurrentPageChange}
      onScrollProgressChange={handlers.onScrollProgressChange}
    />
  )}
/>
```

## Provider Guidance

Use providers for local compound APIs only when controls need to live outside
the renderer tree.

Good future PDF shape:

```tsx
<PdfViewer.Root source={source}>
  <PdfViewer.Toolbar />
  <PdfViewer.ThumbnailRail />
  <PdfViewer.Content />
</PdfViewer.Root>
```

Good shell shape:

```tsx
<ViewerShell slots={{ header, left }}>
  <FileViewer source={source} bare />
</ViewerShell>
```

Bad universal shape:

```tsx
<FileViewerProvider source={source}>
  <UniversalPageControls />
  <UniversalCellControls />
  <UniversalSheetControls />
  <UniversalMimeControls />
</FileViewerProvider>
```

Reason: file formats do not share one command surface.

- PDF has pages, rotation, fit width.
- CSV has rows, columns, active cells, sort.
- XLSX has sheets and cells.
- Image has fit/pan/frame semantics.
- Email has MIME parts.
- File system has paths and selection.

A universal provider would either be too weak or become a bag of optional
nullable APIs.

## Public API Direction

### ViewerShell

Keep small and structural.

```ts
type ViewerShellSlots = {
  header?: React.ReactNode
  toolbar?: React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
  top?: React.ReactNode
  bottom?: React.ReactNode
  overlay?: React.ReactNode
}
```

### FileViewer

Keep source-driven.

```ts
type FileViewerProps = {
  source: ViewerSource
  as?: FileCategory
  className?: string
  bare?: boolean
}
```

Do not add MIME, file-system, split, partition, or attachment-specific props.

### Domain Viewers

Expose domain-specific state and callbacks.

Email:

```ts
type EmailViewerProps = {
  message: MimeMessage
  selectedPath?: MimePartPath
  defaultSelectedPath?: MimePartPath
  onSelectedPathChange?: (path: MimePartPath, node: MimePartNode) => void
}
```

File system:

```ts
type FileSystemProps = {
  items: FileSystemItem[]
  selectedPath?: string | null
  onSelectionChange?: (item: FileSystemItem | null) => void
  resolveSource?: (...) => Promise<ViewerSource | null>
}
```

Split:

```ts
type SplitViewerProps = {
  result: SplitView | null
  renderDocument?: (handlers: SplitDocumentHandlers) => React.ReactNode
}
```

## Visual Rules

- Avoid nested cards around viewers.
- Let the selected leaf viewer fill the main content area.
- Use full-width compound headers for compound-document metadata.
- Put domain navigation beside the viewer below the header.
- Keep sidebar row alignment consistent; projected rows should not inherit
  hidden tree depth unless the UI is intentionally a tree.
- Use square thumbnails when the sidebar is a compact file navigator.
- Avoid gray sidebar backgrounds when the sidebar is part of a single viewer
  surface; use the same background unless there is a strong grouping reason.

## Testing Rules

Each domain viewer needs tests at both levels:

1. Model/projection tests.
2. Component composition tests.

Email examples:

- default body projection chooses HTML over text;
- CID resources resolve from `multipart/related`;
- inline CID resources do not appear in normal sidebar navigation;
- `Content-Disposition: attachment` stays selectable;
- sidebar shows `Body` and `Attachments`, not raw multipart containers;
- selected leaf renders through `FileViewer`;
- selected leaf takes full main content area without an extra part header.

File-system examples:

- selected file resolves to `ViewerSource`;
- preview pane uses `FileViewer`;
- gallery/list/grid modes do not duplicate source-rendering logic.

Split examples:

- segment rail receives current page and scroll progress;
- selecting a segment calls the PDF handle;
- slots stay document-attached, not workflow-specific props on PDF.

## Decision

The library should standardize around this sentence:

> Store the real domain model internally. Project it into the simplest useful
> UI. Compose with `ViewerShell`. Render leaves with `FileViewer`. Keep
> format-specific controls format-specific.

This gives the library enough structure for complex recursive and workflow
viewers without collapsing every domain into a single provider abstraction.
