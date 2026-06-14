# Viewer Header Toolbar Definitive Platonic Blueprint

## Correction

The platonic ideal is not a large set of tiny header subcomponents.

Do not create:

```txt
ViewerHeaderMain
ViewerHeaderTitle
ViewerHeaderMeta
ViewerHeaderActions
ViewerPosition
ViewerZoomControls
ViewerRotateControl
ViewerHeaderButton
```

That is too many nouns. It makes the library feel designed by taxonomy instead
of by use.

The shadcn-grade answer is fewer components, not more components:

```txt
ViewerHeader
ViewerToolbar
ViewerSidebarTrigger
```

Everything else is internal implementation detail or normal user JSX.

## Final Position

Keep the current direction:

```txt
ViewerHeader is the spatial row.
ViewerToolbar is the reusable controlled toolbar grammar.
Format viewers adapt their local state into ViewerToolbar.
Users can edit installed code when they need more.
```

Do not split the toolbar into public atoms.

The ideal public shape is:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
  <ViewerToolbar
    title="contract.pdf"
    position={{ kind: "page", current: 101, total: 400 }}
    zoom={{ scale, onZoomOut, onZoomIn, onFit }}
    rotate={{ onRotate }}
    downloads={[downloadAction]}
  />
</ViewerHeader>
```

This is clear enough, compact enough, and editable enough.

## Why The Previous Version Was Wrong

The previous blueprint tried to make every visual phrase a public component:

```txt
Title
Meta
Position
Actions
Zoom
Rotate
Button
```

That creates three problems:

1. It increases API surface without increasing power.
2. It makes normal usage verbose.
3. It invites users to think the header is a framework.

The correct mental model is smaller:

```txt
ViewerHeader = where header chrome goes
ViewerToolbar = common file/document controls
ViewerSidebarTrigger = shared sidebar toggle
```

If a user wants custom atoms, they own the code after install. They can edit the
toolbar file or write normal JSX inside `ViewerHeader`.

## Shadcn Philosophy

Shadcn components are not meant to be maximally abstract.

They are meant to be:

```txt
copyable
readable
modifiable
complete by default
small enough to understand
not over-factored into clever public primitives
```

The sidebar has many exports because its domain needs them:

```txt
provider state
trigger anywhere
inset layout
menu groups
menu buttons
rail
responsive mobile behavior
keyboard shortcut
```

The viewer header does not need that many exports.

The viewer header needs:

```txt
a row
a trigger
a toolbar
```

That is the shadcn-compliant version.

## Core Rule

Add a public component only when all are true:

```txt
it removes real repeated code
it has a stable meaning outside one viewer
it is large enough to be worth naming
it makes common usage shorter or clearer
it does not force users to learn a miniature DSL
```

`ViewerToolbar` passes.

`ViewerHeaderMain` does not.

`ViewerHeaderTitle` does not.

`ViewerPosition` does not.

`ViewerZoomControls` maybe passes internally, but does not need to be public.

## Definitive Public API

### Viewer Layout

Keep:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

Public exports:

```ts
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
useViewerSidebar
useOptionalViewerSidebar
```

No new header anatomy exports.

### Viewer Toolbar

Keep one toolbar primitive:

```ts
ViewerToolbar
ViewerToolbarSkeleton
ViewerToolbarButton
formatViewerToolbarPosition
```

`ViewerToolbarButton` is acceptable because custom trailing actions are a real
need, and sharing button geometry avoids drift.

Do not create separate public `ViewerZoomControls`, `ViewerRotateControl`, or
`ViewerPosition` unless there is repeated direct demand.

### Toolbar Props

The controlled prop object is not a compromise. It is the API.

```ts
export type ViewerToolbarProps = Omit<React.ComponentProps<"div">, "title"> & {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  position?: ViewerToolbarPosition | null
  zoom?: ViewerToolbarZoom | null
  rotate?: ViewerToolbarRotate | null
  downloads?: ViewerDownloadAction[]
  loading?: boolean
  size?: "default" | "sm"
  extra?: React.ReactNode
}
```

This is enough.

It is not too much because every prop maps to visible toolbar behavior:

```txt
title       primary identity
subtitle    secondary identity
position    page/slide/frame label
zoom        zoom controls
rotate      rotate control
downloads   download control
loading     loading dot/text state
size        compact row variant
extra       last-resort escape hatch
```

The API remains controlled:

```txt
ViewerToolbar never owns document state.
ViewerToolbar never knows PDF/DOCX/PPTX/XLSX.
ViewerToolbar never reaches into provider context.
ViewerToolbar only renders passed state and calls passed callbacks.
```

## The Role Of `extra`

`extra` is not perfect, but it is the correct shadcn escape hatch.

It avoids public taxonomy explosion.

Use it for:

```txt
copy button
custom dropdown
mode toggle
format-specific one-off action
```

Example:

```tsx
<ViewerToolbar
  title={`${wordCount} words`}
  zoom={{ scale, onZoomOut, onZoomIn, onFit: resetZoom }}
  downloads={[downloadAction]}
  extra={
    <ViewerToolbarButton label="Copy text" onClick={copy}>
      <Copy />
    </ViewerToolbarButton>
  }
/>
```

This is better than exporting:

```txt
ViewerHeaderActions
ViewerHeaderButtonGroup
ViewerHeaderCopyButton
ViewerHeaderTrailing
```

## Format Viewer Pattern

Each format viewer should have a tiny adapter from its state into
`ViewerToolbar`.

### PDF

```tsx
export function PdfViewerHeader({
  children,
  toolbar = true,
}: {
  children?: React.ReactNode
  toolbar?: boolean
}) {
  const { currentPage, headerControls, resource } = usePdfViewerHeader()
  const title = resource.fileName || "PDF"

  return (
    <ViewerHeader>
      {children}
      <ViewerToolbar
        className="h-auto flex-1 border-b-0 bg-transparent px-0"
        title={title}
        position={
          headerControls
            ? {
                kind: "page",
                current: headerControls.currentPage,
                total: headerControls.pageCount,
              }
            : toolbar && currentPage
              ? { kind: "page", current: currentPage }
              : null
        }
        zoom={
          toolbar && headerControls
            ? {
                scale: headerControls.scale,
                onZoomOut: headerControls.onZoomOut,
                onZoomIn: headerControls.onZoomIn,
                onFit: headerControls.onFitWidth,
              }
            : null
        }
        rotate={
          toolbar && headerControls
            ? { onRotate: headerControls.onRotate }
            : null
        }
        downloads={
          toolbar && headerControls ? [headerControls.downloadAction] : []
        }
      />
    </ViewerHeader>
  )
}
```

Usage:

```tsx
<PdfViewerHeader>
  <ViewerSidebarTrigger />
</PdfViewerHeader>
```

This is the right amount of composition.

No `start`.

No `leading`.

No `ViewerHeaderMain`.

### PDF With Thumbnails

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <PdfViewerHeader>
      <ViewerSidebarTrigger />
    </PdfViewerHeader>
    <ViewerBody>
      <ViewerSidebar aria-label="PDF pages">
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

This is the hierarchy:

```txt
header
body
  sidebar
  file viewer
```

### DOCX

```tsx
<ViewerToolbar
  position={{ kind: "page", current: currentPage, total: pageCount }}
  zoom={{ scale, onZoomOut, onZoomIn, onFit: fitWidth }}
  downloads={downloadAction ? [downloadAction] : []}
/>
```

### PPTX

```tsx
<ViewerToolbar
  position={{ kind: "slide", current: currentSlide, total: slideCount }}
  zoom={{
    scale,
    onZoomOut,
    onZoomIn,
    onFit,
    isDisabled: scaleControlsDisabled,
  }}
  rotate={{ onRotate }}
  downloads={[downloadAction]}
/>
```

### XLSX

```tsx
<ViewerToolbar
  title={activeSheet.name}
  subtitle={`${activeSheet.rowCount.toLocaleString()} x ${activeSheet.columnCount}`}
  zoom={{
    scale,
    onZoomOut,
    onZoomIn,
    onFit: resetZoom,
    fitLabel: "Actual size",
  }}
  downloads={downloadActions}
/>
```

### CSV

```tsx
<ViewerToolbar
  title={isLoading ? `${rowLabel} loading` : rowLabel}
  subtitle={isLoading ? null : columnLabel}
  loading={isLoading}
  zoom={{
    scale: zoom,
    onZoomOut,
    onZoomIn,
    onFit: resetZoom,
    fitLabel: "Reset zoom",
  }}
  downloads={downloadActions}
/>
```

Keep text contracts intact:

```txt
0 rows loading
```

Do not split meaningful text just to satisfy component anatomy.

### Image

```tsx
<ViewerToolbar
  position={{ label: countLabel }}
  zoom={{
    scale,
    onZoomOut,
    onZoomIn,
    onFit,
    isDisabled: scaleControlsDisabled,
  }}
  rotate={{ onRotate }}
  downloads={[downloadAction]}
/>
```

The `label` position variant is acceptable because image frame labels are real
viewer positions but do not always fit `page | slide | frame`.

Do not create a separate `ViewerFramePosition` component.

### Text And Code

```tsx
<ViewerToolbar
  title={`${lineCount} lines`}
  zoom={{
    scale: fontScale,
    onZoomOut,
    onZoomIn,
    onFit: resetZoom,
    fitLabel: "Reset zoom",
  }}
  downloads={[downloadAction]}
/>
```

### Markdown

Tabs can sit in `title`.

This is acceptable:

```tsx
<ViewerToolbar
  title={
    <Tabs value={mode} onValueChange={setMode}>
      <TabsList variant="underline">
        <TabsTrigger value="rendered">Rendered</TabsTrigger>
        <TabsTrigger value="text">Text</TabsTrigger>
      </TabsList>
    </Tabs>
  }
  zoom={{ scale, onZoomOut, onZoomIn, onFit, onReset }}
  downloads={[downloadAction]}
  extra={<CopyMarkdownButton />}
/>
```

It is not semantically perfect to call tabs a title, but it is practically
correct because:

```txt
it keeps the public API small
it is still normal JSX
it avoids named micro-slots
the installed code remains easy to edit
```

This is the shadcn tradeoff.

## Email

Email is a domain viewer, not a toolbar special case.

Use:

```tsx
<EmailViewerProvider>
  <ViewerRoot>
    <EmailHeader />
    <ViewerBody>
      <ViewerSidebar aria-label="Email parts">
        <EmailPartsSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

`EmailHeader` may render `ViewerHeader` internally.

Attachments can render nested file viewers:

```tsx
<ViewerSurface>
  <FileViewer source={selectedAttachmentSource} />
</ViewerSurface>
```

This is correct nesting.

Do not force email into `ViewerToolbar`.

## File System

The file system owns file-system state.

The viewer primitive should not contain file-system logic.

The file system may contain a viewer:

```tsx
<FileSystemProvider>
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
</FileSystemProvider>
```

This blueprint does not redesign file-system internals.

## Provider Policy

Do not add providers for toolbar/header.

Allowed:

```txt
ViewerRoot owns sidebar open state because triggers can appear anywhere.
PdfViewerProvider owns PDF resource/page state.
EmailViewerProvider owns MIME selection.
FileSystemProvider owns file-system state.
```

Forbidden:

```txt
ViewerHeaderProvider
ViewerToolbarProvider
ViewerChromeProvider
UniversalDocumentProvider
```

The toolbar is controlled. It receives state and callbacks.

## Why This Is Better Than Micro-Parts

Micro-parts optimize for theoretical composability.

`ViewerToolbar` optimizes for real library ergonomics:

```txt
less API to learn
fewer names
fewer imports
less JSX noise
one obvious default
still fully editable after install
```

The decisive comparison:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
  <ViewerToolbar
    title={title}
    position={position}
    zoom={zoom}
    rotate={rotate}
    downloads={downloads}
  />
</ViewerHeader>
```

versus:

```tsx
<ViewerHeader>
  <ViewerHeaderMain>
    <ViewerSidebarTrigger />
    <ViewerHeaderTitle>{title}</ViewerHeaderTitle>
    <ViewerPosition {...position} />
  </ViewerHeaderMain>
  <ViewerHeaderActions>
    <ViewerZoomControls {...zoom} />
    <ViewerRotateControl {...rotate} />
    <ViewerDownloadControl actions={downloads} />
  </ViewerHeaderActions>
</ViewerHeader>
```

The second is more "pure" in a component-theory sense.

The first is better for this library.

## Naming Rules

Use:

```txt
ViewerHeader
ViewerToolbar
ViewerToolbarSkeleton
ViewerToolbarButton
ViewerSidebarTrigger
```

Avoid:

```txt
ViewerHeaderMain
ViewerHeaderTitle
ViewerHeaderMeta
ViewerHeaderActions
ViewerPosition
ViewerZoomControls
ViewerRotateControl
ViewerHeaderButton
ToolbarTitle
ToolbarActions
HeaderControls
leading
trailing
start
end
```

`children` is the composition mechanism.

`extra` is the toolbar escape hatch.

## Registry Shape

Keep `viewer-toolbar` as a separate registry item if it keeps install payloads
clean.

Viewer registry dependencies should be:

```txt
pdf-viewer -> viewer-toolbar
docx-viewer -> viewer-toolbar
pptx-viewer -> viewer-toolbar
image-viewer -> viewer-toolbar
xlsx-viewer -> viewer-toolbar
csv-viewer -> viewer-toolbar
text-viewer -> viewer-toolbar
code-viewer -> viewer-toolbar
markdown-document-viewer -> viewer-toolbar
```

No per-format toolbar registry items:

```txt
pdf-viewer-toolbar
pptx-viewer-toolbar
xlsx-toolbar
csv-viewer-toolbar
```

## Hard Cutover Rules

The implementation is correct when:

```txt
all common document viewers use ViewerToolbar
no per-format toolbar modules remain
PdfViewerHeader accepts children, not start/leading props
PDF thumbnail block uses PdfViewerHeader children for ViewerSidebarTrigger
CSV loading text remains a single meaningful phrase
page markdown uses ViewerToolbar instead of local toolbar buttons
ViewerToolbar stays provider-free and controlled
registry build and validate pass
typecheck passes
focused viewer tests pass
architecture guard prevents old toolbar modules from returning
```

## Test Requirements

Keep tests for:

```txt
ViewerToolbar renders title/subtitle/position
ViewerToolbar renders zoom controls
ViewerToolbar renders rotate only when present
ViewerToolbar renders download only when actions exist
ViewerToolbar omits separators for missing groups
ViewerToolbar skeleton preserves geometry
CSV loading title remains queryable as "0 rows loading"
PDF thumbnails composition places trigger through children
no old toolbar files exist
registry payloads include viewer-toolbar dependency
```

Do not add tests for rejected micro-parts.

## Final Answer

The platonic ideal for this component library is not maximal anatomical
decomposition.

It is:

```txt
few public primitives
strong defaults
controlled toolbar props
domain-owned state
normal JSX composition
editable installed code
no provider for chrome
no micro-component taxonomy
```

The final shape is:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
  <ViewerToolbar {...toolbarProps} />
</ViewerHeader>
```

That is the correct shadcn-grade answer.

