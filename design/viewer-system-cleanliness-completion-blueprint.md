# Viewer System Cleanliness Completion Blueprint

## Purpose

This blueprint defines the remaining work required to make the viewer system
clean in the strict sense:

```txt
simple
fast
complete
modular
typed
consistent
without duplicate conceptual centers
```

It is not a compatibility plan. It is not a migration story. It is the final
cleanup plan after the viewer architecture has mostly converged.

File-system internals are out of scope. File-system may consume viewer
primitives, but the viewer system should not absorb file-system state or
reshape file-system implementation details.

## Verdict

The system is structurally good now.

It is not perfectly clean yet.

The core centers are right:

```txt
ViewerRoot
  spatial shell, frame, sidebar state, sidebar trigger

FileViewer
  one ViewerSource rendered through one format route

SegmentedDocumentProvider
  semantic segments, page-local anchors, viewport/navigation mechanics

Domain providers
  email, split, partition, parse, edit, sources, upload
```

The remaining disorder is narrower:

```txt
document target vocabulary
edit/source evidence convergence
source/evidence provider overlap
page markdown sync boundary proof
thumbnail token adoption proof
public API proof
registry/docs drift
```

The provider idea is not the problem. Providers are correct when each provider
owns one real state machine. The problem is any provider, hook, or type that
blurs two state machines into one vague abstraction.

## Non-Negotiable Boundaries

### ViewerRoot

`ViewerRoot` owns spatial viewer state.

It owns:

```txt
root frame
header/body/surface/sidebar layout
viewer-local sidebar open state
sidebar trigger context
responsive sidebar behavior
viewer CSS variables
```

It must not own:

```txt
files
MIME parts
split segments
partition rows
OCR blocks
source evidence
edit fields
upload queue
file-system tree state
```

### FileViewer

`FileViewer` owns source rendering.

It owns:

```txt
ViewerSource normalization
file identity
resource resolution
format detection
file header model
download action
leaf route selection
unsupported state
```

It must not own:

```txt
domain sidebars
domain selection
email recursion semantics
split or partition state
source/evidence state
edit field state
upload acquisition state
file-system tree state
```

### SegmentedDocumentProvider

`SegmentedDocumentProvider` owns page-document interaction for semantic
segments and page-local anchors.

It owns:

```txt
pages
semantic document segments
page-local segment anchors
current page
scroll progress
preview segment
selected segment
document handle
scrollToPage
scrollToSegmentStart
scrollToAnchor
```

It must not own:

```txt
partition votes
split job status
OCR text meaning
source provenance semantics
edit value state
email MIME parts
file rendering
```

### Domain Providers

A domain provider is valid only when the sentence is precise.

Good:

```txt
EmailViewerProvider owns MIME projection and selected MIME part.
SplitViewerProvider owns split result projection and selected segment.
PartitionViewerProvider owns partition output/vote projections.
PageMarkdownViewerProvider owns markdown page sync and scale.
EditViewerProvider owns editable fields, validation, dirty state, and commands.
```

Bad:

```txt
Provider owns some layout, some selection, some rendering, and some compatibility.
```

## Remaining Cut 1: Canonical Document Target Vocabulary

This is the most important remaining cleanup.

The current vocabulary is still too crowded:

```txt
DocumentAnchor
SegmentAnchor
AnchorResolution
EvidenceItem
SourceEvidenceItem
SourceField
SourceFieldLink
SegmentedItemLink
SourceFieldList
AnchoredDocumentProvider
SegmentedDocumentProvider
```

The final system needs one canonical typed word for a place in a document.

There are only two acceptable outcomes.

### Option A: Keep `DocumentAnchor`

Use `DocumentAnchor` as the canonical typed target vocabulary.

```ts
type DocumentAnchor =
  | PageBoundsAnchor
  | TextRangeAnchor
  | CsvCellAnchor
  | XlsxCellAnchor
  | DocxRangeAnchor
```

### Option B: Hard-Rename To `DocumentTarget`

Use `DocumentTarget` as the canonical typed target vocabulary.

```ts
type DocumentTarget =
  | PageBoundsTarget
  | TextRangeTarget
  | CsvCellTarget
  | XlsxCellTarget
  | DocxRangeTarget
```

Do not keep both names long-term.

### Required Properties

The canonical target type must be:

```txt
typed
closed over known target kinds
explicit about missing targets
explicit about invalid targets
free of metadata bags
separate from SegmentAnchor
```

Wrong:

```ts
type SegmentAnchor = {
  id: string
  pageNumber?: number
  bounds?: SegmentBounds
  metadata?: Record<string, unknown>
}
```

That makes page-local geometry and arbitrary document targets indistinguishable.

### Completion Criteria

This cut is complete when:

```txt
one public canonical target name exists
page-bounds targets adapt into SegmentAnchor only at the segmented boundary
non-page targets stay on typed document handles
source/evidence data uses the canonical target type
edit fields use the canonical target type
architecture tests reject generic target metadata bags
```

## Remaining Cut 2: Source And Evidence Interaction

Source/evidence has the right instinct but too many surface names.

The final model should separate three things:

```txt
provenance item
document target
visual link/row
```

A provenance item is domain data:

```ts
type SourceEvidenceItem = {
  id: string
  label: string
  value?: string
  confidence?: number
  target: DocumentTarget | null
}
```

A document target is navigation data:

```txt
page bounds
text range
CSV cell
XLSX cell
DOCX range
```

A visual link is UI:

```txt
row
label
preview behavior
selected behavior
thumbnail or icon
```

Do not let one component own all three.

### Required Cleanup

1. Make `SourceFieldList` consume one evidence item shape.
2. Keep source provenance names out of `SegmentedDocumentProvider`.
3. Keep `SegmentedItemLink` generic and page-document oriented.
4. Keep non-page source examples on typed document handles.
5. Use segmented mechanics only when the source target is page-local.
6. Remove duplicate hover/preview/select controllers when the canonical target
   layer can own them.

### Completion Criteria

This cut is complete when:

```txt
source/evidence projection code chooses page-local segmented rendering or typed
document-handle rendering from the same canonical target shape
```

and when no source/evidence component needs a private target dialect.

## Remaining Cut 3: Edit Viewer Target Convergence

Edit should converge with source/evidence at the target layer only.

Edit owns editable state. It should not be reduced to evidence.

Shared:

```txt
item id
item label
document target
active item
preview item
scroll to target
highlight target
page-bound geometry
```

Edit-specific:

```txt
value
validation
dirty state
read-only state
field grouping
commit/revert
toolbar commands
write permissions
```

### Ideal Field Shape

```ts
type EditFieldItem = {
  id: string
  label: string
  value: unknown
  target: DocumentTarget | null
  status: EditFieldStatus
  confidence?: number
  isDirty: boolean
  isReadOnly?: boolean
}
```

### Required Cleanup

1. Normalize edit fields to the canonical target type.
2. Preserve missing vs invalid target states.
3. Convert raw PDF `bbox` usage into page-bound targets at the adapter edge.
4. Make overlays read page-bound targets, not edit-specific bbox fields.
5. Share target navigation only after the canonical target vocabulary is fixed.
6. Keep edit toolbar, validation, value, and commit state inside edit.

### Completion Criteria

This cut is complete when edit and source/evidence share the same target
mechanics without sharing domain payloads.

## Remaining Cut 4: Page Markdown Boundary

Page markdown should remain separate from segmented document mechanics.

It owns:

```txt
markdown page model
page rendering
page scroll
current page
scale
page handle registration
```

It does not own:

```txt
semantic segments
segment anchors
evidence hover
segment preview
segment rail/ribbon state
```

### Correct Future Bridge

If parse or markdown output later needs annotations, bridge providers explicitly:

```tsx
<SegmentedDocumentProvider model={model}>
  <PageMarkdownViewerProvider source={source}>
    <SegmentedPageMarkdownBridge />
    <PageMarkdownViewerContent />
  </PageMarkdownViewerProvider>
</SegmentedDocumentProvider>
```

Do not collapse page markdown into segmented document just because both know
about pages.

### Required Cleanup

1. Keep parse as a thin page-markdown domain surface.
2. Prove page markdown does not import segmented primitives.
3. Forward scroll options through the page markdown document handle.
4. Remove public test reliance on sync-version replay protocols.
5. Keep sync versioning, if any, private to the implementation.

### Completion Criteria

This cut is complete when page markdown exposes page navigation behavior without
becoming a third evidence or segment engine.

## Remaining Cut 5: Thumbnail Token Completion

`FileThumbnail` has the right primitive tokens:

```ts
thumbnailShape?: "document" | "square"
thumbnailSize?: "xs" | "sm" | "md" | "lg" | "xl"
```

The remaining work is adoption and proof.

### Migrate

Use tokens in common component-library cases:

```txt
file-thumbnail docs
file-thumbnail demos
attachment sidebar
non-bespoke dropzone workflow blocks
common queue/list/card thumbnails
```

Preferred:

```tsx
<FileThumbnail thumbnailShape="square" thumbnailSize="md" />
```

or:

```tsx
<FileThumbnail thumbnailShape="document" thumbnailSize="md" />
```

### Keep Bespoke

Raw geometry remains valid in visual compositions:

```txt
avatar/circular upload slots
custom thumbnail grid demos
pinboard rotated thumbnails
primitive cards with source-coordinate overlays
run-card media frames
PDF thumbnail rail
file-system internals
```

Do not merge `PdfThumbnailRail` into `FileThumbnail`. PDF page thumbnails are
page navigation, not generic file identity.

### Completion Criteria

This cut is complete when common usages no longer teach
`previewAspectRatio={1}` for square tiles, while bespoke media layouts still
retain explicit geometry.

## Remaining Cut 6: Public Hook And API Proof

Public hooks should expose the smallest coherent state slice.

Good:

```txt
useEmailHeader
useEmailPartsSidebar
useEmailContent
useEmailSelection
useFileViewer
useFileViewerHeader
useFileViewerContent
```

Bad:

```txt
public hooks returning full internal contexts
public hooks exposing private model objects
public hooks used only because named parts need implementation access
```

### Rule

Every provider may have a private full-context hook.

Public hooks must be deliberately narrow:

```txt
header hook
sidebar hook
content hook
selection hook
viewport hook
```

### Completion Criteria

This cut is complete when architecture tests prove that public hooks do not
leak full provider internals.

## Remaining Cut 7: Registry And Documentation Proof

The registry is part of the component API.

The system is not clean if source files are clean but generated registry output
still teaches the old shape.

### Required Proof

For every cleanup, verify the three surfaces:

```txt
source component
registry component
public/r JSON
```

For docs-facing components, also verify:

```txt
content docs
demo components
architecture tests
```

### Required Guards

Architecture tests should reject:

```txt
deleted registry item references
missing docs paths
public full-context hooks
duplicate FileViewer leaf download buttons
Segment props typed as raw Segment[] when they mean DocumentSegment[]
page markdown importing segmented primitives
common thumbnail examples using raw square aspect ratio
target metadata bags in canonical target types
```

### Completion Criteria

This cut is complete when the public registry, docs, tests, and source code all
describe the same architecture.

## Final Inventory Of Bad Smells

The remaining bad smells are:

```txt
two names for document targets
page-local anchors confused with semantic segments
source evidence and edit fields using parallel target dialects
public hooks exposing full provider internals
page markdown sync details visible in public tests
common thumbnails still teaching raw square geometry
registry output drifting from source architecture
docs deleted or renamed without architecture tests being updated
```

The following are not bad smells:

```txt
ViewerRoot and FileViewer both existing
FileViewer having a provider
SegmentedDocumentProvider existing beside PageMarkdownViewerProvider
domain viewers having domain providers
PDF thumbnail rail staying separate from FileThumbnail
file-system consuming viewer primitives without being owned by them
```

## Implementation Order

### Phase 1: Finish Small Proof Cuts

1. Finish thumbnail token adoption in docs and non-bespoke workflow blocks.
2. Finish page markdown handle option forwarding and boundary tests.
3. Remove public test reliance on page markdown sync versions.
4. Regenerate affected registry items.
5. Add architecture guards for the above.

### Phase 2: Choose The Target Word

1. Decide between `DocumentAnchor` and `DocumentTarget`.
2. Make the chosen name canonical.
3. Delete or hard-rename competing public names.
4. Reject untyped metadata target bags.

### Phase 3: Converge Source/Evidence And Edit

1. Adapt source/evidence items to the canonical target type.
2. Adapt edit fields to the canonical target type.
3. Convert page-bound targets to segmented anchors at the boundary.
4. Keep non-page targets on typed document handles.
5. Share target interaction mechanics only where the target type proves it.

### Phase 4: Registry And Docs Sweep

1. Remove stale references to deleted or renamed registry items.
2. Ensure docs paths match current public components.
3. Rebuild public registry JSON.
4. Run architecture tests as the system contract.

## Final Cleanliness Test

The system is clean when all of these sentences are true:

```txt
ViewerRoot renders space.
FileViewer renders one source.
Domain viewers compose state and named parts.
SegmentedDocumentProvider coordinates semantic segments and page-local anchors.
Page markdown coordinates pages only.
One canonical typed target vocabulary exists.
Source/evidence and edit share target mechanics without sharing domain payloads.
Common thumbnails use tokens; bespoke media keeps explicit geometry.
Public hooks expose slices, not implementation contexts.
Registry, docs, tests, and source code teach the same architecture.
File-system is a consumer, not a dependency or responsibility of viewer core.
```

Until those sentences are true, the architecture is good but not finished.
