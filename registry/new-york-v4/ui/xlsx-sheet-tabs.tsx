"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { XlsxSheetMeta } from "@/lib/xlsx-workbook"

const TAB_STRIP_HEIGHT_PX = 36
const TAB_HEIGHT_PX = 28
const TAB_REVEAL_PADDING_PX = 10
const SCROLL_EPSILON_PX = 1
const TAB_MIN_WIDTH_PX = 92
const TAB_MAX_WIDTH_PX = 184
const PREFERRED_VISIBLE_TABS = 6
const LARGE_REVEAL_DISTANCE_MULTIPLIER = 1.25

interface SheetTabScrollState {
  canScrollLeft: boolean
  canScrollRight: boolean
  isOverflowing: boolean
  viewportWidth: number
}

function scrollTabsTo(
  scrollElement: HTMLDivElement,
  left: number,
  behavior: ScrollBehavior
) {
  const maxScrollLeft = Math.max(
    0,
    scrollElement.scrollWidth - scrollElement.clientWidth
  )
  const clampedLeft = Math.min(maxScrollLeft, Math.max(0, left))

  if (typeof scrollElement.scrollTo === "function") {
    scrollElement.scrollTo({ left: clampedLeft, behavior })
  } else {
    scrollElement.scrollLeft = clampedLeft
  }
}

function readScrollState(scrollElement: HTMLElement): SheetTabScrollState {
  const maxScrollLeft = Math.max(
    0,
    scrollElement.scrollWidth - scrollElement.clientWidth
  )

  return {
    canScrollLeft: scrollElement.scrollLeft > SCROLL_EPSILON_PX,
    canScrollRight:
      scrollElement.scrollLeft < maxScrollLeft - SCROLL_EPSILON_PX,
    isOverflowing: maxScrollLeft > SCROLL_EPSILON_PX,
    viewportWidth: scrollElement.clientWidth,
  }
}

function resolveTabWidth(viewportWidth: number, sheetCount: number) {
  if (viewportWidth <= 0 || sheetCount <= 0) return undefined

  const visibleTabs = Math.min(sheetCount, PREFERRED_VISIBLE_TABS)
  const availableWidth = Math.max(0, viewportWidth - 16)
  return Math.round(
    Math.min(
      TAB_MAX_WIDTH_PX,
      Math.max(TAB_MIN_WIDTH_PX, availableWidth / visibleTabs)
    )
  )
}

export function XlsxSheetTabs({
  sheets,
  activeSheetIndex,
  onSelectSheet,
}: {
  sheets: XlsxSheetMeta[]
  activeSheetIndex: number
  onSelectSheet: (sheetIndex: number) => void
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const [scrollState, setScrollState] = React.useState<SheetTabScrollState>({
    canScrollLeft: false,
    canScrollRight: false,
    isOverflowing: false,
    viewportWidth: 0,
  })
  const tabWidth = resolveTabWidth(scrollState.viewportWidth, sheets.length)

  const updateScrollState = React.useCallback(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const nextScrollState = readScrollState(scrollElement)

    setScrollState((current) =>
      current.canScrollLeft === nextScrollState.canScrollLeft &&
      current.canScrollRight === nextScrollState.canScrollRight &&
      current.isOverflowing === nextScrollState.isOverflowing &&
      current.viewportWidth === nextScrollState.viewportWidth
        ? current
        : nextScrollState
    )
  }, [])

  React.useLayoutEffect(() => {
    updateScrollState()

    const scrollElement = scrollRef.current
    const listElement = listRef.current
    if (!scrollElement) return

    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(scrollElement)
    if (listElement) resizeObserver.observe(listElement)

    scrollElement.addEventListener("scroll", updateScrollState, {
      passive: true,
    })
    return () => {
      resizeObserver.disconnect()
      scrollElement.removeEventListener("scroll", updateScrollState)
    }
  }, [sheets.length, updateScrollState])

  React.useLayoutEffect(() => {
    const scrollElement = scrollRef.current
    const activeTab = tabRefs.current[activeSheetIndex]
    if (!scrollElement || !activeTab) return

    const tabLeft = activeTab.offsetLeft - TAB_REVEAL_PADDING_PX
    const tabRight =
      activeTab.offsetLeft + activeTab.offsetWidth + TAB_REVEAL_PADDING_PX
    const viewportLeft = scrollElement.scrollLeft
    const viewportRight = viewportLeft + scrollElement.clientWidth
    const nextLeft =
      tabLeft < viewportLeft
        ? tabLeft
        : tabRight > viewportRight
          ? tabRight - scrollElement.clientWidth
          : null

    if (nextLeft != null) {
      const distance = Math.abs(nextLeft - scrollElement.scrollLeft)
      scrollTabsTo(
        scrollElement,
        nextLeft,
        distance >
          scrollElement.clientWidth * LARGE_REVEAL_DISTANCE_MULTIPLIER
          ? "auto"
          : "smooth"
      )
    }

    window.requestAnimationFrame(updateScrollState)
  }, [activeSheetIndex, tabWidth, updateScrollState])

  if (sheets.length <= 1) return null

  const selectSheet = (sheetIndex: number) => {
    if (sheetIndex !== activeSheetIndex) onSelectSheet(sheetIndex)
  }

  const onTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    sheetIndex: number
  ) => {
    const lastSheetIndex = sheets.length - 1
    let nextSheetIndex: number | null = null

    if (event.key === "ArrowLeft") {
      nextSheetIndex = sheetIndex > 0 ? sheetIndex - 1 : lastSheetIndex
    } else if (event.key === "ArrowRight") {
      nextSheetIndex = sheetIndex < lastSheetIndex ? sheetIndex + 1 : 0
    } else if (event.key === "Home") {
      nextSheetIndex = 0
    } else if (event.key === "End") {
      nextSheetIndex = lastSheetIndex
    }

    if (nextSheetIndex == null) return
    event.preventDefault()
    selectSheet(nextSheetIndex)
    tabRefs.current[nextSheetIndex]?.focus()
  }

  const scrollTabsBy = (delta: number) => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return false

    const maxScrollLeft = Math.max(
      0,
      scrollElement.scrollWidth - scrollElement.clientWidth
    )
    const nextScrollLeft = scrollElement.scrollLeft + delta
    const clampedScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, nextScrollLeft)
    )

    if (Math.abs(clampedScrollLeft - scrollElement.scrollLeft) <= 0.5) {
      return false
    }

    scrollElement.scrollLeft = clampedScrollLeft
    updateScrollState()
    return true
  }

  const onTabsWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollElement = scrollRef.current
    if (!scrollElement || !scrollState.isOverflowing) return

    const dominantDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY
    if (dominantDelta === 0) return

    if (!scrollTabsBy(dominantDelta)) return
    event.preventDefault()
  }

  return (
    <div
      data-slot="xlsx-viewer-tabs"
      role="tablist"
      aria-label="Workbook sheets"
      data-can-scroll-left={scrollState.canScrollLeft}
      data-can-scroll-right={scrollState.canScrollRight}
      data-overflowing={scrollState.isOverflowing}
      style={{ height: TAB_STRIP_HEIGHT_PX }}
      className="relative flex-shrink-0 overflow-hidden border-t bg-card"
    >
      <div
        ref={scrollRef}
        data-slot="xlsx-viewer-tabs-scroll"
        className="h-full overflow-x-auto overflow-y-hidden px-1.5 py-1 overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={onTabsWheel}
      >
        <div
          ref={listRef}
          data-slot="xlsx-viewer-tabs-list"
          className="flex min-w-max items-stretch gap-0.5"
        >
          {sheets.map((sheet, sheetIndex) => (
            <button
              key={`${sheetIndex}:${sheet.name}`}
              ref={(element) => {
                tabRefs.current[sheetIndex] = element
              }}
              type="button"
              role="tab"
              aria-selected={sheetIndex === activeSheetIndex}
              tabIndex={sheetIndex === activeSheetIndex ? 0 : -1}
              onClick={() => selectSheet(sheetIndex)}
              onKeyDown={(event) => onTabKeyDown(event, sheetIndex)}
              style={{
                height: TAB_HEIGHT_PX,
                ...(tabWidth ? { width: tabWidth } : null),
              }}
              title={sheet.name}
              data-active={sheetIndex === activeSheetIndex}
              className={cn(
                "relative flex flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-md border border-transparent px-2.5 text-xs leading-none font-medium whitespace-nowrap outline-none transition-[background-color,border-color,color,box-shadow]",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                sheetIndex === activeSheetIndex
                  ? "border-border/70 bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className="truncate">{sheet.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
