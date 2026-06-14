# DataCell JSON Table Platonic Issues Blueprint

Last audited: 2026-06-14.

## Verdict

Not yet platonic.

The component is much better than the original failure mode. Opening a select is
no longer obviously causing a table-wide React rerender. Primitive state has
been pushed down into `DataCell`, pending primitive values live in
`JsonTablePrimitiveEditStore`, document echo reconciliation has moved out of the
render phase, and the editable body now has horizontal column virtualization.

That is real progress. It is not perfection.

The remaining problems are not one gross bug. They are a set of sharp edges that
still prevent the component from being simple, fast, complete, and inevitable:

- browser style recalculation remains the dominant user-visible cost
- fresh performance verification still depends on fragile local dev-server state
- header and body column rendering use different strategies
- structured editing still needs a layout-effect state hop to open
- primitive echo recognition still has a whole-document stringify fallback
- the runtime table module owns too many state machines
- accessibility proof is weaker than interaction proof
- the proof suite is strong on React fanout but weaker on browser-level
  behavior, variance, and root-cause attribution
- naming has improved, but some concepts still carry historical vocabulary

This file is the current issue ledger. Older JSON-table blueprints are useful
history, but this is the document to read first when deciding what is still
wrong.

## Definition Of Platonic

Platonic means all of this at once:

- Simplicity: the dataflow can be explained without describing old bugs.
- Speed: enum/date/text/boolean interactions feel instant in the large profile.
- Completeness: primitive, structured, virtualized, keyboard, focus, stale echo,
  accessibility, and profiling paths are covered.
- Nothing extra: no fallback paths, legacy adapters, duplicate state, or
  abstractions whose only purpose is hiding awkwardness.
- Perfect modularization: each module owns one coherent concept and exports the
  smallest useful surface.
- High entropy code: every line carries a current reason.
- Consistent naming: one concept has one name everywhere.
- Flaubertian precision: state names, prop boundaries, comments, and tests use
  the exact vocabulary of the component.

## Current Architecture Snapshot

The intended runtime dataflow is:

```txt
sourceDocument
  -> SingleFileTableView
  -> useSingleFileTableDocumentModel
  -> projectionDocument
  -> SingleFileTableRuntime
  -> useSingleFileTableProjectionModel
  -> SingleFileVirtualizedTable
  -> SingleFileFormRow
  -> EditableJsonTableCell / ReadOnlyJsonTableCell
  -> JsonTablePrimitiveCell / JsonTableStructuredCell
  -> DataCell primitive control or structured object/array editor
  -> JsonTableCellCommit
  -> useSingleFileTableDocumentModel
  -> onUpdateDocument({ data })
  -> parent sourceDocument echo
```

The current ownership split is:

- `registry/new-york-v4/ui/data-cell.tsx` owns primitive activation, display,
  editor selection, keyboard/pointer activation, and controlled/uncontrolled
  active state.
- `components/json-table/json-table-data-cell-model.ts` adapts JSON schema
  metadata and JSON values into `DataCellProps`.
- `components/json-table/json-table-primitive-cell.tsx` is the thin runtime
  bridge from a JSON-table primitive cell to `DataCell`.
- `components/json-table/use-json-table-primitive-cell-controller.ts` owns
  primitive effective value, pending snapshot subscription, and primitive
  commit dispatch.
- `components/json-table/json-table-primitive-edit-store.ts` owns primitive
  pending/confirmed/stale snapshots and field-level subscriptions.
- `components/json-table/use-single-file-table-document-model.ts` owns source
  document reconciliation, projection document identity, confirmed data, echo
  recording, and patch emission.
- `components/json-table/single-file-virtualized-table.tsx` owns row/column
  virtualization, header/body split, read-only row patching, primitive active
  store creation, structured edit session state, and scroll synchronization.
- `components/json-table/single-file-form-row.tsx` owns row rendering and the
  rendered body column window.
- `components/json-table/json-table-structured-cell.tsx` owns object/array
  popover rendering.

That split is workable. The biggest issue is that the highest-pressure module,
`SingleFileVirtualizedTable`, still coordinates too many of those ownership
boundaries at once.

## Closed But Guarded Issues

These issues should not be reopened casually. They are listed because regressions
here would recreate the original slowness or warning.

### Closed. Render-phase primitive store reconciliation

Original failure:

```txt
Cannot update a component (`EditableJsonTableCellContent`) while rendering a
different component (`SingleFileTableView`)
```

Current state:

- `SingleFileTableView` now constructs `documentModel` and delegates rendering
  to `SingleFileTableRuntime`.
- `useSingleFileTableDocumentModel` reconciles source document changes in a
  layout effect, not during render.
- `tests/json-table-session-interactions.test.tsx` contains a regression check
  for the specific React warning.

Guardrail:

- Keep primitive store `notify()` calls out of render.
- Keep source-document reconciliation in an effect boundary.
- Keep a test that spies on `console.error` for the React warning.

### Closed. Split row column-window props

Original issue:

- `SingleFileFormRow` received a scattered set of column props:
  `visibleColumns`, optional `visibleColumnIndexes`, optional left pad, and
  optional right pad.
- The name `visibleColumns` could mean "schema-visible columns" or "mounted body
  columns".

Current state:

- `SingleFileFormRow` now receives one `JsonTableRenderedColumnWindow`.
- The window carries `columns`, `projectedCellIndexes`, `leftPadWidthPx`, and
  `rightPadWidthPx`.
- `jsonTableRenderedColumnWindowForColumns()` gives tests/read-only rows a
  full-window helper.
- `tests/json-table-architecture.test.ts` rejects the old optional prop names.

Remaining risk:

- The type currently lives in `single-file-form-row.tsx`, even though the
  concept is a table/virtualizer model. That is a P1 issue below.

### Closed. Early-column-only primitive profile proof

Original issue:

- The profiler only targeted early columns, which left horizontal column
  virtualization unproven.

Current state:

- `scripts/profile-json-table-primitive-interactions.mjs` includes far-column
  large-profile scenarios:
  - `open-far-enum`
  - `open-far-date`
  - `commit-far-text`
- `tests/json-table-virtualization-stress-hardening.test.tsx` includes far
  text/enum/date fields and horizontal-scroll interaction tests.

Remaining risk:

- The fresh profiler path is still fragile when the dev server is stale or
  unhealthy. Passing profiler code is not the same as reliable acceptance proof.

## Issue Ledger

### P0. Large-table interactions are still dominated by browser style recalculation

Observed shape:

- Prior profiling showed large-profile `open-enum`, `open-date`, and
  `switch-dirty-cell` costs dominated by browser style recalculation, not React
  render fanout.
- React render budgets are strict and mostly localized to the active cell.
- Row count reductions did not explain the slow path as strongly as generated
  column count and mounted editable surface.
- Body column virtualization is the right direction, but it has not yet proven
  that style time is below a final target.

Why this is still the top issue:

The user feels browser latency, not architectural purity. A select can avoid
rerendering the table and still feel slow if opening the popup invalidates style
for a large mounted surface.

Likely contributors:

- too many mounted header cells
- too many mounted body cells before/after horizontal virtualization
- focus, hover, active, and portal selectors with broad invalidation scope
- flex table rows and table descendants mixed with absolute row positioning
- row elevation mutating `z-index` on virtual rows
- portaled select/date popup mount invalidating the whole document
- global theme/class selectors matching every data-cell surface

Blueprint:

1. Re-run fresh style experiments against the current tree.
2. Capture repeated runs for the large profile:
   - median
   - p90
   - worst
   - standard deviation or simple spread
3. Add Chrome trace attribution for style/layout work. `Performance.getMetrics`
   is not enough; it reports that style was expensive, not why.
4. Split measurements by mounted surface:
   - eager header plus virtual body
   - virtual header plus virtual body
   - eager header plus eager body, only as a diagnostic baseline
   - popup closed/open
   - active/focus class enabled/disabled
5. Add a mounted DOM summary to each profile:
   - mounted rows
   - mounted editable cells
   - mounted read-only cells
   - mounted header leaves
   - mounted header groups
   - popup nodes
6. Tighten budgets only after repeated fresh profiles are stable.

Completion criteria:

- Large `open-enum` and `open-date` are consistently under an agreed target,
  preferably below 100ms style time on the local profile machine.
- A failed style budget names a likely owner: header, body, popup, selector, or
  global page invalidation.
- The style findings document contains current numbers for the current code,
  not old numbers from a prior architecture.

### P0. Fresh performance verification is still not reliable enough

Current tools:

- `pnpm verify:json-table-performance` verifies a saved report against
  `components/json-table/json-table-performance-budget.json`.
- `pnpm verify:json-table-performance:fresh` checks that
  `http://localhost:3100/json-table-profile` is reachable, runs a fresh Chrome
  profile, then verifies the budget.
- The fresh verifier now supports `PROFILE_SERVER_MODE=auto|existing|managed`.
  In `auto` mode it uses a healthy existing profile route, starts a managed
  Next dev server when nothing is reachable, and fails with the response body
  when a route responds with an unhealthy page.
- `scripts/profile-json-table-primitive-interactions.mjs` can assert React
  render fanout, document patch counts, rect reads, overlay mounts, and some
  browser metrics.

Implemented progress:

- The verifier chooses an available port for managed runs.
- Managed runs pass the resolved `PROFILE_URL` into the profiler and budget
  verifier.
- Managed runs terminate only the dev-server process they started.
- Unhealthy existing routes now print a response body preview instead of a vague
  "start the dev server" instruction.
- `tests/json-table-architecture.test.ts` guards the fresh verifier's managed
  modes and diagnostic behavior.
- `scripts/profile-json-table-primitive-interactions.mjs` now supports
  `--repeat N` and `JSON_TABLE_PROFILE_REPEAT=N`.
- Repeated profiles write `runs` and `repeatedScenarios` with median, p90, and
  worst metric summaries while preserving the single-run `profiles` shape used
  by the existing budget verifier.
- `tests/json-table-architecture.test.ts` guards the repeated-run profiler
  support.
- `JSON_TABLE_PROFILE_REPEAT=3` fresh verification now passes against the
  current route and confirms the large open/switch interactions stay below
  100ms style time at p90/worst on this machine.

Current weakness:

- Fresh profiling still depends on the app compiling successfully.
- A stale Turbopack/dev-server process can return a 500 for code that no longer
  matches the source tree.
- Saved reports can pass after the implementation has drifted.
- One fresh run is too noisy to define final latency budgets.
- The latest fresh and repeated fresh runs pass, but the route is served by an
  existing dev server. Managed-server mode is implemented, yet the canonical
  command still needs proof across clean server lifecycles before budgets should
  be tightened.

Blueprint:

1. Add one canonical command for JSON-table acceptance.
2. Finish the fresh verifier lifecycle:
   - avoid silently validating stale pages
   - preserve the managed-server behavior now in place
3. Finish repeated-run profiling:
   - add optional warmup run
   - decide whether budgets should validate last run, median, p90, or worst
4. Keep saved budget verification, but label it as regression screening, not
   fresh proof.

Completion criteria:

- A maintainer can run one command and know whether JSON-table interaction
  performance regressed.
- The command does not require manually nursing a stale dev server.
- A performance failure includes enough context to reproduce or debug it.

### P0. Header/body column strategy is asymmetric and unproven

Current state:

- Header renders every visible schema column.
- Editable body renders a horizontal column window.
- Body width is preserved with left/right spacer cells.
- Header scroll is synchronized by copying body `scrollLeft`.

Why this might be acceptable:

- Header DOM is shallower than body DOM.
- Header group virtualization is harder than body cell virtualization.
- Eager header rendering keeps group spans and schema editing simpler.

Why this might not be acceptable:

- Profiling indicates column count materially affects style cost.
- Header cells may still be in the style invalidation set when a primitive
  popup opens.
- Header/body asymmetry creates two coordinate systems.
- Accessibility metadata for virtualized body cells is harder when the header is
  not virtualized the same way.

Blueprint:

1. Measure eager-header/virtual-body cost.
2. Add a prototype header window model if header cost is material:
   - visible leaf range
   - clipped group spans
   - left/right group continuation rules
   - schema-edit hit targets only for mounted header cells
3. Test alignment at:
   - scroll left
   - middle horizontal scroll
   - max horizontal scroll
   - nested/grouped headers
   - schema editing disabled/enabled
4. If header stays eager, document the measurement that justifies it.

Completion criteria:

- Header eagerness is a measured decision.
- If virtualized, group headers remain aligned and accessible.
- If eager, header style cost is proven small enough to keep the simpler code.

### P0. Horizontal column virtualization is implemented but not browser-proven enough

Current proof:

- Vitest stress tests cover far text/enum/date cells after horizontal scroll.
- Far pending primitive value survives horizontal unmount/remount.
- Profiler has large-profile far-column scenarios.

Remaining gaps:

- Browser screenshots are not part of the proof.
- Header/body alignment is not visually verified across real scroll positions.
- Keyboard navigation into far columns is not proven.
- Focus return after far-column popup close is not proven in browser.
- Screen-reader semantics for virtualized columns are not proven.
- Structured object/array cells across horizontal unmounts are not explicitly
  covered.

Blueprint:

1. Add browser verification for:
   - initial visible columns
   - far columns after horizontal scroll
   - far enum open
   - far date open
   - far text commit
   - screenshot of header/body alignment
2. Add keyboard-only far-column flows:
   - tab/arrow to a horizontally scrolled cell
   - open select with keyboard
   - close with escape and verify focus return
3. Decide structured-cell unmount behavior:
   - preserve session across horizontal unmount, or
   - intentionally close and commit/cancel according to a documented rule
4. Add a profile assertion that far-column opening does not rerender table/row.

Completion criteria:

- Far-column primitive interactions pass in tests and browser verification.
- Header/body alignment is visually and programmatically checked.
- The accessibility story for virtualized columns is explicit.

### P1. `SingleFileVirtualizedTable` owns too many responsibilities

Current responsibilities:

- table shell layout
- separated header/body rendering
- horizontal header scroll sync
- row virtualization
- column virtualization
- read-only DOM row patching
- primitive active store creation
- structured edit session state
- primitive/structured mutual exclusion
- row callback creation
- row key strategy
- render profiling

Why this is a problem:

This file is a gravity well. Every new performance, interaction, or focus fix
wants to land there. That makes the central runtime harder to reason about and
raises the odds that a local fix accidentally changes edit-session rules or
virtualization behavior.

Blueprint:

1. Extract edit-session ownership:
   - primitive active store ref
   - structured session state
   - primitive activation replacement
   - structured session creation
   - primitive/structured mutual exclusion
2. Extract column-window ownership:
   - full schema-visible columns
   - rendered body columns
   - projected cell indexes
   - pad widths
   - editable/read-only mode strategy
3. Extract header/body scroll sync only if it grows beyond the current callback.
4. Keep the table component as composition:
   - resolve options
   - call virtualizer/model hooks
   - render header/body

Completion criteria:

- `SingleFileVirtualizedTable` no longer reads as the owner of every state
  machine.
- Edit-session rules have focused tests outside the full table harness.
- Column-window rules have focused tests outside row rendering.

### P1. Rendered column window type lives at the wrong layer

Status: implemented and guarded.

Current state:

- `JsonTableRenderedColumnWindow` lives in
  `json-table-rendered-column-window.ts`.
- The model file exports `jsonTableFullRenderedColumnWindow()` and
  `jsonTableVirtualRenderedColumnWindow()`.
- `SingleFileVirtualizedTable` constructs the window through those helpers.
- `SingleFileFormRow` imports only the window type and renders the provided
  window.
- Tests import the window helpers from the model file, not from row code.

Why this mattered:

The row should render a window; it should not be the conceptual owner of the
window model. The type belongs closer to the fixed-grid/JSON-table projection
boundary.

Implemented proof:

- `tests/json-table-rendered-column-window.test.ts` covers full and virtual
  window construction.
- `tests/json-table-architecture.test.ts` guards the model boundary and rejects
  the old row-owned export shape.
- `pnpm test:json-table -- --reporter=dot` includes the model test.

Completion criteria:

- The type lives where the concept is created.
- Row rendering stays dumb.
- Tests no longer import row code just to build a column-window value.

### P1. Structured editor opening still requires a layout-effect state update

Status: implemented and guarded.

Current state:

- `startStructuredEditSession()` creates a session with `isOverlayOpen: true`.
- `JsonTableStructuredCell` no longer calls
  `setStructuredEditSessionOverlayOpen(true)` from a layout effect.
- `onOpenChange(false)` still closes the structured session.
- Test harnesses that model production activation now create structured
  sessions open.

Why this mattered:

- A newly created structured session almost always means "open".
- The open state is split across session existence and a second boolean.
- The first render of the structured cell is intentionally not the final state.

Implemented proof:

- `tests/json-table-architecture.test.ts` asserts the production table creates
  structured sessions open and the structured cell has no layout-effect opener.
- Session, row, architecture, and controller tests pass with the immediate-open
  session model.

Completion criteria:

- Opening a structured editor does not require a layout-effect state hop.
- Session presence has one obvious meaning.
- No React render-phase warning returns.

### P1. Primitive echo recognition still stringifies full document data

Current state:

- `JsonTablePrimitiveEditStore` records identity echoes in a `WeakSet`.
- It also records bounded JSON string keys for cloned parent echoes.
- `reconcileDocumentData()` computes `JSON.stringify(data)` for the incoming
  document data.

Why this is better than before:

- Echo keys are bounded.
- Echo tracking is store-scoped.
- Identity echoes are cheap.

Why this is still not platonic:

- Whole-document stringify scales with document size, not pending edit count.
- It assumes serializable data and stable key order.
- It is a broad fallback for a narrow problem: recognizing the echo of a commit.
- It can become hot on large parent echoes.

Blueprint:

1. Replace whole-document echo keys with narrow commit echo signatures:
   - document id
   - field path
   - committed value signature
   - monotonic commit sequence
2. Reconcile primitive echoes per pending field path.
3. Keep external authoritative changes detectable:
   - same field changed to another value becomes stale
   - unrelated field changes do not disturb pending primitive value
4. Add tests for:
   - cloned parent echo
   - multiple rapid commits to one field
   - same value committed in different fields
   - unrelated same-id external document update
   - large document data
   - non-serializable values if they are allowed at the table boundary

Completion criteria:

- Primitive echo cost scales with pending edit count.
- No full-document stringify is used for echo recognition.
- Stale detection remains correct.

### P1. Document model timing is correct but too dense

Current state:

`useSingleFileTableDocumentModel` owns:

- `sourceDocument`
- `projectionDocument`
- `documentStateRef`
- `confirmedDocumentData`
- primitive edit store creation
- source reset
- same-id source reconciliation
- primitive echo reconciliation
- document patch emission
- `onUpdateDocument` ref stabilization

Why this is acceptable:

Those concerns meet at the document boundary. Splitting them blindly would hide
the timing rules.

Why this is still not ideal:

A reader has to understand why projection is React state, confirmed data is a
ref, source reconciliation is a layout effect, primitive commits record echoes
before parent patch emission, and `onUpdateDocument` promises are ignored.

Blueprint:

1. Write the transition table as code comments or tests:
   - new source document id
   - same-id parent echo of primitive commit
   - same-id external update
   - primitive commit
   - structured commit
   - missing `onUpdateDocument`
2. Add timing tests:
   - no store notify during render
   - primitive echo does not replace projection document
   - external same-id update replaces projection document
   - new document id resets primitive store
3. Decide promise failure behavior for `onUpdateDocument`.
4. If failure is ignored, name that policy explicitly.

Completion criteria:

- The document model can be understood from one transition table.
- Every transition has a test.
- Promise failure behavior is intentional, not accidental.

### P1. `flushSync` boundaries are tiny but still need stronger proof

Current state:

- JSON table uses `flushSync` in
  `json-table-primitive-active-cell-replacement.ts`.
- `DataCell` uses `flushSync` to store activation source before controlled
  active state changes.
- Architecture tests guard allowed `flushSync` locations.

Why it exists:

Same-event cell switching can require the old active primitive control to close
or commit before the next cell opens. Activation source also has to be available
to the control on the first active render.

Why it is still an issue:

`flushSync` is a scheduling escape hatch. It is acceptable only while tiny,
named, and protected by tests that fail without it.

Blueprint:

1. Add comments at each boundary that name the exact race:
   - dirty text -> same-event enum/date activation
   - activation source must be present on first active render
2. Add tests that fail if the synchronous boundary is removed:
   - dirty text commits once
   - next enum/date opens once
   - no stuck active cell
   - no duplicate document patch
   - activation source reaches first control render
3. Keep architecture tests forbidding new `flushSync` sites.

Completion criteria:

- Every `flushSync` has a race-specific test.
- No `flushSync` owns commit logic, DOM measurement, document mutation, or popup
  state.

### P1. Read-only row patching and editable virtualization share infrastructure but not policy

Current state:

- Editable mode uses React-rendered virtual rows with default row overscan `0`.
- Read-only mode uses larger default overscan and a DOM row patcher.
- Both modes share `useFixedGridVirtualization`.
- `rowPatcher.invalidate()` runs when virtual rows, rendered column window, or
  projected rows change.

Risk:

Two different performance strategies live inside one table. A future change can
make read-only scrolling fall back to React churn or make editable behavior
inherit read-only assumptions.

Blueprint:

1. Name the two policies explicitly:
   - editable React row policy
   - read-only DOM patch policy
2. Profile read-only scroll after every virtualization change.
3. Add row patcher diagnostics:
   - patch count
   - fallback count
   - rows patched per scroll
4. Narrow invalidation to structural changes where possible.
5. Document why editable mode does not use the read-only patcher.

Completion criteria:

- Read-only fast path is measured and protected.
- Editable and read-only policies cannot be confused by naming.
- Row patcher fallback is visible in profiler output.

### P1. Accessibility proof lags behind interaction proof

Current proof:

- JSON-table keyboard/a11y interaction tests exist.
- DataCell select uses combobox/listbox-style semantics.
- Date picker uses dialog/calendar semantics.
- Some table-ish DOM elements remain.

Remaining risks:

- Rows are flex rows rather than native table layout.
- Virtual rows are absolutely positioned.
- Virtualized columns need a deliberate `aria-colindex`/`aria-colcount` story.
- Spacer cells are `td` elements with presentation semantics.
- Portaled popups must restore focus correctly.
- Far-column keyboard access is not as proven as pointer access.

Blueprint:

1. Add axe or equivalent checks for:
   - editable inactive table
   - open enum
   - open date
   - structured object popover
   - horizontally scrolled far columns
2. Add keyboard-only browser flows:
   - enter edit mode
   - open select
   - navigate options
   - escape close
   - commit text
   - open/close far column popup
3. Decide and document virtualized grid semantics:
   - `aria-rowcount`
   - `aria-colcount`
   - `aria-rowindex`
   - `aria-colindex`
4. Inspect actual accessibility tree for spacer behavior.

Completion criteria:

- Critical edit states have automated accessibility checks.
- Keyboard-only primitive and structured editing works.
- Virtualized columns have intentional semantics.

### P1. Profiler is good at symptoms but weak at root-cause attribution

Current profiler strengths:

- Chrome DevTools Protocol based.
- Measures elapsed time, React renders, React commits, document patches, rect
  reads, DOM node deltas, layout duration, style duration, and script duration.
- Asserts no table/row render for primitive-local interactions.
- Includes default, large, style-experiment, and far-column scenarios.

Current profiler gaps:

- No Chrome trace selector/style attribution.
- No repeated-run percentile mode.
- No mounted-surface summary.
- No separation of header/body/popup/global invalidation.
- Monkey-patching `getBoundingClientRect` is useful but intrusive.
- Budget failure messages still require manual interpretation.

Blueprint:

1. Add trace mode.
2. Add repeated-run mode.
3. Add mounted-surface counters.
4. Add failure summaries:
   - largest changed metric
   - likely owner
   - exact scenario
   - exact route/config
5. Keep strict React fanout assertions; they catch a different class of
   regression than latency budgets.

Completion criteria:

- A failed profile points to a subsystem, not only a number.
- Style regressions can be investigated without rerunning ad hoc experiments.

### P2. `JsonTableCellProps` is still too broad

Current surface:

`JsonTableCellProps` carries projection, schema, document, primitive active
store, primitive edit store, primitive setter, structured session, structured
setters, commit handler, hover callbacks, and editability.

Why this is understandable:

Cells are the convergence point for schema projection, interaction state, and
commit behavior.

Why this is not ideal:

Every cell receives several ownership domains. That makes memoization and
future edits fragile: a prop can be used in the wrong layer simply because it is
available.

Blueprint:

1. Group by ownership only if identity can stay stable:
   - `cellProjection`
   - `primitiveEditing`
   - `structuredEditing`
   - `commit`
   - `hover`
2. Measure memo stability before and after grouping.
3. Keep `DataCell` adaptation separate from grouped table props.
4. Do not create wrapper churn to make call sites look pretty.

Completion criteria:

- Cell prop ownership is clearer.
- Memo comparisons are shorter or more obviously correct.
- Render counts do not regress.

### P2. Primitive and structured pending values use different local visibility models

Current state:

- Primitive pending values live in `JsonTablePrimitiveEditStore`.
- Structured pending values live inside
  `useJsonTableStructuredCellController`.
- Primitive commits use `visibleThrough: "primitivePendingValue"`.
- Structured commits use `visibleThrough: "projectedDocumentValue"` plus local
  component pending state.

Why this may be fine:

Primitive controls are many and hot; structured editors are heavier and less
frequent. Their state lifecycles differ.

Why it still deserves scrutiny:

The names imply two local visibility mechanisms. A reader has to learn both and
understand why structured pending state does not use the primitive store.

Blueprint:

1. Document the difference in `ARCHITECTURE.md`.
2. Add tests for structured parent echo behavior:
   - committed structured value remains visible before echo
   - echo clears pending state
   - external same-field update wins or becomes stale according to policy
3. Decide whether `visibleThrough` should be renamed to a clearer local owner
   concept.

Completion criteria:

- Primitive and structured visibility policies are explicit.
- The difference is justified by behavior, not history.

### P2. `visibleThrough` is serviceable but still slightly non-obvious

Current name:

```ts
visibleThrough: "primitivePendingValue" | "projectedDocumentValue"
```

Why it works:

It names the local owner that keeps the committed value visible before the
parent document echo is reconciled.

Why it is not perfect:

"Visible through" is not a common lifecycle phrase. Without the comment in
`json-table-cell-commit.ts`, a reader may think it is a display concern rather
than a pre-echo ownership concern.

Blueprint:

1. Run a final call-site sentence test:
   - "commit this value, visible through primitive pending value"
   - "commit this value, visible through projected document value"
2. Compare only names that improve call sites:
   - `visibleThrough`
   - `commitVisibilityOwner`
   - `preEchoVisibilityOwner`
   - `localVisibilityOwner`
3. If a better name wins, make a hard cutover.
4. If not, keep the current name and stop revisiting it.

Completion criteria:

- The name is stable in code, tests, and docs.
- No compatibility alias exists.

### P2. Column vocabulary still has historical residue

Improved state:

- Row-level `visibleColumnIndexes` is gone.
- Row receives `JsonTableRenderedColumnWindow`.
- Pixel widths in the row window use `Px`.

Remaining issues:

- `visibleColumns` still means schema-visible columns in
  `SingleFileVirtualizedTable`.
- `columnItems` comes from the generic fixed-grid virtualizer and needs local
  translation.
- `leftPad` and `rightPad` from the virtualizer are pixel values but do not
  carry `Px`.
- The public vocabulary should distinguish:
  - schema-visible columns
  - rendered body columns
  - projected cell indexes
  - virtualizer column items

Blueprint:

1. Standardize local JSON-table names:
   - `schemaVisibleColumns`
   - `renderedBodyColumns`
   - `renderedBodyColumnItems`
   - `projectedCellIndexes`
   - `leftPadWidthPx`
   - `rightPadWidthPx`
2. Keep generic virtualizer names generic inside generic UI utilities.
3. Add architecture assertions only for names that protect real ownership.

Completion criteria:

- A reader can tell whether a column array is logical or mounted.
- Pixel values carry `Px` at JSON-table boundaries.

### P2. DataCell activation remains conceptually heavy

Current state:

- Pointer, click, keyboard, command, and edit activation are separated.
- Activation source is captured with a synchronous boundary.
- Click-tail suppression prevents the opening event from immediately dismissing
  the popup.
- Select/picker controls consume opening context instead of owning timeout
  hacks.

Why this is strong:

The complexity is centralized and testable.

Why this is still not simple:

Activation tokens, click-tail behavior, keyboard modifiers, pointer opening
events, and dismissal causes form a small state machine. The code is clean, but
the concept is not obvious.

Blueprint:

1. Add a short DataCell activation state diagram to the architecture docs.
2. Keep tests around:
   - pointer opening event does not dismiss immediately
   - next outside pointer dismisses
   - keyboard activation has no pointer token
   - click-tail is consumed once
   - modifier keys do not activate editing accidentally
3. Prevent activation policy from leaking back into select/picker controls.

Completion criteria:

- A reader can understand activation without reading every control file.
- Controls consume policy; they do not recreate it.

### P2. Test harness duplication still obscures production wiring

Current state:

Several tests locally recreate:

- primitive active store refs
- structured session state
- primitive/structured mutual exclusion
- commit bridges
- rendered column windows
- visible column builders

Why this is a problem:

Long harnesses hide the behavior under test and can drift from production
wiring. The component has many tests, but adding the next regression test is
still more expensive than it should be.

Blueprint:

1. Keep focused test utilities, not a magical mega-fixture:
   - editable cell harness
   - virtualized table harness
   - document echo harness
   - rendered column window builder
2. Make production-like wiring the default.
3. Keep each test's behavioral setup visible.
4. Delete per-test harness copies once shared utilities cover the same path.

Completion criteria:

- New regression tests are short.
- Test wiring mirrors production wiring.
- Duplicated session/commit code disappears.

### P2. Architecture tests are useful but brittle

Current state:

- Architecture tests reject forbidden imports, old vocabulary, broad ownership,
  and unwanted `flushSync`.
- They are valuable and should stay.

Weakness:

- Many assertions are string-pattern checks.
- String checks can preserve old text after ownership changes.
- They can fail on comments or miss equivalent behavior under a new name.
- File line-count budgets can encourage superficial extraction.

Blueprint:

1. Keep string checks for deleted vocabulary and allowed boundaries.
2. Add semantic checks where possible:
   - import graph constraints
   - no DataCell import from JSON table internals
   - no JSON-table import from DataCell internals
   - allowed `flushSync` import list
   - commit shape type tests
3. Add comments explaining every forbidden pattern.
4. Delete stale architecture rules after each major refactor.

Completion criteria:

- Architecture tests protect ownership without freezing incidental text.
- Every forbidden pattern has a current reason.

### P2. Architecture documentation is not canonical enough

Current state:

- `components/json-table/ARCHITECTURE.md` exists.
- `components/json-table/ARCHITECTURE_DIAGRAM.md` exists.
- Many design blueprints exist under `design/`.

Problem:

There are too many historical plans. A maintainer can read five plausible
documents and still not know which one is current.

Blueprint:

1. Treat this file as the current issue ledger.
2. Update `ARCHITECTURE.md` with links to:
   - this issue ledger
   - style invalidation findings
   - performance budget file
   - profiler script
3. Mark older blueprints as superseded only when they conflict with current
   architecture.
4. Keep historical reasoning only when it still explains a current decision.

Completion criteria:

- A new maintainer knows which document to read first.
- Old plans no longer compete with current decisions.

### P2. Registry/DataCell artifact consistency is adjacent to JSON-table proof

Current state:

- JSON table imports `DataCell` through `components/ui/data-cell`.
- Runtime DataCell lives under `registry/new-york-v4/ui`.
- Registry/public artifacts are verified by separate scripts.

Risk:

JSON-table behavior can pass while generated registry artifacts drift, or a
DataCell runtime change can affect JSON table without running registry proof.

Blueprint:

1. Add changed-file guidance to the JSON-table acceptance checklist:
   - if `registry/new-york-v4/ui/data-cell*` changes, run DataCell registry
     verification
   - if `components/ui/data-cell.tsx` changes, run DataCell parity checks
2. Keep JSON-table tests importing public DataCell paths unless intentionally
   testing internals.
3. Include registry determinism in final acceptance when DataCell files changed.

Completion criteria:

- DataCell runtime, public barrel, and registry artifact cannot drift unnoticed
  during JSON-table work.

## Execution Blueprint

### Phase 1. Establish current truth

Run:

```sh
pnpm exec tsc --noEmit --pretty false
pnpm test:json-table -- --reporter=dot
pnpm verify:json-table-performance
pnpm verify:json-table-performance:fresh
JSON_TABLE_STYLE_EXPERIMENTS=1 PROFILE_OUTPUT=tmp/json-table-primitive-interactions-profile.fresh.json node scripts/profile-json-table-primitive-interactions.mjs --assert
```

Record:

- exact commit/worktree state
- dev-server owner and port
- fresh profile route
- saved and fresh profile paths
- large-profile style/layout/script/elapsed numbers
- mounted rows/cells/header/popup counts if available

Rule:

Do not claim performance perfection from saved reports alone.

### Phase 2. Finish performance attribution

Work:

- add repeated-run profiler mode
- add trace/style attribution
- split header/body/popup/global style cost
- update `design/data-cell-json-table-style-invalidation-findings.md`
- decide whether header virtualization is required

Decision:

- If header cost is material, virtualize header.
- If selector/global invalidation dominates, fix CSS/containment first.
- If popup mount dominates, isolate popup styling and positioning.

### Phase 3. Compress runtime ownership

Work:

- extract edit-session ownership from `SingleFileVirtualizedTable`
- move rendered column window model out of row file
- simplify structured session open state
- keep row rendering dumb

Rule:

No extraction is allowed unless the API becomes smaller, the tests become
clearer, and profiler render counts do not regress.

### Phase 4. Remove bounded but unnecessary work

Work:

- replace full-document primitive echo stringify
- narrow read-only row patch invalidation
- clean up column naming
- finalize `visibleThrough` naming

Rule:

Bounded waste is still waste if it sits on a hot path.

### Phase 5. Close proof gaps

Work:

- browser verification for far columns
- screenshots/alignment checks
- axe checks for critical open states
- keyboard-only flows
- canonical acceptance command
- architecture-doc index cleanup

Rule:

The component is not done until the proof suite covers what users actually do,
not only what React happens to render.

## Final Acceptance Checklist

The component can be considered close to platonic only when all of this is true:

- `pnpm exec tsc --noEmit --pretty false` passes.
- `pnpm test:json-table -- --reporter=dot` passes.
- Fresh performance verification passes from a clean, owned, reachable profile
  route.
- Saved performance budgets are in sync with fresh profile reality.
- Large `open-enum` and `open-date` meet agreed elapsed/style/layout budgets.
- Far-column enum/date/text scenarios pass in tests and profiler assertions.
- Browser-level verification covers early and far columns.
- Header/body alignment is proven at left, middle, and max horizontal scroll.
- Accessibility checks pass for inactive, enum-open, date-open,
  structured-open, and horizontally scrolled states.
- Keyboard-only primitive and structured editing works.
- No primitive store notification occurs during render.
- Primitive open does not rerender the table or rows.
- Same-event dirty-cell switching commits once and opens the next cell once.
- Exactly one primitive active cell or one structured session exists at a time.
- Primitive echo recognition does not stringify the whole document.
- Header rendering is either virtualized or measured and documented as
  intentionally eager.
- `SingleFileVirtualizedTable` composes models instead of owning every state
  machine directly.
- Rendered column window vocabulary is canonical and lives outside the row file.
- Every remaining `flushSync` is tiny, named, and race-tested.
- DataCell remains independent from JSON-table internals.
- JSON table remains independent from primitive control internals.
- Registry/DataCell artifact verification runs when DataCell files change.
- This issue ledger, architecture docs, profiler, and tests agree.

## Non-Goals

- Do not reintroduce a DataCell editor handle.
- Do not move primitive draft state into JSON table.
- Do not route structured object/array editing through the primitive edit store
  unless a real shared lifecycle is proven.
- Do not add compatibility shims for old commit shapes.
- Do not accept a refactor that merely moves complexity between files.
- Do not tighten latency budgets from a single fresh profile run.
- Do not optimize away accessibility semantics to reduce DOM nodes.
- Do not make the row aware of more virtualizer internals.

## Immediate Next Cut

The next cut should be performance proof, not another speculative refactor:

1. Make fresh profiling reliable from one command.
2. Re-run large style experiments on the current code.
3. Attribute remaining style cost to header, body, popup, selector, or global
   page invalidation.
4. Decide on header virtualization with data.
5. Then compress `SingleFileVirtualizedTable` and move the rendered column
   window model only after the performance direction is clear.

That order keeps the work honest: measure the real remaining latency first,
then simplify the architecture around the winning strategy.
