"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { LayoutItem, LayoutLevel } from "./layout-blocks-types"

const ROW_ESTIMATE_SIZE = 84
const ROW_PADDING = 12

const LEVEL_LABEL: Record<LayoutLevel, string> = {
  block: "Block",
  paragraph: "Paragraph",
  line: "Line",
  word: "Word",
}

export function LayoutBlocksPanel({
  activeItemId,
  className,
  emptyLabel = "No layout items found.",
  items,
  onActiveItemIdChange,
  onNavigateItem,
  onSelectedItemIdChange,
  renderItemContent,
  selectedItemId,
}: {
  activeItemId?: string | null
  className?: string
  emptyLabel?: string
  items: LayoutItem[]
  onActiveItemIdChange?: (itemId: string | null) => void
  onNavigateItem?: (item: LayoutItem, options?: ScrollToOptions) => void
  onSelectedItemIdChange?: (itemId: string | null) => void
  renderItemContent?: (item: LayoutItem) => React.ReactNode
  selectedItemId?: string | null
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => ROW_ESTIMATE_SIZE,
    getItemKey: (index) => items[index]?.id ?? index,
    getScrollElement: () => viewportRef.current,
    overscan: 8,
  })

  return (
    <div
      data-slot="layout-blocks-panel"
      className={cn("flex min-h-0 flex-col bg-background", className)}
    >
      <ScrollArea
        className="min-h-0 flex-1"
        scrollFade
        viewportRef={viewportRef}
      >
        {items.length ? (
          <div
            role="listbox"
            aria-label="OCR blocks"
            className="relative"
            style={{
              height: virtualizer.getTotalSize() + ROW_PADDING * 2,
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index]
              if (!item) return null

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute top-0 right-3 left-3 pb-2 [contain:layout_paint]"
                  style={{
                    transform: `translateY(${
                      virtualRow.start + ROW_PADDING
                    }px)`,
                  }}
                >
                  <LayoutItemRow
                    item={item}
                    isActive={item.id === activeItemId}
                    isSelected={item.id === selectedItemId}
                    renderItemContent={renderItemContent}
                    onActiveItemIdChange={onActiveItemIdChange}
                    onNavigateItem={onNavigateItem}
                    onSelectedItemIdChange={onSelectedItemIdChange}
                  />
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
    </div>
  )
}

function LayoutItemRow({
  isActive,
  isSelected,
  item,
  onActiveItemIdChange,
  onNavigateItem,
  onSelectedItemIdChange,
  renderItemContent,
}: {
  isActive: boolean
  isSelected: boolean
  item: LayoutItem
  onActiveItemIdChange?: (itemId: string | null) => void
  onNavigateItem?: (item: LayoutItem, options?: ScrollToOptions) => void
  onSelectedItemIdChange?: (itemId: string | null) => void
  renderItemContent?: (item: LayoutItem) => React.ReactNode
}) {
  const confidence = item.confidence
  const confidenceLabel =
    confidence == null ? "Unknown" : `${Math.round(confidence * 100)}%`
  const text = item.text.replace(/\s+/g, " ").trim()

  function selectItem() {
    onSelectedItemIdChange?.(item.id)
    onNavigateItem?.(item, { behavior: "smooth" })
  }

  function previewItem() {
    onActiveItemIdChange?.(item.id)
    onNavigateItem?.(item, { behavior: "auto" })
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "w-full rounded-lg border bg-background p-3 text-left transition-[background-color,border-color,box-shadow] outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
        isActive && "border-primary/50 bg-primary/5",
        isSelected && "border-primary bg-primary/8 shadow-sm"
      )}
      onBlur={() => onActiveItemIdChange?.(null)}
      onClick={selectItem}
      onFocus={previewItem}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onActiveItemIdChange?.(null)
          if (isSelected) onSelectedItemIdChange?.(null)
        }
      }}
      onMouseEnter={previewItem}
      onMouseLeave={() => onActiveItemIdChange?.(null)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {LEVEL_LABEL[item.level]}
        </span>
        <span
          className={cn(
            "text-[11px] font-medium",
            confidence != null && confidence < 0.9
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {confidenceLabel}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          p. {item.pageNumber}
        </span>
      </div>
      <div className="mt-2 text-sm leading-5 text-foreground">
        {renderItemContent ? (
          renderItemContent(item)
        ) : (
          <span className="line-clamp-3">{text || "Empty text"}</span>
        )}
      </div>
    </button>
  )
}
