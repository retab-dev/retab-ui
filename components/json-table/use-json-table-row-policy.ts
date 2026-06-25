"use client";

import * as React from "react";

import type {
  FixedGridRowScrollStrategy,
  FixedGridVirtualItem,
} from "@/components/ui/fixed-grid-virtualization";
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types";
import type { ProjectedRow } from "@/components/json-table/lib/document-projection";
import {
  useScalarReadOnlyJsonRowPatcher,
  type ScalarReadOnlyJsonRowPatchState,
} from "@/components/json-table/scalar-read-only-json-row-patcher";

export type JsonTableRowPolicy = {
  invalidateRows: () => void;
  resyncRows: (virtualRows: FixedGridVirtualItem[]) => void;
  rowScrollStrategy: FixedGridRowScrollStrategy | undefined;
};

export function useJsonTableRowPolicy({
  isJsonEditable,
  projectedRows,
  rowHeightPx,
  rowOffsetRef,
  rowWindowRef,
  schemaVisibleColumns,
  viewportHeightRef,
}: {
  isJsonEditable: boolean;
  projectedRows: ProjectedRow[];
  rowHeightPx: number;
  rowOffsetRef: React.RefObject<HTMLElement | null>;
  rowWindowRef: React.RefObject<HTMLElement | null>;
  schemaVisibleColumns: VisibleColumn[];
  viewportHeightRef: React.RefObject<number>;
}): JsonTableRowPolicy {
  const getScalarReadOnlyRowPatchState =
    React.useCallback((): ScalarReadOnlyJsonRowPatchState => {
      return {
        isEnabled: !isJsonEditable,
        projectedRows,
        rowHeightPx,
        viewportHeight: viewportHeightRef.current,
        visibleColumns: schemaVisibleColumns,
      };
    }, [
      isJsonEditable,
      projectedRows,
      rowHeightPx,
      schemaVisibleColumns,
      viewportHeightRef,
    ]);

  const scalarReadOnlyRowPatcher = useScalarReadOnlyJsonRowPatcher({
    rowOffsetRef,
    rowWindowRef,
    getState: getScalarReadOnlyRowPatchState,
  });
  const rowScrollStrategy = React.useMemo(
    () =>
      isJsonEditable
        ? undefined
        : { handleViewport: scalarReadOnlyRowPatcher.patch },
    [isJsonEditable, scalarReadOnlyRowPatcher.patch],
  );

  return React.useMemo(
    () => ({
      invalidateRows: scalarReadOnlyRowPatcher.invalidate,
      resyncRows: isJsonEditable
        ? scalarReadOnlyRowPatcher.invalidate
        : scalarReadOnlyRowPatcher.resync,
      rowScrollStrategy,
    }),
    [
      isJsonEditable,
      scalarReadOnlyRowPatcher.invalidate,
      scalarReadOnlyRowPatcher.resync,
      rowScrollStrategy,
    ],
  );
}
