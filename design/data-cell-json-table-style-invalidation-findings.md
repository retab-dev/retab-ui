# DataCell JSON Table Style Invalidation Findings

## Context

This note records the first controlled style-invalidation profile for the JSON
table after the DataCell-backed primitive editing refactor.

Command:

```sh
JSON_TABLE_STYLE_EXPERIMENTS=1 PROFILE_OUTPUT=tmp/json-table-primitive-interactions-profile.fresh.json node scripts/profile-json-table-primitive-interactions.mjs --assert
```

The profiler ran the normal `default` and `large` profiles plus diagnostic
large-table variants:

- `large-rows-120`: same large schema, fewer document rows
- `large-extra-columns-0`: large profile with no generated extra scalar columns
- `large-extra-columns-6`: large profile with six generated extra scalar columns
- `large-overscan-0`: large profile with row overscan and jump overscan set to
  zero

The measured scenarios are the remaining slow user-visible interactions:

- `open-enum`
- `open-date`
- `switch-dirty-cell`

## Measurements

| Profile                 | Scenario            | Elapsed | Style   | Layout | Editable renders | React commits | Rect reads |
| ----------------------- | ------------------- | ------- | ------- | ------ | ---------------- | ------------- | ---------- |
| `default`               | `open-enum`         | 348.9ms | 124.6ms | 0.5ms  | 2                | 3             | 1          |
| `default`               | `open-date`         | 165.7ms | 92.8ms  | 0.5ms  | 2                | 4             | 2          |
| `default`               | `switch-dirty-cell` | 135.4ms | 90.6ms  | 0.3ms  | 8                | 5             | 0          |
| `large`                 | `open-enum`         | 429.8ms | 376.0ms | 0.5ms  | 2                | 3             | 1          |
| `large`                 | `open-date`         | 446.4ms | 369.0ms | 0.5ms  | 2                | 4             | 2          |
| `large`                 | `switch-dirty-cell` | 417.9ms | 363.5ms | 0.3ms  | 8                | 5             | 0          |
| `large-rows-120`        | `open-enum`         | 429.8ms | 376.2ms | 0.5ms  | 2                | 3             | 1          |
| `large-rows-120`        | `open-date`         | 449.5ms | 381.3ms | 0.5ms  | 2                | 4             | 2          |
| `large-rows-120`        | `switch-dirty-cell` | 435.7ms | 382.3ms | 0.3ms  | 8                | 5             | 0          |
| `large-extra-columns-0` | `open-enum`         | 230.5ms | 180.7ms | 0.5ms  | 2                | 3             | 1          |
| `large-extra-columns-0` | `open-date`         | 261.1ms | 186.0ms | 0.5ms  | 2                | 4             | 2          |
| `large-extra-columns-0` | `switch-dirty-cell` | 227.5ms | 180.2ms | 0.3ms  | 8                | 5             | 0          |
| `large-extra-columns-6` | `open-enum`         | 297.8ms | 241.5ms | 0.5ms  | 2                | 3             | 1          |
| `large-extra-columns-6` | `open-date`         | 321.1ms | 244.8ms | 0.5ms  | 2                | 4             | 2          |
| `large-extra-columns-6` | `switch-dirty-cell` | 292.3ms | 243.3ms | 0.3ms  | 8                | 5             | 0          |
| `large-overscan-0`      | `open-enum`         | 249.6ms | 201.9ms | 0.5ms  | 2                | 3             | 1          |
| `large-overscan-0`      | `open-date`         | 279.8ms | 209.8ms | 0.5ms  | 2                | 4             | 2          |
| `large-overscan-0`      | `switch-dirty-cell` | 278.4ms | 208.2ms | 0.3ms  | 8                | 5             | 0          |

## Findings

The remaining large-table delay is still browser style recalculation, not React
render fanout.

The row-count experiment is decisive: reducing the document from 720 rows to
120 rows did not reduce style cost. That points away from total document size
and toward the mounted/visible table surface.

The generated-column experiment is also decisive: removing the extra generated
columns cuts large-profile style cost from roughly 360-380ms to roughly
180-186ms. Six extra columns lands in the middle, around 241-245ms. Style cost
therefore scales strongly with mounted column surface.

The overscan experiment is meaningful: setting overscan to zero cuts the same
large interactions to roughly 201-210ms style cost. Overscan is not the only
cause, but mounted row surface contributes materially.

React work remains bounded across all variants:

- `open-enum`: 2 editable renders, 3 React commits, 1 rect read
- `open-date`: 2 editable renders, 4 React commits, 2 rect reads
- `switch-dirty-cell`: 8 editable renders, 5 React commits, 0 rect reads

## Next Optimization Target

The next runtime optimization should focus on the mounted virtualized surface,
not document state:

- reduce active editable cell CSS invalidation across sibling columns
- inspect selectors that apply hover, active, focus, or pseudo-element styling
  across every mounted cell
- consider narrower containment at cell surfaces if it does not break overlays
  or focus rings
- keep column-count experiments in the profiler as the primary proof for CSS
  invalidation changes

The profile does not support a document-model rewrite as the next performance
move. It supports a DOM/CSS mounted-surface investigation.

## Implemented Cut: Editable Overscan

Editable tables now default to zero row overscan. Read-only tables keep the
larger row buffer because their scroll path uses row patching and does not mount
primitive editors.

Fresh profile after the cut:

| Profile | Scenario            | Elapsed | Style   | Layout | Editable renders | React commits | Rect reads |
| ------- | ------------------- | ------- | ------- | ------ | ---------------- | ------------- | ---------- |
| `large` | `open-enum`         | 260.5ms | 210.3ms | 0.5ms  | 2                | 3             | 1          |
| `large` | `open-date`         | 276.2ms | 208.1ms | 0.5ms  | 2                | 4             | 2          |
| `large` | `switch-dirty-cell` | 258.2ms | 204.7ms | 0.3ms  | 8                | 5             | 0          |

Saved fixture after the cut:

| Profile | Scenario            | Elapsed | Style   | Layout | Editable renders | React commits | Rect reads |
| ------- | ------------------- | ------- | ------- | ------ | ---------------- | ------------- | ---------- |
| `large` | `open-enum`         | 259.4ms | 202.4ms | 0.6ms  | 2                | 3             | 1          |
| `large` | `open-date`         | 332.8ms | 207.0ms | 0.5ms  | 2                | 4             | 2          |
| `large` | `switch-dirty-cell` | 252.8ms | 204.8ms | 0.3ms  | 8                | 5             | 0          |

The saved performance budget now protects this lower baseline with large-profile
style limits around 180-300ms depending on the interaction.

Remaining style work is now column/CSS-surface focused. The overscan cut removes
roughly half of the large-profile style cost without changing the React render
shape.

## Implemented Cut: Editable Body Column Window

Editable tables now render a horizontal body column window instead of mounting
every editable body cell. Header rendering is still eager; this cut only reduces
the body surface. The row receives one `JsonTableRenderedColumnWindow`, and the
window model now lives in `json-table-rendered-column-window.ts` with separate
full-window and virtual-window constructors.

Fresh profile after the cut:

| Profile   | Scenario            | Elapsed | Style  | Layout | Editable renders | Patches |
| --------- | ------------------- | ------- | ------ | ------ | ---------------- | ------- |
| `default` | `open-enum`         | 172.1ms | 55.8ms | 0.5ms  | 2                | 0       |
| `default` | `open-date`         | 134.7ms | 54.2ms | 0.6ms  | 2                | 0       |
| `default` | `switch-dirty-cell` | 100.0ms | 51.3ms | 0.3ms  | 8                | 1       |
| `large`   | `open-enum`         | 144.7ms | 91.5ms | 0.5ms  | 2                | 0       |
| `large`   | `open-date`         | 153.2ms | 91.9ms | 0.5ms  | 2                | 0       |
| `large`   | `switch-dirty-cell` | 150.0ms | 96.6ms | 0.4ms  | 8                | 1       |

Far-column scenarios from the same fresh run:

| Profile | Scenario          | Elapsed | Style  | Layout | Editable renders | Patches |
| ------- | ----------------- | ------- | ------ | ------ | ---------------- | ------- |
| `large` | `open-far-enum`   | 139.5ms | 89.4ms | 0.3ms  | 2                | 0       |
| `large` | `open-far-date`   | 177.5ms | 90.3ms | 0.5ms  | 2                | 0       |
| `large` | `commit-far-text` | 189.3ms | 91.3ms | 0.4ms  | 6                | 1       |

This is the first fresh proof that the large-profile enum/date open paths are
below 100ms style time on this local profile machine. The improvement should
not be treated as final perfection yet: it is one fresh run, the header remains
eager, and budgets should only be tightened after repeated profiles confirm the
new baseline.

Repeated fresh profile (`JSON_TABLE_PROFILE_REPEAT=3`) confirms the same shape:

| Profile | Scenario            | Runs | Elapsed median | Elapsed p90 | Elapsed worst | Style median | Style p90 | Style worst |
| ------- | ------------------- | ---- | -------------- | ----------- | ------------- | ------------ | --------- | ----------- |
| `large` | `open-enum`         | 3    | 135.3ms        | 146.9ms     | 146.9ms       | 85.3ms       | 93.6ms    | 93.6ms      |
| `large` | `open-date`         | 3    | 156.9ms        | 160.9ms     | 160.9ms       | 88.9ms       | 90.5ms    | 90.5ms      |
| `large` | `switch-dirty-cell` | 3    | 140.6ms        | 149.1ms     | 149.1ms       | 89.2ms       | 98.9ms    | 98.9ms      |
| `large` | `open-far-enum`     | 3    | 127.7ms        | 129.6ms     | 129.6ms       | 85.5ms       | 87.2ms    | 87.2ms      |
| `large` | `open-far-date`     | 3    | 151.6ms        | 154.9ms     | 154.9ms       | 87.6ms       | 90.2ms    | 90.2ms      |
| `large` | `commit-far-text`   | 3    | 176.5ms        | 187.0ms     | 187.0ms       | 85.6ms       | 90.9ms    | 90.9ms      |

The repeated run keeps the critical large open/switch interactions under 100ms
style time at p90/worst for this machine. The remaining higher style costs are
close/commit flows that intentionally unmount or commit more UI:

- `large/close-select-with-escape`: p90 style 204.8ms
- `large/rapid-text-commits`: p90 style 246.4ms
- `large/open-and-commit-date`: p90 style 185.8ms

Those are not the original select-open complaint, but they should inform the
next style-attribution pass.

## Implemented Cut: Mounted Surface Attribution

The profiler now records `mountedSurface.before`, `mountedSurface.after`, and
`mountedSurface.delta` for every scenario. The surface snapshot counts mounted
header cells, body cells, editable cells, editable rows, DataCell surfaces,
popup nodes, calendars, and total document nodes. The budget verifier prints
those counts as `surface=header/body/popup` and adds a coarse
`styleAttributionHint`.

Fresh profile from `pnpm verify:json-table-performance:fresh`:

| Profile   | Scenario            | Elapsed | Style   | Surface                | Owner                   |
| --------- | ------------------- | ------- | ------- | ---------------------- | ----------------------- |
| `default` | `open-enum`         | 103.4ms | 52.9ms  | header:16/body:104/9   | `popup-mount`           |
| `default` | `open-date`         | 234.7ms | 61.0ms  | header:16/body:104/99  | `popup-mount`           |
| `default` | `switch-dirty-cell` | 172.8ms | 57.1ms  | header:16/body:104/0   | `editable-body-surface` |
| `large`   | `open-enum`         | 263.2ms | 97.6ms  | header:106/body:132/15 | `popup-mount`           |
| `large`   | `open-date`         | 428.9ms | 101.1ms | header:106/body:132/99 | `popup-mount`           |
| `large`   | `switch-dirty-cell` | 147.0ms | 97.3ms  | header:106/body:144/0  | `eager-header-surface`  |

This proves the next performance question more sharply:

- Popup opening still mounts the dominant popup surface.
- Non-popup large-profile style work is now suspiciously tied to the eager
  header surface: 106 mounted header cells remain even when the editable body is
  horizontally windowed.
- Header virtualization or header containment should be evaluated before more
  document-state work.

## Implemented Cut: Editable Header Column Window

Editable table headers now render against the same horizontal
`JsonTableRenderedColumnWindow` as the body. Header rows keep full canvas
alignment with left/right spacer cells, but non-spacer header cells are limited
to the mounted body column window. Header cell widths now use the actual
rendered column widths instead of the global column-width option, so stress
tables with custom column widths stay aligned.

Fresh profile from `pnpm verify:json-table-performance:fresh` after the cut:

| Profile | Scenario            | Elapsed | Style  | Surface               | Owner                  |
| ------- | ------------------- | ------- | ------ | --------------------- | ---------------------- |
| `large` | `open-enum`         | 152.6ms | 80.8ms | header:32/body:143/15 | `popup-mount`          |
| `large` | `open-date`         | 276.6ms | 83.2ms | header:32/body:143/99 | `popup-mount`          |
| `large` | `switch-dirty-cell` | 166.9ms | 84.1ms | header:32/body:143/0  | `eager-header-surface` |
| `large` | `commit-number`     | 92.6ms  | 41.1ms | header:32/body:143/0  | `eager-header-surface` |

Compared with the immediately preceding attributed run:

- mounted large-profile header cells dropped from `106` to about `32-34`
- `large/open-enum` style dropped from `97.6ms` to `80.8ms`
- `large/open-date` style dropped from `101.1ms` to `83.2ms`
- `large/switch-dirty-cell` style dropped from `97.3ms` to `84.1ms`

The owner hint still reports `eager-header-surface` for some non-popup large
scenarios because the header remains a material part of the mounted surface.
The next performance work should distinguish true header cost from body/global
selector invalidation with trace-backed attribution before making another
structural cut.
