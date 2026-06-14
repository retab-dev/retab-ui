# Viewer System Definitive Platonic Ideal Blueprint

## Objective

Define the final, ideal architecture for the Retab viewer component family.

This blueprint is not a migration plan.

This blueprint is not a compatibility plan.

This blueprint is the target shape if the only goals are:

- simplicity;
- speed;
- complete behavior;
- no unnecessary abstractions;
- exact module boundaries;
- one name per concept;
- no compatibility wrappers;
- no duplicated state machines;
- copy-pasteable registry components;
- tests that prove the public contract.

File-system implementation is out of scope for this document. File-system may
consume the primitives described here, but this blueprint does not redesign its
domain model.

## Verdict

We have not reached perfection.

We have reached the right axis.

The platonic ideal is not a larger universal viewer. It is not a provider for
everything. It is not a slot object API. It is not a recursive mega-component.

The final architecture is:

```txt
Viewer primitives
  own spatial layout and viewer-local sidebar state.

ViewerSource
  describes one renderable file/document input.

FileViewer
  renders one ViewerSource through format-specific leaf viewers.

Domain providers
  own one domain state machine.

Domain parts
  render named regions from narrow hooks.

DocumentAnchor
  describes pure document locations.

Anchored evidence
  connects domain rows to document anchors without owning the domain.
```

Everything else is an implementation detail.

The final sentence should be mechanically true:

```txt
Domains produce sources, anchors, and rows; viewer primitives place them; file
viewers render sources; anchored primitives coordinate evidence interaction.
```

If a component cannot be explained by that sentence, it does not belong in the
core viewer system.

## Non-Negotiable Standard

The viewer family is finished only when all of these are true:

- a reader can understand the rendered hierarchy by reading JSX;
- every provider owns exactly one state machine;
- every generic primitive owns layout or shared interaction, never domain data;
- every leaf viewer renders exactly one source;
- no leaf viewer owns a sidebar;
- no domain provider owns borders, radius, or flex layout;
- no component has both easy API and composed API that use different internals;
- no generic metadata bag exists where a typed payload should exist;
- no hidden compatibility shell is the conceptual center;
- no public file imports missing private support files;
- all registry artifacts install independently;
- all docs use the same vocabulary as the code;
- tests enforce architectural boundaries, not only rendered snapshots.

Perfection here means deletion. A new abstraction is justified only if it
removes more complexity than it adds.

## Final Vocabulary

Use these words exactly.

```txt
viewer
  The component family for rendering and composing document/file experiences.

root
  The outer spatial and sidebar-state boundary of one composed viewer.

header
  The full-width top region of a composed viewer.

body
  The flex region under the header.

sidebar
  A viewer-local side region controlled by ViewerRoot.

surface
  The main rendering region.

source
  One renderable file/document input.

file
  A source with file-like identity: name, type, size, download behavior.

leaf viewer
  A format-specific renderer for one source.

domain
  Email, split, upload, extraction, OCR, file-system, or another product model.

provider
  React transport for one domain state machine.

part
  A named domain component that reads provider state.

anchor
  A pure document location.

target
  An imperative bridge from an anchor to a rendered document.

evidence
  A domain row that can point at a document anchor.

payload
  Domain-specific row data carried by evidence.
```

Do not use these phrases in public APIs:

```txt
viewer evidence
source item
field item
layout source
target source
file viewer provider root
sidebar provider provider
```

They blur ownership.

## The One Spatial Grammar

The only generic spatial primitives are:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
```

The canonical hierarchy is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

`ViewerSidebarTrigger` may be rendered anywhere inside `ViewerRoot`:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
</ViewerHeader>
```

or:

```tsx
<DomainToolbar>
  <ViewerSidebarTrigger />
</DomainToolbar>
```

This follows the important shadcn sidebar lesson: the trigger should be
portable because the state belongs to a high-enough boundary.

The difference from shadcn sidebar is deliberate:

```txt
ViewerRoot is the sidebar provider.
```

There should not be:

```tsx
<ViewerSidebarProvider>
  <ViewerRoot />
</ViewerSidebarProvider>
```

The viewer root already defines the frame where a sidebar exists. A separate
viewer sidebar provider would duplicate hierarchy and create one provider too
many.

## ViewerRoot Contract

`ViewerRoot` owns:

- outer frame;
- border, radius, background;
- height and overflow policy;
- generic viewer CSS variables;
- sidebar open state;
- controlled and uncontrolled sidebar state;
- sidebar side, collapsibility, and keyboard shortcut;
- context consumed by `ViewerSidebar` and `ViewerSidebarTrigger`.

`ViewerRoot` does not own:

- selected file;
- selected MIME part;
- selected split segment;
- upload queue;
- source map;
- OCR block;
- current PDF page;
- zoom;
- download action;
- row rendering.

The final API should be close to:

```ts
type ViewerRootProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  sidebarSide?: "left" | "right"
  sidebarCollapsible?: "offcanvas" | "icon" | "none"
  shortcut?: string | null
}
```

No domain prop belongs here.

## ViewerHeader Rule

The header is always the full-width top region of the composed viewer.

Correct:

```tsx
<ViewerRoot>
  <EmailHeader />
  <ViewerBody>
    <ViewerSurface>
      <EmailContent />
    </ViewerSurface>
    <ViewerSidebar side="right">
      <EmailPartsSidebar />
    </ViewerSidebar>
  </ViewerBody>
</ViewerRoot>
```

Wrong:

```tsx
<ViewerBody>
  <ViewerSidebar>
    <EmailHeader />
    <EmailPartsSidebar />
  </ViewerSidebar>
  <ViewerSurface />
</ViewerBody>
```

Wrong:

```tsx
<ViewerSurface>
  <div className="viewer-card">
    <AttachmentMetadataHeader />
    <FileViewer />
  </div>
</ViewerSurface>
```

If the selected attachment is not the whole composed viewer, it should not
create a second file metadata header around the nested file viewer.

## ViewerSidebar Contract

`ViewerSidebar` owns the viewer-local side region. It does not own the list
model inside it.

Correct:

```tsx
<ViewerSidebar>
  <EmailPartsSidebar />
</ViewerSidebar>
```

Wrong:

```tsx
<ViewerSidebar items={parts} selectedId={selectedPartId} />
```

The sidebar should be visually neutral by default:

- no forced gray background;
- no opinionated item layout;
- stable width through CSS variables;
- no nested card inside the root frame;
- focus and resize behavior handled at the spatial layer.

Domain lists decide their own rows.

## ViewerSurface Contract

`ViewerSurface` owns the main rendering region.

It can contain:

```tsx
<FileViewer source={source} bare />
```

or:

```tsx
<PdfViewerPages />
```

or:

```tsx
<AnchoredDocumentTarget>
  <FileViewer source={source} bare />
</AnchoredDocumentTarget>
```

It does not:

- select a source;
- parse a file;
- derive email bodies;
- filter OCR blocks;
- route split segments;
- decide sidebar content.

## Keep Viewer And FileViewer Separate

`Viewer` and `FileViewer` both deserve to exist because they answer different
questions.

```txt
Viewer primitives answer: where do regions go?
FileViewer answers: how does this source render?
```

Folding them together would create a component that sometimes means spatial
layout and sometimes means file rendering. That is worse than two names.

The ideal is not:

```tsx
<Viewer source={source} sidebar={...} />
```

The ideal is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface>
      <FileViewer source={source} bare />
    </ViewerSurface>
  </ViewerBody>
</ViewerRoot>
```

The separation is exact:

```txt
ViewerRoot is spatial.
FileViewer is renderable-source routing.
```

## ViewerSource Contract

`ViewerSource` is the convergence point for rendering.

It is not the convergence point for acquisition.

Different domains acquire sources differently:

```txt
email MIME part       -> ViewerSource
dropzone file item    -> ViewerSource
file-system node      -> ViewerSource
split segment         -> ViewerSource
sample URL            -> ViewerSource
API resource          -> ViewerSource
```

The source contract should be minimal:

```ts
type ViewerSource = {
  id?: string
  name?: string
  mimeType?: string
  size?: number
  url?: string
  file?: File
  data?: ArrayBuffer | Uint8Array | string
}
```

The exact implementation may be richer, but the principle is fixed:

```txt
source describes one renderable thing, not the workflow that produced it.
```

Do not add:

- selected state;
- upload progress;
- MIME tree parent;
- extraction field path;
- OCR confidence;
- file-system expansion state.

Those belong to domains.

## FileViewer Contract

The easy API is:

```tsx
<FileViewer source={source} />
```

The composed API is:

```tsx
<FileViewerProvider source={source}>
  <FileViewerHeader />
  <FileViewerContent />
</FileViewerProvider>
```

`FileViewerProvider` owns one source and its resolved render state.

It owns:

- source normalization;
- resource loading;
- detected kind;
- resolved file identity;
- download action;
- unsupported state;
- content renderer selection.

It does not own:

- viewer root layout;
- sidebar open state;
- email part selection;
- split segment selection;
- upload queue;
- extraction field selection;
- OCR block selection.

`FileViewer` may internally compose:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

When nested inside another composed viewer, callers should use:

```tsx
<FileViewer source={source} bare />
```

or:

```tsx
<FileViewerProvider source={source}>
  <FileViewerContent />
</FileViewerProvider>
```

depending on whether file controls are still needed.

## Bare Means One Thing

`bare` means:

```txt
remove the outer frame because a parent viewer already owns the frame.
```

`bare` does not mean:

- remove essential controls;
- remove identity;
- become content-only;
- hide errors;
- disable download;
- skip accessibility.

Content-only parts should be named content-only:

```txt
PdfViewerPages
FileViewerContent
CsvViewerGrid
ImageViewerCanvas
MarkdownViewerContent
```

Do not make `bare` secretly switch APIs.

## Leaf Viewer Rule

Leaf viewers render one source.

Examples:

```txt
PdfViewer
ImageViewer
CsvViewer
XlsxViewer
DocxViewer
TextViewer
CodeViewer
MarkdownViewer
HtmlViewer
```

They own format mechanics:

- loading;
- parsing;
- zoom or scale;
- page navigation;
- search when native to the format;
- canvas or DOM rendering;
- overlays when passed explicit targets;
- imperative handles for targets.

They do not own domain workflows:

- email attachments sidebar;
- split page rail;
- upload queue;
- extraction fields;
- OCR block filter;
- file-system tree.

## Provider Rule

Providers are allowed only when separated named parts need shared state.

Good providers:

```txt
EmailViewerProvider
SplitViewerProvider
PdfViewerProvider
FileViewerProvider
UploadableFileViewerProvider
AnchoredDocumentProvider
```

Each provider must be describable in one sentence:

```txt
EmailViewerProvider owns MIME projection and selected part.
SplitViewerProvider owns split result navigation and selected segment.
PdfViewerProvider owns PDF resource, page state, zoom, and page metrics.
FileViewerProvider owns one source and selected renderer.
UploadableFileViewerProvider owns acquisition queue and selected upload source.
AnchoredDocumentProvider owns item-anchor preview, selection, and activation.
```

A provider is wrong when it owns:

- layout;
- `className` choreography;
- render callback slots;
- unrelated state machines;
- compatibility paths;
- styling decisions.

The ideal hook surface is narrow:

```txt
useEmailHeader
useEmailPartsSidebar
useEmailContent
```

Prefer that over:

```txt
useEmailViewer()
```

when only a small slice is needed.

## Export Style

Use separate named exports.

Correct:

```ts
export {
  EmailViewer,
  EmailViewerProvider,
  EmailHeader,
  EmailPartsSidebar,
  EmailContent,
  useEmailHeader,
  useEmailPartsSidebar,
  useEmailContent,
}
```

Avoid compound dot namespaces:

```tsx
<EmailViewer.Root>
  <EmailViewer.Header />
</EmailViewer.Root>
```

The useful shadcn lesson is composability and local ownership, not necessarily
dot syntax. Separate named exports are easier to search, copy, tree-shake, and
combine with the already named viewer primitives.

## Easy API Rule

Every domain viewer may expose an easy API:

```tsx
<EmailViewer message={message} />
<SplitViewer result={result} />
<UploadableFileViewer />
```

But the easy API must be a transparent composition of the named parts.

It must not:

- use a different state model;
- hide a second layout grammar;
- add wrapper chrome unavailable to composed users;
- support deprecated props;
- become the only complete version.

The easy component is an example made executable.

## Email Viewer Final Shape

Email is a MIME-domain viewer.

It is not a file viewer variant.

The easy API is:

```tsx
<EmailViewer message={message} />
```

The composed API is:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot defaultOpen sidebarSide="right">
    <EmailHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
      <ViewerSidebar aria-label="Email parts">
        <EmailPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

Email owns:

- normalized MIME message;
- recursive part tree;
- path-addressable MIME identity;
- selected part;
- default body selection;
- attachment projection;
- inline resource resolution;
- nested message recursion.

Email does not own:

- viewer root frame;
- sidebar state;
- file rendering;
- PDF controls;
- HTML sandbox internals;
- file-system concepts.

The input should preserve MIME recursion:

```ts
type MimePart = {
  id: string
  mimeType: string
  headers?: readonly MimeHeader[]
  fileName?: string | null
  disposition?: MimePartDisposition | null
  contentId?: string | null
  contentLocation?: string | null
  size?: number | null
  source?: ViewerSource
  children?: readonly MimePart[]
}

type MimeMessage = {
  id?: string
  headers?: readonly MimeHeader[]
  subject?: string | null
  from?: string | readonly string[] | null
  to?: string | readonly string[] | null
  cc?: string | readonly string[] | null
  bcc?: string | readonly string[] | null
  sentAt?: string | Date | null
  root: MimePart
}
```

Do not reintroduce flat `htmlBody`, `textBody`, and `attachments` as the core
model. They can be projections, not input truth.

The sidebar should have two domain sections:

```txt
Body
Attachments
```

It should not expose raw MIME tree noise by default. Raw structure can be a
debug or advanced view only if the product needs it.

## PDF Viewer And Thumbnails Final Shape

PDF has a domain provider because header controls, pages, thumbnails, metrics,
and target scrolling share PDF state.

Easy API:

```tsx
<PdfViewer source={source} />
```

Composed API with thumbnails:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot defaultOpen>
    <PdfViewerHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="Pages">
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

`PdfViewerProvider` owns:

- PDF resource;
- page count;
- current page;
- zoom;
- rotation if supported;
- page metrics;
- thumbnail metrics;
- page target handles.

`PdfViewerThumbnails` owns:

- page list rendering;
- square thumbnail sizing when configured;
- active page highlight;
- page activation;
- virtualization if needed.

It does not own:

- viewer sidebar frame;
- PDF loading;
- file source normalization.

## Split Viewer Final Shape

Split is a domain viewer over a split result.

Easy API:

```tsx
<SplitViewer result={result} />
```

Composed API:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot defaultOpen>
    <SplitViewerHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="Segments">
        <SplitViewerSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerSelectedFile />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Split owns:

- split result normalization;
- segment identity;
- selected segment;
- selected page or file projection;
- segment labels and legends;
- confidence or validation status if present.

Split does not own:

- file rendering;
- PDF internals;
- viewer sidebar state.

The selected segment becomes a `ViewerSource`, then `FileViewer` renders it.

## Dropzone Final Shape

Dropzone is source acquisition, not viewing.

It should produce upload/file items that can become `ViewerSource`.

The correct composition is:

```tsx
<UploadableFileViewerProvider>
  <ViewerRoot defaultOpen>
    <UploadableFileViewerHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="Files">
        <UploadQueue />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewer source={selectedSource} bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</UploadableFileViewerProvider>
```

Dropzone owns:

- drag state;
- accepted/rejected files;
- upload progress;
- queue ordering;
- selected upload item;
- conversion from upload item to `ViewerSource`.

Dropzone does not own:

- file rendering internals;
- PDF controls;
- viewer sidebar styling;
- extraction anchors.

This keeps acquisition separate from rendering.

## Sources And OCR Final Shape

Sources and OCR share anchored evidence interaction, and nothing else.

Shared:

```txt
item id
anchor resolution
preview
selection
activation
scroll
highlight
```

Separate:

```txt
source maps
field labels
layout blocks
row copy
filtering
confidence
rendering
```

The pure anchor vocabulary is:

```ts
type DocumentAnchor =
  | PdfAreaAnchor
  | ImageAreaAnchor
  | TextRangeAnchor
  | CsvCellAnchor
  | XlsxCellAnchor
  | DocxTargetAnchor
```

`document-anchor.ts` owns this and nothing else:

- no React;
- no `"use client"`;
- no provider;
- no source types;
- no OCR types;
- no viewer imports.

The evidence shape is payload-typed:

```ts
type AnchorResolution =
  | { status: "resolved"; anchor: DocumentAnchor }
  | { status: "missing" }
  | { status: "invalid"; reason: string }

type EvidenceAnchor = {
  id: string
  anchor: AnchorResolution
}

type EvidenceItem<Payload> = EvidenceAnchor & {
  payload: Payload
}
```

There is no:

```ts
metadata?: Record<string, unknown>
```

Source payload:

```ts
type SourceEvidencePayload = {
  label: string
  value?: React.ReactNode
  hint?: string
  sourceKind: Source["anchor"]["kind"] | null
}
```

OCR payload:

```ts
type LayoutEvidencePayload = {
  item: LayoutItem
  level: LayoutLevel
  kind: string
  text: string
  confidence?: number
  pageNumber: number
}
```

The composed extraction viewer is:

```tsx
<AnchoredDocumentProvider items={items}>
  <ViewerRoot defaultOpen>
    <ExtractionHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="Fields">
        <SourceFieldList items={sourceEvidenceItems} />
      </ViewerSidebar>
      <ViewerSurface>
        <AnchoredDocumentTarget>
          <FileViewer source={source} bare />
        </AnchoredDocumentTarget>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

The composed OCR viewer is:

```tsx
<AnchoredDocumentProvider items={items}>
  <ViewerRoot defaultOpen>
    <LayoutBlocksHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="Layout blocks">
        <LayoutBlocksPanel items={layoutEvidenceItems} />
      </ViewerSidebar>
      <ViewerSurface>
        <AnchoredDocumentTarget>
          <PdfViewerPages />
        </AnchoredDocumentTarget>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

OCR filtering and projection stay separate:

```txt
createLayoutItemIndex(document)
filterLayoutItems(items, filter)
layoutItemsToEvidenceModel(items, index)
```

Filtering is domain logic. Projection is evidence logic. Geometry is OCR model
logic.

## AnchoredDocumentProvider Contract

The provider owns generic anchored interaction:

- registered items;
- preview item;
- selected item;
- active anchor;
- activation;
- target registration;
- scroll-to-anchor;
- stale item cleanup.

It does not own:

- source maps;
- field paths;
- OCR layout;
- confidence;
- labels;
- values;
- row rendering;
- leaf document rendering.

This provider is correct because the state is genuinely shared by separated
parts: a row list and a rendered document target.

It is not a dead end.

The dead end would be making it know what a source field or OCR block is.

## File-System Boundary

File-system should contain a viewer, not the other way around.

Ideal composition:

```tsx
<FileSystemViewerProvider>
  <ViewerRoot defaultOpen>
    <FileSystemViewerHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="Files">
        <FileSystemViewerTree />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewer source={selectedSource} bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemViewerProvider>
```

This document does not redesign file-system internals.

The boundary is:

```txt
file-system owns acquisition, tree state, and source resolution.
viewer owns layout.
file viewer owns rendering.
```

## Final Module Boundaries

### Generic Viewer

```txt
viewer.tsx
  ViewerRoot
  ViewerHeader
  ViewerBody
  ViewerSidebar
  ViewerSurface
  ViewerSidebarTrigger
  useViewerSidebar
```

Forbidden imports:

```txt
file-viewer
pdf-viewer
email-viewer
split-viewer
source-evidence
layout-blocks
dropzone
file-system
```

### File Viewer

```txt
file-viewer.tsx
file-viewer-provider.tsx
file-viewer-header.tsx
file-viewer-content.tsx
viewer-source.ts
```

Allowed imports:

```txt
leaf viewers
resource loading utilities
download utilities
```

Forbidden imports:

```txt
email-viewer
split-viewer
source-evidence
layout-blocks
dropzone
file-system
```

### Anchored Evidence

```txt
document-anchor.ts
anchored-document-viewer.tsx
anchored-evidence.ts
anchored-item-list.tsx
```

Allowed imports:

```txt
viewer primitives only where rendering/context is needed
document-anchor for types
```

Forbidden imports:

```txt
source-evidence
source-anchor
layout-blocks-model
file-viewer
pdf-viewer
email-viewer
```

### Sources

```txt
source-anchor.ts
source-evidence.ts
source-field-list.tsx
```

Allowed imports:

```txt
document-source
document-anchor
anchored-evidence
anchored-item-list
field-anchor-link
```

Forbidden imports:

```txt
layout-blocks
email-viewer
split-viewer
file-system
```

### OCR/Layout Blocks

```txt
layout-blocks-types.ts
layout-blocks-geometry.ts
layout-blocks-index.ts
layout-blocks-model.ts
layout-blocks-panel.tsx
layout-blocks.tsx
```

Allowed imports:

```txt
anchored-evidence
anchored-document-viewer
anchored-item-list
pdf-anchor-target
pdf-viewer
```

Forbidden imports:

```txt
source-evidence
source-anchor
email-viewer
file-system
```

## Registry Standard

Every registry item must be independently installable.

Rules:

- every dependency is explicit in `registry.json`;
- every public mirror is either owned implementation or deliberate re-export;
- no registry item references a missing file;
- no item relies on another item through accidental relative imports;
- generated `public/r/*.json` files match source;
- docs import only public registry names;
- examples use the same composed API as production code.

If `registry:build` or `registry:validate` fails because of unrelated items,
the component slice may still be correct, but the system has not reached
library perfection.

## Testing Standard

The final test suite must prove both behavior and architecture.

Behavioral tests:

- easy APIs render;
- composed APIs render;
- controlled and uncontrolled selection work;
- sidebar trigger toggles from header, toolbar, and surface;
- file viewers load, error, empty, unsupported, and downloaded states;
- PDF page, zoom, thumbnail, and target navigation work;
- email body and attachment selection work recursively;
- dropzone queue and selected source work;
- Sources and OCR rows preview, activate, and scroll anchors.

Architecture tests:

- viewer primitives import no domains;
- file viewer imports no domains;
- domain providers import viewer primitives but not sibling domains;
- `document-anchor.ts` is pure;
- `anchored-evidence.ts` has no generic metadata;
- source rows use `SourceEvidencePayload`;
- OCR rows use `LayoutEvidencePayload`;
- easy API and composed API share implementation;
- registry dependencies are explicit;
- public mirrors resolve without hidden private modules.

Performance tests:

- large PDF thumbnail lists virtualize or remain bounded;
- large OCR lists do not reproject on hover;
- anchor preview does not rerender the document surface unnecessarily;
- file viewer source changes abort stale loads;
- email MIME trees memoize normalized paths;
- dropzone drag state does not rerender file content.

## Current Imperfections To Remove

The final system is not reached while any of these remain:

- `ViewerShell` remains the conceptual center;
- `Viewer` and `FileViewer` names are used interchangeably;
- any domain owns sidebar provider state instead of `ViewerRoot`;
- a selected attachment creates a nested duplicate file metadata header;
- `bare` removes semantic controls instead of only outer frame chrome;
- raw MIME tree rows are the default email sidebar;
- Sources and OCR share a fake universal row model;
- evidence has generic `metadata`;
- layout blocks cast metadata back into domain objects;
- registry validation depends on unrelated broken items;
- docs show an API that is not the production implementation.

## Final Proof

The platonic ideal is reached when these examples all feel inevitable and
boring.

Email:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot defaultOpen sidebarSide="right">
    <EmailHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
      <ViewerSidebar>
        <EmailPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

PDF thumbnails:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot defaultOpen>
    <PdfViewerHeader trailing={<ViewerSidebarTrigger />} />
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

Split:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot defaultOpen>
    <SplitViewerHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerSelectedFile />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Sources:

```tsx
<AnchoredDocumentProvider items={items}>
  <ViewerRoot defaultOpen>
    <ExtractionHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar>
        <SourceFieldList items={sourceEvidenceItems} />
      </ViewerSidebar>
      <ViewerSurface>
        <AnchoredDocumentTarget>
          <FileViewer source={source} bare />
        </AnchoredDocumentTarget>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

Upload:

```tsx
<UploadableFileViewerProvider>
  <ViewerRoot defaultOpen>
    <UploadableFileViewerHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar>
        <UploadQueue />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewer source={selectedSource} bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</UploadableFileViewerProvider>
```

These should all read as the same system:

```txt
provider owns domain state
viewer root owns spatial/sidebar state
header describes the whole viewer
body splits sidebar and surface
sidebar renders domain navigation
surface renders selected source or target
```

That is the final design.

