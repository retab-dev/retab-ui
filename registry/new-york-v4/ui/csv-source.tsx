"use client"

import * as React from "react"

import type { Source, SourceAnchor } from "@/lib/document-source"
import type { SourceTarget } from "@/hooks/use-source-link"
import type {
  CsvCellAddress,
  CsvViewerHandle,
} from "@/components/ui/csv-viewer"

/** Spreadsheet column letter → 0-based index ("A" → 0, "C" → 2, "AA" → 26). */
export function columnLetterToIndex(letter: string): number | null {
  if (!/^[A-Za-z]+$/.test(letter)) return null
  let n = 0
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
    if (!Number.isSafeInteger(n)) return null
  }
  return n - 1
}

/**
 * A `csv_cell` anchor → 0-based data coordinates. `row` is the 1-based data
 * row (the header is not a data row); `column` is a letter.
 */
export function csvAnchorToCell(anchor: SourceAnchor): CsvCellAddress | null {
  if (anchor.kind === "csv_cell") {
    const columnIndex = columnLetterToIndex(anchor.column)
    if (
      columnIndex == null ||
      !Number.isInteger(anchor.row) ||
      anchor.row < 1
    ) {
      return null
    }
    return {
      rowIndex: anchor.row - 1,
      columnIndex,
    }
  }
  return null
}

/** A stable `SourceTarget` over a `CsvViewer` ref — pass to `useSourceLink`. */
export function useCsvSourceTarget(
  viewerRef: React.RefObject<CsvViewerHandle | null>
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const cell = csvAnchorToCell(source.anchor)
        if (cell) viewerRef.current?.scrollToCell(cell, options)
      },
    }),
    [viewerRef]
  )
}

/**
 * The `activeCell` prop for `CsvViewer` derived from the active source. Pass
 * `useSourceLink(...).activeSource` straight in.
 */
export function sourceToCsvCell(
  source: Source | undefined
): CsvCellAddress | null {
  return (source && csvAnchorToCell(source.anchor)) || null
}
