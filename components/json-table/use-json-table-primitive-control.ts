import * as React from "react"

import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { replaceJsonTablePrimitiveActiveCell } from "@/components/json-table/json-table-primitive-active-cell-replacement"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { useRefCallback } from "@/components/json-table/path-utils"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"
import { useJsonTablePrimitiveCellController } from "@/components/json-table/use-json-table-primitive-cell-controller"

export type JsonTablePrimitiveControl = {
  commitPrimitiveValue: (value: unknown) => void
  primitiveEffectiveValue: unknown
  setPrimitiveActive: (active: boolean) => void
}

export function useJsonTablePrimitiveControl({
  props,
  cellField,
}: {
  props: JsonTableCellProps
  cellField: JsonTableCellField
}): JsonTablePrimitiveControl {
  const {
    commitPrimitiveValueChange,
    effectiveValue: primitiveEffectiveValue,
  } = useJsonTablePrimitiveCellController({
    document: props.document,
    materializedFieldPath: cellField.materializedFieldPath,
    value: cellField.cellValue,
    isEditable: cellField.isJsonEditable && cellField.isPrimitiveCell,
    onCellCommit: props.onCellCommit,
    primitiveEditStore: props.primitiveEditStore,
  })

  const commitPrimitiveValue = useRefCallback((nextValue: unknown) => {
    if (!cellField.fieldMetadata) return
    commitPrimitiveValueChange(
      formatValueForCommit(nextValue, cellField.fieldMetadata.rawSchema)
    )
  })

  const setPrimitiveActive = React.useCallback(
    (nextActive: boolean) => {
      if (
        !cellField.cellId ||
        !cellField.materializedFieldPath ||
        !cellField.isPrimitiveCell
      ) {
        return
      }
      if (nextActive) {
        replaceJsonTablePrimitiveActiveCell({
          store: props.primitiveActiveCellStore,
          setPrimitiveActiveCell: props.setPrimitiveActiveCell,
          nextActiveCell: {
            cellId: cellField.cellId,
            docId: props.docId,
            fieldPath: cellField.materializedFieldPath,
          },
        })
        return
      }
      if (
        props.primitiveActiveCellStore.getSnapshot() ===
        cellField.primitiveActiveCell
      ) {
        props.setPrimitiveActiveCell(null)
      }
    },
    [
      cellField.cellId,
      cellField.isPrimitiveCell,
      cellField.materializedFieldPath,
      cellField.primitiveActiveCell,
      props.docId,
      props.primitiveActiveCellStore,
      props.setPrimitiveActiveCell,
    ]
  )

  return {
    commitPrimitiveValue,
    primitiveEffectiveValue,
    setPrimitiveActive,
  }
}
