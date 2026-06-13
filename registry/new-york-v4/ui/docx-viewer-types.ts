import type { ViewerResource } from "@/lib/viewer-resource"
import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source"

import type { ViewerSlots } from "./viewer-slots"

export type DocxDocumentSource = UrlViewerSource | BlobViewerSource

export type DocxTarget =
  | { kind: "text"; text: string }
  | { kind: "cell"; table: number; row: number; column: number }

export interface DocxViewerHandle {
  scrollToTarget: (target: DocxTarget, options?: ScrollIntoViewOptions) => void
  getViewportElement: () => HTMLDivElement | null
}

export type DocxViewerSlots = ViewerSlots

export interface DocxViewerProps {
  source: DocxDocumentSource
  className?: string
  scale?: number
  defaultScale?: number
  onScaleChange?: (scale: number | null) => void
  toolbar?: boolean
  highlight?: DocxTarget | null
  onVisiblePageChange?: (page: number) => void
  onScrollProgressChange?: (progress: number) => void
  bare?: boolean
  slots?: DocxViewerSlots
}

export type DocxResourceViewerProps = Omit<DocxViewerProps, "source"> & {
  resource: ViewerResource
}
