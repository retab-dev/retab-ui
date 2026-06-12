"use client"

import * as React from "react"

import type { Source, SourceAnchor } from "@/lib/document-source"
import type { SourceTarget } from "@/hooks/use-source-link"
import type {
  TextLineRange,
  TextViewerHandle,
} from "@/components/ui/text-viewer"

/** A text_span anchor → a 1-based inclusive line range. */
export function textAnchorToLines(
  anchor: SourceAnchor
): TextLineRange | undefined {
  if (anchor.kind === "text_span") {
    if (
      !Number.isInteger(anchor.line_start) ||
      !Number.isInteger(anchor.line_end) ||
      anchor.line_start < 1 ||
      anchor.line_end < anchor.line_start
    ) {
      return undefined
    }
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
        if (range) viewerRef.current?.scrollToLineRange(range, options)
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
): TextLineRange | null {
  return (source && textAnchorToLines(source.anchor)) || null
}
