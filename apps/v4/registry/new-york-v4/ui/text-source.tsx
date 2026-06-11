"use client"

import * as React from "react"

import type { Source, SourceAnchor } from "@/lib/document-source"
import type { SourceTarget } from "@/hooks/use-source-link"
import type { TextViewerHandle } from "@/components/ui/text-viewer"

/** A text_span anchor → a 1-based inclusive line range. */
export function textAnchorToLines(
  anchor: SourceAnchor
): { start: number; end: number } | undefined {
  if (anchor.kind === "text_span") {
    return { start: anchor.line_start, end: anchor.line_end }
  }
  return undefined
}

/** A stable `SourceTarget` over a `TextViewer` ref — pass to `useSourceLink`. */
export function useTextSourceTarget(
  viewerRef: React.RefObject<TextViewerHandle | null>
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const range = textAnchorToLines(source.anchor)
        if (range) viewerRef.current?.scrollToLines(range.start, range.end, options)
      },
    }),
    [viewerRef]
  )
}

/**
 * The `highlight` prop for `TextViewer` derived from the active source. Pass
 * `useSourceLink(...).activeSource` straight in.
 */
export function sourceToTextHighlight(
  source: Source | undefined
): { start: number; end: number } | null {
  return (source && textAnchorToLines(source.anchor)) || null
}
