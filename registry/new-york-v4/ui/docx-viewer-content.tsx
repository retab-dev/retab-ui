"use client";

import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { getDocxDocumentResource } from "@/lib/docx-document-resource";
import { isAbortError, isResourceError } from "@/lib/viewer-errors";
import { ScrollArea } from "@/components/ui/scroll-area";

import { FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT } from "./file-viewer-elements";
import {
  resolveFileViewerRendererLayoutInlineSize,
  type FileViewerDocumentAlign,
} from "./file-viewer-renderer-contract";
import {
  useOptionalFileViewerRendererEnvironment,
  useOptionalFileViewerRendererFrame,
} from "./file-viewer-renderer-frame";
import {
  DocxSkeleton,
  DocxViewerBody,
  DocxViewerFrame,
} from "./docx-viewer-chrome";
import { DOCX_SCOPED_STYLES, toDocxFormatError } from "./docx-viewer-core";
import { useDocxHighlight } from "./docx-viewer-highlight";
import {
  createDocxPageWindowForPage,
  createDocxPageWindowFromScroll,
  type DocxPageLayout,
} from "./docx-viewer-layout";
import {
  commitDocxRender,
  projectDocxPages,
  loadDocxPreview,
  renderCachedDocxPreview,
  type DocxRenderedDocument,
} from "./docx-viewer-render";
import { useDocxViewerScale } from "./docx-viewer-scale";
import { useDocxViewerScroll } from "./docx-viewer-scroll";
import {
  buildDocxRenderIndex,
  resolveDocxTargetHit,
  type DocxRenderIndex,
} from "./docx-viewer-targets";
import type {
  DocxResourceContentProps,
  DocxViewerHandle,
} from "./docx-viewer-types";
import {
  useViewerControlsRegistration,
  ViewerControls,
  ViewerControlsSkeleton,
  type ViewerControlsState,
} from "./viewer-controls";
import { joinEffectKey } from "@/lib/effect-key";

const DOCX_TRANSITION_WINDOW_RELEASE_MS = 260;

export function DocxViewerContent({
  bare = false,
  className,
  defaultScale,
  download = true,
  forwardedRef,
  highlight,
  onScaleChange,
  onScrollProgressChange,
  onVisiblePageChange,
  resource,
  scale: controlledScale,
  controls = true,
}: DocxResourceContentProps & {
  forwardedRef?: React.ForwardedRef<DocxViewerHandle>;
}) {
  const docxPreviewPromise = loadDocxPreview();
  void docxPreviewPromise.catch(() => undefined);
  const buffer = React.use(
    getDocxDocumentResource(resource.content, { retainRejected: true }),
  );
  const renderCacheKey = resource.content.key;
  const { registerDocumentSurface, usesShellGeometry } =
    useOptionalFileViewerRendererEnvironment();
  const { containerRef, containerWidth } = useMeasuredDocxContainerInlineSize({
    enabled: !usesShellGeometry,
  });
  const rendererFrame = useOptionalFileViewerRendererFrame({
    fallbackInlineSize: containerWidth,
  });
  const layoutInlineSize = resolveFileViewerRendererLayoutInlineSize({
    fallbackInlineSize: containerWidth,
    rendererFrame,
  });
  const [numPages, setNumPages] = React.useState(0);
  const [pageWidth, setPageWidth] = React.useState<number | null>(null);
  const [renderIndex, setRenderIndex] = React.useState<DocxRenderIndex | null>(
    null,
  );
  const [pageLayout, setPageLayout] = React.useState<DocxPageLayout | null>(
    null,
  );
  const [ready, setReady] = React.useState(false);
  const [renderError, setRenderError] = React.useState<Error | null>(null);
  if (renderError) throw renderError;

  const { fitWidth, scale, zoomIn, zoomOut } = useDocxViewerScale({
    defaultScale,
    layoutInlineSize,
    onScaleChange,
    pageWidth,
    resetKey: resource.keys.resource,
    scale: controlledScale,
  });
  const {
    currentPage,
    handleScroll,
    measureScroll,
    resetScroll,
    scrollViewportRef,
  } = useDocxViewerScroll({
    layoutKey: scale,
    pageLayout,
    onScrollProgressChange,
    onVisiblePageChange,
    ready,
    scale,
  });
  const isDocumentTransitioning = rendererFrame.phase !== "idle";
  const scaleRef = React.useRef(scale);
  scaleRef.current = scale;

  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const renderIndexRef = React.useRef<DocxRenderIndex | null>(null);
  const virtualDocumentRef = React.useRef<DocxRenderedDocument | null>(null);
  const projectVisiblePagesRef = React.useRef<() => void>(() => {});
  const measureScrollRef = React.useRef(measureScroll);
  measureScrollRef.current = measureScroll;
  const transitionWindowReleaseTimerRef = React.useRef<number | null>(null);
  const shouldReleaseTransitionProjectionRef = React.useRef(false);
  const projectVisiblePages = React.useCallback(() => {
    const virtualDocument = virtualDocumentRef.current;
    const viewport = scrollViewportRef.current;
    if (!virtualDocument || !viewport) return;
    projectDocxPages(
      virtualDocument,
      createDocxPageWindowFromScroll({
        layout: virtualDocument.pageLayout,
        scale: scaleRef.current,
        scrollTop: viewport.scrollTop,
        viewportHeight: viewport.clientHeight,
      }),
    );
  }, [scrollViewportRef]);
  useKeyedLayoutEffect(joinEffectKey([projectVisiblePages]), () => {
    projectVisiblePagesRef.current = projectVisiblePages;
  });
  const clearTransitionWindowReleaseTimer = React.useCallback(() => {
    if (transitionWindowReleaseTimerRef.current === null) return;
    window.clearTimeout(transitionWindowReleaseTimerRef.current);
    transitionWindowReleaseTimerRef.current = null;
  }, []);
  const projectTargetPage = React.useCallback(
    (pageNumber: number) => {
      const virtualDocument = virtualDocumentRef.current;
      const viewport = scrollViewportRef.current;
      if (!virtualDocument || !viewport) return;
      projectDocxPages(
        virtualDocument,
        createDocxPageWindowForPage({
          layout: virtualDocument.pageLayout,
          pageIndex: pageNumber - 1,
          scale: scaleRef.current,
          viewportHeight: viewport.clientHeight,
        }),
      );
    },
    [scrollViewportRef],
  );
  const handleViewportScroll = React.useCallback(() => {
    if (!isDocumentTransitioning) projectVisiblePages();
    handleScroll();
  }, [handleScroll, isDocumentTransitioning, projectVisiblePages]);
  const measureBeforeLayoutMotionRef = React.useRef(measureScroll);
  measureBeforeLayoutMotionRef.current = measureScroll;
  const handleBeforeLayoutMotion = React.useCallback(() => {
    measureBeforeLayoutMotionRef.current();
  }, []);
  // The docx surface re-fits by tracking the live animating frame width, so it
  // needs no motion resolver — the kernel's identity default is correct (a FLIP
  // scale on top would double-count the width change and overshoot).
  const surfaceCleanupRef = React.useRef<(() => void) | null>(null);
  const setHostElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      const previousElement = hostRef.current;
      if (previousElement === element) return;
      previousElement?.removeEventListener(
        FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
        handleBeforeLayoutMotion,
      );
      surfaceCleanupRef.current?.();
      surfaceCleanupRef.current = null;
      hostRef.current = element;
      if (!element) return;
      surfaceCleanupRef.current = registerDocumentSurface({ element });
      element.addEventListener(
        FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
        handleBeforeLayoutMotion,
      );
    },
    [handleBeforeLayoutMotion, registerDocumentSurface],
  );

  useKeyedLayoutEffect(
    joinEffectKey(["docx-transition", isDocumentTransitioning, ready]),
    () => {
      clearTransitionWindowReleaseTimer();
      if (!ready) return;

      if (isDocumentTransitioning) {
        shouldReleaseTransitionProjectionRef.current = true;
        return;
      }

      if (!shouldReleaseTransitionProjectionRef.current) return;
      transitionWindowReleaseTimerRef.current = window.setTimeout(() => {
        transitionWindowReleaseTimerRef.current = null;
        shouldReleaseTransitionProjectionRef.current = false;
        projectVisiblePagesRef.current();
        measureScrollRef.current();
      }, DOCX_TRANSITION_WINDOW_RELEASE_MS);
    },
  );

  useKeyedMountEffect(
    joinEffectKey([
      "docx-render",
      buffer,
      docxPreviewPromise,
      renderCacheKey,
      resetScroll,
    ]),
    () => {
      const host = hostRef.current;
      if (!host) return;
      let cancelled = false;
      setReady(false);
      setNumPages(0);
      setRenderIndex(null);
      setPageLayout(null);
      renderIndexRef.current = null;
      virtualDocumentRef.current = null;
      resetScroll();
      host.replaceChildren();
      renderCachedDocxPreview({
        buffer,
        cacheKey: renderCacheKey,
        docxPreviewPromise,
        getScale: () => scaleRef.current,
      })
        .then(({ pageSizes, renderHost }) => {
          if (cancelled) return;
          const result = commitDocxRender({
            host,
            pageSizes,
            renderHost,
            scale: scaleRef.current,
          });
          virtualDocumentRef.current = result.virtualDocument;
          projectVisiblePages();
          const nextRenderIndex = buildDocxRenderIndex(
            host,
            result.virtualDocument.pages,
          );
          renderIndexRef.current = nextRenderIndex;
          setRenderIndex(nextRenderIndex);
          setNumPages(result.numPages);
          setPageWidth(result.pageWidth);
          setPageLayout(result.pageLayout);
          setReady(true);
        })
        .catch((err) => {
          if (!cancelled) {
            setRenderError(
              isResourceError(err) || isAbortError(err)
                ? err
                : toDocxFormatError(err, {
                    kind: "render_failed",
                    message: "Failed to render DOCX.",
                  }),
            );
          }
        });
      return () => {
        cancelled = true;
      };
    },
  );

  useKeyedMountEffect(
    joinEffectKey([
      "docx-content-measure",
      isDocumentTransitioning,
      measureScroll,
      ready,
      scale,
    ]),
    () => {
      if (!ready) return;
      if (
        isDocumentTransitioning ||
        shouldReleaseTransitionProjectionRef.current
      ) {
        return;
      }
      projectVisiblePages();
      measureScroll();
    },
  );

  useMountEffect(() => () => {
    clearTransitionWindowReleaseTimer();
  });

  renderIndexRef.current = renderIndex;

  const highlightName = useDocxHighlight({
    highlight,
    renderIndex,
    ready,
  });
  useDocxControlsRegistration({
    currentPage,
    download,
    downloadAction: resource.originalDownload,
    fitWidth,
    numPages,
    ready,
    scale,
    zoomIn,
    zoomOut,
  });

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToTarget: (target, options) => {
        const index = renderIndexRef.current;
        if (!index) return;
        const hit = resolveDocxTargetHit(index, target);
        if (!hit) return;
        projectTargetPage(hit.pageNumber);
        const node = hit.startContainer;
        const el =
          node?.nodeType === Node.ELEMENT_NODE
            ? (node as HTMLElement)
            : (node?.parentElement ?? null);
        el?.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: options?.behavior ?? "smooth",
          ...options,
        });
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    [projectTargetPage, scrollViewportRef],
  );

  return (
    <DocxViewerFrame bare={bare} className={className}>
      <style>{DOCX_SCOPED_STYLES}</style>
      <style>{`::highlight(${highlightName}){background-color:color-mix(in oklab, var(--primary) 22%, transparent);}`}</style>
      {controls ? (
        ready ? (
          <ViewerControls
            position={{
              kind: "page",
              current: currentPage,
              total: numPages,
            }}
            zoom={{
              scale,
              onZoomOut: zoomOut,
              onZoomIn: zoomIn,
              onFit: fitWidth,
            }}
            downloads={
              download && resource.originalDownload
                ? [resource.originalDownload]
                : []
            }
          />
        ) : (
          <ViewerControlsSkeleton position zoom download={download} />
        )
      ) : null}
      <DocxViewerBody>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportRef={scrollViewportRef}
          viewportProps={{ onScroll: handleViewportScroll }}
        >
          <div ref={containerRef} className="flex flex-col items-center p-4">
            {!ready ? <DocxSkeleton /> : null}
            <div
              ref={setHostElement}
              className={
                ready
                  ? "w-full opacity-100 transition-opacity duration-200"
                  : "w-full opacity-0 transition-opacity duration-200"
              }
              style={{
                transformOrigin: getDocxDocumentTransformOrigin(
                  rendererFrame.align,
                ),
                zoom: scale,
              }}
            />
          </div>
        </ScrollArea>
      </DocxViewerBody>
    </DocxViewerFrame>
  );
}

function useMeasuredDocxContainerInlineSize({ enabled }: { enabled: boolean }) {
  const [containerElement, setContainerElement] =
    React.useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(
    null,
  );

  useKeyedLayoutEffect(joinEffectKey([containerElement, enabled]), () => {
    if (!enabled || !containerElement) {
      if (!enabled) {
        setContainerWidth((current) => (current == null ? current : null));
      }
      return;
    }

    let frame = 0;
    let latest = resolveDocxMeasuredInlineSize(containerElement.clientWidth);
    setContainerWidth(latest);
    if (typeof ResizeObserver === "undefined") return;

    let observer: ResizeObserver | null = null;
    try {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          latest = resolveDocxMeasuredInlineSize(
            (entry.target as HTMLElement).clientWidth,
          );
        }
        if (frame) return;
        frame = -1;
        const requestedFrame = requestAnimationFrame(() => {
          frame = 0;
          setContainerWidth((current) =>
            current === latest ? current : latest,
          );
        });
        if (frame === -1) frame = requestedFrame;
      });
      observer.observe(containerElement);
    } catch {
      if (frame > 0) cancelAnimationFrame(frame);
      observer?.disconnect();
      return;
    }

    return () => {
      if (frame > 0) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  });

  return {
    containerRef: setContainerElement,
    containerWidth,
  };
}

function resolveDocxMeasuredInlineSize(value: number) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getDocxDocumentTransformOrigin(align: FileViewerDocumentAlign) {
  switch (align) {
    case "center":
      return "center top";
    case "end":
      return "right top";
    case "start":
      return "left top";
  }
}

function useDocxControlsRegistration({
  currentPage,
  download,
  downloadAction,
  fitWidth,
  numPages,
  ready,
  scale,
  zoomIn,
  zoomOut,
}: {
  currentPage: number;
  download: boolean;
  downloadAction: NonNullable<ViewerControlsState["downloads"]>[number];
  fitWidth: () => void;
  numPages: number;
  ready: boolean;
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
}) {
  const onControlsChange = useViewerControlsRegistration();
  const controlsState = React.useMemo<ViewerControlsState>(
    () => ({
      loading: !ready,
      position: ready
        ? {
            kind: "page",
            current: currentPage,
            total: numPages,
          }
        : null,
      zoom: ready
        ? {
            scale,
            onZoomOut: zoomOut,
            onZoomIn: zoomIn,
            onFit: fitWidth,
          }
        : null,
      downloads: download && downloadAction ? [downloadAction] : [],
    }),
    [
      currentPage,
      download,
      downloadAction,
      fitWidth,
      numPages,
      ready,
      scale,
      zoomIn,
      zoomOut,
    ],
  );

  useKeyedMountEffect(
    joinEffectKey(["docx-controls", onControlsChange, controlsState]),
    () => {
      if (!onControlsChange) return;
      onControlsChange(controlsState);
      return () => onControlsChange(null);
    },
  );
}
