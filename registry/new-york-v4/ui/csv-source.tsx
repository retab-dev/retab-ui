"use client";

import * as React from "react";

import type { Source, SourceAnchor } from "@/lib/document-source";
import type {
  CsvCellAddress,
  CsvViewerHandle,
} from "@/components/ui/csv-viewer";

export interface SourceTarget {
  scrollTo?: (source: Source, options: { behavior: ScrollBehavior }) => void;
}

/** Spreadsheet column letter → 0-based index ("A" → 0, "C" → 2, "AA" → 26). */
export function columnLetterToIndex(letter: string): number | null {
  if (!/^[A-Za-z]+$/.test(letter)) return null;
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
    if (!Number.isSafeInteger(n)) return null;
  }
  return n - 1;
}

/**
 * A `csv_cell` anchor → 0-based data coordinates. `row` is the 1-based data
 * row (the header is not a data row); `column` is a letter.
 */
export function csvAnchorToTarget(anchor: SourceAnchor): CsvCellAddress | null {
  if (anchor.kind === "csv_cell") {
    const columnIndex = columnLetterToIndex(anchor.column);
    if (
      columnIndex == null ||
      !Number.isInteger(anchor.row) ||
      anchor.row < 1
    ) {
      return null;
    }
    return {
      rowIndex: anchor.row - 1,
      columnIndex,
    };
  }
  return null;
}

/** A stable source target over a `CsvViewer` ref. */
export function useCsvSourceTarget(
  viewerRef: React.RefObject<CsvViewerHandle | null>,
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const target = csvAnchorToTarget(source.anchor);
        if (target) viewerRef.current?.scrollToCell(target, options);
      },
    }),
    [viewerRef],
  );
}

/**
 * The `activeCell` prop for `CsvViewer` derived from a source.
 */
export function sourceToCsvCell(
  source: Source | undefined,
): CsvCellAddress | null {
  return source ? csvAnchorToTarget(source.anchor) : null;
}
