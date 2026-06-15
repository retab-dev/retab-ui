# Viewer System Platonic Reading Blueprint

## Purpose

This is the document to read before judging or changing the viewer system.

The target is not maximum configurability. The target is taste:

```txt
Simplicity
Speed
Everything needed
Nothing more
Perfect modularization
High-entropy code
Perfectly consistent names
Flaubertian precision
shadcn-grade composition
```

The system is good only when the JSX explains the product and the implementation
does not ask users to learn private machinery.

## Current Verdict

The direction is right.

The viewer system now has the correct center:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

That is the primitive grammar.

The good parts:

- `ViewerRoot` owns spatial chrome and sidebar state.
- `ViewerSidebarTrigger` can be placed anywhere inside the nearest
  `ViewerRoot`, like shadcn sidebar triggers.
- `FileViewer` is moving toward a file leaf renderer, not a competing layout
  system.
- Email, split, partition, edit, parse, page markdown, PDF thumbnails, and
  dropzone now mostly read as named compositions.
- Split and partition are converging around shared segmented-document mechanics
  instead of a generic mega-viewer.
- Public broad viewer hooks have mostly been replaced by narrow hooks or private
  part selectors.

But the system is not platonic yet.

The remaining work is subtraction and naming precision, not another layer of
abstraction.

## Non-Negotiables

Do not touch file-system work while tightening this system. It has its own owner
and its own boundary.

Do not add a universal `ViewerShell`.

Do not add a generic `SegmentedViewer`.

Do not preserve compatibility paths for old abstractions.

Do not expose full context values.

Do not ship files named `*-internal-context`.

Do not let tests encode compromises as desirable architecture.

## The Center

`ViewerRoot` is the spatial primitive.

It owns:

- root containment;
- header placement;
- body layout;
- one primary sidebar;
- sidebar open state;
- sidebar trigger state;
- inline and overlay sidebar behavior;
- surface containment.

It does not own:

- files;
- MIME parts;
- upload queues;
- PDF pages;
- thumbnails;
- split segments;
- partition votes;
- OCR boxes;
- extraction sources;
- edit fields;
- file-system trees.

Those belong to composed viewers and domain models.

## Viewer Versus FileViewer

The boundary is:

```txt
Viewer     = spatial chrome primitive
FileViewer = file leaf renderer
```

`ViewerRoot` answers:

```txt
where does the header live?
where does the sidebar live?
where does the surface live?
which sidebar does this trigger control?
```

`FileViewer` answers:

```txt
given a file source, which renderer displays it?
```

The ideal composed file viewer is boring:

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

The convenience component can remain:

```tsx
<FileViewer source={source} />
```

But it must be a wrapper around the same anatomy, not a second philosophy.

## Provider Law

Providers are machinery. Components are the product surface.

A provider is justified when independently placed parts need shared behavior:

- a header button toggles a sidebar;
- a thumbnail rail controls a document;
- a legend previews a document segment;
- a document surface reports current page;
- a custom part needs a narrow control channel.

A provider is not justified just because a component has multiple parts.

The public mental model must stay:

```txt
compose parts
pass data at the boundary
use narrow hooks only when placement crosses component boundaries
```

It must not become:

```txt
mount provider
pull full state
rebuild internal UI from the state bag
```

That is the line shadcn usually gets right.

## Hook Law

Public hooks are rare.

Good public hooks are narrow and named by the capability they expose:

```ts
useViewerSidebar()
useOptionalViewerSidebar()
usePdfViewerThumbnails()
useSplitViewerDocumentControls()
usePartitionViewerDocumentControls()
useParseViewerDocument()
usePageMarkdownViewerDocument()
useEditViewerDocument()
useEditViewerFields()
```

These hooks exist because external composition needs coordination.

Bad public hooks mirror private implementation:

```ts
useEmailViewer()
useSplitViewer()
usePartitionViewer()
useClassifierViewer()
useParseViewer()
usePageMarkdownViewer()
useEditViewer()
useFileViewer()
usePdfViewer()
useXViewerHeader()
useXViewerSidebar()
useXViewerBusy()
useXViewerEmpty()
```

The rule is strict:

```txt
if the hook exists only so the library's own named part can render, it is private
```

Private part selectors are fine:

```ts
function useSplitViewerHeader()
function usePartitionViewerHeader()
function usePageMarkdownViewerHeader()
function useClassifierViewerHeader()
```

They are not public API.

## Context Law

No public aggregate viewer state.

This is the core invariant:

```txt
public anatomy is allowed
public narrow coordination hooks are allowed
public input model types are allowed
public aggregate state bags are not allowed
```

This shape is not platonic:

```ts
type XViewerContextValue = { ...everything }
export function useXViewer(): XViewerContextValue
```

Even if the implementation needs that context internally, consumers should not
see it.

## Registry Law

The registry is the public product.

Registry payloads should not ship files that look private:

```txt
pdf-viewer-internal-context.tsx
edit-viewer-internal-context.tsx
```

If an installed component needs internal selectors, those selectors should live
inside the installed public module or inside a small non-exported local helper
that is not advertised as a conceptual dependency.

Acceptable:

```txt
pdf-viewer.tsx
pdf-viewer-context.tsx
pdf-viewer-thumbnails.tsx
```

Not acceptable:

```txt
pdf-viewer-internal-context.tsx
edit-viewer-internal-context.tsx
```

The file name teaches users what the library thinks matters. A public package
should not teach internal context as a concept.

## Segmented Document Law

Split, partition, sources, OCR, bboxes, and edit share mechanics. They do not
share taste.

The shared primitive is not a generic visual viewer. It is a document
interaction model:

```ts
type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}

type DocumentSegment = {
  id: string
  label: string
  color: string
  pages: number[]
  sourceId?: string
}

type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}

type SegmentRow = {
  id: string
  label?: string
  segments: DocumentSegment[]
}
```

The key distinction:

```txt
semantic segment != page-local anchor
```

Split and partition mostly work with semantic segments:

```ts
{
  id: "appendix",
  label: "Appendix",
  pages: [13, 14, 15],
  color: "blue",
}
```

Sources, OCR, bboxes, and edit fields need page-local anchors:

```ts
{
  id: "invoice-total-anchor",
  segmentId: "invoice-total",
  pageNumber: 2,
  bounds: { left: 62, top: 71, width: 18, height: 4 },
}
```

The provider owns mechanics:

- current page;
- scroll progress;
- active segment;
- selected segment;
- preview segment;
- registered document handle;
- `scrollToPage`;
- `scrollToSegmentStart`;
- `scrollToAnchor`.

It does not own:

- split jobs;
- partition consensus;
- OCR text;
- extraction schemas;
- edit modes;
- files;
- workflow runs;
- MIME parts.

Those are adapters.

## The Duplicate Engine Problem

The remaining non-platonic concept is `AnchoredDocumentProvider`.

It overlaps with segmented-document state:

```txt
active item       -> active segment
selected item     -> selected segment
preview item      -> preview segment
item anchor       -> segment anchor
target scrolling  -> registered document handle
```

The final system should have one interaction engine.

The default final answer:

```txt
SegmentedDocumentProvider replaces AnchoredDocumentProvider
```

After the migration, no reusable viewer block should import:

```txt
AnchoredDocumentProvider
useAnchoredDocument
useAnchoredSourceFieldLink
usePdfAnchoredTarget
anchored-document-viewer
pdf-anchor-target
```

If an evidence helper still needs a neutral anchor data type, keep the data type.
Do not keep a second provider.

## Domain Viewer Law

Domain viewers are thin named compositions.

They contain:

- model creation;
- provider wiring;
- named parts;
- loading, empty, and error states;
- domain labels;
- domain visual order.

They do not contain:

- private layout primitives;
- duplicate sidebar systems;
- duplicate viewport engines;
- broad public hooks;
- one-off scroll protocols;
- domain leakage into `ViewerRoot`.

## Ideal Shapes

### Email

Email is a MIME composition, but it should still read as viewer anatomy:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
    <EmailViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EmailViewerContent />
      </ViewerSurface>
      <ViewerSidebar aria-label="Email parts">
        <EmailViewerPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

Attachments can render nested `FileViewer` instances because they are complete
file leaf viewers.

### PDF With Thumbnails

The thumbnail rail is sidebar content. The PDF viewer owns document rendering.

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot defaultOpen>
    <PdfViewerHeader />
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

No special `PdfThumbnailViewer` primitive is needed.

### Split

Split is a domain composition over segmented-document mechanics:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot defaultOpen>
    <SplitViewerHeader />
    <ViewerBody>
      <SplitViewerSidebar />
      <ViewerSurface>
        <SplitViewerDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Split-specific code should be mostly:

```ts
createSplitSegmentedDocumentModel(result)
```

### Partition

Partition shares mechanics with split, but keeps its own visual taste:

```tsx
<PartitionViewerProvider result={result}>
  <ViewerRoot>
    <PartitionViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PartitionViewerDocument />
        <PartitionViewerRibbon />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PartitionViewerProvider>
```

The model should make projections explicit:

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  viewportSegments: DocumentSegment[]
  legendSegments: DocumentSegment[]
  ribbonRows: PartitionRibbonRow[]
}
```

`viewportSegments` means the semantic segments used for page ownership and
navigation. It must not be implied by `legendSegments`.

### Sources And OCR

Sources and OCR are almost the same mechanically:

```txt
fields/text/items -> semantic segments
boxes/ranges/cells -> anchors
```

The final viewer should not have a separate source interaction engine.

Format-specific adapters are acceptable:

```ts
sourceToPdfArea()
sourceToImageArea()
sourceToTextHighlight()
sourceToCsvCell()
sourceToXlsxCell()
sourceToDocxHighlight()
```

But interaction should stay shared:

```ts
useSegmentedSourceFieldLink()
useSegmentedItemLink()
useSegmentedDocumentViewport()
```

### Edit

Edit fields are segments with optional anchors.

The ideal provider wiring is:

```tsx
<SegmentedDocumentProvider model={createEditViewerSegmentedDocumentModel(fields)}>
  <EditViewerProviderInternal>
    {children}
  </EditViewerProviderInternal>
</SegmentedDocumentProvider>
```

The public surface remains:

```tsx
<EditViewerProvider result={result}>
  <ViewerRoot>
    <EditViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EditViewerDocument />
      </ViewerSurface>
      <ViewerSidebar aria-label="Document fields">
        <EditViewerFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EditViewerProvider>
```

Public hooks should stay narrow:

```ts
useEditViewerDocument()
useEditViewerFields()
```

No `useEditViewer()` full context.

### Parse And Page Markdown

Parse and page markdown must expose chrome explicitly.

Correct:

```tsx
<ParseViewerProvider result={result}>
  <ViewerRoot>
    <ParseViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <ParseViewerSource />
      </ViewerSurface>
      <ViewerSurface>
        <PageMarkdownPane />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ParseViewerProvider>
```

Incorrect:

```tsx
<ViewerSurface>
  <PageMarkdownPaneThatSecretlyRendersToolbar />
</ViewerSurface>
```

Document content panes must not render viewer chrome.

### Dropzone

Dropzone is not a viewer primitive. It is an intake composition.

The right shape is:

```tsx
<FileIntakeViewerProvider files={files}>
  <FileIntakeViewerRoot>
    <FileIntakeViewerHeader />
    <ViewerBody>
      <FileIntakeViewerSidebar />
      <FileIntakeViewerSurface />
    </ViewerBody>
  </FileIntakeViewerRoot>
</FileIntakeViewerProvider>
```

The only public hook should be the one needed for custom surface composition:

```ts
useFileIntakeViewerSurface()
```

Header and sidebar selectors should remain private.

## Current Gaps To Remove

### 1. Anchored Mechanics

Current evidence still includes:

```txt
anchored-document-viewer
pdf-anchor-target
anchored-evidence
source-evidence.anchoredItems
layout-blocks-model.anchoredItems
```

Final target:

```txt
no viewer block imports anchored-document-viewer
no edit code imports pdf-anchor-target
no source block imports useAnchoredDocument
no registry item advertises anchored-document-viewer
no public payload asks users to install pdf-anchor-target
```

### 2. Internal Context Modules

Current evidence still includes:

```txt
registry/new-york-v4/ui/pdf-viewer-internal-context.tsx
components/ui/pdf-viewer-internal-context.tsx
components/viewers/edit/edit-viewer-internal-context.tsx
```

Final target:

```txt
no registry entry includes *-internal-context
no public/r payload includes *-internal-context
no docs/example imports *-internal-context
```

Implementation selectors can exist, but they should not be packaged as named
public files.

### 3. Hidden Chrome In Leaf Content

Any content component that can be placed inside `ViewerSurface` should render
content only.

Final target:

```txt
PageMarkdownPane renders document content only
PdfViewerPages renders document pages only
FileViewerContent renders file content only
headers own toolbars
surfaces own document content
```

### 4. Broad Hook Drift

The broad-hook pattern must stay gone.

Final target:

```txt
no export function useEmailViewer
no export function useSplitViewer
no export function usePartitionViewer
no export function useParseViewer
no export function usePageMarkdownViewer
no export function useEditViewer
```

Narrow hooks are allowed only when they are part of a real composition contract.

### 5. Stale Docs

Several older blueprints still teach previous decisions, especially around
`AnchoredDocumentProvider`.

Final target:

```txt
current docs teach ViewerRoot + SegmentedDocumentProvider
old anchored-provider docs are archived, renamed, or explicitly marked obsolete
component docs show explicit headers
registry examples match the platonic anatomy
```

### 6. Architecture Tests Blessing Compromises

Architecture tests should reject the old shape, not preserve it.

Final target:

```txt
tests fail if source/edit code imports anchored-document-viewer
tests fail if public registry payloads include *-internal-context
tests fail if PageMarkdownPane imports PageMarkdownToolbar
tests fail if parse/page-markdown omit explicit headers
tests fail if composed viewers export full context hooks
```

## Naming Contract

Use the same name for the same idea everywhere.

Preferred vocabulary:

```txt
ViewerRoot          spatial container
ViewerHeader        top chrome
ViewerBody          flex body under header
ViewerSidebar       primary sidebar
ViewerSurface       document/content region
ViewerSidebarTrigger nearest ViewerRoot sidebar trigger

Segment             semantic document unit
Anchor              page-local target for a segment
DocumentHandle      registered imperative document target
SourceFieldLink     field-to-document interaction adapter
```

Avoid mixed vocabulary:

```txt
item vs segment
anchor item vs segment anchor
target vs handle
pane vs surface when it means ViewerSurface
shell vs root
toolbar inside content
internal context as public module
```

Names should make illegal states feel strange.

## Implementation Order

1. Freeze the file-system boundary.
2. Finish the segmented-document cutover for all source/edit interactions.
3. Remove registry exposure for anchored mechanics.
4. Fold `*-internal-context` files into public modules or private local helpers.
5. Make page markdown, parse, PDF, and file viewer chrome explicit in all docs
   and registry examples.
6. Tighten public exports to named anatomy plus narrow hooks only.
7. Rewrite architecture tests so they reject broad hooks, hidden chrome,
   duplicate engines, and internal registry files.
8. Regenerate registry payloads.
9. Run focused tests, then the architecture suite.

## Acceptance Checks

The system is close only when these checks pass:

```bash
rg -n "AnchoredDocumentProvider|useAnchoredDocument|usePdfAnchoredTarget|useAnchoredSourceFieldLink" \
  components/viewers registry/new-york-v4/blocks registry/new-york-v4/ui public/r
```

Expected result: no reusable viewer code or public payload matches.

```bash
rg -n "internal-context|useInternalPdfViewer|useInternalEditViewer" \
  registry.json public/r content/docs
```

Expected result: no registry or docs matches.

```bash
rg -n "export function use(Email|Split|Partition|Parse|PageMarkdown|Edit|File|Pdf)Viewer\\b" \
  components registry/new-york-v4
```

Expected result: no broad full-context hooks.

```bash
rg -n "PageMarkdownToolbar" components/viewers/page-markdown/page-markdown-pane.tsx
```

Expected result: no match.

```bash
pnpm exec vitest run tests/viewer-architecture.test.ts
```

Expected result: architecture ratchets pass.

## Final Definition

The viewer system reaches the platonic target when:

- a user can compose every major viewer by reading JSX anatomy;
- providers coordinate behavior but do not become the public mental model;
- there is one document interaction engine for segments and anchors;
- `ViewerRoot` owns spatial behavior and nothing domain-specific;
- `FileViewer` renders files and does not compete with `ViewerRoot`;
- domain viewers are thin named compositions over models and primitives;
- registry payloads ship only public concepts;
- tests reject the old architecture;
- no component exposes more API than its natural composition requires.

The ideal is not bigger.

The ideal is fewer concepts, placed exactly.
