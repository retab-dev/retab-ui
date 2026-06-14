import * as React from "react"

import {
  type JsonTableCellCommitHandler,
  isJsonTableNoOpCommit,
} from "@/components/json-table/json-table-cell-commit"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { replaceJsonTablePrimitiveActiveCell } from "@/components/json-table/json-table-primitive-active-cell-store"
import {
  useJsonTablePrimitiveEditSnapshot,
  type JsonTablePrimitiveEditStore,
} from "@/components/json-table/json-table-primitive-edit-store"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { getValueAtPath } from "@/components/json-table/lib/document-paths"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { useRefCallback } from "@/components/json-table/path-utils"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"

export function useJsonTablePrimitiveCommitController({
  document,
  materializedFieldPath,
  value,
  isEditable,
  onCellCommit,
  primitiveEditStore,
}: {
  document: TableDocument
  materializedFieldPath: string | undefined
  value: unknown
  isEditable: boolean | undefined
  onCellCommit: JsonTableCellCommitHandler
  primitiveEditStore: JsonTablePrimitiveEditStore
}) {
  const primitiveEdit = useJsonTablePrimitiveEditSnapshot({
    fieldPath: materializedFieldPath,
    store: primitiveEditStore,
  })

  React.useEffect(() => {
    primitiveEditStore.reconcileProjectedValue(materializedFieldPath, value)
  }, [primitiveEditStore, materializedFieldPath, value])

  const effectiveValue = primitiveEdit.hasValue ? primitiveEdit.value : value

  const commitValidatedValue = useRefCallback(function (
    validatedValue: unknown
  ) {
    if (!materializedFieldPath || !isEditable) return

    const previousValue = primitiveEdit.hasValue
      ? primitiveEdit.value
      : getValueAtPath(document.data, materializedFieldPath)
    if (isJsonTableNoOpCommit(previousValue, validatedValue)) return

    markJsonTableProfile("cell-commit-local-start", {
      fieldPath: materializedFieldPath,
    })
    primitiveEditStore.commitValue(
      materializedFieldPath,
      validatedValue,
      previousValue
    )
    markJsonTableProfile("cell-commit-local-end", {
      fieldPath: materializedFieldPath,
    })

    React.startTransition(() => {
      markJsonTableProfile("cell-commit-transition-start", {
        fieldPath: materializedFieldPath,
      })
      onCellCommit({
        fieldPath: materializedFieldPath,
        value: validatedValue,
        previousValue,
        visibleThrough: "primitivePendingValue",
      })
      markJsonTableProfile("cell-commit-transition-end", {
        fieldPath: materializedFieldPath,
      })
    })
  })

  return {
    effectiveValue,
    commitValidatedValue,
  }
}

export function useJsonTablePrimitiveControl({
  props,
  cellField,
}: {
  props: JsonTableCellProps
  cellField: JsonTableCellField
}) {
  const {
    commitValidatedValue,
    effectiveValue,
  } = useJsonTablePrimitiveCommitController({
    document: props.document,
    materializedFieldPath: cellField.materializedFieldPath,
    value: cellField.cellValue,
    isEditable: cellField.isJsonEditable && cellField.isPrimitiveCell,
    onCellCommit: props.onCellCommit,
    primitiveEditStore: props.primitiveEditStore,
  })

  const commitValue = useRefCallback((nextValue: unknown) => {
    if (!cellField.fieldMetadata) return
    commitValidatedValue(
      formatValueForCommit(nextValue, cellField.fieldMetadata.rawSchema)
    )
  })

  const setActive = React.useCallback(
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
    commitValue,
    effectiveValue,
    setActive,
  }
}
