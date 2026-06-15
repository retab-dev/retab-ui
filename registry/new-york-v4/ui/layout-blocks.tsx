"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  PdfViewerPages,
  PdfViewerProvider,
  type PdfDocumentSource,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import { useSegmentedItemLink } from "@/components/ui/segmented-item-link"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer"

import {
  documentAiToLayoutDocument,
  type DocumentAiDocument,
} from "./layout-blocks-document-ai"
import { documentAiToPdfBlob } from "./layout-blocks-document-ai-pdf"
import { createLayoutBlocksViewerModel } from "./layout-blocks-model"
import { LayoutBlocksPanel } from "./layout-blocks-panel"
import { layoutItemsToSegmentedDocumentModel } from "./layout-blocks-segmented-document-model"
import { LayoutOverlayLayer } from "./layout-overlay-layer"

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
  const pdfSource = useDocumentAiPdfSource(output)
  const [lowConfidenceOnly, setLowConfidenceOnly] = React.useState(false)
  const model = React.useMemo(
    () =>
      createLayoutBlocksViewerModel({
        document: layoutDocument,
        levels: INSPECTED_LEVELS,
        lowConfidenceOnly,
        threshold: LOW_CONFIDENCE_THRESHOLD,
      }),
    [layoutDocument, lowConfidenceOnly]
  )
  const segmentedDocumentModel = React.useMemo(
    () =>
      layoutItemsToSegmentedDocumentModel({
        document: layoutDocument,
        items: model.visibleItems,
      }),
    [layoutDocument, model.visibleItems]
  )

  return (
    <SegmentedDocumentProvider model={segmentedDocumentModel}>
      <DocumentAiLayoutBlocksContent
        className={className}
        heightClassName={heightClassName}
        lowConfidenceOnly={lowConfidenceOnly}
        model={model}
        pdfSource={pdfSource}
        setLowConfidenceOnly={setLowConfidenceOnly}
      />
    </SegmentedDocumentProvider>
  )
}

function DocumentAiLayoutBlocksContent({
  className,
  heightClassName,
  lowConfidenceOnly,
  model,
  pdfSource,
  setLowConfidenceOnly,
}: {
  className?: string
  heightClassName: string
  lowConfidenceOnly: boolean
  model: ReturnType<typeof createLayoutBlocksViewerModel>
  pdfSource: ReturnType<typeof useDocumentAiPdfSource>
  setLowConfidenceOnly: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const segmentedViewport = useSegmentedDocumentViewport()
  const itemLink = useSegmentedItemLink()
  const {
    activeItemId,
    clearPreview,
    navigateItem,
    previewItem,
    selectItem,
    selectedItemId,
  } = itemLink

  const renderPageOverlay = React.useCallback(
    ({ pageNumber, rotation }: { pageNumber: number; rotation: number }) => {
      const page = model.index.pagesByNumber.get(pageNumber)
      if (!page) return null

      return (
        <LayoutOverlayLayer
          interactive
          activeItemId={activeItemId}
          items={model.visibleItems.filter(
            (item) => item.pageNumber === pageNumber
          )}
          page={page}
          rotation={rotation}
          selectedItemId={selectedItemId}
          visibleLevels={INSPECTED_LEVELS}
          onItemClick={(item) => {
            selectItem(item.id)
            navigateItem(item.id, { behavior: "smooth", clearPreview: false })
          }}
          onItemPointerEnter={(item) => previewItem(item.id)}
          onItemPointerLeave={clearPreview}
        />
      )
    },
    [
      activeItemId,
      clearPreview,
      model.index.pagesByNumber,
      model.visibleItems,
      navigateItem,
      previewItem,
      selectItem,
      selectedItemId,
    ]
  )
  const setPdfViewerHandle = React.useCallback(
    (handle: PdfViewerHandle | null) => {
      segmentedViewport.documentHandlers.setDocumentHandle(handle)
    },
    [segmentedViewport.documentHandlers]
  )

  return (
    <ViewerRoot
      data-layout-blocks=""
      className={cn("bg-background", heightClassName, className)}
      bare
      defaultOpen
      sidebarSide="right"
    >
      <ViewerHeader>
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <ViewerSidebarTrigger className="-ml-1" />
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-sm font-medium">OCR</div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {model.visibleItems.length} blocks
              </div>
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
            <PdfViewerProvider source={pdfSource.source}>
              <PdfViewerPages
                ref={setPdfViewerHandle}
                bare
                className="h-full"
                onScrollProgressChange={
                  segmentedViewport.documentHandlers.onScrollProgressChange
                }
                onVisiblePageChange={
                  segmentedViewport.documentHandlers.onCurrentPageChange
                }
                renderPageOverlay={renderPageOverlay}
              />
            </PdfViewerProvider>
          ) : (
            <div className="grid h-full place-items-center bg-muted/20 p-6 text-sm text-muted-foreground">
              {pdfSource.error ?? "Preparing OCR pages..."}
            </div>
          )}
        </ViewerSurface>
        <ViewerSidebar
          aria-label="OCR blocks"
          width="320px"
          className="flex min-h-0 shrink-0 flex-col border-l bg-background"
        >
          <LayoutBlocksPanel
            activeItemId={activeItemId}
            className="min-h-0 flex-1"
            emptyLabel={
              lowConfidenceOnly
                ? "No low-confidence OCR blocks found."
                : "No OCR blocks found."
            }
            items={model.evidenceItems}
            selectedItemId={selectedItemId}
            onActiveItemIdChange={previewItem}
            onNavigateItem={(item, options) => {
              navigateItem(item.id, {
                behavior: options?.behavior,
                clearPreview: options?.behavior === "auto" ? false : undefined,
              })
            }}
            onSelectedItemIdChange={(itemId) => {
              selectItem(itemId)
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
export {
  createLayoutBlocksViewerModel,
  layoutItemToEvidenceItem,
} from "./layout-blocks-model"
export { LayoutBlocksPanel } from "./layout-blocks-panel"
export { LayoutOverlayLayer } from "./layout-overlay-layer"
