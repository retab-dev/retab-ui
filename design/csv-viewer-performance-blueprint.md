# CSV Viewer Performance Blueprint

## Purpose

Make the CSV viewer faster where users still feel cost, without disturbing the
row-pool scroll architecture that is already working.

The current vertical scroll path is strong. The next gains should come from
load/parse responsiveness, sort latency, state-copy reduction, and the cases
where the fast row patcher intentionally falls back to React.

## Current Shape

Primary files:

| Responsibility | File |
| --- | --- |
| Public viewer wrapper and controls | `registry/new-york-v4/ui/csv-viewer.tsx` |
| Resource loading and parser orchestration | `registry/new-york-v4/ui/csv-viewer-state.ts` |
| Grid composition, sort state, row pool wiring | `registry/new-york-v4/ui/csv-viewer-grid.tsx` |
| Imperative row scroll patching | `registry/new-york-v4/ui/csv-viewer-row-patcher.ts` |
| Fixed grid math and scroll scheduling | `registry/new-york-v4/ui/fixed-grid-virtualization.ts` |
| Sort comparator and row-order creation | `registry/new-york-v4/ui/csv-viewer-sort.ts` |
| Parser, streaming parser, normalizer | `registry/new-york-v4/lib/csv.ts` |
| Worker wrapper and worker implementation | `registry/new-york-v4/ui/csv-viewer-worker.ts`, `registry/new-york-v4/ui/csv-viewer.worker.ts` |
| Benchmark route and profiler | `app/(view)/scrollbench/*`, `scripts/profile-csv-scrollbench.mjs` |

Already good:

- rows are fixed height;
- columns are fixed width;
- large row sets use `useFixedRowPool`;
- vertical scroll at the left edge patches existing row DOM instead of forcing
  React to reconcile every row and cell;
- React regains canonical ownership after scrolling settles;
- the checked-in 20k x 18 ScrollBench profile reports zero child-list churn and
  sub-10ms p95 frames.

## Non-Goals

- Do not replace the fixed-grid infrastructure.
- Do not replace the row patcher with a generic virtualizer.
- Do not make CSV cells editable in this work.
- Do not add a compatibility layer for old CSV behavior.
- Do not optimize visual styling before measuring a runtime bottleneck.

## Diagnosis

### 1. Text Sources Parse Synchronously

`useCsvResourceState` parses `kind: "text"` resources inside `useMemo` with
`parseCsv`. That blocks render for large text sources and bypasses the worker
path used by blob sources.

`parseCsv` also materializes all parser records before normalization:

```ts
const records = parser.push(input).concat(parser.flush())
```

That creates an avoidable intermediate table before the final `rows` table.

### 2. Streaming Load Copies The Whole Row Prefix Per Batch

Resource streaming appends each 5k-row batch into `sourceRows`, then publishes
`sourceRows.slice()`. Completion slices again.

This gives a simple immutable React state shape, but large files pay repeated
prefix-copy cost while loading. A million-row file should not copy hundreds of
millions of row references just to show progressive progress.

### 3. Sort Is Main-Thread And Comparator-Heavy

`sortedRowOrder` creates one row-index array and sorts it with a comparator that
re-reads row cells and re-runs numeric coercion for every comparison.

That is correct and deterministic, but it is not the target shape for large
tables. Sort should precompute keys once per sorted column, cache reusable row
orders, and avoid blocking the main thread for large row counts.

### 4. The Fast Row Patch Path Is Narrow

`canPatchRows` currently requires:

- row virtualization enabled;
- no active cell;
- `scrollLeft === 0`;
- no column jump.

That is conservative and correct, but real source-linked workflows often have
an active CSV cell, and wide tables are often horizontally scrolled. Those cases
drop back to React-owned viewport commits during vertical scroll.

### 5. The Benchmark Covers The Solved Case Better Than The Open Cases

The existing ScrollBench CSV fixture covers a 20k x 18 table and exercises
vertical scroll. It does not yet put budgets around:

- initial open and parse time;
- text source versus blob source behavior;
- URL stream parsing;
- sort latency;
- active-cell/source-hover vertical scrolling;
- wide-table vertical scrolling after horizontal scroll;
- memory growth while streaming a very large CSV.

## Target Architecture

Keep the current row-pool grid. Tighten the surrounding expensive work.

| Work | Current Owner | Target Owner |
| --- | --- | --- |
| Text parse | Render-time `useMemo` | Async parser path, preferably worker-backed |
| URL stream parse | Main-thread stream parser | Worker-backed stream or worker-backed fetched blob |
| Loading row state | Flat copied `string[][]` per batch | Chunked row store with cheap version updates |
| Sort | Main thread comparator | Cached key projection, worker for large sorts |
| Active highlight during scroll | React fallback | Small imperative active-cell patch or overlay |
| Wide-table vertical scroll | React fallback after horizontal scroll | Fast row patch for stable horizontal windows |
| Performance evidence | Left-edge scroll profile | Load, sort, active-cell, wide-table budgets |

## Phase 1: Add Missing Performance Evidence

Do this before implementation. The current profiler proves that the left-edge
vertical row path is healthy; it does not prove the open cases.

Extend `scripts/profile-csv-scrollbench.mjs` or add a sibling script for CSV
specific scenarios.

Measure:

- time to first grid shell;
- time to first visible rows;
- time to ready state;
- long tasks during text parse, blob parse, and URL parse;
- row state updates during loading;
- total row references copied during loading;
- sort click to stable visible order;
- vertical scroll p95 with no active cell;
- vertical scroll p95 with active cell;
- vertical scroll p95 after horizontal scroll;
- mounted rows, cells, total DOM nodes, child-list churn;
- JS heap after ready and after sort.

Fixtures:

- 20k x 18 numeric CSV, matching current ScrollBench;
- 100k x 18 mixed text/numeric CSV;
- 20k x 200 wide CSV;
- CSV with long quoted fields;
- CSV with sparse ragged rows;
- URL-backed CSV if a local fixture route already exists.

Acceptance:

- The profiler can run against an already-running dev server.
- The profiler does not start, kill, or restart dev servers.
- Output is machine-readable JSON in an ignored artifact path.
- The first committed budgets are observational, then tightened after fixes.

## Phase 2: Unify Text, Blob, And URL Parsing Onto The Async Path

Remove the render-time special case for text parsing.

Work:

- Route text sources through the same async lifecycle as resource sources.
- Add worker support for text input, or wrap text in a `Blob` and use the
  existing worker path when the input crosses a small threshold.
- Keep tiny text CSVs eligible for synchronous parse only if profiling proves
  it avoids visible latency without adding branch complexity.
- Avoid `parseCsv` building an all-records intermediate array.
- Keep streaming cancellation through `AbortController`.
- Preserve current error mapping.

Target API shape:

```ts
type CsvParseInput =
  | { kind: "text"; text: string }
  | { kind: "blob"; blob: Blob }
  | { kind: "stream"; stream: ReadableStream<Uint8Array> }
```

Rules:

- Large parse work does not run during React render.
- Large parse work does not monopolize the main thread.
- The ready state shape remains `{ columns, sourceRows }` until Phase 3 lands.
- Existing parser correctness tests continue to pass.

Acceptance:

- Opening the 100k-row text fixture does not produce a parse long task on the
  main thread.
- Text, blob, and URL sources produce identical table output.
- Aborting a source switch terminates worker work and does not publish stale
  rows.

## Phase 3: Replace Prefix Copies With A Chunked Row Store

Make progressive loading cheap for very large CSVs.

Current loading shape:

```ts
sourceRows.push(...sourceRowBatch)
setState({ status: "loading", columns, sourceRows: sourceRows.slice() })
```

Target loading shape:

```ts
type CsvRowStore = {
  rowCount: number
  getRow(index: number): readonly string[]
  materializeRows(): string[][]
}
```

Work:

- Store parser batches as chunks during loading.
- Publish a cheap version update instead of cloning all row references.
- Teach `CsvGrid` to read rows through `getRow(index)` and `rowCount`.
- Keep final materialization only where export or existing public table APIs
  require `string[][]`.
- Prefer a small CSV-specific store over a generic abstraction.

Rules:

- Do not introduce duplicate row ownership paths.
- Do not materialize all rows during normal viewport scroll.
- Export can pay materialization cost because it is an explicit user action.
- Sort can read from the store or a materialized cache owned by sort state.

Acceptance:

- Loading a 1M-row fixture does not do repeated prefix copies.
- The grid can render progressively from chunked rows.
- Export output remains identical.
- Public `CsvTableSource` still works directly.

## Phase 4: Make Sorting Keyed, Cached, And Worker-Capable

Sorting should be proportional to row count, but it should not repeat cell
classification work for every comparator call.

Work:

- Build a per-column sort-key projection:

```ts
type CsvSortKey =
  | { kind: "number"; value: number; rowIndex: number }
  | { kind: "text"; value: string; rowIndex: number }
  | { kind: "empty"; rowIndex: number }
```

- Sort projected keys instead of repeatedly reading/coercing cells.
- Cache ascending row order by source identity and column index.
- Derive descending order while preserving stable ties.
- Move sort to a worker above a row-count threshold.
- Keep visible rows responsive while sort is pending.

Rules:

- Existing deterministic sort behavior stays intact.
- Mixed numeric/text total ordering stays intact.
- Equal values keep source order in both directions.
- Sort reset semantics stay tied to `csvViewerSortResetKey`.

Acceptance:

- 100k-row sort produces no main-thread long task.
- Re-sorting the same column reuses cached projection/order.
- Tests in `tests/csv-viewer-sort.test.tsx` and
  `tests/csv-parser-fuzz.test.ts` still pass.

## Phase 5: Expand The Fast Row Patch Path

Keep React as the canonical owner, but reduce avoidable fallbacks during real
CSV navigation.

### Active Cell

Current behavior disables row patching when `activeCell` exists. Replace that
with one of two precise models:

- an overlay positioned from row and column geometry; or
- imperative class updates for the previous and next active visible cells.

The overlay is cleaner if source-hover highlighting is transient. Class updates
are better if accessibility state needs to remain attached to the cell.

Acceptance:

- Vertical scroll with an active cell keeps zero child-list churn.
- Highlight does not stick to the wrong source row after scroll settle.
- Canonical React attributes are restored after the settle commit.

### Stable Horizontal Windows

Current behavior requires `scrollLeft === 0`. That leaves wide CSVs slower after
the user scrolls horizontally.

Work:

- Track whether the current column window is stable.
- Allow row patching when vertical scroll changes and the horizontal window has
  not changed.
- Keep fallback when a horizontal jump is in flight.
- Resync row handles after column window changes.

Acceptance:

- Vertical scroll at a non-zero horizontal offset uses the fast row patch path.
- Horizontal scroll still uses React-owned column virtualization.
- Wide-table profiler shows no row child-list churn during stable vertical
  scrolling.

## Phase 6: Parser Inner-Loop Improvements

Do this after moving parse work off render. Inner-loop work matters, but it is
less urgent than main-thread responsiveness.

Potential work:

- Replace character-by-character `field += c` with slice-based accumulation for
  long fields.
- Add a simple unquoted-line fast path for chunks that contain no quotes.
- Avoid allocating empty padding arrays repeatedly for ragged rows.
- Keep parser behavior covered by fuzz tests before and after each change.

Acceptance:

- Parser fuzz tests pass.
- Long quoted field fixtures improve without regressing ordinary numeric CSVs.
- The parser remains usable in both main-thread and worker contexts.

## Verification

Focused commands:

```bash
pnpm test -- tests/csv-viewer.test.tsx tests/csv-viewer-sort.test.tsx tests/csv-viewer-stream.test.ts tests/csv-parser-fuzz.test.ts tests/csv-row-patcher.test.tsx
pnpm typecheck
```

Performance command after Phase 1:

```bash
node scripts/profile-csv-scrollbench.mjs --assert
```

If the profiler is expanded, add a CSV-specific assertion command rather than
hiding multiple performance surfaces behind the existing left-edge scroll name.

## Rollout Order

1. Add measurement for unsolved scenarios.
2. Move large text parse off render.
3. Remove all-records intermediate allocation from `parseCsv`.
4. Replace loading prefix copies with a chunked row store.
5. Make sort keyed and cached.
6. Move large sort to a worker.
7. Keep row patching active with active-cell highlight.
8. Keep row patching active for stable non-zero horizontal scroll.
9. Tune parser inner loops only after the bigger ownership fixes are proven.

## Definition Of Done

The CSV viewer is faster when:

- opening a large CSV does not block first paint;
- loading very large CSVs does not repeatedly clone the row prefix;
- sorting large CSVs does not create a visible main-thread pause;
- active source-linked cells do not destroy vertical scroll performance;
- wide CSVs keep the fast vertical path after horizontal navigation;
- the benchmark suite covers those exact cases with committed budgets;
- existing rendering, export, sort determinism, and source-anchor behavior stay
  unchanged.
