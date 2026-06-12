import * as React from "react"

import { getValueAtPath } from "@/components/json-table/lib/document-paths"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { useRefCallback } from "@/components/json-table/path-utils"

export function useCellController({
  document,
  docId,
  materializedFieldPath,
  value,
  isEditable,
  onDocumentDataChange,
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

  React.useEffect(() => {
    setOptimisticValue(undefined)
  }, [docId, materializedFieldPath, value])

  const effectiveValue = optimisticValue !== undefined ? optimisticValue : value
  const committedTextValue =
    effectiveValue !== null && effectiveValue !== undefined
      ? String(effectiveValue)
      : ""

  const commitValueChange = useRefCallback(function (validatedValue: unknown) {
    if (!materializedFieldPath || !isEditable) return

    const previousValue =
      optimisticValue !== undefined
        ? optimisticValue
        : getValueAtPath(document.data, materializedFieldPath)
    const previousNormalized = normalize(previousValue)
    const nextNormalized = normalize(validatedValue)

    const isNoOp =
      previousValue === validatedValue ||
      safeStringify(previousNormalized) === safeStringify(nextNormalized)
    if (isNoOp) return

    setOptimisticValue(validatedValue)

    React.startTransition(() => {
      onDocumentDataChange(docId, materializedFieldPath, validatedValue)
    })
  })

  return {
    effectiveValue,
    committedTextValue,
    commitValueChange,
  }
}
