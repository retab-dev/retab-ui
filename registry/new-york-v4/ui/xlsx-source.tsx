"use client"

import * as React from "react"

import type { Source, SourceAnchor } from "@/lib/document-source"
import type { SourceTarget } from "@/hooks/use-source-link"
import type { XlsxViewerHandle } from "@/components/ui/xlsx-viewer"

/** Spreadsheet column letter → 0-based index ("A" → 0, "B" → 1, "AA" → 26). */
export function spreadsheetColumnToIndex(letter: string): number {
  let n = 0
  for (const ch of letter.toUpperCase()) {
    if (ch < "A" || ch > "Z") continue
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

/**
 * A `spreadsheet_cell` anchor to the viewer's public compatibility coordinates.
 * Internals convert this shape to `{ sheetIndex, rowIndex, columnIndex }`.
 */
export function spreadsheetAnchorToCell(
  anchor: SourceAnchor
): { sheet: number; row: number; col: number } | undefined {
  if (anchor.kind === "spreadsheet_cell") {
    return {
      sheet: anchor.sheet_index,
      row: anchor.row - 1,
      col: spreadsheetColumnToIndex(anchor.column),
    }
  }
  return undefined
}

/** A stable `SourceTarget` over an `XlsxViewer` ref — pass to `useSourceLink`. */
export function useXlsxSourceTarget(
  viewerRef: React.RefObject<XlsxViewerHandle | null>
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const cell = spreadsheetAnchorToCell(source.anchor)
        if (cell) {
          viewerRef.current?.scrollToCell(
            cell.sheet,
            cell.row,
            cell.col,
            options
          )
        }
      },
    }),
    [viewerRef]
  )
}

/**
 * The public compatibility `activeCell` prop for `XlsxViewer` derived from the
 * active source. Pass `useSourceLink(...).activeSource` straight in.
 */
export function sourceToXlsxCell(
  source: Source | undefined
): { sheet: number; row: number; col: number } | null {
  return (source && spreadsheetAnchorToCell(source.anchor)) || null
}
