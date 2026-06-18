// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  useCsvRowPatcher,
  type CsvRowPatchState,
} from "@/registry/new-york-v4/ui/csv-viewer-row-patcher"
import { createCsvRowStoreFromRows } from "@/registry/new-york-v4/ui/csv-row-store"
import type { FixedGridViewport } from "@/registry/new-york-v4/ui/fixed-grid-virtualization"

afterEach(() => {
  cleanup()
})

describe("CSV row patcher", () => {
  it("patches pooled row text and transforms without touching aria row indexes", () => {
    const rowWindow = buildRowWindow([
      { ariaRowIndex: "2", rowNumber: "1", cells: ["r0c0", "r0c1"] },
      { ariaRowIndex: "3", rowNumber: "2", cells: ["r1c0", "r1c1"] },
      { ariaRowIndex: "4", rowNumber: "3", cells: ["r2c0", "r2c1"] },
    ])
    const state = createPatchState()
    const { result } = renderHook(() =>
      useCsvRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createJumpViewport())).toBe("handled")

    const rows = rowHandles(rowWindow)
    expect(rows.map((row) => row.getAttribute("aria-rowindex"))).toEqual([
      "2",
      "3",
      "4",
    ])
    expect(rows.map((row) => row.style.transform)).toEqual([
      "translate3d(0, 50px, 0)",
      "translate3d(0, 60px, 0)",
      "translate3d(0, 70px, 0)",
    ])
    expect(rowText(rows[0]!)).toEqual(["6", "r5c0", "r5c1"])
    expect(rowText(rows[1]!)).toEqual(["7", "r6c0", "r6c1"])
    expect(rowText(rows[2]!)).toEqual(["8", "r7c0", "r7c1"])
  })

  it("keeps the fast path while a cell is active and patches the active class", () => {
    const rowWindow = buildRowWindow([
      { ariaRowIndex: "2", rowNumber: "1", cells: ["r0c0", "r0c1"] },
      { ariaRowIndex: "3", rowNumber: "2", cells: ["r1c0", "r1c1"] },
      { ariaRowIndex: "4", rowNumber: "3", cells: ["r2c0", "r2c1"] },
    ])
    const state = createPatchState({
      activeCell: { rowIndex: 5, columnIndex: 1 },
    })
    const { result } = renderHook(() =>
      useCsvRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createJumpViewport())).toBe("handled")
    expect(rowText(rowHandles(rowWindow)[0]!)).toEqual(["6", "r5c0", "r5c1"])
    expect(
      rowHandles(rowWindow)[0]!
        .querySelectorAll('[data-slot="csv-cell"]')[1]!
        .className.includes("ring-primary/50")
    ).toBe(true)
  })

  it("keeps the fast path at a stable non-zero horizontal offset", () => {
    const rowWindow = buildRowWindow([
      { ariaRowIndex: "2", rowNumber: "1", cells: ["r0c0", "r0c1"] },
      { ariaRowIndex: "3", rowNumber: "2", cells: ["r1c0", "r1c1"] },
      { ariaRowIndex: "4", rowNumber: "3", cells: ["r2c0", "r2c1"] },
    ])
    const { result } = renderHook(() =>
      useCsvRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => createPatchState(),
      })
    )

    expect(
      result.current.patch({ ...createJumpViewport(), scrollLeft: 360 })
    ).toBe("handled")
  })

  it("resync restores canonical visibility a stale patch left hidden", () => {
    const rowWindow = buildRowWindow([
      { ariaRowIndex: "2", rowNumber: "1", cells: ["r0c0", "r0c1"] },
      { ariaRowIndex: "3", rowNumber: "2", cells: ["r1c0", "r1c1"] },
      { ariaRowIndex: "4", rowNumber: "3", cells: ["r2c0", "r2c1"] },
    ])
    const { result } = renderHook(() =>
      useCsvRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => createPatchState(),
      })
    )

    const rows = rowHandles(rowWindow)
    // The imperative scroll patcher hides/parks pool rows outside its
    // zero-overscan window and rewrites the text of rows it reuses. React's
    // memoized commit can fail to clear that `hidden`, or to rewrite a cyclic
    // column whose value is unchanged in React's own vdom, leaving the
    // patcher's stale DOM behind.
    rows[1]!.hidden = true
    rows[2]!.hidden = true
    rows[2]!.style.transform = "translate3d(0, 9990px, 0)"
    // Stale text the canonical commit would skip (value-unchanged in vdom).
    rows[0]!.querySelector('[data-slot="csv-cell"] span')!.textContent = "STALE"
    rows[0]!.querySelector('[data-slot="csv-row-number"]')!.textContent = "999"

    // A canonical commit that wants all three rows visible must win on
    // visibility, position, and text.
    result.current.resync([
      { index: 5, start: 50, size: 10, end: 60 },
      { index: 6, start: 60, size: 10, end: 70 },
      { index: 7, start: 70, size: 10, end: 80 },
    ])

    expect(rows.map((row) => row.hidden)).toEqual([false, false, false])
    expect(rows.map((row) => row.style.transform)).toEqual([
      "translate3d(0, 50px, 0)",
      "translate3d(0, 60px, 0)",
      "translate3d(0, 70px, 0)",
    ])
    expect(rows.map((row) => rowText(row))).toEqual([
      ["6", "r5c0", "r5c1"],
      ["7", "r6c0", "r6c1"],
      ["8", "r7c0", "r7c1"],
    ])
  })

  it("resync hides pooled rows beyond the canonical window", () => {
    const rowWindow = buildRowWindow([
      { ariaRowIndex: "2", rowNumber: "1", cells: ["r0c0", "r0c1"] },
      { ariaRowIndex: "3", rowNumber: "2", cells: ["r1c0", "r1c1"] },
      { ariaRowIndex: "4", rowNumber: "3", cells: ["r2c0", "r2c1"] },
    ])
    const { result } = renderHook(() =>
      useCsvRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => createPatchState(),
      })
    )

    result.current.resync([{ index: 5, start: 50, size: 10, end: 60 }])

    expect(rowHandles(rowWindow).map((row) => row.hidden)).toEqual([
      false,
      true,
      true,
    ])
  })

  it("declines the fast path when required text nodes are missing", () => {
    const rowWindow = buildRowWindow([
      { ariaRowIndex: "2", rowNumber: "1", cells: ["r0c0", "r0c1"] },
      { ariaRowIndex: "3", rowNumber: "2", cells: ["r1c0", "r1c1"] },
      { ariaRowIndex: "4", rowNumber: "3", cells: ["r2c0", "r2c1"] },
    ])
    const firstCellText = rowWindow.querySelector('[data-slot="csv-cell"] span')
    firstCellText?.replaceChildren(document.createElement("strong"))
    const state = createPatchState()
    const { result } = renderHook(() =>
      useCsvRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createJumpViewport())).toBe("pass")
  })
})

function createPatchState(
  overrides: Partial<CsvRowPatchState> = {}
): CsvRowPatchState {
  return {
    activeCell: null,
    columnItems: [
      { index: 0, widthPx: 100 },
      { index: 1, widthPx: 100 },
    ],
    effectiveRowHeight: 10,
    rowOrder: null,
    shouldVirtualizeRows: true,
    rowStore: createCsvRowStoreFromRows(
      Array.from({ length: 20 }, (_, rowIndex) => [
        `r${rowIndex}c0`,
        `r${rowIndex}c1`,
      ])
    ),
    ...overrides,
  }
}

function createJumpViewport(): FixedGridViewport {
  return {
    scrollTop: 50,
    scrollLeft: 0,
    clientHeight: 20,
    clientWidth: 200,
    isJumpingRows: true,
    isJumpingColumns: false,
  }
}

function buildRowWindow(
  rows: Array<{ ariaRowIndex: string; rowNumber: string; cells: string[] }>
) {
  const rowWindow = document.createElement("div")
  for (const row of rows) {
    const rowElement = document.createElement("div")
    rowElement.dataset.slot = "csv-row"
    rowElement.setAttribute("role", "row")
    rowElement.setAttribute("aria-rowindex", row.ariaRowIndex)

    const rowNumber = document.createElement("div")
    rowNumber.dataset.slot = "csv-row-number"
    rowNumber.append(row.rowNumber)
    rowElement.append(rowNumber)

    for (const text of row.cells) {
      const cell = document.createElement("div")
      cell.dataset.slot = "csv-cell"
      const span = document.createElement("span")
      span.append(text)
      cell.append(span)
      rowElement.append(cell)
    }

    rowWindow.append(rowElement)
  }
  return rowWindow
}

function rowHandles(rowWindow: HTMLElement) {
  return Array.from(rowWindow.querySelectorAll<HTMLElement>('[role="row"]'))
}

function rowText(row: HTMLElement) {
  const rowNumber =
    row.querySelector<HTMLElement>('[data-slot="csv-row-number"]')
      ?.textContent ?? ""
  const cells = Array.from(
    row.querySelectorAll<HTMLElement>('[data-slot="csv-cell"]')
  ).map((cell) => cell.textContent ?? "")
  return [rowNumber, ...cells]
}
