import {
  enumLabel,
  enumValueEquals,
} from "@/components/json-form-retab/scalar-control";
import type { Column } from "@/components/json-form-retab/schema-model";

export type ArrayTableDataCellKind =
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "select"
  | "date"
  | "time"
  | "date-time";

export function formatArrayTableCellValue({
  value,
  column,
}: {
  value: unknown;
  column: Column;
}) {
  if (value == null || value === "") return "—";
  if (column.kind === "enum") {
    const option = column.schema.enum?.find((candidate) =>
      enumValueEquals(candidate, value),
    );
    return option === undefined ? enumLabel(value) : enumLabel(option);
  }
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

export function dataCellKindForColumn(column: Column): ArrayTableDataCellKind {
  if (column.kind === "enum") return "select";
  if (column.kind === "number" || column.kind === "integer") return column.kind;
  if (column.kind === "boolean") return "boolean";
  if (column.schema.format === "date-time") return "date-time";
  if (column.schema.format === "date") return "date";
  if (column.schema.format === "time") return "time";
  return "text";
}
