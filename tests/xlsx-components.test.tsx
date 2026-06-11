// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { XlsxGrid } from "@/registry/new-york-v4/ui/xlsx-grid"
import { XlsxGridRow } from "@/registry/new-york-v4/ui/xlsx-grid-row"
import { XlsxSheetTabs } from "@/registry/new-york-v4/ui/xlsx-sheet-tabs"

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
          { columnIndex: 0, size: 128 },
          { columnIndex: 1, size: 128 },
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
