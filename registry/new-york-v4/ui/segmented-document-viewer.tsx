"use client"

import * as React from "react"

import { type SegmentInteraction } from "@/lib/segment-interaction"
import {
  firstSegmentPage,
  segmentsPageCount,
  type Segment,
} from "@/lib/segments"
import { cn } from "@/lib/utils"
import { PageTimeline } from "@/components/ui/page-timeline"
import { PdfViewer } from "@/components/ui/pdf-viewer"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer"

export interface SegmentedDocumentViewerProps {
  segments: Segment[]
  pageCount?: number
  /** Optional source PDF rendered beside the legend, sidebar, and timeline. */
  src?: string
  title?: React.ReactNode
  unitLabel?: string
  interaction?: SegmentInteraction
  className?: string
}

/**
 * The shared engine behind the partition and split viewers. Composes three
 * reusable surfaces over one `Segment[]` model:
 *   - SegmentSidebar  (navigable list, left)
 *   - SegmentLegend   (color key, top)
 *   - PageTimeline    (page strip) + an optional source PDF
 *
 * Pointer preview is shared across surfaces. When nothing is previewed, the
 * current PDF page highlights the segment that contains it. Clicking a segment
 * scrolls the document to its first page.
 */
export function SegmentedDocumentViewer({
  segments,
  pageCount,
  src,
  title,
  unitLabel = "segment",
  interaction: controlledInteraction,
  className,
}: SegmentedDocumentViewerProps) {
  const total = pageCount ?? segmentsPageCount(segments)
  const [currentPage, setCurrentPage] = React.useState<number | null>(null)
  const internalInteraction = useSegmentInteraction()
  const interaction = controlledInteraction ?? internalInteraction

  // Scroll the rendered PDF to a page from a click handler (no effect needed).
  const documentRef = React.useRef<HTMLDivElement | null>(null)
  const jumpToPage = React.useCallback((page: number) => {
    const el = documentRef.current?.querySelector(
      `[data-slot="pdf-page"][data-page="${page}"]`
    )
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <ViewerRoot
      bare
      defaultSidebarOpen
      data-slot="segmented-document-viewer"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card",
        className
      )}
    >
      {(() => {
        const legend = (
          <SegmentLegend
            variant="plain"
            segments={segments}
            currentPage={currentPage}
            interaction={interaction}
            onSelect={(segment) => {
              const page = firstSegmentPage(segment.pages)
              if (page != null) jumpToPage(page)
            }}
            columns={4}
            showUnusedToggle
          />
        )
        const header = (
          <ViewerHeader>
            <div className="flex items-center gap-2 px-2 pt-2 text-sm font-medium">
              <ViewerSidebarTrigger />
              {title ? <span className="min-w-0 truncate">{title}</span> : null}
            </div>
            <div className="px-3 py-2">{legend}</div>
            <div className="px-3 pb-2">
              <PageTimeline
                segments={segments}
                pageCount={total}
                interaction={interaction}
                currentPage={currentPage}
                onSelectPage={jumpToPage}
              />
            </div>
          </ViewerHeader>
        )
        const sidebar = (
          <ViewerSidebar width="16rem" className="overflow-auto border-r">
            <SegmentSidebar
              segments={segments}
              interaction={interaction}
              currentPage={currentPage}
              unitLabel={unitLabel}
              onSelect={(segment) => {
                const page = firstSegmentPage(segment.pages)
                if (page != null) jumpToPage(page)
              }}
              className="h-full"
            />
          </ViewerSidebar>
        )

        if (!src) {
          return (
            <>
              {header}
              <ViewerBody>
                {sidebar}
                <ViewerSurface className="items-center justify-center p-3 text-center text-xs text-muted-foreground">
                  Pass a document URL to preview its pages.
                </ViewerSurface>
              </ViewerBody>
            </>
          )
        }

        return (
          <>
            {header}
            <ViewerBody ref={documentRef}>
              {sidebar}
              <ViewerSurface>
                <PdfViewer
                  source={{ kind: "url", url: src }}
                  bare
                  className="h-full"
                  onVisiblePageChange={setCurrentPage}
                />
              </ViewerSurface>
            </ViewerBody>
          </>
        )
      })()}
    </ViewerRoot>
  )
}
