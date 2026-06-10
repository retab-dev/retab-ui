"use client"

import * as React from "react"

import { type Segment, buildPageRuns } from "@/lib/segments"
import { cn } from "@/lib/utils"

/** One lane of the ribbon: segments positioned by their page ranges. */
export interface RibbonRow {
  id: string
  label?: string
  segments: Segment[]
}

export interface PageRibbonProps {
  rows: RibbonRow[]
  pageCount: number
  /** "vertical" — pages run top→bottom (split sidebar). "horizontal" — left→right (partition waterfall). */
  orientation?: "vertical" | "horizontal"
  /** 1-based current page; drawn as a cursor line + caret across the rows. */
  currentPage?: number | null
  /** 0..1 fine-grained scroll cursor (horizontal only); overrides the page line. */
  scrollProgress?: number | null
  /** Highlighted segment id (shared hover/selection). */
  activeId?: string | null
  onActivate?: (id: string | null) => void
  /** Click a segment → jump the document to its first page. */
  onSelectPage?: (page: number) => void
  showTicks?: boolean
  /** Thickness of each row: column width (vertical) or row height (horizontal), px. */
  rowThickness?: number
  className?: string
}

/**
 * A page-axis ribbon: every segment is drawn as a block spanning its pages.
 * One vertical row with tiled segments is the split sidebar; many horizontal
 * rows (consensus + votes) is the partition waterfall — same component, same
 * `Segment[]` model. Driven by a shared `activeId` so hovering a segment here
 * dims the others in the legend too.
 */
export function PageRibbon({
  rows,
  pageCount,
  orientation = "horizontal",
  currentPage,
  scrollProgress,
  activeId,
  onActivate,
  onSelectPage,
  showTicks = false,
  rowThickness,
  className,
}: PageRibbonProps) {
  const vertical = orientation === "vertical"
  const thickness = rowThickness ?? (vertical ? 44 : 10)
  if (pageCount <= 0 || rows.length === 0) return null

  const ticks = showTicks ? buildTicks(pageCount) : []
  const cursorPct =
    scrollProgress != null
      ? clamp01(scrollProgress) * 100
      : currentPage != null
        ? ((clamp(currentPage, 1, pageCount) - 0.5) / pageCount) * 100
        : null

  return (
    <div
      data-slot="page-ribbon"
      data-orientation={orientation}
      className={cn(
        "relative flex",
        vertical ? "h-full flex-row gap-1" : "w-full flex-col gap-px",
        className
      )}
    >
      {rows.map((row) => (
        <div
          key={row.id}
          data-slot="page-ribbon-row"
          title={row.label}
          className={cn("relative overflow-hidden rounded-[3px] bg-muted")}
          style={vertical ? { width: thickness } : { height: thickness }}
        >
          {row.segments.flatMap((segment) =>
            buildPageRuns(segment.pages).map(([start, end], i) => {
              const offsetPct = ((start - 1) / pageCount) * 100
              const sizePct = ((end - start + 1) / pageCount) * 100
              const active = activeId === segment.id
              const dimmed = activeId != null && !active
              const isCurrent =
                currentPage != null && currentPage >= start && currentPage <= end
              const style: React.CSSProperties = vertical
                ? { top: `${offsetPct}%`, height: `max(${sizePct}%, 2px)`, left: 0, right: 0 }
                : { left: `${offsetPct}%`, width: `${sizePct}%`, top: 0, bottom: 0 }
              return (
                <button
                  key={`${segment.id}-${i}`}
                  type="button"
                  title={`${segment.label} · pages ${start}${end > start ? `–${end}` : ""}`}
                  onMouseEnter={() => onActivate?.(segment.id)}
                  onMouseLeave={() => onActivate?.(null)}
                  onClick={() => onSelectPage?.(start)}
                  className={cn(
                    "absolute cursor-pointer transition-opacity hover:brightness-110 focus-visible:outline-none",
                    dimmed ? "opacity-30" : isCurrent ? "opacity-100" : "opacity-85"
                  )}
                  style={{
                    ...style,
                    backgroundColor: segment.color,
                    boxShadow:
                      active || isCurrent ? "inset 0 0 0 1.5px rgb(24 24 27)" : undefined,
                  }}
                  aria-label={`${segment.label} pages ${start} to ${end}`}
                />
              )
            })
          )}
        </div>
      ))}

      {cursorPct != null ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute bg-foreground",
            vertical ? "inset-x-0 h-px" : "inset-y-0 w-px"
          )}
          style={vertical ? { top: `${cursorPct}%` } : { left: `${cursorPct}%` }}
        >
          <span
            className={cn(
              "absolute h-0 w-0 border-transparent border-l-foreground",
              vertical
                ? "top-[-4px] left-[-7px] border-y-[4px] border-l-[7px]"
                : "hidden"
            )}
          />
        </div>
      ) : null}

      {ticks.length > 0 ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute font-mono text-[9px] text-muted-foreground tabular-nums",
            vertical ? "top-0 left-full ml-1 h-full" : "top-full left-0 mt-0.5 w-full"
          )}
        >
          {ticks.map((page) => {
            const pct = ((page - 1) / pageCount) * 100
            return (
              <span
                key={page}
                className="absolute leading-none"
                style={
                  vertical
                    ? { top: `${pct}%`, transform: "translateY(-50%)" }
                    : { left: `${pct}%`, transform: "translateX(-50%)" }
                }
              >
                {page}
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function buildTicks(pageCount: number): number[] {
  if (pageCount <= 0) return []
  const step = Math.max(5, Math.round(pageCount / 10 / 5) * 5)
  const ticks = [1]
  for (let p = step; p < pageCount; p += step) ticks.push(p)
  ticks.push(pageCount)
  return ticks
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
function clamp01(v: number) {
  return clamp(v, 0, 1)
}
