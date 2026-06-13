import type * as React from "react"

import {
  type DataCellKind,
  type DataCellSelectOption,
} from "@/components/ui/data-cell"
import { jsonTableCommitValue } from "@/components/json-table/json-table-commit-value"
import {
  jsonTableDataCellClass,
  jsonTableSelectDataCellClass,
} from "@/components/json-table/json-table-data-cell"
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

type JsonTableTextDataCellKind = "text" | "date" | "time" | "date-time"

type JsonTableFormatValue<Kind extends DataCellKind, Value> = (
  value: Value | undefined,
  meta: { kind: Kind }
) => React.ReactNode

type JsonTableTextFormatValue = JsonTableFormatValue<
  JsonTableTextDataCellKind,
  string | null
>

type JsonTableDataCellBaseModel<
  Kind extends DataCellKind,
  Value,
  CommitValue,
> = {
  className: string
  kind: Kind
  value: Value
  commitValue: (commitValue: CommitValue) => unknown
}

type JsonTableTextDataCellModelFor<Kind extends JsonTableTextDataCellKind> =
  JsonTableDataCellBaseModel<Kind, string | null, string | null> & {
    formatValue?: JsonTableTextFormatValue
    showPickerIcon?: boolean
  }

export type JsonTableTextDataCellModel = {
  [Kind in JsonTableTextDataCellKind]: JsonTableTextDataCellModelFor<Kind>
}[JsonTableTextDataCellKind]

export type JsonTableNumberDataCellModel =
  | JsonTableDataCellBaseModel<"number", string | number | null, number | null>
  | JsonTableDataCellBaseModel<"integer", string | number | null, number | null>

export type JsonTableBooleanDataCellModel = JsonTableDataCellBaseModel<
  "boolean",
  boolean | null,
  boolean
>

export type JsonTableSelectDataCellModel = JsonTableDataCellBaseModel<
  "select",
  string | null,
  string | null
> & {
  formatValue?: JsonTableFormatValue<"select", string | null>
  placeholder: string
  selectOptions: DataCellSelectOption[]
}

export type JsonTableDataCellModel =
  | JsonTableTextDataCellModel
  | JsonTableNumberDataCellModel
  | JsonTableBooleanDataCellModel
  | JsonTableSelectDataCellModel

export function createJsonTableDataCellModel({
  fieldMetadata,
  value: jsonValue,
}: {
  fieldMetadata: FieldMetadata
  value: unknown
}): JsonTableDataCellModel {
  const primitiveKind = jsonTablePrimitiveKind(fieldMetadata)

  if (primitiveKind === "select") {
    return selectDataCellModel(fieldMetadata, jsonValue)
  }

  if (primitiveKind === "number" || primitiveKind === "integer") {
    return numberDataCellModel(jsonValue, primitiveKind)
  }

  if (primitiveKind === "boolean") {
    return booleanDataCellModel(fieldMetadata, jsonValue)
  }

  if (primitiveKind) {
    return textDataCellModel(fieldMetadata, jsonValue, primitiveKind)
  }

  return fallbackTextDataCellModel(fieldMetadata, jsonValue)
}

function selectDataCellModel(
  fieldMetadata: FieldMetadata,
  jsonValue: unknown
): JsonTableSelectDataCellModel {
  return {
    className: jsonTableSelectDataCellClass,
    formatValue:
      fieldMetadata.kind === "enum"
        ? () =>
            jsonTableSelectDisplayText({
              isNullable: fieldMetadata.isNullable,
              jsonValue,
            })
        : undefined,
    kind: "select",
    placeholder: "Select...",
    selectOptions: jsonTableSelectOptions(fieldMetadata),
    value: jsonTableSelectValue({ fieldMetadata, jsonValue }),
    commitValue: (commitValue) =>
      commitValue === null
        ? null
        : jsonTableCommitValue({ fieldMetadata, commitValue }),
  }
}

function numberDataCellModel(
  jsonValue: unknown,
  kind: "number" | "integer"
): JsonTableNumberDataCellModel {
  return {
    className: jsonTableDataCellClass,
    kind,
    value: jsonTableNumberDataCellValue(jsonValue),
    commitValue: (commitValue) => commitValue,
  }
}

function booleanDataCellModel(
  fieldMetadata: FieldMetadata,
  jsonValue: unknown
): JsonTableBooleanDataCellModel {
  return {
    className: jsonTableDataCellClass,
    kind: "boolean",
    value: jsonTableBooleanDataCellValue(jsonValue),
    commitValue: (commitValue) =>
      jsonTableCommitValue({ fieldMetadata, commitValue }),
  }
}

function textDataCellModel(
  fieldMetadata: FieldMetadata,
  jsonValue: unknown,
  kind: JsonTableTextDataCellKind
): JsonTableTextDataCellModelFor<typeof kind> {
  return {
    className: jsonTableDataCellClass,
    formatValue:
      fieldMetadata.kind === "date"
        ? (dataCellValue) => jsonTableDateDisplayText(dataCellValue)
        : undefined,
    kind,
    showPickerIcon: false,
    value: jsonTableTextDataCellValue(jsonValue),
    commitValue: (commitValue) =>
      jsonTableCommitValue({ fieldMetadata, commitValue }),
  }
}

function fallbackTextDataCellModel(
  fieldMetadata: FieldMetadata,
  jsonValue: unknown
): JsonTableTextDataCellModelFor<"text"> {
  return {
    className: jsonTableDataCellClass,
    kind: "text",
    value: jsonTableJsonText(jsonValue),
    commitValue: (commitValue) =>
      jsonTableCommitValue({ fieldMetadata, commitValue }),
  }
}
