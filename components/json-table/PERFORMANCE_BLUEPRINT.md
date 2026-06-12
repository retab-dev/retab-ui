# JSON Table Performance Blueprint

## Purpose

This is the performance contract for `components/json-table`.

The architecture is clean; the next frontier is runtime behavior. Performance
perfection here means:

- The table keeps DOM size bounded.
- Scroll work stays inside the frame budget.
- Read-only rendering does not load editing-only machinery.
- Model work happens outside hot scroll paths.
- Profiling results, not taste, decide whether a change is needed.

## Current Profile Baseline

Original profile measured with headless Google Chrome through CDP on:

```text
http://localhost:3100/viewers-preview
```

Mode:

```text
next dev + headless Chrome CDP
```

Important caveats:

- This is a development build, so React and Turbopack overhead are inflated.
- The current dirty tree has unrelated schema-editor errors around
  `object-template-menu`, and `HeaderSchemaMenu` pulls schema-editor code into
  the JSON table bundle even when the table is read-only.
- Production profiling must be the final judge.

Original observed baseline:

| Metric                     | Value     |
| -------------------------- | --------- |
| First contentful paint     | ~316 ms   |
| Load event                 | ~417 ms   |
| Virtual scroll height      | 48,000 px |
| Viewport height            | 367 px    |
| Initial mounted rows       | 45        |
| Initial mounted data cells | 294       |
| Max mounted rows           | 75        |
| Max mounted data cells     | 504       |
| Small-scroll p50 frame     | ~58 ms    |
| Small-scroll p95 frame     | ~68 ms    |
| Small-scroll max frame     | ~72 ms    |
| Layout total               | ~16.6 ms  |
| Paint total                | ~22.7 ms  |
| EventDispatch total        | ~4.36 s   |
| UpdateLayoutTree total     | ~4.32 s   |

Verdict:

- DOM virtualization is working.
- Layout and paint are not the primary bottlenecks.
- Scroll is dominated by React event work and style recalculation.
- The performance ideal has not been reached yet.

## Executed Pass

Implemented changes:

- Added an isolated profile route:
  `http://localhost:3100/json-table-profile`.
- Added repeatable profiler script: `scripts/profile-json-table.mjs`.
- Removed eager schema-editor loading from read-only header rendering by
  lazy-loading `HeaderSchemaMenu` only when schema editing can open.
- Moved misplaced schema-editor property operations out of
  `components/json-table`.
- Tuned default overscan from `30` to `12`.

Measured candidates:

| Overscan | Initial cells | Small p50 | Small p95 | Large p95 | Long tasks |
| -------- | ------------- | --------- | --------- | --------- | ---------- |
| 8        | 140           | ~22 ms    | ~29 ms    | ~67 ms    | 0          |
| 12       | 168           | ~22 ms    | ~26 ms    | ~55 ms    | 0          |
| 16       | 196           | ~25 ms    | ~28 ms    | ~59 ms    | 0          |

Decision:

- Keep `12`.
- `8` saves DOM but worsens scroll.
- `16` adds DOM and worsens scroll.
- `12` is the best measured dev-build tradeoff.

Current post-pass profile on `json-table-profile` with overscan `12`:

| Metric                     | Value    |
| -------------------------- | -------- |
| First contentful paint     | ~136 ms  |
| Load event                 | ~208 ms  |
| Initial mounted rows       | 27       |
| Initial mounted data cells | 168      |
| Small-scroll p50 frame     | ~22 ms   |
| Small-scroll p95 frame     | ~25.5 ms |
| Small-scroll max frame     | ~29 ms   |
| Small-scroll long tasks    | 0        |
| Large-jump p95 frame       | ~45.5 ms |
| Layout total, small scroll | ~11.5 ms |
| Paint total, small scroll  | ~12.5 ms |
| EventDispatch total        | ~1.42 s  |
| UpdateLayoutTree total     | ~1.39 s  |

Post-pass verdict:

- DOM budget now passes comfortably.
- Long-task budget now passes.
- Small-scroll p95 budget now passes.
- Small-scroll p50 is still slightly above the strict ideal.
- Large-jump p95 now passes the strict target.
- Remaining work is style recalculation and React scroll dispatch, not DOM size.

## Second Executed Pass

Implemented changes:

- Precomputed field metadata once per visible column instead of walking the
  schema from every mounted cell.
- Removed per-row sheet option store subscriptions; rows now receive fixed row
  height and column width from the virtualized table.
- Added a true read-only cell path that renders display cells without cell
  editing hooks or the editor dispatcher.
- Kept row virtualization fixed-height and moved viewport windowing onto the
  shared fixed-row virtualizer used by dense grid viewers.
- Reused `HeaderGridCell.leafCount` instead of recomputing leaf descendants
  while rendering headers.

Current post-pass profile on `json-table-profile` with overscan `12`:

| Metric                        | Value    |
| ----------------------------- | -------- |
| Initial mounted rows          | 27       |
| Initial mounted data cells    | 168      |
| Initial DOM nodes             | 668      |
| Small-scroll p50 frame        | ~8.3 ms  |
| Small-scroll p95 frame        | ~24.4 ms |
| Small-scroll max frame        | ~28.6 ms |
| Small-scroll long tasks       | 0        |
| Large-jump p50 frame          | ~20.8 ms |
| Large-jump p95 frame          | ~30.6 ms |
| Large-jump long tasks         | 0        |
| Layout total, small scroll    | ~3.2 ms  |
| Paint total, small scroll     | ~5.9 ms  |
| EventDispatch total, small    | ~176 ms  |
| UpdateLayoutTree total, small | ~161 ms  |
| EventDispatch total, large    | ~1.77 s  |
| UpdateLayoutTree total, large | ~1.70 s  |

Second-pass verdict:

- Small-scroll median is now comfortably inside one 60 FPS frame.
- Small-scroll p95 still has occasional batch-update spikes, but no long tasks.
- Large-jump p95 now passes the stricter 33 ms target.
- The remaining bottleneck is the browser's React/style work during row-window
  replacement, not steady-state scrolling.

## Third Executed Pass

Implemented changes:

- Split cell rendering by responsibility:
  - `read-only-json-table-cell.tsx` renders display-only projected cells.
  - `editable-json-table-cell.tsx` owns editor hooks and editor dispatch.
  - `single-file-form-row.tsx` selects the projected cell path directly.
- Kept the editable cell behind a dynamic import so read-only rendering does not
  statically import `CellEditor`, editor hooks, object editors, popovers, or
  select/date editor modules.
- Added `json-table-cell-types.ts` so both paths share props without sharing runtime
  code.

Current post-pass profile on `json-table-profile` with overscan `12`:

| Metric                        | Value    |
| ----------------------------- | -------- |
| Initial mounted rows          | 27       |
| Initial mounted data cells    | 168      |
| Initial DOM nodes             | 661      |
| Small-scroll p50 frame        | ~8.3 ms  |
| Small-scroll p95 frame        | ~26.1 ms |
| Small-scroll max frame        | ~28.5 ms |
| Small-scroll long tasks       | 0        |
| Large-jump p50 frame          | ~20.5 ms |
| Large-jump p95 frame          | ~29.7 ms |
| Large-jump long tasks         | 0        |
| Layout total, small scroll    | ~3.3 ms  |
| Paint total, small scroll     | ~5.8 ms  |
| EventDispatch total, small    | ~182 ms  |
| UpdateLayoutTree total, small | ~166 ms  |
| EventDispatch total, large    | ~1.75 s  |
| UpdateLayoutTree total, large | ~1.69 s  |

Third-pass verdict:

- The main win is architectural: read-only cells no longer sit in the editor
  module graph.
- Runtime scroll remains in the same band as the second pass, with slightly
  better large-jump p95 and fewer initial DOM nodes.
- The remaining performance ceiling is still row-window replacement, not
  editor code on the read-only route.

## Fourth Executed Pass

Implemented changes:

- Reused mounted row slots in read-only mode:
  - read-only rows are keyed by virtual slot
  - editable rows stay keyed by document row index to keep editor state tied to
    the correct row
- Passed each `SingleFileFormRow` its `projectedRow` instead of the full
  `projectedRows` array.

Current post-pass profile on `json-table-profile` with overscan `12`:

| Metric                        | Value    |
| ----------------------------- | -------- |
| Initial mounted rows          | 27       |
| Initial mounted data cells    | 168      |
| Initial DOM nodes             | 661      |
| Small-scroll p50 frame        | ~8.3 ms  |
| Small-scroll p95 frame        | ~22.9 ms |
| Small-scroll max frame        | ~48.5 ms |
| Small-scroll long tasks       | 0        |
| Large-jump p50 frame          | ~10.6 ms |
| Large-jump p95 frame          | ~27 ms   |
| Large-jump long tasks         | 0        |
| EventDispatch total, small    | ~88 ms   |
| UpdateLayoutTree total, small | ~66 ms   |
| EventDispatch total, large    | ~804 ms  |
| UpdateLayoutTree total, large | ~714 ms  |

Fourth-pass verdict:

- Slot reuse reduced React/style replacement work without changing editable row
  identity.
- Large-jump p50 and p95 improved materially.
- Small-scroll p95 improved; one dev-run raster outlier kept max high, but it
  was not a JavaScript long task.
- The remaining spike source is mostly browser raster/compositing variance and
  the unavoidable prop update burst when a reused slot points at a new row.

## Fifth Executed Pass

Implemented changes:

- Replaced the row contract:
  - before: `visibleKeys`, `fieldMetadataByKey`, `columnWidth`
  - after: `visibleColumns`
- `visibleColumns` carries the facts each cell needs:

```ts
Array<{
  key: string
  fieldMetadata?: FieldMetadata
  widthPx: number
}>
```

- Kept `visibleKeys` only as a local projection input so column-width changes do
  not rebuild projected document rows.
- Removed per-cell width derivation from read-only and editable cells.

Current post-pass profile on `json-table-profile` with overscan `12`:

| Metric                        | Run 1    | Run 2    |
| ----------------------------- | -------- | -------- |
| Initial mounted rows          | 27       | 27       |
| Initial mounted data cells    | 168      | 168      |
| Initial DOM nodes             | 661      | 661      |
| Small-scroll p50 frame        | ~8.3 ms  | ~8.3 ms  |
| Small-scroll p95 frame        | ~24.1 ms | ~24.9 ms |
| Small-scroll long tasks       | 0        | 0        |
| Large-jump p50 frame          | ~9.9 ms  | ~9.9 ms  |
| Large-jump p95 frame          | ~31.3 ms | ~30.6 ms |
| Large-jump long tasks         | 0        | 0        |
| EventDispatch total, small    | ~87 ms   | ~88 ms   |
| UpdateLayoutTree total, small | ~68 ms   | ~68 ms   |
| EventDispatch total, large    | ~826 ms  | ~828 ms  |
| UpdateLayoutTree total, large | ~740 ms  | ~741 ms  |

Fifth-pass verdict:

- This is a code-shape win more than a speed win.
- The row API is simpler and higher-signal.
- Small-scroll p50 and dispatch/layout totals remain excellent.
- Large-jump p95 is slightly noisier than the best fourth-pass profile but still
  has no long tasks and stays inside the regression budget.

## Sixth Executed Pass

Implemented changes:

- Memoized `ReadOnlyJsonTableCell` with a read-only-specific comparator:
  - column key
  - column width
  - column metadata
  - materialized field path
  - projected value
  - schema fallback identity
- Added shared width style helpers:
  - `getCellWidthStyle(widthPx)`
  - `getSelectableCellWidthStyle(widthPx)`
- Removed repeated inline cell width style objects from read-only and editable
  cells.

Current post-pass profile on `json-table-profile` with overscan `12`:

| Metric                        | Value    |
| ----------------------------- | -------- |
| Initial mounted rows          | 27       |
| Initial mounted data cells    | 168      |
| Initial DOM nodes             | 661      |
| Small-scroll p50 frame        | ~8.3 ms  |
| Small-scroll p95 frame        | ~21.6 ms |
| Small-scroll max frame        | ~44.7 ms |
| Small-scroll long tasks       | 0        |
| Large-jump p50 frame          | ~9.8 ms  |
| Large-jump p95 frame          | ~31.1 ms |
| Large-jump long tasks         | 0        |
| EventDispatch total, small    | ~85 ms   |
| UpdateLayoutTree total, small | ~67 ms   |
| EventDispatch total, large    | ~821 ms  |
| UpdateLayoutTree total, large | ~736 ms  |

Sixth-pass verdict:

- Small-scroll p95 improved again.
- Read-only cell rerender logic is now explicit and local.
- Shared cell style objects removed one more repeated allocation path.
- Large-jump p95 remains in the same noisy dev-build band; the next meaningful
  experiment is replacing the virtual body table semantics with a div grid, but
  that is a larger measured experiment rather than a quick win.

## Performance Ideal

The table should feel boring under load.

Target behavior:

- Initial render mounts only the rows needed for the viewport plus deliberate
  overscan.
- Scroll updates do not remount more cells than necessary.
- Small scrolling stays near one browser frame on a modern machine.
- Large jumps converge quickly without long chains of scroll tasks.
- Editing code is absent from read-only table startup.
- Header schema-edit code loads only when editing is possible and the menu is
  opened.

## Non-Negotiable Metrics

Use these targets for production builds first, then compare against dev builds.

### DOM Budget

- Initial mounted data cells: under 350.
- Peak mounted data cells during normal scroll: under 550.
- Peak mounted rows during normal scroll: under 80.
- Total document nodes after idle: under 2,500 for the current demo route.

The current virtualization passes this class of budget.

### Scroll Budget

For small-increment scroll:

- p50 frame interval: under 20 ms.
- p95 frame interval: under 35 ms.
- max frame interval: under 50 ms.
- long tasks during a 120-frame scroll pass: fewer than 5.

For large jumps:

- p95 frame interval: under 50 ms.
- no repeated 60 ms scroll tasks after the target window is mounted.

The current dev profile fails this class of budget.

### Work Attribution Budget

During scroll:

- `Layout` should remain low; current behavior is acceptable.
- `Paint` should remain low; current behavior is acceptable.
- `EventDispatch` must not dominate the trace.
- `UpdateLayoutTree` must not repeatedly consume ~60 ms per scroll step.
- React DOM work should not appear as the top event for every scroll frame.

## Suspected Bottlenecks

### Overscan Is Probably Too High

Previous default:

```ts
overscan = 30
```

With a 367 px viewport and 32 px rows, that can mount roughly:

```text
visible rows (~12) + overscan before (30) + overscan after (30)
```

That explains the 75-row / 504-cell peaks.

Executed result:

- `8`, `12`, and `16` were measured in dev mode.
- `12` is the retained default.
- `12` reduced initial mounted cells from 294 to 168.
- `12` removed scroll long tasks in the measured pass.
- Further scroll gains must come from event/style work, not lower overscan.

### Scroll Updates Still Trigger Too Much React Work

The row virtualizer correctly uses fixed-height arithmetic, but every window
shift still causes React reconciliation for many cells.

Target:

- Confirm that `SingleFileFormRow` and `DataCell` memoization holds during
  scroll.
- Count row renders and cell renders in a profiling-only build.
- Ensure row style identity is stable.
- Ensure projected row/cell references are stable across scroll-only updates.
- Avoid passing freshly allocated objects into memoized rows or cells unless
  they are inside the row itself.

### Style Recalculation Is Too Expensive

`UpdateLayoutTree` dominates the trace while `Layout` and `Paint` stay low. That
usually means many style-invalidated nodes, complex selectors, or repeated
class/style churn.

Target:

- Keep scroll-position updates isolated to row transforms.
- Avoid changing class names on many cells during scroll.
- Keep hover/focus state local to the active cell only.
- Audit Tailwind selectors on table rows/cells for expensive state selectors.
- Consider a minimal table-specific class surface if utility classes generate
  costly recalculation during row remounts.

### Read-Only Mode Loads Editing Code

`HeaderSchemaMenu` imports schema-editor `PropertyEditor` at module load time.
That means read-only JSON table rendering can pull schema-editor code even when
schema editing is impossible.

Current issue:

- The dirty tree has an unrelated missing-module error:
  `@/components/schema-editor/object-template-menu`.
- JSON table read-only rendering should not be sensitive to that path.

Target:

- `HeaderSchemaMenu` should not be imported or rendered when
  `schemaEditMode === "readOnly"` and schema editing is unavailable.
- Schema-editor code should be dynamically imported only when the schema menu can
  open.
- Read-only table startup should not depend on property-form or schema-builder
  modules.

## Optimization Plan

### Phase 1: Establish A Production Baseline

Create a repeatable profiling script that records:

- route
- build mode
- Chrome version
- viewport size
- mounted rows/cells before scroll
- mounted rows/cells after scroll
- frame intervals
- long tasks
- `Performance.getMetrics`
- trace summaries for:
  - `EventDispatch`
  - `FunctionCall`
  - `UpdateLayoutTree`
  - `Layout`
  - `Paint`

Run it against:

- `next dev`
- production server, when the dirty tree can build

Do not optimize against a single dev trace unless production confirms the same
shape.

### Phase 2: Remove Read-Only Editing Weight

Goal:

- Read-only JSON table must not import schema-editor modules.

Implementation direction:

- Split the editable header schema menu boundary.
- In `header-cell.tsx`, only render schema-menu wiring when editing is possible.
- Dynamically import heavy schema-editor UI inside the editable menu path.
- Keep delete/reorder/fold model logic outside schema-editor imports.

Success criteria:

- `/viewers-preview` loads with JSON table even if optional schema-editor modules
  are broken.
- Browser bundle for read-only JSON table no longer includes property-form code.
- Headless profile no longer logs schema-editor module resolution errors.

### Phase 3: Tune Overscan

Goal:

- Reduce mounted rows/cells without blanking during normal scroll.

Implementation direction:

- Change default overscan from `30` to the smallest value that passes scroll
  tests.
- Test `8`, `12`, `16`, and `24`.
- Capture metrics for each value.

Success criteria:

- Peak mounted cells drops meaningfully below 504.
- p95 frame interval improves.
- No visible blank window during normal wheel/touchpad scroll.

### Phase 4: Prove Memoization

Goal:

- Scroll should re-render only rows entering/leaving the window and rows whose
  absolute position changed.

Implementation direction:

- Add temporary profiling counters behind a local flag, not committed unless
  they become a clean test utility.
- Count renders for:
  - `SingleFileVirtualizedTable`
  - `SingleFileFormRow`
  - `DataCell`
  - `CellEditor`
- Compare counts for a fixed 120-frame scroll pass.

Success criteria:

- Existing mounted rows do not re-render from unrelated prop identity churn.
- Cells do not re-render when their projected cell and editor state are
  unchanged.

### Phase 5: Attack Style Recalculation

Goal:

- Lower `UpdateLayoutTree` during scroll.

Implementation direction:

- Audit classes on virtual rows and cells.
- Remove class changes from scroll paths.
- Keep row movement to `transform`.
- Keep cell dimensions stable.
- Consider replacing repeated utility-heavy cell class strings with stable class
  constants.
- Check whether table semantics are costing more than a div-grid for this
  virtualized surface; switch only if profiling proves it.

Success criteria:

- `UpdateLayoutTree` no longer dominates scroll traces.
- `Layout` and `Paint` remain low.

## Profiling Protocol

Use headless Chrome, not jsdom.

Minimum route:

```text
http://localhost:3100/viewers-preview
```

Preferred future route:

```text
http://localhost:3100/json-table-profile
```

This route now exists and renders only `JsonTableDemo`, avoiding unrelated viewer
and docs code.

Profiler:

```bash
PROFILE_URL=http://localhost:3100/json-table-profile node scripts/profile-json-table.mjs
```

Profile scenarios:

1. Initial load to idle.
2. Small-increment scroll: 120 frames, ~20 px per frame.
3. Large-jump scroll: 120 frames, hundreds of px per frame.
4. Scroll to bottom, idle, scroll back to top.
5. Hover one cell while idle.
6. Open object/array editor in editable mode.

Capture:

- frame interval p50/p95/max
- long task count and max duration
- mounted row/cell count
- total DOM nodes
- JS heap used
- layout/style/paint/script durations
- top trace events

## Regression Gates

Performance is acceptable only when the production profile passes:

```text
small scroll p50 < 20 ms
small scroll p95 < 35 ms
small scroll max < 50 ms
long tasks during small scroll < 5
peak mounted data cells < 550
read-only JSON table loads without schema-editor module dependency
```

Dev builds may be slower, but they should preserve the same shape:

- bounded DOM
- no schema-editor dependency in read-only mode
- no repeated 60 ms scroll tasks caused by table code alone

## Non-Goals

- Do not replace the table architecture because one dev trace is slow.
- Do not reintroduce third-party table abstractions.
- Do not optimize by hiding correctness bugs.
- Do not add memoization that obscures ownership without measured benefit.
- Do not add a benchmark that depends on private Radix or browser DOM structure.

## Done Means

The performance pass is complete when:

- profiling is repeatable from a script
- read-only startup is isolated from schema-editor code
- production scroll passes the frame budget
- mounted row/cell counts remain bounded
- trace attribution no longer points primarily at repeated scroll React work
- the performance numbers are recorded before and after the optimization
