"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source"
import { ScrollArea } from "@/components/ui/scroll-area"

import { createPdfPageLayout, getPdfPageLayout } from "./pdf-viewer-layout"
import { PdfPage } from "./pdf-viewer-page"
import { usePdfPageSizes } from "./pdf-viewer-page-sizes"
import { PdfViewerRail } from "./pdf-viewer-rail"
import {
  clearDocumentResource,
  readDocumentResource,
  readPageResource,
  releaseDocumentResource,
  retainDocumentResource,
} from "./pdf-viewer-resource"
import { useMeasuredElementWidth, usePdfScale } from "./pdf-viewer-scale"
import { usePdfScroll } from "./pdf-viewer-scroll"
import { PageSkeleton, PdfViewerFallback } from "./pdf-viewer-states"
import { PdfViewerToolbar } from "./pdf-viewer-toolbar"
import type {
  PageOverlayProps,
  PdfPageSize,
  PdfViewerHandle,
  PdfViewerSlots,
} from "./pdf-viewer-types"
import { usePdfPageVirtualization } from "./pdf-viewer-virtualization"
import { ViewerErrorBoundary } from "./viewer-error"

export { getDocumentResource, getPageResource } from "./pdf-viewer-resource"
export type {
  PageOverlayProps,
  PdfPageScrollTarget,
  PdfViewerHandle,
  PdfViewerSlots,
} from "./pdf-viewer-types"

export type PdfDocumentSource = UrlViewerSource | BlobViewerSource

function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

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
  /**
   * Chrome mounted around the document. `top`/`bottom` are document-column
   * strips, `left`/`right` are rails, and `overlay` floats over the scroller.
   */
  slots?: PdfViewerSlots
  /** Show the toolbar button that collapses/expands rails. */
  railToggle?: boolean
  /** Initial open state of the rails. */
  defaultRailsOpen?: boolean
}

export type PdfResourceViewerProps = Omit<PdfViewerProps, "source"> & {
  resource: ViewerResource
}

export const PdfViewer = React.forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer(props, ref) {
    const { source, ...resourceProps } = props
    const resource = React.useMemo(() => createViewerResource(source), [source])
    return (
      <PdfResourceViewer {...resourceProps} ref={ref} resource={resource} />
    )
  }
)

export const PdfResourceViewer = React.forwardRef<
  PdfViewerHandle,
  PdfResourceViewerProps
>(function PdfResourceViewer(props, ref) {
  const resource = props.resource
  const isClient = useIsClient()
  const hasRail = Boolean(props.slots?.left ?? props.slots?.right)
  const showRailToggle = Boolean(hasRail && (props.railToggle ?? true))

  if (!isClient) {
    return (
      <PdfViewerFallback
        className={props.className}
        bare={props.bare}
        toolbar={props.toolbar}
        showRailToggle={showRailToggle}
      />
    )
  }

  return (
    <ViewerErrorBoundary
      className={props.className}
      download={resource.originalDownload}
      format="pdf"
      onRetry={() => clearDocumentResource(resource.content)}
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <PdfViewerFallback
            className={props.className}
            bare={props.bare}
            toolbar={props.toolbar}
            showRailToggle={showRailToggle}
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
  slots,
  railToggle,
  defaultRailsOpen,
  forwardedRef,
}: Omit<PdfViewerProps, "source"> & {
  forwardedRef?: React.ForwardedRef<PdfViewerHandle>
  resource: ViewerResource
}) {
  const topSlot = slots?.top
  const bottomSlot = slots?.bottom
  const leftRailSlot = slots?.left
  const rightRailSlot = slots?.right
  const overlaySlot = slots?.overlay
  const showRailToggle = Boolean(
    (leftRailSlot || rightRailSlot) && (railToggle ?? true)
  )
  const [railsOpen, setRailsOpen] = React.useState(defaultRailsOpen ?? true)

  const content = resource.content
  const document = readDocumentResource(content)
  React.useEffect(() => {
    retainDocumentResource(content, document)
    return () => releaseDocumentResource(content, document)
  }, [content, document])

  const firstPage = readPageResource(document, 1)
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
    scrollToPageTarget,
    getViewportElement,
  } = usePdfScroll({
    pageCount: document.numPages,
    layout: pageLayout,
    resetKey: document,
    onVisiblePageChange,
    onScrollProgressChange,
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
    forwardedRef,
    () => ({
      scrollToPageTarget,
      getViewportElement,
    }),
    [getViewportElement, scrollToPageTarget]
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
          showRailToggle={showRailToggle}
          railsOpen={railsOpen}
          onToggleRails={() => setRailsOpen((open) => !open)}
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onFitWidth={fitWidth}
          onRotate={() =>
            setRotationState((state) => ({
              document,
              value:
                ((Object.is(state.document, document) ? state.value : 0) + 90) %
                360,
            }))
          }
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {leftRailSlot ? (
          <PdfViewerRail side="left" open={railsOpen} animate={showRailToggle}>
            {leftRailSlot}
          </PdfViewerRail>
        ) : null}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {topSlot ? <div data-slot="pdf-viewer-top">{topSlot}</div> : null}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <ScrollArea
              className="min-h-0 flex-1"
              viewportRef={setViewportElement}
              viewportProps={{ onScroll: handleViewportScroll }}
            >
              <div
                ref={containerRef}
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
            </ScrollArea>
            {overlaySlot ? (
              <div
                data-slot="pdf-viewer-overlay"
                className="pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto"
              >
                {overlaySlot}
              </div>
            ) : null}
          </div>
          {bottomSlot ? (
            <div data-slot="pdf-viewer-bottom">{bottomSlot}</div>
          ) : null}
        </div>
        {rightRailSlot ? (
          <PdfViewerRail side="right" open={railsOpen} animate={showRailToggle}>
            {rightRailSlot}
          </PdfViewerRail>
        ) : null}
      </div>
    </div>
  )
}
