// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  useCsvRowPatcher,
  type CsvRowPatchState,
} from "@/registry/new-york-v4/ui/csv-viewer-row-patcher"
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

  it("declines the fast path while a cell is active", () => {
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

    expect(result.current.patch(createJumpViewport())).toBe("pass")
    expect(rowText(rowHandles(rowWindow)[0]!)).toEqual(["1", "r0c0", "r0c1"])
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
    sourceRows: Array.from({ length: 20 }, (_, rowIndex) => [
      `r${rowIndex}c0`,
      `r${rowIndex}c1`,
    ]),
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
