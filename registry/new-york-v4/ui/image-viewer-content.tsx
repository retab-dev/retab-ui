"use client"

import * as React from "react"

import { type FrameSource } from "@/lib/image-frame-source"
import {
  imageFrameSourceManager,
  type FrameSourceLease,
} from "@/lib/image-source-cache"
import { cn } from "@/lib/utils"
import { ImageViewerToolbar } from "@/components/ui/image-viewer-chrome"
import { ImageFrame } from "@/components/ui/image-viewer-frame"
import {
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

export function ImageViewerContent({
  src,
  className,
  scale: controlledScale,
  toolbar = true,
  downloadFileName,
  renderFrameOverlay,
  onVisibleFrameChange,
  onScrollProgressChange,
  bare = false,
  header,
  aside,
  forwardedRef,
}: ImageViewerProps & {
  forwardedRef?: React.ForwardedRef<ImageViewerHandle>
}) {
  const source = React.use(getImageSource(src))
  const sourceLeaseRef = useFrameSourceLease(src, source)
  const { frameListRef, frameListWidth } = useFrameListWidth()
  const {
    isScaleControlled,
    rotateClockwise,
    rotation,
    scale,
    setViewerScale,
  } = useImageViewerScale(source, controlledScale, frameListWidth)
  const { currentFrameNumber, handleScroll, scrollViewportRef } =
    useVisibleFrame(onScrollProgressChange, onVisibleFrameChange)
  useImageViewerHandle(forwardedRef, scrollViewportRef)

  const frameCount = source.frames.length
  const countLabel =
    source.kind === "tiff"
      ? `Page ${Math.min(currentFrameNumber, frameCount)} of ${frameCount}`
      : `${frameCount} image${frameCount === 1 ? "" : "s"}`

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
          src={src}
          downloadFileName={downloadFileName}
          isScaleControlled={isScaleControlled}
          onZoomOut={() => setViewerScale(clamp(scale / 1.2, 0.25, 5))}
          onZoomIn={() => setViewerScale(clamp(scale * 1.2, 0.25, 5))}
          onFitWidth={() => setViewerScale(null)}
          onRotate={rotateClockwise}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {aside ? (
          <div data-slot="image-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="image-viewer-header">{header}</div> : null}
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={scrollViewportRef}
            viewportProps={{ onScroll: handleScroll }}
          >
            <div
              ref={frameListRef}
              className="flex flex-col items-center gap-4 p-4"
            >
              {source.frames.map((_, frameIndex) => (
                <ImageFrame
                  key={frameIndex}
                  source={source}
                  frameIndex={frameIndex}
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
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

export function getImageSource(src: string): Promise<FrameSource> {
  return imageFrameSourceManager.load(src, createTiffWorker)
}

export function clearImageSourceCacheForTests() {
  imageFrameSourceManager.clear()
}

function useFrameSourceLease(
  src: string,
  source: FrameSource
): React.RefCallback<HTMLDivElement> {
  return React.useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return
      const lease = retainImageSource(src, source)
      return () => lease?.release()
    },
    [src, source]
  )
}

function retainImageSource(
  src: string,
  source: FrameSource
): FrameSourceLease | null {
  return imageFrameSourceManager.retain(src, source)
}

function createTiffWorker() {
  return new Worker(new URL("./image-viewer.worker", import.meta.url), {
    type: "module",
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
