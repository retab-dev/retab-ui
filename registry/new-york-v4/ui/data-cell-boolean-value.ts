import type { DataCellValueMeta } from "@/registry/new-york-v4/ui/data-cell-types";

export type DataCellBooleanCommitHandler = (
  value: boolean,
  meta: DataCellValueMeta,
) => void;

export function commitDataCellBooleanToggle(
  value: boolean | null | undefined,
  onCommit: DataCellBooleanCommitHandler | undefined,
) {
  const nextValue = nextDataCellBooleanValue(value);
  onCommit?.(nextValue, dataCellBooleanValueMeta(nextValue));
}

export function nextDataCellBooleanValue(value: boolean | null | undefined) {
  return !Boolean(value);
}

export function dataCellBooleanValueMeta(value: boolean): DataCellValueMeta {
  return {
    kind: "boolean",
    rawValue: String(value),
    isEmpty: false,
    isValid: true,
  };
}
