# DataCell JSON Table Current Platonic Gap Ledger

## Status

Completed for its original scope.

This document is no longer the active gap list. It records the implementation
that moved JSON table from a dense, table-centered runtime toward the current
modular architecture. The active literal-perfection plan is:

`design/data-cell-json-table-literal-platonic-gap-blueprint.md`

## Completed Scope

The completed scope was:

- split row update policy out of `SingleFileVirtualizedTable`
- split viewport and rendered-column-window composition out of
  `SingleFileVirtualizedTable`
- isolate read-only row patching behind a row policy hook
- add row patch diagnostics to saved and fresh performance reports
- add inert popup and style-class experiment profiler scenarios
- keep activation policy centralized and timer-free
- document the document-model transition table
- replace line-count architecture pressure with responsibility contracts

## Completed Runtime Shape

```txt
sourceDocument
  -> useSingleFileTableDocumentModel
  -> projectionDocument
  -> SingleFileTableRuntime
  -> useSingleFileTableProjectionModel
  -> SingleFileVirtualizedTable
  -> useJsonTableRowPolicy
  -> useJsonTableViewportModel
  -> SingleFileFormRow
  -> EditableJsonTableCell / ReadOnlyJsonTableCell
  -> DataCell primitive control or structured editor
  -> JsonTableCellCommit
  -> useSingleFileTableDocumentModel
  -> onUpdateDocument({ data })
  -> parent sourceDocument echo
```

## Completed Ownership Cuts

- `useSingleFileTableDocumentModel` owns document lifecycle, projection
  identity, confirmed data, primitive echo recording, and patch emission.
- `useJsonTableEditSessionCoordinator` owns primitive active identity and
  structured edit-session lifecycle.
- `useJsonTableRowPolicy` owns the editable/read-only row update strategy.
- `useJsonTableViewportModel` owns fixed-grid virtualization and rendered column
  window composition.
- `SingleFileFormRow` renders one row and builds grouped cell props.
- `EditableJsonTableCell` routes a cell model to primitive, structured, or
  display rendering.
- `DataCell` owns primitive display and primitive controls.
- `JsonTablePrimitiveEditStore` owns primitive pending, confirmed, and stale
  local values.

## Completed Proof

The completed implementation added or preserved proof for:

- row policy behavior
- viewport model behavior
- scalar read-only row patch diagnostics
- primitive interaction render containment
- structured object/array editing
- horizontal virtualization
- keyboard and browser interaction hardening
- document echo reconciliation
- stale primitive echo handling
- saved performance budget verification
- fresh performance verification when the profile route is reachable
- fresh accessibility verification when the profile route is reachable

## Follow-Up

Literal perfection is intentionally tracked elsewhere. Do not add new active
gap sections to this ledger. Add them to:

`design/data-cell-json-table-literal-platonic-gap-blueprint.md`
