# JSON Table Select Performance Blueprint

## Problem

Opening an enum select inside the JSON table feels slow even after preventing sibling cell rerenders. Profiling shows the remaining delay is not caused by the whole table rendering again.

The slow path is the generic Base UI select overlay:

- it performs repeated `getBoundingClientRect` reads while opening
- it mounts a portal, backdrop, positioner, and popup
- it runs focus management during React commit
- it forces expensive style recalculation in the dense virtualized table context

Measured on the current app:

- opening `transactions.0.transaction_type` took about `279ms`
- JSON table renders were limited to the active row/cell path
- React actual render time was about `151ms`
- browser style recalculation was about `177ms`
- `getBoundingClientRect` accounted for about `131ms`
- Base UI `InternalBackdrop` measurement was the dominant rect caller

So the render containment fix worked, but the select component is still too heavy for a grid cell editor.

## Goal

Make opening a primitive enum editor feel instant in the JSON table.

Target behavior:

- opening the dropdown should not rerender unrelated rows or cells
- opening should do one anchor measurement, not a cascade of layout reads
- focus should remain predictable without expensive generic focus machinery
- committing a value should preserve the existing document update semantics
- the generic design-system select should remain available outside the table

## Non-Goals

- Do not rewrite the virtualized table.
- Do not replace every select in the app.
- Do not change schema inference or primitive value semantics.
- Do not introduce a second document update path.
- Do not add compatibility shims for old table select behavior.

## Proposed Architecture

Introduce a table-specific enum popup used only by `DataCellSelectControl`.

```txt
EditableJsonTableCell
  -> JsonTablePrimitiveHandoff
    -> DataCellSelectControl
      -> JsonTableEnumPopup
```

`JsonTableEnumPopup` should be a small fixed-position portal with table-focused behavior:

- measure the trigger once on open
- render the popup with `position: fixed`
- use the known option list directly
- close on outside pointer down, Escape, blur to outside, or option commit
- support ArrowUp, ArrowDown, Enter, Space, Home, End
- return focus to the trigger after close when appropriate

This removes Floating UI positioning, Base UI backdrop measurement, and generic select focus plumbing from the grid hot path.

## Component Contract

`DataCellSelectControl` should continue to own value semantics and commit behavior.

The new popup should receive only UI-level props:

```ts
type JsonTableEnumPopupProps = {
  anchor: HTMLElement
  value: string | null
  options: string[]
  onCommit: (value: string) => void
  onCancel: () => void
}
```

`DataCellSelectControl` keeps:

- parsing current primitive value
- deciding whether the editor auto-opens
- calling the existing `onValueChange`
- preserving labels and placeholders

`JsonTableEnumPopup` owns:

- open overlay rendering
- keyboard navigation
- active option state
- popup positioning
- outside interaction handling

## Positioning Model

On open:

1. call `anchor.getBoundingClientRect()` once
2. compute available viewport space above and below
3. place below unless there is clearly more room above
4. clamp width to at least anchor width
5. clamp max height to viewport space

On scroll or resize:

- close the popup, or recompute once per animation frame

The first version should close on scroll. That is simpler, avoids long-lived observers, and matches grid editing expectations.

## Focus And Accessibility

Use a combobox-like trigger plus listbox popup:

- trigger: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-haspopup="listbox"`
- popup: `role="listbox"`
- option: `role="option"`, `aria-selected`

Keyboard behavior:

- `ArrowDown` opens or moves to the next option
- `ArrowUp` opens or moves to the previous option
- `Enter` and `Space` commit the active option
- `Escape` cancels and closes
- `Tab` commits current focus only if that is already the table convention; otherwise close and allow tab navigation

Focus should stay on the trigger with `aria-activedescendant`, or move into the listbox. Keeping focus on the trigger is usually cheaper and easier to integrate with the existing table editor lifecycle.

## Commit Path

Opening the popup and committing a value are separate performance problems.

Opening should only touch local editor state:

- active cell state
- popup open state
- active option state

Committing should continue to use the existing document patch path.

The commit path currently rerenders many cells because it updates projected document data. That is expected for a real data change, but it should be profiled separately after the open path is fixed. If commit remains too slow, the next blueprint should focus on projection granularity and row/cell identity preservation after document patches.

## Migration Plan

1. Add `JsonTableEnumPopup` beside the JSON table components.
2. Replace the Base UI `Select` usage inside `DataCellSelectControl` only.
3. Keep the visual styling close to the existing table cell select.
4. Preserve the public props of `DataCellSelectControl`.
5. Remove now-unused table-only select imports from that file.
6. Re-profile open and open-plus-commit separately.

## Verification Plan

Automated checks:

- existing JSON table interaction tests
- existing session virtualization hardening tests
- a profiler regression that opening a select does not render sibling cells
- keyboard tests for Arrow keys, Enter, Escape, and outside click

Manual/profile checks:

- open a select in a large JSON table
- confirm only the active row/cell render path changes
- confirm DOM node growth is limited to popup options
- confirm `getBoundingClientRect` count is near one anchor read
- confirm style recalculation drops substantially from the Base UI baseline

Success criteria:

- dropdown appears in under one frame on a warm page
- no unrelated row/cell rerender on open
- no Base UI backdrop or Floating UI stack in the open trace
- option commit still updates the table and document correctly

## Risks

- A custom popup must cover accessibility details that Base UI provided.
- Virtualized scrolling can unmount the anchor while the popup is open.
- Table keyboard navigation may conflict with popup keyboard navigation.
- Styling can drift from the design-system select if duplicated carelessly.

Mitigations:

- keep the popup private to the JSON table
- keep the API small and value-agnostic
- close on scroll and unmount
- test keyboard behavior at the table integration level
- reuse existing design tokens/classes where possible without importing Base UI select primitives

