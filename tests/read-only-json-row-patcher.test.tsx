// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, describe, expect, it } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import {
  useReadOnlyJsonRowPatcher,
  type ReadOnlyJsonRowPatchState,
} from "@/components/json-table/read-only-json-row-patcher"
import type { FixedGridViewport } from "@/components/ui/fixed-grid-virtualization"

afterEach(() => {
  cleanup()
})

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    amount: { type: "number" },
    is_paid: { type: "boolean" },
  },
}

describe("read-only JSON row patcher", () => {
  it("patches read-only row positions and cell text", () => {
    const rowWindow = buildRowWindow([
      { rowIndex: 0, cells: ["row 0", "1"] },
      { rowIndex: 1, cells: ["row 1", "2"] },
      { rowIndex: 2, cells: ["row 2", "3"] },
    ])
    const state = createPatchState()
    const { result } = renderHook(() =>
      useReadOnlyJsonRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createJumpViewport())).toBe("handled")

    const rows = rowHandles(rowWindow)
    expect(rows.map((row) => row.dataset.index)).toEqual(["3", "4", "5"])
    expect(rows.map((row) => row.style.transform)).toEqual([
      "translate3d(0, 30px, 0)",
      "translate3d(0, 40px, 0)",
      "translate3d(0, 50px, 0)",
    ])
    expect(rowText(rows[0]!)).toEqual(["row 3", "4"])
    expect(rowText(rows[1]!)).toEqual(["row 4", "5"])
    expect(rowText(rows[2]!)).toEqual(["row 5", "6"])
  })

  it("falls back to React when a required read-only text node is missing", () => {
    const rowWindow = buildRowWindow([
      { rowIndex: 0, cells: ["row 0", "1"] },
      { rowIndex: 1, cells: ["row 1", "2"] },
      { rowIndex: 2, cells: ["row 2", "3"] },
    ])
    const firstText = rowWindow.querySelector(
      '[data-slot="json-table-read-only-cell"] [data-slot="data-cell-value"]'
    )
    firstText?.replaceChildren(document.createElement("strong"))
    const state = createPatchState()
    const { result } = renderHook(() =>
      useReadOnlyJsonRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      })
    )

    expect(result.current.patch(createJumpViewport())).toBe("pass")
    expect(rowText(rowHandles(rowWindow)[0]!)).toEqual(["", "1"])
  })
})

function createPatchState(
  overrides: Partial<ReadOnlyJsonRowPatchState> = {}
): ReadOnlyJsonRowPatchState {
  return {
    isEnabled: true,
    projectedRows: Array.from({ length: 10 }, (_, rowIndex) =>
      projectedRow(rowIndex)
    ),
    rowHeightPx: 10,
    visibleColumns: [visibleColumn("name"), visibleColumn("amount")],
    ...overrides,
  }
}

function visibleColumn(fieldPath: "name" | "amount" | "is_paid"): VisibleColumn {
  const fieldMetadata = getFieldMetadata(schema, fieldPath)
  if (!fieldMetadata) throw new Error(`Missing metadata for ${fieldPath}`)
  return {
    key: fieldPath,
    widthPx: 100,
    fieldMetadata,
  }
}

function projectedRow(rowIndex: number): ProjectedRow {
  return {
    rowIndex,
    cells: [
      {
        key: "name",
        value: `row ${rowIndex}`,
        templateFieldPath: "name",
        materializedFieldPath: "name",
        arrayIndexes: [],
      },
      {
        key: "amount",
        value: rowIndex + 1,
        templateFieldPath: "amount",
        materializedFieldPath: "amount",
        arrayIndexes: [],
      },
    ],
  }
}

function createJumpViewport(): FixedGridViewport {
  return {
    scrollTop: 30,
    scrollLeft: 0,
    clientHeight: 20,
    clientWidth: 200,
    isJumpingRows: true,
    isJumpingColumns: false,
  }
}

function buildRowWindow(
  rows: Array<{ rowIndex: number; cells: [string, string] }>
) {
  const rowWindow = document.createElement("tbody")
  for (const row of rows) {
    const rowElement = document.createElement("tr")
    rowElement.dataset.slot = "json-table-row"
    rowElement.dataset.index = String(row.rowIndex)

    for (const [cellIndex, text] of row.cells.entries()) {
      const cell = document.createElement("td")
      cell.dataset.slot = "json-table-read-only-cell"
      cell.dataset.fieldPath = cellIndex === 0 ? "name" : "amount"
      const span = document.createElement("span")
      span.dataset.slot = "data-cell-value"
      span.append(text)
      cell.append(span)
      rowElement.append(cell)
    }

    rowWindow.append(rowElement)
  }
  return rowWindow
}

function rowHandles(rowWindow: HTMLElement) {
  return Array.from(
    rowWindow.querySelectorAll<HTMLElement>('[data-slot="json-table-row"]')
  )
}

function rowText(row: HTMLElement) {
  return Array.from(
    row.querySelectorAll<HTMLElement>(
      '[data-slot="json-table-read-only-cell"]'
    )
  ).map((cell) => cell.textContent ?? "")
}
