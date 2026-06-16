# Shadcn File Header Anatomy Blueprint

## Question

How should the viewer system model the file header if the goal is a
shadcn-grade primitive: small public anatomy, expressive composition, no bloated
configuration object, and no duplicate header chrome?

The concrete product pressure is:

```txt
There should be one top file header.
The sidebar trigger should be embedded in that header.
The file title, file metadata, and file controls should live in that same row.
Domain legends, segment summaries, thumbnails, ribbons, attachments, and field
lists should live below the header, inside the body or sidebar.
```

## Position

Yes, this is possible.

The right design is not a bigger `PdfViewerHeader`, not a domain-specific
`SplitViewerHeader`, and not a `headerConfig` prop.

The right design is a single file-header anatomy:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

That is the shadcn-like shape.

The trigger remains a viewer primitive.
The title, metadata, and controls remain file-viewer primitives.
The file renderer privately publishes its controls upward.
The consumer composes the pieces in the only header row.

## Shadcn Reading

### Sidebar Lesson

`Sidebar` is not simple internally.

It owns:

- provider state;
- controlled and uncontrolled open state;
- mobile open state;
- a trigger;
- keyboard shortcuts;
- persistence;
- data attributes;
- CSS variables;
- accessibility wiring.

But the public shape is simple:

```tsx
<SidebarProvider>
  <Sidebar />
  <SidebarInset>
    <SidebarTrigger />
    {children}
  </SidebarInset>
</SidebarProvider>
```

The important idea is that `SidebarTrigger` is portable. It can be placed where
the layout needs it. It is not a prop on the sidebar and not a prop on the
header.

The viewer equivalent is:

```tsx
<ViewerRoot>
  <FileHeader>
    <ViewerSidebarTrigger />
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>

  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

`ViewerSidebarTrigger` should stay portable for exactly the same reason
`SidebarTrigger` is portable.

### Field Lesson

`Field` is anatomy, not configuration.

The shape is conceptually:

```tsx
<Field>
  <FieldLabel />
  <Input />
  <FieldDescription />
  <FieldError />
</Field>
```

The names are concrete. They describe visible parts, not implementation
machinery.

The file header should follow that same discipline:

```txt
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
```

Avoid words that are too generic or too theoretical:

```txt
FileHeaderSlot
FileHeaderRegion
FileHeaderActions
FileHeaderToolbar
FileHeaderRender
FileHeaderChrome
```

`Controls` is the right word because users read the row as operations on the
current file view.

## Final Public Vocabulary

The public file-viewer vocabulary should be:

```txt
FileViewer
FileViewerProvider
FileViewerContent

FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
```

The public viewer-layout vocabulary should be:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
```

These two vocabularies compose. They should not be merged.

## Canonical Shape

The easy shape:

```tsx
<FileViewer source={source} />
```

The composed shape:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileHeader>
      <ViewerSidebarTrigger />
      <FileHeaderTitle />
      <FileHeaderMeta />
      <FileHeaderControls />
    </FileHeader>

    <ViewerBody>
      <ViewerSidebar>
        {sidebar}
      </ViewerSidebar>

      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

That should be enough for:

- PDF thumbnails;
- split viewer;
- partition viewer;
- OCR/source evidence;
- email MIME attachments;
- edit fields;
- upload/dropzone selected-file preview.

## What Is Possible

### One Header

This is possible:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

The file controls row should not be nested under a domain header.

Bad hierarchy:

```tsx
<DomainHeader />
<FileHeader />
<ViewerBody />
```

Good hierarchy:

```tsx
<FileHeader />
<ViewerBody />
```

If the domain has a legend, count, confidence, ribbon, tabs, or instructions,
that content belongs in the body or sidebar, not as a second top header.

### Inner Sidebar Trigger

This is possible:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

The trigger can be anywhere under `ViewerRoot` because it reads viewer sidebar
state from context.

That is exactly the shadcn pattern.

### Type-Agnostic File Controls

This is possible:

```tsx
<FileHeaderControls />
```

The header does not need to know whether the current file is PDF, HTML, image,
CSV, XLSX, Markdown, text, or code.

The active renderer can publish a normalized control state:

```ts
type ViewerControlsState = {
  position?: ViewerControlPosition | null
  zoom?: ViewerZoomControl | null
  rotate?: ViewerRotateControl | null
  downloads?: ViewerDownloadAction[]
  extra?: React.ReactNode
}
```

`FileHeaderControls` renders that state.

### Domain Composition

This is possible:

```tsx
<SegmentedDocumentProvider model={model}>
  <FileViewerProvider source={source}>
    <ViewerRoot>
      <FileHeader>
        <ViewerSidebarTrigger />
        <FileHeaderTitle />
        <FileHeaderMeta />
        <FileHeaderControls />
      </FileHeader>

      <ViewerBody>
        <ViewerSidebar>
          <SegmentedLegend />
        </ViewerSidebar>

        <ViewerSurface>
          <FileViewerContent />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </FileViewerProvider>
</SegmentedDocumentProvider>
```

The domain provider owns domain state.
The file provider owns file state.
The viewer root owns layout state.

This is acceptable because each provider owns a different axis.

## What Is Not Possible

### A Header That Magically Knows Every Domain

This should not exist:

```tsx
<FileHeader
  splitMode
  partitionMode
  ocrMode
  showSegmentLegend
  showVotes
  showMimeParts
/>
```

That would make `FileHeader` a domain registry.

### A File Provider That Owns Every Renderer State

This should not exist:

```ts
type FileViewerContext = {
  pdfPage: number
  pdfScale: number
  sheetName: string
  csvWrap: boolean
  imageRotation: number
  markdownMode: string
  htmlSandbox: string
}
```

The file provider should coordinate file identity and header controls. It should
not absorb every renderer's internal state.

### A File-Specific Sidebar Trigger

This should not exist:

```tsx
<FileViewerSidebarTrigger />
<PdfSidebarTrigger />
<SplitSidebarTrigger />
```

There is one layout primitive:

```tsx
<ViewerSidebarTrigger />
```

### A Prop-Based Header Slot API

This should not be the main API:

```tsx
<FileViewer
  headerStart={<ViewerSidebarTrigger />}
  headerTitle={<FileHeaderTitle />}
  headerMeta={<FileHeaderMeta />}
  headerControls={<FileHeaderControls />}
/>
```

That shape looks convenient, but it moves composition into props. shadcn usually
prefers visible JSX anatomy when the object has stable parts.

## The Control Registration Question

The only imperfect-looking part is the private registration channel:

```ts
const registerControls = useViewerControlsRegistration()
```

A renderer mounts, computes its controls, and registers them upward so
`FileHeaderControls` can render them.

This is slightly imperative because it depends on a lifecycle:

```txt
renderer mounts
renderer registers controls
header receives controls
renderer unmounts
renderer clears controls
```

But this does not violate shadcn philosophy if it stays private.

`Sidebar` also has internal state machinery, effects, persistence, and context.
The user does not experience that machinery as API. The same should be true
here.

The imperative bridge is acceptable only if:

1. users do not import it for normal composition;
2. stale registrations cannot clear newer controls;
3. controls clear when the descriptor changes;
4. the fallback download still works when no renderer controls are registered;
5. domain viewers never configure renderer controls manually.

## Why Not Make Controls Fully Declarative

The tempting alternative is:

```tsx
<FileHeaderControls controls={pdfControls} />
```

or:

```tsx
<FileViewerProvider controls={controls}>
```

That is worse.

It makes the parent responsible for renderer-specific state. The parent would
need to know PDF page state, XLSX sheets, image transforms, CSV wrapping, and
HTML behavior.

The renderer is the only component that naturally knows its own controls.

So the ideal is:

```txt
renderer owns semantics
file provider owns coordination
file header owns placement
viewer root owns layout
```

## Split Viewer Shape

Split should not have a second header.

The ideal shape:

```tsx
<SegmentedDocumentProvider model={splitModel}>
  <FileViewerProvider source={pdfSource}>
    <ViewerRoot>
      <FileHeader>
        <ViewerSidebarTrigger />
        <FileHeaderTitle />
        <FileHeaderMeta />
        <FileHeaderControls />
      </FileHeader>

      <ViewerBody>
        <ViewerSidebar>
          <SplitLegend />
        </ViewerSidebar>

        <ViewerSurface>
          <FileViewerContent />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </FileViewerProvider>
</SegmentedDocumentProvider>
```

If split needs to show `6 sections`, that belongs in the sidebar or the legend
content, not in a top header competing with the file header.

## PDF Thumbnail Shape

PDF thumbnails should use the same anatomy:

```tsx
<FileViewerProvider source={pdfSource}>
  <PdfViewerProvider>
    <ViewerRoot>
      <FileHeader>
        <ViewerSidebarTrigger />
        <FileHeaderTitle />
        <FileHeaderMeta />
        <FileHeaderControls />
      </FileHeader>

      <ViewerBody>
        <ViewerSidebar>
          <PdfThumbnailSidebar />
        </ViewerSidebar>

        <ViewerSurface>
          <FileViewerContent />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </PdfViewerProvider>
</FileViewerProvider>
```

The sidebar trigger toggles thumbnails because thumbnails are the registered
viewer sidebar.

The header controls stay file controls.

## Partition Viewer Shape

Partition should not put its legend above the file header.

The ideal shape:

```tsx
<SegmentedDocumentProvider model={partitionModel}>
  <FileViewerProvider source={pdfSource}>
    <ViewerRoot>
      <FileHeader>
        <ViewerSidebarTrigger />
        <FileHeaderTitle />
        <FileHeaderMeta />
        <FileHeaderControls />
      </FileHeader>

      <ViewerBody>
        <PartitionRail />

        <ViewerSurface>
          <PartitionLegend />
          <FileViewerContent />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </FileViewerProvider>
</SegmentedDocumentProvider>
```

If the legend must be visually above the document, it can live inside the
surface, below the file header.

It should not become a second header row unless it is visually a body toolbar.

## Email Viewer Shape

Email should use the same file header when the selected thing is a file-like
MIME part.

The message metadata is domain content.

```tsx
<EmailViewerProvider message={message}>
  <FileViewerProvider source={selectedMimePartSource}>
    <ViewerRoot>
      <FileHeader>
        <ViewerSidebarTrigger />
        <FileHeaderTitle />
        <FileHeaderMeta />
        <FileHeaderControls />
      </FileHeader>

      <ViewerBody>
        <ViewerSidebar>
          <EmailPartsSidebar />
        </ViewerSidebar>

        <ViewerSurface>
          <EmailMessageSummary />
          <FileViewerContent />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </FileViewerProvider>
</EmailViewerProvider>
```

The email subject/from/to/date should not pretend to be file metadata unless the
selected file is the email itself. It is message metadata.

## Dropzone Shape

Dropzone should not invent a separate selected-file header.

When a file is selected, it can compose the same primitives:

```tsx
<UploadableFileViewerProvider>
  <FileViewerProvider source={selectedFile}>
    <ViewerRoot>
      <FileHeader>
        <ViewerSidebarTrigger />
        <FileHeaderTitle />
        <FileHeaderMeta />
        <FileHeaderControls />
      </FileHeader>

      <ViewerBody>
        <ViewerSidebar>
          <UploadQueue />
        </ViewerSidebar>

        <ViewerSurface>
          <FileViewerContent />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </FileViewerProvider>
</UploadableFileViewerProvider>
```

Upload state belongs to the upload provider.
File display belongs to the file viewer.
Sidebar state belongs to viewer root.

## API Rules

### Rule 1: Children Override Defaults

`FileHeader` should have useful defaults:

```tsx
<FileHeader />
```

should behave like:

```tsx
<FileHeader>
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

But if children are provided, they replace the default anatomy:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderControls />
</FileHeader>
```

This matches shadcn taste: easy default, visible escape hatch.

### Rule 2: No Header Booleans For Anatomy

Avoid:

```tsx
<FileHeader showSidebarTrigger showMeta showControls />
```

Anatomy should be JSX.

The only acceptable small prop is a presentational prop with narrow meaning,
such as:

```tsx
<FileHeaderMeta showCategory={false} />
```

Even that should remain rare.

### Rule 3: No Domain Flags

Avoid:

```tsx
<FileHeaderControls partition />
<FileHeaderControls split />
<FileHeaderControls ocr />
```

The control state is renderer-owned and file-generic.

### Rule 4: No Public Registration Hook In File Viewer Docs

`useViewerControlsRegistration` can exist, but it is internal plumbing.

It should not be taught as the main way to use file viewer.

The public story is:

```tsx
<FileHeaderControls />
```

### Rule 5: One Top Row

A composed viewer should not render both:

```tsx
<DomainHeader />
<FileHeader />
```

If a domain header exists, ask whether it is really:

- sidebar content;
- body toolbar;
- legend;
- ribbon;
- status row;
- empty/loading/error state.

Most domain headers are not headers. They are body content.

## Naming Rules

Use these names:

```txt
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
ViewerSidebarTrigger
ViewerControls
ViewerControlsState
ViewerControlsRegistrationProvider
useViewerControlsRegistration
```

Do not use:

```txt
FileToolbar
FileHeaderToolbar
FileHeaderActions
FileActions
ViewerToolbar
HeaderSlot
HeaderActions
ControlsBus
```

The same concept gets the same name everywhere.

## Implementation Direction

1. Keep `ViewerSidebarTrigger` in `viewer.tsx`.
2. Keep `FileHeader*` in `file-viewer.tsx`.
3. Keep `ViewerControls*` in `viewer-controls.tsx`.
4. Make domain viewers compose `FileHeader` instead of wrapping it.
5. Move domain legend/status content out of top headers and into body/sidebar
   structures.
6. Keep file-type controls renderer-owned and published through the private
   controls bridge.
7. Make tests enforce that composed viewers use exactly one top file header.

## Architecture Tests

The system should have tests for:

- `FileHeader` exports title, meta, and controls anatomy;
- `FileHeader` defaults render title, meta, and controls;
- `FileHeader` children replace defaults;
- `ViewerSidebarTrigger` works inside `FileHeader`;
- `ViewerSidebarTrigger` targets the nearest `ViewerRoot`;
- PDF controls appear through `FileHeaderControls`;
- switching from PDF to non-PDF clears stale PDF controls;
- stale unmount cleanup cannot remove newer controls;
- split and partition examples compose `FileHeader`;
- no composed viewer imports a domain-specific file header for PDF controls;
- no `FileHeaderActions` symbol exists;
- no `ViewerToolbar` symbol exists in public APIs.

## Perfection Test

The design has reached the ideal when this is enough:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

and nobody has to ask:

```txt
Which header owns the file?
Which header owns the sidebar trigger?
Which header owns PDF controls?
Which header owns split metadata?
Why are there two top rows?
Where do I put thumbnails?
Where do I put a segment legend?
```

The answer should be mechanically obvious:

```txt
File identity and file controls go in FileHeader.
Sidebar toggling uses ViewerSidebarTrigger.
Domain navigation goes in ViewerSidebar or ViewerSurface.
File rendering goes in FileViewerContent.
Layout goes in ViewerRoot, ViewerBody, ViewerSidebar, ViewerSurface.
```

That is the shadcn-grade endpoint: small names, obvious composition, private
machinery, and one precise place for each visible concept.
