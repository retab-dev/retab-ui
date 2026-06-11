"use client"

import * as React from "react"

import { type Segment } from "@/lib/segments"
import { cn } from "@/lib/utils"

/** How the legend attaches to the document surface. */
export type SegmentLegendVariant = "bar" | "floating" | "plain"
export type SegmentLegendOrientation = "horizontal" | "vertical"
export type SegmentLegendSide = "top" | "bottom" | "left" | "right"
export type SegmentLegendDensity = "comfortable" | "compact"

export interface SegmentLegendProps {
  segments: Segment[]
  /**
   * How the legend attaches to the document surface:
   * - `bar` — flush, full-width, bordered on its docking side (default).
   * - `floating` — an overlay card pinned to a corner; needs a `relative` parent.
   * - `plain` — raw entries, no chrome (compose your own container).
   * @default "bar"
   */
  variant?: SegmentLegendVariant
  /** Lay entries out horizontally (wrap/grid) or vertically (rail). @default "horizontal" */
  orientation?: SegmentLegendOrientation
  /** Edge the legend docks to — drives the border (`bar`) or anchor (`floating`). */
  side?: SegmentLegendSide
  /** Swatch + label scale. @default "comfortable" */
  density?: SegmentLegendDensity
  /** Highlighted segment id (shared hover/selection). Dims the others. */
  activeId?: string | null
  onActivate?: (id: string | null) => void
  onSelect?: (id: string) => void
  /** 1-based current page; segments that own it render bold ("active"). */
  currentPage?: number | null
  /** Lay entries out on a grid of N columns instead of wrapping inline (horizontal only). */
  columns?: number
  /** Render a "Show all / Hide unused" toggle when some segments own no pages. */
  showUnusedToggle?: boolean
  /** Initial/forced visibility of zero-page segments. */
  showUnused?: boolean
  /** A muted caption rendered under the entries (e.g. a classification's reasoning). */
  caption?: React.ReactNode
  className?: string
}

const DENSITY = {
  comfortable: { swatch: "h-3 w-5", text: "text-xs", gap: "gap-x-4 gap-y-1.5" },
  compact: { swatch: "h-2.5 w-4", text: "text-[11px]", gap: "gap-x-3 gap-y-1" },
} as const

const DOCK_BORDER: Record<SegmentLegendSide, string> = {
  top: "border-b",
  bottom: "border-t",
  left: "border-r",
  right: "border-l",
}

const FLOAT_ANCHOR: Record<SegmentLegendSide, string> = {
  top: "absolute left-3 top-3",
  bottom: "absolute bottom-3 left-3",
  left: "absolute left-3 top-3",
  right: "absolute right-3 top-3",
}

/**
 * Compact color legend: one swatch + label per segment. Hovering raises
 * `activeId` (dims the others); segments containing `currentPage` render bold.
 * Zero-page segments are hidden unless shown via the toggle.
 *
 * `variant` controls how it sits on the document surface (flush bar, floating
 * overlay, or unstyled) so the same legend works for the classify, split, and
 * partition viewers without each one re-building its own chrome.
 */
export function SegmentLegend({
  segments,
  variant = "bar",
  orientation = "horizontal",
  side,
  density = "comfortable",
  activeId,
  onActivate,
  onSelect,
  currentPage,
  columns,
  showUnusedToggle = false,
  showUnused = false,
  caption,
  className,
}: SegmentLegendProps) {
  const [showAll, setShowAll] = React.useState(showUnused)
  const reveal = showUnused || showAll
  const visible = reveal ? segments : segments.filter((s) => s.pages.length > 0)
  const hasHidden = segments.some((s) => s.pages.length === 0)

  if (visible.length === 0) return null

  const d = DENSITY[density]
  const dockSide = side ?? (orientation === "vertical" ? "left" : "top")
  const isVertical = orientation === "vertical"

  const chrome = {
    bar: cn("bg-background px-3 py-2", DOCK_BORDER[dockSide]),
    floating: cn(
      "z-10 rounded-lg border bg-background/90 px-3 py-2 shadow-md backdrop-blur",
      FLOAT_ANCHOR[dockSide]
    ),
    plain: "",
  }[variant]

  const containsCurrent = (s: Segment) =>
    currentPage != null && s.pages.includes(currentPage)

  return (
    <div data-slot="segment-legend" data-variant={variant} className={cn(chrome, className)}>
      <div
        className={cn(
          d.gap,
          isVertical
            ? "flex flex-col"
            : columns
              ? "grid"
              : "flex flex-wrap items-center"
        )}
        style={
          !isVertical && columns
            ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
            : undefined
        }
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
                "flex min-w-0 items-center gap-2 transition-opacity",
                d.text,
                dimmed ? "opacity-40" : "opacity-100"
              )}
            >
              <span
                aria-hidden
                className={cn("shrink-0 rounded-[2px]", d.swatch)}
                style={{ backgroundColor: segment.color }}
              />
              {/* Reserve the bold width up front: an always-semibold but
                  invisible copy sizes the slot, and the visible label overlays
                  it — so toggling bold on the active item can't shift the layout. */}
              <span className="grid min-w-0">
                <span
                  aria-hidden
                  className="invisible col-start-1 row-start-1 truncate font-semibold"
                >
                  {segment.label}
                </span>
                <span
                  className={cn(
                    "col-start-1 row-start-1 truncate",
                    active || current
                      ? "font-semibold text-foreground"
                      : "font-normal text-muted-foreground"
                  )}
                >
                  {segment.label}
                </span>
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
      {caption ? (
        <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {caption}
        </div>
      ) : null}
    </div>
  )
}
