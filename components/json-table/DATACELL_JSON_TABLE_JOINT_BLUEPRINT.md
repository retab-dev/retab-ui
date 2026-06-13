# DataCell and JSON Table Joint Blueprint

## Premise

`DataCell` and JSON table cannot be perfected independently.

JSON table needs cells that are fast, inert, editable, accessible, and
schema-aware. `DataCell` provides the visual and native-control vocabulary for
those cells. If `DataCell` owns too much lifecycle, JSON table becomes bloated.
If JSON table reimplements too much cell behavior, `DataCell` becomes decorative
instead of foundational.

The joint ideal is:

> JSON table owns grid semantics. DataCell owns cell primitives. Editors compose
> those primitives into field-specific interactions.

## Current State

The current architecture has completed the hard cutover:

- JSON table owns one `editSession`.
- Hover no longer mounts editors.
- Editors consume activation intent.
- `DataCell` has no `auto` mode.
- JSON table editors receive direct `cell`, `editSession`, draft, overlay,
  close, and commit props.
- `JsonTableScalarCell` is deleted.
- Picker overlay state can be controlled by the table edit session.
- DataCell public types and pure value formatting/parsing live outside the
  React component file.

The remaining impurity is not legacy compatibility. It is module granularity.
`DataCell` is still a broad rendering component with several responsibilities:

- display shell rendering
- edit shell rendering
- native input rendering
- checkbox rendering
- picker rendering
- popup positioning

The next idealization pass should split those control renderers only if the
split makes ownership clearer without creating ornamental barrels.

## Joint One-Sentence Model

```txt
JSON table projects schema-backed values into grid cells.
DataCell renders display and control primitives for those cells.
Editors translate edit-session intent into native control behavior.
The commit pipeline normalizes values back into document data.
```

Anything outside that flow is suspect.

## Ownership Rules

### JSON Table Owns Grid Semantics

JSON table owns:

- row and column projection
- virtualization
- selected cell identity
- one edit session
- activation intent
- document patch dispatch
- schema-derived field metadata

JSON table does not own:

- how a text input positions a caret
- how a checkbox toggles
- how a select opens
- how a date picker manages its popup
- how a primitive cell is styled internally

### DataCell Owns Cell Primitives

DataCell owns:

- display shell styling
- edit/control shell styling
- consistent density, borders, typography, truncation, and focus rings
- native control composition
- primitive formatting/parsing helpers
- primitive accessibility attributes

DataCell does not own:

- grid selection
- edit-session identity
- hover-to-edit lifecycle
- document paths
- schema traversal
- document commits

### Editors Own Field Interaction

Editors own:

- interpreting `ActivationIntent`
- mapping schema kind to the right primitive
- field-specific draft behavior
- field-specific commit semantics
- overlay lifetime for the current edit session

Editors do not own:

- virtualization
- row projection
- sibling cell rendering
- global table state

## Target Module Shape

```txt
components/ui/data-cell/
  data-cell-display.tsx
  data-cell-text-control.tsx
  data-cell-number-control.tsx
  data-cell-boolean-control.tsx
  data-cell-picker-control.tsx
  data-cell-format.ts
  data-cell-parse.ts
  data-cell-types.ts

components/json-table/
  json-table-edit-session.ts
  json-table-cell-types.ts
  editable-json-table-cell.tsx
  json-table-display-cell.tsx
  cell-editors/
    cell-editor.tsx
    text-editor.tsx
    number-editor.tsx
    boolean-editor.tsx
    enum-editor.tsx
    date-editor.tsx
    time-editor.tsx
    datetime-editor.tsx
    object-editor.tsx
    array-editor.tsx
```

The important point is not the exact filenames. The important point is that
`DataCell` exports primitives, not a second editing lifecycle.

## DataCell Primitive API

### Display Primitive

```tsx
<DataCellDisplay
  kind={kind}
  value={value}
  placeholder="—"
  formatValue={formatValue}
/>
```

Responsibilities:

- render formatted value
- render empty placeholder
- expose read-only accessibility state
- never start editing
- never own draft state
- never commit

### Text Control Primitive

```tsx
<DataCellTextControl
  value={draftValue}
  disabled={disabled}
  activationIntent={activationIntent}
  onDraftChange={setDraftValue}
  onCommit={commitValue}
  onCancel={closeSession}
/>
```

Responsibilities:

- focus from activation intent
- place caret from pointer intent
- seed first typed key from keyboard intent
- emit draft changes
- commit on blur/Enter
- cancel on Escape if that is the editor contract

### Number Control Primitive

```tsx
<DataCellNumberControl
  kind="number"
  value={draftValue}
  activationIntent={activationIntent}
  onDraftChange={setDraftValue}
  onCommit={commitParsedNumber}
/>
```

Responsibilities:

- preserve invalid raw drafts
- expose parse metadata
- commit parsed values through the editor

### Boolean Control Primitive

```tsx
<DataCellBooleanControl
  checked={checked}
  activationIntent={activationIntent}
  onToggle={commitBoolean}
/>
```

Responsibilities:

- toggle from pointer intent
- toggle from Space
- expose checkbox semantics

### Picker Control Primitive

```tsx
<DataCellPickerControl
  kind="date"
  value={draftValue}
  isOpen={isOverlayOpen}
  activationIntent={activationIntent}
  onOpenChange={setOverlayOpen}
  onDraftChange={setDraftValue}
  onCommit={commitDate}
/>
```

Responsibilities:

- open/focus from activation intent
- manage primitive picker accessibility
- emit raw draft values and selected values

## JSON Table Editor API

The ideal editor props should collapse to:

```ts
type JsonTableCellEditorProps = {
  cell: ProjectedCell
  fieldMetadata: FieldMetadata
  session: JsonTableEditSession
  commit: (value: unknown) => void
  updateDraft: (value: unknown) => void
  setOverlayOpen: (open: boolean) => void
  close: () => void
}
```

The editor then composes DataCell primitives:

```tsx
function TextJsonTableEditor(props: JsonTableCellEditorProps) {
  return (
    <DataCellTextControl
      value={String(props.session.draftValue ?? "")}
      activationIntent={props.session.intent}
      onDraftChange={props.updateDraft}
      onCommit={props.commit}
      onCancel={props.close}
    />
  )
}
```

No `focus` group. No `overlays` group. No `textDraft` group. Those are
coordination artifacts from the old architecture.

## Interaction Contract

### Hover

Hover may:

- highlight a cell
- show source mapping
- update hover metadata

Hover must not:

- mount an editor
- focus a control
- open a popup
- create draft state

### Pointer Activation

Pointer activation creates one edit session:

```ts
startEditSession(projectedCell, {
  type: "pointer",
  clientX,
  clientY,
  detail,
})
```

The editor decides what this means.

### Keyboard Activation

Keyboard activation creates one edit session:

```ts
startEditSession(projectedCell, {
  type: "keyboard",
  key,
})
```

The editor decides what this means.

### Commit

Primitive controls emit raw or primitive values.

Editors apply field-specific semantics.

JSON table applies schema/document normalization.

The commit path is:

```txt
DataCell primitive
  -> JSON table field editor
  -> formatValueForCommit
  -> useCellController
  -> onDocumentDataChange
```

## Modularity Tests

The architecture is pure only if these tests are true:

- `DataCellDisplay` can render outside JSON table without importing JSON table.
- JSON table can render inactive cells without importing control primitives.
- A text editor can change caret behavior without touching table virtualization.
- A boolean editor can change toggle semantics without touching
  `EditableJsonTableCell`.
- Date parsing can change without touching display shell styling.
- Row virtualization can change without touching primitive controls.
- `DataCell` tests never need document paths.
- JSON table tests never need `DataCell` internal implementation details.

## Anti-Patterns

Forbidden in the final architecture:

- `DataCell` owning hover-to-edit behavior in the JSON table path.
- JSON table branching on field kind to perform native control behavior.
- Per-cell local edit lifecycle state.
- Focus state whose only purpose is to keep a cell mounted.
- Overlay state outside the edit session unless it is cross-cell product state.
- Editor props named after implementation mechanics rather than domain concepts.
- A generic `mode="auto"` path inside JSON table editing.

## Migration From Current State

1. Keep current `JsonTableEditSession`.

2. Keep `DataCellDisplay` and `DataCellControl` as the public composition
   points.

3. Extract control primitives from the current `DataCellControl` branches only
   when the split reduces real complexity:
   - text
   - number/integer
   - boolean
   - date/time/date-time

4. Keep `JsonTableScalarCell` deleted.

5. Keep editor props collapsed:
   - `cell`
   - `editSession`
   - `draftValue`
   - `setDraftValue`
   - `setOverlayOpen`
   - `closeEditSession`
   - `commitValue`

6. Keep `DataCell` as a convenience composition only if needed for demos or
   external consumers. It must become a wrapper around the primitives, not the
   owner of the primitive lifecycle.

7. Keep `mode="auto"` deleted permanently.

8. Reprofile:
   - hover sweep
   - first click text
   - first click checkbox
   - first click select
   - typing latency
   - blur commit
   - scroll while not editing
   - scroll while one overlay is open

## Success Criteria

The joint system reaches its ideal when:

- JSON table has one edit-session owner.
- `DataCell` exports primitive display/control building blocks.
- No JSON table code depends on `DataCell` auto activation.
- No `DataCell` code depends on JSON table paths, schema, or documents.
- Editors are the only layer that interprets activation intent.
- Primitive controls are the only layer that owns native control mechanics.
- Commit normalization has one path.
- Every prop name maps to a domain concept.

At that point the modularity is real: JSON table and `DataCell` are co-designed,
but neither is bloated by owning the other's responsibility.
