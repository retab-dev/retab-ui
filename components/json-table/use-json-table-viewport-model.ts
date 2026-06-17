"use client"

import * as React from "react"

import { fixedGridColumnWidths } from "@/components/ui/fixed-grid-columns"
import {
  useFixedGridVirtualization,
  type FixedGridRowScrollStrategy,
  type FixedGridVirtualItem,
} from "@/components/ui/fixed-grid-virtualization"
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type { JsonTableRenderedColumnWindow } from "@/components/json-table/json-table-rendered-column-window"
import {
  getColumnWidthPx,
  type ColumnWidth,
} from "@/components/json-table/table-options-store"
import { useJsonTableRenderedColumnWindow } from "@/components/json-table/use-json-table-rendered-column-window"

const defaultEditableRowOverscan = 0
const defaultReadOnlyRowOverscan = 12
const editableColumnOverscan = 2

export type JsonTableViewportModel = {
  renderedColumnWindow: JsonTableRenderedColumnWindow
  totalRowSize: number
  totalWidth: number
  virtualRows: FixedGridVirtualItem[]
}

export function useJsonTableViewportModel({
  columnWidth,
  isJsonEditable,
  jumpOverscan,
  overscan,
  rowCount,
  rowHeightPx,
  rowScrollStrategy,
  schemaVisibleColumns,
  scrollElement,
  scrollRef,
}: {
  columnWidth: ColumnWidth
  isJsonEditable: boolean
  jumpOverscan?: number
  overscan?: number
  rowCount: number
  rowHeightPx: number
  rowScrollStrategy: FixedGridRowScrollStrategy | undefined
  schemaVisibleColumns: VisibleColumn[]
  scrollElement: HTMLElement | null
  scrollRef: React.RefObject<HTMLElement | null>
}): JsonTableViewportModel {
  const totalWidth = React.useMemo(
    () =>
      fixedGridColumnWidths(schemaVisibleColumns).reduce(
        (total, widthPx) => total + widthPx,
        0
      ),
    [schemaVisibleColumns]
  )
  const resolvedOverscan =
    overscan ??
    (isJsonEditable ? defaultEditableRowOverscan : defaultReadOnlyRowOverscan)
  const resolvedJumpOverscan = jumpOverscan ?? resolvedOverscan
  const {
    columnItems: renderedBodyColumnItems,
    leftPad: leftPadWidthPx,
    rightPad: rightPadWidthPx,
    virtualRows,
    totalRowSize,
  } = useFixedGridVirtualization({
    rowCount,
    columnCount: schemaVisibleColumns.length,
    rowSize: rowHeightPx,
    columnSize: getColumnWidthPx(columnWidth),
    rowOverscan: resolvedOverscan,
    columnOverscan: editableColumnOverscan,
    jumpRowOverscan: resolvedJumpOverscan,
    jumpColumnOverscan: editableColumnOverscan,
    minimumRenderedRows: 1,
    rowScrollStrategy,
    scrollRef,
    scrollElement,
    virtualizeColumns: isJsonEditable,
  })
  const renderedColumnWindow = useJsonTableRenderedColumnWindow({
    isJsonEditable,
    leftPadWidthPx,
    renderedBodyColumnItems,
    rightPadWidthPx,
    schemaVisibleColumns,
  })

  return React.useMemo(
    () => ({
      renderedColumnWindow,
      totalRowSize,
      totalWidth,
      virtualRows,
    }),
    [renderedColumnWindow, totalRowSize, totalWidth, virtualRows]
  )
}
