"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  FileViewer,
  FileViewerBody,
  FileViewerProvider,
  FileViewerSurface,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import {
  PdfViewerPages,
  PdfViewerProvider,
  type PdfDocumentSource,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer";
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider";
import { useSegmentedItemLink } from "@/components/ui/segmented-item-link";
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer";

import {
  azureToLayoutDocument,
  type AzureDocument,
} from "./layout-blocks-azure";
import {
  documentAiPageImages,
  documentAiToLayoutDocument,
  type DocumentAiDocument,
} from "./layout-blocks-document-ai";
import { createLayoutBlocksViewerModel } from "./layout-blocks-model";
import { LayoutBlocksPanel } from "./layout-blocks-panel";
import { layoutDocumentToPdfBlob } from "./layout-blocks-pdf";
import { createOcrSegmentedDocumentModel } from "./layout-blocks-segmented-document-model";
import {
  textractToLayoutDocument,
  type TextractDocument,
} from "./layout-blocks-textract";
import type { LayoutDocument, LayoutLevel } from "./layout-blocks-types";
import { LayoutOverlayLayer } from "./layout-overlay-layer";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

const LOW_CONFIDENCE_THRESHOLD = 0.9;
const LEVEL_ORDER: LayoutLevel[] = ["block", "paragraph", "line", "word"];
const EMPTY_PAGE_IMAGES: ReadonlyMap<number, string> = new Map();

/**
 * Discriminated source for the OCR viewer. Each provider's raw output is
 * normalized to a shared {@link LayoutDocument} before rendering, so the viewer
 * itself is provider-agnostic.
 */
export type OcrSource =
  | {
      provider: "google-document-ai";
      output: DocumentAiDocument;
      pageImages?: ReadonlyMap<number, string>;
    }
  | {
      provider: "aws-textract";
      output: TextractDocument;
      pageImages?: ReadonlyMap<number, string>;
    }
  | {
      provider: "azure-document-intelligence";
      output: AzureDocument;
      pageImages?: ReadonlyMap<number, string>;
    };

export function OcrLayoutBlocks({
  className,
  heightClassName = "h-[680px]",
  source,
}: {
  className?: string;
  heightClassName?: string;
  source: OcrSource;
}) {
  const { document: layoutDocument, pageImages } = React.useMemo(
    () => normalizeOcrSource(source),
    [source],
  );
  const inspectedLevels = React.useMemo(
    () => inspectedLevelsForDocument(layoutDocument),
    [layoutDocument],
  );
  const pdfSource = useLayoutPdfSource(layoutDocument, pageImages);
  const [lowConfidenceOnly, setLowConfidenceOnly] = React.useState(false);
  const model = React.useMemo(
    () =>
      createLayoutBlocksViewerModel({
        document: layoutDocument,
        levels: inspectedLevels,
        lowConfidenceOnly,
        threshold: LOW_CONFIDENCE_THRESHOLD,
      }),
    [layoutDocument, inspectedLevels, lowConfidenceOnly],
  );
  const segmentedDocumentModel = React.useMemo(
    () =>
      createOcrSegmentedDocumentModel({
        document: layoutDocument,
        items: model.visibleItems,
      }),
    [layoutDocument, model.visibleItems],
  );

  return (
    <SegmentedDocumentProvider model={segmentedDocumentModel}>
      <OcrLayoutBlocksContent
        className={className}
        heightClassName={heightClassName}
        inspectedLevels={inspectedLevels}
        lowConfidenceOnly={lowConfidenceOnly}
        model={model}
        pdfSource={pdfSource}
        setLowConfidenceOnly={setLowConfidenceOnly}
      />
    </SegmentedDocumentProvider>
  );
}

/**
 * Back-compatible entry point for Google Document AI output. Prefer
 * {@link OcrLayoutBlocks} with an explicit {@link OcrSource} for new code.
 */
export function DocumentAiLayoutBlocks({
  className,
  heightClassName,
  output,
}: {
  className?: string;
  heightClassName?: string;
  output: DocumentAiDocument;
}) {
  const source = React.useMemo<OcrSource>(
    () => ({ provider: "google-document-ai", output }),
    [output],
  );
  return (
    <OcrLayoutBlocks
      className={className}
      heightClassName={heightClassName}
      source={source}
    />
  );
}

function OcrLayoutBlocksContent({
  className,
  heightClassName,
  inspectedLevels,
  lowConfidenceOnly,
  model,
  pdfSource,
  setLowConfidenceOnly,
}: {
  className?: string;
  heightClassName: string;
  inspectedLevels: readonly LayoutLevel[];
  lowConfidenceOnly: boolean;
  model: ReturnType<typeof createLayoutBlocksViewerModel>;
  pdfSource: ReturnType<typeof useLayoutPdfSource>;
  setLowConfidenceOnly: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const segmentedViewport = useSegmentedDocumentViewport();
  const itemLink = useSegmentedItemLink();
  const {
    activeItemId,
    clearPreview,
    navigateItem,
    previewItem,
    selectItem,
    selectedItemId,
  } = itemLink;

  const renderPageOverlay = React.useCallback(
    ({ pageNumber, rotation }: { pageNumber: number; rotation: number }) => {
      const page = model.index.pagesByNumber.get(pageNumber);
      if (!page) return null;

      return (
        <LayoutOverlayLayer
          interactive
          activeItemId={activeItemId}
          items={model.visibleItems.filter(
            (item) => item.pageNumber === pageNumber,
          )}
          page={page}
          rotation={rotation}
          selectedItemId={selectedItemId}
          visibleLevels={inspectedLevels}
          onItemClick={(item) => {
            selectItem(item.id);
            navigateItem(item.id, { behavior: "smooth", clearPreview: false });
          }}
          onItemPointerEnter={(item) => previewItem(item.id)}
          onItemPointerLeave={clearPreview}
        />
      );
    },
    [
      activeItemId,
      clearPreview,
      inspectedLevels,
      model.index.pagesByNumber,
      model.visibleItems,
      navigateItem,
      previewItem,
      selectItem,
      selectedItemId,
    ],
  );
  const setPdfViewerHandle = React.useCallback(
    (handle: PdfViewerHandle | null) => {
      segmentedViewport.documentHandlers.setDocumentHandle(handle);
    },
    [segmentedViewport.documentHandlers],
  );

  const level = inspectedLevels[0] ?? "block";

  return (
    <ViewerRoot
      data-layout-blocks=""
      className={cn("bg-background", heightClassName, className)}
      defaultOpen
      sidebarSide="right"
    >
      <ViewerHeader>
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <ViewerSidebarTrigger className="-ml-1" />
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-sm font-medium">OCR</div>
              <div className="text-muted-foreground shrink-0 text-xs">
                {levelCountLabel(level, model.visibleItems.length)}
              </div>
            </div>
          </div>
          <label className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
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
            <FileViewerProvider source={pdfSource.source}>
              <FileViewer className="h-full">
                <PdfViewerProvider>
                  <FileViewerBody>
                    <FileViewerSurface>
                      <FileViewerViewport>
                        <PdfViewerPages
                          ref={setPdfViewerHandle}
                          bare
                          className="h-full"
                          onScrollProgressChange={
                            segmentedViewport.documentHandlers
                              .onScrollProgressChange
                          }
                          onVisiblePageChange={
                            segmentedViewport.documentHandlers
                              .onCurrentPageChange
                          }
                          renderPageOverlay={renderPageOverlay}
                        />
                      </FileViewerViewport>
                    </FileViewerSurface>
                  </FileViewerBody>
                </PdfViewerProvider>
              </FileViewer>
            </FileViewerProvider>
          ) : (
            <div className="bg-muted/20 text-muted-foreground grid h-full place-items-center p-6 text-sm">
              {pdfSource.error ?? "Preparing OCR pages..."}
            </div>
          )}
        </ViewerSurface>
        <ViewerSidebar
          aria-label="OCR blocks"
          width="320px"
          className="bg-background flex min-h-0 shrink-0 flex-col border-l"
        >
          <LayoutBlocksPanel
            activeItemId={activeItemId}
            className="min-h-0 flex-1"
            emptyLabel={
              lowConfidenceOnly
                ? `No low-confidence OCR ${levelPlural(level)} found.`
                : `No OCR ${levelPlural(level)} found.`
            }
            items={model.evidenceItems}
            selectedItemId={selectedItemId}
            onActiveItemIdChange={previewItem}
            onNavigateItem={(item, options) => {
              navigateItem(item.id, {
                behavior: options?.behavior,
                clearPreview: options?.behavior === "auto" ? false : undefined,
              });
            }}
            onSelectedItemIdChange={(itemId) => {
              selectItem(itemId);
            }}
          />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  );
}

function normalizeOcrSource(source: OcrSource): {
  document: LayoutDocument;
  pageImages: ReadonlyMap<number, string>;
} {
  switch (source.provider) {
    case "aws-textract":
      return {
        document: textractToLayoutDocument(source.output),
        pageImages: source.pageImages ?? EMPTY_PAGE_IMAGES,
      };
    case "azure-document-intelligence":
      return {
        document: azureToLayoutDocument(source.output),
        pageImages: source.pageImages ?? EMPTY_PAGE_IMAGES,
      };
    case "google-document-ai":
    default:
      return {
        document: documentAiToLayoutDocument(source.output),
        pageImages: source.pageImages ?? documentAiPageImages(source.output),
      };
  }
}

/** Pick the coarsest level present so the viewer always has rows to inspect. */
function inspectedLevelsForDocument(document: LayoutDocument): LayoutLevel[] {
  for (const level of LEVEL_ORDER) {
    if (document.items.some((item) => item.level === level)) return [level];
  }
  return ["block"];
}

function levelPlural(level: LayoutLevel): string {
  switch (level) {
    case "block":
      return "blocks";
    case "paragraph":
      return "paragraphs";
    case "line":
      return "lines";
    case "word":
      return "words";
  }
}

function levelCountLabel(level: LayoutLevel, count: number): string {
  const plural = levelPlural(level);
  const singular = plural.slice(0, -1);
  return `${count} ${count === 1 ? singular : plural}`;
}

function useLayoutPdfSource(
  document: LayoutDocument,
  pageImages: ReadonlyMap<number, string>,
) {
  const [state, setState] = React.useState<{
    error?: string;
    source?: PdfDocumentSource;
  }>({});

  useKeyedMountEffect(joinEffectKey([document, pageImages]), () => {
    let isCurrent = true;
    setState({});

    layoutDocumentToPdfBlob(document, new Map(pageImages))
      .then((blob) => {
        if (!isCurrent) return;
        setState({
          source: {
            kind: "blob",
            blob,
            fileName: "ocr-pages.pdf",
            identityKey: `ocr-pdf:${document.pages.length}:${pageImages.size}:${blob.size}`,
            mimeType: "application/pdf",
          },
        });
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setState({
          error:
            error instanceof Error
              ? error.message
              : "Failed to prepare OCR pages.",
        });
      });

    return () => {
      isCurrent = false;
    };
  });

  return state;
}

export type {
  LayoutItem,
  LayoutLevel,
  LayoutPage,
} from "./layout-blocks-types";
export type { DocumentAiDocument } from "./layout-blocks-document-ai";
export type { TextractDocument } from "./layout-blocks-textract";
export type { AzureDocument } from "./layout-blocks-azure";
export {
  documentAiPageImages,
  documentAiToLayoutDocument,
} from "./layout-blocks-document-ai";
export { textractToLayoutDocument } from "./layout-blocks-textract";
export { azureToLayoutDocument } from "./layout-blocks-azure";
export { documentAiToPdfBlob } from "./layout-blocks-document-ai-pdf";
export { layoutDocumentToPdfBlob } from "./layout-blocks-pdf";
export { createLayoutItemIndex } from "./layout-blocks-index";
export {
  createLayoutBlocksViewerModel,
  layoutItemToEvidenceItem,
} from "./layout-blocks-model";
export { LayoutBlocksPanel } from "./layout-blocks-panel";
export { LayoutOverlayLayer } from "./layout-overlay-layer";
