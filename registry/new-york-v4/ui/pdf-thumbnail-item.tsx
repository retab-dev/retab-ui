"use client"

import * as React from "react"

import type { PdfDocumentProxy } from "@/lib/pdf-document-types"
import { cn } from "@/lib/utils"

import {
  PdfThumbnailCanvas,
  PdfThumbnailSkeleton,
} from "./pdf-thumbnail-canvas"
import type { PdfThumbnailLayoutItem } from "./pdf-thumbnail-layout"

export function PdfThumbnailItem({
  doc,
  item,
  active,
  itemId,
  onSelectPage,
}: {
  doc: PdfDocumentProxy
  item: PdfThumbnailLayoutItem
  active: boolean
  itemId: string
  onSelectPage?: (pageNumber: number) => void
}) {
  return (
    <button
      id={itemId}
      type="button"
      aria-label={`Page ${item.pageNumber}`}
      aria-current={active ? "page" : undefined}
      data-active={active}
      data-page-number={item.pageNumber}
      onClick={() => onSelectPage?.(item.pageNumber)}
      className="flex flex-shrink-0 flex-col items-center gap-1 outline-none"
    >
      <div
        className={cn(
          "overflow-hidden rounded-sm bg-white ring-2 transition-shadow",
          active ? "ring-primary" : "ring-sidebar-border"
        )}
        style={{ width: item.imageWidth }}
      >
        <React.Suspense fallback={<PdfThumbnailSkeleton />}>
          <PdfThumbnailCanvas
            doc={doc}
            pageNumber={item.pageNumber}
            width={item.imageWidth}
          />
        </React.Suspense>
      </div>
      <span
        className={cn(
          "text-[10px] tabular-nums",
          active
            ? "font-semibold text-sidebar-foreground"
            : "text-sidebar-foreground/70"
        )}
      >
        {item.pageNumber}
      </span>
    </button>
  )
}
