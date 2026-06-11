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
  /** False when this recycled slot has no row in the current window (hidden). */
  active: boolean;
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
  cellColorState?: "none" | "consensus" | "similarity" | "mismatch";
  distanceData?: any;
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
    active,
    openPopover,
    setOpenPopover,
    onUpdateDocument,
    editMode,
    allowEditing = true,
    onCellHoverStart,
    onCellHoverEnd,
    cellColorState = "none",
    distanceData,
    fieldIndicationMap,
    fieldReasoningMap,
  }) => {
    const prevPropsRef = React.useRef<any>(null);

    // Log what changed
    if (prevPropsRef.current) {
      const changes: string[] = [];
      if (prevPropsRef.current.row !== row) changes.push("row");
      if (prevPropsRef.current.columns !== columns) changes.push("columns");
      if (prevPropsRef.current.schema !== schema) changes.push("schema");
      if (prevPropsRef.current.tableAndPaths !== tableAndPaths)
        changes.push("tableAndPaths");
      if (prevPropsRef.current.visibleKeys !== visibleKeys)
        changes.push("visibleKeys");
      if (prevPropsRef.current.rowCount !== rowCount) changes.push("rowCount");
      if (prevPropsRef.current.onUpdateDocument !== onUpdateDocument)
        changes.push("onUpdateDocument");
      if (prevPropsRef.current.editMode !== editMode) changes.push("editMode");

      // console.log('[SingleFileFormRow] Rendering - Props that changed:', changes, { documentId: row.original.id, rowCount });
    } else {
      // console.log('[SingleFileFormRow] Rendering - Initial render', { documentId: row.original.id, rowCount });
    }

    prevPropsRef.current = {
      row,
      columns,
      schema,
      tableAndPaths,
      visibleKeys,
      rowCount,
      onUpdateDocument,
      editMode,
    };

    // console.log('[SingleFileFormRow] Rendering', { documentId: row.original.id, rowCount });

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
        // Recycled slot with no row in the current window: keep the node (and
        // its cell subtree) mounted for reuse, just don't paint or lay it out.
        display: active ? undefined : "none",
      }),
      [rowIdx, rowHeightPx, active],
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
              colIdx={colIdx}
              pathInfo={pathInfo}
              schema={schema}
              row={row}
              index={0}
              docId={documentId}
              cellColorState={cellColorState}
              columnWidth={columnWidth}
              setOpenPopover={setOpenPopover}
              openPopover={openPopover}
              onGroundTruthDataChange={handleDataChange}
              currentIterationId="single-file"
              similarityType="aligned"
              validationFlags={EMPTY_VALIDATION_FLAGS}
              allowEditing={allowEditing}
              onCellHoverStart={onCellHoverStart}
              onCellHoverEnd={onCellHoverEnd}
              rowDistanceData={distanceData}
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
