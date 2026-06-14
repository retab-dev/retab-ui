# Viewer System Terminal Platonic Blueprint

## Verdict

We have not reached the platonic ideal.

We have reached the right direction.

The right direction is not a bigger viewer component. It is not a universal
provider. It is not a slot object. It is not a compatibility shell.

The terminal design is:

```txt
viewer primitives
  own spatial grammar

leaf viewers
  render one source

domain providers
  own one domain state machine

domain parts
  render named pieces from narrow hooks

target adapters
  connect domain state to leaf viewer handles when needed
```

Every viewer in the library should be explainable by that stack. If it needs a
second mental model, the design is not finished.

## Standard

The component family is done only when it satisfies all of these at once:

- simple enough to memorize;
- fast at runtime;
- fast to read;
- complete for the real workflows;
- no compatibility surface;
- no duplicate state machine;
- no hidden layout;
- no generic primitive that exists for only one domain;
- no provider that owns layout;
- no leaf viewer that owns domain selection;
- one word per concept.

Perfection here means deletion. A new abstraction proves itself by removing
state, props, wrappers, and repeated code.

## One Layout Grammar

There is one generic viewer grammar:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

These are the only generic spatial primitives:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not add generic:

```txt
ViewerShell
ViewerFrame
ViewerPanel
ViewerRail
ViewerContent
ViewerToolbar
ViewerFooter
ViewerOverlay
```

A domain may own those words only when they are domain-specific:

```txt
PdfViewerToolbar
SplitViewerPageRail
EmailViewerPartsList
FileSystemViewerTree
```

## Header Rule

The header is always the full-width top region of the composed viewer.

Correct:

```tsx
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
```

Wrong:

```tsx
<ViewerBody>
  <ViewerSidebar>
    <EmailViewerHeader />
    <EmailViewerPartsList />
  </ViewerSidebar>
  <ViewerSurface />
</ViewerBody>
```

Wrong:

```tsx
<ViewerSurface>
  <div className="viewer-card">
    <AttachmentHeader />
    <FileViewer />
  </div>
</ViewerSurface>
```

If the selected attachment is not the whole viewer, it should not create a
second file metadata header above the leaf viewer.

## Primitive Responsibilities

### Viewer Primitives

Own:

- frame;
- border and radius;
- header position;
- body flex relationship;
- sidebar position;
- surface position;
- viewer-level overflow policy;
- generic CSS variables.

Do not own:

- selected file;
- selected MIME part;
- current PDF page;
- split segments;
- upload files;
- OCR blocks;
- extraction sources;
- anchors;
- toolbars.

### Leaf Viewers

Own:

- one renderable source;
- loading;
- resource errors;
- format-native controls;
- format-native imperative handles;
- format-native overlay hooks.

Do not own:

- sidebars;
- selected domain item;
- source acquisition;
- MIME projection;
- split workflow state;
- extraction field state;
- OCR block state;
- anchored document provider state.

`FileViewer` is a source router. It is not the composition center.

### Domain Providers

Own one domain state machine.

Good providers:

```txt
EmailViewerProvider
PdfViewerProvider
SplitViewerProvider
FileSystemViewerProvider
UploadableFileViewerProvider
AnchoredDocumentProvider
```

Each provider must be narrow enough to describe in one sentence:

```txt
EmailViewerProvider owns MIME projection and selected part.
PdfViewerProvider owns PDF resource, page state, zoom, and header controls.
SplitViewerProvider owns split result navigation and selected segment/page.
FileSystemViewerProvider owns tree expansion, selection, and source resolution.
UploadableFileViewerProvider owns acquisition queue and selected upload source.
AnchoredDocumentProvider owns item-anchor preview, selection, and activation.
```

A provider is wrong when it owns layout, class names, render callbacks, file
rendering, or unrelated state machines.

## Named Exports

Use separate named exports, not dot namespaces.

Correct:

```ts
export {
  EmailViewer,
  EmailViewerProvider,
  EmailViewerHeader,
  EmailViewerPartsList,
  EmailViewerSelectedPart,
  useEmailViewer,
  useEmailViewerHeader,
  useEmailViewerPartsList,
  useEmailViewerSelectedPart,
}
```

Avoid:

```tsx
<EmailViewer.Root>
  <EmailViewer.Header />
  <EmailViewer.Body />
</EmailViewer.Root>
```

Separate named exports match the rest of the registry, are easier to search,
tree-shake naturally, and keep each component copyable.

## Easy API Rule

Every domain viewer may expose an easy component:

```tsx
<EmailViewer source={source} />
```

But the easy component is only preassembled explicit composition.

It must be equivalent to the documented JSX:

```tsx
<EmailViewerProvider source={source}>
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

The easy API must not introduce a second hidden layout model through:

```txt
slots
renderSidebar
sidebarPosition
headerPlacement
layoutVariant
children-as-function
```

If the easy component cannot be shown as the primitive composition, it is not a
good easy component.

## Domain Ideals

### Email

Email is a recursive MIME domain, not an anchored-document domain.

It owns:

- message metadata;
- MIME projection;
- body vs attachment grouping;
- selected part;
- nested `message/rfc822` recursion.

It should expose:

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

The sidebar projection is product-level:

```txt
Body
Attachments
```

The raw MIME tree can exist as debug data, but it is not the main UI.

Canonical layout:

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

### PDF With Thumbnails

PDF thumbnails are explicit sidebar composition.

Canonical layout:

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

The thumbnail sidebar is not a prop on `PdfViewer`.

Wrong:

```tsx
<PdfViewer source={source} thumbnails />
```

Right:

```tsx
<ViewerSidebar>
  <PdfViewerThumbnails />
</ViewerSidebar>
```

### Split Viewer

Split viewer is a workflow viewer over an explicit document renderer.

It owns:

- split result state;
- segment legend;
- page or segment navigation;
- workflow controls.

It does not own the PDF renderer.

Canonical layout:

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
          <PdfViewer source={source} bare />
        </SplitViewerDocument>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

No `renderDocument`.

No hidden document slot.

No duplicated PDF controls.

### File System

File-system viewer is a source browser.

It owns:

- tree expansion;
- selected node;
- preview node;
- source resolution;
- folder empty/loading/error states.

It renders selected files through `FileViewer`.

Canonical layout:

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

The old idea of `file-system-chrome` should not survive as a second wrapper
model.

### Dropzone And Uploadable Viewer

Dropzone is source acquisition.

It is not viewer layout.

It is not anchored document state.

It is allowed to compose with viewers through an uploadable domain provider:

```tsx
<UploadableFileViewerProvider accept={accept}>
  <UploadableFileViewerRoot>
    <UploadableFileViewerHeader />
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

`UploadableFileViewerRoot` may be drag-aware because acquisition needs root DOM
events. It still composes the viewer root; it does not create a parallel viewer
layout grammar.

### Anchored Document

Anchored document is not a viewer.

It is an optional interaction provider for experiences where semantic items
point into a rendered document:

```txt
extraction fields
OCR blocks
edit fields
citations
validation issues
review findings
```

It owns only:

```txt
items
preview item
selected item
active item
active anchor
activate item
target navigation
```

It must not know:

```txt
SourceMap
JSON schema paths
PDF files
MIME parts
attachments
OCR block types
field values
sidebars
forms
tabs
layout
```

Canonical layout:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <DomainItems />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewer
          ref={viewerRef}
          source={source}
          bare
          renderPageOverlay={overlay}
        />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

The provider is viable only if it stays narrower than every domain that uses it.

## Anchored Document State Contract

The shared state model is:

```ts
type AnchoredItemId = string

type AnchoredItem = {
  id: AnchoredItemId
  anchor: DocumentAnchor | null
  disabled?: boolean
}
```

The active rule is:

```txt
previewed item wins
else selected item wins
else null
```

Actions:

```ts
type AnchoredDocumentActions = {
  previewItem: (itemId: AnchoredItemId | null) => void
  selectItem: (itemId: AnchoredItemId | null) => void
  activateItem: (
    itemId: AnchoredItemId,
    options?: { behavior?: ScrollBehavior }
  ) => void
  clearPreview: () => void
  clearSelection: () => void
  clear: () => void
}
```

Rules:

- disabled items cannot become active;
- items without anchors can select but cannot navigate;
- filtering out a selected item clears selection;
- filtering out a previewed item clears preview;
- navigation happens only through `activateItem`;
- extraction, OCR, and edit must not reimplement this state machine.

## Target Adapter Contract

Targets adapt anchors to leaf viewer handles.

Core target:

```ts
type AnchoredDocumentTarget = {
  scrollToAnchor: (
    anchor: DocumentAnchor,
    options: { behavior: ScrollBehavior }
  ) => void
}
```

Format helpers may exist beside the target:

```ts
usePdfAnchoredTarget(viewerRef)
usePdfAnchoredOverlay(options)
useImageAnchoredTarget(viewerRef)
useTextAnchoredTarget(viewerRef)
useCsvAnchoredTarget(viewerRef)
useXlsxAnchoredTarget(viewerRef)
useDocxAnchoredTarget(viewerRef)
```

The provider should not change when a target is added.

If adding a format changes provider semantics, the abstraction is wrong.

## Naming Canon

Use these words exactly:

```txt
Root       generic outer viewer frame
Header     full-width top region
Body       region below header
Sidebar    side region inside body
Surface    main rendering region
Provider   owner of one domain state machine
Source     renderable file-like input
Resource   normalized loaded source
Part       MIME part
Segment    split result segment
Item       semantic object in anchored-document
Anchor     document location
Target     adapter from anchor to viewer behavior
Preview    transient active item
Selected   stable active item
Active     resolved preview-or-selected item
Activate   select plus navigate
```

Avoid shared-layer synonyms:

```txt
Shell
Frame
Pane
Panel
Rail
Current
Focused
Hovered
Pinned
Highlighted
SourceLink
SourceMap
```

Domain code may use domain words at the edge. Shared code must not.

## Deletion List

The hard cutover should delete:

- `ViewerShell` as a conceptual center;
- slot-object viewer APIs;
- generic layout props that hide `ViewerBody` structure;
- file-system chrome wrappers that duplicate viewer primitives;
- nested attachment metadata headers inside email selected-part rendering;
- source-link state used as the final extraction abstraction;
- OCR-only selection state;
- duplicated PDF overlay implementations for extraction, OCR, and edit;
- leaf viewer props for anchored items;
- provider props for layout, class names, or render callbacks;
- comments and docs that teach old concepts.

Do not preserve these for migration convenience.

## Architecture Tests

Add tests that fail on drift:

- every composed viewer source contains the visible primitive grammar;
- `ViewerHeader` appears before `ViewerBody` in composed viewers with headers;
- `ViewerSidebar` and `ViewerSurface` are siblings under `ViewerBody`;
- leaf viewers do not import `AnchoredDocumentProvider`;
- viewer primitives do not import domain providers;
- `FileViewer` does not accept `sourceMap`, `anchoredItems`, or layout slots;
- `PdfViewer` does not accept `thumbnails`, `sidebar`, or `anchoredItems`;
- `AnchoredDocumentProvider` does not import leaf viewers, viewer primitives, or
  source-map types;
- email sidebar renders `Body` and `Attachments`, not raw MIME recursion as the
  primary UI;
- split viewer keeps the document renderer explicit;
- dropzone primitives do not import viewer providers.

## Behavioral Tests

Email:

- message header stays full-width;
- body and attachments appear in separate sections;
- selecting an attachment renders the leaf viewer without a second metadata
  card;
- nested messages recurse through `EmailViewer`;
- inline resources resolve without becoming sidebar attachments.

PDF thumbnails:

- thumbnail sidebar scrolls current page into view;
- clicking a thumbnail activates the page;
- page state is shared between header, thumbnails, and pages;
- `PdfViewer` alone still renders without thumbnails.

Split:

- segment legend drives page/segment selection;
- document child remains explicit;
- no duplicated PDF toolbar appears inside split controls.

File system:

- folder and file selection are distinct;
- selected file resolves to a `ViewerSource`;
- file rendering goes through `FileViewer`;
- folder empty/loading/error states are domain states.

Dropzone:

- acquisition works without any viewer;
- uploadable viewer renders selected source through `FileViewer`;
- drag state is confined to acquisition/root parts.

Anchored document:

- preview wins over selection;
- clearing preview restores selection;
- activation scrolls only when an anchor exists;
- disabled items do not activate;
- removed items clear invalid state;
- extraction, OCR, and edit share the same provider semantics.

## Implementation Order

1. Freeze the generic viewer primitive set.
2. Remove layout slot APIs and wrapper concepts.
3. Make each composed viewer show the explicit primitive grammar.
4. Normalize domain providers into narrow hooks.
5. Make easy APIs preassemble the documented composition only.
6. Clean email around `Header / Body / Attachments / SelectedPart`.
7. Clean PDF thumbnails into explicit sidebar composition.
8. Clean split into workflow provider plus explicit document child.
9. Clean file-system into tree plus selected-file source rendering.
10. Keep dropzone as acquisition, with uploadable viewer as composition.
11. Introduce anchored-document only where semantic items point into documents.
12. Migrate extraction, OCR, and edit to the shared anchored state machine.
13. Add architecture tests that forbid regression.
14. Delete old docs, comments, hooks, and wrappers.

## Acceptance Criteria

We can call the viewer system platonic only when all of this is true:

- a reader can understand each composed viewer by reading its JSX;
- the five generic viewer primitives are sufficient;
- every provider owns exactly one coherent state machine;
- every easy API expands to the same documented composition;
- no generic viewer primitive knows a domain;
- no leaf viewer owns a sidebar or domain selection;
- email, PDF thumbnails, split, file-system, uploadable viewer, extraction, OCR,
  and edit all follow the same layout grammar;
- source acquisition, source rendering, domain selection, and anchored document
  interaction are separate layers;
- architecture tests guard the boundaries;
- old names and compatibility concepts are gone.

## Final Sentence

The perfect viewer system is not a powerful component.

It is a small grammar that makes every powerful composition obvious:

```txt
domain state
  rendered through named parts
  arranged by viewer primitives
  ending in leaf viewers
```

