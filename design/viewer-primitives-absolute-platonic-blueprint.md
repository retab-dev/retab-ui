# Viewer Primitives Absolute Platonic Blueprint

## Verdict

We have not reached the platonic ideal.

We have reached the right direction.

The right direction is not `ViewerShell`.

The right direction is not slot objects.

The right direction is not a universal viewer provider.

The right direction is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

Everything else should compose this grammar.

The provider idea is not a dead end. Broad provider APIs are the dead end.

A provider is correct when it owns domain state needed by separated named parts.
A provider is wrong when it becomes a bag of layout state, render callbacks, and
escape hatches.

## Standard

The ideal component system must satisfy these constraints:

- one visible layout grammar;
- one source vocabulary;
- one name per concept;
- explicit JSX hierarchy;
- no hidden layout through props;
- no compatibility wrappers;
- no second API that secretly does different architecture;
- no public abstraction that exists only because the old design existed.

The test is simple:

```txt
Can a reader understand the rendered viewer hierarchy by reading the JSX?
```

If not, the API is not finished.

## First Principles

```txt
Viewer primitives own layout.
Domain providers own domain state.
Domain parts project domain state into UI.
Leaf renderers render sources.
Source acquisition produces sources.
```

No component should own more than one of those responsibilities.

If a component owns two, split it.

If two components own the same responsibility, delete one.

## The Only Generic Viewer Primitives

The public generic primitive set should be:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not add:

```txt
ViewerShell
ViewerFrame
ViewerContent
ViewerPanel
ViewerRail
ViewerAside
ViewerToolbar
ViewerFooter
ViewerOverlay
```

Those names may exist inside a domain when the domain proves the concept:

```txt
PdfViewerToolbar
SplitViewerPageRail
EmailViewerPartsList
```

They should not become generic primitives until multiple independent viewers
need the exact same semantic region.

## Primitive Contracts

### ViewerRoot

Owns:

- outer frame;
- border, radius, background;
- height and overflow policy;
- generic viewer CSS variables;
- generic accessibility region semantics.

Does not own:

- selected file;
- selected source;
- selected attachment;
- selected MIME part;
- current PDF page;
- split result state;
- upload state;
- domain toolbar state.

### ViewerHeader

Owns the full-width top region.

It is always a sibling before `ViewerBody`, never nested inside sidebar or
surface.

It describes the compound viewer:

- email message metadata;
- PDF document title and global document controls;
- file-system path;
- split workflow title or legend;
- uploadable viewer selected-source summary.

It does not describe a nested selected attachment unless that selected
attachment is the whole viewer.

### ViewerBody

Owns the flex relationship below the header.

It is the only generic place where sidebar and surface become siblings.

Correct:

```tsx
<ViewerHeader />
<ViewerBody>
  <ViewerSidebar />
  <ViewerSurface />
</ViewerBody>
```

Wrong:

```tsx
<ViewerBody>
  <ViewerSurface>
    <div className="flex">
      <Sidebar />
      <FileViewer />
    </div>
  </ViewerSurface>
</ViewerBody>
```

### ViewerSidebar

Owns the viewer-local side region.

It does not own the domain list model.

Correct:

```tsx
<ViewerSidebar>
  <EmailViewerPartsList />
</ViewerSidebar>
```

Wrong:

```tsx
<ViewerSidebar parts={parts} selectedPartId={selectedPartId} />
```

### ViewerSurface

Owns the main rendering region.

It accepts selected domain content:

```tsx
<ViewerSurface>
  <FileViewer source={selectedSource} bare />
</ViewerSurface>
```

It does not select, parse, fetch, or route domain data.

## Source Vocabulary

The shared abstraction is `ViewerSource`.

Do not build a fake universal intake abstraction.

Different domains produce sources in different ways:

```txt
email MIME part       -> ViewerSource
file-system node      -> ViewerSource
dropzone file item    -> ViewerSource
URL sample            -> ViewerSource
split document source -> ViewerSource
```

The convergence point is rendering, not acquisition.

## Provider Rule

Providers are allowed only when separated named parts need shared domain state.

Provider responsibilities:

- normalize domain input;
- derive product projections;
- own controlled or uncontrolled selection;
- expose narrow hooks for named parts;
- convert selected domain objects into `ViewerSource`;
- coordinate imperative handles only when multiple parts need them.

Provider non-responsibilities:

- layout;
- className choreography;
- sidebar styling;
- toolbar placement;
- file rendering;
- dropzone DOM behavior;
- compatibility with removed APIs.

The ideal hook surface is not one large hook.

Good:

```txt
useEmailViewerHeader
useEmailViewerPartsList
useEmailViewerSelectedPart
```

Acceptable as a low-level escape hatch:

```txt
useEmailViewer
```

Bad:

```txt
useEmailViewer() returns header state, sidebar state, selected source,
layout flags, class names, render callbacks, and raw parser internals.
```

## Easy API Rule

Every compound viewer may have an easy API.

The easy API is preassembled composition and nothing more.

Correct:

```tsx
export function EmailViewer(props: EmailViewerProps) {
  return (
    <EmailViewerProvider {...providerProps}>
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
  )
}
```

Wrong:

```tsx
export function EmailViewer({ slots, renderAttachment, sidebarPosition }) {
  // hidden second layout model
}
```

The easy API must look like the docs example.

If the implementation cannot be shown as the docs example, the API is lying.

## Email Viewer Ideal

Email is a recursive MIME domain.

The user interface is not the raw MIME tree.

The sidebar projection is:

```txt
Body
Attachments
```

Canonical composition:

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

Public parts:

```txt
EmailViewer
EmailViewerProvider
useEmailViewer
useEmailViewerHeader
useEmailViewerPartsList
useEmailViewerSelectedPart
EmailViewerHeader
EmailViewerPartsList
EmailViewerSelectedPart
```

Rules:

- `EmailViewerHeader` renders message metadata only.
- `EmailViewerPartsList` renders product sections, not raw MIME recursion.
- `EmailViewerSelectedPart` renders the selected body or attachment.
- Attachments do not add a second file metadata header above the leaf viewer.
- Nested `message/rfc822` parts recurse by rendering another `EmailViewer`.
- Inline body parts and attachments both resolve through the same selected part
  shape.

## PDF Viewer Ideal

PDF is a compound document viewer with page state.

Canonical composition:

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

Public parts:

```txt
PdfViewer
PdfViewerProvider
usePdfViewer
usePdfViewerHeader
usePdfViewerPages
usePdfViewerThumbnails
PdfViewerHeader
PdfViewerThumbnails
PdfViewerPages
```

Rules:

- `PdfViewerProvider` owns source resource, current page, and coordination
  handles.
- `PdfViewerHeader` consumes a narrow header hook.
- `PdfViewerThumbnails` consumes a narrow thumbnails hook.
- `PdfViewerPages` consumes a narrow pages hook.
- Toolbar controls do not leak layout placement.
- Thumbnail sidebar is explicit JSX, not `slots.left`.
- Page rendering stays in `PdfViewerPages`, not in generic primitives.

## Split Viewer Ideal

Split viewer is a workflow viewer over a document renderer.

It is not a PDF viewer.

It is not a file renderer.

Canonical composition:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot>
    <SplitViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerPageRail />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerDocument>
          <PdfViewer source={source} />
        </SplitViewerDocument>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Public parts:

```txt
SplitViewer
SplitViewerProvider
useSplitViewer
useSplitViewerHeader
useSplitViewerPageRail
useSplitViewerDocumentControls
SplitViewerHeader
SplitViewerLegend
SplitViewerPageRail
SplitViewerDocument
```

Rules:

- No `renderDocument`.
- No callback that receives hidden layout props.
- `SplitViewerDocument` receives children.
- Segment overlays belong to split domain parts.
- The document renderer remains explicit.

## File-System Viewer Ideal

File-system viewer is a domain browser that selects a source.

Canonical composition:

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

Public parts:

```txt
FileSystemViewer
FileSystemViewerProvider
useFileSystemViewer
useFileSystemViewerHeader
useFileSystemViewerTree
useFileSystemViewerSelectedFile
FileSystemViewerHeader
FileSystemViewerTree
FileSystemViewerSelectedFile
```

Rules:

- Provider owns tree, expansion, selection, and source resolution.
- Tree renders navigation only.
- Selected file renders through `FileViewer`.
- Folder preview is a domain state, not a generic viewer primitive.

## Uploadable Viewer And Dropzone Ideal

Dropzone is source acquisition.

Uploadable viewer is source acquisition plus selected source rendering.

Dropzone itself is not a viewer.

Canonical composition:

```tsx
<UploadableFileViewerProvider accept={accept}>
  <UploadableFileViewerRoot>
    <ViewerHeader>
      <UploadableFileViewerHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar>
        <UploadableFileViewerSummary />
      </ViewerSidebar>
      <ViewerSurface>
        <UploadableFileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </UploadableFileViewerRoot>
</UploadableFileViewerProvider>
```

Public parts:

```txt
Dropzone
DropzoneUploaderViewer
UploadableFileViewerProvider
useUploadableFileViewer
UploadableFileViewerRoot
UploadableFileViewerHeader
UploadableFileViewerSummary
UploadableFileViewerContent
```

Rules:

- `UploadableFileViewerRoot` is drag-aware and composes the viewer root role.
- Do not reintroduce `UploadableFileViewerFrame`.
- Dropzone DOM/input behavior stays in acquisition components.
- Selected upload content defaults to `FileViewer`.
- Custom rendering is optional, not required for normal use.
- `FileUploader` remains a standalone upload component for collecting files.

## Leaf Renderer Ideal

Leaf renderers render one source.

Examples:

```txt
FileViewer
HtmlViewer
ImageViewer
CsvViewer
XlsxViewer
DocxViewer
PptxViewer
TextViewer
PdfViewerPages
```

Rules:

- leaf renderers do not own sidebars;
- leaf renderers do not own domain selection;
- leaf renderers do not own upload state;
- leaf renderers do not own MIME projection;
- leaf renderers can expose internal controls only when the controls are part
  of the rendered format.

`FileViewer` is a source router, not a compound viewer framework.

## Naming Canon

Use these words consistently:

```txt
Root       generic outer viewer frame
Header     full-width top region
Body       region below header
Sidebar    side region inside body
Surface    main rendering region
Provider   domain state owner
List       selectable domain collection
Selected   selected domain projection
Pages      PDF page renderer
Thumbnails PDF page thumbnail list
Tree       file-system hierarchy
Summary    upload/source summary
Content    selected upload/source content
Source     renderable file-like input
Resource   normalized source with object URL/download behavior
Part       MIME part
Segment    split result segment
```

Avoid:

```txt
Shell
Frame
Chrome
Panel
Aside
Rail
Slot
Content
Body
Surface
```

`Content`, `Body`, and `Surface` are especially dangerous because they become
synonyms. Use them only where the canon assigns them.

## Required Deletions

Delete these public concepts:

```txt
ViewerShell
ViewerShellSlots
ViewerSlots
PdfViewerSlots
slots
slots.left
slots.right
slots.top
slots.bottom
slots.overlay
renderDocument
renderDocument({ slots })
UploadableFileViewerFrame
```

Delete any compatibility wrapper whose only job is to make old slot or shell
code still work.

This blueprint does not optimize for migration.

It optimizes for the final shape.

## Documentation Standard

Every compound viewer doc must teach in this order:

1. canonical composition;
2. named parts;
3. provider contract;
4. easy API;
5. controlled state examples;
6. accessibility;
7. loading, empty, and error states.

The easy API is not the conceptual center.

Composition is the conceptual center.

## Test Standard

Architecture tests must prove:

- every compound easy API renders one `ViewerRoot`;
- `ViewerHeader` is before `ViewerBody`;
- `ViewerSidebar` and `ViewerSurface` are siblings inside `ViewerBody`;
- no public viewer accepts `slots`;
- no runtime viewer code imports `ViewerShell`;
- no runtime viewer code imports `ViewerSlots`;
- email sidebar renders `Body` and `Attachments`;
- email selected attachment does not duplicate file header chrome;
- nested email messages recurse through `EmailViewer`;
- PDF thumbnails are explicit children under `ViewerSidebar`;
- PDF named parts use narrow hooks;
- split document composition uses children, not render callbacks;
- file-system selected file renders through `FileViewer`;
- uploadable selected file renders through `FileViewer`;
- dropzone behavior is separate from viewer layout.

Behavior tests must prove:

- PDF page navigation, thumbnails, zoom, fit, rotate, and download work;
- email body selection, attachment selection, and nested message rendering work;
- split segment navigation and document synchronization work;
- file-system keyboard navigation and selection work;
- dropzone drag, keyboard activation, rejection, and selected-file rendering
  work;
- loading, empty, and error states are visible and accessible.

## Performance Standard

The ideal architecture must preserve speed:

- heavy renderers are lazy-loaded;
- provider values are memoized by stable domain projections;
- large lists use virtualization when needed;
- PDF page work remains incremental;
- thumbnail generation does not block document rendering;
- source object URLs are created and revoked in one owner;
- composed APIs do not add unnecessary wrapper DOM;
- architecture tests prevent abstractions from growing invisible render cost.

## Final Shape

The final system should feel inevitable:

```txt
Viewer primitives describe space.
Domain providers describe state.
Domain parts describe product UI.
Leaf renderers describe files.
Dropzone describes acquisition.
```

No layer should apologize for another layer.

No API should exist because migration was convenient.

No component should be clever.

The correct composition should be obvious, short, and hard to misuse.
