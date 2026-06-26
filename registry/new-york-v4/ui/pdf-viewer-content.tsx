"use client";

import * as React from "react";

import {
  clearPdfDocumentResource,
  readPdfDocumentResource,
  readPdfPageResource,
  releasePdfDocumentResource,
  retainPdfDocumentResource,
} from "@/lib/pdf-document-resource";
import { cn } from "@/lib/utils";
import type { ViewerResource } from "@/lib/viewer-resource";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  createPdfPageLayout,
  getPdfPhysicalScrollHeight,
  getPdfRenderedPageWindow,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout";
import { PdfPage } from "./pdf-viewer-page";
import { usePdfPageSizes } from "./pdf-viewer-page-sizes";
import {
  usePdfRenderedPageCache,
  type PdfRenderedPageCache,
} from "./pdf-viewer-render-cache";
import {
  PDF_SCROLLING_PAGE_RENDER_CONCURRENCY,
  usePdfPageRenderScheduler,
} from "./pdf-viewer-render-scheduler";
import {
  getPdfPageDevicePixelRatio,
  useMeasuredElementWidth,
  usePdfScale,
} from "./pdf-viewer-scale";
import { usePdfScroll } from "./pdf-viewer-scroll";
import { PageSkeleton, PdfViewerFallback } from "./pdf-viewer-states";
import type {
  PageOverlayProps,
  PdfPageRenderTiming,
  PdfPageSize,
  PdfViewerHandle,
  PdfViewerPerformanceOptions,
} from "./pdf-viewer-types";
import { usePdfPageVirtualization } from "./pdf-viewer-virtualization";
import { useIsClient } from "./use-is-client";
import {
  useViewerControlsRegistration,
  ViewerControls,
  type ViewerControlsState,
} from "./viewer-controls";
import { ViewerErrorBoundary } from "./viewer-error";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type PdfViewerContentProps = {
  className?: string;
  /** Controlled rendered scale; when omitted the viewer fits page width until manually zoomed. */
  scale?: number;
  /** Initial uncontrolled scale. Leave unset for fit-to-width. */
  defaultScale?: number;
  /** Called when controls request a scale change. `null` means fit width. */
  onScaleChange?: (scale: number | null) => void;
  controls?: boolean;
  /** Show download actions in this viewer's controls/error state. */
  download?: boolean;
  /** Render absolutely-positioned overlays (e.g. bbox citations) on each page. */
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode;
  /** Fired with the 1-based page nearest the top of the viewport as you scroll. */
  onVisiblePageChange?: (page: number) => void;
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void;
  /** Reports page render work for profiling and benchmark surfaces. */
  onPageRenderTiming?: (timing: PdfPageRenderTiming) => void;
  /** Retained for callers that still pass benchmark switches; the simple renderer ignores them. */
  performanceOptions?: PdfViewerPerformanceOptions;
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean;
};

export type PdfResourceContentProps = PdfViewerContentProps & {
  resource: ViewerResource;
};

type PdfDocument = ReturnType<typeof readPdfDocumentResource>;
type PdfDocumentContent = ViewerResource["content"];
type PdfPageSizeSetter = ReturnType<typeof usePdfPageSizes>["setPageSize"];

export const PdfResourceContent = React.forwardRef<
  PdfViewerHandle,
  PdfResourceContentProps
>(function PdfResourceContent(props, ref) {
  const resource = props.resource;
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <PdfViewerFallback
        className={props.className}
        bare={props.bare}
        controls={props.controls}
      />
    );
  }

  return (
    <ViewerErrorBoundary
      className={props.className}
      download={
        props.controls === false || props.download === false
          ? null
          : resource.originalDownload
      }
      format="pdf"
      onRetry={() => clearPdfDocumentResource(resource.content)}
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <PdfViewerFallback
            className={props.className}
            bare={props.bare}
            controls={props.controls}
          />
        }
      >
        <PdfViewerInner {...props} forwardedRef={ref} resource={resource} />
      </React.Suspense>
    </ViewerErrorBoundary>
  );
});

function PdfViewerInner({
  resource,
  className,
  scale: controlledScale,
  defaultScale,
  onScaleChange,
  controls = true,
  download = true,
  renderPageOverlay,
  onVisiblePageChange,
  onScrollProgressChange,
  onPageRenderTiming,
  performanceOptions,
  bare = false,
  forwardedRef,
}: PdfResourceContentProps & {
  forwardedRef?: React.ForwardedRef<PdfViewerHandle>;
}) {
  const content = resource.content;
  const document = readPdfDocumentResource(content);
  usePdfDocumentResourceLifecycle(content, document);

  const firstPageSize = usePdfFirstPageSize(document);
  const { ref: containerRef, width: containerWidth } =
    useMeasuredElementWidth();
  const { rotation, rotateClockwise } = usePdfDocumentRotation(document);
  const fitPageWidth =
    rotation % 180 === 0 ? firstPageSize.width : firstPageSize.height;
  const { resolvedScale, zoomIn, zoomOut, fitWidth } = usePdfScale({
    controlledScale,
    defaultScale,
    onScaleChange,
    containerWidth,
    pageWidth: fitPageWidth,
    resetKey: document,
  });

  const { pageSizeByNumber, setPageSize } = usePdfPageSizes(document);
  const pageLayout = React.useMemo(
    () =>
      createPdfPageLayout({
        pageCount: document.numPages,
        defaultPageSize: firstPageSize,
        pageSizeByNumber,
        scale: resolvedScale,
        rotation,
      }),
    [
      document.numPages,
      firstPageSize,
      pageSizeByNumber,
      resolvedScale,
      rotation,
    ],
  );
  const {
    currentPage,
    viewportElement,
    setViewportElement,
    measureScroll,
    handleScroll,
    scrollToPage,
    scrollToPageArea,
    getViewportElement,
    getScrollMetrics,
  } = usePdfScroll({
    pageCount: document.numPages,
    layout: pageLayout,
    resetKey: document,
    onVisiblePageChange,
    onScrollProgressChange,
  });
  const {
    scrollPageOffset,
    visiblePageNumbers,
    renderPageNumbers,
    preloadPageNumbers,
    measureVisiblePages,
  } = usePdfPageVirtualization({
    getScrollMetrics,
    layout: pageLayout,
    resetKey: document,
    viewportElement,
  });
  const pageDevicePixelRatio = getPdfPageDevicePixelRatio({
    devicePixelRatio:
      (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1,
    mode: "settled",
  });
  const renderedPageCache = usePdfRenderedPageCache(document);
  const shouldUseRenderedPageCache =
    performanceOptions?.renderedPageCache !== false;
  const {
    activePageNumbers: activeRenderPageNumbers,
    onPageRenderTiming: handleScheduledPageRenderTiming,
  } = usePdfPageRenderScheduler({
    pageNumbers: visiblePageNumbers,
    lowPriorityPageNumbers:
      performanceOptions?.directionAwarePreRender === false
        ? []
        : [...renderPageNumbers, ...preloadPageNumbers],
    scale: resolvedScale,
    rotation,
    devicePixelRatio: pageDevicePixelRatio,
    resetKey: document,
    maxRunning: PDF_SCROLLING_PAGE_RENDER_CONCURRENCY,
    maxLowPriorityRunning:
      performanceOptions?.directionAwarePreRender === false ? 0 : 1,
  });
  const handlePageRenderTiming = React.useCallback(
    (timing: PdfPageRenderTiming) => {
      handleScheduledPageRenderTiming(timing);
      onPageRenderTiming?.(timing);
    },
    [handleScheduledPageRenderTiming, onPageRenderTiming],
  );
  const scrollInteractionRestoreRef = React.useRef<number | null>(null);
  const scrollInteractionElementRef = React.useRef<HTMLElement | null>(null);

  usePdfDocumentControlsRegistration({
    currentPage,
    document,
    download,
    downloadAction: resource.originalDownload,
    fitWidth,
    resolvedScale,
    rotateClockwise,
    zoomIn,
    zoomOut,
  });

  useKeyedMountEffect(
    joinEffectKey([
      document.numPages,
      measureScroll,
      rotation,
      resolvedScale,
      viewportElement,
    ]),
    () => {
      measureScroll();
    },
  );

  const suspendScrollInteractions = React.useCallback(() => {
    const scrollElement = viewportElement?.querySelector<HTMLElement>(
      '[data-slot="pdf-page-sticky-window"]',
    );
    if (!scrollElement) return;

    if (scrollInteractionRestoreRef.current !== null) {
      window.clearTimeout(scrollInteractionRestoreRef.current);
    }
    scrollInteractionElementRef.current = scrollElement;
    scrollElement.style.pointerEvents = "none";
    if (isMobileSafari()) {
      scrollElement.style.overflowX = "hidden";
    }
    scrollInteractionRestoreRef.current = window.setTimeout(() => {
      scrollInteractionRestoreRef.current = null;
      restorePdfScrollInteractions(scrollInteractionElementRef.current);
      scrollInteractionElementRef.current = null;
    }, 120);
  }, [viewportElement]);

  useMountEffect(() => () => {
    if (scrollInteractionRestoreRef.current !== null) {
      window.clearTimeout(scrollInteractionRestoreRef.current);
      scrollInteractionRestoreRef.current = null;
    }
    restorePdfScrollInteractions(scrollInteractionElementRef.current);
    scrollInteractionElementRef.current = null;
  });

  const handleViewportScroll = React.useCallback(() => {
    suspendScrollInteractions();
    handleScroll();
    measureVisiblePages();
  }, [handleScroll, measureVisiblePages, suspendScrollInteractions]);

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToPage,
      scrollToPageArea,
      getViewportElement,
    }),
    [getViewportElement, scrollToPage, scrollToPageArea],
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "bg-muted/20 h-full" : "bg-muted/30 rounded-xl border",
        className,
      )}
      data-slot="pdf-viewer"
    >
      {controls ? (
        <ViewerControls
          position={{
            kind: "page",
            current: currentPage,
            total: document.numPages,
          }}
          zoom={{
            scale: resolvedScale,
            onZoomOut: zoomOut,
            onZoomIn: zoomIn,
            onFit: fitWidth,
          }}
          rotate={{ onRotate: rotateClockwise }}
          downloads={download ? [resource.originalDownload] : []}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <ScrollArea
              className="min-h-0 flex-1"
              viewportRef={setViewportElement}
              viewportProps={{
                onScroll: handleViewportScroll,
                style: { overflowAnchor: "none" },
              }}
            >
              <PdfDocumentPagesLayer
                containerRef={containerRef}
                document={document}
                documentKey={content.key}
                layout={pageLayout}
                physicalScrollHeight={getPdfPhysicalScrollHeight({
                  totalHeight: pageLayout.totalHeight,
                  viewportHeight: viewportElement?.clientHeight ?? 0,
                })}
                activeRenderPageNumbers={activeRenderPageNumbers}
                renderPageNumbers={renderPageNumbers}
                renderCache={
                  shouldUseRenderedPageCache ? renderedPageCache : undefined
                }
                scrollPageOffset={scrollPageOffset}
                visiblePageNumbers={visiblePageNumbers}
                viewportHeight={viewportElement?.clientHeight ?? 0}
                renderPageOverlay={renderPageOverlay}
                rotation={rotation}
                scale={resolvedScale}
                devicePixelRatio={pageDevicePixelRatio}
                onPageRenderTiming={handlePageRenderTiming}
                setPageSize={setPageSize}
              />
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}

function restorePdfScrollInteractions(element: HTMLElement | null) {
  if (!element) return;
  element.style.removeProperty("pointer-events");
  element.style.removeProperty("overflow-x");
}

function isMobileSafari() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  return (
    /Safari/i.test(userAgent) &&
    /Mobile/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS/i.test(userAgent)
  );
}

function usePdfDocumentResourceLifecycle(
  content: PdfDocumentContent,
  document: PdfDocument,
) {
  useKeyedMountEffect(joinEffectKey([content, document]), () => {
    retainPdfDocumentResource(content, document);
    return () => releasePdfDocumentResource(content, document);
  });
}

function usePdfFirstPageSize(document: PdfDocument): PdfPageSize {
  const firstPage = readPdfPageResource(document, 1);

  return React.useMemo<PdfPageSize>(() => {
    const viewport = firstPage.getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  }, [firstPage]);
}

function usePdfDocumentRotation(document: PdfDocument) {
  const [rotationState, setRotationState] = React.useState<{
    document: PdfDocument;
    value: number;
  }>(() => ({ document, value: 0 }));
  const rotation = Object.is(rotationState.document, document)
    ? rotationState.value
    : 0;
  const rotateClockwise = React.useCallback(() => {
    setRotationState((state) => ({
      document,
      value:
        ((Object.is(state.document, document) ? state.value : 0) + 90) % 360,
    }));
  }, [document]);

  return { rotation, rotateClockwise };
}

function usePdfDocumentControlsRegistration({
  currentPage,
  document,
  download,
  downloadAction,
  fitWidth,
  resolvedScale,
  rotateClockwise,
  zoomIn,
  zoomOut,
}: {
  currentPage: number;
  document: PdfDocument;
  download: boolean;
  downloadAction: ViewerResource["originalDownload"];
  fitWidth: () => void;
  resolvedScale: number;
  rotateClockwise: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}) {
  const onControlsChange = useViewerControlsRegistration();
  const controlsState = React.useMemo<ViewerControlsState>(
    () => ({
      position: {
        kind: "page",
        current: currentPage,
        total: document.numPages,
      },
      zoom: {
        scale: resolvedScale,
        onZoomOut: zoomOut,
        onZoomIn: zoomIn,
        onFit: fitWidth,
      },
      rotate: { onRotate: rotateClockwise },
      downloads: download ? [downloadAction] : [],
    }),
    [
      currentPage,
      document.numPages,
      download,
      downloadAction,
      fitWidth,
      resolvedScale,
      rotateClockwise,
      zoomIn,
      zoomOut,
    ],
  );

  useKeyedMountEffect(joinEffectKey([onControlsChange, controlsState]), () => {
    if (!onControlsChange) return;
    onControlsChange(controlsState);
    return () => onControlsChange(null);
  });
}

type PdfDocumentPagesLayerProps = {
  containerRef: React.RefCallback<HTMLDivElement>;
  document: PdfDocument;
  documentKey: string;
  layout: PdfPageLayoutModel;
  physicalScrollHeight: number;
  activeRenderPageNumbers: readonly number[];
  renderPageNumbers: readonly number[];
  renderCache?: PdfRenderedPageCache;
  scrollPageOffset: number;
  visiblePageNumbers: readonly number[];
  viewportHeight: number;
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode;
  rotation: number;
  scale: number;
  devicePixelRatio: number;
  onPageRenderTiming?: (timing: PdfPageRenderTiming) => void;
  setPageSize: PdfPageSizeSetter;
};

function PdfDocumentPagesLayer({
  containerRef,
  document,
  documentKey,
  layout,
  physicalScrollHeight,
  activeRenderPageNumbers,
  renderPageNumbers,
  renderCache,
  scrollPageOffset,
  visiblePageNumbers,
  viewportHeight,
  renderPageOverlay,
  rotation,
  scale,
  devicePixelRatio,
  onPageRenderTiming,
  setPageSize,
}: PdfDocumentPagesLayerProps) {
  const visiblePageNumberSet = React.useMemo(
    () => new Set(visiblePageNumbers),
    [visiblePageNumbers],
  );
  const activeRenderPageNumberSet = React.useMemo(
    () => new Set(activeRenderPageNumbers),
    [activeRenderPageNumbers],
  );
  const renderedWindow = React.useMemo(
    () =>
      getPdfRenderedPageWindow({
        layout,
        pageNumbers: renderPageNumbers,
        physicalScrollHeight,
        scrollPageOffset,
        viewportHeight,
      }),
    [
      layout,
      physicalScrollHeight,
      renderPageNumbers,
      scrollPageOffset,
      viewportHeight,
    ],
  );

  return (
    <div
      ref={containerRef}
      data-slot="pdf-viewer-fit-width-measure"
      className="relative min-w-0"
    >
      <div
        data-slot="pdf-viewer-document"
        className="relative mx-auto"
        style={{
          contain: "layout style",
          height: physicalScrollHeight,
          minWidth: layout.maxPageWidth,
        }}
      >
        {renderedWindow ? (
          <>
            <div
              aria-hidden
              data-slot="pdf-page-window-before"
              style={{
                contain: "layout size",
                height: renderedWindow.beforeHeight,
              }}
            />
            <div
              data-slot="pdf-page-sticky-window"
              className="sticky"
              style={{
                bottom: renderedWindow.stickyInset,
                contain: "layout style inline-size",
                height: renderedWindow.height,
                isolation: "isolate",
                top: renderedWindow.stickyInset,
              }}
            >
              <div
                data-slot="pdf-page-window"
                className="relative"
                style={{
                  contain: "layout style",
                  height: renderedWindow.height,
                }}
              >
                {renderedWindow.pages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
                    data-slot="pdf-page-slot"
                    data-page-number={page.pageNumber}
                    data-visible={
                      visiblePageNumberSet.has(page.pageNumber) ? "" : undefined
                    }
                    style={{
                      top: page.windowTop,
                      width: page.width,
                      minHeight: page.height,
                    }}
                  >
                    {activeRenderPageNumberSet.has(page.pageNumber) ? (
                      <React.Suspense fallback={<PageSkeleton />}>
                        <PdfPage
                          document={document}
                          documentKey={documentKey}
                          pageNumber={page.pageNumber}
                          scale={scale}
                          rotation={rotation}
                          devicePixelRatio={devicePixelRatio}
                          renderCache={renderCache}
                          renderOverlay={renderPageOverlay}
                          onRenderTiming={onPageRenderTiming}
                          onSize={setPageSize}
                        />
                      </React.Suspense>
                    ) : (
                      <PageSkeleton />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div
              aria-hidden
              data-slot="pdf-page-window-after"
              style={{
                contain: "layout size",
                height: renderedWindow.afterHeight,
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
