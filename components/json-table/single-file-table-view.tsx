"use client"

import React, { useMemo, useState } from "react"
import type { JSONSchema7 } from "json-schema"

import { buildFixedGridColumns } from "@/components/ui/fixed-grid-columns"
import { getJsonTableCellDisplayValue } from "@/components/json-table/json-table-display-cell"
import type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes"
import {
  markJsonTableProfile,
  recordJsonTableReactCommit,
  recordJsonTableRender,
} from "@/components/json-table/json-table-profiler"
import {
  projectDocumentRows,
  type ProjectedCell,
  type ProjectedRow,
} from "@/components/json-table/lib/document-projection"
import { flattenHeaderNodes } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { buildHeaderNodesFromSchema } from "@/components/json-table/lib/schema-header-nodes"
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table"
import {
  getColumnWidthPx,
  useSheetOptionsStore,
} from "@/components/json-table/table-options-store"
import type { ColumnWidth } from "@/components/json-table/table-options-store"

export type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes"

interface SingleFileTableViewProps {
  document: TableDocument
  schema: JSONSchema7
  setSchema?: (schema: JSONSchema7) => void // Optional setter to enable schema editing (descriptions)
  columnWidth?: ColumnWidth
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  jsonEditMode: JsonTableJsonEditMode
  schemaEditMode: JsonTableSchemaEditMode
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

function shareProjectedRows(
  previousRows: ProjectedRow[],
  nextRows: ProjectedRow[]
): ProjectedRow[] {
  let didReuseAny = false
  const sharedRows = nextRows.map((nextRow, index) => {
    const previousRow = previousRows[index]
    if (!previousRow) return nextRow

    let rowChanged =
      previousRow.rowIndex !== nextRow.rowIndex ||
      previousRow.cells.length !== nextRow.cells.length

    const nextCells = nextRow.cells.map((nextCell, cellIndex) => {
      const previousCell = previousRow.cells[cellIndex]
      if (canReuseProjectedCell(previousCell, nextCell)) {
        didReuseAny = true
        return previousCell
      }
      rowChanged = true
      return nextCell
    })

    if (!rowChanged) {
      didReuseAny = true
      return previousRow
    }

    return { ...nextRow, cells: nextCells }
  })

  return didReuseAny ? sharedRows : nextRows
}

function canReuseProjectedCell(
  previousCell: ProjectedCell | undefined,
  nextCell: ProjectedCell | undefined
) {
  if (previousCell === nextCell) return true
  if (!previousCell || !nextCell) return false

  const previousDisplayValue =
    "displayValue" in previousCell ? previousCell.displayValue : undefined
  const nextDisplayValue =
    "displayValue" in nextCell ? nextCell.displayValue : undefined

  return (
    previousCell.key === nextCell.key &&
    Object.is(previousCell.value, nextCell.value) &&
    Object.is(previousDisplayValue, nextDisplayValue) &&
    previousCell.templateFieldPath === nextCell.templateFieldPath &&
    previousCell.materializedFieldPath === nextCell.materializedFieldPath &&
    previousCell.addArrayItemAtIndex === nextCell.addArrayItemAtIndex &&
    sameArrayIndexes(previousCell.arrayIndexes, nextCell.arrayIndexes)
  )
}

function sameArrayIndexes(previous: number[], next: number[]) {
  if (previous.length !== next.length) return false
  return previous.every((value, index) => value === next[index])
}

export const SingleFileTableView = React.memo<SingleFileTableViewProps>(
  ({
    document,
    schema,
    setSchema,
    columnWidth: propColumnWidth,
    onUpdateDocument,
    jsonEditMode,
    schemaEditMode,
    onCellHoverStart,
    onCellHoverEnd,
    overscan,
    jumpOverscan,
  }) => {
    recordJsonTableRender("SingleFileTableView", document.id, {
      columnWidth: propColumnWidth ?? null,
      jsonEditMode,
      schemaEditMode,
      hasUpdate: Boolean(onUpdateDocument),
      jumpOverscan: jumpOverscan ?? null,
      overscan: overscan ?? null,
    })

    const { columnWidth: storeColumnWidth } = useSheetOptionsStore()
    const columnWidth = propColumnWidth ?? storeColumnWidth

    const [stopAt, setStopAt] = useState<string[]>([])
    const isJsonEditable = jsonEditMode === "editable"
    const projectedRowsCacheRef = React.useRef<ProjectedRow[]>([])

    // Create refs for drag and drop across header cells.
    const draggedItemKeyRef = React.useRef<string | null>(null)
    const draggedItemParentPathRef = React.useRef<string | null>(null)

    // Generate header nodes from schema
    const [headerNodes] = useMemo(() => {
      return buildHeaderNodesFromSchema(schema, stopAt)
    }, [schema, stopAt])

    const visibleKeys = useMemo(() => {
      return flattenHeaderNodes(headerNodes).map((node) => node.key)
    }, [headerNodes])

    const visibleFieldMetadata = useMemo(() => {
      return visibleKeys.map((key) => getFieldMetadata(schema, key))
    }, [schema, visibleKeys])

    const visibleColumns = useMemo(() => {
      const widthPx = getColumnWidthPx(columnWidth)
      return buildFixedGridColumns({
        items: visibleKeys,
        getKey: (key) => key,
        getWidthPx: (key) => (key.endsWith("__delete") ? 50 : widthPx),
        getMetadata: (_key, index) => visibleFieldMetadata[index],
      }).map((column) => ({
        ...column,
        fieldMetadata: column.metadata,
      }))
    }, [columnWidth, visibleFieldMetadata, visibleKeys])

    const projectedRows = useMemo(() => {
      if (!document) return []
      markJsonTableProfile("project-rows-start", {
        visiblePaths: visibleKeys.length,
        isJsonEditable,
      })
      const rows = projectDocumentRows({
        document,
        visiblePaths: visibleKeys,
        includeArrayAddRows: isJsonEditable,
      })
      if (!isJsonEditable) {
        for (const row of rows) {
          for (
            let columnIndex = 0;
            columnIndex < row.cells.length;
            columnIndex++
          ) {
            const cell = row.cells[columnIndex]
            if (!cell) continue

            const fieldMetadata = visibleFieldMetadata[columnIndex]
            if (!fieldMetadata) continue

            cell.displayValue = getJsonTableCellDisplayValue({
              fieldMetadata,
              value: cell.value,
            })
          }
        }
      }
      const sharedRows = shareProjectedRows(projectedRowsCacheRef.current, rows)
      projectedRowsCacheRef.current = sharedRows
      markJsonTableProfile("project-rows-end", {
        rowCount: sharedRows.length,
      })
      return sharedRows
    }, [document, visibleFieldMetadata, visibleKeys, isJsonEditable])

    const rowCount = Math.max(projectedRows.length, 1)

    return (
      <div className="relative flex min-h-0 w-full flex-1 flex-col">
        <div className="absolute inset-0 flex origin-top-left flex-col">
          <React.Profiler id="JsonTable" onRender={recordJsonTableReactCommit}>
            <SingleFileVirtualizedTable
              headerNodes={headerNodes}
              document={document}
              schema={schema}
              setSchema={setSchema ?? (() => {})}
              isPublished={!setSchema}
              stopAt={stopAt}
              setStopAt={setStopAt}
              draggedItemKeyRef={draggedItemKeyRef}
              draggedItemParentPathRef={draggedItemParentPathRef}
              jsonEditMode={jsonEditMode}
              schemaEditMode={schemaEditMode}
              projectedRows={projectedRows}
              visibleColumns={visibleColumns}
              rowCount={rowCount}
              onUpdateDocument={onUpdateDocument}
              columnWidth={columnWidth}
              onCellHoverStart={onCellHoverStart}
              onCellHoverEnd={onCellHoverEnd}
              overscan={overscan}
              jumpOverscan={jumpOverscan}
            />
          </React.Profiler>
        </div>
      </div>
    )
  }
)
SingleFileTableView.displayName = "SingleFileTableView"
