import type * as React from "react"

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

export interface PdfViewerSlots {
  /** Full-width strip directly below the toolbar (e.g. a legend). */
  top?: React.ReactNode
  /** Full-width strip at the bottom of the document column (e.g. a waterfall). */
  bottom?: React.ReactNode
  /** Collapsible rail to the left of the pages (e.g. a vertical page ribbon). */
  left?: React.ReactNode
  /** Collapsible rail to the right of the pages. */
  right?: React.ReactNode
  /** Absolutely-positioned layer over the scrolling pages (e.g. a floating legend). */
  overlay?: React.ReactNode
}

export type PdfPageSize = {
  width: number
  height: number
}
