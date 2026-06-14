import * as React from "react"

import { getValueAtPath } from "@/components/json-table/lib/document-paths"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  fallbackJsonTablePrimitiveEditStore,
  useJsonTablePrimitiveEditSnapshot,
  type JsonTablePrimitiveEditStore,
} from "@/components/json-table/json-table-primitive-edit-store"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { useRefCallback } from "@/components/json-table/path-utils"

export function useCellController({
  document,
  docId,
  materializedFieldPath,
  value,
  isEditable,
  onDocumentDataChange,
  primitiveEditStore,
}: {
  document: TableDocument
  docId: string
  materializedFieldPath: string | undefined
  value: unknown
  isEditable: boolean | undefined
  onDocumentDataChange: (
    docId: string,
    materializedFieldPath: string,
    value: unknown
  ) => void
  primitiveEditStore?: JsonTablePrimitiveEditStore
}) {
  const editStore = primitiveEditStore ?? fallbackJsonTablePrimitiveEditStore
  const primitiveEdit = useJsonTablePrimitiveEditSnapshot({
    fieldPath: materializedFieldPath,
    store: editStore,
  })

  React.useEffect(() => {
    editStore.reconcileProjectedValue(materializedFieldPath, value)
  }, [editStore, materializedFieldPath, value])

  const safeStringify = React.useCallback((input: unknown) => {
    try {
      return JSON.stringify(input)
    } catch {
      return String(input)
    }
  }, [])

  const normalize = React.useCallback(
    (input: unknown) => (input == null || input === "" ? null : input),
    []
  )

  const effectiveValue = primitiveEdit.hasValue ? primitiveEdit.value : value
  const committedTextValue =
    effectiveValue !== null && effectiveValue !== undefined
      ? String(effectiveValue)
      : ""

  const commitValueChange = useRefCallback(function (validatedValue: unknown) {
    if (!materializedFieldPath || !isEditable) return

    const previousValue = primitiveEdit.hasValue
      ? primitiveEdit.value
      : getValueAtPath(document.data, materializedFieldPath)
    const previousNormalized = normalize(previousValue)
    const nextNormalized = normalize(validatedValue)

    const isNoOp =
      previousValue === validatedValue ||
      safeStringify(previousNormalized) === safeStringify(nextNormalized)
    if (isNoOp) return

    markJsonTableProfile("cell-commit-local-start", {
      fieldPath: materializedFieldPath,
    })
    editStore.commitValue(materializedFieldPath, validatedValue, previousValue)
    markJsonTableProfile("cell-commit-local-end", {
      fieldPath: materializedFieldPath,
    })

    React.startTransition(() => {
      markJsonTableProfile("cell-commit-transition-start", {
        fieldPath: materializedFieldPath,
      })
      onDocumentDataChange(docId, materializedFieldPath, validatedValue)
      markJsonTableProfile("cell-commit-transition-end", {
        fieldPath: materializedFieldPath,
      })
    })
  })

  return {
    effectiveValue,
    committedTextValue,
    commitValueChange,
  }
}
