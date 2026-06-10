"use client"

import * as React from "react"

import { type Segment } from "@/lib/segments"
import { cn } from "@/lib/utils"

export interface SegmentLegendProps {
  segments: Segment[]
  /** Highlighted segment id (shared hover/selection). Dims the others. */
  activeId?: string | null
  onActivate?: (id: string | null) => void
  onSelect?: (id: string) => void
  /** 1-based current page; segments that own it render bold ("active"). */
  currentPage?: number | null
  /** Lay entries out on a grid of N columns instead of wrapping inline. */
  columns?: number
  /** Render a "Show all / Hide unused" toggle when some segments own no pages. */
  showUnusedToggle?: boolean
  /** Initial/forced visibility of zero-page segments. */
  showUnused?: boolean
  className?: string
}

/**
 * Compact color legend: one swatch + label per segment. Hovering raises
 * `activeId` (dims the others); segments containing `currentPage` render bold.
 * Zero-page segments are hidden unless shown via the toggle.
 */
export function SegmentLegend({
  segments,
  activeId,
  onActivate,
  onSelect,
  currentPage,
  columns,
  showUnusedToggle = false,
  showUnused = false,
  className,
}: SegmentLegendProps) {
  const [showAll, setShowAll] = React.useState(showUnused)
  const reveal = showUnused || showAll
  const visible = reveal ? segments : segments.filter((s) => s.pages.length > 0)
  const hasHidden = segments.some((s) => s.pages.length === 0)

  if (visible.length === 0) return null

  const containsCurrent = (s: Segment) =>
    currentPage != null && s.pages.includes(currentPage)

  return (
    <div data-slot="segment-legend" className={className}>
      <div
        className={cn(
          columns
            ? "grid gap-x-4 gap-y-1.5"
            : "flex flex-wrap items-center gap-x-4 gap-y-1.5"
        )}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {visible.map((segment) => {
          const active = activeId === segment.id
          const dimmed = activeId != null && !active
          const current = containsCurrent(segment)
          return (
            <button
              key={segment.id}
              type="button"
              data-active={active}
              title={segment.label}
              onMouseEnter={() => onActivate?.(segment.id)}
              onMouseLeave={() => onActivate?.(null)}
              onClick={() => onSelect?.(segment.id)}
              className={cn(
                "flex min-w-0 items-center gap-2 text-xs transition-opacity",
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
                  active || current
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
      {showUnusedToggle && hasHidden ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {reveal ? "Hide unused" : "Show all"}
        </button>
      ) : null}
    </div>
  )
}
