import * as React from "react"

import type { DataCellActivationIntent } from "@/components/ui/data-cell"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import type { JsonTablePrimitiveCellProps } from "@/components/json-table/json-table-primitive-cell"
import { finishPreviousPrimitiveEditor } from "@/components/json-table/json-table-primitive-handoff"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { useRefCallback } from "@/components/json-table/path-utils"
import { useCellController } from "@/components/json-table/use-cell-controller"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"

export type JsonTablePrimitiveControl = {
  activationRequest: DataCellActivationIntent | undefined
  commitPrimitiveValue: (value: unknown) => void
  primitiveEffectiveValue: unknown
  setActivationRequest: React.Dispatch<
    React.SetStateAction<DataCellActivationIntent | undefined>
  >
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
  const [activationRequest, setActivationRequest] =
    React.useState<DataCellActivationIntent>()
  const { commitValueChange, effectiveValue: primitiveEffectiveValue } =
    useCellController({
      document: props.document,
      docId: props.docId,
      materializedFieldPath: cellField.materializedFieldPath,
      value: cellField.cellValue,
      isEditable: cellField.isJsonEditable && cellField.isPrimitiveCell,
      onDocumentDataChange: props.onDocumentDataChange,
    })

  const commitPrimitiveValue = useRefCallback((nextValue: unknown) => {
    if (!cellField.fieldMetadata) return
    commitValueChange(
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
          primitiveActiveCell: props.primitiveActiveCell,
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
      props.primitiveActiveCell,
      props.primitiveEditorHandleRef,
      props.setPrimitiveActiveCell,
    ]
  )

  React.useEffect(() => {
    if (!cellField.isPrimitiveActive) setActivationRequest(undefined)
  }, [cellField.isPrimitiveActive])

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
    activationRequest,
    commitPrimitiveValue,
    primitiveEffectiveValue,
    setActivationRequest,
    setPrimitiveActive,
    setPrimitiveEditorHandle,
  }
}
