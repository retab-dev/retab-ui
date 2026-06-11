"use client"

import * as React from "react"

import {
  type Segment,
  pageOwners as buildPageOwners,
  segmentsPageCount,
} from "@/lib/segments"
import { cn } from "@/lib/utils"

export interface PageTimelineProps {
  segments: Segment[]
  /** Total pages; defaults to the max page across segments. */
  pageCount?: number
  /** Highlighted segment id; its pages stay lit while others dim. */
  activeId?: string | null
  onActivate?: (id: string | null) => void
  /** 1-based current page to mark (e.g. synced to a PDF scroll position). */
  currentPage?: number | null
  /** Fired when a page cell is clicked. */
  onSelectPage?: (page: number) => void
  className?: string
}

/**
 * A horizontal strip of page cells colored by the segment that owns each page.
 * It ties the legend and sidebar to the document: hovering a cell raises its
 * segment, hovering a segment elsewhere dims unrelated pages, and clicking a
 * cell jumps the document.
 */
export function PageTimeline({
  segments,
  pageCount,
  activeId,
  onActivate,
  currentPage,
  onSelectPage,
  className,
}: PageTimelineProps) {
  const total = pageCount ?? segmentsPageCount(segments)
  const owners = React.useMemo(() => buildPageOwners(segments), [segments])
  const byIndex = React.useMemo(() => {
    const map = new Map<number, Segment>()
    segments.forEach((s) => map.set(s.index, s))
    return map
  }, [segments])

  if (total <= 0) return null

  return (
    <div
      data-slot="page-timeline"
      className={cn("flex items-stretch gap-px overflow-hidden rounded-md", className)}
    >
      {Array.from({ length: total }, (_, i) => {
        const page = i + 1
        const ownerIndexes = owners.get(page) ?? []
        const owner = ownerIndexes.length ? byIndex.get(ownerIndexes[0]) : undefined
        const activeSegment = activeId
          ? segments.find((s) => s.id === activeId)
          : undefined
        const dimmed = activeSegment
          ? !ownerIndexes.includes(activeSegment.index)
          : false
        const isCurrent = currentPage === page
        return (
          <button
            key={page}
            type="button"
            title={`Page ${page}${owner ? ` · ${owner.label}` : ""}`}
            onMouseEnter={() => owner && onActivate?.(owner.id)}
            onMouseLeave={() => onActivate?.(null)}
            onClick={() => onSelectPage?.(page)}
            data-current={isCurrent}
            className={cn(
              "group relative h-7 flex-1 transition-opacity",
              dimmed ? "opacity-25" : "opacity-100"
            )}
            style={{ backgroundColor: owner ? owner.color : "var(--muted)" }}
          >
            {isCurrent ? (
              <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-foreground" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
