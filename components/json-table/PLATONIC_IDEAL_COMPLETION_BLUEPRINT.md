# DataCell and JSON Table Platonic Ideal Completion Blueprint

## Verdict

The component is good. It is not perfect.

The hard cutover removed the largest architectural mistakes:

- no hover-mounted editors
- no `DataCell` auto edit lifecycle
- no `JsonTableScalarCell`
- no grouped compatibility editor props
- one table-owned `editSession`
- first-click text, enum, checkbox, and date interactions work
- picker overlay state can be controlled by JSON table
- DataCell types and value formatting/parsing are split from the React file
- architecture guard tests prevent the old names from returning

The remaining work is narrower and more exact: split the remaining broad
DataCell rendering file, automate browser regressions, profile the new
architecture, and collapse architecture documentation into one authoritative
source.

## One-Sentence Ideal

```txt
JSON table owns grid editing state; DataCell owns primitive cell controls;
editors map schema field kinds onto those controls; value normalization happens
once at commit.
```

If a module cannot defend its place in that sentence, it should not exist.

## What Is Already Ideal Enough

### Edit Lifecycle

The edit lifecycle is structurally correct.

- `JsonTableEditSession` is the only active editing state.
- `EditableJsonTableCell` starts sessions from pointer and keyboard intent.
- Editors receive `editSession`, not local focus/overlay/text-draft prop groups.
- The table controls overlay visibility for enum, object, array, and picker
  editors.

Do not redesign this unless profiling or product behavior proves a real defect.

### Inactive Cells

Inactive cells are structurally correct.

- Display cells are inert.
- Hover does not mount controls.
- Hover does not create draft state.
- Hover does not create popovers, calendars, selects, or inputs.

This is a core invariant.

### Commit Boundary

The commit boundary is structurally correct.

- Editors call `commitValue`.
- `EditableJsonTableCell` normalizes through `formatValueForCommit`.
- `useCellController` owns document commit plumbing.

Do not add editor-local document mutation paths.

## Remaining Imperfections

### 1. DataCell Rendering Is Still Too Broad

Current state:

- `data-cell-types.ts` owns public types.
- `data-cell-format.ts` owns pure parsing and formatting.
- `data-cell.tsx` still owns all rendering and control mechanics.

Remaining impurity:

- text input rendering
- number input rendering
- boolean rendering
- picker rendering
- picker popup positioning
- control focus/caret behavior
- display rendering

These are related, but not identical. A perfect component has smaller files with
one reason to change.

### 2. Browser Regression Coverage Is Manual

Manual smoke has proven the current behavior, but manual smoke is not a
contract.

The product-critical behaviors must become committed browser tests:

- hover does not mount an editor
- one click on text focuses input and typing works
- one click on enum opens options
- one click on checkbox toggles and closes
- one click on date opens picker with table-controlled overlay state
- Escape closes the active editor
- blur commits text once

Until this exists, the architecture can regress without the test suite noticing.

### 3. Performance Has Not Been Re-profiled After The Final Split

The architecture is faster by construction, but the final claim must be
measured.

Required measurements:

- initial render
- hover sweep across visible cells
- click-to-editor-mounted latency
- first keypress latency
- checkbox toggle latency
- enum open latency
- date picker open latency
- scroll while no editor is active
- scroll while one overlay is active

An ideal component has numbers, not vibes.

### 4. Documentation Has Too Many Blueprints

There are now several blueprint files. Some are historical, some are current,
some are diagrams, and some describe completion work.

The ideal documentation state is:

- one canonical architecture note
- one performance note
- one diagram
- no stale migration docs pretending to be current truth

History is useful only if it does not compete with the current contract.

### 5. Whole Repo Is Not Green

The DataCell/JSON table focused suite is green. The full suite still has one
unrelated `parse-viewer` failure.

That does not invalidate the component work, but it prevents the stronger claim
that the whole workspace is pristine.

## Target File Structure

The final DataCell structure should be:

```txt
registry/new-york-v4/ui/
  data-cell.tsx
  data-cell-types.ts
  data-cell-format.ts
  data-cell-display.tsx
  data-cell-text-control.tsx
  data-cell-number-control.tsx
  data-cell-boolean-control.tsx
  data-cell-picker-control.tsx
  data-cell-picker-position.ts
```

Rules:

- `data-cell.tsx` should only compose and export the public convenience API.
- `data-cell-display.tsx` should render inert display cells.
- `data-cell-text-control.tsx` should own text focus, caret, draft, commit.
- `data-cell-number-control.tsx` should own numeric input attributes and invalid
  raw draft preservation.
- `data-cell-boolean-control.tsx` should own checkbox semantics.
- `data-cell-picker-control.tsx` should own date/time trigger and popup.
- `data-cell-picker-position.ts` should own popup geometry.
- `data-cell-format.ts` remains pure and React-free.
- `data-cell-types.ts` remains type-only.

Do not create a file unless it removes a real reason to change from another
file.

## Target Editor Contract

Keep the current editor contract:

```ts
type CellEditorProps = {
  cell: JsonTableEditorCell
  editSession: JsonTableEditSession
  draftValue: string
  setDraftValue: (draftValue: string) => void
  setOverlayOpen: (isOverlayOpen: boolean) => void
  closeEditSession: () => void
  commitValue: (value: unknown) => void
}
```

This is the right shape.

Do not add:

- `focus`
- `overlays`
- `textDraft`
- `identity`
- `field`
- `commit`
- `close`
- context wrappers
- compatibility aliases

## Performance Contract

### Hard Invariants

- Hovering an inactive scalar cell mounts zero inputs.
- Hovering an inactive enum cell mounts zero selects.
- Hovering an inactive date cell mounts zero calendars.
- Only one edit session exists at a time.
- Only the active editor receives draft updates.
- Checkbox pointer activation commits and closes in one interaction.
- Select pointer activation opens options in one interaction.
- Date pointer activation opens the picker in one interaction.

### Metrics To Record

Create a local profiling script or documented profiling flow that records:

| Interaction         | Metric                                 |
| ------------------- | -------------------------------------- |
| hover sweep         | editor mounts, render count, duration  |
| text click          | time to input mounted/focused          |
| first keypress      | time to DOM value update               |
| checkbox click      | time to checked state update           |
| enum click          | time to options visible                |
| date click          | time to picker popup visible           |
| scroll idle         | frames dropped or scroll duration      |
| scroll with overlay | row elevation stability and frame cost |

### Stop Conditions

Optimization stops when:

- no interaction has visible lag
- hover has no mount work
- render counters show no unrelated row churn
- code required to optimize further is less clear than the bottleneck warrants

Speed is a feature, but cleverness is still a liability.

## Browser Regression Contract

Add an automated browser test file that opens `json-table-profile` and verifies:

1. Enable JSON editable mode.
2. Hover a currency cell.
3. Assert no input exists in that cell.
4. Click the currency cell.
5. Type one character.
6. Assert the input value changes immediately.
7. Click an enum cell.
8. Assert `aria-expanded="true"` and options exist.
9. Click an unchecked boolean cell.
10. Assert `aria-checked` flips and the cell is no longer active.
11. Click a date cell.
12. Assert picker popup exists and trigger has `aria-expanded="true"`.

This is the product contract that originally failed. It deserves a permanent
test.

## Documentation Contract

Consolidate the architecture docs into:

```txt
components/json-table/
  ARCHITECTURE.md
  PERFORMANCE_BLUEPRINT.md
  ARCHITECTURE_DIAGRAM.md
```

Suggested mapping:

- fold `PLATONIC_IDEAL_BLUEPRINT.md` into `ARCHITECTURE.md`
- fold current parts of `DATACELL_JSON_TABLE_JOINT_BLUEPRINT.md` into
  `ARCHITECTURE.md`
- fold current parts of `FLAUBERTIAN_IDEAL_BLUEPRINT.md` into
  `ARCHITECTURE.md`
- keep historical migration notes only if they are clearly labeled as history
- delete duplicate blueprint files after consolidation

The ideal documentation set has no competing sources of truth.

## Implementation Phases

### Phase 1: Split DataCell Rendering

1. Extract `DataCellDisplay`.
2. Extract text control.
3. Extract number control.
4. Extract boolean control.
5. Extract picker control.
6. Extract picker positioning.
7. Leave `data-cell.tsx` as a thin composition/export file.
8. Run DataCell tests after each extraction.

### Phase 2: Add Browser Regression

1. Add automated browser coverage for the first-click interactions.
2. Make it deterministic against the local profile page.
3. Keep selectors stable through `data-field-path`.
4. Avoid screenshot-only assertions.
5. Assert DOM state that directly maps to user behavior.

### Phase 3: Profile

1. Run current profiler before more optimization.
2. Record baseline numbers.
3. Identify actual hot paths.
4. Remove memoization or callbacks that no longer pay rent.
5. Optimize only measured waste.
6. Record final numbers in `PERFORMANCE_BLUEPRINT.md`.

### Phase 4: Consolidate Docs

1. Create canonical `ARCHITECTURE.md`.
2. Move current truth into it.
3. Delete or archive stale blueprint files.
4. Keep the architecture guard test aligned with the canonical doc.

### Phase 5: Full Green

1. Fix or quarantine the unrelated `parse-viewer` failure.
2. Run full suite.
3. Record final verification.

## Definition Of Done

We can claim the platonic ideal only when all are true:

- `data-cell.tsx` is a thin public composition file.
- Every DataCell primitive has one reason to change.
- JSON table has exactly one edit-session owner.
- Editors receive only the final direct editor contract.
- Picker overlay state is synchronized with the table edit session.
- Hover mounts no controls.
- First-click interactions are automated browser tests.
- Performance has been re-measured after the final split.
- Architecture docs have one source of truth.
- Focused and full test suites are green, or unrelated failures are explicitly
  quarantined with a tracked reason.

Until then, the component is excellent but not perfect.
