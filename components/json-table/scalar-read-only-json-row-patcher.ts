"use client";

import * as React from "react";

import { fixedGridInverseStickyOffset } from "@/components/ui/fixed-grid-layout";
import {
  fixedVirtualItems,
  fixedVirtualItemWindow,
  type FixedGridJumpViewportResult,
  type FixedGridViewport,
} from "@/components/ui/fixed-grid-virtualization";
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types";
import { jsonTableDisplayText } from "@/components/json-table/json-table-display-value";
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler";
import type { ProjectedRow } from "@/components/json-table/lib/document-projection";

export interface ScalarReadOnlyJsonRowPatchState {
  isEnabled: boolean;
  projectedRows: ProjectedRow[];
  rowHeightPx: number;
  viewportHeight: number;
  visibleColumns: VisibleColumn[];
}

export interface ScalarReadOnlyJsonRowPatcher {
  patch: (viewport: FixedGridViewport) => FixedGridJumpViewportResult;
  resync: (virtualRows: ReturnType<typeof fixedVirtualItems>) => void;
  invalidate: () => void;
}

export type ScalarReadOnlyJsonRowPatchDiagnostic =
  | {
      reason: "handled";
      rowsPatched: number;
    }
  | {
      reason:
        | "disabled"
        | "empty-cache"
        | "empty-next-window"
        | "missing-row-window"
        | "shape-mismatch"
        | "unsupported-viewport"
        | "window-too-large";
      rowsPatched: 0;
    };

interface JsonCellHandle {
  element: HTMLElement;
  checkboxElement: HTMLElement | null;
  textNode: Text | null;
  fieldPath: string | null;
}

interface JsonRowHandle {
  element: HTMLElement;
  cells: JsonCellHandle[];
  isHidden: boolean;
  rowIndex: number | null;
  transform: string;
}

interface JsonRowHandleCache {
  rowWindow: HTMLElement;
  rows: JsonRowHandle[];
}

const PATCH_ROW_OVERSCAN = 0;
const MINIMUM_PATCH_VISIBLE_ROWS = 1;
const TEXT_NODE = 3;

export function useScalarReadOnlyJsonRowPatcher({
  rowWindowRef,
  getState,
  onDiagnostic,
}: {
  rowWindowRef: React.RefObject<HTMLElement | null>;
  getState: () => ScalarReadOnlyJsonRowPatchState;
  onDiagnostic?: (diagnostic: ScalarReadOnlyJsonRowPatchDiagnostic) => void;
}): ScalarReadOnlyJsonRowPatcher {
  const rowHandleCacheRef = React.useRef<JsonRowHandleCache | null>(null);

  const invalidate = React.useCallback(() => {
    rowHandleCacheRef.current = null;
  }, []);

  const resync = React.useCallback(
    (virtualRows: ReturnType<typeof fixedVirtualItems>) => {
      const state = getState();
      if (!state.isEnabled) return;

      const rowWindow = rowWindowRef.current;
      if (!rowWindow) return;

      const cache = readRowHandles(rowWindow);
      rowHandleCacheRef.current = cache;
      if (cache.rows.length === 0) return;

      const nextRowWindow = fixedVirtualItemWindow(virtualRows);
      if (!canPatchRowHandles(cache.rows, nextRowWindow.items, state)) {
        return;
      }

      setRowWindowGeometry(cache.rowWindow, nextRowWindow, {
        viewportHeight: state.viewportHeight,
      });
      patchRows(cache.rows, nextRowWindow.items, state);
    },
    [getState, rowWindowRef],
  );

  const patch = React.useCallback(
    (viewport: FixedGridViewport): FixedGridJumpViewportResult => {
      const state = getState();
      if (!canPatchRows(viewport, state)) {
        recordPatchDiagnostic(onDiagnostic, {
          reason: patchDisabledReason(viewport, state),
          rowsPatched: 0,
        });
        return "pass";
      }

      const rowWindow = rowWindowRef.current;
      if (!rowWindow) {
        recordPatchDiagnostic(onDiagnostic, {
          reason: "missing-row-window",
          rowsPatched: 0,
        });
        return "pass";
      }

      const cache =
        rowHandleCacheRef.current?.rowWindow === rowWindow
          ? rowHandleCacheRef.current
          : readRowHandles(rowWindow);
      rowHandleCacheRef.current = cache;

      if (cache.rows.length === 0) {
        recordPatchDiagnostic(onDiagnostic, {
          reason: "empty-cache",
          rowsPatched: 0,
        });
        return "pass";
      }

      const nextRows = fixedVirtualItems({
        count: state.projectedRows.length,
        size: state.rowHeightPx,
        scrollOffset: viewport.scrollTop,
        viewportSize: viewport.clientHeight,
        overscan: PATCH_ROW_OVERSCAN,
        minimumVisibleCount: MINIMUM_PATCH_VISIBLE_ROWS,
      });
      if (nextRows.length === 0) {
        recordPatchDiagnostic(onDiagnostic, {
          reason: "empty-next-window",
          rowsPatched: 0,
        });
        return "pass";
      }
      if (nextRows.length > cache.rows.length) {
        recordPatchDiagnostic(onDiagnostic, {
          reason: "window-too-large",
          rowsPatched: 0,
        });
        return "pass";
      }

      if (!canPatchRowHandles(cache.rows, nextRows, state)) {
        recordPatchDiagnostic(onDiagnostic, {
          reason: "shape-mismatch",
          rowsPatched: 0,
        });
        return "pass";
      }

      const nextRowWindow = fixedVirtualItemWindow(nextRows);
      setRowWindowGeometry(cache.rowWindow, nextRowWindow, {
        viewportHeight: viewport.clientHeight,
      });
      const rowsPatched = patchRows(cache.rows, nextRowWindow.items, state);
      recordPatchDiagnostic(onDiagnostic, {
        reason: "handled",
        rowsPatched,
      });

      return "handled";
    },
    [getState, onDiagnostic, rowWindowRef],
  );

  return React.useMemo(
    () => ({ invalidate, patch, resync }),
    [invalidate, patch, resync],
  );
}

function patchRows(
  rowHandles: JsonRowHandle[],
  virtualRows: ReturnType<typeof fixedVirtualItems>,
  state: ScalarReadOnlyJsonRowPatchState,
) {
  let rowsPatched = 0;
  for (let handleIndex = 0; handleIndex < rowHandles.length; handleIndex++) {
    const rowHandle = rowHandles[handleIndex];
    const virtualRow = virtualRows[handleIndex];
    if (!virtualRow) {
      setRowHidden(rowHandle, true);
      continue;
    }

    const rowIndex = virtualRow.index;
    const transform = `translate3d(0, ${virtualRow.start}px, 0)`;

    setRowHidden(rowHandle, false);
    setRowTransform(rowHandle, transform);

    if (rowHandle.rowIndex === rowIndex) continue;
    rowHandle.rowIndex = rowIndex;
    rowHandle.element.dataset.index = String(rowIndex);
    rowHandle.element.setAttribute("aria-rowindex", String(rowIndex + 1));
    patchCells(rowHandle, state.projectedRows[rowIndex], state.visibleColumns);
    rowsPatched += 1;
  }
  return rowsPatched;
}

function patchCells(
  rowHandle: JsonRowHandle,
  projectedRow: ProjectedRow | undefined,
  visibleColumns: VisibleColumn[],
) {
  for (let cellIndex = 0; cellIndex < visibleColumns.length; cellIndex++) {
    const cellHandle = rowHandle.cells[cellIndex];
    const projectedCell = projectedRow?.cells[cellIndex];
    const fieldPath = projectedCell?.materializedFieldPath ?? "";

    if (cellHandle) {
      cellHandle.element.dataset.fieldPath = fieldPath;
      cellHandle.fieldPath = fieldPath;
    }
    const column = visibleColumns[cellIndex];
    const displayText = displayTextForCell(projectedCell, column);
    setTextNodeValue(cellHandle?.textNode ?? null, displayText);
    if (column?.fieldMetadata?.kind === "boolean") {
      setBooleanCellState(cellHandle?.checkboxElement ?? null, displayText);
    }
  }
}

function displayTextForCell(
  projectedCell: ProjectedRow["cells"][number] | undefined,
  column: VisibleColumn | undefined,
) {
  const materializedFieldPath = projectedCell?.materializedFieldPath;
  const fieldMetadata = column?.fieldMetadata;
  if (!materializedFieldPath || !fieldMetadata) return "";

  const displayText =
    projectedCell.displayValue ??
    jsonTableDisplayText({ fieldMetadata, jsonValue: projectedCell.value });
  return displayText || emptyDisplayText(fieldMetadata.kind);
}

function emptyDisplayText(kind: string) {
  return kind === "object" || kind === "array" ? "" : "—";
}

function canPatchRows(
  viewport: FixedGridViewport,
  state: ScalarReadOnlyJsonRowPatchState,
) {
  return (
    state.isEnabled &&
    state.rowHeightPx > 0 &&
    viewport.scrollLeft === 0 &&
    !viewport.isJumpingColumns
  );
}

function patchDisabledReason(
  viewport: FixedGridViewport,
  state: ScalarReadOnlyJsonRowPatchState,
): ScalarReadOnlyJsonRowPatchDiagnostic["reason"] {
  if (!state.isEnabled || state.rowHeightPx <= 0) return "disabled";
  if (viewport.scrollLeft !== 0 || viewport.isJumpingColumns) {
    return "unsupported-viewport";
  }
  return "disabled";
}

function recordPatchDiagnostic(
  onDiagnostic:
    | ((diagnostic: ScalarReadOnlyJsonRowPatchDiagnostic) => void)
    | undefined,
  diagnostic: ScalarReadOnlyJsonRowPatchDiagnostic,
) {
  onDiagnostic?.(diagnostic);
  markJsonTableProfile("scalar-read-only-row-patcher", diagnostic);
}

function canPatchRowHandles(
  rowHandles: JsonRowHandle[],
  virtualRows: ReturnType<typeof fixedVirtualItems>,
  state: ScalarReadOnlyJsonRowPatchState,
) {
  for (let handleIndex = 0; handleIndex < virtualRows.length; handleIndex++) {
    const rowHandle = rowHandles[handleIndex];
    if (!rowHandle || rowHandle.cells.length !== state.visibleColumns.length) {
      return false;
    }

    const projectedRow = state.projectedRows[virtualRows[handleIndex].index];
    for (
      let cellIndex = 0;
      cellIndex < state.visibleColumns.length;
      cellIndex++
    ) {
      const column = state.visibleColumns[cellIndex];
      const projectedCell = projectedRow?.cells[cellIndex];
      const fieldMetadata = column?.fieldMetadata;
      if (!projectedCell?.materializedFieldPath || !fieldMetadata) continue;
      if (fieldMetadata.kind === "object" || fieldMetadata.kind === "array") {
        return false;
      }
      if (!rowHandle.cells[cellIndex]?.textNode) return false;
      if (
        fieldMetadata.kind === "boolean" &&
        !rowHandle.cells[cellIndex]?.checkboxElement
      ) {
        return false;
      }
    }
  }
  return true;
}

function readRowHandles(rowWindow: HTMLElement): JsonRowHandleCache {
  const rows = Array.from(
    rowWindow.querySelectorAll<HTMLElement>('[data-slot="json-table-row"]'),
  ).map((element) => {
    const cells = Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-slot="json-table-read-only-cell"]',
      ),
    ).map((cell) => {
      const textElement = cell.querySelector<HTMLElement>(
        '[data-slot="json-table-read-only-cell-text"], [data-slot="data-cell-value"]',
      );
      return {
        element: cell,
        checkboxElement: cell.querySelector<HTMLElement>('[role="checkbox"]'),
        textNode: firstTextNode(textElement),
        fieldPath: cell.dataset.fieldPath ?? null,
      };
    });

    return {
      element,
      cells,
      isHidden: element.hidden,
      rowIndex: numericDataIndex(element),
      transform: element.style.transform,
    };
  });

  return { rowWindow, rows };
}

function firstTextNode(element: Element | null): Text | null {
  const node = element?.firstChild;
  return node?.nodeType === TEXT_NODE ? (node as Text) : null;
}

function numericDataIndex(element: HTMLElement): number | null {
  const value = Number(element.dataset.index);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function setTextNodeValue(textNode: Text | null, value: string) {
  if (textNode && textNode.nodeValue !== value) textNode.nodeValue = value;
}

function setBooleanCellState(
  checkboxElement: HTMLElement | null,
  value: string,
) {
  if (!checkboxElement) return;
  const checked = value === "true";
  const ariaChecked = checked ? "true" : "false";
  const state = checked ? "checked" : "unchecked";
  if (checkboxElement.getAttribute("aria-checked") !== ariaChecked) {
    checkboxElement.setAttribute("aria-checked", ariaChecked);
  }
  if (checkboxElement.getAttribute("aria-label") !== ariaChecked) {
    checkboxElement.setAttribute("aria-label", ariaChecked);
  }
  if (checkboxElement.dataset.state !== state) {
    checkboxElement.dataset.state = state;
  }
}

function setRowTransform(row: JsonRowHandle, transform: string) {
  if (row.transform === transform) return;
  row.element.style.transform = transform;
  row.transform = transform;
}

function setRowHidden(row: JsonRowHandle, isHidden: boolean) {
  if (row.isHidden === isHidden) return;
  row.element.hidden = isHidden;
  row.isHidden = isHidden;
}

function setRowWindowGeometry(
  rowWindowElement: HTMLElement,
  rowWindow: ReturnType<typeof fixedVirtualItemWindow>,
  { viewportHeight }: { viewportHeight: number },
) {
  const stickyOffset = fixedGridInverseStickyOffset({
    viewportSize: viewportHeight,
    windowSize: rowWindow.size,
  });
  setStyleValue(rowWindowElement.style, "position", "sticky");
  setStyleValue(rowWindowElement.style, "height", `${rowWindow.size}px`);
  setStyleValue(rowWindowElement.style, "margin-top", `${rowWindow.start}px`);
  setStyleValue(rowWindowElement.style, "top", `${stickyOffset}px`);
  setStyleValue(rowWindowElement.style, "bottom", `${stickyOffset}px`);
}

function setStyleValue(
  style: CSSStyleDeclaration,
  propertyName: string,
  value: string,
) {
  if (style.getPropertyValue(propertyName) !== value) {
    style.setProperty(propertyName, value);
  }
}
