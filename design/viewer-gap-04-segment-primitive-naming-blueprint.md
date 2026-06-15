# Viewer Gap 04: Segment Primitive Naming

## Question

Do `SegmentLegend`, `SegmentPageRail`, `SegmentSidebar`, and `PageRibbon` still
use the right names now that the model distinguishes `DocumentSegment` from
`SegmentAnchor`?

The current names are usable. They are not perfectly precise.

## Current State

Good:

- `SegmentedDocumentModel` distinguishes semantic segments and page-local
  anchors.
- `segments` is documented as the viewport/navigation projection.
- `SegmentRow` is generic display grouping, not partition vote semantics.
- Split and partition share segment mechanics without sharing visual layout.

Bad:

- Component names still say `Segment`, not `DocumentSegment`.
- `SegmentAnchor` is a different concept but shares the same word.
- `PageRibbon` is generic but also used as a segment/ribbon surface.
- New contributors may not know whether a "segment" is semantic, visual, or
  page-local.

## Vocabulary

The model vocabulary should be:

```txt
DocumentSegment
  semantic region of a document
  may span many pages
  owns label, color, pages

SegmentAnchor
  page-local attachment point for a segment
  may have bounds
  used for overlays and anchor navigation

SegmentRow
  generic grouping/display row of document segments
  no partition-specific vote semantics
```

The UI vocabulary should say what the component renders:

```txt
legend
sidebar
page rail
ribbon
overlay
```

## Rename Options

### Option A: Keep Current Names, Strengthen Types And Docs

```txt
SegmentLegend
SegmentSidebar
SegmentPageRail
PageRibbon
```

Pros:

- Low churn.
- Short names.
- Existing docs/tests remain readable.
- "Segment" is acceptable shorthand in component names.

Cons:

- Less precise than the model.
- Does not force readers to internalize semantic vs page-local distinction.

### Option B: Rename To DocumentSegment Names

```txt
DocumentSegmentLegend
DocumentSegmentSidebar
DocumentSegmentPageRail
DocumentSegmentRibbon
```

Pros:

- Precise.
- Aligns with `DocumentSegment`.
- Prevents accidental confusion with `SegmentAnchor`.

Cons:

- Verbose.
- More churn.
- The names may feel heavier than their visual role.

### Option C: Keep Visual Names, Move Segment Into Props

```txt
Legend
PageRail
Ribbon
SegmentSidebar
```

Pros:

- Clean visual vocabulary.

Cons:

- Too generic for a component library.
- Collides with non-segment legends/rails/ribbons.

## Recommended Direction

Keep the current exported names for now. Improve precision in type names,
documentation, and prop names.

The right next cut is not a rename. It is type and prop exactness:

```ts
type SegmentLegendProps = {
  segments: readonly DocumentSegment[]
}

type SegmentSidebarProps = {
  segments: readonly DocumentSegment[]
}

type SegmentPageRailProps = {
  segments: readonly DocumentSegment[]
}
```

Avoid internal aliases like:

```ts
type Segment = ...
```

unless they are historical test helpers.

## Documentation Rule

Every public segmented component doc should contain this sentence:

```txt
In these components, "segment" means a semantic DocumentSegment, not a
page-local SegmentAnchor.
```

## Success Criteria

- Public props use `DocumentSegment` where possible.
- Internal helpers do not redefine vague `Segment` types.
- Docs explain semantic segments vs page anchors.
- No partition-specific semantics leak into generic segment components.
- No rename churn happens without a clear consumer-facing benefit.

## Failure Signals

- `Segment` means different shapes in adjacent files.
- `SegmentRow` starts carrying vote/output-specific fields.
- `SegmentAnchor` gets fields that belong on `DocumentSegment`.
- Renames are done for taste without reducing real ambiguity.

## Final Position

The current names are not perfect, but they are acceptable if the type surface
is precise. Rename only if actual ambiguity shows up in implementation or docs.

