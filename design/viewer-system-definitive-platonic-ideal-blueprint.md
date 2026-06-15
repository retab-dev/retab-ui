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
  mode?: "auto" | "inline" | "overlay"
  inlineBreakpoint?: number
  sidebarSide?: "left" | "right"
  sidebarCollapsible?: "offcanvas" | "none"
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
          <PartitionViewerRibbon />
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
CSV cells, XLSX cells, and DOCX targets stay on `DocumentAnchor` for now.
They should not be folded into `SegmentAnchor` until the segmented handle can
express non-page navigation without turning vague.

The ideal rule is:

```txt
SegmentedDocumentModel owns semantic document spans and page-local anchors.
Non-page targets need a first-class typed anchor, not a metadata bag.
```

Do not pollute `SegmentAnchor` with vague fields such as:

```ts
metadata?: Record<string, unknown>
```

If non-bbox targets converge later, they must do it through a typed union:

```ts
type SegmentAnchor =
  | PageAreaSegmentAnchor
  | TextRangeSegmentAnchor
  | CsvCellSegmentAnchor
  | XlsxCellSegmentAnchor
  | DocxTargetSegmentAnchor
```

Until then, keeping non-bbox anchored flows separate is cleaner than making the
segmented primitive vague. The implementation should keep
`sourceToSegmentAnchor` null for text, CSV, XLSX, and DOCX sources.

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
- `ViewerRoot` defaults to `mode="auto"` and resolves inline/overlay from the
  measured root width.
- `sidebarCollapsible` is deliberately only `"offcanvas" | "none"`; no icon
  rail belongs in the primitive until there is real product evidence.
- `bare` on `ViewerRoot` removes frame and background styling. Product
  compositions that need a background must opt in with `className`.

Bad:

- None in the spatial primitive contract. Remaining risk is visual tuning in
  domain compositions that now inherit `mode="auto"`.

Change:

- Keep `mode="auto"` as the default.
- Keep icon collapse out of `ViewerRoot`.
- Keep `bare` as no frame and no opinionated background.

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
useFileViewerHeader
useFileViewerContent
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
- The easy API and composed API share the same provider.
- The easy API now renders complete file chrome when `bare` is false.
- `useFileViewer` exposes only the public file state, while
  `useFileViewerHeader` and `useFileViewerContent` expose narrow part-specific
  slices.

Bad:

- `FileViewerContentProps` only accepts `bare` and `className`; content-level
  control is narrow, but not yet a complete named-parts API.
- Lazy route names now use `*ResourceContent`, which makes the resource-first
  content boundary explicit.

Change:

- Keep `<FileViewer source />` as the complete file viewer.
- Keep `<FileViewer source bare />` as the nested/content form.
- Keep resource-first renderers on `*ResourceContent` names.

### ResourceDocShell

Components:

```txt
ZoomActions
ViewerFallback
UnsupportedCard
```

Current judgment:

```txt
removed
```

Good:

- Its useful behavior was folded into the file-viewer named-parts grammar.
- CSV, HTML, and fallback states no longer carry a private file header.

Bad:

- `ZoomActions` still lives in `file-viewer-chrome.tsx`; that is acceptable as
  action chrome, but it should not grow into another shell.

Change:

- Keep `ResourceDocShell` deleted.
- Keep file identity, download, and outer frame in `FileViewerHeader` /
  `ViewerRoot`, not in leaf renderers.

### PDF Viewer

Components:

```txt
PdfViewer
PdfViewerProvider
PdfViewerHeader
PdfViewerPages
PdfResourceContent
PdfViewerThumbnails
PdfThumbnailRail
PdfHighlight
PdfViewerContext hooks
```

Current judgment:

```txt
keep, boundary renamed
```

Good:

- PDF has the best decomposed shape: provider, header, pages, thumbnails,
  resource loading, page metrics, and document handle.
- `PdfViewerThumbnails` is properly sidebar-agnostic.
- `PdfViewerPages` can be embedded inside other viewers and can register a
  handle with segmented-document mechanics.

Bad:

- `PdfViewerPages` delegates back through `PdfResourceContent`; the name is now
  accurate, but the call path still deserves a second look later.
- `PdfViewer` owns a `ViewerRoot`, which is correct for the easy API, but users
  need very clear guidance that `PdfViewerPages` is the content part.

Change:

- Keep `PdfResourceContent` as the resource-first content boundary.
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
- It has an explicit `thumbnailShape: "page" | "square"` contract, so square
  thumbnails are a named rail mode rather than caller CSS.

Bad:

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
HtmlFileContent
CsvFileContent
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
- CSV and HTML file-route adapters are named `CsvFileContent` and
  `HtmlFileContent`, so content-only adapters no longer use `*DocViewer`.

Bad:

- Some leaf viewers include chrome; some are true content renderers.
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
- `FileThumbnail` and `FileThumbnailFrame` expose named
  `thumbnailShape` / `thumbnailSize` tokens for common sidebar geometry while
  preserving `className`, `style`, and `previewAspectRatio` for unusual cases.

Bad:

- Some older consumers still use raw `previewAspectRatio` and dimension classes
  directly.
- PDF rail remains intentionally separate because page-rail virtualization has
  different sizing inputs.

Change:

- Keep `FileThumbnail` independent.
- Prefer `thumbnailShape` and `thumbnailSize` in viewer-system sidebars.

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
- `SegmentedDocumentModel.segments` is documented as the
  viewport/navigation projection.
- `SegmentRow` is documented as generic display grouping only, with
  vote/output semantics kept outside the generic model.

Bad:

- `SegmentLegend`, `SegmentPageRail`, `SegmentSidebar`, and `PageRibbon` still
  use older `Segment` language rather than consistently saying
  `DocumentSegment`.

Change:

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
removed from the UI registry
```

Good:

- It proved sidebar, legend, timeline, and PDF preview could be synchronized.

Bad:

- It was exactly the shape the final architecture rejects: a generic visual
  segmented viewer.
- It owns its own `currentPage`, `useSegmentInteraction`, and DOM
  `querySelector` scroll path instead of using `SegmentedDocumentProvider` and a
  registered document handle.
- It composes `SegmentSidebar`, `SegmentLegend`, `PageTimeline`, and
  `PdfViewer` internally, so users cannot see a domain-owned layout.

Change:

- Keep it out of the core UI registry.
- Do not let it become the recommended primitive.

### Email Viewer

Components:

```txt
EmailViewer
EmailViewerProvider
EmailViewerFrame
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
- `EmailViewerFrame` exports the same named-part composition the easy API uses.
- The sidebar is sectioned into body/attachments instead of raw MIME noise by
  default.
- Attachments render through `FileViewer bare`.
- Inline resources are scoped and resolved outside leaf HTML rendering.

Bad:

- `useEmailViewer` exposes the full context even though narrow hooks exist.
- Nested messages recursively create nested `ViewerRoot`s. That may be right,
  but it is visually and conceptually heavy.

Change:

- Keep `EmailViewerFrame` as the exported preassembled named-part composition.
- Keep `EmailHeader` configurable through `trailing`; the default trigger is a
  convenience, not a fixed header contract.
- Decide whether nested messages should be nested full viewers or nested email
  content.

### Split Viewer

Components:

```txt
SplitViewer
SplitViewerProvider
SplitViewerHeader
SplitViewerSidebar
SplitViewerPageRail
SplitViewerLegend
SplitViewerDocument
SplitViewerEmptyState
```

Current judgment:

```txt
keep, with semantic parts only
```

Good:

- Split uses `SegmentedDocumentProvider`.
- Split has narrow hooks for header, rail, legend, and document.
- Page rail and legend share the same viewport mechanics.
- It no longer owns a custom scroll replay protocol.
- `SplitViewerRoot`, `SplitViewerBody`, and `SplitViewerSurface` have been
  removed; the easy API composes `ViewerRoot`, `ViewerBody`, and
  `ViewerSurface` directly.
- `SplitViewerSidebar` remains because it owns split-specific rail visibility
  and default rail content.
- `SplitViewer` and `SplitViewerDocument` use an explicit `document` prop for
  caller-owned source rendering.

Bad:

- None in the split composition boundary. Remaining quality work is visual and
  document-source integration in examples.

Change:

- Keep semantic parts: header, page rail, legend, document, empty state.
- Do not reintroduce pure spatial aliases for `ViewerRoot`, `ViewerBody`, or
  `ViewerSurface`.
- Keep empty states background-neutral unless a domain component explicitly
  needs a filled state surface.
- Keep selected source/document rendering explicit through `document`.

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
- `PartitionViewer` and `PartitionViewerDocument` accept an explicit
  `document` node for caller-owned source rendering.
- `PartitionViewerRibbon` is an independently composed named part inside the
  surface, not hidden in the header.

Bad:

- `createPartitionSegmentedDocumentModel` passes `ribbonRows` into generic
  `rows`, which is acceptable only if those rows remain generic. Partition
  votes are already domain-specific.

Change:

- Keep selected source/document rendering explicit through `document`.
- Keep vote/output semantics in partition model, not generic
  `SegmentedDocumentModel`.
- Keep ribbon as its own named part.

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
- `useSegmentedItemLink` owns selected item, preview item, active segment,
  active anchors, and anchor/segment-start navigation for both OCR/layout and
  source-field adapters.

Bad:

- Overlay generation filters visible items per page inside the render callback.
- Header, filter controls, document, sidebar, and provider wiring live in one
  large component.

Change:

- Keep `useSegmentedItemLink` generic: item ids, selected/preview state,
  active anchors, and navigation only. Do not add source, OCR, or visual
  concepts to it.
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
SourceFieldLink
useAnchoredSourceFieldLink
useSegmentedItemLink
useSegmentedSourceFieldLink
source-segmented-document-model
InteractiveItemList
AnchoredDocumentProvider
```

Current judgment:

```txt
renamed; provider convergence still open
```

Good:

- Bbox-backed PDF/image source examples now use `SegmentedDocumentProvider`.
- Non-bbox source examples still have a working anchored path.
- `source-segmented-document-model` refuses to fake CSV/XLSX/DOCX/text targets
  as page anchors.
- Source field linking now uses the neutral `SourceFieldLink` name.
- `SourceFieldList` now renders through the neutral `InteractiveItemList`
  primitive, so segmented source consumers no longer depend on an
  anchored registry item.
- `useSegmentedSourceFieldLink` exposes all active anchors for the active
  segment while keeping `activeAnchor` as the primary navigation target.
- `useSegmentedSourceFieldLink` is now a source-name adapter over
  `useSegmentedItemLink`; it no longer owns segment/anchor lookup itself.
- PDF and image segmented source overlays render every active page-local
  anchor for the selected field.

Bad:

- `AnchoredDocumentProvider` and `SegmentedDocumentProvider` now overlap for
  bbox cases, so readers must learn two interaction systems.

Change:

- Keep non-bbox targets on the typed `DocumentAnchor` path until a non-page
  segmented handle exists.

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
- PDF/image segmented overlays and document-handle bridges now live in
  `source-segmented-document-overlays`.

Bad:

- Mixed extraction has two interaction systems: segmented for PDF/image,
  anchored for text/CSV/XLSX/DOCX.
- The same `SourceFieldList` component has to straddle both systems.

Change:

- Keep shared segmented PDF/image source overlay helpers in
  `source-segmented-document-overlays`.
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
keep, with handle-based document sync
```

Good:

- Page markdown is a real leaf/document renderer, not a domain sidebar system.
- Parse is a thin domain wrapper over page markdown.
- Markdown/page rendering is decomposed into model, pane, scale, scroll, sync,
  toolbar, and content.
- Page markdown document sync uses a registered document handle instead of a
  `scrollRequest.version` replay protocol.

Bad:

- It has its own current-page sync engine separate from
  `SegmentedDocumentProvider`.
- `ParseViewer` has no header, which may be fine for embedded use but makes it
  less consistent as a standalone domain viewer.

Change:

- Keep page markdown separate unless it needs segment/anchor behavior.
- Keep its document sync handle narrow: `scrollToPage` only.

### Classifier Viewer

Components:

```txt
ClassifierViewer
ClassifierViewerProvider
ClassifierViewerHeader
ClassifierViewerDocument
ClassifierViewerEmptyState
```

Current judgment:

```txt
plain result viewer
```

Good:

- It is simple.
- It uses `ViewerRoot`, `ViewerHeader`, `ViewerBody`, and `ViewerSurface`.
- It no longer creates a fake `Segment[]` or local segment interaction state
  just to render one category.
- `ClassifierViewer` and `ClassifierViewerDocument` accept an explicit
  `document` node for caller-owned source rendering.

Bad:

- None in the classifier composition boundary.

Change:

- Keep classify off segmented-document mechanics until it has real page spans
  or anchors.
- Keep selected source/document rendering explicit through `document`.

### Upload / Dropzone Viewer

Components:

```txt
useDropzone
FileUploader
FileIntakeViewer
FileIntakeViewerProvider
FileIntakeViewerDropTarget
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
- `FileIntakeViewerDropTarget` owns the drop root and hidden input.
- `FileIntakeViewerRoot` owns only viewer frame/chrome.
- The composed viewer uses `ViewerRoot`, `ViewerSidebar`, and `FileViewer bare`.

Bad:

- It is single-file only by design, while the naming `FileIntakeViewer` could
  imply a queue.

Change:

- Keep custom rendering on composed parts via `useFileIntakeViewerSurface`
  rather than a `renderViewer` callback on the easy API.
- Keep browser acquisition in `FileIntakeViewerDropTarget`, not
  `FileIntakeViewerRoot`.
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
   ResourceDocShell has been removed. Do not recreate it under another name.

2. Names that lie about completeness
   The public `*ResourceViewer` names have been cut over to
   `*ResourceContent`. Do not reintroduce `*ResourceViewer` for content-only
   renderers.

3. Generic visual mega-viewers
   SegmentedDocumentViewer has been removed from the UI registry. Do not
   recreate it as the primitive.

4. Old scroll replay protocols
   Removed from page markdown; do not reintroduce effect-replayed scroll
   request state.

5. Two evidence interaction engines for the same visual problem
   AnchoredDocumentProvider and SegmentedDocumentProvider overlap for bbox
   evidence.

6. Slot/render callback escape hatches
   FileIntakeViewer no longer exposes renderViewer on the easy API. Custom
   rendering should come from provider + named parts + narrow hooks.

7. Wrapper aliases for generic spatial primitives
   SplitViewerRoot, SplitViewerBody, and SplitViewerSurface have been removed.
   SplitViewerSidebar remains because it encodes split behavior: hide when no
   output exists and provide the page rail by default.

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
1. Rename misleading resource/content viewer boundaries.
2. Decide anchored vs segmented source list APIs.
3. Keep edit fields and non-bbox sources out of `SegmentAnchor` unless a typed
   non-page segmented handle is designed.
4. Compress SplitViewer spatial wrapper aliases.
5. Revisit classifier: real segmented document consumer or plain result card.
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
Provider that owns both layout and selected domain item
```

```txt
One component that is sometimes a complete viewer and sometimes content-only
```

## What Is Still Not Perfect

Even with the correct architecture, the system is not perfect until these are
gone:

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
