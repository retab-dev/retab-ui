"use client"

import * as React from "react"

import {
  ImageSourceDisposedError,
  toImageFormatError,
  type FrameSource,
} from "@/lib/image-frame-source"
import {
  frameCssSize,
  frameIndexToNumber,
  type FrameOverlayProps,
  type QuarterTurn,
} from "@/lib/image-geometry"
import { isResourceError } from "@/lib/viewer-errors"

export interface ImageFrameProps {
  source: FrameSource
  frameIndex: number
  scale: number
  rotation: QuarterTurn
  renderOverlay?: (props: FrameOverlayProps) => React.ReactNode
}

export function ImageFrame({
  source,
  frameIndex,
  scale,
  rotation,
  renderOverlay,
}: ImageFrameProps) {
  const descriptor = source.frames[frameIndex]
  const frameRect = frameCssSize(descriptor.intrinsicSize, scale, rotation)
  const frameNumber = frameIndexToNumber(frameIndex)

  return (
    <div
      className="relative shadow-sm ring-1 ring-border"
      style={{ width: frameRect.width, height: frameRect.height }}
      data-slot="image-frame"
      data-frame={frameNumber}
      data-frame-number={frameNumber}
    >
      <ImageFrameCanvas
        source={source}
        frameIndex={frameIndex}
        scale={scale}
        rotation={rotation}
      />
      {renderOverlay ? (
        <div className="pointer-events-none absolute inset-0">
          {renderOverlay({
            frameNumber,
            frameRect,
            scale,
            rotation,
          })}
        </div>
      ) : null}
    </div>
  )
}

function ImageFrameCanvas({
  source,
  frameIndex,
  scale,
  rotation,
}: {
  source: FrameSource
  frameIndex: number
  scale: number
  rotation: QuarterTurn
}) {
  const descriptor = source.frames[frameIndex]
  const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1
  const frameRect = frameCssSize(descriptor.intrinsicSize, scale, rotation)
  const [drawError, setDrawError] = React.useState<Error | null>(null)

  if (drawError) throw drawError

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      canvas.width = Math.max(1, Math.floor(frameRect.width * dpr))
      canvas.height = Math.max(1, Math.floor(frameRect.height * dpr))

      let cancelled = false
      source
        .acquire(frameIndex)
        .then((bitmap) => {
          if (cancelled) return
          ctx.save()
          try {
            ctx.scale(dpr, dpr)
            ctx.translate(frameRect.width / 2, frameRect.height / 2)
            ctx.rotate((rotation * Math.PI) / 180)
            const drawWidth = descriptor.intrinsicSize.width * scale
            const drawHeight = descriptor.intrinsicSize.height * scale
            ctx.imageSmoothingQuality = "high"
            ctx.drawImage(
              bitmap,
              -drawWidth / 2,
              -drawHeight / 2,
              drawWidth,
              drawHeight
            )
          } finally {
            ctx.restore()
          }
        })
        .catch((error) => {
          if (error instanceof ImageSourceDisposedError) return
          if (!cancelled) {
            setDrawError(
              isResourceError(error)
                ? error
                : toImageFormatError(error, {
                    kind: "decode_failed",
                    message: "Image decode failed",
                  })
            )
          }
        })

      return () => {
        cancelled = true
        source.release(frameIndex)
      }
    },
    [
      descriptor.intrinsicSize.height,
      descriptor.intrinsicSize.width,
      dpr,
      frameIndex,
      frameRect.height,
      frameRect.width,
      rotation,
      scale,
      source,
    ]
  )

  return (
    <canvas
      ref={canvasRef}
      style={{ width: frameRect.width, height: frameRect.height }}
      className="block bg-white"
    />
  )
}
