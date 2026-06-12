// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { XlsxGrid } from "@/registry/new-york-v4/ui/xlsx-grid"
import { XlsxGridRow } from "@/registry/new-york-v4/ui/xlsx-grid-row"
import { XlsxSheetTabs } from "@/registry/new-york-v4/ui/xlsx-sheet-tabs"
import {
  resolveLoadedScrollTarget,
  toInternalCellRef,
  type PendingXlsxScrollTarget,
} from "@/registry/new-york-v4/ui/xlsx-viewer-scroll"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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
})
