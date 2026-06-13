"use client"

import * as React from "react"

import { createViewerResource } from "@/lib/viewer-resource"
import { PdfThumbnailSidebar } from "@/components/ui/pdf-thumbnail-sidebar"
import {
  PdfResourceViewer,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"

const PDF_URL = "/samples/nvidia-10k-fy2024.pdf"
const PDF_SOURCE = {
  kind: "url" as const,
  url: PDF_URL,
  fileName: "nvidia-10k-fy2024.pdf",
}

/**
 * PDF viewer with a page-thumbnail sidebar.
 *
 * The thumbnail rail goes in the viewer's left slot; the viewer's built-in
 * toolbar toggle (`railToggle`) collapses/expands it. The viewer reports the
 * visible page (`onVisiblePageChange`) so the active thumbnail highlights, and
 * clicking a thumbnail scrolls the document to that page. Thumbnails render
 * lazily as they scroll into view, so this works on large documents.
 */
export function PdfThumbnailsBlock() {
  const [currentPage, setCurrentPage] = React.useState(1)
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const resource = React.useMemo(() => createViewerResource(PDF_SOURCE), [])

  const jumpToPage = React.useCallback((page: number) => {
    viewerRef.current?.scrollToPage(page)
  }, [])

  return (
    <div className="h-full min-h-[680px] bg-background">
      <PdfResourceViewer
        ref={viewerRef}
        resource={resource}
        bare
        onVisiblePageChange={setCurrentPage}
        slots={{
          left: (
            <PdfThumbnailSidebar
              resource={resource}
              currentPage={currentPage}
              onSelectPage={jumpToPage}
              className="w-36 border-r"
            />
          ),
        }}
        className="h-full"
      />
    </div>
  )
}
