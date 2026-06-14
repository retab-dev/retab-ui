# Viewer System Definitive Platonic Blueprint

## Purpose

This is the final target architecture for the Retab viewer component family.

It is not a migration plan. It is not a compatibility plan. It does not try to
justify old shapes. It describes the smallest architecture that can express the
full product:

- file viewers;
- PDF thumbnails;
- email MIME viewers;
- split viewers;
- partition viewers;
- OCR/layout viewers;
- source/bbox evidence viewers;
- upload/dropzone viewers;
- file-system viewers as consumers only.

File-system implementation details are out of scope. File-system may compose
these primitives, but the viewer system must not absorb file-system state.

## Verdict

The ideal is not one universal viewer.

The ideal is four exact centers:

```txt
ViewerRoot
  spatial composition, frame, and viewer-local sidebar state

ViewerSource
  one renderable file/document input

FileViewer
  rendering of one ViewerSource through format-specific leaf viewers

SegmentedDocumentProvider
  shared segment, anchor, page, scroll, hover, and navigation mechanics
```

Everything else is a domain composition.

The final sentence should stay true:

```txt
Domains produce sources, segments, anchors, rows, and selected ids.
Viewer primitives place regions.
FileViewer renders sources.
SegmentedDocumentProvider coordinates document interaction.
```

If a component cannot be explained by that sentence, it probably does not
belong in the core viewer system.

## Non-Negotiables

The finished system must satisfy all of these:

- JSX reveals the hierarchy without reading hidden slot code.
- Each provider owns one state machine.
- Generic primitives own layout or shared interaction, never product domain.
- Leaf viewers render exactly one source.
- Leaf viewers do not own product sidebars.
- Domain providers do not own generic borders, radius, or flex layout.
- Easy APIs are transparent compositions of named parts.
- No easy API has a different internal model from its composed API.
- No generic metadata bag exists where a typed payload should exist.
- No compatibility wrappers remain as conceptual centers.
- No duplicated hover, preview, scroll, and active-page systems exist.
- No public registry item depends on private missing files.
- Public names use one word per concept.
- Tests prove boundaries, not only visual snapshots.

Perfection here means deletion. An abstraction is valid only when it removes
more complexity than it adds.

## Final Vocabulary

Use these names exactly.

```txt
viewer
  The component family for rendering and composing file/document experiences.

root
  The outer spatial boundary of one composed viewer.

header
  The full-width top region of a composed viewer.

body
  The flex region below the header.

sidebar
  A viewer-local side region controlled by ViewerRoot.

surface
  The main rendering region.

source
  One renderable file/document input.

file
  A source with file-like identity: name, MIME type, size, and download.

leaf viewer
  A format-specific renderer for one source.

domain
  Email, split, partition, OCR, extraction, upload, or file-system.

provider
  React transport for one state machine.

part
  A named component that renders one region from a provider.

segment
  A semantic document span.

anchor
  A page-local target for a segment.

row
  A display grouping of semantic segments.

handle
  An imperative bridge from shared navigation to a rendered document.
```

Do not use these public API names:

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

## Layer Map

The system has five layers.

```txt
1. Viewer primitives
   ViewerRoot, ViewerHeader, ViewerBody, ViewerSidebar, ViewerSurface,
   ViewerSidebarTrigger

2. Source rendering
   ViewerSource, FileViewerProvider, FileViewerHeader, FileViewerContent,
   FileViewer, format leaf viewers

3. Segmented document mechanics
   SegmentedDocumentModel, SegmentedDocumentProvider,
   useSegmentedDocumentViewport, document handles, segment primitives

4. Domain models
   Email model, split model, partition model, source model, OCR model,
   upload model

5. Domain compositions
   EmailViewer, SplitViewer, PartitionViewer, ExtractViewer,
   UploadableFileViewer, FileSystemViewer
```

Only lower layers can be imported by higher layers. The reverse is forbidden.

## Viewer Primitives

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

The header is outside the body. This is not optional.

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

Nested cards and second metadata headers are not composition. They are duplicate
chrome.

## ViewerRoot Is The Sidebar Provider

There should not be a separate viewer sidebar provider.

Correct:

```tsx
<ViewerRoot defaultOpen sidebarSide="right">
  <ViewerHeader>
    <ViewerSidebarTrigger />
  </ViewerHeader>
  <ViewerBody>
    <ViewerSurface />
    <ViewerSidebar />
  </ViewerBody>
</ViewerRoot>
```

Wrong:

```tsx
<ViewerSidebarProvider>
  <ViewerRoot>
    <ViewerSidebar />
  </ViewerRoot>
</ViewerSidebarProvider>
```

The shadcn sidebar lesson is that the trigger should be portable because state
lives high enough. The viewer-specific improvement is that `ViewerRoot` is
already the correct boundary. Another provider adds hierarchy without adding
meaning.

`ViewerSidebarTrigger` may be rendered anywhere inside `ViewerRoot`:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
</ViewerHeader>
```

```tsx
<DomainToolbar>
  <ViewerSidebarTrigger />
</DomainToolbar>
```

`ViewerRoot` owns:

- outer frame;
- border, radius, background;
- height and overflow policy;
- generic viewer CSS variables;
- sidebar open state;
- controlled and uncontrolled sidebar state;
- sidebar side;
- sidebar collapsibility;
- sidebar keyboard shortcut;
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

The root prop shape should stay close to:

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

## ViewerSidebar Contract

`ViewerSidebar` owns the side region. It does not own the list model inside it.

Correct:

```tsx
<ViewerSidebar aria-label="Email parts">
  <EmailPartsSidebar />
</ViewerSidebar>
```

Wrong:

```tsx
<ViewerSidebar items={parts} selectedId={selectedPartId} />
```

The sidebar default should be visually neutral:

- no forced gray background;
- no opinionated item row layout;
- stable width through CSS variables;
- no nested card inside the root frame;
- no domain icons;
- focus and resize behavior handled at the spatial layer.

Domain lists decide their own sections, rows, thumbnails, icons, and labels.

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
<SegmentedDocumentSurface>
  <FileViewer source={source} bare />
</SegmentedDocumentSurface>
```

It does not:

- select a source;
- parse a file;
- derive email bodies;
- filter OCR blocks;
- route split segments;
- decide sidebar content.

## Viewer And FileViewer Both Deserve To Exist

Do not fold `Viewer` and `FileViewer` together.

They answer different questions:

```txt
Viewer primitives answer: where do regions go?
FileViewer answers: how does this source render?
```

The wrong API is:

```tsx
<Viewer source={source} sidebar={...} />
```

The correct composition is:

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

This separation is not ceremony. It prevents a single name from meaning both
spatial layout and file rendering.

## ViewerSource

`ViewerSource` is the convergence point for rendering, not acquisition.

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

## FileViewer

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

`FileViewer` may internally compose a complete framed viewer:

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
- skip accessibility;
- silently switch to another renderer.

Content-only parts must be named content-only:

```txt
PdfViewerPages
FileViewerContent
CsvViewerGrid
ImageViewerCanvas
MarkdownViewerContent
```

Do not make `bare` secretly switch APIs.

## Leaf Viewers

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

They do not own product workflows:

- email attachments sidebar;
- split page rail;
- upload queue;
- extraction fields;
- OCR block filter;
- file-system tree.

## Segmented Document

The segmented-document layer is the convergence point for split, partition,
OCR, sources, and bbox extraction.

It is not a visual mega-viewer.

It is a document annotation and navigation primitive:

```tsx
<SegmentedDocumentProvider model={model}>{children}</SegmentedDocumentProvider>
```

It owns shared mechanics:

```txt
current page
scroll progress
hover / preview interaction
document handle registration
scroll to page
scroll to segment start
scroll to anchor / bounds
rail follow behavior
synchronized legend, rail, ribbon, sidebar, and overlays
```

It does not own:

```txt
split jobs
partition consensus
OCR parsing
source schemas
workflow runs
email MIME parts
file-system trees
upload queues
visual taste
empty-state copy
```

Do not build:

```tsx
<SegmentedViewer
  mode="partition"
  showVotes
  showPageRail={false}
  overlayMode="bbox"
/>
```

That is a hidden product component, not a primitive.

## Segment Is Not Anchor

Do not collapse semantic segments and page-local anchors.

They are different concepts:

```txt
DocumentSegment = semantic document span
SegmentAnchor = page-local visual or scroll target
```

For split and partition, the first-class object is semantic:

```ts
{
  id: "appendix",
  label: "Appendix",
  pages: [13, 14, 15, 16, 17, 18, 19, 20],
  color: "var(--chart-4)",
}
```

For OCR, sources, and bboxes, the visual target is page-local:

```ts
{
  id: "anchor:invoice-total:2",
  segmentId: "invoice-total",
  pageNumber: 2,
  bounds: { x: 0.6, y: 0.7, width: 0.2, height: 0.04 },
}
```

If every segment becomes page-local, split and partition get worse. Legend,
rail, and ribbon surfaces would constantly regroup anchors back into semantic
segments. That is the wrong direction.

## SegmentedDocumentModel

The shared model describes a segmented document, not a viewer.

```ts
export type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}

export type SegmentedPage = {
  pageNumber: number
  width?: number
  height?: number
}

export type DocumentSegment = {
  id: string
  label: string
  color: string
  pages: number[]
  sourceId?: string
}

export type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}

export type SegmentBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type SegmentRow = {
  id: string
  label?: string
  segments: DocumentSegment[]
}
```

In `SegmentedDocumentModel`, `segments` means:

```txt
the semantic segment projection used for viewport ownership and navigation
```

For partition, that is the same concept previously called
`viewportSegments`. Partition may still keep `legendSegments` and `ribbonRows`
in its own domain model, but the generic provider must not learn partition
taste.

The mapping is:

```txt
split
  segments

partition
  segmented model uses viewport/navigation segments
  partition domain model keeps legendSegments and ribbonRows if needed

sources
  segments + anchors

OCR
  segments + anchors

extraction PDF/image bboxes
  segments + anchors
```

`rows` is allowed only when the grouping is generic enough to remain a
document-segment concept. If a row carries partition votes, consensus, output
metadata, or product-specific controls, it belongs in the partition model, not
the shared segmented model.

## SegmentedDocumentProvider

The provider owns interaction and navigation, not domain derivation.

```ts
export type SegmentedDocumentContextValue = {
  model: SegmentedDocumentModel
  viewport: SegmentedDocumentViewport
}
```

Viewport:

```ts
export type SegmentedDocumentViewport = {
  model: SegmentedDocumentViewportModel
  interaction: SegmentInteraction
  documentHandlers: SegmentedDocumentHandlers
  navigation: SegmentedDocumentNavigation
  rail: SegmentedDocumentRail
}
```

Viewport model:

```ts
export type SegmentedDocumentViewportModel = {
  currentPage: number | null
  scrollProgress: number
  currentSegmentId: string | null
  previewSegmentId: string | null
  highlightedSegmentId: string | null
}
```

Document handlers:

```ts
export type SegmentedDocumentHandlers = {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  setDocumentHandle: (handle: SegmentedDocumentHandle | null) => void
}
```

Document handle:

```ts
export type SegmentedDocumentHandle = {
  getViewportElement?: () => HTMLElement | null
  scrollToPage: (page: number, options?: ScrollToOptions) => void
  scrollToAnchor?: (anchor: SegmentAnchor, options?: ScrollToOptions) => void
  scrollToPageArea?: (
    target: {
      pageNumber: number
      top: number
      left?: number
      width?: number
      height?: number
    },
    options?: ScrollToOptions
  ) => void
}
```

Navigation:

```ts
export type SegmentedDocumentNavigation = {
  scrollToPage: (page: number) => void
  scrollToSegmentStart: (segment: DocumentSegment) => void
  scrollToAnchor: (anchor: SegmentAnchor) => void
}
```

This replaces scroll replay protocols such as:

```txt
scrollRequest.version
```

Imperative document actions belong behind the registered document handle. They
should not be replayed by parent effects.

## Segment Primitives

Shared segment parts may exist, but only as optional consumers of the provider:

```tsx
<SegmentedLegend />
<SegmentedPageRail />
<SegmentedRibbon />
<SegmentedSidebar />
<SegmentedOverlay />
```

They must not import:

```txt
split
partition
OCR
sources
schemas
workflow runs
files
email
file-system
```

Domain viewers compose them. The provider is shared. The visible taste remains
domain-owned.

## Domain Provider Rule

Providers are allowed only when separated named parts need shared state.

Good providers:

```txt
EmailViewerProvider
SplitViewerProvider
PartitionViewerProvider
PdfViewerProvider
FileViewerProvider
UploadableFileViewerProvider
SegmentedDocumentProvider
```

Each provider must be describable in one sentence:

```txt
EmailViewerProvider owns MIME projection and selected part.
SplitViewerProvider owns split result normalization and selected segment.
PartitionViewerProvider owns partition result projections and selected output.
PdfViewerProvider owns PDF resource, page state, zoom, and page metrics.
FileViewerProvider owns one source and selected renderer.
UploadableFileViewerProvider owns acquisition queue and selected upload source.
SegmentedDocumentProvider owns segment interaction and document navigation.
```

A provider is wrong when it owns:

- layout;
- className choreography;
- render callback slots;
- unrelated state machines;
- compatibility paths;
- styling decisions.

Narrow hooks are better than broad hooks:

```txt
useEmailHeader
useEmailPartsSidebar
useEmailContent
```

is better than forcing every part through:

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

The useful shadcn lesson is composability and local ownership, not dot syntax.
Separate named exports are easier to search, copy, tree-shake, and combine with
the already named viewer primitives.

## Easy API Rule

Every domain viewer may expose an easy API:

```tsx
<EmailViewer message={message} />
<SplitViewer result={result} />
<PartitionViewer result={result} />
<UploadableFileViewer />
```

The easy API must be a transparent composition of the named parts.

It must not:

- use a different state model;
- hide a second layout grammar;
- add wrapper chrome unavailable to composed users;
- support deprecated props;
- become the only complete version.

The easy component is an executable example.

## Email Viewer

Email is a MIME-domain viewer.

It is not a file viewer variant.

Easy API:

```tsx
<EmailViewer message={message} />
```

Composed API:

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

The default sidebar should have two product sections:

```txt
Body
Attachments
```

Raw MIME structure is not the default user interface. It can exist only as an
advanced/debug part.

## PDF Viewer And Thumbnails

PDF has a provider because header controls, pages, thumbnails, metrics, and
target scrolling share PDF state.

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

## Split Viewer

Split is a domain viewer over a split result.

Easy API:

```tsx
<SplitViewer result={result} />
```

Composed API:

```tsx
<SplitViewerProvider result={result}>
  <SegmentedDocumentProvider model={segmentedModel}>
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
  </SegmentedDocumentProvider>
</SplitViewerProvider>
```

Split owns:

- split result normalization;
- segment identity;
- selected segment;
- selected page or file projection;
- segment labels and legends;
- confidence or validation status if present.

`SegmentedDocumentProvider` owns:

- current page;
- scroll progress;
- segment hover/preview;
- document handle navigation.

Split does not own:

- file rendering;
- PDF internals;
- viewer sidebar state;
- duplicated segment viewport logic.

The selected segment becomes a `ViewerSource`. `FileViewer` renders it.

## Partition Viewer

Partition is a domain viewer over partition output and vote semantics.

It should converge with split at the interaction layer, not the visual layer.

Easy API:

```tsx
<PartitionViewer result={result} />
```

Composed API:

```tsx
<PartitionViewerProvider result={result}>
  <SegmentedDocumentProvider model={segmentedModel}>
    <ViewerRoot defaultOpen>
      <PartitionViewerHeader trailing={<ViewerSidebarTrigger />} />
      <ViewerBody>
        <ViewerSurface>
          <PartitionRibbon />
          <PartitionDocument />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </SegmentedDocumentProvider>
</PartitionViewerProvider>
```

Partition owns:

- output/vote semantics;
- partition result normalization;
- empty and processing states;
- `legendSegments`;
- `ribbonRows`;
- selected output or row;
- horizontal ribbon layout;
- partition-specific copy.

`SegmentedDocumentProvider` owns:

- viewport/navigation segments;
- current page;
- scroll progress;
- hover/preview;
- document handle registration;
- `scrollToPage`;
- `scrollToSegmentStart`.

The partition model may keep:

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  segmentedModel: SegmentedDocumentModel
  legendSegments: DocumentSegment[]
  ribbonRows: PartitionRibbonRow[]
}
```

The generic provider must not accept:

```txt
partitionMode
showConsensusVotes
voteRows
outputNames
```

Those are partition concerns.

## OCR, Sources, And Bbox Evidence

OCR, sources, and bbox extraction are close enough to share segmented-document
mechanics.

They should produce:

```txt
DocumentSegment[] for semantic rows or fields
SegmentAnchor[] for page-local visual targets
```

Examples:

```txt
field path -> DocumentSegment
source bbox -> SegmentAnchor
OCR block -> DocumentSegment + SegmentAnchor
provenance item -> SegmentAnchor
```

The overlay reads `anchors`.

The list/sidebar/legend reads `segments`.

Clicking a field or source item calls:

```ts
navigation.scrollToAnchor(anchor)
```

or:

```ts
navigation.scrollToSegmentStart(segment)
```

depending on the UI intent.

This does not mean every extraction target belongs in
`SegmentedDocumentModel`. Page and image bboxes fit naturally. Text ranges,
CSV cells, XLSX cells, and DOCX targets need a deliberate typed anchor model
before they are folded in.

The ideal rule is:

```txt
SegmentedDocumentModel owns semantic document spans and page-local anchors.
Non-page targets need a first-class typed anchor, not a metadata bag.
```

Do not pollute `SegmentAnchor` with vague fields such as:

```ts
metadata?: Record<string, unknown>
```

If non-bbox targets converge later, they should do it through a typed union:

```ts
type SegmentAnchor =
  | PageAreaSegmentAnchor
  | TextRangeSegmentAnchor
  | CsvCellSegmentAnchor
  | XlsxCellSegmentAnchor
  | DocxTargetSegmentAnchor
```

until then, keeping non-bbox anchored flows separate is cleaner than making the
segmented primitive vague.

## Upload And Dropzone

Dropzone is source acquisition, not viewing.

It should produce upload/file items that can become `ViewerSource`.

Correct composition:

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
- accepted files;
- rejected files;
- upload progress;
- queue ordering;
- selected upload item;
- conversion from upload item to `ViewerSource`.

Dropzone does not own:

- file rendering internals;
- PDF controls;
- viewer sidebar styling;
- extraction anchors.

## File-System Viewer

File-system is a domain consumer.

The direction is:

```txt
file-system contains viewer
```

not:

```txt
viewer contains file-system
```

The shape may look like:

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

But file-system owns:

- tree state;
- expansion;
- selection;
- lazy loading;
- file operations;
- permissions;
- path semantics;
- directory actions.

The viewer system owns none of that.

## Public Composition Examples

### Email Attachment

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot defaultOpen sidebarSide="right">
    <EmailHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSurface>
        <FileViewer source={selectedPartSource} bare />
      </ViewerSurface>
      <ViewerSidebar aria-label="Email parts">
        <EmailPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

No second attachment metadata header wraps the nested file viewer unless the
selected attachment is itself the whole viewer.

### PDF With Thumbnails

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot defaultOpen>
    <PdfViewerHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="Pages">
        <PdfViewerThumbnails variant="square" />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

### Source Bboxes

```tsx
<SegmentedDocumentProvider model={sourceSegmentedModel}>
  <ViewerRoot defaultOpen sidebarSide="right">
    <SourceHeader trailing={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSurface>
        <SourceDocument />
      </ViewerSurface>
      <ViewerSidebar aria-label="Sources">
        <SourceFieldList />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</SegmentedDocumentProvider>
```

## Styling Rules

Viewer primitives provide structural styling only.

They may own:

- frame radius;
- border;
- background;
- sidebar width variables;
- flex direction;
- overflow containment;
- focus-visible rings;
- collapsed state data attributes.

They may not own:

- email row density;
- MIME part icons;
- split segment colors;
- partition vote visuals;
- OCR confidence colors;
- file-system indentation;
- upload progress row design.

Domain components use tokens and local CSS classes. They do not patch generic
viewer internals.

## Accessibility Requirements

The final system must include:

- labelled sidebars;
- keyboard accessible sidebar trigger;
- focus-visible states;
- stable tab order when sidebar opens/closes;
- meaningful file names in headers;
- progress and loading states with accessible text;
- unsupported-file states that explain what failed;
- document navigation controls with button semantics;
- no clickable `div` rows without keyboard behavior.

Accessibility is part of the component API, not a final polish pass.

## Performance Requirements

The final system must preserve speed at every layer:

- providers memoize context values;
- large page lists and thumbnails virtualize when needed;
- PDF pages avoid unnecessary rerenders on hover;
- overlays render from normalized anchors, not ad hoc source scans;
- sidebar lists do not recompute MIME/source/partition projections on every
  pointer move;
- callbacks exposed by providers are stable;
- source loading is cached at the file/resource layer;
- scrolling uses document handles, not parent effect replay loops.

If a generic abstraction forces domain code to rerender more often, the
abstraction is wrong.

## Testing Standard

Architecture tests:

- viewer primitives import no domain modules;
- `FileViewer` imports leaf viewers but no email, split, partition, upload, or
  file-system modules;
- `SegmentedDocumentProvider` imports no split, partition, OCR, source, email,
  upload, or file-system modules;
- domain viewers compose `ViewerRoot`, `ViewerBody`, `ViewerSidebar`, and
  `ViewerSurface` visibly;
- no `scrollRequest.version` protocol exists;
- no generic viewer component accepts domain flags.

Model tests:

- split adapters create semantic `DocumentSegment[]`;
- partition adapters create `segmentedModel`, `legendSegments`, and
  `ribbonRows` without mixing their meanings;
- OCR/source adapters create anchors linked to existing segment ids;
- invalid anchors are ignored or rejected deterministically;
- page numbers normalize consistently.

Controller tests:

- current page updates from document callbacks;
- scroll progress clamps to `0..1`;
- navigation ignores invalid pages;
- `scrollToSegmentStart` uses the first normalized segment page;
- `scrollToAnchor` calls `scrollToAnchor` when available;
- `scrollToAnchor` falls back to `scrollToPageArea` for bounds;
- `scrollToAnchor` falls back to `scrollToPage`;
- result/model changes reset current page, progress, and preview.

Composition tests:

- easy APIs are visible named-part compositions;
- email sidebar defaults to body and attachments;
- PDF thumbnails render in `ViewerSidebar`, not a bespoke wrapper;
- split and partition use segmented-document viewport mechanics;
- bbox source viewers use segmented-document anchors;
- non-bbox source viewers do not fake page anchors through metadata bags.

Registry tests:

- each registry item installs with all private support files;
- generated registry JSON includes the same dependencies as source blocks;
- blocks can be copied without local app-only imports.

Visual tests:

- PDF thumbnail layout is stable at mobile and desktop widths;
- email attachment viewer has one frame, not nested cards;
- sidebar trigger can be placed in headers and toolbars;
- split, partition, OCR, and source overlays remain aligned after resize;
- text fits in sidebar rows without overlap.

## Failure Modes

The design has failed if any of these appear:

```tsx
<Viewer source={source} attachments={parts} />
```

```tsx
<SegmentedViewer mode="partition" showVotes />
```

```tsx
<ViewerSidebar items={items} selectedId={id} />
```

```tsx
<FileViewer source={source} selectedField={field} />
```

```tsx
<SegmentAnchor metadata={{ cell: "A1" }} />
```

```txt
scrollRequest.version
```

```txt
Provider that owns both layout and selected domain item
```

```txt
One component that is sometimes a complete viewer and sometimes content-only
```

## What Is Still Not Perfect

Even with the correct architecture, the system is not perfect until these are
gone:

- legacy naming where `FieldAnchorLink` now means both anchored and segmented
  behavior;
- duplicated PDF/image bbox overlay helpers across examples;
- non-bbox extraction targets split between older anchored mechanics and the
  segmented model;
- any domain easy API that still has private layout wrappers unavailable to
  composed users;
- any visual example not verified in browser after structural changes.

These are not reasons to abandon the provider direction. They are the remaining
proof obligations.

## Final Shape

The platonic ideal is:

```txt
one spatial grammar
one source-rendering grammar
one segmented-document interaction grammar
many domain-owned compositions
```

Not:

```txt
one hidden mega-viewer
```

Not:

```txt
many duplicated hover/scroll/navigation systems
```

Not:

```txt
viewer absorbs file-system, email, split, partition, OCR, upload, and sources
```

The final boundary is exact:

```txt
ViewerRoot places.
FileViewer renders.
SegmentedDocumentProvider coordinates document interaction.
Domain providers decide domain meaning.
```

That is the architecture to protect.
