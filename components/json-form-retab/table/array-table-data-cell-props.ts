import type {
  DataCellProps,
  DataCellSelectOption,
} from "@/components/ui/data-cell";
import {
  dataCellNumberValue,
  dataCellTextValue,
  enumLabel,
  enumValueEquals,
} from "@/components/json-form-retab/scalar-control";
import { NULL_SELECT_VALUE } from "@/components/json-form-retab/scalar/enum-control";
import type { Column } from "@/components/json-form-retab/schema-model";
import type { CommitArrayTableCellValue } from "@/components/json-form-retab/table/array-table-cell-commit";
import type { ArrayTableCellModel } from "@/components/json-form-retab/table/array-table-cell-model";
import { arrayTableCellProps } from "@/components/json-form-retab/table/array-table-cell-props";

type ArrayTableDataCellSharedProps = {
  active: boolean;
  autoFocus: boolean;
  editable: boolean;
  name: string;
  onCommit: CommitArrayTableCellValue;
  onEditingEnd: () => void;
  role?: "button";
  tabIndex: 0;
  "aria-label": string;
  "data-table-cell-editable"?: "true";
  "data-table-cell-editor"?: "true";
  "data-table-cell-path"?: string;
};

export function createArrayTableDataCellProps({
  column,
  commitValue,
  isEditing,
  model,
  onEditingEnd,
}: {
  column: Column;
  commitValue: CommitArrayTableCellValue;
  isEditing: boolean;
  model: ArrayTableCellModel;
  onEditingEnd: () => void;
}): DataCellProps {
  const sharedProps = arrayTableDataCellSharedProps({
    commitValue,
    isEditing,
    model,
    onEditingEnd,
  });

  if (column.kind === "enum") {
    return arrayTableSelectDataCellProps({
      column,
      commitValue,
      model,
      sharedProps,
    });
  }

  if (model.kind === "number" || model.kind === "integer") {
    return {
      ...arrayTableCellProps(model, { isEditing }),
      ...sharedProps,
      kind: model.kind,
      value: dataCellNumberValue(model.value),
      formatValue: () => model.displayText,
      placeholder: "",
    };
  }

  if (model.kind === "boolean") {
    return {
      ...arrayTableCellProps(model, { isEditing }),
      ...sharedProps,
      kind: "boolean",
      value:
        model.value === null || model.value === undefined
          ? null
          : Boolean(model.value),
    };
  }

  if (model.kind === "date") {
    return {
      ...arrayTableCellProps(model, { isEditing }),
      ...sharedProps,
      kind: "date",
      value: dataCellTextValue(model.value),
      formatValue: () => model.displayText,
      placeholder: "",
    };
  }

  if (model.kind === "time") {
    return {
      ...arrayTableCellProps(model, { isEditing }),
      ...sharedProps,
      kind: "time",
      value: dataCellTextValue(model.value),
      formatValue: () => model.displayText,
      placeholder: "",
    };
  }

  if (model.kind === "date-time") {
    return {
      ...arrayTableCellProps(model, { isEditing }),
      ...sharedProps,
      kind: "date-time",
      value: dataCellTextValue(model.value),
      formatValue: () => model.displayText,
      placeholder: "",
    };
  }

  return {
    ...arrayTableCellProps(model, { isEditing }),
    ...sharedProps,
    kind: "text",
    value: dataCellTextValue(model.value),
    formatValue: () => model.displayText,
    placeholder: "",
  };
}

function arrayTableDataCellSharedProps({
  commitValue,
  isEditing,
  model,
  onEditingEnd,
}: {
  commitValue: CommitArrayTableCellValue;
  isEditing: boolean;
  model: ArrayTableCellModel;
  onEditingEnd: () => void;
}): ArrayTableDataCellSharedProps {
  return {
    active: isEditing,
    editable: isEditing,
    autoFocus: isEditing,
    name: model.path,
    onCommit: commitValue,
    onEditingEnd,
    role: isEditing ? undefined : "button",
    tabIndex: 0,
    "aria-label": `${model.label} ${model.displayText}`,
    "data-table-cell-editable": isEditing ? undefined : "true",
    "data-table-cell-editor": isEditing ? "true" : undefined,
    "data-table-cell-path": isEditing ? undefined : model.path,
  };
}

function arrayTableSelectDataCellProps({
  column,
  commitValue,
  model,
  sharedProps,
}: {
  column: Column;
  commitValue: CommitArrayTableCellValue;
  model: ArrayTableCellModel;
  sharedProps: ArrayTableDataCellSharedProps;
}): DataCellProps {
  return {
    ...arrayTableCellProps(model, { isEditing: sharedProps.active }),
    ...sharedProps,
    kind: "select",
    value: arrayTableSelectValue({
      column,
      value: model.value,
    }),
    selectOptions: arrayTableSelectOptions(column),
    placeholder: "Select...",
    formatValue: () => model.displayText,
    onCommit: (value, meta) => {
      commitValue(
        arrayTableSelectCommitValue({
          column,
          value,
        }),
        meta,
      );
    },
  };
}

function enumOptionValue(index: number): string {
  return `enum:${index}`;
}

function arrayTableSelectOptions(column: Column): DataCellSelectOption[] {
  const enumValues = column.schema.enum ?? [];
  const hasNullEnumValue = enumValues.some((value) => value === null);
  const nullableOptions: DataCellSelectOption[] =
    column.nullable && !hasNullEnumValue
      ? [{ value: NULL_SELECT_VALUE, label: "No value" }]
      : [];

  return [
    ...nullableOptions,
    ...enumValues.map((value, index) => ({
      value: enumOptionValue(index),
      label: enumLabel(value),
    })),
  ];
}

function arrayTableSelectValue({
  column,
  value,
}: {
  column: Column;
  value: unknown;
}): string | null {
  const enumIndex =
    column.schema.enum?.findIndex((candidate) =>
      enumValueEquals(candidate, value),
    ) ?? -1;

  if (enumIndex >= 0) return enumOptionValue(enumIndex);
  if (value === null && column.nullable) return NULL_SELECT_VALUE;
  return null;
}

function arrayTableSelectCommitValue({
  column,
  value,
}: {
  column: Column;
  value: string | null;
}): unknown {
  if (value === NULL_SELECT_VALUE || value === null) return null;
  const match = value.match(/^enum:(\d+)$/);
  if (!match) return undefined;
  return column.schema.enum?.[Number(match[1])];
}
