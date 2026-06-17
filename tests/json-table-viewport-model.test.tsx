// @vitest-environment jsdom

import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import { useJsonTableViewportModel } from "@/components/json-table/use-json-table-viewport-model"

function column(index: number): VisibleColumn {
  return {
    key: `column_${index}`,
    widthPx: 96,
  }
}

const schemaVisibleColumns = Array.from({ length: 12 }, (_, index) =>
  column(index)
)

function renderViewportModel(isJsonEditable: boolean) {
  const scrollElement = document.createElement("div")
  Object.defineProperty(scrollElement, "clientHeight", {
    configurable: true,
    value: 96,
  })
  Object.defineProperty(scrollElement, "clientWidth", {
    configurable: true,
    value: 96,
  })

  return renderHook(() =>
    useJsonTableViewportModel({
      columnWidth: "large",
      isJsonEditable,
      rowCount: 10,
      rowHeightPx: 32,
      rowScrollStrategy: undefined,
      schemaVisibleColumns,
      scrollElement,
      scrollRef: { current: scrollElement },
    })
  )
}

describe("useJsonTableViewportModel", () => {
  it("keeps read-only tables on the full schema-visible column window", () => {
    const { result } = renderViewportModel(false)

    expect(result.current.renderedColumnWindow.columns).toEqual(
      schemaVisibleColumns
    )
    expect(result.current.renderedColumnWindow.projectedCellIndexes).toEqual(
      schemaVisibleColumns.map((_, index) => index)
    )
    expect(result.current.renderedColumnWindow.leftPadWidthPx).toBe(0)
    expect(result.current.renderedColumnWindow.rightPadWidthPx).toBe(0)
  })

  it("keeps editable tables on the virtualized body column window", () => {
    const { result } = renderViewportModel(true)

    expect(result.current.renderedColumnWindow.columns.length).toBeLessThan(
      schemaVisibleColumns.length
    )
    expect(result.current.renderedColumnWindow.projectedCellIndexes[0]).toBe(0)
    expect(result.current.totalRowSize).toBe(320)
    expect(result.current.totalWidth).toBe(1152)
  })
})
