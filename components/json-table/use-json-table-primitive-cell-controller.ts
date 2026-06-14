import * as React from "react"

import {
  type JsonTableCellCommitHandler,
  isJsonTableNoOpCommit,
  jsonTableCommittedTextValue,
} from "@/components/json-table/json-table-cell-commit"
import {
  useJsonTablePrimitiveEditSnapshot,
  type JsonTablePrimitiveEditStore,
} from "@/components/json-table/json-table-primitive-edit-store"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { getValueAtPath } from "@/components/json-table/lib/document-paths"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { useRefCallback } from "@/components/json-table/path-utils"

export function useJsonTablePrimitiveCellController({
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
  const committedTextValue = jsonTableCommittedTextValue(effectiveValue)

  const commitPrimitiveValueChange = useRefCallback(function (
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
    committedTextValue,
    commitPrimitiveValueChange,
  }
}
