import * as React from "react"

import {
  isJsonTableNoOpCommit,
  jsonTableCommittedTextValue,
  type JsonTableCellCommitHandler,
} from "@/components/json-table/json-table-cell-commit"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { useRefCallback } from "@/components/json-table/path-utils"

type StructuredLocalCommit = {
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
  const [localCommit, setLocalCommit] =
    React.useState<StructuredLocalCommit | null>(null)
  const activeLocalCommit =
    localCommit?.fieldPath === materializedFieldPath ? localCommit : null
  const effectiveValue = activeLocalCommit ? activeLocalCommit.value : value
  const committedTextValue = jsonTableCommittedTextValue(effectiveValue)

  React.useEffect(() => {
    if (!activeLocalCommit || !Object.is(activeLocalCommit.value, value)) {
      return
    }
    setLocalCommit(null)
  }, [activeLocalCommit, value])

  const commitStructuredValueChange = useRefCallback(function (
    validatedValue: unknown
  ) {
    if (!materializedFieldPath || !isEditable) return
    if (isJsonTableNoOpCommit(effectiveValue, validatedValue)) return

    markJsonTableProfile("cell-commit-local-start", {
      fieldPath: materializedFieldPath,
    })
    setLocalCommit({ fieldPath: materializedFieldPath, value: validatedValue })
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
        visibility: "projectedDocumentValue",
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
