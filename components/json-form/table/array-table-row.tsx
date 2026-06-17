"use client"

import * as React from "react"
import { X } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { cn } from "@/lib/utils"
import { getFixedGridRowStyle } from "@/components/ui/fixed-grid-row-style"
import {
  encodeJsonFormKey,
  joinJsonFormPath,
  joinJsonSourcePath,
} from "@/components/json-form/path-codec"
import { labelFor, type Column } from "@/components/json-form/schema-model"
import { TABLE_ROW_HEIGHT } from "@/components/json-form/table/array-table-config"
import { ArrayTableCell } from "@/components/json-form/table/array-table-cell"
import {
  dataCellKindForColumn,
  formatArrayTableCellValue,
} from "@/components/json-form/table/array-table-format"

export const ArrayTableRow = React.memo(function ArrayTableRow({
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
  const closeEditor = React.useCallback(
    () => setActiveEditorPath(null),
    [setActiveEditorPath]
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
      {columns.map((column) => {
        const path = joinJsonFormPath(rowPath, column.key)
        const value = rowValue?.[encodeJsonFormKey(column.key)]
        const isEnum = column.kind === "enum"
        const isActiveEditor = activeEditorPath === path

        return (
          <ArrayTableCell
            key={column.key}
            model={{
              path,
              sourcePath: joinJsonSourcePath(rowSourcePath, column.key),
              label: labelFor(column.key, column.schema),
              displayText: formatArrayTableCellValue({ value, column }),
              kind: dataCellKindForColumn(column),
              value,
              isEnum,
              isEditing: isEnum && isActiveEditor,
              isScalarEditing: !isEnum && isActiveEditor,
              sourceLinked,
            }}
            column={column}
            setValue={setValue}
            closeEditor={closeEditor}
          />
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
