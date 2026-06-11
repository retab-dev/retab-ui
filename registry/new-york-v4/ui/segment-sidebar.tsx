"use client"

import * as React from "react"

import { type Segment, formatPageRanges } from "@/lib/segments"
import { cn } from "@/lib/utils"

export interface SegmentSidebarProps {
  segments: Segment[]
  /** Highlighted segment (hover or selection). */
  activeId?: string | null
  onActivate?: (id: string | null) => void
  /** Fired on click — e.g. to jump the document to the segment's first page. */
  onSelect?: (segment: Segment) => void
  /** Noun for a row, e.g. "chunk" (partition) or "subdocument" (split). */
  unitLabel?: string
  /** Show segments with zero pages too. */
  showUnused?: boolean
  className?: string
}

/**
 * A selectable list of segments — the "sidebar" surface. Each row shows the
 * color swatch, label, page ranges, page count, and (when present) a confidence
 * bar. Hovering raises `activeId`; clicking fires `onSelect` so the host can
 * scroll the document to that segment.
 */
export function SegmentSidebar({
  segments,
  activeId,
  onActivate,
  onSelect,
  unitLabel = "segment",
  showUnused = true,
  className,
}: SegmentSidebarProps) {
  const visible = showUnused
    ? segments
    : segments.filter((s) => s.pages.length > 0)

  return (
    <div
      data-slot="segment-sidebar"
      className={cn("flex min-h-0 flex-col", className)}
    >
      <div className="flex-shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">
        {visible.length} {unitLabel}
        {visible.length === 1 ? "" : "s"}
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2">
        {visible.map((segment) => {
          const active = activeId === segment.id
          const dimmed = activeId != null && !active
          return (
            <li key={segment.id}>
              <button
                type="button"
                data-active={active}
                onMouseEnter={() => onActivate?.(segment.id)}
                onMouseLeave={() => onActivate?.(null)}
                onClick={() => onSelect?.(segment)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-border bg-muted"
                    : "border-transparent hover:bg-muted/50",
                  dimmed && "opacity-60"
                )}
              >
                <span
                  aria-hidden
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[3px] ring-1 ring-black/20"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {segment.label || (
                      <span className="text-muted-foreground italic">
                        unnamed
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {segment.pages.length === 0
                      ? "no pages"
                      : `${segment.pages.length} page${
                          segment.pages.length === 1 ? "" : "s"
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
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <span className="mt-0.5 flex items-center gap-1.5">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-muted-foreground/20">
        <span
          className="block h-full rounded-full bg-foreground/60"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </span>
  )
}
