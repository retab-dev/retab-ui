"use client"

import * as React from "react"

import { type SegmentInteraction } from "@/lib/segment-interaction"
import { normalizePageCount, type Segment } from "@/lib/segments"
import { cn } from "@/lib/utils"
import { PageRibbon } from "@/components/ui/page-ribbon"

import { type SegmentViewportController } from "./use-segment-viewport-controller"

const DEFAULT_PAGE_HEIGHT = 48

export interface SegmentPageRailProps {
  segments: Segment[]
  pageCount: number
  currentPage?: number | null
  scrollProgress?: number | null
  interaction?: SegmentInteraction
  railApi: SegmentViewportController["rail"]
  onSelectPage?: (page: number) => void
  onSelect?: (segment: Segment) => void
  showTicks?: boolean
  pageHeight?: number
  className?: string
}

export function SegmentPageRail({
  segments,
  pageCount,
  currentPage,
  scrollProgress,
  interaction,
  railApi,
  onSelectPage,
  onSelect,
  showTicks = true,
  pageHeight = DEFAULT_PAGE_HEIGHT,
  className,
}: SegmentPageRailProps) {
  const total = normalizePageCount(pageCount)
  if (total <= 0) return null

  const safePageHeight =
    Number.isFinite(pageHeight) && pageHeight > 0
      ? pageHeight
      : DEFAULT_PAGE_HEIGHT
  const contentHeight = Math.max(total * safePageHeight, safePageHeight)
  const {
    onPointerEnter,
    onPointerLeave,
    onScroll,
    setPageElement,
    setViewportElement,
  } = railApi

  return (
    <div
      ref={setViewportElement}
      data-slot="segment-page-rail"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onScroll={onScroll}
      className={cn(
        "h-full overflow-auto border-r border-border bg-background px-3 py-6",
        className
      )}
    >
      <div
        data-slot="segment-page-rail-content"
        className="relative min-h-full"
        style={{ height: contentHeight }}
      >
        <PageRibbon
          orientation="vertical"
          rows={[{ id: "split", segments }]}
          pageCount={total}
          currentPage={currentPage}
          scrollProgress={scrollProgress}
          interaction={interaction}
          onSelectPage={onSelectPage}
          onSelect={onSelect}
          showTicks={showTicks}
          className="h-full"
        />
        {Array.from({ length: total }, (_, index) => {
          const page = index + 1
          const topPct = ((page - 0.5) / total) * 100

          return (
            <span
              key={page}
              ref={(element) => setPageElement(page, element)}
              aria-hidden
              data-page-number={page}
              data-slot="segment-page-rail-page-marker"
              className="pointer-events-none absolute left-0 h-px w-px opacity-0"
              style={{ top: `${topPct}%` }}
            />
          )
        })}
      </div>
    </div>
  )
}
