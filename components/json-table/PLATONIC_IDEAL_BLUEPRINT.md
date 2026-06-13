# DataCell and JSON Table Platonic Ideal Blueprint

## Verdict

We have not reached the platonic ideal yet.

The current implementation is a strong hard cutover:

- JSON table owns activation and edit-session state.
- `DataCell` no longer owns hover-to-edit lifecycle.
- Hover does not mount controls.
- Text, select, and checkbox cells work on the first click.
- The old grouped editor prop contract is gone.
- `JsonTableScalarCell` is gone.

But perfection requires more than removing the worst abstraction. The next
version must make the remaining architecture feel inevitable: smaller modules,
stricter names, fewer local state pockets, measured speed, and browser-level
interaction tests that encode the product contract.

## North Star

```txt
JSON table owns grid state.
DataCell owns cell primitives.
Editors translate a table edit session into one mounted primitive.
The commit boundary normalizes values once.
```

Anything outside that sentence is suspect.

## Ideal Properties

### Simplicity

- There is one edit lifecycle: `JsonTableEditSession`.
- A displayed cell is inert.
- A mounted editor is already interactive.
- No hover path changes component type.
- No component both decides whether editing starts and renders the editor.
- No editor receives props for systems it does not own.

### Speed

- Hover is metadata-only or no-op; it never mounts inputs, popovers, calendars,
  or select infrastructure.
- An inactive cell renders only a display primitive.
- An active scalar cell renders one native control.
- One active editor updates one session, not row-wide or table-wide state.
- Profiling is part of the contract, not an afterthought.

### Completeness

- Text cells support one-click edit and immediate typing.
- Number cells preserve invalid drafts until commit.
- Boolean cells toggle on one pointer click and Space.
- Enum cells open on one click.
- Date/time cells open intentionally and commit normalized values.
- Object/array cells open overlays without disturbing virtualization.
- Keyboard activation, Escape, blur, and virtualized unmounts have defined
  behavior.

### Nothing More

- No compatibility prop groups.
- No wrapper that only forwards `DataCell` props.
- No table-specific behavior inside `DataCell`.
- No schema traversal inside editors.
- No DOM-query focus bridge from JSON table into mounted controls.
- No duplicate display path inside active editors.

## Final Ownership Model

| Module Family       | Owns                                                                         | Must Not Own                                    |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| JSON table shell    | projection, virtualization, cell activation, edit session                    | primitive focus/caret behavior                  |
| JSON table editors  | field-kind mapping, draft seeding, field commit semantics                    | grid state, schema traversal, document patching |
| DataCell primitives | display/control styling, native control behavior, primitive parsing metadata | document paths, schema concepts, table sessions |
| Value model         | commit normalization, date/time conversion                                   | rendering, focus, overlays                      |
| Tests               | user-visible behavior and contracts                                          | legacy implementation trivia                    |

## Target Module Map

The exact filenames can change, but the boundaries should converge here.

```txt
components/ui/data-cell/
  data-cell-types.ts
  data-cell-display.tsx
  data-cell-text-control.tsx
  data-cell-number-control.tsx
  data-cell-boolean-control.tsx
  data-cell-picker-control.tsx
  data-cell-format.ts
  data-cell-parse.ts
  index.ts

components/json-table/
  json-table-edit-session.ts
  editable-json-table-cell.tsx
  json-table-display-cell.tsx
  json-table-data-cell.ts
  use-cell-controller.ts
  use-elevated-virtual-row.ts
  cell-editors/
    editor-types.ts
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

The current single-file `registry/new-york-v4/ui/data-cell.tsx` is acceptable
as an intermediate state, but not as the final ideal. It contains too many
reasons to change.

## Ideal DataCell API

### Display

```tsx
<DataCellDisplay
  kind={kind}
  value={value}
  placeholder="—"
  formatValue={formatValue}
/>
```

Rules:

- Display never edits.
- Display never owns draft state.
- Display never commits.
- Display can look editable through cursor affordance only if the caller asks,
  but it still does not activate itself.

### Text Control

```tsx
<DataCellTextControl
  value={draftValue}
  activationIntent={activationIntent}
  disabled={disabled}
  onDraftChange={setDraftValue}
  onCommit={commitValue}
  onCancel={closeSession}
/>
```

Rules:

- Focus itself from `activationIntent`.
- Place caret from pointer intent.
- Let the editor decide whether printable keyboard intent replaces the draft.
- Commit on Enter or blur.
- Cancel on Escape if the product contract chooses cancellation.

### Number Control

```tsx
<DataCellNumberControl
  kind="number"
  value={draftValue}
  activationIntent={activationIntent}
  onDraftChange={setDraftValue}
  onCommit={commitParsedNumber}
/>
```

Rules:

- Preserve raw invalid drafts.
- Emit parse metadata.
- Never coerce invalid input silently.

### Boolean Control

```tsx
<DataCellBooleanControl
  checked={checked}
  activationIntent={activationIntent}
  onCommit={commitBoolean}
/>
```

Rules:

- Toggle from pointer activation.
- Toggle from Space.
- Close immediately after activation-triggered commit.

### Picker Control

```tsx
<DataCellPickerControl
  kind="date"
  value={draftValue}
  activationIntent={activationIntent}
  isOpen={isOverlayOpen}
  onOpenChange={setOverlayOpen}
  onDraftChange={setDraftValue}
  onCommit={commitDate}
  onClose={closeSession}
/>
```

Rules:

- Overlay state is controlled when embedded in JSON table.
- The picker may own internal calendar navigation, but not whether the table row
  is elevated.
- Opening a picker must not require a second click.

## Ideal JSON Table Editor API

Current direction is correct:

```ts
export interface CellEditorProps {
  cell: JsonTableEditorCell
  session: JsonTableEditSession
  draftValue: string
  setDraftValue: (value: string) => void
  setOverlayOpen: (open: boolean) => void
  close: () => void
  commit: (value: unknown) => void
}
```

The final ideal should make names even tighter:

```ts
type JsonTableCellEditorProps = {
  cell: JsonTableEditorCell
  editSession: JsonTableEditSession
  draftValue: string
  setDraftValue: (draftValue: string) => void
  setOverlayOpen: (isOverlayOpen: boolean) => void
  closeEditSession: () => void
  commitValue: (value: unknown) => void
}
```

This is more verbose, but more exact. `commit` and `close` are convenient;
`commitValue` and `closeEditSession` say the precise domain action.

## Naming Standard

Use one name for one concept.

| Concept                                | Required Name                              |
| -------------------------------------- | ------------------------------------------ |
| Active table edit lifecycle            | `editSession`                              |
| Cause of editing                       | `activationIntent`                         |
| Concrete document path                 | `materializedFieldPath`                    |
| Schema path that may contain wildcards | `templateFieldPath`                        |
| Schema-derived field facts             | `fieldMetadata`                            |
| Displayed projected document cell      | `projectedCell`                            |
| Active editor cell facts               | `editorCell` or `cell` inside editor props |
| String being edited                    | `draftValue`                               |
| Overlay visibility                     | `isOverlayOpen`                            |
| Commit from editor to table            | `commitValue`                              |
| Close the active session               | `closeEditSession`                         |

Forbidden in this subsystem:

- `openEditorPath`
- `JsonTableScalarCell`
- `InteractiveDataCell`
- `auto` as an edit mode
- `focus` as an editor prop group
- `overlays` as an editor prop group
- `textDraft` as an editor prop group
- generic `metadata`
- generic `valueState`
- wrapper names whose only meaning is historical

## Performance Contract

The ideal is not just cleaner. It must be measurably fast.

### Required Measurements

- Initial render cost for a representative table.
- Hover cost over 100 cells.
- First-click-to-control-mounted latency for text, enum, boolean, date.
- Keystroke cost in a mounted text editor.
- Checkbox toggle cost.
- Select open cost.
- Scroll cost with no active editor.
- Scroll cost with one active overlay.

### Required Budgets

Budgets should be set from measured baseline, then tightened. Initial target:

- Hover over inactive cells mounts zero editors.
- A text keystroke re-renders only the active editor path and unavoidable
  ancestors.
- Checkbox toggle commits and closes without keeping an active editor mounted.
- Select open does not invalidate unrelated rows.
- Row virtualization remains stable with an active overlay.

### Required Instrumentation

- Keep `json-table-profiler.ts` focused on table-specific events.
- Add explicit marks for:
  - `edit-session-start`
  - `editor-mounted`
  - `draft-updated`
  - `value-committed`
  - `edit-session-closed`
  - `overlay-opened`
  - `overlay-closed`
- Prefer user timing marks and render counters over ad hoc console logs.

## Test Contract

### Unit Tests

DataCell primitive tests must prove:

- display never mounts controls on hover or click.
- text control focuses from activation intent.
- pointer activation places the caret.
- number control preserves invalid raw input.
- boolean control toggles once.
- picker control opens without a second click.

JSON table editor tests must prove:

- each `FieldKind` dispatches to the right editor.
- text keyboard activation can seed a draft.
- number keyboard activation can seed a numeric draft.
- boolean pointer activation commits and closes.
- enum activation opens the select.
- object/array activation opens a popover and closes the session.

### Browser Tests

The following must become automated browser tests, not just manual smoke:

- Hover over a scalar cell leaves `inputCount === 0`.
- One click on text cell plus typing changes the input immediately.
- One click on enum cell opens options.
- One click on checkbox toggles the value.
- Escape closes an active editor.
- Blur commits text and closes the session.
- Scrolling with an active editor does not orphan an overlay.

## Deletion Checklist

The architecture is not ideal while any of these exist:

- a hover path that mounts a control.
- a parent component that queries inside an editor to focus it.
- an editor prop that is passed only for compatibility.
- duplicate scalar display wrappers.
- a generic `mode="auto"` edit concept.
- a broad DataCell file where display, controls, formatting, parsing, and
  picker overlay positioning all change together.
- tests that assert old implementation details instead of current product
  behavior.

## Implementation Plan

### Phase 1: Freeze The New Contract

- Rename editor props to the exact final names:
  - `session` -> `editSession`
  - `commit` -> `commitValue`
  - `close` -> `closeEditSession`
- Update tests to use the same names.
- Add a grep-based invariant test or script for forbidden legacy names.

### Phase 2: Split DataCell

- Extract shared types into `data-cell-types.ts`.
- Extract display into `data-cell-display.tsx`.
- Extract text/number/boolean/picker controls into separate files.
- Extract parse and format helpers.
- Keep `components/ui/data-cell.tsx` as the public barrel only if it does not
  hide ownership.

### Phase 3: Control Overlay State Precisely

- Decide whether picker `isOpen` must be controlled by JSON table.
- If yes, make picker overlay state fully controlled in the table path.
- If no, document why picker-local state is acceptable and how row elevation is
  synchronized.

### Phase 4: Profile Again

- Re-run the original DataCell/JSON table profile.
- Compare against the pre-cutover hover-mount architecture.
- Record render counts and interaction timings in `PERFORMANCE_BLUEPRINT.md`.
- Remove any remaining memoization that no longer pays rent.

### Phase 5: Browser Regression Suite

- Convert the manual smoke into automated browser checks.
- Run those checks before calling the component ideal.

## Definition Of Done

We can say this component has reached its ideal only when:

- The module map matches the ownership model.
- The forbidden-name scan is clean.
- Focus/caret behavior belongs to DataCell controls, not table DOM effects.
- Activation/session behavior belongs to JSON table, not DataCell.
- Every editor receives only the props it uses.
- Hover over inactive cells has zero editor mount cost.
- First-click interaction is proven for text, enum, checkbox, and picker.
- Focused tests, typecheck, and browser regressions pass.
- A fresh profile shows no obvious interaction or render waste.

Until then, the architecture is good. It is not yet perfect.
