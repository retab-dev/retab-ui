# Sources Viewer North Star: PDF Gold Standard Everywhere

## Verdict

`SourcesViewerBlock` has not reached the platonic ideal.

It works, and the interaction model is strong, but the visual hierarchy exposes
an architectural compromise:

```txt
Source format tabs
  outer source shell header
    source-data sidebar trigger
    Source-linked results
  document viewer header
    file position / title
    zoom
    rotate
    download
  source-data sidebar header
    Source-linked data
```

There are two visible header rows before the document body. The sidebar trigger
controls the correct right panel, but it lives one level above the row where a
user expects document-level controls to live. PDF can express the right shape;
the other viewers mostly cannot.

This blueprint is the north star and implementation plan to make the component
feel inevitable.

## Implementation Status

The first architecture cut is in place:

- `SourcesViewerBlock` no longer renders the old `Source-linked results` header.
- The first row under the format tabs is the real `FileViewerHeader`.
- The source-data sidebar trigger lives in that row.
- `SourceLinkedViewer` owns the source-data root boundary with `ViewerRoot`.
- File identity and header controls come from `FileViewerProvider`.
- PDF uses the canonical provider/page composition inside that root.
- Image, XLSX, and DOCX reuse the enclosing `FileViewerProvider` resource
  through their resource-content leaves.
- non-PDF renderers now register controls upward into `FileViewerControls`.

Remaining work before the ideal is complete:

- verify the source-data trigger in a hydrated block view and fix it if it
  remains disabled;
- extract first-class `TextViewerProvider` / `TextViewerDocument`;
- extract first-class `CsvViewerProvider` / `CsvViewerGrid`;
- finish public provider/document leaves for Image, XLSX, and DOCX instead of
  relying on resource-content helpers;
- remove all duplicate source ownership in Text and CSV tabs;
- add behavior coverage for the source-data trigger and every tab's source
  hover path.

## Platonic Ideal

The user-facing model is:

```txt
source document beside source-linked data
```

The implementation should express exactly that:

```tsx
<SourcesViewer>
  <SourceFormatTabs />

  <SourceLinkedViewer source={source} extraction={extraction}>
    <FileViewerHeader>
      <ViewerSidebarTrigger />
      <FileViewerTitle />
      <FileViewerMeta />
      <FileViewerControls />
    </FileViewerHeader>

    <FileViewerContent>
      <FileViewerSurface>
        <FormatDocument />
      </FileViewerSurface>

      <ViewerSidebar side="right">
        <SourcesForm />
      </ViewerSidebar>
    </FileViewerContent>
  </SourceLinkedViewer>
</SourcesViewer>
```

One root. One true file header row. One source-data sidebar. Format-specific
rendering only where format-specific rendering belongs.

## Non-Negotiables

- There must be one visible document header row per active tab.
- The source-data sidebar trigger must live in that row.
- The trigger must still control the source-data sidebar, not an unrelated
  nested sidebar root.
- Format-specific viewers must not own private top-level toolbar rows when used
  inside the sources viewer.
- File title, file metadata, and renderer controls must use the shared
  `FileViewerHeader` anatomy.
- Renderer leaves publish controls upward; headers render controls.
- No broad `headerConfig`, `toolbarConfig`, or sources-specific props in generic
  viewers.
- No compatibility shims, duplicate paths, or backward-compatible fallback
  branches.
- Easy APIs may remain, but they must be built from the same composed parts.

## PDF Gold Standard

PDF already demonstrates the correct public grammar:

```tsx
<FileViewer source={source} bare className="h-full">
  <PdfViewerProvider>
    <FileViewerHeader>
      <FileViewerSidebarTrigger className="-ml-1" />
      <FileViewerTitle />
      <FileViewerMeta />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerContent>
      <FileViewerSurface>
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerContent>
  </PdfViewerProvider>
</FileViewer>
```

The north star is not to make every renderer imitate PDF internals. The north
star is to make every file-backed renderer speak the same shell language:

```txt
FileViewer
  FormatViewerProvider
    FileViewerHeader
      optional sidebar trigger
      FileViewerTitle
      FileViewerMeta
      FileViewerControls
    FileViewerContent
      FileViewerSurface
        FormatDocument
```

## Current Architecture Gap

`SourcesViewerBlock` currently uses `SourcesShell`:

```txt
SourcesShell
  ViewerRoot
    ViewerHeader
      ViewerSidebarTrigger
      Source-linked results
    ViewerBody
      ViewerSurface
        child viewer
      ViewerSidebar side=right
        SourcesForm
```

The child viewer is different per tab:

```txt
PDF
  FileViewer
    PdfViewerProvider
      FileViewerHeader
      FileViewerContent
        PdfViewerPages

Image
  ImageViewer
    ImageViewerContent
      ViewerControls
      frame list

Text
  TextViewer
    PlainTextViewerFrame
      TextViewerContent
        TextViewerControls
        text canvas

CSV
  CsvViewer
    CsvViewerFrame
      CsvViewerHeader
      CsvGrid

XLSX
  XlsxViewer
    XlsxViewerSession
      ViewerControls
      workbook body
      sheet tabs

DOCX
  DocxViewer
    DocxViewerContent
      ViewerControls
      docx body
```

This violates consistency. Same product concept, different component
boundaries.

## Target Components

### `SourceLinkedViewer`

`SourceLinkedViewer` is the source-panel composition root. It owns one
`ViewerRoot`, one right sidebar, and no decorative header.

```tsx
function SourceLinkedViewer({
  children,
  extraction,
  link,
}: {
  children: React.ReactNode
  extraction: SourceExtraction
  link: SegmentedSourceFieldLink
}) {
  return (
    <ViewerRoot bare defaultOpen className="h-full bg-background">
      <ViewerBody>
        {children}
        <ViewerSidebar
          aria-label="Source-linked fields"
          side="right"
          width="420px"
          className="flex flex-shrink-0 flex-col border-l"
        >
          <SourcesForm extraction={extraction} link={link} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  )
}
```

It replaces the visible `SourcesShell` header. The active format viewer supplies
the single file header row.

### `SourceLinkedFileHeader`

Every tab should use the same header anatomy:

```tsx
function SourceLinkedFileHeader() {
  return (
    <FileViewerHeader>
      <ViewerSidebarTrigger className="-ml-1" />
      <FileViewerTitle />
      <FileViewerMeta />
      <FileViewerControls />
    </FileViewerHeader>
  )
}
```

Use `ViewerSidebarTrigger`, not `FileViewerSidebarTrigger`, when the source-data
sidebar belongs to the outer `SourceLinkedViewer` root.

### Format Leaves

Each format should expose one leaf that renders document content and registers
viewer controls:

```txt
PdfViewerPages
ImageViewerFrames
TextViewerDocument
CsvViewerGrid
XlsxViewerWorkbook
DocxViewerDocument
```

The leaf owns rendering. The provider/session owns state. The header owns
visible controls.

## The Hard Part: Root Ownership

The sidebar trigger must be inside the same `ViewerRoot` context as the
source-data sidebar.

That means this is wrong:

```tsx
<ViewerRoot>
  <FileViewer>
    <FileViewerHeader>
      <ViewerSidebarTrigger />
    </FileViewerHeader>
  </FileViewer>
  <ViewerSidebar side="right" />
</ViewerRoot>
```

The trigger may bind to the nested `FileViewer` root instead of the source-data
sidebar root.

The correct shape is:

```tsx
<ViewerRoot>
  <FileViewerProvider source={source}>
    <FormatViewerProvider>
      <FileViewerHeader>
        <ViewerSidebarTrigger />
        <FileViewerTitle />
        <FileViewerMeta />
        <FileViewerControls />
      </FileViewerHeader>
      <ViewerBody>
        <ViewerSurface>
          <FormatDocument />
        </ViewerSurface>
        <ViewerSidebar side="right" />
      </ViewerBody>
    </FormatViewerProvider>
  </FileViewerProvider>
</ViewerRoot>
```

If `FileViewer` creates a `ViewerRoot`, then the source-data sidebar must be
inside that same root. If `SourceLinkedViewer` creates the `ViewerRoot`, use
`FileViewerProvider` for file scope instead of `FileViewer`.

For `SourcesViewerBlock`, one outer `ViewerRoot` is the precise boundary.

## Immediate Implementation Strategy

Do the north-star architecture directly, but sequence it to keep each cut small.

### Step 1: Extract `SourceLinkedViewer`

Replace `SourcesShell` with a root that owns only:

- `ViewerRoot`
- `ViewerBody`
- right `ViewerSidebar`
- `SourcesForm`

Remove the visible `ViewerHeader` containing `Source-linked results`.

Keep the current tab children temporarily.

### Step 2: Convert PDF Tab First

Make PDF prove the correct root boundary:

```tsx
<SourceLinkedViewer extraction={PDF_EXTRACTION} link={link}>
  <FileViewerProvider source={PDF_SOURCE}>
    <PdfViewerProvider>
      <FileViewerHeader>
        <ViewerSidebarTrigger className="-ml-1" />
        <FileViewerTitle />
        <FileViewerMeta />
        <FileViewerControls />
      </FileViewerHeader>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </PdfViewerProvider>
  </FileViewerProvider>
</SourceLinkedViewer>
```

This verifies:

- the trigger controls the right source-data sidebar;
- file title/meta/controls still work;
- PDF controls still register upward;
- no nested root steals sidebar context.

### Step 3: Add Viewer Control Registration To Non-PDF Leaves

For each non-PDF viewer, replace private header-row rendering with control
registration when used in composed mode.

Target internal rule:

```txt
easy API
  renders FileViewerProvider + FileViewerHeader + leaf

composed API
  provider + leaf only
  leaf registers controls
```

Do not add a quick `controlsLeading` prop as the final architecture. A
`controlsLeading` prop is acceptable only as a temporary local bridge if a cut
must be split, and it should be removed in the same migration chain.

### Step 4: Migrate Image

Image is the smallest proof after PDF.

Create:

```txt
ImageViewerProvider
ImageViewerFrames
```

Move or expose:

- frame source loading;
- frame source lease;
- current frame label;
- scale;
- rotation;
- zoom handlers;
- download action;
- frame virtualization;
- imperative handle.

`ImageViewerFrames` registers:

```tsx
useViewerControlsRegistration({
  position: { label: countLabel },
  zoom,
  rotate,
  downloads,
})
```

`ImageViewer` easy API becomes composed from provider + header + frames.

### Step 5: Migrate DOCX

DOCX is close to PDF in user controls: page position, zoom, download.

Create:

```txt
DocxViewerProvider
DocxViewerDocument
```

Move or expose:

- document buffer resource;
- render lifecycle;
- render index;
- current page;
- page count;
- scale;
- fit-width/zoom handlers;
- download action;
- imperative handle.

`DocxViewerDocument` registers controls when ready. Loading state should still
surface in the single file header, not through a private skeleton row.

### Step 6: Migrate XLSX

Create:

```txt
XlsxViewerProvider
XlsxViewerWorkbook
```

Keep sheet tabs in the body, below the content surface. They are workbook body
chrome, not file header chrome.

Register:

- active sheet name;
- row x column subtitle;
- loading state;
- zoom handlers;
- download actions.

### Step 7: Migrate Text

Create:

```txt
TextViewerProvider
TextViewerDocument
```

Move or expose:

- resource/retry lifecycle from `PlainTextViewerFrame`;
- prepared document;
- mode;
- font scale;
- virtual viewport;
- highlight range;
- copy action;
- download action;
- imperative handle.

`TextViewerControls` can remain as an internal control-state builder, but it
must not render a visible row in composed mode.

### Step 8: Migrate CSV

CSV has inline text/table source modes, so migrate it last.

Create:

```txt
CsvViewerProvider
CsvViewerGrid
```

For file-backed sources, use `FileViewerProvider` and the canonical header.
For inline text/table sources, keep a standalone root only if there is no file
resource to own title/meta/downloads.

Register:

- row count title;
- column count subtitle;
- loading state;
- zoom handlers;
- export/download actions.

### Step 9: Rewrite `SourcesViewerBlock`

After each format can use the canonical anatomy, every tab should have the same
top-level shape:

```tsx
<SourceLinkedViewer extraction={extraction} link={link}>
  <FileViewerProvider source={source}>
    <FormatViewerProvider>
      <SourceLinkedFileHeader />
      <ViewerSurface>
        <FormatDocument />
      </ViewerSurface>
    </FormatViewerProvider>
  </FileViewerProvider>
</SourceLinkedViewer>
```

The only differences across tabs should be:

- source object;
- extraction data;
- segmented document model;
- format provider;
- format document leaf;
- source-target adapter.

## Per-Viewer Target Shapes

### PDF

```tsx
<FileViewerProvider source={PDF_SOURCE}>
  <PdfViewerProvider>
    <SourceLinkedFileHeader />
    <ViewerSurface>
      <PdfViewerPages />
    </ViewerSurface>
  </PdfViewerProvider>
</FileViewerProvider>
```

### Image

```tsx
<FileViewerProvider source={IMAGE_SOURCE}>
  <ImageViewerProvider>
    <SourceLinkedFileHeader />
    <ViewerSurface>
      <ImageViewerFrames />
    </ViewerSurface>
  </ImageViewerProvider>
</FileViewerProvider>
```

### Text

```tsx
<FileViewerProvider source={TEXT_SOURCE}>
  <TextViewerProvider mode="text">
    <SourceLinkedFileHeader />
    <ViewerSurface>
      <TextViewerDocument />
    </ViewerSurface>
  </TextViewerProvider>
</FileViewerProvider>
```

### CSV

```tsx
<FileViewerProvider source={CSV_SOURCE}>
  <CsvViewerProvider>
    <SourceLinkedFileHeader />
    <ViewerSurface>
      <CsvViewerGrid />
    </ViewerSurface>
  </CsvViewerProvider>
</FileViewerProvider>
```

### XLSX

```tsx
<FileViewerProvider source={XLSX_SOURCE}>
  <XlsxViewerProvider>
    <SourceLinkedFileHeader />
    <ViewerSurface>
      <XlsxViewerWorkbook />
    </ViewerSurface>
  </XlsxViewerProvider>
</FileViewerProvider>
```

### DOCX

```tsx
<FileViewerProvider source={DOCX_SOURCE}>
  <DocxViewerProvider>
    <SourceLinkedFileHeader />
    <ViewerSurface>
      <DocxViewerDocument />
    </ViewerSurface>
  </DocxViewerProvider>
</FileViewerProvider>
```

## Naming Rules

Use the same concept name everywhere:

```txt
source
extraction
link
provider
document
surface
sidebar
controls
```

Avoid:

```txt
toolbar
chrome
headerConfig
actions
panelTrigger
resultsHeader
shellHeader
```

Preferred public names:

```txt
SourceLinkedViewer
SourceLinkedFileHeader
SourcesForm

ImageViewerProvider
ImageViewerFrames
TextViewerProvider
TextViewerDocument
CsvViewerProvider
CsvViewerGrid
XlsxViewerProvider
XlsxViewerWorkbook
DocxViewerProvider
DocxViewerDocument
```

## Tests

Architecture tests should enforce:

- `SourcesViewerBlock` does not render the old `Source-linked results` outer
  header.
- `SourcesViewerBlock` renders exactly one visible file header row per tab.
- The source-data `ViewerSidebarTrigger` appears before `FileViewerTitle` and
  `FileViewerControls`.
- The source-data sidebar and trigger share the same `ViewerRoot`.
- Non-PDF composed leaves do not render private top-level `ViewerControls`
  rows.
- Easy APIs are composed from the same provider/header/document parts.
- File-backed format providers do not accept duplicate `source` props when
  inside `FileViewerProvider`.
- `Source-linked data` remains the right sidebar header.

Behavior tests should verify:

- clicking the header trigger collapses and expands the right source-data
  panel;
- file zoom/download controls still work after the trigger moves;
- source hover still highlights and scrolls the source document;
- switching tabs preserves mounted tab state;
- PDF/Image/Text/CSV/XLSX/DOCX all keep their current source-link behavior.

Visual verification should cover:

- desktop width;
- narrow viewport overlay sidebar mode;
- every tab;
- loading/skeleton states where available.

## Acceptance Criteria

The component reaches the ideal when:

- the first row under format tabs is the real file header;
- the sidebar trigger, file identity, and file controls live in that row;
- there is no extra outer "results" header;
- the right panel still has its own `Source-linked data` header;
- every tab uses the same anatomy;
- format-specific code owns only format-specific behavior;
- file source ownership is single and obvious;
- controls registration is the only path for renderer controls in composed
  file-backed viewers;
- the code reads as the product reads: source document beside source-linked
  data.

## Implementation Warning

Do not stop at moving icons.

Moving the trigger visually without fixing root ownership will create a fake
solution: the button may bind to the wrong sidebar root, or the component will
depend on accidental context behavior.

The correct implementation starts with the root boundary:

```txt
one SourceLinkedViewer root
one right source-data sidebar
file scope via FileViewerProvider
format state via FormatViewerProvider
format document leaf registers controls upward
```

That is the smallest shape that can become perfect.
