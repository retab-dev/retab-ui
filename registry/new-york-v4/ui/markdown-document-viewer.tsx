"use client"

import * as React from "react"
import { Check, Copy, Maximize, Minus, Plus } from "lucide-react"
import { createRoot, type Root } from "react-dom/client"

import type { ViewerResource } from "@/lib/viewer-resource"

import { Button } from "./button"
import {
  createMarkdownLayoutStyle,
  createMarkdownChunkEstimates,
  MARKDOWN_DOCUMENT_CHUNK_PADDING_X,
  MARKDOWN_DOCUMENT_CHUNK_PADDING_Y,
  MARKDOWN_DOCUMENT_COLUMN_WIDTH,
} from "./markdown-document-layout"
import {
  createMarkdownDocument,
  findMarkdownChunkForLine,
  markdownChunkIntersectsLineRange,
  type MarkdownDocument,
  type MarkdownDocumentChunk,
} from "./markdown-document-model"
import { MarkdownDocumentChunkRenderer } from "./markdown-document-renderer"
import { patchMarkdownChunkTables } from "./markdown-document-table-accessibility"
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
const MARKDOWN_VIEWER_CHUNK_GAP = 0
const MARKDOWN_VIEWER_READING_SCALE = 0.75
const MARKDOWN_VIEWER_ZOOM_STEP = 1.2

type MarkdownDocumentViewMode = "rendered" | "text"

type ViewportSize = {
  height: number
  width: number
}

type MarkdownViewportAnchor = {
  anchor: ReturnType<typeof getMarkdownScrollAnchor>
  topPaddingScroll: number
}

const MarkdownProjectionCanvas = React.forwardRef<HTMLDivElement>(
  function MarkdownProjectionCanvas(_, ref) {
    return (
      <div
        ref={ref}
        className="relative mx-auto min-w-0"
        data-slot="markdown-document-virtual-canvas"
      />
    )
  }
)

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
  const [viewportSize, setViewportSize] = React.useState<ViewportSize>({
    height: 0,
    width: 0,
  })
  const [measuredHeights, setMeasuredHeights] = React.useState<
    Map<string, number>
  >(() => new Map())
  const canvasRef = React.useRef<HTMLDivElement | null>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const scrollFrameRef = React.useRef<number | null>(null)
  const scrollTopRef = React.useRef(0)
  const projectionCacheRef = React.useRef<MarkdownProjectionCache>({
    measurementKey: "",
    chunks: new Map(),
  })
  const pendingAnchorRef = React.useRef<MarkdownViewportAnchor | null>(null)
  const viewportHeight =
    viewportSize.height || MARKDOWN_VIEWER_DEFAULT_VIEWPORT_HEIGHT
  const viewportWidth =
    viewportSize.width || MARKDOWN_VIEWER_DEFAULT_VIEWPORT_WIDTH
  const fitScale = React.useMemo(
    () => getMarkdownDocumentFitScale(viewportWidth),
    [viewportWidth]
  )
  const scale = manualScale ?? fitScale
  const highlightRange = React.useMemo(
    () => normalizeTextLineRange(highlight, document.lineCount),
    [document.lineCount, highlight]
  )
  const chunkMeasurementKey = React.useMemo(
    () => `${mode}:${scale.toFixed(3)}:${viewportWidth}:${text.length}`,
    [mode, scale, text.length, viewportWidth]
  )
  const chunkEstimates = React.useMemo(
    () =>
      createMarkdownChunkEstimates(
        document,
        createMarkdownLayoutStyle({
          contentWidth: MARKDOWN_DOCUMENT_COLUMN_WIDTH * scale,
          zoom: scale,
        })
      ),
    [document, scale]
  )
  const estimateHeight = React.useCallback(
    (index: number) => (chunkEstimates[index] ?? 1) + MARKDOWN_VIEWER_CHUNK_GAP,
    [chunkEstimates]
  )
  const getKey = React.useCallback(
    (index: number) =>
      `${chunkMeasurementKey}:${document.chunks[index]?.id ?? index}`,
    [document.chunks, chunkMeasurementKey]
  )
  const virtualGeometry = React.useMemo(
    () =>
      createMarkdownVirtualGeometry({
        count: document.chunks.length,
        estimateHeight,
        getKey,
        measuredHeights,
      }),
    [document.chunks.length, estimateHeight, getKey, measuredHeights]
  )
  React.useEffect(() => {
    setMeasuredHeights(new Map())
  }, [chunkMeasurementKey])

  React.useEffect(() => {
    pendingAnchorRef.current = null
    setManualScale(null)
    scrollTopRef.current = 0
    scrollMarkdownViewportTo(viewportRef.current, { left: 0, top: 0 })
  }, [document])

  const readVirtualScrollTop = React.useCallback(() => {
    return Math.max(
      0,
      (viewportRef.current?.scrollTop ?? scrollTopRef.current) -
        MARKDOWN_VIEWER_CANVAS_PADDING_Y
    )
  }, [])

  const captureScrollAnchor = React.useCallback(() => {
    const scrollTop = viewportRef.current?.scrollTop ?? scrollTopRef.current
    pendingAnchorRef.current = {
      anchor: getMarkdownScrollAnchor({
        geometry: virtualGeometry,
        scrollTop: readVirtualScrollTop(),
      }),
      topPaddingScroll: Math.min(scrollTop, MARKDOWN_VIEWER_CANVAS_PADDING_Y),
    }
  }, [readVirtualScrollTop, virtualGeometry])

  React.useLayoutEffect(() => {
    const pendingAnchor = pendingAnchorRef.current
    const viewport = viewportRef.current
    if (!pendingAnchor || !viewport) return

    pendingAnchorRef.current = null
    if (!pendingAnchor.anchor) return

    const nextVirtualScrollTop = scrollTopForMarkdownAnchor({
      anchor: pendingAnchor.anchor,
      geometry: virtualGeometry,
    })
    viewport.scrollTop = nextVirtualScrollTop + pendingAnchor.topPaddingScroll
    scrollTopRef.current = viewport.scrollTop
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

  const measureChunk = React.useCallback(
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

  const projectChunks = React.useCallback(() => {
    scrollFrameRef.current = null
    projectMarkdownChunks({
      cache: projectionCacheRef.current,
      canvas: canvasRef.current,
      document,
      geometry: virtualGeometry,
      highlightRange,
      measureChunk,
      measurementKey: chunkMeasurementKey,
      mode,
      scale,
      viewport: viewportRef.current,
      viewportHeight,
    })
  }, [
    document,
    virtualGeometry,
    highlightRange,
    measureChunk,
    mode,
    chunkMeasurementKey,
    scale,
    viewportHeight,
  ])

  const scheduleProjectChunks = React.useCallback(() => {
    if (scrollFrameRef.current !== null) return
    if (typeof requestAnimationFrame === "undefined") {
      projectChunks()
      return
    }
    scrollFrameRef.current = requestAnimationFrame(projectChunks)
  }, [projectChunks])

  const handleScroll = React.useCallback(() => {
    scrollTopRef.current = viewportRef.current?.scrollTop ?? 0
    scheduleProjectChunks()
  }, [scheduleProjectChunks])

  React.useLayoutEffect(() => {
    projectChunks()
  }, [projectChunks])

  React.useEffect(
    () => () => {
      if (
        scrollFrameRef.current !== null &&
        typeof cancelAnimationFrame !== "undefined"
      ) {
        cancelAnimationFrame(scrollFrameRef.current)
      }
      disposeMarkdownProjectionCache(projectionCacheRef.current)
    },
    []
  )

  const scrollToChunkIndex = React.useCallback(
    (index: number, options?: ScrollToOptions, sourceLine?: number) => {
      const viewport = viewportRef.current
      if (!viewport || document.chunks.length === 0) return
      const chunk = document.chunks[index]
      const lineOffset =
        chunk && sourceLine
          ? Math.max(0, sourceLine - chunk.chunkStartLine) * 24 * scale
          : 0
      const targetTop =
        MARKDOWN_VIEWER_CANVAS_PADDING_Y +
        topForMarkdownIndex({
          geometry: virtualGeometry,
          index,
        }) +
        lineOffset
      const maxTop =
        MARKDOWN_VIEWER_CANVAS_PADDING_Y +
        Math.max(0, virtualGeometry.totalHeight - viewport.clientHeight)
      const top = Math.min(maxTop, Math.max(0, targetTop))
      scrollMarkdownViewportTo(viewport, {
        behavior: "smooth",
        top,
        ...options,
      })
      scrollTopRef.current = top
      projectChunks()
    },
    [document.chunks, projectChunks, scale, virtualGeometry]
  )

  const scrollToLineRange = React.useCallback(
    (
      range: ReturnType<typeof normalizeTextLineRange>,
      options?: ScrollToOptions
    ) => {
      if (!range) return
      const chunk = findMarkdownChunkForLine(document.chunks, range.start)
      if (!chunk) return
      scrollToChunkIndex(chunk.chunkIndex, options, range.start)
    },
    [document.chunks, scrollToChunkIndex]
  )

  React.useImperativeHandle(
    forwardedRef ?? null,
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
      const targetChunk = document.chunks.find((chunk) =>
        chunk.blocks.some((block) => block.headingId === targetId)
      )
      if (!targetChunk) return

      event.preventDefault()
      const targetLine =
        targetChunk.blocks.find((block) => block.headingId === targetId)
          ?.blockStartLine ?? targetChunk.chunkStartLine
      scrollToChunkIndex(targetChunk.chunkIndex, undefined, targetLine)
      if (window.location.hash !== href) {
        window.history.replaceState(null, "", href)
      }
    },
    [document.chunks, scrollToChunkIndex]
  )

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <MarkdownDocumentToolbar
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
        className="min-h-0 flex-1 bg-background"
        orientation="vertical"
        viewportClassName="bg-background"
        viewportProps={{
          onClickCapture: handleFragmentClick,
          onScroll: handleScroll,
        }}
        viewportRef={viewportRef}
      >
        <MarkdownProjectionCanvas ref={canvasRef} />
      </ScrollArea>
    </TextViewerFrame>
  )
}

function MarkdownDocumentToolbar({
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

type MarkdownProjectionCache = {
  measurementKey: string
  chunks: Map<string, MarkdownProjectedChunk>
}

type MarkdownProjectedChunk = {
  renderKey: string
  resizeObserver: ResizeObserver | null
  root: Root
  shell: HTMLElement
}

function projectMarkdownChunks({
  cache,
  canvas,
  document,
  geometry,
  highlightRange,
  measureChunk,
  measurementKey,
  mode,
  scale,
  viewport,
  viewportHeight,
}: {
  cache: MarkdownProjectionCache
  canvas: HTMLDivElement | null
  document: MarkdownDocument
  geometry: ReturnType<typeof createMarkdownVirtualGeometry>
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  measureChunk: (key: string, height: number) => void
  measurementKey: string
  mode: MarkdownDocumentViewMode
  scale: number
  viewport: HTMLDivElement | null
  viewportHeight: number
}) {
  if (!canvas) return

  canvas.style.height = `${
    geometry.totalHeight + MARKDOWN_VIEWER_CANVAS_PADDING_Y * 2
  }px`
  canvas.style.width = `${Math.max(1, MARKDOWN_DOCUMENT_COLUMN_WIDTH * scale)}px`

  if (cache.measurementKey !== measurementKey) {
    disposeMarkdownProjectionCache(cache)
    cache.measurementKey = measurementKey
  }

  const scrollTop = Math.max(
    0,
    (viewport?.scrollTop ?? 0) - MARKDOWN_VIEWER_CANVAS_PADDING_Y
  )
  const virtualWindow = getMarkdownVirtualItems({
    geometry,
    overscanPx: MARKDOWN_VIEWER_OVERSCAN_PX,
    scrollTop,
    viewportHeight,
  })
  const visibleKeys = new Set(
    virtualWindow.items.map((virtualItem) => virtualItem.key)
  )

  for (const [key, projectedChunk] of cache.chunks) {
    if (visibleKeys.has(key)) continue
    disposeMarkdownProjectedChunk(projectedChunk)
    cache.chunks.delete(key)
  }

  for (const virtualItem of virtualWindow.items) {
    const chunk = document.chunks[virtualItem.index]
    if (!chunk) continue
    const projectedChunk =
      cache.chunks.get(virtualItem.key) ??
      createMarkdownProjectedChunk({
        cache,
        key: virtualItem.key,
        measureChunk,
        chunk,
      })

    patchMarkdownChunkShell({
      highlightRange,
      chunk,
      projectedChunk,
      scale,
      virtualItem,
    })
    renderMarkdownProjectedChunk({
      document,
      highlightRange,
      measureChunk,
      mode,
      chunk,
      projectedChunk,
      virtualItem,
    })
    canvas.append(projectedChunk.shell)
  }

}

function createMarkdownProjectedChunk({
  cache,
  key,
  measureChunk,
  chunk,
}: {
  cache: MarkdownProjectionCache
  key: string
  measureChunk: (key: string, height: number) => void
  chunk: MarkdownDocumentChunk
}) {
  const shell = document.createElement("article")
  const projectedChunk: MarkdownProjectedChunk = {
    renderKey: "",
    resizeObserver:
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() =>
            syncMarkdownProjectedChunk({
              measureChunk,
              chunk,
              chunkMeasurementKey: key,
              projectedChunk,
            })
          ),
    root: createRoot(shell),
    shell,
  }
  projectedChunk.resizeObserver?.observe(shell)
  cache.chunks.set(key, projectedChunk)
  return projectedChunk
}

function patchMarkdownChunkShell({
  highlightRange,
  chunk,
  projectedChunk,
  scale,
  virtualItem,
}: {
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  chunk: MarkdownDocumentChunk
  projectedChunk: MarkdownProjectedChunk
  scale: number
  virtualItem: MarkdownVirtualItem
}) {
  const isHighlighted = markdownChunkIntersectsLineRange({
    chunk,
    range: highlightRange,
  })
  projectedChunk.shell.ariaCurrent = isHighlighted ? "true" : null
  projectedChunk.shell.className = `absolute text-card-foreground ${
    isHighlighted ? "bg-primary/5 ring-1 ring-primary/30" : ""
  }`
  delete projectedChunk.shell.dataset.chunkIndex
  projectedChunk.shell.dataset.chunkIndex = String(chunk.chunkIndex)
  projectedChunk.shell.dataset.slot = "markdown-document-chunk"
  projectedChunk.shell.dataset.sourceEndLine = String(chunk.chunkEndLine)
  projectedChunk.shell.dataset.sourceLine = String(chunk.chunkStartLine)
  projectedChunk.shell.style.fontSize = `${14 * scale}px`
  projectedChunk.shell.style.left = "50%"
  projectedChunk.shell.style.minHeight = ""
  projectedChunk.shell.style.paddingBlock = "0px"
  projectedChunk.shell.style.paddingInline = `${
    MARKDOWN_DOCUMENT_CHUNK_PADDING_X * scale
  }px`
  projectedChunk.shell.style.transform = `translate(-50%, ${
    virtualItem.top + MARKDOWN_VIEWER_CANVAS_PADDING_Y
  }px)`
  projectedChunk.shell.style.width = `${MARKDOWN_DOCUMENT_COLUMN_WIDTH * scale}px`
}

function renderMarkdownProjectedChunk({
  document,
  highlightRange,
  measureChunk,
  mode,
  chunk,
  projectedChunk,
  virtualItem,
}: {
  document: MarkdownDocument
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  measureChunk: (key: string, height: number) => void
  mode: MarkdownDocumentViewMode
  chunk: MarkdownDocumentChunk
  projectedChunk: MarkdownProjectedChunk
  virtualItem: MarkdownVirtualItem
}) {
  const renderKey = [
    virtualItem.key,
    mode,
    chunk.id,
    chunk.markdown,
    chunk.sourceText,
    highlightRange?.start ?? "",
    highlightRange?.end ?? "",
  ].join("\u0000")
  if (projectedChunk.renderKey === renderKey) return

  projectedChunk.renderKey = renderKey
  const syncChunk = () =>
    syncMarkdownProjectedChunk({
      measureChunk,
      chunk,
      chunkMeasurementKey: virtualItem.key,
      projectedChunk,
    })
  projectedChunk.root.render(
    <MarkdownVirtualChunkContent
      document={document}
      highlightRange={highlightRange}
      mode={mode}
      chunk={chunk}
      onContentReady={syncChunk}
    />
  )
}

function syncMarkdownProjectedChunk({
  measureChunk,
  chunk,
  chunkMeasurementKey,
  projectedChunk,
}: {
  measureChunk: (key: string, height: number) => void
  chunk: MarkdownDocumentChunk
  chunkMeasurementKey: string
  projectedChunk: MarkdownProjectedChunk
}) {
  patchMarkdownChunkTables({ chunkId: chunk.id, root: projectedChunk.shell })
  const content = projectedChunk.shell.querySelector<HTMLElement>(
    '[data-slot="markdown-document-rendered-content"], [data-slot="markdown-document-text-content"]'
  )
  const height = measureMarkdownProjectedChunkHeight({
    content,
    shell: projectedChunk.shell,
  })
  if (!Number.isFinite(height) || height <= 0) return
  measureChunk(chunkMeasurementKey, height + MARKDOWN_VIEWER_CHUNK_GAP)
}

function measureMarkdownProjectedChunkHeight({
  content,
  shell,
}: {
  content: HTMLElement | null
  shell: HTMLElement
}) {
  const contentHeight = content ? measuredElementHeight(content) : 0
  const contentBoxHeight =
    contentHeight > 0
      ? contentHeight + elementVerticalPadding(shell)
      : measuredElementHeight(shell)
  const shellScrollHeight = shell.scrollHeight
  const shellMinHeight = cssPixels(shell.style.minHeight)
  const overflowingShellHeight =
    shellScrollHeight > shellMinHeight + 0.5 ? shellScrollHeight : 0

  return Math.max(contentBoxHeight, overflowingShellHeight)
}

function measuredElementHeight(element: HTMLElement) {
  return element.offsetHeight || element.getBoundingClientRect().height
}

function elementVerticalPadding(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  const physicalPadding =
    cssPixels(style.paddingTop) + cssPixels(style.paddingBottom)
  if (physicalPadding > 0) return physicalPadding
  const logicalPadding = cssPixels(element.style.paddingBlock)
  return logicalPadding > 0 ? logicalPadding * 2 : 0
}

function cssPixels(value: string) {
  const pixels = Number.parseFloat(value)
  return Number.isFinite(pixels) ? pixels : 0
}

function disposeMarkdownProjectionCache(cache: MarkdownProjectionCache) {
  for (const projectedChunk of cache.chunks.values()) {
    disposeMarkdownProjectedChunk(projectedChunk)
  }
  cache.chunks.clear()
}

function disposeMarkdownProjectedChunk(projectedChunk: MarkdownProjectedChunk) {
  projectedChunk.resizeObserver?.disconnect()
  deferMarkdownRootUnmount(projectedChunk.root)
  projectedChunk.shell.remove()
}

function deferMarkdownRootUnmount(root: Root) {
  const unmount = () => root.unmount()
  if (typeof queueMicrotask === "function") {
    queueMicrotask(unmount)
    return
  }
  window.setTimeout(unmount, 0)
}

function MarkdownVirtualChunkContent({
  document,
  highlightRange,
  mode,
  chunk,
  onContentReady,
}: {
  document: MarkdownDocument
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  mode: MarkdownDocumentViewMode
  chunk: MarkdownDocumentChunk
  onContentReady: () => void
}) {
  React.useLayoutEffect(() => {
    onContentReady()
  }, [onContentReady])

  return mode === "text" ? (
    <pre
      className="font-mono leading-relaxed whitespace-pre-wrap text-foreground/90"
      data-slot="markdown-document-text-content"
    >
      {chunk.sourceText}
    </pre>
  ) : (
    <MarkdownDocumentChunkRenderer
      headingIdsByLine={document.headingIdsByLine}
      highlightRange={highlightRange}
      onContentReady={onContentReady}
      chunk={chunk}
    />
  )
}

function getMarkdownDocumentFitScale(viewportWidth: number) {
  const availableWidth = viewportWidth - MARKDOWN_VIEWER_FIT_PADDING_X
  const fitWidthScale = availableWidth / MARKDOWN_DOCUMENT_COLUMN_WIDTH
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
