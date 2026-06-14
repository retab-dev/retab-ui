# Viewer System Next Cut Blueprint

## Objective

Make the viewer system converge from "right architecture" to "finished
component library."

The current design direction is correct:

```txt
viewer primitives
leaf viewers
domain providers
domain parts
target adapters
source acquisition
```

The next cut should not add another conceptual center. It should remove the
remaining places where the implementation still feels like several histories
living in the same package.

The target is a system where every composed viewer can be understood by reading
the JSX hierarchy.

## Verdict

We should keep the provider approach, but only in its narrow form.

The provider is not the viewer.

The provider is the domain state machine that allows the header, sidebar, and
surface to be separated without prop drilling.

Correct:

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

Wrong:

```tsx
<EmailViewerProvider
  header={...}
  sidebar={...}
  renderPart={...}
  layout="split"
/>
```

The provider exists to make named parts possible. It must not become a slot API
with a different spelling.

## Final Grammar

There is one generic spatial grammar:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

These are the only generic viewer primitives:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Every other public component is either:

- a leaf viewer;
- a domain provider;
- a named domain part;
- a target adapter;
- a source acquisition component.

## Component Taxonomy

### Viewer Primitives

Own:

- frame;
- header placement;
- body layout;
- sidebar/surface relationship;
- viewer-level overflow;
- generic CSS variables.

Do not own:

- selected files;
- selected MIME parts;
- PDF page state;
- upload state;
- split segment state;
- extraction fields;
- OCR blocks;
- anchors.

### Leaf Viewers

Examples:

```txt
PdfViewer
ImageViewer
TextViewer
CsvViewer
XlsxViewer
DocxViewer
HtmlViewer
FileViewer
```

Own:

- rendering one source;
- format-native loading and errors;
- format-native controls;
- format-native handles;
- format-native overlay hooks.

Do not own:

- sidebars;
- thumbnails;
- MIME selection;
- split workflow selection;
- upload queues;
- anchored document selection;
- extraction or OCR state.

`FileViewer` is a source router. It is not the composition primitive.

### Domain Providers

Each provider owns exactly one state machine.

```txt
EmailViewerProvider
  owns MIME projection and selected part.

PdfViewerProvider
  owns PDF resource, page, zoom, and document controls.

SplitViewerProvider
  owns split result navigation and selected segment/page.

FileSystemViewerProvider
  owns tree expansion, selection, and source resolution.

UploadableFileViewerProvider
  owns acquisition queue and selected upload source.

AnchoredDocumentProvider
  owns item-anchor preview, selection, and activation.
```

A provider is wrong when it owns:

- layout;
- class names for generic regions;
- file rendering;
- unrelated domain state;
- broad render callbacks;
- compatibility modes.

### Domain Parts

Domain parts are named components that consume one provider and render one
piece of the composed viewer.

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
FileSystemViewerSurface

UploadableFileViewerHeader
UploadableFileViewerSummary
UploadableFileViewerContent
```

The part names should say what they render, not where they happen to sit in one
example.

## Canonical Compositions

### Email Viewer

Email is a MIME composition viewer.

The header describes the message.

The sidebar separates body candidates from attachments.

The surface renders the selected MIME part through `FileViewer` or a nested
message composition.

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

- no MIME tree as the default visual model;
- sidebar sections are `Body` and `Attachments`;
- nested email messages recurse through email composition;
- selected attachments do not add a second metadata header above the leaf
  viewer;
- body, attachment, and nested message selection use the same selected-part
  model.

### PDF With Thumbnails

PDF thumbnails are not a PDF viewer prop.

They are a PDF domain composition:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <PdfThumbnailSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewer />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

Rules:

- `PdfViewer` renders pages;
- `PdfViewerProvider` owns page and zoom state;
- `PdfThumbnailSidebar` reads PDF page state and changes the current page;
- no `thumbnails`, `sidebar`, or `renderThumbnail` props on `PdfViewer`.

### Split Viewer

Split is a document workflow composition.

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

- split selection belongs to `SplitViewerProvider`;
- PDF rendering stays in PDF/File leaf viewers;
- the sidebar presents segments and pages, not generic files;
- the surface renders the selected segment source.

### File System Viewer

File system is a navigable source collection.

```tsx
<FileSystemViewerProvider fileSystem={fileSystem}>
  <ViewerRoot>
    <FileSystemViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemViewerTree />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemViewerSurface />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemViewerProvider>
```

Rules:

- tree state belongs to the provider;
- source rendering belongs to `FileViewer`;
- file-system controls are domain parts, not a generic viewer shell;
- directory selection and file selection are explicit states.

### Dropzone Uploadable Viewer

Dropzone is source acquisition.

Uploadable viewer composition is the bridge from acquisition to viewing.

```tsx
<UploadableFileViewerProvider>
  <UploadableFileViewerRoot>
    <UploadableFileViewerHeader />
    <ViewerBody>
      <UploadableFileViewerSummary />
      <UploadableFileViewerContent />
    </ViewerBody>
  </UploadableFileViewerRoot>
</UploadableFileViewerProvider>
```

Rules:

- dropzone primitives own file intake gestures;
- uploadable provider owns queue and selected upload source;
- viewer primitives own layout;
- `FileViewer` renders the selected source;
- dropzone examples should not import file viewer internals.

### Extraction And OCR

Extraction and OCR are anchored document compositions, not special PDF viewers.

```tsx
<AnchoredDocumentProvider items={items}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <ExtractionFields />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewer renderPageOverlay={overlay} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

Rules:

- extraction fields and OCR blocks project to anchored items;
- `AnchoredDocumentProvider` owns preview, selected, and active item state;
- PDF target adapters translate anchors into PDF overlays and scroll targets;
- OCR and extraction should share the same anchored interaction model;
- neither OCR nor extraction should add source-link concepts back into leaf
  viewers.

## Public API Rule

Use separate named exports.

Correct:

```ts
export {
  EmailViewer,
  EmailViewerProvider,
  EmailViewerHeader,
  EmailViewerPartsList,
  EmailViewerSelectedPart,
  useEmailViewer,
}
```

Avoid dot namespaces:

```tsx
<EmailViewer.Root />
```

The separate named exports are easier to search, tree-shake, document, and
copy into shadcn-style projects.

## Naming Table

Use these words consistently:

```txt
Root
Header
Body
Sidebar
Surface
Provider
Source
Resource
Part
Segment
Item
Anchor
Target
Preview
Selected
Active
Activate
```

Avoid these as shared-layer concepts:

```txt
Shell
Frame
Panel
Pane
Rail
Current
Hovered
Pinned
SourceLink
SourceMap
```

Domain-specific exceptions are allowed only when the domain proves the word:

```txt
SplitViewerPageRail
MIME part
file-system node
upload item
OCR block
extraction field
```

## Next Implementation Cut

### 1. Architecture Test Lock

Add tests that lock the architecture before more edits.

Required assertions:

- `viewer.tsx` exports only the five generic primitives;
- composed viewers use `ViewerRoot`, `ViewerHeader`, `ViewerBody`,
  `ViewerSidebar`, and `ViewerSurface`;
- leaf viewers do not import domain providers;
- `FileViewer` has no layout, sidebar, thumbnail, or anchored props;
- `PdfViewer` has no thumbnail/sidebar/anchored props;
- dropzone examples do not import file viewer internals;
- anchored core imports no PDF, OCR, extraction, file, or form leaf viewers;
- docs do not teach removed source-link vocabulary.

### 2. Docs Vocabulary Cut

Rewrite public docs around the same grammar.

Priority pages:

```txt
content/docs/viewers/file-viewer.mdx
content/docs/viewers/pdf-viewer.mdx
content/docs/viewers/email-viewer.mdx
content/docs/components/file-system.mdx
content/docs/components/split-viewer.mdx
content/docs/components/extract-viewer.mdx
content/docs/components/json-form.mdx
```

The docs should teach:

```txt
primitive -> provider -> named parts -> leaf viewer
```

They should not teach:

```txt
shell
slot
source link
hover/pin
render document callback
leaf viewer as composition center
```

### 3. Example Coherence Pass

Audit each registry block against the canonical composition.

Required examples:

```txt
email-viewer
pdf-thumbnails
split-viewer
file-system
dropzone-uploader-viewer
extract-viewer
extraction-viewer
layout-blocks
edit-viewer
```

Each example should make the hierarchy visible. If an example hides the body,
sidebar, or surface behind a broad wrapper, it should be rewritten.

### 4. Provider Boundary Pass

For each provider, verify imports and public return values.

No provider should expose:

- generic layout state;
- class name slots;
- unrelated domain state;
- file rendering callbacks;
- compatibility flags.

Each provider hook should read like a narrow state model, not a bag of props.

### 5. Visual Verification

Run the local docs or registry preview and capture the core examples:

```txt
/blocks#email-viewer
/blocks#pdf-thumbnails
/blocks#split-viewer
/blocks#file-system
/blocks#dropzone-uploader-viewer
```

Verify:

- header is full width;
- sidebar and surface are siblings;
- no nested card inside card;
- no duplicate selected-file metadata header;
- sidebar thumbnails align on the same left edge;
- PDF/file surfaces take the full available width;
- mobile layout does not create overlapping controls.

### 6. Registry Integrity

After source changes:

```bash
bun run registry:build
bunx vitest run tests/viewer-architecture.test.ts
bunx tsc --noEmit --pretty false
```

Then run the focused viewer suite:

```bash
bunx vitest run \
  tests/email-viewer.test.tsx \
  tests/file-viewer.test.tsx \
  tests/dropzone.test.tsx \
  tests/anchored-document-viewer.test.tsx \
  tests/edit-viewer-model.test.ts \
  tests/edit-viewer-render.test.tsx \
  tests/sources.test.tsx \
  tests/pdf-source.test.tsx \
  tests/docx-source.test.tsx \
  tests/image-viewer-probes.test.tsx \
  tests/xlsx-workbook.test.ts \
  tests/layout-blocks-document-ai.test.ts \
  tests/viewer-architecture.test.ts
```

## Done Definition

This cut is complete when:

- the generic primitive set is exactly five components;
- every composed viewer uses the same visible grammar;
- providers own only their domain state machines;
- leaf viewers only render sources;
- dropzone remains acquisition, not viewing;
- extraction and OCR share anchored-document interaction;
- old source-link vocabulary is gone from public docs;
- registry output is rebuilt;
- architecture tests prevent regression;
- visual examples match the hierarchy.

The final system should feel boring in the best sense: obvious, small, fast,
and hard to misuse.
