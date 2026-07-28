import { cn } from "@/lib/utils";
import type { ArrayTableCellModel } from "@/components/json-form-retab/table/array-table-cell-model";

export function arrayTableCellClassName({
  isEditing,
  model,
}: {
  isEditing: boolean;
  model: ArrayTableCellModel;
}): string {
  return cn(
    "min-w-0 rounded text-sm data-[source-active=true]:bg-primary/5 data-[source-active=true]:ring-1 data-[source-active=true]:ring-primary/30",
    !isEditing
      ? "hover:bg-background focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"
      : "px-1 py-0.5",
    model.sourceLinked && isEditing && "hover:bg-muted/55",
  );
}

export function arrayTableCellProps(
  model: ArrayTableCellModel,
  { isEditing = false }: { isEditing?: boolean } = {},
) {
  return {
    "data-slot": "data-cell",
    "data-table-cell": "",
    "data-source-path": model.sourceLinked ? model.sourcePath : undefined,
    className: arrayTableCellClassName({ isEditing, model }),
  };
}
