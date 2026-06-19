"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";
import { createRoot, type Root } from "react-dom/client";

import { useElementWidth } from "@/hooks/use-element-width";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createPageMarkdownLayout,
  createPageMeasurementKey,
  findPageMarkdownPageByOffset,
  getPageMarkdownPageLayout,
  getPageMarkdownVisiblePageNumbers,
} from "@/components/viewers/page-markdown/page-markdown-layout";
import {
  usePageMarkdownMeasurements,
  usePageMarkdownScrollAnchor,
} from "@/components/viewers/page-markdown/page-markdown-measurements";
import { PageMarkdownPageFrame } from "@/components/viewers/page-markdown/page-markdown-page-frame";
import { usePageMarkdownScroll } from "@/components/viewers/page-markdown/page-markdown-scroll";
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types";

export interface PageMarkdownPaneHandle {
  scrollToPage: (pageNumber: number, options?: ScrollToOptions) => void;
}

export const PageMarkdownPane = React.forwardRef<
  PageMarkdownPaneHandle,
  {
    pages: string[];
    text: string;
    mode: PageMarkdownViewMode;
    scale: number;
    isScaleReady: boolean;
    resetKey?: string;
    onContainerWidthChange: (width: number | null) => void;
    onVisiblePageChange: (pageNumber: number) => void;
  }
>(function PageMarkdownPane(
  {
    pages,
    text,
    mode,
    scale,
    isScaleReady,
    resetKey,
    onContainerWidthChange,
    onVisiblePageChange,
  },
  ref,
) {
  const [viewportWidthRef, viewportWidth] = useElementWidth();
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const projectionFrameRef = React.useRef<number | null>(null);
  const projectPagesRef = React.useRef<() => void>(() => {});
  const projectionCacheRef = React.useRef<PageMarkdownProjectionCache>({
    resetKey: null,
    slots: new Map(),
  });
  const pagesSignature = React.useMemo(
    () => `${resetKey ?? ""}\u0000${pages.join("\u0000")}`,
    [pages, resetKey],
  );
  const pageRenderKeys = React.useMemo(
    () =>
      pages.map((markdown) =>
        createPageMeasurementKey({
          markdown,
          mode,
          scale,
        }),
      ),
    [mode, pages, scale],
  );
  const { measuredHeightByPageNumber, setPageHeight } =
    usePageMarkdownMeasurements({ mode, pages, scale });
  const layout = React.useMemo(
    () =>
      createPageMarkdownLayout({
        measuredHeightByPageNumber,
        mode,
        pages,
        scale,
      }),
    [measuredHeightByPageNumber, mode, pages, scale],
  );
  const {
    handleScroll,
    measureScroll,
    scrollToPage,
    getViewportElement,
    setViewportElement,
    viewportElement,
  } = usePageMarkdownScroll({
    layout,
    onVisiblePageChange,
    pageCount: pages.length,
    resetKey: pagesSignature,
  });

  React.useLayoutEffect(() => {
    onContainerWidthChange(viewportWidth);
  }, [onContainerWidthChange, viewportWidth]);

  const { captureScrollAnchor } = usePageMarkdownScrollAnchor({
    layout,
    onRestore: () => projectPagesRef.current(),
    viewportElement,
  });
  const captureScrollAnchorBeforePageResize = React.useCallback(
    (pageNumber: number) => {
      const viewportElement = getViewportElement();
      if (!viewportElement) return;

      const anchorPageNumber = findPageMarkdownPageByOffset(
        layout,
        viewportElement.scrollTop,
      );
      if (pageNumber < anchorPageNumber) captureScrollAnchor();
    },
    [captureScrollAnchor, getViewportElement, layout],
  );
  const handlePageSize = React.useCallback(
    (pageNumber: number, height: number) => {
      setPageHeight(pageNumber, height, () =>
        captureScrollAnchorBeforePageResize(pageNumber),
      );
    },
    [captureScrollAnchorBeforePageResize, setPageHeight],
  );

  const projectPages = React.useCallback(() => {
    projectionFrameRef.current = null;
    projectPageMarkdownPages({
      cache: projectionCacheRef.current,
      canvas: canvasRef.current,
      layout,
      mode,
      onSize: handlePageSize,
      pageRenderKeys,
      pages,
      resetKey: pagesSignature,
      scale,
      viewportElement: getViewportElement(),
    });
  }, [
    getViewportElement,
    handlePageSize,
    layout,
    mode,
    pages,
    pageRenderKeys,
    pagesSignature,
    scale,
  ]);
  React.useLayoutEffect(() => {
    projectPagesRef.current = projectPages;
  }, [projectPages]);

  const schedulePageProjection = React.useCallback(() => {
    if (projectionFrameRef.current !== null) return;
    if (typeof requestAnimationFrame !== "function") {
      projectPages();
      return;
    }
    projectionFrameRef.current = requestAnimationFrame(projectPages);
  }, [projectPages]);

  React.useImperativeHandle(
    ref ?? null,
    () => ({
      scrollToPage: (pageNumber, options) => {
        scrollToPage(pageNumber, options);
        measureScroll();
        projectPages();
      },
    }),
    [measureScroll, projectPages, scrollToPage],
  );

  React.useLayoutEffect(() => {
    projectPages();
  }, [projectPages, viewportElement]);

  React.useEffect(
    () => () => {
      if (
        projectionFrameRef.current !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(projectionFrameRef.current);
      }
      disposePageMarkdownProjectionCache(projectionCacheRef.current);
    },
    [],
  );

  const handleViewportScroll = React.useCallback(() => {
    handleScroll();
    schedulePageProjection();
  }, [handleScroll, schedulePageProjection]);

  const handleViewportKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const viewportElement = event.currentTarget;
      const maxScrollTop = Math.max(
        0,
        viewportElement.scrollHeight - viewportElement.clientHeight,
      );
      let nextScrollTop: number | null = null;

      switch (event.key) {
        case "ArrowDown":
          nextScrollTop = viewportElement.scrollTop + 40;
          break;
        case "ArrowUp":
          nextScrollTop = viewportElement.scrollTop - 40;
          break;
        case "PageDown":
          nextScrollTop =
            viewportElement.scrollTop + viewportElement.clientHeight * 0.85;
          break;
        case "PageUp":
          nextScrollTop =
            viewportElement.scrollTop - viewportElement.clientHeight * 0.85;
          break;
        case "Home":
          nextScrollTop = 0;
          break;
        case "End":
          nextScrollTop = maxScrollTop;
          break;
        default:
          return;
      }

      event.preventDefault();
      viewportElement.scrollTop = Math.min(
        maxScrollTop,
        Math.max(0, nextScrollTop),
      );
      measureScroll();
      projectPages();
    },
    [measureScroll, projectPages],
  );

  if (!isScaleReady) {
    return (
      <div className="bg-muted/20 flex h-full min-h-0 min-w-0 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <div ref={viewportWidthRef} className="h-full w-full min-w-0" />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 flex h-full min-h-0 min-w-0 flex-col">
      <ScrollArea
        nativeScrollbar
        viewportRef={setViewportElement}
        viewportProps={{
          "aria-label": "Markdown pages",
          onKeyDown: handleViewportKeyDown,
          onScroll: handleViewportScroll,
          tabIndex: 0,
        }}
        className="min-h-0 flex-1"
      >
        <div ref={viewportWidthRef} className="w-full min-w-0">
          <div
            ref={canvasRef}
            className="relative mx-auto"
            style={{
              height: layout.totalHeight,
              minWidth: layout.width,
            }}
          />
        </div>
      </ScrollArea>
    </div>
  );
});

type PageMarkdownProjectionCache = {
  resetKey: unknown;
  slots: Map<number, PageMarkdownProjectedSlot>;
};

type PageMarkdownProjectedSlot = {
  renderKey: string;
  root: Root;
  slot: HTMLElement;
};

function projectPageMarkdownPages({
  cache,
  canvas,
  layout,
  mode,
  onSize,
  pageRenderKeys,
  pages,
  resetKey,
  scale,
  viewportElement,
}: {
  cache: PageMarkdownProjectionCache;
  canvas: HTMLDivElement | null;
  layout: ReturnType<typeof createPageMarkdownLayout>;
  mode: PageMarkdownViewMode;
  onSize: (pageNumber: number, height: number) => void;
  pageRenderKeys: readonly string[];
  pages: readonly string[];
  resetKey: unknown;
  scale: number;
  viewportElement: HTMLDivElement | null;
}) {
  if (!canvas) return;

  canvas.style.height = `${layout.totalHeight}px`;
  canvas.style.minWidth = `${layout.width}px`;

  if (!Object.is(cache.resetKey, resetKey)) {
    disposePageMarkdownProjectionCache(cache);
    cache.resetKey = resetKey;
  }

  const visiblePageNumbers = getPageMarkdownVisiblePageNumbers({
    layout,
    scrollTop: viewportElement?.scrollTop ?? 0,
    viewportHeight: getPageMarkdownViewportHeight(viewportElement),
  });
  const visiblePageNumberSet = new Set(visiblePageNumbers);

  for (const [pageNumber, projectedSlot] of cache.slots) {
    if (visiblePageNumberSet.has(pageNumber)) continue;
    disposePageMarkdownProjectedSlot(projectedSlot);
    cache.slots.delete(pageNumber);
  }

  for (const pageNumber of visiblePageNumbers) {
    const pageLayout = getPageMarkdownPageLayout(layout, pageNumber);
    const markdown = pages[pageNumber - 1];
    const pageRenderKey = pageRenderKeys[pageNumber - 1];
    if (!pageLayout || markdown == null) continue;

    const projectedSlot =
      cache.slots.get(pageNumber) ??
      createPageMarkdownProjectedSlot(pageNumber);
    patchPageMarkdownProjectedSlot(projectedSlot.slot, pageLayout);
    renderPageMarkdownProjectedSlot({
      markdown,
      mode,
      onSize,
      pageLayout,
      pageNumber,
      pageRenderKey,
      projectedSlot,
      scale,
    });
    cache.slots.set(pageNumber, projectedSlot);
    canvas.append(projectedSlot.slot);
  }
}

function createPageMarkdownProjectedSlot(pageNumber: number) {
  const slot = document.createElement("div");
  slot.dataset.pageNumber = String(pageNumber);
  slot.dataset.slot = "page-markdown-page-slot";
  slot.className = "absolute left-1/2 -translate-x-1/2";
  return {
    renderKey: "",
    root: createRoot(slot),
    slot,
  };
}

function patchPageMarkdownProjectedSlot(
  slot: HTMLElement,
  pageLayout: NonNullable<ReturnType<typeof getPageMarkdownPageLayout>>,
) {
  slot.style.top = `${pageLayout.offsetTop}px`;
  slot.style.width = `${pageLayout.width}px`;
  slot.style.minHeight = `${pageLayout.height}px`;
}

function renderPageMarkdownProjectedSlot({
  markdown,
  mode,
  onSize,
  pageLayout,
  pageNumber,
  pageRenderKey,
  projectedSlot,
  scale,
}: {
  markdown: string;
  mode: PageMarkdownViewMode;
  onSize: (pageNumber: number, height: number) => void;
  pageLayout: NonNullable<ReturnType<typeof getPageMarkdownPageLayout>>;
  pageNumber: number;
  pageRenderKey?: string;
  projectedSlot: PageMarkdownProjectedSlot;
  scale: number;
}) {
  const renderKey = [
    pageNumber,
    mode,
    scale,
    pageLayout.height,
    pageLayout.width,
    pageRenderKey ?? markdown,
  ].join("\u0000");
  if (projectedSlot.renderKey === renderKey) return;

  projectedSlot.renderKey = renderKey;
  projectedSlot.root.render(
    <PageMarkdownPageFrame
      estimatedHeight={pageLayout.height}
      markdown={markdown}
      mode={mode}
      onSize={onSize}
      pageNumber={pageNumber}
      scale={scale}
    />,
  );
}

function getPageMarkdownViewportHeight(viewportElement: HTMLElement | null) {
  return (
    viewportElement?.clientHeight ||
    viewportElement?.getBoundingClientRect().height ||
    0
  );
}

function disposePageMarkdownProjectionCache(
  cache: PageMarkdownProjectionCache,
) {
  for (const projectedSlot of cache.slots.values()) {
    disposePageMarkdownProjectedSlot(projectedSlot);
  }
  cache.slots.clear();
}

function disposePageMarkdownProjectedSlot(
  projectedSlot: PageMarkdownProjectedSlot,
) {
  deferPageMarkdownRootUnmount(projectedSlot.root);
  projectedSlot.slot.remove();
}

function deferPageMarkdownRootUnmount(root: Root) {
  const unmount = () => root.unmount();
  if (typeof queueMicrotask === "function") {
    queueMicrotask(unmount);
    return;
  }
  window.setTimeout(unmount, 0);
}
