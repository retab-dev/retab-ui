"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  getPptxFitScale,
  getPptxResetKey,
  type PageOverlayProps,
  type PptxPageOverlayProps,
  type PptxSlideOverlayProps,
} from "./pptx-viewer-core"
import { PptxErrorBoundary } from "./pptx-viewer-error-boundary"
import { PptxViewerFallback } from "./pptx-viewer-fallback"
import { useRetainedPptxSource } from "./pptx-viewer-hooks"
import { createPptxScrollActivity } from "./pptx-viewer-scroll"
import { PptxSlideScroller } from "./pptx-viewer-slide"
import { PptxToolbar } from "./pptx-viewer-toolbar"
import { usePptxViewportWidth } from "./pptx-viewer-viewport"
import { usePptxVisibleSlide } from "./pptx-viewer-visible-slide"
import { usePptxZoom } from "./pptx-viewer-zoom"

export type {
  PageOverlayProps,
  PptxPageOverlayProps,
  PptxSlideOverlayProps,
}

/** Client gate without an effect: false during SSR, true after hydration. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export interface PptxViewerProps {
  /** URL of the .pptx (same-origin or CORS-enabled). */
  src: string
  className?: string
  /** Controlled scale. When omitted, the viewer owns zoom state. */
  scale?: number
  /** Initial uncontrolled scale. When omitted, uncontrolled mode starts fit-width. */
  defaultScale?: number
  /** Called by zoom controls. `null` means return to fit-width mode. */
  onScaleChange?: (scale: number | null) => void
  toolbar?: boolean
  downloadFileName?: string
  /** Render absolutely-positioned overlays, such as bbox citations, on each slide. */
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  /** @deprecated Use `renderSlideOverlay`. */
  renderPageOverlay?: (props: PptxPageOverlayProps) => React.ReactNode
  /** Fired with the 1-based slide nearest the top of the viewport as you scroll. */
  onVisibleSlideChange?: (slide: number) => void
  /** @deprecated Use `onVisibleSlideChange`. */
  onVisiblePageChange?: (page: number) => void
  /** Fired with scroll progress in [0, 1]. */
  onScrollProgressChange?: (progress: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
  /** Rendered as a full-width strip directly below the toolbar. */
  header?: React.ReactNode
  /** Rendered as a left rail alongside the scrolling slides. */
  aside?: React.ReactNode
  /**
   * Render slides as soon as they near the viewport, even mid-scroll. Defaults to
   * false: uncached renders wait until scrolling settles.
   */
  eager?: boolean
}

export function PptxViewer(props: PptxViewerProps) {
  const isClient = useIsClient()
  if (!isClient) {
    return <PptxViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <PptxErrorBoundary
      className={props.className}
      src={props.src}
      bare={props.bare}
      downloadFileName={props.downloadFileName}
      resetKey={getPptxResetKey(props)}
    >
      <React.Suspense
        fallback={
          <PptxViewerFallback className={props.className} bare={props.bare} />
        }
      >
        <PptxViewerContent {...props} />
      </React.Suspense>
    </PptxErrorBoundary>
  )
}

function PptxViewerContent({
  src,
  className,
  scale: controlledScale,
  defaultScale,
  onScaleChange,
  toolbar = true,
  downloadFileName,
  renderSlideOverlay,
  renderPageOverlay,
  onVisibleSlideChange,
  onVisiblePageChange,
  onScrollProgressChange,
  bare = false,
  header,
  aside,
  eager = false,
}: PptxViewerProps) {
  const source = useRetainedPptxSource(src)
  const activeRenderSlideOverlay = renderSlideOverlay ?? renderPageOverlay

  const [rotation, setRotation] = React.useState(0)
  const scrollActivity = React.useMemo(() => createPptxScrollActivity(), [])
  const { containerRef, viewportWidth } = usePptxViewportWidth()
  const { currentSlide, handleScroll, scrollViewportRef } = usePptxVisibleSlide(
    {
      onScrollProgressChange,
      onVisibleSlideChange,
      onVisiblePageChange,
    }
  )

  const fitScale = getPptxFitScale(viewportWidth, source.baseSize.width)
  const { scaleControlsDisabled, setViewerScale, zoomScale } = usePptxZoom({
    controlledScale,
    defaultScale,
    fitScale,
    onScaleChange,
  })

  const handleViewportScroll = React.useCallback(() => {
    if (!eager) scrollActivity.handleScroll()
    handleScroll()
  }, [eager, handleScroll, scrollActivity])

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="pptx-viewer"
    >
      {toolbar ? (
        <PptxToolbar
          currentSlide={currentSlide}
          slideCount={source.slideCount}
          zoomScale={zoomScale}
          scaleControlsDisabled={scaleControlsDisabled}
          src={src}
          downloadFileName={downloadFileName}
          onZoom={(factor) => setViewerScale(zoomScale * factor)}
          onFitWidth={() => setViewerScale(null)}
          onRotate={() => setRotation((value) => (value + 90) % 360)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {aside ? (
          <div data-slot="pptx-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="pptx-viewer-header">{header}</div> : null}
          <PptxSlideScroller
            source={source}
            zoomScale={zoomScale}
            rotation={rotation}
            eager={eager}
            activity={scrollActivity}
            renderSlideOverlay={activeRenderSlideOverlay}
            containerRef={containerRef}
            viewportRef={scrollViewportRef}
            onScroll={handleViewportScroll}
          />
        </div>
      </div>
    </div>
  )
}
