"use client"

import * as React from "react"

import {
  createFrameSource,
  isTiffBytes,
  type FrameDescriptor,
  type FrameSource,
} from "@/lib/image-frame-source"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import { ImageViewerFallback } from "@/components/ui/image-viewer-chrome"
import {
  getImageSource,
  ImageViewerContent,
  resetImageSourceCacheForTests,
} from "@/components/ui/image-viewer-content"
import type {
  ImageViewerHandle,
  ImageViewerProps,
} from "@/components/ui/image-viewer-types"
import { useIsClient } from "@/components/ui/use-is-client"
import { ViewerErrorBoundary } from "@/components/ui/viewer-error"

export type {
  ImageDocumentSource,
  ImageFrameOverlayProps,
  ImageViewerHandle,
  ImageViewerProps,
  ImageViewerSlots,
} from "@/components/ui/image-viewer-types"
export type { FrameDescriptor, FrameSource }
export { getImageSource, resetImageSourceCacheForTests }

export type ImageResourceViewerProps = Omit<ImageViewerProps, "source"> & {
  resource: ViewerResource
}

export const ImageViewer = React.forwardRef<
  ImageViewerHandle,
  ImageViewerProps
>(function ImageViewer(props, ref) {
  const { source, ...resourceProps } = props
  const resource = React.useMemo(() => createViewerResource(source), [source])
  return (
    <ImageResourceViewer {...resourceProps} ref={ref} resource={resource} />
  )
})

export const ImageResourceViewer = React.forwardRef<
  ImageViewerHandle,
  ImageResourceViewerProps
>(function ImageResourceViewer(props, ref) {
  const isClient = useIsClient()
  const resource = props.resource
  if (!isClient) {
    return (
      <ImageViewerFallback
        bare={props.bare}
        className={props.className}
        fallbackFrameSize={props.fallbackFrameSize}
        scale={props.scale ?? props.defaultScale}
        toolbar={props.toolbar}
      />
    )
  }
  return (
    <ViewerErrorBoundary
      className={props.className}
      download={resource.originalDownload}
      format="image"
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <ImageViewerFallback
            bare={props.bare}
            className={props.className}
            fallbackFrameSize={props.fallbackFrameSize}
            scale={props.scale ?? props.defaultScale}
            toolbar={props.toolbar}
          />
        }
      >
        <ImageViewerContent {...props} forwardedRef={ref} resource={resource} />
      </React.Suspense>
    </ViewerErrorBoundary>
  )
})

export function looksLikeTiff(
  src: string,
  contentType: string | null,
  bytes: ArrayBuffer
): boolean {
  return isTiffBytes(src, contentType, bytes)
}

export function createImageSourceForTests(
  kind: "image" | "tiff",
  frames: readonly { width: number; height: number }[],
  decode: (frameIndex: number) => Promise<ImageBitmap>,
  onDispose?: (reason: Error) => void
): FrameSource {
  return createFrameSource({
    kind: kind === "image" ? "native-image" : "tiff",
    frames: frames.map((frame) => ({
      intrinsicSize: { width: frame.width, height: frame.height },
    })),
    decode,
    maxDecodedFrames: 16,
    onDispose,
  })
}
