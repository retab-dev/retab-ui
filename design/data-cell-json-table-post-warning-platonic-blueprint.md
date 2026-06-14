# DataCell JSON Table Post-Warning Platonic Blueprint

## Verdict

Not yet platonic.

The component is now strong enough that the remaining flaws are narrow and
visible. The latest React warning proved the next standard: correctness is not
only "does the table avoid whole-table rerenders?" It is also "can a reader
prove that render is pure, persistence is outside render, and every external
store notification happens in an event or effect?"

This blueprint targets the remaining gap between excellent and inevitable:

- render-phase purity must be guarded, not trusted
- document input, projected document, and parent echo vocabulary must be exact
- persistence must have one name and one contract
- overlay performance must have a browser-cost budget, not just profiler notes
- `SingleFileTableView` must stop being a dense orchestration knot
- tests must prove architecture, not merely behavior

The final implementation should be smaller to read than the current one. Any
solution that adds a second state machine, compatibility adapter, generic event
bus, feature flag, or timer-based workaround fails this blueprint.

## Current State

What is already good:

- primitive commits are locally scoped through `JsonTablePrimitiveEditStore`
- `SingleFileVirtualizedTable` is echo-blind
- primitive and structured commit controllers are separated
- projected row sharing is pure and directly tested
- parent callback churn no longer rerenders the table
- the recent render-phase reconciliation bug has been moved into a layout effect

What still prevents the platonic ideal:

- `SingleFileTableView` still owns store lifetime, persistence, document echo
  reconciliation, projected document preservation, stable callbacks, and render
  handoff
- `useJsonTablePrimitivePersistenceBridge` is named too narrowly and vaguely:
  it handles both primitive commits and structured value changes
- the state vocabulary still forces readers to infer the difference between
  input document, projected document, render document, pending primitive value,
  confirmed primitive echo, and authoritative parent replacement
- the profiler proves React rerenders are mostly solved, but overlay style cost
  is not yet budgeted or explained by an inert baseline
- architecture tests forbid many legacy names, but they do not yet forbid
  render-phase store notification paths
- same-props target-cell renders are still not fully attributed

## Final Shape

```txt
SingleFileTableView
  -> stable parent callbacks
  -> primitive edit store owner
  -> useJsonTableDocumentPersistence
  -> useJsonTableProjectedDocument
  -> SingleFileTableProjectionView
  -> SingleFileVirtualizedTable
  -> EditableJsonTableCell
  -> DataCell
```

Each layer has one reason to exist:

- `SingleFileTableView`: compose owners and render the table projection
- `useJsonTableDocumentPersistence`: materialize table commits into parent
  document updates and mark primitive echoes
- `useJsonTableProjectedDocument`: decide which document identity should be
  rendered after parent input changes
- `SingleFileTableProjectionView`: schema/header/projection/virtualization
  preparation
- `SingleFileVirtualizedTable`: viewport, active cell identity, row rendering
- `EditableJsonTableCell`: table-to-DataCell model and controller composition
- `DataCell`: primitive display, native control behavior, local draft/open state

## Non-Goals

- Do not rewrite virtualization.
- Do not replace the DataCell primitive system.
- Do not add compatibility shims or legacy adapters.
- Do not debounce, delay, or batch commits with timers.
- Do not broaden public props.
- Do not weaken accessibility to reduce style/layout work.
- Do not touch unrelated dirty worktree files as part of this blueprint.

## Principle 1. Render Is A Pure Function

### Problem

The warning came from this shape:

```txt
SingleFileTableView render
  -> reconcileDocumentData
  -> primitive edit-store notify
  -> EditableJsonTableCell subscriber update
```

That specific path is fixed, but the architecture should make this class of bug
hard to reintroduce.

### Target

No component render path may call a function that can notify an external store,
write parent document state, reset primitive edit entries, or reconcile parent
echoes.

Allowed mutation zones:

- user event handlers
- React effects
- explicit store methods called from tested hooks inside effects
- test setup

Disallowed mutation zones:

- component function body
- `useMemo`
- prop comparator
- render helper called from JSX
- projection function

### Plan

1. Add an architecture test for render-phase mutation vocabulary:
   - forbid `reconcileDocumentData(` in component bodies except inside the
     dedicated projected-document hook
   - forbid `primitiveEditStore.reset(` outside effects, event handlers, and
     tests
   - forbid `recordDocumentEcho(` outside document persistence
   - forbid `notify(` exports or callbacks outside the edit-store module
2. Move all document input reconciliation into one hook:

   ```ts
   useJsonTableProjectedDocument({
     inputDocument,
     primitiveEditStore,
     documentPersistence,
   })
   ```

3. Keep the hook internally effect-driven:
   - document id change resets primitive state
   - same-document primitive echo preserves rendered projection
   - same-document authoritative parent replacement updates projection
4. Add a regression test for the exact warning:
   - primitive edit
   - parent echo
   - no "Cannot update a component while rendering a different component"
5. Add a store-level render guard in tests if practical:
   - a test helper that throws if edit-store notifications fire while a
     sentinel render flag is active

### Success Criteria

- No production component body calls primitive echo reconciliation directly.
- The exact React warning regression test remains green.
- Render-phase mutation architecture tests fail on the old bug shape.
- The only place that decides projected document identity is
  `useJsonTableProjectedDocument`.

## Principle 2. One Document Persistence Contract

### Problem

`useJsonTablePrimitivePersistenceBridge` is doing the right work under the wrong
name. It persists primitive commits, persists structured value changes, tracks
latest document data, marks primitive document echoes, and exposes
reconciliation helpers.

The word `Bridge` hides too much. The word `Primitive` is too narrow.

### Target

Rename and compress the contract around the actual responsibility:

```ts
type JsonTableDocumentPersistence = {
  commitPrimitiveValue(commit: JsonTablePrimitiveCommit): void
  commitStructuredValue(change: JsonTableStructuredValueChange): void
  reconcileInputDocument(data: Record<string, unknown>): PrimitiveEchoResult
  resetInputDocument(data: Record<string, unknown>): void
}
```

The persistence owner knows parent document writes. Primitive and structured
controllers do not know parent patch construction. The virtualized table does
not know echo semantics.

### Plan

1. Rename:
   - `useJsonTablePrimitivePersistenceBridge` ->
     `useJsonTableDocumentPersistence`
   - `persistPrimitiveCommit` -> `commitPrimitiveValue`
   - `persistDocumentDataChange` -> `commitStructuredValue`
   - `reconcileDocumentData` -> `reconcileInputDocument`
   - `resetDocumentData` -> `resetInputDocument`
2. Introduce an explicit structured change type:

   ```ts
   type JsonTableStructuredValueChange = {
     docId: string
     fieldPath: string
     value: unknown
   }
   ```

3. Keep primitive echo marking private to document persistence.
4. Keep `setValueAtMaterializedPath` private to document persistence.
5. Update architecture docs and tests so the final commit path names match the
   code exactly.

### Success Criteria

- No production file uses `PrimitivePersistenceBridge`.
- No production file uses the vague document-persistence word `Bridge`.
- `SingleFileVirtualizedTable` still contains no `onUpdateDocument`,
  `recordDocumentEcho`, `reconcileInputDocument`, or
  `setValueAtMaterializedPath` vocabulary.
- Structured commits never enter primitive pending/confirmed/stale state.

## Principle 3. One Projected Document State Machine

### Problem

The current wrapper holds several related concepts:

- parent `document`
- `projectedDocument`
- `renderDocument`
- `previousDocumentIdRef`
- `lastInputDocumentRef`
- primitive edit-store pending/confirmed/stale entries

The behavior is correct, but the proof is still spread across inline refs and a
persistence object.

### Target

One named hook owns the state machine and exposes one value:

```ts
const projectedDocument = useJsonTableProjectedDocument({
  inputDocument,
  primitiveEditStore,
  documentPersistence,
})
```

The hook's internal vocabulary is fixed:

- `inputDocument`: latest document prop from the parent
- `renderedDocument`: document identity currently given to projection
- `lastInputDocument`: previous parent document identity inspected by the hook
- `documentId`: identity boundary that resets primitive state
- `primitiveEcho`: parent document data produced by a local primitive commit
- `authoritativeInput`: parent document data not recognized as a local echo

Do not use `current`, `previous`, `projected`, and `render` interchangeably.

### Plan

1. Extract `useJsonTableProjectedDocument`.
2. Keep the first render pure:
   - if `documentId` changes before effects run, render the new input document
     immediately
   - reconcile/reset in a layout effect
3. Add focused tests:
   - primitive echo keeps `renderedDocument` stable
   - authoritative same-id input replaces `renderedDocument`
   - new `documentId` resets primitive edit store and renders new document
   - repeated same object input does no reconciliation work
4. Add architecture tests:
   - `SingleFileTableView` contains no `previousDocumentIdRef`
   - `SingleFileTableView` contains no direct `reconcileInputDocument`
   - projected-document hook is the only production owner of that lifecycle

### Success Criteria

- `SingleFileTableView` reads as a declarative shell.
- A reader can prove echo suppression from one hook file.
- The hook tests cover every transition in the state machine.
- The render-phase warning cannot be reintroduced without failing a test.

## Principle 4. One Commit Vocabulary

### Problem

The code still has two visible callback shapes below the wrapper:

- primitive commit
- document data change

That distinction is real, but names must make the boundary exact. The table
should never invite a reader to wonder whether a primitive commit has already
entered the edit store or still needs to.

### Target

Use exact nouns:

- `JsonTablePrimitiveCommit`: already committed locally to primitive edit store
- `JsonTableStructuredValueChange`: object/array value change that bypasses
  primitive lifecycle
- `JsonTableDocumentPersistence`: parent document write owner
- `JsonTableProjectedDocument`: rendered document identity after echo policy

### Plan

1. Keep `JsonTablePrimitiveCommit` as the only primitive persistence payload.
2. Add `JsonTableStructuredValueChange` instead of passing positional
   `(docId, fieldPath, value)` arguments.
3. Rename callback props below the projection boundary:
   - `onPrimitiveCommit`
   - `onStructuredValueChange`
4. Remove generic names such as `patchDocumentData`, `onDocumentDataChange`, and
   `persistDocumentDataChange` from the primitive/structured boundary if they
   obscure ownership.
5. Update tests to assert that primitive commits call `commitValue` exactly once
   and structured commits call it zero times.

### Success Criteria

- Every commit callback name says whether it is primitive, structured, or parent
  document persistence.
- No primitive path performs document patch construction outside document
  persistence.
- No structured path touches primitive edit-store lifecycle.

## Principle 5. Browser Cost Has A Budget

### Problem

Profiler evidence says overlay interactions are dominated by browser style work,
especially in large profiles. That is a valid bottleneck, but it is not yet a
closed engineering loop.

### Target

The profiler must answer:

- how much React work happened?
- how much browser work happened?
- which browser category dominated?
- does overlay cost scale with table size?
- how much cost remains for an inert overlay?

### Plan

1. Add profiler scenarios:
   - inert overlay open
   - inert overlay close
   - enum open at top of large table
   - enum open after scrolling far into large table
   - date picker open at top of large table
   - date picker open after scrolling far into large table
2. Capture:
   - overlay subtree node count
   - table subtree node count
   - active stylesheet count
   - focused element before/after
   - style duration
   - layout duration
   - script duration
3. Set budgets in the profiler report:
   - parent callback churn: zero JSON table renders
   - scalar primitive commit: target cell render only
   - overlay open React renders: target row/cell only
   - overlay style cost: must not scale materially with table row count after
     inert baseline is subtracted
4. If style cost scales:
   - inspect selectors around table hover/focus/active state
   - tighten broad selectors to slot-local classes
   - reduce popup DOM where it is unnecessary
5. If style cost does not scale:
   - document the inert baseline as browser/control cost
   - stop chasing micro-optimizations without evidence

### Success Criteria

- Profiler output explains overlay cost without manual DevTools inspection.
- Large-table overlay cost is either reduced or proven to be constant
  browser/control baseline.
- The profiler fails on whole-table render regressions.
- The profiler fails on unexplained table-size-scaled overlay cost.

## Principle 6. Same-Props Renders Are Either Gone Or Named

### Problem

`EditableJsonTableCell.same-props` render buckets are target-scoped, but
"same-props" is not an explanation. It is a profiler blind spot.

### Target

Every target-cell render is attributed to a named local cause:

- primitive active identity change
- primitive edit snapshot version change
- control open state change
- text draft change
- focus handoff
- value confirmation
- stale value conflict

### Plan

1. Extend cell render profiling to include:
   - active-cell snapshot version
   - primitive edit snapshot version
   - local control open state
   - local draft state presence
   - commit/confirm/stale status
2. Replace `same-props` with `local-state`, `external-store`, or a more precise
   cause when possible.
3. Add profiler assertions:
   - no unexplained `same-props` bucket
   - no row/table render caused by target-cell local state
4. Remove any render that remains unexplained after attribution.

### Success Criteria

- `rg "EditableJsonTableCell.same-props" tmp/json-table-primitive-interactions-profile.json`
  returns no unexplained matches.
- Any repeated target-cell render has a named cause.
- Render counts do not increase.

## Principle 7. Module Boundaries Are Small And Enforced

### Problem

The architecture is guarded, but some key files still carry more concepts than
their ideal responsibility.

### Target Line Counts

- `single-file-table-view.tsx`: wrapper and projection shell only
- `use-json-table-document-persistence.ts`: document patching and echo marking
- `use-json-table-projected-document.ts`: input document reconciliation
- `single-file-virtualized-table.tsx`: viewport and sessions only
- `editable-json-table-cell.tsx`: pure router
- `use-json-table-primitive-cell-controller.ts`: primitive local commit only
- `use-json-table-structured-cell-controller.ts`: structured value changes only

Line count is not the goal. It is a smoke alarm. A file that grows past its
limit must justify the added responsibility.

### Plan

1. Add new architecture guards for:
   - document persistence vocabulary
   - projected document vocabulary
   - render-phase mutation vocabulary
   - callback naming vocabulary
2. Keep line-count limits for hot files and add limits for the two new hooks.
3. Update `components/json-table/ARCHITECTURE.md` after the cutover.
4. Keep generated registry changes deterministic.

### Success Criteria

- File boundaries are visible from imports alone.
- Architecture tests describe the current ideal, not old migration scars.
- The architecture doc and runtime names match exactly.

## Implementation Phases

### Phase 1. Render-Purity Guardrail

- Add architecture tests for render-phase mutation vocabulary.
- Keep the existing warning regression.
- Confirm old inline reconciliation shape would fail.

### Phase 2. Document Persistence Rename

- Rename the bridge to `useJsonTableDocumentPersistence`.
- Rename callbacks and payloads.
- Update virtualized table props and tests.
- Update architecture docs.

### Phase 3. Projected Document Hook

- Extract `useJsonTableProjectedDocument`.
- Move document id reset and echo suppression into the hook.
- Add transition tests for echo, authoritative input, document id changes, and
  repeated same-object input.

### Phase 4. Commit Vocabulary Compression

- Introduce `JsonTableStructuredValueChange`.
- Replace positional structured commit callbacks.
- Make primitive and structured commit names exact across call sites.

### Phase 5. Profiler Budget

- Add inert overlay and scrolled-large overlay scenarios.
- Capture browser-cost context.
- Add budget assertions for table renders and overlay scaling.

### Phase 6. Same-Props Attribution

- Add local/external snapshot attribution.
- Remove or rename unexplained render buckets.
- Assert no unexplained same-props renders remain.

### Phase 7. Quiet Diff And Final Audit

- Run scoped status.
- Rebuild `data-cell` registry output.
- Run correctness, architecture, registry, and profiler gates.
- Update this blueprint with measured before/after numbers if implemented.

## Verification

Correctness:

```bash
pnpm typecheck
pnpm test tests/json-table-boolean-enum-interactions.test.tsx tests/json-table-session-virtualization-hardening.test.tsx tests/json-table-session-interactions.test.tsx tests/json-table-architecture.test.ts tests/json-table-picker-interactions.test.tsx tests/json-table-primitive-edit-store.test.ts tests/json-table-projected-row-sharing.test.ts tests/json-table-controller.test.tsx tests/json-table-row-render.test.tsx tests/json-table-text-number-interactions.test.tsx
pnpm test tests/json-table-text-number-hardening.test.tsx tests/json-table-value-normalization-hardening.test.tsx tests/json-table-session-race-interactions.test.tsx tests/json-table-picker-overlay-hardening.test.tsx tests/json-table-virtualization-stress-hardening.test.tsx
pnpm verify:data-cell-registry
```

Profiler:

```bash
PROFILE_URL=http://localhost:3100/json-table-profile pnpm profile:json-table-primitives
```

Architecture searches:

```bash
rg "PrimitivePersistenceBridge|primitivePersistenceBridge|persistDocumentDataChange|persistPrimitiveCommit" components/json-table tests registry/new-york-v4/ui
rg "recordDocumentEcho|setValueAtMaterializedPath|onUpdateDocument|reconcileInputDocument" components/json-table/single-file-virtualized-table.tsx
rg "previousDocumentIdRef|lastInputDocumentRef|reconcileInputDocument" components/json-table/single-file-table-view.tsx
rg "EditableJsonTableCell.same-props" tmp/json-table-primitive-interactions-profile.json
```

The first three searches should return no production violations after the
cutover. The last search should return no unexplained profiler buckets.

## Definition Of Done

- Render-phase primitive-store notifications are impossible by architecture
  guard, not just by convention.
- `SingleFileTableView` is a small declarative owner shell.
- Document persistence has one exact name and one exact API.
- Projected document preservation has one hook and direct transition tests.
- Primitive commits and structured value changes have separate payload types.
- Overlay browser cost is budgeted and explained.
- No unexplained `EditableJsonTableCell.same-props` profiler bucket remains.
- Architecture docs, runtime names, tests, profiler output, and registry output
  agree.

## Platonic Check

The component reaches the requested ideal only when these questions have
one-line answers:

- Why did this interaction render?
- Which exact cell or table layer rendered?
- Which browser category consumed time?
- Which module owns parent document writes?
- Which module owns primitive echo marking?
- Which module owns projected document preservation?
- Which callback means primitive commit versus structured value change?
- Which names are allowed for input, rendered, echo, and authoritative document
  data?

If any answer requires tracing incidental refs across the wrapper, reading a
generic bridge, or accepting an unexplained profiler bucket, the component is
excellent but not perfect.
