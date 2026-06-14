# DataCell JSON Table Absolute Platonic Ideal Blueprint

## Current State

The primitive interaction path is now strong and measured.

- Enum hover performs zero anchor reads and triggers no JSON table renders.
- Enum open performs exactly one anchor read and renders only the target `EditableJsonTableCell`.
- Boolean toggle performs one persisted patch and renders only the owning cell surface.
- Date picker open performs exactly one anchor read and renders only the target `EditableJsonTableCell`.
- Date month navigation performs zero anchor reads and triggers no JSON table renders.
- Default and large profiler runs assert these invariants.
- Projected scalar patch tests prove path-indexed cell identity replacement instead of broad table identity churn.

This is not yet the platonic ideal.

- Scalar enum, text, number, date, and boolean commits render only the owning cell surface and persist exactly one document patch.
- DataCell control typing uses exact control state and kind-specific control props without generic picker-open vocabulary.
- The date picker is table-isolated and has explicit DOM and layout budgets.
- DataCell registry generation has a scoped item build path.
- The profiler is a repeatable primitive interaction gate for default and large table profiles.

## Goal

Make primitive table editing feel inevitable:

- Open, hover, navigate, and close stay local to the active primitive editor.
- Scalar commit updates one document value, one projected cell identity, and one visible editing surface.
- Parent table, row, and virtualizer work happens only for structural changes, not for scalar primitive edits.
- DataCell exposes the smallest complete primitive editor API.
- Naming is exact and consistent across DataCell, JSON table adapters, tests, and profiler scenarios.
- Generated output is deterministic and scoped to the changed component.
- Performance invariants are enforced by a repeatable gate.

## Non-Goals

- Do not rewrite virtualization.
- Do not add a second document mutation model.
- Do not change user-facing editing semantics.
- Do not hide render work behind timers, debounce, or delayed commits.
- Do not add compatibility shims or legacy aliases.
- Do not broaden the design system while fixing this component.

## Platonic Invariants

### 1. Scalar Commit Is Proportional To One Cell

Problem: scalar commit currently travels through parent document state, so a real enum commit still renders table-level owners.

Design:

- Route primitive scalar patches through a path-indexed document projection boundary.
- Publish a scalar patch as `{ path, value }`, not as a broad table data replacement.
- Recompute or replace only the affected projected cell identity.
- Keep table, virtualizer, and row identities stable for scalar edits.
- Reserve parent table invalidation for structural edits: row insert, row delete, column shape change, schema change, and file-level replacement.

Success criteria:

- Enum, date, text, number, and boolean scalar commits render only the owning cell surface.
- `SingleFileTableView`, `SingleFileVirtualizedTable`, and `SingleFileFormRow` do not render on scalar commit.
- The persisted document update still happens exactly once.
- The projected patch test proves one cell identity changes and sibling identities stay stable.

### 2. Primitive Open State Uses One Vocabulary

Problem: DataCell uses `open` / `onOpenChange`, while table adapter code still contains picker-oriented naming.

Design:

- Use `open` and `onOpenChange` at the primitive control boundary.
- Use `editorOpen` only if a table-level disambiguator is unavoidable.
- Keep `picker` language inside actual picker implementations only.
- Remove names such as `onPickerOpenChange` from generic table and DataCell adapter surfaces.

Success criteria:

- `rg "onPickerOpenChange|isPickerOpen|pickerOpen"` finds no generic DataCell or JSON table adapter state.
- Tests, profiler scenarios, and component props use the same concept name for the same state.
- No compatibility alias remains.

### 3. DataCell Control Registry Has No Type Ceremony

Problem: the registry boundary still carries avoidable activation-model and prop-shaping ceremony.

Design:

- Each primitive exports one exact control descriptor: `kind`, `render`, and `activate`.
- Control props are a discriminated union keyed by the primitive kind.
- The shared DataCell shell dispatches from the discriminant without casts.
- Primitive-specific props stay inside the primitive control module.
- Adding a new primitive requires one registry entry and one typed control implementation.

Success criteria:

- No `as DataCell...ControlProps` cast is needed at the registry boundary.
- No broad activation model exists only to be converted into primitive-specific props.
- TypeScript forces exhaustive handling when a primitive kind is added or removed.
- The public DataCell API remains smaller after the change.

### 4. Date Picker DOM Is Bounded

Problem: date open is isolated from the table, but the editor still mounts more local structure than a table primitive should need.

Design:

- Measure node delta, layout time, and scripting time for date open and month navigation.
- Replace generic calendar layers in the table hot path if they exceed the measured budget.
- Keep keyboard navigation, focus management, aria labels, and locale-correct formatting.
- Keep month navigation local and free of anchor reads.

Success criteria:

- Date open has an explicit node-count budget.
- Date open has an explicit layout-time budget.
- Date month navigation remains zero table renders and zero anchor reads.
- Accessibility coverage does not regress.

### 5. Generated Artifacts Are Deterministic And Scoped

Problem: registry builds can produce unrelated generated churn, which makes the component harder to reason about and review.

Design:

- Make registry generation stable by construction: sorted keys, deterministic formatting, and no timestamp-like drift.
- Add a scoped path for building only affected component registry output when possible.
- Keep generated files as consequences of source changes, not as broad workspace noise.

Success criteria:

- A DataCell-only source edit changes only DataCell-related generated artifacts and required registry indexes.
- Running registry build twice without source changes produces an empty diff.
- Reviewers can distinguish component changes from generated consequences immediately.

### 6. The Profiler Is A Gate

Problem: the profiler is good enough to diagnose regressions, but not yet a reliable quality boundary.

Design:

- Promote the primitive interaction profiler to a repeatable command owned by the frontend test workflow.
- Run default and large-table profiles.
- Emit a compact JSON summary with render counts, anchor reads, commit counts, and node deltas.
- Fail on invariant regressions, not on incidental timing variance.
- Keep timing thresholds coarse and structural thresholds strict.

Success criteria:

- One local command validates the primitive interaction contract.
- CI can run the same command without manual browser setup.
- Failure output names the exact scenario, component, and exceeded invariant.

## Implementation Phases

### Phase 1. Commit Path Proof

- Add a profiler scenario that isolates scalar commit from open.
- Capture the exact render ownership chain for enum, date, text, number, and boolean commits.
- Add a failing assertion for the ideal scalar commit behavior.
- Design the smallest path-indexed projection boundary that can satisfy it.

### Phase 2. Commit Path Isolation

- Route scalar primitive commits through the projection boundary.
- Keep structural edits on the existing table invalidation path.
- Preserve persistence semantics and undo semantics.
- Update tests around projected cell identity, sibling identity, and real document commit count.

### Phase 3. Vocabulary Compression

- Rename generic picker-facing table props to the final open-state vocabulary.
- Update tests and profiler scenario names to match.
- Remove compatibility aliases in the same change.

### Phase 4. Registry Compression

- Collapse the control registry to exact primitive descriptors.
- Remove broad activation models and prop casts.
- Keep primitive-specific complexity inside primitive modules.
- Verify exhaustiveness with `tsc`.

### Phase 5. Date Editor Budget

- Add date open node and layout measurements to the profiler summary.
- Decide whether the current calendar can meet the budget.
- If not, build a smaller table-specific date primitive.
- Preserve keyboard, focus, and aria behavior.

### Phase 6. Generated Output And Gate

- Make registry output deterministic and scoped.
- Add a repeatable frontend command for primitive performance assertions.
- Wire the command into the appropriate local or CI workflow.
- Document the invariants where future component authors will find them.

## Verification

Run the existing correctness and architecture checks:

```bash
pnpm typecheck
pnpm test tests/json-table-boolean-enum-interactions.test.tsx tests/json-table-session-virtualization-hardening.test.tsx tests/json-table-session-interactions.test.tsx tests/json-table-architecture.test.ts tests/json-table-picker-interactions.test.tsx tests/json-table-projected-cell-patch.test.ts tests/json-table-controller.test.tsx tests/json-table-row-render.test.tsx tests/json-table-text-number-interactions.test.tsx
pnpm profile:json-table-primitives
pnpm registry:build:items data-cell
```

Add these final checks before declaring the component ideal:

```bash
rg "onPickerOpenChange|isPickerOpen|pickerOpen" components registry/new-york-v4/ui tests scripts public/r/data-cell.json
rg "as DataCell.*ControlProps|DataCellControlActivationModel|activationModel" components registry/new-york-v4/ui tests scripts public/r/data-cell.json
```

Required profiler assertions:

- Hover: zero anchor reads, zero JSON table renders.
- Open: exactly one anchor read, target cell render only.
- Navigate: zero anchor reads, zero JSON table renders.
- Boolean toggle: target cell render only, no table, virtualizer, or row render, exactly one document patch.
- Scalar commit: target cell render only, no table, virtualizer, or row render, exactly one document patch.
- Date open: node delta and layout time within explicit budgets.

## Definition Of Done

- Scalar primitive commit updates one persisted value and one projected cell without table, row, or virtualizer rerender.
- Open, hover, navigate, close, and boolean toggle keep the current strict render behavior.
- DataCell and JSON table use one exact open-state vocabulary.
- The control registry has no casts, broad activation adapters, or duplicate prop shapes.
- Date picker cost is bounded by explicit profiler budgets.
- Registry generation is deterministic and scoped.
- The profiler is a repeatable gate for default and large-table scenarios.
- The resulting API is smaller, faster, more exact, and easier to read than the current one.
