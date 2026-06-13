import type { ViewerSlots } from "./viewer-slots"

export interface PageOverlayProps {
  pageNumber: number
  /** Rendered page size in CSS pixels (post-scale, post-rotation). */
  width: number
  height: number
  scale: number
  rotation: number
}

export type PdfPageScrollTarget = {
  top: number
}

export interface PdfViewerHandle {
  scrollToPageTarget: (
    pageNumber: number,
    target: PdfPageScrollTarget,
    options?: ScrollToOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export type PdfViewerSlots = ViewerSlots

export type PdfPageSize = {
  width: number
  height: number
}
