# DataCell JSON Table Current Platonic Gap Blueprint

## Verdict

Platonic for the scope of this blueprint.

The JSON table now has the ownership cuts, diagnostics, fresh browser proof,
and targeted repeated large-profile proof this blueprint required. Perfection
is always conditional on continued evidence, but the current implementation
meets the acceptance bar defined here.

Current proof:

- `pnpm test:json-table` passes: 27 files, 328 tests.
- `pnpm verify:json-table-performance` passes: 25 saved scenarios.
- `pnpm typecheck` passes.
- `node --check` passes for the JSON-table profiler, performance verifier, and
  accessibility verifier scripts.
- Saved performance budgets prove current checked-in profiler output, including
  read-only row patch attribution and inert style probe scenarios.
- `PROFILE_SERVER_MODE=existing JSON_TABLE_PROFILE_WARMUP=1 pnpm verify:json-table-performance:fresh`
  passes: 25 fresh browser scenarios.
- `PROFILE_SERVER_MODE=existing pnpm verify:json-table-accessibility:fresh`
  passes.
- `PROFILE_SERVER_MODE=existing JSON_TABLE_PROFILE_WARMUP=1 JSON_TABLE_PROFILE_REPEAT=3 JSON_TABLE_PROFILE_TARGETS=large JSON_TABLE_PROFILE_SCENARIOS=open-enum,open-date,switch-dirty-cell,open-far-enum,open-far-date,commit-far-text pnpm verify:json-table-performance:fresh`
  passes: 6 targeted repeated large-profile scenarios.

## Implementation Status

Implemented source changes:

- Gap 1: `SingleFileVirtualizedTable` now composes row policy and viewport
  model hooks instead of owning the read-only row patcher and raw fixed-grid
  virtualizer output directly.
- Gap 2: read-only row patching is isolated behind `useJsonTableRowPolicy`, and
  the saved performance budget includes `read-only-scroll-jump` with handled,
  fallback, reason, and rows-patched attribution.
- Gap 3: saved and fresh verifiers are wired for the canonical gate. Fresh proof
  remains blocked only by the unavailable profile route.
- Gap 4: inert popup shell scenarios and profiler-only style class experiments
  exist for empty portal, select shell, picker shell, row hover, active-cell
  overlay, focus-visible ring, and portal shadow/animation costs.
- Gap 5: architecture guards keep the two approved `flushSync` boundaries and
  reject timeout-based primitive input opening policy.
- Gap 6: the document model has a transition-table comment plus focused tests
  for primitive echo reconciliation, authoritative parent replacement, new
  source reset, missing updater, structured commits, and rejected update
  promises.
- Gap 7: the architecture guard now checks responsibility-specific module
  contracts instead of raw line-count limits, so it protects ownership without
  encouraging meaningless extraction.

Still unproven:

- Nothing in this blueprint remains unproven against the current source tree.

## Definition Of Done

The component reaches the platonic ideal only when all of this is true:

- The runtime dataflow can be explained in one pass without historical context.
- Primitive interactions are target-scoped in React and bounded in browser
  style/layout work.
- Structured object and array editing, horizontal virtualization, keyboard
  flows, focus return, stale echoes, and accessibility all have executable
  proof.
- There are no compatibility paths, hidden fallback state machines, or broad
  abstractions that exist only to hide awkward ownership.
- Every module owns one coherent concept.
- Every exported type and variable name maps to exactly one concept.
- The canonical fresh gate can be run once and trusted.

## Current Shape

The core flow is good:

```txt
sourceDocument
  -> useSingleFileTableDocumentModel
  -> projectionDocument
  -> SingleFileTableRuntime
  -> useSingleFileTableProjectionModel
  -> SingleFileVirtualizedTable
  -> SingleFileFormRow
  -> EditableJsonTableCell / ReadOnlyJsonTableCell
  -> DataCell primitive control or structured editor
  -> JsonTableCellCommit
  -> useSingleFileTableDocumentModel
  -> onUpdateDocument({ data })
  -> parent sourceDocument echo
```

The important ownership cuts are already in place:

- `useSingleFileTableDocumentModel` owns document lifecycle, projection
  identity, confirmed data, primitive echo recording, and patch emission.
- `useJsonTableEditSessionCoordinator` owns primitive active identity and
  structured edit-session lifecycle.
- `useJsonTableRenderedColumnWindow` owns the editable/read-only column-window
  strategy.
- `SingleFileFormRow` renders a row and builds grouped cell props.
- `EditableJsonTableCell` is a router, not a controller.
- `DataCell` owns primitive display and primitive controls.
- `JsonTablePrimitiveEditStore` owns primitive pending, confirmed, and stale
  local values.

This is a serious architecture. It is not yet the final form.

## Gap 1. `SingleFileVirtualizedTable` Is Still The Gravity Center

Current responsibilities:

- table shell layout
- split header/body rendering
- header scroll synchronization
- row virtualization
- column virtualization
- read-only row patching integration
- row key policy
- edit-session API consumption
- profiler marks
- row prop wiring

This file has shed state machines, but it still coordinates too many pressure
points. New performance or interaction work will naturally land here unless the
remaining boundaries are named more sharply.

### Target

`SingleFileVirtualizedTable` should read as composition:

1. Resolve table options.
2. Resolve viewport model.
3. Resolve row policy.
4. Render header and body.

### Plan

1. Extract a small viewport model hook:

   ```ts
   useJsonTableViewportModel({
     isJsonEditable,
     rowCount,
     rowHeightPx,
     columnWidth,
     schemaVisibleColumns,
     rowScrollStrategy,
     scrollRef,
     scrollElement,
     overscan,
     jumpOverscan,
   })
   ```

   It returns `virtualRows`, `totalRowSize`, `renderedColumnWindow`, and
   `totalWidth`.

2. Extract read-only row policy integration:

   ```ts
   useJsonTableRowPolicy({
     isJsonEditable,
     projectedRows,
     rowHeightPx,
     rowWindowRef,
     schemaVisibleColumns,
   })
   ```

   It returns `rowScrollStrategy` and `invalidateRows`.

3. Keep header scroll sync inline unless it grows beyond the current callback.

4. Keep rendering in `SingleFileVirtualizedTable`; do not create wrapper
   components just to reduce line count.

### Acceptance

- `SingleFileVirtualizedTable` no longer imports
  `useReadOnlyJsonRowPatcher` directly.
- `SingleFileVirtualizedTable` no longer destructures raw fixed-grid
  virtualizer output.
- Row policy has focused tests for editable and read-only behavior.
- Existing render and performance budgets do not regress.

## Gap 2. Read-Only DOM Patching Is Fast But Conceptually Expensive

Read-only mode uses an imperative DOM patcher while editable mode uses React
rows. This is a deliberate performance split, but it violates the ideal unless
the policy remains narrow, measured, and visibly separate.

### Target

Read-only DOM patching is either:

- proven necessary and isolated as a named row policy, or
- replaced by a simpler React path that meets scroll performance budgets.

### Plan

1. Add read-only scroll performance to the canonical saved budget if it is not
   already strong enough to detect a patcher fallback.
2. Add profiler output for patch attempts:
   - handled count
   - fallback count
   - fallback reason
   - rows patched
3. Move row-patcher setup behind `useJsonTableRowPolicy`.
4. Keep the patcher forbidden from editable mode.

### Acceptance

- A read-only scroll regression fails with a reason, not only a slow number.
- Editable mode cannot accidentally inherit DOM patching.
- The row patcher remains scalar/boolean-only unless object/array patching has
  a real benchmark and tests.

## Gap 3. Fresh Proof Is Still Weaker Than Saved Proof

Saved performance verification is valuable, but saved reports can pass after the
implementation or browser has drifted. Fresh proof is the certificate.

### Target

One command gives a maintainer trustworthy JSON-table acceptance:

```sh
pnpm verify:json-table
```

The command should validate tests, saved budgets, fresh browser performance,
and browser accessibility.

### Plan

1. Keep saved budget verification as regression screening.
2. Run fresh performance only against a healthy profile route or managed server.
3. When using a manually running server, prefer:

   ```sh
   PROFILE_SERVER_MODE=existing \
   JSON_TABLE_PROFILE_WARMUP=1 \
   pnpm verify:json-table-performance:fresh
   ```

4. For final acceptance, run repeated fresh proof on a quiet server:

   ```sh
   PROFILE_SERVER_MODE=existing \
   JSON_TABLE_PROFILE_WARMUP=1 \
   JSON_TABLE_PROFILE_REPEAT=3 \
   JSON_TABLE_PROFILE_TARGETS=large \
   JSON_TABLE_PROFILE_SCENARIOS=open-enum,open-date,switch-dirty-cell,open-far-enum,open-far-date,commit-far-text \
   pnpm verify:json-table-performance:fresh
   ```

5. Treat single-run fresh budgets as fast feedback.
6. Use repeated p90 for style/latency decisions.
7. Use worst-run values for structural invariants:
   - React render fanout
   - document patch count
   - rect reads
   - mounted surface counts

### Acceptance

- Fresh profile route compiles from the current source tree.
- Large-profile `open-enum`, `open-date`, `switch-dirty-cell`,
  `open-far-enum`, `open-far-date`, and `commit-far-text` remain below the
  agreed style budget.
- Failures print route, scenario, likely owner, mounted surface, and changed
  metric.

## Gap 4. Style Attribution Is Useful But Not Exact

Current profiling proves the original React fanout problem is not the dominant
cost. Remaining large-profile interaction time is browser style/layout work,
with coarse attribution to header, body, popup, or global surface.

### Target

A style regression points to the smallest actionable owner:

- popup mount
- calendar DOM
- select option DOM
- header surface
- body surface
- focus/active selector
- global document selector

### Plan

1. Add inert popup scenarios:
   - open empty portal shell
   - open select shell without options
   - open date shell without calendar
2. Compare inert shell cost to real select/date popup cost.
3. Add class-toggle experiments behind profiler flags:
   - disable row hover class
   - disable active-cell overlay class
   - disable focus-visible ring class
   - disable portal subtree animation class
4. Preserve accessibility and interaction semantics in every experiment.
5. Only change production CSS when an experiment gives a clear win.

### Acceptance

- Remaining style cost is attributed to a concrete mounted surface or selector
  family.
- A proposed CSS/DOM change includes before/after profiler numbers.
- No accessibility verifier regression.

## Gap 5. `DataCell` Activation Is Correct But Heavy

DataCell activation handles pointer, click, keyboard, command actions,
modifier keys, activation source, click-tail suppression, opening-context
consumption, and controlled/uncontrolled active state.

This complexity is centralized and tested, but it is not simple.

### Target

Activation remains one small state machine with one vocabulary:

- `display`
- `command`
- `edit activation`
- `activation source`
- `opening context`
- `dismiss cause`

### Plan

1. Keep the two `flushSync` boundaries tiny and named:
   - primitive active-cell replacement
   - DataCell activation-source storage
2. Add or keep tests that fail without each synchronous boundary.
3. Prevent select and picker controls from reimplementing activation policy.
4. Do not add timers to solve opening/dismissal races.

### Acceptance

- Only the two approved `flushSync` sites exist.
- Each `flushSync` site has a race-specific comment and test.
- Select and picker files contain no timeout-based opening policy.

## Gap 6. Document Model Is Correct But Dense

`useSingleFileTableDocumentModel` is compact and tested, but it asks the reader
to understand several timing rules at once:

- projection document is React state
- confirmed data is a ref
- source reconciliation runs in a layout effect
- primitive commits record echo signatures before patch emission
- structured commits rely on structured local visibility
- update promise rejection does not roll back local state

### Target

The document boundary should read as a transition table plus small operations.

### Plan

1. Keep the transition table comment.
2. Split pure transition helpers from React wiring only if it improves tests or
   reader comprehension.
3. Name the promise rejection policy as optimistic fire-and-forget persistence.
4. Add no retry or rollback path unless product behavior requires it.

### Acceptance

- Every transition has a focused test.
- No document mutation happens outside the document model and patch helper.
- No primitive echo recognition performs full-document serialization.

## Gap 7. Architecture Proof Is Still Partly Textual

The architecture tests are valuable, but some checks are still string-pattern
guards. They protect hard cutovers, but they can also freeze incidental wording.

### Target

Architecture tests protect behavior and ownership, not prose.

### Plan

1. Keep string checks for:
   - deleted files
   - banned compatibility vocabulary
   - allowed `flushSync` sites
   - canonical command names
2. Prefer semantic checks for:
   - import graph boundaries
   - public barrel boundaries
   - generated artifact contents
   - performance budget shape
3. Delete stale historical assertions after each completed cut.

### Acceptance

- Every forbidden pattern has a current reason.
- Architecture tests cannot pass merely because stale words remain in comments.
- Line-count limits do not encourage meaningless extraction.

## Work Order

1. Run the full current gate on a healthy existing profile server.
2. Extract row policy behind `useJsonTableRowPolicy`.
3. Extract viewport model behind `useJsonTableViewportModel`.
4. Add inert popup and selector experiment profiler scenarios.
5. Tighten attribution and fresh-failure summaries.
6. Re-run:

   ```sh
   pnpm test:json-table
   pnpm verify:json-table-performance
   PROFILE_SERVER_MODE=existing JSON_TABLE_PROFILE_WARMUP=1 pnpm verify:json-table-performance:fresh
   PROFILE_SERVER_MODE=existing pnpm verify:json-table-accessibility:fresh
   PROFILE_SERVER_MODE=existing JSON_TABLE_PROFILE_WARMUP=1 JSON_TABLE_PROFILE_REPEAT=3 JSON_TABLE_PROFILE_TARGETS=large JSON_TABLE_PROFILE_SCENARIOS=open-enum,open-date,switch-dirty-cell,open-far-enum,open-far-date,commit-far-text pnpm verify:json-table-performance:fresh
   pnpm typecheck
   ```

## Final Acceptance

The JSON table can be called platonic only after this final evidence exists:

- All focused tests pass.
- TypeScript passes.
- Saved performance budgets pass.
- Fresh performance budgets pass against the current source tree.
- Fresh browser accessibility verification passes.
- Repeated large-profile proof confirms p90 style/latency budgets.
  The repeated gate targets the large editable scenarios named in Gap 3:
  `open-enum`, `open-date`, `switch-dirty-cell`, `open-far-enum`,
  `open-far-date`, and `commit-far-text`.
- `SingleFileVirtualizedTable` reads as composition, not as a state-machine
  sink.
- Read-only row patching is either isolated and measured or removed.
- Activation remains centralized with no timer fallback.
- The current architecture document and current blueprint agree.
