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

## State Glossary

- `sourceDocument` is the latest document received from parent props.
- `projectionDocument` is the document identity used to project visible rows.
- `confirmedDocumentData` is the authoritative data base used for outgoing
  document patches.
- A parent echo is a same-document-id source update caused by a table commit.
- A primitive pending value is a scalar value owned by
  `JsonTablePrimitiveEditStore` until the parent echo confirms it.
- A structured pending value is an object or array value owned by
  `useJsonTableStructuredCellController` until projection catches up.
- `JsonTableCellCommit.visibleThrough` names which local owner keeps a committed
  value visible before the parent echo is reconciled.

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

`visibleThrough` is the final commit-lifecycle field name. It names which local
owner keeps a committed value visible until the parent echo is reconciled.

```txt
primitive control
  -> active control commitValue
  -> EditableJsonTableCell formatValueForCommit
  -> useJsonTablePrimitiveCellController
  -> JsonTablePrimitiveEditStore
  -> JsonTableCellCommit(visibleThrough: "primitivePendingValue")
  -> useSingleFileTableDocumentModel
  -> onUpdateDocument
```

Structured object and array editors use their own document-data controller:

```txt
structured editor
  -> formatValueForCommit
  -> useJsonTableStructuredCellController
  -> JsonTableCellCommit(visibleThrough: "projectedDocumentValue")
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
- `confirmedDocumentData` is the latest data used to build outgoing patches.
- `JsonTablePrimitiveEditStore` owns primitive `pending`, `confirmed`, and
  `stale` cell snapshots.

The rules are exact:

- A new document id resets the primitive edit store and immediately projects the
  new source document.
- A same-id parent echo confirms primitive edit-store state and does not replace
  the projection document.
- A same-id external parent change replaces the projection document.
- Every cell commit crosses the same `JsonTableCellCommit` boundary. Primitive
  cells mark `visibleThrough: "primitivePendingValue"`; structured cells mark
  `visibleThrough: "projectedDocumentValue"`.

The document model is the only place where these concerns are allowed to meet:

- source-document identity and parent echoes
- `projectionDocument` selection for row projection
- `confirmedDocumentData` for outgoing patches
- primitive echo recording and reconciliation
- `onUpdateDocument` patch emission

Every other JSON-table module receives the result of that state machine. The
runtime, virtualized table, rows, cells, and primitive/structured controllers may
carry `onCellCommit`, but they do not patch document data, reconcile source
documents, or record primitive echoes.

Visible values resolve in one priority order:

| Priority | Source                   | Owner                                  | Meaning                                                                           |
| -------- | ------------------------ | -------------------------------------- | --------------------------------------------------------------------------------- |
| 1        | Primitive pending value  | `JsonTablePrimitiveEditStore`          | Scalar edit committed locally before the parent echo confirms it.                 |
| 2        | Structured pending value | `useJsonTableStructuredCellController` | Object/array editor commit shown locally until the projected document catches up. |
| 3        | Projected document value | `useSingleFileTableDocumentModel`      | Last document identity chosen for row projection.                                 |
| 4        | Source document value    | parent props                           | Authoritative input before any local projection state exists.                     |

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

The refreshed profile shows that large-table select and picker opens are no
longer dominated by React rendering. They render the active editable cell only,
but browser style recalculation still scales with the large virtualized table
surface. The budget records that cost honestly: it protects against structural
regressions such as sibling-cell rerenders, extra document patches, unbounded
rect reads, or unexpected overlay mounts, while keeping the remaining style
duration visible for future CSS/DOM invalidation work.

## Regression Guards

`tests/json-table-row-render.test.tsx` protects the user-facing interaction
contract. `tests/json-table-architecture.test.ts` protects the hard-cutover
architecture by rejecting legacy names and deleted compatibility files.

## Verification Contract

Architecture-only changes should at minimum run:

```sh
pnpm test tests/json-table-architecture.test.ts
```

Before declaring the JSON table runtime complete, run the focused ownership
tests, the broad JSON-table interaction suite, and the performance verifiers:

```sh
pnpm test tests/json-table-architecture.test.ts tests/json-table-controller.test.tsx tests/json-table-primitive-edit-store.test.ts tests/json-table-row-render.test.tsx
pnpm test:json-table
pnpm verify:json-table-performance
pnpm verify:json-table-performance:fresh
pnpm typecheck
```

The saved performance verifier reads the checked-in profile fixture and guards
React work, DOM reads, document patches, and measured interaction budgets. It
accepts flat scenario budgets and explicit `hard`, `latency`, and `diagnostic`
budget sections so structural invariants can stay separate from style/layout
diagnostics. It is not a universal latency guarantee. The fresh verifier writes
`tmp/json-table-primitive-interactions-profile.fresh.json` by default, verifies
that fresh artifact against the same budgets, and must fail with setup
instructions that make a missing local server/page explicit.

For style-invalidation work, run the profiler with
`JSON_TABLE_STYLE_EXPERIMENTS=1` or `--style-experiments`. This adds large-table
row-count, extra-column-count, and overscan variants and prints a compact
`open-enum`, `open-date`, and `switch-dirty-cell` style-cost table. Those
experiment profiles are diagnostic; the normal verifier still gates the stable
`default` and `large` profiles.

Editable tables default to zero row overscan because profiling showed mounted
row surface contributes directly to select/picker style recalculation. Read-only
tables keep a larger default overscan because they use row patching for scroll
continuity and do not mount primitive editors.
