"use client"

import * as React from "react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  PageMarkdownDocumentPane,
  type PageMarkdownDocumentPaneHandle,
} from "@/components/viewers/page-markdown/page-markdown-document-pane"
import { PageMarkdownEmptyState } from "@/components/viewers/page-markdown/page-markdown-empty-state"
import { PAGE_MARKDOWN_PAGE_WIDTH } from "@/components/viewers/page-markdown/page-markdown-layout"
import { joinMarkdownPages } from "@/components/viewers/page-markdown/page-markdown-model"
import {
  PageMarkdownPane,
  type PageMarkdownPaneHandle,
} from "@/components/viewers/page-markdown/page-markdown-pane"
import {
  usePageMarkdownScale,
  zoomPageScale,
} from "@/components/viewers/page-markdown/page-markdown-scale"
import { usePageMarkdownSync } from "@/components/viewers/page-markdown/page-markdown-sync"
import {
  type PageMarkdownViewerProps,
  type PageMarkdownViewMode,
} from "@/components/viewers/page-markdown/page-markdown-types"

export function PageMarkdownViewer({
  pages,
  text = joinMarkdownPages(pages),
  isProcessing = false,
  renderDocument,
  onVisiblePageChange,
  fileName = "document.md",
  resetKey,
  processingLabel = "Preparing document...",
}: PageMarkdownViewerProps) {
  const hasPages = pages.length > 0
  const [mode, setMode] = React.useState<PageMarkdownViewMode>("rendered")
  const [markdownContainerWidth, setMarkdownContainerWidth] = React.useState<
    number | null
  >(null)
  const pagePaneResetKey = hasPages ? `pages:${resetKey ?? ""}` : "empty"
  const { currentPage, reportDocumentPage, reportMarkdownPage } =
    usePageMarkdownSync({
      onMarkdownPageChange: onVisiblePageChange,
      pageCount: pages.length,
      resetKey: pagePaneResetKey,
    })

  const markdownPaneRef = React.useRef<PageMarkdownPaneHandle | null>(null)
  const documentPaneRef = React.useRef<PageMarkdownDocumentPaneHandle | null>(
    null
  )
  const [documentPageReport, setDocumentPageReport] = React.useState<{
    pageNumber: number
  } | null>(null)

  React.useEffect(() => {
    setMode("rendered")
    setDocumentPageReport(null)
  }, [resetKey])

  const handleDocumentPageChange = React.useCallback(
    (pageNumber: number) => {
      const normalizedPage = Number.isFinite(pageNumber)
        ? Math.floor(pageNumber)
        : 1
      const pageCount = Math.max(1, pages.length)
      setDocumentPageReport({
        pageNumber: Math.min(pageCount, Math.max(1, normalizedPage)),
      })
    },
    [pages.length]
  )
  const handleDocumentScrollProgressChange = React.useCallback(
    (progress: number) => {
      void progress
    },
    []
  )

  React.useEffect(() => {
    if (!documentPageReport) return
    const target = reportDocumentPage(documentPageReport.pageNumber)
    if (target?.pane === "markdown") {
      markdownPaneRef.current?.scrollToPage(target.pageNumber)
    }
  }, [documentPageReport, reportDocumentPage])

  const handleMarkdownPageChange = React.useCallback(
    (pageNumber: number) => {
      const target = reportMarkdownPage(pageNumber)
      if (target?.pane === "document") {
        documentPaneRef.current?.scrollToPage(target.pageNumber)
      }
    },
    [reportMarkdownPage]
  )

  const { fitWidth, scale, setViewerScale } = usePageMarkdownScale({
    containerWidth: markdownContainerWidth,
    pageWidth: PAGE_MARKDOWN_PAGE_WIDTH,
    resetKey,
  })
  const isMarkdownScaleReady = markdownContainerWidth !== null

  if (!hasPages) {
    return (
      <PageMarkdownEmptyState
        isProcessing={isProcessing}
        processingLabel={processingLabel}
      />
    )
  }

  const markdownPane = (
    <PageMarkdownPane
      ref={markdownPaneRef}
      pages={pages}
      text={text}
      mode={mode}
      scale={scale}
      isScaleReady={isMarkdownScaleReady}
      currentPage={currentPage}
      fileName={fileName}
      resetKey={resetKey}
      onModeChange={setMode}
      onZoom={(factor) => setViewerScale(zoomPageScale(scale, factor))}
      onFitWidth={fitWidth}
      onContainerWidthChange={setMarkdownContainerWidth}
      onVisiblePageChange={handleMarkdownPageChange}
    />
  )

  if (!renderDocument) {
    return <div className="flex min-h-0 flex-1 flex-col">{markdownPane}</div>
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel defaultSize={52} minSize={28}>
        <PageMarkdownDocumentPane
          ref={documentPaneRef}
          renderDocument={renderDocument}
          onCurrentPageChange={handleDocumentPageChange}
          onScrollProgressChange={handleDocumentScrollProgressChange}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={48} minSize={28}>
        {markdownPane}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
