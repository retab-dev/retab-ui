"use client"

import * as React from "react"

import {
  PdfViewerHeader,
  PdfViewerPages,
  PdfViewerProvider,
  PdfViewerThumbnails,
} from "@/components/ui/pdf-viewer"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer"

const PDF_URL = "/samples/nvidia-10k-fy2024.pdf"
const PDF_SOURCE = {
  kind: "url" as const,
  url: PDF_URL,
  fileName: "nvidia-10k-fy2024.pdf",
}

/**
 * PDF viewer with page thumbnails in a navigation rail.
 *
 * ViewerSidebar owns placement. PdfViewerThumbnails owns PDF page
 * thumbnail behavior, active-page highlighting, and click-to-jump navigation.
 */
export function PdfThumbnailsBlock() {
  return (
    <div className="h-full min-h-[680px] bg-background">
      <PdfViewerProvider source={PDF_SOURCE}>
        <ViewerRoot bare defaultOpen className="h-full">
          <PdfViewerHeader>
            <ViewerSidebarTrigger />
          </PdfViewerHeader>
          <ViewerBody>
            <ViewerSidebar
              aria-label="PDF pages"
              width="4.5rem"
              className="border-r"
            >
              <PdfViewerThumbnails thumbnailWidth={60} />
            </ViewerSidebar>
            <ViewerSurface>
              <PdfViewerPages bare className="h-full" />
            </ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      </PdfViewerProvider>
    </div>
  )
}
