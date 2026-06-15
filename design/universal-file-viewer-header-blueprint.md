# Universal File Viewer Header Blueprint

## Question

Can the viewer system converge toward a universal, type-agnostic `FileViewer`
that knows how to render the right title, metadata, toolbar, and actions for any
file type, while still allowing domain viewers such as split, partition, OCR,
sources, email, and edit to compose around it?

## Position

Yes.

The universal `FileViewer` should become the center for **file rendering** and
**file chrome**.

It should not become the center for every document workflow.

The right boundary is:

```txt
ViewerRoot
  layout, sidebar state, trigger context

FileViewer
  file type detection, file header, file toolbar, file rendering

SegmentedDocument / domain providers
  split, partition, OCR, extraction, source evidence, email MIME, edit fields
```

This gives us one top file header everywhere without turning `FileViewer` into a
giant domain abstraction.

## Current Problem

Many composed viewers currently produce stacked header chrome:

```tsx
<ViewerRoot>
  <PdfViewerHeader />
  <PartitionViewerHeader />
  <ViewerBody />
</ViewerRoot>
```

This reads as two headers:

1. a file/document toolbar;
2. a domain header or legend.

The desired hierarchy is:

```tsx
<ViewerRoot>
  <FileViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The sidebar trigger should live inside the file header:

```tsx
<FileViewerHeader>
  <ViewerSidebarTrigger />
  ...
</FileViewerHeader>
```

The legend, ribbon, page rail, MIME part list, field list, and source evidence
should live below that header as body/surface/sidebar content.

## Shadcn Reading

The shadcn sidebar pattern is:

```tsx
<SidebarProvider>
  <AppSidebar />
  <SidebarInset>
    <header>
      <SidebarTrigger />
      ...
    </header>
    <main />
  </SidebarInset>
</SidebarProvider>
```

The trigger is a free primitive. It works because it reads provider context. It
is not owned by the header, sidebar, or app shell.

The analogous viewer pattern is:

```tsx
<ViewerRoot>
  <FileViewerHeader>
    <ViewerSidebarTrigger />
    <FileViewerHeaderTitle />
    <FileViewerHeaderMeta />
    <FileViewerHeaderToolbar />
  </FileViewerHeader>

  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

This is more shadcn-like than a prop such as:

```tsx
<PdfViewerHeader showSidebarTrigger />
```

The trigger should remain a primitive.

The header should expose anatomy.

## Core Primitive Shape

The universal file viewer should be decomposable:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileViewerHeader>
      <ViewerSidebarTrigger />
      <FileViewerHeaderTitle />
      <FileViewerHeaderMeta />
      <FileViewerHeaderToolbar />
    </FileViewerHeader>

    <ViewerBody>
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

The easy API remains:

```tsx
<FileViewer source={source} />
```

The composed API is the important one for domain viewers.

## Header Anatomy

The vocabulary should stay small.

### `FileViewerHeader`

The single top chrome row for a file-backed viewer.

It should render `ViewerHeader` internally and provide spacing, alignment,
border, and overflow behavior.

It should not know about split, partition, OCR, extraction, email, edit, or file
system semantics.

### `FileViewerHeaderTitle`

The identity of the viewed file.

Examples:

```txt
harris_2023_federal_state_returns.pdf
review-note.html
Northstar Foods contract.eml
```

It answers:

```txt
what am I looking at?
```

### `FileViewerHeaderMeta`

Passive facts about the file or the active file renderer.

Examples:

```txt
40 pages
application/pdf · 1.2 MB
text/html · 2.1 KB
Sheet 2 of 5
```

It answers:

```txt
what useful context describes it?
```

### `FileViewerHeaderToolbar`

The type-specific viewer toolbar.

Examples:

```txt
PDF: page, zoom, fit, rotate, download
Image: zoom, fit, rotate, download
Text: copy, wrap, zoom, download
Spreadsheet: sheet, zoom, download
HTML: zoom, download
```

It answers:

```txt
how do I manipulate the current file view?
```

### `ViewerSidebarTrigger`

The layout/sidebar toggle.

It should remain generic:

```tsx
<ViewerSidebarTrigger />
```

It answers:

```txt
show or hide the viewer sidebar
```

It should not become `FileViewerSidebarTrigger`, `PdfSidebarTrigger`, or
`SplitSidebarTrigger`.

## Type-Agnostic Responsibilities

`FileViewer` should own:

- source normalization;
- resource creation;
- descriptor resolution;
- type detection;
- file title;
- file category;
- file size / MIME metadata when available;
- original download action;
- type-specific renderer selection;
- type-specific default toolbar;
- loading states;
- error states;
- unsupported file states.

It may expose narrow state through named parts, but it should not expose a broad
public context hook.

## Type-Specific Responsibilities

Each concrete renderer should own the controls that are truly renderer-specific.

PDF owns:

- current page;
- page count;
- zoom;
- fit width;
- rotation;
- document handle;
- page-area scroll.

Image owns:

- zoom;
- fit;
- rotation if supported.

Text/code owns:

- copy;
- wrap if supported;
- zoom or font size if supported.

Spreadsheet owns:

- active sheet;
- sheet count;
- grid navigation if supported.

The universal file header should consume a normalized toolbar model from the
active renderer. It should not hard-code PDF state into `FileViewer`.

## Toolbar Registration Model

The PDF viewer already points toward the right shape with viewport registration.

The generalized pattern is:

```txt
FileViewerProvider
  owns resource and file descriptor

FileViewerContent
  mounts the active renderer

active renderer
  registers toolbar controls upward

FileViewerHeaderToolbar
  renders the registered controls
```

Conceptually:

```ts
type FileViewerToolbarState = {
  position?: ViewerToolbarPosition | null
  zoom?: ViewerToolbarZoom | null
  rotate?: ViewerToolbarRotate | null
  downloads?: ViewerDownloadAction[]
  extra?: React.ReactNode
}
```

This type should remain about generic toolbar capabilities, not file domains.

Good:

```txt
position
zoom
rotate
download
copy
fit
```

Bad:

```txt
partitionMode
splitSegments
ocrFields
emailMimeParts
extractionSchema
```

## Domain Viewer Composition

Domain viewers should wrap file viewing, not replace it.

### Split

```tsx
<SplitViewerProvider result={result}>
  <FileViewerProvider source={source}>
    <ViewerRoot defaultOpen>
      <FileViewerHeader>
        <ViewerSidebarTrigger />
        <FileViewerHeaderTitle />
        <SplitViewerHeaderMeta />
        <FileViewerHeaderToolbar />
      </FileViewerHeader>

      <ViewerBody>
        <ViewerSidebar>
          <SplitViewerPageRail />
        </ViewerSidebar>

        <ViewerSurface>
          <SplitViewerLegend />
          <FileViewerContent />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </FileViewerProvider>
</SplitViewerProvider>
```

Split owns:

- split result;
- segment model;
- page rail;
- legend;
- segment interaction;
- scroll synchronization.

FileViewer owns:

- PDF rendering;
- file title;
- PDF page/zoom/download toolbar.

### Partition

```tsx
<PartitionViewerProvider result={result}>
  <FileViewerProvider source={source}>
    <ViewerRoot>
      <FileViewerHeader>
        <ViewerSidebarTrigger />
        <FileViewerHeaderTitle />
        <PartitionViewerHeaderMeta />
        <FileViewerHeaderToolbar />
      </FileViewerHeader>

      <ViewerBody>
        <ViewerSurface>
          <PartitionViewerLegend />
          <PartitionViewerRibbon />
          <FileViewerContent />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </FileViewerProvider>
</PartitionViewerProvider>
```

Partition owns:

- output rows;
- vote rows;
- legend segments;
- ribbon;
- semantic partition interaction.

FileViewer owns the file.

### Email

Email is different because the first-class object is a MIME document, not a
single flat file.

The email viewer should still use file viewer for selected MIME parts:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
    <EmailViewerHeader>
      <ViewerSidebarTrigger />
      <EmailViewerTitle />
      <EmailViewerMeta />
    </EmailViewerHeader>

    <ViewerBody>
      <ViewerSidebar>
        <EmailPartsSidebar />
      </ViewerSidebar>

      <ViewerSurface>
        <FileViewerProvider source={selectedPartSource}>
          <FileViewerHeader>
            <FileViewerHeaderTitle />
            <FileViewerHeaderMeta />
            <FileViewerHeaderToolbar />
          </FileViewerHeader>
          <FileViewerContent />
        </FileViewerProvider>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

Email owns MIME hierarchy.

FileViewer owns the selected part rendering.

This is the one place where nested file headers can be legitimate, because the
outer object is an email and the inner object is an attachment/body part.

## Anti-Goals

Do not make `FileViewer` accept domain props:

```tsx
<FileViewer
  source={source}
  segments={segments}
  partition={partition}
  ocr={ocr}
  extraction={extraction}
  emailParts={parts}
/>
```

That would turn file rendering into a workflow blob.

Do not add type-specific boolean props to generic headers:

```tsx
<FileViewerHeader showPdfControls showSegmentCount showSidebarTrigger />
```

That is not shadcn-like.

Do not make every domain viewer render a competing top `ViewerHeader`.

Domain viewers can provide header metadata or body content, but the file header
should be the single top row when the primary object is a file.

## What Is Possible Now

The current primitives already allow:

- `ViewerSidebarTrigger` inside any header under the same `ViewerRoot`;
- a single `ViewerRoot` with one top header;
- body-scoped sidebars;
- domain content inside `ViewerSidebar` or `ViewerSurface`;
- `FileViewerProvider` plus `FileViewerContent` composition;
- `PdfViewerProvider` plus `PdfViewerPages` composition.

## What Is Not Clean Yet

The current header APIs are not anatomical enough.

`FileViewerHeader` and `PdfViewerHeader` accept `children`, but `children`
replace the whole default header.

That means this is possible:

```tsx
<PdfViewerHeader>
  <ViewerSidebarTrigger />
  <span>51 segments</span>
</PdfViewerHeader>
```

But it loses the default PDF toolbar unless the consumer rebuilds it manually.

The missing piece is first-class header anatomy:

```tsx
<FileViewerHeader>
  <ViewerSidebarTrigger />
  <FileViewerHeaderTitle />
  <FileViewerHeaderMeta />
  <FileViewerHeaderToolbar />
</FileViewerHeader>
```

## Final API Direction

The clean target is:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot defaultOpen>
    <FileViewerHeader>
      <ViewerSidebarTrigger />
      <FileViewerHeaderTitle />
      <FileViewerHeaderMeta />
      <FileViewerHeaderToolbar />
    </FileViewerHeader>

    <ViewerBody>
      <ViewerSidebar />
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

The easy target is:

```tsx
<FileViewer source={source} />
```

The easy API should be assembled from the same parts.

## Naming Rules

Use `FileViewer` for the complete file experience.

Use `FileViewerProvider` for file descriptor/resource/header state.

Use `FileViewerContent` for the selected renderer.

Use `FileViewerHeader` for the single top file chrome row.

Use `FileViewerHeaderTitle`, `FileViewerHeaderMeta`, and
`FileViewerHeaderToolbar` only if the anatomy proves necessary.

Avoid:

```txt
FileViewerShell
FileViewerFrame
FileViewerChrome
PdfHeaderControls as public universal API
showSidebarTrigger props
partitionMode props
splitMode props
```

## Implementation Sequence

1. Define the file header model.

   It should include file identity, passive metadata, download actions, and an
   optional registered toolbar state from the active renderer.

2. Split `FileViewerHeader` into anatomy.

   Keep the default header easy to use, but allow reconstruction from named
   parts.

3. Generalize toolbar registration.

   Start from PDF viewport controls, but rename the transport away from PDF if
   it becomes shared.

4. Make `FileViewerContent` register the active renderer toolbar.

   PDF registers page/zoom/rotate/download.

   Other renderers can register only what they support.

5. Rebuild `FileViewer` easy API from provider + header + body + content.

6. Recompose split and partition around `FileViewerHeader`.

   Remove competing top `ViewerHeader` rows.

7. Keep email explicit.

   Email can have an outer email header and an inner file header for selected
   attachments/body parts.

## Acceptance Criteria

- A PDF file can render with one top header.
- A split viewer can render with one top file header and a sidebar trigger
  inside it.
- A partition viewer can render with one top file header and no stacked
  `PdfViewerHeader` + `PartitionViewerHeader`.
- The file header can show file title, passive metadata, toolbar controls, and
  file actions without custom rebuilding.
- `ViewerSidebarTrigger` remains a generic viewer primitive.
- `FileViewer` does not import split, partition, OCR, sources, email, edit, or
  file-system modules.
- Domain viewers do not need to rebuild PDF toolbar internals.
- Public docs teach anatomy composition, not boolean prop switches.
- Architecture tests prevent domain props from entering `FileViewer`.

## Platonic Test

The design is good when this feels inevitable:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileViewerHeader>
      <ViewerSidebarTrigger />
      <FileViewerHeaderTitle />
      <DomainHeaderMeta />
      <FileViewerHeaderToolbar />
    </FileViewerHeader>

    <ViewerBody>
      <DomainSidebar />
      <ViewerSurface>
        <DomainSurfaceChrome />
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

And this feels obviously wrong:

```tsx
<FileViewer
  source={source}
  split={split}
  partition={partition}
  ocr={ocr}
  sources={sources}
/>
```

The first is composition.

The second is a junk drawer.

