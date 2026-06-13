import { format } from "date-fns"

import { formatDataCellDisplayValue } from "@/components/ui/data-cell"
import {
  jsonTableJsonText,
  jsonTableNumberDataCellValue,
  jsonTableTextDataCellValue,
} from "@/components/json-table/json-table-data-cell-value"
import { jsonTablePrimitiveKind } from "@/components/json-table/json-table-primitive-kind"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export function jsonTableDisplayText({
  fieldMetadata,
  jsonValue,
}: {
  fieldMetadata: FieldMetadata
  jsonValue: unknown
}): string {
  const primitiveKind = jsonTablePrimitiveKind(fieldMetadata)

  if (primitiveKind === "select") {
    return formatDataCellDisplayValue(
      "select",
      jsonTableTextDataCellValue(jsonValue)
    )
  }

  if (primitiveKind === "number" || primitiveKind === "integer") {
    return formatDataCellDisplayValue(
      primitiveKind,
      jsonTableNumberDataCellValue(jsonValue)
    )
  }

  if (primitiveKind === "boolean") {
    return typeof jsonValue === "boolean" ? String(jsonValue) : ""
  }

  if (primitiveKind) {
    if (fieldMetadata.kind === "date")
      return jsonTableDateDisplayText(jsonValue)
    return formatDataCellDisplayValue(
      primitiveKind,
      jsonTableTextDataCellValue(jsonValue)
    )
  }

  return jsonTableJsonText(jsonValue)
}

export function jsonTableDateDisplayText(jsonValue: unknown): string {
  if (jsonValue === null || jsonValue === undefined || jsonValue === "") {
    return ""
  }
  if (typeof jsonValue !== "string") return String(jsonValue)
  const date = parseDateStringAsLocal(jsonValue)
  return date ? format(date, "PP") : jsonValue
}
