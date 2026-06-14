import { describe, expect, it } from "vitest"

import type {
  ProjectedCell,
  ProjectedRow,
} from "@/components/json-table/lib/document-projection"
import { shareProjectedRows } from "@/components/json-table/lib/projected-row-sharing"

function cell(overrides: Partial<ProjectedCell> = {}): ProjectedCell {
  return {
    key: "vendor",
    value: "ACME",
    displayValue: "ACME",
    templateFieldPath: "vendor",
    materializedFieldPath: "vendor",
    arrayIndexes: [],
    ...overrides,
  }
}

function row(cells: Array<ProjectedCell | undefined>): ProjectedRow {
  return { rowIndex: 0, cells }
}

describe("projected row sharing", () => {
  it("reuses unchanged row and cell identities", () => {
    const previousCell = cell()
    const previousRow = row([previousCell])
    const nextRows = [row([cell()])]

    const sharedRows = shareProjectedRows([previousRow], nextRows)

    expect(sharedRows[0]).toBe(previousRow)
    expect(sharedRows[0]?.cells[0]).toBe(previousCell)
  })

  it("replaces only the changed primitive cell", () => {
    const previousVendorCell = cell()
    const previousTotalCell = cell({
      key: "total",
      value: 1,
      displayValue: "1",
      templateFieldPath: "total",
      materializedFieldPath: "total",
    })
    const previousRow = row([previousVendorCell, previousTotalCell])

    const sharedRows = shareProjectedRows(
      [previousRow],
      [
        row([
          cell({ value: "Globex", displayValue: "Globex" }),
          cell({
            key: "total",
            value: 1,
            displayValue: "1",
            templateFieldPath: "total",
            materializedFieldPath: "total",
          }),
        ]),
      ]
    )

    expect(sharedRows[0]).not.toBe(previousRow)
    expect(sharedRows[0]?.cells[0]).not.toBe(previousVendorCell)
    expect(sharedRows[0]?.cells[1]).toBe(previousTotalCell)
  })

  it("does not reuse cells when array indexes change", () => {
    const previousCell = cell({
      key: "lines.*.name",
      materializedFieldPath: "lines.0.name",
      arrayIndexes: [0],
    })

    const sharedRows = shareProjectedRows(
      [row([previousCell])],
      [
        row([
          cell({
            key: "lines.*.name",
            materializedFieldPath: "lines.1.name",
            arrayIndexes: [1],
          }),
        ]),
      ]
    )

    expect(sharedRows[0]?.cells[0]).not.toBe(previousCell)
  })

  it("does not reuse cells when display value changes", () => {
    const previousCell = cell({ value: "2024-01-02", displayValue: "Jan 2" })

    const sharedRows = shareProjectedRows(
      [row([previousCell])],
      [row([cell({ value: "2024-01-02", displayValue: "Jan 02, 2024" })])]
    )

    expect(sharedRows[0]?.cells[0]).not.toBe(previousCell)
  })

  it("does not reuse rows when row length changes", () => {
    const previousRow = row([cell()])
    const nextRow = row([cell(), cell({ key: "total" })])

    const sharedRows = shareProjectedRows([previousRow], [nextRow])

    expect(sharedRows[0]).not.toBe(previousRow)
  })
})
