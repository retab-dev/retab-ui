"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

export type InteractiveItemListItem = {
  id: string
  disabled?: boolean
}

export type InteractiveItemListRenderState = {
  isActive: boolean
  isDisabled: boolean
  isSelected: boolean
}

const DEFAULT_ESTIMATE_SIZE = 72
const ROW_PADDING = 12

type InteractiveItemListVirtualRow = {
  index: number
  key: React.Key
  start: number
}

function requestFrame(callback: () => void) {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    window.requestAnimationFrame(callback)
    return
  }
  setTimeout(callback, 0)
}

export function InteractiveItemList<Item extends InteractiveItemListItem>({
  activeItemId,
  "aria-label": ariaLabel,
  className,
  emptyLabel = "No items.",
  estimateSize = DEFAULT_ESTIMATE_SIZE,
  items,
  onActivateItem,
  onClearPreview,
  onClearSelection,
  onPreviewItem,
  onVisibleItemChange,
  renderItem,
  selectedItemId,
}: {
  activeItemId?: string | null
  "aria-label": string
  className?: string
  emptyLabel?: string
  estimateSize?: number
  items: readonly Item[]
  onActivateItem?: (item: Item) => void
  onClearPreview?: () => void
  onClearSelection?: () => void
  onPreviewItem?: (item: Item) => void
  onVisibleItemChange?: (item: Item) => void
  renderItem: (
    item: Item,
    state: InteractiveItemListRenderState
  ) => React.ReactNode
  selectedItemId?: string | null
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const optionRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const visibleItemIdRef = React.useRef<string | null>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    getItemKey: (index) => items[index]?.id ?? index,
    getScrollElement: () => viewportRef.current,
    overscan: 8,
  })
  const virtualRows: InteractiveItemListVirtualRow[] =
    virtualizer.getVirtualItems().length > 0
      ? virtualizer.getVirtualItems()
      : items.map((item, index) => ({
          index,
          key: item.id,
          start: index * estimateSize,
        }))
  const totalSize = Math.max(
    virtualizer.getTotalSize(),
    items.length * estimateSize
  )

  const firstEnabledIndex = React.useCallback(
    () => items.findIndex((item) => !item.disabled),
    [items]
  )

  const lastEnabledIndex = React.useCallback(() => {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (!items[index]?.disabled) return index
    }
    return -1
  }, [items])

  const enabledIndexFrom = React.useCallback(
    (startIndex: number, direction: 1 | -1) => {
      for (
        let index = startIndex;
        index >= 0 && index < items.length;
        index += direction
      ) {
        if (!items[index]?.disabled) return index
      }
      return -1
    },
    [items]
  )

  const focusItem = React.useCallback(
    (index: number) => {
      const item = items[index]
      if (!item || item.disabled) return
      virtualizer.scrollToIndex(index)
      requestFrame(() => {
        optionRefs.current.get(item.id)?.focus()
      })
    },
    [items, virtualizer]
  )

  const reportVisibleItem = React.useCallback(() => {
    if (!onVisibleItemChange) return
    const viewport = viewportRef.current
    if (!viewport) return

    const marker = viewport.scrollTop + ROW_PADDING
    const virtualItems = virtualizer.getVirtualItems()
    const virtualItem =
      virtualItems.find((row) => row.start + row.size >= marker) ??
      virtualItems[0]
    const fallbackIndex = Math.min(
      items.length - 1,
      Math.max(0, Math.floor(marker / estimateSize))
    )
    const item = virtualItem ? items[virtualItem.index] : items[fallbackIndex]
    if (!item || item.disabled || item.id === visibleItemIdRef.current) return

    visibleItemIdRef.current = item.id
    onVisibleItemChange(item)
  }, [estimateSize, items, onVisibleItemChange, virtualizer])

  const handleViewportScroll = React.useCallback(() => {
    requestFrame(reportVisibleItem)
  }, [reportVisibleItem])

  return (
    <ScrollArea
      className={cn("min-h-0 flex-1", className)}
      scrollFade
      viewportProps={{ onScroll: handleViewportScroll }}
      viewportRef={viewportRef}
    >
      {items.length ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="relative"
          style={{ height: totalSize + ROW_PADDING * 2 }}
        >
          {virtualRows.map((virtualRow) => {
            const item = items[virtualRow.index]
            if (!item) return null

            const isActive = item.id === activeItemId
            const isDisabled = Boolean(item.disabled)
            const isSelected = item.id === selectedItemId

            return (
              <div
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute top-0 right-3 left-3 pb-2 [contain:layout_paint]"
                style={{
                  transform: `translateY(${virtualRow.start + ROW_PADDING}px)`,
                }}
              >
                <button
                  ref={(element) => {
                    if (element) {
                      optionRefs.current.set(item.id, element)
                    } else {
                      optionRefs.current.delete(item.id)
                    }
                  }}
                  type="button"
                  role="option"
                  aria-disabled={isDisabled || undefined}
                  aria-selected={isSelected}
                  data-active={isActive ? "true" : "false"}
                  data-disabled={isDisabled ? "true" : "false"}
                  data-selected={isSelected ? "true" : "false"}
                  disabled={isDisabled}
                  className="block w-full text-left outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  onBlur={() => onClearPreview?.()}
                  onClick={() => {
                    if (!isDisabled) onActivateItem?.(item)
                  }}
                  onFocus={() => {
                    if (!isDisabled) onPreviewItem?.(item)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault()
                      focusItem(enabledIndexFrom(virtualRow.index + 1, 1))
                      return
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault()
                      focusItem(enabledIndexFrom(virtualRow.index - 1, -1))
                      return
                    }
                    if (event.key === "Home") {
                      event.preventDefault()
                      focusItem(firstEnabledIndex())
                      return
                    }
                    if (event.key === "End") {
                      event.preventDefault()
                      focusItem(lastEnabledIndex())
                      return
                    }
                    if (event.key === "Escape") {
                      event.preventDefault()
                      onClearPreview?.()
                      onClearSelection?.()
                      return
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      if (!isDisabled) onActivateItem?.(item)
                    }
                  }}
                  onMouseEnter={() => {
                    if (!isDisabled) onPreviewItem?.(item)
                  }}
                  onMouseLeave={() => onClearPreview?.()}
                >
                  {renderItem(item, { isActive, isDisabled, isSelected })}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="p-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        </div>
      )}
    </ScrollArea>
  )
}
