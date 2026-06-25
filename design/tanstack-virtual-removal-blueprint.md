# TanStack Virtual Removal Blueprint

## Goal

Remove `@tanstack/react-virtual` from the package, source, docs, tests, and
generated registry artifacts. The codebase already has local virtualization
primitives for the expensive viewer paths; the remaining TanStack usage is
small enough to replace with direct fixed-row and measured-row hooks.

This is a hard cutover. Do not add a TanStack-shaped compatibility wrapper.

## Current State

Heavy viewer grids are already local:

- `registry/new-york-v4/ui/csv-viewer-grid.tsx` uses
  `useFixedGridVirtualization` and `useFixedRowPool`.
- `registry/new-york-v4/ui/xlsx-grid.tsx` uses the same fixed-grid engine.
- `registry/new-york-v4/ui/fixed-grid-virtualization.ts` owns fixed-size row,
  fixed-size row+column, scroll-to-index, jump detection, and row pool math.
- `registry/new-york-v4/ui/text-viewer-virtualization.ts` already owns
  variable-size offset arrays, binary search, and scroll-anchor helpers.
- PDF, image, code, text, and markdown viewers already use local virtualizers.

Remaining direct TanStack usage:

- `registry/new-york-v4/ui/file-system-list-view.tsx`
  - Fixed `34px` rows.
  - Uses `getVirtualItems()`, `getTotalSize()`, `initialRect`, and overscan.
- `registry/new-york-v4/ui/file-system-grid-view.tsx`
  - Fixed `132px` tile rows.
  - Uses `getVirtualItems()`, `getTotalSize()`, overscan, and `scrollToIndex`.
- `registry/new-york-v4/ui/file-system-columns-view.tsx`
  - Fixed `32px` rows.
  - Uses `getVirtualItems()`, `getTotalSize()`, overscan, and `scrollToIndex`.
- `registry/new-york-v4/ui/interactive-item-list.tsx`
  - Mostly estimated rows, but currently uses `measureElement`, `getItemKey`,
    and `scrollToIndex`.
- `components/json-form/virtual-list.tsx`
  - Variable-height card rows.
  - Uses `measureElement` and estimated height plus gap.

Stale references also exist in:

- `components/json-form/json-form.tsx`
- `content/docs/components/file-viewer/renderers/csv.mdx`
- `content/docs/components/file-viewer/renderers/xlsx.mdx`
- `tests/viewer-architecture.test.ts`
- `package.json`, `pnpm-lock.yaml`, `registry.json`, and `public/r/*.json`

## Target Shape

### Fixed-Size Lists

Use the existing `useFixedRowVirtualization` from
`registry/new-york-v4/ui/fixed-grid-virtualization.ts`.

Required behavior is already present:

- `rowCount`
- fixed `rowSize`
- overscan
- total height
- `scrollToRow`
- initial viewport height
- rAF scroll reads
- `ResizeObserver` viewport updates

Expected migration:

- File system list, grid, and columns switch from `useVirtualizer` to
  `useFixedRowVirtualization`.
- `virtualizer.scrollToIndex(index)` becomes
  `scrollToRow({ rowIndex: index, align: "center" })`.
- Existing zero-measure fallbacks become `initialViewportHeight` values rather
  than separate TanStack fallback branches.
- Row keys remain domain keys (`row.id`, `entry.path`) where mounted row state
  must survive reorder/filter operations.

### Measured Lists

Add a local measured-row hook. Put it next to the fixed engine unless a cleaner
module boundary emerges during implementation:

`registry/new-york-v4/ui/measured-row-virtualization.ts`

Public API:

```ts
export interface MeasuredRowVirtualItem {
  index: number;
  key: React.Key;
  start: number;
  size: number;
  end: number;
}

export function useMeasuredRowVirtualization(options: {
  count: number;
  estimateSize: number;
  getItemKey?: (index: number) => React.Key;
  overscan?: number;
  paddingStart?: number;
  paddingEnd?: number;
  scrollRef: React.RefObject<HTMLElement | null>;
  initialViewportHeight?: number;
}): {
  virtualRows: MeasuredRowVirtualItem[];
  totalSize: number;
  scrollToIndex: (
    index: number,
    options?: { align?: "start" | "center" | "end"; behavior?: ScrollBehavior },
  ) => void;
  measureRow: (index: number, element: HTMLElement | null) => void;
};
```

Implementation rules:

- Store measured sizes by row index.
- Compute starts and total size from `estimateSize` plus measured overrides.
- Use binary search to derive visible start/end.
- Observe row elements with one `ResizeObserver`; unobserve on ref cleanup.
- Observe the scroll element with `ResizeObserver` and passive scroll listener.
- Schedule scroll reads with `requestAnimationFrame`.
- Preserve scroll anchoring when measured heights change above the viewport.
- Cap mounted items to a sane maximum, matching the defensive pattern in
  `fixed-grid-virtualization.ts` and `text-viewer-virtualization.ts`.
- Keep the API local and semantic. Do not copy TanStack method names except
  where the concept is already local, such as `scrollToIndex`.

Expected migration:

- `interactive-item-list.tsx`
  - Use `getItemKey: (index) => items[index]?.id ?? index`.
  - Replace `ref={virtualizer.measureElement}` with
    `ref={(element) => measureRow(virtualRow.index, element)}`.
  - Replace `virtualizer.scrollToIndex(index)` with local `scrollToIndex`.
  - Keep `ROW_PADDING` as `paddingStart` and `paddingEnd`, not ad hoc height
    additions.
- `components/json-form/virtual-list.tsx`
  - Use `estimateSize + gap`.
  - Use field IDs as keys.
  - Keep `paddingBottom: gap` only if the measured outer row includes it; avoid
    double-counting gap in both measurement and layout.

## Migration Plan

1. Add measured-row virtualization.
   - Implement the hook.
   - Add focused unit tests for offset math, measurement updates, scroll-to-index,
     zero-height viewport fallback, key stability, and anchor preservation.

2. Replace fixed file-system virtualizers.
   - Migrate `file-system-list-view.tsx`.
   - Migrate `file-system-grid-view.tsx`.
   - Migrate `file-system-columns-view.tsx`.
   - Keep roving-focus behavior identical by mapping selected entries to row
     indexes before calling `scrollToRow`.

3. Replace measured/list virtualizers.
   - Migrate `interactive-item-list.tsx`.
   - Migrate `components/json-form/virtual-list.tsx`.
   - Keep existing keyboard, preview, disabled, and reorder behavior unchanged.

4. Remove TanStack from metadata and generated artifacts.
   - Remove `@tanstack/react-virtual` from `package.json`.
   - Update `pnpm-lock.yaml`.
   - Rebuild registry artifacts with the repo registry command.
   - Ensure `registry.json` and `public/r/*.json` no longer include the package.

5. Update stale docs and architecture assertions.
   - CSV docs should say local fixed-grid virtualization.
   - XLSX docs should say local fixed-grid virtualization.
   - JSON form docs/comments should say local row virtualization.
   - Replace the architecture test assertion that currently expects
     `useVirtualizer`.

## Acceptance Checks

Run targeted tests first:

```bash
pnpm test -- tests/fixed-grid-infrastructure.test.ts tests/interactive-item-list.test.tsx tests/file-system.test.tsx tests/viewer-architecture.test.ts
```

Then run JSON form coverage:

```bash
pnpm test -- tests/json-form*.test.tsx tests/json-form*.test.ts
```

Then run typecheck and registry checks:

```bash
pnpm typecheck
pnpm registry:build
```

Final grep must return no real dependency references:

```bash
rg "@tanstack/react-virtual|useVirtualizer" \
  --glob '!design/tanstack-virtual-removal-blueprint.md'
```

Expected final state:

- No source imports `@tanstack/react-virtual`.
- No docs claim CSV, XLSX, or JSON form use TanStack Virtual.
- `package.json` and `pnpm-lock.yaml` no longer include TanStack Virtual.
- Registry metadata and generated `public/r/*.json` do not include TanStack
  Virtual.
- File-system roving focus still scrolls selected rows into view.
- Interactive item list keeps row identity across reorder/filter.
- JSON form card arrays still handle rows taller than their estimate.

## Risks

- Measured-row anchor drift is the main correctness risk. If row `N` changes
  height above the viewport, the viewport must keep showing the same logical
  content instead of jumping.
- `ResizeObserver` behavior in tests is incomplete. Keep pure offset math
  testable without DOM and cover hook behavior with controlled observers.
- `InteractiveItemList` uses measured rows but also reports the visible item.
  The replacement should expose enough row window data to preserve this without
  scanning all items.
- Registry artifacts can leave false-positive dependency references even after
  source migration. Treat the registry build as part of the cutover, not cleanup.

## Non-Goals

- Do not rewrite PDF, image, code, text, markdown, CSV, or XLSX virtualization.
- Do not introduce a generic table library.
- Do not keep TanStack as an optional dependency.
- Do not add a wrapper named `useVirtualizer`.
