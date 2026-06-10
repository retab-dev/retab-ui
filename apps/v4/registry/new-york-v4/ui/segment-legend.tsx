"use client"

import * as React from "react"

import { type Segment } from "@/lib/segments"
import { cn } from "@/lib/utils"

export interface SegmentLegendProps {
  segments: Segment[]
  /** Currently highlighted segment id (hover/selection), if any. */
  activeId?: string | null
  onActivate?: (id: string | null) => void
  onSelect?: (id: string) => void
  /** Show segments with zero pages too. Defaults to false (hide unused). */
  showUnused?: boolean
  className?: string
}

/**
 * Compact color legend: one swatch + label per segment. Hovering or selecting
 * an entry raises `activeId`, which the document/timeline can react to. Segments
 * that own no pages are hidden unless `showUnused` is set.
 */
export function SegmentLegend({
  segments,
  activeId,
  onActivate,
  onSelect,
  showUnused = false,
  className,
}: SegmentLegendProps) {
  const visible = showUnused
    ? segments
    : segments.filter((s) => s.pages.length > 0)

  if (visible.length === 0) return null

  return (
    <div
      data-slot="segment-legend"
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}
    >
      {visible.map((segment) => {
        const dimmed = activeId != null && activeId !== segment.id
        return (
          <button
            key={segment.id}
            type="button"
            data-active={activeId === segment.id}
            onMouseEnter={() => onActivate?.(segment.id)}
            onMouseLeave={() => onActivate?.(null)}
            onClick={() => onSelect?.(segment.id)}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded text-xs transition-opacity",
              dimmed ? "opacity-40" : "opacity-100"
            )}
          >
            <span
              aria-hidden
              className="h-3 w-5 shrink-0 rounded-[2px] ring-1 ring-black/20"
              style={{ backgroundColor: segment.color }}
            />
            <span
              className={cn(
                "truncate",
                activeId === segment.id
                  ? "font-semibold text-foreground"
                  : "font-normal text-muted-foreground"
              )}
            >
              {segment.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
