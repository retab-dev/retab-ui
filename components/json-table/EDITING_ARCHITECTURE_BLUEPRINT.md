# JSON Table Editing Architecture Blueprint

## Platonic Standard

This component has not reached the platonic ideal yet.

The ideal is:

> A grid renders values. An edit session edits one value. A commit pipeline
> writes the result.

Everything else should be implementation detail.

The target architecture must optimize for:

- simplicity: one concept owns one responsibility
- speed: inactive cells stay inert and cheap
- completeness: every native interaction is accounted for
- nothing extra: no duplicate editing lifecycles
- perfect modularization: projection, grid, editor, commit, and visual
  primitives are separate
- high-entropy state: state names express domain concepts, not symptoms
- consistent language: the same concept has the same name everywhere

## Diagnosis

The current cell editing system has too many overlapping state machines for one
interaction.

A single editable cell can currently involve:

- table cell active/inactive state
- hover state
- pointer active state
- activity lock state
- focused field state
- draft text state
- select open state
- nested editor path state
- `DataCell` display/edit/auto state
- native input/select/checkbox state

The deeper problem is that "cell" means too many things:

- visual table cell
- hover target
- focus target
- editor host
- draft owner
- popover owner
- commit owner
- native control wrapper
- schema dispatcher

That makes the system fragile. Hover mounting accidentally made the real control
exist before the click, which hid the deeper issue: after hover mounting was
removed, the first pointer event landed on a display shell instead of the native
control the user expected to operate.

The architecture should be reduced to one clear rule:

> A table cell is either displaying or participating in one edit session. The
> table decides which edit session exists. The editor owns native interaction
> semantics.

## Target Model

The table should own one edit session, not many per-cell editing states:

```ts
type CellId = `${string}:${string}`

type EditSession = null | {
  cellId: CellId
  docId: string
  fieldPath: string
  intent: ActivationIntent
  initialValue: unknown
  draft: unknown
  status: "editing" | "committing" | "closing"
}
```

The activation intent should preserve why editing started:

```ts
type ActivationIntent =
  | { type: "pointer"; clientX: number; clientY: number; detail: number }
  | { type: "keyboard"; key: string }
  | { type: "programmatic" }
```

Projected cells should be pure data:

```ts
type ProjectedCell = {
  cellId: CellId
  docId: string
  fieldPath: string
  kind: FieldKind
  value: unknown
  schema: JSONSchema7
  displayValue: string
  isEditable: boolean
}
```

Rendering should become a direct choice:

```tsx
editSession?.cellId === projectedCell.cellId ? (
  <CellEditor cell={projectedCell} session={editSession} />
) : (
  <CellDisplay cell={projectedCell} />
)
```

There should be no hover-mounted editors, no per-cell edit state, and no
table-level special cases for text, boolean, enum, date, or nested values.

The pure data flow is:

```txt
document + schema
  -> projected cells
  -> virtual grid display
  -> one edit session
  -> field editor
  -> normalized commit
  -> document patch
```

## Component Boundaries

### Table and Row Layer

Owns:

- selected cell identity
- edit session identity
- visible rows and columns
- source hover highlighting
- document updates

Does not own:

- caret placement
- checkbox toggling
- select opening
- draft input behavior
- editor-specific focus behavior

Minimal table-level state should be close to:

```ts
type GridInteractionState = {
  hoveredCellId: CellId | null
  selectedCellId: CellId | null
  editSession: EditSession
}
```

Overlay state should live inside the edit session unless there is a concrete
reason to lift it.

### Editable Table Cell

Should become thin:

- render display or editor based on `editSession`
- capture pointer and keyboard activation intent
- call `startEditSession(...)`

It should not own local editing lifecycle state such as:

- `isPointerActive`
- `isActivityLocked`
- `shouldAutoFocus`
- `isInputFocused`
- `isSelectOpen`

It should be almost this small:

```tsx
<td onPointerDown={activate} onKeyDown={activateFromKeyboard}>
  {isEditing ? (
    <CellEditor cell={cell} session={session} />
  ) : (
    <CellDisplay cell={cell} />
  )}
</td>
```

### Cell Editor

Dispatches by field kind and passes the projected cell plus edit session down:

```tsx
<CellEditor cell={projectedCell} session={editSession} onCommit={commit} />
```

### Individual Editors

Each editor owns the native behavior for its control:

- text and number: focus input, place caret from pointer intent when possible
- boolean: toggle on pointer or Space, focus checkbox for keyboard activation
- enum: open select on pointer or Enter
- date/time: focus or open picker according to intent
- object/array: open nested editor

The table should never need to know that boolean means toggle, enum means open,
or text means focus an input.

## Layer Responsibilities

### Projection Layer

Converts document, schema, and visible columns into projected cells.

Owns:

- path resolution
- field kind resolution
- display value derivation
- editability

Does not own:

- React state
- focus
- draft values
- commits
- editor behavior

### Grid Layer

Renders projected cells and owns grid interaction state.

Owns:

- hover identity
- selected identity
- one edit session
- virtualization integration

Does not own:

- editor-specific behavior
- native control details
- value parsing

### Edit Session Layer

Owns the lifecycle of editing one value.

Owns:

- edited cell identity
- initial value
- draft value
- activation intent
- editing/committing/closing status
- overlay activity when needed

This is the missing concept in the current implementation. Editing should not be
implied by scattered booleans such as `isPointerActive`, `shouldAutoFocus`, or
`isActivityLocked`.

### Control Layer

Owns native interaction for each field kind.

Owns:

- focus behavior
- caret placement
- select opening
- checkbox toggling
- picker behavior
- draft input changes

Does not own:

- grid selection
- row projection
- document patching

### Commit Pipeline

Owns conversion from editor output to document data.

Owns:

- raw draft normalization
- schema-aware parsing
- null/empty handling
- document patch creation

## DataCell Simplification

`DataCell` should stop being both a renderer and a mini edit state machine.

Split the concept into smaller primitives.

### DataCellDisplay

Pure display:

- formats value
- renders inert shell
- cheap to mount
- no draft state
- no hover edit
- no commit path

### DataCell Controls

Pure active controls:

- assumes editing is already active
- owns native control semantics
- owns draft behavior
- emits commit/cancel events

Possible primitive surface:

```tsx
<DataCellDisplay />
<DataCellTextInput />
<DataCellNumberInput />
<DataCellBooleanControl />
<DataCellPickerControl />
```

Formatting and parsing should be helpers, not hidden editing lifecycle state:

```ts
formatDataCellValue(kind, value)
parseDataCellValue(kind, rawValue, options)
```

The JSON table path should avoid `mode="auto"`. Auto mode is the ambiguous
middle layer that makes the first-click behavior hard to reason about.

The JSON table already has a grid editing model. Nesting another auto-edit model
inside `DataCell` is the bloat.

## Interaction Rules

### Pointer Activation

1. Pointer down on inactive cell records an activation intent.
2. Table starts one edit session.
3. Editor consumes the intent.
4. Editor performs native-equivalent behavior.

Examples:

- text: focus input and place caret at the clicked location
- boolean: toggle once
- enum: open menu
- date/time: focus or open picker

### Keyboard Activation

1. Focused table cell receives Enter, F2, Space, or a typeable key.
2. Table activates the cell with keyboard intent.
3. Editor decides how to apply that key.

Examples:

- text: first typeable key starts draft with that character, or replaces
  selected text if selection exists
- boolean: Space toggles
- enum: Enter opens

### Blur and Commit

The editor should own commit/cancel behavior.

On blur:

- editor commits or cancels according to its rules
- table clears `editSession`
- no generic per-cell activity lock should be needed

### Portals and Popovers

Editors with overlays may need to keep the edit session alive while an external
portal is open. That should be an explicit editor request, not a generic
table-level activity lock web.

For example:

```ts
type EditorActivity = {
  isOverlayOpen: boolean
}
```

The table can then avoid clearing `editSession` while the editor reports an open
overlay.

## Naming Rules

Names should describe domain concepts, not implementation symptoms.

Prefer:

- `editSession`
- `cellId`
- `fieldPath`
- `activationIntent`
- `projectedCell`
- `commitValue`
- `draftValue`

Avoid:

- `isPointerActive`
- `shouldAutoFocus`
- `isActivityLocked`
- `focusedField` when it only means "editing field"
- `showInput` when it means "editing"
- `forceEditMode`

If a boolean survives, it should name a real user-visible state, not a
coordination mechanism.

## Performance Strategy

Simplify first, then optimize.

Expected fast path:

- inactive cells render inert display DOM only
- only the edited cell mounts editor logic
- hover only updates visual/source mapping
- virtualization limits visible rows
- memoization becomes easier because cells have fewer local states

Profile interaction budgets instead of only render counts:

- hover over 100 cells: no editor mounts
- activate text cell: one editor mount
- type first character after click: no lost character
- click text middle: caret lands where clicked
- checkbox first click: one document update
- select first click: menu opens
- draft typing: sibling rows do not rerender
- blur: one commit

Performance should be measured after the architecture is simplified. The current
complexity makes profiles misleading because hover behavior, activation behavior,
and editor mounting are entangled.

## Migration Plan

1. Define the core domain types:
   - `CellId`
   - `ProjectedCell`
   - `ActivationIntent`
   - `EditSession`

2. Freeze behavior tests around desired interactions:
   - first click text typing
   - first click checkbox toggle
   - first click select open
   - click in the middle of text places caret correctly
   - fast click-then-type does not lose the first character
   - blur commits once
   - Escape behavior is explicit

3. Introduce table-level `editSession`.

4. Make `EditableJsonTableCell` render display/editor from `editSession`.

5. Move activation behavior into editors through `ActivationIntent`.

6. Remove table-level kind special cases.

7. Completed: `DataCell` auto mode is deleted and JSON table uses explicit
   display/control primitives.

8. Delete obsolete local state:
   - pointer active
   - activity lock
   - should auto focus
   - focused field state that only coordinates activation
   - select open state from the table cell wrapper

9. Profile the simplified architecture.

10. Optimize only the remaining measured hot paths.

## Success Criteria

The system is correct when:

- hover never mounts editors
- first click behaves like a native control interaction
- editor behavior is owned by editors, not the table shell
- inactive cells are cheap and inert
- edit-session state has one owner
- the code path for editing one cell is easy to trace
- `DataCell` has no hidden auto-edit lifecycle in the JSON table path
- state names describe domain concepts instead of event-order workarounds

The table should answer one question:

> Which cell is being edited?

The editor should answer one question:

> What does this user intent mean for this control?

Right now too many layers answer both questions. The pure architecture separates
them.
