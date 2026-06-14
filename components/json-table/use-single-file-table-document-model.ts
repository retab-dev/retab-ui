import * as React from "react"

import type {
  JsonTableCellCommit,
  JsonTableCellCommitHandler,
} from "@/components/json-table/json-table-cell-commit"
import {
  createJsonTablePrimitiveEditStore,
  type JsonTablePrimitiveEditStore,
} from "@/components/json-table/json-table-primitive-edit-store"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { setValueAtMaterializedPath } from "@/components/json-table/lib/document-patches"
import type { TableDocument } from "@/components/json-table/lib/projects-types"

export type SingleFileTableDocumentModel = {
  projectionDocument: TableDocument
  canCommitDocument: boolean
  onCellCommit: JsonTableCellCommitHandler
  primitiveEditStore: JsonTablePrimitiveEditStore
}

function ignoreCellCommit() {}

function projectionDocumentForRender({
  projectionDocument,
  sourceDocument,
  previousSourceDocumentId,
}: {
  projectionDocument: TableDocument
  sourceDocument: TableDocument
  previousSourceDocumentId: string
}) {
  return previousSourceDocumentId !== sourceDocument.id
    ? sourceDocument
    : projectionDocument
}

export function useSingleFileTableDocumentModel({
  onUpdateDocument,
  sourceDocument,
}: {
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  sourceDocument: TableDocument
}): SingleFileTableDocumentModel {
  const primitiveEditStoreRef = React.useRef(
    createJsonTablePrimitiveEditStore()
  )
  const [projectionDocument, setProjectionDocument] =
    React.useState(sourceDocument)
  const previousSourceDocumentIdRef = React.useRef(sourceDocument.id)
  const reconciledSourceDocumentRef = React.useRef(sourceDocument)
  const confirmedDocumentDataRef = React.useRef(sourceDocument.data)
  const updateDocumentRef = React.useRef(onUpdateDocument)

  React.useLayoutEffect(() => {
    updateDocumentRef.current = onUpdateDocument
  }, [onUpdateDocument])

  const resetForSourceDocument = React.useCallback(
    (nextSourceDocument: TableDocument) => {
      previousSourceDocumentIdRef.current = nextSourceDocument.id
      reconciledSourceDocumentRef.current = nextSourceDocument
      confirmedDocumentDataRef.current = nextSourceDocument.data
      primitiveEditStoreRef.current.reset()
      setProjectionDocument(nextSourceDocument)
    },
    []
  )

  const reconcileSourceDocument = React.useCallback(
    (nextSourceDocument: TableDocument) => {
      if (reconciledSourceDocumentRef.current === nextSourceDocument) return
      reconciledSourceDocumentRef.current = nextSourceDocument
      confirmedDocumentDataRef.current = nextSourceDocument.data

      const reconciliation =
        primitiveEditStoreRef.current.reconcileDocumentData(
          nextSourceDocument.data
        )
      if (!reconciliation.isPrimitiveDocumentEcho) {
        setProjectionDocument(nextSourceDocument)
      }
    },
    []
  )

  const commitCellValue = React.useCallback(
    ({ fieldPath, value, visibility }: JsonTableCellCommit) => {
      const updateDocument = updateDocumentRef.current
      if (!updateDocument) return

      markJsonTableProfile("document-patch-start", { fieldPath })
      const nextData = setValueAtMaterializedPath(
        confirmedDocumentDataRef.current,
        fieldPath,
        value
      )
      confirmedDocumentDataRef.current = nextData
      if (visibility === "primitivePendingValue") {
        primitiveEditStoreRef.current.recordDocumentEcho(nextData)
      }
      updateDocument({ data: nextData })
      markJsonTableProfile("document-patch-end", { fieldPath })
    },
    []
  )

  React.useLayoutEffect(() => {
    if (previousSourceDocumentIdRef.current !== sourceDocument.id) {
      resetForSourceDocument(sourceDocument)
      return
    }

    reconcileSourceDocument(sourceDocument)
  }, [reconcileSourceDocument, resetForSourceDocument, sourceDocument])

  const currentProjectionDocument = projectionDocumentForRender({
    projectionDocument,
    sourceDocument,
    previousSourceDocumentId: previousSourceDocumentIdRef.current,
  })
  const canCommitDocument = Boolean(onUpdateDocument)
  const onCellCommit = commitCellValue

  return React.useMemo(
    () => ({
      projectionDocument: currentProjectionDocument,
      canCommitDocument,
      onCellCommit: canCommitDocument ? onCellCommit : ignoreCellCommit,
      primitiveEditStore: primitiveEditStoreRef.current,
    }),
    [canCommitDocument, currentProjectionDocument, onCellCommit]
  )
}
