"use client"

import * as React from "react"

import { type FrameSource } from "@/lib/image-frame-source"
import {
  imageFrameSourceManager,
  type FrameSourceLease,
  type ImageSourceContent,
} from "@/lib/image-source-cache"
import { cn } from "@/lib/utils"
import {
  type ViewerContentIdentity,
  type ViewerResource,
} from "@/lib/viewer-resource"
import { ImageViewerToolbar } from "@/components/ui/image-viewer-chrome"
import { ImageFrame } from "@/components/ui/image-viewer-frame"
import {
  MAX_VIEWER_SCALE,
  MIN_VIEWER_SCALE,
  useFrameListWidth,
  useImageViewerHandle,
  useImageViewerScale,
  useVisibleFrame,
} from "@/components/ui/image-viewer-hooks"
import {
  type ImageViewerHandle,
  type ImageViewerProps,
} from "@/components/ui/image-viewer-types"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  createImageFrameLayout,
  getImageFrameLayout,
  useImageFrameVirtualization,
} from "./image-viewer-virtualization"

export function ImageViewerContent({
  resource,
  className,
  scale: controlledScale,
  defaultScale,
  onScaleChange,
  toolbar = true,
  renderFrameOverlay,
  onVisibleFrameChange,
  onScrollProgressChange,
  bare = false,
  slots,
  forwardedRef,
}: Omit<ImageViewerProps, "source"> & {
  forwardedRef?: React.ForwardedRef<ImageViewerHandle>
  resource: ViewerResource
}) {
  const topSlot = slots?.top
  const bottomSlot = slots?.bottom
  const leftRailSlot = slots?.left
  const rightRailSlot = slots?.right
  const overlaySlot = slots?.overlay
  const frameSource = React.use(getImageSource(resource.content))
  const sourceLeaseRef = useFrameSourceLease(resource.content, frameSource)
  const { frameListRef, frameListWidth } = useFrameListWidth()
  const {
    rotateClockwise,
    rotation,
    scale,
    scaleControlsDisabled,
    setViewerScale,
  } = useImageViewerScale(
    frameSource,
    controlledScale,
    defaultScale,
    onScaleChange,
    frameListWidth
  )
  const frameLayout = React.useMemo(
    () =>
      createImageFrameLayout({
        frames: frameSource.frames,
        scale,
        rotation,
      }),
    [frameSource.frames, rotation, scale]
  )
  const {
    currentFrameNumber,
    handleScroll,
    scrollViewportElement,
    scrollViewportRef,
    setScrollViewportRef,
  } = useVisibleFrame(
    frameLayout,
    frameSource,
    onScrollProgressChange,
    onVisibleFrameChange
  )
  const { visibleFrameNumbers, measureVisibleFrames } =
    useImageFrameVirtualization({
      layout: frameLayout,
      resetKey: frameSource,
      viewportElement: scrollViewportElement,
    })
  useImageViewerHandle(forwardedRef, scrollViewportRef, frameLayout)

  const frameCount = frameSource.frames.length
  const countLabel =
    frameSource.kind === "tiff"
      ? `Page ${Math.min(currentFrameNumber, frameCount)} of ${frameCount}`
      : `${frameCount} image${frameCount === 1 ? "" : "s"}`
  const handleViewportScroll = React.useCallback(() => {
    handleScroll()
    measureVisibleFrames()
  }, [handleScroll, measureVisibleFrames])

  return (
    <div
      ref={sourceLeaseRef}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="image-viewer"
    >
      {toolbar ? (
        <ImageViewerToolbar
          countLabel={countLabel}
          scale={scale}
          downloadAction={resource.originalDownload}
          scaleControlsDisabled={scaleControlsDisabled}
          onZoomOut={() =>
            setViewerScale(
              clamp(scale / 1.2, MIN_VIEWER_SCALE, MAX_VIEWER_SCALE)
            )
          }
          onZoomIn={() =>
            setViewerScale(
              clamp(scale * 1.2, MIN_VIEWER_SCALE, MAX_VIEWER_SCALE)
            )
          }
          onFitWidth={() => setViewerScale(null)}
          onRotate={rotateClockwise}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {leftRailSlot ? (
          <div data-slot="image-viewer-left" className="flex-shrink-0">
            {leftRailSlot}
          </div>
        ) : null}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {topSlot ? <div data-slot="image-viewer-top">{topSlot}</div> : null}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <ScrollArea
              className="min-h-0 flex-1"
              viewportRef={setScrollViewportRef}
              viewportProps={{ onScroll: handleViewportScroll }}
            >
              <div
                ref={frameListRef}
                className="relative min-h-full w-full"
                style={{ height: frameLayout.totalHeight }}
              >
                <div
                  className="relative mx-auto h-full w-full"
                  style={{
                    minWidth:
                      frameLayout.maxFrameWidth + frameLayout.padding * 2,
                  }}
                >
                  {visibleFrameNumbers.map((frameNumber) => {
                    const frame = getImageFrameLayout(frameLayout, frameNumber)
                    if (!frame) return null

                    return (
                      <div
                        key={frameNumber}
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{
                          top: frame.offsetTop,
                          width: frame.width,
                          height: frame.height,
                        }}
                      >
                        <ImageFrame
                          source={frameSource}
                          frameIndex={frame.frameIndex}
                          scale={scale}
                          rotation={rotation}
                          renderOverlay={
                            renderFrameOverlay
                              ? ({ frameNumber, frameRect, scale, rotation }) =>
                                  renderFrameOverlay({
                                    frameNumber,
                                    width: frameRect.width,
                                    height: frameRect.height,
                                    scale,
                                    rotation,
                                  })
                              : undefined
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </ScrollArea>
            {overlaySlot ? (
              <div
                data-slot="image-viewer-overlay"
                className="pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto"
              >
                {overlaySlot}
              </div>
            ) : null}
          </div>
          {bottomSlot ? (
            <div data-slot="image-viewer-bottom">{bottomSlot}</div>
          ) : null}
        </div>
        {rightRailSlot ? (
          <div data-slot="image-viewer-right" className="flex-shrink-0">
            {rightRailSlot}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function getImageSource(
  content: ImageSourceContent
): Promise<FrameSource> {
  return imageFrameSourceManager.load(content, createTiffWorker)
}

export function resetImageSourceCacheForTests() {
  imageFrameSourceManager.clear()
}

function useFrameSourceLease(
  content: ViewerContentIdentity,
  source: FrameSource
): React.RefCallback<HTMLDivElement> {
  return React.useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return
      const lease = retainImageSource(content, source)
      return () => lease?.release()
    },
    [content, source]
  )
}

function retainImageSource(
  content: ViewerContentIdentity,
  source: FrameSource
): FrameSourceLease | null {
  return imageFrameSourceManager.retain(content, source)
}

function createTiffWorker() {
  return new Worker(new URL("./image-viewer.worker", import.meta.url), {
    type: "module",
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
