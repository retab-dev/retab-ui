"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"

import { getPptxFitScale, getPptxResetKey } from "./pptx-viewer-core"
import { PptxViewerFallback } from "./pptx-viewer-fallback"
import { useRetainedPptxSource } from "./pptx-viewer-hooks"
import { createPptxScrollActivity } from "./pptx-viewer-scroll"
import {
  PPTX_SLIDE_GAP,
  PPTX_SLIDE_PADDING,
  PptxSlideScroller,
} from "./pptx-viewer-slide"
import {
  evictPptxSource,
  subscribePptxSourceLoadTiming,
} from "./pptx-viewer-source"
import { PptxToolbar } from "./pptx-viewer-toolbar"
import type { PptxViewerProps } from "./pptx-viewer-types"
import { usePptxViewportWidth } from "./pptx-viewer-viewport"
import {
  createPptxSlideLayout,
  usePptxVisibleSlide,
} from "./pptx-viewer-visible-slide"
import { usePptxZoom } from "./pptx-viewer-zoom"
import { useIsClient } from "./use-is-client"
import { ViewerErrorBoundary } from "./viewer-error"

export type { PptxDocumentSource, PptxViewerProps } from "./pptx-viewer-types"
export type {
  PptxSourceLoadTiming,
  PptxSlideRenderTiming,
  PptxSlideOverlayProps,
} from "./pptx-viewer-core"

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
  const onSourceLoadTiming = props.onSourceLoadTiming
  const hasSourceLoadTiming = Boolean(onSourceLoadTiming)
  const onSourceLoadTimingRef = React.useRef(onSourceLoadTiming)

  React.useEffect(() => {
    onSourceLoadTimingRef.current = onSourceLoadTiming
  }, [onSourceLoadTiming])

  React.useEffect(() => {
    if (!hasSourceLoadTiming) return
    return subscribePptxSourceLoadTiming(resource.content, (timing) => {
      onSourceLoadTimingRef.current?.(timing)
    })
  }, [resource.content, hasSourceLoadTiming])

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
  const fitScale = getPptxFitScale(viewportWidth, source.baseSize.width)
  const { scaleControlsDisabled, setViewerScale, zoomScale } = usePptxZoom({
    controlledScale,
    defaultScale,
    fitScale,
    onScaleChange,
  })
  const slideLayout = React.useMemo(
    () =>
      createPptxSlideLayout({
        baseSize: source.baseSize,
        zoomScale,
        rotation,
        slideCount: source.slideCount,
        slideGap: PPTX_SLIDE_GAP,
        slidePadding: PPTX_SLIDE_PADDING,
      }),
    [source.baseSize, source.slideCount, zoomScale, rotation]
  )
  const { currentSlide, handleScroll, scrollViewportRef } = usePptxVisibleSlide(
    {
      layout: slideLayout,
      onScrollProgressChange,
      onVisibleSlideChange,
    }
  )

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
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <PptxSlideScroller
              source={source}
              zoomScale={zoomScale}
              rotation={rotation}
              layout={slideLayout}
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
    </div>
  )
}
