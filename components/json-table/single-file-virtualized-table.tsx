"use client"

import React, { useRef } from "react"
import type { JSONSchema7 } from "json-schema"

import { parseDataCellNumberInput } from "@/components/ui/data-cell"
import { fixedGridColumnWidths } from "@/components/ui/fixed-grid-columns"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "@/components/ui/fixed-grid-layout"
import { FixedGridViewport } from "@/components/ui/fixed-grid-viewport"
import { useFixedRowVirtualization } from "@/components/ui/fixed-grid-virtualization"
import {
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { JsonTableHeaderCell } from "@/components/json-table/header-cell"
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes"
import type {
  JsonTableActivationIntent,
  JsonTableEditSession,
} from "@/components/json-table/json-table-edit-session"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import {
  markJsonTableProfile,
  recordJsonTableRender,
} from "@/components/json-table/json-table-profiler"
import { setValueAtMaterializedPath } from "@/components/json-table/lib/document-patches"
import { getValueAtPath } from "@/components/json-table/lib/document-paths"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import { buildHeaderGridRows } from "@/components/json-table/lib/header-nodes"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"

import { SingleFileFormRow } from "./single-file-form-row"
import {
  getColumnWidthPx,
  getRowHeightPx,
  useSheetOptionsStore,
  type ColumnWidth,
} from "./table-options-store"

interface SingleFileVirtualizedTableProps {
  headerNodes: JsonTableHeaderNode[]
  document: TableDocument
  schema: JSONSchema7
  setSchema: (schema: JSONSchema7) => void
  isPublished: boolean
  stopAt: string[]
  setStopAt: (stopAt: string[]) => void
  draggedItemKeyRef: React.RefObject<string | null>
  draggedItemParentPathRef: React.RefObject<string | null>
  jsonEditMode: JsonTableJsonEditMode
  schemaEditMode: JsonTableSchemaEditMode
  projectedRows: ProjectedRow[]
  visibleColumns: VisibleColumn[]
  rowCount: number
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  columnWidth?: ColumnWidth
  onCellHoverStart?: (info: {
    docId: string
    fieldPath: string
    rect: DOMRect
  }) => void
  onCellHoverEnd?: () => void
  /** Rows to render beyond the viewport on each side (virtualization buffer). Default 12. */
  overscan?: number
  /** Rows to render beyond the viewport after large scroll jumps. Defaults to overscan. */
  jumpOverscan?: number
}

const SingleFileTableHeader = React.memo(
  ({
    headerNodes,
    columnWidth,
    schema,
    setSchema,
    isPublished,
    stopAt,
    setStopAt,
    draggedItemKeyRef,
    draggedItemParentPathRef,
    schemaEditMode,
  }: {
    headerNodes: JsonTableHeaderNode[]
    columnWidth: ColumnWidth
    schema: JSONSchema7
    setSchema: (schema: JSONSchema7) => void
    isPublished: boolean
    stopAt: string[]
    setStopAt: (stopAt: string[]) => void
    draggedItemKeyRef: React.RefObject<string | null>
    draggedItemParentPathRef: React.RefObject<string | null>
    schemaEditMode: JsonTableSchemaEditMode
  }) => {
    // Header rows derived straight from the schema header tree: each group spans
    // its leaves; shallower leaves get continuation cells so the grid stays
    // aligned.
    const headerRows = React.useMemo(
      () => buildHeaderGridRows(headerNodes),
      [headerNodes]
    )

    return (
      <TableHeader className="sticky top-0 z-10 bg-muted/30">
        {headerRows.map((cells, rowIdx) => (
          <TableRow
            key={rowIdx}
            className="flex w-max min-w-full border-b bg-muted/30"
          >
            {cells.map((cell, cellIdx) => {
              const width = cell.leafCount * getColumnWidthPx(columnWidth)

              if (cell.isContinuation) {
                return (
                  <th
                    key={cellIdx}
                    className="shrink-0 border-r bg-muted/30 text-xs text-foreground last:border-r-0"
                    style={{ width: `${width}px`, minWidth: `${width}px` }}
                  />
                )
              }

              return (
                <TableHead
                  key={cellIdx}
                  className="m-0 h-9 shrink-0 border-r bg-muted/30 p-0 text-foreground last:border-r-0"
                  style={{
                    width: `${width}px`,
                    minWidth: `${width}px`,
                  }}
                  colSpan={cell.colSpan}
                >
                  <JsonTableHeaderCell
                    node={cell.node}
                    leafCount={cell.leafCount}
                    schema={schema}
                    setSchema={setSchema}
                    stopAt={stopAt}
                    setStopAt={setStopAt}
                    columnWidth={columnWidth}
                    isPublished={isPublished}
                    draggedItemKeyRef={draggedItemKeyRef}
                    draggedItemParentPathRef={draggedItemParentPathRef}
                    schemaEditMode={schemaEditMode}
                  />
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
    )
  }
)
SingleFileTableHeader.displayName = "SingleFileTableHeader"

function normalizeCommittedValue(value: unknown) {
  return value === "" || value === undefined ? null : value
}

function areCommittedValuesEqual(left: unknown, right: unknown) {
  const normalizedLeft = normalizeCommittedValue(left)
  const normalizedRight = normalizeCommittedValue(right)
  if (Object.is(normalizedLeft, normalizedRight)) return true
  try {
    return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight)
  } catch {
    return false
  }
}

const JSON_TABLE_NUMBER_KEY = /^[0-9.+-]$/

function initialDraftValueForSession({
  fieldMetadata,
  intent,
  value,
}: {
  fieldMetadata: FieldMetadata | undefined
  intent: JsonTableActivationIntent
  value: unknown
}) {
  if (intent.type !== "keyboard" || intent.key.length !== 1) return value
  if (fieldMetadata?.kind === "string") return intent.key
  if (
    (fieldMetadata?.kind === "number" || fieldMetadata?.kind === "integer") &&
    JSON_TABLE_NUMBER_KEY.test(intent.key)
  ) {
    return intent.key
  }
  return value
}

export const SingleFileVirtualizedTable =
  React.memo<SingleFileVirtualizedTableProps>(
    ({
      headerNodes,
      document,
      schema,
      setSchema,
      isPublished,
      stopAt,
      setStopAt,
      draggedItemKeyRef,
      draggedItemParentPathRef,
      jsonEditMode,
      schemaEditMode,
      projectedRows,
      visibleColumns,
      rowCount,
      onUpdateDocument,
      columnWidth: propColumnWidth,
      onCellHoverStart,
      onCellHoverEnd,
      overscan = 12,
      jumpOverscan = overscan,
    }) => {
      const { rowHeight, columnWidth: storeColumnWidth } =
        useSheetOptionsStore()
      const columnWidth = propColumnWidth ?? storeColumnWidth

      const [editSession, setEditSession] =
        React.useState<JsonTableEditSession | null>(null)
      const editSessionIdRef = useRef(0)
      const documentDataRef = useRef(document.data)
      const pendingDocumentDataRef = useRef<Record<string, unknown> | null>(
        null
      )

      React.useEffect(() => {
        documentDataRef.current = document.data
        if (pendingDocumentDataRef.current === document.data) {
          pendingDocumentDataRef.current = null
        }
      }, [document.data])

      const totalWidth = fixedGridColumnWidths(visibleColumns).reduce(
        (total, widthPx) => total + widthPx,
        0
      )

      const rowHeightPx = getRowHeightPx(rowHeight)
      const scrollRef = useRef<HTMLDivElement>(null)
      const headerScrollRef = useRef<HTMLDivElement>(null)
      const { virtualRows, totalRowSize } = useFixedRowVirtualization({
        rowCount,
        rowSize: rowHeightPx,
        rowOverscan: overscan,
        jumpRowOverscan: jumpOverscan,
        scrollRef,
      })
      const isJsonEditable = jsonEditMode === "editable"
      recordJsonTableRender("SingleFileVirtualizedTable", document.id, {
        columnCount: visibleColumns.length,
        editSessionFieldPath: editSession?.fieldPath ?? null,
        isJsonEditable,
        rowCount,
        virtualRows: virtualRows.length,
      })
      const updateEditSessionDraft = React.useCallback((value: unknown) => {
        setEditSession((currentSession) =>
          currentSession && !Object.is(currentSession.draftValue, value)
            ? { ...currentSession, draftValue: value }
            : currentSession
        )
      }, [])
      const setEditSessionOverlayOpen = React.useCallback((open: boolean) => {
        setEditSession((currentSession) =>
          currentSession && currentSession.isOverlayOpen !== open
            ? { ...currentSession, isOverlayOpen: open }
            : currentSession
        )
      }, [])
      const closeEditSession = React.useCallback(() => {
        setEditSession(null)
      }, [])
      const patchDocumentData = React.useCallback(
        (materializedFieldPath: string, value: unknown) => {
          if (!onUpdateDocument) return

          markJsonTableProfile("document-patch-start", {
            fieldPath: materializedFieldPath,
          })
          const baseData =
            pendingDocumentDataRef.current ?? documentDataRef.current
          const nextData = setValueAtMaterializedPath(
            baseData,
            materializedFieldPath,
            value
          )
          pendingDocumentDataRef.current = nextData
          onUpdateDocument({ data: nextData })
          markJsonTableProfile("document-patch-end", {
            fieldPath: materializedFieldPath,
          })
        },
        [onUpdateDocument]
      )
      const handleDocumentDataChange = React.useCallback(
        (_docId: string, materializedFieldPath: string, value: unknown) => {
          patchDocumentData(materializedFieldPath, value)
        },
        [patchDocumentData]
      )
      const commitEditSessionDraft = React.useCallback(
        (session: JsonTableEditSession) => {
          if (!onUpdateDocument) return

          const fieldMetadata = getFieldMetadata(schema, session.fieldPath)
          if (!fieldMetadata) return

          const rawDraftValue =
            session.draftValue === null || session.draftValue === undefined
              ? ""
              : String(session.draftValue)
          const parsedDraftValue =
            fieldMetadata.kind === "number" || fieldMetadata.kind === "integer"
              ? parseDataCellNumberInput({
                  kind: fieldMetadata.kind,
                  value: rawDraftValue,
                }).value
              : fieldMetadata.kind === "string"
                ? rawDraftValue === ""
                  ? null
                  : rawDraftValue
                : session.draftValue
          const nextValue = formatValueForCommit(
            parsedDraftValue,
            fieldMetadata.rawSchema,
            schema
          )
          const baseData =
            pendingDocumentDataRef.current ?? documentDataRef.current
          const previousValue = getValueAtPath(baseData, session.fieldPath)

          if (areCommittedValuesEqual(previousValue, nextValue)) return
          patchDocumentData(session.fieldPath, nextValue)
        },
        [onUpdateDocument, patchDocumentData, schema]
      )
      const startEditSession = React.useCallback(
        (
          projectedCell: ProjectedRow["cells"][number],
          intent: JsonTableActivationIntent
        ) => {
          if (!projectedCell?.materializedFieldPath) return
          const nextCellId = jsonTableCellId(
            document.id,
            projectedCell.materializedFieldPath
          )
          if (editSession && editSession.cellId !== nextCellId) {
            commitEditSessionDraft(editSession)
          }
          const baseData =
            pendingDocumentDataRef.current ?? documentDataRef.current
          const sessionValue = getValueAtPath(
            baseData,
            projectedCell.materializedFieldPath
          )
          const fieldMetadata = getFieldMetadata(
            schema,
            projectedCell.materializedFieldPath
          )

          const nextSessionId = editSessionIdRef.current + 1
          editSessionIdRef.current = nextSessionId
          setEditSession({
            id: nextSessionId,
            cellId: nextCellId,
            docId: document.id,
            fieldPath: projectedCell.materializedFieldPath,
            intent,
            initialValue: sessionValue,
            draftValue: initialDraftValueForSession({
              fieldMetadata,
              intent,
              value: sessionValue,
            }),
            status: "editing",
            isOverlayOpen: false,
          })
        },
        [commitEditSessionDraft, document.id, editSession, schema]
      )

      const handleBodyScroll = React.useCallback(
        (event: React.UIEvent<HTMLDivElement>) => {
          if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
          }
        },
        []
      )

      return (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {/* Header: a fixed, opaque bar outside the vertical scroll. It
                scrolls horizontally in sync with the body so fields stay
                aligned, while rows scroll underneath it. A sticky header
                inside the transformed/virtualized body shows rows through it
                (transforms break sticky) — the CSV viewer uses the same
                separated-header approach. */}
          <div
            ref={headerScrollRef}
            className="w-full shrink-0 overflow-x-hidden bg-muted/30"
          >
            <table
              data-slot="table"
              className="relative flex w-full flex-col rounded-none bg-muted/30"
              style={getFixedGridCanvasStyle({ minWidth: totalWidth })}
            >
              <SingleFileTableHeader
                columnWidth={columnWidth}
                headerNodes={headerNodes}
                schema={schema}
                setSchema={setSchema}
                isPublished={isPublished}
                stopAt={stopAt}
                setStopAt={setStopAt}
                draggedItemKeyRef={draggedItemKeyRef}
                draggedItemParentPathRef={draggedItemParentPathRef}
                schemaEditMode={schemaEditMode}
              />
            </table>
          </div>
          <FixedGridViewport
            scrollRef={scrollRef}
            dataSlot="json-table-scroll"
            className="w-full flex-1 overflow-auto"
            onScroll={handleBodyScroll}
          >
            <table
              data-slot="table"
              className="relative flex w-full flex-col rounded-none bg-background"
              style={getFixedGridCanvasStyle({ minWidth: totalWidth })}
            >
              <TableBody
                className="relative w-full bg-background"
                style={getFixedGridRowWindowStyle({
                  height: totalRowSize,
                  minWidth: "100%",
                })}
              >
                {virtualRows.map((virtualRow, slotIndex) => {
                  // Editable mode keeps row identity so focused editor state
                  // cannot move to another document row. Read-only mode reuses
                  // visible row shells to avoid replacement spikes while
                  // scrolling through large tables.
                  const rowIdx = virtualRow.index
                  const rowKey = isJsonEditable
                    ? `row-${rowIdx}`
                    : `slot-${slotIndex}`
                  return (
                    <SingleFileFormRow
                      key={rowKey}
                      rowIdx={rowIdx}
                      rowTopPx={virtualRow.start}
                      document={document}
                      projectedRow={projectedRows[rowIdx]}
                      schema={schema}
                      visibleColumns={visibleColumns}
                      rowHeightPx={rowHeightPx}
                      editSession={editSession}
                      startEditSession={startEditSession}
                      updateEditSessionDraft={updateEditSessionDraft}
                      setEditSessionOverlayOpen={setEditSessionOverlayOpen}
                      closeEditSession={closeEditSession}
                      onCellHoverStart={onCellHoverStart}
                      onCellHoverEnd={onCellHoverEnd}
                      onDocumentDataChange={handleDocumentDataChange}
                      isJsonEditable={isJsonEditable}
                    />
                  )
                })}
              </TableBody>
            </table>
          </FixedGridViewport>
        </div>
      )
    }
  )
SingleFileVirtualizedTable.displayName = "SingleFileVirtualizedTable"
