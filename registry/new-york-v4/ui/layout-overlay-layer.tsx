"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { itemToQuad, toSvgPoints } from "./layout-blocks-geometry"
import type { LayoutItem, LayoutLevel, LayoutPage } from "./layout-blocks-types"

const OVERLAY_BLUE = "rgb(37 99 235)"
const OVERLAY_ACTIVE_PURPLE = "rgb(147 51 234)"
const OVERLAY_ACTIVE_PURPLE_FILL = "rgb(147 51 234 / 0.12)"
const OVERLAY_STROKE_WIDTH = 1.6
const OVERLAY_ACTIVE_STROKE_WIDTH = 2.2

export function LayoutOverlayLayer({
  activeItemId,
  className,
  interactive = false,
  items,
  onItemClick,
  onItemPointerEnter,
  onItemPointerLeave,
  page,
  rotation = page.rotation,
  selectedItemId,
  visibleLevels,
}: {
  activeItemId?: string | null
  className?: string
  interactive?: boolean
  items: LayoutItem[]
  onItemClick?: (item: LayoutItem) => void
  onItemPointerEnter?: (item: LayoutItem) => void
  onItemPointerLeave?: () => void
  page: LayoutPage
  rotation?: number
  selectedItemId?: string | null
  visibleLevels?: readonly LayoutLevel[]
}) {
  const visibleLevelSet = React.useMemo(
    () => (visibleLevels?.length ? new Set(visibleLevels) : null),
    [visibleLevels]
  )
  const renderedItems = React.useMemo(
    () =>
      visibleLevelSet
        ? items.filter((item) => visibleLevelSet.has(item.level))
        : items,
    [items, visibleLevelSet]
  )

  return (
    <svg
      aria-hidden={!interactive}
      className={cn(
        "absolute inset-0 z-10 size-full",
        interactive ? "pointer-events-auto" : "pointer-events-none",
        className
      )}
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {renderedItems.map((item) => {
        const quad = itemToQuad(item, page)
        if (!quad) return null

        const isActive = item.id === activeItemId
        const isSelected = item.id === selectedItemId
        const isEmphasized = isActive || isSelected

        return (
          <polygon
            key={item.id}
            data-item-id={item.id}
            points={toSvgPoints(quad, page, rotation)}
            vectorEffect="non-scaling-stroke"
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={
              interactive
                ? `${item.level} ${item.text.trim() || "layout item"}`
                : undefined
            }
            className={cn(
              "transition-[fill,stroke,stroke-width]",
              interactive && "cursor-pointer outline-none",
              interactive && "focus-visible:outline-none"
            )}
            style={{
              fill: isEmphasized ? OVERLAY_ACTIVE_PURPLE_FILL : "transparent",
              stroke: isEmphasized ? OVERLAY_ACTIVE_PURPLE : OVERLAY_BLUE,
            }}
            strokeWidth={
              isEmphasized ? OVERLAY_ACTIVE_STROKE_WIDTH : OVERLAY_STROKE_WIDTH
            }
            onClick={() => onItemClick?.(item)}
            onKeyDown={(event) => {
              if (!interactive) return
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onItemClick?.(item)
              }
            }}
            onPointerEnter={() => onItemPointerEnter?.(item)}
            onPointerLeave={onItemPointerLeave}
          />
        )
      })}
    </svg>
  )
}
