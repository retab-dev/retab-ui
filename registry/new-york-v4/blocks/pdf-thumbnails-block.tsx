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
 * PDF viewer with a page-thumbnail sidebar.
 *
 * The thumbnail rail is explicit viewer structure: a ViewerSidebar beside the
 * PDF rendering surface. The viewer reports the visible page so the active
 * thumbnail highlights, and clicking a thumbnail scrolls the document.
 */
export function PdfThumbnailsBlock() {
  return (
    <div className="h-full min-h-[680px] bg-background">
      <PdfViewerProvider source={PDF_SOURCE}>
        <ViewerRoot bare defaultSidebarOpen className="h-full">
          <PdfViewerHeader leading={<ViewerSidebarTrigger />} />
          <ViewerBody>
            <ViewerSidebar width="9rem" className="border-r">
              <PdfViewerThumbnails />
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
