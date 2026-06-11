"use client"

import React, { useMemo, useState } from "react"
import type { JSONSchema7 } from "json-schema"

import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import { flattenHeaderNodes } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { buildHeaderNodesFromSchema } from "@/components/json-table/lib/schema-inspection"
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table"
import { useSheetOptionsStore } from "@/components/json-table/table-options-store"
import type { ColumnWidth } from "@/components/json-table/table-options-store"

interface SingleFileTableViewProps {
  document: TableDocument
  schema: JSONSchema7
  setSchema?: (schema: JSONSchema7) => void // Optional setter to enable schema editing (descriptions)
  columnWidth?: ColumnWidth
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  editMode?: "descriptionOnly" | "editable" | "readOnly"
  allowEditing?: boolean // Controls whether cells can be edited
  onCellHoverStart?: (info: {
    docId: string
    fieldPath: string
    rect: DOMRect
  }) => void
  /** Rows to render beyond the viewport on each side (virtualization buffer). Default 30. */
  overscan?: number
}

export const SingleFileTableView = React.memo<SingleFileTableViewProps>(
  ({
    document,
    schema,
    setSchema,
    columnWidth: propColumnWidth,
    onUpdateDocument,
    editMode = "editable",
    allowEditing = true,
    onCellHoverStart,
    overscan,
  }) => {
    const { columnWidth: storeColumnWidth } = useSheetOptionsStore()
    const columnWidth = propColumnWidth ?? storeColumnWidth

    const [stopAt, setStopAt] = useState<string[]>([])

    // Create refs for drag and drop across header cells.
    const draggedItemKeyRef = React.useRef<string | null>(null)
    const draggedItemParentPathRef = React.useRef<string | null>(null)

    // Generate header nodes from schema
    const [headerNodes] = useMemo(() => {
      return buildHeaderNodesFromSchema(schema, stopAt)
    }, [schema, stopAt])

    // Calculate visible keys
    const visibleKeys = useMemo(() => {
      return flattenHeaderNodes(headerNodes).map((node) => node.key)
    }, [headerNodes])

    const projectedRows = useMemo(() => {
      if (!document) return []
      return projectDocumentRows({
        document,
        visiblePaths: visibleKeys,
        includeArrayAddRows: editMode !== "readOnly",
      })
    }, [document, visibleKeys, editMode])

    const rowCount = Math.max(projectedRows.length, 1)

    return (
      <div className="relative flex min-h-0 w-full flex-1 flex-col">
        <div className="absolute inset-0 flex origin-top-left flex-col">
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
            editMode={editMode}
            projectedRows={projectedRows}
            visibleKeys={visibleKeys}
            rowCount={rowCount}
            onUpdateDocument={onUpdateDocument}
            columnWidth={columnWidth}
            allowEditing={allowEditing}
            onCellHoverStart={onCellHoverStart}
            overscan={overscan}
          />
        </div>
      </div>
    )
  }
)
SingleFileTableView.displayName = "SingleFileTableView"
