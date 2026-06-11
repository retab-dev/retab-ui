# Segment Sidebar / Legend V3 Platonic Blueprint

## Purpose

This blueprint defines the final polish pass for the segment sidebar, legend,
timeline, ribbon, and document-viewer coordination system.

The V2 architecture is now fundamentally correct:

- one `Segment[]` domain model
- one shared `SegmentInteraction` object
- one `useSegmentInteraction()` hook
- one surface-state adapter
- segment-first `onSelect`
- no legacy `activeId`, `onActivate`, id-first select, or controlled-prop bridge

V3 is not a rewrite. It is the pass that removes remaining linguistic drift,
edge-case ambiguity, and small ergonomic roughness.

## Standard Of Perfection

The system is ideal when a maintainer can answer every question with one rule:

- Which surface owns hover? The shared interaction object.
- Which surface owns focus? The shared interaction object.
- Which surface owns selection? The shared interaction object.
- Which surface owns current page? The host/viewer.
- Which callback receives a segment? Every segment callback.
- Which prop coordinates surfaces? `interaction`.
- Which state renders visual emphasis? the shared surface snapshot.

No component should require historical knowledge of previous APIs.

## Current State

What is already right:

- `SegmentInteraction` contains only `hoveredId`, `focusedId`, `selectedId`,
  setters, `clearSelection`, and `selectSegment`.
- `SegmentInteractionSnapshot` contains booleans only.
- `resolveActiveSegmentId` derives transient emphasis from
  `hoveredId ?? focusedId ?? selectedId`.
- `SegmentLegend`, `SegmentSidebar`, `PageTimeline`, `PageRibbon`, and
  `SegmentedDocumentViewer` accept `interaction`.
- `onSelect` receives `Segment`, not an id.
- Generated registry output matches the source.
- Tests cover shared selection, hover/focus precedence, current-page state,
  unused segments, and caller-owned interaction state.

Remaining imperfections:

- The helper name `resolveActiveSegmentId` still exposes "active" as vocabulary.
- `SegmentInteraction` is all-or-nothing; controlled callers must provide full
  setter functions even if they only control selection.
- `PageTimeline` has an implicit "first owner wins" rule for overlapping page
  ownership.
- `SegmentedDocumentViewer` still builds `legend`, `sidebar`, and `header`
  inline, which is compact but not maximally calm.
- A few local variable names use `seg` instead of `segment`.
- Sidebar current-page semantics can be more precise than `aria-current="true"`.

## Non-Goals

- Do not redesign the visual language.
- Do not replace `Segment[]`.
- Do not add workflow-specific props to primitives.
- Do not introduce a state library.
- Do not reintroduce controlled `selectedId` props on primitives.
- Do not optimize unrelated viewer systems.

## Final Public Model

### `SegmentInteraction`

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

This remains the only shared coordination object.

### `SegmentInteractionSnapshot`

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

Rename `isActive` to `isHighlighted`.

Reason: "active" sounds like a persisted state. The actual meaning is resolved
visual emphasis from hover, focus, or selection.

### Highlight Resolution

Keep this as an implementation helper, not a concept the component API teaches:

```ts
function resolveHighlightedSegmentId(
  interaction?: Pick<
    SegmentInteraction,
    "hoveredId" | "focusedId" | "selectedId"
  >
) {
  return (
    interaction?.hoveredId ??
    interaction?.focusedId ??
    interaction?.selectedId ??
    null
  )
}
```

Rules:

- Hover wins over focus.
- Focus wins over selection.
- Selection persists after hover/focus leave.
- Current page never participates in interaction state.

## Ergonomic Controlled State

Do not bring back primitive `selectedId` props.

If callers need controlled selection, provide a second hook:

```ts
export function useControlledSegmentInteraction({
  hoveredId,
  focusedId,
  selectedId,
  setHoveredId,
  setFocusedId,
  setSelectedId,
}: {
  hoveredId: string | null
  focusedId: string | null
  selectedId: string | null
  setHoveredId: (id: string | null) => void
  setFocusedId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
}): SegmentInteraction
```

This keeps primitives pure while removing boilerplate from controlled callers.

Do not add:

- `defaultSelectedId`
- `onSelectedIdChange`
- `selectedId` props on legend/sidebar/timeline/ribbon

## Surface Contract

Every segment-bearing surface uses the same adapter:

```ts
const { state, eventHandlers, ariaProps, dataProps } = getSegmentSurfaceProps({
  segment,
  interaction,
  currentPage,
  onSelect,
})
```

The adapter owns:

- hover handlers
- focus handlers
- click selection
- segment-first select callback
- selected aria state
- `data-highlighted`
- `data-current`
- `data-selected`

No surface should duplicate these rules.

## Naming Rules

Use these names everywhere:

| Concept | Name |
| --- | --- |
| Domain object | `segment` |
| Collection | `segments` |
| Shared state object | `interaction` |
| Persistent selection | `selectedId` / `isSelected` |
| Transient visual emphasis | `highlightedId` / `isHighlighted` |
| Page ownership state | `currentPage` / `isCurrent` |
| De-emphasized sibling state | `isDimmed` |
| Host click side effect | `onSelect` |
| Page jump side effect | `onSelectPage` |

Avoid:

- `seg`
- `active`
- `owner` when `segment` is available
- id-first callbacks

## Page Ownership Semantics

`PageTimeline` needs an explicit overlapping-page policy.

Recommended policy:

- If one segment owns the page, the page cell selects that segment.
- If multiple segments own the page, the cell highlights all matching ownership
  by dimming only segments outside the owner set.
- Click selects the first segment by document order unless a future UI exposes a
  disambiguation menu.
- The title/aria label must mention overlap: `Page 3 · 2 segments`.

This makes the current behavior intentional instead of accidental.

## Accessibility Contract

Minimum final requirements:

- Segment buttons use `aria-pressed` for persistent selection.
- Current page ownership uses `aria-current="page"` when page-specific.
- Focus rings are visible on every surface.
- Ribbon hit areas remain usable when visual runs are smaller than the pointer
  target.
- Page timeline labels include page number and segment label/count.
- Unused hidden segments are not focusable.
- Show-unused toggle names the hidden count.

Specific cleanup:

- Change sidebar current ownership from `aria-current="true"` to a more precise
  value if the row represents the current page context.
- Ensure `data-highlighted` replaces `data-active` if the naming change lands.

## Visual Contract

The visual states must remain distinct:

| State | Required Treatment |
| --- | --- |
| Default | neutral text/chrome |
| Hovered | highlighted emphasis |
| Focused | highlighted emphasis plus focus ring |
| Selected | persistent selected styling |
| Current | current-page styling distinct from selected |
| Dimmed | lower opacity but still readable |
| Unused | muted page copy; optionally hidden |

Selection must not rely only on font weight. Focus must not rely only on color.
Current-page state must not look identical to selection.

## Component-Specific Work

### `segment-interaction.ts`

- Rename `resolveActiveSegmentId` to `resolveHighlightedSegmentId`.
- Rename `isActive` to `isHighlighted`.
- Rename `data-active` to `data-highlighted`.
- Keep the file small and domain-only.

### `use-segment-interaction.ts`

- Keep the default hook zero-argument.
- Add `useControlledSegmentInteraction` only if controlled callers repeat the
  full interaction object in more than one place.
- Keep hook outputs stable and obvious.

### `segment-legend.tsx`

- Replace active language in comments.
- Keep unused-segment visibility as the only local state.
- Keep label-width reservation if it still prevents layout shift.
- Do not grow the legend into a workflow-specific panel.

### `segment-sidebar.tsx`

- Replace any `seg` local names with `segment`.
- Tighten `aria-current`.
- Consider extracting the row only if the file becomes harder to scan; do not
  create a row component just for aesthetics.

### `page-timeline.tsx`

- Make overlap policy explicit in code.
- Avoid repeated `segments.find` inside page rendering if this becomes hot.
- Rename highlighted-state variables consistently.

### `page-ribbon.tsx`

- Keep tiny-run hit area.
- Rename active terminology.
- Preserve separate current-page cursor and selected/highlighted outline.

### `segmented-document-viewer.tsx`

- Replace inline `seg` with `segment`.
- If the function remains visually dense, extract only one helper:
  `renderSegmentChrome`.
- Do not add layout props until a real consumer needs them.

## Tests

Add or update tests for:

- highlighted naming replacing active naming
- no legacy public names in source and generated registry output
- controlled interaction via caller-owned object or controlled hook
- overlapping page ownership in `PageTimeline`
- current-page aria semantics
- `data-highlighted`, `data-selected`, and `data-current`
- segment-first `onSelect` across legend, sidebar, timeline, and ribbon

Keep tests close to user-observable behavior. Do not test implementation names
except the explicit legacy-name regression scan.

## Verification

Required commands:

```bash
./node_modules/.bin/vitest run tests/segment-surfaces.test.tsx
./node_modules/.bin/eslint registry/new-york-v4/lib/segment-interaction.ts registry/new-york-v4/ui/use-segment-interaction.ts registry/new-york-v4/ui/segment-legend.tsx registry/new-york-v4/ui/segment-sidebar.tsx registry/new-york-v4/ui/page-timeline.tsx registry/new-york-v4/ui/page-ribbon.tsx registry/new-york-v4/ui/segmented-document-viewer.tsx tests/segment-surfaces.test.tsx
./node_modules/.bin/shadcn build --output public/r
./node_modules/.bin/shadcn registry validate
./node_modules/.bin/tsc --noEmit --pretty false --incremental false 2>&1 | rg "(segment-interaction|use-segment-interaction|segment-legend|segment-sidebar|page-ribbon|page-timeline|segmented-document-viewer|segment-surfaces)"
rg -n "activeId|onActivate|onSelectSegment|SegmentSurfaceInteraction|onHoverChange|onFocusChange|onSelectedChange|onSelectedIdChange|defaultSelectedId|selectedId\\?:" registry/new-york-v4 components content/docs tests lib public/r registry.json --glob '!node_modules'
```

The final `rg` command should return no matches for segment/sidebar/legend
files. Matches in unrelated systems must be inspected, not blindly removed.

## Completion Criteria

V3 is complete when:

- there is no public active vocabulary in the segment system
- there are no legacy prop names in source, docs, tests, or generated registry
- every surface uses the shared adapter for segment state
- controlled callers have one clean sanctioned path
- page overlap behavior is explicit
- aria semantics are precise
- tests cover the state model and regression scan
- generated registry output is in sync

At that point the system is small, sharp, and hard to misunderstand.
