import type { DataCellKind } from "@/components/ui/data-cell"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export function jsonTablePrimitiveKind(
  fieldMetadata: FieldMetadata
): DataCellKind | null {
  switch (fieldMetadata.kind) {
    case "enum":
      return "select"
    case "string":
    case "unknown":
      return "text"
    case "number":
    case "integer":
    case "boolean":
    case "date":
    case "date-time":
    case "time":
      return fieldMetadata.kind
    default:
      return null
  }
}
