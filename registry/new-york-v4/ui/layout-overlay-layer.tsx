"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { itemToQuad, toSvgPoints } from "./layout-blocks-geometry"
import type { LayoutItem, LayoutLevel, LayoutPage } from "./layout-blocks-types"

const OVERLAY_PALETTES = [
  {
    fill: "rgb(139 92 246 / 0.05)",
    stroke: "rgb(139 92 246 / 0.35)",
    activeFill: "rgb(139 92 246 / 0.1)",
    activeStroke: "rgb(139 92 246 / 0.7)",
  },
  {
    fill: "rgb(59 130 246 / 0.05)",
    stroke: "rgb(59 130 246 / 0.35)",
    activeFill: "rgb(59 130 246 / 0.1)",
    activeStroke: "rgb(59 130 246 / 0.7)",
  },
  {
    fill: "rgb(16 185 129 / 0.05)",
    stroke: "rgb(16 185 129 / 0.35)",
    activeFill: "rgb(16 185 129 / 0.1)",
    activeStroke: "rgb(16 185 129 / 0.7)",
  },
  {
    fill: "rgb(245 158 11 / 0.05)",
    stroke: "rgb(245 158 11 / 0.35)",
    activeFill: "rgb(245 158 11 / 0.1)",
    activeStroke: "rgb(245 158 11 / 0.7)",
  },
  {
    fill: "rgb(244 63 94 / 0.05)",
    stroke: "rgb(244 63 94 / 0.35)",
    activeFill: "rgb(244 63 94 / 0.1)",
    activeStroke: "rgb(244 63 94 / 0.7)",
  },
  {
    fill: "rgb(6 182 212 / 0.05)",
    stroke: "rgb(6 182 212 / 0.35)",
    activeFill: "rgb(6 182 212 / 0.1)",
    activeStroke: "rgb(6 182 212 / 0.7)",
  },
  {
    fill: "rgb(100 116 139 / 0.05)",
    stroke: "rgb(100 116 139 / 0.35)",
    activeFill: "rgb(100 116 139 / 0.1)",
    activeStroke: "rgb(100 116 139 / 0.7)",
  },
  {
    fill: "rgb(113 113 122 / 0.05)",
    stroke: "rgb(113 113 122 / 0.35)",
    activeFill: "rgb(113 113 122 / 0.1)",
    activeStroke: "rgb(113 113 122 / 0.7)",
  },
] as const

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
        const palette = getOverlayPalette(item.id)

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
              "transition-[fill,stroke]",
              interactive && "cursor-pointer outline-none",
              interactive && "focus-visible:outline-none"
            )}
            style={{
              fill: isEmphasized ? palette.activeFill : palette.fill,
              stroke: isEmphasized ? palette.activeStroke : palette.stroke,
            }}
            strokeWidth={1}
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

function getOverlayPalette(itemId: string) {
  return OVERLAY_PALETTES[hashString(itemId) % OVERLAY_PALETTES.length]
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}
