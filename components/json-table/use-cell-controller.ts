import * as React from "react"

import { buildDocumentDataPatch } from "@/components/json-table/lib/document-patches"
import { getValueAtPath } from "@/components/json-table/lib/json-schema-utils"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { useRefCallback } from "@/components/json-table/path-utils"

export function useCellController({
  document,
  docId,
  fieldPath,
  value,
  isEditable,
  onDocumentDataChange,
}: {
  document: TableDocument
  docId: string
  fieldPath: string | undefined
  value: unknown
  isEditable: boolean | undefined
  onDocumentDataChange: (docId: string, value: unknown) => void
}) {
  const [optimisticValue, setOptimisticValue] = React.useState<unknown>()

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

  const effectiveValue = optimisticValue !== undefined ? optimisticValue : value
  const cleanStringValue =
    effectiveValue !== null && effectiveValue !== undefined
      ? String(effectiveValue)
      : ""

  const commitValueChange = useRefCallback(function (validatedValue: unknown) {
    if (!fieldPath || !isEditable) return

    const previousRoot = document.data
    const previousValue = getValueAtPath(previousRoot, fieldPath)
    const previousNormalized = normalize(previousValue)
    const nextNormalized = normalize(validatedValue)
    const uiNormalized = normalize(value)

    const isNoOp =
      previousValue === validatedValue ||
      safeStringify(previousNormalized) === safeStringify(nextNormalized) ||
      safeStringify(uiNormalized) === safeStringify(nextNormalized)
    if (isNoOp) return

    const patch = buildDocumentDataPatch(
      previousRoot,
      fieldPath,
      validatedValue
    )
    onDocumentDataChange(docId, patch.data)
    setOptimisticValue(validatedValue)
  })

  return {
    effectiveValue,
    cleanStringValue,
    commitValueChange,
  }
}
