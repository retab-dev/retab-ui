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
  type PptxSlideRenderTiming,
  type PptxSourceLoadTiming,
} from "./pptx-viewer-core"
import { PptxViewerFallback } from "./pptx-viewer-fallback"
import { useRetainedPptxSource } from "./pptx-viewer-hooks"
import { createPptxScrollActivity } from "./pptx-viewer-scroll"
import { PptxSlideScroller } from "./pptx-viewer-slide"
import {
  evictPptxSource,
  subscribePptxSourceLoadTiming,
} from "./pptx-viewer-source"
import { PptxToolbar } from "./pptx-viewer-toolbar"
import { usePptxViewportWidth } from "./pptx-viewer-viewport"
import { usePptxVisibleSlide } from "./pptx-viewer-visible-slide"
import { usePptxZoom } from "./pptx-viewer-zoom"
import { ViewerErrorBoundary } from "./viewer-error"

export type {
  PptxSourceLoadTiming,
  PptxSlideRenderTiming,
  PptxSlideOverlayProps,
}
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
  /** Intrinsic slide size used to reserve the first slide while metadata loads. */
  fallbackSlideSize?: { width: number; height: number }
  /** Called by zoom controls. `null` means return to fit-width mode. */
  onScaleChange?: (scale: number | null) => void
  toolbar?: boolean
  /** Render absolutely-positioned overlays, such as bbox citations, on each slide. */
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  /** Reports measured canvas render work for benchmark and profiling surfaces. */
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void
  /** Reports measured presentation fetch/parse/load work for benchmark surfaces. */
  onSourceLoadTiming?: (timing: PptxSourceLoadTiming) => void
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
  /** Render slides as soon as they near the viewport, even mid-scroll. */
  eager?: boolean
}

export type PptxResourceViewerProps = Omit<PptxViewerProps, "source"> & {
  resource: ViewerResource
}

export function PptxViewer(props: PptxViewerProps) {
  const { source, ...resourceProps } = props
  const resource = React.useMemo(() => createViewerResource(source), [source])
  return <PptxResourceViewer {...resourceProps} resource={resource} />
}

export function PptxResourceViewer(props: PptxResourceViewerProps) {
  const isClient = useIsClient()
  const resource = props.resource
  const onSourceLoadTimingRef = React.useRef(props.onSourceLoadTiming)
  onSourceLoadTimingRef.current = props.onSourceLoadTiming

  React.useEffect(() => {
    if (!props.onSourceLoadTiming) return
    return subscribePptxSourceLoadTiming(resource.content, (timing) => {
      onSourceLoadTimingRef.current?.(timing)
    })
  }, [resource.content, Boolean(props.onSourceLoadTiming)])

  if (!isClient) {
    return (
      <PptxViewerFallback
        className={props.className}
        bare={props.bare}
        fallbackSlideSize={props.fallbackSlideSize}
        toolbar={props.toolbar}
      />
    )
  }
  return (
    <ViewerErrorBoundary
      className={props.className}
      bare={props.bare}
      download={resource.originalDownload}
      format="pptx"
      resetKey={getPptxResetKey({
        resourceKey: resource.keys.resource,
        scale: props.scale,
        defaultScale: props.defaultScale,
        eager: props.eager ?? true,
      })}
      sourceKind={resource.sourceKind}
      onRetry={() => evictPptxSource(resource.content)}
    >
      <React.Suspense
        fallback={
          <PptxViewerFallback
            className={props.className}
            bare={props.bare}
            fallbackSlideSize={props.fallbackSlideSize}
            toolbar={props.toolbar}
          />
        }
      >
        <PptxViewerContent
          key={resource.keys.load}
          {...props}
          resource={resource}
        />
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
  onSlideRenderTiming,
  onVisibleSlideChange,
  onScrollProgressChange,
  bare = false,
  header,
  aside,
  eager = true,
}: Omit<PptxViewerProps, "source"> & { resource: ViewerResource }) {
  const source = useRetainedPptxSource(resource.content)
  const downloadAction = React.useMemo(
    () => resource.originalDownload,
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
            onSlideRenderTiming={onSlideRenderTiming}
            containerRef={containerRef}
            viewportRef={scrollViewportRef}
            onScroll={handleViewportScroll}
          />
        </div>
      </div>
    </div>
  )
}
