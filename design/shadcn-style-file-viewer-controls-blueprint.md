# Shadcn-Style File Viewer Controls Blueprint

## Position

The file viewer should follow the same design discipline as shadcn's strongest
components: small public anatomy, explicit composition, and private state
plumbing that users do not have to understand.

The goal is not to remove all imperative machinery. `Sidebar` proves that
stateful machinery is acceptable when it is hidden behind a clean provider and
small named parts. The goal is to prevent that machinery from becoming the user
API.

The file viewer should therefore be:

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
      <ViewerSidebar />
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

This is the public shape.

Everything else is implementation detail.

## Shadcn Lessons

### Sidebar

`Sidebar` is not purely declarative. It has:

- a provider;
- context;
- controlled and uncontrolled state;
- a trigger;
- mobile state;
- keyboard shortcuts;
- CSS variables;
- many composed anatomy parts.

But the user-facing shape remains obvious:

```tsx
<SidebarProvider>
  <Sidebar />
  <SidebarInset>
    <SidebarTrigger />
    {children}
  </SidebarInset>
</SidebarProvider>
```

The imperative state is real, but it is contained.

That is the relevant lesson for file viewer controls. The fact that a PDF
renderer must publish page, zoom, rotate, and download controls upward is not
automatically a design failure. It becomes a failure only if users must think
about the registration mechanism.

### Field

`Field` is mostly structural, so shadcn keeps it as dumb anatomy:

```tsx
<Field>
  <FieldLabel />
  <Input />
  <FieldDescription />
  <FieldError />
</Field>
```

The names describe the object, not the implementation.

The file header should follow this vocabulary discipline:

```txt
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
```

No `slots`, no `actions`, no `renderHeader`, no `toolbarConfig`.

## Public API

The canonical API should be:

```txt
FileViewerProvider
FileViewer
FileViewerContent

FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
```

`FileViewer` is the easy API.

`FileViewerProvider + FileHeader + FileViewerContent` is the composed API.

The user should not import a registration hook.

The user should not pass a giant controls object to `FileViewer`.

The user should not learn file-type-specific header contracts to build a normal
viewer.

## Ownership

### `ViewerRoot`

Owns viewer layout:

- frame;
- body;
- surface;
- sidebar state;
- sidebar trigger wiring.

It does not know files.

### `FileViewerProvider`

Owns file identity and file-viewer coordination:

- source;
- resolved resource;
- descriptor;
- renderer selection;
- current registered controls;
- reset on source or descriptor change.

It does not know PDF page state, XLSX sheets, CSV wrap state, image transforms,
or Markdown copy behavior.

### Active Renderer

Owns file-type semantics:

- PDF owns page, zoom, rotation, fit, PDF download;
- XLSX owns sheet selection and workbook-specific controls;
- CSV owns table controls;
- image owns image transforms;
- Markdown/text/code own copy/wrap/download controls;
- HTML owns iframe-specific controls.

The renderer can publish normalized controls upward, but those controls remain
generic at the file-header level.

### `FileHeaderControls`

Owns visible control placement.

It reads the normalized control state from `FileViewerProvider` and renders the
shared control grammar.

It should not know which renderer produced the controls.

## Internal Bridge

The current registration idea is acceptable, but the naming must make it clear
that this is private plumbing:

```ts
type ViewerControlsState = {
  position?: ViewerControlPosition | null
  zoom?: ViewerZoomControl | null
  rotate?: ViewerRotateControl | null
  downloads?: ViewerDownloadAction[]
  extra?: React.ReactNode
}

type ViewerControlsRegistration = (state: ViewerControlsState | null) => void
```

Preferred private names:

```txt
ViewerControlsRegistrationProvider
useViewerControlsRegistration
```

Avoid public-facing names that make this feel like a feature:

```txt
FileViewerControlsRegistration
FileViewerActionsProvider
useFileViewerControlsBus
renderControls
```

The bridge should be treated like `Sidebar` context: necessary, internal, and
boring.

## Required Behavior

The registration bridge must obey strict rules:

1. The active renderer may register one normalized control state.
2. The control state is cleared when the renderer unmounts.
3. The control state is cleared when the file descriptor changes.
4. If no renderer controls are registered, `FileHeaderControls` can still show
   the original file download.
5. Old PDF controls must not survive after switching to a non-PDF file.
6. Multiple active renderers should not be a supported public case.
7. Domain viewers should never pass `splitMode`, `partitionMode`, `ocrMode`, or
   similar flags into `FileHeaderControls`.

## Why Not Lift Everything Into `FileViewerProvider`

This would make the header feel more declarative:

```ts
const controls = useFileControls()
```

But it would force `FileViewerProvider` to understand every file type.

That is the wrong tradeoff.

It creates a god provider:

```txt
PDF page state
PDF zoom state
XLSX sheet state
CSV wrap state
image transform state
Markdown copy state
HTML sandbox state
```

This violates the shadcn lesson. `SidebarProvider` owns sidebar state, not every
menu item's semantics. `FileViewerProvider` should own file state and the
control channel, not every renderer's internal model.

## Why Not Render Props

This shape is also not ideal:

```tsx
<FileViewerContent
  controls={(controls) => <FileHeaderControls controls={controls} />}
/>
```

It makes the content responsible for a header that lives above it. It also
turns the viewer into slot machinery, which is less shadcn-like than explicit
composition.

The physical layout is:

```txt
header
body
  sidebar
  surface
```

The API should preserve that physical layout.

## Why Not `actions`

The public word should be `controls`.

Users do not need to distinguish:

```txt
controls = view state changes
actions = resource side effects
```

In a viewer header, page navigation, zoom, rotate, fullscreen, download, copy,
sheet selection, and wrap toggles are all operational controls.

The public vocabulary should be:

```txt
title     what is this?
meta      what passive facts describe it?
controls  how do I operate this viewer/file?
```

So:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

`ViewerSidebarTrigger` remains separate because it controls layout, not the
file.

## Domain Composition

### Split

```tsx
<SplitViewerProvider result={result}>
  <FileViewerProvider source={source}>
    <PdfViewerProvider source={source}>
      <ViewerRoot>
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
            <SplitViewerDocument document={<PdfViewerPages bare />} />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PdfViewerProvider>
  </FileViewerProvider>
</SplitViewerProvider>
```

Split contributes domain metadata and domain body chrome. It does not own file
controls.

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
            <PartitionViewerDocument document={<PdfViewerPages bare />} />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PdfViewerProvider>
  </FileViewerProvider>
</PartitionViewerProvider>
```

Partition contributes domain metadata, legend, and ribbon. It does not own file
controls.

### Email

```tsx
<EmailViewerProvider email={email}>
  <FileViewerProvider source={selectedPart.source}>
    <ViewerRoot>
      <EmailHeader />
      <ViewerBody>
        <EmailPartsSidebar />
        <ViewerSurface>
          <FileHeader>
            <FileHeaderTitle />
            <FileHeaderMeta />
            <FileHeaderControls />
          </FileHeader>
          <FileViewerContent bare />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </FileViewerProvider>
</EmailViewerProvider>
```

Email is different because the selected MIME part is the file. It can still use
the same file header anatomy for the selected part.

## Tests

The system should have architecture tests for:

- `FileViewer` exports only the intended public anatomy;
- registration hooks are not public exports;
- `FileHeaderControls`, not `FileHeaderActions`, is the public name;
- composed split and partition blocks use one `FileHeader`;
- composed split and partition blocks do not render duplicate PDF/domain
  headers above the document;
- `ViewerSidebarTrigger` remains imported from viewer primitives, not file
  viewer;
- switching from PDF to a non-PDF source clears page/zoom/rotate controls;
- fallback download remains visible when no renderer controls are registered;
- registry payloads match source.

## Perfection Standard

The design is right when the user thinks in anatomy:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

and never in mechanics:

```tsx
registerControlsState(...)
renderActions(...)
pdfHeaderSlot(...)
```

The internal bridge can exist. It just must never become the concept.
