// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { FixedGridViewport } from "@/registry/new-york-v4/ui/fixed-grid-virtualization"
import {
  useXlsxRowPatcher,
  type XlsxRowPatchState,
} from "@/registry/new-york-v4/ui/xlsx-viewer-row-patcher"

afterEach(() => {
  cleanup()
})

describe("XLSX row patcher", () => {
  it("patches pooled row text, numeric state, active state, and transforms in place", () => {
    const rowWindow = buildRowWindow([
      {
        ariaRowIndex: "1",
        rowNumber: "1",
        cells: [
          { text: "r0c0", numeric: false, active: false },
          { text: "r0c1", numeric: true, active: false },
        ],
      },
      {
        ariaRowIndex: "2",
        rowNumber: "2",
        cells: [
          { text: "r1c0", numeric: false, active: false },
          { text: "r1c1", numeric: true, active: false },
        ],
      },
      {
        ariaRowIndex: "3",
        rowNumber: "3",
        cells: [
          { text: "r2c0", numeric: false, active: false },
          { text: "r2c1", numeric: true, active: false },
        ],
      },
    ])
    const originalRows = rowHandles(rowWindow)
    const state = createPatchState({
      activeCell: { rowIndex: 5, columnIndex: 1 },
    })
    const { result } = renderHook(() =>
      useXlsxRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createViewport())).toBe("handled")

    const rows = rowHandles(rowWindow)
    expect(rows).toEqual(originalRows)
    expect(rows.map((row) => row.style.transform)).toEqual([
      "translate3d(0, 120px, 0)",
      "translate3d(0, 144px, 0)",
      "translate3d(0, 168px, 0)",
    ])
    expect(rowText(rows[0]!)).toEqual(["6", "r5c0", "500"])
    expect(rowText(rows[1]!)).toEqual(["7", "r6c0", "600"])
    expect(rowText(rows[2]!)).toEqual(["8", "r7c0", "700"])

    const firstRowCells = cellHandles(rows[0]!)
    expect(firstRowCells[0]!.className).toContain("justify-start")
    expect(firstRowCells[0]!.className).not.toContain("tabular-nums")
    expect(firstRowCells[1]!.className).toContain("justify-end")
    expect(firstRowCells[1]!.className).toContain("tabular-nums")
    expect(firstRowCells[1]!.className).toContain("ring-primary")
    expect(firstRowCells[1]!.hasAttribute("title")).toBe(false)
    expect(firstRowCells[1]!.getAttribute("aria-rowindex")).toBeNull()
    expect(firstRowCells[1]!.getAttribute("aria-colindex")).toBe("2")
  })

  it("does not mutate per-cell row indexes, titles, or stable classes during fast scroll patches", () => {
    const rowWindow = buildRowWindow([
      {
        ariaRowIndex: "1",
        rowNumber: "1",
        cells: [
          { text: "r0c0", numeric: false, active: false },
          { text: "r0c1", numeric: true, active: false },
        ],
      },
      {
        ariaRowIndex: "2",
        rowNumber: "2",
        cells: [
          { text: "r1c0", numeric: false, active: false },
          { text: "r1c1", numeric: true, active: false },
        ],
      },
      {
        ariaRowIndex: "3",
        rowNumber: "3",
        cells: [
          { text: "r2c0", numeric: false, active: false },
          { text: "r2c1", numeric: true, active: false },
        ],
      },
    ])
    const cells = Array.from(
      rowWindow.querySelectorAll<HTMLElement>('[data-slot="xlsx-cell"]')
    )
    const setAttributeSpies = cells.map((cell) =>
      vi.spyOn(cell, "setAttribute")
    )
    const classToggleSpies = cells.map((cell) =>
      vi.spyOn(cell.classList, "toggle")
    )
    const state = createPatchState()
    const { result } = renderHook(() =>
      useXlsxRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createViewport())).toBe("handled")

    expect(
      setAttributeSpies.flatMap((spy) =>
        spy.mock.calls.map(([attribute]) => attribute)
      )
    ).toEqual([])
    expect(
      classToggleSpies.reduce((count, spy) => count + spy.mock.calls.length, 0)
    ).toBe(0)
    for (const cell of cells) {
      expect(cell.getAttribute("aria-rowindex")).toBeNull()
      expect(cell.hasAttribute("title")).toBe(false)
    }
  })

  it("declines the fast path after the active cell changes", () => {
    const rowWindow = buildRowWindow([
      {
        ariaRowIndex: "1",
        rowNumber: "1",
        cells: [
          { text: "r0c0", numeric: false, active: false },
          { text: "r0c1", numeric: true, active: false },
        ],
      },
      {
        ariaRowIndex: "2",
        rowNumber: "2",
        cells: [
          { text: "r1c0", numeric: false, active: false },
          { text: "r1c1", numeric: true, active: false },
        ],
      },
      {
        ariaRowIndex: "3",
        rowNumber: "3",
        cells: [
          { text: "r2c0", numeric: false, active: false },
          { text: "r2c1", numeric: true, active: false },
        ],
      },
    ])
    const state = createPatchState()
    const { result } = renderHook(() =>
      useXlsxRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createViewport())).toBe("handled")
    state.activeCell = { rowIndex: 6, columnIndex: 1 }

    expect(result.current.patch({ ...createViewport(), scrollTop: 144 })).toBe(
      "pass"
    )
  })

  it("declines the fast path after horizontal columns change", () => {
    const rowWindow = buildRowWindow([
      {
        ariaRowIndex: "1",
        rowNumber: "1",
        cells: [
          { text: "r0c0", numeric: false, active: false },
          { text: "r0c1", numeric: true, active: false },
        ],
      },
      {
        ariaRowIndex: "2",
        rowNumber: "2",
        cells: [
          { text: "r1c0", numeric: false, active: false },
          { text: "r1c1", numeric: true, active: false },
        ],
      },
      {
        ariaRowIndex: "3",
        rowNumber: "3",
        cells: [
          { text: "r2c0", numeric: false, active: false },
          { text: "r2c1", numeric: true, active: false },
        ],
      },
    ])
    const state = createPatchState()
    const { result } = renderHook(() =>
      useXlsxRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createViewport())).toBe("handled")
    state.columnItems = [
      { key: "1", widthPx: 180, metadata: { columnIndex: 1 } },
      { key: "2", widthPx: 180, metadata: { columnIndex: 2 } },
    ]

    expect(result.current.patch({ ...createViewport(), scrollTop: 144 })).toBe(
      "pass"
    )
  })
})

function createPatchState(
  overrides: Partial<XlsxRowPatchState> = {}
): XlsxRowPatchState {
  return {
    activeCell: null,
    columnCount: 2,
    columnItems: [
      { key: "0", widthPx: 180, metadata: { columnIndex: 0 } },
      { key: "1", widthPx: 180, metadata: { columnIndex: 1 } },
    ],
    getCell: (rowIndex, columnIndex) => ({
      text: columnIndex === 1 ? String(rowIndex * 100) : `r${rowIndex}c0`,
      numeric: columnIndex === 1,
    }),
    rowCount: 20,
    rowHeight: 24,
    sheetName: "Sheet",
    ...overrides,
  }
}

function createViewport(): FixedGridViewport {
  return {
    scrollTop: 120,
    scrollLeft: 0,
    clientHeight: 48,
    clientWidth: 360,
    isJumpingRows: true,
    isJumpingColumns: false,
  }
}

function buildRowWindow(
  rows: Array<{
    ariaRowIndex: string
    rowNumber: string
    cells: Array<{ text: string; numeric: boolean; active: boolean }>
  }>
) {
  const rowWindow = document.createElement("div")
  for (const row of rows) {
    const rowElement = document.createElement("div")
    rowElement.dataset.slot = "xlsx-row"
    rowElement.setAttribute("role", "row")
    rowElement.setAttribute("aria-rowindex", row.ariaRowIndex)

    const rowNumber = document.createElement("div")
    rowNumber.dataset.slot = "xlsx-row-number"
    rowNumber.append(row.rowNumber)
    rowElement.append(rowNumber)

    row.cells.forEach((cellData, cellIndex) => {
      const cell = document.createElement("div")
      cell.dataset.slot = "xlsx-cell"
      cell.setAttribute("role", "gridcell")
      cell.setAttribute("aria-colindex", String(cellIndex + 1))
      cell.className = [
        "flex",
        "items-center",
        "truncate",
        cellData.numeric ? "justify-end tabular-nums" : "justify-start",
        cellData.active
          ? "bg-primary/12 ring-1 ring-primary/50 ring-inset"
          : "",
      ].join(" ")

      const span = document.createElement("span")
      span.append(cellData.text)
      cell.append(span)
      rowElement.append(cell)
    })

    rowWindow.append(rowElement)
  }
  return rowWindow
}

function rowHandles(rowWindow: HTMLElement) {
  return Array.from(rowWindow.querySelectorAll<HTMLElement>('[role="row"]'))
}

function cellHandles(row: HTMLElement) {
  return Array.from(
    row.querySelectorAll<HTMLElement>('[data-slot="xlsx-cell"]')
  )
}

function rowText(row: HTMLElement) {
  const rowNumber =
    row.querySelector<HTMLElement>('[data-slot="xlsx-row-number"]')
      ?.textContent ?? ""
  const cells = cellHandles(row).map((cell) => cell.textContent ?? "")
  return [rowNumber, ...cells]
}
