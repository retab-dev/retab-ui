"use client"

import * as React from "react"

import { type SegmentInteraction } from "@/lib/segment-interaction"
import { normalizePageCount, type Segment } from "@/lib/segments"
import { cn } from "@/lib/utils"

import { PageRibbon } from "./page-ribbon"

export type SegmentPageRailApi = {
  setViewportElement: (element: HTMLElement | null) => void
  setPageElement: (page: number, element: HTMLElement | null) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onScroll: () => void
}

export interface SegmentPageRailProps {
  segments: Segment[]
  pageCount: number
  currentPage?: number | null
  scrollProgress?: number | null
  interaction?: SegmentInteraction
  railApi: SegmentPageRailApi
  onSelectPage?: (page: number) => void
  onSelect?: (segment: Segment) => void
  showTicks?: boolean
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
  className,
}: SegmentPageRailProps) {
  const total = normalizePageCount(pageCount)
  if (total <= 0) return null

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
        "flex h-full min-h-0 flex-col overflow-hidden border-r border-border bg-background px-3 py-6",
        className
      )}
    >
      <div
        data-slot="segment-page-rail-content"
        className="relative min-h-0 flex-1"
      >
        <PageRibbon
          orientation="vertical"
          rows={[{ id: "segment-page-rail", segments }]}
          pageCount={total}
          currentPage={currentPage}
          scrollProgress={scrollProgress}
          interaction={interaction}
          onSelectPage={onSelectPage}
          onSelect={onSelect}
          showTicks={showTicks}
          className="h-full min-h-0"
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
