"use client"

import * as React from "react"

import { ViewerBody, ViewerRoot, ViewerSurface } from "@/components/ui/viewer"
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
import { PageMarkdownToolbar } from "@/components/viewers/page-markdown/page-markdown-toolbar"
import {
  type PageMarkdownDocumentScrollRequest,
  type PageMarkdownDocumentState,
  type PageMarkdownViewerProps,
  type PageMarkdownViewMode,
} from "@/components/viewers/page-markdown/page-markdown-types"

type PageMarkdownViewerContextValue = {
  currentPage: number
  document: PageMarkdownDocumentState
  fileName: string
  hasPages: boolean
  isMarkdownScaleReady: boolean
  isProcessing: boolean
  markdownPaneRef: React.RefObject<PageMarkdownPaneHandle | null>
  mode: PageMarkdownViewMode
  pages: string[]
  processingLabel: string
  resetKey?: string
  scale: number
  setMarkdownContainerWidth: (width: number | null) => void
  setMode: (mode: PageMarkdownViewMode) => void
  setViewerScale: (scale: number | null) => void
  text: string
  fitWidth: () => void
  onMarkdownVisiblePageChange: (pageNumber: number) => void
}

const PageMarkdownViewerContext =
  React.createContext<PageMarkdownViewerContextValue | null>(null)

export function usePageMarkdownViewer() {
  const context = React.useContext(PageMarkdownViewerContext)
  if (!context) {
    throw new Error(
      "usePageMarkdownViewer must be used within PageMarkdownViewerProvider."
    )
  }
  return context
}

export function usePageMarkdownViewerContent() {
  const {
    currentPage,
    fileName,
    fitWidth,
    hasPages,
    isMarkdownScaleReady,
    isProcessing,
    markdownPaneRef,
    mode,
    onMarkdownVisiblePageChange,
    pages,
    processingLabel,
    resetKey,
    scale,
    setMarkdownContainerWidth,
    setMode,
    setViewerScale,
    text,
  } = usePageMarkdownViewer()

  return {
    currentPage,
    fileName,
    fitWidth,
    hasPages,
    isMarkdownScaleReady,
    isProcessing,
    markdownPaneRef,
    mode,
    onMarkdownVisiblePageChange,
    pages,
    processingLabel,
    resetKey,
    scale,
    setMarkdownContainerWidth,
    setMode,
    setViewerScale,
    text,
  }
}

export function usePageMarkdownViewerDocument(): PageMarkdownDocumentState {
  return usePageMarkdownViewer().document
}

export function usePageMarkdownViewerToolbar() {
  const { currentPage, fileName, fitWidth, mode, pages, scale, setMode, text } =
    usePageMarkdownViewer()

  return {
    currentPage,
    fileName,
    fitWidth,
    mode,
    pageCount: pages.length,
    scale,
    setMode,
    text,
  }
}

export function PageMarkdownViewerProvider({
  children,
  pages,
  text = joinMarkdownPages(pages),
  isProcessing = false,
  onVisiblePageChange,
  fileName = "document.md",
  resetKey,
  processingLabel = "Preparing document...",
}: PageMarkdownViewerProps & { children: React.ReactNode }) {
  const hasPages = pages.length > 0
  const [mode, setMode] = React.useState<PageMarkdownViewMode>("rendered")
  const [markdownContainerWidth, setMarkdownContainerWidth] = React.useState<
    number | null
  >(null)
  const markdownPaneRef = React.useRef<PageMarkdownPaneHandle | null>(null)
  const [documentScrollRequest, setDocumentScrollRequest] =
    React.useState<PageMarkdownDocumentScrollRequest | null>(null)
  const pagePaneResetKey = hasPages ? `pages:${resetKey ?? ""}` : "empty"
  const { currentPage, reportDocumentPage, reportMarkdownPage } =
    usePageMarkdownSync({
      onMarkdownPageChange: onVisiblePageChange,
      pageCount: pages.length,
      resetKey: pagePaneResetKey,
    })

  React.useEffect(() => {
    setMode("rendered")
    setDocumentScrollRequest(null)
  }, [resetKey])

  const handleDocumentPageChange = React.useCallback(
    (pageNumber: number) => {
      const normalizedPage = Number.isFinite(pageNumber)
        ? Math.floor(pageNumber)
        : 1
      const pageCount = Math.max(1, pages.length)
      const target = reportDocumentPage(
        Math.min(pageCount, Math.max(1, normalizedPage))
      )
      if (target?.pane === "markdown") {
        markdownPaneRef.current?.scrollToPage(target.pageNumber)
      }
    },
    [pages.length, reportDocumentPage]
  )

  const handleDocumentScrollProgressChange = React.useCallback(
    (progress: number) => {
      void progress
    },
    []
  )

  const handleMarkdownPageChange = React.useCallback(
    (pageNumber: number) => {
      const target = reportMarkdownPage(pageNumber)
      if (target?.pane === "document") {
        setDocumentScrollRequest({
          pageNumber: target.pageNumber,
          version: target.version,
        })
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

  const document = React.useMemo<PageMarkdownDocumentState>(
    () => ({
      onCurrentPageChange: handleDocumentPageChange,
      onScrollProgressChange: handleDocumentScrollProgressChange,
      scrollRequest: documentScrollRequest,
    }),
    [
      documentScrollRequest,
      handleDocumentPageChange,
      handleDocumentScrollProgressChange,
    ]
  )

  const value = React.useMemo<PageMarkdownViewerContextValue>(
    () => ({
      currentPage,
      document,
      fileName,
      fitWidth,
      hasPages,
      isMarkdownScaleReady,
      isProcessing,
      markdownPaneRef,
      mode,
      onMarkdownVisiblePageChange: handleMarkdownPageChange,
      pages,
      processingLabel,
      resetKey,
      scale,
      setMarkdownContainerWidth,
      setMode,
      setViewerScale,
      text,
    }),
    [
      currentPage,
      document,
      fileName,
      fitWidth,
      handleMarkdownPageChange,
      hasPages,
      isMarkdownScaleReady,
      isProcessing,
      mode,
      pages,
      processingLabel,
      resetKey,
      scale,
      setViewerScale,
      text,
    ]
  )

  return (
    <PageMarkdownViewerContext.Provider value={value}>
      {children}
    </PageMarkdownViewerContext.Provider>
  )
}

export function PageMarkdownViewerContent() {
  const {
    currentPage,
    fileName,
    fitWidth,
    hasPages,
    isMarkdownScaleReady,
    isProcessing,
    markdownPaneRef,
    mode,
    onMarkdownVisiblePageChange,
    pages,
    processingLabel,
    resetKey,
    scale,
    setMarkdownContainerWidth,
    setMode,
    setViewerScale,
    text,
  } = usePageMarkdownViewerContent()

  if (!hasPages) {
    return (
      <PageMarkdownEmptyState
        isProcessing={isProcessing}
        processingLabel={processingLabel}
      />
    )
  }

  return (
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
      onVisiblePageChange={onMarkdownVisiblePageChange}
    />
  )
}

export function PageMarkdownViewerToolbar() {
  const {
    currentPage,
    fileName,
    fitWidth,
    mode,
    pages,
    scale,
    setMode,
    setViewerScale,
    text,
  } = usePageMarkdownViewerContent()

  return (
    <PageMarkdownToolbar
      currentPage={Math.min(currentPage, pages.length)}
      pageCount={pages.length}
      mode={mode}
      scale={scale}
      text={text}
      fileName={fileName}
      onModeChange={setMode}
      onZoom={(factor) => setViewerScale(zoomPageScale(scale, factor))}
      onFitWidth={fitWidth}
    />
  )
}

export function PageMarkdownViewer(props: PageMarkdownViewerProps) {
  return (
    <PageMarkdownViewerProvider {...props}>
      <ViewerRoot bare className="h-full flex-1 bg-background">
        <ViewerBody>
          <ViewerSurface>
            <PageMarkdownViewerContent />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PageMarkdownViewerProvider>
  )
}
