import { describe, expect, it } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import {
  jsonTableFullRenderedColumnWindow,
  jsonTableVirtualRenderedColumnWindow,
} from "@/components/json-table/json-table-rendered-column-window"

function column(key: string): VisibleColumn {
  return {
    key,
    widthPx: 80,
  }
}

describe("json table rendered column window", () => {
  it("builds a full rendered column window for non-virtualized rows", () => {
    const columns = [column("a"), column("b"), column("c")]

    expect(jsonTableFullRenderedColumnWindow(columns)).toEqual({
      columns,
      projectedCellIndexes: [0, 1, 2],
      leftPadWidthPx: 0,
      rightPadWidthPx: 0,
    })
  })

  it("builds a virtual rendered column window with projected cell indexes", () => {
    const columns = [column("a"), column("b"), column("c"), column("d")]

    expect(
      jsonTableVirtualRenderedColumnWindow({
        columnItems: [{ index: 1 }, { index: 3 }],
        leftPadWidthPx: 80,
        rightPadWidthPx: 160,
        schemaVisibleColumns: columns,
      })
    ).toEqual({
      columns: [columns[1], columns[3]],
      projectedCellIndexes: [1, 3],
      leftPadWidthPx: 80,
      rightPadWidthPx: 160,
    })
  })
})
