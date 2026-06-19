import { cn } from "@/lib/utils";
import type { CommitArrayTableCellValue } from "@/components/json-form/table/array-table-cell-commit";
import type { ArrayTableCellModel } from "@/components/json-form/table/array-table-cell-model";

export function arrayTableCellClassName(model: ArrayTableCellModel): string {
  return cn(
    "min-w-0 rounded data-[source-active=true]:bg-primary/5 data-[source-active=true]:ring-1 data-[source-active=true]:ring-primary/30",
    !model.isEditing && !model.isScalarEditing
      ? "hover:bg-background focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"
      : "px-1 py-0.5",
    model.sourceLinked &&
      (model.isEditing || model.isScalarEditing) &&
      "hover:bg-muted/55",
  );
}

export function arrayTableCellProps(model: ArrayTableCellModel) {
  return {
    "data-slot": "data-cell",
    "data-table-cell": "",
    "data-source-path": model.sourceLinked ? model.sourcePath : undefined,
    className: arrayTableCellClassName(model),
  };
}

export function editableArrayTableCellProps({
  closeEditor,
  commitValue,
  model,
}: {
  closeEditor: () => void;
  commitValue: CommitArrayTableCellValue;
  model: ArrayTableCellModel;
}) {
  return {
    active: model.isScalarEditing,
    editable: model.isScalarEditing,
    role: !model.isScalarEditing ? "button" : undefined,
    "aria-label": `${model.label} ${model.displayText}`,
    tabIndex: 0,
    "data-table-cell-editable": !model.isScalarEditing ? "true" : undefined,
    "data-table-cell-path": !model.isScalarEditing ? model.path : undefined,
    autoFocus: model.isScalarEditing,
    name: model.path,
    onCommit: commitValue,
    "data-table-cell-editor": model.isScalarEditing ? "true" : undefined,
    onBlur: () => {
      if (model.isScalarEditing) closeEditor();
    },
  };
}
