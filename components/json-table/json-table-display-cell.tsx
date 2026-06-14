import * as React from "react"

import {
  DataCell,
  type DataCellEditorHandle,
  type DataCellValueMeta,
} from "@/components/ui/data-cell"
import {
  createJsonTableDataCellModel,
  type JsonTableBooleanDataCellModel,
  type JsonTableNumberDataCellModel,
  type JsonTableSelectDataCellModel,
  type JsonTableTextDataCellModel,
} from "@/components/json-table/json-table-data-cell-model"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export type JsonTableDisplayCellProps = {
  fieldMetadata: FieldMetadata
  value: unknown
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
  onOpenChange,
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
  onOpenChange?: (open: boolean) => void
  value: unknown
}) {
  const model = React.useMemo(
    () => createJsonTableDataCellModel({ fieldMetadata, value }),
    [fieldMetadata, value]
  )
  const sharedProps = {
    mode,
    editable: isEditable,
    active,
    activationSource,
    autoFocus,
    onEditingEnd,
    onActiveChange,
    onEditorHandleChange,
    onOpenChange,
    onKeyDown,
  }

  if (model.kind === "select") {
    return (
      <JsonTableSelectDataCell
        model={model}
        onCommit={onCommit}
        sharedProps={sharedProps}
      />
    )
  }

  if (model.kind === "boolean") {
    return (
      <JsonTableBooleanDataCell
        model={model}
        onCommit={onCommit}
        sharedProps={sharedProps}
      />
    )
  }

  if (model.kind === "number" || model.kind === "integer") {
    return (
      <JsonTableNumberDataCell
        model={model}
        onCommit={onCommit}
        sharedProps={sharedProps}
      />
    )
  }

  return (
    <JsonTableTextDataCell
      model={model}
      onCommit={onCommit}
      sharedProps={sharedProps}
    />
  )
}

type JsonTableDataCellSharedProps = {
  activationSource?: React.ComponentProps<typeof DataCell>["activationSource"]
  active?: boolean
  autoFocus?: boolean
  editable: boolean
  mode: "display" | "edit"
  onActiveChange?: (active: boolean) => void
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
  onOpenChange?: (open: boolean) => void
}

type JsonTableDataCellCommitHandler = (
  value: unknown,
  meta: DataCellValueMeta
) => void

function JsonTableSelectDataCell({
  model,
  onCommit,
  sharedProps,
}: {
  model: JsonTableSelectDataCellModel
  onCommit?: JsonTableDataCellCommitHandler
  sharedProps: JsonTableDataCellSharedProps
}) {
  return (
    <DataCell
      {...sharedProps}
      kind={model.kind}
      value={model.value}
      selectOptions={model.selectOptions}
      placeholder={model.placeholder}
      className={model.className}
      formatValue={model.formatValue}
      onCommit={(commitValue, meta) =>
        onCommit?.(model.commitValue(commitValue), meta)
      }
    />
  )
}

function JsonTableBooleanDataCell({
  model,
  onCommit,
  sharedProps,
}: {
  model: JsonTableBooleanDataCellModel
  onCommit?: JsonTableDataCellCommitHandler
  sharedProps: JsonTableDataCellSharedProps
}) {
  return (
    <DataCell
      {...sharedProps}
      kind={model.kind}
      value={model.value}
      className={model.className}
      onCommit={(commitValue, meta) =>
        onCommit?.(model.commitValue(commitValue), meta)
      }
    />
  )
}

function JsonTableNumberDataCell({
  model,
  onCommit,
  sharedProps,
}: {
  model: JsonTableNumberDataCellModel
  onCommit?: JsonTableDataCellCommitHandler
  sharedProps: JsonTableDataCellSharedProps
}) {
  return (
    <DataCell
      {...sharedProps}
      kind={model.kind}
      value={model.value}
      className={model.className}
      onCommit={(commitValue, meta) =>
        onCommit?.(model.commitValue(commitValue), meta)
      }
    />
  )
}

function JsonTableTextDataCell({
  model,
  onCommit,
  sharedProps,
}: {
  model: JsonTableTextDataCellModel
  onCommit?: JsonTableDataCellCommitHandler
  sharedProps: JsonTableDataCellSharedProps
}) {
  return (
    <DataCell
      {...sharedProps}
      kind={model.kind}
      value={model.value}
      className={model.className}
      formatValue={model.formatValue}
      showPickerIcon={model.showPickerIcon}
      onCommit={(commitValue, meta) =>
        onCommit?.(model.commitValue(commitValue), meta)
      }
    />
  )
}
