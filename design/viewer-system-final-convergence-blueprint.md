# Viewer System Final Convergence Blueprint

## Objective

Turn the viewer work from a strong architecture into a finished component
system.

The previous passes answered the main design question:

```txt
Viewer primitives own spatial grammar.
Leaf viewers render one source.
Domain providers own one domain state machine.
Domain parts project provider state into named UI.
Source acquisition produces sources.
Anchored document owns source-to-document activation.
```

This blueprint defines the last convergence pass.

The goal is not to add a new concept. The goal is to make the concepts that
survived unavoidable.

## Verdict

The direction is right.

The system is not done.

It becomes done only when every public viewer and every registry block follows
the same visible grammar, and when old one-off viewer histories are either
absorbed into the grammar or deleted.

The final shape should be boring in the best way:

```tsx
<DomainViewerProvider>
  <ViewerRoot>
    <DomainViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <DomainViewerSidebarPart />
      </ViewerSidebar>
      <ViewerSurface>
        <DomainViewerSurfacePart />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DomainViewerProvider>
```

The provider pattern is still correct, but only as a narrow state boundary.
Provider-as-layout is a dead end. Provider-as-domain-state is the useful idea.

## Non-Negotiable Grammar

There are five generic viewer primitives:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

There is no sixth primitive until at least three independent viewer domains need
the exact same semantic region.

Do not add generic:

```txt
ViewerShell
ViewerFrame
ViewerPanel
ViewerPane
ViewerRail
ViewerToolbar
ViewerFooter
ViewerOverlay
ViewerContent
```

Those words may remain domain-local only when the domain proves the concept:

```txt
PdfViewerToolbar
SplitViewerPageRail
EmailViewerPartsList
EditViewerFieldPanel
```

## Public Surface

The component library should expose separate named exports.

Correct:

```ts
export {
  ViewerRoot,
  ViewerHeader,
  ViewerBody,
  ViewerSidebar,
  ViewerSurface,
  EmailViewer,
  EmailViewerProvider,
  EmailViewerHeader,
  EmailViewerPartsList,
  EmailViewerSelectedPart,
}
```

Avoid:

```tsx
<EmailViewer.Root />
<EmailViewer.Header />
<EmailViewer.Sidebar />
```

The dot form is elegant for a hand-authored app. It is worse for this registry:
less searchable, less copyable, less explicit in dependency files, and more
likely to hide which pieces are actual primitives.

## Taxonomy

### Viewer Primitives

Own:

- outer frame;
- top header position;
- body flex relationship;
- sidebar placement;
- surface placement;
- generic overflow;
- generic CSS variables.

Do not own:

- selected file;
- selected MIME part;
- PDF page;
- split segment;
- upload queue;
- extraction field;
- OCR block;
- source anchor;
- render callbacks.

### Leaf Viewers

Examples:

```txt
PdfViewer
ImageViewer
TextViewer
CodeViewer
CsvViewer
XlsxViewer
DocxViewer
PptxViewer
HtmlViewer
FileViewer
PretextMarkdownViewer
MarkdownDocumentViewer
```

Own:

- rendering one source or one already-resolved resource;
- loading state;
- resource errors;
- format-native controls;
- format-native imperative handle;
- format-native target adapter hooks.

Do not own:

- sidebar state;
- source acquisition;
- MIME projection;
- workflow navigation;
- extraction field state;
- OCR block state;
- anchored activation state.

`FileViewer` is a router from `ViewerSource` to a leaf viewer. It is not the
composition primitive.

### Domain Providers

Each provider owns exactly one state machine.

```txt
EmailViewerProvider
  owns MIME projection and selected part.

PdfViewerProvider
  owns PDF resource, page, zoom, and header controls.

SplitViewerProvider
  owns split result navigation and selected segment/page.

FileSystemViewerProvider
  owns tree expansion, selection, and source resolution.

UploadableFileViewerProvider
  owns acquisition queue and selected upload source.

AnchoredDocumentProvider
  owns item-anchor preview, selection, and activation.

ParseViewerProvider
  owns parse-result page markdown state.

PartitionViewerProvider
  owns partition-result page navigation and status projection.

ClassifierViewerProvider
  owns classification-result document state.
```

A provider becomes wrong the moment it owns:

- layout;
- class names for generic viewer regions;
- file rendering;
- unrelated domain state;
- broad render callbacks;
- compatibility modes.

### Domain Parts

Domain parts are named components that consume one provider and render one
piece of UI.

Examples:

```txt
EmailViewerHeader
EmailViewerPartsList
EmailViewerSelectedPart

PdfViewerHeader
PdfViewerThumbnailSidebar
PdfViewerSurface

SplitViewerHeader
SplitViewerSidebar
SplitViewerSurface

FileSystemViewerHeader
FileSystemViewerTree
FileSystemViewerSelectedFile

UploadableFileViewerHeader
UploadableFileViewerSummary
UploadableFileViewerContent
```

Names should describe what the part renders, not only where one example places
it.

## Canonical Compositions

### Email

Email is a MIME composition viewer.

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

Rules:

- the top header describes the message;
- the sidebar has body and attachment sections, not a raw MIME tree;
- selecting an attachment renders the leaf viewer directly;
- nested messages recurse through the same email composition;
- attachment metadata belongs in the sidebar item and selected state, not as a
  second header above `FileViewer`.

### PDF With Thumbnails

PDF thumbnails are explicit composition, not a separate PDF viewer species.

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <PdfViewerThumbnailSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerSurface />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

Rules:

- thumbnails consume the PDF provider;
- the surface consumes the same PDF provider;
- page and zoom state are not duplicated;
- thumbnail selection and visible-page sync share one page model.

### Split

Split is a workflow navigation viewer around leaf document rendering.

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot>
    <SplitViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerSurface />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Rules:

- split owns segment navigation;
- PDF owns PDF rendering;
- split must not recreate PDF toolbar state;
- split segment labels and page ranges live in split parts, not in generic
  viewer primitives.

### File System

File system is a source selection domain.

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

Rules:

- tree state belongs to the provider;
- source rendering belongs to `FileViewer`;
- the file-system sidebar does not know how to render PDFs, CSVs, images, or
  text;
- the selected file is represented as a `ViewerSource`.

### Uploadable File Viewer

Dropzone is acquisition. Uploadable viewer is composition.

```tsx
<UploadableFileViewerProvider>
  <ViewerRoot>
    <UploadableFileViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <UploadableFileViewerSummary />
      </ViewerSidebar>
      <ViewerSurface>
        <UploadableFileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</UploadableFileViewerProvider>
```

Rules:

- `useDropzone` owns intake mechanics;
- `UploadableFileViewerProvider` owns the selected upload source;
- `DropzoneRoot`, `DropzoneInput`, and `DropzoneTrigger` do not know about
  `ViewerRoot`;
- source acquisition never renders documents directly unless the example is
  deliberately demonstrating acquisition only.

### Extraction And OCR

Extraction and OCR should share the same anchored-document mental model.

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSurface>
        <AnchoredDocumentTarget />
      </ViewerSurface>
      <ViewerSidebar>
        <AnchoredItemList />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

The difference between extraction and OCR is the item model, not the viewer
architecture.

```txt
extraction item
  field label
  value
  confidence
  normalized type
  anchor

OCR item
  text
  confidence
  reading order
  anchor
```

Both become anchored items.

Rules:

- the anchored provider owns preview, selection, and activation;
- target adapters connect anchors to PDF, image, text, CSV, XLSX, and DOCX;
- extraction and OCR sidebars may differ visually;
- they should not differ in hover/pin/activate state machinery;
- leaf viewers receive target adapters, not extraction or OCR concepts.

## Remaining Convergence Work

### 1. Promote One Public Viewer Grammar

Audit every docs page, registry block, and composed viewer example.

Every composed viewer should show:

```tsx
Provider
  ViewerRoot
    Header
    ViewerBody
      ViewerSidebar
      ViewerSurface
```

If an example hides this grammar behind an opaque easy component, the docs must
also show the composed form.

### 2. Remove Old Viewer Histories

Audit these families:

```txt
parse
partition
classification
edit
page markdown
anchored extraction
OCR
source blocks
```

For each one, decide:

```txt
leaf viewer
domain provider
domain part
target adapter
source acquisition
example-only block
```

Anything that cannot be classified is design debt.

### 3. Collapse Source And OCR Interaction

Replace parallel interaction state machines with anchored-document state.

Keep domain item shapes separate. Share:

```txt
active item
active anchor
preview
selection
activation
target adapter
```

Do not share:

```txt
field formatting
OCR text grouping
confidence display
normalization labels
workflow copy
```

### 4. Make Leaf Viewer Target Adapters Boring

Each leaf viewer should expose one narrow target adapter path.

```txt
PdfViewer       -> PDF page and bbox target
ImageViewer     -> image rectangle target
TextViewer      -> line/range target
CodeViewer      -> line/range target
CsvViewer       -> cell/range target
XlsxViewer      -> sheet/cell/range target
DocxViewer      -> paragraph/run target
```

The adapter should translate anchored-document intent into leaf-native
coordinates. It should not own item state.

### 5. Cut Compatibility Names

Remove shared-layer names that preserve old mental models:

```txt
Shell
Frame
Pane
Panel
Rail
Current
Hovered
Pinned
SourceLink
SourceMap
renderDocument
renderSidebar
slots
```

Domain-local use is allowed only when the domain meaning is precise and tested.

Example:

```txt
SplitViewerPageRail
```

is acceptable if it means the page rail inside split.

```txt
ViewerRail
```

is not acceptable as a generic primitive.

### 6. Keep Easy APIs As Thin Examples

Every domain can expose an easy component:

```tsx
<EmailViewer message={message} />
<SplitViewer result={result} />
<FileSystem tree={tree} />
```

But the easy component must be mechanically equivalent to the composed form.

Rules:

- no hidden state that composed parts cannot access;
- no alternate layout path;
- no compatibility props;
- no render callback escape hatch;
- no different behavior from the documented composition.

### 7. Registry Proof

The registry should prove the system.

Required blocks:

```txt
email viewer
pdf thumbnails
split viewer
file system
dropzone file viewer
extraction viewer
OCR viewer
parse viewer
partition viewer
classification viewer
edit viewer
```

Each block should make one architectural point. Blocks should not compensate
for weak primitives with local wrapper layouts.

## Test Gates

### Architecture Tests

Add tests that prove:

- `viewer.tsx` exports only the five generic spatial primitives;
- providers do not import leaf viewer internals except through domain surface
  parts;
- leaf viewers do not import domain providers;
- acquisition components do not import viewer primitives;
- anchored-document provider does not import extraction or OCR components;
- extraction and OCR both use anchored-document state;
- easy components render the same structural grammar as composed examples;
- docs mention provider, parts, and easy API for each composed viewer.

### Behavior Tests

Keep behavior tests close to the state owner:

```txt
EmailViewerProvider
  selects body and attachments
  resolves inline resources
  recurses nested messages

PdfViewerProvider
  changes page
  changes zoom
  synchronizes thumbnails

SplitViewerProvider
  selects segment
  maps segment pages to document pages

UploadableFileViewerProvider
  selects uploaded source
  handles accepted and rejected files

AnchoredDocumentProvider
  previews item
  selects item
  activates target
  clears state predictably
```

### Visual Tests

Use browser verification for:

- one root per composed viewer;
- header above body;
- sidebar and surface as siblings;
- no nested card inside surface unless the leaf viewer itself requires it;
- no duplicate attachment header;
- PDF thumbnails are square and aligned;
- email body and attachments are visually separate sections;
- source/OCR interactions activate the same visual affordance.

## Deletion List

Delete or rewrite any component that survives only because it was useful before
the primitive grammar existed.

Candidates to audit:

```txt
legacy source-link helpers
source-map naming in shared layers
duplicate source sidebar components
domain wrappers that own layout
viewer wrappers that only forward class names
render callback examples
old extraction-specific hover/pin state
old OCR-specific hover/pin state
dropzone examples that render documents without the uploadable viewer boundary
```

Do not keep adapters for backward compatibility. This library is still forming;
the cost of preserving wrong shape is higher than the cost of a hard cutover.

## Acceptance Criteria

The pass is complete when:

- the public primitive set is exactly five components;
- every composed viewer can be written with the same JSX grammar;
- every provider has a one-sentence state ownership rule;
- no provider owns layout;
- no leaf viewer owns domain selection;
- dropzone is acquisition-only;
- extraction and OCR share anchored-document interaction;
- target adapters are leaf-native and domain-agnostic;
- easy APIs are thin composed wrappers;
- docs and examples teach the same model;
- registry output is synchronized;
- architecture tests fail on the old mental model names;
- behavior tests cover each provider state machine;
- browser verification passes for the core viewer blocks.

## Final Standard

The finished viewer system should feel like this:

```txt
I can read the JSX and know the layout.
I can read the provider name and know the state machine.
I can read the leaf viewer name and know the rendered source.
I can read the target adapter name and know the coordinate system.
I can read the sidebar part name and know the domain list.
```

Anything that requires a second explanation is not finished.
