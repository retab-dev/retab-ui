import { type DataCellValueMeta } from "@/components/ui/data-cell";
import { datetimeLocalInputValue } from "@/components/json-form-retab/scalar-control";
import type { Column } from "@/components/json-form-retab/schema-model";

export type SetArrayTableCellValue = (
  path: string,
  value: unknown,
  options: {
    shouldDirty: true;
    shouldTouch: true;
    shouldValidate: true;
  },
) => void;

export type CommitArrayTableCellValue = (
  value: unknown,
  meta?: DataCellValueMeta,
) => void;

export const NO_ARRAY_TABLE_CELL_COMMIT = Symbol("NO_ARRAY_TABLE_CELL_COMMIT");

export function normalizeArrayTableCellValue({
  column,
  currentValue,
  nextValue,
  meta,
}: {
  column: Column;
  currentValue: unknown;
  nextValue: unknown;
  meta?: DataCellValueMeta;
}): unknown | typeof NO_ARRAY_TABLE_CELL_COMMIT {
  let normalizedValue: unknown;
  if (column.kind === "enum") {
    normalizedValue = nextValue;
  } else if (column.kind === "number" || column.kind === "integer") {
    if (meta && !meta.isValid) return NO_ARRAY_TABLE_CELL_COMMIT;
    normalizedValue =
      typeof nextValue === "number"
        ? nextValue
        : nextValue === null && column.nullable && meta?.isEmpty !== false
          ? null
          : undefined;
    if (normalizedValue === undefined) return NO_ARRAY_TABLE_CELL_COMMIT;
  } else if (column.kind === "boolean") {
    normalizedValue = Boolean(nextValue);
  } else {
    const currentText = currentValue == null ? "" : String(currentValue);
    const currentDisplay =
      column.schema.format === "date-time"
        ? datetimeLocalInputValue(currentText)
        : currentText;
    const nextText = typeof nextValue === "string" ? nextValue : "";
    const nextDisplay =
      column.schema.format === "date-time"
        ? datetimeLocalInputValue(nextText)
        : nextText;

    if (nextDisplay === currentDisplay) return NO_ARRAY_TABLE_CELL_COMMIT;
    normalizedValue =
      nextDisplay === "" && column.nullable ? null : nextDisplay;
  }

  return Object.is(currentValue, normalizedValue)
    ? NO_ARRAY_TABLE_CELL_COMMIT
    : normalizedValue;
}

export function commitArrayTableCellValue({
  column,
  currentValue,
  meta,
  nextValue,
  path,
  setValue,
}: {
  column: Column;
  currentValue: unknown;
  meta?: DataCellValueMeta;
  nextValue: unknown;
  path: string;
  setValue: SetArrayTableCellValue;
}) {
  const normalizedValue = normalizeArrayTableCellValue({
    column,
    currentValue,
    nextValue,
    meta,
  });

  if (normalizedValue === NO_ARRAY_TABLE_CELL_COMMIT) return;
  setValue(path, normalizedValue, {
    shouldDirty: true,
    shouldTouch: true,
    shouldValidate: true,
  });
}
