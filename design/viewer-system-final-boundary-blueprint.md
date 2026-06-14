# Viewer System Final Boundary Blueprint

## Objective

Define the final boundary for the viewer component library.

The system should make one thing obvious:

```txt
Viewer primitives compose space.
Domain providers compose state.
Domain parts compose product behavior.
Leaf renderers display one resolved source.
Source acquisition creates sources.
Anchored providers connect semantic items to document targets.
```

If a component does two of those jobs, the design is not finished.

This blueprint is the next architectural pass after the post-merge coherence
work. It is not a migration plan and it does not preserve old shapes for
compatibility. It describes the target shape.

## Current Judgment

The direction is good.

The provider idea is not a dead end. Broad providers are a dead end.

The primitive idea is also good. But the primitive must remain spatial, not
conceptual ownership of all file viewing behavior.

The remaining risk is that the library keeps three subtly different meanings
for "viewer":

```txt
spatial viewer shell
standalone file viewer
embedded file renderer
domain composed viewer
```

Those meanings must be separated by names and module boundaries.

## Final Vocabulary

Use exactly these shared spatial primitives:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Use domain names for domain parts:

```txt
EmailViewerProvider
EmailViewerHeader
EmailViewerPartsSidebar
EmailViewerSelectedPart

PdfViewerProvider
PdfViewerHeader
PdfViewerDocument
PdfViewerThumbnails

SplitViewerProvider
SplitViewerHeader
SplitViewerSidebar
SplitViewerSelectedSegment

FileSystemViewerProvider
FileSystemViewerHeader
FileSystemViewerTree
FileSystemViewerPreview

UploadableFileViewerProvider
UploadableFileViewerHeader
UploadableFileViewerQueue
UploadableFileViewerSelectedFile

AnchoredDocumentProvider
AnchoredDocumentSurface
AnchoredDocumentSidebar
```

Use renderer names for embeddable leaf rendering:

```txt
PdfDocumentRenderer
ImageDocumentRenderer
HtmlDocumentRenderer
TextDocumentRenderer
CsvDocumentRenderer
XlsxDocumentRenderer
DocxDocumentRenderer
PptxDocumentRenderer
PretextMarkdownDocumentRenderer
```

Use `FileViewer` only if it means:

```txt
resolve a ViewerSource and route it to one document renderer
```

`FileViewer` must not mean:

```txt
own a sidebar
own an outer header
own domain selection
own upload state
own MIME structure
own extraction or OCR state
```

## Final Component Layers

### 1. Spatial primitives

`viewer.tsx` owns layout slots only.

Allowed:

- root containment;
- header region;
- body flex layout;
- sidebar region;
- surface region;
- stable `data-slot` names;
- minimal responsive defaults.

Forbidden:

- provider state;
- file metadata;
- source routing;
- toolbars;
- thumbnails;
- selection;
- loading state beyond normal DOM composition.

### 2. Document renderers

A renderer displays one resolved source.

Examples:

```tsx
<PdfDocumentRenderer resource={resource} />
<HtmlDocumentRenderer source={source} />
<TextDocumentRenderer source={source} />
```

Allowed:

- format-specific loading;
- format-specific errors;
- format-specific zoom or pagination internals when the format requires them;
- target adapters for anchored overlays;
- resource cleanup.

Forbidden:

- `ViewerRoot`;
- `ViewerHeader`;
- `ViewerSidebar`;
- domain list selection;
- upload queues;
- MIME recursion;
- split segment navigation.

This is the boundary that prevents double nesting.

### 3. Source router

`FileViewer` routes one `ViewerSource` to one renderer.

Allowed:

- infer renderer from MIME type, extension, or explicit kind;
- pass source metadata to the renderer;
- expose render-state callbacks if required by the renderer;
- render a format error when no renderer exists.

Forbidden:

- outer chrome;
- domain sidebars;
- default headers;
- nested `ViewerRoot`;
- acquisition state.

The ideal shape is:

```tsx
<ViewerSurface>
  <FileViewer source={selectedSource} />
</ViewerSurface>
```

There should be no visual or DOM sign that `FileViewer` itself is a composed
viewer.

### 4. Domain providers

A domain provider exists only when separated domain parts need shared state.

Each provider must have one sentence.

```txt
EmailViewerProvider owns MIME projection and selected part.
PdfViewerProvider owns PDF resource, page, zoom, and document controls.
SplitViewerProvider owns split output navigation and selected segment.
FileSystemViewerProvider owns tree expansion, selection, and source resolution.
UploadableFileViewerProvider owns upload queue and selected upload source.
AnchoredDocumentProvider owns item preview, selection, activation, and targets.
```

Allowed:

- controlled and uncontrolled selection;
- derived domain projections;
- imperative coordination inside the domain;
- conversion from selected domain item to `ViewerSource`;
- stable hooks for named parts.

Forbidden:

- generic layout;
- slot APIs;
- children rewriting;
- unrelated workflow state;
- another provider's state;
- renderer internals.

### 5. Domain composed viewers

A composed viewer is just a canonical arrangement of primitives and domain
parts.

It is allowed only when the library wants to ship an obvious default
composition.

It must be written in the same public grammar that a user would write by hand.

Example:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
    <EmailViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <EmailViewerPartsSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <EmailViewerSelectedPart />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

The composed viewer may exist as `EmailViewer`, but it must not hide a second
private layout model. Its implementation should read like the example above.

## Canonical Shapes

### Email

Email is a MIME composition.

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
    <EmailViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <EmailViewerPartsSidebar />
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
- the sidebar has two human sections: body and attachments;
- MIME containers may inform projection but should not dominate the sidebar UI;
- selecting a nested message creates another email domain inside the surface
  only when the selected part is genuinely another message;
- selecting a normal attachment renders `FileViewer` without another outer
  header;
- CID resources belong to the selected HTML part and should not appear as
  attachments.

### PDF with thumbnails

PDF is a document domain with optional navigation.

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

Rules:

- thumbnails are a sidebar part, not a renderer feature;
- `PdfViewerDocument` renders the PDF surface and registers controls with the
  provider;
- a standalone PDF viewer is this composition, not a different code path;
- an embedded PDF attachment uses the renderer/router path without thumbnails
  unless the embedding domain explicitly composes them.

### Split viewer

Split is a domain over output segments.

```tsx
<SplitViewerProvider output={output}>
  <ViewerRoot>
    <SplitViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerSelectedSegment />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Rules:

- the sidebar selects segments;
- the surface renders the selected segment through `FileViewer` or a segment
  renderer;
- split state should not leak into PDF, file-system, email, extraction, or OCR
  modules.

### File system viewer

File system is a browsing domain.

```tsx
<FileSystemViewerProvider tree={tree}>
  <ViewerRoot>
    <FileSystemViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemViewerTree />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemViewerPreview />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemViewerProvider>
```

Rules:

- the tree owns folder expansion and file selection;
- the preview resolves the selected file to a `ViewerSource`;
- the preview renders `FileViewer`;
- file-system nodes do not teach file renderers about folders.

### Dropzone and uploadable viewer

Dropzone is source acquisition, not document viewing.

```tsx
<UploadableFileViewerProvider>
  <ViewerRoot>
    <UploadableFileViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <UploadableFileViewerQueue />
      </ViewerSidebar>
      <ViewerSurface>
        <UploadableFileViewerSelectedFile />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</UploadableFileViewerProvider>
```

Rules:

- dropzone produces upload items and sources;
- upload state stays in the uploadable provider;
- `FileViewer` receives one selected source;
- drag state must not enter viewer primitives;
- upload queue UI is a sidebar part, not a document renderer.

### Extraction and OCR

Extraction and OCR are the same family: anchored document review.

```tsx
<AnchoredDocumentProvider items={items} targets={targets}>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSurface>
        <AnchoredDocumentSurface>
          <FileViewer source={documentSource} />
        </AnchoredDocumentSurface>
      </ViewerSurface>
      <ViewerSidebar>
        <AnchoredDocumentSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

Rules:

- extraction fields and OCR blocks are both anchored items;
- the difference is item schema and sidebar presentation, not document
  anchoring mechanics;
- target geometry, preview, activation, and scroll coordination belong to
  `AnchoredDocumentProvider`;
- document renderers expose target adapters but do not own extraction or OCR
  semantics.

## Public API Standard

Use separate named exports.

Correct:

```ts
export {
  ViewerRoot,
  ViewerHeader,
  ViewerBody,
  ViewerSidebar,
  ViewerSurface,
  EmailViewerProvider,
  EmailViewerHeader,
  EmailViewerPartsSidebar,
  EmailViewerSelectedPart,
}
```

Avoid compound namespace components:

```tsx
<EmailViewer.Root />
<EmailViewer.Header />
```

The library is a registry. Users copy, search, split, and remix files. Separate
named exports keep ownership explicit.

## File Organization

Target organization:

```txt
registry/new-york-v4/ui/viewer.tsx
  spatial primitives

registry/new-york-v4/ui/file-viewer.tsx
  source router only

registry/new-york-v4/ui/*-document-renderer.tsx
  one file format renderer per file

registry/new-york-v4/ui/pdf-viewer-context.tsx
  PDF provider and hooks

registry/new-york-v4/ui/pdf-viewer.tsx
  PDF named parts and canonical composition

registry/new-york-v4/ui/email-viewer.tsx
  email provider, hooks, named parts, canonical composition

registry/new-york-v4/ui/file-system.tsx
  file-system provider, hooks, named parts, canonical composition

registry/new-york-v4/ui/dropzone.tsx
  acquisition primitives

registry/new-york-v4/ui/uploadable-file-viewer.tsx
  uploadable provider, hooks, named parts, canonical composition

registry/new-york-v4/ui/anchored-document.tsx
  anchored provider, hooks, target model, generic anchored parts
```

No file should need to import a composed viewer to render a leaf source.

## Tests That Prove The Design

Architecture tests should enforce:

- `viewer.tsx` exports only spatial primitives;
- `FileViewer` does not render `ViewerRoot`, `ViewerHeader`, `ViewerBody`,
  `ViewerSidebar`, or `ViewerSurface`;
- document renderers do not render `ViewerRoot` or `ViewerSidebar`;
- each composed viewer renders one direct `ViewerRoot`;
- each composed viewer's `ViewerBody` owns sibling `ViewerSidebar` and
  `ViewerSurface` when it has a sidebar;
- email selected attachments do not create nested viewer roots unless the
  selected attachment is another message;
- PDF thumbnails are composed through `ViewerSidebar`;
- split output selection is not imported by file renderers;
- dropzone primitives do not import viewer primitives;
- anchored document provider is the only owner of anchor selection and
  activation.

Visual tests should cover:

- email with body and attachments;
- nested email message;
- HTML attachment with CID resources;
- PDF with thumbnail sidebar;
- PDF embedded as an attachment;
- split viewer;
- file-system viewer;
- dropzone viewer after one uploaded file is selected;
- extraction viewer;
- OCR viewer.

Every visual route should prove:

```txt
single visible root
expected header presence
no accidental nested roots
sidebar and surface are siblings
no broken iframe or object URL console errors
square thumbnails where thumbnails exist
```

## Cutover Plan

### Phase 1: Name the renderer boundary

Create renderer components for the formats that currently blur standalone and
embedded viewing.

The first candidates are:

```txt
PDF
HTML
image
text
CSV
XLSX
DOCX
PPTX
pretext markdown
```

Do not introduce compatibility wrappers. Move call sites to the new names.

### Phase 2: Make `FileViewer` chrome-free

Remove outer viewer chrome from `FileViewer`.

After this phase, `FileViewer` is safe inside:

```txt
EmailViewerSelectedPart
FileSystemViewerPreview
SplitViewerSelectedSegment
UploadableFileViewerSelectedFile
AnchoredDocumentSurface
```

### Phase 3: Rebuild standalone viewers as compositions

Each standalone viewer becomes a readable composition of:

```txt
provider
viewer primitives
domain parts
renderer or FileViewer
```

The default export, if it exists, should be a convenience composition only.

### Phase 4: Merge extraction and OCR mechanics

Create one anchored document contract for both.

Keep domain item shape separate:

```txt
ExtractionField
OcrBlock
```

Share mechanics:

```txt
target geometry
hover preview
selection
activation
scroll into view
highlight rendering
target adapter
```

### Phase 5: Delete vocabulary drift

Remove or rename shared-layer concepts that compete with the final grammar:

```txt
Shell
Frame
Pane
Panel
Rail
Content
Current
SourceMap
SourceLink
```

Keep those words only when they are real domain terms and not viewer-system
terms.

### Phase 6: Prove through registry blocks

Every block should teach the same grammar:

```txt
provider
root
header
body
sidebar
surface
domain part
renderer
```

The docs should not explain exceptions.

If an exception needs explanation, the abstraction is not finished.

## Acceptance Criteria

The system reaches the target when all statements are true:

- `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`, and
  `ViewerSurface` are the only shared layout primitives.
- `FileViewer` never creates viewer chrome.
- document renderers never create viewer chrome.
- every domain composed viewer can be copied into userland and understood as
  plain JSX composition.
- email, PDF thumbnails, split, file-system, dropzone, extraction, and OCR use
  the same spatial grammar.
- extraction and OCR share anchored mechanics.
- source acquisition is separate from source rendering.
- providers each own exactly one domain state machine.
- architecture tests fail when boundaries are crossed.
- visual tests prove the real registry blocks, not synthetic examples only.
- generated registry output matches source.
- docs and examples use the same names as code.

## Final Position

The platonic design is not:

```txt
one magic Viewer that knows every document domain
```

It is:

```txt
one tiny spatial grammar
many narrow domain providers
many embeddable document renderers
one chrome-free source router
composed viewers that are just examples made real
```

That shape is simple, fast, complete, and hard to misuse.
