# Anchored Document Platonic Ideal Blueprint

## Objective

Define the final ideal for anchored document experiences after the first
feasibility test.

The standard is perfection:

- simple;
- fast;
- complete;
- no unnecessary concepts;
- no layout pollution;
- no duplicate interaction state;
- precise names;
- precise module boundaries;
- one inevitable API.

The component family should make extraction sources, OCR blocks, edit fields,
citations, validation issues, and review findings feel like one thing:

```txt
semantic items anchored into a document
```

## Judgment From The Test

The worktree proof showed the abstraction is possible for the two most important
PDF cases:

```txt
PDF extraction fields
OCR layout blocks
```

Both can share:

- active item state;
- selected item state;
- hover preview;
- click selection;
- scroll-to-anchor;
- viewer primitive layout;
- a PDF target adapter.

The proof also showed a real deletion:

```txt
useLayoutBlockSelection
```

That matters. A good abstraction should delete a domain-specific state machine,
not merely wrap it.

But the proof is not the platonic ideal. It is still too narrow, too thin, and
too adapter-shaped.

## Final Position

The ideal stack is:

```txt
Viewer primitives
  own layout

Leaf viewers
  render files

Anchor targets
  adapt anchors to leaf viewer handles and render hooks

AnchoredDocumentProvider
  owns item interaction state

Domain adapters
  project extraction, OCR, edit, citations, validation into anchored items
```

There should be no other shared shell for this family.

## The One Sentence

An anchored document viewer is a composition where a side panel of semantic
items controls highlights and navigation in a document surface.

If a component does not match that sentence, it should not use
`AnchoredDocumentProvider`.

## Core JSX

The ideal composition remains visibly spatial:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSurface>{document}</ViewerSurface>
      <ViewerSidebar>{items}</ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

Nothing important should be hidden behind:

```tsx
<AnchoredDocumentViewer layout="right-sidebar" />
```

or:

```tsx
<PdfViewer anchoredItems={items} />
```

## Primitive Ownership

### Viewer Primitives

Own:

- frame;
- header position;
- body split;
- sidebar position;
- document surface position.

Do not own:

- items;
- anchors;
- selection;
- hover;
- source maps;
- OCR blocks;
- field values.

### Leaf Viewers

Own:

- file/resource rendering;
- format loading;
- imperative scroll handles;
- format-native overlays/highlights.

Do not own:

- anchored item state;
- source maps;
- side panels;
- OCR block lists;
- extraction forms.

### Anchor Targets

Own:

- converting `DocumentAnchor` into leaf viewer scroll calls;
- converting active/selected state into leaf viewer overlay/highlight props.

Do not own:

- item labels;
- field values;
- OCR confidence filtering;
- layout;
- sidebar rows.

### AnchoredDocumentProvider

Owns:

- item registry;
- active item;
- selected item;
- active anchor;
- preview action;
- select action;
- activate/navigate action;
- clearing invalid selection when items disappear.

Does not own:

- rendering a PDF;
- rendering an image;
- rendering a JSON form;
- rendering OCR rows;
- filters;
- grouping;
- tabs;
- layout.

### Domain Adapters

Own:

- domain-to-item projection;
- labels;
- values;
- confidence;
- severity;
- grouping;
- domain-specific empty states.

Do not own:

- generic hover/select/scroll semantics;
- generic active/selected conflict rules;
- leaf viewer internals.

## Public Core API

The final core should be small.

```ts
type AnchoredItemId = string

type AnchoredItem = {
  id: AnchoredItemId
  anchor: DocumentAnchor | null
  disabled?: boolean
}
```

This is intentionally austere.

Do not add `label`, `value`, `confidence`, `severity`, or `group` until there is
proof that generic parts need those fields. Domain side panels can keep domain
objects in their own arrays and join by `id`.

The provider API:

```ts
type AnchoredDocumentState = {
  items: readonly AnchoredItem[]
  activeItemId: AnchoredItemId | null
  selectedItemId: AnchoredItemId | null
  activeItem: AnchoredItem | null
  selectedItem: AnchoredItem | null
  activeAnchor: DocumentAnchor | null
}
```

Actions:

```ts
type AnchoredDocumentActions = {
  previewItem: (itemId: AnchoredItemId | null) => void
  selectItem: (itemId: AnchoredItemId | null) => void
  activateItem: (
    itemId: AnchoredItemId,
    options?: { behavior?: ScrollBehavior }
  ) => void
  clearPreview: () => void
  clearSelection: () => void
  clear: () => void
}
```

## State Semantics

There should be exactly one active rule:

```txt
previewed item wins
else selected item
else null
```

Hover and focus create preview.

Click and keyboard activation create selection.

Leaving hover clears preview and restores selected highlight.

Filtering out the selected item clears selection.

Filtering out the previewed item clears preview.

Disabled items cannot activate.

Items without anchors can select, but cannot navigate.

These rules should not be reimplemented by extraction, OCR, edit, or citations.

## Anchor Model

The final anchor model should be closed enough to be useful and open enough to
cover real document formats.

```ts
type DocumentAnchor =
  | PdfAreaAnchor
  | ImageAreaAnchor
  | TextRangeAnchor
  | CsvCellAnchor
  | XlsxCellAnchor
  | DocxTargetAnchor
```

PDF:

```ts
type PdfAreaAnchor = {
  kind: "pdf-area"
  pageNumber: number
  left: number
  top: number
  width: number
  height: number
}
```

Use one coordinate convention:

```txt
percent in rendered page coordinates
```

Do not mix normalized `0..1`, percent `0..100`, and page-space pixels in the
same public anchor type.

If upstream data is normalized, normalize it in the adapter:

```txt
Source -> DocumentAnchor
Document AI polygon -> DocumentAnchor
Edit field bbox -> DocumentAnchor
```

Image:

```ts
type ImageAreaAnchor = {
  kind: "image-area"
  frameNumber?: number
  left: number
  top: number
  width: number
  height: number
}
```

Text:

```ts
type TextRangeAnchor = {
  kind: "text-range"
  startLine: number
  endLine: number
}
```

CSV:

```ts
type CsvCellAnchor = {
  kind: "csv-cell"
  rowIndex: number
  columnIndex: number
}
```

XLSX:

```ts
type XlsxCellAnchor = {
  kind: "xlsx-cell"
  sheetIndex: number
  rowIndex: number
  columnIndex: number
}
```

DOCX:

```ts
type DocxTargetAnchor = {
  kind: "docx-target"
  target: DocxTarget
}
```

## Naming

Use these names everywhere in the shared layer:

```txt
item
anchor
target
preview
active
selected
activate
```

Avoid these names in the shared layer:

```txt
source
field
block
highlight
pin
hovered
current
focus
```

Domain adapters may use domain words at their boundary:

```txt
extraction field
OCR block
edit field
citation
validation issue
```

But once data crosses into the shared layer, it is an item with an anchor.

## Target API

The target API should be precise and minimal:

```ts
type AnchoredDocumentTarget = {
  scrollToAnchor: (
    anchor: DocumentAnchor,
    options: { behavior: ScrollBehavior }
  ) => void
}
```

Overlay/highlight should not necessarily live on the target object. The proof
used target-adjacent helpers, which is cleaner:

```ts
usePdfAnchoredTarget(viewerRef)
usePdfAnchoredOverlay(items)
useTextAnchoredHighlight()
useCsvAnchoredCell()
```

This avoids a target object becoming an all-purpose rendering bag.

## PDF Overlay Ideal

PDF overlays need two modes:

```txt
passive
interactive
```

Passive:

- renders active/selected anchor only;
- no pointer handlers;
- used by extraction source fields.

Interactive:

- renders all visible page items;
- hover previews;
- click selects;
- used by OCR blocks and edit fields.

The ideal API:

```tsx
const renderPageOverlay = usePdfAnchoredOverlay({
  mode: "interactive",
  pageItems,
})
```

or:

```tsx
const renderPageOverlay = usePdfAnchoredOverlay({
  mode: "active",
})
```

Do not force extraction and OCR to use separate overlay implementations when
the geometry is the same.

## Source Link Relationship

`useSourceLink` is not the final ideal for anchored document experiences.

It is a useful older abstraction:

```txt
SourceMap + field path + source target
```

The final ideal is:

```txt
AnchoredItem[] + item id + document target
```

`JsonForm` should eventually accept a smaller generic adapter:

```ts
type FieldAnchorLink = {
  activePath: string | null
  onFieldHover: (path: string | null) => void
  selectField: (path: string) => void
}
```

That adapter can be produced from `AnchoredDocumentProvider`.

Do not let the shared anchored layer depend conceptually on extraction
`SourceMap`. Source maps are one domain input, not the core model.

## Domain Projections

### PDF Extraction

Projection:

```txt
ExtractField[] -> AnchoredItem[]
SourceMap -> field form adapter
```

Layout:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSurface>
        <PdfViewer renderPageOverlay={overlay} />
      </ViewerSurface>
      <ViewerSidebar>
        <JsonForm />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

### OCR

Projection:

```txt
Document AI blocks -> AnchoredItem[]
```

OCR owns:

- block text;
- confidence;
- low-confidence filter;
- level filter;
- row rendering.

Anchored document owns:

- active block;
- selected block;
- scroll;
- page overlay active/selected semantics.

### Edit

Projection:

```txt
Edit fields -> AnchoredItem[]
```

Edit owns:

- source/filled mode;
- field values;
- validation;
- edit controls;
- field panel copy;
- fill status.

Anchored document owns:

- field hover;
- selected field;
- scroll to field bbox;
- active overlay semantics.

Edit is the real final exam. If edit can use the same model without special
cases, the abstraction is probably right.

### Multi-Format Extraction

Do not migrate this first.

The ideal migration order is:

```txt
PDF extraction
OCR
Edit
multi-format extraction
```

Multi-format extraction should prove target adapters, not provider semantics.

Each format becomes:

```txt
Source -> DocumentAnchor
DocumentAnchor -> leaf viewer adapter
```

## Public Parts

Core:

```txt
AnchoredDocumentProvider
useAnchoredDocument
```

Target helpers:

```txt
usePdfAnchoredTarget
usePdfAnchoredOverlay
sourceToPdfAnchor
layoutItemToPdfAnchor
```

Generic list parts are suspicious.

Do not add:

```txt
AnchoredItemList
AnchoredItemRow
AnchoredDocumentHeader
AnchoredDocumentSidebar
```

until there is proof that extraction, OCR, edit, and citations need the same
visual row. Today they do not. They need the same state, not the same list UI.

## What To Delete

The ideal implementation should delete duplicated state machines:

```txt
useLayoutBlockSelection
source-link hover/pin state for extraction blocks
edit-viewer selected/hovered field bbox state
ad hoc scroll-to-bbox helpers in domain viewers
```

Do not keep old hooks as compatibility paths.

If the shared provider is right, domain-specific selection hooks disappear.

## What Not To Touch

Do not add anchored-document imports to:

```txt
PdfViewer
FileViewer
ImageViewer
TextViewer
CodeViewer
CsvViewer
XlsxViewer
DocxViewer
ViewerRoot
```

Do not add anchored props to leaf viewers:

```txt
anchoredItems
anchors
sourceMap
selectedItemId
activeItemId
onItemSelect
```

Leaf viewers should stay independently useful.

## Speed

The provider must be cheap:

- item lookup by memoized `Map`;
- no deep item diffing;
- no layout measurement;
- no document parsing;
- no per-page overlay computation in provider;
- no rerendering leaf viewers for unrelated side panel state if avoidable.

Overlay helpers should filter by page outside hot render loops when possible.

Side panels with many items should virtualize in the domain panel, not in the
provider.

## Accessibility

The provider should support accessible behavior but not dictate markup.

Domain panels should render:

- buttons for selectable rows;
- form controls for fields;
- `aria-selected` where listbox semantics are used;
- focus preview;
- keyboard activation;
- disabled state for unavailable anchors.

Interactive overlays should only be keyboard focusable when they are intended
as real controls. Passive overlays should be `aria-hidden`.

## Tests Required For The Ideal

Core provider:

- preview item overrides selected item;
- clearing preview restores selected item;
- selecting item clears preview;
- selecting item navigates with smooth behavior;
- previewing item navigates with auto behavior;
- disabled item cannot navigate;
- item without anchor can select but not navigate;
- removed selected item clears selection;
- removed preview item clears preview.

Containment:

- leaf viewers do not import anchored-document;
- viewer primitives do not import anchored-document;
- `FileViewerProps` has no anchored props;
- `PdfViewerProps` has no anchored props.

PDF target:

- `pdf-area` calls `scrollToPageArea`;
- invalid anchor kind is ignored;
- active overlay renders only on matching page;
- interactive overlay previews and selects items.

Extraction:

- form hover previews anchor;
- form click selects anchor;
- missing anchor shows missing indicator;
- selected anchor survives unrelated hover.

OCR:

- row hover previews block;
- row click selects block;
- overlay hover previews block;
- overlay click selects block;
- low-confidence filtering clears invalid selection.

Edit:

- field panel and overlay share active/selected state;
- switching document mode preserves selected field when valid;
- editing values does not reset anchor state.

## Success Criteria

The ideal is reached only when:

- PDF extraction and OCR share provider and PDF target;
- OCR-specific selection hook is deleted;
- extraction-specific hover/pin state is replaced or isolated as a thin adapter;
- edit fields use the same provider without awkward special cases;
- multi-format extraction uses target adapters without changing provider;
- leaf viewers remain clean;
- viewer primitives remain clean;
- names are consistent across provider, adapters, and tests;
- every exported part has a demonstrated use;
- every duplicated state machine is gone.

## Failure Criteria

The design has failed if:

- provider grows layout props;
- provider grows domain filters;
- provider imports PDF/image/text viewers;
- leaf viewers import provider;
- every target needs domain-specific branching;
- edit viewer cannot use the model cleanly;
- extraction and OCR still duplicate hover/select/scroll logic;
- generic row/list parts appear before there is visual convergence.

## Implementation Path

1. Keep the PDF extraction + OCR proof in the test worktree.
2. Tighten names:
   - `pdf-area`, not mixed `pdf-bbox` / `pdf-location`;
   - `previewItem`, not `setActiveItemId`;
   - `selectItem`, not `pinField`;
   - `target`, not `sourceTarget` in the shared layer.
3. Extract a real PDF overlay helper that supports passive and interactive
   modes.
4. Remove `useAnchoredSourceLink` as a conceptual dependency by creating a
   smaller `JsonForm` field-anchor adapter.
5. Migrate edit viewer as the final proof.
6. Only then decide whether multi-format extraction should use the same core for
   image, text, CSV, XLSX, and DOCX.

## Final Ideal

The final implementation should feel boring:

```tsx
const items = domainToAnchoredItems(domain)
const target = usePdfAnchoredTarget(viewerRef)
const overlay = usePdfAnchoredOverlay({ mode: "interactive", items })

return (
  <AnchoredDocumentProvider items={items} target={target}>
    <ViewerRoot>
      <ViewerHeader />
      <ViewerBody>
        <ViewerSurface>
          <PdfViewer ref={viewerRef} bare renderPageOverlay={overlay} />
        </ViewerSurface>
        <ViewerSidebar>
          <DomainPanel />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </AnchoredDocumentProvider>
)
```

No magic.

No hidden layout.

No format pollution.

No duplicate selection state.

No compatibility shell.

One precise shared idea:

```txt
semantic items anchored into a document
```
