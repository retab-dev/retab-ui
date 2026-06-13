"use client"

import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { cn } from "@/lib/utils"

import { PdfThumbnailItem } from "./pdf-thumbnail-item"
import {
  normalizeThumbnailPage,
  type PdfThumbnailLayout,
  type PdfThumbnailLayoutItem,
} from "./pdf-thumbnail-layout"

export function getPdfThumbnailItemId(pageNumber: number) {
  return `pdf-thumbnail-page-${pageNumber}`
}

export function PdfThumbnailRail({
  doc,
  layout,
  visibleItems,
  currentPage,
  viewportRef,
  onSelectPage,
  onPageActivate,
  onPointerEnter,
  onPointerLeave,
  onScroll,
  className,
}: {
  doc: PDFDocumentProxy
  layout: PdfThumbnailLayout
  visibleItems: readonly PdfThumbnailLayoutItem[]
  currentPage: number | null | undefined
  viewportRef: React.RefObject<HTMLDivElement | null>
  onSelectPage?: (pageNumber: number) => void
  onPageActivate?: (pageNumber: number) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onScroll?: () => void
  className?: string
}) {
  const activePage = normalizeThumbnailPage(currentPage, layout.pageCount)
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const page = activePage ?? 1
      const nextPage = getKeyboardTargetPage({
        key: event.key,
        page,
        pageCount: layout.pageCount,
      })

      if (nextPage == null) return
      event.preventDefault()
      onPageActivate?.(nextPage)
      onSelectPage?.(nextPage)
    },
    [activePage, layout.pageCount, onPageActivate, onSelectPage]
  )
  const handleSelectPage = React.useCallback(
    (pageNumber: number) => {
      onPageActivate?.(pageNumber)
      onSelectPage?.(pageNumber)
    },
    [onPageActivate, onSelectPage]
  )

  return (
    <nav
      ref={viewportRef}
      data-slot="pdf-thumbnail-sidebar"
      aria-label="PDF pages"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onScroll={onScroll}
      className={cn("h-full overflow-auto bg-muted/30 p-2", className)}
    >
      <ol className="relative w-full" style={{ height: layout.totalHeight }}>
        {visibleItems.map((item) => (
          <li
            key={item.pageNumber}
            data-index={item.pageIndex}
            className="absolute top-0 left-0 flex w-full justify-center pb-2"
            style={{
              height: item.height,
              transform: `translateY(${item.top}px)`,
            }}
          >
            <PdfThumbnailItem
              doc={doc}
              item={item}
              active={activePage === item.pageNumber}
              itemId={getPdfThumbnailItemId(item.pageNumber)}
              onSelectPage={handleSelectPage}
            />
          </li>
        ))}
      </ol>
    </nav>
  )
}

function getKeyboardTargetPage({
  key,
  page,
  pageCount,
}: {
  key: string
  page: number
  pageCount: number
}) {
  switch (key) {
    case "ArrowUp":
      return Math.max(1, page - 1)
    case "ArrowDown":
      return Math.min(pageCount, page + 1)
    case "Home":
      return 1
    case "End":
      return pageCount
    default:
      return null
  }
}
