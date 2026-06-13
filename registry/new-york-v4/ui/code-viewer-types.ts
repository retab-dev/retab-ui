import type {
  BlobViewerSource,
  TextSource,
  UrlViewerSource,
} from "@/lib/viewer-source"

import type { TextLineRange } from "./text-viewer-ranges"
import type { TextViewerBounds } from "./text-viewer-resource"

export type { TextLineRange }
export type CodeLineRange = TextLineRange

export interface CodeViewerHandle {
  scrollToLineRange: (range: TextLineRange, options?: ScrollToOptions) => void
  getViewportElement: () => HTMLDivElement | null
}

export type CodeDocumentSource = UrlViewerSource | BlobViewerSource | TextSource

export interface CodeViewerProps extends TextViewerBounds {
  source: CodeDocumentSource
  className?: string
  toolbar?: boolean
  /** 1-based inclusive line range to highlight, or null. */
  highlight?: TextLineRange | null
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
}
