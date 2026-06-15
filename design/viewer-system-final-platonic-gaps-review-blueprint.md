# Viewer System Final Platonic Gaps Review Blueprint

## Purpose

This blueprint converts the latest viewer-system review into a concrete final
cleanup plan.

The standard is not "good enough." The standard is:

```txt
Simplicity
Speed
Everything needed
Nothing more
Perfect modularization
High-entropy code
Consistent names
Flaubertian precision
shadcn-grade taste
```

The mandatory reading is
[`viewer-system-platonic-reading-blueprint.md`](./viewer-system-platonic-reading-blueprint.md).

That document is still correct. The current implementation is much closer to
it, but not fully there.

## Current Verdict

The main viewer grammar is good.

The center is right:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The recent direction is correct:

- `ViewerRoot` is the spatial primitive;
- sidebar state belongs to `ViewerRoot`;
- `FileViewer` is a file leaf renderer;
- email now exposes final named anatomy;
- split and partition share segmented-document mechanics;
- broad composed-viewer hooks are mostly gone;
- architecture tests protect many important absences.

But the system is not yet platonic.

The remaining problems are not a need for more abstraction. They are the
opposite:

- one duplicate interaction engine remains;
- some chrome still lives inside document surfaces;
- internal selector files are still shipped as public-looking registry modules;
- some architecture tests bless compromises instead of ratcheting toward the
  ideal.

## Non-Goals

Do not touch file-system.

Do not add a generic mega-viewer.

Do not add compatibility shims.

Do not preserve old APIs for migration comfort.

Do not introduce slot objects, render-prop viewers, or universal shell wrappers.

Do not make providers the product surface.

## The Final Taste Test

A new reader should understand every composed viewer from JSX alone.

Good:

```tsx
<ParseViewerProvider result={result}>
  <ViewerRoot>
    <ParseViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <SourceDocument />
      </ViewerSurface>
      <ViewerSurface>
        <ParseViewerMarkdown />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ParseViewerProvider>
```

Bad:

```tsx
<ViewerSurface>
  <SomePaneThatSecretlyRendersToolbarAndDocument />
</ViewerSurface>
```

Bad:

```tsx
const state = useSomeViewer()
```

Bad:

```tsx
<AnchoredDocumentProvider>
  <SegmentedDocumentProvider>...</SegmentedDocumentProvider>
</AnchoredDocumentProvider>
```

The ideal exposes anatomy and narrow coordination seams. It does not expose
implementation state bags.

## 1. Remove The Remaining Duplicate Interaction Engine

### Problem

`AnchoredDocumentProvider` still exists as a second document interaction engine.

It owns:

- active item;
- selected item;
- preview item;
- active anchor;
- item activation;
- item preview;
- item selection;
- target scrolling.

That overlaps with segmented-document mechanics:

- current page;
- scroll progress;
- preview segment;
- active segment;
- segment anchors;
- document handle registration;
- `scrollToPage`;
- `scrollToSegmentStart`;
- `scrollToAnchor`.

This means the system now has two concepts for the same family of behavior:

```txt
AnchoredDocumentProvider
SegmentedDocumentProvider
```

That is not Flaubertian. The concepts are too close to coexist in the final
system.

### Current Evidence

The broad anchored hook still returns a full state bag:

```ts
export function useAnchoredDocument()
```

The sources demo still has both shells:

```txt
SourcesShell
SegmentedSourcesShell
```

Some formats use segmented mechanics:

```txt
PDF
Image
```

Other formats still use anchored mechanics:

```txt
Text
CSV
XLSX
DOCX
```

Edit still depends on anchored mechanics:

```txt
EditViewerProvider -> AnchoredDocumentProvider
EditViewerProvider -> useAnchoredDocument
EditViewerProvider -> usePdfAnchoredTarget
```

### Target

One interaction engine.

The likely final center is:

```tsx
<SegmentedDocumentProvider model={model}>{children}</SegmentedDocumentProvider>
```

The shared semantic model stays:

```ts
type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}
```

Domain adapters produce models:

```ts
createSourcesSegmentedDocumentModel(...)
createSourcesSegmentedDocumentModel(...)
editResultToSegmentedDocumentModel(...)
createOcrSegmentedDocumentModel(...)
```

Domain UI consumes narrow links:

```ts
useSegmentedItemLink()
useSegmentedSourceFieldLink()
useSegmentedDocumentViewport()
```

No public hook should return the full anchored context.

### Required Design Decision

Decide whether the final primitive is:

1. `SegmentedDocumentProvider` as the only interaction engine; or
2. a renamed, smaller `EvidenceDocumentProvider` built from segmented concepts.

The default recommendation is option 1.

The reason is simple: split, partition, sources, OCR, PDF/image overlays, and
layout blocks already align around segments plus optional anchors. Introducing
another provider name would add vocabulary without adding power.

### Required Code Changes

- Convert text sources to segmented mechanics.
- Convert CSV sources to segmented mechanics.
- Convert XLSX sources to segmented mechanics.
- Convert DOCX sources to segmented mechanics.
- Convert edit viewer selection and overlays to segmented mechanics.
- Remove `AnchoredDocumentProvider` from source blocks.
- Remove `useAnchoredDocument` from source blocks.
- Remove `usePdfAnchoredTarget` from edit.
- Remove `pdf-anchor-target` from edit if no other first-class use remains.
- Delete `anchored-document-viewer` if no final use remains.

### Tests

Architecture tests should assert:

```txt
registry/new-york-v4/blocks/*sources* does not contain AnchoredDocumentProvider
registry/new-york-v4/blocks/*sources* does not contain useAnchoredDocument
components/viewers/edit does not contain AnchoredDocumentProvider
components/viewers/edit does not contain useAnchoredDocument
components/viewers/edit does not contain usePdfAnchoredTarget
```

If `anchored-document-viewer` remains, tests must prove it is not part of the
viewer system. The stricter target is deletion.

## 2. Move PageMarkdown And Parse Chrome Back To Viewer Anatomy

### Problem

`PageMarkdownViewerToolbar` exists, but `PageMarkdownPane` still renders
`PageMarkdownToolbar` internally.

That hides chrome inside the surface.

Current shape:

```tsx
<ViewerRoot>
  <ViewerBody>
    <ViewerSurface>
      <PageMarkdownViewerContent />
    </ViewerSurface>
  </ViewerBody>
</ViewerRoot>
```

But `PageMarkdownViewerContent` renders a pane, and the pane renders toolbar
chrome inside itself.

That violates the central viewer rule:

```txt
header belongs above body
surface contains document content
toolbar/header controls should be explicit anatomy
```

Parse inherits this problem because `ParseViewerMarkdown` is just
`PageMarkdownViewerContent`.

### Target

Page markdown should read as named anatomy:

```tsx
<PageMarkdownViewerProvider pages={pages}>
  <ViewerRoot>
    <PageMarkdownViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PageMarkdownViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PageMarkdownViewerProvider>
```

Parse should read as named anatomy:

```tsx
<ParseViewerProvider result={result}>
  <ViewerRoot>
    <ParseViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <ParseViewerMarkdown />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ParseViewerProvider>
```

The document pane should render only document content and loading/empty states.
It should not own toolbar chrome.

### Naming

Preferred names:

```ts
PageMarkdownViewerHeader
PageMarkdownViewerContent
ParseViewerHeader
ParseViewerMarkdown
```

If `PageMarkdownViewerToolbar` remains, it should be a private implementation
inside `PageMarkdownViewerHeader`, or a public component only if users are
expected to place it independently.

The stronger final API is:

```ts
PageMarkdownViewerHeader
```

not:

```ts
PageMarkdownViewerToolbar
```

because the viewer system vocabulary is header/body/sidebar/surface.

### Required Code Changes

- Remove toolbar rendering from `PageMarkdownPane`.
- Make `PageMarkdownPane` render only document content.
- Add or rename `PageMarkdownViewerHeader`.
- Make the default `PageMarkdownViewer` render:

```tsx
<PageMarkdownViewerHeader />
<ViewerBody>
  <ViewerSurface>
    <PageMarkdownViewerContent />
  </ViewerSurface>
</ViewerBody>
```

- Add `ParseViewerHeader`.
- Make the default `ParseViewer` render `ParseViewerHeader`.
- Update parse docs to show the header in composed examples.

### Tests

Architecture tests should assert:

```txt
PageMarkdownPane does not import PageMarkdownToolbar
PageMarkdownPane does not render PageMarkdownToolbar
PageMarkdownViewer renders PageMarkdownViewerHeader before ViewerBody
ParseViewer renders ParseViewerHeader before ViewerBody
Parse docs show ParseViewerHeader in composed examples
```

Behavior tests should still cover:

- zoom;
- fit width;
- rendered/source mode switch;
- page sync with source document;
- empty state;
- processing state.

## 3. Stop Shipping Public-Looking Internal Selector Modules

### Problem

Internal selector modules are marked `@internal`, but registry source is copied
source. If a file is shipped, exported functions in that file look available.

Current acceptable-but-not-platonic pattern:

```ts
export function useInternalPdfViewerHeader()
export function useInternalPdfViewerPages()
export function useInternalPdfViewerHeaderControls()
```

and:

```ts
export function useInternalEditViewerLayout()
export function useInternalEditViewerBusy()
export function useInternalEditViewerEmpty()
export function useInternalEditViewerHeader()
```

The names are honest, but the boundary is weak.

The final system should not require public-looking `useInternal*` exports.

### Target

First-party part selectors should be unexported whenever possible.

The best shape:

```txt
provider context + first-party parts live close enough that internal selectors
do not need exported module boundaries
```

For PDF:

```txt
PdfViewerProvider
PdfViewerHeader
PdfViewerPages
PdfViewerThumbnails
```

should not require a registry-shipped `pdf-viewer-internal-context.tsx`.

For edit:

```txt
EditViewerProvider
EditViewerHeader
EditViewerDocument
EditViewerFields
EditViewerBusyOverlay
EditViewerEmptyState
```

should not require a registry-shipped `edit-viewer-internal-context.tsx` with
public-looking internal exports.

### Acceptable Short-Term Shape

If module splitting is still needed for install packaging, keep internal files
but make the public contract stricter:

- no docs import them;
- no examples import them;
- no public entrypoint re-exports `useInternal*`;
- registry tests explicitly call this a temporary compromise.

But the final platonic target is stricter:

```txt
no shipped internal selector modules
```

### Required Code Changes

PDF options:

1. Move provider context into `pdf-viewer.tsx` and keep public re-exports there.
2. Keep `pdf-viewer-context.tsx` for public provider/thumbnails only, and move
   first-party PDF parts that need private selectors into the same module.
3. Split by public parts, not by internal state.

Edit options:

1. Collapse internal selectors into the modules that use them.
2. Move provider and public parts into a package shape where context can remain
   private without cross-file exported hooks.
3. If public hooks are needed, keep only real composition seams:

```ts
useEditViewerDocument()
useEditViewerFields()
```

Do not export:

```ts
useInternalEditViewerLayout()
useInternalEditViewerBusy()
useInternalEditViewerEmpty()
useInternalEditViewerHeader()
```

### Tests

Architecture tests should eventually assert:

```txt
registry.json does not include pdf-viewer-internal-context.tsx
registry.json does not include edit-viewer-internal-context.tsx
public/r does not include useInternalPdfViewerHeader
public/r does not include useInternalEditViewerLayout
public entrypoints do not export useInternal*
docs/examples do not import *-internal-context
```

## 4. Turn Architecture Tests From Compromise Guards Into Taste Ratchets

### Problem

Some architecture tests currently encode compromises as expected behavior.

Examples:

```txt
expect internal PDF selectors to exist
expect edit internal selectors to exist
expect sourcesViewer to contain AnchoredDocumentProvider
expect edit provider to contain AnchoredDocumentProvider
expect PageMarkdownViewerToolbar internals
```

Those tests were useful while stabilizing the migration.

They are no longer the final standard.

Tests should protect the ideal, not the last acceptable compromise.

### Target

Architecture tests should read like the platonic contract:

```txt
no broad public hooks
no duplicate interaction engines
no hidden chrome inside document surfaces
no public-looking internal selector modules
no file-system changes
no shell wrappers
no slot objects
no renderDocument
no compatibility shims
```

### Required Test Changes

Replace tests that bless compromises with tests that reject them.

For sources/edit:

```txt
sources blocks do not import anchored-document-viewer
edit viewer does not import anchored-document-viewer
edit viewer does not import pdf-anchor-target
```

For page markdown / parse:

```txt
PageMarkdownPane does not import PageMarkdownToolbar
PageMarkdownViewer has explicit header anatomy
ParseViewer has explicit header anatomy
```

For internal modules:

```txt
registry.json does not include *-internal-context
public/r does not expose useInternal*
```

Keep existing strong tests:

```txt
no ViewerShell
no ViewerSlots
no renderDocument
no broad useXViewer hooks
no public first-party part-state hooks
email uses final named anatomy
segmented document has no public aggregate hook
```

## 5. Clean Up Legacy Vocabulary In Viewer Docs And Leaf Viewers

### Problem

Some viewer docs and leaf-viewer internals still use vocabulary that conflicts
with the final system vocabulary:

```txt
Frame
legacy
compatibility
stable legacy routes
public compatibility coordinates
```

Some of these are legitimate domain words. For example, image frames are real.

But in the viewer architecture context, `Frame` and compatibility language are
dangerous because the system explicitly rejected:

```txt
ViewerFrame
ViewerShell
compatibility wrappers
legacy APIs
```

### Target

Be precise.

Allowed:

```txt
image frame
animation frame
document frame geometry
```

Suspicious:

```txt
ViewerFrame
TextViewerFrame
CsvViewerFrame
DocxViewerFrame
XlsxViewerFrame
PlainTextViewerFrame
legacy viewer
compatibility coordinates
```

The final viewer-system docs should not teach old vocabulary.

Leaf viewers can keep internal implementation names only when they describe a
real rendering unit, not a second chrome system.

### Required Review

Audit:

- `content/docs/viewers/**`;
- `components/viewers/*VIEWER_SYSTEM*.md`;
- `registry/new-york-v4/ui/*viewer-chrome.tsx`;
- `registry/new-york-v4/ui/*viewer-frame*.tsx`.

Classify each `Frame` as:

1. real rendering geometry;
2. private leaf-viewer implementation;
3. public chrome concept that should be renamed.

Only category 3 must be removed from the public system.

### Tests

Architecture tests should avoid a naive ban on `Frame`, because image/PPTX/text
rendering legitimately use frames.

Instead, reject these specific public concepts:

```txt
ViewerFrame
FileViewerFrame
EmailViewerFrame
PageMarkdownViewerFrame
ParseViewerFrame
SplitViewerFrame
PartitionViewerFrame
EditViewerFrame
ClassifierViewerFrame
```

Docs tests should reject:

```txt
legacy viewer
compatibility wrapper
ViewerShell
ViewerFrame
```

unless the document is explicitly marked as superseded historical material.

## 6. Preserve What Is Already Right

Do not destabilize good parts.

Keep:

- `ViewerRoot` as the spatial primitive;
- `ViewerSidebarTrigger` as the anywhere trigger;
- one primary sidebar per `ViewerRoot`;
- nested `ViewerRoot` for nested complete viewers;
- `FileViewer` as leaf renderer;
- email named anatomy;
- split/partition domain composition;
- segmented semantic model:

```ts
DocumentSegment
SegmentAnchor
SegmentRow
SegmentedDocumentModel
```

- narrow public hooks:

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
useSegmentedDocumentViewport()
useSegmentedDocumentModel()
useSegmentedItemLink()
```

These are real composition seams.

## Implementation Order

1. Convert page-markdown and parse chrome to explicit header anatomy.
2. Convert source blocks from anchored mechanics to segmented mechanics.
3. Convert edit viewer selection/overlay mechanics away from anchored provider.
4. Delete or fully quarantine anchored-document modules.
5. Collapse PDF/edit internal selector modules or stop shipping them as
   registry files.
6. Update architecture tests to reject the old compromises.
7. Audit viewer docs for legacy/chrome vocabulary.
8. Rebuild registry payloads.
9. Run typecheck and targeted viewer tests.

## Verification Commands

At minimum:

```bash
pnpm registry:build
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run tests/viewer-architecture.test.ts tests/segment-surfaces.test.tsx tests/parse-viewer.test.tsx tests/page-markdown-render.test.tsx tests/edit-viewer-render.test.tsx
pnpm exec eslint registry/new-york-v4/ui/viewer.tsx registry/new-york-v4/ui/segmented-document-provider.tsx components/viewers/page-markdown/page-markdown-viewer.tsx components/viewers/parse/parse-viewer.tsx components/viewers/edit/edit-viewer-provider.tsx tests/viewer-architecture.test.ts
git diff --check
```

Also run focused absence checks:

```bash
rg -n "AnchoredDocumentProvider|useAnchoredDocument|usePdfAnchoredTarget" components/viewers registry/new-york-v4/blocks
rg -n "PageMarkdownToolbar" components/viewers/page-markdown/page-markdown-pane.tsx
rg -n "internal-context|useInternal" public/r registry.json content/docs registry/new-york-v4/blocks
rg -n "ViewerShell|ViewerSlots|renderDocument|EmailViewerFrame|ViewerFrame" components/viewers registry/new-york-v4 content/docs
git diff --name-only | rg "file-system|fslight" || true
```

The first four should either return no final violations or only explicitly
accepted private implementation uses. The last command must return nothing.

## Final Acceptance Criteria

The viewer system reaches this blueprint's target when:

- `ViewerRoot` remains the only spatial primitive;
- no composed viewer exports a broad `useXViewer()` hook;
- no public hook returns a full provider context;
- sources, OCR, bbox, layout, split, partition, and edit share one document
  interaction engine;
- `AnchoredDocumentProvider` is gone from viewer code, or fully outside the
  viewer system;
- page-markdown and parse have explicit header anatomy;
- document surfaces do not secretly render viewer chrome;
- internal selector modules are not shipped as public-looking registry files;
- architecture tests reject duplicate interaction engines and hidden chrome;
- stale docs do not teach old public surfaces;
- registry payloads match source;
- file-system remains untouched.

## Final Verdict

The viewer system is close, but not finished.

The core grammar is right. The remaining work is not invention. It is deletion,
renaming, and convergence.

The platonic version is smaller than the current version:

```txt
one spatial primitive
one document interaction engine
explicit anatomy
rare hooks
private machinery
no compatibility ghosts
```

That is the shadcn-grade destination.
