"use client"

import * as React from "react"

import { useElementWidth } from "@/hooks/use-element-width"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  createPageMarkdownLayout,
  getPageMarkdownPageLayout,
} from "@/components/viewers/page-markdown/page-markdown-layout"
import {
  usePageMarkdownMeasurements,
  usePageMarkdownScrollAnchor,
} from "@/components/viewers/page-markdown/page-markdown-measurements"
import { PageMarkdownPageFrame } from "@/components/viewers/page-markdown/page-markdown-page-frame"
import { usePageMarkdownScroll } from "@/components/viewers/page-markdown/page-markdown-scroll"
import { PageMarkdownToolbar } from "@/components/viewers/page-markdown/page-markdown-toolbar"
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types"
import { usePageMarkdownPageVirtualization } from "@/components/viewers/page-markdown/page-markdown-virtualization"

export interface PageMarkdownPaneHandle {
  scrollToPage: (pageNumber: number) => void
}

export const PageMarkdownPane = React.forwardRef<
  PageMarkdownPaneHandle,
  {
    pages: string[]
    text: string
    mode: PageMarkdownViewMode
    scale: number
    isScaleReady: boolean
    currentPage: number
    fileName: string
    resetKey?: string
    onModeChange: (mode: PageMarkdownViewMode) => void
    onZoom: (factor: number) => void
    onFitWidth: () => void
    onContainerWidthChange: (width: number | null) => void
    onVisiblePageChange: (pageNumber: number) => void
  }
>(function PageMarkdownPane(
  {
    pages,
    text,
    mode,
    scale,
    isScaleReady,
    currentPage,
    fileName,
    resetKey,
    onModeChange,
    onZoom,
    onFitWidth,
    onContainerWidthChange,
    onVisiblePageChange,
  },
  ref
) {
  const [viewportWidthRef, viewportWidth] = useElementWidth()
  const pagesSignature = React.useMemo(
    () => `${resetKey ?? ""}\u0000${pages.join("\u0000")}`,
    [pages, resetKey]
  )
  const { measuredHeightByPageNumber, setPageHeight } =
    usePageMarkdownMeasurements({ mode, pages, scale })
  const layout = React.useMemo(
    () =>
      createPageMarkdownLayout({
        measuredHeightByPageNumber,
        mode,
        pages,
        scale,
      }),
    [measuredHeightByPageNumber, mode, pages, scale]
  )
  const {
    handleScroll,
    measureScroll,
    scrollToPage,
    getViewportElement,
    setViewportElement,
    viewportElement,
  } = usePageMarkdownScroll({
    layout,
    onVisiblePageChange,
    pageCount: pages.length,
    resetKey: pagesSignature,
  })
  const { measureVisiblePages, visiblePageNumbers } =
    usePageMarkdownPageVirtualization({
      getViewportElement,
      layout,
      resetKey: pagesSignature,
      viewportElement,
    })

  React.useLayoutEffect(() => {
    onContainerWidthChange(viewportWidth)
  }, [onContainerWidthChange, viewportWidth])

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToPage: (pageNumber) => {
        scrollToPage(pageNumber)
        measureScroll()
        measureVisiblePages()
      },
    }),
    [measureScroll, measureVisiblePages, scrollToPage]
  )
  const { captureScrollAnchor } = usePageMarkdownScrollAnchor({
    layout,
    onRestore: measureVisiblePages,
    viewportElement,
  })
  const handlePageSize = React.useCallback(
    (pageNumber: number, height: number) => {
      setPageHeight(pageNumber, height, captureScrollAnchor)
    },
    [captureScrollAnchor, setPageHeight]
  )

  React.useEffect(() => {
    measureVisiblePages()
  }, [layout, measureVisiblePages, viewportElement])

  const handleViewportScroll = React.useCallback(() => {
    handleScroll()
    measureVisiblePages()
  }, [handleScroll, measureVisiblePages])

  const handleViewportKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return
      }

      const viewportElement = event.currentTarget
      const maxScrollTop = Math.max(
        0,
        viewportElement.scrollHeight - viewportElement.clientHeight
      )
      let nextScrollTop: number | null = null

      switch (event.key) {
        case "ArrowDown":
          nextScrollTop = viewportElement.scrollTop + 40
          break
        case "ArrowUp":
          nextScrollTop = viewportElement.scrollTop - 40
          break
        case "PageDown":
          nextScrollTop =
            viewportElement.scrollTop + viewportElement.clientHeight * 0.85
          break
        case "PageUp":
          nextScrollTop =
            viewportElement.scrollTop - viewportElement.clientHeight * 0.85
          break
        case "Home":
          nextScrollTop = 0
          break
        case "End":
          nextScrollTop = maxScrollTop
          break
        default:
          return
      }

      event.preventDefault()
      viewportElement.scrollTop = Math.min(
        maxScrollTop,
        Math.max(0, nextScrollTop)
      )
      measureScroll()
      measureVisiblePages()
    },
    [measureScroll, measureVisiblePages]
  )

  if (!isScaleReady) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col bg-muted/20">
        <div className="h-10 shrink-0 border-b bg-card" />
        <ScrollArea className="min-h-0 flex-1">
          <div ref={viewportWidthRef} className="h-full w-full min-w-0" />
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-muted/20">
      <PageMarkdownToolbar
        currentPage={Math.min(currentPage, pages.length)}
        pageCount={pages.length}
        mode={mode}
        scale={scale}
        text={text}
        fileName={fileName}
        onModeChange={onModeChange}
        onZoom={onZoom}
        onFitWidth={onFitWidth}
      />
      <ScrollArea
        viewportRef={setViewportElement}
        viewportProps={{
          "aria-label": "Markdown pages",
          onKeyDown: handleViewportKeyDown,
          onScroll: handleViewportScroll,
          tabIndex: 0,
        }}
        className="min-h-0 flex-1"
      >
        <div ref={viewportWidthRef} className="w-full min-w-0">
          <div
            className="relative mx-auto"
            style={{
              height: layout.totalHeight,
              minWidth: layout.width,
            }}
          >
            {visiblePageNumbers.map((pageNumber) => {
              const pageLayout = getPageMarkdownPageLayout(layout, pageNumber)
              const markdown = pages[pageNumber - 1]
              if (!pageLayout || markdown == null) return null

              return (
                <div
                  key={pageNumber}
                  data-slot="page-markdown-page-slot"
                  data-page-number={pageNumber}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    top: pageLayout.offsetTop,
                    width: pageLayout.width,
                    minHeight: pageLayout.height,
                  }}
                >
                  <PageMarkdownPageFrame
                    estimatedHeight={pageLayout.height}
                    pageNumber={pageNumber}
                    markdown={markdown}
                    mode={mode}
                    onSize={handlePageSize}
                    scale={scale}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
})
