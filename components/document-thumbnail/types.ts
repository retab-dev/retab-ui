import type * as React from "react"

import type { FileCategory, ViewerSource } from "@/lib/viewer-source"

/**
 * Which corner of the document stays pinned when its preview is larger than the
 * (usually square) frame.
 */
export type ThumbnailAnchor = "top-left" | "top-right" | "bottom-left"

export interface DocumentThumbnailProps {
  source: ViewerSource
  as?: FileCategory
  className?: string
  previewAspectRatio?: number
  /** Corner of the document to keep visible when it overflows. Default top-left. */
  anchor?: ThumbnailAnchor
  /** Change this to retry a failed render without changing the source. */
  retryKey?: React.Key
}

/** Absolute-position classes that pin a covered element to its anchor corner. */
export const ANCHOR_CORNER: Record<ThumbnailAnchor, string> = {
  "top-left": "top-0 left-0",
  "top-right": "top-0 right-0",
  "bottom-left": "bottom-0 left-0",
}

/** `object-position` classes for the <img> cover path (raster images). */
export const ANCHOR_OBJECT_POSITION: Record<ThumbnailAnchor, string> = {
  "top-left": "object-left-top",
  "top-right": "object-right-top",
  "bottom-left": "object-left-bottom",
}
