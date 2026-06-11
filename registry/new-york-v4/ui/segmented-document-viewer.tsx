"use client"

import * as React from "react"

import { type SegmentInteraction } from "@/lib/segment-interaction"
import { segmentsPageCount, type Segment } from "@/lib/segments"
import { cn } from "@/lib/utils"
import { PageTimeline } from "@/components/ui/page-timeline"
import { PdfViewer } from "@/components/ui/pdf-viewer"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"

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
 *   - SegmentSidebar  (selectable list, left)
 *   - SegmentLegend   (color key, top)
 *   - PageTimeline    (page strip) + an optional source PDF
 *
 * Hover, focus, and persistent selection are shared: a segment highlighted in
 * one surface is reflected everywhere, and clicking a segment scrolls the
 * document to its first page.
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
    <div
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
              if (segment.pages.length) jumpToPage(segment.pages[0])
            }}
            columns={4}
            showUnusedToggle
          />
        )
        const sidebar = (
          <aside className="h-full w-64 flex-shrink-0 overflow-auto border-r">
            <SegmentSidebar
              segments={segments}
              interaction={interaction}
              currentPage={currentPage}
              unitLabel={unitLabel}
              onSelect={(segment) =>
                segment.pages.length && jumpToPage(segment.pages[0])
              }
              className="h-full"
            />
          </aside>
        )
        const header = (
          <div className="border-b">
            {title ? (
              <div className="px-3 pt-2 text-sm font-medium">{title}</div>
            ) : null}
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
          </div>
        )

        if (!src) {
          return (
            <>
              {header}
              <div className="flex min-h-0 flex-1">
                {sidebar}
                <div className="flex flex-1 items-center justify-center p-3 text-center text-xs text-muted-foreground">
                  Pass a document URL to preview its pages.
                </div>
              </div>
            </>
          )
        }

        return (
          <div ref={documentRef} className="min-h-0 flex-1">
            <PdfViewer
              src={src}
              bare
              className="h-full"
              header={header}
              aside={sidebar}
              onVisiblePageChange={setCurrentPage}
            />
          </div>
        )
      })()}
    </div>
  )
}
