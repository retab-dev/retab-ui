"use client";

import * as React from "react";

import { getFixedGridCanvasStyle } from "@/components/ui/fixed-grid-layout";
import { WithDescription } from "@/components/json-form-retab/disclosure";
import {
  labelFor,
  type Column,
} from "@/components/json-form-retab/schema-model";
import { useSourceLinkedTableCells } from "@/components/json-form-retab/source-link";
import {
  createArrayTableActiveCellStore,
  type ArrayTableActiveCellStore,
} from "@/components/json-form-retab/table/array-table-active-cell-store";
import {
  FixedArrayTableBody,
  StaticArrayTableBody,
} from "@/components/json-form-retab/table/array-table-body";
import {
  TABLE_SCROLL_THRESHOLD,
  TABLE_VIRTUALIZE_THRESHOLD,
} from "@/components/json-form-retab/table/array-table-config";
import { ArrayTableRow } from "@/components/json-form-retab/table/array-table-row";

export function ArrayTable({
  name,
  sourcePath,
  fields,
  remove,
  canRemove,
  columns,
}: {
  name: string;
  sourcePath: string;
  fields: { id: string }[];
  remove: (index: number) => void;
  canRemove: boolean;
  columns: Column[];
}) {
  const template = `${columns.map(() => "minmax(9rem, 1fr)").join(" ")} 2.25rem`;
  const minWidth = columns.length * 150 + 36;
  const activeCellStoreRef = React.useRef<ArrayTableActiveCellStore | null>(
    null,
  );
  if (!activeCellStoreRef.current) {
    activeCellStoreRef.current = createArrayTableActiveCellStore();
  }
  const activeCellStore = activeCellStoreRef.current;
  const tableRef = React.useRef<HTMLDivElement>(null);
  const sourceTable = useSourceLinkedTableCells({
    tableRef,
    refreshKey: fields.length,
  });
  const sourceLinked = sourceTable.sourceLinked;
  const virtualize = fields.length > TABLE_VIRTUALIZE_THRESHOLD;
  const scrollHandlers = React.useMemo(
    () => ({
      onScrollStart: sourceTable.handleScrollStart,
      onScrollMove: sourceTable.handleScrollMove,
      onScrollEnd: sourceTable.handleScrollEnd,
    }),
    [sourceTable],
  );

  const handleTableClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const table = tableRef.current;
      const activeElement = table?.ownerDocument.activeElement;
      if (
        !(activeElement instanceof HTMLElement) ||
        activeElement.dataset.tableCellEditor !== "true" ||
        !table?.contains(activeElement) ||
        activeElement === event.target ||
        activeElement.contains(event.target as Node)
      ) {
        return;
      }
      activeElement.blur();
    },
    [],
  );

  const handleTableClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const cell = sourceTable.getCellFromTarget(event.target);
      if (!cell) return;
      sourceTable.selectCellSource(cell);
      if (cell.dataset.tableCellEditable !== "true") return;
      const path = cell.dataset.tableCellPath;
      if (path) activeCellStore.setActivePath(path);
    },
    [activeCellStore, sourceTable],
  );

  const handleTableKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const cell = sourceTable.getCellFromTarget(event.target);
      if (!cell || cell.dataset.tableCellEditable !== "true") return;
      const path = cell.dataset.tableCellPath;
      if (!path) return;
      sourceTable.selectCellSource(cell);
      event.preventDefault();
      activeCellStore.setActivePath(path);
    },
    [activeCellStore, sourceTable],
  );

  const renderRow = React.useCallback(
    (index: number, rowTopPx?: number) => (
      <ArrayTableRow
        name={name}
        sourcePath={sourcePath}
        index={index}
        isLastRow={index === fields.length - 1}
        columns={columns}
        remove={remove}
        canRemove={canRemove}
        sourceLinked={sourceLinked}
        template={template}
        rowTopPx={rowTopPx}
        activeCellStore={activeCellStore}
      />
    ),
    [
      activeCellStore,
      name,
      sourcePath,
      fields.length,
      columns,
      remove,
      canRemove,
      sourceLinked,
      template,
    ],
  );

  return (
    <div
      ref={tableRef}
      onClickCapture={handleTableClickCapture}
      onClick={handleTableClick}
      onKeyDown={handleTableKeyDown}
      onPointerMove={sourceLinked ? sourceTable.handlePointerMove : undefined}
      onPointerLeave={sourceLinked ? sourceTable.handlePointerLeave : undefined}
      onFocus={sourceTable.handleFocus}
      onBlur={sourceTable.handleBlur}
      className="bg-background overflow-x-auto"
    >
      <div style={getFixedGridCanvasStyle({ minWidth })}>
        <div
          className="bg-muted/35 grid h-9 items-center gap-1 border-b px-2"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((column) => (
            <div
              key={column.key}
              className="text-muted-foreground flex min-w-0 items-center gap-1 px-2 text-xs font-medium"
            >
              <WithDescription text={column.schema.description}>
                <span className="truncate">
                  {labelFor(column.key, column.schema)}
                </span>
              </WithDescription>
              {column.required ? (
                <span className="text-destructive">*</span>
              ) : null}
            </div>
          ))}
          <span className="sr-only">Actions</span>
        </div>
        {virtualize ? (
          <FixedArrayTableBody
            fields={fields}
            scrollHandlers={scrollHandlers}
            renderItem={renderRow}
          />
        ) : fields.length > TABLE_SCROLL_THRESHOLD ? (
          <StaticArrayTableBody
            fields={fields}
            scrollHandlers={scrollHandlers}
            renderItem={renderRow}
          />
        ) : (
          <div>
            {fields.map((entry, index) => (
              <React.Fragment key={entry.id}>{renderRow(index)}</React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
