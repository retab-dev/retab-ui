# Segment Sidebar / Legend V4 Last-Mile Blueprint

## Purpose

This blueprint defines the final small pass after the V3 cleanup.

V3 removed the legacy API and fixed the major naming model:

- no public `active` vocabulary
- `highlighted` is the visual emphasis concept
- `interaction` is the only cross-surface coordination prop
- callbacks are segment-first
- current page is host-owned
- generated registry output is in sync

V4 is not a redesign. It is the last-mile pass for exactness: remove the few
remaining rough edges that keep the system from feeling perfectly inevitable.

## Standard

The target is:

- everything needed
- nothing more
- no historical vocabulary
- no fuzzy callback wording
- no avoidable naming drift
- no repeated interaction-building logic
- no ambiguous page ownership behavior hidden inside render code

The result should read like it could not reasonably have been named or factored
another way.

## Current Remaining Imperfections

### `PageTimeline` Is Correct But Not Calm Enough

Current issues:

- overlap policy lives inline inside the render loop
- `ownerSegmentIndexes` keeps the "owner" vocabulary alive
- highlighted segment lookup does `segments.find(...)` while rendering each page
- page label construction is mixed into JSX rendering

This is the main remaining code-quality target.

### Interaction Hooks Duplicate Construction

`useSegmentInteraction` and `useControlledSegmentInteraction` both build:

- `selectSegment`
- `clearSelection`
- the final `SegmentInteraction` object

The duplication is small, but perfection asks whether it can become one pure
builder without adding abstraction weight.

### Callback Wording Is Slightly Imprecise

Several prop comments say `onSelect` fires "after the segment is selected".

That is true only when an `interaction` object is supplied. Without interaction,
`onSelect` still fires as a host side effect, but no shared selected state is
mutated.

The wording should describe behavior exactly.

### Browser Verification Is Blocked

The docs app currently fails before the segment pages render because unrelated
schema-editor/property-form files import missing exports from
`components/schema-editor/property-form/types.ts`.

The segment work can be correct without fixing that unrelated blocker, but the
final claim must separate:

- component implementation verification
- visual browser verification

## Non-Goals

- Do not redesign UI styling.
- Do not change `Segment[]`.
- Do not change install paths or registry item names.
- Do not add primitive `selectedId` props.
- Do not fix unrelated schema-editor/property-form compile errors unless the
  user explicitly asks.
- Do not introduce a new state library or context provider.

## Desired API Shape

Keep:

```ts
export interface SegmentInteraction {
  hoveredId: string | null
  focusedId: string | null
  selectedId: string | null
  setHoveredId: (id: string | null) => void
  setFocusedId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
  clearSelection: () => void
  selectSegment: (segment: Segment) => void
}
```

Keep:

```ts
export interface SegmentInteractionSnapshot {
  isHovered: boolean
  isFocused: boolean
  isSelected: boolean
  isHighlighted: boolean
  isCurrent: boolean
  isDimmed: boolean
}
```

Keep:

```ts
resolveHighlightedSegmentId(...)
getSegmentInteractionState(...)
getSegmentSurfaceProps(...)
useSegmentInteraction()
useControlledSegmentInteraction(...)
```

Do not add new public props.

## Interaction Construction

Consider extracting one private helper in `use-segment-interaction.ts`:

```ts
function useSegmentInteractionObject({
  hoveredId,
  focusedId,
  selectedId,
  setHoveredId,
  setFocusedId,
  setSelectedId,
}: ControlledSegmentInteractionOptions): SegmentInteraction
```

Then:

```ts
export function useSegmentInteraction(): SegmentInteraction {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  const [focusedId, setFocusedId] = React.useState<string | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  return useSegmentInteractionObject({
    hoveredId,
    focusedId,
    selectedId,
    setHoveredId,
    setFocusedId,
    setSelectedId,
  })
}

export function useControlledSegmentInteraction(
  options: ControlledSegmentInteractionOptions
): SegmentInteraction {
  return useSegmentInteractionObject(options)
}
```

Accept this extraction only if the file becomes clearer. If the helper makes the
hook feel indirect, leave the duplication.

## Timeline Refactor

Move page-cell derivation into small pure helpers inside `page-timeline.tsx`.

Suggested internal types:

```ts
interface TimelinePageSegment {
  segmentIndexes: number[]
  primarySegment?: Segment
  label: string
}
```

Suggested helpers:

```ts
function buildSegmentByIndex(segments: Segment[]): Map<number, Segment>

function getTimelinePageSegment({
  page,
  segmentIndexesByPage,
  segmentByIndex,
}: {
  page: number
  segmentIndexesByPage: Map<number, number[]>
  segmentByIndex: Map<number, Segment>
}): TimelinePageSegment

function getHighlightedSegmentIndex({
  segments,
  highlightedSegmentId,
}: {
  segments: Segment[]
  highlightedSegmentId: string | null
}): number | undefined
```

Naming rules:

- Prefer `segmentIndexes` over `ownerSegmentIndexes`.
- Prefer `primarySegment` for the click target.
- Prefer `pageLabel` for aria/title text.
- Avoid `owner` unless referring to the imported `pageOwners` domain helper.

Behavior rules:

- No segment on page: muted page cell, no segment selection, page click still
  calls `onSelectPage`.
- One segment on page: label is `Page N · Segment Label`.
- Multiple segments on page: label is `Page N · X segments`.
- Click target for overlap is `primarySegment`, defined as first segment by
  document order.
- Dimming checks whether the highlighted segment index is included in the page's
  segment indexes.

## Callback Language

Update comments and docs from:

```ts
/** Fired on click after the segment is selected. */
onSelect?: (segment: Segment) => void
```

To:

```ts
/** Fired when a segment surface is clicked, after shared selection is requested. */
onSelect?: (segment: Segment) => void
```

Reason: `getSegmentSurfaceProps` requests selection when `interaction` exists,
then fires `onSelect`. It does not guarantee selection changed.

Apply this wording consistently to:

- `SegmentLegendProps`
- `SegmentSidebarProps` if needed
- `PageTimelineProps`
- `PageRibbonProps`
- docs prop tables
- generated registry output

## Docs

Docs should teach the final model without implementation history:

- use `useSegmentInteraction()` for ordinary composed viewers
- use `useControlledSegmentInteraction()` for caller-owned state
- pass `interaction` to every segment surface
- use `onSelect` for host side effects such as scrolling
- do not mention removed props
- do not mention migration or legacy APIs

Keep docs short. The component API should be self-explanatory.

## Tests

Keep existing tests and add/adjust:

- `PageTimeline` helper behavior through rendered output:
  - empty page label
  - one-segment page label
  - overlapping page label
  - overlap click selects primary segment
  - highlighted overlap page is not dimmed when highlighted segment is one of
    the overlapping segments
- `useControlledSegmentInteraction`:
  - returns one interaction object that updates selected state through
    `selectSegment`
  - `clearSelection` clears selected state
- legacy scan remains clean:
  - `activeId`
  - `data-active`
  - `isActive`
  - `resolveActiveSegmentId`
  - `onActivate`
  - `onSelectSegment`
  - `defaultSelectedId`
  - `onSelectedIdChange`

Do not add brittle tests for private helper names.

## Verification

Required:

```bash
./node_modules/.bin/vitest run tests/segment-surfaces.test.tsx
./node_modules/.bin/eslint registry/new-york-v4/lib/segment-interaction.ts registry/new-york-v4/ui/use-segment-interaction.ts registry/new-york-v4/ui/segment-legend.tsx registry/new-york-v4/ui/segment-sidebar.tsx registry/new-york-v4/ui/page-timeline.tsx registry/new-york-v4/ui/page-ribbon.tsx registry/new-york-v4/ui/segmented-document-viewer.tsx tests/segment-surfaces.test.tsx
./node_modules/.bin/shadcn build --output public/r
./node_modules/.bin/shadcn registry validate
./node_modules/.bin/tsc --noEmit --pretty false --incremental false 2>&1 | rg "(segment-interaction|use-segment-interaction|segment-legend|segment-sidebar|page-ribbon|page-timeline|segmented-document-viewer|segment-surfaces)"
rg -n "activeId|data-active|isActive|resolveActiveSegmentId|onActivate|onSelectSegment|defaultSelectedId|onSelectedIdChange|selectedId\\?:" registry/new-york-v4 components content/docs tests lib public/r registry.json --glob '!node_modules'
```

Browser:

- Start the docs app only if the unrelated schema-editor/property-form compile
  blocker is fixed.
- If it is still blocked, report browser verification as blocked by unrelated
  files and name the blocker precisely.

## Completion Criteria

V4 is complete when:

- `page-timeline.tsx` is calmer and has explicit page-cell derivation
- no public or generated segment artifact contains legacy active vocabulary
- controlled/uncontrolled interaction construction is either unified or
  intentionally left duplicated because the helper was worse
- `onSelect` wording is exact everywhere
- tests cover timeline overlap and controlled interaction clearing
- registry output is rebuilt and valid
- browser verification is either clean or explicitly blocked by unrelated files

At that point, the component system is close enough to call "ideal" without
lying about the remaining external app-level blockers.
