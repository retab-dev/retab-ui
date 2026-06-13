"use client"

import * as React from "react"

import type {
  Source,
  SourceAnchor,
  SourceLocation,
} from "@/lib/document-source"
import type { SourceTarget } from "@/hooks/use-source-link"
import {
  PdfHighlight,
  type PageOverlayProps,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"

/**
 * Turn a source anchor into a PDF target, or `undefined` when the anchor isn't
 * a page region (a spreadsheet cell, a text span, …). PDF/image bbox anchors are
 * normalized [0, 1]; the viewer wants percentages, so scale by 100. An image
 * lands on the single page 1.
 */
export function pdfAnchorToTarget(
  anchor: SourceAnchor
): SourceLocation | undefined {
  if (anchor.kind === "pdf_bbox") {
    if (!isPositiveInteger(anchor.page) || !isValidNormalizedBox(anchor)) {
      return undefined
    }
    return {
      page: anchor.page,
      area: {
        left: anchor.left * 100,
        top: anchor.top * 100,
        width: anchor.width * 100,
        height: anchor.height * 100,
      },
    }
  }
  if (anchor.kind === "image_bbox") {
    if (anchor.page != null && !isPositiveInteger(anchor.page)) {
      return undefined
    }
    if (!isValidNormalizedBox(anchor)) return undefined
    return {
      page: 1,
      area: {
        left: anchor.left * 100,
        top: anchor.top * 100,
        width: anchor.width * 100,
        height: anchor.height * 100,
      },
    }
  }
  return undefined
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1
}

function isValidNormalizedBox({
  left,
  top,
  width,
  height,
}: {
  left: number
  top: number
  width: number
  height: number
}): boolean {
  return (
    Number.isFinite(left) &&
    Number.isFinite(top) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    left >= 0 &&
    top >= 0 &&
    width > 0 &&
    height > 0 &&
    left + width <= 1 &&
    top + height <= 1
  )
}

/**
 * A stable `SourceTarget` over a `PdfViewer` ref — pass to `useSourceLink`. The
 * ref is read lazily (only when scrolling), so this is just the bridge from the
 * generic source contract to the viewer's imperative handle.
 */
export function usePdfSourceTarget(
  viewerRef: React.RefObject<PdfViewerHandle | null>
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const target = pdfAnchorToTarget(source.anchor)
        if (target) {
          viewerRef.current?.scrollToPageArea(
            { pageNumber: target.page, top: target.area.top },
            options
          )
        }
      },
    }),
    [viewerRef]
  )
}

/**
 * Build a `renderPageOverlay` callback that draws the active source highlight on
 * its page. Pass `useSourceLink(...).activeSource` straight in.
 */
export function renderPdfSourceOverlay(
  source: Source | undefined
): (props: PageOverlayProps) => React.ReactNode {
  const target = source ? pdfAnchorToTarget(source.anchor) : undefined
  return function PdfSourceOverlay({ pageNumber }: PageOverlayProps) {
    return target && target.page === pageNumber ? (
      <PdfHighlight area={target.area} />
    ) : null
  }
}
