# JSON Table Flaubertian Ideal Blueprint

## Purpose

This is the final architecture contract for `components/json-table`.

Perfection here means:

- Everything needed.
- Nothing extra.
- Every module has one reason to exist.
- Every name says exactly what it is.
- Every test proves behavior without binding to implementation trivia.
- Every compatibility artifact is gone.
- Every remaining line can defend its existence.

## Current Verdict

The component has reached the intended structural ideal for its current product
requirements.

- No TanStack Table runtime model remains.
- TanStack Virtual is the deliberate row viewport primitive.
- No `row.original`, header-group placeholders, fake leaf columns, or old
  library-shaped concepts remain.
- `schema-inspection.ts`, `json-schema-utils.ts`, `date-utils.ts`, and
  `value-formatting.ts` are deleted.
- Schema, document, value, header, editor, and interaction behavior have local
  owners.
- Date parsing, date display formatting, schema date detection, and commit
  normalization are separate concepts.
- Cell editors receive grouped semantic props instead of a flat compatibility
  bag.
- Field paths use exact names: `templateFieldPath` for schema templates and
  `materializedFieldPath` for document paths.
- Table-level object and array editor state is named `openEditorPath`.
- Test DOM setup is centralized in `tests/json-table-test-dom.ts`.
- Focused model, controller, editor dispatch, and header menu interaction tests
  exist.
- Focused lint, scoped typecheck scan, legacy scan, compatibility scan, and
  line-count gates are clean.

The next architecture change should require a concrete product bug, measured
performance issue, or new user-facing requirement.

## One-Sentence Model

JSON table projects `TableDocument.data` through JSON schema-derived field
metadata, renders that projection through typed editor surfaces, and emits
immutable document or schema edits through pure model helpers.

If a file, variable, or test does not support that sentence, it is suspect.

## Perfection Criteria

The component is ideal only while all of these remain true:

- A schema concern can be changed without opening a document mutation file.
- A document projection concern can be changed without opening an editor file.
- A visual editor concern can be changed without opening a schema traversal file.
- Header drag behavior can be reasoned about without rendering React.
- Date parsing can be reasoned about without knowing schema traversal.
- Date display formatting can be reasoned about without knowing commit logic.
- Object and array editor state has one table-level owner.
- Every value sent upward has passed through the same normalization boundary.
- Every mutable product action has either an immutable model helper or an
  explicit controller owner.
- Every public local type name maps to a domain concept, not to a former library.

## Negative Space

These are not missing features. They are intentionally absent.

- No TanStack Table compatibility vocabulary.
- No generic JSON table utility barrel.
- No catch-all `utils.ts`.
- No schema/document/value/UI mixed module.
- No context layer for cell editor props.
- No private DOM assertions in tests.
- No rendered drag-and-drop test unless the assertion can target stable callback
  payloads or visible behavior.
- No abstraction that exists only to make files look symmetrical.
- No re-export file that hides a function's real owner.

The strongest version of this component is not the version with the most
patterns. It is the version where every remaining pattern pays rent.

## Final Module Map

### Table Shell

- `single-file-table-view.tsx`: owns table-level derived schema/document state.
- `single-file-virtualized-table.tsx`: owns the virtualized table viewport.
- `single-file-form-row.tsx`: owns form-row rendering.
- `json-table-demo.tsx`: demo entry point for showcase routes.
- `sample/data.json`: demo data.
- `sample/schema.json`: demo schema.

### Cell UI

- `data-cell.tsx`: connects projected document cells to editor props.
- `cell-display.tsx`: read-only scalar display.
- `object-editor.tsx`: embedded JSON form editor for object and array values.
- `use-cell-controller.ts`: cell commit/no-op/optimistic state controller.
- `use-elevated-virtual-row.ts`: transient row stacking while overlays are open.
- `cell-editors/cell-editor.tsx`: editor dispatch by `FieldKind`.
- `cell-editors/editor-classes.ts`: shared editor class names.
- `cell-editors/editor-types.ts`: grouped editor prop contracts.
- `cell-editors/primitive-editor.tsx`: primitive editor shell.
- `cell-editors/text-editor.tsx`: string editor.
- `cell-editors/number-editor.tsx`: number editor.
- `cell-editors/boolean-editor.tsx`: boolean editor.
- `cell-editors/enum-editor.tsx`: enum editor.
- `cell-editors/date-editor.tsx`: date editor.
- `cell-editors/datetime-editor.tsx`: date-time editor.
- `cell-editors/time-editor.tsx`: time editor.
- `cell-editors/object-editor.tsx`: object editor trigger.
- `cell-editors/array-editor.tsx`: array editor trigger.

### Header UI

- `header-cell.tsx`: connects header nodes to header interactions.
- `header-label.tsx`: visible header label.
- `header-schema-menu.tsx`: schema edit menu for a header.
- `header-drag-ui.ts`: DOM drag affordance helpers.
- `use-header-controller.ts`: header fold/drag/schema-edit controller.

### Shared UI Utilities

- `path-utils.ts`: stable callback and targeted comparison helpers for React
  cells.
- `table-options-store.ts`: persisted table view options.

### Pure Model

- `lib/projects-types.ts`: document type.
- `lib/header-nodes.ts`: local header node type and leaf flattening.
- `lib/schema-references.ts`: `$ref` and composition unwrapping.
- `lib/schema-paths.ts`: schema path traversal.
- `lib/schema-field-metadata.ts`: schema-derived field kind and edit metadata.
- `lib/schema-flat-properties.ts`: flat schema property extraction.
- `lib/schema-header-nodes.ts`: header tree construction.
- `lib/schema-mutations.ts`: immutable schema edits.
- `lib/header-drag-model.ts`: pure header reorder decisions.
- `lib/document-paths.ts`: materialized field paths and document path lookup.
- `lib/document-projection.ts`: document-to-visible-cell projection.
- `lib/document-patches.ts`: immutable document writes.
- `lib/date-parsing.ts`: date/time parsing.
- `lib/date-display-formatting.ts`: HTML input date/time formatting.
- `lib/schema-date-detection.ts`: schema date/time detection.
- `lib/value-normalization.ts`: commit-time value normalization.

Anything outside this map needs a concrete reason.

## Ownership Rules

Each file has one primary owner. If a change crosses owners, the call boundary
must stay explicit.

| Owner          | Owns                                           | Must Not Own                        |
| -------------- | ---------------------------------------------- | ----------------------------------- |
| Schema model   | refs, paths, metadata, header nodes, mutations | React state, document values        |
| Document model | projection, materialized paths, patches        | schema mutation, editor UI          |
| Value model    | date parsing/display, commit normalization     | rendering, schema tree construction |
| Cell UI        | editor selection, drafts, focus, overlays      | schema traversal, document patching |
| Header UI      | menu, fold, drag affordance wiring             | document projection, value parsing  |
| Controllers    | event sequencing and optimistic state          | pure transformations hidden inline  |
| Tests          | contracts and user-visible behavior            | implementation trivia               |

When a function seems to need two owners, split it or move the shared concept to
the narrowest pure model file.

## Naming Standard

Use these exact terms:

| Concept                              | Required Name           |
| ------------------------------------ | ----------------------- |
| Schema path that may include `*`     | `templateFieldPath`     |
| Concrete document path               | `materializedFieldPath` |
| Schema-derived field facts           | `fieldMetadata`         |
| Document-derived visible cell        | `projectedCell`         |
| Table-level object/array editor path | `openEditorPath`        |
| Setter for table-level editor path   | `setOpenEditorPath`     |
| Committed/effective string value     | `committedTextValue`    |
| Currently displayed string value     | `activeTextValue`       |
| Local editor draft string            | `draftTextValue`        |
| Commit callback from editor          | `onCommit`              |

Forbidden names in JSON table runtime code:

- `actualKey`
- `keyValue`
- generic `metadata`
- `openPopover`
- `setOpenPopover`
- `stringValue`
- `liveStringValue`
- `cleanStringValue`

## Editor Prop Contract

`CellEditorProps` is grouped by concept:

```ts
type CellEditorProps = {
  identity: CellIdentity
  field: CellFieldState
  textDraft: CellTextDraft
  focus: CellFocusState
  overlays: CellOverlayState
  commit: CellCommitHandlers
}
```

These groups are the contract:

- `CellIdentity`: `docId`, `fieldPath`.
- `CellFieldState`: `schema`, `fieldMetadata`, `value`, `effectiveValue`,
  `isEditable`.
- `CellTextDraft`: `committedTextValue`, `activeTextValue`, `draftTextValue`,
  `setDraftTextValue`.
- `CellFocusState`: `focusedField`, `setFocusedField`, `setIsInputFocused`.
- `CellOverlayState`: select/date/object-array open state.
- `CellCommitHandlers`: `onCommit`.

Do not replace this with context unless prop threading becomes a measured product
problem. Explicit grouped props keep editor ownership visible.

## Entropy Standard

High-entropy code means every line carries domain information.

Prefer:

- `materializedFieldPath` over `path`.
- `fieldMetadata` over `metadata`.
- `projectedCell` over `cell`.
- `formatValueForCommit` over `formatValue`.
- `buildDocumentDataPatch` over inline object mutation.
- a small pure function with a domain name over repeated conditional branches.

Reject:

- names that describe implementation shape but not domain meaning.
- wrappers that only forward props.
- one-off adapters for deleted abstractions.
- helper files whose names do not predict their contents.
- comments that explain what the syntax already says.

## Test Architecture

### Model Tests

Must cover:

- `$defs` refs.
- legacy `definitions` refs.
- nested refs.
- circular refs.
- nullable unions via `type`, `anyOf`, `oneOf`, `allOf`.
- arrays of scalars.
- arrays of objects.
- arrays of arrays.
- empty arrays with add-row projection.
- read-only projection with no add rows.
- missing schema paths.
- sparse array writes.
- root replacement.
- immutable object/array writes.
- fold/unfold changing visible leaf paths.
- date, date-time, and time display formatting.
- scalar and nested commit normalization.

### Controller Tests

Must cover:

- cell no-op commit.
- cell optimistic update.
- disabled/read-only commit no-op.
- header fold/unfold.
- drag cleanup.
- valid drag reorder.
- invalid drag no-op.

### Render And Interaction Tests

Must cover:

- editor dispatch for every `FieldKind`.
- object/array trigger rendering.
- header delete callback behavior.
- header menu close behavior after delete.

Add broader rendered reorder or remount-survival tests only when they can assert
visible behavior or callback payloads without binding to private DOM structure.

### Test Harness

- `tests/json-table-test-dom.ts` is the only place that installs jsdom globals.
- `tests/json-table-editor-test-utils.tsx` is the editor render harness.
- Tests should assert visible text, roles, input values, and callback payloads.
- Tests should not assert private CSS sequencing, component names, or Radix
  internals.

## File Size Budgets

Budgets are not aesthetic. They prevent hidden ownership creep.

- `data-cell.tsx`: under 200 lines.
- `header-cell.tsx`: under 160 lines.
- `use-cell-controller.ts`: under 100 lines.
- `use-header-controller.ts`: under 160 lines.
- each editor file: under 140 lines, except `enum-editor.tsx` may be under 160.
- each pure model file: under 180 lines, except `schema-header-nodes.ts` may be
  under 220.
- each focused test file: under 240 lines.

If a file exceeds budget, either split a real owner or explain why the budget is
wrong.

## Regression Gates

Run before declaring the component structurally complete:

```bash
bun test tests/json-table-model.test.ts tests/json-table-controller.test.tsx tests/json-table-render.test.tsx tests/json-table-header-menu.test.tsx
bunx eslint components/json-table tests/json-table-model.test.ts tests/json-table-controller.test.tsx tests/json-table-render.test.tsx tests/json-table-header-menu.test.tsx tests/json-table-editor-test-utils.tsx tests/json-table-test-dom.ts --max-warnings=0
bun run typecheck 2>&1 | rg "components/json-table|tests/json-table"
rg "row\\.original|PathInfo|assignObjectKey|buildCellPathRows|header-from-schema|@tanstack/react-table|\\bany\\b" components/json-table tests/json-table*.test.* -g '!*.md'
rg "schema-inspection|json-schema-utils|date-utils|actualKey|keyValue|openPopover|setOpenPopover|cleanStringValue|liveStringValue|stringValue|value-formatting" components/json-table tests/json-table*.test.* -g '!*.md'
rg "from \\\"react\\\"|from 'react'|@/components/ui|ui-retab|\\bwindow\\.|globalThis|HTMLElement|DocumentFragment|MutationObserver" components/json-table/lib/schema-*.ts components/json-table/lib/document-*.ts components/json-table/lib/value-*.ts components/json-table/lib/date-*.ts components/json-table/lib/header-drag-model.ts
wc -l components/json-table/data-cell.tsx components/json-table/header-cell.tsx components/json-table/use-cell-controller.ts components/json-table/use-header-controller.ts components/json-table/use-elevated-virtual-row.ts components/json-table/cell-editors/*.tsx components/json-table/cell-editors/*.ts components/json-table/lib/schema-*.ts components/json-table/lib/document-*.ts components/json-table/lib/date-*.ts components/json-table/lib/value-normalization.ts tests/json-table-model.test.ts tests/json-table-controller.test.tsx tests/json-table-render.test.tsx tests/json-table-header-menu.test.tsx
```

Expected:

- tests pass.
- lint passes.
- scoped typecheck scan prints no output.
- legacy scans print no output.
- pure model import scan prints no UI/React/DOM imports.
- file sizes stay inside budget.

## Done Means

The component is structurally complete when:

- stale blueprints are gone.
- compatibility catch-all utilities are gone.
- value model files each own one concept.
- test DOM setup is centralized.
- names obey the naming standard.
- editor props are grouped by concept, not passed as a flat bag.
- high-value interaction tests cover user-visible behavior or callback payloads.
- compatibility artifacts and old names are absent.
- every regression gate is green.
- a new engineer can understand the table by reading the file list and type names
  without knowing anything about the previous implementation.

## Change Protocol

Future changes must start by naming the owner they affect.

Use this checklist:

1. Identify whether the change is schema, document, value, cell UI, header UI,
   controller, or test harness work.
2. Edit the owning module first.
3. Add or update the narrowest focused test.
4. Run the regression gates.
5. If a new file is needed, add it to the module map and delete or shrink the
   module that used to own that responsibility.
6. If a forbidden name becomes tempting, stop and name the domain concept instead.

The blueprint is not a museum. It is a pressure system: any future code that does
not fit here should either improve the blueprint or be rejected.
