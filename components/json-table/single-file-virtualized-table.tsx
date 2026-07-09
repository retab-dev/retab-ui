"use client";

import React, { useCallback, useRef, useState } from "react";
import type { JSONSchema7 } from "json-schema";

import { getFixedGridCanvasStyle } from "@/components/ui/fixed-grid-layout";
import { FixedGridRowWindow } from "@/components/ui/fixed-grid-row-window";
import { FixedGridViewport } from "@/components/ui/fixed-grid-viewport";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JsonTableHeaderCell } from "@/components/json-table/header-cell";
import type { JsonTableCellCommitHandler } from "@/components/json-table/json-table-cell-commit";
import type {
  JsonTableCellHoverInfo,
  VisibleColumn,
} from "@/components/json-table/json-table-cell-types";
import type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes";
import type { JsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store";
import { recordJsonTableRender } from "@/components/json-table/json-table-profiler";
import type { JsonTableRenderedColumnWindow } from "@/components/json-table/json-table-rendered-column-window";
import type { ProjectedRow } from "@/components/json-table/lib/document-projection";
import { buildHeaderGridRows } from "@/components/json-table/lib/header-nodes";
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes";
import type { TableDocument } from "@/components/json-table/lib/projects-types";
import { useJsonTableEditSessionCoordinator } from "@/components/json-table/use-json-table-edit-session-coordinator";
import { useJsonTableRowPolicy } from "@/components/json-table/use-json-table-row-policy";
import { useJsonTableViewportModel } from "@/components/json-table/use-json-table-viewport-model";

import { SingleFileFormRow } from "./single-file-form-row";
import {
  getRowHeightPx,
  useSheetOptionsStore,
  type ColumnWidth,
} from "./table-options-store";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

interface SingleFileVirtualizedTableProps {
  headerNodes: JsonTableHeaderNode[];
  document: TableDocument;
  schema: JSONSchema7;
  setSchema: (schema: JSONSchema7) => void;
  isPublished: boolean;
  stopAt: string[];
  setStopAt: (stopAt: string[]) => void;
  draggedItemKeyRef: React.RefObject<string | null>;
  draggedItemParentPathRef: React.RefObject<string | null>;
  jsonEditMode: JsonTableJsonEditMode;
  schemaEditMode: JsonTableSchemaEditMode;
  projectedRows: ProjectedRow[];
  visibleColumns: VisibleColumn[];
  rowCount: number;
  primitiveEditStore: JsonTablePrimitiveEditStore;
  onCellCommit: JsonTableCellCommitHandler;
  columnWidth?: ColumnWidth;
  onCellHoverStart?: (info: JsonTableCellHoverInfo) => void;
  onCellHoverEnd?: () => void;
  /** Rows to render beyond the viewport on each side. Editable defaults to 0; read-only defaults to 12. */
  overscan?: number;
  /** Rows to render beyond the viewport after large scroll jumps. Defaults to the resolved overscan. */
  jumpOverscan?: number;
}

const SingleFileTableHeader = React.memo(
  ({
    headerNodes,
    renderedColumnWindow,
    schema,
    setSchema,
    isPublished,
    stopAt,
    setStopAt,
    draggedItemKeyRef,
    draggedItemParentPathRef,
    schemaEditMode,
  }: {
    headerNodes: JsonTableHeaderNode[];
    renderedColumnWindow: JsonTableRenderedColumnWindow;
    schema: JSONSchema7;
    setSchema: (schema: JSONSchema7) => void;
    isPublished: boolean;
    stopAt: string[];
    setStopAt: (stopAt: string[]) => void;
    draggedItemKeyRef: React.RefObject<string | null>;
    draggedItemParentPathRef: React.RefObject<string | null>;
    schemaEditMode: JsonTableSchemaEditMode;
  }) => {
    // Header rows derived straight from the schema header tree: each group spans
    // its leaves; shallower leaves get continuation cells so the grid stays
    // aligned.
    const headerRows = React.useMemo(
      () => buildHeaderGridRows(headerNodes),
      [headerNodes],
    );
    const renderedColumnIndexSet = React.useMemo(
      () => new Set(renderedColumnWindow.projectedCellIndexes),
      [renderedColumnWindow.projectedCellIndexes],
    );
    const renderedColumnWidthByProjectedIndex = React.useMemo(() => {
      return new Map(
        renderedColumnWindow.projectedCellIndexes.map(
          (projectedIndex, index) => [
            projectedIndex,
            renderedColumnWindow.columns[index]?.widthPx ?? 0,
          ],
        ),
      );
    }, [
      renderedColumnWindow.columns,
      renderedColumnWindow.projectedCellIndexes,
    ]);

    return (
      <TableHeader className="bg-muted/30 sticky top-0 z-10">
        {headerRows.map((cells, rowIdx) => (
          <TableRow
            key={rowIdx}
            aria-rowindex={rowIdx + 1}
            className="bg-muted/30 flex w-max min-w-full border-b"
          >
            {renderedColumnWindow.leftPadWidthPx > 0 && (
              <th
                aria-hidden="true"
                data-json-table-header-spacer="true"
                className="bg-muted/30 text-foreground shrink-0 border-r text-xs"
                role="presentation"
                style={{
                  width: `${renderedColumnWindow.leftPadWidthPx}px`,
                  minWidth: `${renderedColumnWindow.leftPadWidthPx}px`,
                }}
              />
            )}
            {cells.map((cell, cellIdx) => {
              const leafStart = cells
                .slice(0, cellIdx)
                .reduce((sum, item) => sum + item.leafCount, 0);
              const renderedLeafIndexes = Array.from(
                { length: cell.leafCount },
                (_, index) => leafStart + index,
              ).filter((index) => renderedColumnIndexSet.has(index));
              const renderedLeafCount = renderedLeafIndexes.length;
              if (renderedLeafCount === 0) return null;

              const width = renderedLeafIndexes.reduce(
                (sum, index) =>
                  sum + (renderedColumnWidthByProjectedIndex.get(index) ?? 0),
                0,
              );
              const ariaColumnIndex = (renderedLeafIndexes[0] ?? 0) + 1;

              if (cell.isContinuation) {
                return (
                  // Presentational continuation cell; aria-colindex is kept so
                  // the grid's column numbering stays contiguous for AT that
                  // read it, even though the role drops it from the a11y tree.
                  // eslint-disable-next-line jsx-a11y/role-supports-aria-props
                  <th
                    key={cellIdx}
                    aria-colindex={ariaColumnIndex}
                    aria-hidden="true"
                    className="bg-muted/30 text-foreground shrink-0 border-r text-xs last:border-r-0"
                    role="presentation"
                    style={{ width: `${width}px`, minWidth: `${width}px` }}
                  />
                );
              }

              return (
                <TableHead
                  key={cellIdx}
                  aria-colindex={ariaColumnIndex}
                  className="bg-muted/30 text-foreground m-0 h-9 shrink-0 border-r p-0 last:border-r-0"
                  style={{
                    width: `${width}px`,
                    minWidth: `${width}px`,
                  }}
                  colSpan={renderedLeafCount}
                >
                  <JsonTableHeaderCell
                    node={cell.node}
                    leafCount={renderedLeafCount}
                    cellWidthPx={width}
                    schema={schema}
                    setSchema={setSchema}
                    stopAt={stopAt}
                    setStopAt={setStopAt}
                    isPublished={isPublished}
                    draggedItemKeyRef={draggedItemKeyRef}
                    draggedItemParentPathRef={draggedItemParentPathRef}
                    schemaEditMode={schemaEditMode}
                  />
                </TableHead>
              );
            })}
            {renderedColumnWindow.rightPadWidthPx > 0 && (
              <th
                aria-hidden="true"
                data-json-table-header-spacer="true"
                className="bg-muted/30 text-foreground shrink-0 text-xs"
                role="presentation"
                style={{
                  width: `${renderedColumnWindow.rightPadWidthPx}px`,
                  minWidth: `${renderedColumnWindow.rightPadWidthPx}px`,
                }}
              />
            )}
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
      headerNodes,
      document,
      schema,
      setSchema,
      isPublished,
      stopAt,
      setStopAt,
      draggedItemKeyRef,
      draggedItemParentPathRef,
      jsonEditMode,
      schemaEditMode,
      projectedRows,
      visibleColumns,
      rowCount,
      primitiveEditStore,
      onCellCommit,
      columnWidth: propColumnWidth,
      onCellHoverStart,
      onCellHoverEnd,
      overscan,
      jumpOverscan,
    }) => {
      const { rowHeight, columnWidth: storeColumnWidth } =
        useSheetOptionsStore();
      const columnWidth = propColumnWidth ?? storeColumnWidth;
      const schemaVisibleColumns = visibleColumns;

      const editSession = useJsonTableEditSessionCoordinator({
        documentId: document.id,
      });

      const rowHeightPx = getRowHeightPx(rowHeight);
      const isJsonEditable = jsonEditMode === "editable";
      const scrollRef = useRef<HTMLDivElement>(null);
      const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
        null,
      );
      const setScrollRef = useCallback((element: HTMLDivElement | null) => {
        scrollRef.current = element;
        setScrollElement((current) =>
          current === element ? current : element,
        );
      }, []);
      const headerScrollRef = useRef<HTMLDivElement>(null);
      const rowOffsetRef = useRef<HTMLTableSectionElement>(null);
      const rowWindowRef = useRef<HTMLTableSectionElement>(null);
      const viewportClientHeightRef = useRef(0);
      const rowPolicy = useJsonTableRowPolicy({
        isJsonEditable,
        projectedRows,
        rowHeightPx,
        rowOffsetRef,
        rowWindowRef,
        schemaVisibleColumns,
        viewportHeightRef: viewportClientHeightRef,
      });
      const {
        renderedColumnWindow,
        totalRowSize,
        totalWidth,
        viewportClientHeight,
        virtualRowWindow,
        virtualRows,
      } = useJsonTableViewportModel({
        columnWidth,
        isJsonEditable,
        jumpOverscan,
        overscan,
        rowCount,
        rowHeightPx,
        rowScrollStrategy: rowPolicy.rowScrollStrategy,
        schemaVisibleColumns,
        scrollElement,
        scrollRef,
      });
      viewportClientHeightRef.current = viewportClientHeight;

      useKeyedLayoutEffect(
        joinEffectKey([
          rowPolicy,
          virtualRows,
          renderedColumnWindow,
          projectedRows,
        ]),
        () => {
          rowPolicy.resyncRows(virtualRows);
        },
      );
      recordJsonTableRender("SingleFileVirtualizedTable", document.id, {
        columnCount: schemaVisibleColumns.length,
        primitiveActiveFieldPath:
          editSession.primitiveActiveCellStore.getSnapshot()?.fieldPath ?? null,
        structuredEditSessionFieldPath:
          editSession.structuredEditSession?.fieldPath ?? null,
        isJsonEditable,
        rowCount,
        virtualRows: virtualRows.length,
      });

      const handleBodyScroll = React.useCallback(
        (event: React.UIEvent<HTMLDivElement>) => {
          const bodyScrollElement = event.currentTarget;
          setScrollElement((current) =>
            current === bodyScrollElement ? current : bodyScrollElement,
          );
          if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = bodyScrollElement.scrollLeft;
          }
        },
        [],
      );

      return (
        <div className="bg-background relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Header: a fixed, opaque bar outside the vertical scroll. It
                scrolls horizontally in sync with the body so fields stay
                aligned, while rows scroll underneath it. A sticky header
                inside the transformed/virtualized body shows rows through it
                (transforms break sticky) — the CSV viewer uses the same
                separated-header approach. */}
          <div
            ref={headerScrollRef}
            className="bg-muted/30 w-full shrink-0 overflow-x-hidden"
          >
            <table
              aria-colcount={schemaVisibleColumns.length}
              data-slot="table"
              className="bg-muted/30 relative flex w-full flex-col rounded-none"
              style={getFixedGridCanvasStyle({ minWidth: totalWidth })}
            >
              <SingleFileTableHeader
                headerNodes={headerNodes}
                renderedColumnWindow={renderedColumnWindow}
                schema={schema}
                setSchema={setSchema}
                isPublished={isPublished}
                stopAt={stopAt}
                setStopAt={setStopAt}
                draggedItemKeyRef={draggedItemKeyRef}
                draggedItemParentPathRef={draggedItemParentPathRef}
                schemaEditMode={schemaEditMode}
              />
            </table>
          </div>
          <FixedGridViewport
            scrollRef={setScrollRef}
            dataSlot="json-table-scroll"
            className="w-full flex-1 overflow-auto"
            onScroll={handleBodyScroll}
          >
            <FixedGridRowWindow
              as="table"
              offsetAs="tbody"
              windowAs="tbody"
              aria-colcount={schemaVisibleColumns.length}
              aria-rowcount={rowCount}
              data-slot="table"
              className="bg-background relative flex w-full flex-col rounded-none"
              minWidth={totalWidth}
              rowMinWidth="100%"
              totalSize={totalRowSize}
              virtualRowWindow={virtualRowWindow}
              viewportHeight={viewportClientHeight}
              rowOffsetRef={rowOffsetRef}
              rowWindowRef={rowWindowRef}
              offsetDataSlot="json-table-row-offset"
              offsetClassName="bg-background w-full shrink-0"
              windowDataSlot="json-table-row-window"
              windowClassName="bg-background w-full"
            >
              {virtualRowWindow.items.map((virtualRow, slotIndex) => {
                // Editable mode keeps row identity so focused editor state
                // cannot move to another document row. Read-only mode reuses
                // visible row shells to avoid replacement spikes while
                // scrolling through large tables.
                const rowIdx = virtualRow.index;
                const rowKey = isJsonEditable
                  ? `row-${rowIdx}`
                  : `slot-${slotIndex}`;
                const projectedRow = projectedRows[rowIdx];
                return (
                  <SingleFileFormRow
                    key={rowKey}
                    rowIdx={rowIdx}
                    rowTopPx={virtualRow.start}
                    document={document}
                    projectedRow={projectedRow}
                    schema={schema}
                    renderedColumnWindow={renderedColumnWindow}
                    rowHeightPx={rowHeightPx}
                    primitiveActiveCellStore={
                      editSession.primitiveActiveCellStore
                    }
                    primitiveEditStore={primitiveEditStore}
                    setPrimitiveActiveCell={editSession.setPrimitiveActiveCell}
                    structuredEditSession={editSession.structuredEditSession}
                    startStructuredEditSession={
                      editSession.startStructuredEditSession
                    }
                    setStructuredEditSessionOverlayOpen={
                      editSession.setStructuredEditSessionOverlayOpen
                    }
                    closeStructuredEditSession={
                      editSession.closeStructuredEditSession
                    }
                    onCellHoverStart={onCellHoverStart}
                    onCellHoverEnd={onCellHoverEnd}
                    onCellCommit={onCellCommit}
                    isJsonEditable={isJsonEditable}
                  />
                );
              })}
            </FixedGridRowWindow>
          </FixedGridViewport>
        </div>
      );
    },
  );
SingleFileVirtualizedTable.displayName = "SingleFileVirtualizedTable";
