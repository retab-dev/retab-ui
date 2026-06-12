"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source"

import {
  getPptxFitScale,
  getPptxResetKey,
  type PptxSlideOverlayProps,
} from "./pptx-viewer-core"
import { PptxViewerFallback } from "./pptx-viewer-fallback"
import { useRetainedPptxSource } from "./pptx-viewer-hooks"
import { createPptxScrollActivity } from "./pptx-viewer-scroll"
import { PptxSlideScroller } from "./pptx-viewer-slide"
import { PptxToolbar } from "./pptx-viewer-toolbar"
import { usePptxViewportWidth } from "./pptx-viewer-viewport"
import { usePptxVisibleSlide } from "./pptx-viewer-visible-slide"
import { usePptxZoom } from "./pptx-viewer-zoom"
import { ViewerErrorBoundary } from "./viewer-error"

export type { PptxSlideOverlayProps }
export type PptxDocumentSource = UrlViewerSource | BlobViewerSource

/** Client gate without an effect: false during SSR, true after hydration. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export interface PptxViewerProps {
  /** Canonical presentation source. */
  source: PptxDocumentSource
  className?: string
  /** Controlled scale. When omitted, the viewer owns zoom state. */
  scale?: number
  /** Initial uncontrolled scale. When omitted, uncontrolled mode starts fit-width. */
  defaultScale?: number
  /** Called by zoom controls. `null` means return to fit-width mode. */
  onScaleChange?: (scale: number | null) => void
  toolbar?: boolean
  /** Render absolutely-positioned overlays, such as bbox citations, on each slide. */
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  /** Fired with the 1-based slide nearest the top of the viewport as you scroll. */
  onVisibleSlideChange?: (slide: number) => void
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
  const { source } = props
  const resource = React.useMemo(() => createViewerResource(source), [source])
  if (!isClient) {
    return <PptxViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <ViewerErrorBoundary
      className={props.className}
      bare={props.bare}
      download={resource.getOriginalDownload()}
      format="pptx"
      resetKey={getPptxResetKey({
        resourceKey: resource.keys.resource,
        scale: props.scale,
        defaultScale: props.defaultScale,
        eager: props.eager,
      })}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <PptxViewerFallback className={props.className} bare={props.bare} />
        }
      >
        <PptxViewerContent {...props} resource={resource} />
      </React.Suspense>
    </ViewerErrorBoundary>
  )
}

function PptxViewerContent({
  resource,
  className,
  scale: controlledScale,
  defaultScale,
  onScaleChange,
  toolbar = true,
  renderSlideOverlay,
  onVisibleSlideChange,
  onScrollProgressChange,
  bare = false,
  header,
  aside,
  eager = false,
}: PptxViewerProps & { resource: ViewerResource }) {
  const source = useRetainedPptxSource(resource)
  const downloadAction = React.useMemo(
    () => resource.getOriginalDownload(),
    [resource]
  )

  const [rotation, setRotation] = React.useState(0)
  const scrollActivity = React.useMemo(() => createPptxScrollActivity(), [])
  const { containerRef, viewportWidth } = usePptxViewportWidth()
  const { currentSlide, handleScroll, scrollViewportRef } = usePptxVisibleSlide(
    {
      onScrollProgressChange,
      onVisibleSlideChange,
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
          downloadAction={downloadAction}
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
            renderSlideOverlay={renderSlideOverlay}
            containerRef={containerRef}
            viewportRef={scrollViewportRef}
            onScroll={handleViewportScroll}
          />
        </div>
      </div>
    </div>
  )
}
