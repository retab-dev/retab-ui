// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { XlsxGrid } from "@/registry/new-york-v4/ui/xlsx-grid"
import { XlsxGridRow } from "@/registry/new-york-v4/ui/xlsx-grid-row"
import { XlsxSheetTabs } from "@/registry/new-york-v4/ui/xlsx-sheet-tabs"
import {
  isValidLoadedScrollTarget,
  resolveLoadedScrollTarget,
  toInternalCellRef,
  type PendingXlsxScrollTarget,
} from "@/registry/new-york-v4/ui/xlsx-viewer-scroll"

const originalResizeObserver = globalThis.ResizeObserver

beforeEach(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  globalThis.ResizeObserver = originalResizeObserver
})

function mockElementMetrics({
  clientHeight,
  clientWidth,
}: {
  clientHeight: number
  clientWidth: number
}) {
  const clientHeightSpy = vi
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockReturnValue(clientHeight)
  const clientWidthSpy = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockReturnValue(clientWidth)
  const scrollTo = vi.fn()
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  })
  return { clientHeightSpy, clientWidthSpy, scrollTo }
}

describe("XlsxSheetTabs", () => {
  it("renders sheet tabs with selected state and reports accepted clicks", () => {
    const onSelectSheet = vi.fn()

    render(
      <XlsxSheetTabs
        sheets={[
          {
            name: "Summary",
            rowCount: 1,
            columnCount: 1,
            nonEmptyCellCount: 1,
          },
          {
            name: "Details",
            rowCount: 2,
            columnCount: 3,
            nonEmptyCellCount: 4,
          },
        ]}
        activeSheetIndex={0}
        onSelectSheet={onSelectSheet}
      />
    )

    expect(
      screen.getByRole("tab", { name: "Summary" }).getAttribute("aria-selected")
    ).toBe("true")
    expect(
      screen.getByRole("tab", { name: "Details" }).getAttribute("aria-selected")
    ).toBe("false")

    fireEvent.click(screen.getByRole("tab", { name: "Details" }))

    expect(onSelectSheet).toHaveBeenCalledWith(1)
  })

  it("does not render a tablist for a single-sheet workbook", () => {
    render(
      <XlsxSheetTabs
        sheets={[
          { name: "Only", rowCount: 1, columnCount: 1, nonEmptyCellCount: 1 },
        ]}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />
    )

    expect(screen.queryByRole("tablist")).toBeNull()
  })
})

describe("XlsxGrid", () => {
  it("renders an explicit empty-sheet state", () => {
    render(
      <XlsxGrid
        rowCount={0}
        columnCount={0}
        sheetName="Empty"
        getCell={() => ({ text: "", numeric: false })}
        scale={1}
        isolateStyles={false}
      />
    )

    expect(screen.getByText("Empty sheet")).toBeTruthy()
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Empty is empty"
    )
  })

  it("treats invalid grid dimensions as an empty sheet", () => {
    render(
      <XlsxGrid
        rowCount={Number.MAX_SAFE_INTEGER + 1}
        columnCount={1}
        sheetName="Invalid"
        getCell={() => ({ text: "should not render", numeric: false })}
        scale={1}
        isolateStyles={false}
      />
    )

    expect(screen.getByText("Empty sheet")).toBeTruthy()
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Invalid is empty"
    )
    expect(screen.queryByText("should not render")).toBeNull()
  })

  it("falls back to a usable scale when the grid scale is invalid", () => {
    render(
      <XlsxGrid
        rowCount={1}
        columnCount={1}
        sheetName="Invalid scale"
        getCell={() => ({ text: "visible", numeric: false })}
        scale={Number.NaN}
        isolateStyles={false}
      />
    )

    expect(screen.getByRole("grid").getAttribute("aria-rowcount")).toBe("1")
    expect(screen.getByText("visible")).toBeTruthy()
  })

  it("renders visible rows and cells with grid indexes", () => {
    render(
      <XlsxGridRow
        rowIndex={2}
        getCell={(_rowIndex, columnIndex) => ({
          text: `cell ${columnIndex}`,
          numeric: columnIndex === 1,
        })}
        gridTemplate="52px 0px 128px 128px 0px"
        rowHeight={28}
        columnItems={[
          { key: "0", widthPx: 128, metadata: { columnIndex: 0 } },
          { key: "1", widthPx: 128, metadata: { columnIndex: 1 } },
        ]}
        leftPad={0}
        rightPad={0}
        start={56}
        activeColumnIndex={1}
      />
    )

    expect(screen.getByRole("row").getAttribute("aria-rowindex")).toBe("3")
    const cells = screen.getAllByRole("gridcell")
    expect(cells[0].getAttribute("aria-colindex")).toBe("1")
    expect(cells[1].getAttribute("aria-colindex")).toBe("2")
    expect(cells[1].className).toContain("ring-primary")
  })

  it("marks the active cell only when the active row is visible", () => {
    const { rerender } = render(
      <XlsxGrid
        rowCount={3}
        columnCount={3}
        sheetName="Active"
        getCell={(rowIndex, columnIndex) => ({
          text: `${rowIndex}:${columnIndex}`,
          numeric: false,
        })}
        scale={1}
        activeCell={{ rowIndex: 1, columnIndex: 2 }}
        isolateStyles={false}
      />
    )

    const activeCell = screen.getByTitle("1:2")
    expect(activeCell.className).toContain("ring-primary")
    expect(screen.getByTitle("0:2").className).not.toContain("ring-primary")

    rerender(
      <XlsxGrid
        rowCount={3}
        columnCount={3}
        sheetName="Active"
        getCell={(rowIndex, columnIndex) => ({
          text: `${rowIndex}:${columnIndex}`,
          numeric: false,
        })}
        scale={1}
        activeCell={{ rowIndex: 2, columnIndex: 2 }}
        isolateStyles={false}
      />
    )

    expect(screen.getByTitle("1:2").className).not.toContain("ring-primary")
    expect(screen.getByTitle("2:2").className).toContain("ring-primary")
  })

  it("scrolls requested cells to the viewport center using the scaled grid size", () => {
    const { scrollTo } = mockElementMetrics({
      clientHeight: 80,
      clientWidth: 240,
    })

    const { rerender } = render(
      <XlsxGrid
        rowCount={50}
        columnCount={20}
        sheetName="Scroll"
        getCell={() => ({ text: "", numeric: false })}
        scale={2}
        isolateStyles={false}
      />
    )

    rerender(
      <XlsxGrid
        rowCount={50}
        columnCount={20}
        sheetName="Scroll"
        getCell={() => ({ text: "", numeric: false })}
        scale={2}
        scrollRequest={{
          sheetIndex: 0,
          rowIndex: 10,
          columnIndex: 4,
          behavior: "auto",
          nonce: 1,
        }}
        isolateStyles={false}
      />
    )

    expect(scrollTo).toHaveBeenCalledWith({
      top: 548,
      left: 1032,
      behavior: "auto",
    })
  })
})

describe("XlsxViewer scroll model", () => {
  const sheets = [
    { name: "Summary", rowCount: 3, columnCount: 2, nonEmptyCellCount: 1 },
    { name: "Detail", rowCount: 4, columnCount: 5, nonEmptyCellCount: 1 },
  ]

  it("converts public compatibility cells to internal coordinates", () => {
    expect(toInternalCellRef({ sheet: 1, row: 2, col: 3 })).toEqual({
      sheetIndex: 1,
      rowIndex: 2,
      columnIndex: 3,
    })
    expect(toInternalCellRef({ sheet: -1, row: 0, col: 0 })).toBeNull()
    expect(toInternalCellRef({ sheet: 0.5, row: 0, col: 0 })).toBeNull()
    expect(toInternalCellRef({ sheet: 0, row: NaN, col: 0 })).toBeNull()
    expect(
      toInternalCellRef({
        sheet: Number.MAX_SAFE_INTEGER + 1,
        row: 0,
        col: 0,
      })
    ).toBeNull()
    expect(
      toInternalCellRef({
        sheet: 0,
        row: Number.MAX_SAFE_INTEGER + 1,
        col: 0,
      })
    ).toBeNull()
  })

  it("rejects invalid loaded scroll targets before resolving sheet changes", () => {
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: -1, columnIndex: 0 },
        sheets
      )
    ).toBe(false)
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 0, columnIndex: -1 },
        sheets
      )
    ).toBe(false)
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 0.5, columnIndex: 0 },
        sheets
      )
    ).toBe(false)
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 2, columnIndex: 1 },
        sheets
      )
    ).toBe(true)
  })

  it("rejects loaded scroll targets that only fit invalid sheet dimensions", () => {
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 1, columnIndex: 0 },
        [
          {
            name: "Fractional",
            rowCount: 1.5,
            columnCount: 1,
            nonEmptyCellCount: 0,
          },
        ]
      )
    ).toBe(false)

    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 0, columnIndex: 0 },
        [
          {
            name: "Infinite",
            rowCount: Number.POSITIVE_INFINITY,
            columnCount: 1,
            nonEmptyCellCount: 0,
          },
        ]
      )
    ).toBe(false)
  })

  it("replays a pending pre-load scroll target after sheets are known", () => {
    const pendingTarget: PendingXlsxScrollTarget = {
      sheetIndex: 1,
      rowIndex: 2,
      columnIndex: 3,
      behavior: "auto",
    }

    expect(
      resolveLoadedScrollTarget({
        activeSheetIndex: 0,
        target: pendingTarget,
        sheets,
      })
    ).toEqual({
      sheetIndex: 1,
      request: pendingTarget,
      changed: true,
    })
  })

  it("drops an out-of-bounds pending pre-load scroll target", () => {
    expect(
      resolveLoadedScrollTarget({
        activeSheetIndex: 0,
        target: {
          sheetIndex: 1,
          rowIndex: 9,
          columnIndex: 3,
          behavior: "auto",
        },
        sheets,
      })
    ).toBeNull()
  })

  it("resolves same-sheet loaded targets without reporting a sheet change", () => {
    const target: PendingXlsxScrollTarget = {
      sheetIndex: 0,
      rowIndex: 2,
      columnIndex: 1,
      behavior: "smooth",
    }

    expect(
      resolveLoadedScrollTarget({
        activeSheetIndex: 0,
        target,
        sheets,
      })
    ).toEqual({
      sheetIndex: 0,
      request: target,
      changed: false,
    })
  })
})
