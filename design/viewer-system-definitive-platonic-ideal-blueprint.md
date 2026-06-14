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
}
```

No domain prop belongs here.

Keyboard shortcuts are app policy, not viewer structure. A product can wire any
local or global shortcut through `useViewerSidebar().toggleSidebar`, but
`ViewerRoot` should not expose a shortcut prop.

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

## Component Inventory And Bad Patterns

This inventory is scoped to the viewer system. It intentionally excludes
file-system internals, json-table, schema-editor, and general shadcn primitives.

The useful question is not whether each component works. Most of them work. The
question is whether each component expresses the final architecture without
leaking an older idea.

### Viewer Spatial Primitives

Components:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
useViewerSidebar
useOptionalViewerSidebar
```

Current judgment:

```txt
keep
```

Good:

- `ViewerRoot` is already the viewer-local sidebar provider.
- `ViewerSidebarTrigger` can be placed in headers and toolbars.
- `ViewerSidebar` registers with the root instead of requiring props on the
  root.
- `ViewerRoot` rejects multiple primary sidebars, which keeps the spatial
  grammar understandable.

Bad:

- `ViewerRoot` has more responsive sidebar policy than the blueprint currently
  names: `mode`, `inlineBreakpoint`, and measured inline/overlay switching.
  That may be correct, but it needs to be accepted explicitly or compressed.
- `ViewerRoot` still defaults `mode` to `"inline"` even though most product
  compositions want resilient behavior across widths.
- `ViewerRoot` supports `sidebarCollapsible: "offcanvas" | "none"` but the
  blueprint vocabulary still mentions an `"icon"` shape as a possible final
  primitive. Either implement the icon rail or delete it from the desired API.
- `bare` on `ViewerRoot` currently still applies `bg-muted/20`. That means
  "bare" is not perfectly "parent owns all frame/background".

Change:

- Decide whether `mode="auto"` is the default platonic behavior.
- Decide whether icon collapse belongs in `ViewerRoot`; if not, remove it from
  all docs.
- Make `bare` mean no frame and no opinionated background.

### Generic Toolbar

Components:

```txt
ViewerToolbar
ViewerDownloadButton
ViewerErrorState
ViewerErrorBoundary
```

Current judgment:

```txt
keep, but narrow
```

Good:

- `ViewerToolbar` gives file viewers one consistent visual language for title,
  position, zoom, rotate, and download.
- `ViewerDownloadButton` keeps download behavior out of every leaf viewer.
- Error states are shared at the rendering layer instead of duplicated per
  domain.

Bad:

- `ViewerToolbar` is generic enough to be reused, but it also knows document
  concepts such as page position, zoom, rotate, and downloads. It is closer to
  "file toolbar" than "viewer spatial primitive".
- If `ViewerToolbar` keeps growing, it will become the mega-toolbar the
  primitive layer was supposed to avoid.

Change:

- Treat `ViewerToolbar` as source-rendering chrome, not as a spatial primitive.
- Do not add domain actions to it.

### FileViewer

Components:

```txt
FileViewer
FileViewerProvider
FileViewerHeader
FileViewerContent
useFileViewer
FileViewerRoute
```

Current judgment:

```txt
keep, but finish the public grammar
```

Good:

- `FileViewerProvider` owns one source and one resolved render state.
- `FileViewerContent` routes to format renderers.
- `FileViewerHeader` exists as a named part.
- The easy API and composed API now mostly share the same provider.

Bad:

- The easy `FileViewer` currently renders only `FileViewerContent`; it does not
  render `FileViewerHeader` plus `ViewerRoot` as the blueprint describes. That
  makes `FileViewer` ambiguous: sometimes it is the whole file viewer, sometimes
  it is content.
- `FileViewerContentProps` only accepts `bare` and `className`; content-level
  control is narrow, but not yet a complete named-parts API.
- `useFileViewer` exposes the whole context, not narrow header/content slices.
- Lazy route names such as `PdfResourceViewer`, `ImageResourceViewer`, and
  `XlsxResourceViewer` sound like complete viewers while they are actually
  resource/content renderers.

Change:

- Decide whether `<FileViewer source />` is complete chrome or content-only.
  The final architecture says complete chrome.
- If complete, make the nested form explicit through `bare`, or add a clearly
  named `FileViewerContentOnly` path.
- Rename resource renderers toward content names if they are public.

### ResourceDocShell

Components:

```txt
ResourceDocShell
ZoomActions
ZoomActionsSkeleton
ViewerFallback
UnsupportedCard
```

Current judgment:

```txt
replace
```

Good:

- It solved a real problem for CSV, HTML, text, and fallback states: shared
  header, actions, zoom skeleton, and download.

Bad:

- It is a private second chrome contract parallel to `FileViewerHeader` and
  `FileViewerContent`.
- It has its own header DOM instead of using `ViewerHeader`.
- It makes CSV/HTML/text feel different from PDF, DOCX, image, and PPTX.
- It spreads the meaning of `bare` into file chrome internals.

Change:

- Move its useful pieces into `FileViewerHeader`, `FileViewerContent`, and
  leaf-specific content parts.
- Delete `ResourceDocShell` as a public or semi-public pattern.

### PDF Viewer

Components:

```txt
PdfViewer
PdfViewerProvider
PdfViewerHeader
PdfViewerPages
PdfResourceViewer
PdfViewerThumbnails
PdfThumbnailRail
PdfHighlight
PdfViewerContext hooks
```

Current judgment:

```txt
keep, rename one boundary
```

Good:

- PDF has the best decomposed shape: provider, header, pages, thumbnails,
  resource loading, page metrics, and document handle.
- `PdfViewerThumbnails` is properly sidebar-agnostic.
- `PdfViewerPages` can be embedded inside other viewers and can register a
  handle with segmented-document mechanics.

Bad:

- `PdfResourceViewer` sounds like a complete viewer. It is really a resource
  page renderer.
- `PdfViewerPages` delegates back through `PdfResourceViewer`, which makes the
  public/composed boundary harder to read.
- `PdfViewer` owns a `ViewerRoot`, which is correct for the easy API, but users
  need very clear guidance that `PdfViewerPages` is the content part.

Change:

- Rename `PdfResourceViewer` to something content-shaped if it remains public.
- Keep `PdfViewer`, `PdfViewerProvider`, `PdfViewerHeader`,
  `PdfViewerPages`, and `PdfViewerThumbnails`.

### PDF Thumbnail Rail

Components:

```txt
PdfViewerThumbnails
PdfThumbnailRail
PdfThumbnailRailViewport
PdfThumbnailItem
PdfThumbnailCanvas
usePdfThumbnailDocument
usePdfThumbnailPageMetrics
usePdfThumbnailWindow
useThumbnailRailFollow
```

Current judgment:

```txt
keep
```

Good:

- It is independent from `ViewerSidebar`.
- It virtualizes.
- It follows the active page without stealing pointer/user scroll.
- It owns thumbnail-specific metrics instead of polluting PDF pages.

Bad:

- Square thumbnail behavior is still a prop/style convention, not a strongly
  named variant everywhere.
- The rail and segmented page rail have similar "follow current item" behavior
  implemented separately.

Change:

- Keep separate visual components.
- Consider sharing only the tiny follow-current-item mechanic if it becomes
  demonstrably identical.

### Leaf File Viewers

Components:

```txt
ImageViewer
CsvViewer
XlsxViewer
DocxViewer
PptxViewer
TextViewer
CodeViewer
PretextMarkdownViewer
MarkdownDocumentViewer
HtmlDocViewer
CsvDocViewer
```

Current judgment:

```txt
keep, normalize chrome names
```

Good:

- The leaf viewers mostly own format mechanics and do not own product sidebars.
- Heavy formats have dedicated resource/cache/worker modules.
- CSV, XLSX, text, code, image, DOCX, PDF, and PPTX are separated enough for
  performance work.

Bad:

- Naming is uneven: some are `*Viewer`, some are `*ResourceViewer`, some are
  `*DocViewer`, some are `*Content`.
- Some leaf viewers include chrome; some rely on `ResourceDocShell`; some are
  true content renderers.
- Markdown has multiple families: pretext markdown, markdown document viewer,
  page markdown viewer. That may be necessary, but the names do not reveal the
  product distinction sharply enough.

Change:

- Reserve `*Viewer` for complete easy components.
- Use `*Content`, `*Pages`, `*Canvas`, `*Grid`, or `*Workbook` for content-only
  parts.
- Document why the markdown variants are different, or collapse them.

### FileThumbnail

Components:

```txt
FileThumbnail
FileThumbnailFrame
FileThumbnail renderers
thumbnail cache
thumbnail workers
```

Current judgment:

```txt
keep
```

Good:

- It is acquisition/rendering adjacent but not a viewer.
- It has renderer registry, cache, workers, error states, and format-specific
  renderers.
- It is useful in email, upload, and source sidebars without pulling in
  `FileViewer`.

Bad:

- Thumbnail presentation rules are spread across consumers: email sidebar,
  file intake sidebar, PDF rail, source sidebars.
- Square thumbnail sizing is not a universal consumer contract.

Change:

- Keep `FileThumbnail` independent.
- Standardize consumer thumbnail sizing tokens or variants.

### Segmented Document Mechanics

Components:

```txt
SegmentedDocumentModel
SegmentedDocumentProvider
useSegmentedDocument
useSegmentedDocumentModel
useSegmentedDocumentViewport
useSegmentViewportController
useSegmentInteraction
SegmentLegend
SegmentPageRail
SegmentSidebar
PageRibbon
```

Current judgment:

```txt
keep, protect from visual mega-viewer drift
```

Good:

- The model separates semantic `DocumentSegment` from page-local
  `SegmentAnchor`.
- The provider owns hover, preview, current page, scroll progress, document
  handle registration, and navigation.
- Split, partition, OCR, and bbox source examples can share mechanics.

Bad:

- `SegmentedDocumentProvider` currently drives viewport ownership from
  `model.segments`; that is clean only if `model.segments` is explicitly the
  viewport/navigation projection.
- `rows?: SegmentRow[]` is risky. It is safe for generic segment rows, but it
  can easily become a tunnel for partition-specific vote semantics.
- `SegmentLegend`, `SegmentPageRail`, `SegmentSidebar`, and `PageRibbon` still
  use older `Segment` language rather than consistently saying
  `DocumentSegment`.

Change:

- Document that `model.segments` means viewport/navigation segments.
- Keep partition vote/output detail outside the generic provider.
- Rename exported segment primitives only if the current names start causing
  real ambiguity.

### SegmentedDocumentViewer

Components:

```txt
SegmentedDocumentViewer
```

Current judgment:

```txt
delete or demote to demo/block
```

Good:

- It proved sidebar, legend, timeline, and PDF preview could be synchronized.

Bad:

- It is exactly the shape the final architecture rejects: a generic visual
  segmented viewer.
- It owns its own `currentPage`, `useSegmentInteraction`, and DOM
  `querySelector` scroll path instead of using `SegmentedDocumentProvider` and a
  registered document handle.
- It composes `SegmentSidebar`, `SegmentLegend`, `PageTimeline`, and
  `PdfViewer` internally, so users cannot see a domain-owned layout.

Change:

- Remove it from the core UI registry or reframe it as a demo-only block.
- Do not let it become the recommended primitive.

### Email Viewer

Components:

```txt
EmailViewer
EmailViewerProvider
EmailHeader
EmailPartsSidebar
EmailContent
useEmailViewer
useEmailHeader
useEmailPartsSidebar
useEmailContent
email-viewer-model
email-viewer-types
email-viewer-inline-resources
```

Current judgment:

```txt
keep, polish composition boundary
```

Good:

- MIME recursion is preserved in the input and model.
- The easy API uses a full-width header plus body/surface/sidebar hierarchy.
- The sidebar is sectioned into body/attachments instead of raw MIME noise by
  default.
- Attachments render through `FileViewer bare`.
- Inline resources are scoped and resolved outside leaf HTML rendering.

Bad:

- `EmailViewerChrome` is private. The easy API is transparent enough in code,
  but not exported as the composed example.
- `useEmailViewer` exposes the full context even though narrow hooks exist.
- Nested messages recursively create nested `ViewerRoot`s. That may be right,
  but it is visually and conceptually heavy.
- `EmailHeader` does not accept a `trailing` prop; it hardcodes
  `ViewerSidebarTrigger`.

Change:

- Export the same named composition the easy API uses, or make the easy API
  visibly assemble exported parts only.
- Prefer `EmailHeader` with a trailing slot over a hardcoded trigger if callers
  need control.
- Decide whether nested messages should be nested full viewers or nested email
  content.

### Split Viewer

Components:

```txt
SplitViewer
SplitViewerProvider
SplitViewerRoot
SplitViewerHeader
SplitViewerBody
SplitViewerSidebar
SplitViewerSurface
SplitViewerPageRail
SplitViewerLegend
SplitViewerDocument
SplitViewerEmptyState
```

Current judgment:

```txt
keep, compress wrapper parts
```

Good:

- Split uses `SegmentedDocumentProvider`.
- Split has narrow hooks for header, rail, legend, and document.
- Page rail and legend share the same viewport mechanics.
- It no longer owns a custom scroll replay protocol.

Bad:

- `SplitViewerRoot`, `SplitViewerBody`, `SplitViewerSidebar`, and
  `SplitViewerSurface` mostly re-export generic spatial primitives with light
  defaults. That can be convenient, but it creates a parallel spatial grammar.
- `SplitViewerDocument` receives arbitrary `children`, so the source rendering
  contract is not explicit in the component boundary.
- Empty state uses `bg-muted`, which can fight the root/surface background
  grammar.

Change:

- Keep semantic parts: header, page rail, legend, document, empty state.
- Delete or minimize wrapper aliases for `ViewerRoot`, `ViewerBody`,
  `ViewerSidebar`, and `ViewerSurface` unless they encode real split behavior.
- Make selected source/document rendering explicit.

### Partition Viewer

Components:

```txt
PartitionViewer
PartitionViewerProvider
PartitionViewerHeader
PartitionViewerDocument
PartitionViewerEmptyState
partition-viewer-model
```

Current judgment:

```txt
keep as convergence proof, finish as product viewer
```

Good:

- Partition uses `SegmentedDocumentProvider`.
- `PartitionViewerModel` correctly separates `viewportSegments`,
  `legendSegments`, and `ribbonRows`.
- The stale `scrollRequest.version` protocol is gone from partition.

Bad:

- The easy API does not yet render a real document; `PartitionViewerDocument`
  says "No document available" when output exists.
- `createPartitionSegmentedDocumentModel` passes `ribbonRows` into generic
  `rows`, which is acceptable only if those rows remain generic. Partition
  votes are already domain-specific.
- Header owns both legend and ribbon. That may be right visually, but it means
  the ribbon is currently header chrome rather than an independently composed
  body/header part.

Change:

- Connect partition to an actual document source/handle.
- Keep vote/output semantics in partition model, not generic
  `SegmentedDocumentModel`.
- Decide whether ribbon is a domain header part or its own named part.

### OCR / Layout Blocks

Components:

```txt
DocumentAiLayoutBlocks
LayoutBlocksPanel
LayoutOverlayLayer
layout-blocks-model
layout-blocks-segmented-document-model
layout-blocks-geometry
```

Current judgment:

```txt
keep, extract interaction adapter
```

Good:

- OCR/layout now uses `SegmentedDocumentProvider`.
- Layout items become semantic segments plus anchors.
- PDF pages register the segmented document handle.
- Overlay, panel, and document navigation are synchronized.

Bad:

- `DocumentAiLayoutBlocksContent` still owns local selected item state and
  repeats segment/anchor lookup logic that also exists in `useSegmentedFieldLink`.
- Overlay generation filters visible items per page inside the render callback.
- Header, filter controls, document, sidebar, and provider wiring live in one
  large component.

Change:

- Extract a generic `useSegmentedItemLink` / `useSegmentedSourceLink` shape.
- Move per-page overlay projection out of the render callback if profiling
  shows pressure.
- Split visible parts if this becomes a public composed API.

### Source Field / Evidence Components

Components:

```txt
SourceFieldList
SourceIndicator
SourceEvidence
SourceAnchor
FieldAnchorLink
useAnchoredFieldLink
useSegmentedFieldLink
source-segmented-document-model
AnchoredItemList
AnchoredDocumentProvider
```

Current judgment:

```txt
rename and split
```

Good:

- Bbox-backed PDF/image source examples now use `SegmentedDocumentProvider`.
- Non-bbox source examples still have a working anchored path.
- `source-segmented-document-model` refuses to fake CSV/XLSX/DOCX/text targets
  as page anchors.

Bad:

- `FieldAnchorLink` is now a misleading name because it can be backed by
  either anchored-document or segmented-document mechanics.
- `SourceFieldList` still renders through `AnchoredItemList`, even when the
  link is segmented.
- `useSegmentedFieldLink` only maps one anchor per segment id. That is enough
  for current examples, but not enough for multiple anchors per field.
- `AnchoredDocumentProvider` and `SegmentedDocumentProvider` now overlap for
  bbox cases, so readers must learn two interaction systems.

Change:

- Rename `FieldAnchorLink` to a neutral link name such as `SourceFieldLink`.
- Split anchored and segmented field-list implementations if the shared list
  keeps leaking old terms.
- Decide whether non-bbox targets deserve typed `SegmentAnchor` variants or a
  separate non-segmented provider.

### Extraction Blocks

Components:

```txt
ExtractViewerBlock
ExtractionViewerBlock
JsonFormSourcesBlock
ImageSourcesBlock
TextSourcesBlock
CsvSourcesBlock
XlsxSourcesBlock
DocxSourcesBlock
```

Current judgment:

```txt
hybrid, intentionally unfinished
```

Good:

- PDF/image bbox examples use segmented-document mechanics.
- Text/CSV/XLSX/DOCX examples do not lie by pretending non-page targets are
  page bboxes.
- The mixed extraction viewer exposes the real current split.

Bad:

- PDF/image overlay helpers are duplicated across blocks.
- Mixed extraction has two interaction systems: segmented for PDF/image,
  anchored for text/CSV/XLSX/DOCX.
- The same `SourceFieldList` component has to straddle both systems.

Change:

- Extract shared segmented PDF/image source overlay helpers.
- Make an explicit decision on typed non-bbox anchors before touching text,
  CSV, XLSX, or DOCX convergence.

### Edit Viewer

Components:

```txt
EditViewer
EditViewerProvider
EditViewerHeader
EditViewerDocument
EditViewerFields
EditViewerToolbar
EditViewer overlays/states/model
```

Current judgment:

```txt
works, but pre-convergence
```

Good:

- It has a real domain provider and named parts.
- It separates header, document, fields, toolbar, states, and model.
- It uses `ViewerRoot`, `ViewerBody`, `ViewerSurface`, and `ViewerSidebar`
  visibly.

Bad:

- It still uses `AnchoredDocumentProvider` for PDF field interaction.
- It has its own field projection, selection, target, and overlay mechanics
  instead of using segmented-document anchors.
- It owns a large provider value with many slices, which is coherent but heavy.

Change:

- Decide whether edit fields are segmented-document anchors. If yes, migrate
  PDF field overlays to `SegmentedDocumentProvider`.
- If edit remains separate, document why filled-field editing is not the same
  primitive as source/OCR evidence.

### Parse / Page Markdown Viewer

Components:

```txt
ParseViewer
ParseViewerProvider
ParseViewerMarkdown
PageMarkdownViewer
PageMarkdownViewerProvider
PageMarkdownViewerContent
PageMarkdownViewerToolbar
PageMarkdownPane
```

Current judgment:

```txt
keep, but isolate old scroll protocol
```

Good:

- Page markdown is a real leaf/document renderer, not a domain sidebar system.
- Parse is a thin domain wrapper over page markdown.
- Markdown/page rendering is decomposed into model, pane, scale, scroll, sync,
  toolbar, and content.

Bad:

- Page markdown still uses a `scrollRequest.version` protocol.
- It has its own current-page sync engine separate from
  `SegmentedDocumentProvider`.
- `ParseViewer` has no header, which may be fine for embedded use but makes it
  less consistent as a standalone domain viewer.

Change:

- Keep page markdown separate unless it needs segment/anchor behavior.
- If it needs document-handle navigation, replace `scrollRequest.version` with
  a registered handle pattern.

### Classifier Viewer

Components:

```txt
ClassifierViewer
ClassifierViewerProvider
ClassifierViewerHeader
ClassifierViewerDocumentState
ClassifierViewerEmptyState
```

Current judgment:

```txt
too thin to be final
```

Good:

- It is simple.
- It uses `ViewerRoot`, `ViewerHeader`, `ViewerBody`, and `ViewerSurface`.

Bad:

- It creates a local `Segment[]` and `useSegmentInteraction` just for one
  classification segment, instead of using segmented-document mechanics or
  avoiding segment primitives entirely.
- It does not render a document when classified.
- `requestDocumentStart` is an imperative escape hatch, not a viewer handle.

Change:

- Either make classify a real segmented-document consumer when it highlights a
  document, or make it a non-document result card and stop using segment
  primitives.

### Upload / Dropzone Viewer

Components:

```txt
useDropzone
FileUploader
FileIntakeViewer
FileIntakeViewerProvider
FileIntakeViewerRoot
FileIntakeViewerHeader
FileIntakeViewerSidebar
FileIntakeViewerSurface
```

Current judgment:

```txt
keep, remove render callback smell
```

Good:

- Dropzone is acquisition, not file rendering.
- `FileIntakeViewerProvider` converts selected files to `ViewerSource`.
- The composed viewer uses `ViewerRoot`, `ViewerSidebar`, and `FileViewer bare`.

Bad:

- `FileIntakeViewerSurface` accepts `renderViewer`, which is a slot-like escape
  hatch. It is useful, but it weakens the named-parts philosophy.
- `FileIntakeViewerRoot` wraps the whole viewer in a drop root, so acquisition
  hit area and viewer frame are coupled.
- It is single-file only by design, while the naming `FileIntakeViewer` could
  imply a queue.

Change:

- Prefer named parts and source access over `renderViewer`.
- Make single-file vs queue explicit in names.

### File-System Viewer

Components:

```txt
FileSystemViewerProvider
FileSystemViewerHeader
FileSystemViewerTree
file-system components
```

Current judgment:

```txt
out of scope, consumer only
```

Good:

- The desired direction is clear: file-system contains viewer.

Bad:

- This blueprint should not judge or redesign file-system internals.

Change:

- Do not touch file-system implementation as part of viewer cleanup.
- Only require that file-system consumes `ViewerRoot` and `FileViewer` through
  public APIs.

### Cross-Cutting Bad Patterns

These are the patterns I would actively remove.

```txt
1. Private second chrome systems
   ResourceDocShell is the main offender.

2. Names that lie about completeness
   PdfResourceViewer and other ResourceViewer names sound complete when they
   are content/resource renderers.

3. Generic visual mega-viewers
   SegmentedDocumentViewer should not be the primitive.

4. Old scroll replay protocols
   scrollRequest.version remains in page markdown and should not spread.

5. Two evidence interaction engines for the same visual problem
   AnchoredDocumentProvider and SegmentedDocumentProvider overlap for bbox
   evidence.

6. Slot/render callback escape hatches
   renderViewer is acceptable as an escape hatch but not as the main
   composition grammar.

7. Wrapper aliases for generic spatial primitives
   SplitViewerRoot/Body/Sidebar/Surface are useful only if they encode real
   split behavior.

8. Broad hooks next to narrow hooks
   useEmailViewer, useSplitViewer, and useEditViewer are fine internally, but
   public parts should prefer narrow hooks.

9. Domain styling inside generic surfaces
   bg-muted empty states and sidebar backgrounds often fight the neutral viewer
   frame.

10. Mixed markdown viewer vocabulary
    Pretext markdown, markdown document, and page markdown need a sharper
    naming story.
```

### Change Priority

Order matters. The cleanest sequence is:

```txt
1. Delete or demote SegmentedDocumentViewer.
2. Replace ResourceDocShell with FileViewer named parts.
3. Decide the exact FileViewer easy API: complete chrome or content-only.
4. Rename misleading resource/content viewer boundaries.
5. Extract duplicated segmented PDF/image source overlay helpers.
6. Rename FieldAnchorLink and decide anchored vs segmented source list APIs.
7. Decide whether edit fields and non-bbox sources join typed SegmentAnchor.
8. Replace page-markdown scrollRequest.version only if page markdown needs the
   shared handle pattern.
9. Compress SplitViewer spatial wrapper aliases.
10. Revisit classifier: real segmented document consumer or plain result card.
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
