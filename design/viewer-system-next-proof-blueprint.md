# Viewer System Next Proof Blueprint

## Objective

Prove whether the viewer system has reached the right final shape by forcing
every real composed viewer through one visible grammar.

The question is no longer whether the architecture is attractive in the
abstract. The question is whether it survives the hard cases without extra
concepts:

```txt
email MIME recursion
PDF thumbnails
split results
file-system browsing
dropzone acquisition
extraction sources
OCR sources
anchored document targets
plain leaf file rendering
```

If those all compose cleanly from the same pieces, the design is real. If one
case needs a private layout model, the architecture is still incomplete.

## Verdict

The direction is correct, but it is not proven enough to call finished.

The provider idea is not the danger. A broad provider is the danger.

The useful rule is:

```txt
viewer primitives own space
domain providers own one state machine
domain parts render named regions
leaf viewers render one source
source acquisition produces sources
anchored providers connect semantic items to document targets
```

Any component that crosses two of those boundaries should be deleted, split, or
renamed until the boundary is visible again.

## Final Grammar

The only generic spatial grammar is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The only generic viewer primitives are:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not add another generic primitive unless three independent domains need the
same semantic region and cannot express it with these five.

Forbidden as shared primitives:

```txt
ViewerShell
ViewerFrame
ViewerPane
ViewerPanel
ViewerRail
ViewerToolbar
ViewerContent
ViewerFooter
ViewerOverlay
ViewerProvider
```

Domain-specific versions are allowed only when they name real domain behavior:

```txt
PdfViewerToolbar
SplitViewerPageRail
EmailViewerPartsList
FileSystemViewerTree
UploadableFileViewerQueue
AnchoredDocumentTargets
```

## Public API Rule

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
  EmailViewerPartsList,
  EmailViewerSelectedPart,
}
```

Avoid compound dot APIs:

```tsx
<EmailViewer.Root />
<EmailViewer.Header />
<EmailViewer.Sidebar />
```

The registry is copied, searched, inspected, and composed. Separate named
exports make ownership clearer and keep dependency files explicit.

## Provider Rule

A provider is valid only when separated named parts need shared domain state.

It may own:

- input normalization;
- derived domain projections;
- controlled and uncontrolled selection;
- resource lifecycle;
- imperative coordination between domain parts;
- conversion from selected domain item to `ViewerSource`.

It must not own:

- layout;
- slots;
- class choreography for generic regions;
- file rendering internals;
- unrelated workflow state;
- compatibility fallbacks;
- another provider's state machine.

One provider, one sentence:

```txt
EmailViewerProvider owns MIME projection and selected part.
PdfViewerProvider owns PDF resource, page, zoom, and viewer controls.
SplitViewerProvider owns split navigation and selected segment.
FileSystemViewerProvider owns tree expansion, selection, and source resolution.
UploadableFileViewerProvider owns acquisition queue and selected upload source.
AnchoredDocumentProvider owns item preview, selection, activation, and targets.
```

If the one-sentence description needs "and also", the provider is too broad.

## Leaf Viewer Rule

A leaf viewer renders one source or one resolved resource.

Examples:

```txt
PdfViewer
ImageViewer
TextViewer
HtmlViewer
CsvViewer
XlsxViewer
DocxViewer
PptxViewer
PretextMarkdownViewer
MarkdownDocumentViewer
FileViewer
```

Leaf viewers may own:

- format-native loading;
- format-native errors;
- format-native controls;
- format-native handles;
- target adapters for overlays and anchors.

Leaf viewers must not own:

- sidebars;
- MIME part selection;
- split segment selection;
- upload queues;
- file-system tree state;
- extraction field state;
- OCR block state;
- anchored item selection.

`FileViewer` is a router from `ViewerSource` to a leaf viewer. It is not the
composition center.

## Canonical Compositions

### Email

Email is a MIME domain, not a file viewer with attachments bolted on.

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

- the header describes the email;
- the sidebar is a product projection with body and attachments sections;
- the selected part renders as a source without a second metadata header;
- nested `message/rfc822` parts recurse by rendering another composed email
  viewer;
- raw MIME structure can exist as debug state, not the default UI.

### PDF Thumbnails

PDF thumbnails are explicit composition, not a boolean mode.

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

- thumbnails consume PDF provider state;
- page rendering stays in the surface;
- thumbnail sidebar is square, aligned, and visual;
- the PDF resource lifecycle is created once.

### Split

Split is a workflow over document sources.

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

- split state belongs to the split provider;
- page and segment navigation belong to split parts;
- the document renderer remains a leaf or anchored document composition;
- no split state leaks into generic viewer primitives.

### File System

The file system viewer is tree selection plus source rendering.

```tsx
<FileSystemViewerProvider root={root}>
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

- tree expansion and selection stay in the file-system provider;
- selected file becomes a `ViewerSource`;
- `FileViewer` renders the selected source;
- file-system state never enters `FileViewer`.

### Dropzone

Dropzone is source acquisition. It is not a viewer primitive.

```tsx
<UploadableFileViewerProvider>
  <ViewerRoot>
    <UploadableFileViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <UploadableFileViewerQueue />
      </ViewerSidebar>
      <ViewerSurface>
        <UploadableFileViewerSurface />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</UploadableFileViewerProvider>
```

Rules:

- drag/drop, file input, validation, and upload queue are acquisition concerns;
- selected upload output becomes a `ViewerSource`;
- document rendering is delegated to `FileViewer` or a leaf viewer;
- dropzone state does not leak into PDF, email, extraction, or OCR providers.

### Extraction And OCR

Extraction and OCR should be the same family, not two unrelated viewers.

They are anchored document experiences:

```tsx
<AnchoredDocumentProvider items={items} targets={targets}>
  <ViewerRoot>
    <AnchoredDocumentHeader />
    <ViewerBody>
      <ViewerSidebar>
        <AnchoredDocumentItemList />
      </ViewerSidebar>
      <ViewerSurface>
        <AnchoredDocumentSurface />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

Domain-specific names may wrap this when the product needs them:

```txt
ExtractionViewerProvider
ExtractionViewerFields
OcrViewerProvider
OcrViewerBlocks
```

But those wrappers must only normalize data and name the domain. They must not
fork anchoring behavior.

Rules:

- extraction fields and OCR blocks both become anchored items;
- bboxes, polygons, spans, and page references become targets;
- hover, preview, active item, and scroll activation are anchored behavior;
- document rendering remains leaf behavior with target adapters.

## Required Cut

The next implementation pass should do only this:

1. Audit every exported viewer and block against the taxonomy.
2. Delete or rename any component whose name hides its layer.
3. Ensure every composed viewer has exactly one `ViewerRoot`.
4. Ensure every composed viewer has at most one top-level header.
5. Ensure sidebars are siblings of surfaces, not wrappers around them.
6. Ensure leaf viewers never create outer composition chrome.
7. Ensure source acquisition always ends in `ViewerSource`.
8. Ensure extraction and OCR share anchored-document behavior.
9. Ensure docs teach the same grammar as the code.
10. Ensure registry output is regenerated from source.

Do not add a new abstraction during this pass. If a case does not fit, write
down the exact failure before designing the fix.

## Architecture Tests

Add tests that fail on conceptual drift:

- composed blocks expose one `data-slot="viewer-root"`;
- nested viewer roots are absent unless recursion is the domain behavior;
- sidebar and surface are siblings under `ViewerBody`;
- email default sidebar contains body and attachments sections;
- selected email attachment does not render a second metadata header;
- PDF thumbnails use the PDF provider resource once;
- split viewer does not import PDF thumbnail internals;
- file-system viewer does not import email, split, extraction, or OCR state;
- dropzone components do not import leaf viewer internals except through
  `ViewerSource`;
- extraction and OCR both consume anchored-document primitives or adapters;
- shared-layer files do not export forbidden generic names.

These tests should inspect code shape where possible and render shape where
necessary. They should guard the mental model, not just happy-path pixels.

## Visual Proof

Every canonical block must be checked in the browser:

```txt
email viewer
PDF thumbnails
split viewer
file-system viewer
dropzone file viewer
extraction viewer
OCR viewer
plain file viewer
```

The proof is valid only when:

- no page has duplicate frames;
- no sidebar has accidental gray background;
- thumbnails are square and aligned;
- headers are full-width top regions;
- selected leaf viewers take the full available surface;
- console errors are empty;
- loading and error states are visible and contained;
- mobile width preserves the same hierarchy.

Screenshots are evidence, not decoration. Keep them when judging a UI cut.

## Done Definition

This pass is done when the answer to every question is boring:

```txt
Where does layout live?
  Viewer primitives.

Where does domain state live?
  One narrow provider.

Where does rendering live?
  Leaf viewers.

Where does acquisition live?
  Acquisition components and upload provider.

Where do source-to-document interactions live?
  Anchored document provider and target adapters.

How do I compose a new viewer?
  Pick the provider, render named parts inside the five primitives.
```

If any answer needs a diagram-specific exception, the design is not finished.

## Anti-Goal

Do not optimize for migration.

Backward compatibility is not part of this judgment. The ideal library is the
one with the fewest concepts that fully explains the real product surface.

If compatibility code remains, it should be removed from the ideal design and
handled as a separate migration artifact only if the product explicitly needs
it.
