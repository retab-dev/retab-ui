"use client"

import * as React from "react"

import type { FixedGridRowScrollStrategy } from "@/components/ui/fixed-grid-virtualization"
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import {
  useScalarReadOnlyJsonRowPatcher,
  type ScalarReadOnlyJsonRowPatchState,
} from "@/components/json-table/scalar-read-only-json-row-patcher"

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
  const getScalarReadOnlyRowPatchState =
    React.useCallback((): ScalarReadOnlyJsonRowPatchState => {
      return {
        isEnabled: !isJsonEditable,
        projectedRows,
        rowHeightPx,
        visibleColumns: schemaVisibleColumns,
      }
    }, [isJsonEditable, projectedRows, rowHeightPx, schemaVisibleColumns])

  const scalarReadOnlyRowPatcher = useScalarReadOnlyJsonRowPatcher({
    rowWindowRef,
    getState: getScalarReadOnlyRowPatchState,
  })
  const rowScrollStrategy = React.useMemo(
    () =>
      isJsonEditable
        ? undefined
        : { handleViewport: scalarReadOnlyRowPatcher.patch },
    [isJsonEditable, scalarReadOnlyRowPatcher.patch]
  )

  return React.useMemo(
    () => ({
      invalidateRows: scalarReadOnlyRowPatcher.invalidate,
      rowScrollStrategy,
    }),
    [scalarReadOnlyRowPatcher.invalidate, rowScrollStrategy]
  )
}
