"use client"

import * as React from "react"

import { PdfThumbnailSidebar } from "@/components/ui/pdf-thumbnail-sidebar"
import { PdfViewer } from "@/components/ui/pdf-viewer"

const PDF_URL = "/samples/nvidia-10k-fy2024.pdf"

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
  const previewRef = React.useRef<HTMLDivElement | null>(null)

  const jumpToPage = React.useCallback((page: number) => {
    previewRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <div ref={previewRef} className="h-full min-h-[680px] bg-background">
      <PdfViewer
        source={{
          kind: "url",
          url: PDF_URL,
          fileName: "nvidia-10k-fy2024.pdf",
        }}
        bare
        onVisiblePageChange={setCurrentPage}
        slots={{
          left: (
            <PdfThumbnailSidebar
              src={PDF_URL}
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
