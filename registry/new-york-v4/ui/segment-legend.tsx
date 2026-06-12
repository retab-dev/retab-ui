"use client"

import * as React from "react"

import {
  getSegmentSurfaceProps,
  scopeSegmentInteraction,
  type SegmentInteraction,
} from "@/lib/segment-interaction"
import {
  segmentDisplayLabel,
  segmentPageCount,
  type Segment,
} from "@/lib/segments"
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
  /** Shared hover/focus/selection state. */
  interaction?: SegmentInteraction
  /** Fired when a segment surface is clicked, after shared selection is requested. */
  onSelect?: (segment: Segment) => void
  /** 1-based current page; owning segments receive current-page styling. */
  currentPage?: number | null
  /** Lay entries out on a grid of N columns instead of wrapping inline (horizontal only). */
  columns?: number
  /** Render a "Show all / Hide unused" toggle when some segments own no pages. */
  showUnusedToggle?: boolean
  /** Controlled visibility of zero-page segments. */
  showUnused?: boolean
  /** Initial visibility of zero-page segments when `showUnused` is uncontrolled. */
  defaultShowUnused?: boolean
  onShowUnusedChange?: (showUnused: boolean) => void
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
 * Compact color legend: one swatch + label per segment. Hovering, focusing, or
 * selecting highlights that segment and dims the others. Segments containing
 * `currentPage` receive separate current-page styling.
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
  interaction,
  onSelect,
  currentPage,
  columns,
  showUnusedToggle = false,
  showUnused,
  defaultShowUnused = false,
  onShowUnusedChange,
  caption,
  className,
}: SegmentLegendProps) {
  const [uncontrolledShowUnused, setUncontrolledShowUnused] =
    React.useState(defaultShowUnused)
  const reveal = showUnused ?? uncontrolledShowUnused
  const visible = reveal
    ? segments
    : segments.filter((s) => segmentPageCount(s.pages) > 0)
  const hasHidden = segments.some((s) => segmentPageCount(s.pages) === 0)
  const canToggleUnused = showUnusedToggle && hasHidden
  const scopedInteraction = React.useMemo(
    () =>
      scopeSegmentInteraction(
        interaction,
        visible.map((segment) => segment.id)
      ),
    [interaction, visible]
  )

  if (visible.length === 0 && !canToggleUnused) return null

  const d = DENSITY[density]
  const dockSide = side ?? (orientation === "vertical" ? "left" : "top")
  const isVertical = orientation === "vertical"
  // Only a positive integer column count drives the grid; anything else
  // (0, negative, fractional, Infinity, NaN) would emit invalid
  // `grid-template-columns` and silently collapse the row into one column,
  // so fall back to the wrapping flex layout instead.
  const gridColumns =
    !isVertical &&
    columns != null &&
    Number.isInteger(columns) &&
    columns > 0
      ? columns
      : null

  const chrome = {
    bar: cn("bg-background px-3 py-2", DOCK_BORDER[dockSide]),
    floating: cn(
      "z-10 rounded-lg border bg-background/90 px-3 py-2 shadow-md backdrop-blur",
      FLOAT_ANCHOR[dockSide]
    ),
    plain: "",
  }[variant]

  const toggleUnused = () => {
    const next = !reveal
    if (showUnused === undefined) {
      setUncontrolledShowUnused(next)
    }
    onShowUnusedChange?.(next)
  }

  return (
    <div
      data-slot="segment-legend"
      data-variant={variant}
      className={cn(chrome, className)}
    >
      {visible.length > 0 ? (
        <div
          className={cn(
            d.gap,
            isVertical
              ? "flex flex-col"
              : gridColumns
                ? "grid"
                : "flex flex-wrap items-center"
          )}
          style={
            gridColumns
              ? { gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }
              : undefined
          }
        >
          {visible.map((segment, segmentPosition) => {
            const { state, eventHandlers, ariaProps, dataProps } =
              getSegmentSurfaceProps({
                segment,
                interaction: scopedInteraction,
                currentPage,
                onSelect,
              })
            const label = segmentDisplayLabel(segment.label)
            return (
              <button
                key={`${segment.id}-${segmentPosition}`}
                type="button"
                {...ariaProps}
                {...dataProps}
                {...eventHandlers}
                title={label}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-[3px] transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  d.text,
                  state.isDimmed ? "opacity-40" : "opacity-100"
                )}
              >
                <span
                  aria-hidden
                  className={cn("shrink-0 rounded-[2px]", d.swatch)}
                  style={{ backgroundColor: segment.color }}
                />
                {/* Reserve the bold width up front: an always-semibold but
                    invisible copy sizes the slot, and the visible label overlays
                    it so highlighted/current labels cannot shift the layout. */}
                <span className="grid min-w-0">
                  <span
                    aria-hidden
                    className="invisible col-start-1 row-start-1 truncate font-semibold"
                  >
                    {label}
                  </span>
                  <span
                    className={cn(
                      "col-start-1 row-start-1 truncate",
                      !segment.label.trim() && "italic",
                      state.isHighlighted || state.isCurrent || state.isSelected
                        ? "font-semibold text-foreground"
                        : "font-normal text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
      {canToggleUnused ? (
        <button
          type="button"
          aria-label={
            reveal
              ? "Hide unused segments"
              : `Show ${segments.length - visible.length} unused segments`
          }
          onClick={toggleUnused}
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
