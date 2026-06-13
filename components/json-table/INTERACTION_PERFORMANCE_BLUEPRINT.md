# JSON Table Interaction Performance Blueprint

## Current State

The enum select overlay no longer uses the generic Base UI select stack. Opening a select now mounts `DataCellSelectPopup` instead of Base UI `SelectContent`, `Positioner`, `Popup`, and backdrop internals.

The latest select-open probe showed:

- custom popup mounted: yes
- Base UI select mounted: no
- popup options: 2
- React actual duration: about `3.7ms`
- JavaScript layout reads: 2 total
- DOM node growth: +16

That proves the select overlay architecture is now small. It does not prove the full interaction path is optimal.

Remaining symptoms:

- select open elapsed is still about `152ms` in the probe
- style recalculation is still high on open
- open still performs one table hover rect read plus one popup anchor rect read
- open plus commit still fans out through document patch and projection
- commit still rerenders many same-props cells

## Goal

Make primitive JSON table interactions feel instant and scale with the changed cell, not the mounted table.

Target behavior:

- opening an enum popup should render in one visible pass
- opening should require only the measurements strictly needed for the popup
- hover should not measure cell geometry unless a consumer needs geometry
- committing one primitive value should preserve object identity for unaffected projected rows and cells
- performance regressions should be caught by a repeatable profiler assertion

## Non-Goals

- Do not rewrite the table renderer.
- Do not change JSON value semantics.
- Do not introduce a second commit pipeline.
- Do not weaken virtualization.
- Do not reintroduce generic overlay primitives into the JSON table select hot path.

## Phase 1: Remove Unused Hover Measurement

### Problem

`shellPointerEnter` currently calls `event.currentTarget.getBoundingClientRect()` before invoking `onCellHoverStart`.

For primitive editing, that measurement is usually unrelated to opening the editor. In the select-open probe, it accounted for one of the two JavaScript rect reads.

### Design

Move hover geometry behind demand:

- if no hover consumer is registered, do not measure
- if the consumer only needs identity, pass doc id and field path without rect
- if a consumer needs geometry, provide a lazy `getRect` function instead of an eager rect

Proposed event shape:

```ts
type JsonTableCellHoverStart = {
  docId: string
  fieldPath: string
  getRect: () => DOMRect
}
```

Consumers that need geometry call `getRect()`. Consumers that only need identity avoid layout work.

### Verification

- select-open rect probe should drop from 2 rect reads to 1 for the popup anchor
- hover tests should still pass
- any hover overlay should still position correctly when actually shown

## Phase 2: Render Popup Positioned On First Mount

### Problem

Earlier versions opened local state before the popup position was known. The current shape measures in `DataCellSelectControl` before opening, then renders `DataCellSelectPopup` with a position.

That keeps the component simple, but it creates an extra layout-effect cycle.

### Design

Measure before opening:

1. `DataCellSelectControl` receives the open command
2. read `triggerRef.current.getBoundingClientRect()`
3. compute the fixed popup position synchronously
4. store `{ open: true, position, activeOptionIndex }` in one state update
5. render `DataCellSelectPopup` already positioned

`DataCellSelectPopup` should become a pure overlay:

```ts
type DataCellSelectPopupProps = {
  id: string
  position: DataCellSelectPopupPosition
  value: string | null
  activeIndex: number
  options: DataCellSelectOption[]
  onActiveIndexChange: (index: number) => void
  onCommit: (value: string) => void
  onCancel: () => void
  onOutsidePointerDown: (event: PointerEvent) => void
}
```

This keeps the one necessary popup measurement but removes the unpositioned first render.

### Verification

- select-open React commit count should decrease
- popup should be visible on first mounted frame
- rect reads should remain 1 after Phase 1
- Escape, outside click, keyboard navigation, and same-value close should keep passing

## Phase 3: Preserve Projection Identity On Primitive Commit

### Problem

Open is now local, but commit is still broad. A single primitive patch can cause many projected rows and cells to receive new object identities, producing same-props rerenders across mounted cells.

This is now the main remaining architectural cost.

### Design

Make projection patch-aware.

For a primitive patch:

- identify the changed materialized field path
- identify the projected row that owns that field path
- reuse previous projected row objects for unaffected rows
- reuse previous projected cell objects for unaffected cells
- only replace the changed projected cell and any row-level object that actually changed

The projection cache should sit at the table-view boundary, not inside individual cells.

Candidate API:

```ts
type ProjectDocumentRowsCache = {
  documentId: string
  visiblePaths: string[]
  rows: ProjectedRow[]
}

function projectDocumentRowsWithReuse(args: {
  previous: ProjectDocumentRowsCache | null
  document: TableDocument
  visiblePaths: string[]
  changedFieldPath: string | null
  includeArrayAddRows: boolean
}): ProjectDocumentRowsCache
```

Rules:

- if visible paths change, rebuild
- if document id changes, rebuild
- if array structure changes, rebuild the affected array region
- if a primitive leaf changes, reuse every row and cell outside that path

### Verification

- committing `transactions.0.transaction_type` should not rerender unrelated mounted cells
- checkbox commit should no longer report hundreds of same-props `EditableJsonTableCell` renders
- projected values must update correctly for changed cells
- array add/remove behavior must remain correct

## Phase 4: Separate Open Cost From Commit Cost In Tooling

### Problem

One-off profiling proved the current behavior, but it is too easy to regress. The repo needs a repeatable profiler command that asserts the important invariants.

### Design

Add a checked-in profiler script for JSON table primitive interactions.

Scenarios:

- open enum popup
- open enum popup and commit another value
- toggle boolean
- open date picker as a comparison baseline

Assertions:

- enum open mounts `[data-slot="data-cell-select-popup"]`
- enum open does not mount Base UI select slots
- enum open rect reads are at or below the expected count
- enum open renders only the active row/cell path
- enum commit closes the popup and updates the document
- enum commit does not rerender unrelated mounted cells after Phase 3

The script should write JSON artifacts under `tmp/` and fail with a clear assertion message.

### Verification

Run:

```sh
node scripts/profile-json-table-primitive-interactions.mjs --assert
```

The command should be deterministic enough for local regression checks. CI wiring can come later.

## Success Criteria

The interaction path is complete when current evidence proves:

- enum open uses the DataCell-owned popup only
- enum open performs one popup anchor measurement and no eager hover measurement
- enum open has no unrelated row or cell renders
- enum open renders the popup positioned on first mount
- primitive commit updates the changed value without same-props rerender fanout
- profiling assertions are checked into the repo
- focused interaction, architecture, and type checks pass

## Implementation Order

1. Gate or lazify hover rect measurement.
2. Move enum popup positioning into the open state transition.
3. Add the checked-in primitive interaction profiler with current open assertions.
4. Make projection reuse object identity for primitive patches.
5. Tighten profiler assertions around commit fanout.

This order removes the cheap measurable waste first, then makes the remaining broad commit path visible and enforceable while it is being fixed.
