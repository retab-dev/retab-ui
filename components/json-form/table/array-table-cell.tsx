"use client"

import * as React from "react"
import { useController, useFormContext } from "react-hook-form"

import { cn } from "@/lib/utils"
import { DataCell } from "@/components/ui/data-cell"
import {
  dataCellNumberValue,
  dataCellTextValue,
  ScalarControl,
} from "@/components/json-form/scalar-control"
import type { Column } from "@/components/json-form/schema-model"
import {
  commitArrayTableCellValue,
  type CommitArrayTableCellValue,
  type SetArrayTableCellValue,
} from "@/components/json-form/table/array-table-cell-commit"
import type { ArrayTableCellModel } from "@/components/json-form/table/array-table-cell-model"
import {
  arrayTableCellClassName,
  arrayTableCellProps,
  editableArrayTableCellProps,
} from "@/components/json-form/table/array-table-cell-props"

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
  const cellClassName = arrayTableCellClassName(model)
  const cellProps = arrayTableCellProps(model)
  const commitValue = React.useCallback<CommitArrayTableCellValue>(
    (nextValue, meta) => {
      commitArrayTableCellValue({
        column,
        currentValue: model.value,
        meta,
        nextValue,
        path: model.path,
        setValue,
      })
    },
    [column, model.path, model.value, setValue]
  )
  const editableProps = editableArrayTableCellProps({
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
