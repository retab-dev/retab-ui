"use client"

import * as React from "react"

import { useElementWidth } from "@/hooks/use-element-width"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PageMarkdownPageFrame } from "@/components/viewers/page-markdown/page-markdown-page-frame"
import { PageMarkdownToolbar } from "@/components/viewers/page-markdown/page-markdown-toolbar"
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types"
import { getVisiblePageFromViewport } from "@/components/viewers/page-markdown/visible-page"

export interface PageMarkdownPaneHandle {
  scrollToPage: (page: number) => void
}

export const PageMarkdownPane = React.forwardRef<
  PageMarkdownPaneHandle,
  {
    pages: string[]
    text: string
    mode: PageMarkdownViewMode
    scale: number
    currentPage: number
    downloadFileName: string
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
    downloadFileName,
    onModeChange,
    onZoom,
    onFitWidth,
    onContainerWidthChange,
    onVisiblePageChange,
  },
  ref
) {
  const [pageContainerRef, pageContainerWidth] = useElementWidth()
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const scrollFrameRef = React.useRef(0)
  const lastVisiblePageRef = React.useRef(1)

  React.useEffect(() => {
    onContainerWidthChange(pageContainerWidth)
  }, [onContainerWidthChange, pageContainerWidth])

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToPage(page) {
        scrollViewportToPage(viewportRef.current, page)
      },
    }),
    []
  )

  const reportVisiblePage = React.useCallback(() => {
    scrollFrameRef.current = 0
    const viewport = viewportRef.current
    if (!viewport) return

    const page = getVisiblePageFromViewport(viewport)
    if (page && page !== lastVisiblePageRef.current) {
      lastVisiblePageRef.current = page
      onVisiblePageChange(page)
    }
  }, [onVisiblePageChange])

  const handleScroll = React.useCallback(() => {
    if (scrollFrameRef.current) return
    scrollFrameRef.current = requestAnimationFrame(reportVisiblePage)
  }, [reportVisiblePage])

  React.useEffect(
    () => () => {
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current)
    },
    []
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-muted/20">
      <PageMarkdownToolbar
        currentPage={Math.min(currentPage, pages.length)}
        pageCount={pages.length}
        mode={mode}
        scale={scale}
        text={text}
        downloadFileName={downloadFileName}
        onModeChange={onModeChange}
        onZoom={onZoom}
        onFitWidth={onFitWidth}
      />
      <ScrollArea
        viewportRef={viewportRef}
        viewportProps={{ onScroll: handleScroll }}
        className="min-h-0 flex-1"
      >
        <div
          ref={pageContainerRef}
          className="flex flex-col items-center gap-4 p-4"
        >
          {pages.map((markdown, pageIndex) => (
            <PageMarkdownPageFrame
              key={`${mode}-${pageIndex}`}
              page={pageIndex + 1}
              markdown={markdown}
              mode={mode}
              scale={scale}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
})

export function scrollViewportToPage(
  viewport: HTMLElement | null,
  page: number
) {
  viewport
    ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" })
}
