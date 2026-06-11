"use client"

import * as React from "react"
import { ScanText } from "lucide-react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Spinner } from "@/components/ui/spinner"
import {
  PageMarkdownDocumentPane,
  type PageMarkdownDocumentPaneHandle,
} from "@/components/viewers/page-markdown/page-markdown-document-pane"
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
  downloadFileName = "document.md",
}: PageMarkdownViewerProps) {
  const hasPages = pages.length > 0
  const [mode, setMode] = React.useState<PageMarkdownViewMode>("rendered")
  const [manualScale, setManualScale] = React.useState<number | null>(null)
  const [markdownContainerWidth, setMarkdownContainerWidth] = React.useState<
    number | null
  >(null)
  const { currentPage, reportDocumentPage, reportMarkdownPage } =
    usePagePaneSync({ onMarkdownPageChange: onVisiblePageChange })

  const markdownPaneRef = React.useRef<PageMarkdownPaneHandle | null>(null)
  const documentPaneRef = React.useRef<PageMarkdownDocumentPaneHandle | null>(
    null
  )
  const [documentPageReport, setDocumentPageReport] = React.useState<{
    page: number
  } | null>(null)

  const handleDocumentPageChange = React.useCallback((page: number) => {
    setDocumentPageReport({ page })
  }, [])

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
    return <PageMarkdownEmptyState isProcessing={isProcessing} />
  }

  const markdownPane = (
    <PageMarkdownPane
      ref={markdownPaneRef}
      pages={pages}
      text={text}
      mode={mode}
      scale={scale}
      currentPage={currentPage}
      downloadFileName={downloadFileName}
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
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={48} minSize={28}>
        {markdownPane}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function PageMarkdownEmptyState({ isProcessing }: { isProcessing: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-muted/30 px-8 text-muted-foreground">
      {isProcessing ? (
        <>
          <Spinner className="size-8 text-primary" />
          <p className="text-sm">Parsing document...</p>
        </>
      ) : (
        <>
          <ScanText className="size-12 opacity-60" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-foreground">
              No markdown pages yet
            </p>
            <p className="max-w-xs text-xs">
              Provide page-by-page markdown to see the rendered document here.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
