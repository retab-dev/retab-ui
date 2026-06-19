"use client";

import * as React from "react";

import type { Source, SourceAnchor } from "@/lib/document-source";
import type { XlsxViewerHandle } from "@/components/ui/xlsx-viewer";

export interface SourceTarget {
  scrollTo?: (source: Source, options: { behavior: ScrollBehavior }) => void;
}

/** Spreadsheet column letter → 0-based index ("A" → 0, "B" → 1, "AA" → 26). */
export function spreadsheetColumnToIndex(letter: string): number | null {
  if (!/^[A-Za-z]+$/.test(letter)) return null;
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
    if (!Number.isSafeInteger(n)) return null;
  }
  return n - 1;
}

/**
 * A `spreadsheet_cell` anchor to the viewer's public compatibility coordinates.
 * Internals convert this shape to `{ sheetIndex, rowIndex, columnIndex }`.
 */
export function xlsxAnchorToTarget(
  anchor: SourceAnchor,
): { sheet: number; row: number; col: number } | undefined {
  if (anchor.kind === "spreadsheet_cell") {
    const col = spreadsheetColumnToIndex(anchor.column);
    if (
      col == null ||
      !Number.isSafeInteger(anchor.sheet_index) ||
      anchor.sheet_index < 0 ||
      !Number.isSafeInteger(anchor.row) ||
      anchor.row < 1
    ) {
      return undefined;
    }
    return {
      sheet: anchor.sheet_index,
      row: anchor.row - 1,
      col,
    };
  }
  return undefined;
}

/** A stable source target over an `XlsxViewer` ref. */
export function useXlsxSourceTarget(
  viewerRef: React.RefObject<XlsxViewerHandle | null>,
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const target = xlsxAnchorToTarget(source.anchor);
        if (target) {
          viewerRef.current?.scrollToCell(
            target.sheet,
            target.row,
            target.col,
            options,
          );
        }
      },
    }),
    [viewerRef],
  );
}

/**
 * The public compatibility `activeCell` prop for `XlsxViewer` derived from a
 * source.
 */
export function sourceToXlsxCell(
  source: Source | undefined,
): { sheet: number; row: number; col: number } | null {
  return source ? xlsxAnchorToTarget(source.anchor) || null : null;
}
