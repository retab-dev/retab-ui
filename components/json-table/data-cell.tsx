"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import type { DataCellProps } from "@/components/json-table/data-cell-types"
import { cmp } from "@/components/json-table/path-utils"
import { ReadOnlyDataCell } from "@/components/json-table/read-only-data-cell"

const EditableDataCell = dynamic(
  () =>
    import("@/components/json-table/editable-data-cell").then((module) => ({
      default: module.EditableDataCell,
    })),
  { ssr: false }
)

function memoVariables(props: DataCellProps) {
  const { document, ...rest } = props
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  return { ...rest, materializedFieldPath, document }
}

export const DataCell = React.memo(
  (props: DataCellProps) => {
    if (!props.allowEditing) {
      return <ReadOnlyDataCell {...props} />
    }
    return <EditableDataCell {...props} />
  },
  (prev: DataCellProps, next: DataCellProps) => {
    return cmp(memoVariables(prev), memoVariables(next), {
      deep: ["projectedCell.arrayIndexes"],
    })
  }
)
DataCell.displayName = "DataCell"
