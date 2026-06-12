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
import { usePagePaneSync } from "@/components/viewers/page-markdown/page-markdown-hooks"
import {
  fitPageScale,
  joinMarkdownPages,
  zoomPageScale,
} from "@/components/viewers/page-markdown/page-markdown-model"
import {
  PageMarkdownPane,
  type PageMarkdownPaneHandle,
} from "@/components/viewers/page-markdown/page-markdown-pane"
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
  const [manualScale, setManualScale] = React.useState<number | null>(null)
  const [markdownContainerWidth, setMarkdownContainerWidth] = React.useState<
    number | null
  >(null)
  const pagePaneResetKey = hasPages ? `pages:${resetKey ?? ""}` : "empty"
  const { currentPage, reportDocumentPage, reportMarkdownPage } =
    usePagePaneSync({
      onMarkdownPageChange: onVisiblePageChange,
      pageCount: pages.length,
      resetKey: pagePaneResetKey,
    })

  const markdownPaneRef = React.useRef<PageMarkdownPaneHandle | null>(null)
  const documentPaneRef = React.useRef<PageMarkdownDocumentPaneHandle | null>(
    null
  )
  const [documentPageReport, setDocumentPageReport] = React.useState<{
    page: number
  } | null>(null)

  React.useEffect(() => {
    setMode("rendered")
    setManualScale(null)
    setDocumentPageReport(null)
  }, [resetKey])

  const handleDocumentPageChange = React.useCallback(
    (page: number) => {
      const normalizedPage = Number.isFinite(page) ? Math.floor(page) : 1
      const pageCount = Math.max(1, pages.length)
      setDocumentPageReport({
        page: Math.min(pageCount, Math.max(1, normalizedPage)),
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
    const target = reportDocumentPage(documentPageReport.page)
    if (target?.pane === "markdown") {
      markdownPaneRef.current?.scrollToPage(target.page)
    }
  }, [documentPageReport, reportDocumentPage])

  const handleVisibleMarkdownPageChange = React.useCallback(
    (page: number) => {
      const target = reportMarkdownPage(page)
      if (target?.pane === "document") {
        documentPaneRef.current?.scrollToPage(target.page)
      }
    },
    [reportMarkdownPage]
  )

  const fitScale = fitPageScale(markdownContainerWidth)
  const scale = manualScale ?? fitScale

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
      currentPage={currentPage}
      fileName={fileName}
      resetKey={resetKey}
      onModeChange={setMode}
      onZoom={(factor) => setManualScale(zoomPageScale(scale, factor))}
      onFitWidth={() => setManualScale(null)}
      onContainerWidthChange={setMarkdownContainerWidth}
      onVisiblePageChange={handleVisibleMarkdownPageChange}
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
