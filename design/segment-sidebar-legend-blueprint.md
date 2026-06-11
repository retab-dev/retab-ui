# Segment Sidebar / Legend Blueprint

## Purpose

This document defines the target design for the segment sidebar, legend, and
page-axis surfaces. The current implementation has the right composition model:
partition, split, and classify results all reduce to `Segment[]`, and the
document viewers compose shared primitives instead of each viewer owning bespoke
chrome.

The remaining work is interaction quality and contract clarity. The system
should make hover, keyboard focus, selection, current-page emphasis, and
click-to-jump distinct enough that consumers can reason about them without
reading every component.

## North Star

Segment surfaces should be small controlled views over one shared interaction
model.

```tsx
const segmentState = useSegmentInteraction()

<SegmentLegend segments={segments} interaction={segmentState} />
<SegmentSidebar segments={segments} interaction={segmentState} />
<PageRibbon rows={rows} interaction={segmentState} />
```

The components should stay presentational. They render labels, swatches, page
ranges, and page-axis blocks. They do not decide what "selected" means for a
workflow, and they do not hide page-jump behavior behind ambiguous active state.

## Current Assessment

What is good:

- `Segment[]` is the correct shared model for split, partition, and classify.
- `SegmentLegend`, `SegmentSidebar`, and `PageRibbon` are compact and reusable.
- Viewer slots are a good integration boundary; legend/sidebar/ribbon placement
  is separate from PDF rendering.
- Color assignment and page-range formatting live in pure helpers.

What is not finished:

- `activeId` currently means hover most of the time, but comments and docs call
  it "hover/selection".
- Click selection is not persistent; clicks generally only jump to a page.
- Keyboard focus does not participate in shared highlighting.
- `PageRibbon` removes the default focus outline without a strong replacement.
- `SegmentLegend.showUnused` is both an initial value and a forced reveal flag,
  which makes controlled updates unclear.
- There are no focused tests for shared interaction behavior across the segment
  surfaces.

## Design Principles

1. Hover, focus, selected, and current page are different states.
2. Pointer users and keyboard users get equivalent highlighting.
3. Click-to-jump is an explicit callback, not an implied side effect of
   selection.
4. Presentational components accept normalized segments and resolved state.
5. State helpers live outside visual components and are optional to use.
6. Component docs describe the exact state contract, not the intended demo.
7. Tests cover behavior before visual variants.
8. No viewer should duplicate segment interaction logic.

## Interaction Model

Introduce a small shared type:

```ts
export interface SegmentInteractionState {
  hoveredId: string | null
  focusedId: string | null
  selectedId: string | null
  activeId: string | null
}

export interface SegmentInteractionHandlers {
  setHoveredId: (id: string | null) => void
  setFocusedId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
  selectSegment: (segment: Segment) => void
}
```

`activeId` is derived, not stored:

```ts
const activeId = hoveredId ?? focusedId ?? selectedId
```

Selection persists until another segment is selected or the host clears it.
Hover temporarily overrides selection. Focus temporarily overrides selection
when there is no hover. Current page remains separate and can emphasize one or
more segments without mutating interaction state.

## Public API Target

The primitives should accept either explicit props or a bundled interaction
object. Keep explicit props for simple use, but stop overloading `activeId` as
the whole interaction contract.

```ts
export interface SegmentSurfaceInteraction {
  hoveredId?: string | null
  focusedId?: string | null
  selectedId?: string | null
  activeId?: string | null
  onHoverChange?: (id: string | null) => void
  onFocusChange?: (id: string | null) => void
  onSelectedChange?: (id: string | null) => void
}
```

Component callbacks:

- `onHoverChange(id)` fires on pointer enter/leave.
- `onFocusChange(id)` fires on focus/blur.
- `onSelectedChange(id)` fires on selection changes.
- `onSelect(segment)` remains available for host behavior like page jumps.

The visual active id is resolved in this order:

1. `interaction.activeId`
2. `interaction.hoveredId`
3. `interaction.focusedId`
4. `interaction.selectedId`
5. legacy `activeId`

This preserves migration compatibility while making the intended model explicit.

## Component Responsibilities

### SegmentLegend

Responsibilities:

- Render a compact color key.
- Support bar, floating, and plain variants.
- Support horizontal grid/wrap and vertical rail layout.
- Highlight active, selected, focused, and current-page segments.
- Emit hover, focus, selected, and click callbacks.
- Optionally hide zero-page segments.

Forbidden:

- Owning page-jump behavior.
- Mutating selected state on mouse leave.
- Treating `showUnused` as both controlled and uncontrolled state.

Target changes:

- Replace `showUnused` with either `defaultShowUnused` and `showUnused`, or keep
  one controlled prop plus `onShowUnusedChange`.
- Add focus handlers to every legend button.
- Add `aria-pressed` when the segment is selected.
- Add an accessible label for the show-unused toggle that includes the hidden
  count.

### SegmentSidebar

Responsibilities:

- Render a scrollable list of segments.
- Show swatch, label, page count, page ranges, and optional confidence.
- Support hover, focus, selected, and current-page styling.
- Emit `onSelect(segment)` for host actions.

Forbidden:

- Clearing persistent selection on pointer leave.
- Owning document scroll logic.
- Hiding zero-page segments without a clear prop.

Target changes:

- Add `currentPage?: number | null`.
- Add keyboard/focus participation in the shared interaction model.
- Use `aria-current` for the segment that owns the current page when useful.
- Use `aria-pressed` or `aria-selected` consistently for selected rows.

### PageRibbon

Responsibilities:

- Render page-axis blocks from segment page runs.
- Support vertical and horizontal orientation.
- Show current page or scroll-progress cursor.
- Support hover, focus, selected, and current-page styling.
- Emit `onSelectPage(page)` and optionally `onSelectSegment(segment)`.

Forbidden:

- Removing focus visibility without replacement.
- Encoding selection solely through inline box shadows.
- Assuming one row means split and many rows means partition inside the
  component itself.

Target changes:

- Add a visible focus ring style that works on tiny ribbon blocks.
- Add focus handlers to each segment run button.
- Use a consistent active outline token across legend/sidebar/ribbon.
- Consider a minimum hit area wrapper for very short page runs.

### SegmentedDocumentViewer

Responsibilities:

- Compose sidebar, legend, timeline/ribbon, and document.
- Own shared interaction state when the caller does not provide it.
- Own page-jump behavior for document surfaces.
- Pass the same interaction object to every segment surface.

Forbidden:

- Re-implementing the hover/selection policy inline for each surface.
- Treating click-to-jump as the only selected behavior.

Target changes:

- Introduce `useSegmentInteraction`.
- Keep `jumpToPage` local to document viewers.
- On segment click, select the segment and jump to its first page.
- Allow controlled selected id for hosts that want URL/state persistence later.

## File Layout

Target layout:

```txt
registry/new-york-v4/lib/
  segments.ts
  segment-interaction.ts

registry/new-york-v4/ui/
  segment-legend.tsx
  segment-sidebar.tsx
  page-ribbon.tsx
  page-timeline.tsx
  segmented-document-viewer.tsx
```

`segment-interaction.ts` should contain only pure helpers and React-free types:

- `resolveActiveSegmentId`
- `isSegmentCurrentPage`
- `getSegmentInteractionState`
- type definitions for interaction props

If a hook is added, place it next to the composed viewer or in a client-only UI
file, not in the pure registry lib.

## Test Plan

Add focused tests before broad visual work:

- `SegmentLegend` hides zero-page segments by default and can reveal them.
- `SegmentLegend` calls hover, focus, select, and click callbacks separately.
- `SegmentSidebar` renders page ranges and confidence without losing selection
  when hover leaves.
- `PageRibbon` builds one button per page run and fires `onSelectPage(start)`.
- Shared interaction resolution prefers hover over focus over selection.
- `SegmentedDocumentViewer` selects a segment and attempts a first-page jump on
  click.

Tests should assert behavior and ARIA/data attributes, not Tailwind class names
unless the class is the actual public contract.

## Migration Plan

### Phase 1: Clarify Without Breaking

- Add interaction types and `resolveActiveSegmentId`.
- Keep existing `activeId` and `onActivate` props as legacy aliases.
- Update docs to say `activeId` is a visual highlight, not full selection.
- Add tests for current behavior before changing semantics.

### Phase 2: Add Real Selection

- Add hover/focus/selected props to legend, sidebar, and ribbon.
- Add focus handlers and selected ARIA attributes.
- Update `SegmentedDocumentViewer`, split viewer, partition viewer, classify
  viewer, and demos to use the new shared interaction helper.
- Click should select and then call the host jump callback.

### Phase 3: Tighten Controlled State

- Replace ambiguous `showUnused` behavior with controlled/uncontrolled props.
- Decide whether selected id should be clearable from the UI.
- Remove or deprecate legacy `onActivate` once downstream examples have moved.

### Phase 4: Polish Visual States

- Standardize active, selected, focused, current-page, and dimmed styles.
- Add visible focus treatment for ribbon blocks.
- Check compact and vertical legend variants at narrow widths.
- Verify long labels and many segments do not overflow or shift layout.

## Definition Of Done

The system is done when:

- Docs no longer use "hover/selection" to describe a single transient state.
- Mouse hover, keyboard focus, persistent selection, and current page are all
  visually and semantically distinct.
- Every segment surface can share one interaction state without custom glue.
- Click-to-jump remains host-owned and testable.
- Focused tests cover the shared state contract.
- Typecheck/lint failures, if any, are unrelated and documented.
