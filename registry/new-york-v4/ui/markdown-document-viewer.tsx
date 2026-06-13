"use client"

import * as React from "react"
import { Check, Copy, Maximize, Minus, Plus } from "lucide-react"

import type { ViewerResource } from "@/lib/viewer-resource"

import { Button } from "./button"
import {
  MARKDOWN_DOCUMENT_PAGE_PADDING_X,
  MARKDOWN_DOCUMENT_PAGE_PADDING_Y,
  MARKDOWN_DOCUMENT_PAGE_WIDTH,
} from "./markdown-document-layout"
import {
  createMarkdownDocument,
  findMarkdownPageForLine,
  markdownPageIntersectsLineRange,
  type MarkdownDocument,
  type MarkdownDocumentPage,
} from "./markdown-document-model"
import { MarkdownDocumentPageRenderer } from "./markdown-document-renderer"
import {
  createMarkdownVirtualGeometry,
  getMarkdownScrollAnchor,
  getMarkdownVirtualItems,
  scrollTopForMarkdownAnchor,
  topForMarkdownIndex,
  type MarkdownVirtualItem,
} from "./markdown-document-virtualizer"
import { PlainTextViewerShell } from "./plain-text-viewer-shell"
import { ScrollArea } from "./scroll-area"
import { Separator } from "./separator"
import { Tabs, TabsList, TabsTrigger } from "./tabs"
import { TextViewerFallback, TextViewerFrame } from "./text-viewer-chrome"
import { normalizeTextLineRange } from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
} from "./text-viewer-resource"
import { clampTextViewerScale } from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import { ViewerDownloadControl } from "./viewer-download"

const MARKDOWN_VIEWER_OVERSCAN_PX = 900
const MARKDOWN_VIEWER_DEFAULT_VIEWPORT_HEIGHT = 720
const MARKDOWN_VIEWER_DEFAULT_VIEWPORT_WIDTH = 960
const MARKDOWN_VIEWER_CANVAS_PADDING_Y = 16
const MARKDOWN_VIEWER_FIT_PADDING_X = 32
const MARKDOWN_VIEWER_PAGE_GAP = 16
const MARKDOWN_VIEWER_READING_SCALE = 0.75
const MARKDOWN_VIEWER_ZOOM_STEP = 1.2

type MarkdownDocumentViewMode = "rendered" | "text"

type ViewportSize = {
  height: number
  width: number
}

export const MarkdownDocumentViewer = React.forwardRef<
  TextViewerHandle,
  TextViewerProps
>(function MarkdownDocumentViewer(props, ref) {
  return (
    <PlainTextViewerShell
      props={props}
      forwardedRef={ref}
      clientFallbackPolicy="always"
      Fallback={TextViewerFallback}
      Content={MarkdownDocumentViewerContent}
    />
  )
})

function MarkdownDocumentViewerContent({
  resource,
  className,
  toolbar = true,
  highlight,
  bare = false,
  maxBytes,
  maxLines,
  retryVersion,
  forwardedRef,
}: TextViewerProps & {
  resource: ViewerResource
  retryVersion: number
  forwardedRef?: React.ForwardedRef<TextViewerHandle>
}) {
  const bounds = React.useMemo(
    () => resolvedTextViewerBounds({ maxBytes, maxLines }),
    [maxBytes, maxLines]
  )
  const text = React.useMemo(
    () =>
      readTextResource({
        bounds,
        content: resource.content,
        retryVersion,
      }),
    [bounds, resource.content, retryVersion]
  )
  const document = React.useMemo(() => createMarkdownDocument(text), [text])
  const [mode, setMode] = React.useState<MarkdownDocumentViewMode>("rendered")
  const [manualScale, setManualScale] = React.useState<number | null>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewportSize, setViewportSize] = React.useState<ViewportSize>({
    height: 0,
    width: 0,
  })
  const [measuredHeights, setMeasuredHeights] = React.useState<
    Map<string, number>
  >(() => new Map())
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const scrollFrameRef = React.useRef<number | null>(null)
  const pendingAnchorRef = React.useRef<ReturnType<
    typeof getMarkdownScrollAnchor
  > | null>(null)
  const viewportHeight =
    viewportSize.height || MARKDOWN_VIEWER_DEFAULT_VIEWPORT_HEIGHT
  const viewportWidth =
    viewportSize.width || MARKDOWN_VIEWER_DEFAULT_VIEWPORT_WIDTH
  const fitScale = React.useMemo(
    () => getMarkdownDocumentFitScale(viewportWidth),
    [viewportWidth]
  )
  const scale = manualScale ?? fitScale
  const virtualScrollTop = Math.max(
    0,
    scrollTop - MARKDOWN_VIEWER_CANVAS_PADDING_Y
  )
  const highlightRange = React.useMemo(
    () => normalizeTextLineRange(highlight, document.lineCount),
    [document.lineCount, highlight]
  )
  const pageMeasurementKey = React.useMemo(
    () => `${mode}:${scale.toFixed(3)}:${viewportWidth}:${text.length}`,
    [mode, scale, text.length, viewportWidth]
  )
  const estimateHeight = React.useCallback(
    (index: number) =>
      (document.pages[index]?.estimatedHeight ?? 1) * scale +
      MARKDOWN_VIEWER_PAGE_GAP,
    [document.pages, scale]
  )
  const getKey = React.useCallback(
    (index: number) =>
      `${pageMeasurementKey}:${document.pages[index]?.id ?? index}`,
    [document.pages, pageMeasurementKey]
  )
  const virtualGeometry = React.useMemo(
    () =>
      createMarkdownVirtualGeometry({
        count: document.pages.length,
        estimateHeight,
        getKey,
        measuredHeights,
      }),
    [document.pages.length, estimateHeight, getKey, measuredHeights]
  )
  const virtualWindow = React.useMemo(
    () =>
      getMarkdownVirtualItems({
        geometry: virtualGeometry,
        overscanPx: MARKDOWN_VIEWER_OVERSCAN_PX,
        scrollTop: virtualScrollTop,
        viewportHeight,
      }),
    [virtualScrollTop, viewportHeight, virtualGeometry]
  )
  const currentPage = currentPageFromVirtualItems({
    items: virtualWindow.items,
    pages: document.pages,
    scrollTop: virtualScrollTop,
  })

  React.useEffect(() => {
    setMeasuredHeights(new Map())
  }, [pageMeasurementKey])

  React.useEffect(() => {
    pendingAnchorRef.current = null
    setManualScale(null)
    setScrollTop(0)
    scrollMarkdownViewportTo(viewportRef.current, { left: 0, top: 0 })
  }, [document])

  const captureScrollAnchor = React.useCallback(() => {
    pendingAnchorRef.current = getMarkdownScrollAnchor({
      geometry: virtualGeometry,
      scrollTop: Math.max(
        0,
        (viewportRef.current?.scrollTop ?? scrollTop) -
          MARKDOWN_VIEWER_CANVAS_PADDING_Y
      ),
    })
  }, [scrollTop, virtualGeometry])

  React.useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current
    const viewport = viewportRef.current
    if (!anchor || !viewport) return

    pendingAnchorRef.current = null
    viewport.scrollTop =
      scrollTopForMarkdownAnchor({
        anchor,
        geometry: virtualGeometry,
      }) + MARKDOWN_VIEWER_CANVAS_PADDING_Y
  }, [virtualGeometry])

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const readSize = () => {
      setViewportSize((current) => {
        const next = {
          height: viewport.clientHeight,
          width: viewport.clientWidth,
        }
        return current.height === next.height && current.width === next.width
          ? current
          : next
      })
    }

    readSize()
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(readSize)
    observer?.observe(viewport)
    return () => observer?.disconnect()
  }, [])

  const handleScroll = React.useCallback(() => {
    if (scrollFrameRef.current !== null) return
    if (typeof requestAnimationFrame === "undefined") {
      setScrollTop(viewportRef.current?.scrollTop ?? 0)
      return
    }
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null
      setScrollTop(viewportRef.current?.scrollTop ?? 0)
    })
  }, [])

  React.useEffect(
    () => () => {
      if (
        scrollFrameRef.current !== null &&
        typeof cancelAnimationFrame !== "undefined"
      ) {
        cancelAnimationFrame(scrollFrameRef.current)
      }
    },
    []
  )

  const measurePage = React.useCallback(
    (key: string, height: number) => {
      if (!Number.isFinite(height) || height <= 0) return

      setMeasuredHeights((current) => {
        if (current.get(key) === height) return current
        captureScrollAnchor()
        const next = new Map(current)
        next.set(key, height)
        return next
      })
    },
    [captureScrollAnchor]
  )

  const scrollToPageIndex = React.useCallback(
    (index: number, options?: ScrollToOptions, sourceLine?: number) => {
      const viewport = viewportRef.current
      if (!viewport || document.pages.length === 0) return
      const page = document.pages[index]
      const lineOffset =
        page && sourceLine
          ? Math.max(0, sourceLine - page.pageStartLine) * 24 * scale
          : 0
      scrollMarkdownViewportTo(viewport, {
        behavior: "smooth",
        top:
          MARKDOWN_VIEWER_CANVAS_PADDING_Y +
          topForMarkdownIndex({
            geometry: virtualGeometry,
            index,
          }) +
          lineOffset,
        ...options,
      })
    },
    [document.pages, scale, virtualGeometry]
  )

  const scrollToLineRange = React.useCallback(
    (
      range: ReturnType<typeof normalizeTextLineRange>,
      options?: ScrollToOptions
    ) => {
      if (!range) return
      const page = findMarkdownPageForLine(document.pages, range.start)
      if (!page) return
      scrollToPageIndex(page.pageNumber - 1, options, range.start)
    },
    [document.pages, scrollToPageIndex]
  )

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      getViewportElement: () => viewportRef.current,
      scrollToLineRange: (range, options) => {
        scrollToLineRange(
          normalizeTextLineRange(range, document.lineCount),
          options
        )
      },
    }),
    [document.lineCount, scrollToLineRange]
  )

  React.useEffect(() => {
    scrollToLineRange(highlightRange)
  }, [highlightRange, scrollToLineRange])

  const zoom = (factor: number) => {
    captureScrollAnchor()
    setManualScale(clampTextViewerScale(scale * factor))
  }
  const fitWidth = () => {
    captureScrollAnchor()
    setManualScale(null)
  }
  const resetZoom = () => {
    captureScrollAnchor()
    setManualScale(1)
  }
  const handleFragmentClick = React.useCallback(
    (event: React.MouseEvent) => {
      const href = localFragmentHrefFromEventTarget(event.target)
      if (!href) return

      const targetId = decodeFragmentHref(href)
      const targetPage = document.pages.find((page) =>
        page.blocks.some((block) => block.headingId === targetId)
      )
      if (!targetPage) return

      event.preventDefault()
      const targetLine =
        targetPage.blocks.find((block) => block.headingId === targetId)
          ?.blockStartLine ?? targetPage.pageStartLine
      scrollToPageIndex(targetPage.pageNumber - 1, undefined, targetLine)
      if (window.location.hash !== href) {
        window.history.replaceState(null, "", href)
      }
    },
    [document.pages, scrollToPageIndex]
  )

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <MarkdownDocumentToolbar
          currentPage={currentPage}
          document={document}
          downloadAction={resource.originalDownload}
          mode={mode}
          scale={scale}
          onFitWidth={fitWidth}
          onModeChange={setMode}
          onResetZoom={resetZoom}
          onZoomIn={() => zoom(MARKDOWN_VIEWER_ZOOM_STEP)}
          onZoomOut={() => zoom(1 / MARKDOWN_VIEWER_ZOOM_STEP)}
        />
      ) : null}
      <ScrollArea
        className="min-h-0 flex-1 bg-muted/30"
        orientation="vertical"
        viewportClassName="bg-muted/30"
        viewportProps={{
          onClickCapture: handleFragmentClick,
          onScroll: handleScroll,
        }}
        viewportRef={viewportRef}
      >
        <div
          className="relative mx-auto min-w-0"
          data-slot="markdown-document-virtual-canvas"
          style={{
            height:
              virtualWindow.totalHeight + MARKDOWN_VIEWER_CANVAS_PADDING_Y * 2,
            width: Math.max(1, MARKDOWN_DOCUMENT_PAGE_WIDTH * scale),
          }}
        >
          {virtualWindow.items.map((virtualItem) => {
            const page = document.pages[virtualItem.index]
            if (!page) return null
            return (
              <MarkdownVirtualPage
                key={virtualItem.key}
                document={document}
                highlightRange={highlightRange}
                mode={mode}
                page={page}
                pageMeasurementKey={virtualItem.key}
                scale={scale}
                virtualItem={virtualItem}
                onMeasure={measurePage}
              />
            )
          })}
        </div>
      </ScrollArea>
    </TextViewerFrame>
  )
}

function MarkdownDocumentToolbar({
  currentPage,
  document,
  downloadAction,
  mode,
  scale,
  onFitWidth,
  onModeChange,
  onResetZoom,
  onZoomIn,
  onZoomOut,
}: {
  currentPage: number
  document: MarkdownDocument
  downloadAction: NonNullable<ViewerResource["originalDownload"]>
  mode: MarkdownDocumentViewMode
  scale: number
  onFitWidth: () => void
  onModeChange: (mode: MarkdownDocumentViewMode) => void
  onResetZoom: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  return (
    <div className="no-scrollbar flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b bg-card px-2">
      <span className="px-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        Page {currentPage} of {document.pages.length}
      </span>
      <Tabs
        value={mode}
        onValueChange={(value) =>
          onModeChange(value as MarkdownDocumentViewMode)
        }
      >
        <TabsList variant="underline" className="py-0">
          <TabsTrigger value="rendered" className="h-8 text-xs sm:text-xs">
            Rendered
          </TabsTrigger>
          <TabsTrigger value="text" className="h-8 text-xs sm:text-xs">
            Text
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ToolbarIconButton label="Zoom out" onClick={onZoomOut}>
          <Minus />
        </ToolbarIconButton>
        <button
          className="w-12 text-center text-xs text-muted-foreground tabular-nums"
          title="Reset zoom"
          type="button"
          onClick={onResetZoom}
        >
          {Math.round(scale * 100)}%
        </button>
        <ToolbarIconButton label="Zoom in" onClick={onZoomIn}>
          <Plus />
        </ToolbarIconButton>
        <ToolbarIconButton label="Fit width" onClick={onFitWidth}>
          <Maximize />
        </ToolbarIconButton>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <CopyAllMarkdownButton text={document.text} />
        <ViewerDownloadControl actions={[downloadAction]} />
      </div>
    </div>
  )
}

function CopyAllMarkdownButton({ text }: { text: string }) {
  const [isCopied, setIsCopied] = React.useState(false)
  const timeoutRef = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const copy = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    void navigator.clipboard?.writeText(text).then(() => {
      setIsCopied(true)
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        setIsCopied(false)
      }, 1200)
    })
  }

  return (
    <Button
      aria-label={isCopied ? "Copied" : "Copy markdown"}
      className="size-7"
      size="icon-sm"
      title="Copy markdown"
      type="button"
      variant="ghost"
      onClick={copy}
    >
      {isCopied ? <Check /> : <Copy />}
    </Button>
  )
}

function ToolbarIconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      aria-label={label}
      className="size-7"
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
      {...props}
    >
      {children}
    </Button>
  )
}

function MarkdownVirtualPage({
  document,
  highlightRange,
  mode,
  page,
  pageMeasurementKey,
  scale,
  virtualItem,
  onMeasure,
}: {
  document: MarkdownDocument
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  mode: MarkdownDocumentViewMode
  page: MarkdownDocumentPage
  pageMeasurementKey: string
  scale: number
  virtualItem: MarkdownVirtualItem
  onMeasure: (key: string, height: number) => void
}) {
  const pageRef = React.useRef<HTMLElement | null>(null)

  React.useLayoutEffect(() => {
    const element = pageRef.current
    if (!element) return

    const syncPage = () => {
      patchMarkdownTableAccessibility(element)
      const height =
        element.offsetHeight || element.getBoundingClientRect().height
      onMeasure(pageMeasurementKey, height + MARKDOWN_VIEWER_PAGE_GAP)
    }
    syncPage()

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncPage)
    resizeObserver?.observe(element)

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(syncPage)
    mutationObserver?.observe(element, {
      attributes: false,
      childList: true,
      subtree: true,
    })

    return () => {
      mutationObserver?.disconnect()
      resizeObserver?.disconnect()
    }
  }, [pageMeasurementKey, onMeasure])

  const isHighlighted = markdownPageIntersectsLineRange({
    page,
    range: highlightRange,
  })
  const pageWidth = MARKDOWN_DOCUMENT_PAGE_WIDTH * scale
  const measuredPageHeight = Math.max(
    1,
    virtualItem.height - MARKDOWN_VIEWER_PAGE_GAP
  )

  return (
    <article
      ref={pageRef}
      aria-current={isHighlighted ? "true" : undefined}
      className={`absolute bg-card text-card-foreground shadow-sm ring-1 ring-border ${
        isHighlighted ? "ring-primary/40" : ""
      }`}
      data-page-number={page.pageNumber}
      data-slot="markdown-document-page"
      data-source-end-line={page.pageEndLine}
      data-source-line={page.pageStartLine}
      style={{
        fontSize: `${14 * scale}px`,
        left: "50%",
        minHeight: measuredPageHeight,
        paddingBlock: `${MARKDOWN_DOCUMENT_PAGE_PADDING_Y * scale}px`,
        paddingInline: `${MARKDOWN_DOCUMENT_PAGE_PADDING_X * scale}px`,
        transform: `translate(-50%, ${
          virtualItem.top + MARKDOWN_VIEWER_CANVAS_PADDING_Y
        }px)`,
        width: pageWidth,
      }}
    >
      {mode === "text" ? (
        <pre className="font-mono leading-relaxed whitespace-pre-wrap text-foreground/90">
          {page.markdown}
        </pre>
      ) : (
        <MarkdownDocumentPageRenderer
          headingIdsByLine={document.headingIdsByLine}
          highlightRange={highlightRange}
          page={page}
        />
      )}
    </article>
  )
}

function getMarkdownDocumentFitScale(viewportWidth: number) {
  const availableWidth = viewportWidth - MARKDOWN_VIEWER_FIT_PADDING_X
  const fitWidthScale = availableWidth / MARKDOWN_DOCUMENT_PAGE_WIDTH
  return clampTextViewerScale(
    Math.min(MARKDOWN_VIEWER_READING_SCALE, fitWidthScale)
  )
}

function scrollMarkdownViewportTo(
  viewport: HTMLElement | null,
  options: ScrollToOptions
) {
  if (!viewport) return
  if (typeof viewport.scrollTo === "function") {
    viewport.scrollTo(options)
    return
  }
  if (typeof options.left === "number") viewport.scrollLeft = options.left
  if (typeof options.top === "number") viewport.scrollTop = options.top
}

function currentPageFromVirtualItems({
  items,
  pages,
  scrollTop,
}: {
  items: readonly MarkdownVirtualItem[]
  pages: readonly MarkdownDocumentPage[]
  scrollTop: number
}) {
  const currentVirtualItem =
    items.find((virtualItem) => virtualItem.bottom >= scrollTop + 80) ??
    items[0]
  return pages[currentVirtualItem?.index ?? 0]?.pageNumber ?? 1
}

function localFragmentHrefFromEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  const link = target.closest<HTMLAnchorElement>('a[href^="#"]')
  const href = link?.getAttribute("href") ?? null
  return href && href.length > 1 ? href : null
}

function decodeFragmentHref(href: string) {
  try {
    return decodeURIComponent(href.slice(1))
  } catch {
    return href.slice(1)
  }
}

function patchMarkdownTableAccessibility(root: HTMLElement | null) {
  if (!root) return

  const tables = root.querySelectorAll<HTMLTableElement>(
    "table[data-markdown-table]"
  )
  tables.forEach((table, tableIndex) => {
    const headers = Array.from(table.querySelectorAll("thead th"))
    headers.forEach((header, columnIndex) => {
      if (!header.id) {
        header.id = `markdown-table-${tableIndex}-column-${columnIndex}`
      }
      header.setAttribute("scope", "col")
    })

    table.querySelectorAll("tbody tr").forEach((row) => {
      Array.from(row.querySelectorAll<HTMLTableCellElement>("td")).forEach(
        (cell, columnIndex) => {
          const header = headers[columnIndex]
          if (header) cell.headers = header.id
        }
      )
    })
  })
}
