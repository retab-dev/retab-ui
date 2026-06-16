# File Viewer Final Platonic Perfection Blueprint

## Verdict

No, `FileViewer` has not reached the platonic ideal yet.

It has reached the right conceptual shape. That is the important part. The
center of gravity is now correct:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

This is the right public grammar. It is shadcn-like in the ways that matter:

- one root component owns scope;
- named anatomy parts are explicit;
- the easy API and the composed API share the same root;
- advanced behavior is unlocked by composition, not by prop explosion;
- internals exist, but users should not need to name them.

The remaining work is not another conceptual rewrite. The remaining work is a
final subtraction and boundary pass. The current system is good. The ideal
system should feel inevitable.

## Definition Of Perfection

For this component, perfection means:

- `FileViewer` is the only public root concept.
- `FileViewerProvider` is not a public authoring concept.
- `ViewerRoot` remains the generic primitive under the hood.
- `FileViewer` owns file identity, viewer sidebar state, file header context,
  and document routing.
- `FileViewerHeader`, `FileViewerBody`, `FileViewerSidebar`,
  `FileViewerSurface`, and `FileViewerDocument` are the full public anatomy.
- The default usage is not a second architecture. It is the same component with
  omitted children.
- The header is not format-specific. PDF, image, DOCX, XLSX, CSV, markdown,
  HTML, and text all contribute controls through the same registration bridge.
- Format renderers own format state.
- Header parts render state; they do not own format behavior.
- Sidebar behavior comes from the viewer primitive and works from any trigger
  inside the root.
- File routing is private.
- Document lifecycle is private.
- Public hooks are narrow.
- There are no legacy aliases, compatibility wrappers, duplicated names, or
  "also this way" APIs.

The taste target is:

```txt
one root
one body
one sidebar
one surface
one document
one header
one control bridge
one private route
```

Everything else must justify itself.

## Current System Map

The current implementation is split across these files:

```txt
registry/new-york-v4/ui/file-viewer.tsx
registry/new-york-v4/ui/file-viewer-document.tsx
registry/new-york-v4/ui/file-viewer-internal.tsx
registry/new-york-v4/ui/file-viewer-route.tsx
registry/new-york-v4/ui/file-viewer-core.ts
registry/new-york-v4/ui/file-viewer-chrome.tsx
registry/new-york-v4/ui/viewer.tsx
registry/new-york-v4/ui/viewer-controls.tsx
```

The shape is mostly correct.

### `file-viewer.tsx`

This is the public component file.

It currently owns:

- `FileViewer`;
- `FileViewerHeader`;
- `FileViewerTitle`;
- `FileViewerMeta`;
- `FileViewerControls`;
- `FileViewerBody`;
- `FileViewerSidebar`;
- `FileViewerSurface`;
- `FileViewerSidebarTrigger`;
- public prop types for those parts;
- default composition when `children` is omitted;
- public re-export of `FileViewerDocument`;
- public re-export of `useFileViewerResource`.

This is the right general responsibility.

The file should read like public anatomy. A reader should be able to scan it and
understand how to compose a file viewer without reading the renderer routing
engine.

It should not own:

- lazy renderer imports;
- file category switch statements;
- suspense fallback lifecycle;
- error boundary lifecycle;
- descriptor abort signal plumbing;
- format-specific behavior;
- PDF page state;
- thumbnail state;
- extraction or source state;
- email MIME state;
- file-system tree state.

The current file has already stopped owning routing and document lifecycle. That
is a strong improvement. It still imports an internal document renderer for the
default composition. That is acceptable, but not perfect.

### `file-viewer-document.tsx`

This is the document lifecycle file.

It currently owns:

- `FileViewerDocument`;
- `FileViewerDocumentRenderer`;
- `useFileViewerDocument`;
- descriptor key access;
- descriptor signal access;
- resource access;
- client fallback behavior;
- suspense;
- error boundary;
- route invocation;
- controls cleanup on descriptor change;
- leaf controls and leaf download flags.

This extraction is correct.

The public anatomy file should not contain `React.Suspense`,
`FileErrorBoundary`, `descriptorSignal`, or `<FileViewerRoute />`. Those are not
part of the public grammar. They belong here.

The remaining smell is the name and export status of
`FileViewerDocumentRenderer`. It is not public through `file-viewer.tsx`, which
is good. But it is still an exported symbol from a shipped registry file. In a
library package this would be fully private behind package exports. In a shadcn
registry, copied source files are visible, so privacy is convention plus tests.

The final version should make the intention unambiguous.

Preferred final internal shape:

```tsx
export function FileViewerDocument(props: FileViewerDocumentProps) {
  return (
    <InternalFileViewerDocument
      {...props}
      leafControls
      leafDownload
    />
  )
}

export function InternalFileViewerDocument(...) {
  ...
}
```

The name `InternalFileViewerDocument` is less pretty than
`FileViewerDocumentRenderer`, but it is more honest. In a registry component
system, honest private naming is valuable because users can see the files.

If we keep `FileViewerDocumentRenderer`, the invariant must be:

```txt
FileViewerDocumentRenderer is registry-internal.
It is never exported from file-viewer.tsx.
It is never imported by docs, demos, blocks, or composed viewers.
```

That is acceptable, but not the cleanest final state.

### `file-viewer-internal.tsx`

This is the private context file.

It currently owns:

- `FileViewerProvider`;
- `FileViewerContext`;
- `useFileViewerContext`;
- `useOptionalFileViewerResource`;
- `useFileViewerResource`;
- descriptor resolution;
- descriptor reset key;
- descriptor abort signal;
- resource creation;
- client readiness;
- controls state;
- `ViewerControlsRegistrationProvider`.

This boundary is mostly right.

The public root is `FileViewer`. The provider exists because React context needs
a provider, not because users should compose one.

The ideal public story is:

```tsx
<FileViewer source={source}>...</FileViewer>
```

not:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>...</ViewerRoot>
</FileViewerProvider>
```

The second version is lower-level machinery. It should stay undocumented and
unre-exported from `file-viewer.tsx`.

The one public hook that remains acceptable is:

```ts
useFileViewerResource()
```

It is an escape hatch for format integrations and advanced composed viewers. It
must stay narrow. It should never become:

```ts
useFileViewer()
useFileViewerContext()
useFileViewerHeader()
useFileViewerDocument()
useOptionalFileViewerResource()
```

Those leak internal state shape.

### `file-viewer-route.tsx`

This is the private renderer dispatch file.

It currently owns:

- lazy loading of heavy renderers;
- category dispatch;
- blob/direct URL differences;
- text, code, markdown, CSV, HTML, PDF, DOCX, image, PPTX, and XLSX routing;
- fallback to unsupported file UI;
- the bridge from generic file descriptor to renderer-specific props.

This extraction is correct.

It should not become public. Consumers should never write:

```tsx
<FileViewerRoute ... />
```

They should write:

```tsx
<FileViewerDocument />
```

The route file is allowed to be boring. A clear switch is preferable to a clever
registry if the switch is easier to read and safer to change. The ideal is not
"abstract everything." The ideal is "the smallest clear implementation."

There is one possible future refinement: the current route still has repeated
branches for text source, blob source without direct URL, and direct URL source.
If the repetition starts creating defects, normalize source capability before
dispatching. If it remains easy to read, leave it alone.

### `file-viewer-core.ts`

This is the source and descriptor file.

It currently owns:

- `FileCategory`;
- `ViewerSource`;
- `FileViewerProps` core fields;
- descriptor resolution;
- descriptor reset key;
- prose text detection;
- small exported helpers from viewer-source;
- optional profiling helper.

This is generally right.

The one naming caveat is that `FileViewerProps` in this file includes both
source identity fields and rendering fields:

```ts
source
as
className
bare
isolateStyles
```

That is acceptable today because `FileViewerProps` is a core local type, but the
ideal conceptual split is:

```txt
file identity:
  source
  as

viewer presentation:
  className
  bare
  isolateStyles
```

Do not split this unless it makes the code clearer. This is a small type
purity issue, not a user-facing problem.

### `file-viewer-chrome.tsx`

This file is slightly imprecise.

It owns:

- unsupported card;
- viewer fallback;
- file error boundary;
- zoom helpers;
- zoom actions.

The name `chrome` is broad enough that it works, but not precise enough to feel
final. Some exports are fallback/error chrome. Some exports are zoom control
helpers.

The cleaner split would be:

```txt
file-viewer-fallback.tsx
  UnsupportedCard
  ViewerFallback
  FileErrorBoundary

viewer-zoom.tsx
  useZoom
  ZoomActions
```

This is not the highest priority because it is not part of the public API. But
for perfection, every file name should be exact.

### `viewer.tsx`

This is the generic viewer primitive.

It owns:

- `ViewerRoot`;
- `ViewerHeader`;
- `ViewerBody`;
- `ViewerSidebar`;
- `ViewerSurface`;
- `ViewerSidebarTrigger`;
- sidebar open state;
- controlled/uncontrolled sidebar behavior;
- inline/overlay sidebar mode;
- sidebar registration;
- one-primary-sidebar invariant;
- trigger accessibility;
- CSS variable wiring for sidebar width;
- focus return after close.

This is the right layer for sidebar mechanics.

`FileViewer` should not reimplement sidebar state. It should wrap
`ViewerRoot`, pass through the relevant sidebar props, and expose
file-prefixed aliases:

```tsx
<FileViewerSidebar />
<FileViewerSidebarTrigger />
```

That is exactly the shadcn sidebar lesson: the provider/root owns state, while
small parts can be placed where the composition needs them.

### `viewer-controls.tsx`

This is the shared controls primitive.

It owns:

- position display;
- zoom control display;
- rotate control display;
- download control display;
- extra control rendering;
- skeleton rendering;
- controls registration context.

This is the right direction.

The header does not need PDF-specific props. The PDF renderer knows PDF state
and registers:

```ts
position
zoom
rotate
downloads
extra
```

Then `FileViewerControls` renders the active state. This is the correct
ownership model:

```txt
renderer owns document state
FileViewer owns file scope
header renders registered controls
```

## Public API Target

The final public export surface from `file-viewer.tsx` should be:

```ts
FileViewer
FileViewerHeader
FileViewerTitle
FileViewerMeta
FileViewerControls
FileViewerBody
FileViewerSidebar
FileViewerSurface
FileViewerSidebarTrigger
FileViewerDocument
useFileViewerResource

FileViewerProps
FileViewerHeaderProps
FileViewerTitleProps
FileViewerMetaProps
FileViewerControlsProps
FileViewerBodyProps
FileViewerSidebarProps
FileViewerSurfaceProps
FileViewerSidebarTriggerProps
FileViewerDocumentProps
FileCategory
```

It should not export:

```ts
FileViewerProvider
FileViewerContext
useFileViewerContext
useOptionalFileViewerResource
useFileViewerHeader
useFileViewerDocument
FileViewerRoute
FileViewerDocumentRenderer
InternalFileViewerDocument
FileViewerContent
FileViewerContentProps
```

The difference matters. The first list is anatomy and one narrow escape hatch.
The second list is implementation.

## The One-Way Principle

The user should feel there is one way to use the component:

```tsx
<FileViewer source={source} />
```

and, when they need more layout:

```tsx
<FileViewer source={source}>...</FileViewer>
```

This is not two architectures. It is one root with two densities.

The easy API is:

```tsx
<FileViewer source={source} />
```

It should expand conceptually to:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

There is one subtle internal difference: in the default full viewer, controls
and downloads live in the header, so the document leaf must not render its own
leaf controls. In a bare leaf document, the document may own controls/downloads.

That distinction is implementation, not API.

The final code should make this distinction explicit with private names, not
with public variants.

Good public:

```tsx
<FileViewerDocument />
```

Good private:

```tsx
<InternalFileViewerDocument leafControls={false} leafDownload={false} />
```

Bad public:

```tsx
<FileViewerDocumentRenderer />
<FileViewerDocument controls={false} download={false} />
<FileViewerContent />
<FileViewerProvider />
```

The more the public API lets users configure internal placement semantics, the
less perfect it becomes.

## Anatomy Contract

### `FileViewer`

`FileViewer` is the root.

It owns:

- file source;
- optional category override;
- file descriptor;
- viewer resource;
- sidebar state through `ViewerRoot`;
- controls registration state;
- default composition.

It accepts:

- `source`;
- `as`;
- `bare`;
- `className`;
- `isolateStyles`;
- sidebar root props inherited from `ViewerRoot`;
- children.

It should not accept:

- `title`;
- `meta`;
- `controls`;
- `sidebar`;
- `renderHeader`;
- `renderDocument`;
- `pdfOptions`;
- `imageOptions`;
- `partitionMode`;
- `splitMode`;
- `emailMode`;
- format-specific state.

Composition should carry those needs.

### `FileViewerHeader`

`FileViewerHeader` is the file-level top row.

Default children:

```tsx
<>
  <FileViewerTitle />
  <FileViewerMeta />
  <FileViewerControls />
</>
```

The header should support replacement by children:

```tsx
<FileViewerHeader>
  <FileViewerSidebarTrigger />
  <FileViewerTitle />
  <SplitViewerHeaderMeta />
  <FileViewerControls />
</FileViewerHeader>
```

It should not know about:

- PDF pages;
- thumbnails;
- partitions;
- sources;
- email MIME parts;
- file-system trees.

Domain viewers can contribute small header parts, but the row remains the
file-viewer row.

### `FileViewerTitle`

`FileViewerTitle` renders the display name.

It should be plain, left aligned, and truncating.

It should not render a generic file icon by default. The title is enough. A
generic icon adds visual noise and does not carry meaningful information.

The invariant is:

```txt
title first, meta next, controls last
```

### `FileViewerMeta`

`FileViewerMeta` renders passive facts about the active file.

Examples:

- `application/pdf`;
- `text/html`;
- `pdf`;
- page position if a renderer contributes that through controls;
- domain-specific passive metadata inserted by a domain header part.

The current implementation renders MIME/category from file resource and
descriptor. That is acceptable.

The visual placement should be left side, next to title:

```txt
title, meta                         controls
```

not:

```txt
title                         meta, controls
```

Meta is identity context. Controls are operations.

### `FileViewerControls`

`FileViewerControls` renders operational controls.

It reads the active registered state:

```ts
position
zoom
rotate
downloads
extra
```

and falls back to the original file download when no renderer has registered
downloads.

This is good.

It should not accept format props directly. For example, this would be wrong:

```tsx
<FileViewerControls page={page} zoom={zoom} rotate={rotate} />
```

The renderer should register those controls.

### `FileViewerBody`

`FileViewerBody` is the layout row under the header.

It is the file-prefixed wrapper around `ViewerBody`.

This name is correct. `FileViewerContent` was not correct because "content" can
mean either the layout body or the rendered file. `Body` is layout. `Document`
is rendered file.

### `FileViewerSidebar`

`FileViewerSidebar` is the optional file-viewer side region.

It is the file-prefixed wrapper around `ViewerSidebar`.

It should be used for:

- PDF thumbnails;
- document section rails;
- attachment lists when the file viewer owns the file scope;
- source-linked field lists only when the sidebar is truly part of the file
  viewer.

It should not be used to smuggle an unrelated application shell into a file
viewer.

The generic `ViewerSidebar` still exists for non-file viewers and outer domain
viewers.

### `FileViewerSidebarTrigger`

`FileViewerSidebarTrigger` toggles the file viewer sidebar.

It must work anywhere inside the `FileViewer` root, exactly like the shadcn
sidebar trigger pattern.

It should not require prop drilling:

```tsx
<FileViewerHeader>
  <FileViewerSidebarTrigger />
</FileViewerHeader>
```

and:

```tsx
<SomeNestedToolbar>
  <FileViewerSidebarTrigger />
</SomeNestedToolbar>
```

should both work if the trigger is under the same `FileViewer`.

### `FileViewerSurface`

`FileViewerSurface` is the main visual region.

It should contain the rendered document or a domain overlay around it:

```tsx
<FileViewerSurface>
  <FileViewerDocument />
</FileViewerSurface>
```

or:

```tsx
<FileViewerSurface>
  <SplitPageRail />
  <PdfViewerPages />
</FileViewerSurface>
```

It should not own file identity. It is a surface, not a provider.

### `FileViewerDocument`

`FileViewerDocument` is the routed file renderer.

It should be the public way to say:

```txt
render the active file source using the correct renderer
```

It should not expose routing details.

It should not ask the caller to pass the source again. The source is already
owned by `FileViewer`.

Good:

```tsx
<FileViewer source={source}>
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

Bad:

```tsx
<FileViewer source={source}>
  <FileViewerDocument source={source} />
</FileViewer>
```

The second version duplicates identity and creates drift.

## Data Flow

The ideal data flow is:

```txt
source
  -> resolveFileDescriptor(source, as)
  -> createViewerResource(source, as)
  -> FileViewerProvider private context
  -> FileViewerHeader reads descriptor/resource
  -> FileViewerDocument reads descriptor/resource
  -> FileViewerRoute picks renderer
  -> renderer registers controls
  -> FileViewerControls renders controls
```

In component terms:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerTitle />       // descriptor.displayName
    <FileViewerMeta />        // resource.mimeType or descriptor category
    <FileViewerControls />    // registered renderer controls
  </FileViewerHeader>

  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />  // descriptor/resource -> private route
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

This is clean because no public child is asked to reconstruct the source.

## Control Registration Contract

The control bridge is one of the strongest parts of the design.

The active document renderer owns document state:

- PDF owns current page, page count, zoom, rotate, and download details.
- Image owns zoom, fit, rotate, and download details.
- DOCX/PPTX/XLSX own whatever state is meaningful for their renderers.
- Text/code/markdown may only own download.

The renderer registers:

```ts
type ViewerControlsState = {
  position?: ViewerControlPosition | null
  zoom?: ViewerZoomControl | null
  rotate?: ViewerRotateControl | null
  downloads?: ViewerDownloadAction[]
  extra?: React.ReactNode
}
```

`FileViewerControls` renders it.

This prevents `FileViewerHeader` from becoming:

```tsx
<FileViewerHeader
  page={page}
  pageCount={pageCount}
  zoom={zoom}
  onZoomIn={onZoomIn}
  onZoomOut={onZoomOut}
  onRotate={onRotate}
  downloads={downloads}
/>
```

That prop shape would be bloated and format-specific.

The invariant is:

```txt
FileViewerControls is a display slot.
Document renderers own control state.
FileViewerProvider owns the active registration bridge.
```

## Sidebar Contract

The sidebar belongs to `ViewerRoot`, surfaced through file-prefixed parts.

The file viewer should support:

```tsx
<FileViewer source={source} defaultOpen>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerBody>
    <FileViewerSidebar width="4.5rem">
      <PdfViewerThumbnails />
    </FileViewerSidebar>
    <FileViewerSurface>
      <PdfViewerPages />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

The trigger should not know where the sidebar is. It talks to the root.

The sidebar should not know who triggers it. It registers with the root.

This mirrors the shadcn sidebar philosophy:

```txt
root owns state
parts consume state
composition owns layout
```

## File Viewer And Viewer Primitive Relationship

`ViewerRoot` and `FileViewer` both deserve to exist, but not at the same public
conceptual level.

`ViewerRoot` is the generic layout primitive:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

It is for domain viewers that are not simply file viewers:

- sources shell;
- extraction result shell;
- non-file review layouts;
- custom multi-pane document workflows.

`FileViewer` is the file-specialized root:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

It adds:

- file descriptor;
- file resource;
- file title;
- file meta;
- file controls;
- file document route.

The ideal relationship is:

```txt
ViewerRoot       generic shell primitive
FileViewer       file-scoped composition root built on ViewerRoot
```

The user should not need to write both for ordinary file viewing.

## Composed Viewer Contracts

### PDF Viewer

The PDF easy API should be:

```tsx
<PdfViewer source={source} />
```

Internally, it should compose:

```tsx
<FileViewer source={source}>
  <PdfViewerProvider>
    <FileViewerHeader>
      <FileViewerTitle />
      <FileViewerMeta />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerBody>
      <FileViewerSurface>
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerBody>
  </PdfViewerProvider>
</FileViewer>
```

The old `PdfViewerHeader` should stay dead. It was private parallel chrome.

PDF-specific state belongs to `PdfViewerProvider` and `PdfViewerPages`.
File-level chrome belongs to `FileViewerHeader`.

### PDF Thumbnail Viewer

The thumbnail block is the clearest proof of the abstraction.

It should be:

```tsx
<FileViewer source={source} defaultOpen>
  <PdfViewerProvider>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerTitle />
      <FileViewerMeta />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerBody>
      <FileViewerSidebar>
        <PdfViewerThumbnails />
      </FileViewerSidebar>
      <FileViewerSurface>
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerBody>
  </PdfViewerProvider>
</FileViewer>
```

The PDF thumbnail component owns thumbnail behavior. The file viewer owns
placement.

This is good modularization.

### Split Viewer

Split viewer should be file-backed composition:

```tsx
<FileViewer source={source} defaultOpen>
  <SplitViewerProvider model={model}>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerTitle />
      <SplitViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerBody>
      <SplitViewerSidebar />
      <FileViewerSurface>
        <SplitViewerRail />
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerBody>
  </SplitViewerProvider>
</FileViewer>
```

The split-specific pieces should own split semantics:

- candidate segments;
- active segment;
- hover behavior;
- split metadata;
- rail labels.

They should not own file title, file controls, or file document routing.

### Partition Viewer

Partition viewer should also be file-backed composition:

```tsx
<FileViewer source={source}>
  <PartitionViewerProvider model={model}>
    <FileViewerHeader>
      <FileViewerTitle />
      <PartitionViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerBody>
      <FileViewerSurface>
        <PartitionRibbon />
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerBody>
  </PartitionViewerProvider>
</FileViewer>
```

Partition-specific state belongs to partition:

- output labels;
- vote rows;
- viewport segments;
- consensus semantics;
- empty/loading states.

File viewer should only provide file chrome and layout.

### Sources / OCR / Extraction Viewer

Sources and OCR are not simply a file viewer. They are evidence-linked domain
workflows. A generic outer `ViewerRoot` can be correct:

```tsx
<ViewerRoot>
  <ViewerHeader>
    <ViewerSidebarTrigger />
    <h2>Source-linked results</h2>
  </ViewerHeader>
  <ViewerBody>
    <ViewerSurface>
      <FileViewer source={source} bare>
        ...
      </FileViewer>
    </ViewerSurface>
    <ViewerSidebar side="right">
      <ExtractionForm />
    </ViewerSidebar>
  </ViewerBody>
</ViewerRoot>
```

This is not a failure of `FileViewer`. It means the domain shell is broader than
one file. The file viewer can live inside the domain surface.

The key rule:

```txt
If the sidebar belongs to the file, use FileViewerSidebar.
If the sidebar belongs to the domain workflow, use ViewerSidebar.
```

### Email Viewer

Email is a MIME document, not a normal file.

The right shape is:

```tsx
<EmailViewer>
  <EmailHeader />
  <ViewerBody>
    <EmailPartsSidebar />
    <ViewerSurface>
      <FileViewer source={selectedPart.source} bare />
    </ViewerSurface>
  </ViewerBody>
</EmailViewer>
```

or, if the selected MIME part should have full file chrome:

```tsx
<FileViewer source={selectedPart.source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

Email should not force `FileViewer` to understand MIME trees. The adapter should
turn a MIME part into a `ViewerSource`.

### Dropzone

Dropzone fits by producing uploadable file sources.

The viewer side should be simple:

```tsx
<Dropzone>
  <DropzoneTrigger />
  <DropzoneItems />
  <FileViewer source={selectedUpload.source} />
</Dropzone>
```

Dropzone owns:

- drag state;
- accepted/rejected files;
- upload progress;
- selected upload item;
- upload lifecycle.

FileViewer owns:

- previewing the selected file;
- header;
- controls;
- document route.

Do not merge upload state into `FileViewer`.

### File System

File system should contain file viewer, not the other way around.

The right mental model is:

```tsx
<FileSystem>
  <FileSystemTree />
  <FileViewer source={selectedFile.source} />
</FileSystem>
```

File viewer should not know:

- directories;
- renaming;
- deletion;
- copy/paste;
- file-system selection;
- provider-backed file trees.

This blueprint intentionally does not prescribe file-system changes.

## What Is Already Good

### The public names are now coherent

This is the strongest improvement:

```txt
FileViewer
FileViewerHeader
FileViewerTitle
FileViewerMeta
FileViewerControls
FileViewerBody
FileViewerSidebar
FileViewerSurface
FileViewerSidebarTrigger
FileViewerDocument
```

The names are not clever. They are exact.

### `FileViewerContent` is gone

This matters.

`Content` was imprecise:

- content could mean body layout;
- content could mean rendered document;
- content could mean route output.

`Body`, `Surface`, and `Document` separate those concepts.

### `PdfViewerHeader` is gone conceptually

PDF no longer needs private header chrome.

The file header can render PDF controls because PDF registers controls upward.
That is the correct split.

### The provider is private in practice

Users author:

```tsx
<FileViewer source={source}>...</FileViewer>
```

not:

```tsx
<FileViewerProvider>...</FileViewerProvider>
```

That is right.

### Sidebar trigger placement works conceptually

The trigger belongs to the root context. It can be placed in the header or
inside nested chrome, as long as it is under the same `FileViewer`.

### Blocks are proving the grammar

The PDF thumbnails block, split block, partition block, and sources block all
show the right pattern:

```txt
domain model/provider
  + FileViewer anatomy
  + format renderer
```

That is the direction.

## Remaining Gaps

## Gap 1: `FileViewerDocumentRenderer` Is Still Visible As A Module Export

Current state:

```ts
// file-viewer-document.tsx
export function FileViewerDocumentRenderer(...)
```

`file-viewer.tsx` imports it for the default composition but does not re-export
it. That is good enough mechanically, but not perfect philosophically.

The symbol name looks public. A copied shadcn file makes it visible.

### Desired state

Rename it:

```ts
export function InternalFileViewerDocument(...)
```

and keep the public export from `file-viewer.tsx` limited to:

```ts
export { FileViewerDocument, type FileViewerDocumentProps }
```

Then the default composition uses:

```tsx
<InternalFileViewerDocument
  bare
  className="h-full"
  leafControls={false}
  leafDownload={false}
/>
```

This makes the distinction explicit:

```txt
FileViewerDocument          public anatomy
InternalFileViewerDocument  private implementation
```

### Acceptance

```txt
file-viewer.tsx does not export InternalFileViewerDocument.
docs do not mention InternalFileViewerDocument.
blocks do not import InternalFileViewerDocument.
tests prove it is absent from public exports.
```

## Gap 2: `file-viewer-chrome.tsx` Is A Mixed Bag

Current state:

```txt
file-viewer-chrome.tsx
  UnsupportedCard
  ViewerFallback
  FileErrorBoundary
  useZoom
  ZoomActions
```

This file is useful but imprecise.

### Desired state

Split by responsibility:

```txt
file-viewer-fallback.tsx
  UnsupportedCard
  ViewerFallback
  FileErrorBoundary

viewer-zoom.tsx
  useZoom
  ZoomActions
```

Only do this if it improves clarity without creating import churn in public
examples.

### Acceptance

```txt
file names match exports
fallback/error UI is together
zoom helpers are not hidden under file-viewer chrome unless intentionally private
```

## Gap 3: Public Hook Surface Must Stay Minimal

Current public hook:

```ts
useFileViewerResource()
```

This is acceptable, but it is the edge of the cliff.

The following should never become public:

```ts
useFileViewer()
useFileViewerContext()
useFileViewerHeader()
useFileViewerDocument()
useOptionalFileViewerResource()
```

### Desired state

Keep `useFileViewerResource()` as the only public hook.

If another use case appears, add a narrow hook named after the exact value, not
after the provider:

```ts
useFileViewerResource()
```

Potentially acceptable in the future:

```ts
useFileViewerDescriptor()
```

Probably not acceptable:

```ts
useFileViewerState()
```

The more a hook returns the whole context, the less shadcn-like the component
becomes.

### Acceptance

Architecture tests should assert:

```txt
no exported useFileViewerContext
no exported useFileViewerHeader
no exported useFileViewerDocument
no exported useOptionalFileViewerResource from file-viewer.tsx
```

## Gap 4: Default Composition Still Reads Slightly Special

Current default composition:

```tsx
<FileViewerHeader />
<FileViewerBody>
  <FileViewerSurface>
    <FileViewerDocumentRenderer
      bare
      className="h-full"
      leafControls={false}
      leafDownload={false}
    />
  </FileViewerSurface>
</FileViewerBody>
```

This is correct behavior but the name is not ideal.

### Desired state

After renaming:

```tsx
<FileViewerHeader />
<FileViewerBody>
  <FileViewerSurface>
    <InternalFileViewerDocument
      bare
      className="h-full"
      leafControls={false}
      leafDownload={false}
    />
  </FileViewerSurface>
</FileViewerBody>
```

This makes the public composition and internal composition distinction honest.

The public reader sees:

```tsx
<FileViewerDocument />
```

The internal reader sees:

```tsx
<InternalFileViewerDocument />
```

No one sees a fake second public component.

## Gap 5: Route Dispatch Has Some Repetition

Current route dispatch is clear but repetitive:

- text source branch;
- blob source without direct URL branch;
- direct URL branch;
- repeated renderer props.

This is not currently a fatal smell. The route file is private and explicit.

### Desired state

Only refactor if the repetition starts hiding behavior.

Possible shape:

```ts
type FileRouteCapability = {
  directLoadUrl?: string
  isBlob: boolean
  isText: boolean
}
```

Then dispatch from category plus capability.

But do not create a registry map unless it is obviously cleaner than the
current switch. A generic registry can become more abstract and less readable
than a direct switch.

### Acceptance

The route file should make these questions easy:

- What renderer handles PDF?
- What renderer handles markdown text?
- What happens if a blob URL has no direct load URL?
- Which renderers receive `controls`?
- Which renderers receive `download`?
- Which renderers receive `isolateStyles`?
- Which renderers receive `descriptorSignal`?

If a refactor makes any of those harder to answer, reject it.

## Gap 6: Header Layout Needs Permanent Invariants

The header layout target is:

```txt
title, meta                                      controls
```

The title and meta are identity. Controls are operations.

There should be no default file icon.

### Required invariants

```txt
FileViewerTitle is left side.
FileViewerMeta sits next to title.
FileViewerControls has ml-auto.
FileViewerTitle truncates.
FileViewerMeta truncates or hides gracefully.
Controls never push the title out completely.
```

### Acceptance

Tests should cover:

- no generic icon rendered by default;
- title is present;
- meta is present when MIME/category exists;
- controls render on the right by class/structure;
- custom header children replace defaults.

Visual examples should cover:

- long file name;
- PDF with page controls;
- unknown file type;
- mobile width with sidebar trigger.

## Gap 7: Registry Privacy Is By Convention, So Tests Must Guard It

In a package, internals can be hidden through package exports.

In this registry, internals are source files copied into the consumer project.
That means privacy is enforced by:

- not re-exporting internals;
- not documenting internals;
- not using internals in blocks;
- architecture tests;
- precise filenames.

### Required private files

```txt
file-viewer-internal.tsx
file-viewer-route.tsx
file-viewer-document.tsx contains internal document runtime
```

### Public imports allowed

Docs, demos, and blocks may import from:

```ts
"@/components/ui/file-viewer"
```

They should not import from:

```ts
"@/components/ui/file-viewer-internal"
"@/components/ui/file-viewer-route"
"@/components/ui/file-viewer-document"
```

Exception: registry item dependency wiring may reference the file paths because
the registry installer needs source files.

### Acceptance

Architecture tests should scan:

```txt
registry/new-york-v4/blocks
components/viewers
content/docs
```

and reject imports from internal file-viewer modules.

## Gap 8: Bare Semantics Must Stay Boring

`bare` is useful but dangerous if it grows.

Current meaning:

```txt
bare = reduce outer chrome/framing
```

It is used when the file viewer is embedded inside another shell.

It should not become:

```txt
bare = hide header
bare = disable controls
bare = change routing
bare = disable provider
bare = render leaf controls differently in public API
```

Those are separate concerns.

The default full viewer can use an internal document with leaf controls off.
That should not leak into `bare`.

### Acceptance

Tests should cover:

- `<FileViewer source={source} bare />` still renders a document;
- bare with children still provides context;
- bare does not skip file descriptor/resource creation;
- bare does not alter category detection.

## Gap 9: Composed Viewers Must Not Rebuild File Chrome

PDF, split, partition, sources, email, edit, parse, and dropzone integrations
should follow the boundary:

```txt
domain viewer owns domain state
FileViewer owns file state
format renderer owns format state
ViewerRoot owns generic layout state
```

Any composed viewer that creates:

- its own file title row;
- its own file controls row;
- its own download button for file download;
- its own PDF page controls outside registration;
- its own parallel sidebar trigger for a `FileViewerSidebar`;

is suspect.

### Acceptance

Architecture tests should assert composed viewer examples contain
`FileViewerHeader`, `FileViewerBody`, and `FileViewerSurface` when they are
file-backed.

They should not assert that every domain shell is a `FileViewer`. Sources/OCR
may correctly have an outer `ViewerRoot` and an inner `FileViewer`.

## Gap 10: Documentation Must Teach The Anatomy, Not The Internals

The docs should teach:

```tsx
<FileViewer source={source} />
```

then:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

then:

```tsx
<FileViewer source={source} defaultOpen>
  <PdfViewerProvider>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerTitle />
      <FileViewerMeta />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerBody>
      <FileViewerSidebar>
        <PdfViewerThumbnails />
      </FileViewerSidebar>
      <FileViewerSurface>
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerBody>
  </PdfViewerProvider>
</FileViewer>
```

Docs should not mention:

```txt
FileViewerProvider
FileViewerRoute
FileViewerDocumentRenderer
InternalFileViewerDocument
useFileViewerContext
```

The docs should present one idea:

```txt
FileViewer is the file-scoped viewer root.
Its named parts compose file chrome, sidebar, surface, and document.
```

## Final Target File Boundaries

The ideal final boundary map:

```txt
file-viewer.tsx
  public anatomy
  public root
  default composition
  public narrow hook re-export

file-viewer-document.tsx
  FileViewerDocument
  InternalFileViewerDocument
  document lifecycle
  suspense
  error boundary
  route invocation

file-viewer-internal.tsx
  FileViewerProvider
  private context
  descriptor/resource creation
  controls registration bridge

file-viewer-route.tsx
  renderer dispatch
  lazy renderer imports
  route-specific prop adaptation

file-viewer-core.ts
  source and descriptor model
  category helpers
  reset key

file-viewer-fallback.tsx
  unsupported card
  fallback
  error boundary

viewer-zoom.tsx
  zoom helper hook
  zoom action buttons

viewer.tsx
  generic viewer shell
  generic sidebar mechanics

viewer-controls.tsx
  shared controls UI
  controls registration primitive
```

This is the modularization target.

## Implementation Plan

### Pass 1: Lock the public API

Ensure `file-viewer.tsx` exports exactly the public anatomy:

```ts
FileViewer
FileViewerHeader
FileViewerTitle
FileViewerMeta
FileViewerControls
FileViewerBody
FileViewerSidebar
FileViewerSurface
FileViewerSidebarTrigger
FileViewerDocument
useFileViewerResource
```

Remove or reject:

```ts
FileViewerContent
FileViewerProvider
FileViewerRoute
FileViewerDocumentRenderer
useFileViewerContext
useOptionalFileViewerResource
```

No aliases. No compatibility shims.

### Pass 2: Rename the internal document renderer

Change:

```ts
FileViewerDocumentRenderer
```

to:

```ts
InternalFileViewerDocument
```

Then update the default composition in `file-viewer.tsx`.

Keep `FileViewerDocument` public.

Do not document `InternalFileViewerDocument`.

### Pass 3: Split imprecise chrome if it still reads wrong

If the file still feels mixed, split:

```txt
file-viewer-chrome.tsx
```

into:

```txt
file-viewer-fallback.tsx
viewer-zoom.tsx
```

Only do this if it improves clarity. Do not split files just to increase file
count.

### Pass 4: Audit route clarity

Read `file-viewer-route.tsx` and ask:

- Is each category easy to find?
- Are direct URL and blob behaviors obvious?
- Are renderer props obvious?
- Is unsupported fallback obvious?

If yes, leave it.

If no, normalize capability state before dispatching.

Do not introduce a generic renderer registry unless it makes the code shorter
and more readable.

### Pass 5: Harden header layout

Keep default header order:

```tsx
<FileViewerTitle />
<FileViewerMeta />
<FileViewerControls />
```

Ensure:

- no generic icon;
- meta is left of controls;
- controls remain right aligned;
- long title truncates;
- meta does not crowd controls;
- custom children still replace defaults.

### Pass 6: Audit composed viewers

Review:

```txt
registry/new-york-v4/ui/pdf-viewer.tsx
registry/new-york-v4/blocks/pdf-thumbnails-block.tsx
registry/new-york-v4/blocks/split-viewer-block.tsx
registry/new-york-v4/blocks/partition-viewer-block.tsx
registry/new-york-v4/blocks/sources-viewer-block.tsx
registry/new-york-v4/ui/email-viewer.tsx
registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx
components/viewers/split/split-viewer.tsx
components/viewers/partition/partition-viewer.tsx
```

Enforce:

- file-backed viewers compose `FileViewer`;
- file header comes from `FileViewerHeader`;
- file controls come from `FileViewerControls`;
- sidebar trigger for file sidebar comes from `FileViewerSidebarTrigger`;
- format state stays in format provider;
- domain state stays in domain provider.

Do not touch file-system unless there is a separate explicit request.

### Pass 7: Rebuild registry payloads

After implementation, rebuild registry items that include file viewer:

```txt
file-viewer
pdf-viewer
pdf-thumbnails-block
split-viewer-block
partition-viewer-block
sources-viewer-block
```

Then sync the registry index.

### Pass 8: Strengthen architecture tests

Tests should prove:

- `FileViewerContent` is gone;
- `FileViewerBody` exists;
- `FileViewerDocument` is public;
- `FileViewerRoute` is not public;
- `FileViewerProvider` is not public;
- `InternalFileViewerDocument` is not exported from `file-viewer.tsx`;
- docs/blocks do not import private modules;
- registry item includes required internal dependency files;
- public payload mirrors source invariants.

### Pass 9: Run verification

Minimum verification:

```bash
pnpm typecheck
pnpm test -- tests/file-viewer.test.tsx tests/pdf-viewer.test.tsx
pnpm test -- tests/viewer-architecture.test.ts -t "FileViewer|compound easy APIs|PDF thumbnails block|workflow registry blocks|public/r viewer metadata|relative internal module"
```

Optional full verification:

```bash
pnpm test -- tests/viewer-architecture.test.ts
```

If unrelated file-system assertions fail, record them and do not repair
file-system as part of this blueprint.

## Architecture Test Invariants

The system should have explicit tests for these strings and absences.

### Public file positive assertions

`registry/new-york-v4/ui/file-viewer.tsx` should contain:

```txt
export function FileViewer
export function FileViewerHeader
export function FileViewerTitle
export function FileViewerMeta
export function FileViewerControls
export function FileViewerBody
export function FileViewerSidebar
export function FileViewerSurface
export function FileViewerSidebarTrigger
export { FileViewerDocument
<FileViewerProvider
<ViewerRoot
<FileViewerHeader
<FileViewerBody
<FileViewerSurface
```

### Public file negative assertions

`registry/new-york-v4/ui/file-viewer.tsx` should not contain:

```txt
export function FileViewerContent
export type FileViewerContentProps
export function FileViewerDocumentRenderer
export function InternalFileViewerDocument
export function FileViewerProvider
export function useFileViewerContext
export function useOptionalFileViewerResource
export function FileViewerRoute
React.Suspense
FileErrorBoundary
ViewerFallback
descriptorSignal
```

### Document file positive assertions

`registry/new-york-v4/ui/file-viewer-document.tsx` should contain:

```txt
export function FileViewerDocument
InternalFileViewerDocument
function useFileViewerDocument
React.Suspense
FileErrorBoundary
ViewerFallback
descriptorSignal
from "./file-viewer-route"
<FileViewerRoute
```

### Docs and blocks negative assertions

These locations should not import private file viewer modules:

```txt
content/docs
components/viewers
registry/new-york-v4/blocks
```

Forbidden imports:

```txt
file-viewer-internal
file-viewer-route
file-viewer-document
```

The public import should be:

```ts
import { FileViewer, FileViewerHeader } from "@/components/ui/file-viewer"
```

## Non-Goals

Do not do these as part of this blueprint:

- redesign file-system;
- add compatibility aliases;
- keep old names for migration;
- expose `FileViewerProvider`;
- make a generic mega `SegmentedViewer`;
- merge upload/dropzone state into `FileViewer`;
- merge MIME/email state into `FileViewer`;
- make `FileViewer` aware of extraction schemas;
- make `FileViewer` aware of split or partition job semantics;
- add render props for every slot;
- add format-specific props to `FileViewerHeader`;
- create a renderer plugin registry unless route dispatch becomes genuinely
  worse than a switch.

## The Hard Lines

These are the design lines that should not move:

```txt
FileViewer is the root.
FileViewerProvider is implementation.
FileViewerBody is layout.
FileViewerSurface is visual region.
FileViewerDocument is routed file output.
ViewerRoot is generic layout primitive.
FileViewer is file-scoped specialization.
Controls register upward.
Header renders controls.
Format renderers own format state.
Domain viewers own domain state.
File system contains FileViewer.
FileViewer does not contain file system.
```

If future work violates one of these, it should be treated as architecture
regression, not harmless convenience.

## Final Desired Reading Experience

A new reader opening `file-viewer.tsx` should understand this in under one
minute:

```txt
FileViewer wraps ViewerRoot.
It provides file context.
It exposes file-prefixed anatomy.
The default viewer is just header + body + surface + document.
The document implementation is elsewhere.
The route implementation is elsewhere.
The provider implementation is elsewhere.
```

A new reader opening `file-viewer-document.tsx` should understand:

```txt
This file runs the active document.
It owns fallback, suspense, error boundary, reset, and route invocation.
```

A new reader opening `file-viewer-route.tsx` should understand:

```txt
This file maps descriptor category and source capability to a renderer.
```

A new reader opening docs should understand:

```txt
Use FileViewer.
Compose its named parts when you need custom layout.
Use FileViewerSidebar and FileViewerSidebarTrigger for side panels.
Use FileViewerDocument for routed content.
```

No reader should need to understand the provider before they can use the
component.

## Final Verdict After This Blueprint

The design direction is right.

The public names are right.

The provider direction is not a dead end. It works because it is no longer the
public concept. The mistake would be exposing the provider as the authored
primitive. The correct move is what the current system now does: use context
internally, make `FileViewer` the authoring root, and expose small named parts.

The system is close to the ideal, but perfection still requires the final cuts:

1. make the internal document renderer name explicitly private;
2. keep public hooks narrow;
3. keep file header universal and icon-free;
4. keep docs and blocks away from internals;
5. split imprecise helper files only where the split clarifies ownership;
6. refuse legacy aliases and compatibility paths.

The shortest version:

```txt
The architecture is correct.
The remaining work is taste, naming, and enforcement.
```
