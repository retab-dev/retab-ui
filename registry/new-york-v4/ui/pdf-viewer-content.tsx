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
  createPdfPageLayout,
  getPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout"
import { PdfPage } from "./pdf-viewer-page"
import { usePdfPageSizes } from "./pdf-viewer-page-sizes"
import { useMeasuredElementWidth, usePdfScale } from "./pdf-viewer-scale"
import { usePdfScroll } from "./pdf-viewer-scroll"
import { PageSkeleton, PdfViewerFallback } from "./pdf-viewer-states"
import type {
  PageOverlayProps,
  PdfDocumentViewportControls,
  PdfPageSize,
  PdfViewerHandle,
} from "./pdf-viewer-types"
import { usePdfDocumentViewportRegistration } from "./pdf-viewer-viewport"
import { usePdfPageVirtualization } from "./pdf-viewer-virtualization"
import { useIsClient } from "./use-is-client"
import { ViewerErrorBoundary } from "./viewer-error"
import { ViewerToolbar } from "./viewer-toolbar"

export type PdfViewerContentProps = {
  className?: string
  /** Controlled rendered scale; when omitted the viewer fits page width until manually zoomed. */
  scale?: number
  /** Initial uncontrolled scale. Leave unset for fit-to-width. */
  defaultScale?: number
  /** Called when toolbar controls request a scale change. `null` means fit width. */
  onScaleChange?: (scale: number | null) => void
  toolbar?: boolean
  /** Show download actions in this viewer's toolbar/error state. */
  download?: boolean
  /** Render absolutely-positioned overlays (e.g. bbox citations) on each page. */
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode
  /** Fired with the 1-based page nearest the top of the viewport as you scroll. */
  onVisiblePageChange?: (page: number) => void
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void
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
        toolbar={props.toolbar}
      />
    )
  }

  return (
    <ViewerErrorBoundary
      className={props.className}
      download={props.download === false ? null : resource.originalDownload}
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
  download = true,
  renderPageOverlay,
  onVisiblePageChange,
  onScrollProgressChange,
  bare = false,
  forwardedRef,
}: PdfResourceContentProps & {
  forwardedRef?: React.ForwardedRef<PdfViewerHandle>
}) {
  const content = resource.content
  const document = readPdfDocumentResource(content)
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
  usePdfDocumentViewportControls({
    currentPage,
    document,
    downloadAction: resource.originalDownload,
    fitWidth,
    resolvedScale,
    rotateClockwise,
    zoomIn,
    zoomOut,
  })
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
        <ViewerToolbar
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
                pageNumbers={visiblePageNumbers}
                renderPageOverlay={renderPageOverlay}
                rotation={rotation}
                scale={resolvedScale}
                setPageSize={setPageSize}
              />
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
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

function usePdfDocumentViewportControls({
  currentPage,
  document,
  downloadAction,
  fitWidth,
  resolvedScale,
  rotateClockwise,
  zoomIn,
  zoomOut,
}: {
  currentPage: number
  document: PdfDocument
  downloadAction: ViewerResource["originalDownload"]
  fitWidth: () => void
  resolvedScale: number
  rotateClockwise: () => void
  zoomIn: () => void
  zoomOut: () => void
}) {
  const onViewportControlsChange = usePdfDocumentViewportRegistration()
  const viewportControls = React.useMemo<PdfDocumentViewportControls>(
    () => ({
      currentPage,
      downloadAction,
      onFitWidth: fitWidth,
      onRotate: rotateClockwise,
      onZoomIn: zoomIn,
      onZoomOut: zoomOut,
      pageCount: document.numPages,
      scale: resolvedScale,
    }),
    [
      currentPage,
      document.numPages,
      downloadAction,
      fitWidth,
      resolvedScale,
      rotateClockwise,
      zoomIn,
      zoomOut,
    ]
  )

  React.useEffect(() => {
    if (!onViewportControlsChange) return
    onViewportControlsChange(viewportControls)
    return () => onViewportControlsChange(null)
  }, [onViewportControlsChange, viewportControls])

  return viewportControls
}

function PdfDocumentPagesLayer({
  containerRef,
  document,
  layout,
  pageNumbers,
  renderPageOverlay,
  rotation,
  scale,
  setPageSize,
}: {
  containerRef: React.RefCallback<HTMLDivElement>
  document: PdfDocument
  layout: PdfPageLayoutModel
  pageNumbers: readonly number[]
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode
  rotation: number
  scale: number
  setPageSize: PdfPageSizeSetter
}) {
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
      >
        {pageNumbers.map((pageNumber) => {
          const page = getPdfPageLayout(layout, pageNumber)
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
                  scale={scale}
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
  )
}
