"use client"

import * as React from "react"

import { useElementWidth } from "@/hooks/use-element-width"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  createPageMarkdownLayout,
  createPageMeasurementKey,
  findPageMarkdownPageByOffset,
  getPageMarkdownPageLayout,
} from "@/components/viewers/page-markdown/page-markdown-layout"
import { PageMarkdownPageFrame } from "@/components/viewers/page-markdown/page-markdown-page-frame"
import { usePageMarkdownScroll } from "@/components/viewers/page-markdown/page-markdown-scroll"
import { PageMarkdownToolbar } from "@/components/viewers/page-markdown/page-markdown-toolbar"
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types"
import { usePageMarkdownPageVirtualization } from "@/components/viewers/page-markdown/page-markdown-virtualization"

export interface PageMarkdownPaneHandle {
  scrollToPage: (page: number) => void
}

type PageHeightMeasurement = {
  height: number
  key: string
}

type PageMarkdownScrollAnchor = {
  offsetWithinPage: number
  pageNumber: number
}

export const PageMarkdownPane = React.forwardRef<
  PageMarkdownPaneHandle,
  {
    pages: string[]
    text: string
    mode: PageMarkdownViewMode
    scale: number
    currentPage: number
    fileName: string
    resetKey?: string
    onModeChange: (mode: PageMarkdownViewMode) => void
    onZoom: (factor: number) => void
    onFitWidth: () => void
    onContainerWidthChange: (width: number | null) => void
    onVisiblePageChange: (page: number) => void
  }
>(function PageMarkdownPane(
  {
    pages,
    text,
    mode,
    scale,
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
  const [pageContainerRef, pageContainerWidth] = useElementWidth()
  const [pageHeightMeasurements, setPageHeightMeasurements] = React.useState<
    Map<number, PageHeightMeasurement>
  >(() => new Map())
  const pendingScrollAnchorRef = React.useRef<PageMarkdownScrollAnchor | null>(
    null
  )
  const pagesSignature = React.useMemo(
    () => `${resetKey ?? ""}\u0000${pages.join("\u0000")}`,
    [pages, resetKey]
  )
  const measuredHeightByPageNumber = React.useMemo(() => {
    const measuredHeights = new Map<number, number>()
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const pageNumber = pageIndex + 1
      const measurement = pageHeightMeasurements.get(pageNumber)
      if (!measurement) continue

      const key = createPageMeasurementKey({
        markdown: pages[pageIndex]!,
        mode,
        scale,
      })
      if (measurement.key === key) {
        measuredHeights.set(pageNumber, measurement.height)
      }
    }
    return measuredHeights
  }, [mode, pageHeightMeasurements, pages, scale])
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
      layout,
      resetKey: pagesSignature,
      viewportElement,
    })

  React.useEffect(() => {
    onContainerWidthChange(pageContainerWidth)
  }, [onContainerWidthChange, pageContainerWidth])

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

  const captureScrollAnchor = React.useCallback(() => {
    const viewport = viewportElement
    if (!viewport) return

    const pageNumber = findPageMarkdownPageByOffset(layout, viewport.scrollTop)
    const pageLayout = getPageMarkdownPageLayout(layout, pageNumber)
    if (!pageLayout) return

    pendingScrollAnchorRef.current = {
      offsetWithinPage: viewport.scrollTop - pageLayout.offsetTop,
      pageNumber,
    }
  }, [layout, viewportElement])

  const setPageHeight = React.useCallback(
    (pageNumber: number, height: number) => {
      const markdown = pages[pageNumber - 1]
      if (!markdown || !Number.isFinite(height) || height <= 0) return

      const key = createPageMeasurementKey({ markdown, mode, scale })
      setPageHeightMeasurements((current) => {
        const currentMeasurement = current.get(pageNumber)
        if (
          currentMeasurement?.key === key &&
          currentMeasurement.height === height
        ) {
          return current
        }

        captureScrollAnchor()
        const next = new Map(current)
        next.set(pageNumber, { height, key })
        return next
      })
    },
    [captureScrollAnchor, mode, pages, scale]
  )

  React.useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current
    if (!anchor || !viewportElement) return

    pendingScrollAnchorRef.current = null
    const pageLayout = getPageMarkdownPageLayout(layout, anchor.pageNumber)
    if (!pageLayout) return

    viewportElement.scrollTop = Math.max(
      0,
      pageLayout.offsetTop + anchor.offsetWithinPage
    )
    measureVisiblePages()
  }, [layout, measureVisiblePages, viewportElement])

  React.useEffect(() => {
    measureVisiblePages()
  }, [layout, measureVisiblePages, viewportElement])

  const handleViewportScroll = React.useCallback(() => {
    handleScroll()
    measureVisiblePages()
  }, [handleScroll, measureVisiblePages])

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
        viewportProps={{ onScroll: handleViewportScroll }}
        className="min-h-0 flex-1"
      >
        <div
          ref={pageContainerRef}
          className="relative mx-auto"
          style={{
            height: layout.totalHeight,
            minWidth: layout.width,
          }}
        >
          {visiblePageNumbers.map((pageNumber) => {
            const page = getPageMarkdownPageLayout(layout, pageNumber)
            const markdown = pages[pageNumber - 1]
            if (!page || markdown == null) return null

            return (
              <div
                key={pageNumber}
                data-slot="page-markdown-page-slot"
                data-page-number={pageNumber}
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  top: page.offsetTop,
                  width: page.width,
                  minHeight: page.height,
                }}
              >
                <PageMarkdownPageFrame
                  estimatedHeight={page.height}
                  page={pageNumber}
                  markdown={markdown}
                  mode={mode}
                  onSize={setPageHeight}
                  scale={scale}
                />
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
})
