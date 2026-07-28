import {
  labelFor,
  type Column,
} from "@/components/json-form-retab/schema-model";
import {
  dataCellKindForColumn,
  formatArrayTableCellValue,
  type ArrayTableDataCellKind,
} from "@/components/json-form-retab/table/array-table-format";

export type ArrayTableCellModel = {
  path: string;
  sourcePath: string;
  label: string;
  displayText: string;
  kind: ArrayTableDataCellKind;
  value: unknown;
  isEnum: boolean;
  sourceLinked: boolean;
};

export function createArrayTableCellModel({
  path,
  sourcePath,
  column,
  value,
  sourceLinked,
}: {
  path: string;
  sourcePath: string;
  column: Column;
  value: unknown;
  sourceLinked: boolean;
}): ArrayTableCellModel {
  const isEnum = column.kind === "enum";

  return {
    path,
    sourcePath,
    label: labelFor(column.key, column.schema),
    displayText: formatArrayTableCellValue({ value, column }),
    kind: dataCellKindForColumn(column),
    value,
    isEnum,
    sourceLinked,
  };
}
