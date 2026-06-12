"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import { PdfPage } from "./pdf-viewer-page"
import { usePdfPageSizes } from "./pdf-viewer-page-sizes"
import { PdfViewerRail } from "./pdf-viewer-rail"
import {
  getDocumentResource,
  getPageResource,
  releaseDocumentResource,
  retainDocumentResource,
} from "./pdf-viewer-resource"
import { useMeasuredElementWidth, usePdfScale } from "./pdf-viewer-scale"
import { usePdfScroll } from "./pdf-viewer-scroll"
import {
  PageSkeleton,
  PdfErrorBoundary,
  PdfViewerFallback,
} from "./pdf-viewer-states"
import { PdfViewerToolbar } from "./pdf-viewer-toolbar"
import type {
  PageOverlayProps,
  PdfPageSize,
  PdfViewerHandle,
  PdfViewerSlots,
} from "./pdf-viewer-types"
import { usePdfPageVirtualization } from "./pdf-viewer-virtualization"

export { getDocumentResource, getPageResource } from "./pdf-viewer-resource"
export type {
  PageOverlayProps,
  PdfPageScrollTarget,
  PdfViewerHandle,
  PdfViewerSlots,
} from "./pdf-viewer-types"

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
  /** URL of the PDF (same-origin or CORS-enabled). */
  src: string
  className?: string
  /** Controlled rendered scale; when omitted the viewer fits page width until manually zoomed. */
  scale?: number
  /** Initial uncontrolled scale. Leave unset for fit-to-width. */
  defaultScale?: number
  /** Called when toolbar controls request a scale change. `null` means fit width. */
  onScaleChange?: (scale: number | null) => void
  toolbar?: boolean
  downloadFileName?: string
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

export const PdfViewer = React.forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer(props, ref) {
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
      <PdfErrorBoundary className={props.className} resetKey={props.src}>
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
          <PdfViewerInner {...props} forwardedRef={ref} />
        </React.Suspense>
      </PdfErrorBoundary>
    )
  }
)

function PdfViewerInner({
  src,
  className,
  scale: controlledScale,
  defaultScale,
  onScaleChange,
  toolbar = true,
  downloadFileName,
  renderPageOverlay,
  onVisiblePageChange,
  onScrollProgressChange,
  bare = false,
  slots,
  railToggle,
  defaultRailsOpen,
  forwardedRef,
}: PdfViewerProps & {
  forwardedRef?: React.ForwardedRef<PdfViewerHandle>
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

  const document = React.use(getDocumentResource(src))
  React.useEffect(() => {
    retainDocumentResource(src, document)
    return () => releaseDocumentResource(src, document)
  }, [src, document])

  const firstPage = React.use(getPageResource(document, 1))
  const firstPageSize = React.useMemo<PdfPageSize>(() => {
    const viewport = firstPage.getViewport({ scale: 1 })
    return { width: viewport.width, height: viewport.height }
  }, [firstPage])

  const { ref: containerRef, width: containerWidth } = useMeasuredElementWidth()
  const { resolvedScale, zoomIn, zoomOut, fitWidth } = usePdfScale({
    controlledScale,
    defaultScale,
    onScaleChange,
    containerWidth,
    pageWidth: firstPageSize.width,
  })

  const [rotation, setRotation] = React.useState(0)
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
    onVisiblePageChange,
    onScrollProgressChange,
  })
  const { visiblePages, registerPageSlot } = usePdfPageVirtualization({
    pageCount: document.numPages,
    viewportElement,
  })

  const { pageSizeByNumber, setPageSize } = usePdfPageSizes(document)

  const isRotated = rotation % 180 !== 0

  React.useEffect(() => {
    measureScroll()
  }, [
    document.numPages,
    measureScroll,
    rotation,
    resolvedScale,
    viewportElement,
  ])

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
          src={src}
          downloadFileName={downloadFileName}
          showRailToggle={showRailToggle}
          railsOpen={railsOpen}
          onToggleRails={() => setRailsOpen((open) => !open)}
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onFitWidth={fitWidth}
          onRotate={() => setRotation((value) => (value + 90) % 360)}
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
              viewportProps={{ onScroll: handleScroll }}
            >
              <div
                ref={containerRef}
                className="flex flex-col items-center gap-4 p-4"
              >
                {Array.from({ length: document.numPages }, (_, index) => {
                  const pageNumber = index + 1
                  const pageSize = pageSizeByNumber.get(pageNumber) ?? {
                    width: firstPageSize.width,
                    height: firstPageSize.height,
                  }
                  const estimatedWidth = Math.round(
                    (isRotated ? pageSize.height : pageSize.width) *
                      resolvedScale
                  )
                  const estimatedHeight = Math.round(
                    (isRotated ? pageSize.width : pageSize.height) *
                      resolvedScale
                  )

                  return (
                    <div
                      key={pageNumber}
                      ref={registerPageSlot}
                      data-slot="pdf-page-slot"
                      data-page-number={pageNumber}
                      className="flex items-center justify-center"
                      style={{
                        width: estimatedWidth,
                        minHeight: estimatedHeight,
                      }}
                    >
                      {visiblePages.has(pageNumber) ? (
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
                      ) : null}
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
