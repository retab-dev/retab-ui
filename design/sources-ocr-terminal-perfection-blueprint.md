# Sources/OCR Terminal Perfection Blueprint

## Objective

Define the final ideal for Sources/OCR after the anchored-evidence direction has
proved viable.

This is not a file-system blueprint.

This is not a viewer-system blueprint.

The scope is exactly:

```txt
extraction sources
OCR layout blocks
anchored evidence projection
anchored document interaction
sidebar item behavior
registry installability for those pieces
```

## Verdict

No, this area has not reached perfection.

It has reached a good design.

The provider is not a dead end. The provider is the correct interaction
primitive. The imperfection is that some surrounding modules still make the
architecture feel broader and more coupled than the concept actually is.

The final ideal is:

```txt
AnchoredDocumentProvider owns interaction.
Evidence modules own projection.
Domain panels own row presentation.
Leaf viewers own document rendering.
Target adapters connect anchors to leaf viewers.
```

The current design is close because the core sentence is right:

```txt
Sources and OCR are semantic items anchored into a document.
```

The current design is not perfect because that sentence is not yet enforced
everywhere by the module graph, naming, tests, and registry surface.

## The Ideal Sentence

The whole system should be explainable as:

```txt
A domain produces evidence items.
Evidence items project into anchored items.
Anchored items drive preview, selection, scroll, and highlight in a document.
The domain panel renders rows.
The document viewer renders the file.
```

If a module cannot be placed in that sentence, it probably should not exist.

## Final Shape

```txt
anchored-document-viewer.tsx
  generic interaction provider
  generic anchor types
  no source vocabulary
  no OCR vocabulary
  no field vocabulary
  no file viewer imports
  no row rendering

anchored-evidence.ts
  pure evidence model
  evidence item -> anchored item projection
  anchor resolution helpers
  no React runtime
  no source vocabulary
  no OCR vocabulary

anchored-item-list.tsx
  generic virtualized listbox primitive
  hover/focus preview
  click/keyboard activation
  disabled-row behavior
  no source vocabulary
  no OCR vocabulary

source-anchor.ts
  pure Source -> DocumentAnchor conversion
  no React
  no viewer adapter imports
  no registry UI imports except type-only anchor types

source-evidence.ts
  SourceField/SourceMap -> EvidenceItem
  no viewer adapter imports
  no UI row rendering

field-anchor-link.ts
  compatibility adapter from anchored item link to field vocabulary
  lives outside anchored-document-viewer
  contains the only public field-link naming

source-field-list.tsx
  extraction/source row presentation
  uses AnchoredItemList
  renders source labels, values, hints, missing/invalid states

layout-blocks-model.ts
  LayoutDocument/LayoutItem -> EvidenceItem
  computes visible OCR evidence model
  no panel rendering

layout-blocks-panel.tsx
  OCR row presentation
  uses AnchoredItemList
  renders OCR labels, text, confidence, page hint

pdf/image/text/csv/xlsx/docx targets
  render documents
  scroll to anchors
  draw active/selected highlights
```

## What Is Correct Now

### Provider Boundary

`AnchoredDocumentProvider` has the correct job.

It owns:

- item registry;
- preview item id;
- selected item id;
- active item;
- active anchor;
- preview;
- selection;
- activation;
- scroll to anchor;
- clearing stale selected/preview items when the item list changes.

It should not own:

- JSON schema;
- source maps;
- OCR confidence;
- field paths;
- row labels;
- row values;
- PDF rendering;
- image rendering;
- layout.

That boundary is right.

### Evidence As The Middle Layer

`EvidenceItem` is the correct shared layer between Sources and OCR.

It is not the canonical domain model.

It is not the provider item.

It is the projection target:

```txt
SourceField -> EvidenceItem -> AnchoredItem
LayoutItem  -> EvidenceItem -> AnchoredItem
```

This is the right abstraction because it removes duplicated interaction
without pretending extraction fields and OCR blocks are the same domain object.

### Domain Panels Stay Separate

Sources and OCR should not become one giant panel component.

They share:

- active item semantics;
- selected item semantics;
- hover preview;
- keyboard navigation;
- disabled item behavior;
- scroll-to-anchor;
- missing/invalid anchor semantics.

They do not share:

- canonical data;
- labels;
- copy;
- confidence display;
- filtering controls;
- row density;
- grouping;
- empty states.

The shared primitive is `AnchoredItemList`, not a universal
`DocumentIntelligencePanel`.

### Leaf Viewers Stay Clean

Leaf viewers should render documents.

They should not become owners of evidence state.

The final design must preserve:

```txt
FileViewer has no sourceMap prop.
PdfViewer has no anchoredItems prop.
ImageViewer has no evidence prop.
TextViewer has no field-link prop.
```

Target adapters may connect provider state to a leaf viewer, but leaf viewers
must not absorb the anchored-document domain.

## Remaining Imperfections

### 1. The Registry Surface Is Still Too Easy To Pollute

The conceptual graph is now good, but registry installability has to enforce
the same graph.

The registry should make these installation shapes possible:

```txt
anchored-document-viewer
  installs only generic interaction

anchored-evidence
  installs only pure evidence projection helpers

source-anchor
  installs only Source -> DocumentAnchor conversion

source-evidence
  installs source projection without file rendering adapters

layout-blocks
  installs OCR model/panel without extraction source helpers
```

The unacceptable shape is:

```txt
installing source-evidence pulls PDF/image/csv/xlsx/docx viewer adapters
installing anchored-document-viewer pulls field/source/OCR components
installing layout-blocks pulls source-map helpers
```

Perfection requires registry dependency tests, not just local TypeScript
success.

### 2. `DocumentAnchor` Is Still Housed In A Client File

`DocumentAnchor` is a pure data type, but today it lives in
`anchored-document-viewer.tsx`, which is a client module.

Type-only imports make this workable.

They do not make it beautiful.

The platonic shape is:

```txt
document-anchor.ts
  DocumentAnchor
  PdfAreaAnchor
  ImageAreaAnchor
  TextRangeAnchor
  CsvCellAnchor
  XlsxCellAnchor
  DocxTargetAnchor

anchored-document-viewer.tsx
  imports DocumentAnchor
  owns provider and hooks

source-anchor.ts
  imports DocumentAnchor from document-anchor.ts
```

This would make the pure conversion modules obviously pure instead of
technically pure.

This is a real remaining gap.

### 3. `EvidenceItem` Still Mixes Interaction Projection And Display Payload

The current `EvidenceItem` shape is pragmatic:

```ts
type EvidenceItem = {
  id: string
  anchor: AnchorResolution
  label: string
  value?: React.ReactNode
  text?: string
  hint?: string
  kind?: string
  confidence?: number
  metadata?: Record<string, unknown>
}
```

This works.

It is not perfectly tight.

The tension is that:

- `id` and `anchor` are required for interaction projection;
- `label`, `value`, `text`, `hint`, `confidence`, and `metadata` are display
  payloads;
- `metadata.layoutItem` reintroduces domain data through an escape hatch.

The ideal split is:

```ts
type EvidenceAnchor = {
  id: string
  anchor: AnchorResolution
}

type EvidenceItem<Payload> = EvidenceAnchor & {
  payload: Payload
}
```

Then Sources can define:

```ts
type SourceEvidencePayload = {
  label: string
  value?: React.ReactNode
  hint?: string
  sourceKind: string
}
```

OCR can define:

```ts
type LayoutEvidencePayload = {
  level: LayoutLevel
  kind: string
  text: string
  confidence?: number
  pageNumber: number
  item: LayoutItem
}
```

This would make the shared part exact:

```txt
id + anchor
```

and keep every display word in the domain.

The current shape is acceptable. The generic-payload shape is cleaner.

### 4. `metadata` Is Too Weak For Flaubertian Code

`metadata?: Record<string, unknown>` is useful for migration and fast
composition, but it is a weak type.

It allows row renderers to recover domain meaning by casting:

```ts
const layoutItem = item.metadata?.layoutItem as LayoutItem | undefined
```

That is not perfection.

The final design should remove generic metadata from the shared evidence type.

Use typed payloads instead.

### 5. Source Path Vocabulary Still Needs A Hard Edge

Field paths are domain vocabulary.

They belong to extraction/form adapters.

They should not leak into:

- anchored provider;
- anchored list primitive;
- OCR model;
- target adapters.

The right bridge is:

```txt
field-anchor-link.ts
  field path vocabulary at the form/source edge only
```

The hard rule:

```txt
Only source/form modules may say "field" or "path" when they mean extracted
data fields.
```

Perfection requires tests that fail if field vocabulary returns to the provider.

### 6. OCR Filtering And Evidence Projection Are Still Coupled

`createLayoutBlocksViewerModel` currently computes:

- index;
- visible OCR items;
- low-confidence filtering;
- evidence items;
- anchored items.

That is practical.

The sharper shape is two steps:

```txt
createLayoutBlocksIndex(document)
filterLayoutItems(document.items, filter)
layoutItemsToEvidenceModel(items, index)
```

Why this matters:

- filtering is OCR panel state;
- evidence projection is anchored-document state;
- index creation is geometry state.

The current function is not wrong. It is too much one function to be the final
word.

### 7. Missing And Invalid Anchors Need Better Visual Semantics

`AnchorResolution` is the correct model:

```ts
type AnchorResolution =
  | { status: "resolved"; anchor: DocumentAnchor }
  | { status: "missing" }
  | { status: "invalid"; reason: string }
```

The UI still has to prove it treats these states distinctly.

The ideal behavior:

```txt
resolved -> enabled row, can preview/select/scroll/highlight
missing  -> enabled row if the item still has semantic value, no scroll
invalid  -> disabled row, explicit reason available to row renderer
```

The provider only needs `disabled`.

The domain row should own the copy:

```txt
No source
Unsupported source
Invalid bounding box
Page not found
```

Do not collapse all unresolved anchors into a single faded row.

### 8. Active And Selected Semantics Need Final Contract Tests

The final interaction semantics should be unambiguous:

```txt
hover/focus previews an item
click/Enter/Space selects and scrolls smoothly
preview has priority over selected
Escape clears preview and selection
disabled items cannot preview, select, or scroll
removed selected item clears selection
removed preview item clears preview
```

This behavior belongs to the anchored provider and anchored list tests.

Sources and OCR should not duplicate it.

### 9. Virtualization Needs Proof Under Real Panel Mutations

The anchored list is the right primitive, but virtualized primitives need
stronger proof than static rendering tests.

Required cases:

- zero-measure environment renders deterministic fallback rows;
- removing the selected row does not visually select the next row by index;
- reordering rows preserves identity by item id;
- keyboard navigation skips disabled rows;
- `Home` and `End` land on enabled rows;
- empty state has no hidden active descendant;
- row refs are removed when items unmount.

Without these tests, the primitive is good but not proven.

### 10. Naming Is Close But Not Perfect

The final vocabulary should be strict:

```txt
anchor     document location
target     imperative bridge into a leaf viewer
item       provider-level semantic unit
evidence   domain projection that can become an item
source     extraction provenance
layout     OCR structure
field      extracted data path
viewer     document renderer or spatial shell, never evidence state
```

Forbidden drift:

```txt
source item       when the item is generic evidence
field item        inside anchored provider
layout source     for OCR geometry
target source     for anchors
viewer evidence   for provider state
```

The code is close. It still needs vocabulary tests or a strict source audit.

## The Final API

### Generic Anchored Interaction

```tsx
<AnchoredDocumentProvider items={anchoredItems} target={target}>
  {children}
</AnchoredDocumentProvider>
```

```ts
type AnchoredItem = {
  id: string
  anchor: DocumentAnchor | null
  disabled?: boolean
}
```

```ts
type AnchoredItemLink = {
  activeItemId: string | null
  previewItem: (itemId: string | null) => void
  activateItem: (itemId: string) => void
}
```

No fields.

No sources.

No OCR.

### Generic Evidence Projection

```ts
type EvidenceAnchor = {
  id: string
  anchor: AnchorResolution
}

type EvidenceItem<Payload> = EvidenceAnchor & {
  payload: Payload
}
```

```ts
function evidenceItemsToAnchoredItems(
  items: readonly EvidenceAnchor[]
): AnchoredItem[]
```

This function should be boring and permanent.

### Source Projection

```ts
type SourceEvidencePayload = {
  label: string
  value?: React.ReactNode
  hint?: string
  sourceKind: string
}

function sourceMapToEvidenceItems(input: {
  sourceMap: SourceMap
  values?: Record<string, unknown>
  schema?: JSONSchema7
}): EvidenceItem<SourceEvidencePayload>[]
```

### OCR Projection

```ts
type LayoutEvidencePayload = {
  item: LayoutItem
  level: LayoutLevel
  kind: string
  text: string
  confidence?: number
  pageNumber: number
}

function layoutItemsToEvidenceItems(input: {
  items: readonly LayoutItem[]
  index: LayoutItemIndex
}): EvidenceItem<LayoutEvidencePayload>[]
```

### List Primitive

```tsx
<AnchoredItemList
  aria-label="Evidence"
  items={items}
  activeItemId={activeItemId}
  selectedItemId={selectedItemId}
  onPreviewItem={preview}
  onActivateItem={activate}
  onClearPreview={clearPreview}
  onClearSelection={clearSelection}
  renderItem={renderItem}
/>
```

The list primitive should know only:

```txt
id
disabled
active
selected
focus
keyboard
virtualization
```

## Ideal Composition Examples

### Extraction Sources

```tsx
const model = sourceMapToEvidenceModel({ sourceMap, values, schema })
const target = usePdfAnchorTarget(pdfHandle)

return (
  <AnchoredDocumentProvider items={model.anchoredItems} target={target}>
    <ViewerRoot>
      <ViewerBody>
        <ViewerSurface>
          <PdfViewer source={source} bare />
        </ViewerSurface>
        <ViewerSidebar>
          <SourceFieldList items={model.evidenceItems} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </AnchoredDocumentProvider>
)
```

### OCR

```tsx
const index = createLayoutBlocksIndex(document)
const visibleItems = filterLayoutItems(document.items, filter)
const model = layoutItemsToEvidenceModel({ items: visibleItems, index })
const target = usePdfAnchorTarget(pdfHandle)

return (
  <AnchoredDocumentProvider items={model.anchoredItems} target={target}>
    <ViewerRoot>
      <ViewerBody>
        <ViewerSurface>
          <PdfViewer source={source} bare />
        </ViewerSurface>
        <ViewerSidebar>
          <LayoutBlocksPanel items={model.evidenceItems} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </AnchoredDocumentProvider>
)
```

These two examples should feel structurally identical.

Their data and rows should still be domain-specific.

## Non-Goals

Do not create:

- `SourcesOcrViewer`;
- `DocumentIntelligenceViewer`;
- `AnchoredEvidenceViewer` as a layout shell;
- `FileViewer sourceMap`;
- `PdfViewer anchoredItems`;
- a universal row component for sources and OCR;
- a universal evidence filter system;
- a file-system integration layer.

Those abstractions sound convenient, but they would make the concept bigger
than the problem.

## Implementation Plan

### Step 1: Extract Pure Document Anchor Types

Create:

```txt
registry/new-york-v4/ui/document-anchor.ts
components/ui/document-anchor.ts
```

Move only pure anchor types there.

Update:

```txt
anchored-document-viewer.tsx
source-anchor.ts
anchored-evidence.ts
target adapters
tests
registry.json
public/r/*
```

Acceptance:

```txt
source-anchor.ts imports no .tsx module
document-anchor.ts has no "use client"
document-anchor.ts imports no React
```

### Step 2: Split Evidence Anchor From Evidence Payload

Replace loose `EvidenceItem` with a generic payload model.

Target:

```ts
type EvidenceAnchor = {
  id: string
  anchor: AnchorResolution
}

type EvidenceItem<Payload = unknown> = EvidenceAnchor & {
  payload: Payload
}
```

Then migrate:

```txt
SourceFieldList -> EvidenceItem<SourceEvidencePayload>
LayoutBlocksPanel -> EvidenceItem<LayoutEvidencePayload>
source-evidence.ts -> typed source payload
layout-blocks-model.ts -> typed layout payload
```

Acceptance:

```txt
no metadata?: Record<string, unknown> in anchored-evidence.ts
no "as LayoutItem" cast in layout-blocks-panel.tsx
source rows do not receive OCR payload fields
OCR rows do not receive source payload fields
```

### Step 3: Separate OCR Filtering From Projection

Break `createLayoutBlocksViewerModel` into:

```txt
createLayoutItemIndex
filterLayoutItems
layoutItemsToEvidenceModel
createLayoutBlocksViewerModel
```

Keep `createLayoutBlocksViewerModel` only if it is a small convenience wrapper.

Acceptance:

```txt
filter tests do not need anchored evidence
projection tests do not need filter state
index tests do not need panel rendering
```

### Step 4: Harden `AnchoredItemList`

Add tests for:

```txt
zero-measure fallback rows
stable row identity after removal
stable row identity after reorder
disabled row keyboard skipping
Home/End enabled-row behavior
Escape clears preview and selection
empty list semantics
```

Acceptance:

```txt
source panels and OCR panels share these tests by using the primitive
no domain panel reimplements keyboard navigation
```

### Step 5: Harden Registry Boundaries

Add architecture tests that inspect registry items and source imports.

Required failures:

```txt
anchored-document-viewer imports source-evidence
anchored-document-viewer imports field-anchor-link
anchored-document-viewer imports layout-blocks
source-evidence imports pdf-source/image-source/csv-source/xlsx-source/docx-source
layout-blocks-model imports source-evidence
source-field-list imports layout-blocks
layout-blocks-panel imports source-field-list
```

Acceptance:

```txt
installing each primitive installs the minimum dependency graph
```

### Step 6: Update Docs To Teach The Boundary

Docs must explain:

```txt
AnchoredDocumentProvider is generic interaction.
EvidenceItem is projection, not storage.
SourceFieldList is source presentation.
LayoutBlocksPanel is OCR presentation.
Leaf viewers stay document renderers.
```

Docs must not suggest:

```txt
pass sourceMap into FileViewer
pass anchoredItems into PdfViewer
use source rows for OCR
use OCR rows for sources
```

## Test Matrix

### Pure Projection

- `sourceToDocumentAnchor` converts every supported source kind.
- invalid normalized boxes return invalid/missing resolution.
- `image_bbox` becomes `image-area`, not `pdf-area`.
- CSV columns convert from letters to zero-based indexes.
- spreadsheet rows convert to zero-based indexes.
- docx text/cell anchors validate ranges.
- text spans validate line ranges.

### Evidence Model

- source fields produce stable ids.
- source maps preserve paths as ids.
- schema titles become labels only when unambiguous.
- missing source becomes missing anchor resolution.
- invalid source becomes invalid anchor resolution.
- OCR layout items produce stable ids.
- OCR missing page becomes missing anchor resolution.
- OCR confidence and page hints stay in typed payload.

### Provider

- preview wins over selected.
- selected survives hover clear.
- removed selected item clears.
- removed preview item clears.
- disabled selected item clears.
- activation scrolls only resolved enabled items.
- preview scroll uses auto behavior.
- activation scroll uses smooth behavior by default.

### List

- renders in zero-measure environments.
- uses item ids as keys.
- does not select by index after removal.
- does not activate disabled rows.
- keyboard navigation skips disabled rows.
- Escape clears both preview and selection.

### Integration

- extraction source hover highlights the document.
- extraction source click persists highlight.
- OCR row hover highlights the document.
- OCR row click persists highlight.
- switching filters clears stale OCR selection.
- switching source map clears stale source selection.
- missing anchors render useful row states.
- invalid anchors are visibly non-interactive.

### Registry

- relevant registry payloads are generated.
- registry dependencies match imports.
- pure modules are not emitted as client components.
- installation payload for source projection does not include leaf viewers.
- installation payload for anchored provider does not include source/OCR rows.

## Completion Criteria

This area reaches the practical ideal only when all of these are true:

- `DocumentAnchor` is pure and independent from client provider code.
- `AnchoredDocumentProvider` has no source, field, OCR, or viewer imports.
- `EvidenceItem` has typed payloads and no `Record<string, unknown>` metadata
  escape hatch.
- Source projection imports no viewer adapters.
- OCR projection imports no source projection.
- Source and OCR panels share `AnchoredItemList`.
- Source and OCR panels do not share row components.
- Missing and invalid anchor states are explicit in the row UI.
- Provider interaction semantics are covered by behavior tests.
- Virtualized list identity is covered by behavior tests.
- Registry payloads prove the same dependency graph as source imports.
- Docs teach composition instead of hidden shells.
- No file-system code is touched.

## Final Judgment

The current design is good.

The provider is not the mistake.

The remaining work is precision:

```txt
move pure anchor types out of client code
make evidence payloads typed
remove generic metadata
split OCR filtering from projection
prove list identity and virtualization
lock registry dependencies
```

After those changes, Sources/OCR would be very close to the platonic version:

```txt
simple because every module has one job
fast because only the list and viewer virtualize/render
complete because all anchor states are explicit
minimal because no universal document-intelligence shell exists
modular because domain panels and provider cannot pollute each other
```

