# DataCell and JSON Table Platonic Ideal Blueprint

## Verdict

The hard cutover is implemented.

Primitive drafts, primitive overlays, pointer caret geometry, and primitive
commit metadata belong to `DataCell`. `json-table` owns projection, active
identity, virtualization, structured object/array sessions, and document
commits. Cross-cell primitive handoff is now an explicit
`DataCellEditorHandle`, not a DOM-query blur protocol.

The remaining imperfection is intentionally narrow:

- `EditableJsonTableCell` still owns the grid-shell activation bridge.
- the bridge forwards pointer/key requests when the event starts on the `td`
  rather than inside `DataCell`.
- boolean shell Space/click still commits at the table boundary because it is a
  single-value command, not a draft editor.
- cross-cell handoff still uses `flushSync` inside one helper to preserve dirty
  draft ordering during the same browser event.

That is the current irreducible compromise: the grid can have focus, so the
grid must be able to ask the primitive editor to start. The grid must not know
how the primitive editor works.

## One-Sentence Ideal

The table renders a projected cell; `DataCell` owns every primitive interaction;
the table commits final JSON values.

Everything else is either structured editing or bloat.

## Target Ownership

### JSON Table Owns

- document identity
- schema interpretation
- row and column projection
- virtualization
- active primitive cell identity
- structured object/array edit sessions
- JSON value normalization at the document boundary
- focus movement between table cells

### DataCell Owns

- primitive display
- pointer activation
- keyboard activation once focused
- caret placement
- primitive draft
- primitive picker/select open state
- boolean toggle semantics
- blur, Enter, and Escape behavior
- primitive commit metadata

### The Adapter Owns

`json-table` still needs a tiny adapter between JSON fields and primitive
controls. That adapter owns only translation:

- `FieldMetadata` -> `DataCellKind`
- JSON value -> `DataCellValue`
- enum JSON value -> select option value
- primitive commit -> JSON value
- JSON table class names

It must not own draft, overlay, pointer coordinates, or caret geometry.

## Desired Module Shape

```txt
components/json-table/
  editable-json-table-cell.tsx        chooses primitive vs structured
  json-table-primitive-cell.tsx       thin DataCell adapter
  json-table-structured-cell.tsx      object/array popover editor
  json-table-cell-state.ts            active identity and structured session types
  json-table-display-cell.tsx         value formatting and DataCell adapter helpers
  use-cell-controller.ts              optimistic document commit boundary
```

`editable-json-table-cell.tsx` should become boring. Its ideal job:

```txt
if no projected field -> render empty disabled cell
if read-only -> render read-only cell
if primitive -> render JsonTablePrimitiveCell
if structured -> render JsonTableStructuredCell path
```

No primitive caret math. No primitive draft. No primitive DOM-query handoff. No
primitive parse logic.

## State Shape

```ts
type JsonTablePrimitiveActiveCell = {
  cellId: JsonTableCellId
  docId: string
  fieldPath: string
}

type JsonTableStructuredEditSession = {
  id: number
  cellId: JsonTableCellId
  docId: string
  fieldPath: string
  intent: JsonTableActivationIntent
  isOverlayOpen: boolean
}
```

Primitive state is identity only.

Structured state is richer because object/array editors are table-owned
popovers, not primitive DataCell controls.

There is no shared `JsonTableEditSession`.

## The Hard Problem

The hard problem is switching from one primitive cell to another.

Today, the table may receive a `pointerdown` on the next cell while the previous
`DataCell` still owns a dirty local draft. If React simply replaces the active
cell, the draft can be lost before blur commits it. The current implementation
uses a synchronous finish path to force the previous editor to complete before
the next gesture proceeds.

That path now exposes a tiny explicit lifecycle handle:

```ts
type DataCellEditorHandle = {
  finish: () => void
  cancel: () => void
}
```

Then cross-cell handoff becomes:

```txt
new cell receives activation
  -> table asks active DataCell handle to finish
  -> active DataCell commits/cancels using its own rules
  -> table changes active identity
  -> new DataCell activates
```

No DOM query. No forced blur as protocol. No accidental dependence on jsdom
focus behavior. No `flushSync` as the public contract.

`flushSync` may remain as an implementation detail inside the handoff boundary
only if React ordering makes it unavoidable, but it must not leak into primitive
activation itself.

## Activation Model

### Normal Pointer Click

```txt
pointer lands on DataCell display
  -> DataCell captures display text geometry
  -> DataCell becomes active through onActiveChange(true)
  -> DataCell mounts the native control
  -> DataCell focuses and places caret
```

The table does not calculate text geometry for this path.

### Table Shell Pointer Click

This exists only for empty cell chrome or test-driven cell activation.

```txt
pointer lands on td, not DataCell
  -> table forwards a pointer activation request
  -> DataCell activates and interprets the pointer request
```

The table may forward pointer coordinates. It must not measure text, inspect
display spans, or calculate caret offsets.

### Keyboard From Focused Table Cell

The grid may keep `td` focus for navigation. Therefore keyboard activation from
the table shell is legitimate:

```txt
focused td receives printable key / Enter / F2 / Space
  -> table sets primitive active identity with keyboard activation request
  -> DataCell owns the resulting primitive edit behavior
```

This is the remaining reason for an activation bridge. The primitive key
predicate comes from `DataCell`; the table does not maintain a second copy of
primitive keyboard rules.

## Naming Cleanup

Names that were changed:

- `JsonTableActiveCell` -> `JsonTableStructuredActiveCell`
- `closeEditSession` local structured prop -> `closeStructuredEditSession`
- `editSession` local structured prop -> `structuredEditSession`
- `primitiveActivationIntent` -> `primitiveActivationRequest`

Same concept, same name everywhere. Different concept, different name.

## Deletion List

Deleted from `EditableJsonTableCell`:

- primitive text hit-testing
- primitive kind-specific keyboard rules
- DOM query handoff logic
- `flushSync` outside a single lifecycle helper

Deleted from table state:

- primitive draft value
- primitive picker-open state
- primitive overlay-open state
- primitive parse/format draft logic
- shared edit-session type

Deleted from tests:

- assertions that treat primitive cells as sessions
- harness state that stores primitive drafts
- stale `draftValue` overrides for json-table primitive render helpers

## Required New Boundary

The explicit primitive lifecycle boundary is:

```ts
type JsonTablePrimitiveCellProps = {
  fieldMetadata: FieldMetadata
  effectiveValue: unknown
  isActive: boolean
  isEditable: boolean
  activationRequest?: DataCellActivationIntent
  onActiveChange: (active: boolean) => void
  onCommit: (value: unknown, meta: DataCellValueMeta) => void
  onEditingEnd: () => void
  onEditorHandleChange: (handle: DataCellEditorHandle | null) => void
}
```

The ideal `EditableJsonTableCell` passes identity and callbacks. It does not
know how the primitive editor works.

## Interaction Contract

Text:

- first click edits immediately
- caret lands at the clicked character boundary
- typing inserts at the caret
- printable-key activation replaces with that key
- blur commits once
- Enter commits once
- Escape cancels and closes
- clicking another cell commits before switching

Number:

- first click edits immediately
- pointer activation edits the existing value
- printable-key activation starts replacement draft
- invalid numeric drafts commit `null` with invalid metadata
- empty numeric drafts commit `null` with valid empty metadata

Boolean:

- click toggles exactly once
- Space toggles exactly once
- Enter/F2 focuses without auto-toggle
- Escape closes focused checkbox without commit

Enum/select:

- first click opens once
- activation click tail does not close it
- option selection preserves original JSON identity
- Escape closes without commit
- outside click closes without commit

Date/time:

- first click opens once
- display and editor use the same trompe-l'oeil formatting
- date selection commits normalized JSON string
- Escape/outside closes without commit
- active virtual row stays elevated while popup is open

Virtualization:

- inactive rows do not rerender for active primitive drafts
- active row stays mounted/elevated while overlay is open
- scrolling active row out finishes according to explicit lifecycle policy
- row keys never move active editor state to another row

## Performance Contract

The table render cost should depend on:

- visible rows
- visible columns
- active identity
- structured session identity
- committed document data

It should not depend on:

- primitive draft text
- primitive picker open state
- primitive cursor position
- primitive hover state
- primitive overlay internal state

The protected perf paths:

- hover sweep across many cells
- first click into text
- type one printable key into focused cell
- click dirty text -> boolean
- click dirty text -> enum option
- click dirty text -> date picker
- scroll with no active cell
- scroll with active picker

## Migration Plan

1. Done: rename structured-only components and props so the code stops lying.
2. Done: extract `JsonTablePrimitiveCell` from `EditableJsonTableCell`.
3. Done: move primitive kind/key activation rules behind `DataCell`.
4. Done: introduce `DataCellEditorHandle`.
5. Done: replace DOM-query/blur handoff with explicit editor handle handoff.
6. Done: confine required `flushSync` to one lifecycle helper.
7. Done: delete primitive text geometry calculation from table code.
8. Done: delete stale test/harness session language for primitive render
   helpers.
9. Done: update architecture diagrams to show `EditableJsonTableCell` as a
   router, not an interaction owner.
10. Remaining: re-profile hover, click-to-edit, type-to-edit, and scroll paths
    against the new boundary.

## Success Criteria

We have reached the ideal when these are all true:

- `EditableJsonTableCell` can be understood in under one minute.
- `JsonTablePrimitiveCell` is only a JSON/DataCell adapter.
- `DataCell` is the only primitive gesture owner.
- primitive drafts never leave DataCell.
- primitive overlay state never leaves DataCell.
- cross-cell handoff is explicit, not inferred from DOM focus.
- table code has no text hit-testing.
- table code has no primitive pointer coordinates for normal DataCell clicks.
- structured object/array editing is the only rich table session.
- every variable name says exactly which layer owns the concept.

The final architecture should feel inevitable:

```txt
projection chooses cells
cell router chooses primitive or structured
DataCell edits primitives
structured editor edits objects and arrays
commit boundary writes JSON
```

Nothing more.
