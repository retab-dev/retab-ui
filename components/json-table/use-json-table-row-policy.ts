"use client"

import * as React from "react"

import type { FixedGridRowScrollStrategy } from "@/components/ui/fixed-grid-virtualization"
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import {
  useReadOnlyJsonRowPatcher,
  type ReadOnlyJsonRowPatchState,
} from "@/components/json-table/read-only-json-row-patcher"

export type JsonTableRowPolicy = {
  invalidateRows: () => void
  rowScrollStrategy: FixedGridRowScrollStrategy | undefined
}

export function useJsonTableRowPolicy({
  isJsonEditable,
  projectedRows,
  rowHeightPx,
  rowWindowRef,
  schemaVisibleColumns,
}: {
  isJsonEditable: boolean
  projectedRows: ProjectedRow[]
  rowHeightPx: number
  rowWindowRef: React.RefObject<HTMLElement | null>
  schemaVisibleColumns: VisibleColumn[]
}): JsonTableRowPolicy {
  const getReadOnlyRowPatchState =
    React.useCallback((): ReadOnlyJsonRowPatchState => {
      return {
        isEnabled: !isJsonEditable,
        projectedRows,
        rowHeightPx,
        visibleColumns: schemaVisibleColumns,
      }
    }, [isJsonEditable, projectedRows, rowHeightPx, schemaVisibleColumns])

  const readOnlyRowPatcher = useReadOnlyJsonRowPatcher({
    rowWindowRef,
    getState: getReadOnlyRowPatchState,
  })
  const rowScrollStrategy = React.useMemo(
    () =>
      isJsonEditable
        ? undefined
        : { handleViewport: readOnlyRowPatcher.patch },
    [isJsonEditable, readOnlyRowPatcher.patch]
  )

  return React.useMemo(
    () => ({
      invalidateRows: readOnlyRowPatcher.invalidate,
      rowScrollStrategy,
    }),
    [readOnlyRowPatcher.invalidate, rowScrollStrategy]
  )
}
