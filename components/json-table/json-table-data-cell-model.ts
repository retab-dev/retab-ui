import type * as React from "react"

import {
  type DataCellProps,
  type DataCellValueMeta,
} from "@/components/ui/data-cell"
import { jsonTableCommitValue } from "@/components/json-table/json-table-commit-value"
import {
  jsonTableDataCellClass,
  jsonTableSelectDataCellClass,
} from "@/components/json-table/json-table-data-cell-classes"
import {
  jsonTableBooleanDataCellValue,
  jsonTableJsonText,
  jsonTableNumberDataCellValue,
  jsonTableTextDataCellValue,
} from "@/components/json-table/json-table-data-cell-value"
import { jsonTableDateDisplayText } from "@/components/json-table/json-table-display-value"
import { jsonTablePrimitiveKind } from "@/components/json-table/json-table-primitive-kind"
import {
  jsonTableSelectDisplayText,
  jsonTableSelectOptions,
  jsonTableSelectValue,
} from "@/components/json-table/json-table-select-options"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

type TextDataCellKind = "text" | "date" | "time" | "date-time"

type SharedDataCellProps = {
  active?: boolean
  autoFocus?: boolean
  editable: boolean
  onActiveChange?: (active: boolean) => void
  onEditingEnd?: () => void
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
}

type CommitJsonValue = (value: unknown, meta: DataCellValueMeta) => void

type JsonCommitValue = string | number | boolean | null

export function createJsonTableDataCellProps({
  active,
  autoFocus,
  fieldMetadata,
  isEditable = false,
  onActiveChange,
  onCommit,
  onEditingEnd,
  onKeyDown,
  onOpenChange,
  value,
}: {
  active?: boolean
  autoFocus?: boolean
  fieldMetadata: FieldMetadata
  isEditable?: boolean
  onActiveChange?: (active: boolean) => void
  onCommit?: CommitJsonValue
  onEditingEnd?: () => void
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
  onOpenChange?: (open: boolean) => void
  value: unknown
}): DataCellProps {
  const sharedProps: SharedDataCellProps = {
    editable: isEditable,
    active,
    autoFocus,
    onEditingEnd,
    onActiveChange,
    onKeyDown,
  }

  const primitiveKind = jsonTablePrimitiveKind(fieldMetadata)

  if (primitiveKind === "select") {
    return selectDataCellProps({
      fieldMetadata,
      jsonValue: value,
      onCommit,
      onOpenChange,
      sharedProps,
    })
  }

  if (primitiveKind === "number" || primitiveKind === "integer") {
    return numberDataCellProps({
      jsonValue: value,
      kind: primitiveKind,
      onCommit,
      sharedProps,
    })
  }

  if (primitiveKind === "boolean") {
    return booleanDataCellProps({
      fieldMetadata,
      jsonValue: value,
      onCommit,
      sharedProps,
    })
  }

  if (primitiveKind) {
    return textDataCellProps({
      fieldMetadata,
      jsonValue: value,
      kind: primitiveKind,
      onCommit,
      onOpenChange,
      sharedProps,
    })
  }

  return fallbackTextDataCellProps({
    fieldMetadata,
    jsonValue: value,
    onCommit,
    sharedProps,
  })
}

function jsonTableDataCellCommitHandler<CommitValue>(
  toJsonValue: (dataCellValue: CommitValue) => unknown,
  onCommit?: CommitJsonValue
) {
  return (dataCellValue: CommitValue, meta: DataCellValueMeta) => {
    onCommit?.(toJsonValue(dataCellValue), meta)
  }
}

function jsonTableDataCellJsonCommitHandler<CommitValue extends JsonCommitValue>(
  fieldMetadata: FieldMetadata,
  onCommit?: CommitJsonValue
) {
  return jsonTableDataCellCommitHandler(
    (commitValue: CommitValue) =>
      jsonTableCommitValue({ fieldMetadata, commitValue }),
    onCommit
  )
}

function selectDataCellProps({
  fieldMetadata,
  jsonValue,
  onCommit,
  onOpenChange,
  sharedProps,
}: {
  fieldMetadata: FieldMetadata
  jsonValue: unknown
  onCommit?: CommitJsonValue
  onOpenChange?: (open: boolean) => void
  sharedProps: SharedDataCellProps
}): DataCellProps {
  return {
    ...sharedProps,
    kind: "select",
    value: jsonTableSelectValue({ fieldMetadata, jsonValue }),
    selectOptions: jsonTableSelectOptions(fieldMetadata),
    placeholder: "Select...",
    className: jsonTableSelectDataCellClass,
    formatValue:
      fieldMetadata.kind === "enum"
        ? () =>
            jsonTableSelectDisplayText({
              isNullable: fieldMetadata.isNullable,
              jsonValue,
            })
        : undefined,
    onOpenChange,
    onCommit: jsonTableDataCellCommitHandler(
      (dataCellValue) =>
        dataCellValue === null
          ? null
          : jsonTableCommitValue({ fieldMetadata, commitValue: dataCellValue }),
      onCommit
    ),
  }
}

function numberDataCellProps({
  jsonValue,
  kind,
  onCommit,
  sharedProps,
}: {
  jsonValue: unknown
  kind: "number" | "integer"
  onCommit?: CommitJsonValue
  sharedProps: SharedDataCellProps
}): DataCellProps {
  return {
    ...sharedProps,
    kind,
    value: jsonTableNumberDataCellValue(jsonValue),
    className: jsonTableDataCellClass,
    onCommit: jsonTableDataCellCommitHandler(
      (dataCellValue) => dataCellValue,
      onCommit
    ),
  }
}

function booleanDataCellProps({
  fieldMetadata,
  jsonValue,
  onCommit,
  sharedProps,
}: {
  fieldMetadata: FieldMetadata
  jsonValue: unknown
  onCommit?: CommitJsonValue
  sharedProps: SharedDataCellProps
}): DataCellProps {
  return {
    ...sharedProps,
    kind: "boolean",
    value: jsonTableBooleanDataCellValue(jsonValue),
    className: jsonTableDataCellClass,
    onCommit: jsonTableDataCellJsonCommitHandler(fieldMetadata, onCommit),
  }
}

function textDataCellProps({
  fieldMetadata,
  jsonValue,
  kind,
  onCommit,
  onOpenChange,
  sharedProps,
}: {
  fieldMetadata: FieldMetadata
  jsonValue: unknown
  kind: TextDataCellKind
  onCommit?: CommitJsonValue
  onOpenChange?: (open: boolean) => void
  sharedProps: SharedDataCellProps
}): DataCellProps {
  if (kind === "text") {
    return {
      ...sharedProps,
      kind,
      value: jsonTableTextDataCellValue(jsonValue),
      className: jsonTableDataCellClass,
      onCommit: jsonTableDataCellJsonCommitHandler(fieldMetadata, onCommit),
    }
  }

  return {
    ...sharedProps,
    kind,
    value: jsonTableTextDataCellValue(jsonValue),
    className: jsonTableDataCellClass,
    formatValue:
      fieldMetadata.kind === "date"
        ? (dataCellValue: string | null | undefined) =>
            jsonTableDateDisplayText(dataCellValue)
        : undefined,
    showPickerIcon: false,
    onOpenChange,
    onCommit: jsonTableDataCellJsonCommitHandler(fieldMetadata, onCommit),
  }
}

function fallbackTextDataCellProps({
  fieldMetadata,
  jsonValue,
  onCommit,
  sharedProps,
}: {
  fieldMetadata: FieldMetadata
  jsonValue: unknown
  onCommit?: CommitJsonValue
  sharedProps: SharedDataCellProps
}): DataCellProps {
  return {
    ...sharedProps,
    kind: "text",
    value: jsonTableJsonText(jsonValue),
    className: jsonTableDataCellClass,
    onCommit: jsonTableDataCellJsonCommitHandler(fieldMetadata, onCommit),
  }
}
