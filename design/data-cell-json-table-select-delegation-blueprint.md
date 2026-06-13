# DataCell and JSON Table Select Delegation Blueprint

## Purpose

This blueprint resolves the enum/select failure as an architecture problem, not
as a local dropdown timing bug.

The target is the smallest possible primitive editing contract:

```txt
json-table renders primitive DataCell
  -> user gesture reaches DataCell
  -> DataCell owns the primitive interaction
  -> DataCell emits one committed primitive value
  -> json-table writes JSON
```

Enum select should not be a special interaction path in `json-table`. It should
be just another primitive `DataCell` control.

## Bare-Bones Mandate

The implementation must be deletion-first.

Before adding code, remove coordination that only exists because the table and
`DataCell` both think they own primitive activation. The correct implementation
should feel smaller after the fix, not larger.

Allowed implementation moves:

- pass schema-derived primitive facts into `DataCell`
- pass one commit callback out of `DataCell`
- keep one active primitive identity in `json-table`
- keep one shell fallback for events that miss `DataCell`
- keep one cross-cell finish/cancel handle

Forbidden implementation moves:

- add an enum editor in `json-table`
- add a select-specific table path
- add table-owned select open state
- add table-owned select close timers
- add Radix select imports to `json-table`
- add activation retries
- add delayed reopen logic
- add compatibility branches for the old enum path
- add wrapper components whose only job is to repair event ordering
- add feature flags for old and new primitive activation

The desired diff should mostly delete ambiguity:

```txt
less table activation code
less enum-specific table code
less timing repair code
same JSON value adaptation
same structured object/array path
stronger interaction tests
```

If the implementation needs more state to make enum select work, it is probably
moving in the wrong direction.

## Diagnosis

The current failure shape is an architecture smell because enum opening depends
on two owners coordinating during one browser gesture:

```txt
td shell pointer/click
  -> json-table decides whether to activate the cell
  -> React mounts active DataCell
  -> DataCellSelectControl decides whether to open
  -> Radix/select focus and pointer tails run
  -> close guards decide whether the menu survives
```

That chain is too long for a primitive control. The same click is partly owned
by the table shell and partly owned by the select. Once timing guards appear,
the system has already admitted that ownership is unclear.

The local symptom can look like:

- enum cell is still read-only because JSON edit mode did not actually switch
- enum cell activates but the select never opens
- select opens and immediately closes from the activation click tail
- option click is consumed by the shell or a stale active-cell transition

Those are different bugs, but they share one root cause: primitive activation is
not fully delegated to the primitive control.

## First Principle

`DataCell` is the trompe-l'oeil.

That means `DataCell` owns both illusions:

- the inert display surface that looks like table text
- the real primitive control that appears when the user acts

`json-table` should not be another trompe-l'oeil around `DataCell`. It should
only provide table frame, value adaptation, active identity, and commit routing.

## Desired Ownership

### `json-table` Owns

- document/schema projection
- row and column virtualization
- cell identity
- whether a primitive cell is editable
- whether a primitive cell is active
- JSON-to-primitive value adaptation
- primitive-to-JSON commit adaptation
- structured object/array editing
- focus return to table chrome after primitive editing ends

### `json-table` Does Not Own

- select open state
- select close timing
- primitive overlay lifecycle
- primitive draft state
- text caret placement
- checkbox semantics
- date picker opening
- pointer-coordinate interpretation for primitive controls
- control-specific first-click behavior

### `DataCell` Owns

- primitive display
- primitive activation from direct pointer/click/key events
- text draft and selection
- number draft
- checkbox toggle semantics
- select open/close and option commit
- date/time picker open/close and commit
- blur, Enter, Escape behavior for primitive drafts
- editor handle used by the table only for cross-cell finish/cancel

## Pure Select Flow

The ideal enum interaction is:

```txt
user clicks enum DataCell
  -> DataCell receives the original pointer/click
  -> DataCell enters edit mode
  -> DataCellSelectControl opens the select
  -> user clicks option
  -> DataCellSelectControl commits selected primitive value
  -> JsonTableDataCell adapts primitive value to JSON enum identity
  -> useCellController writes the field
  -> DataCell closes
  -> json-table clears active primitive identity
```

No table code should decide how the select opens. No table code should delay
select close. No table code should know Radix select event ordering.

## Table Shell Escape Hatch

The table shell still needs one narrow escape hatch:

```txt
user clicks td chrome outside DataCell
  -> json-table may mark the primitive cell active
  -> DataCell may autofocus a default control state
```

This exists for empty padding, keyboard grid navigation, and accessibility. It
must not become the normal path for direct clicks on `DataCell`.

Rules:

- If the event target is inside `DataCell`, `json-table` must not synthesize a
  primitive activation intent.
- If the event target is outside `DataCell` but inside the `td`, `json-table`
  may request generic activation only.
- Generic activation never carries text coordinates or select-specific open
  semantics.
- Direct `DataCell` events always win over shell events.

## Module Shape

```txt
components/json-table/
  editable-json-table-cell.tsx
    table cell router and shell attributes only

  use-json-table-editable-cell-model.ts
    active identity, shell focus, structured routing, commit wiring

  json-table-data-cell.tsx
    FieldMetadata/value adapter into DataCell

  json-table-primitive-cell.tsx
    active/inactive primitive wrapper around JsonTableDataCell

  json-table-primitive-activation.ts
    shell-only fallback activation, never direct DataCell activation

  json-table-primitive-command.ts
    only command primitives that intentionally bypass editors

  json-table-primitive-handoff.ts
    cross-cell finish/cancel ordering

registry/new-york-v4/ui/
  data-cell.tsx
    primitive router

  data-cell-select-control.tsx
    complete select lifecycle owner
```

The important boundary is not file count. The important boundary is that only
`DataCellSelectControl` understands select lifecycle.

## Minimal Runtime API

The primitive table-to-DataCell API should be this small:

```ts
type JsonTablePrimitiveDataCellProps = {
  kind: DataCellKind
  value: DataCellValue
  mode: "readOnly" | "editable"
  isActive: boolean
  options?: DataCellSelectOption[]
  onActiveChange: (isActive: boolean) => void
  onCommit: (value: DataCellValue) => void
  onEditingEnd: () => void
}
```

Anything beyond this must justify itself against the ownership map.

Specifically, enum does not get extra lifecycle props. It only uses:

- `kind: "select"`
- `value`
- `options`
- `onCommit`

There should be no prop equivalent to:

- `open`
- `defaultOpen`
- `closeDelay`
- `activationPoint`
- `selectIntent`
- `shouldSkipFirstClose`
- `onSelectOpenChange`

Those are `DataCell` concerns.

## Enum Value Contract

Enums have JSON-specific value identity, but not JSON-specific interaction.

`json-table` may adapt:

```txt
JSON enum value/null
  -> DataCell select primitive value
```

and:

```txt
DataCell selected primitive value
  -> JSON enum value/null
```

`json-table` may not own:

- opening the select
- focusing the trigger
- keeping the menu open
- interpreting option pointer events
- delaying close after activation

This distinction is the key. Value identity belongs to `json-table`; interaction
identity belongs to `DataCell`.

## Interaction Checklist

Enum/select must satisfy:

- clicking an editable enum cell opens the select on the first click
- clicking a readonly enum cell does nothing and exposes readonly semantics
- clicking an enum cell while another primitive is active first finishes the
  previous primitive, then opens the enum select
- clicking an option commits exactly once
- clicking outside closes without changing the value
- Escape closes without changing the value
- keyboard activation opens the select from the active table cell
- Arrow keys move through options when the select is open
- Enter commits the highlighted option when the select is open
- Tab commits or closes according to `DataCell`'s primitive lifecycle contract
- null enum values round-trip through the nullable sentinel without leaking the
  sentinel into document data
- enum display formatting and selected option text are consistent
- virtualization row elevation keeps the select overlay usable while open

## Architecture Tests

The tests should protect ownership, not just behavior.

Required guards:

- `json-table` has no enum editor component outside `DataCell`
- `json-table` has no select open state
- `json-table` has no select close delay
- `json-table` has no Radix select imports
- enum field metadata flows only through the value adapter
- direct `DataCell` event targets bypass shell activation
- shell activation code cannot construct select-specific intents
- `DataCellSelectControl` is the only owner of select open/close lifecycle
- there is one JSON enum value adapter and no enum interaction adapter
- table primitive activation code contains no `enum`, `select`, `option`, or
  Radix vocabulary

## Deletion Targets

During implementation, inspect and delete any code that exists only to bridge
table-owned activation into select-owned lifecycle:

- enum-specific active-cell branching
- select-specific activation intents
- close-delay coordination between table shell and select
- pointer-tail guards owned by the table
- table tests that assert implementation details of select opening instead of
  user-visible behavior

Keep code that has real table responsibility:

- schema enum option extraction
- nullable enum sentinel mapping
- JSON identity preservation
- document commit normalization
- row elevation while an active overlay exists

The distinction is strict: JSON meaning stays in `json-table`; primitive
interaction moves to `DataCell`.

## Implementation Order

1. Prove the bug on a healthy dev server or browser test fixture.
2. Add the browser regression for first-click enum opening.
3. Delete table-owned select interaction code.
4. Keep enum value mapping in the `JsonTableDataCell` adapter.
5. Let direct `DataCell` events activate and open the select themselves.
6. Preserve only shell fallback activation for non-DataCell targets.
7. Run architecture tests that forbid select lifecycle from returning to
   `json-table`.
8. Run browser tests for text, boolean, enum, date, and cross-cell handoff.

This order prevents a false fix where more coordination hides the bug.

## No-Cheating Rubric

A fix is rejected even if the dropdown works when it does any of these:

- opens select from a table-owned enum branch
- keeps select alive with a table-owned timeout
- stores select open state outside `DataCellSelectControl`
- adds a second enum value path to avoid touching the existing adapter
- forwards original pointer events through table code to imitate native control
  behavior
- adds a wrapper whose only purpose is to absorb Radix focus or pointer tails
- makes enum work by weakening text, boolean, date, or keyboard behavior
- keeps a dead legacy path "just in case"

A fix is accepted only when the working interaction is a consequence of the
simple boundary:

```txt
DataCell direct event -> DataCell primitive control -> primitive commit
```

and the table is only doing:

```txt
schema/value adaptation -> active identity -> JSON commit
```

## Minimal State Model

The target state graph has three table states:

```txt
inactive
primitive active: { docId, fieldPath }
structured active: { docId, fieldPath, sessionId }
```

There is no table state for:

- selected enum option
- open enum menu
- pending enum activation
- delayed enum close
- select trigger focus
- select option hover

Inside `DataCell`, select state may exist because it is local primitive
interaction state:

```txt
closed
open
committing
```

The table observes only the final commit and editing end.

## Naming Rules

Use the same concepts everywhere:

- `primitive` means text, number, boolean, enum/select, date, time, or date-time.
- `structured` means object or array.
- `active` means the table identity currently delegated to a cell.
- `open` means a local primitive overlay or menu is visible.
- `commit` means a final primitive value is ready to write into JSON.
- `adapt` means converting between JSON shape and `DataCell` shape.

Do not use `session`, `editor`, `overlay`, or `picker` to describe enum table
state. Enum does not get table state.

## Completion Checklist

Implementation is complete only when all of these are true:

- the first click on an editable enum cell opens the select in a real browser
- clicking an option writes the document value exactly once
- readonly enum cells do not open
- nullable enum values preserve `null` identity
- switching from active text to enum finishes text and opens enum on the same
  user action
- switching from active date/time to enum does not leave a stale overlay
- keyboard activation opens the enum select without adding enum-specific table
  code
- `json-table` contains no select lifecycle state
- `json-table` contains no select lifecycle timing constants
- `json-table` contains no Radix select imports
- table primitive activation contains no enum/select vocabulary
- architecture tests enforce the negative ownership rules
- browser tests enforce first-click enum open and option commit
- the implementation deletes more interaction coordination than it adds

## Browser Tests

The browser regression must test the real event chain:

```txt
editable JSON table
  -> click enum cell
  -> assert listbox/menu visible after the same click
  -> click option
  -> assert cell display changed
  -> assert document JSON changed
```

Also test:

- enum after active text cell
- enum after active date picker
- enum in virtualized row
- nullable enum null -> concrete value
- concrete value -> null
- rapid click from one enum cell to another

These tests are more important than jsdom-only tests because the failure is
about browser pointer, focus, and overlay ordering.

## Success Criteria

The architecture is acceptable when this statement is true:

> `json-table` can delete every enum/select-specific interaction rule and enum
> selection still works because `DataCell` owns the primitive select.

The architecture is not pure while this statement is false:

> enum select only works because the table shell and `DataCellSelectControl`
> coordinate activation timing.

## Final Shape

The final system should read like this:

```txt
json-table:
  "This field is an enum. Here are the options. Here is how to commit JSON."

DataCell:
  "I am a select. I know how to open, close, navigate, and commit."
```

That is the pure boundary. Everything else is bloat.
