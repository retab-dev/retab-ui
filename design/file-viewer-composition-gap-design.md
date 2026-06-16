# File Viewer Composition Gap Design

## Question

Should the file viewer converge toward this shape?

```tsx
<FileViewer source={source}>
  <FileHeader>
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

This document describes the current system, the gap between the current system
and that ideal, and the design decisions needed to decide whether this target is
actually good.

## Verdict

The target is a good idea, but not literally as written unless `FileViewer`
becomes a small composition root.

The current system is close to the same mental model, but it still exposes too
much of the implementation:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileHeader>
      <FileHeaderTitle />
      <FileHeaderMeta />
      <FileHeaderControls />
    </FileHeader>
    <ViewerBody>
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

That is already coherent. The remaining question is whether the public grammar
should compress `FileViewerProvider + ViewerRoot + FileViewerContent` into a
more elegant `FileViewer + FileContent` grammar.

My position:

```txt
Yes, the grammar should move in that direction.
No, we should not hide layout decisions inside a magical FileViewer.
Yes, FileViewer can become the file-scoped root/provider.
No, FileViewer should not become a workflow shell.
```

## Current System

### 1. `ViewerRoot`

`ViewerRoot` is the generic layout primitive.

It owns:

- outer frame;
- `bare` frame removal;
- sidebar open state;
- sidebar controlled/uncontrolled state;
- sidebar trigger context;
- inline versus overlay sidebar mode;
- one registered primary sidebar.

It does not own:

- file identity;
- file type detection;
- PDF page state;
- email MIME state;
- split/partition semantics;
- extraction/OCR evidence;
- file-system selection.

This is the right boundary. `ViewerRoot` is not a file viewer. It is a viewer
layout surface.

Current anatomy:

```txt
ViewerRoot
  ViewerHeader
  ViewerBody
    ViewerSidebar
    ViewerSurface
```

This is shadcn-compatible because the pieces are named, composable, and
provider-backed where behavior needs context.

### 2. `FileViewerProvider`

`FileViewerProvider` is the current file-scoped provider.

It owns:

- source;
- resolved resource;
- descriptor;
- descriptor key;
- descriptor abort signal;
- client readiness;
- isolated style preference;
- registered renderer controls.

This is useful, but dense. It is currently the largest conceptual object in the
file viewer system.

The provider exists because `FileHeader`, `FileHeaderTitle`, `FileHeaderMeta`,
`FileHeaderControls`, and `FileViewerContent` need shared state.

That is a legitimate provider. The problem is not that a provider exists. The
problem is that callers must often see the provider even when they are only
trying to write normal file viewer composition.

### 3. `FileHeader`

`FileHeader` is the shared file chrome row.

Current anatomy:

```tsx
<FileHeader>
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

This is the strongest part of the system right now.

It gives us:

- one header row for all file-backed viewers;
- no PDF-specific private header;
- no duplicated title/icon/meta row;
- domain viewers that can insert sidebar triggers or domain metadata;
- a single place to align title, meta, and controls.

The latest direction is correct:

```txt
title, meta <----------------------------> controls
```

The title should not consume the whole row. The controls should own the
right-side push.

### 4. `FileViewerContent`

`FileViewerContent` is the routed file renderer.

It chooses between:

- PDF;
- DOCX;
- image;
- PPTX;
- XLSX;
- CSV;
- Markdown;
- HTML;
- text/code;
- unsupported state.

This is the correct role. It should be content, not chrome.

The name is slightly heavy. In the ideal grammar, `FileContent` reads better
because it is clearly the content part inside a `FileViewer` root. The current
name is safer in the existing export surface because `FileViewer` is still the
complete easy API.

### 5. Renderer Providers

Some renderers have their own provider because they need renderer-specific
state.

Example: PDF.

```tsx
<FileViewerProvider source={source}>
  <PdfViewerProvider source={source}>
    ...
    <PdfViewerPages />
    ...
  </PdfViewerProvider>
</FileViewerProvider>
```

`PdfViewerProvider` owns PDF-specific state:

- current page;
- PDF resource;
- document handle;
- thumbnail navigation.

This boundary is good in spirit. PDF page navigation is not file identity.

The flaw is that `FileViewerProvider` and `PdfViewerProvider` currently both
derive resource state from the same source. That means the model is conceptually
duplicated even if the runtime cost is acceptable.

Platonic direction:

```txt
FileViewerProvider owns the canonical resource.
PdfViewerProvider consumes the canonical resource.
```

### 6. Controls Registration

Renderer content can register controls upward through `ViewerControls`.

For PDF, the page renderer owns the real mechanics:

- current page;
- total pages;
- zoom;
- fit;
- rotate;
- download action.

The file header owns placement:

```tsx
<FileHeaderControls />
```

This separation is directionally right.

The remaining weakness is taste. The registration protocol is visible in the
internal architecture:

```txt
ViewerControlsRegistrationProvider
useViewerControlsRegistration
controlsState
setControlsState
```

It works, but it is not yet as obvious as the sidebar trigger pattern. It should
feel like:

```txt
content provides controls
header displays controls
```

not:

```txt
a renderer registers a serializable-ish controls state into a parent provider
```

The implementation can still use registration. The public model should not make
users think about it.

### 7. Complete Easy APIs

The system still has complete easy APIs such as:

```tsx
<FileViewer source={source} />
<PdfViewer source={source} />
```

Those are good. A shadcn-grade component should have both:

```txt
easy API for normal use
composed API for product layouts
```

The danger is when the easy API becomes the conceptual center. The conceptual
center should be the anatomy, not the convenience wrapper.

## Gap To The Ideal

### Ideal

```tsx
<FileViewer source={source}>
  <FileHeader>
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

### Current Equivalent

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileHeader>
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

### Gap 1: `FileViewer` Is Not The Composition Root

Today, `FileViewer` means the complete easy viewer.

The ideal wants `FileViewer` to mean the file-scoped root:

```tsx
<FileViewer source={source}>{children}</FileViewer>
```

That can be good, but it changes the semantics of the component.

There are two possible designs.

#### Option A: Keep The Explicit Provider

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    ...
  </ViewerRoot>
</FileViewerProvider>
```

Advantages:

- explicit;
- no overloaded component;
- current code already works this way;
- clear difference between provider and complete viewer.

Disadvantages:

- more ceremony;
- less shadcn-like at the callsite;
- users must learn one more wrapper;
- `FileViewerProvider` reads like implementation, not anatomy.

#### Option B: Make `FileViewer` A Root/Provider

```tsx
<FileViewer source={source}>
  <FileHeader />
  <ViewerBody />
</FileViewer>
```

Advantages:

- beautiful callsite;
- `FileViewer` becomes the obvious conceptual center;
- source ownership and file anatomy sit in one visible component;
- matches the user mental model: "this whole thing is a file viewer."

Disadvantages:

- `FileViewer` becomes overloaded unless carefully designed;
- without children, it must still render the easy default;
- with children, it must not inject hidden chrome;
- it still needs to decide whether it renders `ViewerRoot` itself.

My recommendation is Option B, with strict rules:

```txt
FileViewer with children = file provider + viewer root.
FileViewer without children = complete default composition.
FileViewer never owns workflow semantics.
```

### Gap 2: `ViewerRoot` Is Still Separate

The ideal snippet uses:

```tsx
<FileViewer source={source}>
  ...
</FileViewer>
```

It does not show `ViewerRoot`.

That implies `FileViewer` includes `ViewerRoot`.

This is attractive, but it must be handled carefully.

If `FileViewer` renders `ViewerRoot`, it should forward the generic viewer root
props:

```tsx
<FileViewer
  source={source}
  defaultOpen
  mode="auto"
  sidebarSide="left"
  bare
>
  ...
</FileViewer>
```

That is convenient but increases the `FileViewer` API surface.

Alternative:

```tsx
<FileViewer source={source}>
  <ViewerRoot>
    ...
  </ViewerRoot>
</FileViewer>
```

This keeps layout explicit but loses the exact ideal shape.

The cleanest final design is probably:

```tsx
<FileViewer source={source} bare defaultOpen>
  <FileHeader />
  <ViewerBody />
</FileViewer>
```

where `FileViewer` renders `ViewerRoot` internally and only forwards the small
viewer root prop set that is already fundamental to file-viewer composition:

- `bare`;
- `className`;
- `defaultOpen`;
- `open`;
- `onOpenChange`;
- `mode`;
- `inlineBreakpoint`;
- `sidebarSide`;
- `sidebarCollapsible`.

That is acceptable because those are layout concerns of the file viewer frame.

### Gap 3: `FileContent` Does Not Exist

The current component is:

```tsx
<FileViewerContent />
```

The ideal component is:

```tsx
<FileContent />
```

`FileContent` is better if `FileViewer` becomes the root. It reads like the
named part of the root.

Final naming should avoid both ambiguity and verbosity:

```txt
FileViewer       root/easy API
FileHeader       top chrome
FileHeaderTitle  identity
FileHeaderMeta   passive facts
FileHeaderControls renderer controls
FileContent      routed file content
```

Compatibility can keep `FileViewerContent` as an alias for a while, but the
ideal grammar should prefer `FileContent`.

### Gap 4: Resource Ownership Is Duplicated

The current PDF path nests:

```txt
FileViewerProvider source -> createViewerResource(source)
PdfViewerProvider source  -> createViewerResource(source)
```

That is not perfect.

The ideal should be:

```txt
FileViewer creates resource once.
Pdf renderer consumes that resource.
Pdf provider owns only PDF state.
```

Possible final shape:

```tsx
<FileViewer source={source}>
  <PdfViewerProvider resource={file.resource}>
    <PdfViewerPages />
  </PdfViewerProvider>
</FileViewer>
```

But the user should not write that in normal routed file viewing. The route
should wire it internally.

For direct PDF composition, the public API could be:

```tsx
<PdfViewerProvider>
  <PdfViewerPages />
  <PdfViewerThumbnails />
</PdfViewerProvider>
```

where `PdfViewerProvider` reads the current file resource if one exists, or
accepts `source`/`resource` explicitly when standalone.

### Gap 5: Controls Have Two Homes

Today renderer controls can be:

1. rendered locally by the renderer;
2. registered upward into `FileHeaderControls`.

This dual mode is useful but not beautiful.

The ideal model:

```txt
FileHeaderControls is the canonical visible location.
Renderer-local controls exist only for standalone non-file compositions.
```

For file-routed content:

```tsx
<FileHeaderControls />
<FileContent />
```

`FileContent` should render no internal toolbar.

For standalone renderer usage:

```tsx
<PdfViewerPages toolbar />
```

or:

```tsx
<PdfViewer source={source} />
```

This keeps standalone components useful without polluting the file viewer
composition.

### Gap 6: Metadata Is Not Fully Settled

`FileHeaderMeta` currently chooses from resource MIME type, descriptor MIME
type, or category.

That is good enough for now, but not final.

The ideal metadata should be passive and concise:

```txt
pdf
application/pdf
1.2 MB
Page 44 of 96
Sheet 2 of 5
```

The hard decision is whether active renderer position belongs in
`FileHeaderMeta` or `FileHeaderControls`.

For the proposed layout:

```txt
title, meta <----------------------------> controls
```

the best rule is:

```txt
FileHeaderMeta: stable file facts.
FileHeaderControls: dynamic viewer position and operations.
```

That means:

```txt
left:  nvidia-10k-fy2024.pdf, pdf
right: Page 44 of 96  -  100%  +  fit rotate download
```

If we decide page position should sit next to file type on the left, the naming
needs one more part:

```tsx
<FileHeaderStatus />
```

But that is probably too much. Keep the dynamic position with controls.

### Gap 7: Domain Viewers Still Need A Clear Rule

Split, partition, sources, OCR, email, edit, and file-system viewers should not
be absorbed into `FileViewer`.

They should compose around it.

Correct:

```tsx
<SplitViewerProvider split={split}>
  <FileViewer source={source}>
    <FileHeader>
      <ViewerSidebarTrigger />
      <FileHeaderTitle />
      <SplitViewerHeaderMeta />
      <FileHeaderControls />
    </FileHeader>
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerLegend />
      </ViewerSidebar>
      <ViewerSurface>
        <FileContent />
      </ViewerSurface>
    </ViewerBody>
  </FileViewer>
</SplitViewerProvider>
```

Incorrect:

```tsx
<FileViewer
  source={source}
  split={split}
  partition={partition}
  emailParts={parts}
/>
```

`FileViewer` is file rendering and file chrome. It is not a workflow renderer.

## Is The Ideal Good?

Yes, if it is interpreted as an anatomy.

The ideal is good because it makes the public composition obvious:

```txt
FileViewer owns file scope.
FileHeader owns top chrome.
FileHeaderTitle owns identity.
FileHeaderMeta owns passive facts.
FileHeaderControls owns renderer operations.
ViewerBody owns layout.
ViewerSidebar owns navigation/secondary content.
ViewerSurface owns primary content.
FileContent owns routed file rendering.
```

That is simple. It is modular. It is shadcn-like.

The ideal is bad if `FileViewer` becomes a giant component with many props:

```tsx
<FileViewer
  source={source}
  sidebar="thumbnails"
  splitLegend
  partitionRibbon
  emailAttachments
  extractionBboxes
  showPdfControls
  showImageControls
/>
```

That would destroy the architecture.

The difference is composition versus configuration.

The proposed ideal is good only if the answer to customization is:

```tsx
compose parts
```

not:

```tsx
add props
```

## Design Decisions

### Decision 1: Keep `ViewerRoot` Generic

`ViewerRoot` should remain the only owner of viewer layout and sidebar state.

Even if `FileViewer` renders `ViewerRoot` internally, the underlying primitive
must stay generic.

Reason:

```txt
email, split, partition, edit, parse, OCR, sources, and file-system viewers
need the same shell behavior without becoming file renderers.
```

### Decision 2: Make File Scope Explicit

There must be one file scope.

Today that is `FileViewerProvider`.

The ideal can rename/compress that scope into `FileViewer`, but the underlying
idea must remain:

```txt
source -> descriptor -> resource -> header/content/controls
```

### Decision 3: Make File Resource Canonical

One source should create one canonical resource for one file viewer scope.

Renderer providers should consume the canonical resource.

They should not independently derive the same resource unless they are used
standalone outside a file viewer.

### Decision 4: Keep Renderer State Local

PDF current page, PDF document handle, image transform, spreadsheet sheet state,
and text/code scale should stay renderer-specific.

They should not move into `FileViewerProvider`.

`FileViewerProvider` may host registered controls. It should not own the
renderer state behind those controls.

### Decision 5: Treat Controls As A Slot, Not A Toolbar

`FileHeaderControls` should be the slot where renderer controls appear.

It should not know whether controls came from PDF, image, text, or CSV.

Renderer code should describe available controls. Header code should place them.

### Decision 6: Prefer Named Parts Over Options

Good:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

Bad:

```tsx
<FileHeader showSidebarTrigger showMeta showControls />
```

The first is shadcn-grade. The second becomes prop soup.

### Decision 7: Let Domain Viewers Compose, Not Extend

An email viewer is not a subclass of file viewer.

It is a domain viewer that contains file viewers:

```txt
email message
  header
  body/sidebar layout
  selected MIME leaf rendered by FileContent/FileViewer
```

Same for split, partition, sources, OCR, edit, and file-system.

The file viewer should be strong enough to sit inside those domains without
making them inherit its semantics.

## Recommended Final Public Grammar

### Easy API

```tsx
<FileViewer source={source} />
```

Renders:

```tsx
<FileViewer source={source}>
  <FileHeader>
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>
  <ViewerBody>
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

### Composed API

```tsx
<FileViewer source={source} defaultOpen>
  <FileHeader>
    <ViewerSidebarTrigger />
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>
  <ViewerBody>
    <ViewerSidebar>
      <PdfViewerThumbnails />
    </ViewerSidebar>
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

### Domain API

```tsx
<PartitionViewerProvider result={result}>
  <FileViewer source={source}>
    <FileHeader>
      <ViewerSidebarTrigger />
      <FileHeaderTitle />
      <PartitionViewerHeaderMeta />
      <FileHeaderControls />
    </FileHeader>
    <ViewerBody>
      <ViewerSidebar>
        <PartitionLegend />
      </ViewerSidebar>
      <ViewerSurface>
        <FileContent />
        <PartitionOverlays />
      </ViewerSurface>
    </ViewerBody>
  </FileViewer>
</PartitionViewerProvider>
```

## Implementation Direction

### Phase 1: Stabilize Current Anatomy

Keep the current components:

```txt
FileViewerProvider
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
FileViewerContent
```

Make sure all file-backed examples use them consistently.

No private `PdfViewerHeader`.
No duplicate file title rows.
No icon in title by default.
No meta pushed to the right by title flex.

### Phase 2: Remove Duplicate Resource Derivation

Make renderer providers accept a resource or read the current file resource.

PDF is the first target:

```txt
before:
  FileViewerProvider(source)
  PdfViewerProvider(source)

after:
  FileViewerProvider(source)
  PdfViewerProvider(resource)
```

or:

```txt
PdfViewerProvider reads FileViewer resource when nested.
```

The second option is ergonomically better but needs careful dependency control.

### Phase 3: Introduce `FileContent`

Add:

```tsx
export const FileContent = FileViewerContent
```

Then update docs and examples to prefer:

```tsx
<FileContent />
```

inside a file viewer composition.

### Phase 4: Decide Whether `FileViewer` Can Be A Root

If yes, implement:

```tsx
<FileViewer source={source}>{children}</FileViewer>
```

as:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>{children}</ViewerRoot>
</FileViewerProvider>
```

When `children` is absent, render the default composition.

This must not break the easy API.

### Phase 5: Make Controls Registration Feel Private

Keep the registration internals if needed, but make the conceptual API:

```tsx
<FileHeaderControls />
```

and:

```tsx
<FileContent />
```

No user should need to know about:

```txt
ViewerControlsRegistrationProvider
controlsState
setControlsState
```

unless they are building a new renderer.

## Anti-Goals

Do not make `FileViewer` understand:

- split jobs;
- partition consensus;
- OCR schemas;
- extraction fields;
- email MIME trees;
- file-system trees;
- upload queues;
- workflow runs.

Do not add props like:

```txt
showPartitionRibbon
emailMode
sourceBboxMode
thumbnailSidebar
splitLegend
```

Those are compositions, not file viewer options.

Do not make the generic `ViewerRoot` file-aware.

Do not make renderer-specific state global.

## Final Test

The design is right when these examples all feel natural.

### Plain File

```tsx
<FileViewer source={source} />
```

### PDF With Thumbnails

```tsx
<FileViewer source={source} defaultOpen>
  <FileHeader>
    <ViewerSidebarTrigger />
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>
  <ViewerBody>
    <ViewerSidebar>
      <PdfViewerThumbnails />
    </ViewerSidebar>
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

### Email Attachment

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
    <EmailHeader />
    <ViewerBody>
      <ViewerSidebar>
        <EmailPartsSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewer source={selectedPart.source} bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

### Split Viewer

```tsx
<SplitViewerProvider split={split}>
  <FileViewer source={source}>
    <FileHeader>
      <ViewerSidebarTrigger />
      <FileHeaderTitle />
      <SplitViewerHeaderMeta />
      <FileHeaderControls />
    </FileHeader>
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerLegend />
      </ViewerSidebar>
      <ViewerSurface>
        <FileContent />
        <SplitViewerOverlays />
      </ViewerSurface>
    </ViewerBody>
  </FileViewer>
</SplitViewerProvider>
```

If this feels obvious, the system is good.

If implementing those examples requires special props, duplicate headers,
manual resource plumbing, or local toolbar suppression flags everywhere, the
system is not done.

## Final Position

The proposed ideal is the right north star.

The current system has the right pieces:

- `ViewerRoot` for layout;
- `FileHeader` for file chrome;
- `FileHeaderTitle` for identity;
- `FileHeaderMeta` for passive facts;
- `FileHeaderControls` for renderer operations;
- `FileViewerContent` for routed rendering;
- renderer providers for renderer-specific state.

The remaining imperfection is that the pieces are not compressed into one
inevitable grammar yet. The biggest structural gap is duplicate resource
ownership between file scope and renderer scope. The biggest taste gap is
controls registration feeling like machinery instead of anatomy.

The design should continue toward:

```tsx
<FileViewer source={source}>
  <FileHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

but with one strict constraint:

```txt
FileViewer is the file primitive, not the workflow primitive.
```

