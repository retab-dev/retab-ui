import type * as React from "react"

import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source"

export interface ImageFrameOverlayProps {
  /** 1-based frame index (a TIFF page; always 1 for single images). */
  frameNumber: number
  /** Rendered frame size in CSS pixels (post-scale, post-rotation). */
  width: number
  height: number
  scale: number
  rotation: number
}

/**
 * Imperative handle for driving the viewer from outside (e.g. scroll to the
 * source of a hovered field). Obtain it with a `ref` on `<ImageViewer>`.
 */
export interface ImageViewerHandle {
  /**
   * Scroll a frame's normalized area into view. `area` fields are percentages
   * [0, 100] of the rendered frame; only `top` is required. Pass
   * `behavior: "auto"` for an instant jump (e.g. on hover).
   */
  scrollToFrameArea: (
    frameNumber: number,
    area: { top: number; left?: number; width?: number; height?: number },
    options?: ScrollToOptions
  ) => void
  /** The scrolling viewport element, or null before the image loads. */
  getViewportElement: () => HTMLDivElement | null
}

export type ImageDocumentSource = UrlViewerSource | BlobViewerSource

export interface ImageViewerProps {
  /** Canonical image source. PNG/JPEG/WebP/GIF/AVIF/BMP/ICO or TIFF. */
  source: ImageDocumentSource
  className?: string
  /** Fixed scale; when omitted the viewer fits frame width to the container. */
  scale?: number
  /** Intrinsic size used to reserve the first frame while image metadata loads. */
  fallbackFrameSize?: { width: number; height: number }
  toolbar?: boolean
  /** Render absolutely-positioned overlays (e.g. bbox citations) on each frame. */
  renderFrameOverlay?: (props: ImageFrameOverlayProps) => React.ReactNode
  /** Fired with the 1-based frame nearest the top of the viewport as you scroll. */
  onVisibleFrameChange?: (frameNumber: number) => void
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
  /** Rendered as a full-width strip directly below the toolbar (e.g. a legend). */
  header?: React.ReactNode
  /** Rendered as a left rail alongside the scrolling frames (e.g. a page ribbon). */
  aside?: React.ReactNode
}
