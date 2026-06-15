# Viewer Gap 02: Edit Viewer Evidence Convergence

## Question

Is the edit viewer a separate editing system, or is it the same document-target
interaction model as source/evidence with editable values?

The current edit viewer has a coherent domain provider. It owns fields, active
field, document targets, overlays, toolbar state, and value editing. That is
valid. The gap is that its document interaction mechanics overlap with
source/evidence mechanics.

## Current State

Good:

- Edit viewer has real domain parts.
- It exposes header, document, fields, toolbar, states, and provider.
- It uses viewer spatial primitives visibly.
- It has a coherent provider value for edit behavior.

Bad:

- It still uses `AnchoredDocumentProvider` for PDF field interaction.
- It owns field projection and selection separately from segmented/source
  evidence.
- It duplicates overlay and target concepts.
- It is unclear whether edit fields are document evidence, document controls, or
  a different primitive.

## Core Distinction

Source/evidence asks:

```txt
Where did this value come from?
```

Edit asks:

```txt
Where does this editable value live, and how can the user change it?
```

These are not identical, but they share a document-target layer.

The shared layer should be:

```txt
item id
item label
document target
active item
preview item
scroll to target
highlight target
```

The edit-specific layer should be:

```txt
field value
field validation
dirty state
commit/revert
field confidence
write permissions
toolbar actions
```

## Ideal Shape

Edit fields should be typed document-target items with edit payloads:

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

The viewer composes shared document interaction with edit-specific state:

```tsx
<EditViewerProvider fields={fields}>
  <ViewerRoot>
    <EditViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <EditViewerFields />
      </ViewerSidebar>
      <ViewerSurface>
        <EditViewerDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EditViewerProvider>
```

Inside `EditViewerProvider`, target interaction should be delegated to a shared
target controller:

```ts
const target = useDocumentTargetController({
  items: fields,
  getTarget: (field) => field.target,
})
```

The edit provider owns values. The target controller owns document navigation.

## Implementation Plan

### Step 1: Isolate Edit Field Target Shape

Create or normalize a single edit field target property:

```ts
target: DocumentTarget | null
```

Do not keep parallel fields such as:

```txt
pageNumber
bbox
anchorId
range
cell
```

outside a typed target union.

### Step 2: Extract A Target Controller

Create a shared hook that does not know about source or edit:

```ts
function useDocumentTargetController<TItem>({
  items,
  selectedItemId,
  onSelectedItemIdChange,
  getItemId,
  getTarget,
}: DocumentTargetControllerOptions<TItem>)
```

It returns:

```ts
{
  selectedItem,
  previewItem,
  activeTarget,
  setSelectedItemId,
  setPreviewItemId,
  registerDocumentHandle,
  scrollToItem,
  highlightItem,
}
```

### Step 3: Keep Edit Provider As Domain Owner

Do not move value editing into the target controller.

The edit provider remains responsible for:

```txt
value changes
validation
submission
dirty tracking
field grouping
toolbar actions
empty/error states
```

### Step 4: Adapt PDF/Image Fields To Segmented Overlays

For fields whose target is `page-bounds`, derive:

```ts
DocumentSegment[]
SegmentAnchor[]
```

Then reuse segmented overlays for field highlighting.

### Step 5: Keep Non-Page Targets Typed

Text/CSV/XLSX/DOCX edit targets should not be forced through bboxes.

They should register document handles:

```ts
scrollToTarget(target: DocumentTarget)
```

## Success Criteria

- Edit field target data uses the same `DocumentTarget` union as source/evidence.
- Edit provider no longer owns low-level scroll protocols.
- PDF/image edit overlays can share segmented overlay helpers.
- Text/CSV/XLSX/DOCX edit targets remain typed.
- The edit provider still owns editing behavior.
- The UI remains a named-parts composition, not a generic mega-viewer.

## Failure Signals

- Edit fields become generic evidence items with value data bolted on.
- Source/evidence starts importing edit concepts.
- `SegmentAnchor` gains edit-specific fields.
- A generic `DocumentInteractionProvider` starts owning validation or form
  behavior.

## Final Position

Edit should converge at the document-target interaction layer, not at the full
viewer layer. The ideal is shared navigation and overlays, with edit remaining a
domain-specific composed viewer.

