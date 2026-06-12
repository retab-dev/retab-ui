# Fixed Grid Shared Infrastructure Blueprint

## Purpose

CSV, XLSX, and JSON table all render dense, fixed-size, scrollable grids.

They should share the infrastructure that is mathematically identical:

- fixed row/column windowing
- scroll measurement
- virtual item geometry
- spacer padding
- row positioning
- header-aware scrollbars
- scroll benchmarks

They should not share domain behavior:

- CSV sorting and delimiter semantics
- XLSX workbook, sheet, and formatted-cell semantics
- JSON schema projection, editing, and header tree semantics

The goal is purification, not a framework. Shared code must remove duplication
or prevent measured regressions. If a shared module needs viewer-specific
conditionals, the abstraction is too large.

## Current Finding

Moving JSON table row virtualization from the custom fixed-row window to
TanStack Virtual was measured as a regression on `json-table-profile`.

Benchmark shape:

- headless Chrome
- 5 measured runs after warmup
- 120 frames per scenario
- same viewport and mounted row count for baseline and experiment

| Scenario   | Custom Fixed Window | TanStack Virtual | Change |
| ---------- | ------------------: | ---------------: | -----: |
| Small jump |           108.3 FPS |         49.0 FPS | -54.7% |
| Large jump |            65.8 FPS |         46.2 FPS | -29.8% |

Conclusion:

For these viewers, fixed-size arithmetic is the right primitive. TanStack Table
must remain absent. TanStack Virtual is not the ideal JSON table row primitive.

## Target Shape

Create one small fixed-grid infrastructure surface:

```txt
registry/new-york-v4/ui/fixed-grid-virtualization.ts
registry/new-york-v4/ui/fixed-grid-row-style.ts
registry/new-york-v4/ui/fixed-grid-template.ts
registry/new-york-v4/ui/header-aware-scrollbar.tsx
registry/new-york-v4/ui/viewer-scrollbar-css.ts
```

Expose app aliases only where existing app code imports through
`components/ui/*`:

```txt
components/ui/fixed-grid-virtualization.ts
components/ui/fixed-grid-row-style.ts
components/ui/fixed-grid-template.ts
components/ui/header-aware-scrollbar.tsx
components/ui/viewer-scrollbar-css.ts
```

Do not add a broad `grid-utils.ts` barrel.

The next layer is still infrastructure, not a shared viewer. The ideal shape is
a fixed-grid substrate with explicit contracts for viewport, columns,
interaction, and benchmarking:

```txt
registry/new-york-v4/ui/fixed-grid-viewport.tsx
registry/new-york-v4/ui/fixed-grid-columns.ts
registry/new-york-v4/ui/fixed-grid-selection.ts
registry/new-york-v4/ui/fixed-grid-benchmark.ts
```

Add these only when the current duplication is visible in at least two viewers.
The rule is simple: if a module needs to know whether it is rendering CSV, XLSX,
or JSON, it does not belong in the shared substrate.

## Shared Modules

### `fixed-grid-virtualization.ts`

Owns fixed-size viewport math only.

Exports:

- `useFixedGridVirtualization`
- `useFixedRowVirtualization`
- `fixedVirtualItems`
- `fixedScrollOffset`
- `FixedGridVirtualItem`
- `FixedGridColumnItem`

Rules:

- No rendering.
- No CSV/XLSX/JSON names.
- No schema, workbook, delimiter, or cell concepts.
- No dependency on TanStack Table or TanStack Virtual.
- Overscan and jump overscan are inputs, not constants hidden inside the hook.
- It returns geometry, not React elements.

### `fixed-grid-row-style.ts`

Owns absolute row positioning.

Exports:

- `getFixedGridRowStyle`

Input:

```ts
{
  gridTemplate?: string
  rowHeight: number
  top: number
  contain?: boolean
}
```

Output:

```ts
React.CSSProperties
```

Rules:

- Use `translate3d(0, top, 0)` for virtual rows.
- Use `contain: "layout paint style"` for dense read-only grid rows unless a
  viewer has a measured reason not to.
- No viewer-specific classes.

### `fixed-grid-template.ts`

Owns CSS grid-template string construction.

Exports:

- `buildVirtualGridTemplate`

Input:

```ts
{
  leadingWidth: number
  leftPad: number
  columnWidths: readonly number[]
  rightPad: number
}
```

Rules:

- No knowledge of row-number gutters versus XLSX gutters.
- No knowledge of CSV headers, XLSX column labels, or JSON schema headers.
- Return a stable string from simple numeric inputs.

### `header-aware-scrollbar.tsx`

Owns the custom vertical scrollbar that starts below a sticky header.

Exports:

- `HeaderAwareScrollbar`

Input:

```ts
{
  scrollRef: React.RefObject<HTMLDivElement | null>
  headerHeight: number
}
```

Rules:

- One implementation for CSV and XLSX.
- rAF-throttle measurement.
- Preserve pointer dragging.
- Compare thumb state before setting React state.
- Do not know about CSV/XLSX/JSON.

JSON table currently uses the native scrollbar because its header is outside the
vertical scrollport. It should adopt this only if a product need appears.

### `viewer-scrollbar-css.ts`

Owns repeated scrollbar CSS strings.

Exports:

- `viewerScrollbarCss(slotName: string)`

Rules:

- Generate the same hidden vertical native scrollbar CSS for CSV/XLSX.
- Keep slot names as data-slot values supplied by the viewer.
- Do not introduce global CSS.

## Next Shared Layer

### `fixed-grid-viewport.tsx`

Owns the scroll container contract, not viewer chrome.

Exports:

- `FixedGridViewport`
- `FixedGridViewportRefs`

Input:

```ts
{
  scrollRef: React.RefObject<HTMLDivElement | null>
  className?: string
  children: React.ReactNode
  dataSlot: string
  totalRowSize: number
  totalColumnSize?: number
}
```

Rules:

- The viewport owns `overflow`, relative positioning, and benchmark slot naming.
- The viewer owns headers, toolbars, empty states, and cell rendering.
- The viewport must not know about row numbers, worksheets, schema fields, or
  CSV headers.
- Do not introduce a render-prop shell unless the duplicated code needs it.

This should replace repeated scroll container markup only after the existing
CSV, XLSX, and JSON scroll containers have converged enough that the extracted
component is smaller than the duplicated markup.

### `fixed-grid-columns.ts`

Owns the visible-column vocabulary.

Exports:

- `FixedGridColumn`
- `buildFixedGridColumns`
- `fixedGridColumnWidths`

Canonical type:

```ts
type FixedGridColumn<Metadata = unknown> = {
  key: string
  widthPx: number
  metadata?: Metadata
}
```

Rules:

- Prefer a column array over per-cell object lookups.
- Keep viewer-specific metadata opaque.
- Do not model header rendering here.
- Do not model nested JSON header trees here.
- Do not model XLSX column labels here.

This is the natural home for the pattern the JSON table already wants:

```ts
visibleColumns: Array<{
  key: string
  fieldMetadata?: FieldMetadata
  widthPx: number
}>
```

The shared version should use `metadata` as an opaque payload, while JSON can
alias it locally to `fieldMetadata` if that reads better in its domain code.

### `fixed-grid-selection.ts`

Owns coordinate primitives that are the same across dense grids.

Exports:

- `GridCellCoordinate`
- `isSameGridCell`
- `gridCellKey`
- `parseGridCellKey`

Canonical type:

```ts
type GridCellCoordinate = {
  rowIndex: number
  columnIndex: number
}
```

Rules:

- Share only coordinate identity and cheap helpers.
- CSV and XLSX may use this directly for active-cell state.
- JSON may use it only for read-only focus if that becomes useful.
- Do not put editing, formulas, validation, schema paths, or clipboard behavior
  in this module.

Selection is worth sharing only if it removes duplicated coordinate plumbing.
It is not worth sharing if it forces JSON form behavior into spreadsheet terms.

### `fixed-grid-benchmark.ts`

Owns the viewer adapter contract used by scrollbench.

Exports:

- `FixedGridBenchmarkViewer`
- `findFixedGridScroller`
- `isScrollableViewport`

Canonical type:

```ts
type FixedGridBenchmarkViewer = {
  id: string
  label: string
  sample: string
  scrollerSelector: string
}
```

Rules:

- Each viewer declares its scroller selector.
- The benchmark harness should not accumulate viewer-specific selector guesses.
- A viewport is valid only when `clientHeight > 0` and
  `scrollHeight > clientHeight`.
- Benchmark code may know viewer ids; shared UI modules may not.

This keeps performance measurement honest and makes it harder to accidentally
benchmark a collapsed mobile panel or the wrong scroll element.

## Sharing Boundary

Share these:

- fixed row and column geometry
- viewport scroll contracts
- row positioning styles
- grid-template construction
- hidden native scrollbar CSS
- header-aware scrollbar mechanics
- visible-column arrays with opaque metadata
- coordinate identity helpers
- scrollbench adapter metadata

Do not share these:

- CSV parsing
- CSV sorting semantics
- XLSX workbook/sheet state
- XLSX formatted-cell lookup
- JSON schema projection
- JSON header trees
- JSON materialized field paths
- cell renderers
- header renderers
- edit controllers
- clipboard behavior
- toolbar behavior

The shared layer should feel like math and DOM mechanics. The viewer layer
should feel like CSV, XLSX, or JSON.

## Viewer Ownership

### CSV Keeps

- parsing/resource state
- delimiter and header semantics
- sorting projection
- row number semantics
- CSV cell text rendering
- CSV toolbar/download behavior

CSV Uses Shared

- `useFixedGridVirtualization`
- `buildVirtualGridTemplate`
- `getFixedGridRowStyle`
- `HeaderAwareScrollbar`
- `viewerScrollbarCss`

### XLSX Keeps

- workbook loading
- sheet state
- formatted cell lookup
- column label rendering
- active cell routing
- toolbar and sheet tabs

XLSX Uses Shared

- `useFixedGridVirtualization`
- `buildVirtualGridTemplate`
- `getFixedGridRowStyle`
- `HeaderAwareScrollbar`
- `viewerScrollbarCss`

### JSON Table Keeps

- schema header tree
- projected document rows
- edit/read-only mode
- object/array editor state
- cell controller behavior
- materialized field paths

JSON Uses Shared

- `useFixedRowVirtualization`
- `getFixedGridRowStyle`
- optionally `buildVirtualGridTemplate` if JSON header/body grid templates stay
  fixed-width and numeric

JSON Does Not Use

- `HeaderAwareScrollbar`, unless a measured/product reason appears
- column virtualization, unless profiling proves horizontal cell count is the
  bottleneck
- TanStack Virtual, unless future measurements overturn the current result

## Required Refactor Sequence

1. Extract `fixedVirtualItems` and `fixedScrollOffset` as exported pure helpers.
2. Add `useFixedRowVirtualization` as a row-only wrapper around the existing
   fixed arithmetic engine.
3. Move JSON table from TanStack Virtual to `useFixedRowVirtualization`.
4. Preserve read-only slot keys in JSON table.
5. Pass `virtualRow.start` into JSON rows, not `rowIndex * rowHeight` computed
   inside the row.
6. Extract `getFixedGridRowStyle`.
7. Update CSV, XLSX, and JSON rows to use the shared row style helper.
8. Extract `buildVirtualGridTemplate`.
9. Update CSV and XLSX grid-template construction.
10. Extract `HeaderAwareScrollbar`.
11. Replace CSV/XLSX scrollbar modules with thin viewer-specific CSS exports or
    direct shared imports.
12. Extract `viewerScrollbarCss`.
13. Add JSON table to `scrollbench`.
14. Add a benchmark script or route command that can compare current branch
    against a baseline commit.
15. Extract a `FixedGridColumn` vocabulary only where two viewers are already
    passing `{ key, widthPx }` arrays.
16. Move repeated scroll viewport markup into `FixedGridViewport` only if the
    resulting call sites stay smaller and clearer.
17. Move scrollbench viewer metadata into explicit viewer adapters so the
    benchmark harness stops guessing selectors.
18. Add coordinate helpers only if CSV and XLSX active-cell code duplicate the
    same row/column identity logic.

Stop after any step that makes code less direct without reducing duplication or
preventing a measured regression.

## Benchmark Gate

Every virtualization infrastructure change must run:

```sh
bun run test tests/csv-viewer.test.tsx tests/xlsx-components.test.tsx tests/xlsx-viewer-ref.test.tsx
bun run test tests/json-table-model.test.ts tests/json-table-render.test.tsx tests/json-table-controller.test.tsx tests/json-table-header-menu.test.tsx
bunx eslint registry/new-york-v4/ui/fixed-grid-virtualization.ts registry/new-york-v4/ui/csv-viewer-grid.tsx registry/new-york-v4/ui/xlsx-grid.tsx components/json-table --max-warnings=0
```

Performance gate:

- CSV scrollbench small and large jump must not regress by more than 5%.
- XLSX scrollbench small and large jump must not regress by more than 5%.
- JSON table small and large jump must recover the custom fixed-window baseline
  within 10%.

The JSON target is:

| Scenario   |    Target |
| ---------- | --------: |
| Small jump | >= 97 FPS |
| Large jump | >= 59 FPS |

Those targets are 90% of the measured custom-window baseline.

## Naming Contract

Use these names everywhere:

- `scrollRef`: the scrollable element ref.
- `virtualRows`: mounted row geometry.
- `virtualColumns`: mounted column geometry inside the shared module only.
- `columnItems`: viewer-facing visible columns.
- `leftPad`: spacer before visible columns.
- `rightPad`: spacer after visible columns.
- `totalRowSize`: full virtual row height.
- `totalColumnSize`: full virtual column width.
- `rowHeightPx`: JSON table row height.
- `rowTopPx`: absolute row top from the virtualizer.
- `gridTemplate`: CSS grid-template-columns string.

Avoid:

- `item` when the value is a row or column and a precise name fits.
- `virtualizer` in viewer code unless the module truly exposes a virtualizer
  object.
- `TanStack` vocabulary in JSON table except in historical notes.

## Non-Goals

- No shared table component.
- No shared cell renderer.
- No shared header renderer.
- No generic data-grid framework.
- No attempt to make CSV, XLSX, and JSON expose the same public API.
- No abstraction for variable-height rows.
- No abstraction for editable spreadsheet behavior.

## Success Criteria

The refactor is successful when:

- CSV, XLSX, and JSON share fixed-size virtualization math.
- JSON table no longer uses TanStack Virtual.
- CSV/XLSX no longer duplicate header-aware scrollbar logic.
- CSV/XLSX no longer duplicate grid-template construction.
- Row positioning style is generated by one helper.
- All three viewers keep their own domain renderers.
- Benchmarks prove the shared infrastructure does not trade clarity for speed.
