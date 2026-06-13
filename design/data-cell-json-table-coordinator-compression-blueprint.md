# DataCell and JSON Table Coordinator Compression Blueprint

## Verdict

We have purified the visible component, but not the whole system.

`EditableJsonTableCell` is now the right shape: a small router. The remaining
imperfection is that `useJsonTableEditableCellModel` became the new gravity
well. It is much better than hiding the logic in the component, but at roughly
470 lines it still asks one hook to understand too much.

The next ideal is not another behavioral rewrite. It is compression:

```txt
large coordinator hook -> small composition hook + precise hooks
```

Every extracted hook should own one concept, export one narrow result, and use
the same names as the architecture everywhere else.

## One-Sentence Target

`useJsonTableEditableCellModel` should become a thin composition hook that
assembles field identity, primitive control, structured control, shell props,
focus return, profiling, and render-model selection from smaller owners.

## Current Shape

The current router is good:

```txt
EditableJsonTableCell
  -> useJsonTableEditableCellModel
  -> render disabled / primitive / structured-active / display
```

The current coordinator is too broad:

```txt
useJsonTableEditableCellModel
  derives field identity
  derives primitive/structured active state
  owns primitive activation request state
  owns useCellController commit boundary
  owns primitive active identity transitions
  owns primitive editor handle registration
  owns previous primitive handoff
  owns focus restoration
  records profiler render snapshots
  owns hover reporting
  owns pointer shell handling
  owns click shell handling
  owns keyboard shell handling
  builds disabled shell props
  builds editable shell props
  builds primitive props
  builds structured props
  builds display props
```

This is too much entropy in one file. The lines are useful, but the boundary is
not precise enough.

## Target Module Shape

```txt
components/json-table/
  editable-json-table-cell.tsx
    pure JSX router

  use-json-table-editable-cell-model.ts
    composition only, ideally under 160 lines

  use-json-table-cell-field.ts
    materialized path, metadata, cell id, primitive kind, active booleans

  use-json-table-primitive-control.ts
    primitive effective value, commit callback, active callback,
    activation request state, editor handle registration

  use-json-table-shell-handlers.ts
    pointer/click/key/hover handlers built from activation, command,
    handoff, structured start, and primitive control APIs

  use-json-table-focus-return.ts
    focus returns to td after editing ends

  use-json-table-cell-profiler.ts
    render snapshot recording for editable cells

  json-table-cell-shell.ts
    disabled/editable shell prop builders

  json-table-cell-model.ts
    model union types and model builders
```

This is intentionally more files. The goal is fewer meanings per file, not
fewer filenames.

## Ownership Boundaries

### `use-json-table-cell-field.ts`

Owns derived identity:

- `materializedFieldPath`
- `fieldMetadata`
- `dataCellKind`
- `cellId`
- `cellValue`
- `cellWidth`
- `isPrimitiveCell`
- `isPrimitiveActive`
- `isStructuredActive`
- `isCellEditing`
- `isJsonEditable`

Does not own:

- event handlers
- commits
- focus
- shell props
- render model

### `use-json-table-primitive-control.ts`

Owns primitive control data:

- `primitiveEffectiveValue`
- `primitiveActivationRequest`
- `commitPrimitiveValue`
- `setPrimitiveActive`
- `setPrimitiveEditorHandle`
- clearing activation requests when inactive

Does not own:

- pointer/key filtering
- boolean command decisions
- shell events
- structured sessions

### `use-json-table-shell-handlers.ts`

Owns table shell event wiring:

- hover enter/move
- hover leave
- pointer down
- click tail
- key down

It may call:

- `finishPreviousPrimitiveEditor`
- `commitPrimitiveCommand`
- `pointerActivationRequest`
- `keyboardActivationRequest`
- `structuredPointerActivationIntent`
- `structuredKeyboardActivationIntent`
- `startStructuredEditSession`
- primitive control callbacks

It must not own:

- `useCellController`
- render model construction
- field metadata lookup
- shell prop object construction

### `use-json-table-focus-return.ts`

Owns only:

- remembering whether the cell was editing
- focusing the table cell after editing ends and no table edit remains active

It must not know:

- field kinds
- commits
- activation requests

### `use-json-table-cell-profiler.ts`

Owns only:

- `recordJsonTableRender("EditableJsonTableCell", ...)`
- the snapshot shape for editable cell renders

It must not:

- mutate state
- decide active identity
- build props

### `json-table-cell-shell.ts`

Owns only:

- disabled shell props
- editable shell props
- class names
- width styles
- data attributes
- tab index

It must not:

- close over React state
- call hooks
- create event behavior beyond accepting handlers

### `json-table-cell-model.ts`

Owns only:

- model union types
- model construction helpers

The model variants should stay exact:

```ts
type JsonTableEditableCellModel =
  | { kind: "disabled"; shellProps }
  | { kind: "primitive"; shellRef; shellProps; primitiveProps }
  | { kind: "structured-active"; shellRef; shellProps; structuredActiveProps }
  | { kind: "display"; shellRef; shellProps; displayProps }
```

## Naming Contract

Use exact names:

- `cellField` for derived cell identity and schema facts
- `cellValue` for projected JSON value
- `primitiveEffectiveValue` for controller-backed primitive value
- `isPrimitiveActive` for primitive identity match
- `isStructuredActive` for structured session match
- `isCellEditing` for rendered active state
- `activationRequest` for table-to-DataCell requests
- `shellHandlers` for td event handlers
- `shellProps` for td props
- `primitiveProps` for `JsonTablePrimitiveCell`
- `structuredActiveProps` for `JsonTableStructuredActiveCell`
- `displayProps` for `JsonTableDisplayCell`

Avoid:

- generic `value` in the coordinator hook
- generic `isEditing` outside a small local scope
- generic `handleClick` without shell qualifier
- generic `close` or `session`
- `activeCell` unless it is the exported union

## Desired Composition Hook

The final `useJsonTableEditableCellModel` should read like this:

```ts
export function useJsonTableEditableCellModel(props: JsonTableCellProps) {
  const cellField = useJsonTableCellField(props)
  const shellRef = React.useRef<HTMLTableCellElement>(null)

  const primitiveControl = useJsonTablePrimitiveControl({
    props,
    cellField,
  })

  useJsonTableFocusReturn({
    shellRef,
    isCellEditing: cellField.isCellEditing,
    primitiveActiveCell: props.primitiveActiveCell,
    structuredEditSession: props.structuredEditSession,
  })

  useJsonTableCellProfiler({ props, cellField })

  const shellHandlers = useJsonTableShellHandlers({
    props,
    cellField,
    primitiveControl,
  })

  return buildJsonTableEditableCellModel({
    props,
    cellField,
    primitiveControl,
    shellHandlers,
    shellRef,
  })
}
```

If the hook is still hard to read, the split failed.

## Required Deletions From `use-json-table-editable-cell-model.ts`

Delete direct ownership of:

- field metadata lookup
- `useCellController`
- pointer event handler bodies
- click event handler bodies
- keydown event handler bodies
- focus-return layout effect
- profiler snapshot construction
- shell prop construction
- model object construction

The file should import the new hooks and builders, not implementation details
such as:

- `getFieldMetadata`
- `formatValueForCommit`
- `getSelectableCellWidthStyle`
- `markJsonTableProfile`
- `recordJsonTableRender`
- `finishPreviousPrimitiveEditor`
- `commitPrimitiveCommand`

Those should live behind the new boundaries.

## Architecture Guards

Extend `tests/json-table-architecture.test.ts`.

The coordinator file should not contain:

- `getFieldMetadata`
- `useCellController`
- `formatValueForCommit`
- `markJsonTableProfile`
- `recordJsonTableRender`
- `finishPreviousPrimitiveEditor`
- `commitPrimitiveCommand`
- `pointerActivationRequest`
- `keyboardActivationRequest`
- `getSelectableCellWidthStyle`
- `getCellWidthStyle`
- `onPointerDown:`
- `onKeyDown:`
- `React.useLayoutEffect`

The router file should keep its existing forbidden-pattern guard.

Add line-count guards:

- `editable-json-table-cell.tsx` <= 80 lines
- `use-json-table-editable-cell-model.ts` <= 180 lines
- each extracted hook/module <= 220 lines, except tests

Line-count guards are blunt, but useful here: this architecture is about
preventing a new gravity well.

## Interaction Contract

No behavior may change.

Preserve:

- first click into text places caret
- typing after click inserts instead of replacing
- printable key activation replaces
- dirty text commits before switching cells
- dirty text commits when virtualized out
- pending document data survives parent lag
- enum first click opens
- enum click tail does not close
- enum Escape closes without commit
- enum outside pointer closes without commit
- enum option preserves JSON identity
- date and active editor use the same display format
- date picker opens on first click
- boolean click toggles exactly once
- boolean Space toggles exactly once
- Enter/F2 on boolean does not toggle
- unrelated virtual rows stay inert
- active overlay row stays elevated

## Performance Contract

No new render pressure.

The profiler must still show:

- hover-date-cell: zero React renders
- hover-first-20-mounted-cells: zero React renders
- primitive draft changes do not rerender inactive rows
- active identity changes only affect visible rows that depend on active state

The profiler should be run with:

```sh
PROFILE_OUTPUT=/tmp/retab-json-table-coordinator-compression-profile.json \
  node scripts/profile-json-table-interactions.mjs
```

## Verification Plan

Run:

```sh
pnpm exec prettier --check \
  components/json-table/editable-json-table-cell.tsx \
  components/json-table/use-json-table-editable-cell-model.ts \
  components/json-table/use-json-table-cell-field.ts \
  components/json-table/use-json-table-primitive-control.ts \
  components/json-table/use-json-table-shell-handlers.ts \
  components/json-table/use-json-table-focus-return.ts \
  components/json-table/use-json-table-cell-profiler.ts \
  components/json-table/json-table-cell-shell.ts \
  components/json-table/json-table-cell-model.ts \
  tests/json-table-architecture.test.ts \
  design/data-cell-json-table-coordinator-compression-blueprint.md
```

Run:

```sh
pnpm exec vitest run tests/json-table-*.test.tsx
pnpm exec vitest run tests/json-table-*.test.ts \
  tests/data-cell-control-lifecycle.test.tsx \
  tests/data-cell-text-hit-test.test.ts \
  tests/data-cell.test.tsx
```

Run full typecheck if the unrelated worktree allows it:

```sh
pnpm exec tsc --noEmit --pretty false --incremental false
```

If full typecheck fails outside JSON-table/DataCell, record the unrelated file
and exact error.

## Success Criteria

We are closer to the platonic ideal when:

- `EditableJsonTableCell` remains a small router.
- `useJsonTableEditableCellModel` is a small composition hook, not a behavior
  owner.
- every extracted hook has one coherent reason to exist.
- naming distinguishes cell facts, primitive control, shell handlers, shell
  props, and render model.
- architecture tests prevent coordinator bloat from returning.
- full JSON-table/DataCell suites pass.
- profiler hover scenarios still produce zero React renders.

The final code should feel like a sentence:

```txt
derive the cell
derive primitive control
wire shell handlers
restore focus
record profile
build render model
render the model
```

Nothing more.
