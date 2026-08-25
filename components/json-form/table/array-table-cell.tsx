"use client";

import * as React from "react";

import { DataCell } from "@/components/ui/data-cell";
import { useJsonFormReadOnly } from "@/components/json-form/read-only";
import type { Column } from "@/components/json-form/schema-model";
import {
  useArrayTableCellActive,
  type ArrayTableActiveCellStore,
} from "@/components/json-form/table/array-table-active-cell-store";
import {
  commitArrayTableCellValue,
  type CommitArrayTableCellValue,
  type SetArrayTableCellValue,
} from "@/components/json-form/table/array-table-cell-commit";
import { createArrayTableDataCellProps } from "@/components/json-form/table/array-table-data-cell-props";
import type { ArrayTableCellModel } from "@/components/json-form/table/array-table-cell-model";

function ArrayTableCellContent({
  model,
  column,
  activeCellStore,
  setValue,
  closeEditor,
}: {
  model: ArrayTableCellModel;
  column: Column;
  activeCellStore: ArrayTableActiveCellStore;
  setValue: SetArrayTableCellValue;
  closeEditor: () => void;
}) {
  const readOnly = useJsonFormReadOnly();
  const isEditing = useArrayTableCellActive(activeCellStore, model.path);
  const commitValue = React.useCallback<CommitArrayTableCellValue>(
    (nextValue, meta) => {
      commitArrayTableCellValue({
        column,
        currentValue: model.value,
        meta,
        nextValue,
        path: model.path,
        setValue,
      });
    },
    [column, model.path, model.value, setValue],
  );

  return (
    <DataCell
      {...createArrayTableDataCellProps({
        column,
        commitValue,
        isEditing,
        model,
        onEditingEnd: closeEditor,
        readOnly,
      })}
    />
  );
}

export const ArrayTableCell = React.memo(
  ArrayTableCellContent,
  (previous, next) =>
    previous.model.path === next.model.path &&
    previous.model.sourcePath === next.model.sourcePath &&
    previous.model.label === next.model.label &&
    previous.model.displayText === next.model.displayText &&
    previous.model.kind === next.model.kind &&
    Object.is(previous.model.value, next.model.value) &&
    previous.model.isEnum === next.model.isEnum &&
    previous.model.sourceLinked === next.model.sourceLinked &&
    previous.column === next.column &&
    previous.activeCellStore === next.activeCellStore &&
    previous.setValue === next.setValue &&
    previous.closeEditor === next.closeEditor,
);
ArrayTableCell.displayName = "ArrayTableCell";
