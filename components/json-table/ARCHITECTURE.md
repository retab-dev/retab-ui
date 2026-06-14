# JSON Table and DataCell Architecture

## Essence

JSON table owns document structure, schema interpretation, virtualization, and
the identity of the active cell. DataCell owns primitive display and primitive
controls. JSON table has only two editing paths: DataCell-backed primitive
cells and structured object/array cells.

```txt
document + schema
  -> projection
  -> visible rows and columns
  -> display cells
  -> one active primitive identity or one structured session
  -> one primitive control
  -> one commit path
```

Anything outside that line must justify itself.

## Ownership

### JSON Table

JSON table owns:

- projected rows, visible columns, and field paths
- schema metadata and active-cell selection
- `JsonTablePrimitiveActiveCell` identity for DataCell-backed cells
- `JsonTableStructuredEditSession` state for object/array popovers
- document mutation through the table commit boundary
- shell activation from table chrome and keyboard focus

JSON table does not own:

- primitive input rendering
- checkbox semantics
- date/time popup geometry
- primitive draft state
- primitive picker-open state
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

- table active-cell identity
- document mutation
- schema traversal
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

## Active State Contract

Primitive cells receive only active identity. The table does not store their
draft values or overlay state.

```ts
type JsonTablePrimitiveActiveCell = {
  cellId: JsonTableCellId
  docId: string
  fieldPath: string
}
```

Structured object/array editors keep a table-owned session because their
popover lifecycle is table-specific.

```ts
type JsonTableStructuredEditSession = {
  id: number
  cellId: JsonTableCellId
  docId: string
  fieldPath: string
  intent: JsonTableActivationIntent
  isOverlayOpen: boolean
}
```

There are no compatibility aliases. Primitive identity, primitive draft,
overlay state, and structured popover state are separate concepts.

## Interaction Contract

- Hover never mounts an active control.
- Pointer activation mounts the active control for the clicked cell only.
- Text cells focus and accept typing on the first click.
- Typeable keys start text editing.
- Boolean cells toggle on the first click and close the edit session.
- Enum cells open on the first click.
- Date cells open the picker on the first click.
- Text blur commits once and closes the primitive active cell.
- Escape cancels scalar drafts and closes the primitive active cell.
- Only one primitive active cell or structured session exists at a time.
- Only DataCell receives primitive draft updates.
- Switching cells synchronously finishes the previous primitive DataCell before
  the next cell action runs.

## Commit Path

```txt
primitive control
  -> active control commitValue
  -> EditableJsonTableCell formatValueForCommit
  -> useJsonTablePrimitiveCellController
  -> JsonTablePrimitiveEditStore
  -> JsonTableCellCommit(visibility: "primitivePendingValue")
  -> useSingleFileTableDocumentModel
  -> onUpdateDocument
```

Structured object and array editors use their own document-data controller:

```txt
structured editor
  -> formatValueForCommit
  -> useJsonTableStructuredCellController
  -> JsonTableCellCommit(visibility: "projectedDocumentValue")
  -> useSingleFileTableDocumentModel
  -> onUpdateDocument
```

No active control writes to the document directly, and structured commits do not
enter primitive pending/confirmed/stale lifecycle.

## Document Lifecycle

`SingleFileTableView` is only the public adapter. `useSingleFileTableDocumentModel`
owns the document state machine:

- `sourceDocument` is the latest parent prop.
- `projectionDocument` is the document used to project rows.
- `confirmedDocumentDataRef` is the latest data used to build outgoing patches.
- `JsonTablePrimitiveEditStore` owns primitive `pending`, `confirmed`, and
  `stale` cell snapshots.

The rules are exact:

- A new document id resets the primitive edit store and immediately projects the
  new source document.
- A same-id parent echo confirms primitive edit-store state and does not replace
  the projection document.
- A same-id external parent change replaces the projection document.
- Every cell commit crosses the same `JsonTableCellCommit` boundary. Primitive
  cells mark `visibility: "primitivePendingValue"`; structured cells mark
  `visibility: "projectedDocumentValue"`.

Visible values resolve in one priority order:

| Priority | Source | Owner | Meaning |
| --- | --- | --- | --- |
| 1 | Primitive pending value | `JsonTablePrimitiveEditStore` | Scalar edit committed locally before the parent echo confirms it. |
| 2 | Structured local value | `useJsonTableStructuredCellController` | Object/array editor commit shown locally until the projected document catches up. |
| 3 | Projected document value | `useSingleFileTableDocumentModel` | Last document identity chosen for row projection. |
| 4 | Source document value | parent props | Authoritative input before any local projection state exists. |

## Performance Contract

Inactive cells are cheap because they render inert display only. Hover is cheap
because it does not mount inputs, selects, calendars, popovers, or local draft
state. Editing is localized because the table has exactly one primitive active
identity or one structured session at a time.

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
