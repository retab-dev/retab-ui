# Segment Sidebar / Legend V2 Blueprint

## Purpose

This blueprint defines the ideal version of the segment sidebar, legend, ribbon,
and timeline system after the compatibility-preserving v1 implementation.

V1 made the architecture correct enough to build on: segment surfaces now share a
real interaction model with separate hover, focus, selection, and current-page
state. V2 should remove migration compromises, tighten the API, and finish the
interaction and visual design to the point where the system feels inevitable.

## North Star

There should be one obvious way to coordinate segment surfaces:

```tsx
const interaction = useSegmentInteraction()

<SegmentLegend segments={segments} interaction={interaction} />
<SegmentSidebar segments={segments} interaction={interaction} />
<PageRibbon rows={rows} interaction={interaction} />
<PageTimeline segments={segments} interaction={interaction} />
```

Every surface should mean the same thing by:

- hovered
- focused
- selected
- current
- dimmed
- disabled or empty

No component should require the caller to know which internal event raised the
visual highlight.

## Non-Goals

- Do not redesign the PDF viewer.
- Do not replace the `Segment[]` model.
- Do not add workflow-specific concepts to the primitives.
- Do not remove compatibility until docs, demos, registry blocks, and product
  viewers have all migrated.
- Do not introduce a styling framework or state library for this system.

## Current V1 Assessment

What is now good:

- `SegmentSurfaceInteraction` separates hover, focus, selected, and active ids.
- `useSegmentInteraction` gives composed viewers one shared state object.
- `SegmentLegend`, `SegmentSidebar`, `PageRibbon`, and `PageTimeline` all accept
  the shared interaction object.
- Keyboard focus participates in highlighting.
- Clicks persist selection and can still call host-owned jump behavior.
- `SegmentLegend.showUnused` now has controlled and uncontrolled paths.
- Focused tests cover the core behavior.

Remaining compromises:

- Legacy props still exist: `activeId` and `onActivate`.
- Legend selection has both `onSelect(id)` and `onSelectSegment(segment)`.
- `PageRibbon` has focus visibility, but small page runs still have small hit
  targets.
- Current visual states are functional, not fully design-system-level.
- Tests are focused but not exhaustive.
- Full repository typecheck is still blocked by unrelated errors.

## Ideal Public API

### Shared Types

```ts
export interface SegmentInteraction {
  hoveredId: string | null
  focusedId: string | null
  selectedId: string | null
  activeId: string | null
  setHoveredId: (id: string | null) => void
  setFocusedId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
  clearSelection: () => void
  selectSegment: (segment: Segment) => void
}
```

`activeId` remains derived:

```ts
hoveredId ?? focusedId ?? selectedId
```

No primitive should expose a separate `activeId` prop after migration.

### SegmentLegend

```ts
export interface SegmentLegendProps {
  segments: Segment[]
  interaction?: SegmentInteraction
  variant?: "bar" | "floating" | "plain"
  orientation?: "horizontal" | "vertical"
  side?: "top" | "bottom" | "left" | "right"
  density?: "comfortable" | "compact"
  currentPage?: number | null
  columns?: number
  showUnused?: boolean
  defaultShowUnused?: boolean
  onShowUnusedChange?: (showUnused: boolean) => void
  onSelect?: (segment: Segment) => void
  caption?: React.ReactNode
  className?: string
}
```

Rules:

- `onSelect` receives the full segment, not an id.
- `interaction.onSelectedChange` or `interaction.selectSegment` owns selection.
- `onSelect` is for host side effects such as page jumps.
- `activeId` and `onActivate` are removed.

### SegmentSidebar

```ts
export interface SegmentSidebarProps {
  segments: Segment[]
  interaction?: SegmentInteraction
  currentPage?: number | null
  onSelect?: (segment: Segment) => void
  unitLabel?: string
  showUnused?: boolean
  className?: string
}
```

Rules:

- Sidebar rows use one consistent selection semantic.
- `aria-current` is only used for current-page ownership.
- `aria-pressed` or `aria-selected` is used for selection, not both.

### PageRibbon / PageTimeline

```ts
export interface SegmentAxisSurfaceProps {
  interaction?: SegmentInteraction
  currentPage?: number | null
  onSelectSegment?: (segment: Segment) => void
  onSelectPage?: (page: number) => void
}
```

Rules:

- Clicking a segment run selects the segment first, then fires page jump.
- Tiny runs must still have an accessible and usable focus target.
- Current-page cursor and selected segment outline are visually distinct.

## Visual State Contract

Every segment surface should implement these states:

| State    | Meaning                                 | Visual Treatment                               |
| -------- | --------------------------------------- | ---------------------------------------------- |
| Default  | Segment exists, not active              | Normal opacity, muted text where appropriate   |
| Hovered  | Pointer is over the segment             | Active emphasis, siblings dimmed               |
| Focused  | Keyboard focus is on the segment        | Visible focus ring plus active emphasis        |
| Selected | Segment was clicked or selected by host | Persistent emphasis after hover/focus leaves   |
| Current  | Segment owns the current page           | Page-current emphasis, distinct from selection |
| Dimmed   | Another segment is active               | Lower opacity, still readable                  |
| Empty    | Segment owns no pages                   | Muted page copy, optional hidden state         |

Focus must never depend only on color. Selection must not be conveyed only by
bold text. Current page must not look identical to selected segment.

## Accessibility Contract

Minimum expectations:

- Every interactive segment entry is reachable by keyboard.
- Every focusable element has a visible focus state.
- Every selected segment exposes a semantic selected or pressed state.
- Current page state uses `aria-current` only where the element represents a
  page or page-owning row.
- Tiny ribbon runs have labels that include segment label and page range.
- Hidden unused segments are not focusable.
- Show-unused toggle includes the hidden count in its accessible label.

Open decision:

- Choose one selection semantic for list-like surfaces:
  - `aria-pressed` if rows behave as toggle buttons.
  - `aria-selected` if the sidebar becomes a true listbox/tablist-like surface.

The current UI is closer to button selection, so `aria-pressed` should remain
unless the component adopts full listbox semantics.

## Interaction Rules

1. Hover sets `hoveredId`.
2. Mouse leave clears only `hoveredId`.
3. Focus sets `focusedId`.
4. Blur clears only `focusedId`.
5. Click sets `selectedId`.
6. Click then fires host `onSelect`.
7. Current page never mutates interaction state.
8. Controlled `selectedId` never mutates internal selected state.
9. Disabled or empty segments can be selected only if the host explicitly allows
   it.

## Component Internals

Create a small shared adapter for event props:

```ts
function getSegmentSurfaceProps(segment, interaction, options) {
  return {
    state,
    eventHandlers,
    ariaProps,
    dataProps,
  }
}
```

This prevents every surface from re-implementing:

- hover handlers
- focus handlers
- selected handlers
- `aria-pressed`
- `data-active`
- `data-current`
- `data-selected`
- dimming logic

The adapter should remain React-compatible but not require JSX.

## Migration Plan

### Phase 1: Deprecate Legacy Props

- Mark `activeId` and `onActivate` as deprecated in comments.
- Mark `SegmentLegend.onSelect(id)` as deprecated.
- Add `onSelectSegment` to docs as the migration bridge.
- Keep runtime behavior unchanged.

### Phase 2: Move To Segment-First Selection

- Change internal examples to use `onSelectSegment`.
- Update split, partition, classify, demos, and blocks.
- Update tests to assert the segment callback.
- Leave id callback as compatibility only.

### Phase 3: Remove Legacy API From Docs

- Remove `activeId` and `onActivate` from primary docs tables.
- Move them to a short migration note.
- Make `interaction` the only recommended coordination API.

### Phase 4: Remove Legacy API From Registry

- Remove `activeId` and `onActivate`.
- Rename `onSelectSegment` to `onSelect`.
- Emit one major/minor registry note depending on versioning policy.

### Phase 5: Visual QA Pass

Verify at minimum:

- 1 segment
- 3 segments
- 12 segments
- 30 segments
- repeated labels
- zero-page segments
- long labels
- non-contiguous pages
- overlapping partition chunks
- mobile width
- narrow sidebar
- dark mode
- keyboard-only use

Use browser screenshots for:

- legend bar
- floating legend
- vertical rail
- sidebar
- vertical ribbon
- horizontal ribbon
- composed segmented document viewer

## Test Plan

Add or extend tests for:

- `resolveActiveSegmentId` precedence.
- Controlled selected id.
- Uncontrolled selected id.
- Hover does not clear selection.
- Focus does not clear selection.
- Selection survives hover/focus transitions.
- Current page can emphasize a segment without selecting it.
- Legend show-unused controlled mode.
- Legend show-unused uncontrolled mode.
- Sidebar current-page state.
- Ribbon non-contiguous page runs.
- Ribbon tiny run focus labels.
- Timeline unowned pages while another segment is selected.
- `SegmentedDocumentViewer` controlled selection.
- Legacy props still work until removed.

## Browser Verification

Before calling V2 complete, run the docs app and verify:

- no console errors on legend/sidebar docs pages
- no clipped labels in legend variants
- focus ring is visible on every segment surface
- selected state persists after pointer leaves
- keyboard tab order is predictable
- clicking legend/sidebar/ribbon jumps to the expected page when a document is
  mounted

Screenshots should be captured for desktop and mobile widths.

## Definition Of Done

V2 is done when:

- `interaction` is the only recommended coordination API.
- Every surface shares one event and ARIA adapter.
- Legacy props are either removed or isolated in a migration section.
- `onSelect` consistently receives a `Segment`.
- Visual states are distinct across hover, focus, selected, and current.
- Tiny ribbon runs are keyboard-visible and pointer-usable.
- Focused unit tests and browser verification both pass.
- Registry output includes the helper dependencies with no manual patching.
