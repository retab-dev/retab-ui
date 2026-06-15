# Viewer System Platonic Ratchet Blueprint

## Purpose

This blueprint is the next ratchet for the viewer system.

The standard is still:

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

The current architecture is close enough that the remaining work is mostly
subtraction. Do not add a broader abstraction to fix a boundary problem. Make
the boundaries sharper.

## Verdict

The viewer system is directionally right.

The center is still:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

That shape should remain the public grammar.

The remaining non-platonic parts are:

1. source evidence still has an old anchored interaction engine;
2. edit still uses that anchored engine even though it is a segmented PDF
   evidence viewer;
3. page markdown and parse source code now expose explicit headers, but tests
   and registry payloads still describe the old toolbar shape;
4. PDF and edit still ship internal selector modules as registry files;
5. architecture tests still preserve some compromises instead of rejecting
   them.

None of these require a new mega-provider.

## Non-Goals

Do not touch file-system.

Do not touch fslight.

Do not add:

```txt
ViewerShell
ViewerSlots
ViewerProvider
ViewerSidebarProvider
FileViewerProvider as a spatial root
SegmentedViewer
renderDocument
slots={{ ... }}
```

Do not add compatibility wrappers.

Do not preserve old APIs for migration comfort.

Do not make the provider the product surface.

## The Final Public Shape

Viewer anatomy stays public:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

Domain viewers are named compositions:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
    <EmailViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EmailViewerContent />
      </ViewerSurface>
      <ViewerSidebar>
        <EmailViewerPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

Document interaction mechanics stay narrow:

```tsx
<SegmentedDocumentProvider model={model}>
  {children}
</SegmentedDocumentProvider>
```

Public hooks are scarce:

```ts
useViewerSidebar()
useOptionalViewerSidebar()
usePdfViewerThumbnails()
useParseViewerDocument()
usePageMarkdownViewerDocument()
useEditViewerDocument()
useEditViewerFields()
useSegmentedDocumentViewport()
useSegmentedDocumentModel()
```

Public hooks must not be aggregate state mirrors:

```ts
useEmailViewer()
useSplitViewer()
usePartitionViewer()
useParseViewer()
usePageMarkdownViewer()
useEditViewer()
useFileViewer()
useXViewerHeader()
useXViewerSidebar()
```

## Current Source Facts

### Page Markdown And Parse

Source has already moved in the correct direction:

```txt
components/viewers/page-markdown/page-markdown-viewer.tsx
  exports PageMarkdownViewerHeader
  renders PageMarkdownViewerHeader before ViewerBody

components/viewers/page-markdown/page-markdown-pane.tsx
  no longer imports PageMarkdownToolbar

components/viewers/parse/parse-viewer.tsx
  exports ParseViewerHeader
  renders ParseViewerHeader before ViewerBody

content/docs/viewers/parse-viewer.mdx
  shows ParseViewerHeader in composition
```

But the system is not consistent yet:

```txt
tests/viewer-architecture.test.ts
  still expects usePageMarkdownViewerToolbar
  still expects PageMarkdownViewerToolbar

public/r/parse-viewer-block.json
  still embeds the old page-markdown content shape
  still embeds PageMarkdownViewerToolbar
  still shows PageMarkdownViewer without explicit header anatomy
```

The source code is ahead of the contract. The tests and registry need to catch
up.

### Source Evidence

Source evidence is split between two interaction systems.

Segmented path:

```txt
registry/new-york-v4/blocks/extract-viewer-block.tsx
registry/new-york-v4/blocks/json-form-sources-block.tsx
registry/new-york-v4/blocks/image-sources-block.tsx
registry/new-york-v4/ui/source-segmented-document-model.ts
registry/new-york-v4/ui/source-segmented-document-overlays.tsx
registry/new-york-v4/ui/segmented-document-provider.tsx
registry/new-york-v4/ui/segmented-item-link.ts
```

Anchored path:

```txt
registry/new-york-v4/blocks/sources-viewer-block.tsx
registry/new-york-v4/blocks/text-sources-block.tsx
registry/new-york-v4/blocks/csv-sources-block.tsx
registry/new-york-v4/blocks/xlsx-sources-block.tsx
registry/new-york-v4/blocks/docx-sources-block.tsx
registry/new-york-v4/ui/anchored-document-viewer.tsx
registry/new-york-v4/ui/pdf-anchor-target.tsx
registry/new-york-v4/ui/source-field-link.ts
components/ui/anchored-document-viewer.tsx
components/ui/pdf-anchor-target.tsx
```

This is the biggest remaining conceptual impurity.

### Edit

Edit still depends on anchored mechanics:

```txt
components/viewers/edit/edit-viewer-provider.tsx
  AnchoredDocumentProvider
  useAnchoredDocument
  usePdfAnchoredTarget
```

Edit should not need a second evidence engine. It is a PDF document plus
fields. That is exactly:

```txt
DocumentSegment = semantic field
SegmentAnchor   = page-local field box
SegmentedDocumentProvider = hover, selection, preview, navigation
```

Edit should become a segmented-document composition.

### Internal Selector Modules

PDF and edit still ship files that look public because registry users copy
source files:

```txt
registry/new-york-v4/ui/pdf-viewer-internal-context.tsx
components/viewers/edit/edit-viewer-internal-context.tsx
```

They export names such as:

```ts
useInternalPdfViewerHeader()
useInternalPdfViewerPages()
useInternalPdfViewerHeaderControls()
useInternalEditViewerLayout()
useInternalEditViewerBusy()
useInternalEditViewerEmpty()
useInternalEditViewerHeader()
```

The word `Internal` is honest but not enough. A shipped exported hook is still
read as API.

## Data Model Decision

Do not pollute `SegmentAnchor`.

The current segmented model has the right semantic split:

```ts
type DocumentSegment = {
  id: string
  label: string
  pages: number[]
  color: string
  sourceId?: string
}

type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}
```

Keep `SegmentAnchor` page-local.

Do not turn it into:

```ts
type SegmentAnchor =
  | PdfBox
  | ImageBox
  | TextRange
  | CsvCell
  | XlsxCell
  | DocxTarget
```

That would make the shared segmented-document model know every leaf viewer.
That is the wrong direction.

The correct boundary:

```txt
SegmentedDocumentProvider
  owns semantic segment interaction and paged-document navigation.

Source field blocks
  own format-local source target adapters.

Leaf viewers
  own their own target types:
    TextViewerHighlight
    CsvViewerActiveCell
    XlsxViewerActiveCell
    DocxViewerHighlight
```

This means PDF/image/OCR/edit can use segmented anchors directly because their
targets are page-local.

Text/CSV/XLSX/DOCX source blocks should not force fake pages into the segmented
model just to satisfy a universal abstraction. They should use the same public
`SourceFieldList` link contract and keep format-local navigation inside the
block.

The final win is not that every block uses exactly the same provider. The win is
that no reusable public viewer system ships two competing evidence engines.

## Phase 1 - Ratchet Page Markdown And Parse Contracts

Source already points in the right direction. Make the rest of the tree agree.

Required changes:

- update architecture tests to require `PageMarkdownViewerHeader`;
- update architecture tests to reject `PageMarkdownViewerToolbar` as public
  viewer anatomy;
- update architecture tests to require `ParseViewerHeader`;
- update page-markdown render tests so toolbar controls are exercised through
  `PageMarkdownViewerHeader`;
- update parse tests so composed parse fixtures include `ParseViewerHeader`
  when they need toolbar controls;
- regenerate registry payloads so `public/r/parse-viewer-block.json` embeds the
  new source.

Architecture assertions:

```txt
PageMarkdownPane does not import PageMarkdownToolbar
PageMarkdownPane does not render PageMarkdownToolbar
PageMarkdownViewer exports PageMarkdownViewerHeader
PageMarkdownViewer renders PageMarkdownViewerHeader before ViewerBody
ParseViewer exports ParseViewerHeader
ParseViewer renders ParseViewerHeader before ViewerBody
parse docs import and render ParseViewerHeader
public/r/parse-viewer-block.json contains PageMarkdownViewerHeader
public/r/parse-viewer-block.json contains ParseViewerHeader
public/r/parse-viewer-block.json does not contain PageMarkdownViewerToolbar
```

## Phase 2 - Remove Anchored Evidence From Reusable Viewer Surface

The strict target:

```txt
no registry item named anchored-document-viewer
no registry item named pdf-anchor-target
no components/ui/anchored-document-viewer.tsx re-export
no components/ui/pdf-anchor-target.tsx re-export
no source block imports AnchoredDocumentProvider
no source block imports useAnchoredDocument
no edit code imports AnchoredDocumentProvider
no edit code imports useAnchoredDocument
no edit code imports usePdfAnchoredTarget
```

Do this without adding a new universal evidence provider.

### PDF/Image/OCR/Extraction Sources

Keep the segmented path.

These targets are page-local and fit `SegmentAnchor`:

```txt
pdf_bbox
image_bbox
OCR bbox
layout bbox
```

The current segmented source helpers are the right direction:

```ts
createSourcesSegmentedDocumentModel()
createSourcesSegmentedDocumentModel()
useSegmentedSourceFieldLink()
useSegmentedPdfViewerHandle()
useSegmentedImageViewerHandle()
useSegmentedPdfSourceOverlay()
useSegmentedImageSourceOverlay()
```

### Text/CSV/XLSX/DOCX Sources

Do not pretend these are page-local segmented documents.

Replace anchored provider usage with block-local source link state:

```ts
type SourceFieldLink = {
  activePath: string | null
  onFieldHover: (path: string | null) => void
  selectField?: (path: string) => void
}
```

Each block derives its own format target from the active source:

```txt
text_span          -> TextViewer highlight and scrollToLineRange
csv_cell           -> CsvViewer activeCell and scrollToCell
spreadsheet_cell   -> XlsxViewer activeCell and scrollToCell
docx_text_span     -> DocxViewer highlight and scrollToTarget
docx_table_cell    -> DocxViewer highlight and scrollToTarget
```

The helper can be tiny and private:

```ts
function useSourceFieldSelection(initialPath?: string | null): SourceFieldLink
```

Do not export it from a registry UI primitive unless multiple shipped blocks
need the same exact code and no domain vocabulary leaks.

### SourceFieldLink Cleanup

`source-field-link.ts` should stop importing anchored mechanics.

Target contents:

```txt
SourceFieldLink type
SegmentedSourceFieldLink type
useSegmentedSourceFieldLink
```

Remove:

```txt
useAnchoredSourceFieldLink
AnchoredItemId import
useAnchoredItemLink import
```

If text/CSV/XLSX/DOCX blocks need local link state, keep that helper in those
blocks or a small block-only utility.

## Phase 3 - Convert Edit To Segmented Mechanics

Edit is the cleanest proof that segmented-document is the right interaction
engine.

Target structure:

```tsx
<SegmentedDocumentProvider model={editSegmentedModel}>
  <EditViewerResolvedProvider ...>
    {children}
  </EditViewerResolvedProvider>
</SegmentedDocumentProvider>
```

The model adapter should live in edit model code:

```ts
createEditSegmentedDocumentModel(...)
```

Mapping:

```txt
EditViewerField.key       -> DocumentSegment.sourceId
EditViewerField.label     -> DocumentSegment.label
field source page         -> DocumentSegment.pages
field source bbox         -> SegmentAnchor.bounds
```

Selection bridge target:

```txt
useSegmentedItemLink
```

Replace:

```txt
useAnchoredDocument
activateItem
previewItem
selectItem
clearSelection
```

with:

```txt
useSegmentedItemLink
navigateItem
previewItem
selectItem
clearPreview
```

PDF handle registration target:

```txt
useSegmentedDocumentViewport().documentHandlers.setDocumentHandle
```

Do not keep `usePdfAnchoredTarget`.

Edit public hooks should stay narrow:

```ts
useEditViewerDocument()
useEditViewerFields()
```

Do not restore:

```ts
useEditViewer(): EditViewerContextValue
```

## Phase 4 - Stop Shipping Internal Selector Modules

The platonic target is no registry-shipped internal selector files.

Remove from registry payloads:

```txt
registry/new-york-v4/ui/pdf-viewer-internal-context.tsx
components/viewers/edit/edit-viewer-internal-context.tsx
```

The reason is not cosmetic. In a copied-code component library, exported
functions inside shipped files are de facto public.

Preferred PDF shape:

```txt
pdf-viewer-context.tsx
  public provider/context seams only

pdf-viewer.tsx
  first-party parts and unexported part selectors
```

Preferred edit shape:

```txt
edit-viewer-provider.tsx
  provider and public narrow hooks

edit-viewer.tsx
edit-viewer-header.tsx
edit-viewer-document.tsx
edit-viewer-fields.tsx
  first-party parts
```

If cross-file first-party parts need private selectors, choose one of two
honest shapes:

1. colocate provider and first-party parts so selectors can be unexported;
2. export context objects only inside source package boundaries, but do not
   include those modules in public registry items.

The final registry should not contain:

```txt
useInternalPdfViewerHeader
useInternalPdfViewerPages
useInternalPdfViewerHeaderControls
useInternalEditViewerLayout
useInternalEditViewerBusy
useInternalEditViewerEmpty
useInternalEditViewerHeader
```

## Phase 5 - Turn Architecture Tests Into Taste Ratchets

Architecture tests should describe the final aesthetic, not the migration
history.

Remove assertions that require old compromises:

```txt
expect PageMarkdownViewerToolbar to exist
expect usePageMarkdownViewerToolbar to exist
expect internal PDF selectors to be exported
expect internal edit selectors to be exported
expect sources blocks to contain AnchoredDocumentProvider
expect edit provider to contain AnchoredDocumentProvider
expect registry items to include anchored-document-viewer
expect registry items to include pdf-anchor-target
```

Add assertions that reject them:

```txt
no broad composed-viewer aggregate hooks
no hidden toolbar inside document panes
no reusable viewer block imports anchored-document-viewer
no edit code imports pdf-anchor-target
no registry item ships *-internal-context
no public/r payload contains useInternal*
no public/r payload contains PageMarkdownViewerToolbar
no public/r source block payload contains AnchoredDocumentProvider
```

Keep existing strong tests:

```txt
no ViewerShell
no ViewerSlots
no renderDocument
no slots={{ ... }}
no broad useXViewer state bag
no file-system changes
```

## Phase 6 - Registry And Public Payload Sync

Source is not enough. This is a registry library.

Every architectural change must update:

```txt
registry.json
public/r/*.json
registry/new-york-v4/**/*.tsx
components/**/*.tsx
content/docs/**/*.mdx
tests/**/*.ts
tests/**/*.tsx
```

Public payload checks:

```txt
public/r/parse-viewer-block.json does not contain PageMarkdownViewerToolbar
public/r/parse-viewer-block.json contains ParseViewerHeader
public/r/edit-viewer-block.json does not contain useInternalEditViewer
public/r/edit-viewer-block.json does not contain AnchoredDocumentProvider
public/r/pdf-viewer.json does not contain pdf-viewer-internal-context
public/r/*sources*.json does not contain AnchoredDocumentProvider
public/r/registry.json does not advertise anchored-document-viewer
```

If the registry generator cannot express the desired boundary, fix the item
definitions. Do not let generated JSON preserve old architecture.

## Phase 7 - Stale Blueprint Cleanup

Do not let old design docs teach the opposite of the current system.

For documents that still present anchored-document as the terminal ideal, add a
top-level supersession notice:

```md
This document is historical. The current standard is
viewer-system-platonic-ratchet-blueprint.md.
```

Likely historical documents:

```txt
design/anchored-document-platonic-ideal-blueprint.md
design/anchored-document-terminal-platonic-blueprint.md
design/anchored-document-containment-blueprint.md
```

Do not delete useful historical context. Just prevent it from being read as
current guidance.

## Verification Commands

Use focused checks first:

```bash
rg -n "AnchoredDocumentProvider|useAnchoredDocument|usePdfAnchoredTarget|anchored-document-viewer|pdf-anchor-target" \
  components/viewers registry/new-york-v4 public/r registry.json \
  -g '!**/file-system*' -g '!**/fslight*'
```

```bash
rg -n "PageMarkdownViewerToolbar|usePageMarkdownViewerToolbar" \
  components/viewers registry/new-york-v4 public/r tests content/docs
```

```bash
rg -n "useInternalPdfViewer|useInternalEditViewer|internal-context" \
  registry.json public/r components/viewers components/ui registry/new-york-v4/ui tests
```

```bash
git diff --name-only | rg "file-system|fslight" || true
```

Run focused tests:

```bash
bun test tests/viewer-architecture.test.ts
bun test tests/page-markdown-render.test.tsx tests/parse-viewer.test.tsx tests/parse-viewer-adapter.test.tsx
bun test tests/edit-viewer-render.test.tsx tests/sources.test.tsx tests/segment-surfaces.test.tsx
```

Broaden only after the focused tests are clean.

## Definition Of Done

The cut is done only when all of this is true:

- `ViewerRoot` remains the only spatial viewer primitive.
- `FileViewer` remains a leaf renderer, not a competing root system.
- Page markdown has explicit `PageMarkdownViewerHeader` anatomy everywhere,
  including public registry payloads.
- Parse has explicit `ParseViewerHeader` anatomy everywhere, including docs and
  registry payloads.
- Edit uses segmented-document mechanics, not anchored-document mechanics.
- Reusable source blocks no longer import anchored-document primitives.
- `source-field-link.ts` no longer imports anchored-document code.
- `anchored-document-viewer` and `pdf-anchor-target` are not advertised as
  public registry items.
- PDF and edit do not ship public-looking internal selector modules.
- Architecture tests reject the old compromises.
- Public docs do not show broad viewer state hooks.
- No file-system or fslight files are changed.

## Final Taste Test

A user should understand a composed viewer by reading JSX.

Good:

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

Bad:

```tsx
<ViewerSurface>
  <PaneThatSecretlyRendersToolbar />
</ViewerSurface>
```

Good:

```tsx
<SegmentedDocumentProvider model={model}>
  <ViewerRoot>
    <EditViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EditViewerDocument />
      </ViewerSurface>
      <ViewerSidebar>
        <EditViewerFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</SegmentedDocumentProvider>
```

Bad:

```tsx
<AnchoredDocumentProvider>
  <SegmentedDocumentProvider>{children}</SegmentedDocumentProvider>
</AnchoredDocumentProvider>
```

The perfect system has fewer concepts, not more.

