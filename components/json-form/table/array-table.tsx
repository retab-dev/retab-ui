"use client"

import * as React from "react"

import { getFixedGridCanvasStyle } from "@/components/ui/fixed-grid-layout"
import { WithDescription } from "@/components/json-form/disclosure"
import { joinJsonFormPath } from "@/components/json-form/path-codec"
import { labelFor, type Column } from "@/components/json-form/schema-model"
import { useSourceLinkedTableCells } from "@/components/json-form/source-link"
import {
  FixedArrayTableBody,
  StaticArrayTableBody,
} from "@/components/json-form/table/array-table-body"
import {
  TABLE_SCROLL_THRESHOLD,
  TABLE_VIRTUALIZE_THRESHOLD,
} from "@/components/json-form/table/array-table-config"
import { ArrayTableRow } from "@/components/json-form/table/array-table-row"

export function ArrayTable({
  name,
  sourcePath,
  fields,
  remove,
  canRemove,
  columns,
}: {
  name: string
  sourcePath: string
  fields: { id: string }[]
  remove: (index: number) => void
  canRemove: boolean
  columns: Column[]
}) {
  const template = `${columns.map(() => "minmax(9rem, 1fr)").join(" ")} 2.25rem`
  const minWidth = columns.length * 150 + 36
  const [activeEditorPath, setActiveEditorPath] = React.useState<string | null>(
    null
  )
  const tableRef = React.useRef<HTMLDivElement>(null)
  const sourceTable = useSourceLinkedTableCells({
    tableRef,
    refreshKey: fields.length,
  })
  const sourceLinked = sourceTable.sourceLinked
  const virtualize = fields.length > TABLE_VIRTUALIZE_THRESHOLD
  const scrollHandlers = React.useMemo(
    () => ({
      onScrollStart: sourceTable.handleScrollStart,
      onScrollMove: sourceTable.handleScrollMove,
      onScrollEnd: sourceTable.handleScrollEnd,
    }),
    [sourceTable]
  )

  const handleTableClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const table = tableRef.current
      const activeElement = table?.ownerDocument.activeElement
      if (
        !(activeElement instanceof HTMLElement) ||
        activeElement.dataset.tableCellEditor !== "true" ||
        !table?.contains(activeElement) ||
        activeElement === event.target ||
        activeElement.contains(event.target as Node)
      ) {
        return
      }
      activeElement.blur()
    },
    []
  )

  const handleTableClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const cell = sourceTable.getCellFromTarget(event.target)
      if (!cell) return
      sourceTable.selectCellSource(cell)
      if (cell.dataset.tableCellEditable !== "true") return
      const path = cell.dataset.tableCellPath
      if (path) setActiveEditorPath(path)
    },
    [sourceTable]
  )

  const handleTableKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return
      const cell = sourceTable.getCellFromTarget(event.target)
      if (!cell || cell.dataset.tableCellEditable !== "true") return
      const path = cell.dataset.tableCellPath
      if (!path) return
      sourceTable.selectCellSource(cell)
      event.preventDefault()
      setActiveEditorPath(path)
    },
    [sourceTable]
  )

  const renderRow = React.useCallback(
    (index: number, rowTopPx?: number) => (
      <ArrayTableRow
        name={name}
        sourcePath={sourcePath}
        index={index}
        isLastRow={index === fields.length - 1}
        columns={columns}
        remove={remove}
        canRemove={canRemove}
        sourceLinked={sourceLinked}
        template={template}
        rowTopPx={rowTopPx}
        activeEditorPath={
          activeEditorPath?.startsWith(`${joinJsonFormPath(name, index)}.`)
            ? activeEditorPath
            : null
        }
        subscribeToRow={!virtualize}
        setActiveEditorPath={setActiveEditorPath}
      />
    ),
    [
      name,
      sourcePath,
      fields.length,
      columns,
      remove,
      canRemove,
      sourceLinked,
      template,
      activeEditorPath,
      virtualize,
    ]
  )

  return (
    <div
      ref={tableRef}
      onClickCapture={handleTableClickCapture}
      onClick={handleTableClick}
      onKeyDown={handleTableKeyDown}
      onPointerMove={sourceLinked ? sourceTable.handlePointerMove : undefined}
      onPointerLeave={sourceLinked ? sourceTable.handlePointerLeave : undefined}
      onFocus={sourceTable.handleFocus}
      onBlur={sourceTable.handleBlur}
      className="overflow-x-auto bg-background"
    >
      <div style={getFixedGridCanvasStyle({ minWidth })}>
        <div
          className="grid h-9 items-center gap-1 border-b bg-muted/35 px-2"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((column) => (
            <div
              key={column.key}
              className="flex min-w-0 items-center gap-1 px-2 text-xs font-medium text-muted-foreground"
            >
              <WithDescription text={column.schema.description}>
                <span className="truncate">
                  {labelFor(column.key, column.schema)}
                </span>
              </WithDescription>
              {column.required ? (
                <span className="text-destructive">*</span>
              ) : null}
            </div>
          ))}
          <span className="sr-only">Actions</span>
        </div>
        {virtualize ? (
          <FixedArrayTableBody
            name={name}
            fields={fields}
            activeEditorPath={activeEditorPath}
            scrollHandlers={scrollHandlers}
            renderItem={renderRow}
          />
        ) : fields.length > TABLE_SCROLL_THRESHOLD ? (
          <StaticArrayTableBody
            fields={fields}
            scrollHandlers={scrollHandlers}
            renderItem={renderRow}
          />
        ) : (
          <div>
            {fields.map((entry, index) => (
              <React.Fragment key={entry.id}>{renderRow(index)}</React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
