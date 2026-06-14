# DataCell JSON Table Final State Model Blueprint

## Verdict

Not yet platonic.

The latest contract pass removed the most visible architectural impurity:
primitive and structured cells no longer expose two upward commit APIs. Both now
emit one `JsonTableCellCommit`, and the document model is the only place that
turns cell commits into parent document patches.

That is the right direction. The remaining gap is sharper:

- the state model is correct, but still takes effort to prove
- the commit visibility field is now semantic, but still needs to stay defended
- test spies still use old document-change vocabulary
- architecture tests prove absence of the old split, but not the whole state
  algebra
- performance is verified by scripts, but no permanent budget defends the select
  open path

The next pass should make the component feel inevitable. A reader should be able
to answer one question without tracing seven files:

> Which state owns the visible value at this exact moment?

## One-Sentence Target

Make JSON table editing a small, explicit state algebra: one cell commit,
one projection owner, one document patch owner, one primitive echo rule, and no
legacy vocabulary in production code or test harnesses.

## Current Shape

The current source-level shape is good:

```txt
DataCell control
  -> primitive or structured controller
  -> JsonTableCellCommit
  -> SingleFileFormRow
  -> SingleFileVirtualizedTable
  -> useSingleFileTableDocumentModel
  -> onUpdateDocument({ data })
```

Primitive values additionally pass through `JsonTablePrimitiveEditStore` before
the parent echo arrives:

```txt
primitive controller
  -> primitiveEditStore.commitValue(...)
  -> JsonTableCellCommit
  -> document model marks parent patch data as primitive echo
  -> parent sends source document back
  -> primitive edit store confirms echo
```

Structured values use local document projection instead:

```txt
structured controller
  -> local structured commit state
  -> JsonTableCellCommit
  -> document model patches confirmed data
  -> parent sends source document back
```

The split is now internal and explicit. The remaining work is to make the split
read like data, not ceremony.

## Non-Goals

- Do not reintroduce `onDocumentDataChange`.
- Do not reintroduce `onPrimitiveCommit`.
- Do not add a compatibility adapter or dual callback path.
- Do not move parent patching back into rows, cells, or controllers.
- Do not add a global event bus.
- Do not add timers to hide commit or echo ordering.
- Do not weaken accessibility to win perf numbers.
- Do not rewrite virtualization.

## Principle 1. Name The State Algebra

### Problem

The final `JsonTableCellCommit` includes:

```ts
visibility: "projectedDocumentValue" | "primitivePendingValue"
```

This is the chosen state word: it names which local owner keeps the committed
value visible before the parent document echo is reconciled.

### Target

Keep `visibility` as the one commit lifecycle field.

Candidate shape:

```ts
type JsonTableCellCommit = {
  fieldPath: string
  value: unknown
  previousValue: unknown
  visibility: JsonTableCommitVisibility
}

type JsonTableCommitVisibility =
  | "primitivePendingValue"
  | "projectedDocumentValue"
```

The naming should keep this sentence exact:

> Until the parent echo arrives, this commit is visible through X.

### Plan

1. Write the state algebra in `json-table-cell-commit.ts` next to the type.
2. Use that one word everywhere.
3. Keep the field mechanically consistent across:
   - primitive controller
   - structured controller
   - document model
   - tests
   - architecture docs
4. Delete any alias for the old field name.
5. Add an architecture test that fails if the old field name returns.

### Success Criteria

- `JsonTableCellCommit` reads as semantic state, not storage plumbing.
- The field name answers what owns the visible value before the parent echo.
- No source or test file contains the retired implementation-shaped field name.
- Architecture docs use the same word as runtime code.

## Principle 2. One Owner For Visible Value Resolution

### Problem

Value visibility is split across three places:

- primitive controller asks the edit store for a pending/confirmed/stale value
- structured controller keeps a local structured commit
- document model decides which source document identity is projected

This is reasonable, but the rule is implicit. A new reader has to infer the
priority order.

### Target

Make the visible value priority explicit:

```txt
primitive pending value
  > structured local value
  > projected document value
  > source document value
```

Then encode where each state is allowed to exist:

- primitive pending value: only `JsonTablePrimitiveEditStore`
- structured local value: only `useJsonTableStructuredCellController`
- projected document value: only `useSingleFileTableDocumentModel`
- source document value: only parent props

### Plan

1. Add a short state table to `ARCHITECTURE.md`.
2. Add architecture tests:
   - primitive controller may import/use `JsonTablePrimitiveEditStore`
   - structured controller may not import/use `JsonTablePrimitiveEditStore`
   - rows and virtualized table may not call document patch helpers
   - only document model may call `setValueAtMaterializedPath`
   - only document model may call `recordDocumentEcho`
3. Add behavior tests:
   - primitive pending value wins over stale projected prop until reconciliation
   - structured local value shows immediately after structured commit
   - authoritative parent replacement updates projected document
   - primitive echo confirms without replacing projected document identity
4. Keep these as small tests against the current hooks where possible.

### Success Criteria

- A single table in docs explains every visible value source.
- Architecture tests forbid value-resolution logic from spreading.
- Behavior tests prove the priority order.

## Principle 3. Compress The Document Model

### Problem

`useSingleFileTableDocumentModel` owns the right concepts:

- primitive edit store lifetime
- source document id reset
- projected document preservation
- confirmed document data ref
- parent patch emission
- primitive echo marking
- source document reconciliation

The hook is coherent, but dense. It is still possible to read it as a sequence
of refs instead of as a state machine.

### Target

Make the document model read as four named transitions:

```txt
source document changed to a new id
source document echoed a primitive commit
source document changed authoritatively
cell committed a value
```

Each transition should be one named function.

### Plan

1. Extract private functions inside the hook module:
   - `resetForSourceDocument`
   - `reconcileSourceDocument`
   - `commitCellValue`
   - `projectionDocumentForRender`
2. Keep them local to the module unless tests truly need exports.
3. Use exact state names:
   - `sourceDocument`
   - `projectionDocument`
   - `confirmedDocumentData`
   - `primitiveEditStore`
4. Remove generic names like `current`, `next`, or `data` where they hide a
   state transition.
5. Add comments only above the transition functions, not inside obvious lines.

### Success Criteria

- The hook body is mostly orchestration.
- Each transition has a precise name.
- No behavior changes.
- Typecheck and existing JSON table tests remain green.

## Principle 4. Eliminate Legacy Test Vocabulary

### Problem

Production code no longer exposes `onDocumentDataChange`, but several tests
still use that name for spies. That was useful during migration, but it now
preserves old vocabulary in the reader's head.

### Target

Tests should say what the runtime says:

- `onCellCommit` for cell-level assertions
- `onUpdateDocument` for parent document patch assertions
- `documentPatchSpy` only when asserting `{ data }` payloads

### Plan

1. Rename test spies:
   - `onDocumentDataChange` -> `onCellCommit` when asserting cell emission
   - `onDocumentDataChange` -> `onUpdateDocument` when asserting parent patching
   - `view.onDocumentDataChange` -> `view.onCellCommit` or `view.onUpdateDocument`
2. Update shared test helpers:
   - `TestDocumentDataChange` should disappear
   - helpers should accept `onCellCommit` or `onUpdateDocument`
3. Keep assertion payloads at the right layer:
   - cell harnesses assert `JsonTableCellCommit`
   - virtualized/table harnesses assert `{ data }`
4. Add an architecture test or grep assertion that test helpers do not define
   old callback type names.

### Success Criteria

- No JSON table test helper defines `TestDocumentDataChange`.
- No JSON table test harness prop is named `onDocumentDataChange`.
- Tests are clearer because each spy name matches the layer under test.

## Principle 5. Add A Permanent Select Performance Budget

### Problem

The original user pain was select latency. Profiling showed React rerendering
was not the main bottleneck after the primitive-boundary work, but the project
still lacks a hard budget that prevents regressions.

### Target

Make select-open latency a tracked invariant.

The budget should cover both:

- React work: row/cell/table render counts
- browser work: elapsed open time and, when available, style/layout duration

### Plan

1. Extend `profile:json-table-primitives` to produce a compact budget summary:
   - `open-enum` elapsed time
   - `open-enum` React commits
   - `open-enum` rendered component count
   - `open-enum` table/row render count
   - large-table equivalent
2. Add a checked JSON budget file, for example:

   ```txt
   components/json-table/json-table-performance-budget.json
   ```

3. Add a verifier command:

   ```txt
   pnpm verify:json-table-performance
   ```

4. Keep the first budget generous enough for CI variance.
5. Fail only on regressions that matter:
   - table rerenders during select open
   - row fanout beyond target row/cell
   - elapsed time above budget by a clear tolerance
6. Include a documented way to intentionally update the budget after profiling.

### Success Criteria

- Select open has a checked budget.
- The budget fails if whole-table rerendering returns.
- The budget report is small enough to read in CI output.
- The profiler artifact remains useful for deep diagnosis.

## Principle 6. Keep The Module Graph Exact

### Problem

The current modularization is strong but still has a few possible drift points:

- document model could absorb projection/schema work
- virtualized table could regain commit persistence
- row could regain document patching
- cell model could learn too much about document state
- tests could reintroduce compatibility-shaped helpers

### Target

Make ownership impossible to accidentally blur.

### Desired Module Map

```txt
single-file-table-view
  public adapter only

use-single-file-table-document-model
  source document, projection document, primitive echo, parent patches

single-file-table-runtime
  combines document model, schema model, projection model, profiler shell

use-single-file-table-schema-model
  headers, visible keys, visible columns, schema-local state

use-single-file-table-projection-model
  projected rows, structural sharing, row count

single-file-virtualized-table
  viewport, active cell identity, row rendering

single-file-form-row
  row shell, cell prop construction

editable-json-table-cell
  table cell router

primitive/structured controllers
  local visible value and commit emission
```

### Plan

1. Expand `json-table-architecture.test.ts` with module-boundary assertions.
2. Use positive and negative assertions:
   - view imports document model and runtime
   - view does not import projection/schema/edit-store internals
   - runtime imports schema/projection model and virtualized table
   - virtualized table does not import document patch helpers
   - row does not import document patch helpers
   - controllers do not import parent update helpers
3. Keep assertions simple string checks so they are cheap and obvious.

### Success Criteria

- Boundary drift is caught by tests.
- The module graph can be drawn from the architecture test.
- No broad abstraction is added to enforce what simple imports can enforce.

## Implementation Order

1. Rename the commit field from implementation ownership to semantic state.
2. Update runtime code and architecture docs to the new state vocabulary.
3. Rename JSON table test spies and helpers away from legacy document-change
   vocabulary.
4. Compress `useSingleFileTableDocumentModel` into named transitions.
5. Add visible-value priority tests.
6. Add module-boundary tests.
7. Add the select performance budget verifier.
8. Run the focused and hardening suites.

## Verification Gates

Required:

```txt
pnpm typecheck
pnpm test tests/json-table-controller.test.tsx tests/json-table-session-interactions.test.tsx tests/json-table-row-render.test.tsx tests/json-table-boolean-enum-interactions.test.tsx tests/json-table-text-number-interactions.test.tsx
pnpm test tests/json-table-boolean-enum-interactions.test.tsx tests/json-table-session-virtualization-hardening.test.tsx tests/json-table-session-interactions.test.tsx tests/json-table-architecture.test.ts tests/json-table-picker-interactions.test.tsx tests/json-table-primitive-edit-store.test.ts tests/json-table-projected-row-sharing.test.ts tests/json-table-controller.test.tsx tests/json-table-row-render.test.tsx tests/json-table-text-number-interactions.test.tsx
pnpm test tests/json-table-text-number-hardening.test.tsx tests/json-table-value-normalization-hardening.test.tsx tests/json-table-session-race-interactions.test.tsx tests/json-table-picker-overlay-hardening.test.tsx tests/json-table-virtualization-stress-hardening.test.tsx
pnpm verify:data-cell-registry
```

New gate after the performance-budget work:

```txt
pnpm verify:json-table-performance
```

## Completion Criteria

This blueprint is complete only when all of these are true:

- `JsonTableCellCommit` has one semantic field for local visibility/echo policy.
- No runtime or JSON table test helper uses old two-path vocabulary.
- The document model reads as named state transitions.
- Architecture docs define the visible-value priority order.
- Architecture tests enforce the module graph.
- Select-open performance has a checked budget.
- Existing focused, broad, and hardening JSON table suites pass.
- Full typecheck passes.

## Final Standard

The final component should be explainable in one paragraph:

> A cell commit is a value plus the local state that makes it visible before the
> parent echo. Primitive commits are visible through the primitive edit store;
> structured commits are visible through projected document state. The document
> model alone patches parent data, marks primitive echoes, reconciles source
> documents, and chooses the projection document. Rows and cells never patch
> documents; they only emit `JsonTableCellCommit`.

If the code says exactly that, with no extra paths, it will be close to the
platonic ideal.
