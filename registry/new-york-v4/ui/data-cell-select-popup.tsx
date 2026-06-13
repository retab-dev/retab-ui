"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { useDataCellSelectPopupDismissal } from "@/registry/new-york-v4/ui/data-cell-select-popup-dismissal"
import type { DataCellSelectPopupPosition } from "@/registry/new-york-v4/ui/data-cell-select-popup-position"
import type { DataCellSelectOption } from "@/registry/new-york-v4/ui/data-cell-types"

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

  useDataCellSelectPopupDismissal({
    anchor,
    popupRef,
    onCancel,
    onOutsidePointerDown,
  })

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
