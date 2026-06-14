# Viewer Primitives Remaining Platonic Gap Blueprint

## Verdict

The merged viewer architecture is good.

It is not yet the platonic ideal.

The direction is correct:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The remaining work is not another abstraction. It is compression.

The goal is to make the implementation feel inevitable:

- one visible layout grammar;
- one source vocabulary;
- one naming system;
- domain providers with minimal state;
- leaf renderers that only render;
- no shell residue;
- no slot residue;
- no compatibility paths;
- no "almost the same thing" names.

## Non-Negotiable Architecture

```txt
Viewer primitives own space.
Domain providers own shared domain state.
Domain parts project that state into UI.
Leaf renderers render selected sources.
Source-acquisition primitives create sources.
```

Every file in the viewer system should fit exactly one of those buckets.

If a component cannot be placed in one bucket, it is either too broad or named
incorrectly.

## Current Quality Level

The implementation has crossed the important architectural line:

- `ViewerShell` and `ViewerSlots` are no longer the conceptual center;
- compound viewers can be expressed as explicit JSX;
- `FileViewer` is closer to a leaf router;
- email, PDF thumbnails, split viewer, file system, and dropzone all have a
  plausible provider-plus-parts shape.

But the code still carries implementation history:

- some provider surfaces are too wide;
- some easy APIs and composed APIs are not clearly separated;
- some leaf renderers still expose frame/chrome details that should be either
  internal or consistently named;
- naming is improved but not mathematically consistent;
- generated registry output and docs need one final pass to teach the primitive
  grammar as the only mental model.

## Provider Rule

Providers are not a dead end.

Unbounded providers are a dead end.

A provider is justified only when separated named parts need shared domain
state.

Good provider responsibilities:

- normalize input;
- derive stable product projections;
- own controlled/uncontrolled selection;
- expose the smallest hook contract needed by named parts;
- convert selected domain objects into `ViewerSource`;
- centralize imperative coordination only when multiple parts need it.

Forbidden provider responsibilities:

- layout;
- className choreography;
- sidebar styling;
- toolbar placement;
- file rendering;
- dropzone DOM layout;
- compatibility with removed slot APIs;
- generic viewer state.

Provider hooks should be boring and narrow. If a hook returns a large bag of
unrelated values, split the provider internals or split the named part API.

## Primitive Rule

The public primitive set remains:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not add `ViewerToolbar`, `ViewerRail`, `ViewerFooter`, `ViewerAside`, or
`ViewerOverlay` until at least three independent viewers prove the same
semantic region is needed.

Local component names may mention those ideas:

```txt
PdfViewerToolbar
SplitViewerPageRail
EmailViewerPartsList
```

But they are domain parts, not generic viewer primitives.

## Easy API Rule

Every compound viewer may expose an easy API:

```tsx
<PdfViewer source={source} />
<EmailViewer message={message} />
<SplitViewer result={result} />
<FileSystem tree={tree} />
<DropzoneUploaderViewer />
```

But the easy API must be only preassembled composition.

It must not own a second layout model.

The easy API implementation should read like the documentation example:

```tsx
export function PdfViewer(props: PdfViewerProps) {
  return (
    <PdfViewerProvider {...providerProps}>
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
  )
}
```

If an easy API has hidden branches that construct alternate layouts, it is no
longer sugar. It has become a second system.

## Naming Rules

Use one word per concept.

```txt
Root      generic viewer frame
Header    full-width viewer header
Body      region below header
Sidebar   side region inside body
Surface   main rendering region
Provider  domain state owner
List      selectable domain collection
Selected  currently selected domain projection
Pages     rendered PDF pages
Thumbnails PDF page thumbnails
Tree      file-system hierarchy
Summary   upload/source summary
Content   selected upload/source content
```

Avoid synonyms unless the concept is genuinely different:

```txt
Frame
Shell
Chrome
Rail
Aside
Panel
Content
Body
Surface
```

Those words are currently too easy to use interchangeably. The final pass
should eliminate ambiguity.

Preferred names:

```txt
PlainTextViewerFrame       internal leaf frame
ViewerRoot                 generic compound viewer frame
ViewerSurface              generic main rendering region
PdfViewerPages             PDF leaf page renderer
PdfViewerThumbnails        PDF page-thumbnail domain part
EmailViewerPartsList       product projection list
EmailViewerSelectedPart    selected MIME/source projection
FileSystemViewerTree       file-system hierarchy
FileSystemViewerSelectedFile selected file projection
UploadableFileViewerSummary upload/source summary
UploadableFileViewerContent selected upload/source projection
```

Names to remove or prevent from returning:

```txt
ViewerShell
ViewerSlots
PdfViewerSlots
slots
left
right
top
bottom
overlay
renderDocument({ slots })
```

## Source Rule

The shared abstraction is `ViewerSource`.

Different domains may produce it:

```txt
email MIME part       -> ViewerSource
file-system node      -> ViewerSource
dropzone file item    -> ViewerSource
URL sample            -> ViewerSource
split document source -> ViewerSource
```

Do not create a fake universal "file intake" abstraction above those domains.

The convergence point is source rendering, not source acquisition.

## Component Targets

### FileViewer

Target role:

```txt
leaf source router
```

It should:

- accept a source/resource;
- detect the renderer;
- lazy-load heavy renderers;
- pass `bare` or equivalent leaf framing intent consistently;
- preserve download/error behavior.

It should not:

- own viewer layout;
- own sidebar state;
- own selected attachment;
- own upload state;
- expose slot props;
- special-case compound viewer composition.

### PdfViewer

Target role:

```txt
compound PDF viewer composed from provider + primitives + PDF parts
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

Remaining perfection work:

- keep named PDF parts on narrow hooks:
  `usePdfViewerHeader`, `usePdfViewerPages`, and
  `usePdfViewerThumbnails`;
- ensure thumbnail/page coordination has one owner;
- ensure toolbar controls do not leak layout assumptions;
- keep `PdfViewerPages` a renderer, not a layout manager;
- make the block example identical to the canonical composition.

### EmailViewer

Target role:

```txt
recursive MIME domain viewer projected into product UI
```

Public parts:

```txt
EmailViewer
EmailViewerProvider
useEmailViewer
EmailViewerHeader
EmailViewerPartsList
EmailViewerSelectedPart
```

The sidebar should be a product projection:

```txt
Body
Attachments
```

It should not expose the raw MIME tree as the primary UI.

Nested messages should recurse by rendering another `EmailViewer` inside the
selected part surface. The recursion belongs to the domain projection, not to
generic viewer primitives.

Remaining perfection work:

- keep named parts on narrow hooks:
  `useEmailViewerHeader`, `useEmailViewerPartsList`, and
  `useEmailViewerSelectedPart`;
- make `EmailViewerPartsList` vocabulary body/attachments only;
- ensure inline body parts and attachments produce the same selected-source
  shape;
- remove any attachment-specific header nesting that duplicates viewer chrome;
- make recursive message rendering explicit and test-covered.

### SplitViewer

Target role:

```txt
workflow viewer over selected document rendering
```

Public parts:

```txt
SplitViewer
SplitViewerProvider
useSplitViewer
useSplitViewerHeader
useSplitViewerPageRail
useSplitViewerLegend
useSplitViewerDocument
useSplitViewerDocumentControls
SplitViewerHeader
SplitViewerLegend
SplitViewerPageRail
SplitViewerDocument
```

Remaining perfection work:

- keep legend/header composition explicit;
- keep page rail/sidebar composition explicit;
- keep named split parts on narrow hooks:
  `useSplitViewerHeader`, `useSplitViewerPageRail`,
  `useSplitViewerLegend`, and `useSplitViewerDocument`;
- remove any hidden document-render callback shape that smuggles layout;
- ensure `SplitViewerDocument` is a domain overlay/projection, not a PDF clone.

### FileSystem

Target role:

```txt
file-system domain viewer
```

Public parts:

```txt
FileSystem
FileSystemViewerProvider
useFileSystemViewer
useFileSystemViewerHeader
useFileSystemViewerTree
useFileSystemViewerSelectedFile
FileSystemViewerHeader
FileSystemViewerTree
FileSystemViewerSelectedFile
```

Remaining perfection work:

- keep the easy API named `FileSystem`; reserve `FileSystemViewer*` for
  provider parts;
- keep named file-system parts on narrow hooks:
  `useFileSystemViewerHeader`, `useFileSystemViewerTree`, and
  `useFileSystemViewerSelectedFile`;
- keep tree state inside the provider;
- ensure selected file resolution ends at `ViewerSource`;
- ensure selected file rendering is delegated to `FileViewer`.

### UploadableFileViewer

Target role:

```txt
source acquisition plus selected source viewer
```

Public parts:

```txt
UploadableFileViewerProvider
useUploadableFileViewer
useUploadableFileViewerRoot
useUploadableFileViewerHeader
useUploadableFileViewerSummary
useUploadableFileViewerContent
UploadableFileViewerRoot
UploadableFileViewerHeader
UploadableFileViewerSummary
UploadableFileViewerContent
DropzoneUploaderViewer
```

Remaining perfection work:

- keep `UploadableFileViewerRoot` as the drag-aware domain root composed over
  `ViewerRoot`; do not reintroduce `UploadableFileViewerFrame`;
- keep named uploadable parts on narrow hooks:
  `useUploadableFileViewerRoot`, `useUploadableFileViewerHeader`,
  `useUploadableFileViewerSummary`, and `useUploadableFileViewerContent`;
- ensure dropzone DOM/input behavior lives in acquisition code, not viewer
  primitives;
- keep `DropzoneUploaderViewer` usable without custom render props by defaulting
  selected upload content to `FileViewer`;
- keep `FileUploader` separate from viewer composition.

## Deletion And Compression Pass

Run a final audit for these patterns:

```txt
ViewerShell
ViewerSlots
slots
slot
Rail
Aside
Panel
Chrome
Frame
Content
Body
Surface
selectedFile
selectedSource
selectedPart
currentPart
activePart
```

For every occurrence:

1. Decide which architectural bucket it belongs to.
2. Rename it if the word conflicts with the bucket.
3. Delete it if it exists only to bridge old and new shapes.
4. Add a focused test if the distinction is architectural.

The goal is not fewer files by itself.

The goal is fewer concepts.

## Documentation Standard

Every compound viewer doc should start with the canonical composition.

The easy API should be presented second.

Correct order:

1. explicit composition;
2. named parts;
3. provider contract;
4. easy API;
5. controlled state examples;
6. accessibility and loading/error behavior.

Wrong order:

1. easy API;
2. props table;
3. hidden implementation detail;
4. composition as an advanced escape hatch.

Composition is not the escape hatch. Composition is the system.

## Test Standard

Architecture tests should prove:

- every easy API renders one `ViewerRoot`;
- `ViewerHeader` is before `ViewerBody`;
- `ViewerSidebar` and `ViewerSurface` are siblings inside `ViewerBody`;
- no public viewer accepts `slots`;
- no runtime code imports `ViewerShell` or `ViewerSlots`;
- PDF thumbnails are explicit children under `ViewerSidebar`;
- email parts are body/attachments projection, not raw MIME dump;
- split legend and page rail are explicit named parts;
- file system selected file renders through `FileViewer`;
- dropzone selected file renders through `FileViewer`;
- provider hooks do not expose layout-only fields.

Behavior tests should prove:

- PDF page, zoom, thumbnails, and download still work;
- email attachment selection and nested message rendering work;
- split page/segment navigation still works;
- file-system keyboard and selection behavior still works;
- dropzone drag, keyboard, rejection, and selected-file behavior still work;
- error, loading, and empty states are visible and accessible.

## Performance Standard

Platonic viewer composition must be fast in three ways:

```txt
runtime
rendering
reader comprehension
```

Runtime:

- heavy renderers remain lazy;
- PDF document state is shared between pages and thumbnails;
- object URLs are created and revoked once;
- source normalization is memoized at domain boundaries.

Rendering:

- provider values are split or memoized to avoid broad re-renders;
- thumbnail/page scrolling does not trigger unrelated header renders;
- selected source changes do not remount unrelated sidebar structure;
- leaf renderers keep their virtualization and worker boundaries.

Reader comprehension:

- the primary JSX tree explains the layout;
- provider hooks are small;
- names match the visible UI;
- no component compensates for another component's unclear job.

## Completion Criteria

We can call the viewer system platonic only when all of these are true:

- the canonical tree is the only layout grammar;
- compound viewers are provider plus named parts;
- easy APIs are literal preassembled compositions;
- `FileViewer` is only a source router/leaf renderer;
- every domain converges at `ViewerSource`;
- docs teach composition first;
- tests enforce the grammar;
- no naming pair means the same concept;
- no component exists only because the old architecture once existed;
- deleting compatibility code does not remove any desired behavior.

Until then, the design is good, not perfect.
