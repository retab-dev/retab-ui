import * as React from "react"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import {
  jsonTableFullRenderedColumnWindow,
  jsonTableVirtualRenderedColumnWindow,
  type JsonTableRenderedColumnItem,
  type JsonTableRenderedColumnWindow,
} from "@/components/json-table/json-table-rendered-column-window"

export function useJsonTableRenderedColumnWindow({
  isJsonEditable,
  leftPadWidthPx,
  renderedBodyColumnItems,
  rightPadWidthPx,
  schemaVisibleColumns,
}: {
  isJsonEditable: boolean
  leftPadWidthPx: number
  renderedBodyColumnItems: JsonTableRenderedColumnItem[]
  rightPadWidthPx: number
  schemaVisibleColumns: VisibleColumn[]
}): JsonTableRenderedColumnWindow {
  return React.useMemo(() => {
    if (!isJsonEditable) {
      return jsonTableFullRenderedColumnWindow(schemaVisibleColumns)
    }

    return jsonTableVirtualRenderedColumnWindow({
      columnItems: renderedBodyColumnItems,
      leftPadWidthPx,
      rightPadWidthPx,
      schemaVisibleColumns,
    })
  }, [
    isJsonEditable,
    leftPadWidthPx,
    renderedBodyColumnItems,
    rightPadWidthPx,
    schemaVisibleColumns,
  ])
}
