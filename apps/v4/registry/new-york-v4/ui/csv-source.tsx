"use client"

import * as React from "react"

import type { Source, SourceAnchor } from "@/lib/document-source"
import type { SourceTarget } from "@/hooks/use-source-link"
import type { CsvViewerHandle } from "@/components/ui/csv-viewer"

/** Spreadsheet column letter → 0-based index ("A" → 0, "C" → 2, "AA" → 26). */
export function columnLetterToIndex(letter: string): number {
  let n = 0
  for (const ch of letter.toUpperCase()) {
    if (ch < "A" || ch > "Z") continue
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

/**
 * A `csv_cell` anchor → 0-based `{ row, col }` data coordinates. `row` is the
 * 1-based data row (the header is not a data row); `column` is a letter.
 */
export function csvAnchorToCell(
  anchor: SourceAnchor
): { row: number; col: number } | undefined {
  if (anchor.kind === "csv_cell") {
    return { row: anchor.row - 1, col: columnLetterToIndex(anchor.column) }
  }
  return undefined
}

/** A stable `SourceTarget` over a `CsvViewer` ref — pass to `useSourceLink`. */
export function useCsvSourceTarget(
  viewerRef: React.RefObject<CsvViewerHandle | null>
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const cell = csvAnchorToCell(source.anchor)
        if (cell) viewerRef.current?.scrollToCell(cell.row, cell.col, options)
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
): { row: number; col: number } | null {
  return (source && csvAnchorToCell(source.anchor)) || null
}
