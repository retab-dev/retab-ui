"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { cn } from "@/lib/utils";
import { getFixedGridRowStyle } from "@/components/ui/fixed-grid-row-style";
import {
  encodeJsonFormKey,
  joinJsonFormPath,
  joinJsonSourcePath,
} from "@/components/json-form-retab/path-codec";
import { useJsonFormReadOnly } from "@/components/json-form-retab/read-only";
import type { Column } from "@/components/json-form-retab/schema-model";
import type { ArrayTableActiveCellStore } from "@/components/json-form-retab/table/array-table-active-cell-store";
import { ArrayTableCell } from "@/components/json-form-retab/table/array-table-cell";
import { createArrayTableCellModel } from "@/components/json-form-retab/table/array-table-cell-model";
import { TABLE_ROW_HEIGHT } from "@/components/json-form-retab/table/array-table-config";

export const ArrayTableRow = React.memo(function ArrayTableRow({
  name,
  sourcePath,
  index,
  isLastRow,
  columns,
  remove,
  canRemove,
  sourceLinked,
  template,
  rowTopPx,
  activeCellStore,
}: {
  name: string;
  sourcePath: string;
  index: number;
  isLastRow: boolean;
  columns: Column[];
  remove: (index: number) => void;
  canRemove: boolean;
  sourceLinked: boolean;
  template: string;
  rowTopPx?: number;
  activeCellStore: ArrayTableActiveCellStore;
}) {
  const readOnly = useJsonFormReadOnly();
  const { control, getValues, setValue } = useFormContext();
  const rowPath = joinJsonFormPath(name, index);
  const rowSourcePath = joinJsonSourcePath(sourcePath, index);
  const watchedRowValue = useWatch({
    control,
    name: rowPath,
  }) as Record<string, unknown> | undefined;
  const rowValue = (watchedRowValue ?? getValues(rowPath)) as
    | Record<string, unknown>
    | undefined;
  const rowStyle = React.useMemo(
    () =>
      rowTopPx === undefined
        ? { gridTemplateColumns: template }
        : getFixedGridRowStyle({
            gridTemplate: template,
            rowHeight: TABLE_ROW_HEIGHT,
            top: rowTopPx,
          }),
    [rowTopPx, template],
  );
  const closeEditor = React.useCallback(
    () => activeCellStore.setActivePath(null),
    [activeCellStore],
  );

  return (
    <div
      data-index={index}
      className={cn(
        "hover:bg-muted/25 grid items-center gap-1 border-b px-2 py-1 [contain:layout_paint_style]",
        isLastRow && "border-b-0",
      )}
      style={rowStyle}
    >
      {columns.map((column) => {
        const path = joinJsonFormPath(rowPath, column.key);
        const value = rowValue?.[encodeJsonFormKey(column.key)];

        return (
          <ArrayTableCell
            key={column.key}
            model={createArrayTableCellModel({
              path,
              sourcePath: joinJsonSourcePath(rowSourcePath, column.key),
              column,
              value,
              sourceLinked,
            })}
            column={column}
            activeCellStore={activeCellStore}
            setValue={setValue}
            closeEditor={closeEditor}
          />
        );
      })}
      {readOnly ? null : (
        <button
          type="button"
          className="text-muted-foreground hover:border-border hover:text-destructive focus-visible:ring-ring flex size-8 items-center justify-center rounded-md border border-transparent text-base leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          onClick={() => remove(index)}
          aria-label="Remove row"
          disabled={!canRemove}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
});
