import * as React from "react"

import { getValueAtPath } from "@/components/json-table/lib/document-paths"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  fallbackJsonTablePrimitivePatchStore,
  useJsonTablePrimitivePatchSnapshot,
  type JsonTablePrimitivePatchStore,
} from "@/components/json-table/json-table-primitive-patch-store"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { useRefCallback } from "@/components/json-table/path-utils"

export function useCellController({
  document,
  docId,
  materializedFieldPath,
  value,
  isEditable,
  onDocumentDataChange,
  primitivePatchStore,
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
  primitivePatchStore?: JsonTablePrimitivePatchStore
}) {
  const patchStore = primitivePatchStore ?? fallbackJsonTablePrimitivePatchStore
  const primitivePatch = useJsonTablePrimitivePatchSnapshot({
    fieldPath: materializedFieldPath,
    store: patchStore,
  })

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

  const effectiveValue = primitivePatch.hasValue ? primitivePatch.value : value
  const committedTextValue =
    effectiveValue !== null && effectiveValue !== undefined
      ? String(effectiveValue)
      : ""

  const commitValueChange = useRefCallback(function (validatedValue: unknown) {
    if (!materializedFieldPath || !isEditable) return

    const previousValue = primitivePatch.hasValue
      ? primitivePatch.value
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
    patchStore.setValue(materializedFieldPath, validatedValue, previousValue)
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
