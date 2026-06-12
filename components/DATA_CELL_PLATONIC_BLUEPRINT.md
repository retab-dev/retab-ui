# Data Cell Platonic Blueprint

## Goal

`DataCell` is the canonical scalar cell for dense document data. It is the
single implementation used by JSON table, JSON form table mode, docs examples,
and future grid-like surfaces.

The ideal component is display-first, edit-on-intent, native where possible,
schema-agnostic at its core, and adapter-friendly at its edges.

## Non-Negotiables

- Display cells must be cheap: no mounted text, number, date, time, or checkbox
  input unless the user is interacting with an editable cell.
- Editing must use native controls for scalar browser semantics:
  `type="number"`, `type="date"`, `type="time"`, `type="datetime-local"`,
  `type="text"`, and `type="checkbox"`.
- Generic `DataCell` must not know JSON Schema, document paths, table rows,
  source linking, virtualization, or form libraries.
- Schema-aware normalization belongs in adapters, not inside `DataCell`.
- The public API must describe the data-cell concept, not leak one caller's
  implementation details.
- Every mode must be testable without a table.

## Final Public API

```tsx
<DataCell
  kind="number"
  value={amount}
  editable
  onValueCommit={setAmount}
/>
```

Target props:

```ts
type DataCellKind =
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "time"
  | "date-time"

type DataCellMode = "display" | "edit" | "auto"
type DataCellValue = string | number | boolean | null | undefined
type DataCellCommitValue = string | number | boolean | null
type DataCellDateTimeZone = "local" | "preserve" | "utc"
type DataCellValueMeta = {
  kind: DataCellKind
  rawValue: string
  isEmpty: boolean
  isValid: boolean
}

interface DataCellProps {
  kind: DataCellKind
  value?: DataCellValue
  mode?: DataCellMode
  editable?: boolean
  disabled?: boolean
  name?: string
  placeholder?: string
  dateTimeZone?: DataCellDateTimeZone
  formatValue?: (
    value: DataCellValue,
    meta: { kind: DataCellKind }
  ) => React.ReactNode
  draftValue?: string
  autoFocus?: boolean
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onValueCommit?: (value: DataCellCommitValue, meta: DataCellValueMeta) => void
}
```

Rules:

- `mode` defaults to `"auto"` when `editable` is true.
- `mode` defaults to `"display"` otherwise.
- `mode="display"` never mounts an input.
- `mode="edit"` mounts the native input immediately.
- `mode="auto"` mounts the input only while hovered, focused, or activated.
- `value` is the committed scalar.
- `draftValue` is the controlled edit draft.
- `formatValue` is a semantic display formatter, not an alternate render path.
- standard DOM props carry ARIA, data attributes, events, and classes.
- `className` may target `[data-mode="display"]` or `[data-mode="edit"]`.
- `dateTimeZone` makes date-time commit policy explicit.

## Internal Shape

`DataCell` should stay one public export backed by private pieces:

- `DataCell`: resolves mode and owns the public contract.
- `InteractiveDataCell`: owns display-first edit activation.
- `DataCellDisplay`: renders inert display markup.
- `DataCellEdit`: renders native input/checkbox controls.
- parsing/formatting helpers: pure functions with direct tests.

No private component should be exported unless another component has a proven
need that cannot be expressed through the public API.

## Commit Semantics

`DataCell` performs scalar input normalization only:

- text/date/time/date-time: `"" -> null`, otherwise string.
- boolean: checkbox state -> boolean.
- number/integer: parse native input text into number or `null`.
- number/integer drafts stay raw while editing.
- numeric commit metadata distinguishes empty, valid, and invalid input.
- integer commits require integer input.
- date-time commits can return local text, preserve the original timezone
  suffix, or append `Z`.

Adapters decide schema semantics:

- nullable field: `null` means clear to `null`.
- required non-nullable field: invalid/empty numeric commit may be ignored.
- lossy date-time projections must opt into explicit timezone preservation.
- object/array/enum semantics stay outside `DataCell`.

This keeps `DataCell` generic and keeps JSON Schema policy near JSON Schema
code.

## Required Adapters

### JSON Table

Owns:

- schema field metadata -> `DataCellKind`
- document value -> `DataCellValue`
- draft state
- schema-aware commit normalization
- row elevation
- enum/object/array custom editors

Must not own:

- scalar display/edit swapping
- scalar input type selection
- scalar draft parsing

### JSON Form Table Mode

Owns:

- JSON Schema column -> `DataCellKind`
- form value -> `DataCellValue`
- nullable/required commit policy
- lossy date-time preservation
- react-hook-form `setValue`

Must not own:

- bespoke text/date/time/number inputs
- bespoke boolean checkbox styling
- scalar display markup

## Deletion Targets

Remove or avoid reintroducing:

- scalar-specific display components that duplicate `DataCellDisplay`
- raw scalar `<input>` elements inside JSON table scalar editors
- raw scalar `<input>` elements inside JSON form table cells
- table-owned text edit activation state
- table-owned date popover state for scalar date cells
- old `commitValue`, `onDraftChange`, `displayClassName`, `inputClassName`,
  `onInputFocus`, `onInputBlur` style props

## Performance Bar

For visible table cells:

- display mode must allocate no input DOM.
- hover must mount at most the active cell's input.
- scrolling must not re-render unchanged rows.
- callbacks passed into memoized table rows must be stable.
- layout dimensions must not shift between display and edit modes.
- boolean display must not mount a real checkbox input unless editable and
  activated.

Profiling checks:

- React Profiler: hover one cell and confirm only that cell swaps.
- React Profiler: edit one cell and confirm sibling rows do not re-render.
- DOM inspection: mounted scalar inputs should be limited to active/edit cells.
- Scrollbench: table scroll FPS should not regress after adoption.

## Accessibility Bar

- Display cells that are not interactive should not be focusable.
- Editable table display wrappers may own button semantics for edit activation.
- Native inputs must keep their browser roles.
- Checkbox display state must expose `role="checkbox"` and `aria-checked`.
- Escape and Enter should end editing consistently where the adapter expects it.
- Name/label responsibility belongs to the adapter through standard DOM props.

## Test Matrix

Core `DataCell` tests:

- display renders text, number, integer, boolean, date, time, date-time.
- display mode never mounts input on hover.
- auto editable mode mounts input on hover/click.
- edit mode mounts input immediately.
- number and integer use `type="number"`.
- invalid numeric draft stays raw and commits `null` with `isValid: false`.
- boolean display is inert; boolean edit commits boolean.
- controlled draft and uncontrolled draft both work.
- standard DOM events and ARIA props are forwarded.
- date-time timezone preservation is explicit and tested.

JSON table tests:

- scalar cells display through `DataCell`.
- scalar cells mount native inputs only after activation.
- number/integer commits use schema-aware normalization.
- enum/object/array editors remain unchanged.
- read-only table cells never mount scalar inputs.

JSON form table tests:

- display cells render through `DataCell`.
- boolean cells render through `DataCell`.
- string/date/time/date-time/number/integer edit through `DataCell`.
- invalid non-nullable numeric edits preserve previous value.
- nullable numeric clears to `null`.
- unchanged date-time projections preserve original ISO string.

## Documentation Bar

Docs must show:

- display-only use
- editable auto use
- forced edit use
- all scalar kinds
- controlled draft example
- table adapter guidance: schema policy lives outside `DataCell`

Docs must not imply hover changes a display-only cell. Only editable/auto cells
should swap on interaction.

## Completion Criteria

The component reaches the target when:

- JSON table and JSON form table use `DataCell` for all scalar display/edit
  cells.
- no old scalar editor props remain in callers.
- typecheck passes.
- focused tests pass for `DataCell`, JSON table, and JSON form.
- registry build and validation pass.
- docs route renders and examples match behavior.
- a quick browser pass confirms display cells do not mutate on hover unless
  they are explicitly editable.
