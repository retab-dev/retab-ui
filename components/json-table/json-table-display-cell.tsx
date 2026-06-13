import * as React from "react"

import { cn } from "@/lib/utils"
import {
  DataCell,
  type DataCellCommitValue,
  type DataCellEditorHandle,
  type DataCellProps,
  type DataCellValueMeta,
} from "@/components/ui/data-cell"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"
import {
  createJsonTableDataCellModel,
  dataCellKindForField,
  getJsonTableCellDisplayValue,
} from "@/components/json-table/json-table-data-cell-model"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { DataCellBooleanIndicator } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import { dataCellCheckboxDisplayClass } from "@/registry/new-york-v4/ui/data-cell-classes"

export type JsonTableDisplayCellProps = {
  fieldMetadata: FieldMetadata
  value: unknown
}

export function JsonTableReadOnlyPrimitiveDisplayCell({
  displayValue,
  fieldMetadata,
}: {
  displayValue: string
  fieldMetadata: FieldMetadata
}) {
  const isEmpty = displayValue === ""
  const text = isEmpty ? "—" : displayValue

  if (fieldMetadata.kind === "boolean") {
    const checked = displayValue === "true"
    return (
      <div
        data-slot="data-cell"
        data-kind="boolean"
        data-mode="display"
        aria-readonly
        className={cn(
          jsonTableDataCellClass,
          "flex items-center justify-center"
        )}
      >
        <span
          role="checkbox"
          data-slot="checkbox"
          data-state={checked ? "checked" : "unchecked"}
          aria-checked={checked}
          aria-label={checked ? "true" : "false"}
          className={cn(
            dataCellCheckboxDisplayClass,
            "pointer-events-none flex items-center justify-center"
          )}
        >
          <DataCellBooleanIndicator checked={checked} />
        </span>
        <span data-slot="json-table-read-only-cell-text" className="sr-only">
          {text}
        </span>
      </div>
    )
  }

  return (
    <div
      data-slot="data-cell"
      data-kind={dataCellKindForField(fieldMetadata) ?? "text"}
      data-mode="display"
      aria-readonly
      className={cn(
        jsonTableDataCellClass,
        "relative inline-flex w-full items-center overflow-hidden bg-transparent px-3 text-inherit"
      )}
    >
      <span
        data-slot="json-table-read-only-cell-text"
        className={cn("truncate", isEmpty && "text-muted-foreground")}
      >
        {text}
      </span>
    </div>
  )
}

export function JsonTableDisplayCell({
  fieldMetadata,
  value,
}: JsonTableDisplayCellProps) {
  return (
    <JsonTableDataCell
      fieldMetadata={fieldMetadata}
      value={value}
      mode="display"
    />
  )
}

export function JsonTableDataCell({
  activationSource,
  autoFocus,
  active,
  fieldMetadata,
  isEditable = false,
  mode,
  onCommit,
  onEditingEnd,
  onKeyDown,
  onActiveChange,
  onEditorHandleChange,
  onPickerOpenChange,
  value,
}: {
  activationSource?: React.ComponentProps<typeof DataCell>["activationSource"]
  autoFocus?: boolean
  active?: boolean
  fieldMetadata: FieldMetadata
  isEditable?: boolean
  mode: "display" | "edit"
  onCommit?: (value: unknown, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
  onActiveChange?: (active: boolean) => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
  onPickerOpenChange?: (open: boolean) => void
  value: unknown
}) {
  const model = React.useMemo(
    () => createJsonTableDataCellModel({ fieldMetadata, value }),
    [fieldMetadata, value]
  )
  const handleCommit = React.useCallback(
    (nextValue: DataCellCommitValue, meta: DataCellValueMeta) => {
      onCommit?.(model.commitValue(nextValue), meta)
    },
    [model, onCommit]
  )
  const dataCellProps = {
    kind: model.kind,
    mode,
    value: model.value,
    ...(model.selectOptions ? { selectOptions: model.selectOptions } : {}),
    editable: isEditable,
    active,
    activationSource,
    autoFocus,
    onCommit: handleCommit,
    onEditingEnd,
    onActiveChange,
    onEditorHandleChange,
    onPickerOpenChange,
    onKeyDown,
    placeholder: model.placeholder,
    className: model.className,
    formatValue: model.formatValue,
    showPickerIcon: model.showPickerIcon,
  } as DataCellProps

  return <DataCell {...dataCellProps} />
}
