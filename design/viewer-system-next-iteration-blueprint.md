# Viewer System Next Iteration Blueprint

## Verdict

The direction is right.

The work is not done.

The next iteration should not invent a new abstraction. It should make the
current abstraction impossible to misunderstand:

```txt
viewer primitives own spatial grammar
domain providers own one domain state machine
domain parts render named UI regions
leaf viewers render one source
source acquisition produces sources
anchored document coordinates semantic items with document targets
```

If a viewer cannot be explained by that stack, it is either not migrated or the
stack is wrong.

## Objective

Make the viewer system feel like one component family rather than a set of good
local experiments.

This pass should produce:

- one public layout grammar;
- one source vocabulary;
- one anchored-document vocabulary;
- one provider rule;
- one dropzone boundary;
- one recipe for every composed viewer;
- no compatibility wrappers;
- no duplicate conceptual centers.

The target is not backward compatibility. The target is the cleanest library.

## Non-Negotiable Shape

The only generic viewer layout grammar is:

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

Do not add generic:

```txt
ViewerShell
ViewerFrame
ViewerPanel
ViewerPane
ViewerRail
ViewerToolbar
ViewerContent
ViewerFooter
ViewerOverlay
```

Domain components may use domain-specific names when the domain proves the
concept:

```txt
EmailViewerPartsList
PdfViewerThumbnails
SplitViewerPageRail
FileSystemViewerTree
UploadableFileViewerQueue
AnchoredDocumentSidebar
```

## Provider Rule

A provider is valid only when separated named parts need shared domain state.

It may own:

- input normalization;
- derived domain projections;
- controlled or uncontrolled selection;
- resource lifecycle;
- imperative coordination between domain parts;
- conversion from selected domain item to `ViewerSource`.

It must not own:

- layout;
- class name choreography;
- sidebar placement;
- render slots;
- file rendering internals;
- dropzone DOM behavior unless it is the acquisition provider;
- anchored-document state unless it is `AnchoredDocumentProvider`;
- compatibility with removed APIs.

Good:

```txt
EmailViewerProvider owns MIME projection and selected part.
PdfViewerProvider owns PDF resource, current page, zoom, and controls.
SplitViewerProvider owns split navigation and selected segment.
FileSystemViewerProvider owns tree expansion, selection, and source resolution.
UploadableFileViewerProvider owns acquisition queue and selected upload source.
AnchoredDocumentProvider owns item preview, selection, activation, and targets.
```

Bad:

```txt
ViewerProvider owns every possible viewer concern.
FileViewerProvider owns sidebars, toolbars, attachments, and anchors.
EmailViewerProvider owns layout and file rendering.
PdfViewerProvider owns extraction fields.
DropzoneProvider owns document rendering.
```

## Canonical Composition

### Email

Email is a recursive MIME domain.

The primary sidebar is a product projection, not a raw MIME debugger:

```txt
Body
Attachments
```

Canonical API:

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

- header describes the email, not the selected attachment;
- selected attachment renders through a leaf viewer without a second metadata
  header;
- nested `message/rfc822` parts recurse by rendering another email viewer;
- raw MIME structure may exist as debug data, not as the default sidebar.

### PDF With Thumbnails

PDF thumbnails are explicit sidebar composition.

Canonical API:

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

Rules:

- thumbnails are not a boolean prop on `PdfViewer`;
- thumbnail state comes from `PdfViewerProvider`;
- page rendering stays in `PdfViewerPages`;
- no nested `PdfViewer` root inside another viewer surface.

### Split

Split is a workflow viewer over an explicit document renderer.

Canonical API:

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
          <PdfViewerProvider source={source}>
            <PdfViewerPages />
          </PdfViewerProvider>
        </SplitViewerDocument>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Rules:

- split owns split state only;
- document rendering remains explicit children;
- no `renderDocument` callback;
- no duplicated PDF header;
- segment overlays are split domain parts, not PDF viewer concerns.

### File System

File system is a source browser.

Canonical API:

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

- provider owns tree, expansion, selection, and source resolution;
- selected files render through `FileViewer`;
- folder previews are file-system domain UI;
- no `file-system-chrome` wrapper survives as a second model.

### Dropzone

Dropzone is source acquisition.

It is not a viewer primitive and not a file renderer.

Canonical uploadable viewer:

```tsx
<UploadableFileViewerProvider accept={accept}>
  <UploadableFileViewerRoot>
    <UploadableFileViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <UploadableFileViewerQueue />
      </ViewerSidebar>
      <ViewerSurface>
        <UploadableFileViewerSelectedFile />
      </ViewerSurface>
    </ViewerBody>
  </UploadableFileViewerRoot>
</UploadableFileViewerProvider>
```

Rules:

- drag/drop DOM behavior belongs at the uploadable root;
- accepted/rejected files belong to acquisition state;
- selected uploaded file becomes a `ViewerSource`;
- file rendering still goes through the leaf viewer system.

### Anchored Extraction, OCR, Edit, And Sources

Extraction, OCR, edit, and source bboxes are one family at the interaction
level.

They differ in domain projection, not in architecture.

Canonical API:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <DomainProvider data={data}>
    <ViewerRoot>
      <DomainHeader />
      <ViewerBody>
        <ViewerSidebar>
          <DomainAnchoredItems />
        </ViewerSidebar>
        <ViewerSurface>
          <PdfViewerProvider source={source}>
            <PdfViewerPages overlay={overlay} />
          </PdfViewerProvider>
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </DomainProvider>
</AnchoredDocumentProvider>
```

Rules:

- `AnchoredDocumentProvider` owns preview, selection, activation, and target
  navigation;
- extraction fields, OCR blocks, edit fields, and citations map to anchored
  items;
- domain providers own domain data only;
- leaf viewers receive target adapters or overlays, not domain state;
- no `sourceLink`, `SourceMap`, `hoverPath`, or `pinnedPath` vocabulary remains
  in public viewer/docs code.

## Leaf Viewer Boundary

`FileViewer` is a source router.

Leaf viewers own:

- one renderable source;
- loading;
- resource errors;
- format-native controls;
- format-native rendering;
- format-native handles.

Leaf viewers do not own:

- sidebars;
- domain lists;
- upload queues;
- selected MIME parts;
- split segments;
- extraction fields;
- OCR blocks;
- anchored item state.

When a leaf viewer is placed inside a composed viewer, it must not create a
second outer viewer root unless it is intentionally the entire composed viewer.

## Public Export Rule

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
  useEmailViewerHeader,
  useEmailViewerPartsList,
  useEmailViewerSelectedPart,
}
```

Avoid namespace APIs:

```tsx
<EmailViewer.Root>
  <EmailViewer.Header />
</EmailViewer.Root>
```

Separate named exports are easier to search, easier to copy from registry
examples, and align with the rest of the component library.

## Easy API Rule

Every composed viewer may expose an easy component:

```tsx
<EmailViewer message={message} />
```

But the easy component is only preassembled composition.

It must be equivalent to the documented primitive composition. It must not
introduce a second hidden layout model with:

```txt
slots
renderSidebar
renderHeader
renderDocument
sidebarPosition
headerPlacement
layoutVariant
children-as-function layout props
```

If the easy component cannot be copied into explicit JSX, the API is not pure.

## What To Delete

Delete or hard-cut:

- conceptual `ViewerShell` center;
- nested viewer roots inside composed viewer surfaces;
- duplicate attachment/file metadata headers;
- `file-system-chrome` as a separate wrapper concept;
- raw MIME tree as the default email sidebar;
- render-slot APIs for viewer layout;
- PDF thumbnail booleans or layout props;
- anchored/source-link vocabulary drift;
- compatibility aliases for old names;
- generated registry entries that point at deleted surfaces.

## What To Normalize

Normalize vocabulary across source, docs, tests, and registry:

```txt
Root
Header
Body
Sidebar
Surface
Provider
Source
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

Avoid shared-layer drift:

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

Domain-specific words are allowed only inside the domain:

```txt
MIME part
split segment
file-system node
upload item
OCR block
extraction field
edit field
```

## Implementation Phases

### Phase 1: Finish The Hard Migration

Audit and migrate every composed viewer:

- email;
- PDF thumbnails;
- split;
- file system;
- uploadable/dropzone viewer;
- extract viewer;
- extraction viewer;
- OCR viewer;
- edit viewer;
- parse viewer;
- partition viewer;
- classify viewer;
- layout blocks.

Each migrated viewer must show the canonical grammar in source.

### Phase 2: Compress Providers

For each provider:

- write its one-sentence responsibility in code comments or docs;
- remove layout concerns;
- remove class name plumbing that belongs to primitives;
- expose narrow hooks for named parts;
- keep the broad hook only as a low-level escape hatch;
- verify imports do not cross into unrelated domains.

### Phase 3: Stabilize Anchored Document

Make extraction, OCR, edit, citations, and bbox sources share one anchored
interaction model:

- item identity;
- item label;
- item status;
- item anchor target;
- preview;
- selected;
- active;
- activation navigation.

Do not create separate anchored models for each product surface.

### Phase 4: Stabilize Acquisition

Keep dropzone and upload queue state separate from rendering:

- dropzone examples may produce `ViewerSource`;
- uploadable viewer may select a source;
- leaf viewers render selected sources;
- viewer primitives own layout.

### Phase 5: Rewrite Docs Around The System

Docs should teach the architecture, not isolated widgets.

Every compound viewer doc should include:

- the easy API;
- the explicit composition API;
- provider responsibility;
- part responsibilities;
- at least one controlled-state example when selection exists;
- accessibility notes for sidebar/surface navigation;
- loading, empty, and error states.

### Phase 6: Registry Integrity

Run:

```txt
bun run registry:build
```

Then verify:

- source and generated registry match;
- deleted files are absent from `registry.json`;
- generated examples use current names;
- registry dependencies match imports;
- no generated artifact preserves old vocabulary.

### Phase 7: Architecture Tests

Tests should guard the shape, not only happy-path rendering.

Required architecture assertions:

- generic viewer primitives are exactly five;
- composed viewers use `ViewerRoot`, `ViewerHeader`, `ViewerBody`,
  `ViewerSidebar`, and `ViewerSurface`;
- leaf viewers do not import domain providers;
- domain providers do not import unrelated providers;
- `FileViewer` has no layout/sidebar/anchored props;
- `PdfViewer` has no thumbnail/sidebar/anchored layout props;
- dropzone examples do not import file-viewer internals;
- anchored document core does not import source-map or leaf viewer types;
- docs examples contain the canonical grammar.

### Phase 8: Behavior Tests

Required behavior tests:

- email body and attachment selection;
- email nested message recursion;
- PDF page and thumbnail synchronization;
- split segment selection and overlay rendering;
- file-system folder/file selection;
- upload queue selection and rejection;
- extraction field preview, selection, and activation;
- OCR block preview, selection, and activation;
- edit field preview, selection, and activation.

### Phase 9: Visual Verification

Run browser verification for:

```txt
/view/blocks/email-viewer
/view/blocks/pdf-thumbnails
/view/blocks/split
/view/blocks/file-system
/view/blocks/dropzone-file-viewer
/view/blocks/extract
/view/blocks/extraction-viewer
/view/blocks/ocr
```

Check:

- exactly one viewer root per composed viewer;
- no nested cards inside cards;
- no duplicate headers;
- sidebar and surface are siblings;
- body/header alignment is consistent;
- thumbnails are square where intended;
- text does not overflow controls;
- loading/error/empty states render;
- browser console has no viewer runtime errors.

## Acceptance Criteria

The next iteration is complete when:

- every composed viewer uses the same visible grammar;
- every provider has one responsibility and narrow hooks;
- every selected document renders through a leaf viewer or leaf viewer part;
- dropzone is acquisition only;
- anchored document is interaction only;
- extraction, OCR, edit, and source bboxes share one anchored model;
- no compatibility wrapper remains as a conceptual center;
- no old naming vocabulary remains in public code/docs/tests;
- registry builds from source;
- typecheck passes;
- focused behavior tests pass;
- architecture tests pass;
- browser verification passes on the required blocks.

## Final Test

A new composed viewer should be obvious to write:

```tsx
<DomainProvider input={input}>
  <ViewerRoot>
    <DomainHeader />
    <ViewerBody>
      <ViewerSidebar>
        <DomainNavigation />
      </ViewerSidebar>
      <ViewerSurface>
        <DomainSelectedSource />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DomainProvider>
```

If the author reaches for a new generic primitive, a slot object, a hidden
layout prop, or a cross-domain provider, the design has drifted.

The ideal state is boring, searchable, and exact.

