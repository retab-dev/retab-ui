"use client"

import * as React from "react"

import {
  getSegmentInteractionState,
  getSegmentSurfaceProps,
  scopeSegmentInteraction,
  type SegmentInteraction,
} from "@/lib/segment-interaction"
import {
  buildPageRuns,
  normalizePageCount,
  segmentDisplayLabel,
} from "@/lib/segments"
import { cn } from "@/lib/utils"

import type { DocumentSegment } from "./segmented-document-model"

/** One lane of the ribbon: segments positioned by their page ranges. */
export interface RibbonRow {
  id: string
  label?: string
  segments: DocumentSegment[]
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
  /** Shared preview state. */
  interaction?: SegmentInteraction
  /** Click a segment → jump the document to its first page. */
  onSelectPage?: (page: number) => void
  /** Fired when a segment surface is clicked. */
  onSelect?: (segment: DocumentSegment) => void
  showTicks?: boolean
  /** Thickness of each row: column width (vertical) or row height (horizontal), px. */
  rowThickness?: number
  className?: string
}

/**
 * A page-axis ribbon: every segment is drawn as a block spanning its pages.
 * One vertical row with tiled segments is the split sidebar; many horizontal
 * rows (consensus + votes) is the partition waterfall — same component, same
 * `Segment[]` model. Driven by shared interaction state so hovering a segment
 * here dims the others in the legend too.
 */
export function PageRibbon({
  rows,
  pageCount,
  orientation = "horizontal",
  currentPage,
  scrollProgress,
  interaction,
  onSelectPage,
  onSelect,
  showTicks = false,
  rowThickness,
  className,
}: PageRibbonProps) {
  const vertical = orientation === "vertical"
  const total = normalizePageCount(pageCount)
  const defaultThickness = vertical ? 44 : 10
  const thickness =
    rowThickness != null && Number.isFinite(rowThickness) && rowThickness > 0
      ? rowThickness
      : defaultThickness
  const visibleSegments = React.useMemo(
    () =>
      rows.flatMap((row) =>
        row.segments.filter(
          (segment) => buildVisiblePageRuns(segment.pages, total).length > 0
        )
      ),
    [rows, total]
  )
  const scopedInteraction = React.useMemo(
    () =>
      scopeSegmentInteraction(
        interaction,
        visibleSegments.map((segment) => segment.id)
      ),
    [interaction, visibleSegments]
  )
  const interactionState = React.useMemo(
    () =>
      getSegmentInteractionState({
        segments: visibleSegments,
        currentPage,
        interaction: scopedInteraction,
      }),
    [currentPage, scopedInteraction, visibleSegments]
  )
  if (total <= 0 || rows.length === 0) return null

  const ticks = showTicks ? buildTicks(total) : []
  const cursorPct =
    scrollProgress != null && Number.isFinite(scrollProgress)
      ? clamp01(scrollProgress) * 100
      : currentPage != null && Number.isFinite(currentPage)
        ? ((clamp(currentPage, 1, total) - 0.5) / total) * 100
        : null

  return (
    <div
      data-slot="page-ribbon"
      data-orientation={orientation}
      onMouseLeave={() => scopedInteraction?.clearPreview()}
      className={cn(
        "relative flex",
        vertical ? "h-full flex-row gap-1" : "w-full flex-col gap-px",
        className
      )}
    >
      {rows.map((row, rowPosition) => (
        <div
          key={`${row.id}-${rowPosition}`}
          data-slot="page-ribbon-row"
          title={row.label}
          className={cn("relative overflow-hidden rounded-[3px] bg-muted")}
          style={vertical ? { width: thickness } : { height: thickness }}
        >
          {row.segments.flatMap((segment, segmentPosition) =>
            buildVisiblePageRuns(segment.pages, total).map(
              ([start, end], i) => {
                const label = segmentDisplayLabel(segment.label)
                const offsetPct = ((start - 1) / total) * 100
                const sizePct = ((end - start + 1) / total) * 100
                const isCurrent =
                  currentPage != null &&
                  currentPage >= start &&
                  currentPage <= end
                const { state, eventHandlers, dataProps } =
                  getSegmentSurfaceProps({
                    segment,
                    interaction: scopedInteraction,
                    interactionState,
                    isCurrent,
                    onSelect,
                  })
                const style: React.CSSProperties = vertical
                  ? {
                      top: `${offsetPct}%`,
                      height: `max(${sizePct}%, 2px)`,
                      left: 0,
                      right: 0,
                    }
                  : {
                      left: `${offsetPct}%`,
                      width: `${sizePct}%`,
                      top: 0,
                      bottom: 0,
                    }
                return (
                  <button
                    key={`${segment.id}-${segmentPosition}-${i}`}
                    type="button"
                    {...dataProps}
                    title={`${label} · pages ${start}${end > start ? `–${end}` : ""}`}
                    onClick={() => {
                      eventHandlers.onClick()
                      onSelectPage?.(start)
                    }}
                    onPointerEnter={eventHandlers.onPointerEnter}
                    onPointerLeave={eventHandlers.onPointerLeave}
                    className={cn(
                      "absolute cursor-pointer transition-opacity before:absolute before:-inset-1 before:content-[''] hover:brightness-110 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      state.isDimmed
                        ? "opacity-30"
                        : isCurrent
                          ? "opacity-100"
                          : "opacity-85"
                    )}
                    style={{
                      ...style,
                      backgroundColor: segment.color,
                      boxShadow: state.isHighlighted
                        ? "inset 0 0 0 1.5px rgb(24 24 27)"
                        : undefined,
                    }}
                    aria-label={`${label} pages ${start} to ${end}`}
                  />
                )
              }
            )
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
          style={
            vertical ? { top: `${cursorPct}%` } : { left: `${cursorPct}%` }
          }
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
        // Vertical: an in-flow column so the ribbon's width includes the labels
        // (the aside sizes to fit, no overflow). Horizontal: a strip below.
        <div
          aria-hidden
          className={cn(
            "font-mono text-[9px] text-muted-foreground tabular-nums",
            vertical
              ? "relative w-4 flex-shrink-0"
              : "pointer-events-none absolute top-full left-0 mt-0.5 w-full"
          )}
        >
          {ticks.map((page) => {
            const pct = ((page - 1) / total) * 100
            return (
              <span
                key={page}
                className={cn("absolute leading-none", vertical && "left-0")}
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
  if (pageCount !== 1) ticks.push(pageCount)
  return ticks
}

function buildVisiblePageRuns(
  pages: number[],
  pageCount: number
): Array<[number, number]> {
  if (pageCount <= 0) return []
  return buildPageRuns(pages)
    .map(
      ([start, end]) => [start, Math.min(end, pageCount)] as [number, number]
    )
    .filter(([start, end]) => start <= pageCount && end >= 1 && start <= end)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
function clamp01(v: number) {
  return clamp(v, 0, 1)
}
