"use client";

import React, { useMemo, useState } from "react";
import { JSONSchema7 } from "json-schema";
import { TableDocument } from "@/components/json-table/lib/projects-types";
import {
  objectToTable2D,
  PathInfo,
} from "@/components/json-table/path-utils";
import {
  ColumnsFromSchema,
  flattenColumns,
} from "@/components/json-table/header-from-schema";
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table";
import {
  ColumnWidth,
  useSheetOptionsStore,
} from "@/components/json-table/table-options-store";
interface SingleFileTableViewProps {
  document: TableDocument;
  schema: JSONSchema7;
  setSchema?: (schema: JSONSchema7) => void; // Optional setter to enable schema editing (description, reasoning)
  columnWidth?: ColumnWidth;
  onUpdateDocument?: (patch: any) => Promise<void>;
  editMode?: "promptOnly" | "editable" | "readOnly";
  allowEditing?: boolean; // Controls whether cells can be edited
  onCellHoverStart?: (info: {
    docId: string;
    fieldPath: string;
    rect: DOMRect;
  }) => void;
  /** Direct callback for ground truth changes (used in reconciliation mode) */
  onGroundTruthChange?: (fieldPath: string, newValue: any) => void;
  /** Map from field paths to indication texts (for review) */
  fieldIndicationMap?: Map<string, string>;
  /** Rows to render beyond the viewport on each side (virtualization buffer). Default 12. */
  overscan?: number;
}

export const SingleFileTableView = React.memo<SingleFileTableViewProps>(
  ({
    document,
    schema,
    setSchema,
    columnWidth: propColumnWidth,
    onUpdateDocument,
    editMode = "editable",
    allowEditing = true,
    onCellHoverStart,
    onGroundTruthChange,
    fieldIndicationMap,
    overscan,
  }) => {
    const { columnWidth: storeColumnWidth } = useSheetOptionsStore();
    const columnWidth = propColumnWidth ?? storeColumnWidth;

    const [stopAt, setStopAt] = useState<string[]>([]);
    const [foldAllSignal, setFoldAllSignal] = useState(0);

    // Create refs for drag and drop (needed by ColumnsFromSchema)
    const draggedItemKeyRef = React.useRef<string | null>(null);
    const draggedItemParentPathRef = React.useRef<string | null>(null);

    // Generate columns from schema
    const [columns] = useMemo(() => {
      return ColumnsFromSchema(
        schema as any,
        setSchema ?? (() => {}), // Use provided setSchema or no-op
        stopAt,
        setStopAt,
        columnWidth,
        !setSchema, // is_published = true only if no setSchema (disables schema editing)
        draggedItemKeyRef,
        draggedItemParentPathRef,
        "single-file", // currentIterationId
        editMode,
      );
    }, [schema, setSchema, stopAt, columnWidth, editMode]);

    // Calculate visible keys
    const visibleKeys = useMemo(() => {
      return flattenColumns(columns)
        .map((c) =>
          "accessorKey" in c ? (c.accessorKey as string) : undefined,
        )
        .filter(Boolean) as string[];
    }, [columns]);

    // Convert document to 2D table format
    const tableAndPaths = useMemo(() => {
      if (!document) return { table: [], paths: [] };
      return objectToTable2D(document, visibleKeys, {
        includeArrayAddRows: editMode !== "readOnly",
      });
    }, [document, visibleKeys, editMode]);

    const rowCount = Math.max(tableAndPaths.paths.length, 1);

    return (
      <div className="relative flex min-h-0 w-full flex-1 flex-col">
        <div
          className="absolute inset-0 flex origin-top-left flex-col"
          //style={{ transform: 'scale(0.8)', width: '125%', height: '125%' }}
          //  style={{ transform: 'scale(0.85)', width: '117.64705882352942%', height: '117.64705882352942%' }}
        >
          <SingleFileVirtualizedTable
            stopAt={stopAt}
            setStopAt={setStopAt}
            foldAllSignal={foldAllSignal}
            setFoldAllSignal={setFoldAllSignal}
            columns={columns}
            document={document}
            schema={schema}
            tableAndPaths={tableAndPaths}
            visibleKeys={visibleKeys}
            rowCount={rowCount}
            onUpdateDocument={onUpdateDocument}
            editMode={editMode}
            allowEditing={allowEditing}
            onCellHoverStart={onCellHoverStart}
            onGroundTruthChange={onGroundTruthChange}
            fieldIndicationMap={fieldIndicationMap}
            overscan={overscan}
          />
        </div>
      </div>
    );
  },
);
SingleFileTableView.displayName = "SingleFileTableView";
