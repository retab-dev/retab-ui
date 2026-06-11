"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { HoverCardPortalContext } from "./hover-card-context";
import { DataCellPopoverCardContent } from "./data-cell-popover-card-content";
import { useFixedRowWindow } from "./lib/use-fixed-row-window";
import { useMountEffect } from "@/hooks/useMountEffect";

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
  cellColorState?: "none" | "consensus" | "similarity" | "mismatch";
  distanceData?: any;
  showHoverCard?: boolean;
  similarityType?: "unaligned" | "aligned";
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

function HoverCardPositionRunner({
  hoverInfo,
  hoverCardRef,
  setHoverCardPos,
}: {
  hoverInfo: HoverInfo;
  hoverCardRef: React.RefObject<HTMLDivElement | null>;
  setHoverCardPos: React.Dispatch<
    React.SetStateAction<{ left: number; top: number }>
  >;
}) {
  useMountEffect(() => {
    const GAP = 0;
    const PAD = 8;
    const DIFF = 34;
    const compute = () => {
      const el = hoverCardRef.current;
      const cardWidth = el?.offsetWidth ?? 240;
      const cardHeight = el?.offsetHeight ?? 200;
      let left = hoverInfo.rect.left - GAP - cardWidth;
      let top = hoverInfo.rect.top - DIFF;
      top = Math.max(PAD, Math.min(top, window.innerHeight - cardHeight - PAD));
      if (left < PAD) {
        left = hoverInfo.rect.right + GAP;
      }
      setHoverCardPos({ left, top });
    };

    const raf = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(raf);
  });

  return null;
}

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
      cellColorState = "none",
      distanceData,
      showHoverCard = false,
      similarityType = "aligned",
      onGroundTruthChange,
      fieldIndicationMap,
      fieldReasoningMap,
      overscan = 12,
    }) => {
      // DEBUG: Log showHoverCard prop value
      //console.log('[SingleFileVirtualizedTable] showHoverCard prop:', showHoverCard);
      const renderCount = React.useRef(0);
      const prevPropsRef = React.useRef<any>(null);
      renderCount.current++;

      // Log what changed
      if (prevPropsRef.current) {
        const changes: string[] = [];
        if (prevPropsRef.current.stopAt !== stopAt) changes.push("stopAt");
        if (prevPropsRef.current.setStopAt !== setStopAt)
          changes.push("setStopAt");
        if (prevPropsRef.current.foldAllSignal !== foldAllSignal)
          changes.push("foldAllSignal");
        if (prevPropsRef.current.setFoldAllSignal !== setFoldAllSignal)
          changes.push("setFoldAllSignal");
        if (prevPropsRef.current.columns !== columns) changes.push("columns");
        if (prevPropsRef.current.document !== document)
          changes.push("document");
        if (prevPropsRef.current.schema !== schema) changes.push("schema");
        if (prevPropsRef.current.tableAndPaths !== tableAndPaths)
          changes.push("tableAndPaths");
        if (prevPropsRef.current.visibleKeys !== visibleKeys)
          changes.push("visibleKeys");
        if (prevPropsRef.current.rowCount !== rowCount)
          changes.push("rowCount");
        if (prevPropsRef.current.onUpdateDocument !== onUpdateDocument)
          changes.push("onUpdateDocument");
        if (prevPropsRef.current.editMode !== editMode)
          changes.push("editMode");

        //console.log(`[SingleFileVirtualizedTable] Rendering #${renderCount.current} - Props that changed:`, changes);
      } else {
        //console.log(`[SingleFileVirtualizedTable] Rendering #${renderCount.current} - Initial render`);
      }

      prevPropsRef.current = {
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
      };

      //console.log(`[SingleFileVirtualizedTable] Rendering #${renderCount.current}`, {
      //    columnsRef: columns,
      //    columnsLength: columns.length,
      //    documentRef: document,
      //    tableAndPathsRef: tableAndPaths,
      //    visibleKeysRef: visibleKeys,
      //    visibleKeysLength: visibleKeys.length,
      //});

      const { rowHeight, columnWidth } = useSheetOptionsStore();
      const theme = getTheme("single-file");

      // Add hover info state for DataCell hover functionality
      const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

      // Which object/array cell has its inline editor popover open (by field
      // key). Held at the table level so it survives row virtualization.
      const [openPopover, setOpenPopover] = useState<string | null>(null);

      // Hover card state and refs
      const hoverCardRef = useRef<HTMLDivElement>(null);
      const [hoverCardPos, setHoverCardPos] = useState<{
        left: number;
        top: number;
      }>({ left: 0, top: 0 });
      const clearHoverTimeoutRef = useRef<number | null>(null);
      const isPointerInCardRef = useRef<boolean>(false);
      const [portalOpen, setPortalOpen] = useState(false);

      // Handle cell hover start
      const handleCellHoverStart = useCallback(
        (info: { docId: string; fieldPath: string; rect: DOMRect }) => {
          // console.log('[SingleFileVirtualizedTable] handleCellHoverStart called:', {
          //     info,
          //     showHoverCard,
          //     isPointerInCardRef: isPointerInCardRef.current,
          //     clearHoverTimeoutRef: clearHoverTimeoutRef.current,
          // });
          if (clearHoverTimeoutRef.current) {
            clearTimeout(clearHoverTimeoutRef.current);
            clearHoverTimeoutRef.current = null;
          }
          // Do not change the displayed field while the pointer is over the card
          if (isPointerInCardRef.current) {
            // console.log('[SingleFileVirtualizedTable] Skipping setHoverInfo - pointer is in card');
            return;
          }
          // console.log('[SingleFileVirtualizedTable] Setting hoverInfo:', info);
          setHoverInfo(info);
          onCellHoverStart?.(info);
        },
        [onCellHoverStart],
      );

      // Handle cell hover end
      const handleCellHoverEnd = useCallback(() => {
        if (clearHoverTimeoutRef.current) {
          clearTimeout(clearHoverTimeoutRef.current);
        }
        if (isPointerInCardRef.current || portalOpen) return; // keep showing while over card or when portal is open
        // Small delay to avoid flicker crossing tiny gaps
        clearHoverTimeoutRef.current = window.setTimeout(() => {
          setHoverInfo(null);
          clearHoverTimeoutRef.current = null;
        }, 10);
      }, [portalOpen]);

      // Noop update function for read-only mode
      const noopUpdateDocument = useCallback(async () => {}, []);
      //         documentId: document.id,
      //         documentRef: document,
      //         columnsRef: columns,
      //         tableAndPathsRef: tableAndPaths,
      //         schemaRef: schema,
      //         onUpdateDocumentRef: onUpdateDocument,
      //     });
      // }, [rowCount, visibleKeys, document, columns, tableAndPaths, schema, onUpdateDocument]);

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
      const hoverCardPositionRunner =
        showHoverCard && hoverInfo ? (
          <HoverCardPositionRunner
            key={`${hoverInfo.docId}:${hoverInfo.fieldPath}:${hoverInfo.rect.left}:${hoverInfo.rect.top}:${hoverInfo.rect.right}`}
            hoverInfo={hoverInfo}
            hoverCardRef={hoverCardRef}
            setHoverCardPos={setHoverCardPos}
          />
        ) : null;

      // Render hover card via portal to document.body to avoid transform/stacking context issues
      const hoverCardElement =
        showHoverCard && hoverInfo && typeof window !== "undefined"
          ? createPortal(
              <div
                className="z-[9999]"
                style={{
                  position: "fixed",
                  left: `${hoverCardPos.left}px`,
                  top: `${hoverCardPos.top}px`,
                  pointerEvents: "auto",
                }}
                onMouseEnter={() => {
                  //console.log('[SingleFileVirtualizedTable] HoverCard onMouseEnter');
                  isPointerInCardRef.current = true;
                  if (clearHoverTimeoutRef.current) {
                    clearTimeout(clearHoverTimeoutRef.current);
                    clearHoverTimeoutRef.current = null;
                  }
                }}
                onMouseLeave={() => {
                  //console.log('[SingleFileVirtualizedTable] HoverCard onMouseLeave');
                  isPointerInCardRef.current = false;
                  if (!clearHoverTimeoutRef.current && !portalOpen) {
                    clearHoverTimeoutRef.current = window.setTimeout(() => {
                      setHoverInfo(null);
                      clearHoverTimeoutRef.current = null;
                    }, 120);
                  }
                }}
              >
                <HoverCardPortalContext.Provider value={{ setPortalOpen }}>
                  <div
                    ref={hoverCardRef}
                    className="overflow-hidden rounded-md border border-border bg-background p-0 shadow-lg"
                  >
                    <DataCellPopoverCardContent
                      similarityType={similarityType}
                      document={document}
                      selectedFieldPath={hoverInfo.fieldPath}
                      currentIterationId={
                        cellColorState === "similarity"
                          ? "iteration-single-file"
                          : "single-file"
                      }
                      updateDocument={noopUpdateDocument}
                      jsonSchema={schema}
                      rowDistanceData={distanceData}
                      onGroundTruthChange={onGroundTruthChange}
                      fieldIndicationMap={fieldIndicationMap}
                      fieldReasoningMap={fieldReasoningMap}
                    />
                  </div>
                </HoverCardPortalContext.Provider>
              </div>,
              window.document.body,
            )
          : null;

      return (
        <HoverInfoContext.Provider value={{ hoverInfo, setHoverInfo }}>
          {hoverCardPositionRunner}
          {/* Hover Card rendered via portal */}
          {hoverCardElement}

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
                    ? Array.from({ length: Math.max(0, end - start) }, (_, i) => {
                        const rowIdx = start + i;
                        return (
                        <SingleFileFormRow
                          key={rowIdx}
                          rowIdx={rowIdx}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            transform: `translateY(${rowIdx * rowHeightPx}px)`,
                          }}
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
                          onCellHoverStart={
                            showHoverCard
                              ? handleCellHoverStart
                              : onCellHoverStart
                          }
                          onCellHoverEnd={
                            showHoverCard ? handleCellHoverEnd : undefined
                          }
                          cellColorState={cellColorState}
                          distanceData={distanceData}
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
