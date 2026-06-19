import { labelFor, type Column } from "@/components/json-form/schema-model";
import {
  dataCellKindForColumn,
  formatArrayTableCellValue,
  type ArrayTableDataCellKind,
} from "@/components/json-form/table/array-table-format";

export type ArrayTableCellModel = {
  path: string;
  sourcePath: string;
  label: string;
  displayText: string;
  kind: ArrayTableDataCellKind;
  value: unknown;
  isEnum: boolean;
  isEditing: boolean;
  isScalarEditing: boolean;
  sourceLinked: boolean;
};

export function createArrayTableCellModel({
  path,
  sourcePath,
  column,
  value,
  activeEditorPath,
  sourceLinked,
}: {
  path: string;
  sourcePath: string;
  column: Column;
  value: unknown;
  activeEditorPath: string | null;
  sourceLinked: boolean;
}): ArrayTableCellModel {
  const isEnum = column.kind === "enum";
  const isActiveEditor = activeEditorPath === path;

  return {
    path,
    sourcePath,
    label: labelFor(column.key, column.schema),
    displayText: formatArrayTableCellValue({ value, column }),
    kind: dataCellKindForColumn(column),
    value,
    isEnum,
    isEditing: isEnum && isActiveEditor,
    isScalarEditing: !isEnum && isActiveEditor,
    sourceLinked,
  };
}
