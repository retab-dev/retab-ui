# XLSX Viewer Final-Form Blueprint

This is the remaining path from "strong and shippable" to the closest practical
version of "platonic" for `XlsxViewer`.

The previous hardening pass already solved the large problems:

- parsing runs in a worker
- workbook storage is sparse
- cache entries are bounded and rejected loads are not pinned
- viewer, grid, toolbar, tabs, shadow scope, workbook model, and worker protocol
  are split
- generated registry artifacts include the split modules
- targeted unit and component tests exist
- the docs demo has been browser-smoke-tested

This blueprint is therefore not a rewrite plan. It is a final polish plan focused
only on the remaining sources of imprecision.

## Definition Of Done

The component is "final-form" when:

- public and internal names use one vocabulary, or documented compatibility names
  are isolated at the edge
- worker flattening can be tested without spinning up a worker
- `xlsx-grid.tsx` contains only grid composition, not scrollbar and skeleton
  implementation details
- cache eviction behavior is deterministic for pending and resolved entries
- the browser smoke test is automated
- docs and registry descriptions exactly match the implementation
- no new abstraction exists unless it removes real complexity

## Non-Goals

Do not add features while doing this pass.

Specifically, do not add:

- editing
- formulas
- charts
- styles
- merged-cell layout
- freeze panes
- lazy per-sheet parsing
- spreadsheet keyboard navigation
- a server conversion path

The target is a better viewer, not a broader spreadsheet product.

## Public API Edge

Current public API:

```ts
export interface XlsxCellRef {
  sheet: number
  row: number
  col: number
}

export interface XlsxViewerHandle {
  scrollToCell: (
    sheet: number,
    row: number,
    col: number,
    options?: { behavior?: ScrollBehavior }
  ) => void
}
```

Internal vocabulary now uses `sheetIndex`, `rowIndex`, and `columnIndex`.

Final-form rule:

- Keep the public API above for compatibility.
- Add internal conversion helpers at the boundary:
  - `toInternalCellRef`
  - `isValidPublicCellRef`
  - `isValidScrollTarget`
- After conversion, all internal code uses:
  - `sheetIndex`
  - `rowIndex`
  - `columnIndex`
- No internal module should use `row`, `col`, or `sheet` to mean indexes except
  when naming the public compatibility type.

Acceptance:

- `rg "\bcol\b|\brow\b" registry/new-york-v4/ui/xlsx-*.tsx
registry/new-york-v4/lib/xlsx-*.ts` shows only public API compatibility,
  comments, or local DOM/text words.

## Worker Flattening

Current state:

- `xlsx-viewer.worker.ts` reads SheetJS workbooks and directly builds compact
  sheets.
- The worker protocol and parse limits are shared.

Final-form split:

```txt
registry/new-york-v4/lib/xlsx-worker-protocol.ts
registry/new-york-v4/lib/xlsx-workbook.ts
registry/new-york-v4/lib/xlsx-sheetjs-flattener.ts
registry/new-york-v4/ui/xlsx-viewer.worker.ts
```

Responsibilities:

- `xlsx-sheetjs-flattener.ts`
  - exports `flattenSheetJsWorkbook`
  - exports `flattenSheetJsWorksheet`
  - owns SheetJS worksheet traversal
  - throws typed `XlsxWorkerError`
  - accepts parse limits as an argument with `XLSX_PARSE_LIMITS` default
- `xlsx-viewer.worker.ts`
  - receives messages
  - calls `flattenSheetJsWorkbook`
  - transfers buffers
  - posts typed responses

Rules:

- The flattener contains no `Worker`, `postMessage`, or React references.
- The worker contains no worksheet traversal loops.
- The flattener remains coupled to SheetJS types, not to UI modules.

Tests:

- generated empty sheet
- generated multi-sheet workbook
- formatted number display
- date display when `cellDates: true`
- sparse far-away cell
- corrupt/invalid shape behavior if practical
- over-limit range
- over-limit non-empty cells
- over-limit text size

Acceptance:

- Worker tests do not need a real browser worker to prove flattening behavior.
- One browser smoke test still proves the worker boundary.

## Grid Split

Current state:

- `xlsx-grid.tsx` is cohesive but large.
- It owns:
  - virtualized grid composition
  - row rendering
  - custom vertical scrollbar
  - skeleton rendering
  - grid constants

Final-form split:

```txt
registry/new-york-v4/ui/xlsx-grid.tsx
registry/new-york-v4/ui/xlsx-grid-row.tsx
registry/new-york-v4/ui/xlsx-grid-scrollbar.tsx
registry/new-york-v4/ui/xlsx-grid-skeleton.tsx
registry/new-york-v4/ui/xlsx-grid-constants.ts
```

Responsibilities:

- `xlsx-grid.tsx`
  - virtualizer setup
  - grid template computation
  - scroll request effect
  - composition
- `xlsx-grid-row.tsx`
  - visible row and cell DOM
  - ARIA row/gridcell attributes
  - active cell styling
- `xlsx-grid-scrollbar.tsx`
  - header-aware scrollbar only
- `xlsx-grid-skeleton.tsx`
  - fallback skeleton only
- `xlsx-grid-constants.ts`
  - base dimensions

Rules:

- `xlsx-grid.tsx` should stay under roughly 260 lines.
- `xlsx-grid-row.tsx` should not import `@tanstack/react-virtual`.
- `xlsx-grid-scrollbar.tsx` should not know about cells or sheets.
- Skeleton code should not live next to live-cell rendering.

Acceptance:

- Each module name describes exactly what it owns.
- No file split creates circular imports.

## Cache Semantics

Current state:

- `XlsxSourceCache` is bounded.
- Rejected loads are removed.
- Resolved evictions call `dispose`.
- Pending eviction is intentionally pragmatic.

Final-form rule:

- Pending loads may be evicted for entry-count pressure, but the policy must be
  explicit and tested.
- Resolved entries are evicted before pending entries for byte pressure.
- Entry-count pressure may evict oldest pending entries only when the cache would
  otherwise grow beyond `maxEntries`.
- A pending load that resolves after eviction must not reinsert itself.

Tests:

- rejected load is retryable
- resolved LRU eviction disposes old source
- byte-pressure eviction prefers resolved entries
- pending entry evicted by entry-count pressure does not reinsert on resolve
- `clear()` disposes all resolved entries and prevents stale ownership

Acceptance:

- There is no cache behavior that has to be inferred from comments.

## Accessibility Boundary

Current state:

- Toolbar buttons have labels.
- Tabs expose tablist/tab semantics.
- Grid exposes `role="grid"` and row/column counts.
- Visible rows/cells expose row/gridcell roles.

Final-form target:

- Keep useful inspection semantics.
- Do not pretend to be a full interactive spreadsheet.
- Add `aria-colindex` and `aria-rowindex` only on visible cells/rows.
- Ensure row number gutter remains visual and does not duplicate gridcell
  announcements.
- Ensure empty state has a useful accessible label.

Tests:

- grid has sheet label and row/column counts
- visible rows expose row indexes
- visible cells expose column indexes
- single-sheet tablist is omitted
- multi-sheet tablist exposes selected state

Acceptance:

- Accessibility tests describe current supported semantics, not aspirational
  Excel behavior.

## Automated Browser Verification

Current state:

- Browser smoke verification is manual.

Final-form target:

Add one automated browser smoke test or script that runs against the docs demo:

```txt
tests/browser/xlsx-viewer-smoke.test.ts
```

or, if the repo has no browser-test runner:

```txt
scripts/verify-xlsx-viewer.mjs
```

It should verify:

- docs page loads
- demo workbook eventually renders
- the shadow-root grid exists
- grid label, row count, and column count are present
- at least one workbook tab is selected
- no console errors are emitted

Rules:

- Do not make this test depend on pixel-perfect screenshots.
- Do not require a network service outside the local dev server.
- If the dev server is not available, the script should fail with a clear message.

Acceptance:

- The manual browser smoke check can be replaced by one repeatable command.

## Documentation And Registry

Docs should say only what the implementation does:

- client-side parsing
- worker-based parse
- sparse compact sheet storage
- row and column virtualization
- source-link compatible highlighting and scrolling
- optional style isolation via shadow root

Docs should not say:

- sheets are lazy
- lookup is O(1)
- Excel styling is supported
- the component is a spreadsheet editor

Registry rules:

- `xlsx-viewer` must include all split UI files.
- `xlsx-viewer` must depend on:
  - `xlsx-worker-protocol`
  - `xlsx-workbook`
  - shadcn primitives it imports
- any new `xlsx-*` lib used by installable files must be a registry item or part
  of an existing registry item.

Acceptance:

- `bun run registry:build`
- `bun run registry:validate`
- generated `public/r/xlsx-viewer.json` contains every installed file.

## Verification Commands

Run these before calling the pass complete:

```bash
bunx vitest run tests/xlsx-workbook.test.ts tests/xlsx-components.test.tsx
bunx eslint registry/new-york-v4/ui/xlsx-*.tsx registry/new-york-v4/lib/xlsx-*.ts tests/xlsx-*.test.ts*
bunx prettier --check registry/new-york-v4/ui/xlsx-*.tsx registry/new-york-v4/lib/xlsx-*.ts tests/xlsx-*.test.ts* components/viewers/XLSX_VIEWER_BLUEPRINT.md
bun run registry:build
bun run registry:validate
```

Also run the automated browser verification once it exists.

## Completion Criteria

This blueprint is complete when:

- all edge compatibility naming is isolated
- worker traversal is extracted and unit-tested
- grid submodules are split without increasing conceptual surface area
- cache pending-entry policy is explicit and tested
- browser smoke verification is automated
- docs and registry are synchronized
- no file contains an avoidable second responsibility

At that point, further work should require either measured performance data,
accessibility audit findings, or a real user-facing feature request.
