"use client"

import * as React from "react"

import {
  getSegmentSurfaceProps,
  scopeSegmentInteraction,
  type SegmentInteraction,
} from "@/lib/segment-interaction"
import {
  formatPageRanges,
  segmentDisplayLabel,
  segmentPageCount,
  type Segment,
} from "@/lib/segments"
import { cn } from "@/lib/utils"

export interface SegmentSidebarProps {
  segments: Segment[]
  /** Shared hover/focus state. */
  interaction?: SegmentInteraction
  /** Fired when a segment surface is clicked. */
  onSelect?: (segment: Segment) => void
  /** 1-based current page; owning segments receive current-page state. */
  currentPage?: number | null
  /** Noun for a row, e.g. "chunk" (partition) or "subdocument" (split). */
  unitLabel?: string
  /** Show segments with zero pages too. */
  showUnused?: boolean
  className?: string
}

/**
 * A navigable list of segments — the "sidebar" surface. Each row shows the
 * color swatch, label, page ranges, page count, and (when present) a confidence
 * bar. Hovering and focusing preview the segment; clicking fires `onSelect`
 * for host side effects like document scrolling.
 */
export function SegmentSidebar({
  segments,
  interaction,
  onSelect,
  currentPage,
  unitLabel = "segment",
  showUnused = true,
  className,
}: SegmentSidebarProps) {
  const visible = showUnused
    ? segments
    : segments.filter((s) => segmentPageCount(s.pages) > 0)
  const scopedInteraction = React.useMemo(
    () =>
      scopeSegmentInteraction(
        interaction,
        visible.map((segment) => segment.id)
      ),
    [interaction, visible]
  )

  return (
    <div
      data-slot="segment-sidebar"
      onMouseLeave={() => scopedInteraction?.clearPreview()}
      className={cn("flex min-h-0 flex-col", className)}
    >
      <div className="flex-shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">
        {visible.length} {unitLabel}
        {visible.length === 1 ? "" : "s"}
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2">
        {visible.map((segment, segmentPosition) => {
          const { state, eventHandlers, dataProps } = getSegmentSurfaceProps({
            segment,
            interaction: scopedInteraction,
            currentPage,
            onSelect,
          })
          const label = segmentDisplayLabel(segment.label)
          const pageCount = segmentPageCount(segment.pages)
          return (
            <li key={`${segment.id}-${segmentPosition}`}>
              <button
                type="button"
                {...dataProps}
                {...eventHandlers}
                aria-current={state.isCurrent ? "page" : undefined}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  state.isActive
                    ? "border-border bg-muted"
                    : "border-transparent hover:bg-muted/50",
                  state.isDimmed && "opacity-60"
                )}
              >
                <span
                  aria-hidden
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[3px] ring-1 ring-black/20"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {segment.label.trim() ? (
                      label
                    ) : (
                      <span className="text-muted-foreground italic">
                        unnamed
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {pageCount === 0
                      ? "no pages"
                      : `${pageCount} page${
                          pageCount === 1 ? "" : "s"
                        } · ${formatPageRanges(segment.pages)}`}
                  </span>
                  {segment.confidence != null ? (
                    <ConfidenceBar value={segment.confidence} />
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const safeValue = Number.isFinite(value) ? value : 0
  const pct = Math.round(Math.max(0, Math.min(1, safeValue)) * 100)
  return (
    <span className="mt-0.5 flex items-center gap-1.5">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-muted-foreground/20">
        <span
          className="block h-full rounded-full bg-foreground/60"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {pct}%
      </span>
    </span>
  )
}
