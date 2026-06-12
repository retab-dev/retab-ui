import type { PdfPageSize } from "./pdf-viewer-types"

export const PDF_PAGE_GAP = 16
export const PDF_PAGE_PADDING = 16

export type PdfPageLayout = {
  pageNumber: number
  width: number
  height: number
  offsetTop: number
}

export type PdfPageLayoutModel = {
  pages: PdfPageLayout[]
  totalHeight: number
  maxPageWidth: number
}

export function createPdfPageLayout({
  pageCount,
  defaultPageSize,
  pageSizeByNumber,
  scale,
  rotation,
}: {
  pageCount: number
  defaultPageSize: PdfPageSize
  pageSizeByNumber: ReadonlyMap<number, PdfPageSize>
  scale: number
  rotation: number
}): PdfPageLayoutModel {
  const pages: PdfPageLayout[] = []
  const isRotated = rotation % 180 !== 0
  let offsetTop = PDF_PAGE_PADDING
  let maxPageWidth = 0

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const pageSize = pageSizeByNumber.get(pageNumber) ?? defaultPageSize
    const width = Math.round(
      (isRotated ? pageSize.height : pageSize.width) * scale
    )
    const height = Math.round(
      (isRotated ? pageSize.width : pageSize.height) * scale
    )

    pages.push({ pageNumber, width, height, offsetTop })
    maxPageWidth = Math.max(maxPageWidth, width)
    offsetTop += height + PDF_PAGE_GAP
  }

  return {
    pages,
    totalHeight:
      pages.length === 0 ? 0 : offsetTop - PDF_PAGE_GAP + PDF_PAGE_PADDING,
    maxPageWidth,
  }
}

export function getPdfPageLayout(
  layout: PdfPageLayoutModel,
  pageNumber: number
) {
  return layout.pages[pageNumber - 1]
}

export function findPdfPageByOffset(
  layout: PdfPageLayoutModel,
  offset: number
) {
  if (layout.pages.length === 0) return 1

  let low = 0
  let high = layout.pages.length - 1
  let match = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const page = layout.pages[mid]
    if (page.offsetTop <= offset) {
      match = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return layout.pages[match].pageNumber
}

export function getPdfVisiblePageNumbers({
  layout,
  scrollTop,
  viewportHeight,
  overscanPages = 2,
}: {
  layout: PdfPageLayoutModel
  scrollTop: number
  viewportHeight: number
  overscanPages?: number
}) {
  if (layout.pages.length === 0) return []

  const startOffset = Math.max(0, scrollTop - viewportHeight)
  const endOffset = scrollTop + viewportHeight * 2
  const firstVisiblePage = findPdfPageByOffset(layout, startOffset)
  const lastVisiblePage = findPdfPageByOffset(layout, endOffset)
  const firstPage = Math.max(1, firstVisiblePage - overscanPages)
  const lastPage = Math.min(
    layout.pages.length,
    lastVisiblePage + overscanPages
  )

  return Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index
  )
}
