"use client";

import React from "react";
import { JSONSchema7 } from "json-schema";
import { Row, ColumnDef } from "@tanstack/react-table";
import { TableRow } from "@/components/ui-retab/table";
import { TableDocument } from "@/components/json-table/lib/projects-types";
import { PathInfo } from "@/components/json-table/path-utils";
import { DataCell } from "@/components/json-table/data-cell";
import {
  getRowHeightPx,
  useSheetOptionsStore,
} from "@/components/json-table/table-options-store";
import { getTheme } from "@/components/json-table/lib/themes";

interface SingleFileFormRowProps {
  row: Row<TableDocument>;
  columns: ColumnDef<TableDocument>[];
  schema: JSONSchema7;
  tableAndPaths: { table: unknown[][]; paths: (PathInfo | undefined)[][] };
  visibleKeys: string[];
  rowCount: number;
  /** Which sub-row of the document this renders (set by the row virtualizer). */
  rowIdx: number;
  /** Absolute-positioning style from the virtualizer (translateY/height). */
  style?: React.CSSProperties;
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
    style,
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

    const handleDataChange = async (docId: string, value: any) => {
      console.log("[SingleFileFormRow] handleDataChange called", {
        docId,
        value,
      });
      if (onUpdateDocument) {
        console.log("[SingleFileFormRow] Calling onUpdateDocument");
        await onUpdateDocument({ prediction_data: { prediction: value } });
      }
    };

    // Render a single sub-row (one of the document's `rowCount` rows). Which
    // rows are mounted is decided by the row virtualizer in the parent.
    const rowHeightPx = getRowHeightPx(rowHeight);
    return (
      <TableRow
        data-index={rowIdx}
        className={`flex border-b-0 ${theme.border} ${theme.tableRowBg} w-full`}
        style={{
          height: `${rowHeightPx}px`,
          minHeight: `${rowHeightPx}px`,
          minWidth: "100%",
          ...style,
        }}
      >
        {/* Data cells */}
        {visibleKeys.map((key, colIdx) => {
          const pathInfo = paths[rowIdx]?.[colIdx];

          return (
            <DataCell
              key={`${key}-${rowIdx}`}
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
              validationFlags={{}}
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
