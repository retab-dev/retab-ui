import * as React from "react"

import {
  isJsonTableNoOpCommit,
  jsonTableCommittedTextValue,
  type JsonTableCellCommitHandler,
} from "@/components/json-table/json-table-cell-commit"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { useRefCallback } from "@/components/json-table/path-utils"

type StructuredPendingValue = {
  fieldPath: string
  value: unknown
}

export function useJsonTableStructuredCellController({
  materializedFieldPath,
  value,
  isEditable,
  onCellCommit,
}: {
  materializedFieldPath: string | undefined
  value: unknown
  isEditable: boolean | undefined
  onCellCommit: JsonTableCellCommitHandler
}) {
  const [structuredPendingValue, setStructuredPendingValue] =
    React.useState<StructuredPendingValue | null>(null)
  const activeStructuredPendingValue =
    structuredPendingValue?.fieldPath === materializedFieldPath
      ? structuredPendingValue
      : null
  const effectiveValue = activeStructuredPendingValue
    ? activeStructuredPendingValue.value
    : value
  const committedTextValue = jsonTableCommittedTextValue(effectiveValue)

  React.useEffect(() => {
    if (
      !activeStructuredPendingValue ||
      !Object.is(activeStructuredPendingValue.value, value)
    ) {
      return
    }
    setStructuredPendingValue(null)
  }, [activeStructuredPendingValue, value])

  const commitStructuredValueChange = useRefCallback(function (
    validatedValue: unknown
  ) {
    if (!materializedFieldPath || !isEditable) return
    if (isJsonTableNoOpCommit(effectiveValue, validatedValue)) return

    markJsonTableProfile("cell-commit-local-start", {
      fieldPath: materializedFieldPath,
    })
    setStructuredPendingValue({
      fieldPath: materializedFieldPath,
      value: validatedValue,
    })
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
        previousValue: effectiveValue,
        visibleThrough: "projectedDocumentValue",
      })
      markJsonTableProfile("cell-commit-transition-end", {
        fieldPath: materializedFieldPath,
      })
    })
  })

  return {
    effectiveValue,
    committedTextValue,
    commitStructuredValueChange,
  }
}
