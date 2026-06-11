"use client";

import React, { useMemo, useState, useRef } from "react";
import { JSONSchema7 } from "json-schema";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-retab/table";
import {
  buildHeaderRows,
  getLeafColumns,
  type TableColumn,
} from "@/components/json-table/lib/column-types";
import { TableDocument } from "@/components/json-table/lib/projects-types";
import { PathInfo } from "./path-utils";
import { SingleFileFormRow } from "./single-file-form-row";
import {
  getColumnWidthPx,
  getRowHeightPx,
  useSheetOptionsStore,
} from "./table-options-store";
import { getTheme } from "@/components/json-table/lib/themes";
import { HoverInfoContext, HoverInfo } from "./hover-info-context";
import { useFixedRowWindow } from "./lib/use-fixed-row-window";

interface SingleFileVirtualizedTableProps {
  stopAt: string[];
  setStopAt: React.Dispatch<React.SetStateAction<string[]>>;
  foldAllSignal: number;
  setFoldAllSignal: React.Dispatch<React.SetStateAction<number>>;
  columns: TableColumn[];
  document: TableDocument;
  schema: JSONSchema7;
  tableAndPaths: { table: unknown[][]; paths: (PathInfo | undefined)[][] };
  visibleKeys: string[];
  rowCount: number;
  onUpdateDocument?: (patch: any) => Promise<void>;
  editMode: "promptOnly" | "editable" | "readOnly";
  allowEditing?: boolean;
  onCellHoverStart?: (info: {
    docId: string;
    fieldPath: string;
    rect: DOMRect;
  }) => void;
  /** Direct callback for ground truth changes (used in reconciliation mode) */
  onGroundTruthChange?: (fieldPath: string, newValue: any) => void;
  /** Map from field paths to indication texts (for review) */
  fieldIndicationMap?: Map<string, string>;
  /** Map from field paths to reasoning texts extracted from data (for review) */
  fieldReasoningMap?: Map<string, string>;
  /** Rows to render beyond the viewport on each side (virtualization buffer). Default 12. */
  overscan?: number;
}

const SingleFileTableHeader = React.memo(
  ({
    columns,
    columnWidth,
  }: {
    columns: TableColumn[];
    columnWidth: any;
  }) => {
    const theme = getTheme("single-extraction");
    // Header rows derived straight from the column tree: each group spans its
    // leaves; leaves leave empty placeholder cells in the rows beneath them so
    // columns stay aligned. (This is what TanStack's getHeaderGroups produced.)
    const headerRows = buildHeaderRows(columns);

    return (
      <TableHeader className={`sticky top-0 z-10 ${theme.headerBg}`}>
        {headerRows.map((cells, rowIdx) => (
          <TableRow
            key={rowIdx}
            className={`flex w-max min-w-full ${theme.subHeaderBg} border-b ${theme.border}`}
          >
            {cells.map((cell, cellIdx) => {
              const width = cell.leafCount * getColumnWidthPx(columnWidth);

              if (cell.placeholder) {
                return (
                  <th
                    key={cellIdx}
                    className={`shrink-0 ${theme.subHeaderBg} text-3xs ${theme.headerText} border-r last:border-r-0 ${theme.border}`}
                    style={{ width: `${width}px`, minWidth: `${width}px` }}
                  />
                );
              }

              return (
                <TableHead
                  key={cellIdx}
                  className={`shrink-0 ${theme.headerBg} ${theme.headerText} m-0 border-r p-0 last:border-r-0 ${theme.border}`}
                  style={{
                    width: `${width}px`,
                    minWidth: `${width}px`,
                    height: "38px",
                  }}
                  colSpan={cell.colSpan}
                >
                  {cell.col.header?.({
                    column: { getLeafColumns: () => getLeafColumns(cell.col) },
                  })}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
    );
  },
);
SingleFileTableHeader.displayName = "SingleFileTableHeader";

export const SingleFileVirtualizedTable =
  React.memo<SingleFileVirtualizedTableProps>(
    ({
      stopAt,
      setStopAt,
      foldAllSignal,
      setFoldAllSignal,
      columns,
      document,
      schema,
      tableAndPaths,
      visibleKeys,
      rowCount,
      onUpdateDocument,
      editMode,
      allowEditing = true,
      onCellHoverStart,
      onGroundTruthChange,
      fieldIndicationMap,
      fieldReasoningMap,
      overscan = 12,
    }) => {

      const { rowHeight, columnWidth } = useSheetOptionsStore();
      const theme = getTheme("single-file");

      // Add hover info state for DataCell hover functionality
      const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

      // Which object/array cell has its inline editor popover open (by field
      // key). Held at the table level so it survives row virtualization.
      const [openPopover, setOpenPopover] = useState<string | null>(null);

      // Cells read the document via `row.original` — that's all the old
      // TanStack row gave them, so a one-field wrapper is the whole "row model".
      const docRow = useMemo(() => ({ original: document }), [document]);

      const totalWidth = visibleKeys.length * getColumnWidthPx(columnWidth);

      // ── Row virtualization ──────────────────────────────────────────────
      // Rows are a fixed height, so the visible window is plain arithmetic — no
      // per-row measurement, no library. The header lives in its own bar
      // *outside* this scroll container (so `top` is just `index * rowHeight`,
      // no scroll-margin offset to correct for), and each mounted row is
      // absolutely positioned inside a spacer of the full list height.
      const rowHeightPx = getRowHeightPx(rowHeight);
      const scrollRef = useRef<HTMLDivElement>(null);
      const headerScrollRef = useRef<HTMLDivElement>(null);
      const bodyRef = useRef<HTMLTableSectionElement>(null);
      // `ready` gates the first paint: the window is unknown until the viewport
      // is measured in a layout effect, which keeps SSR (zero rows) and the
      // first client render in sync, then fills in before the browser paints.
      const { start, end, totalHeight, ready } = useFixedRowWindow({
        scrollRef,
        rowCount,
        rowHeight: rowHeightPx,
        overscan,
      });

      return (
        <HoverInfoContext.Provider value={{ hoverInfo, setHoverInfo }}>
          <div
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${theme.tableContainerBg}`}
          >
            {/* Header: a fixed, opaque bar outside the vertical scroll. It
                scrolls horizontally in sync with the body so columns stay
                aligned, while rows scroll underneath it. A sticky header
                inside the transformed/virtualized body shows rows through it
                (transforms break sticky) — the CSV viewer uses the same
                separated-header approach. */}
            <div
              ref={headerScrollRef}
              className={`w-full shrink-0 overflow-x-hidden ${theme.headerBg}`}
            >
              <Table
                className={`relative flex w-full flex-col rounded-none ${theme.headerBg}`}
                style={{ minWidth: `${totalWidth}px` }}
              >
                <SingleFileTableHeader
                  columnWidth={columnWidth}
                  columns={columns}
                />
              </Table>
            </div>
            <div
              ref={scrollRef}
              className="w-full flex-1 overflow-auto"
              onScroll={(e) => {
                if (headerScrollRef.current) {
                  headerScrollRef.current.scrollLeft =
                    e.currentTarget.scrollLeft;
                }
              }}
            >
              <Table
                className={`relative flex w-full flex-col rounded-none ${theme.tableContainerBg}`}
                style={{
                  minWidth: `${totalWidth}px`,
                }}
              >
                <TableBody
                  ref={bodyRef}
                  className={`relative w-full ${theme.tableContainerBg}`}
                  style={{
                    height: `${totalHeight}px`,
                    minWidth: "100%",
                  }}
                >
                  {ready && docRow
                    ? Array.from({ length: end - start }, (_, i) => {
                        // One DOM row per row in the visible window, keyed by row
                        // index: rows mount/unmount as they enter/leave. Each row's
                        // props are memoized on primitives, so rows that stay put
                        // are skipped by React.memo.
                        const rowIdx = start + i;
                        return (
                        <SingleFileFormRow
                          key={rowIdx}
                          rowIdx={rowIdx}
                          row={docRow}
                          tableAndPaths={tableAndPaths}
                          columns={columns}
                          schema={schema}
                          visibleKeys={visibleKeys}
                          rowCount={rowCount}
                          openPopover={openPopover}
                          setOpenPopover={setOpenPopover}
                          onUpdateDocument={onUpdateDocument}
                          editMode={editMode}
                          allowEditing={allowEditing}
                          onCellHoverStart={onCellHoverStart}
                          fieldIndicationMap={fieldIndicationMap}
                          fieldReasoningMap={fieldReasoningMap}
                        />
                        );
                      })
                    : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </HoverInfoContext.Provider>
      );
    },
  );
SingleFileVirtualizedTable.displayName = "SingleFileVirtualizedTable";
