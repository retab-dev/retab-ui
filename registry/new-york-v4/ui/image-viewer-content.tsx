"use client"

import * as React from "react"

import { type FrameSource } from "@/lib/image-frame-source"
import { normalizeRotation } from "@/lib/image-geometry"
import {
  imageFrameSourceManager,
  type FrameSourceLease,
} from "@/lib/image-source-cache"
import { cn } from "@/lib/utils"
import { ImageViewerToolbar } from "@/components/ui/image-viewer-chrome"
import { ImageFrame } from "@/components/ui/image-viewer-frame"
import {
  type ImageViewerHandle,
  type ImageViewerProps,
} from "@/components/ui/image-viewer-types"
import { ScrollArea } from "@/components/ui/scroll-area"

const IMAGE_SCROLL_HEADROOM = 48

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
  const firstFrameWidth = source.frames[0]?.intrinsicSize.width || 1
  const isScaleControlled = controlledScale !== undefined
  const [uncontrolledScale, setUncontrolledScale] = React.useState<
    number | null
  >(null)
  const [rotation, setRotation] = React.useState(0)
  const [frameListWidth, setFrameListWidth] = React.useState<number | null>(
    null
  )
  const [currentFrameNumber, setCurrentFrameNumber] = React.useState(1)
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReportedFrameNumber = React.useRef(0)

  const containerRef = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    setFrameListWidth(element.clientWidth)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFrameListWidth((entry.target as HTMLElement).clientWidth)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fitWidthScale = frameListWidth
    ? (frameListWidth - 32) / firstFrameWidth
    : 1
  const scale =
    controlledScale ?? uncontrolledScale ?? Math.max(0.25, fitWidthScale)
  const rotationQuarterTurn = normalizeRotation(rotation)
  const frameCount = source.frames.length
  const countLabel =
    source.kind === "tiff"
      ? `Page ${Math.min(currentFrameNumber, frameCount)} of ${frameCount}`
      : `${frameCount} image${frameCount === 1 ? "" : "s"}`

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToFrameArea: (frameNumber, area, options) => {
        const viewport = scrollViewportRef.current
        const frame = viewport?.querySelector<HTMLElement>(
          `[data-frame-number="${frameNumber}"]`
        )
        if (!viewport || !frame) return
        const frameRect = frame.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        const frameTop = frameRect.top - viewportRect.top + viewport.scrollTop
        const targetTop =
          frameTop + (area.top / 100) * frameRect.height - IMAGE_SCROLL_HEADROOM
        viewport.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
          ...options,
        })
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    []
  )

  const sourceLeaseRef = useFrameSourceLease(src, source)

  const handleScroll = React.useCallback(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? viewport.scrollTop / scrollable : 0
    )

    const viewportRect = viewport.getBoundingClientRect()
    const marker = viewportRect.top + viewportRect.height * 0.2
    const frames = viewport.querySelectorAll<HTMLElement>("[data-frame-number]")
    let frameNumber = 1
    for (const frame of frames) {
      if (frame.getBoundingClientRect().top <= marker) {
        frameNumber = Number(frame.dataset.frameNumber)
      } else {
        break
      }
    }
    if (frameNumber && frameNumber !== lastReportedFrameNumber.current) {
      lastReportedFrameNumber.current = frameNumber
      setCurrentFrameNumber(frameNumber)
      onVisibleFrameChange?.(frameNumber)
    }
  }, [onScrollProgressChange, onVisibleFrameChange])

  const setViewerScale = React.useCallback(
    (nextScale: number | null) => {
      if (isScaleControlled) return
      setUncontrolledScale(nextScale)
    },
    [isScaleControlled]
  )

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
          onRotate={() => setRotation((value) => (value + 90) % 360)}
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
              ref={containerRef}
              className="flex flex-col items-center gap-4 p-4"
            >
              {source.frames.map((_, frameIndex) => (
                <ImageFrame
                  key={frameIndex}
                  source={source}
                  frameIndex={frameIndex}
                  scale={scale}
                  rotation={rotationQuarterTurn}
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
