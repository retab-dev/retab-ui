"use client"

import * as React from "react"

import {
  type Segment,
  pageOwners as buildPageOwners,
  segmentsPageCount,
} from "@/lib/segments"
import { cn } from "@/lib/utils"
import { PageTimeline } from "@/components/ui/page-timeline"
import { PdfViewer } from "@/components/ui/pdf-viewer"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"

export interface SegmentedDocumentViewerProps {
  segments: Segment[]
  pageCount?: number
  /** Optional source PDF; when set, pages render with per-page color overlays. */
  src?: string
  title?: React.ReactNode
  unitLabel?: string
  className?: string
}

/**
 * The shared engine behind the partition and split viewers. Composes three
 * reusable surfaces over one `Segment[]` model:
 *   - SegmentSidebar  (selectable list, left)
 *   - SegmentLegend   (color key, top)
 *   - PageTimeline    (page strip) + an optional PDF document with color overlays
 *
 * Hover/selection is shared: hovering a segment anywhere dims the others
 * everywhere, and clicking a segment scrolls the document to its first page.
 */
export function SegmentedDocumentViewer({
  segments,
  pageCount,
  src,
  title,
  unitLabel = "segment",
  className,
}: SegmentedDocumentViewerProps) {
  const total = pageCount ?? segmentsPageCount(segments)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [currentPage, setCurrentPage] = React.useState<number | null>(null)

  const owners = React.useMemo(() => buildPageOwners(segments), [segments])
  const byIndex = React.useMemo(() => {
    const map = new Map<number, Segment>()
    segments.forEach((s) => map.set(s.index, s))
    return map
  }, [segments])

  // Scroll the rendered PDF to a page from a click handler (no effect needed).
  const documentRef = React.useRef<HTMLDivElement | null>(null)
  const jumpToPage = React.useCallback((page: number) => {
    const el = documentRef.current?.querySelector(
      `[data-slot="pdf-page"][data-page="${page}"]`
    )
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const activeSegment = activeId
    ? segments.find((s) => s.id === activeId)
    : undefined

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
            activeId={activeId}
            onActivate={setActiveId}
            onSelect={(id) => {
              const seg = segments.find((s) => s.id === id)
              if (seg?.pages.length) jumpToPage(seg.pages[0])
            }}
            columns={4}
            showUnusedToggle
          />
        )
        const sidebar = (
          <aside className="h-full w-64 flex-shrink-0 overflow-auto border-r">
            <SegmentSidebar
              segments={segments}
              activeId={activeId}
              onActivate={setActiveId}
              unitLabel={unitLabel}
              onSelect={(seg) => seg.pages.length && jumpToPage(seg.pages[0])}
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
                activeId={activeId}
                onActivate={setActiveId}
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
                  Pass a document URL to preview pages with color overlays.
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
              renderPageOverlay={({ pageNumber }) => {
                const ownerIdx = owners.get(pageNumber) ?? []
                if (ownerIdx.length === 0) return null
                const owner = byIndex.get(ownerIdx[0])
                if (!owner) return null
                const active =
                  activeSegment != null && ownerIdx.includes(activeSegment.index)
                return (
                  <div
                    className="absolute inset-0 transition-colors"
                    style={{
                      backgroundColor: withAlpha(owner.color, active ? 0.22 : 0.08),
                      outline: active ? `3px solid ${owner.color}` : undefined,
                      outlineOffset: -3,
                    }}
                  />
                )
              }}
            />
          </div>
        )
      })()}
    </div>
  )
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace("#", "")
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
