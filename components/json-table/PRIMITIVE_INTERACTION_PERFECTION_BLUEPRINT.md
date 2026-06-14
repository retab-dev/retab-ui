# JSON Table Primitive Interaction Perfection Blueprint

## Current State

The enum select path is no longer the main problem.

Recent profiler evidence for `transactions.0.transaction_type` shows:

- enum open mounts `DataCellSelectPopup`, not Base UI select internals
- enum open performs one anchor `getBoundingClientRect()` read
- enum open renders only the target editable cell path
- enum commit closes the popup and renders only the same target editable cell path
- checkbox toggle can complete with no React renders in the measured path
- profiler assertions are checked in through `scripts/profile-json-table-primitive-interactions.mjs`

This is a strong local result. It is not perfection.

The remaining cost is architectural:

- primitive edit state is still coordinated by table-level state
- `SingleFileVirtualizedTable` and `SingleFileFormRow` still participate in simple editor open/close transitions
- select commit is contained, but still needs several React commits
- date picker is still much heavier than select
- the profiler proves a controlled route, not every production-sized document shape

## Goal

Make primitive cell interactions scale with the edited cell and the mounted editor only.

The ideal interaction model:

- opening a primitive editor does not rerender the table body
- moving editor-local active state does not involve row or table components
- committing a primitive value updates only the changed value identity and the minimal affected view model
- every primitive editor has the same low-cost overlay contract
- profiler assertions encode the expected invariants so regressions are visible immediately

## Non-Goals

- Do not rewrite virtualization.
- Do not introduce a second document mutation model.
- Do not change JSON value semantics.
- Do not replace all design-system primitives globally.
- Do not add compatibility adapters for older table editor flows.
- Do not optimize by hiding real work behind timers or deferred visual updates.

## Target Architecture

Primitive editing should split into three ownership layers:

```txt
Document/table projection
  owns document data, projected rows, visible paths, row identity

Primitive edit coordinator
  owns active primitive cell identity and lifecycle handoff

Cell-local editor primitive
  owns popup/input open state, option focus, overlay geometry, keyboard loop
```

The current shape is close, but table state still carries too much interaction detail. The next step is to make table-level state identify the active cell only, while editor-local state owns all transient UI behavior.

## Invariant 1: Table-Level State Is Identity Only

### Problem

Opening a primitive editor still changes table-level active edit state. That is why `SingleFileVirtualizedTable` and `SingleFileFormRow` still appear in profiler output for a simple select open.

This is better than rerendering sibling cells, but it is not the ideal boundary. The table should know which cell owns keyboard focus and edit lifecycle. It should not participate in option navigation, popup open state, or date picker panel state.

### Design

Constrain table edit state to a stable identity object:

```ts
type PrimitiveEditIdentity = {
  docId: string
  fieldPath: string
  sessionId: number
}
```

All editor-local transient state stays below the cell:

- popup open/closed
- active option index
- measured popup position
- calendar month
- typed draft text
- validation display
- pointer hover within the popup

The table publishes only:

- the active primitive identity
- commands to request focus, commit, cancel, or move to another cell
- stable callbacks for data mutation

### Success Criteria

- opening a select no longer rerenders `SingleFileFormRow`
- opening a select no longer produces same-props renders in `SingleFileVirtualizedTable`
- keyboard navigation inside the select popup does not touch table-level state
- closing an unchanged editor is local except for focus restoration

## Invariant 2: Primitive Editors Share One Overlay Contract

### Problem

The select path is now small because it uses a table-specific popup. The date picker still behaves like the older problem: larger DOM growth, more rect reads, and more React duration.

If each primitive editor invents its own overlay lifecycle, the table will keep accumulating one-off performance cliffs.

### Design

Create one DataCell overlay contract used by select, date, and future primitive popups:

```ts
type DataCellOverlayPosition = {
  left: number
  top: number
  width: number
  maxHeight: number
}

type DataCellOverlayController = {
  anchor: HTMLElement
  position: DataCellOverlayPosition
  close: () => void
  commitAndClose: (value: unknown) => void
}
```

Shared rules:

- measure the anchor once before opening
- render positioned on first mount
- close on scroll or resize unless the editor has a specific reason to reposition
- keep focus rules explicit
- avoid generic overlay libraries in table hot paths
- expose stable `data-slot` attributes for profiler assertions

Select already follows this shape. Date picker should be moved to it next.

### Success Criteria

- date picker open performs one anchor rect read
- date picker open has bounded DOM growth
- date picker open renders only the target editable cell path
- date picker month navigation is local to the picker
- date picker close does not rerender unrelated rows or cells

## Invariant 3: Projection Reuse Is Path-Aware

### Problem

The primitive commit path now preserves visible render containment in the profiled select case. The deeper requirement is stronger: a primitive value edit should preserve row and cell identity everywhere outside the changed path.

The current edit-store overlay avoids cloning unchanged cells, but the rule must stay path-aware: scalar edit lifecycle belongs to the primitive edit store, while structural document changes belong to projection.

### Design

Track the changed materialized field path with primitive edit-store state:

```ts
type PrimitiveEditState = {
  status: "idle" | "pending" | "confirmed" | "stale"
  fieldPath: string
  value: unknown
}
```

Use field-path indexing at the projection boundary:

```ts
type ProjectedCellIndex = Map<
  string,
  {
    rowIndex: number
    cellIndex: number
  }
>
```

Patch algorithm:

1. locate the changed projected cell through `ProjectedCellIndex`
2. reuse every projected row before and after the owning row
3. clone only the owning row
4. clone only the changed cell inside that row
5. rebuild the index only when visible paths or row structure changes

Fallback to full projection only for structural changes:

- array add/remove
- object key add/remove
- visible path changes
- document id changes
- schema edit changes

### Success Criteria

- primitive commit does not scan every visible cell in the row
- primitive commit replaces exactly one projected cell for scalar value changes
- structural edits still rebuild safely
- tests cover both scalar patch and array/object structural patch behavior

## Invariant 4: Stable Callback Surfaces

### Problem

Even when render output is memoized, unstable callback props can force the table, row, or cell layers to participate.

The select-path fix stabilized the document update callback through a ref. That pattern should become explicit instead of incidental.

### Design

At the table boundary:

- callbacks passed to rows are stable
- callbacks passed to cells are stable
- mutable external callbacks are read through refs
- command payloads carry identity and value rather than closing over row objects

Candidate command shape:

```ts
type PrimitiveCellCommand =
  | {
      type: "commit"
      docId: string
      fieldPath: string
      value: unknown
    }
  | {
      type: "cancel"
      docId: string
      fieldPath: string
    }
```

### Success Criteria

- profiler does not report table/row/cell renders caused only by callback identity churn
- architecture tests lock stable callback boundaries
- adding a new primitive editor does not require new table callback props

## Invariant 5: Measurement Is Intentional And Counted

### Problem

Performance drift often enters through measurement: hover geometry, overlay positioning, scroll alignment, focus restoration, and browser hit testing.

The profiler now counts rect reads for primitive interactions. That should become a permanent architecture rule.

### Design

Keep layout reads behind named helpers:

- `getDataCellSelectPopupPosition`
- future `getDataCellDatePopupPosition`
- lazy hover `getRect`
- focused scroll alignment helper

Avoid inline `getBoundingClientRect()` in primitive cell components except through these helpers.

Profiler assertions should remain strict:

- select open: one rect read
- date open: one rect read after date overlay rewrite
- hover-only movement: zero rect reads unless a geometry consumer is active
- commit-only interactions: zero popup anchor rect reads

### Success Criteria

- `rg "getBoundingClientRect"` in JSON table code returns only approved call sites
- profiler fails if select/date open exceed their rect-read budgets
- hover tests prove lazy geometry still works when needed

## Implementation Plan

### Phase 1: Lock The Current Select Win

Convert the current profiler evidence into explicit architecture tests:

- assert the select popup uses DataCell-owned slots
- assert Base UI select slots are absent in the JSON table select path
- assert select open keeps the popup positioned on first render
- assert select open has exactly one anchor measurement in the profiler script

This phase should not change behavior. It prevents regression while deeper work happens.

### Phase 2: Make Projection Patches Field-Indexed

Replace pending row scanning with a path-indexed projected cell patch:

- add or reuse a projected cell index
- store pending `fieldPath` with pending data
- patch only the indexed row/cell for scalar updates
- rebuild on structural edits
- extend tests around scalar versus structural projection reuse

This removes the last known avoidable work in primitive commit.

### Phase 3: Remove Row Participation From Editor Open

Move primitive editor open/close state fully into the active cell editor:

- table stores active identity only
- row receives stable identity state
- cell derives whether it owns the active session
- popup open state and option/date navigation stay local

This is the hardest phase because it touches keyboard handoff and focus restoration.

### Phase 4: Give Date Picker The Select Treatment

Build a table-specific `DataCellDatePopup` with the same overlay rules as select:

- one anchor measure before open
- fixed-position portal
- local calendar state
- explicit keyboard handling
- close on scroll/resize
- stable profiler slots

Then update the profiler assertions so date picker has the same render and measurement expectations as select.

### Phase 5: Broaden Profiling Inputs

The current profile route is intentionally controlled. Add large and awkward datasets:

- many rows
- many visible columns
- deeply nested field paths
- long enum labels
- sparse array/object data
- disabled enum options

The profiler should prove scale invariants, not just one sample table.

## Verification Plan

Run after each phase:

```sh
bun run test tests/json-table-boolean-enum-interactions.test.tsx
bun run test tests/json-table-session-virtualization-hardening.test.tsx
bun run test tests/json-table-session-interactions.test.tsx
bun run test tests/json-table-architecture.test.ts
bun x tsc --noEmit --pretty false
node scripts/profile-json-table-primitive-interactions.mjs --assert
```

Additional checks after date picker work:

- add a focused date picker interaction test
- add date-specific profiler assertions
- inspect the profiler JSON artifact for DOM growth, rect reads, and React commit count

## Final Success Criteria

The primitive interaction architecture is close to perfect when all of these are true:

- select open renders only the target cell editor
- date open renders only the target cell editor
- primitive popup open performs exactly one anchor measurement
- hover does no layout work without an active geometry consumer
- primitive scalar commit replaces exactly one projected cell
- table and row components do not rerender for editor-local state changes
- all primitive editor callbacks are stable at row/cell boundaries
- profiler assertions cover select, boolean, date, and commit paths
- large profile datasets preserve the same interaction invariants

## Open Questions

- Should table-level active identity be stored in React state, an external store, or a small evented controller?
- Should focus restoration remain table-owned, or become a primitive editor responsibility with table commands?
- Should structural projection rebuilds be explicit operations rather than inferred from patch shape?
- Should the profiler become part of CI, or stay as a local performance gate until it is less environment-sensitive?

## Definition Of Perfection

Perfection here does not mean zero work. It means the work is exactly proportional to the user action.

For a primitive cell editor:

- opening edits the editor, not the table
- navigating the editor edits the editor, not the row
- committing a scalar value edits one value, not the projected document
- measuring layout happens once, at the boundary where geometry is needed
- every remaining render has a clear reason visible in profiler output
