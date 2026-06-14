"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  AnchoredDocumentProvider,
  type AnchoredItem,
  useAnchoredDocument,
} from "@/components/ui/anchored-document-viewer"
import {
  usePdfAnchoredOverlay,
  usePdfAnchoredTarget,
} from "@/components/ui/pdf-anchor-target"
import {
  PdfViewer,
  type PdfDocumentSource,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"

import {
  documentAiToLayoutDocument,
  type DocumentAiDocument,
} from "./layout-blocks-document-ai"
import { documentAiToPdfBlob } from "./layout-blocks-document-ai-pdf"
import { getScrollTarget } from "./layout-blocks-geometry"
import { createLayoutItemIndex } from "./layout-blocks-index"
import { LayoutBlocksPanel } from "./layout-blocks-panel"
import type { LayoutItem } from "./layout-blocks-types"

const LOW_CONFIDENCE_THRESHOLD = 0.9

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
  const anchoredItems = React.useMemo(
    () =>
      visibleItems.map((item): AnchoredItem => {
        const page = index.pagesByNumber.get(item.pageNumber)
        const target = page ? getScrollTarget(item, page) : null
        return {
          id: item.id,
          anchor: target
            ? {
                kind: "pdf-area",
                pageNumber: target.pageNumber,
                left: target.left,
                top: target.top,
                width: target.width,
                height: target.height,
              }
            : null,
        }
      }),
    [index.pagesByNumber, visibleItems]
  )
  const target = usePdfAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={anchoredItems} target={target}>
      <DocumentAiLayoutBlocksContent
        anchoredItems={anchoredItems}
        className={className}
        heightClassName={heightClassName}
        index={index}
        lowConfidenceOnly={lowConfidenceOnly}
        pdfSource={pdfSource}
        setLowConfidenceOnly={setLowConfidenceOnly}
        viewerRef={viewerRef}
        visibleItems={visibleItems}
      />
    </AnchoredDocumentProvider>
  )
}

function DocumentAiLayoutBlocksContent({
  anchoredItems,
  className,
  heightClassName,
  index,
  lowConfidenceOnly,
  pdfSource,
  setLowConfidenceOnly,
  viewerRef,
  visibleItems,
}: {
  anchoredItems: readonly AnchoredItem[]
  className?: string
  heightClassName: string
  index: ReturnType<typeof createLayoutItemIndex>
  lowConfidenceOnly: boolean
  pdfSource: ReturnType<typeof useDocumentAiPdfSource>
  setLowConfidenceOnly: React.Dispatch<React.SetStateAction<boolean>>
  viewerRef: React.RefObject<PdfViewerHandle | null>
  visibleItems: LayoutItem[]
}) {
  const {
    activeItemId,
    activateItem,
    clearSelection,
    previewItem,
    selectedItemId,
  } = useAnchoredDocument()
  const renderPageOverlay = usePdfAnchoredOverlay({
    getItemLabel: (item) => {
      const layoutItem = index.itemsById.get(item.id)
      const text = layoutItem?.text.replace(/\s+/g, " ").trim()
      return text ? `OCR block: ${text}` : `OCR block ${item.id}`
    },
    items: anchoredItems,
    mode: "interactive",
  })

  return (
    <ViewerRoot
      data-slot="layout-blocks"
      className={cn("bg-background", heightClassName, className)}
      bare
    >
      <ViewerHeader>
        <div className="flex items-center justify-between gap-3 p-3">
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
      </ViewerHeader>
      <ViewerBody>
        <ViewerSurface>
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
        </ViewerSurface>
        <ViewerSidebar className="flex min-h-0 w-[320px] shrink-0 flex-col border-l bg-background md:w-[320px]">
          <LayoutBlocksPanel
            activeItemId={activeItemId}
            className="min-h-0 flex-1"
            emptyLabel={
              lowConfidenceOnly
                ? "No low-confidence OCR blocks found."
                : "No OCR blocks found."
            }
            items={visibleItems}
            selectedItemId={selectedItemId}
            onActiveItemIdChange={previewItem}
            onSelectedItemIdChange={(itemId) => {
              if (itemId) {
                activateItem(itemId)
                return
              }
              clearSelection()
            }}
          />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
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
