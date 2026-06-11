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

Measured with headless Google Chrome through CDP on:

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

Observed baseline:

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

Current default:

```ts
overscan = 30
```

With a 367 px viewport and 32 px rows, that can mount roughly:

```text
visible rows (~12) + overscan before (30) + overscan after (30)
```

That explains the 75-row / 504-cell peaks.

Target:

- Default overscan should be measured, not inherited.
- Try `8`, `12`, and `16`.
- Keep keyboard/page-scroll behavior acceptable.
- Prefer adaptive overscan only if fixed overscan cannot satisfy both smoothness
  and blank-free scrolling.

### Scroll Updates Still Trigger Too Much React Work

The virtualizer correctly uses fixed-row arithmetic, but every window shift still
causes React reconciliation for many cells.

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
  `editMode === "readOnly"` and schema editing is unavailable.
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

The preferred route should render only `JsonTableDemo`, avoiding unrelated
viewer and docs code.

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
