"use client"

import * as React from "react"
import { createRoot, type Root } from "react-dom/client"

import {
  clearPdfDocumentResource,
  readPdfDocumentResource,
  readPdfPageResource,
  releasePdfDocumentResource,
  retainPdfDocumentResource,
} from "@/lib/pdf-document-resource"
import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  createPdfPageLayout,
  getPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout"
import { PdfPage } from "./pdf-viewer-page"
import { usePdfPageSizes } from "./pdf-viewer-page-sizes"
import { usePdfRenderedPageCache } from "./pdf-viewer-render-cache"
import { usePdfPageRenderScheduler } from "./pdf-viewer-render-scheduler"
import {
  getPdfPageDevicePixelRatio,
  useMeasuredElementWidth,
  usePdfScale,
} from "./pdf-viewer-scale"
import { usePdfScroll, usePdfScrollActivity } from "./pdf-viewer-scroll"
import { PageSkeleton, PdfViewerFallback } from "./pdf-viewer-states"
import type {
  PageOverlayProps,
  PdfPageRenderTiming,
  PdfPageSize,
  PdfViewerHandle,
} from "./pdf-viewer-types"
import { usePdfPageVirtualization } from "./pdf-viewer-virtualization"
import { useIsClient } from "./use-is-client"
import { usePdfPageMetrics } from "./use-pdf-page-metrics"
import {
  useViewerControlsRegistration,
  ViewerControls,
  type ViewerControlsState,
} from "./viewer-controls"
import { ViewerErrorBoundary } from "./viewer-error"

export type PdfViewerContentProps = {
  className?: string
  /** Controlled rendered scale; when omitted the viewer fits page width until manually zoomed. */
  scale?: number
  /** Initial uncontrolled scale. Leave unset for fit-to-width. */
  defaultScale?: number
  /** Called when controls request a scale change. `null` means fit width. */
  onScaleChange?: (scale: number | null) => void
  controls?: boolean
  /** Show download actions in this viewer's controls/error state. */
  download?: boolean
  /** Render absolutely-positioned overlays (e.g. bbox citations) on each page. */
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode
  /** Fired with the 1-based page nearest the top of the viewport as you scroll. */
  onVisiblePageChange?: (page: number) => void
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void
  /** Reports page render work for profiling and benchmark surfaces. */
  onPageRenderTiming?: (timing: PdfPageRenderTiming) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
}

export type PdfResourceContentProps = PdfViewerContentProps & {
  resource: ViewerResource
}

type PdfDocument = ReturnType<typeof readPdfDocumentResource>
type PdfDocumentContent = ViewerResource["content"]
type PdfPageSizeSetter = ReturnType<typeof usePdfPageSizes>["setPageSize"]

export const PdfResourceContent = React.forwardRef<
  PdfViewerHandle,
  PdfResourceContentProps
>(function PdfResourceContent(props, ref) {
  const resource = props.resource
  const isClient = useIsClient()

  if (!isClient) {
    return (
      <PdfViewerFallback
        className={props.className}
        bare={props.bare}
        controls={props.controls}
      />
    )
  }

  return (
    <ViewerErrorBoundary
      className={props.className}
      download={
        props.controls === false || props.download === false
          ? null
          : resource.originalDownload
      }
      format="pdf"
      onRetry={() => clearPdfDocumentResource(resource.content)}
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <PdfViewerFallback
            className={props.className}
            bare={props.bare}
            controls={props.controls}
          />
        }
      >
        <PdfViewerInner {...props} forwardedRef={ref} resource={resource} />
      </React.Suspense>
    </ViewerErrorBoundary>
  )
})

function PdfViewerInner({
  resource,
  className,
  scale: controlledScale,
  defaultScale,
  onScaleChange,
  controls = true,
  download = true,
  renderPageOverlay,
  onVisiblePageChange,
  onScrollProgressChange,
  onPageRenderTiming,
  bare = false,
  forwardedRef,
}: PdfResourceContentProps & {
  forwardedRef?: React.ForwardedRef<PdfViewerHandle>
}) {
  const content = resource.content
  const document = readPdfDocumentResource(content)
  const [pageRenderErrorState, setPageRenderErrorState] = React.useState<{
    resetKey: PdfDocument
    error: unknown
  } | null>(null)
  const pageRenderError =
    pageRenderErrorState && Object.is(pageRenderErrorState.resetKey, document)
      ? pageRenderErrorState.error
      : null
  usePdfDocumentResourceLifecycle(content, document)
  const firstPageSize = usePdfFirstPageSize(document)
  const { ref: containerRef, width: containerWidth } = useMeasuredElementWidth()
  const { rotation, rotateClockwise } = usePdfDocumentRotation(document)
  const fitPageWidth =
    rotation % 180 === 0 ? firstPageSize.width : firstPageSize.height
  const { resolvedScale, zoomIn, zoomOut, fitWidth } = usePdfScale({
    controlledScale,
    defaultScale,
    onScaleChange,
    containerWidth,
    pageWidth: fitPageWidth,
    resetKey: document,
  })

  const { pageSizeByNumber, setPageSize, setPageSizes } =
    usePdfPageSizes(document)
  const { metricByPageNumber, requestPageMetrics } = usePdfPageMetrics(
    document,
    document
  )
  const pageLayout = React.useMemo(
    () =>
      createPdfPageLayout({
        pageCount: document.numPages,
        defaultPageSize: firstPageSize,
        pageSizeByNumber,
        scale: resolvedScale,
        rotation,
      }),
    [
      document.numPages,
      firstPageSize,
      pageSizeByNumber,
      resolvedScale,
      rotation,
    ]
  )
  const {
    currentPage,
    viewportElement,
    setViewportElement,
    measureScroll,
    handleScroll,
    scrollToPage,
    scrollToPageArea,
    getViewportElement,
  } = usePdfScroll({
    pageCount: document.numPages,
    layout: pageLayout,
    resetKey: document,
    onVisiblePageChange,
    onScrollProgressChange,
  })
  const { isScrolling, scrollDirection, handleScrollActivity } =
    usePdfScrollActivity()
  const renderCache = usePdfRenderedPageCache(document)
  usePdfDocumentControlsRegistration({
    currentPage,
    document,
    download,
    downloadAction: resource.originalDownload,
    fitWidth,
    resolvedScale,
    rotateClockwise,
    zoomIn,
    zoomOut,
  })
  const {
    visiblePageNumbers,
    renderPageNumbers,
    preloadPageNumbers,
    measureVisiblePages,
  } = usePdfPageVirtualization({
    layout: pageLayout,
    resetKey: document,
    viewportElement,
  })
  const pageDevicePixelRatio = getPdfPageDevicePixelRatio({
    devicePixelRatio:
      (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1,
    mode: isScrolling ? "scrolling" : "settled",
  })
  const lowPriorityRenderPageNumbers = React.useMemo(
    () =>
      isScrolling
        ? []
        : getDirectionAwarePdfPreRenderPageNumbers({
            pageCount: document.numPages,
            renderPageNumbers,
            scrollDirection,
          }),
    [document.numPages, isScrolling, renderPageNumbers, scrollDirection]
  )
  const {
    activePageNumbers: activeRenderPageNumbers,
    onPageRenderTiming: handleScheduledPageRenderTiming,
  } = usePdfPageRenderScheduler({
    pageNumbers: renderPageNumbers,
    lowPriorityPageNumbers: lowPriorityRenderPageNumbers,
    scale: resolvedScale,
    rotation,
    devicePixelRatio: pageDevicePixelRatio,
    resetKey: document,
    maxRunning: isScrolling ? 1 : undefined,
  })
  const handlePageRenderTiming = React.useCallback(
    (timing: PdfPageRenderTiming) => {
      handleScheduledPageRenderTiming(timing)
      onPageRenderTiming?.(timing)
    },
    [handleScheduledPageRenderTiming, onPageRenderTiming]
  )
  const handlePageRenderError = React.useCallback(
    (error: unknown) => {
      setPageRenderErrorState({ resetKey: document, error })
    },
    [document]
  )

  React.useEffect(() => {
    requestPageMetrics([
      ...preloadPageNumbers,
      ...lowPriorityRenderPageNumbers,
    ])
  }, [lowPriorityRenderPageNumbers, preloadPageNumbers, requestPageMetrics])

  React.useEffect(() => {
    setPageSizes(metricByPageNumber)
  }, [metricByPageNumber, setPageSizes])

  React.useEffect(() => {
    measureScroll()
  }, [
    document.numPages,
    measureScroll,
    rotation,
    resolvedScale,
    viewportElement,
  ])

  const handleViewportScroll = React.useCallback(() => {
    handleScrollActivity(viewportElement ?? undefined)
    handleScroll()
    measureVisiblePages()
  }, [
    handleScroll,
    handleScrollActivity,
    measureVisiblePages,
    viewportElement,
  ])

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToPage,
      scrollToPageArea,
      getViewportElement,
    }),
    [getViewportElement, scrollToPage, scrollToPageArea]
  )

  if (pageRenderError) throw pageRenderError

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="pdf-viewer"
    >
      {controls ? (
        <ViewerControls
          position={{
            kind: "page",
            current: currentPage,
            total: document.numPages,
          }}
          zoom={{
            scale: resolvedScale,
            onZoomOut: zoomOut,
            onZoomIn: zoomIn,
            onFit: fitWidth,
          }}
          rotate={{ onRotate: rotateClockwise }}
          downloads={download ? [resource.originalDownload] : []}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <ScrollArea
              className="min-h-0 flex-1"
              viewportRef={setViewportElement}
              viewportProps={{ onScroll: handleViewportScroll }}
            >
              <PdfDocumentPagesLayer
                containerRef={containerRef}
                document={document}
                layout={pageLayout}
                pageNumbers={mergePdfPageNumbers([
                  ...visiblePageNumbers,
                  ...activeRenderPageNumbers,
                ])}
                renderPageNumbers={activeRenderPageNumbers}
                renderPageOverlay={renderPageOverlay}
                renderCache={renderCache}
                rotation={rotation}
                scale={resolvedScale}
                devicePixelRatio={pageDevicePixelRatio}
                onPageRenderTiming={handlePageRenderTiming}
                onPageRenderError={handlePageRenderError}
                setPageSize={setPageSize}
              />
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}

function getDirectionAwarePdfPreRenderPageNumbers({
  pageCount,
  renderPageNumbers,
  scrollDirection,
}: {
  pageCount: number
  renderPageNumbers: readonly number[]
  scrollDirection: number
}) {
  if (renderPageNumbers.length === 0) return []

  const edgePageNumber =
    scrollDirection >= 0
      ? renderPageNumbers[renderPageNumbers.length - 1]
      : renderPageNumbers[0]
  const pageNumber = edgePageNumber + (scrollDirection >= 0 ? 1 : -1)
  return pageNumber >= 1 && pageNumber <= pageCount ? [pageNumber] : []
}

function usePdfDocumentResourceLifecycle(
  content: PdfDocumentContent,
  document: PdfDocument
) {
  React.useEffect(() => {
    retainPdfDocumentResource(content, document)
    return () => releasePdfDocumentResource(content, document)
  }, [content, document])
}

function usePdfFirstPageSize(document: PdfDocument): PdfPageSize {
  const firstPage = readPdfPageResource(document, 1)

  return React.useMemo<PdfPageSize>(() => {
    const viewport = firstPage.getViewport({ scale: 1 })
    return { width: viewport.width, height: viewport.height }
  }, [firstPage])
}

function usePdfDocumentRotation(document: PdfDocument) {
  const [rotationState, setRotationState] = React.useState<{
    document: PdfDocument
    value: number
  }>(() => ({ document, value: 0 }))
  const rotation = Object.is(rotationState.document, document)
    ? rotationState.value
    : 0
  const rotateClockwise = React.useCallback(() => {
    setRotationState((state) => ({
      document,
      value:
        ((Object.is(state.document, document) ? state.value : 0) + 90) % 360,
    }))
  }, [document])

  return { rotation, rotateClockwise }
}

function usePdfDocumentControlsRegistration({
  currentPage,
  document,
  download,
  downloadAction,
  fitWidth,
  resolvedScale,
  rotateClockwise,
  zoomIn,
  zoomOut,
}: {
  currentPage: number
  document: PdfDocument
  download: boolean
  downloadAction: ViewerResource["originalDownload"]
  fitWidth: () => void
  resolvedScale: number
  rotateClockwise: () => void
  zoomIn: () => void
  zoomOut: () => void
}) {
  const onControlsChange = useViewerControlsRegistration()
  const controlsState = React.useMemo<ViewerControlsState>(
    () => ({
      position: {
        kind: "page",
        current: currentPage,
        total: document.numPages,
      },
      zoom: {
        scale: resolvedScale,
        onZoomOut: zoomOut,
        onZoomIn: zoomIn,
        onFit: fitWidth,
      },
      rotate: { onRotate: rotateClockwise },
      downloads: download ? [downloadAction] : [],
    }),
    [
      currentPage,
      document.numPages,
      download,
      downloadAction,
      fitWidth,
      resolvedScale,
      rotateClockwise,
      zoomIn,
      zoomOut,
    ]
  )

  React.useEffect(() => {
    if (!onControlsChange) return
    onControlsChange(controlsState)
    return () => onControlsChange(null)
  }, [onControlsChange, controlsState])
}

function PdfDocumentPagesLayer({
  containerRef,
  document,
  layout,
  pageNumbers,
  renderPageNumbers,
  renderPageOverlay,
  renderCache,
  rotation,
  scale,
  devicePixelRatio,
  onPageRenderTiming,
  onPageRenderError,
  setPageSize,
}: {
  containerRef: React.RefCallback<HTMLDivElement>
  document: PdfDocument
  layout: PdfPageLayoutModel
  pageNumbers: readonly number[]
  renderPageNumbers: readonly number[]
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode
  renderCache: ReturnType<typeof usePdfRenderedPageCache>
  rotation: number
  scale: number
  devicePixelRatio: number
  onPageRenderTiming?: (timing: PdfPageRenderTiming) => void
  onPageRenderError: (error: unknown) => void
  setPageSize: PdfPageSizeSetter
}) {
  const projectionCanvasRef = React.useRef<HTMLDivElement | null>(null)
  const projectionCacheRef = React.useRef<PdfPageProjectionCache>({
    pages: new Map(),
    resetKey: "",
  })
  const projectionResetKey = String(getPdfProjectionDocumentKey(document))

  const setProjectionCanvas = React.useCallback(
    (element: HTMLDivElement | null) => {
      projectionCanvasRef.current = element
    },
    []
  )

  React.useLayoutEffect(() => {
    projectPdfPages({
      cache: projectionCacheRef.current,
      canvas: projectionCanvasRef.current,
      devicePixelRatio,
      document,
      layout,
      onPageRenderError,
      onPageRenderTiming,
      pageNumbers,
      renderCache,
      renderPageNumbers,
      renderPageOverlay,
      resetKey: projectionResetKey,
      rotation,
      scale,
      setPageSize,
    })
  }, [
    devicePixelRatio,
    document,
    layout,
    onPageRenderError,
    onPageRenderTiming,
    pageNumbers,
    projectionResetKey,
    renderCache,
    renderPageNumbers,
    renderPageOverlay,
    rotation,
    scale,
    setPageSize,
  ])

  React.useEffect(
    () => () => disposePdfPageProjectionCache(projectionCacheRef.current),
    []
  )

  return (
    <div
      ref={containerRef}
      data-slot="pdf-viewer-fit-width-measure"
      className="relative min-w-0"
    >
      <div
        data-slot="pdf-viewer-document"
        className="relative mx-auto"
        style={{
          height: layout.totalHeight,
          minWidth: layout.maxPageWidth,
        }}
        ref={setProjectionCanvas}
      />
    </div>
  )
}

type PdfPageProjectionCache = {
  pages: Map<number, ProjectedPdfPage>
  resetKey: string
}

type ProjectedPdfPage = {
  renderKey: string
  root: Root
  shell: HTMLElement
}

const pdfProjectionDocumentKeys = new WeakMap<PdfDocument, number>()
const pdfProjectionCallbackKeys = new WeakMap<object, number>()
let nextPdfProjectionDocumentKey = 1
let nextPdfProjectionCallbackKey = 1

function projectPdfPages({
  cache,
  canvas,
  devicePixelRatio,
  document,
  layout,
  onPageRenderTiming,
  onPageRenderError,
  pageNumbers,
  renderCache,
  renderPageNumbers,
  renderPageOverlay,
  resetKey,
  rotation,
  scale,
  setPageSize,
}: {
  cache: PdfPageProjectionCache
  canvas: HTMLDivElement | null
  devicePixelRatio: number
  document: PdfDocument
  layout: PdfPageLayoutModel
  onPageRenderTiming?: (timing: PdfPageRenderTiming) => void
  onPageRenderError: (error: unknown) => void
  pageNumbers: readonly number[]
  renderCache: ReturnType<typeof usePdfRenderedPageCache>
  renderPageNumbers: readonly number[]
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode
  resetKey: string
  rotation: number
  scale: number
  setPageSize: PdfPageSizeSetter
}) {
  if (!canvas) return

  if (cache.resetKey !== resetKey) {
    disposePdfPageProjectionCache(cache)
    cache.resetKey = resetKey
  }

  const renderPageNumberSet = new Set(renderPageNumbers)
  const pageNumberSet = new Set(pageNumbers)
  let previousShell: HTMLElement | null = null

  for (const pageNumber of pageNumbers) {
    const page = getPdfPageLayout(layout, pageNumber)
    if (!page) continue

    const projectedPage =
      cache.pages.get(pageNumber) ?? createProjectedPdfPage(pageNumber)
    patchProjectedPdfPage(projectedPage.shell, page)
    renderProjectedPdfPage({
      devicePixelRatio,
      document,
      onPageRenderError,
      onPageRenderTiming,
      page,
      projectedPage,
      renderCache,
      renderOverlay: renderPageOverlay,
      renderPage: renderPageNumberSet.has(pageNumber),
      rotation,
      scale,
      setPageSize,
    })
    cache.pages.set(pageNumber, projectedPage)
    placeProjectedPdfPage(canvas, projectedPage.shell, previousShell)
    previousShell = projectedPage.shell
  }

  for (const [pageNumber, projectedPage] of cache.pages) {
    if (pageNumberSet.has(pageNumber)) continue
    disposeProjectedPdfPage(projectedPage)
    cache.pages.delete(pageNumber)
  }
}

function createProjectedPdfPage(pageNumber: number): ProjectedPdfPage {
  const shell = document.createElement("div")
  shell.className =
    "absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
  shell.dataset.slot = "pdf-page-slot"
  shell.dataset.pageNumber = String(pageNumber)

  return {
    renderKey: "",
    root: createRoot(shell),
    shell,
  }
}

function patchProjectedPdfPage(
  shell: HTMLElement,
  page: NonNullable<ReturnType<typeof getPdfPageLayout>>
) {
  shell.dataset.pageNumber = String(page.pageNumber)
  shell.style.top = `${page.offsetTop}px`
  shell.style.width = `${page.width}px`
  shell.style.minHeight = `${page.height}px`
}

function renderProjectedPdfPage({
  devicePixelRatio,
  document,
  onPageRenderTiming,
  onPageRenderError,
  page,
  projectedPage,
  renderCache,
  renderOverlay,
  renderPage,
  rotation,
  scale,
  setPageSize,
}: {
  devicePixelRatio: number
  document: PdfDocument
  onPageRenderTiming?: (timing: PdfPageRenderTiming) => void
  onPageRenderError: (error: unknown) => void
  page: NonNullable<ReturnType<typeof getPdfPageLayout>>
  projectedPage: ProjectedPdfPage
  renderCache: ReturnType<typeof usePdfRenderedPageCache>
  renderOverlay?: (props: PageOverlayProps) => React.ReactNode
  renderPage: boolean
  rotation: number
  scale: number
  setPageSize: PdfPageSizeSetter
}) {
  const renderKey = [
    page.pageNumber,
    renderPage ? "render" : "skeleton",
    getPdfProjectionDocumentKey(document),
    page.width,
    page.height,
    scale,
    rotation,
    devicePixelRatio,
    getPdfProjectionCallbackKey(renderOverlay),
    getPdfProjectionCallbackKey(onPageRenderTiming),
    getPdfProjectionCallbackKey(onPageRenderError),
    getPdfProjectionCallbackKey(setPageSize),
  ].join("\u0000")

  if (projectedPage.renderKey === renderKey) return
  projectedPage.renderKey = renderKey
  projectedPage.root.render(
    <PdfPageProjectionErrorBoundary
      onError={onPageRenderError}
      resetKey={renderKey}
    >
      {renderPage ? (
        <React.Suspense fallback={<PageSkeleton />}>
          <PdfPage
            document={document}
            pageNumber={page.pageNumber}
            scale={scale}
            rotation={rotation}
            devicePixelRatio={devicePixelRatio}
            renderOverlay={renderOverlay}
            onRenderTiming={onPageRenderTiming}
            onSize={setPageSize}
            renderCache={renderCache}
          />
        </React.Suspense>
      ) : (
        <PageSkeleton />
      )}
    </PdfPageProjectionErrorBoundary>
  )
}

function placeProjectedPdfPage(
  canvas: HTMLElement,
  shell: HTMLElement,
  previousShell: HTMLElement | null
) {
  const nextSibling = previousShell
    ? previousShell.nextSibling
    : canvas.firstChild
  if (shell === nextSibling) return
  canvas.insertBefore(shell, nextSibling)
}

function disposePdfPageProjectionCache(cache: PdfPageProjectionCache) {
  for (const projectedPage of cache.pages.values()) {
    disposeProjectedPdfPage(projectedPage)
  }
  cache.pages.clear()
}

function disposeProjectedPdfPage(projectedPage: ProjectedPdfPage) {
  projectedPage.shell.remove()
  deferPdfRootUnmount(projectedPage.root)
}

function deferPdfRootUnmount(root: Root) {
  const unmount = () => root.unmount()
  if (typeof queueMicrotask === "function") {
    queueMicrotask(unmount)
    return
  }
  window.setTimeout(unmount, 0)
}

function mergePdfPageNumbers(pageNumbers: readonly number[]) {
  return [...new Set(pageNumbers)].sort((left, right) => left - right)
}

function getPdfProjectionDocumentKey(document: PdfDocument) {
  const cached = pdfProjectionDocumentKeys.get(document)
  if (cached) return cached
  const key = nextPdfProjectionDocumentKey
  nextPdfProjectionDocumentKey += 1
  pdfProjectionDocumentKeys.set(document, key)
  return key
}

function getPdfProjectionCallbackKey(
  callback: object | undefined
) {
  if (!callback) return 0
  const cached = pdfProjectionCallbackKeys.get(callback)
  if (cached) return cached
  const key = nextPdfProjectionCallbackKey
  nextPdfProjectionCallbackKey += 1
  pdfProjectionCallbackKeys.set(callback, key)
  return key
}

class PdfPageProjectionErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    onError: (error: unknown) => void
    resetKey: string
  },
  { error: unknown | null }
> {
  state: Readonly<{ error: unknown | null }> = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidUpdate(previousProps: {
    children: React.ReactNode
    onError: (error: unknown) => void
    resetKey: string
  }) {
    if (
      previousProps.resetKey !== this.props.resetKey &&
      this.state.error != null
    ) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error)
  }

  render() {
    if (this.state.error != null) return null
    return this.props.children
  }
}
