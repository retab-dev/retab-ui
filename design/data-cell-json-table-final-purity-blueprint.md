# DataCell and JSON Table Final Purity Blueprint

## Verdict

Implemented.

The system is now correctly split at the highest level:

- `DataCell` owns primitive editing.
- `json-table` owns projection, virtualization, identity, and JSON commits.
- structured object/array editors remain table-owned because they are not
  primitive controls.

The bloat targeted by this blueprint lived in one place:
`EditableJsonTableCell`.

That file still combines four responsibilities:

- cell routing
- grid-shell activation
- primitive handoff ordering
- structured active rendering

This blueprint is therefore not another rewrite of `DataCell`. It is a
decomposition of the table cell shell until each behavior has one precise
owner.

## Implementation Status

The extraction is complete:

- `EditableJsonTableCell` is a 40-line router.
- `JsonTableStructuredActiveCell` owns structured active rendering.
- `json-table-cell-memo.ts` owns memo comparison shape.
- `json-table-primitive-handoff.ts` owns synchronous previous-editor finish.
- `json-table-primitive-command.ts` owns boolean command semantics.
- `json-table-primitive-activation.ts` owns shell pointer/key activation.
- `use-json-table-editable-cell-model.ts` wires these boundaries into a table
  cell model.
- architecture tests forbid the extracted responsibilities from returning to
  the router file.

## One-Sentence Target

`EditableJsonTableCell` should become a pure router; every interaction rule
should live in a named boundary that owns exactly that rule.

## Pre-Implementation Impurities

### 1. `EditableJsonTableCell` Is Still Too Dense

It still contains:

- primitive activation state
- shell pointer activation
- shell keyboard activation
- boolean command activation
- previous primitive finish ordering
- structured active component definition
- memo variable shaping
- focus restoration
- hover reporting
- disabled-cell fallback rendering

None of these are individually bad. The impurity is that they sit in one file
and force the reader to hold the whole table interaction model at once.

### 2. Shell Activation Is Not Named As A Boundary

There are two legitimate activation paths:

```txt
DataCell display event -> DataCell self-activation
td shell event          -> grid-shell activation bridge
```

The first path is pure.

The second path is necessary because the grid cell itself can hold focus and
receive keyboard events. But today it is inline code, not a boundary with a
small vocabulary.

### 3. Boolean Is A Command, Not An Editor

Boolean activation still looks like a primitive exception in the table shell.
That exception is conceptually correct: clicking a checkbox is a one-step
command, not a draft-editing session.

The problem is naming. The code should say "primitive command", not hide the
command inside generic primitive activation code.

### 4. Handoff Uses `flushSync`

The explicit editor handle is correct:

```ts
type DataCellEditorHandle = {
  finish: () => void
  cancel: () => void
}
```

The remaining imperfection is that cross-cell handoff still uses `flushSync`.
This may be unavoidable during same-event pointer handoff, but it should be
isolated in a module whose name makes the constraint explicit.

### 5. Structured Active Rendering Lives In The Router File

`JsonTableStructuredActiveCell` is still defined inside
`editable-json-table-cell.tsx`.

That makes the router file responsible for object/array editing details. It
should only choose the structured path and pass the identity/context onward.

## Target Module Shape

```txt
components/json-table/
  editable-json-table-cell.tsx
    pure router and td shell

  json-table-primitive-cell.tsx
    FieldMetadata/value adapter into DataCell

  json-table-primitive-activation.ts
    grid-shell pointer/key activation bridge

  json-table-primitive-handoff.ts
    explicit previous-editor finish/cancel ordering

  json-table-primitive-command.ts
    boolean and other command-style primitive actions

  json-table-structured-active-cell.tsx
    structured active wrapper and row elevation

  json-table-structured-cell.tsx
    object/array editor popover

  json-table-cell-memo.ts
    memo comparison variables for editable table cells
```

The router should read like this:

```tsx
if (!projectedField) return <DisabledJsonTableCell />

const cellModel = useJsonTableEditableCellModel(props)

return (
  <TableCell {...cellModel.shellProps}>
    {cellModel.kind === "primitive" ? (
      <JsonTablePrimitiveCell {...cellModel.primitiveProps} />
    ) : cellModel.kind === "structured-active" ? (
      <JsonTableStructuredActiveCell {...cellModel.structuredProps} />
    ) : (
      <JsonTableDisplayCell {...cellModel.displayProps} />
    )}
  </TableCell>
)
```

The file should contain no inline primitive rules and no structured editor
internals.

## Ownership Map

### `EditableJsonTableCell`

Owns:

- table cell element
- table cell data attributes
- branch between disabled, primitive, structured-active, and display
- attaching already-built event handlers

Does not own:

- keyboard filtering
- pointer intent construction
- previous editor finish ordering
- boolean command semantics
- structured popover internals
- memo variable construction

### `json-table-primitive-activation.ts`

Owns:

- deciding whether a shell pointer event should activate a primitive cell
- deciding whether a shell keyboard event should activate a primitive cell
- constructing a `DataCellActivationIntent`
- calling `canActivateDataCellFromKey`

Does not own:

- text measurement
- caret offsets
- draft values
- overlay state
- JSON commits

### `json-table-primitive-command.ts`

Owns:

- primitive command classification
- boolean click/Space toggling
- future command primitives, if any

Does not own:

- draft editors
- select/date picker opening
- text/number input activation

### `json-table-primitive-handoff.ts`

Owns:

- finishing the previous primitive editor before activating the next one
- clearing the current primitive editor handle
- documenting why synchronous ordering is required

Allowed impurity:

- `flushSync`, if and only if tests prove same-event handoff otherwise drops
  dirty drafts.

### `JsonTableStructuredActiveCell`

Owns:

- structured row elevation
- object/array commit boundary
- structured popover lifecycle
- structured profiler labels

Does not own:

- primitive activation
- primitive editor handles
- table-cell event handling

## State Shape

The state shape remains correct:

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

Do not merge them.

Primitive identity is enough because `DataCell` owns primitive editing.
Structured sessions need richer state because object/array editors are
table-owned popovers.

## Activation Contract

### Pointer On DataCell

```txt
event target is DataCell
  -> table does nothing
  -> DataCell self-activates
  -> DataCell owns caret/overlay behavior
```

### Pointer On Table Shell

```txt
event target is td shell
  -> primitive activation bridge constructs pointer request
  -> primitive handoff finishes previous editor
  -> table sets primitive active identity
  -> DataCell interprets the request
```

The bridge may forward `clientX`, `clientY`, and `detail`.

The bridge must not measure text or calculate selection offsets.

### Keyboard On Table Shell

```txt
focused td receives keydown
  -> primitive activation bridge filters platform/navigation keys
  -> DataCell key predicate accepts or rejects primitive activation
  -> primitive command handler may execute command
  -> otherwise table sets primitive active identity
```

There must be exactly one primitive key predicate: `DataCell`.

## Handoff Contract

When moving from one primitive cell to another:

```txt
next shell event starts
  -> finish previous primitive handle
  -> clear previous handle ref
  -> clear previous active identity
  -> set next active identity
```

The previous editor decides what finish means.

Examples:

- text/number: commit current input value
- select/date/time: close without committing if no option/date was chosen
- boolean: end focus without extra commit

The table must not infer finish behavior from DOM focus.

## Naming Contract

Use these names everywhere:

- `primitiveActiveCell` for primitive identity
- `structuredEditSession` for object/array session state
- `activationRequest` for table-to-DataCell primitive activation
- `activationIntent` for DataCell-internal activation semantics
- `primitiveCommand` for boolean-style one-step primitive changes
- `finishPrimitiveEditor` only as a module function if it wraps
  `DataCellEditorHandle.finish`

Avoid these names:

- `editSession` for primitives
- `activeCell` when the value is structured-only
- `overlayOpen` without the owning layer in the name
- `close` as a prop name without the thing being closed

## Deletion Plan

Delete from `editable-json-table-cell.tsx`:

- inline `JsonTableStructuredActiveCell`
- inline shell key filtering
- inline shell pointer activation request construction
- inline boolean toggle command
- inline primitive handoff implementation
- inline memo variable shaping

Keep in `editable-json-table-cell.tsx`:

- projected-field existence branch
- `TableCell` markup
- primitive/structured/display branch
- wiring of named handlers returned by helper modules/hooks

## Implementation Plan

1. Extract `JsonTableStructuredActiveCell` to
   `json-table-structured-active-cell.tsx`.
2. Extract `editableCellMemoVariables` to `json-table-cell-memo.ts`.
3. Extract previous primitive finish logic to `json-table-primitive-handoff.ts`.
4. Extract boolean command behavior to `json-table-primitive-command.ts`.
5. Extract shell pointer/key activation decisions to
   `json-table-primitive-activation.ts`.
6. Replace `didActivateBeforeClickRef` with a named shell activation guard.
7. Collapse `EditableJsonTableCellContent` into a declarative router.
8. Add architecture tests that forbid the deleted inline responsibilities from
   reappearing in the router file.
9. Rerun the full JSON-table interaction, virtualization, accessibility, and
   browser-sequence suites.
10. Re-profile hover, first click, type-to-edit, dirty handoff, and scroll.

## Architecture Tests

Add or extend guards so `editable-json-table-cell.tsx` cannot contain:

- `flushSync`
- `canActivateDataCellFromKey`
- `DataCellEditorHandle`
- `structuredEditSessionId`
- `recordJsonTableRender("JsonTableStructuredActiveCell"`
- `event.getModifierState("AltGraph")`
- `fieldMetadata.kind === "boolean"`
- `activationRequest: {`

Those concepts should exist, but not in the router file.

## Interaction Tests To Preserve

The final refactor is valid only if these still pass:

- first click into text places the caret
- typing after click inserts, not replaces
- printable key activation replaces
- dirty text commits before switching cells
- dirty text commits when virtualized out
- pending document data survives parent lag
- enum first click opens and stays open through click tail
- enum Escape closes without commit
- enum outside pointer closes without commit
- enum option preserves JSON identity
- date display and active editor match formatting
- date picker opens on first click
- boolean click toggles exactly once
- boolean Space toggles exactly once
- Enter/F2 on boolean does not toggle
- unrelated mounted virtual rows do not activate
- active row stays elevated while overlay is open

## Performance Tests To Preserve

The final architecture should not add render pressure to:

- hover sweep over visible cells
- primitive first-click activation
- type one character into text/number
- select option commit
- date picker open/close
- scroll with no active cell
- scroll with an active primitive editor
- scroll with an active overlay

The table render cost must still depend on visible rows, visible columns,
active identity, structured session identity, and committed or pending document
data. It must not depend on primitive draft text, primitive cursor position, or
primitive overlay internals.

## Success Criteria

We reach the next ideal when:

- `editable-json-table-cell.tsx` is under 200 lines.
- the router file has no primitive-kind branches except primitive vs
  structured classification.
- all primitive shell activation logic is in one activation module.
- all previous-editor finish ordering is in one handoff module.
- all boolean command semantics are in one command module.
- structured active rendering is outside the router file.
- architecture tests prevent the old inline responsibilities from returning.
- all JSON-table and DataCell tests pass.
- profiler output shows no new render churn on primitive draft changes.

The final shape should be boring:

```txt
projection -> row -> cell router
cell router -> primitive adapter -> DataCell
cell router -> structured active cell -> structured editor
DataCell/editor -> commit boundary -> pending document data -> document patch
```

Nothing hidden. Nothing duplicated. Nothing decorative.
