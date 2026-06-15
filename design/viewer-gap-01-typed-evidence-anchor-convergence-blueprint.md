# Viewer Gap 01: Typed Evidence Anchor Convergence

## Question

Can source/evidence interaction converge without making the segmented document
primitive vague?

The current system has two valid interaction models:

```txt
SegmentedDocumentProvider
  page documents
  semantic document segments
  page-local bbox anchors
  page scrolling
  anchor scrolling
  overlays

AnchoredDocumentProvider
  text ranges
  CSV cells
  XLSX cells
  DOCX targets
  arbitrary target handles
  source/evidence selection
```

The gap is not that two providers exist. The gap is that bbox-backed source
evidence now fits naturally into `SegmentedDocumentProvider`, while non-bbox
source evidence still needs `AnchoredDocumentProvider`. Readers must learn two
systems that overlap in selection, preview, active item, and navigation.

## Current State

Good:

- PDF and image bboxes use segmented-document mechanics.
- `DocumentSegment` and `SegmentAnchor` correctly separate semantic objects from
  page-local geometry.
- `useSegmentedItemLink` is neutral and reusable.
- Text, CSV, XLSX, and DOCX examples do not fake page bboxes.
- `sourceToSegmentAnchor` stays null for non-page targets.

Bad:

- Evidence interaction has two state machines.
- Source examples have to choose provider by file type.
- `SourceFieldList` has to straddle both worlds.
- There is no typed non-page segmented navigation handle.
- The word "anchor" means two different things depending on the provider.

## Non-Goal

Do not force every evidence target into `SegmentAnchor`.

This is wrong:

```ts
type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber?: number
  bounds?: SegmentBounds
  metadata?: Record<string, unknown>
}
```

That would make the primitive generic but not precise. It would also hide
important target semantics behind untyped metadata.

## Ideal Model

The correct convergence point is a typed document target union:

```ts
type DocumentTarget =
  | PageBoundsTarget
  | TextRangeTarget
  | CsvCellTarget
  | XlsxCellTarget
  | DocxRangeTarget

type PageBoundsTarget = {
  kind: "page-bounds"
  pageNumber: number
  bounds: SegmentBounds
}

type TextRangeTarget = {
  kind: "text-range"
  rangeId: string
}

type CsvCellTarget = {
  kind: "csv-cell"
  rowIndex: number
  columnIndex: number
}

type XlsxCellTarget = {
  kind: "xlsx-cell"
  sheetId: string
  rowIndex: number
  columnIndex: number
}

type DocxRangeTarget = {
  kind: "docx-range"
  rangeId: string
}
```

Then the shared evidence model can be:

```ts
type EvidenceItem = {
  id: string
  label: string
  description?: string
  target: DocumentTarget
}
```

Page-backed targets can adapt into `SegmentedDocumentModel`:

```ts
function createSegmentedEvidenceModel(items: EvidenceItem[]) {
  return items.flatMap((item) =>
    item.target.kind === "page-bounds"
      ? [{
          segment: evidenceItemToSegment(item),
          anchor: evidenceItemToSegmentAnchor(item),
        }]
      : []
  )
}
```

Non-page targets should use typed document handles:

```ts
type EvidenceDocumentHandle = {
  scrollToTarget: (target: DocumentTarget, options?: ScrollOptions) => void
  highlightTarget?: (target: DocumentTarget | null) => void
}
```

## Provider Decision

There are two viable final states.

### Option A: Keep Two Providers, Sharpen Boundary

```txt
SegmentedDocumentProvider
  only page documents and page-local anchors

AnchoredDocumentProvider
  typed non-page document targets
```

This is acceptable if the names become precise:

```txt
SegmentedDocumentProvider -> PageSegmentedDocumentProvider
AnchoredDocumentProvider  -> DocumentTargetProvider
```

The cost: source/evidence has two integration paths forever.

### Option B: One Evidence Interaction Provider

```tsx
<EvidenceProvider items={items}>
  <SourceFieldList />
  <EvidenceDocument />
</EvidenceProvider>
```

The provider owns:

```txt
selectedItemId
previewItemId
activeItem
activeTarget
registerDocumentHandle
scrollToItem
previewItem
```

Page documents adapt this provider to segmented overlays:

```tsx
<EvidenceProvider items={items}>
  <SegmentedDocumentProvider model={pageBackedModel}>
    <PdfEvidenceDocument />
  </SegmentedDocumentProvider>
</EvidenceProvider>
```

The cost: more plumbing, but better semantic ownership.

## Recommended Direction

Build a typed `DocumentTarget` layer first. Do not immediately delete
`AnchoredDocumentProvider`.

The next implementation should:

1. Add a typed `DocumentTarget` union.
2. Convert source/evidence examples to produce `EvidenceItem[]`.
3. Keep page-bounds targets adapting to `SegmentedDocumentProvider`.
4. Keep non-page targets on the current anchored path.
5. Rename or wrap anchored APIs only after the typed model proves itself.

## Success Criteria

- No `metadata?: Record<string, unknown>` is introduced.
- Page bboxes continue to use segmented overlays.
- Text/CSV/XLSX/DOCX targets stay typed.
- `SourceFieldList` receives one item shape independent of file type.
- Target navigation is implemented through registered document handles.
- Provider choice becomes an implementation detail, not a product-level fork.

## Failure Signals

- `SegmentAnchor` grows optional fields for text/cells/ranges.
- Source examples branch deeply on file type inside UI components.
- Selection state is duplicated between source list and document overlay.
- New abstractions use names like `GenericAnchor`, `AnyTarget`, or `metadata`.

