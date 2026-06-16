"use client"

import * as React from "react"

import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSurface,
} from "@/components/ui/viewer"
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
import { PageMarkdownControls } from "@/components/viewers/page-markdown/page-markdown-controls"
import {
  type PageMarkdownDocumentHandle,
  type PageMarkdownDocumentState,
  type PageMarkdownViewerProps,
  type PageMarkdownViewMode,
} from "@/components/viewers/page-markdown/page-markdown-types"

type PageMarkdownViewerContextValue = {
  content: PageMarkdownViewerContentState
  document: PageMarkdownDocumentState
  header: PageMarkdownViewerHeaderState
}

type PageMarkdownViewerContentState = {
  hasPages: boolean
  isMarkdownScaleReady: boolean
  isProcessing: boolean
  markdownPaneRef: React.RefObject<PageMarkdownPaneHandle | null>
  mode: PageMarkdownViewMode
  onMarkdownVisiblePageChange: (pageNumber: number) => void
  pages: string[]
  processingLabel: string
  resetKey?: string
  scale: number
  setMarkdownContainerWidth: (width: number | null) => void
  text: string
}

type PageMarkdownViewerHeaderState = {
  currentPage: number
  fileName: string
  fitWidth: () => void
  mode: PageMarkdownViewMode
  pageCount: number
  scale: number
  setMode: (mode: PageMarkdownViewMode) => void
  setViewerScale: (scale: number | null) => void
  text: string
}

const PageMarkdownViewerContext =
  React.createContext<PageMarkdownViewerContextValue | null>(null)

function usePageMarkdownViewerContext(): PageMarkdownViewerContextValue {
  const context = React.useContext(PageMarkdownViewerContext)
  if (!context) {
    throw new Error(
      "usePageMarkdownViewer must be used within PageMarkdownViewerProvider."
    )
  }
  return context
}

function usePageMarkdownViewerContent(): PageMarkdownViewerContentState {
  return usePageMarkdownViewerContext().content
}

export function usePageMarkdownViewerDocument(): PageMarkdownDocumentState {
  return usePageMarkdownViewerContext().document
}

function usePageMarkdownViewerHeader(): PageMarkdownViewerHeaderState {
  return usePageMarkdownViewerContext().header
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
  const documentHandleRef = React.useRef<PageMarkdownDocumentHandle | null>(
    null
  )
  const pagePaneResetKey = hasPages ? `pages:${resetKey ?? ""}` : "empty"
  const { currentPage, reportDocumentPage, reportMarkdownPage } =
    usePageMarkdownSync({
      onMarkdownPageChange: onVisiblePageChange,
      pageCount: pages.length,
      resetKey: pagePaneResetKey,
    })

  React.useEffect(() => {
    setMode("rendered")
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
        documentHandleRef.current?.scrollToPage(target.pageNumber)
      }
    },
    [reportMarkdownPage]
  )

  const setDocumentHandle = React.useCallback(
    (handle: PageMarkdownDocumentHandle | null) => {
      documentHandleRef.current = handle
    },
    []
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
      setDocumentHandle,
    }),
    [
      handleDocumentPageChange,
      handleDocumentScrollProgressChange,
      setDocumentHandle,
    ]
  )

  const content = React.useMemo<PageMarkdownViewerContentState>(
    () => ({
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
      text,
    }),
    [
      handleMarkdownPageChange,
      hasPages,
      isMarkdownScaleReady,
      isProcessing,
      markdownPaneRef,
      mode,
      pages,
      processingLabel,
      resetKey,
      scale,
      setMarkdownContainerWidth,
      text,
    ]
  )

  const header = React.useMemo<PageMarkdownViewerHeaderState>(
    () => ({
      currentPage,
      fileName,
      fitWidth,
      mode,
      pageCount: pages.length,
      scale,
      setMode,
      setViewerScale,
      text,
    }),
    [
      currentPage,
      fileName,
      fitWidth,
      mode,
      pages.length,
      scale,
      setMode,
      setViewerScale,
      text,
    ]
  )

  const value = React.useMemo<PageMarkdownViewerContextValue>(
    () => ({
      content,
      document,
      header,
    }),
    [content, document, header]
  )

  return (
    <PageMarkdownViewerContext.Provider value={value}>
      {children}
    </PageMarkdownViewerContext.Provider>
  )
}

export function PageMarkdownViewerContent() {
  const {
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
      resetKey={resetKey}
      onContainerWidthChange={setMarkdownContainerWidth}
      onVisiblePageChange={onMarkdownVisiblePageChange}
    />
  )
}

export function PageMarkdownViewerHeader({
  className,
}: {
  className?: string
}) {
  const {
    currentPage,
    fileName,
    fitWidth,
    mode,
    pageCount,
    scale,
    setMode,
    setViewerScale,
    text,
  } = usePageMarkdownViewerHeader()

  return (
    <ViewerHeader className={className}>
      <PageMarkdownControls
        className="border-b-0"
        currentPage={Math.min(currentPage, pageCount)}
        pageCount={pageCount}
        mode={mode}
        scale={scale}
        text={text}
        fileName={fileName}
        onModeChange={setMode}
        onZoom={(factor) => setViewerScale(zoomPageScale(scale, factor))}
        onFitWidth={fitWidth}
      />
    </ViewerHeader>
  )
}

export function PageMarkdownViewer(props: PageMarkdownViewerProps) {
  return (
    <PageMarkdownViewerProvider {...props}>
      <ViewerRoot bare className="h-full flex-1 bg-background">
        <PageMarkdownViewerHeader />
        <ViewerBody>
          <ViewerSurface>
            <PageMarkdownViewerContent />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PageMarkdownViewerProvider>
  )
}
