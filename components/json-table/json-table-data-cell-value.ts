import { jsonTablePrimitiveKind } from "@/components/json-table/json-table-primitive-kind";
import { jsonTableSelectValue } from "@/components/json-table/json-table-select-options";
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata";

export function jsonTableDataCellValue({
  fieldMetadata,
  jsonValue,
}: {
  fieldMetadata: FieldMetadata;
  jsonValue: unknown;
}): string | number | boolean | null {
  const primitiveKind = jsonTablePrimitiveKind(fieldMetadata);

  if (primitiveKind === "select") {
    return jsonTableSelectValue({ fieldMetadata, jsonValue });
  }

  if (primitiveKind === "number" || primitiveKind === "integer") {
    return jsonTableNumberDataCellValue(jsonValue);
  }

  if (primitiveKind === "boolean") {
    return typeof jsonValue === "boolean" ? jsonValue : null;
  }

  if (primitiveKind) {
    return jsonTableTextDataCellValue(jsonValue);
  }

  return jsonTableJsonText(jsonValue);
}

export function jsonTableBooleanDataCellValue(
  jsonValue: unknown,
): boolean | null {
  return typeof jsonValue === "boolean" ? jsonValue : null;
}

export function jsonTableJsonText(jsonValue: unknown): string {
  if (Array.isArray(jsonValue)) return `[${jsonValue.length} items]`;
  if (jsonValue === null || jsonValue === undefined) return "";
  if (typeof jsonValue !== "object") return String(jsonValue);
  try {
    return JSON.stringify(jsonValue);
  } catch {
    return String(jsonValue);
  }
}

export function jsonTableNumberDataCellValue(
  jsonValue: unknown,
): string | number | null {
  return typeof jsonValue === "number" || typeof jsonValue === "string"
    ? jsonValue
    : null;
}

export function jsonTableTextDataCellValue(jsonValue: unknown): string | null {
  return jsonValue === null || jsonValue === undefined
    ? null
    : String(jsonTablePrimitiveTextValue(jsonValue));
}

function jsonTablePrimitiveTextValue(jsonValue: unknown) {
  if (
    jsonValue === null ||
    jsonValue === undefined ||
    typeof jsonValue === "string" ||
    typeof jsonValue === "number" ||
    typeof jsonValue === "boolean"
  ) {
    return jsonValue;
  }
  return jsonTableJsonText(jsonValue);
}
