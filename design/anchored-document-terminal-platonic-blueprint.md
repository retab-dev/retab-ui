# Anchored Document Terminal Platonic Blueprint

## Verdict

We have not reached the platonic ideal yet.

We have reached the right architectural direction.

The provider is not a dead end. A universal viewer provider would be a dead end.
An anchored-document provider is correct because it owns one coherent state
machine:

```txt
semantic item <-> document anchor
```

The danger is not the provider itself. The danger is letting the provider become
the conceptual center of the viewer system. It must not own layout, files,
source maps, rendering, sidebars, tabs, MIME trees, PDF pages, OCR filtering, or
field values.

The platonic form is:

```txt
Viewer primitives
  own spatial grammar

Leaf viewers
  render files

Anchor targets
  adapt anchors to a leaf viewer

AnchoredDocumentProvider
  owns hover, selection, activation, and active anchor state

Domain compositions
  project real domain objects into anchored items
```

Anything outside that sentence is suspect.

## The Exact Problem

Extraction sources and OCR blocks are almost the same problem.

They are not the same because their domain rows differ:

```txt
extraction
  fields, values, schema paths, confidence, source evidence

OCR
  detected blocks, text, block type, hierarchy, confidence, page geometry
```

They are the same because their viewer interaction is identical:

```txt
hover row -> preview document region
click row -> select document region
active region -> highlight and scroll
clear row -> clear preview
removed item -> clear invalid state
```

The shared abstraction should cover only the second list.

If it covers the first list, it pollutes the component library.

## Terminal Rule

The shared abstraction is allowed to know:

```txt
item id
anchor
disabled state
active state
selected state
target navigation
```

It is not allowed to know:

```txt
source maps
JSON schema paths
MIME parts
PDF files
OCR block types
email attachments
validation severities
field values
sidebars
tabs
forms
```

This rule is the difference between a useful provider and a swamp.

## Ideal Public Core

The core type surface should be small enough to memorize.

```ts
type AnchoredItemId = string

type DocumentAnchor =
  | {
      kind: "pdf-area"
      pageNumber: number
      left: number
      top: number
      width: number
      height: number
    }

type AnchoredItem = {
  id: AnchoredItemId
  anchor: DocumentAnchor | null
  disabled?: boolean
}

type AnchoredDocumentTarget = {
  scrollToAnchor: (
    anchor: DocumentAnchor,
    options: { behavior: ScrollBehavior }
  ) => void
}
```

The state exposed by the provider should be:

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

The actions should be:

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

There should not be a second synonym for these concepts.

Do not add:

```txt
hoveredItemId
focusedItemId
pinnedItemId
sourceId
activeSource
selectedAnchor
highlightedItemId
targetItemId
```

unless the product proves a genuinely different state.

## Active State Rule

There is one rule:

```txt
previewed item wins
else selected item wins
else null
```

That gives:

```txt
hover preview
stable click selection
predictable keyboard activation
no duplicate highlight state
```

Disabled items cannot become active.

Items without anchors can be selected, but cannot navigate.

## Provider Semantics

The provider should enforce these invariants:

- `activeItem` is always an item from `items` or `null`;
- `selectedItem` is always an item from `items` or `null`;
- disabled items are ignored by preview and activation;
- selection is cleared when the selected item disappears;
- preview is cleared when the previewed item disappears;
- `activeAnchor` is `activeItem.anchor` when present, else `null`;
- navigation happens only through `activateItem` and target adapters.

The provider should not render UI.

The provider should not import viewer primitives.

The provider should not import `PdfViewer`.

The provider should not import extraction source utilities.

## Layout Grammar

Every composed anchored viewer should remain readable as JSX.

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <ViewerRoot>
    <ViewerHeader>{header}</ViewerHeader>
    <ViewerBody>
      <ViewerSidebar>{semanticItems}</ViewerSidebar>
      <ViewerSurface>{documentViewer}</ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</AnchoredDocumentProvider>
```

No hidden compound shortcut should replace this as the conceptual model.

Wrong:

```tsx
<AnchoredDocumentViewer
  items={items}
  source={source}
  sidebar="right"
  renderItem={renderItem}
/>
```

Wrong:

```tsx
<PdfViewer source={source} anchoredItems={items} />
```

Wrong:

```tsx
<FileViewer source={source} sourceMap={sources} />
```

## PDF Target

PDF is the first proven anchor target.

It should own:

- conversion from `pdf-area` anchors to page rectangles;
- scroll-to-page-and-rectangle behavior;
- active highlight rendering;
- interactive region rendering when a domain needs region clicks.

It should not own:

- extraction field labels;
- OCR row rendering;
- source path mapping;
- sidebar grouping;
- provider state.

The target API should feel like this:

```ts
const target = usePdfAnchoredTarget(pdfViewerRef)
const overlay = usePdfAnchoredOverlay({ mode: "active" })
```

For OCR:

```ts
const overlay = usePdfAnchoredOverlay({
  mode: "interactive",
  items,
  getItemLabel,
})
```

This is the important compression:

```txt
extraction passive overlay
OCR interactive overlay
same anchor model
same provider state
same PDF geometry
```

## Extraction Composition

Extraction should adapt source maps at the edge.

The anchored core must not import `SourceMap`.

Correct:

```tsx
const items = extractionSourcesToAnchoredItems(sources)
const fieldLink = useAnchoredFieldLink()

<AnchoredDocumentProvider items={items} target={target}>
  <ViewerBody>
    <ViewerSurface>
      <PdfViewer
        ref={pdfViewerRef}
        source={source}
        renderPageOverlay={overlay}
      />
    </ViewerSurface>
    <ViewerSidebar>
      <JsonForm sourceLink={fieldLink} />
    </ViewerSidebar>
  </ViewerBody>
</AnchoredDocumentProvider>
```

The form adapter can speak in schema paths because the form is a domain
component. The provider should only see those paths as item ids.

## OCR Composition

OCR should project visible document blocks into anchored items.

Correct:

```tsx
const items = layoutBlocksToAnchoredItems(visibleBlocks)
const overlay = usePdfAnchoredOverlay({
  mode: "interactive",
  items,
  getItemLabel: getBlockLabel,
})

<AnchoredDocumentProvider items={items} target={target}>
  <ViewerHeader>{controls}</ViewerHeader>
  <ViewerBody>
    <ViewerSurface>
      <PdfViewer
        ref={pdfViewerRef}
        source={source}
        renderPageOverlay={overlay}
      />
    </ViewerSurface>
    <ViewerSidebar>
      <LayoutBlocksPanel blocks={visibleBlocks} />
    </ViewerSidebar>
  </ViewerBody>
</AnchoredDocumentProvider>
```

OCR should not keep a second `useLayoutBlockSelection` state machine.

The panel may own filters and row rendering. It should not own the generic
hover/select/scroll contract.

## Multi-Format Extraction

Multi-format extraction should prove target adapters, not provider complexity.

The provider should stay unchanged when adding:

```txt
image region target
text range target
CSV cell target
XLSX cell target
DOCX range target
```

Each target adapts the same abstract relationship:

```txt
semantic item -> document anchor -> visible focus/highlight
```

If adding a new format requires provider props, the abstraction is wrong.

The only acceptable provider change is adding a genuinely new anchor kind after
two or more targets prove it cannot be represented by the existing kind.

## Email Viewer

Email is not an anchored-document viewer by default.

Email is a recursive file composition:

```txt
message header
message body
MIME part sidebar
selected part file viewer
```

The ideal email layout is:

```tsx
<ViewerRoot>
  <ViewerHeader>
    <EmailHeader />
  </ViewerHeader>
  <ViewerBody>
    <ViewerSidebar>
      <EmailPartsSidebar />
    </ViewerSidebar>
    <ViewerSurface>
      <FileViewer source={selectedPartSource} />
    </ViewerSurface>
  </ViewerBody>
</ViewerRoot>
```

Email should use anchored-document only if a semantic item points into a rendered
message body region. Attachments and MIME parts alone are not anchors.

This distinction matters. It prevents the provider from becoming a general
selection store for every compound viewer.

## Dropzone

Dropzone is not an anchored-document primitive.

Dropzone produces files or sources. Viewers consume sources. Anchored document
compositions may consume sources and semantic items.

Correct dependency:

```txt
Dropzone -> source acquisition
FileViewer -> source rendering
AnchoredDocumentProvider -> semantic item interactions
Domain viewer -> composes all of the above
```

Wrong dependency:

```txt
Dropzone knows anchored items
FileViewer knows upload state
AnchoredDocumentProvider knows files
```

The dropzone belongs before the viewer composition, not inside the anchored
state model.

## Why This Is Shadcn-Compliant

The shadcn pattern is not "compound components always."

The pattern is:

```txt
small copyable primitives
explicit composition
local ownership
escape by editing code, not by giant prop APIs
```

This design is compliant because:

- primitives are named exports, not magical dot namespaces;
- JSX shows the real layout;
- domain providers exist only where separated parts need shared state;
- the provider owns behavior, not visual hierarchy;
- leaf viewers remain independently useful;
- domain compositions are copyable examples, not mandatory framework classes.

The dots question resolves here:

```txt
AnchoredDocumentProvider
useAnchoredDocument
usePdfAnchoredTarget
usePdfAnchoredOverlay
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Separate named exports are clearer for this library.

## What To Delete

The ideal implementation should delete:

- OCR-only selection state;
- extraction-only hover/pin state that duplicates provider state;
- source-link state embedded in anchored core;
- PDF overlay code duplicated between extraction and OCR;
- nested viewer cards inside viewer surfaces;
- compound wrappers that only hide `ViewerRoot` composition;
- props that exist only for backward compatibility.

Deletion is the proof.

## What Not To Build

Do not build:

- `ViewerProvider`;
- `FileViewerProvider`;
- `ViewerShell` as the conceptual center;
- `AnchoredDocumentViewer` as a universal renderer;
- `PdfViewer.ThumbnailSidebar` style namespace APIs;
- source-map support inside `FileViewer`;
- anchor support inside every leaf viewer "just in case";
- render-prop mega components with twenty slots.

These all make the library look more powerful while making the architecture less
true.

## Implementation Order

1. Finalize the anchored core API.
2. Make `selectItem` state-only and `activateItem` state-plus-navigation.
3. Remove source-map imports from anchored core.
4. Replace source-link coupling with a thin field adapter.
5. Build one PDF target adapter.
6. Build one PDF overlay helper with passive and interactive modes.
7. Migrate PDF extraction to the passive overlay.
8. Migrate OCR to the interactive overlay.
9. Delete OCR-only selection state.
10. Add architecture tests forbidding anchored imports in leaf viewers.
11. Add behavior tests for preview, selection, activation, disabled items, and
    missing anchors.
12. Only then evaluate multi-format extraction targets.

Do not start by generalizing every file format.

Start by making PDF extraction and OCR perfect.

## Tests That Matter

Core state:

- preview wins over selection;
- clearing preview restores selection as active;
- disabled items do not activate;
- missing anchors can select but do not navigate;
- removed items clear invalid state.

PDF target:

- activation scrolls to the correct page area;
- passive overlay renders exactly the active anchor;
- interactive overlay renders visible page items;
- hover previews an item;
- click activates an item.

Architecture:

- leaf viewers do not import anchored-document code;
- viewer primitives do not import anchored-document code;
- anchored core does not import `SourceMap`;
- extraction and OCR share the provider;
- extraction and OCR share the PDF target;
- OCR-specific selection state is gone.

## Platonic Acceptance Criteria

We can say this component family has reached the platonic ideal when all of this
is true:

- a reader can understand every composed viewer by reading the JSX hierarchy;
- `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`, and
  `ViewerSurface` remain the only generic spatial primitives;
- `AnchoredDocumentProvider` owns exactly one state machine;
- `PdfViewer`, `FileViewer`, and other leaf viewers remain anchor-free;
- extraction and OCR have no duplicate hover/select/scroll logic;
- source maps are domain adapters, not provider concepts;
- the PDF overlay implementation is shared by extraction and OCR;
- adding a new anchored domain means projecting items, not inventing state;
- adding a new file format means adding a target adapter, not changing provider
  semantics;
- no compatibility wrapper remains as a conceptual center;
- every exported name corresponds to one stable concept.

## Final Position

The design is good, but not finished.

The provider is viable only because it is narrow.

The platonic target is not "a powerful viewer system." It is a small grammar:

```txt
layout primitives
leaf file viewers
domain providers
target adapters
domain compositions
```

For anchored document experiences, the exact grammar is:

```txt
semantic item
  has anchor

provider
  owns active and selected item

target
  turns anchor into document behavior

domain viewer
  renders the human meaning
```

That is the line. Hold it there.
