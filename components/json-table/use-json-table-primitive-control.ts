import * as React from "react"

import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import type { JsonTablePrimitiveCellProps } from "@/components/json-table/json-table-primitive-cell"
import { finishPreviousPrimitiveEditor } from "@/components/json-table/json-table-primitive-handoff"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { useRefCallback } from "@/components/json-table/path-utils"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"
import { useJsonTablePrimitiveCellController } from "@/components/json-table/use-json-table-primitive-cell-controller"

export type JsonTablePrimitiveControl = {
  commitPrimitiveValue: (value: unknown) => void
  primitiveEffectiveValue: unknown
  setPrimitiveActive: (active: boolean) => void
  setPrimitiveEditorHandle: JsonTablePrimitiveCellProps["onEditorHandleChange"]
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
        finishPreviousPrimitiveEditor({
          currentCellId: cellField.cellId,
          primitiveActiveCell: props.primitiveActiveCellStore.getSnapshot(),
          primitiveEditorHandleRef: props.primitiveEditorHandleRef,
          setPrimitiveActiveCell: props.setPrimitiveActiveCell,
        })
        props.setPrimitiveActiveCell({
          cellId: cellField.cellId,
          docId: props.docId,
          fieldPath: cellField.materializedFieldPath,
        })
        return
      }
      if (cellField.isPrimitiveActive) props.setPrimitiveActiveCell(null)
    },
    [
      cellField.cellId,
      cellField.isPrimitiveActive,
      cellField.isPrimitiveCell,
      cellField.materializedFieldPath,
      props.docId,
      props.primitiveActiveCellStore,
      props.primitiveEditorHandleRef,
      props.setPrimitiveActiveCell,
    ]
  )

  const setPrimitiveEditorHandle = React.useCallback<
    JsonTablePrimitiveCellProps["onEditorHandleChange"]
  >(
    (handle) => {
      if (!cellField.isPrimitiveActive) return
      props.primitiveEditorHandleRef.current = handle
    },
    [cellField.isPrimitiveActive, props.primitiveEditorHandleRef]
  )

  return {
    commitPrimitiveValue,
    primitiveEffectiveValue,
    setPrimitiveActive,
    setPrimitiveEditorHandle,
  }
}
