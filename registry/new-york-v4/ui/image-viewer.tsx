"use client"

import * as React from "react"

import {
  createFrameSource,
  isTiffBytes,
  type FrameDescriptor,
  type FrameSource,
} from "@/lib/image-frame-source"
import {
  ImageViewerErrorBoundary,
  ImageViewerFallback,
} from "@/components/ui/image-viewer-chrome"
import {
  clearImageSourceCacheForTests,
  getImageSource,
  ImageViewerContent,
} from "@/components/ui/image-viewer-content"
import type {
  ImageViewerHandle,
  ImageViewerProps,
} from "@/components/ui/image-viewer-types"

export type {
  ImageViewerHandle,
  ImageViewerProps,
  PageOverlayProps,
} from "@/components/ui/image-viewer-types"
export type { FrameDescriptor, FrameSource }
export { clearImageSourceCacheForTests, getImageSource }

export const ImageViewer = React.forwardRef<
  ImageViewerHandle,
  ImageViewerProps
>(function ImageViewer(props, ref) {
  const isClient = useIsClient()
  if (!isClient) {
    return <ImageViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <ImageViewerErrorBoundary className={props.className} resetKey={props.src}>
      <React.Suspense
        fallback={
          <ImageViewerFallback className={props.className} bare={props.bare} />
        }
      >
        <ImageViewerContent {...props} forwardedRef={ref} />
      </React.Suspense>
    </ImageViewerErrorBoundary>
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

function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}
