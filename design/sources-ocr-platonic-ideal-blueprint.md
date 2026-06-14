# Sources/OCR Platonic Ideal Blueprint

## Objective

Define the absolute ideal for Sources/OCR anchored document experiences.

This blueprint is not a migration plan.

This blueprint is not a compatibility plan.

This blueprint describes the final shape the code should have if we optimize
only for:

- simplicity;
- speed;
- complete behavior;
- no unnecessary abstractions;
- perfect module boundaries;
- precise names;
- installable registry artifacts;
- tests that prove the contract.

File-system is out of scope.

## Verdict

The provider direction is correct.

The current implementation is good.

The platonic ideal is still sharper.

The final architecture should make one sentence mechanically true:

```txt
Sources and OCR share anchored evidence interaction, and nothing else.
```

That means:

```txt
shared:  item id, anchor resolution, preview, selection, activation, scroll
separate: source maps, layout blocks, row copy, filtering, confidence, rendering
```

The ideal is not a `SourcesOcrViewer`.

The ideal is not a `DocumentIntelligenceViewer`.

The ideal is a small stack of exact primitives.

## Design Choices

### Choice 1: Keep The Provider

The provider is not the dead end.

The provider is the right primitive because there is real shared state:

```txt
preview item
selected item
active item
active anchor
activation
target scrolling
stale item cleanup
```

That state is neither source-specific nor OCR-specific.

The wrong version of the provider would own:

```txt
field paths
source maps
schema labels
OCR confidence
row rendering
document rendering
```

The platonic version owns none of that.

### Choice 2: Do Not Merge Sources And OCR

Sources and OCR are structurally similar, but not identical.

They share an interaction grammar:

```txt
semantic row -> anchor -> preview/select/scroll/highlight
```

They do not share a domain model:

```txt
SourceMap is extraction provenance.
LayoutDocument is OCR structure.
```

Merging them into one `SourcesOcrViewer` would make the common part too big
and the domain parts too vague.

The shared unit is `EvidenceItem<Payload>`, not a universal row component.

### Choice 3: Keep Leaf Viewers Ignorant

`FileViewer`, `PdfViewer`, `ImageViewer`, `TextViewer`, `CsvViewer`,
`XlsxViewer`, and `DocxViewer` render documents.

They should not accept:

```txt
sourceMap
anchoredItems
evidenceItems
fieldLink
layoutBlocks
```

Those props would be convenient in demos and harmful in the component library.

Evidence belongs beside leaf viewers, not inside them.

### Choice 4: Extract Pure Anchor Types

`DocumentAnchor` is data vocabulary.

It should not live in a client provider module.

Keeping it in `anchored-document-viewer.tsx` works technically through type-only
imports, but it makes pure projection modules look coupled to client code.

The ideal creates `document-anchor.ts`.

This is the highest-signal next cut.

### Choice 5: Make Evidence Payload-Typed

The current broad `EvidenceItem` shape is useful, but not exact enough:

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

That shape mixes the shared interaction part with domain display payload.

The ideal shape is:

```ts
type EvidenceItem<Payload> = {
  id: string
  anchor: AnchorResolution
  payload: Payload
}
```

That makes the shared part exact and forces Sources/OCR to name their own
payloads.

### Choice 6: Remove Generic Metadata

`metadata?: Record<string, unknown>` is not Flaubertian.

It lets code smuggle domain objects through the shared layer and recover them
with casts.

The ideal has no generic metadata.

If a row needs the original `LayoutItem`, it appears in
`LayoutEvidencePayload`.

If a row needs source details, they appear in `SourceEvidencePayload`.

### Choice 7: Split OCR Filtering From Projection

OCR has three different concerns:

```txt
indexing page geometry
filtering visible OCR items
projecting OCR items into evidence
```

The ideal keeps them separate.

Filtering is a panel/domain concern.

Projection is an anchored-evidence concern.

Geometry is an OCR model concern.

Convenience wrappers may exist only if they are obvious compositions of these
pure functions.

### Choice 8: Treat Public Mirrors As Deliberate Surface

The `components/ui/*` mirror must not be accidental.

Every public mirror file should be one of:

```txt
an owned local implementation
a deliberate re-export of the registry implementation
```

No public file should import a missing local support module.

No TypeScript success should depend on tests mocking around broken public
surface.

## One Sentence

```txt
A domain projects semantic evidence into document anchors, then a generic
anchored interaction provider coordinates rows, highlights, and navigation.
```

Every file in this slice should fit into that sentence.

If it does not, it should not be in this slice.

## Final Vocabulary

Use these words exactly:

```txt
anchor
  A pure document location.

target
  An imperative bridge from an anchor to a rendered document viewer.

item
  A provider-level interactive unit.

evidence
  A domain-derived semantic thing that can become an item.

source
  Extraction provenance.

field
  Extracted data path.

layout
  OCR/document-AI structure.

panel
  Domain row presentation.

viewer
  File/document rendering or spatial shell.
```

Do not use:

```txt
source item
field item
layout source
viewer evidence
target source
```

Those phrases blur boundaries.

## Final File Tree

```txt
registry/new-york-v4/ui/
  document-anchor.ts
  anchored-document-viewer.tsx
  anchored-evidence.ts
  anchored-item-list.tsx
  field-anchor-link.ts
  source-anchor.ts
  source-evidence.ts
  source-field-list.tsx
  layout-blocks-model.ts
  layout-blocks-panel.tsx
  layout-blocks.tsx
```

Public mirror:

```txt
components/ui/
  document-anchor.ts
  anchored-document-viewer.tsx
  anchored-evidence.ts
  anchored-item-list.tsx
  field-anchor-link.ts
  source-anchor.ts
  source-evidence.ts
  source-field-list.tsx
  layout-blocks-model.ts
  layout-blocks-panel.tsx
  layout-blocks.tsx
```

Every public mirror file is deliberate:

```txt
owned implementation or explicit re-export
```

No accidental public surface.

No missing support file that makes TypeScript depend on registry internals by
accident.

## Module Ownership

### `document-anchor.ts`

Owns pure document location types.

```ts
type DocumentAnchor =
  | PdfAreaAnchor
  | ImageAreaAnchor
  | TextRangeAnchor
  | CsvCellAnchor
  | XlsxCellAnchor
  | DocxTargetAnchor
```

Rules:

- no `"use client"`;
- no React import;
- no hooks;
- no provider;
- no source types;
- no OCR types;
- no viewer imports.

This file is pure vocabulary.

### `anchored-document-viewer.tsx`

Owns generic interaction state.

It exports:

```ts
type AnchoredItem = {
  id: string
  anchor: DocumentAnchor | null
  disabled?: boolean
}

type AnchoredDocumentTarget = {
  scrollToAnchor: (
    anchor: DocumentAnchor,
    options: { behavior: ScrollBehavior }
  ) => void
}

type AnchoredItemLink = {
  activeItemId: string | null
  previewItem: (itemId: string | null) => void
  activateItem: (itemId: string) => void
}
```

It owns:

- item registry;
- preview item id;
- selected item id;
- active item derivation;
- active anchor derivation;
- preview;
- selection;
- activation;
- scroll-to-target;
- stale item cleanup.

It does not own:

- evidence;
- source maps;
- field paths;
- OCR layout;
- row rendering;
- PDF/image/text/csv/xlsx/docx rendering;
- filters;
- grouping;
- schema labels.

Forbidden imports:

```txt
source-evidence
source-anchor
source-field-list
field-anchor-link
layout-blocks
layout-blocks-model
layout-blocks-panel
pdf-viewer
file-viewer
```

### `anchored-evidence.ts`

Owns generic evidence projection.

The ideal type is payload-generic:

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

It exports:

```ts
resolvedEvidenceAnchor(anchor)
missingEvidenceAnchor()
invalidEvidenceAnchor(reason)
evidenceToAnchoredItem(item)
evidenceItemsToAnchoredItems(items)
```

It does not export:

- labels;
- values;
- text;
- confidence;
- metadata;
- source helpers;
- OCR helpers.

There is no:

```ts
metadata?: Record<string, unknown>
```

Generic metadata is an escape hatch. The ideal removes it.

Domain payloads are the only place where domain display data can live.

This means:

```txt
source rows read SourceEvidencePayload
OCR rows read LayoutEvidencePayload
generic evidence functions read only id + anchor
```

### `anchored-item-list.tsx`

Owns generic listbox behavior.

It knows:

- item id;
- disabled state;
- active state;
- selected state;
- hover preview;
- focus preview;
- click activation;
- keyboard activation;
- keyboard navigation;
- virtualization;
- empty state;
- stable item identity.

It does not know:

- source;
- field;
- OCR;
- confidence;
- JSON schema;
- document anchors.

Its item constraint is minimal:

```ts
type AnchoredItemListItem = {
  id: string
  disabled?: boolean
}
```

It should be usable for extraction fields, OCR rows, citations, validation
issues, and edit fields without a new primitive.

### `field-anchor-link.ts`

Owns the field vocabulary adapter.

It is allowed to say:

```txt
Field
Path
activePath
onFieldHover
selectField
```

No other generic anchored module is allowed to say those words.

It bridges:

```txt
AnchoredItemLink -> FieldAnchorLink
```

This is an edge adapter, not core state.

### `source-anchor.ts`

Owns pure extraction source to document anchor conversion.

It converts:

```txt
pdf_bbox          -> pdf-area
image_bbox        -> image-area
csv_cell          -> csv-cell
spreadsheet_cell  -> xlsx-cell
docx_text_span    -> docx-target
docx_table_cell   -> docx-target
text_span         -> text-range
```

Rules:

- no `"use client"`;
- no React import;
- no hooks;
- no overlay imports;
- no `pdf-source`;
- no `image-source`;
- no `csv-source`;
- no `xlsx-source`;
- no `docx-source`;
- no `text-source`.

It returns `DocumentAnchor | null`.

It does not decide missing versus invalid. That belongs to the evidence
boundary.

### `source-evidence.ts`

Owns extraction source projection.

Ideal payload:

```ts
type SourceEvidencePayload = {
  label: string
  value?: React.ReactNode
  hint?: string
  sourceKind: Source["anchor"]["kind"]
}
```

It converts:

```txt
SourceField -> EvidenceItem<SourceEvidencePayload>
SourceMap   -> EvidenceItem<SourceEvidencePayload>[]
```

It may import:

```txt
anchored-evidence
source-anchor
document-source
json-schema types
```

It may not import:

```txt
viewer adapters
row components
OCR modules
leaf viewers
```

### `source-field-list.tsx`

Owns extraction row presentation.

It renders:

- label;
- value;
- source kind;
- missing source state;
- invalid source state;
- selected/active visual state.

It uses:

```txt
AnchoredItemList
FieldAnchorLink
EvidenceItem<SourceEvidencePayload>
```

It does not own:

- provider state;
- source-map conversion;
- PDF/image/csv/xlsx/docx rendering;
- OCR row presentation.

### `layout-blocks-model.ts`

Owns OCR/layout projection.

Ideal payload:

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

The ideal has separate pure functions:

```ts
createLayoutItemIndex(document)
filterLayoutItems(items, filter)
layoutItemToEvidenceItem(item, index)
layoutItemsToEvidenceModel(items, index)
```

Convenience wrappers are allowed only if they are thin.

`createLayoutBlocksViewerModel` may remain only if it is equivalent to:

```ts
const index = createLayoutItemIndex(document)
const visibleItems = filterLayoutItems(document.items, filter)
return layoutItemsToEvidenceModel(visibleItems, index)
```

No filtering rule should be hidden inside evidence projection.

It may import:

```txt
layout-blocks-types
layout-blocks-index
layout-blocks-geometry
anchored-evidence
```

It may not import:

```txt
React components
source-evidence
source-anchor
source-field-list
leaf viewers
```

### `layout-blocks-panel.tsx`

Owns OCR row presentation.

It renders:

- level;
- text;
- confidence;
- page hint;
- active/selected visual state;
- empty state.

It uses:

```txt
AnchoredItemList
EvidenceItem<LayoutEvidencePayload>
```

It does not own:

- filtering logic;
- geometry;
- provider state;
- source-map conversion;
- source row UI.

### `layout-blocks.tsx`

Owns the composed OCR experience.

It composes:

```tsx
<AnchoredDocumentProvider items={model.anchoredItems} target={target}>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSurface>{document}</ViewerSurface>
      <ViewerSidebar>{layoutPanel}</ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

It is allowed to know the page surface and the OCR panel.

It is not allowed to become a generic evidence shell.

## Dependency Graph

Allowed graph:

```txt
document-anchor
  <- anchored-document-viewer
  <- anchored-evidence
  <- source-anchor
  <- target adapters

anchored-document-viewer
  <- field-anchor-link
  <- composed source/OCR/edit/citation experiences

anchored-evidence
  <- source-evidence
  <- layout-blocks-model

anchored-item-list
  <- source-field-list
  <- layout-blocks-panel

source-anchor
  <- source-evidence

source-evidence
  <- source-field-list
  <- source blocks

layout-blocks-model
  <- layout-blocks-panel
  <- layout-blocks
```

Forbidden graph:

```txt
anchored-document-viewer -> source/*
anchored-document-viewer -> layout/*
anchored-document-viewer -> evidence/*
anchored-evidence        -> source/*
anchored-evidence        -> layout/*
anchored-item-list       -> source/*
anchored-item-list       -> layout/*
source-anchor            -> viewer adapters
source-evidence          -> viewer adapters
layout-blocks-model      -> React components
source-field-list        -> layout-blocks-panel
layout-blocks-panel      -> source-field-list
leaf viewers             -> anchored evidence state
```

## Ideal Composition

### Extraction

```tsx
const model = sourceMapToEvidenceModel({ sourceMap, values, schema })
const target = usePdfAnchoredTarget(pdfRef)
const link = useAnchoredFieldLink()

return (
  <AnchoredDocumentProvider items={model.anchoredItems} target={target}>
    <ViewerRoot>
      <ViewerBody>
        <ViewerSurface>
          <PdfViewer ref={pdfRef} source={source} bare />
        </ViewerSurface>
        <ViewerSidebar>
          <SourceFieldList items={model.evidenceItems} link={link} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </AnchoredDocumentProvider>
)
```

### OCR

```tsx
const index = createLayoutItemIndex(document)
const visibleItems = filterLayoutItems(document.items, filter)
const model = layoutItemsToEvidenceModel(visibleItems, index)
const target = usePdfAnchoredTarget(pdfRef)

return (
  <AnchoredDocumentProvider items={model.anchoredItems} target={target}>
    <ViewerRoot>
      <ViewerBody>
        <ViewerSurface>
          <PdfViewer ref={pdfRef} source={source} bare />
        </ViewerSurface>
        <ViewerSidebar>
          <LayoutBlocksPanel items={model.evidenceItems} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </AnchoredDocumentProvider>
)
```

The composition is intentionally repetitive.

That repetition is honest. It shows the spatial structure.

Do not hide it behind a universal shell.

## State Semantics

Provider contract:

```txt
preview item wins over selected item for active item derivation
selected item persists when preview clears
activation selects and scrolls
preview scrolls without selecting
selecting does not scroll unless activation is requested
disabled items cannot preview, select, activate, or scroll
missing anchors can be selected but do not scroll
invalid anchors are disabled
removed preview item clears preview
removed selected item clears selection
```

List contract:

```txt
hover previews
focus previews
blur clears preview
mouse leave clears preview
click activates
Enter activates
Space activates
Escape clears preview and selection
ArrowDown moves to next enabled row
ArrowUp moves to previous enabled row
Home moves to first enabled row
End moves to last enabled row
virtual rows are keyed by item id
row identity survives reorder
row identity survives filtering
zero-measure environments render deterministic fallback rows
```

## Anchor Semantics

Anchor resolution must preserve distinction:

```txt
resolved
  The row has a valid document location.

missing
  The domain item exists but has no source/anchor.

invalid
  The domain item has malformed or unsupported anchor data.
```

Provider projection:

```ts
function evidenceToAnchoredItem(item: EvidenceAnchor): AnchoredItem {
  return {
    id: item.id,
    anchor: item.anchor.status === "resolved" ? item.anchor.anchor : null,
    disabled: item.anchor.status === "invalid",
  }
}
```

Rows own copy.

Provider owns behavior.

## Accessibility Contract

`AnchoredItemList`:

- renders `role="listbox"`;
- renders each row trigger as `role="option"`;
- sets `aria-selected` from selected state only;
- sets `aria-disabled` for disabled rows;
- keeps disabled rows non-interactive;
- uses caller-provided `aria-label`;
- does not make active preview pretend to be selection;
- does not trap focus in empty state.

Domain panels:

- provide useful row labels;
- expose missing/invalid states in visible text or accessible labels;
- do not rely on color alone for confidence or invalidity;
- keep row content readable under virtualization.

## Registry Contract

Each registry item must install only what it needs.

Required items:

```txt
document-anchor
anchored-document-viewer
anchored-evidence
anchored-item-list
field-anchor-link
source-anchor
source-evidence
source-field-list
layout-blocks
```

Registry rules:

- `anchored-document-viewer` does not depend on source/OCR/evidence rows;
- `anchored-evidence` does not depend on source/OCR;
- `source-anchor` does not depend on viewer adapters;
- `source-evidence` depends on `source-anchor` and `anchored-evidence`;
- `source-field-list` depends on `source-evidence`, `field-anchor-link`, and
  `anchored-item-list`;
- `layout-blocks` owns OCR composition dependencies;
- generated `public/r/*` matches `registry.json`;
- `pnpm registry:build` passes;
- `pnpm registry:validate` passes.

## Test Contract

### Source Projection

Tests must prove:

- every supported source kind converts correctly;
- `pdf_bbox` becomes `pdf-area`;
- `image_bbox` becomes `image-area`;
- CSV/spreadsheet coordinates are validated and zero-based;
- text spans reject impossible ranges;
- docx anchors reject impossible ranges;
- invalid geometry does not produce impossible boxes;
- missing and invalid anchors stay distinct;
- source map field ids remain stable.

### OCR Projection

Tests must prove:

- layout item ids remain stable;
- page geometry converts to `pdf-area`;
- missing page becomes missing anchor;
- low-confidence filtering is separate from projection;
- filtering does not mutate canonical OCR items;
- confidence and page number live in typed payload;
- no source vocabulary is required.

### Provider

Tests must prove:

- preview beats selected;
- selected survives preview clear;
- activation scrolls smoothly by default;
- preview scrolls with auto behavior;
- missing anchors select without scrolling;
- disabled items do nothing;
- stale preview clears on item removal;
- stale selection clears on item removal.

### List

Tests must prove:

- hover/focus preview;
- leave/blur clear preview;
- click/Enter/Space activation;
- Escape clears preview and selection;
- keyboard movement skips disabled rows;
- zero-measure fallback renders all rows deterministically;
- row identity is keyed by id;
- reorder does not move row state to another item;
- filtering does not select by index.

### Architecture

Tests must prove:

- provider imports no source/OCR/evidence row modules;
- evidence imports no source/OCR modules;
- list imports no source/OCR modules;
- source-anchor imports no React and no viewer adapters;
- source-evidence imports source-anchor, not viewer adapters;
- layout-blocks-model imports no React components;
- field vocabulary appears only in field/form/source-edge modules;
- registry dependencies match import dependencies.

### Gates

The ideal is not reached unless these pass:

```txt
pnpm exec tsc --noEmit --pretty false
pnpm registry:build
pnpm registry:validate
focused Sources/OCR tests
architecture boundary tests
git diff --check
```

## Non-Goals

Do not:

- touch file-system;
- create a universal evidence viewer;
- create a universal source/OCR row;
- make `FileViewer` understand source maps;
- make `PdfViewer` understand anchored items;
- move field paths into the provider;
- make evidence canonical storage;
- centralize all overlay rendering;
- keep compatibility aliases after call sites are cut.

## Deletions Required For The Ideal

Delete:

- generic `metadata?: Record<string, unknown>` from evidence;
- `DocumentAnchor` definitions inside client provider files;
- provider exports containing field/path vocabulary;
- source projection imports of viewer adapters;
- OCR row casts from untyped metadata;
- any accidental local public surface that does not build under TypeScript.

## Completion Criteria

The platonic ideal is reached when:

- `DocumentAnchor` is pure and independent;
- provider is generic interaction only;
- evidence is payload-typed and has no metadata escape hatch;
- source projection is pure and adapter-free;
- OCR projection is pure and filter-separated;
- source and OCR panels share only list and provider behavior;
- source and OCR panels keep domain presentation separate;
- missing and invalid anchors are explicit;
- row identity and virtualization are proven;
- TypeScript passes globally;
- registry build and validation pass globally;
- architecture tests enforce the module graph;
- docs show explicit composition instead of hidden shells.

## Final Judgment

The ideal is small:

```txt
pure anchors
generic interaction
typed evidence
domain projection
domain rows
leaf viewer targets
explicit composition
```

Nothing else.
