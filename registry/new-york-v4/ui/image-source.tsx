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

/**
 * The 1-based frame a bbox anchor lives on, or undefined if it isn't a raster
 * bbox. `image_bbox` defaults to frame 1 (single image); a multi-frame TIFF (or
 * a rasterized slide deck) sets `page` explicitly.
 */
export function imageAnchorToFrame(anchor: SourceAnchor): number | undefined {
  if (anchor.kind === "image_bbox") return anchor.page ?? 1
  if (anchor.kind === "pdf_bbox") return anchor.page
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
        const frame = imageAnchorToFrame(source.anchor)
        if (area && frame)
          viewerRef.current?.scrollToFrameArea(frame, area, options)
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
  const frame = source ? imageAnchorToFrame(source.anchor) : undefined
  return function ImageSourceOverlay({ pageNumber }: PageOverlayProps) {
    if (!area || pageNumber !== frame) return null
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
