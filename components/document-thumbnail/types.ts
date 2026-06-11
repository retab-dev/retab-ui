import type * as React from "react"

export type DocumentKind =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "image"
  | "tiff"
  | "csv"
  | "markdown"
  | "html"
  | "text"

/**
 * Which corner of the document stays pinned when its preview is larger than the
 * (usually square) frame.
 */
export type ThumbnailAnchor = "top-left" | "top-right" | "bottom-left"

export interface DocumentThumbnailProps {
  src: string
  name: string
  type: string
  kind: DocumentKind
  className?: string
  previewAspectRatio?: number
  /** Corner of the document to keep visible when it overflows. Default top-left. */
  anchor?: ThumbnailAnchor
  /** Change this to retry a failed render without changing the source. */
  retryKey?: React.Key
}

export interface ThumbnailResourceIdentity {
  kind: DocumentKind
  src: string
  anchor: ThumbnailAnchor
  retryKey: React.Key | null
}

export function getThumbnailResourceKey({
  kind,
  src,
  anchor,
  retryKey,
}: ThumbnailResourceIdentity): string {
  return [
    encodePart(`kind:${kind}`),
    encodePart(`src:${src}`),
    encodePart(`anchor:${anchor}`),
    encodeRetryKey(retryKey),
  ].join("")
}

function encodePart(value: string): string {
  return `${value.length}:${value}`
}

function encodeRetryKey(retryKey: React.Key | null): string {
  if (retryKey === null) return encodePart("retry:null:")
  return encodePart(`retry:${typeof retryKey}:${String(retryKey)}`)
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
