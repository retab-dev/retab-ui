"use client"

import * as React from "react"
import { X } from "lucide-react"
import { useController, useFormContext, useWatch } from "react-hook-form"

import { cn } from "@/lib/utils"
import {
  DataCell,
  type DataCellKind,
  type DataCellValueMeta,
} from "@/components/ui/data-cell"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "@/components/ui/fixed-grid-layout"
import { getFixedGridRowStyle } from "@/components/ui/fixed-grid-row-style"
import { useFixedRowVirtualization } from "@/components/ui/fixed-grid-virtualization"
import { WithDescription } from "@/components/json-form/disclosure"
import {
  encodeJsonFormKey,
  joinJsonFormPath,
  joinJsonSourcePath,
} from "@/components/json-form/path-codec"
import {
  dataCellNumberValue,
  dataCellTextValue,
  datetimeLocalInputValue,
  enumLabel,
  enumValueEquals,
  ScalarControl,
} from "@/components/json-form/scalar-control"
import { labelFor, type Column } from "@/components/json-form/schema-model"
import { useSourceLinkedTableCells } from "@/components/json-form/source-link"

const TABLE_MAX_HEIGHT = 420
const TABLE_ROW_HEIGHT = 44
const TABLE_SCROLL_THRESHOLD = Math.floor(TABLE_MAX_HEIGHT / TABLE_ROW_HEIGHT)
const TABLE_VIRTUALIZE_THRESHOLD = 500
const TABLE_ROW_OVERSCAN = 3
const TABLE_JUMP_ROW_OVERSCAN = 6

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
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex min-w-0 items-center gap-1 px-2 text-xs font-medium text-muted-foreground"
            >
              <WithDescription text={col.schema.description}>
                <span className="truncate">
                  {labelFor(col.key, col.schema)}
                </span>
              </WithDescription>
              {col.required ? (
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
            onScrollStart={sourceTable.handleScrollStart}
            onScrollMove={sourceTable.handleScrollMove}
            onScrollEnd={sourceTable.handleScrollEnd}
            renderItem={renderRow}
          />
        ) : fields.length > TABLE_SCROLL_THRESHOLD ? (
          <StaticArrayTableBody
            fields={fields}
            onScrollStart={sourceTable.handleScrollStart}
            onScrollMove={sourceTable.handleScrollMove}
            onScrollEnd={sourceTable.handleScrollEnd}
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

const ArrayTableRow = React.memo(function ArrayTableRow({
  name,
  sourcePath,
  index,
  isLastRow,
  columns,
  remove,
  canRemove,
  sourceLinked,
  template,
  rowTopPx,
  activeEditorPath,
  subscribeToRow,
  setActiveEditorPath,
}: {
  name: string
  sourcePath: string
  index: number
  isLastRow: boolean
  columns: Column[]
  remove: (index: number) => void
  canRemove: boolean
  sourceLinked: boolean
  template: string
  rowTopPx?: number
  activeEditorPath: string | null
  subscribeToRow: boolean
  setActiveEditorPath: (path: string | null) => void
}) {
  const { control, getValues, setValue } = useFormContext()
  const rowPath = joinJsonFormPath(name, index)
  const rowSourcePath = joinJsonSourcePath(sourcePath, index)
  const watchedRowValue = useWatch({
    control,
    name: rowPath,
    disabled: !subscribeToRow,
  }) as Record<string, unknown> | undefined
  const rowValue = (subscribeToRow ? watchedRowValue : getValues(rowPath)) as
    | Record<string, unknown>
    | undefined
  const rowStyle = React.useMemo(
    () =>
      rowTopPx === undefined
        ? { gridTemplateColumns: template }
        : getFixedGridRowStyle({
            gridTemplate: template,
            rowHeight: TABLE_ROW_HEIGHT,
            top: rowTopPx,
          }),
    [rowTopPx, template]
  )

  return (
    <div
      data-index={index}
      className={cn(
        "grid items-center gap-1 border-b px-2 py-1 [contain:layout_paint_style] hover:bg-muted/25",
        isLastRow && "border-b-0"
      )}
      style={rowStyle}
    >
      {columns.map((col) => {
        const path = joinJsonFormPath(rowPath, col.key)
        const logicalPath = joinJsonSourcePath(rowSourcePath, col.key)
        const value = rowValue?.[encodeJsonFormKey(col.key)]
        const isEnum = col.kind === "enum"
        const isActiveEditor = activeEditorPath === path
        const isEditing = isEnum && isActiveEditor
        const isScalarEditing = !isEnum && isActiveEditor
        const dataCellKind = dataCellKindForColumn(col)
        const displayLabel = labelFor(col.key, col.schema)
        const displayText = formatTableCellValue({ value, column: col })
        const textValue = value == null ? "" : String(value)
        const initialDisplay =
          col.schema.format === "date-time"
            ? datetimeLocalInputValue(textValue)
            : textValue
        const cellClassName = cn(
          "min-w-0 rounded data-[anchor-active=true]:bg-primary/5 data-[anchor-active=true]:ring-1 data-[anchor-active=true]:ring-primary/30",
          !isEditing && !isScalarEditing
            ? "hover:bg-background focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"
            : "px-1 py-0.5",
          sourceLinked && (isEditing || isScalarEditing) && "hover:bg-muted/55"
        )
        const cellProps = {
          "data-slot": "data-cell",
          "data-table-cell": "",
          "data-anchor-path": sourceLinked ? logicalPath : undefined,
          className: cellClassName,
        }
        const commitDataCellValue = (
          nextValue: unknown,
          meta?: DataCellValueMeta
        ) => {
          let normalizedValue: unknown
          if (col.kind === "number" || col.kind === "integer") {
            if (meta && !meta.isValid) return
            normalizedValue =
              typeof nextValue === "number"
                ? nextValue
                : nextValue === null && col.nullable && meta?.isEmpty !== false
                  ? null
                  : undefined
            if (normalizedValue === undefined) return
          } else if (col.kind === "boolean") {
            normalizedValue = Boolean(nextValue)
          } else {
            const nextText = typeof nextValue === "string" ? nextValue : ""
            const nextDisplay =
              col.schema.format === "date-time"
                ? datetimeLocalInputValue(nextText)
                : nextText
            if (nextDisplay === initialDisplay) return
            normalizedValue =
              nextDisplay === "" && col.nullable ? null : nextDisplay
          }

          if (Object.is(value, normalizedValue)) return
          setValue(path, normalizedValue, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          })
        }

        return (
          <React.Fragment key={col.key}>
            {isEditing ? (
              <ArrayTableCellEditor
                path={path}
                column={col}
                onClose={() => setActiveEditorPath(null)}
                cellProps={cellProps}
              />
            ) : isEnum ? (
              <DataCell
                {...cellProps}
                kind="text"
                value={dataCellTextValue(value)}
                formatValue={() => displayText}
                placeholder=""
                role="button"
                tabIndex={0}
                aria-label={`${displayLabel} ${displayText}`}
                data-table-cell-editable="true"
                data-table-cell-path={path}
                className={cn(cellClassName, "text-sm")}
              />
            ) : dataCellKind === "number" || dataCellKind === "integer" ? (
              <DataCell
                {...cellProps}
                kind={dataCellKind}
                active={isScalarEditing}
                editable={isScalarEditing}
                value={dataCellNumberValue(value)}
                formatValue={() => displayText}
                placeholder=""
                role={!isScalarEditing ? "button" : undefined}
                aria-label={`${displayLabel} ${displayText}`}
                tabIndex={0}
                data-table-cell-editable={!isScalarEditing ? "true" : undefined}
                data-table-cell-path={!isScalarEditing ? path : undefined}
                autoFocus={isScalarEditing}
                name={path}
                onCommit={commitDataCellValue}
                data-table-cell-editor={isScalarEditing ? "true" : undefined}
                onBlur={() => {
                  if (isScalarEditing) setActiveEditorPath(null)
                }}
                className={cn(cellClassName, "text-sm")}
              />
            ) : dataCellKind === "boolean" ? (
              <DataCell
                {...cellProps}
                kind="boolean"
                active={isScalarEditing}
                editable={isScalarEditing}
                value={Boolean(value)}
                role={!isScalarEditing ? "button" : undefined}
                aria-label={`${displayLabel} ${displayText}`}
                tabIndex={0}
                data-table-cell-editable={!isScalarEditing ? "true" : undefined}
                data-table-cell-path={!isScalarEditing ? path : undefined}
                autoFocus={isScalarEditing}
                name={path}
                onCommit={commitDataCellValue}
                data-table-cell-editor={isScalarEditing ? "true" : undefined}
                onBlur={() => {
                  if (isScalarEditing) setActiveEditorPath(null)
                }}
                className={cn(cellClassName, "text-sm")}
              />
            ) : (
              <DataCell
                {...cellProps}
                kind={dataCellKind}
                active={isScalarEditing}
                editable={isScalarEditing}
                value={dataCellTextValue(value)}
                formatValue={() => displayText}
                placeholder=""
                role={!isScalarEditing ? "button" : undefined}
                aria-label={`${displayLabel} ${displayText}`}
                tabIndex={0}
                data-table-cell-editable={!isScalarEditing ? "true" : undefined}
                data-table-cell-path={!isScalarEditing ? path : undefined}
                autoFocus={isScalarEditing}
                name={path}
                onCommit={commitDataCellValue}
                data-table-cell-editor={isScalarEditing ? "true" : undefined}
                onBlur={() => {
                  if (isScalarEditing) setActiveEditorPath(null)
                }}
                className={cn(cellClassName, "text-sm")}
              />
            )}
          </React.Fragment>
        )
      })}
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-md border border-transparent text-base leading-none text-muted-foreground transition-colors hover:border-border hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        onClick={() => remove(index)}
        aria-label="Remove row"
        disabled={!canRemove}
      >
        <X className="size-4" />
      </button>
    </div>
  )
})

function ArrayTableCellEditor({
  path,
  column,
  onClose,
  cellProps,
}: {
  path: string
  column: Column
  onClose: () => void
  cellProps: React.HTMLAttributes<HTMLElement>
}) {
  return (
    <ArrayTableSelectCellEditor
      path={path}
      column={column}
      onClose={onClose}
      cellProps={cellProps}
    />
  )
}

function ArrayTableSelectCellEditor({
  path,
  column,
  onClose,
  cellProps,
}: {
  path: string
  column: Column
  onClose: () => void
  cellProps: React.HTMLAttributes<HTMLElement>
}) {
  const { control } = useFormContext()
  const { field } = useController({ control, name: path })

  return (
    <div
      {...cellProps}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <ScalarControl
        kind={column.kind}
        schema={column.schema}
        field={{
          ...field,
          onBlur: () => {
            field.onBlur()
            onClose()
          },
        }}
        compact
        nullable={column.nullable}
      />
    </div>
  )
}

function formatTableCellValue({
  value,
  column,
}: {
  value: unknown
  column: Column
}) {
  if (value == null || value === "") return "—"
  if (column.kind === "enum") {
    const option = column.schema.enum?.find((candidate) =>
      enumValueEquals(candidate, value)
    )
    return option === undefined ? enumLabel(value) : enumLabel(option)
  }
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "—"
  if (typeof value === "boolean") return value ? "True" : "False"
  return String(value)
}

function dataCellKindForColumn(
  column: Column
): Exclude<DataCellKind, "select"> {
  if (column.kind === "number" || column.kind === "integer") return column.kind
  if (column.kind === "boolean") return "boolean"
  if (column.schema.format === "date-time") return "date-time"
  if (column.schema.format === "date") return "date"
  if (column.schema.format === "time") return "time"
  return "text"
}

function useArrayTableScrollActivity(
  scrollRef: React.RefObject<HTMLElement | null>,
  {
    onScrollStart,
    onScrollMove,
    onScrollEnd,
  }: {
    onScrollStart: () => void
    onScrollMove: () => void
    onScrollEnd: () => void
  }
) {
  const isScrollingRef = React.useRef(false)
  const scrollEndTimeoutRef = React.useRef(0)
  const callbacksRef = React.useRef({
    onScrollStart,
    onScrollMove,
    onScrollEnd,
  })

  React.useLayoutEffect(() => {
    callbacksRef.current = { onScrollStart, onScrollMove, onScrollEnd }
  }, [onScrollEnd, onScrollMove, onScrollStart])

  const handleScroll = React.useCallback(() => {
    if (!isScrollingRef.current) {
      isScrollingRef.current = true
      callbacksRef.current.onScrollStart()
    }
    callbacksRef.current.onScrollMove()
    window.clearTimeout(scrollEndTimeoutRef.current)
    scrollEndTimeoutRef.current = window.setTimeout(() => {
      isScrollingRef.current = false
      callbacksRef.current.onScrollEnd()
    }, 120)
  }, [])

  React.useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    scrollElement.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.clearTimeout(scrollEndTimeoutRef.current)
      scrollElement.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll, scrollRef])
}

function StaticArrayTableBody({
  fields,
  onScrollStart,
  onScrollMove,
  onScrollEnd,
  renderItem,
}: {
  fields: { id: string }[]
  onScrollStart: () => void
  onScrollMove: () => void
  onScrollEnd: () => void
  renderItem: (index: number) => React.ReactNode
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  useArrayTableScrollActivity(scrollRef, {
    onScrollStart,
    onScrollMove,
    onScrollEnd,
  })

  return (
    <div
      ref={scrollRef}
      data-slot="json-form-table-scroll"
      className="overflow-y-auto"
      style={{ maxHeight: TABLE_MAX_HEIGHT }}
    >
      <div className="[contain:layout_paint_style]">
        {fields.map((entry, index) => (
          <React.Fragment key={entry.id}>{renderItem(index)}</React.Fragment>
        ))}
      </div>
    </div>
  )
}

function FixedArrayTableBody({
  name,
  fields,
  activeEditorPath,
  onScrollStart,
  onScrollMove,
  onScrollEnd,
  renderItem,
}: {
  name: string
  fields: { id: string }[]
  activeEditorPath: string | null
  onScrollStart: () => void
  onScrollMove: () => void
  onScrollEnd: () => void
  renderItem: (index: number, rowTopPx: number) => React.ReactNode
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const { virtualRows, totalRowSize } = useFixedRowVirtualization({
    rowCount: fields.length,
    rowSize: TABLE_ROW_HEIGHT,
    rowOverscan: TABLE_ROW_OVERSCAN,
    jumpRowOverscan: TABLE_JUMP_ROW_OVERSCAN,
    scrollRef,
  })
  useArrayTableScrollActivity(scrollRef, {
    onScrollStart,
    onScrollMove,
    onScrollEnd,
  })

  return (
    <div
      ref={scrollRef}
      data-slot="json-form-table-scroll"
      className="overflow-y-auto"
      style={{ maxHeight: TABLE_MAX_HEIGHT }}
    >
      <div
        style={getFixedGridRowWindowStyle({
          height: totalRowSize,
          minWidth: "100%",
        })}
        className="[contain:layout_paint_style]"
      >
        {virtualRows.map((virtualRow, slotIndex) => {
          const isEditingRow = activeEditorPath?.startsWith(
            `${name}.${virtualRow.index}.`
          )
          return (
            <React.Fragment
              key={
                isEditingRow ? fields[virtualRow.index].id : `slot-${slotIndex}`
              }
            >
              {renderItem(virtualRow.index, virtualRow.start)}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
