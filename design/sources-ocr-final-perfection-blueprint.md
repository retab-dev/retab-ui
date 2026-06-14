# Sources/OCR Final Perfection Blueprint

## Objective

Define the remaining work required for Sources/OCR anchored evidence to move
from a good design to the closest practical version of perfection.

This document does not reopen file-system work.

The scope is only:

```txt
Sources
OCR/layout blocks
Anchored evidence
Anchored document interaction
Source/OCR registry installability
```

## Verdict

We have reached the right architecture direction.

We have not reached perfection.

The current design is good because it has the correct split:

```txt
AnchoredDocumentProvider -> interaction primitive
EvidenceItem             -> domain projection
AnchoredItemList         -> list interaction primitive
SourceFieldList          -> source presentation
LayoutBlocksPanel        -> OCR presentation
Leaf viewers             -> rendering and overlays
```

The remaining imperfection is mostly physical, not conceptual.

The concepts are right. The module graph is not yet as pure as the concepts.

## Final Target

The final shape should make this sentence mechanically true:

```txt
Sources and OCR share evidence interaction, not domain model, rendering, or
viewer ownership.
```

The final module graph should make pollution difficult:

```txt
anchored-document-viewer.tsx
  no evidence imports
  no source imports
  no OCR imports
  no leaf viewer imports

anchored-evidence.ts
  pure evidence projection types
  conversion from EvidenceItem to AnchoredItem

anchored-item-list.tsx
  generic listbox behavior only
  no source/OCR names

source-anchor.ts
  pure Source -> DocumentAnchor conversion

source-evidence.ts
  SourceField/SourceMap -> EvidenceItem

layout-blocks-model.ts
  LayoutDocument/LayoutItem -> EvidenceItem

source-field-list.tsx
  source row rendering only

layout-blocks-panel.tsx
  OCR row rendering only
```

## What Is Already Right

### Provider Boundary

`AnchoredDocumentProvider` is still correctly austere.

It owns:

- preview item id;
- selected item id;
- active item;
- active anchor;
- activation;
- preview clearing;
- selection clearing;
- target scrolling.

It does not own:

- labels;
- values;
- OCR confidence;
- JSON schema;
- source maps;
- PDF/image/text/csv/xlsx/docx rendering.

This is the most important success.

### Evidence Projection

`EvidenceItem` is the right middle layer.

It is above provider state:

```txt
EvidenceItem -> AnchoredItem
```

It is below domain UI:

```txt
SourceFieldList renders source-flavored EvidenceItem rows
LayoutBlocksPanel renders OCR-flavored EvidenceItem rows
```

That is the correct level of abstraction.

### Shared List Primitive

`AnchoredItemList` is the right reuse point.

The duplicated thing was not the row design. The duplicated thing was:

- listbox shell;
- hover preview;
- focus preview;
- click activation;
- keyboard navigation;
- disabled row behavior;
- empty state structure;
- virtualization.

That is what should be shared.

### Source/OCR Separation

Sources and OCR should not collapse into one component.

They share:

```txt
semantic item -> anchor -> active document state
```

They do not share:

- canonical data;
- row copy;
- confidence semantics;
- overlay rendering;
- filtering controls;
- source-map rules.

The current direction preserves that.

## Remaining Imperfections

### 1. Source Projection Is Not Physically Pure Enough

`source-evidence.ts` is conceptually a projection module, but it currently
depends on source adapter modules that are also viewer-facing client modules.

That means the conceptual graph is cleaner than the physical graph.

The better shape is:

```txt
source-anchor.ts
  SourceAnchor -> DocumentAnchor
  pure TypeScript
  no React
  no hooks
  no overlay components
  no "use client"

pdf-source.tsx / image-source.tsx / text-source.tsx / ...
  viewer targets
  hooks
  overlays
  leaf viewer bridges

source-evidence.ts
  imports source-anchor.ts
  imports anchored-evidence.ts
```

The important correction:

```txt
Evidence projection should not import rendering adapters.
```

This is the biggest remaining purity gap.

### 2. PDF Source Semantics Are Ambiguous

The PDF adapter intentionally treats `image_bbox` as a PDF page-one target for
rendering image-backed sources inside a PDF-like surface.

That is useful for a viewer adapter.

It is not a good generic source projection rule.

Generic source projection must preserve source kind:

```txt
pdf_bbox   -> pdf-area
image_bbox -> image-area
```

The current implementation now dispatches by source kind, but the permanent
fix is to make this impossible to regress by moving the conversion into a pure
source-anchor module with exhaustive tests.

### 3. Field Vocabulary Still Exists In Public Core Surface

`FieldAnchorLink` remains because forms still consume field-flavored anchor
links.

That is acceptable today.

It is not perfect.

The ideal public vocabulary is:

```ts
type AnchoredItemLink = {
  activeItemId: string | null
  previewItem: (itemId: string | null) => void
  activateItem: (itemId: string) => void
}
```

Field vocabulary should live only at the source/form edge:

```ts
type FieldAnchorLink = {
  activePath: string | null
  onFieldHover: (path: string | null) => void
  selectField?: (path: string) => void
}
```

The final cut should remove `FieldAnchorLink` from the anchored provider file
or move it into a source/form adapter module:

```txt
anchored-document-viewer.tsx -> AnchoredItemLink only
field-anchor-link.ts        -> field adapter
```

This is not urgent, but it is the honest perfection gap.

### 4. AnchoredItemList Needs Harder Behavioral Proof

`AnchoredItemList` is the right primitive, but perfection requires stronger
proof.

It needs tests for:

- ArrowDown skips disabled rows or intentionally does not, with the rule named;
- ArrowUp from first row is stable;
- Home and End focus the first/last row;
- Enter activates focused row;
- Space activates focused row;
- Escape clears preview;
- Escape clears selection when the caller supports selection clearing;
- disabled rows cannot preview or activate;
- removed active row clears visual state;
- removed selected row clears visual state;
- virtualized rows preserve item identity;
- zero-measure environments render deterministic rows;
- row ids remain stable under filtering.

The primitive is good.

It is not yet proven enough to call perfect.

### 5. Accessibility Is Correct In Shape, Not Exhaustively Proven

The intended contract is:

```txt
role=listbox
role=option
aria-selected for selection
aria-disabled for invalid rows
keyboard navigation
domain-specific aria-label
```

The remaining work is to verify:

- screen reader names are useful and not concatenated badly;
- active preview does not pretend to be selected unless the caller really maps
  active to selected;
- disabled invalid rows communicate why they are disabled;
- empty states do not trap focus;
- virtualization does not hide focused rows unexpectedly.

The UI should be accessible by construction, not by accident.

### 6. Registry Build Is Not Globally Clean

The relevant Sources/OCR registry payloads are generated.

The full registry build is currently blocked by unrelated file-system registry
references.

That does not invalidate the Sources/OCR implementation, but perfection means
the whole registry can be rebuilt from scratch.

For this slice, the final acceptance requirement is:

```txt
pnpm registry:build
```

passes without relying on item-level partial builds.

This requires resolving unrelated registry breakage elsewhere, not changing
the Sources/OCR design.

### 7. Public Re-Export Shape Is Slightly Uneven

Local blocks import:

```ts
@/components/ui/source-evidence
```

via a re-export stub.

That matches the repo pattern, but the new primitives should have an explicit
decision:

- either only installed registry consumers import them;
- or local `components/ui/*` re-export stubs exist for every public primitive.

The final decision should be consistent for:

```txt
anchored-evidence
anchored-item-list
source-evidence
layout-blocks-model
```

Do not let accidental import paths define the public API.

## Desired Final File Tree

The final Sources/OCR slice should look like this:

```txt
registry/new-york-v4/ui/
  anchored-document-viewer.tsx
  anchored-evidence.ts
  anchored-item-list.tsx
  source-anchor.ts
  source-evidence.ts
  source-field-list.tsx
  layout-blocks-model.ts
  layout-blocks-panel.tsx
  layout-blocks.tsx
```

Optional adapter file if field vocabulary remains public:

```txt
registry/new-york-v4/ui/field-anchor-link.ts
```

The final dependency direction:

```txt
anchored-document-viewer
  <- anchored-evidence
  <- anchored-item-list consumers
  <- source-anchor
  <- source-evidence
  <- source-field-list

layout-blocks-types/geometry/index
  <- layout-blocks-model
  <- layout-blocks-panel
  <- layout-blocks
```

Forbidden direction:

```txt
anchored-document-viewer -> evidence/source/OCR
anchored-evidence        -> source/OCR/viewer rendering
anchored-item-list       -> source/OCR
source-anchor            -> React/hooks/overlays
source-evidence          -> hooks/overlays
layout-blocks-model      -> React components
```

## Exact Refactor Plan

### Step 1. Extract Pure Source Anchor Conversion

Create:

```txt
source-anchor.ts
```

Move pure conversion into it:

```ts
function sourceToDocumentAnchor(source: Source | null | undefined): AnchorResolution
```

or split lower:

```ts
function sourceAnchorToDocumentAnchor(
  source: Source
): DocumentAnchor | null
```

Rules:

- no `"use client"`;
- no React import;
- no hooks;
- no overlay components;
- exhaustive `switch` on `source.anchor.kind`;
- invalid source returns invalid reason at the evidence boundary.

Then `source-evidence.ts` becomes only:

```txt
SourceField/SourceMap -> EvidenceItem
```

### Step 2. Move Field Link Vocabulary Out Of Provider

Keep provider item vocabulary:

```txt
AnchoredItem
AnchoredItemLink
useAnchoredItemLink
```

Move field vocabulary to:

```txt
field-anchor-link.ts
```

or source/form-specific module.

The provider should no longer export names containing:

```txt
Field
Path
```

unless those names are actually generic document concepts.

### Step 3. Harden AnchoredItemList

Add explicit tests for:

- keyboard movement;
- activation keys;
- disabled rows;
- Escape clearing;
- dynamic removal;
- zero-measure fallback;
- virtualization identity.

Only after these tests pass should the primitive be considered stable enough
for more domains.

### Step 4. Clarify Selection Versus Preview

Today some source usage maps `activePath` to both active and selected state.

The final API should make callers choose:

```tsx
<AnchoredItemList
  activeItemId={activeItemId}
  selectedItemId={selectedItemId}
/>
```

For field adapters:

```txt
active field path can be preview or selected, but not silently both
```

This distinction matters for accessibility and visual semantics.

### Step 5. Add Full Architecture Guards

Add tests that assert:

- `anchored-document-viewer.tsx` imports no evidence/source/OCR modules;
- `anchored-evidence.ts` imports no source/OCR modules;
- `source-anchor.ts` imports no React and no `.tsx` modules;
- `source-evidence.ts` imports `source-anchor.ts`, not viewer adapters;
- source blocks import projection helpers, not low-level anchor adapters;
- OCR component imports `createLayoutBlocksViewerModel`;
- `LayoutBlocksPanel` and `SourceFieldList` import `AnchoredItemList`;
- registry items include every relative internal module they import.

### Step 6. Make Registry Build Global Again

The final proof is not item-level registry build.

The final proof is:

```txt
pnpm registry:build
pnpm registry:validate
```

passing from a clean working tree.

This may require unrelated registry repairs outside Sources/OCR, but the
Sources/OCR slice should not be considered perfectly shippable until global
registry generation is clean.

## Acceptance Criteria

### Conceptual

- Sources and OCR share only evidence interaction.
- Sources and OCR do not share canonical domain models.
- No universal Sources/OCR viewer shell exists.
- Viewer composition remains explicit.
- Provider state remains generic and small.

### Data

- every supported source kind maps through a pure source-anchor function;
- missing and invalid anchors remain distinguishable;
- `EvidenceItem` remains derived data;
- `AnchoredItem` remains provider data;
- OCR layout item ids remain stable under filtering;
- source map dotted/indexed paths remain stable.

### Module Graph

- provider imports no evidence/domain modules;
- evidence imports no source/OCR modules except through deliberate projection
  modules;
- source projection imports no React hooks or overlay renderers;
- list primitive imports no source/OCR modules;
- OCR model imports no React components;
- row presentation components import only the shared list primitive and their
  domain model.

### Tests

- source projection tests pass;
- OCR projection tests pass;
- provider tests pass;
- anchored list interaction tests pass;
- architecture tests pass;
- TypeScript passes;
- full registry build passes once unrelated registry breakage is removed.

## Non-Goals

Do not:

- touch file-system to improve this slice;
- merge Sources and OCR into one component;
- make `ViewerRoot` understand evidence;
- make `FileViewer` understand source maps;
- centralize overlay rendering across PDF/image/text/csv/xlsx/docx;
- hide composition behind a universal evidence viewer;
- keep compatibility shims for old field vocabulary once call sites are cut.

## Final Judgment

The current implementation is good.

The abstraction is not a dead end.

The provider system works because it owns interaction state and nothing else.

The remaining path to perfection is precise:

```txt
make projection physically pure,
remove field vocabulary from the provider,
prove AnchoredItemList deeply,
make registry generation globally clean.
```

If those are done, the Sources/OCR design will be close to the platonic ideal:

```txt
simple enough to read,
generic only where generic is true,
specific where the domain is specific,
fast by construction,
and hard to misuse.
```
