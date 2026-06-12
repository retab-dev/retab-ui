"use client"

import * as React from "react"

import {
  getSegmentSurfaceProps,
  resolveHighlightedSegmentId,
  scopeSegmentInteraction,
  type SegmentInteraction,
} from "@/lib/segment-interaction"
import {
  normalizePageCount,
  segmentDisplayLabel,
  segmentsPageCount,
  type Segment,
} from "@/lib/segments"
import { cn } from "@/lib/utils"

export interface PageTimelineProps {
  segments: Segment[]
  /** Total pages; defaults to the max page across segments. */
  pageCount?: number
  /** Shared hover/focus/selection state. */
  interaction?: SegmentInteraction
  /** 1-based current page to mark (e.g. synced to a PDF scroll position). */
  currentPage?: number | null
  /** Fired when a page cell is clicked. */
  onSelectPage?: (page: number) => void
  /** Fired when a segment surface is clicked, after shared selection is requested. */
  onSelect?: (segment: Segment) => void
  className?: string
}

interface TimelinePageSegment {
  segmentIndexes: number[]
  primarySegment?: Segment
  label: string
}

/**
 * A horizontal strip of page cells colored by the segment mapped to each page.
 * It ties the legend and sidebar to the document: hovering a cell highlights its
 * segment, highlighting a segment elsewhere dims unrelated pages, and clicking
 * a cell jumps the document. If multiple segments map to a page, the first
 * segment in document order is selected and the page label calls out the overlap.
 */
export function PageTimeline({
  segments,
  pageCount,
  interaction,
  currentPage,
  onSelectPage,
  onSelect,
  className,
}: PageTimelineProps) {
  const total = normalizePageCount(pageCount ?? segmentsPageCount(segments))
  const segmentIndexesByPage = React.useMemo(
    () => buildPageSegmentIndexes(segments),
    [segments]
  )
  const segmentByIndex = React.useMemo(
    () => buildSegmentByIndex(segments),
    [segments]
  )
  const segmentIndexById = React.useMemo(
    () => buildSegmentIndexById(segments),
    [segments]
  )
  const scopedInteraction = React.useMemo(
    () =>
      scopeSegmentInteraction(
        interaction,
        segments
          .filter((segment) =>
            segment.pages.some(
              (page) => Number.isInteger(page) && page >= 1 && page <= total
            )
          )
          .map((segment) => segment.id)
      ),
    [interaction, segments, total]
  )

  if (total <= 0) return null
  const highlightedSegmentId = resolveHighlightedSegmentId(scopedInteraction)
  const highlightedSegmentIndex = getHighlightedSegmentIndex({
    highlightedSegmentId,
    segmentIndexById,
  })

  return (
    <div
      data-slot="page-timeline"
      className={cn(
        "flex items-stretch gap-px overflow-hidden rounded-md",
        className
      )}
    >
      {Array.from({ length: total }, (_, i) => {
        const page = i + 1
        const pageSegment = getTimelinePageSegment({
          page,
          segmentIndexesByPage,
          segmentByIndex,
        })
        const { segmentIndexes, primarySegment } = pageSegment
        const surfaceProps = primarySegment
          ? getSegmentSurfaceProps({
              segment: primarySegment,
              interaction: scopedInteraction,
              isCurrent: currentPage === page,
              onSelect,
            })
          : null
        const dimmed =
          highlightedSegmentIndex != null
            ? !segmentIndexes.includes(highlightedSegmentIndex)
            : false
        const isCurrent = currentPage === page
        return (
          <button
            key={page}
            type="button"
            aria-current={isCurrent ? "page" : undefined}
            aria-pressed={surfaceProps?.state.isSelected ?? false}
            aria-label={pageSegment.label}
            title={pageSegment.label}
            onMouseEnter={surfaceProps?.eventHandlers.onMouseEnter}
            onMouseLeave={surfaceProps?.eventHandlers.onMouseLeave}
            onFocus={surfaceProps?.eventHandlers.onFocus}
            onBlur={surfaceProps?.eventHandlers.onBlur}
            onClick={() => {
              surfaceProps?.eventHandlers.onClick()
              onSelectPage?.(page)
            }}
            data-highlighted={surfaceProps?.state.isHighlighted ?? false}
            data-current={isCurrent}
            data-selected={surfaceProps?.state.isSelected ?? false}
            className={cn(
              "group relative h-7 flex-1 transition-opacity focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              dimmed ? "opacity-25" : "opacity-100"
            )}
            style={{
              backgroundColor: primarySegment
                ? primarySegment.color
                : "var(--muted)",
            }}
          >
            {isCurrent ? (
              <span className="pointer-events-none absolute inset-0 ring-2 ring-foreground ring-inset" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function buildSegmentByIndex(segments: Segment[]): Map<number, Segment> {
  const map = new Map<number, Segment>()
  segments.forEach((segment, index) => map.set(index, segment))
  return map
}

function buildSegmentIndexById(segments: Segment[]): Map<string, number> {
  const map = new Map<string, number>()
  segments.forEach((segment, index) => map.set(segment.id, index))
  return map
}

function buildPageSegmentIndexes(segments: Segment[]): Map<number, number[]> {
  const owners = new Map<number, number[]>()
  segments.forEach((segment, index) => {
    segment.pages.forEach((page) => {
      if (!Number.isInteger(page) || page <= 0) return
      const list = owners.get(page) ?? []
      list.push(index)
      owners.set(page, list)
    })
  })
  return owners
}

function getTimelinePageSegment({
  page,
  segmentIndexesByPage,
  segmentByIndex,
}: {
  page: number
  segmentIndexesByPage: Map<number, number[]>
  segmentByIndex: Map<number, Segment>
}): TimelinePageSegment {
  const segmentIndexes = segmentIndexesByPage.get(page) ?? []
  const primarySegment = segmentIndexes.length
    ? segmentByIndex.get(segmentIndexes[0])
    : undefined
  const segmentLabel =
    segmentIndexes.length > 1
      ? `${segmentIndexes.length} segments`
      : primarySegment
        ? segmentDisplayLabel(primarySegment.label)
        : undefined

  return {
    segmentIndexes,
    primarySegment,
    label: `Page ${page}${segmentLabel ? ` · ${segmentLabel}` : ""}`,
  }
}

function getHighlightedSegmentIndex({
  highlightedSegmentId,
  segmentIndexById,
}: {
  highlightedSegmentId: string | null
  segmentIndexById: Map<string, number>
}): number | undefined {
  return highlightedSegmentId
    ? segmentIndexById.get(highlightedSegmentId)
    : undefined
}
