"use client"

import * as React from "react"
import { useController, useFormContext } from "react-hook-form"

import { cn } from "@/lib/utils"
import {
  DataCell,
  type DataCellCommitValue,
  type DataCellValueMeta,
} from "@/components/ui/data-cell"
import {
  dataCellNumberValue,
  dataCellTextValue,
  datetimeLocalInputValue,
  ScalarControl,
} from "@/components/json-form/scalar-control"
import type { Column } from "@/components/json-form/schema-model"
import type { ArrayTableDataCellKind } from "@/components/json-form/table/array-table-format"

type SetArrayTableCellValue = (
  path: string,
  value: unknown,
  options: {
    shouldDirty: true
    shouldTouch: true
    shouldValidate: true
  }
) => void

export type ArrayTableCellModel = {
  path: string
  sourcePath: string
  label: string
  displayText: string
  kind: ArrayTableDataCellKind
  value: unknown
  isEnum: boolean
  isEditing: boolean
  isScalarEditing: boolean
  sourceLinked: boolean
}

export function ArrayTableCell({
  model,
  column,
  setValue,
  closeEditor,
}: {
  model: ArrayTableCellModel
  column: Column
  setValue: SetArrayTableCellValue
  closeEditor: () => void
}) {
  const cellClassName = cn(
    "min-w-0 rounded data-[source-active=true]:bg-primary/5 data-[source-active=true]:ring-1 data-[source-active=true]:ring-primary/30",
    !model.isEditing && !model.isScalarEditing
      ? "hover:bg-background focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"
      : "px-1 py-0.5",
    model.sourceLinked &&
      (model.isEditing || model.isScalarEditing) &&
      "hover:bg-muted/55"
  )
  const cellProps = {
    "data-slot": "data-cell",
    "data-table-cell": "",
    "data-source-path": model.sourceLinked ? model.sourcePath : undefined,
    className: cellClassName,
  }
  const commitValue = (
    nextValue: DataCellCommitValue,
    meta?: DataCellValueMeta
  ) => {
    const normalizedValue = normalizeArrayTableCellValue({
      column,
      currentValue: model.value,
      nextValue,
      meta,
    })

    if (normalizedValue === NO_CELL_COMMIT) return
    setValue(model.path, normalizedValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }
  const editableProps = editableCellProps({
    model,
    commitValue,
    closeEditor,
  })

  if (model.isEditing) {
    return (
      <ArrayTableCellEditor
        path={model.path}
        column={column}
        onClose={closeEditor}
        cellProps={cellProps}
      />
    )
  }

  if (model.isEnum) {
    return (
      <DataCell
        {...cellProps}
        kind="text"
        value={dataCellTextValue(model.value)}
        formatValue={() => model.displayText}
        placeholder=""
        role="button"
        tabIndex={0}
        aria-label={`${model.label} ${model.displayText}`}
        data-table-cell-editable="true"
        data-table-cell-path={model.path}
        className={cn(cellClassName, "text-sm")}
      />
    )
  }

  if (model.kind === "number" || model.kind === "integer") {
    return (
      <DataCell
        {...cellProps}
        {...editableProps}
        kind={model.kind}
        value={dataCellNumberValue(model.value)}
        formatValue={() => model.displayText}
        placeholder=""
        className={cn(cellClassName, "text-sm")}
      />
    )
  }

  if (model.kind === "boolean") {
    return (
      <DataCell
        {...cellProps}
        {...editableProps}
        kind="boolean"
        value={Boolean(model.value)}
        className={cn(cellClassName, "text-sm")}
      />
    )
  }

  return (
    <DataCell
      {...cellProps}
      {...editableProps}
      kind={model.kind}
      value={dataCellTextValue(model.value)}
      formatValue={() => model.displayText}
      placeholder=""
      className={cn(cellClassName, "text-sm")}
    />
  )
}

function editableCellProps({
  model,
  commitValue,
  closeEditor,
}: {
  model: ArrayTableCellModel
  commitValue: (value: DataCellCommitValue, meta?: DataCellValueMeta) => void
  closeEditor: () => void
}) {
  return {
    active: model.isScalarEditing,
    editable: model.isScalarEditing,
    role: !model.isScalarEditing ? "button" : undefined,
    "aria-label": `${model.label} ${model.displayText}`,
    tabIndex: 0,
    "data-table-cell-editable": !model.isScalarEditing ? "true" : undefined,
    "data-table-cell-path": !model.isScalarEditing ? model.path : undefined,
    autoFocus: model.isScalarEditing,
    name: model.path,
    onCommit: commitValue,
    "data-table-cell-editor": model.isScalarEditing ? "true" : undefined,
    onBlur: () => {
      if (model.isScalarEditing) closeEditor()
    },
  }
}

const NO_CELL_COMMIT = Symbol("NO_CELL_COMMIT")

function normalizeArrayTableCellValue({
  column,
  currentValue,
  nextValue,
  meta,
}: {
  column: Column
  currentValue: unknown
  nextValue: DataCellCommitValue
  meta?: DataCellValueMeta
}): unknown | typeof NO_CELL_COMMIT {
  let normalizedValue: unknown
  if (column.kind === "number" || column.kind === "integer") {
    if (meta && !meta.isValid) return NO_CELL_COMMIT
    normalizedValue =
      typeof nextValue === "number"
        ? nextValue
        : nextValue === null && column.nullable && meta?.isEmpty !== false
          ? null
          : undefined
    if (normalizedValue === undefined) return NO_CELL_COMMIT
  } else if (column.kind === "boolean") {
    normalizedValue = Boolean(nextValue)
  } else {
    const currentText = currentValue == null ? "" : String(currentValue)
    const currentDisplay =
      column.schema.format === "date-time"
        ? datetimeLocalInputValue(currentText)
        : currentText
    const nextText = typeof nextValue === "string" ? nextValue : ""
    const nextDisplay =
      column.schema.format === "date-time"
        ? datetimeLocalInputValue(nextText)
        : nextText

    if (nextDisplay === currentDisplay) return NO_CELL_COMMIT
    normalizedValue =
      nextDisplay === "" && column.nullable ? null : nextDisplay
  }

  return Object.is(currentValue, normalizedValue)
    ? NO_CELL_COMMIT
    : normalizedValue
}

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
