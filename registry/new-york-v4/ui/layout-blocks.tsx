"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  PdfViewer,
  type PdfDocumentSource,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"

import {
  documentAiToLayoutDocument,
  type DocumentAiDocument,
} from "./layout-blocks-document-ai"
import { documentAiToPdfBlob } from "./layout-blocks-document-ai-pdf"
import { getScrollTarget } from "./layout-blocks-geometry"
import { createLayoutItemIndex } from "./layout-blocks-index"
import { LayoutBlocksPanel } from "./layout-blocks-panel"
import type { LayoutItem } from "./layout-blocks-types"
import { LayoutOverlayLayer } from "./layout-overlay-layer"
import { useLayoutBlockSelection } from "./use-layout-block-selection"

const LOW_CONFIDENCE_THRESHOLD = 0.9
const INSPECTED_LEVELS = ["block"] as const

export function DocumentAiLayoutBlocks({
  className,
  heightClassName = "h-[680px]",
  output,
}: {
  className?: string
  heightClassName?: string
  output: DocumentAiDocument
}) {
  const layoutDocument = React.useMemo(
    () => documentAiToLayoutDocument(output),
    [output]
  )
  const index = React.useMemo(
    () =>
      createLayoutItemIndex({
        items: layoutDocument.items,
        pages: layoutDocument.pages,
      }),
    [layoutDocument.items, layoutDocument.pages]
  )
  const pdfSource = useDocumentAiPdfSource(output)
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const selection = useLayoutBlockSelection()
  const [lowConfidenceOnly, setLowConfidenceOnly] = React.useState(false)
  const visibleItems = React.useMemo(
    () =>
      layoutDocument.items.filter((item) => {
        if (item.level !== "block") return false
        if (!lowConfidenceOnly) return true
        return (
          item.confidence != null && item.confidence < LOW_CONFIDENCE_THRESHOLD
        )
      }),
    [layoutDocument.items, lowConfidenceOnly]
  )

  const navigateItem = React.useCallback(
    (item: LayoutItem) => {
      const page = index.pagesByNumber.get(item.pageNumber)
      if (!page) return
      const target = getScrollTarget(item, page)
      viewerRef.current?.scrollToPageArea(
        { pageNumber: item.pageNumber, top: target.top },
        { behavior: "smooth" }
      )
    },
    [index.pagesByNumber]
  )

  const renderPageOverlay = React.useCallback(
    ({ pageNumber, rotation }: { pageNumber: number; rotation: number }) => {
      const page = index.pagesByNumber.get(pageNumber)
      if (!page) return null

      return (
        <LayoutOverlayLayer
          interactive
          activeItemId={selection.activeItemId}
          items={visibleItems.filter((item) => item.pageNumber === pageNumber)}
          page={page}
          rotation={rotation}
          selectedItemId={selection.selectedItemId}
          visibleLevels={INSPECTED_LEVELS}
          onItemClick={(item) => {
            selection.selectItemId(item.id)
            navigateItem(item)
          }}
          onItemPointerEnter={(item) => selection.setActiveItemId(item.id)}
          onItemPointerLeave={selection.clearActiveItemId}
        />
      )
    },
    [index.pagesByNumber, navigateItem, selection, visibleItems]
  )

  return (
    <div
      data-slot="layout-blocks"
      className={cn(
        "flex min-h-0 overflow-hidden bg-background",
        heightClassName,
        className
      )}
    >
      <div className="min-h-0 min-w-0 flex-1">
        {pdfSource.source ? (
          <PdfViewer
            ref={viewerRef}
            bare
            className="h-full"
            renderPageOverlay={renderPageOverlay}
            source={pdfSource.source}
          />
        ) : (
          <div className="grid h-full place-items-center bg-muted/20 p-6 text-sm text-muted-foreground">
            {pdfSource.error ?? "Preparing OCR pages..."}
          </div>
        )}
      </div>
      <aside className="flex min-h-0 w-[320px] shrink-0 flex-col border-l bg-background">
        <div className="border-b p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">OCR</div>
              <div className="text-xs text-muted-foreground">
                {visibleItems.length} blocks
              </div>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5"
                checked={lowConfidenceOnly}
                onChange={(event) =>
                  setLowConfidenceOnly(event.currentTarget.checked)
                }
              />
              Low confidence
            </label>
          </div>
        </div>
        <LayoutBlocksPanel
          activeItemId={selection.activeItemId}
          className="min-h-0 flex-1"
          emptyLabel={
            lowConfidenceOnly
              ? "No low-confidence OCR blocks found."
              : "No OCR blocks found."
          }
          items={visibleItems}
          selectedItemId={selection.selectedItemId}
          onActiveItemIdChange={selection.setActiveItemId}
          onNavigateItem={navigateItem}
          onSelectedItemIdChange={selection.selectItemId}
        />
      </aside>
    </div>
  )
}

function useDocumentAiPdfSource(output: DocumentAiDocument) {
  const [state, setState] = React.useState<{
    error?: string
    source?: PdfDocumentSource
  }>({})

  React.useEffect(() => {
    let isCurrent = true
    setState({})

    documentAiToPdfBlob(output)
      .then((blob) => {
        if (!isCurrent) return
        setState({
          source: {
            kind: "blob",
            blob,
            fileName: "ocr-pages.pdf",
            identityKey: `document-ai-pdf:${output.pages?.length ?? 0}:${blob.size}`,
            mimeType: "application/pdf",
          },
        })
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setState({
          error:
            error instanceof Error
              ? error.message
              : "Failed to prepare OCR pages.",
        })
      })

    return () => {
      isCurrent = false
    }
  }, [output])

  return state
}

export type { LayoutItem, LayoutLevel, LayoutPage } from "./layout-blocks-types"
export type { DocumentAiDocument } from "./layout-blocks-document-ai"
export { documentAiToLayoutDocument } from "./layout-blocks-document-ai"
export { documentAiToPdfBlob } from "./layout-blocks-document-ai-pdf"
export { createLayoutItemIndex } from "./layout-blocks-index"
export { LayoutBlocksPanel } from "./layout-blocks-panel"
export { LayoutOverlayLayer } from "./layout-overlay-layer"
export { useLayoutBlockSelection } from "./use-layout-block-selection"
