import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"

type JsonTableRenderedColumnItem = {
  index: number
}

export type JsonTableRenderedColumnWindow = {
  columns: VisibleColumn[]
  projectedCellIndexes: number[]
  leftPadWidthPx: number
  rightPadWidthPx: number
}

export function jsonTableFullRenderedColumnWindow(
  schemaVisibleColumns: VisibleColumn[]
): JsonTableRenderedColumnWindow {
  return {
    columns: schemaVisibleColumns,
    projectedCellIndexes: schemaVisibleColumns.map((_, index) => index),
    leftPadWidthPx: 0,
    rightPadWidthPx: 0,
  }
}

export function jsonTableVirtualRenderedColumnWindow({
  columnItems,
  leftPadWidthPx,
  rightPadWidthPx,
  schemaVisibleColumns,
}: {
  columnItems: JsonTableRenderedColumnItem[]
  leftPadWidthPx: number
  rightPadWidthPx: number
  schemaVisibleColumns: VisibleColumn[]
}): JsonTableRenderedColumnWindow {
  return {
    columns: columnItems.map((item) => schemaVisibleColumns[item.index]!),
    projectedCellIndexes: columnItems.map((item) => item.index),
    leftPadWidthPx,
    rightPadWidthPx,
  }
}
