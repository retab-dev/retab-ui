"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import type { SourceTarget } from "@/hooks/use-source-link"
import type { DocxTarget, DocxViewerHandle } from "@/components/ui/docx-viewer"

/**
 * A docx source → a viewer-ready `DocxTarget`, or null when the anchor isn't a
 * docx anchor. Text spans carry the quoted `content` (the viewer locates it by
 * match); table cells carry their index. Mirrors the PDF adapter's
 * `pdfAnchorToLocation` — the adapter resolves the anchor, the viewer the DOM.
 */
export function docxSourceToTarget(
  source: Source | undefined
): DocxTarget | null {
  if (!source) return null
  const a = source.anchor
  if (a.kind === "docx_text_span") {
    if (
      !isNonNegativeInteger(a.paragraph) ||
      !isValidOptionalRange(a.char_start, a.char_end)
    )
      return null
    const text = source.content.trim()
    return text ? { kind: "text", text } : null
  }
  if (a.kind === "docx_table_cell") {
    if (
      !isNonNegativeInteger(a.table) ||
      !isNonNegativeInteger(a.row) ||
      !isNonNegativeInteger(a.column)
    )
      return null
    return { kind: "cell", table: a.table, row: a.row, column: a.column }
  }
  return null
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0
}

function isValidOptionalRange(start?: number, end?: number) {
  if (start == null && end == null) return true
  if (start == null || end == null) return false
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end >= start
  )
}

/** A stable `SourceTarget` over a `DocxViewer` ref — pass to `useSourceLink`. */
export function useDocxSourceTarget(
  viewerRef: React.RefObject<DocxViewerHandle | null>
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const target = docxSourceToTarget(source)
        if (target) viewerRef.current?.scrollToTarget(target, options)
      },
    }),
    [viewerRef]
  )
}

/**
 * The `highlight` prop for `DocxViewer` derived from the active source. Pass
 * `useSourceLink(...).activeSource` straight in; non-docx anchors resolve to null.
 */
export function sourceToDocxHighlight(
  source: Source | undefined
): DocxTarget | null {
  return docxSourceToTarget(source)
}
