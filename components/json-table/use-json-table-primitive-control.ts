import * as React from "react"

import type { DataCellActivationSource } from "@/components/ui/data-cell"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import type { JsonTablePrimitiveCellProps } from "@/components/json-table/json-table-primitive-cell"
import { finishPreviousPrimitiveEditor } from "@/components/json-table/json-table-primitive-handoff"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { useRefCallback } from "@/components/json-table/path-utils"
import { useCellController } from "@/components/json-table/use-cell-controller"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"

export type JsonTablePrimitiveControl = {
  activationSource: DataCellActivationSource | undefined
  commitPrimitiveValue: (value: unknown) => void
  primitiveEffectiveValue: unknown
  setActivationSource: React.Dispatch<
    React.SetStateAction<DataCellActivationSource | undefined>
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
  const [activationSource, setActivationSource] =
    React.useState<DataCellActivationSource>()
  const { commitValueChange, effectiveValue: primitiveEffectiveValue } =
    useCellController({
      document: props.document,
      docId: props.docId,
      materializedFieldPath: cellField.materializedFieldPath,
      value: cellField.cellValue,
      isEditable: cellField.isJsonEditable && cellField.isPrimitiveCell,
      onDocumentDataChange: props.onDocumentDataChange,
      primitiveEditStore: props.primitiveEditStore,
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

  React.useEffect(() => {
    if (!cellField.isPrimitiveActive) setActivationSource(undefined)
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
    activationSource,
    commitPrimitiveValue,
    primitiveEffectiveValue,
    setActivationSource,
    setPrimitiveActive,
    setPrimitiveEditorHandle,
  }
}
