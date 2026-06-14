"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import type { PageOverlayProps, PdfViewerHandle } from "@/components/ui/pdf-viewer"
import { PdfHighlight } from "@/components/ui/pdf-viewer"

import type {
  AnchoredDocumentTarget,
  AnchoredItem,
  PdfAreaAnchor,
} from "./anchored-document-viewer"
import { useAnchoredDocument } from "./anchored-document-viewer"
import { pdfAnchorToTarget } from "./pdf-source"

export function sourceToPdfAnchor(source: Source): PdfAreaAnchor | null {
  const target = pdfAnchorToTarget(source.anchor)
  return target
    ? {
        kind: "pdf-area",
        pageNumber: target.page,
        left: target.area.left,
        top: target.area.top,
        width: target.area.width,
        height: target.area.height,
      }
    : null
}

export function usePdfAnchoredTarget(
  viewerRef: React.RefObject<PdfViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo<AnchoredDocumentTarget>(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "pdf-area") return
        viewerRef.current?.scrollToPageArea(
          {
            pageNumber: anchor.pageNumber,
            left: anchor.left,
            top: anchor.top,
            width: anchor.width,
            height: anchor.height,
          },
          options
        )
      },
    }),
    [viewerRef]
  )
}

type PdfAnchoredOverlayOptions =
  | {
      mode?: "active"
    }
  | {
      getItemLabel?: (item: AnchoredItem) => string
      items: readonly AnchoredItem[]
      mode: "interactive"
    }

function pdfArea(anchor: PdfAreaAnchor) {
  return {
    left: anchor.left,
    top: anchor.top,
    width: anchor.width,
    height: anchor.height,
  }
}

function isPdfAreaAnchor(anchor: AnchoredItem["anchor"]): anchor is PdfAreaAnchor {
  return anchor?.kind === "pdf-area"
}

export function usePdfAnchoredOverlay(options: PdfAnchoredOverlayOptions = {}) {
  const {
    activateItem,
    activeAnchor,
    activeItemId,
    clearPreview,
    previewItem,
    selectedItemId,
  } = useAnchoredDocument()

  return React.useCallback(
    ({ pageNumber }: PageOverlayProps) => {
      if (options.mode !== "interactive") {
        return isPdfAreaAnchor(activeAnchor) &&
          activeAnchor.pageNumber === pageNumber ? (
          <PdfHighlight area={pdfArea(activeAnchor)} />
        ) : null
      }

      const pageItems = options.items.filter(
        (item) =>
          !item.disabled &&
          isPdfAreaAnchor(item.anchor) &&
          item.anchor.pageNumber === pageNumber
      )

      return pageItems.map((item) => {
        const anchor = item.anchor as PdfAreaAnchor
        const isActive = item.id === activeItemId
        const isSelected = item.id === selectedItemId

        return (
          <button
            key={item.id}
            type="button"
            aria-label={options.getItemLabel?.(item) ?? item.id}
            aria-current={isActive ? "true" : undefined}
            aria-pressed={isSelected}
            data-anchored-item-id={item.id}
            data-active={isActive ? "" : undefined}
            data-selected={isSelected ? "" : undefined}
            className={[
              "absolute z-20 rounded-[2px] border bg-transparent outline-none transition-[background-color,border-color,box-shadow]",
              "border-primary/35 hover:border-primary/70 hover:bg-primary/8 focus-visible:ring-2 focus-visible:ring-ring",
              isActive ? "border-primary/70 bg-primary/12" : "",
              isSelected ? "border-primary bg-primary/16 shadow-sm" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${anchor.left}%`,
              top: `${anchor.top}%`,
              width: `${anchor.width}%`,
              height: `${anchor.height}%`,
            }}
            onClick={() => activateItem(item.id)}
            onPointerEnter={() => previewItem(item.id)}
            onPointerLeave={clearPreview}
          />
        )
      })
    },
    [
      activateItem,
      activeAnchor,
      activeItemId,
      clearPreview,
      options,
      previewItem,
      selectedItemId,
    ]
  )
}
