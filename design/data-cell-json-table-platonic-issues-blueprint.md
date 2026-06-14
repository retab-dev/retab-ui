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
- the runtime table module owns too many state machines
- browser-level accessibility proof now covers the critical primitive states,
  keyboard-only far-column flows, and the far structured object editor path
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
- Body column virtualization reduced body surface substantially.
- Fresh profiler output now records mounted header/body/popup surface counts and
  a coarse `styleAttributionHint`.
- Editable header rendering now uses the same horizontal column window as the
  body, reducing large-profile mounted header cells from `106` to roughly
  `32-34` on the fresh profile route.
- Current fresh proof still points to popup mount for `open-enum` and
  `open-date`; non-popup style work now needs trace-backed attribution before
  another structural cut.
- Trace-mode proof now confirms the dominant style bucket is Chrome style-tree
  work (`Blink.Style.UpdateTime`, `Document::updateStyle`, and
  `Document::recalcStyle`), not hidden React fanout.

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

Implemented attribution cut:

- `scripts/profile-json-table-primitive-interactions.mjs` records
  `mountedSurface.before`, `mountedSurface.after`, and `mountedSurface.delta`.
- The snapshot includes mounted header cells, body cells, editable cells, rows,
  DataCell surfaces, popup nodes, calendars, and document node count.
- The profiler emits `styleAttributionHint` with coarse buckets:
  - `popup-mount`
  - `popup-open-surface`
  - `eager-header-surface`
  - `editable-body-surface`
  - `global-document-surface`
  - `not-style-bound`
- `scripts/verify-json-table-performance-budget.mjs` prints
  `surface=header/body/popup` and `owner=...` in every summary line.

Fresh proof from `pnpm verify:json-table-performance:fresh`:

- `large/open-enum`: `surface=header:106/body:132/popup:15`,
  `owner=popup-mount`, `style=97.6ms`.
- `large/open-date`: `surface=header:106/body:132/popup:99`,
  `owner=popup-mount`, `style=101.1ms`.
- `large/switch-dirty-cell`: `surface=header:106/body:144/popup:0`,
  `owner=eager-header-surface`, `style=97.3ms`.

Implemented header-window cut:

- `SingleFileTableHeader` receives `JsonTableRenderedColumnWindow`.
- Editable headers render only the header cells whose leaf indexes intersect
  the body column window.
- Header spacer cells preserve the full scroll canvas.
- Header cell widths use actual rendered column widths, not the global
  `columnWidth` option.
- `tests/json-table-virtualization-stress-hardening.test.tsx` asserts both
  header and body windows mount fewer cells than the full visible schema.

Fresh auto-lifecycle proof from
`PROFILE_SERVER_MODE=auto JSON_TABLE_PROFILE_WARMUP=1 pnpm
verify:json-table-performance:fresh`:

- `large/open-enum`: `surface=header:32/body:143/popup:15`,
  `owner=popup-mount`, `style=71.9ms`, `elapsed=119.8ms`.
- `large/open-date`: `surface=header:32/body:143/popup:99`,
  `owner=popup-mount`, `style=71.6ms`, `elapsed=167.3ms`.
- `large/switch-dirty-cell`: `surface=header:32/body:143/popup:0`,
  `owner=eager-header-surface`, `style=70.8ms`, `elapsed=114.1ms`.

Trace-mode proof from
`JSON_TABLE_PROFILE_TRACE=1 PROFILE_OUTPUT=tmp/json-table-primitive-interactions-profile.trace.json node scripts/profile-json-table-primitive-interactions.mjs --assert`:

- `large/open-enum`: normal elapsed stayed separate from trace shutdown
  overhead; trace style was dominated by Chrome style update/recalc events.
- `pnpm verify:json-table-performance` accepts trace reports and prints
  `traceStyle=`, `traceLayout=`, and `traceScript=` buckets when present.

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
- Text setup in `scripts/profile-json-table-primitive-interactions.mjs` now
  refinds or remounts the target edit input before injecting setup values, so
  `switch-dirty-cell` and `post-churn-text-commit` are not dependent on fragile
  focus surviving dev-server/HMR churn.
- Date commit profiling now selects enabled visible calendar
  `button[data-day]` elements instead of relying on text content or CSS class
  names, and reports candidate counts when no commit button exists.
- Date commit profiling now waits for actionable `button[data-day]` elements,
  not only the calendar root, so it does not race the picker mount transition.
- Fresh profiler setup now retries the verified editable-mode activation instead
  of assuming one synthetic `Editable` click always lands immediately after
  hydration.
- Fresh profiler setup now records `profilePageState` diagnostics and recovers a
  genuinely blank profile document once, while still failing mounted tables that
  are missing an expected field.
- Fresh profiler runs now close Chrome profile targets through `/json/close/`
  and sweep stale profile targets at startup, so warmup tabs do not keep
  participating in dev-server HMR.
- `scripts/profile-json-table-primitive-interactions.mjs` supports
  `--warmup N` and `JSON_TABLE_PROFILE_WARMUP=N`. Warmup runs execute the same
  target scenarios but are discarded from the saved report.
- `scripts/profile-json-table-primitive-interactions.mjs` supports diagnostic
  target and scenario filters through `--targets`,
  `JSON_TABLE_PROFILE_TARGETS`, `--scenarios`, and
  `JSON_TABLE_PROFILE_SCENARIOS`. Defaults remain unfiltered, and
  scenario-filtered runs are refused with `--assert` so the canonical profiler
  assertion cannot be weakened accidentally.
- `package.json` now exposes `pnpm verify:json-table` as the canonical
  JSON-table gate. It runs:
  - `pnpm test:json-table`
  - saved performance budget verification
  - auto-lifecycle fresh performance verification with
    `JSON_TABLE_PROFILE_WARMUP=1`
  - auto-lifecycle browser accessibility verification
- `components/json-table/ARCHITECTURE.md` documents the canonical gate and
  keeps repository-wide `pnpm typecheck` as a separate whole-app health check.
- `tests/json-table-architecture.test.ts` guards the canonical command and
  profiler warmup/filter options.
- The canonical gate now uses `PROFILE_SERVER_MODE=auto`, because Next 16
  permits one dev server per repository even across different ports. `auto`
  reuses a healthy profile route, starts a managed server when no route is
  reachable, and still fails with diagnostics when a route responds with the
  wrong page.
- `pnpm verify:json-table` now passes end to end against the live
  `http://localhost:3100/json-table-profile` route.

Current weakness:

- Fresh profiling still depends on the app compiling the route successfully.
- A stale Turbopack/dev-server process can return a 500 for code that no longer
  matches the source tree; auto mode avoids validating that page by requiring a
  healthy profile route and printing the unhealthy response body.
- Unrelated open app routes can still compile in the same Next dev server and
  print errors while the JSON-table verifier runs. The profiler now keeps its
  own profile targets isolated and closed, but it cannot make unrelated routes
  healthy.
- Saved reports can pass after the implementation has drifted.
- One measured fresh run is still too noisy to define final latency budgets.
- The canonical gate runs a warmup, but final budget tightening should still use
  repeated fresh proof, ideally from a quiet process with no other dev server
  running.

Blueprint:

1. Add one canonical command for JSON-table acceptance.
2. Finish the fresh verifier lifecycle:
   - avoid silently validating stale pages
   - preserve the auto lifecycle now in place
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

Fresh auto-lifecycle proof from
`PROFILE_SERVER_MODE=auto JSON_TABLE_PROFILE_WARMUP=1 pnpm
verify:json-table-performance:fresh`:

- `default/open-enum`: `elapsed=96.6ms`, `style=50.9ms`,
  `surface=header:16/body:104/popup:9`, `owner=popup-mount`.
- `default/open-date`: `elapsed=172.8ms`, `style=59.6ms`,
  `surface=header:16/body:104/popup:99`, `owner=popup-mount`.
- `default/switch-dirty-cell`: `elapsed=94.6ms`, `style=50.3ms`,
  `surface=header:16/body:104/popup:0`, `owner=editable-body-surface`.
- `large/open-enum`: `elapsed=119.8ms`, `style=71.9ms`,
  `surface=header:32/body:143/popup:15`, `owner=popup-mount`.
- `large/open-date`: `elapsed=167.3ms`, `style=71.6ms`,
  `surface=header:32/body:143/popup:99`, `owner=popup-mount`.
- `large/switch-dirty-cell`: `elapsed=114.1ms`, `style=70.8ms`,
  `surface=header:32/body:143/popup:0`, `owner=eager-header-surface`.

### Closed. Header/body column strategy is shared and guarded

Previous state:

- Header renders every visible schema column.
- Editable body renders a horizontal column window.
- Body width is preserved with left/right spacer cells.
- Header scroll is synchronized by copying body `scrollLeft`.

Why this was not acceptable:

- Profiling showed mounted column surface was the main style-cost driver.
- Header cells stayed in the mounted style surface even after body column
  virtualization.
- Header/body asymmetry created two coordinate systems.
- Accessibility metadata for virtualized body cells was harder while the header
  used a different strategy.

Current state:

- `SingleFileTableHeader` receives the same `JsonTableRenderedColumnWindow` as
  the body rows.
- Header cells mount only when their leaf indexes intersect the rendered column
  window.
- Header spacer cells preserve the full horizontal scroll canvas and are hidden
  from the accessibility tree.
- Header and body cells expose absolute 1-based column coordinates.
- The split header/body tables both expose the real column count.

Implemented proof:

- `tests/json-table-virtualization-stress-hardening.test.tsx` checks that
  header and body mount fewer cells than the full visible schema.
- The same test verifies left and far horizontal windows expose the expected
  `aria-colindex` values.
- The same test verifies spacer cells are `aria-hidden` and
  `role="presentation"`.
- `tests/json-table-architecture.test.ts` guards the shared rendered column
  window, header spacers, table `aria-colcount`, body `aria-rowcount`, and row
  `aria-rowindex` wiring.
- Fresh profiling after the header-window cut reduced large-profile mounted
  header cells from `106` to roughly `32`.

Completion criteria:

- Header and body share one rendered column window.
- Virtualized header/body coordinates remain absolute and accessible.
- Header style surface stays bounded in fresh profiling.

### P0. Horizontal column virtualization is implemented but not browser-proven enough

Current proof:

- Vitest stress tests cover far text/enum/date cells after horizontal scroll.
- Far pending primitive value survives horizontal unmount/remount.
- Profiler has large-profile far-column scenarios.
- Browser accessibility verification scrolls the large profile to far columns
  and checks far enum/date popup exposure in the browser accessibility tree.
- Browser verification now checks header/body geometry alignment at left,
  middle, and far horizontal scroll positions.
- Browser verification now exercises keyboard-only far enum, far date, and far
  text flows in the large profile.
- Virtualization stress tests now cover far structured object cells across
  horizontal unmount/remount.
- Browser verification now opens a far dynamic structured object cell, verifies
  its typed dynamic `reviewer` and `priority` controls, checks horizontal
  unmount/remount, and checks keyboard Enter/Escape focus return.

Remaining gaps:

- Stored browser screenshots are not part of the proof; geometry is checked
  programmatically instead.
- Array-specific horizontal remount proof is intentionally not duplicated at
  the browser layer right now. The current object proof exercises the shared
  structured-session, popover, focus-return, and horizontal virtualization
  boundary. Add array-specific browser proof only if array editor internals gain
  behavior that object editors do not share, or if table projection semantics
  change to expose array-level controls differently.

Blueprint:

1. Add browser verification for:
   - initial visible columns
   - far columns after horizontal scroll
   - far enum open
   - far date open
   - far text commit
   - header/body alignment at left, middle, and far scroll positions
2. Add keyboard-only far-column flows:
   - tab/arrow to a horizontally scrolled cell
   - open select with keyboard
   - close with escape and verify focus return
   - type-to-edit far text and commit with Enter
3. Decide structured-cell unmount behavior:
   - preserve session across horizontal unmount
   - unmount popover DOM while the cell is unmounted
   - reopen from the table-owned structured session when the cell remounts
4. Add a profile assertion that far-column opening does not rerender table/row.

Completion criteria:

- Far-column primitive interactions pass in tests and browser verification.
- Header/body alignment is programmatically checked in a real browser.
- Keyboard-only far enum/date/text flows pass in browser verification.
- Structured object cells preserve their table-owned session across horizontal
  unmount/remount in virtualization stress tests and browser verification.
- The accessibility story for virtualized columns is explicit.

### P1. `SingleFileVirtualizedTable` owns too many responsibilities

Status: partially implemented.

Current responsibilities:

- table shell layout
- separated header/body rendering
- horizontal header scroll sync
- row virtualization
- column virtualization
- read-only DOM row patching
- row callback creation
- row key strategy
- render profiling

Extracted responsibilities:

- `useJsonTableEditSessionCoordinator` owns primitive active store creation,
  structured edit session state, structured session IDs, and
  primitive/structured mutual exclusion.
- `useJsonTableRenderedColumnWindow` owns editable/read-only rendered column
  window strategy, translating fixed-grid virtualizer output into the
  JSON-table `JsonTableRenderedColumnWindow` model.

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

Implemented cut:

- `useJsonTableEditSessionCoordinator` is the edit-session owner.
- `SingleFileVirtualizedTable` consumes one `editSession` API instead of owning
  primitive and structured edit refs/state directly.
- Architecture tests guard the ownership boundary and keep structured sessions
  immediately open in the coordinator.
- `tests/json-table-edit-session-coordinator.test.tsx` proves:
  - primitive active state lives in a stable external store
  - opening a structured session clears primitive active state
  - activating a primitive cell clears structured session state
  - overlay open state and close behavior stay local to the coordinator
  - document-id changes reset primitive and structured edit state
  - missing projected cells are ignored
- `tests/json-table-virtualization-stress-hardening.test.tsx` proves a far
  structured object session survives horizontal unmount/remount. The popover DOM
  disappears while the cell is unmounted and reopens when the active cell
  remounts from the table-owned session.
- `tests/json-table-rendered-column-window-hook.test.tsx` proves:
  - read-only tables receive the full schema-visible column window
  - editable tables receive the rendered body column window
  - the hook preserves window identity while inputs are stable
- `SingleFileVirtualizedTable` now uses local boundary names:
  `schemaVisibleColumns`, `renderedBodyColumnItems`, `leftPadWidthPx`, and
  `rightPadWidthPx`.
- Architecture tests guard that the table consumes
  `useJsonTableRenderedColumnWindow` instead of directly constructing full or
  virtual rendered windows.
- The JSON-table interaction suite passes with the extracted coordinator.

Remaining work:

- Keep scroll synchronization in the table unless it grows beyond one callback.

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

### P1. Primitive echo recognition no longer stringifies full document data

Previous state:

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

Implemented cut:

- `recordDocumentEcho()` now receives a narrow
  `JsonTablePrimitiveDocumentEcho`:
  - emitted document data identity
  - edited field path
  - committed value
- Exact parent echoes are recognized by `WeakMap` identity.
- Cloned parent echoes are recognized by a bounded signature list.
- Cloned signatures compare the committed field value and the unedited siblings
  along the edited path, so same-value external documents with unrelated
  sibling changes are not hidden as primitive echoes.
- `JSON.stringify(data)`, `documentEchoKey`, and `primitiveDocumentEchoKeys`
  have been removed from the primitive edit store.

Implemented proof:

- `tests/json-table-primitive-edit-store.test.ts` covers rapid repeated
  commits, cloned parent echoes, store isolation, stale authoritative changes,
  and rejection of cloned echoes with unrelated top-level or nested sibling
  changes.
- `tests/json-table-architecture.test.ts` asserts primitive echo recognition is
  narrow and non-serializing.
- `pnpm test:json-table -- --reporter=dot` passes with 282 JSON-table tests.
- `pnpm exec tsc --noEmit --pretty false` passes.

Completion criteria:

- Primitive echo cost scales with the bounded echo signature list and edited
  path width, not full document serialization.
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

Implemented cut:

- `useSingleFileTableDocumentModel` now carries a compact transition table at
  the document boundary:
  - new source id resets projection, confirmed data, and primitive edits
  - same-id primitive echoes update confirmed data without replacing projection
  - same-id external updates replace projection
  - primitive commits record primitive echoes before patch emission
  - structured commits patch confirmed data while structured local state owns
    visibility
  - missing updater exposes a no-op commit handler
- `emitOptimisticDocumentPatch()` names the persistence policy: the model emits
  patches optimistically and does not roll back local document state when the
  returned promise rejects.

Implemented proof:

- `tests/json-table-controller.test.tsx` covers primitive echo projection
  retention, same-id external replacement, new-id reset, missing updater no-op,
  structured patching from confirmed data, and rejected update promises.

Completion criteria:

- The document model can be understood from one transition table.
- Every transition has a test.
- Promise failure behavior is intentional, not accidental.

### P1. `flushSync` boundaries are tiny but still need stronger proof

Current state:

- JSON table uses `flushSync` in
  `json-table-primitive-active-cell-store.ts`.
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

Implemented cut:

- `replaceJsonTablePrimitiveActiveCell()` names the same-event cell switching
  race at the `flushSync` site.
- `storeDataCellActivationSource()` names the first-active-render activation
  source race at the `flushSync` site.
- Architecture tests now assert:
  - JSON-table has exactly one allowed `flushSync` owner:
    `json-table-primitive-active-cell-store.ts`
  - DataCell has exactly one allowed `flushSync` owner: `data-cell.tsx`
  - both sites carry race-specific comments

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

Implemented cut:

- `components/json-table/ARCHITECTURE.md` now names the two row strategies:
  editable tables use the React row policy; read-only tables use the DOM row
  patch policy.
- The architecture doc explains why editable mode does not use the read-only
  patcher: editable rows can contain active controls and local edit state that
  must not be imperatively rewritten.
- `ReadOnlyJsonRowPatchDiagnostic` now reports one diagnostic per patch attempt:
  - `reason: "handled"` with `rowsPatched`
  - fallback reasons including `shape-mismatch`, `unsupported-viewport`,
    `window-too-large`, `missing-row-window`, and disabled/empty cases
- `useReadOnlyJsonRowPatcher` accepts an optional `onDiagnostic` callback for
  tests and emits a `read-only-row-patcher` profiler mark for profiler output.
- `tests/read-only-json-row-patcher.test.tsx` covers handled patch row counts,
  shape-mismatch fallback, and unsupported horizontal viewport fallback.
- `tests/read-only-json-row-patcher.test.tsx` is now part of
  `pnpm test:json-table`.
- `tests/json-table-architecture.test.ts` guards the policy docs, diagnostic
  vocabulary, profiler mark, and diagnostic tests.

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
- Virtualized header/body tables expose real `aria-colcount`.
- Virtualized body rows expose absolute `aria-rowindex`.
- Virtualized body cells expose absolute `aria-colindex`.
- Header cells expose absolute `aria-colindex`.
- Header and body spacer cells are hidden with `aria-hidden` and
  `role="presentation"`.

Remaining risks:

- Rows are flex rows rather than native table layout.
- Virtual rows are absolutely positioned.
- Portaled popups must restore focus correctly.
- Structured object/array browser flows are still thinner than primitive
  browser flows.

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
4. Inspect actual browser accessibility tree for spacer behavior and virtual
   coordinates.

Implemented cut:

- Body tables expose `aria-rowcount` and `aria-colcount`.
- Header tables expose `aria-colcount`.
- Mounted rows expose absolute `aria-rowindex`.
- Mounted editable/read-only cells expose absolute `aria-colindex`.
- Header cells expose absolute `aria-colindex`.
- Header and body spacer cells are removed from the accessibility tree.
- Virtualization stress tests prove the left and far horizontal windows keep
  correct absolute coordinates.
- `DataCellPickerControl` sanitizes residual picker-only props before spreading
  trigger button props, removing React DOM warnings for `showPickerIcon` and
  `onOpenChange`.
- `scripts/verify-json-table-accessibility.mjs` adds browser-level checks for:
  - editable inactive table semantics
  - open enum combobox/listbox accessibility-tree exposure
  - open date dialog/calendar accessibility-tree exposure
  - horizontally scrolled far-column coordinates
  - far enum/date popup accessibility exposure
  - header/body geometry alignment at left, middle, and far horizontal scroll
    positions
  - keyboard-only far enum open/close with focus return
  - keyboard-only far date open/close with focus return
  - keyboard-only far text type-to-edit and Enter commit
  - far structured object dialog exposure
  - far structured object typed dynamic controls
  - far structured object horizontal unmount/remount
  - keyboard-only far structured object open/close with focus return
- `verify:json-table-accessibility:fresh` runs that verifier against the
  auto-lifecycle profile route.
- The unrelated file-system compile blocker was repaired by restoring the
  current `file-system-browser-state` model and aligning the status bar with
  that state shape.
- Auto-lifecycle browser accessibility verification now passes against
  `/json-table-profile` and `/json-table-profile?variant=large`.
- `JsonTableStructuredCell` preserves explicit `additionalProperties` and
  `patternProperties` schemas when adding structured editor context, so dynamic
  object cells render typed existing keys instead of an empty arbitrary form.
- Structured popover close now restores focus to the table cell shell after
  Escape.

Completion criteria:

- Critical edit states have automated accessibility checks.
- Keyboard-only primitive editing works across early and far columns.
- Structured object keyboard browser proof covers open, close, focus return,
  dynamic controls, and the structured horizontal remount boundary.
- Virtualized columns have intentional semantics.

### P1. Profiler is good at symptoms but weak at root-cause attribution

Current profiler strengths:

- Chrome DevTools Protocol based.
- Measures elapsed time, React renders, React commits, document patches, rect
  reads, DOM node deltas, layout duration, style duration, and script duration.
- Asserts no table/row render for primitive-local interactions.
- Includes default, large, style-experiment, and far-column scenarios.
- Supports repeated runs and reports median, p90, and worst per scenario.
- Captures mounted surface snapshots before and after each scenario.
- Budget summaries print mounted header/body/popup counts and a coarse likely
  owner for style-bound scenarios.

Current profiler gaps:

- Chrome trace attribution exists, but Chrome still does not expose useful
  selector-level attribution for these scenarios.
- Header/body/popup/global attribution is coarse; trace mode identifies event
  families, not the exact selector that invalidated each cell.
- Monkey-patching `getBoundingClientRect` is useful but intrusive.
- Budget failure messages now include a likely owner, but still lack a ranked
  "largest changed metric" diff against baseline.

Blueprint:

1. Add trace mode.
2. Keep repeated-run mode.
3. Keep mounted-surface counters.
4. Add failure summaries:
   - largest changed metric
   - likely owner
   - exact scenario
   - exact route/config
5. Keep strict React fanout assertions; they catch a different class of
   regression than latency budgets.

Implemented cut:

- `JSON_TABLE_PROFILE_REPEAT` / `--repeat` produces repeated scenario summaries.
- `mountedSurface` captures header cells, body cells, editable cells, rows,
  DataCell surfaces, popup nodes, calendars, and total document nodes.
- `styleAttributionHint` gives immediate coarse ownership in fresh budget
  output.
- `JSON_TABLE_PROFILE_TRACE=1` / `--trace` enables Chrome trace capture around
  each measured scenario. The report records `trace` summaries with total timed
  duration, style/layout/script buckets, top timed trace events, top
  style/layout events, and invalidation events when Chrome emits them.
- `scripts/verify-json-table-performance-budget.mjs` prints trace style,
  layout, and script buckets when the profile report contains trace data.
- Text setup refinds/remounts the intended edit input before injecting profile
  values, so dirty-switch and post-churn setup does not fail solely because
  focus drifted after an unrelated dev-server event.
- Focused repeated trace profiling now runs against the large profile without
  paying trace cost for every setup scenario:
  `JSON_TABLE_PROFILE_WARMUP=1 JSON_TABLE_PROFILE_REPEAT=3
JSON_TABLE_PROFILE_TRACE=1 JSON_TABLE_PROFILE_TARGETS=large
JSON_TABLE_PROFILE_SCENARIOS=open-enum,open-date,switch-dirty-cell,open-far-enum,open-far-date,commit-far-text`.
- Current large-profile targeted p90 style costs are:
  - `open-enum`: `68.8ms`
  - `open-date`: `69.1ms`
  - `switch-dirty-cell`: `69.8ms`
  - `open-far-enum`: `60.9ms`
  - `open-far-date`: `62.1ms`
  - `commit-far-text`: `67.9ms`
- Budget policy: the canonical gate should keep validating the single measured
  warmed run for fast local feedback. Repeated profiles are diagnostic evidence.
  If repeated-run gating is added later, latency/style budgets should use p90;
  hard structural invariants such as React fanout, document patches, rect
  reads, and mounted-surface counts should use worst. Median is useful for
  trend reporting only, not for pass/fail.
- Checked large-profile budgets were tightened from repeated p90 evidence:
  `open-enum`, `open-date`, `switch-dirty-cell`, `open-far-enum`,
  `open-far-date`, and `commit-far-text` now have `maxStyleDurationMs <= 120`.
- The tracked saved profile fixture
  `tmp/json-table-primitive-interactions-profile.json` was refreshed from the
  current warmed fresh profile, so saved budget screening covers the current
  implementation instead of an older high-style baseline.
- Architecture tests guard repeatability, mounted-surface attribution, and trace
  mode.

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

Implemented cut:

- `JsonTableCellProps` is now grouped by ownership:
  - `cellProjection`
  - `primitiveEditing`
  - `structuredEditing`
  - `commit`
  - `hover`
- `SingleFileFormRow` creates stable shared group objects for primitive
  editing, structured editing, commit, and hover; only `cellProjection` is
  rebuilt per rendered cell because it contains the column, projected cell, and
  absolute column index.
- Editable/read-only cells, primitive control, shell handlers, structured
  active cells, and memo comparison now consume grouped props.
- `components/json-table/ARCHITECTURE.md` documents the cell prop ownership
  contract.
- `tests/json-table-architecture.test.ts` guards the grouped type surface,
  grouped row construction, grouped memo comparison, and documentation.
- `PROFILE_SERVER_MODE=existing pnpm verify:json-table-performance:fresh`
  passes after the grouping cut; active-cell interactions still avoid table/row
  rerenders and the large profile keeps bounded render counts.

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

Implemented cut:

- `useJsonTableStructuredCellController` now stores
  `projectedValueAtCommit` with the structured pending value.
- Structured pending state remains visible only while the projected value still
  equals `projectedValueAtCommit`.
- A cloned parent echo that matches the structured pending value clears pending
  state.
- A divergent projected value clears pending state; the parent value wins.
- `tests/json-table-controller.test.tsx` covers pre-echo visibility, cloned
  echo clearing, and divergent parent replacement.
- `components/json-table/ARCHITECTURE.md` documents the structured pending
  policy.
- `tests/json-table-architecture.test.ts` guards the policy vocabulary.

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

Implemented cut:

- Kept `visibleThrough`.
- The call-site sentences are slightly unusual but precise: the phrase names the
  local owner that keeps a committed value visible before the parent echo is
  reconciled.
- `commitVisibilityOwner` and `localVisibilityOwner` are more verbose without
  making the two enum values clearer.
- `preEchoVisibilityOwner` is more explicit but leaks parent-echo timing into
  every commit call site.
- `components/json-table/json-table-cell-commit.ts` carries the final
  vocabulary comment.
- `components/json-table/ARCHITECTURE.md` documents `visibleThrough` as the
  final commit-lifecycle field.
- `tests/json-table-architecture.test.ts` guards the current name and rejects
  old candidate names.

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

Implemented cut:

- JSON-table code now translates `visibleColumns` to `schemaVisibleColumns` at
  the virtualized-table boundary.
- Mounted body virtualizer items are named `renderedBodyColumnItems`.
- Row projection indexes are carried as `projectedCellIndexes`.
- JSON-table spacer widths use `leftPadWidthPx` and `rightPadWidthPx`.
- Generic fixed-grid virtualizer inputs remain `columnItems`, `leftPad`, and
  `rightPad` only at the generic utility boundary.
- `tests/json-table-architecture.test.ts` guards the boundary names and rejects
  ambiguous local destructuring.

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

Implemented cut:

- `components/json-table/ARCHITECTURE.md` now includes a DataCell activation
  state machine covering display, command, edit activation, activation source
  storage, active control render, opening-context consumption, and dismissal.
- The same section names the invariants:
  - pointer activation stores pointer coordinates and arms a one-shot click
    tail
  - keyboard activation stores a keyboard source and does not arm a pointer
    tail
  - boolean activation commits as a command without mounting an editor
  - modifier-key events do not activate editing
  - `storeDataCellActivationSource()` is the only DataCell `flushSync` boundary
  - select and picker controls consume `useDataCellOpeningContext()`
- `tests/json-table-architecture.test.ts` guards that the activation state
  machine and policy terms remain documented.

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

Implemented cut:

- `tests/json-table-interaction-test-utils.tsx` remains the shared production-like
  row harness for primitive interaction tests.
- `tests/json-table-text-number-interactions.test.tsx` now uses
  `renderInteractionRow` instead of locally recreating primitive active store,
  primitive edit store, structured session state, and rendered-column-window
  wiring.
- `tests/json-table-boolean-enum-interactions.test.tsx` now uses
  `renderInteractionRow` with its custom schema/document instead of carrying a
  local row harness copy.
- `tests/json-table-architecture.test.ts` guards that those tests import the
  shared harness and do not reintroduce the duplicated row-session wiring.

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

Implemented cut:

- `tests/json-table-architecture.test.ts` now includes
  `importedModuleSpecifiers()`, a small import-specifier parser for architecture
  rules that should apply to actual imports instead of arbitrary text.
- DataCell registry runtime files now have a semantic import-graph guard:
  - no import from `@/components/json-table`
  - no import back through the public `@/components/ui/data-cell` barrel
- The old string guards remain for deleted compatibility vocabulary,
  controlled `flushSync` ownership, and hard-cutover names.

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

Implemented cut:

- `components/json-table/ARCHITECTURE.md` now has a `Current Documents` section
  near the top.
- The section names the canonical read order:
  - architecture file
  - this issue ledger
  - style invalidation findings
  - checked performance budget
  - primitive interaction profiler
  - saved and fresh budget verifiers
- The section states that older JSON-table blueprints are historical unless the
  current ledger points back to them.
- `tests/json-table-architecture.test.ts` guards the indexed document paths.

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

Implemented cut:

- `components/json-table/ARCHITECTURE.md` now extends the verification contract
  with DataCell changed-file rules.
- Runtime DataCell artifact changes require `pnpm verify:data-cell-registry`.
- Public barrel changes require `pnpm verify:data-cell`.
- Registry/public artifact changes require `pnpm verify:data-cell-registry`.
- The architecture doc states that JSON-table tests should import through
  `components/ui/data-cell` unless intentionally proving DataCell internals.
- `tests/json-table-architecture.test.ts` guards the acceptance text and the
  `verify:data-cell` / `verify:data-cell-registry` package scripts.
- `pnpm verify:data-cell-registry` passes.

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
- Header rendering is virtualized with the editable body column window.
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

The next cut should be final proof hardening and latency tightening, not another
speculative refactor. The repeated trace run, budget aggregate policy, and
array-horizontal proof decision are now recorded, so the remaining work is:

1. Keep the canonical `pnpm verify:json-table` gate green after each proof or
   budget update.
2. If repeated-run gating is implemented, validate p90 for latency/style and
   worst for hard structural invariants.
3. Make another CSS/DOM structural cut only if trace evidence points to a
   specific mounted surface or selector family.

That order keeps the work honest: the core architecture is now coherent, so the
remaining work should prove and tighten the user-visible edges.
