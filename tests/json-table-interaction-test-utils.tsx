import * as React from "react"
import { render } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { vi } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableActiveCell,
  JsonTableActivationIntent,
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import { createJsonTablePrimitiveActiveCellStore } from "@/components/json-table/json-table-primitive-active-cell-store"
import { createJsonTablePrimitivePatchStore } from "@/components/json-table/json-table-primitive-patch-store"
import type {
  ProjectedCell,
  ProjectedRow,
} from "@/components/json-table/lib/document-projection"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileFormRow } from "@/components/json-table/single-file-form-row"

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

function SingleFileFormRowHarness({
  onDocumentDataChange,
  onEditSessionChange,
  ...props
}: Omit<
  React.ComponentProps<typeof SingleFileFormRow>,
  | "primitiveActiveCellStore"
  | "primitivePatchStore"
  | "setPrimitiveActiveCell"
  | "structuredEditSession"
  | "startStructuredEditSession"
  | "setStructuredEditSessionOverlayOpen"
  | "closeStructuredEditSession"
  | "onDocumentDataChange"
> & {
  onDocumentDataChange?: React.ComponentProps<
    typeof SingleFileFormRow
  >["onDocumentDataChange"]
  onEditSessionChange?: (activeCell: JsonTableActiveCell | null) => void
}) {
  const primitiveActiveCellStoreRef = React.useRef(
    createJsonTablePrimitiveActiveCellStore()
  )
  const primitivePatchStoreRef = React.useRef(createJsonTablePrimitivePatchStore())
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

  return (
    <SingleFileFormRow
      {...props}
      primitiveActiveCellStore={primitiveActiveCellStoreRef.current}
      primitivePatchStore={primitivePatchStoreRef.current}
      setPrimitiveActiveCell={setPrimitiveActiveCell}
      structuredEditSession={structuredEditSession}
      startStructuredEditSession={startStructuredEditSession}
      setStructuredEditSessionOverlayOpen={setStructuredEditSessionOverlayOpen}
      closeStructuredEditSession={closeStructuredEditSession}
      onDocumentDataChange={onDocumentDataChange ?? vi.fn()}
    />
  )
}

export function renderInteractionRow({
  document = interactionDocument,
  schema = interactionSchema,
  visiblePaths,
  rowIndex = 0,
  isJsonEditable = true,
  onDocumentDataChange = vi.fn(),
  onEditSessionChange,
}: {
  document?: TableDocument
  schema?: JSONSchema7
  visiblePaths: string[]
  rowIndex?: number
  isJsonEditable?: boolean
  onDocumentDataChange?: React.ComponentProps<
    typeof SingleFileFormRow
  >["onDocumentDataChange"]
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
          onDocumentDataChange={onDocumentDataChange}
          onEditSessionChange={onEditSessionChange}
          isJsonEditable={isJsonEditable}
        />
      </tbody>
    </table>
  )
}
