"use client"

import * as React from "react"

import type { Source, SourceAnchor, SourceArea } from "@/lib/document-source"
import type { SourceTarget } from "@/hooks/use-source-link"
import {
  type PageOverlayProps,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"

const HIGHLIGHT_CLASS =
  "pointer-events-none absolute z-10 rounded-[2px] border border-primary/70 bg-primary/12 shadow-[0_4px_16px_rgb(0_0_0_/_8%)]"

/** A normalized image/pdf bbox anchor → a percentage box on the frame. */
export function imageAnchorToArea(
  anchor: SourceAnchor
): SourceArea | undefined {
  if (anchor.kind === "image_bbox" || anchor.kind === "pdf_bbox") {
    return {
      left: anchor.left * 100,
      top: anchor.top * 100,
      width: anchor.width * 100,
      height: anchor.height * 100,
    }
  }
  return undefined
}

/** A stable `SourceTarget` over an `ImageViewer` ref — pass to `useSourceLink`. */
export function useImageSourceTarget(
  viewerRef: React.RefObject<ImageViewerHandle | null>
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const area = imageAnchorToArea(source.anchor)
        if (area) viewerRef.current?.scrollToFrameArea(1, area, options)
      },
    }),
    [viewerRef]
  )
}

/**
 * Build a `renderPageOverlay` callback that draws the active source highlight on
 * the image. Pass `useSourceLink(...).activeSource` straight in.
 */
export function renderImageSourceOverlay(
  source: Source | undefined
): (props: PageOverlayProps) => React.ReactNode {
  const area = source ? imageAnchorToArea(source.anchor) : undefined
  return function ImageSourceOverlay({ pageNumber }: PageOverlayProps) {
    if (!area || pageNumber !== 1) return null
    return (
      <div
        className={HIGHLIGHT_CLASS}
        style={{
          left: `${area.left}%`,
          top: `${area.top}%`,
          width: `${area.width}%`,
          height: `${area.height}%`,
        }}
      />
    )
  }
}
