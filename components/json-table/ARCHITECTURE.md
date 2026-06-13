# JSON Table and DataCell Architecture

## Essence

JSON table owns document structure, schema interpretation, virtualization, and
the single active edit session. DataCell owns primitive display and primitive
controls. JSON table has only three active control families: DataCell-backed
primitive cells, enum cells, and structured cells.

```txt
document + schema
  -> projection
  -> visible rows and columns
  -> display cells
  -> one edit session
  -> one active cell control
  -> one primitive control
  -> one commit path
```

Anything outside that line must justify itself.

## Ownership

### JSON Table

JSON table owns:

- projected rows, visible columns, and field paths
- schema metadata and active-control selection
- one `JsonTableEditSession`
- draft value and overlay-open state for the active control
- document mutation through the table commit boundary
- cell activation from pointer and keyboard intent

JSON table does not own:

- primitive input rendering
- checkbox semantics
- date/time popup geometry
- primitive value formatting/parsing

### DataCell

DataCell owns:

- inert display rendering
- text input focus, caret placement, draft, and blur commit
- number/integer input attributes and numeric parse metadata
- boolean checkbox semantics
- date/time/date-time trigger, popup, and picker commit
- primitive formatting/parsing helpers

DataCell does not own:

- table edit sessions
- document mutation
- schema traversal
- enum select semantics
- structured object/array popovers
- hover-to-edit behavior

## Runtime Files

```txt
registry/new-york-v4/ui/data-cell.tsx
registry/new-york-v4/ui/data-cell-types.ts
registry/new-york-v4/ui/data-cell-format.ts
registry/new-york-v4/ui/data-cell-classes.ts
registry/new-york-v4/ui/data-cell-display.tsx
registry/new-york-v4/ui/data-cell-text-control.tsx
registry/new-york-v4/ui/data-cell-number-control.tsx
registry/new-york-v4/ui/data-cell-boolean-control.tsx
registry/new-york-v4/ui/data-cell-picker-control.tsx
registry/new-york-v4/ui/data-cell-picker-position.ts
```

`data-cell.tsx` is only the public router and barrel. It contains no rendering
mechanics. The focused files each have one reason to change.

## Active Control Contract

The active cell receives the smallest possible control-specific contract.
Scalar, date, boolean, and enum controls use `JsonTableDataCell`. Objects and
arrays use `JsonTableStructuredCell`.

```ts
type JsonTableActiveControlProps = {
  fieldPath: string
  fieldMetadata: FieldMetadata
  effectiveValue: unknown
  editSession: JsonTableEditSession
  setOverlayOpen: (isOverlayOpen: boolean) => void
  closeEditSession: () => void
  commitValue: (value: unknown) => void
}
```

There are no compatibility aliases. The old grouped concepts are gone:
identity, field state, text draft, focus state, overlay maps, commit handlers,
and auto mode.

## Interaction Contract

- Hover never mounts an active control.
- Pointer activation mounts the active control for the clicked cell only.
- Text cells focus and accept typing on the first click.
- Typeable keys start text editing.
- Boolean cells toggle on the first click and close the edit session.
- Enum cells open on the first click.
- Date cells open the picker on the first click.
- Text blur commits once and closes the edit session.
- Only one edit session exists at a time.
- Only the active control receives draft updates.

## Commit Path

```txt
primitive control
  -> active control commitValue
  -> EditableJsonTableCell formatValueForCommit
  -> useCellController
  -> onDocumentDataChange
```

No active control writes to the document directly.

## Performance Contract

Inactive cells are cheap because they render inert display only. Hover is cheap
because it does not mount inputs, selects, calendars, popovers, or local draft
state. Editing is localized because the table has exactly one edit session and
only one active control at a time.

The protected measurements are:

- hover sweep active-control mounts
- click-to-input focus latency
- first keypress latency
- checkbox toggle latency
- enum open latency
- date picker open latency
- scroll with no active control
- scroll with one active overlay

## Regression Guards

`tests/json-table-row-render.test.tsx` protects the user-facing interaction
contract. `tests/json-table-architecture.test.ts` protects the hard-cutover
architecture by rejecting legacy names and deleted compatibility files.
