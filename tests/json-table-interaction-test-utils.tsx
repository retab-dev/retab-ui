import * as React from "react"
import { render } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { vi } from "vitest"

import type { JsonTableCellCommit } from "@/components/json-table/json-table-cell-commit"
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableActivationIntent,
  JsonTableActiveCell,
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import { createJsonTablePrimitiveActiveCellStore } from "@/components/json-table/json-table-primitive-active-cell-store"
import { createJsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"
import type { JsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"
import { setValueAtMaterializedPath } from "@/components/json-table/lib/document-patches"
import type {
  ProjectedCell,
  ProjectedRow,
} from "@/components/json-table/lib/document-projection"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileFormRow } from "@/components/json-table/single-file-form-row"

type TestCellCommit = (
  docId: string,
  materializedFieldPath: string,
  value: unknown
) => void

export const interactionSchema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
    amount: { type: "number" },
    count: { type: "integer" },
    is_paid: { type: "boolean" },
    shipped_at: { type: "string", format: "date" },
    shipped_time: { type: "string", format: "time" },
    reviewed_at: { type: "string", format: "date-time" },
    status: { enum: ["draft", "approved", "option:1"] },
    nullable_status: { enum: ["draft", "approved", null] },
    numeric_status: { type: "integer", enum: [1, 2] },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
        },
      },
    },
    metadata: {
      type: "object",
      properties: {
        source: { type: "string" },
      },
    },
  },
}

export const interactionDocument: TableDocument = {
  id: "doc_1",
  data: {
    vendor: "ACME",
    note: "memo",
    amount: 12.5,
    count: 3,
    is_paid: false,
    shipped_at: "2024-01-02",
    shipped_time: "09:30:00",
    reviewed_at: "2024-01-02T09:30:00Z",
    status: "draft",
    nullable_status: "approved",
    numeric_status: 1,
    lines: [
      { name: "one", quantity: 1 },
      { name: "two", quantity: 2 },
    ],
    metadata: { source: "upload" },
  },
}

export function interactionVisibleColumn(
  key: string,
  schema: JSONSchema7 = interactionSchema
): VisibleColumn {
  const fieldMetadata = getRequiredInteractionFieldMetadata(key, schema)

  return {
    key,
    widthPx: 180,
    fieldMetadata,
  }
}

export function getRequiredInteractionFieldMetadata(
  key: string,
  schema: JSONSchema7 = interactionSchema
): FieldMetadata {
  const fieldMetadata = getFieldMetadata(schema, key)
  if (!fieldMetadata) throw new Error(`Missing field metadata for ${key}`)
  return fieldMetadata
}

export function findEditableCell(
  container: HTMLElement,
  fieldPath: string
): HTMLElement {
  const cell = container.querySelector(
    `td[data-field-path="${fieldPath}"][data-json-table-editable-cell="true"]`
  )
  if (!(cell instanceof HTMLElement)) {
    throw new Error(`Expected editable cell for ${fieldPath}`)
  }
  return cell
}

export function findReadonlyCell(
  container: HTMLElement,
  fieldPath: string
): HTMLElement {
  const cell = container.querySelector(`td[data-field-path="${fieldPath}"]`)
  if (!(cell instanceof HTMLElement)) {
    throw new Error(`Expected cell for ${fieldPath}`)
  }
  return cell
}

export function projectedRowsFor({
  document = interactionDocument,
  visiblePaths,
}: {
  document?: TableDocument
  visiblePaths: string[]
}): ProjectedRow[] {
  return projectDocumentRows({
    document,
    visiblePaths,
    includeArrayAddRows: true,
  })
}

export function createTestCellCommitBridge({
  documentData,
  onUpdateDocument = vi.fn(async () => undefined),
  primitiveEditStore,
}: {
  documentData: Record<string, unknown>
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  primitiveEditStore: JsonTablePrimitiveEditStore
}) {
  let currentDocumentData = documentData

  function persistFieldValue(
    materializedFieldPath: string,
    value: unknown,
    usesPrimitiveEditStore: boolean
  ) {
    const nextData = setValueAtMaterializedPath(
      currentDocumentData,
      materializedFieldPath,
      value
    )
    currentDocumentData = nextData
    if (usesPrimitiveEditStore) primitiveEditStore.recordDocumentEcho(nextData)
    onUpdateDocument({ data: nextData })
  }

  return {
    onCellCommit: (commit: JsonTableCellCommit) => {
      persistFieldValue(
        commit.fieldPath,
        commit.value,
        commit.visibility === "primitivePendingValue"
      )
    },
  }
}

function SingleFileFormRowHarness({
  onCellCommit,
  onEditSessionChange,
  ...props
}: Omit<
  React.ComponentProps<typeof SingleFileFormRow>,
  | "primitiveActiveCellStore"
  | "primitiveEditStore"
  | "setPrimitiveActiveCell"
  | "structuredEditSession"
  | "startStructuredEditSession"
  | "setStructuredEditSessionOverlayOpen"
  | "closeStructuredEditSession"
  | "onCellCommit"
> & {
  onCellCommit?: TestCellCommit
  onEditSessionChange?: (activeCell: JsonTableActiveCell | null) => void
}) {
  const primitiveActiveCellStoreRef = React.useRef(
    createJsonTablePrimitiveActiveCellStore()
  )
  const primitiveEditStoreRef = React.useRef(
    createJsonTablePrimitiveEditStore()
  )
  const [structuredEditSession, setStructuredEditSessionState] =
    React.useState<JsonTableStructuredEditSession | null>(null)
  const sessionIdRef = React.useRef(0)

  const setPrimitiveActiveCell = React.useCallback(
    (activeCell: JsonTablePrimitiveActiveCell | null) => {
      primitiveActiveCellStoreRef.current.setSnapshot(activeCell)
      if (activeCell) setStructuredEditSessionState(null)
      onEditSessionChange?.(activeCell)
    },
    [onEditSessionChange]
  )

  const startStructuredEditSession = React.useCallback(
    (projectedCell: ProjectedCell, intent: JsonTableActivationIntent) => {
      const nextSessionId = sessionIdRef.current + 1
      sessionIdRef.current = nextSessionId
      const nextSession: JsonTableStructuredEditSession = {
        id: nextSessionId,
        cellId: jsonTableCellId(
          props.document.id,
          projectedCell.materializedFieldPath
        ),
        docId: props.document.id,
        fieldPath: projectedCell.materializedFieldPath,
        intent,
        isOverlayOpen: false,
      }
      primitiveActiveCellStoreRef.current.setSnapshot(null)
      setStructuredEditSessionState(nextSession)
      onEditSessionChange?.(nextSession)
    },
    [onEditSessionChange, props.document.id]
  )
  const setStructuredEditSessionOverlayOpen = React.useCallback(
    (open: boolean) => {
      setStructuredEditSessionState((currentSession) => {
        const nextSession =
          currentSession && currentSession.isOverlayOpen !== open
            ? { ...currentSession, isOverlayOpen: open }
            : currentSession
        if (nextSession !== currentSession) onEditSessionChange?.(nextSession)
        return nextSession
      })
    },
    [onEditSessionChange]
  )
  const closeStructuredEditSession = React.useCallback(() => {
    setStructuredEditSessionState(null)
    onEditSessionChange?.(primitiveActiveCellStoreRef.current.getSnapshot())
  }, [onEditSessionChange])
  const handleCellCommit = React.useCallback(
    (commit: JsonTableCellCommit) => {
      ;(onCellCommit ?? vi.fn())(
        props.document.id,
        commit.fieldPath,
        commit.value
      )
    },
    [onCellCommit, props.document.id]
  )

  return (
    <SingleFileFormRow
      {...props}
      primitiveActiveCellStore={primitiveActiveCellStoreRef.current}
      primitiveEditStore={primitiveEditStoreRef.current}
      setPrimitiveActiveCell={setPrimitiveActiveCell}
      structuredEditSession={structuredEditSession}
      startStructuredEditSession={startStructuredEditSession}
      setStructuredEditSessionOverlayOpen={setStructuredEditSessionOverlayOpen}
      closeStructuredEditSession={closeStructuredEditSession}
      onCellCommit={handleCellCommit}
    />
  )
}

export function renderInteractionRow({
  document = interactionDocument,
  schema = interactionSchema,
  visiblePaths,
  rowIndex = 0,
  isJsonEditable = true,
  onCellCommit = vi.fn(),
  onEditSessionChange,
}: {
  document?: TableDocument
  schema?: JSONSchema7
  visiblePaths: string[]
  rowIndex?: number
  isJsonEditable?: boolean
  onCellCommit?: TestCellCommit
  onEditSessionChange?: (activeCell: JsonTableActiveCell | null) => void
}) {
  const rows = projectedRowsFor({ document, visiblePaths })
  const projectedRow = rows[rowIndex]
  if (!projectedRow) throw new Error(`Missing projected row ${rowIndex}`)

  return render(
    <table>
      <tbody>
        <SingleFileFormRowHarness
          document={document}
          schema={schema}
          projectedRow={projectedRow}
          visibleColumns={visiblePaths.map((path) =>
            interactionVisibleColumn(path, schema)
          )}
          rowIdx={rowIndex}
          rowTopPx={0}
          rowHeightPx={32}
          onCellCommit={onCellCommit}
          onEditSessionChange={onEditSessionChange}
          isJsonEditable={isJsonEditable}
        />
      </tbody>
    </table>
  )
}
