import * as React from "react"

import {
  isJsonTableNoOpCommit,
  type JsonTableCellCommitHandler,
} from "@/components/json-table/json-table-cell-commit"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { useRefCallback } from "@/components/json-table/path-utils"

type StructuredPendingValue = {
  fieldPath: string
  projectedValueAtCommit: unknown
  value: unknown
}

function areStructuredValuesEqual(previousValue: unknown, nextValue: unknown) {
  return isJsonTableNoOpCommit(previousValue, nextValue)
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

  React.useEffect(() => {
    if (!structuredPendingValue) return
    if (structuredPendingValue.fieldPath !== materializedFieldPath) {
      setStructuredPendingValue(null)
      return
    }
    if (areStructuredValuesEqual(structuredPendingValue.value, value)) {
      setStructuredPendingValue(null)
      return
    }
    if (
      !areStructuredValuesEqual(
        structuredPendingValue.projectedValueAtCommit,
        value
      )
    ) {
      setStructuredPendingValue(null)
    }
  }, [materializedFieldPath, structuredPendingValue, value])

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
      projectedValueAtCommit: value,
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
    commitStructuredValueChange,
  }
}
