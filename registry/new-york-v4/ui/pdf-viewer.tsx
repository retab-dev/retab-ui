"use client"

import * as React from "react"

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
  PdfViewerProvider,
  useOptionalPdfViewerHeaderControls,
  usePdfViewer,
  usePdfViewerHeader,
  usePdfViewerPages,
  type PdfDocumentSource,
  type PdfViewerHeaderControls,
} from "./pdf-viewer-context"
import { createPdfPageLayout, getPdfPageLayout } from "./pdf-viewer-layout"
import { PdfPage } from "./pdf-viewer-page"
import { usePdfPageSizes } from "./pdf-viewer-page-sizes"
import { useMeasuredElementWidth, usePdfScale } from "./pdf-viewer-scale"
import { usePdfScroll } from "./pdf-viewer-scroll"
import { PageSkeleton, PdfViewerFallback } from "./pdf-viewer-states"
import { PdfViewerControls, PdfViewerToolbar } from "./pdf-viewer-toolbar"
import type {
  PageOverlayProps,
  PdfPageSize,
  PdfViewerHandle,
} from "./pdf-viewer-types"
import { usePdfPageVirtualization } from "./pdf-viewer-virtualization"
import { useIsClient } from "./use-is-client"
import { ViewerBody, ViewerHeader, ViewerRoot, ViewerSurface } from "./viewer"
import { ViewerErrorBoundary } from "./viewer-error"

export type {
  PageOverlayProps,
  PdfPageAreaTarget,
  PdfViewerHandle,
} from "./pdf-viewer-types"
export {
  PdfViewerProvider,
  usePdfViewer,
  usePdfViewerHeader,
  usePdfViewerPages,
  usePdfViewerThumbnails,
  type PdfDocumentSource,
} from "./pdf-viewer-context"
export { PdfViewerThumbnails } from "./pdf-viewer-thumbnails"

export interface PdfHighlightProps extends React.ComponentProps<"div"> {
  /** Normalized box, each field a percentage [0, 100] of the page. */
  area: { left: number; top: number; width: number; height: number }
}

export function PdfHighlight({
  area,
  className,
  style,
  ...props
}: PdfHighlightProps) {
  return (
    <div
      data-slot="pdf-highlight"
      className={cn(
        "pointer-events-none absolute z-10 rounded-[2px] border border-primary/70 bg-primary/12 shadow-[0_4px_16px_rgb(0_0_0_/_8%)]",
        className
      )}
      style={{
        left: `${area.left}%`,
        top: `${area.top}%`,
        width: `${area.width}%`,
        height: `${area.height}%`,
        ...style,
      }}
      {...props}
    />
  )
}

export interface PdfViewerProps {
  /** Canonical PDF source. URL sources preserve PDF.js range-loading behavior. */
  source: PdfDocumentSource
  className?: string
  /** Controlled rendered scale; when omitted the viewer fits page width until manually zoomed. */
  scale?: number
  /** Initial uncontrolled scale. Leave unset for fit-to-width. */
  defaultScale?: number
  /** Called when toolbar controls request a scale change. `null` means fit width. */
  onScaleChange?: (scale: number | null) => void
  toolbar?: boolean
  /** Render absolutely-positioned overlays (e.g. bbox citations) on each page. */
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode
  /** Fired with the 1-based page nearest the top of the viewport as you scroll. */
  onVisiblePageChange?: (page: number) => void
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
}

export type PdfResourceViewerProps = Omit<PdfViewerProps, "source"> & {
  resource: ViewerResource
}

export const PdfViewer = React.forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer(props, ref) {
    const {
      source,
      className,
      bare = false,
      toolbar = true,
      ...pagesProps
    } = props
    return (
      <PdfViewerProvider source={source}>
        <ViewerRoot bare={bare} className={cn("h-full", className)}>
          <PdfViewerHeader toolbar={toolbar} />
          <ViewerBody>
            <ViewerSurface>
              <PdfViewerPages
                {...pagesProps}
                bare
                className="h-full"
                ref={ref}
              />
            </ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      </PdfViewerProvider>
    )
  }
)

export function PdfViewerHeader({
  className,
  leading,
  toolbar = true,
}: {
  className?: string
  leading?: React.ReactNode
  toolbar?: boolean
}) {
  const { currentPage, headerControls, resource } = usePdfViewerHeader()
  const label = resource.fileName || "PDF"

  return (
    <ViewerHeader
      className={cn("flex min-h-10 items-center gap-3 px-2 py-1", className)}
    >
      {leading}
      <div className="min-w-0 truncate px-1 text-sm font-medium">{label}</div>
      {toolbar && headerControls ? (
        <PdfViewerControls {...headerControls} />
      ) : toolbar && currentPage ? (
        <div className="ml-auto px-1 text-xs text-muted-foreground tabular-nums">
          Page {currentPage}
        </div>
      ) : null}
    </ViewerHeader>
  )
}

export const PdfViewerPages = React.forwardRef<
  PdfViewerHandle,
  Omit<PdfViewerProps, "source">
>(function PdfViewerPages(props, ref) {
  const { resource, setCurrentPage, setViewerHandle } = usePdfViewerPages()
  const handleVisiblePageChange = React.useCallback(
    (page: number) => {
      setCurrentPage(page)
      props.onVisiblePageChange?.(page)
    },
    [props.onVisiblePageChange, setCurrentPage]
  )
  const handleRef = React.useCallback(
    (handle: PdfViewerHandle | null) => {
      setViewerHandle(handle)
      if (typeof ref === "function") {
        ref(handle)
        return
      }
      if (ref) ref.current = handle
    },
    [ref, setViewerHandle]
  )

  return (
    <PdfResourceViewer
      {...props}
      ref={handleRef}
      resource={resource}
      toolbar={false}
      onVisiblePageChange={handleVisiblePageChange}
    />
  )
})

export const PdfResourceViewer = React.forwardRef<
  PdfViewerHandle,
  PdfResourceViewerProps
>(function PdfResourceViewer(props, ref) {
  const resource = props.resource
  const isClient = useIsClient()

  if (!isClient) {
    return (
      <PdfViewerFallback
        className={props.className}
        bare={props.bare}
        toolbar={props.toolbar}
      />
    )
  }

  return (
    <ViewerErrorBoundary
      className={props.className}
      download={resource.originalDownload}
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
            toolbar={props.toolbar}
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
  toolbar = true,
  renderPageOverlay,
  onVisiblePageChange,
  onScrollProgressChange,
  bare = false,
  forwardedRef,
}: Omit<PdfViewerProps, "source"> & {
  forwardedRef?: React.ForwardedRef<PdfViewerHandle>
  resource: ViewerResource
}) {
  const setHeaderControls = useOptionalPdfViewerHeaderControls()
  const content = resource.content
  const document = readPdfDocumentResource(content)
  React.useEffect(() => {
    retainPdfDocumentResource(content, document)
    return () => releasePdfDocumentResource(content, document)
  }, [content, document])

  const firstPage = readPdfPageResource(document, 1)
  const firstPageSize = React.useMemo<PdfPageSize>(() => {
    const viewport = firstPage.getViewport({ scale: 1 })
    return { width: viewport.width, height: viewport.height }
  }, [firstPage])

  const { ref: containerRef, width: containerWidth } = useMeasuredElementWidth()
  const [rotationState, setRotationState] = React.useState<{
    document: typeof document
    value: number
  }>(() => ({ document, value: 0 }))
  const rotation = Object.is(rotationState.document, document)
    ? rotationState.value
    : 0
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

  const { pageSizeByNumber, setPageSize } = usePdfPageSizes(document)
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
  const handleRotate = React.useCallback(() => {
    setRotationState((state) => ({
      document,
      value:
        ((Object.is(state.document, document) ? state.value : 0) + 90) % 360,
    }))
  }, [document])
  const headerControls = React.useMemo<PdfViewerHeaderControls>(
    () => ({
      currentPage,
      downloadAction: resource.originalDownload,
      onFitWidth: fitWidth,
      onRotate: handleRotate,
      onZoomIn: zoomIn,
      onZoomOut: zoomOut,
      pageCount: document.numPages,
      scale: resolvedScale,
    }),
    [
      currentPage,
      document.numPages,
      fitWidth,
      handleRotate,
      resource.originalDownload,
      resolvedScale,
      zoomIn,
      zoomOut,
    ]
  )
  React.useEffect(() => {
    if (!setHeaderControls) return
    setHeaderControls(headerControls)
    return () => setHeaderControls(null)
  }, [headerControls, setHeaderControls])
  const { visiblePageNumbers, measureVisiblePages } = usePdfPageVirtualization({
    layout: pageLayout,
    resetKey: document,
    viewportElement,
  })

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
    handleScroll()
    measureVisiblePages()
  }, [handleScroll, measureVisiblePages])

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToPage,
      scrollToPageArea,
      getViewportElement,
    }),
    [getViewportElement, scrollToPage, scrollToPageArea]
  )

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="pdf-viewer"
    >
      {toolbar ? (
        <PdfViewerToolbar
          currentPage={currentPage}
          pageCount={document.numPages}
          scale={resolvedScale}
          downloadAction={resource.originalDownload}
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onFitWidth={fitWidth}
          onRotate={handleRotate}
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
              <div
                ref={containerRef}
                data-slot="pdf-viewer-fit-width-measure"
                className="relative min-w-0"
              >
                <div
                  data-slot="pdf-viewer-document"
                  className="relative mx-auto"
                  style={{
                    height: pageLayout.totalHeight,
                    minWidth: pageLayout.maxPageWidth,
                  }}
                >
                  {visiblePageNumbers.map((pageNumber) => {
                    const page = getPdfPageLayout(pageLayout, pageNumber)
                    if (!page) return null

                    return (
                      <div
                        key={pageNumber}
                        data-slot="pdf-page-slot"
                        data-page-number={pageNumber}
                        className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
                        style={{
                          top: page.offsetTop,
                          width: page.width,
                          minHeight: page.height,
                        }}
                      >
                        <React.Suspense fallback={<PageSkeleton />}>
                          <PdfPage
                            document={document}
                            pageNumber={pageNumber}
                            scale={resolvedScale}
                            rotation={rotation}
                            renderOverlay={renderPageOverlay}
                            onSize={setPageSize}
                          />
                        </React.Suspense>
                      </div>
                    )
                  })}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}
