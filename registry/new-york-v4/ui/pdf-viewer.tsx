"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  PdfViewerHeader,
  PdfViewerPages,
  PdfViewerProvider,
  type PdfDocumentSource,
} from "./pdf-viewer-context"
import {
  PdfResourceContent,
  type PdfViewerContentProps,
  type PdfResourceContentProps,
} from "./pdf-viewer-content"
import type { PdfViewerHandle } from "./pdf-viewer-types"
import { ViewerBody, ViewerRoot, ViewerSurface } from "./viewer"

export type {
  PageOverlayProps,
  PdfDocumentViewportControls,
  PdfPageAreaTarget,
  PdfViewerHandle,
} from "./pdf-viewer-types"
export {
  PdfViewerHeader,
  PdfViewerPages,
  PdfViewerProvider,
  usePdfViewerThumbnails,
  type PdfDocumentSource,
} from "./pdf-viewer-context"
export {
  PdfResourceContent,
  type PdfResourceContentProps,
  type PdfViewerContentProps,
} from "./pdf-viewer-content"
export {
  PdfThumbnailRail,
  PdfViewerThumbnails,
  type PdfThumbnailRailProps,
  type PdfViewerThumbnailsProps,
} from "./pdf-viewer-thumbnails"

export interface PdfHighlightProps extends React.ComponentProps<"div"> {
  /** Normalized box, each field a percentage [0, 100] of the page. */
  area: { left: number; top: number; width: number; height: number }
}

export function PdfHighlight({
  area,
  className,
  style,
  ...props
}: PdfHighlightProps) {
  return (
    <div
      data-slot="pdf-highlight"
      className={cn(
        "pointer-events-none absolute z-10 rounded-[2px] border border-primary/70 bg-primary/12 shadow-[0_4px_16px_rgb(0_0_0_/_8%)]",
        className
      )}
      style={{
        left: `${area.left}%`,
        top: `${area.top}%`,
        width: `${area.width}%`,
        height: `${area.height}%`,
        ...style,
      }}
      {...props}
    />
  )
}

export interface PdfViewerProps extends PdfViewerContentProps {
  /** Canonical PDF source. URL sources preserve PDF.js range-loading behavior. */
  source: PdfDocumentSource
}

export const PdfViewer = React.forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer(props, ref) {
    const {
      source,
      className,
      bare = false,
      toolbar = true,
      download = true,
      ...pagesProps
    } = props
    return (
      <PdfViewerProvider source={source}>
        <ViewerRoot bare={bare} className={cn("h-full", className)}>
          <PdfViewerHeader download={download} toolbar={toolbar} />
          <ViewerBody>
            <ViewerSurface>
              <PdfViewerPages
                {...pagesProps}
                bare
                className="h-full"
                download={download}
                ref={ref}
              />
            </ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      </PdfViewerProvider>
    )
  }
)
