# Sources/OCR Anchored Evidence Blueprint

## Objective

Define the next ideal step for sources and OCR without touching the file-system
viewer and without weakening the viewer primitive boundary.

The question is narrow:

```txt
Sources and OCR are structurally close. What could be better?
```

The answer is not another viewer shell.

The answer is a sharper domain projection layer over the existing anchored
document primitive.

## Verdict

Sources and OCR are in a good direction, but they are not perfect.

They already share the right interaction model:

```txt
semantic item -> document anchor -> preview/select/scroll/highlight
```

They do not yet share the right vocabulary.

Sources speak in:

```txt
SourceField
Source
SourceMap
FieldAnchorLink
JsonForm anchorLink
SourceFieldList
SourceIndicator
```

OCR speaks in:

```txt
LayoutItem
LayoutItemIndex
LayoutBlocksPanel
LayoutOverlayLayer
lowConfidenceOnly
visibleItems
```

The common thing exists, but it is implicit.

The platonic form should make the common thing explicit while keeping domain
rendering separate.

The strongest correction is not to merge Sources and OCR.

The strongest correction is to name the shared middle layer:

```txt
anchored evidence
```

That layer is small enough to be reused and specific enough to be useful. It is
not a viewer. It is not a file abstraction. It is not a document renderer. It is
a normalized description of semantic things that point into a document.

This matters because it prevents two bad outcomes:

- duplicated source/OCR interaction code;
- a giant "document intelligence viewer" abstraction that would leak into every
  component that happens to draw boxes.

## What Is Already Right

### Viewer Composition

The spatial composition is right:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSurface>{document}</ViewerSurface>
      <ViewerSidebar>{semanticItems}</ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

This should remain visible.

No hidden `<AnchoredEvidenceViewer />` should replace it as the conceptual
center.

### Anchored Provider Boundary

`AnchoredDocumentProvider` owns the correct generic state:

- preview item;
- selected item;
- active item;
- active anchor;
- activation;
- preview clearing;
- selection clearing;
- target scrolling.

It does not render a PDF, render OCR rows, render fields, know about JSON
schema, or own viewer layout.

That is correct.

### Domain Inputs

The existing domain inputs should remain domain-specific.

`Source` is the right shape for extraction provenance.

`LayoutItem` is the right shape for OCR output.

They should not be collapsed into one raw input type.

## The Missing Concept

The missing concept is:

```txt
evidence item
```

An evidence item is a semantic row that can point at a document location.

It is not the provider's primitive item. It is one level above it.

The provider primitive should remain austere:

```ts
type AnchoredItem = {
  id: AnchoredItemId
  anchor: DocumentAnchor | null
  disabled?: boolean
}
```

But Sources/OCR need a domain-facing projection shape:

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

This type should not replace `Source` or `LayoutItem`.

It should be a projection target:

```txt
SourceField -> EvidenceItem -> AnchoredItem
LayoutItem   -> EvidenceItem -> AnchoredItem
```

The important word is projection.

`EvidenceItem` must be derived, not canonical. The canonical records stay in
their domains:

```txt
extraction provenance -> Source / SourceMap
OCR/layout output     -> LayoutDocument / LayoutItem
viewer interaction    -> AnchoredItem
```

If `EvidenceItem` becomes the storage format for OCR or sources, the design has
gone wrong. It should be the shared interaction/display projection between
domain models and anchored viewer state.

## Anchor Resolution

`anchor: DocumentAnchor | null` is workable, but it loses useful information.

For the ideal Sources/OCR layer, the domain projection should distinguish:

```ts
type AnchorResolution =
  | { status: "resolved"; anchor: DocumentAnchor }
  | { status: "missing" }
  | { status: "invalid"; reason: string }
```

Then the generic provider can still receive:

```ts
function evidenceToAnchoredItem(item: EvidenceItem): AnchoredItem {
  return {
    id: item.id,
    anchor: item.anchor.status === "resolved" ? item.anchor.anchor : null,
    disabled: item.anchor.status === "invalid",
  }
}
```

This keeps provider state small while making the UI honest.

The sidebar can now render:

- resolved evidence;
- missing source;
- invalid source;
- disabled interaction;
- precise empty/error copy.

`SourceIndicator` can stop inferring all missing states from `path` and `found`.

## Naming Correction

`FieldAnchorLink` is too extraction-specific.

The provider already works for OCR blocks, edit issues, citations, and review
findings. The link object should not say "field".

Current conceptual shape:

```ts
type FieldAnchorLink = {
  activePath: string | null
  onFieldHover: (path: string | null) => void
  selectField?: (path: string) => void
}
```

Ideal generic shape:

```ts
type AnchoredItemLink = {
  activeItemId: string | null
  previewItem: (itemId: string | null) => void
  activateItem: (itemId: string) => void
}
```

Extraction-specific adapters can preserve field language at the edge:

```ts
function useFieldAnchorLink(): FieldAnchorLink {
  const link = useAnchoredItemLink()
  return {
    activePath: link.activeItemId,
    onFieldHover: link.previewItem,
    selectField: link.activateItem,
  }
}
```

But the core vocabulary should be item-based.

## Shared List Primitive

`SourceFieldList` and `LayoutBlocksPanel` should not become one component.

They have different content:

- sources show label/value/hint;
- OCR shows block kind/confidence/page/text;
- JSON form shows schema-driven controls;
- future validation panels may show errors and fixes.

But they should share a lower primitive for the interaction shell.

Ideal primitive:

```tsx
<AnchoredItemList
  items={items}
  activeItemId={activeItemId}
  selectedItemId={selectedItemId}
  onPreviewItem={previewItem}
  onActivateItem={activateItem}
  renderItem={(item) => <DomainRow item={item} />}
/>
```

Responsibilities:

- listbox semantics;
- active/selected data attributes;
- hover preview;
- focus preview;
- click activation;
- keyboard activation;
- clearing preview on blur/leave;
- optional virtualization;
- empty state shell.

Non-responsibilities:

- field values;
- OCR confidence copy;
- JSON schema;
- anchor conversion;
- PDF/image/text/csv/xlsx/docx target adapters.

## OCR Projection

OCR should have an explicit model function.

Current logic is spread across the component:

- convert Document AI output to layout document;
- create layout index;
- filter visible blocks;
- map visible blocks to anchored items;
- prepare PDF source;
- render overlay for page items;
- render panel rows.

Ideal projection:

```ts
type LayoutBlocksViewerModel = {
  document: LayoutDocument
  index: LayoutItemIndex
  visibleItems: readonly LayoutItem[]
  evidenceItems: readonly EvidenceItem[]
  anchoredItems: readonly AnchoredItem[]
}

function createLayoutBlocksViewerModel({
  document,
  lowConfidenceOnly,
  levels,
  threshold,
}: {
  document: LayoutDocument
  lowConfidenceOnly: boolean
  levels: readonly LayoutLevel[]
  threshold: number
}): LayoutBlocksViewerModel
```

This would make the React component read like composition:

```tsx
const model = createLayoutBlocksViewerModel(...)

<AnchoredDocumentProvider items={model.anchoredItems} target={target}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PdfViewerPages renderPageOverlay={renderOverlay(model)} />
      </ViewerSurface>
      <ViewerSidebar>
        <LayoutBlocksPanel items={model.evidenceItems} />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

The component should not be where the model is discovered.

## Sources Projection

Sources already have strong low-level anchor adapters:

- `pdfAnchorToTarget`;
- `imageAnchorToTarget`;
- `textAnchorToTarget`;
- `csvAnchorToTarget`;
- `xlsxAnchorToTarget`;
- `docxAnchorToTarget`.

The weakness is that each block repeats source-to-anchor projection.

Ideal projection:

```ts
function sourceToDocumentAnchor(source: Source): AnchorResolution
```

and:

```ts
function sourceFieldToEvidenceItem(field: SourceField): EvidenceItem
```

For JSON form sources:

```ts
function sourceMapToEvidenceItems({
  sourceMap,
  values,
  schema,
}: {
  sourceMap: SourceMap
  values?: Record<string, unknown>
  schema?: JSONSchema7
}): EvidenceItem[]
```

This should live near source utilities, not in every demo block.

Blocks should become examples of composition, not repeated domain plumbing.

## Overlay Model

OCR has `LayoutOverlayLayer`.

PDF sources have `usePdfAnchoredOverlay`.

These are parallel concepts:

```txt
active evidence item -> visual overlay in document surface
```

The ideal does not force one overlay renderer.

It does define one input:

```ts
type ActiveEvidence = {
  itemId: string
  anchor: DocumentAnchor
  state: "preview" | "selected"
}
```

Each leaf viewer adapter decides how to render it.

PDF may use `PdfHighlight`.

Image may use absolute frame overlays.

OCR may render many passive boxes plus one active/selected box.

Do not centralize overlay drawing.

Centralize only active evidence state.

## Accessibility Gaps

The current direction is good, but the ideal must lock:

- listbox/option semantics for all anchored evidence lists;
- exact `aria-selected`;
- active preview should not masquerade as selection;
- disabled invalid-anchor rows should expose disabled state;
- keyboard arrows should move between rows in long panels;
- Enter/Space should activate;
- Escape should clear preview or selection consistently;
- virtualized rows should preserve stable item identity;
- sidebar labels should be domain-specific.

The shared list primitive is where most of this belongs.

`SourceFieldList` and `LayoutBlocksPanel` should not each hand-roll slightly
different row interaction forever.

## Performance Rules

Sources/OCR can involve thousands of rows.

The ideal model should enforce:

- model projection in `useMemo`;
- stable ids;
- `Map` indexes where lookup is frequent;
- virtualization for large panels;
- overlays filtered per visible page;
- no full-tree recomputation on hover;
- no full PDF/source rerender on sidebar hover;
- anchor conversion done once per input change.

OCR already has panel virtualization.

Source field lists are small today, but the primitive should support
virtualization before large source maps force a redesign.

## Module Boundaries

Proposed modules:

```txt
anchored-document-viewer.tsx
  provider, state, item link, core anchor types

anchored-evidence.ts
  EvidenceItem, AnchorResolution, conversion to AnchoredItem

anchored-item-list.tsx
  generic row shell and listbox behavior

source-evidence.ts
  Source/SourceMap/SourceField -> EvidenceItem

layout-blocks-model.ts
  Document AI/LayoutDocument/LayoutItem -> EvidenceItem and AnchoredItem

layout-blocks-panel.tsx
  OCR-specific row rendering over AnchoredItemList

source-field-list.tsx
  field-specific row rendering over AnchoredItemList
```

The important boundary:

```txt
anchored-document-viewer.tsx must not import anchored-evidence.ts
```

The provider remains austere.

The evidence layer is optional sugar for Sources/OCR-style compositions.

## Current Issues To Fix

### 1. Sources Repeat Projection Logic

The source blocks currently tend to know too much:

```txt
block -> Source -> concrete anchor adapter -> AnchoredItem
```

That is not a good block responsibility. Blocks should demonstrate composition,
not carry conversion policy.

The conversion policy belongs in one source evidence module:

```txt
Source / SourceMap / SourceField -> EvidenceItem[]
```

Then every source block uses the same rules for:

- unsupported source kinds;
- missing sources;
- invalid source values;
- source labels;
- dotted JSON paths;
- source value formatting;
- stable ids.

### 2. OCR Builds Too Much Inside React

OCR has the opposite issue. It has the right data, but too much of the viewer
model is discovered inside the component body:

```txt
Document AI output
  -> layout document
  -> layout index
  -> filtered visible items
  -> anchored items
  -> panel rows
  -> overlay items
```

That should be a pure projection step:

```txt
LayoutDocument + filters -> LayoutBlocksViewerModel
```

React should compose the result. It should not be where the model boundary is
invented.

### 3. Field Language Leaks Into Generic Anchoring

`FieldAnchorLink` is useful for JSON/extraction forms, but it is the wrong core
name. OCR rows, source rows, citations, validation issues, and review comments
are not fields.

The generic link should be item-based:

```txt
activeItemId
previewItem
activateItem
```

Field-specific language can remain as an adapter at the form boundary. It
should not define the provider vocabulary.

### 4. Missing And Invalid Anchors Are Conflated

`anchor: null` is not enough in the domain layer.

There are three different cases:

- the source exists and resolves to a document location;
- the item has no source;
- the item has a source but the source is invalid or unsupported.

Those should not produce the same UI state.

The provider only needs `anchor | null`, but the evidence layer should preserve
the reason:

```txt
resolved -> interactive anchored row
missing  -> row can still exist, but no document jump
invalid  -> row is disabled or visibly broken
```

### 5. Source And OCR Lists Are Similar But Not Identical

`SourceFieldList` and `LayoutBlocksPanel` should not become one component. That
would destroy domain clarity.

They should share only the interaction chassis:

```txt
virtualized list
hover preview
focus preview
keyboard navigation
click activation
disabled rows
aria state
empty state
stable refs
```

They should keep separate row renderers.

This is the exact level of reuse: below presentation, above raw DOM events.

## Final Data Shapes

### Provider Primitive

This remains the smallest possible anchored interaction record:

```ts
type AnchoredItem = {
  id: string
  anchor: DocumentAnchor | null
  disabled?: boolean
}
```

It exists only so the provider can answer:

```txt
which item is active?
which anchor should be shown?
can this item be activated?
where should the document scroll?
```

No label. No value. No confidence. No source. No schema.

### Evidence Projection

This is the shared Sources/OCR display projection:

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

The field meanings should be strict:

- `id`: stable semantic id, not array index unless the source truly has no id;
- `anchor`: resolved/missing/invalid document location;
- `label`: short row title;
- `value`: extraction value or compact rendered value;
- `text`: OCR/layout text or long evidence text;
- `hint`: page/sheet/line/location summary;
- `kind`: machine-readable item class;
- `confidence`: normalized `0..1` confidence when applicable;
- `metadata`: escape hatch for original domain item, not general state.

`metadata` should not become a parallel model store. If a value is used by more
than one row renderer, it deserves a named field.

### Anchor Resolution

```ts
type AnchorResolution =
  | { status: "resolved"; anchor: DocumentAnchor }
  | { status: "missing" }
  | { status: "invalid"; reason: string }
```

This is the difference between honest UI and silent failure.

The provider receives:

```txt
EvidenceItem[] -> AnchoredItem[]
```

The panel receives:

```txt
EvidenceItem[]
```

The renderer receives:

```txt
active AnchoredItem -> leaf viewer overlay adapter
```

## Final Module Shape

The ideal module graph is intentionally one-way:

```txt
anchored-document-viewer.tsx
  exports provider, target, core anchor types, generic item link

anchored-evidence.ts
  imports anchored-document-viewer types
  exports EvidenceItem, AnchorResolution, evidenceToAnchoredItem

anchored-item-list.tsx
  imports no source/OCR modules
  exports generic list interaction primitive

source-evidence.ts
  imports source types and anchor adapters
  imports anchored-evidence
  exports source projection helpers

layout-blocks-model.ts
  imports layout types
  imports anchored-evidence
  exports OCR projection helpers

source-field-list.tsx
  imports source-evidence and anchored-item-list
  renders extraction/source rows

layout-blocks-panel.tsx
  imports layout-blocks-model and anchored-item-list
  renders OCR/layout rows
```

Forbidden imports:

```txt
anchored-document-viewer.tsx -> anchored-evidence.ts
anchored-document-viewer.tsx -> source-evidence.ts
anchored-document-viewer.tsx -> layout-blocks-model.ts
anchored-item-list.tsx      -> source-evidence.ts
anchored-item-list.tsx      -> layout-blocks-model.ts
source-evidence.ts          -> layout-blocks-model.ts
layout-blocks-model.ts      -> source-evidence.ts
```

That is the pollution guard.

The evidence layer may depend on the provider primitive. The provider primitive
must not depend on the evidence layer.

## Composition Examples

### Sources

```tsx
const model = sourceMapToEvidenceModel({ sourceMap, values, schema })

<AnchoredDocumentProvider items={model.anchoredItems} target={target}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSurface>{document}</ViewerSurface>
      <ViewerSidebar>
        <SourceFieldList fields={fields} />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

The source viewer stays explicit:

```txt
viewer composition is visible
source projection is centralized
row rendering remains source-specific
```

### OCR

```tsx
const model = createLayoutBlocksViewerModel({
  document,
  levels,
  lowConfidenceOnly,
  threshold,
})

<AnchoredDocumentProvider items={model.anchoredItems} target={target}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PdfViewer renderPageOverlay={renderLayoutOverlay(model)} />
      </ViewerSurface>
      <ViewerSidebar>
        <LayoutBlocksPanel items={model.evidenceItems} />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

The OCR viewer stays explicit:

```txt
OCR model owns OCR filtering
OCR panel owns OCR row copy
PDF surface owns PDF rendering
anchored provider owns interaction
```

## Overlay Rule

Do not create one universal overlay component.

The universal concept is the active evidence state. The overlay rendering is
leaf-viewer-specific:

- PDF renders page highlights;
- image renders normalized boxes;
- OCR renders passive layout boxes plus active state;
- text renders line ranges;
- CSV/XLSX renders cell state;
- DOCX renders paragraph/cell state.

The shared input is:

```txt
active item id -> active document anchor
```

The renderer remains local to the document surface.

That keeps the design fast and precise. Centralizing overlay drawing would be
false reuse.

## State Rules

The final behavior should be exact:

- hover previews an item;
- focus previews an item;
- click activates/selects an item;
- keyboard arrows move focus without losing row identity;
- Enter/Space activates;
- Escape clears preview first, then selection where the panel supports
  selection;
- disabled invalid rows cannot activate;
- missing-anchor rows may activate domain state but do not scroll the document;
- active preview takes visual priority over selected item;
- removing the active item clears active provider state;
- removing the selected item clears selected provider state;
- anchor conversion does not run during hover.

The most important invariant:

```txt
hover changes state, not model
```

If a hover recomputes source maps, OCR indexes, or anchored items, the boundary
is wrong.

## Performance Contract

This layer must be boringly fast.

Required properties:

- pure projection functions;
- memoized model creation at React boundaries;
- stable item ids;
- no object churn on hover;
- virtualized sidebars for OCR and large source maps;
- page-level overlay filtering;
- map/index lookup for repeated anchor access;
- no provider context value changes except actual interaction state changes;
- no leaf viewer remount caused by sidebar hover.

The design is not just about aesthetics. It is about preventing evidence-heavy
documents from making the whole viewer feel slow.

## Exact Cutover

This should be a hard cutover for Sources/OCR, not a compatibility maze.

Keep only these temporary allowances when strictly required by current public
APIs:

- `FieldAnchorLink` may survive as a thin adapter for JSON form fields;
- field words may survive in source-specific row components;
- existing block names can remain.

Remove or forbid:

- inline source-to-anchor conversion in source blocks;
- inline OCR anchored item construction in React render code;
- separate keyboard/list implementations for source rows and OCR rows;
- generic provider names that say `field`;
- domain imports from the anchored provider;
- a combined source/OCR viewer shell.

## Acceptance Criteria

### Data

- every source row can be represented as `EvidenceItem`;
- every OCR row can be represented as `EvidenceItem`;
- `EvidenceItem` converts losslessly enough to `AnchoredItem` for provider
  interaction;
- missing and invalid anchors are distinguishable;
- dotted/indexed JSON source paths stay stable;
- OCR ids remain stable under filtering.

### Components

- `SourceFieldList` uses the shared list primitive;
- `LayoutBlocksPanel` uses the shared list primitive;
- neither component owns provider internals;
- neither component knows how PDF/image/text/csv/xlsx/docx scrolling works;
- both components can render their rows without becoming one component.

### Architecture

- provider imports stay clean;
- source projection is centralized;
- OCR projection is centralized;
- viewer composition remains explicit in blocks;
- no file-system code changes are required;
- no file viewer changes are required.

### Tests

- model tests cover source field projection;
- model tests cover source map projection;
- model tests cover OCR projection;
- interaction tests cover shared list hover/click/keyboard behavior;
- architecture tests forbid forbidden imports;
- block tests prove source/OCR examples use the projection helpers.

## Honest Evaluation

This is not yet Flaubertian perfection if Sources and OCR still have:

- duplicated row event handling;
- repeated source-to-anchor mapping;
- provider APIs named after fields;
- `null` anchors with no reason;
- OCR model construction inside React;
- panel virtualization in only one branch;
- tests that verify screenshots but not model invariants.

It becomes a good design when the shared concept is exactly this:

```txt
EvidenceItem is the domain projection.
AnchoredItem is the provider primitive.
AnchoredItemList is the interaction primitive.
SourceFieldList and LayoutBlocksPanel are domain presentations.
```

It becomes an excellent design when that sentence is obvious from the file
tree.

## Migration Shape

This should be a hard conceptual migration, but not a broad UI rewrite.

1. Add `AnchoredItemLink` while keeping `FieldAnchorLink` as a thin field
   adapter only if needed by form APIs.

2. Add `AnchorResolution` and `EvidenceItem`.

3. Add `evidenceToAnchoredItem`.

4. Add source projection helpers:
   - `sourceToDocumentAnchor`;
   - `sourceFieldToEvidenceItem`;
   - `sourceMapToEvidenceItems`.

5. Add OCR projection helper:
   - `createLayoutBlocksViewerModel`.

6. Add `AnchoredItemList`.

7. Rebuild `SourceFieldList` and `LayoutBlocksPanel` on top of
   `AnchoredItemList`.

8. Update source/OCR blocks so their JSX remains visibly composed:

```tsx
<AnchoredDocumentProvider items={model.anchoredItems} target={target}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSurface />
      <ViewerSidebar />
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

Do not introduce a combined `SourcesOcrViewer`.

## Tests To Add

### Model Tests

- `SourceField -> EvidenceItem -> AnchoredItem`;
- `LayoutItem -> EvidenceItem -> AnchoredItem`;
- missing anchors stay selectable when appropriate;
- invalid anchors are disabled;
- confidence threshold filtering;
- stable ids after filtering;
- source map paths preserve dotted/indexed paths.

### Interaction Tests

- hover previews;
- blur clears preview;
- click activates;
- keyboard activation works;
- active item prefers preview over selected;
- removed selected item clears;
- removed preview item clears;
- disabled item cannot activate.

### Architecture Tests

- `AnchoredDocumentProvider` does not import evidence/domain modules;
- source blocks do not reimplement source-to-anchor conversion inline;
- OCR component does not build anchored items inline;
- `SourceFieldList` and `LayoutBlocksPanel` use the shared list primitive;
- viewer composition remains explicit.

## Anti-Goals

Do not:

- make `ViewerRoot` understand evidence;
- make `FileViewer` understand sources;
- make `PdfViewer` own source maps;
- make `AnchoredDocumentProvider` render panels;
- make `AnchoredDocumentProvider` know field labels or OCR confidence;
- collapse `Source` and `LayoutItem` into one input type;
- create a universal extraction/OCR viewer shell;
- use provider nesting to hide unclear data flow.

## Final Ideal

The final ideal is:

```txt
AnchoredDocumentProvider owns interaction.
Evidence projection owns domain-to-anchor rows.
Viewer primitives own spatial layout.
Leaf viewers own rendering.
Source/OCR panels own domain presentation.
```

Sources and OCR become the same where they should be the same:

```txt
anchored evidence interaction
```

They remain different where they should be different:

```txt
domain data, row rendering, overlays, filtering, copy
```

That is the sharper design.
