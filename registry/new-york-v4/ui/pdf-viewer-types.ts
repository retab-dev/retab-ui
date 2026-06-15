import type { ViewerResource } from "@/lib/viewer-resource"

export interface PageOverlayProps {
  pageNumber: number
  /** Rendered page size in CSS pixels (post-scale, post-rotation). */
  width: number
  height: number
  scale: number
  rotation: number
}

export type PdfPageAreaTarget = {
  pageNumber: number
  top: number
  left?: number
  width?: number
  height?: number
}

export interface PdfViewerHandle {
  scrollToPage: (pageNumber: number, options?: ScrollToOptions) => void
  scrollToPageArea: (
    target: PdfPageAreaTarget,
    options?: ScrollToOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export type PdfPageSize = {
  width: number
  height: number
}

export type PdfDocumentViewportControls = {
  currentPage: number
  downloadAction: ViewerResource["originalDownload"]
  onFitWidth: () => void
  onRotate: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  pageCount: number
  scale: number
}
