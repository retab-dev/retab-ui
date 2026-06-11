"use client";

import React from "react";
import { JSONSchema7 } from "json-schema";
import { TableRow } from "@/components/ui-retab/table";
import type {
  RowLike,
  TableColumn,
} from "@/components/json-table/lib/column-types";
import { TableDocument } from "@/components/json-table/lib/projects-types";
import { PathInfo } from "@/components/json-table/path-utils";
import { DataCell } from "@/components/json-table/data-cell";
import {
  getRowHeightPx,
  useSheetOptionsStore,
} from "@/components/json-table/table-options-store";
import { getTheme } from "@/components/json-table/lib/themes";

// Stable reference so DataCell's React.memo isn't broken by a fresh `{}` each
// render. There are no per-cell validation flags in the single-file table.
const EMPTY_VALIDATION_FLAGS: Record<string, never> = {};

interface SingleFileFormRowProps {
  row: RowLike;
  columns: TableColumn[];
  schema: JSONSchema7;
  tableAndPaths: { table: unknown[][]; paths: (PathInfo | undefined)[][] };
  visibleKeys: string[];
  rowCount: number;
  /** Which sub-row of the document this renders (set by the row virtualizer). */
  rowIdx: number;
  /** Which object/array cell's inline editor popover is open (by field key). */
  openPopover: string | null;
  setOpenPopover: (key: string | null) => void;
  onUpdateDocument?: (patch: any) => Promise<void>;
  editMode: "promptOnly" | "editable" | "readOnly";
  allowEditing?: boolean;
  onCellHoverStart?: (info: {
    docId: string;
    fieldPath: string;
    rect: DOMRect;
  }) => void;
  onCellHoverEnd?: () => void;
  fieldIndicationMap?: Map<string, string>;
  fieldReasoningMap?: Map<string, string>;
}

export const SingleFileFormRow = React.memo<SingleFileFormRowProps>(
  ({
    row,
    columns,
    schema,
    tableAndPaths,
    visibleKeys,
    rowCount,
    rowIdx,
    openPopover,
    setOpenPopover,
    onUpdateDocument,
    editMode,
    allowEditing = true,
    onCellHoverStart,
    onCellHoverEnd,
    fieldIndicationMap,
    fieldReasoningMap,
  }) => {
    const { rowHeight, columnWidth } = useSheetOptionsStore();
    const theme = getTheme("single-file");

    const { table: _table, paths } = tableAndPaths;
    const documentId = row.original.id;

    // Stable callback identity so DataCell's React.memo holds across the
    // parent's per-scroll re-renders.
    const handleDataChange = React.useCallback(
      async (_docId: string, value: any) => {
        if (onUpdateDocument) {
          await onUpdateDocument({ prediction_data: { prediction: value } });
        }
      },
      [onUpdateDocument],
    );

    // Render a single sub-row (one of the document's `rowCount` rows). Which
    // rows are mounted is decided by the row virtualizer in the parent.
    const rowHeightPx = getRowHeightPx(rowHeight);
    // Compute the absolute-positioning style here (not in the parent) and
    // memoize it on the only inputs that matter. Passing a fresh `style` object
    // down on every scroll frame was breaking this row's React.memo, forcing
    // every mounted row to re-render. `contain` scopes style/layout recalc to
    // the row so a single row entering/leaving can't invalidate its siblings.
    const rowStyle = React.useMemo<React.CSSProperties>(
      () => ({
        position: "absolute",
        top: 0,
        left: 0,
        transform: `translateY(${rowIdx * rowHeightPx}px)`,
        height: `${rowHeightPx}px`,
        minHeight: `${rowHeightPx}px`,
        minWidth: "100%",
        contain: "layout style",
      }),
      [rowIdx, rowHeightPx],
    );
    return (
      <TableRow
        data-index={rowIdx}
        className={`flex border-b-0 ${theme.border} ${theme.tableRowBg} w-full`}
        style={rowStyle}
      >
        {/* Data cells */}
        {visibleKeys.map((key, colIdx) => {
          const pathInfo = paths[rowIdx]?.[colIdx];

          return (
            <DataCell
              key={key}
              keyValue={key}
              rowIdx={rowIdx}
              pathInfo={pathInfo}
              schema={schema}
              row={row}
              docId={documentId}
              columnWidth={columnWidth}
              setOpenPopover={setOpenPopover}
              openPopover={openPopover}
              onGroundTruthDataChange={handleDataChange}
              currentIterationId="single-file"
              validationFlags={EMPTY_VALIDATION_FLAGS}
              allowEditing={allowEditing}
              onCellHoverStart={onCellHoverStart}
              onCellHoverEnd={onCellHoverEnd}
              fieldIndicationMap={fieldIndicationMap}
              fieldReasoningMap={fieldReasoningMap}
            />
          );
        })}
      </TableRow>
    );
  },
);
SingleFileFormRow.displayName = "SingleFileFormRow";
