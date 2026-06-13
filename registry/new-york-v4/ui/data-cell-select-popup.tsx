"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import type { DataCellSelectOption } from "@/registry/new-york-v4/ui/data-cell-types"

export type DataCellSelectPopupPosition = {
  left: number
  top: number
  width: number
  maxHeight: number
}

export type DataCellSelectPopupProps = {
  anchor: HTMLElement
  id: string
  position: DataCellSelectPopupPosition
  activeDescendantId: string | undefined
  value: string | null
  activeIndex: number
  options: DataCellSelectOption[]
  onActiveIndexChange: (index: number) => void
  onCommit: (value: string) => void
  onCancel: () => void
  onOutsidePointerDown: (event: PointerEvent) => void
}

const popupGapPx = 4
const viewportMarginPx = 8
const minimumPopupHeightPx = 64

export function DataCellSelectPopup({
  anchor,
  id,
  position,
  activeDescendantId,
  value,
  activeIndex,
  options,
  onActiveIndexChange,
  onCommit,
  onCancel,
  onOutsidePointerDown,
}: DataCellSelectPopupProps) {
  const popupRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (anchor.contains(target) || popupRef.current?.contains(target)) return

      onOutsidePointerDown(event)
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true)
  }, [anchor, onOutsidePointerDown])

  React.useEffect(() => {
    const handleViewportChange = (event: Event) => {
      const target = event.target
      if (target instanceof Node && popupRef.current?.contains(target)) return
      onCancel()
    }

    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("scroll", handleViewportChange, true)
    return () => {
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("scroll", handleViewportChange, true)
    }
  }, [onCancel])

  return createPortal(
    <div
      ref={popupRef}
      id={id}
      role="listbox"
      aria-activedescendant={activeDescendantId}
      className="fixed z-[60] overflow-y-auto rounded-lg border bg-popover p-1 text-foreground shadow-lg/5 outline-none select-none"
      data-slot="data-cell-select-popup"
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        minWidth: position.width,
        maxHeight: position.maxHeight,
      }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value
        const isActive = index === activeIndex
        return (
          <div
            key={option.value}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            data-active={isActive ? "true" : undefined}
            data-disabled={option.disabled ? "true" : undefined}
            className={cn(
              "grid min-h-8 cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none sm:min-h-7 sm:text-sm",
              "data-[active=true]:bg-accent data-[active=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-64",
              option.className
            )}
            onMouseEnter={() => {
              if (!option.disabled) onActiveIndexChange(index)
            }}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!option.disabled) onCommit(option.value)
            }}
          >
            <span className="col-start-1 flex size-4 items-center justify-center">
              {isSelected ? (
                <svg
                  aria-hidden="true"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
                </svg>
              ) : null}
            </span>
            <span className="col-start-2 min-w-0 truncate">{option.label}</span>
          </div>
        )
      })}
    </div>,
    document.body
  )
}

export function getDataCellSelectPopupPosition({
  rect,
  viewportWidth,
  viewportHeight,
}: {
  rect: DOMRect
  viewportWidth: number
  viewportHeight: number
}): DataCellSelectPopupPosition {
  const availableBelow = viewportHeight - rect.bottom - viewportMarginPx
  const availableAbove = rect.top - viewportMarginPx
  const shouldPlaceAbove =
    availableBelow < minimumPopupHeightPx && availableAbove > availableBelow
  const maxHeight = Math.max(
    minimumPopupHeightPx,
    shouldPlaceAbove ? availableAbove - popupGapPx : availableBelow - popupGapPx
  )
  const top = shouldPlaceAbove
    ? Math.max(viewportMarginPx, rect.top - popupGapPx - maxHeight)
    : Math.min(rect.bottom + popupGapPx, viewportHeight - viewportMarginPx)
  const left = Math.min(
    Math.max(viewportMarginPx, rect.left),
    Math.max(viewportMarginPx, viewportWidth - rect.width - viewportMarginPx)
  )

  return {
    left,
    top,
    width: rect.width,
    maxHeight,
  }
}

export function firstEnabledDataCellSelectOptionIndex(
  options: DataCellSelectOption[]
) {
  return options.findIndex((option) => !option.disabled)
}

export function nextEnabledDataCellSelectOptionIndex({
  options,
  currentIndex,
  direction,
}: {
  options: DataCellSelectOption[]
  currentIndex: number
  direction: 1 | -1
}) {
  if (options.length === 0) return -1

  for (let offset = 1; offset <= options.length; offset += 1) {
    const index =
      (currentIndex + direction * offset + options.length) % options.length
    if (!options[index]?.disabled) return index
  }

  return -1
}

export function selectedDataCellSelectOptionIndex({
  options,
  value,
}: {
  options: DataCellSelectOption[]
  value: string | null
}) {
  const selectedIndex = options.findIndex((option) => option.value === value)
  if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) {
    return selectedIndex
  }

  return firstEnabledDataCellSelectOptionIndex(options)
}
