"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource";

import { getPptxFitScale, getPptxResetKey } from "./pptx-viewer-core";
import { FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT } from "./file-viewer-elements";
import {
  resolveFileViewerRendererLayoutInlineSize,
  type FileViewerDocumentAlign,
} from "./file-viewer-renderer-contract";
import {
  useOptionalFileViewerRendererEnvironment,
  useOptionalFileViewerRendererFrame,
} from "./file-viewer-renderer-frame";
import { PptxViewerFallback } from "./pptx-viewer-fallback";
import { useRetainedPptxSource } from "./pptx-viewer-hooks";
import { preloadPptxRenderer } from "./pptx-viewer-renderer";
import { createPptxScrollActivity } from "./pptx-viewer-scroll";
import {
  PPTX_SLIDE_GAP,
  PPTX_SLIDE_PADDING,
  PptxSlideScroller,
} from "./pptx-viewer-slide";
import { evictPptxSource } from "./pptx-viewer-source";
import type { PptxViewerProps } from "./pptx-viewer-types";
import { usePptxViewportWidth } from "./pptx-viewer-viewport";
import {
  createPptxSlideLayout,
  usePptxVisibleSlide,
} from "./pptx-viewer-visible-slide";
import { usePptxZoom } from "./pptx-viewer-zoom";
import { useIsClient } from "./use-is-client";
import { ViewerControls } from "./viewer-controls";
import { ViewerErrorBoundary } from "./viewer-error";

export type { PptxDocumentSource, PptxViewerProps } from "./pptx-viewer-types";
export type {
  PptxSourceLoadTiming,
  PptxSlideRenderTiming,
  PptxSlideOverlayProps,
} from "./pptx-viewer-core";

export function preloadPptxViewer() {
  preloadPptxRenderer();
}

export type PptxResourceContentProps = Omit<PptxViewerProps, "source"> & {
  resource: ViewerResource;
};

export function PptxViewer(props: PptxViewerProps) {
  const { source, ...resourceProps } = props;
  const resource = React.useMemo(() => createViewerResource(source), [source]);
  return <PptxResourceContent {...resourceProps} resource={resource} />;
}

export function PptxResourceContent(props: PptxResourceContentProps) {
  const isClient = useIsClient();
  const resource = props.resource;

  if (!isClient) {
    return (
      <PptxViewerFallback
        className={props.className}
        bare={props.bare}
        fallbackSlideSize={props.fallbackSlideSize}
        controls={props.controls}
      />
    );
  }
  return (
    <ViewerErrorBoundary
      className={props.className}
      bare={props.bare}
      download={
        props.controls === false || props.download === false
          ? null
          : resource.originalDownload
      }
      format="pptx"
      resetKey={getPptxResetKey({
        resourceKey: resource.keys.resource,
        scale: props.scale,
        defaultScale: props.defaultScale,
        eager: props.eager ?? false,
      })}
      sourceKind={resource.sourceKind}
      onRetry={() => evictPptxSource(resource.content)}
    >
      <React.Suspense
        fallback={
          <PptxViewerFallback
            className={props.className}
            bare={props.bare}
            fallbackSlideSize={props.fallbackSlideSize}
            controls={props.controls}
          />
        }
      >
        <PptxViewerContent
          key={resource.keys.load}
          {...props}
          resource={resource}
        />
      </React.Suspense>
    </ViewerErrorBoundary>
  );
}

function PptxViewerContent({
  resource,
  className,
  scale: controlledScale,
  defaultScale,
  download = true,
  onScaleChange,
  controls = true,
  renderSlideOverlay,
  onSlideRenderTiming,
  onSourceLoadTiming,
  onVisibleSlideChange,
  onScrollProgressChange,
  bare = false,
  eager = false,
}: Omit<PptxViewerProps, "source"> & { resource: ViewerResource }) {
  const source = useRetainedPptxSource(resource.content, onSourceLoadTiming);
  const downloadAction = download ? resource.originalDownload : null;

  const [rotation, setRotation] = React.useState(0);
  const scrollActivity = React.useMemo(() => createPptxScrollActivity(), []);
  const rendererEnvironment = useOptionalFileViewerRendererEnvironment();
  const { containerRef, viewportWidth } = usePptxViewportWidth({
    enabled: !rendererEnvironment.usesShellGeometry,
  });
  const rendererFrame = useOptionalFileViewerRendererFrame({
    fallbackInlineSize: viewportWidth,
  });
  const layoutInlineSize = resolveFileViewerRendererLayoutInlineSize({
    fallbackInlineSize: viewportWidth,
    rendererFrame,
  });
  const fitScale = getPptxFitScale(layoutInlineSize, source.baseSize.width);
  const { scaleControlsDisabled, setViewerScale, zoomScale } = usePptxZoom({
    controlledScale,
    defaultScale,
    fitScale,
    onScaleChange,
  });
  const slideLayout = React.useMemo(
    () =>
      createPptxSlideLayout({
        baseSize: source.baseSize,
        zoomScale,
        rotation,
        slideCount: source.slideCount,
        slideGap: PPTX_SLIDE_GAP,
        slidePadding: PPTX_SLIDE_PADDING,
      }),
    [source.baseSize, source.slideCount, zoomScale, rotation],
  );
  const { currentSlide, getScrollMetrics, handleScroll, scrollViewportRef } =
    usePptxVisibleSlide({
      layout: slideLayout,
      onScrollProgressChange,
      onVisibleSlideChange,
    });
  const scrollInteractionRestoreRef = React.useRef<number | null>(null);
  const scrollInteractionElementRef = React.useRef<HTMLElement | null>(null);
  const documentSurfaceRef = React.useRef<HTMLDivElement | null>(null);

  const suspendScrollInteractions = React.useCallback(() => {
    const scrollElement = scrollViewportRef.current?.querySelector<HTMLElement>(
      '[data-slot="pptx-slide-sticky-window"]',
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
      restorePptxScrollInteractions(scrollInteractionElementRef.current);
      scrollInteractionElementRef.current = null;
    }, 120);
  }, [scrollViewportRef]);

  useMountEffect(() => () => {
    if (scrollInteractionRestoreRef.current !== null) {
      window.clearTimeout(scrollInteractionRestoreRef.current);
      scrollInteractionRestoreRef.current = null;
    }
    restorePptxScrollInteractions(scrollInteractionElementRef.current);
    scrollInteractionElementRef.current = null;
  });

  const handleViewportScroll = React.useCallback(() => {
    scrollActivity.handleScroll();
    suspendScrollInteractions();
    handleScroll();
  }, [handleScroll, scrollActivity, suspendScrollInteractions]);
  const measureBeforeLayoutMotionRef = React.useRef(handleScroll);
  measureBeforeLayoutMotionRef.current = handleScroll;
  const handleBeforeLayoutMotion = React.useCallback(() => {
    measureBeforeLayoutMotionRef.current();
  }, []);
  const setDocumentSurfaceElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      const previousElement = documentSurfaceRef.current;
      if (previousElement === element) return;
      previousElement?.removeEventListener(
        FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
        handleBeforeLayoutMotion,
      );
      documentSurfaceRef.current = element;
      rendererEnvironment.setDocumentSurfaceElement(element);
      if (!element) return;
      element.addEventListener(
        FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
        handleBeforeLayoutMotion,
      );
    },
    [
      handleBeforeLayoutMotion,
      rendererEnvironment.setDocumentSurfaceElement,
    ],
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "bg-muted/20 h-full" : "bg-muted/30 rounded-xl border",
        className,
      )}
      data-slot="pptx-viewer"
    >
      {controls ? (
        <ViewerControls
          position={{
            kind: "slide",
            current: currentSlide,
            total: source.slideCount,
          }}
          zoom={{
            scale: zoomScale,
            onZoomOut: () => setViewerScale(zoomScale / 1.2),
            onZoomIn: () => setViewerScale(zoomScale * 1.2),
            onFit: () => setViewerScale(null),
            isDisabled: scaleControlsDisabled,
          }}
          rotate={{
            onRotate: () => setRotation((value) => (value + 90) % 360),
          }}
          downloads={downloadAction ? [downloadAction] : []}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div
          ref={setDocumentSurfaceElement}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
          data-slot="pptx-viewer-document-surface"
          style={{
            transformOrigin: getPptxDocumentTransformOrigin(
              rendererFrame.align,
            ),
          }}
        >
          <div className="relative flex min-h-0 flex-1 flex-col">
            <PptxSlideScroller
              source={source}
              zoomScale={zoomScale}
              rotation={rotation}
              layout={slideLayout}
              eager={eager}
              activity={scrollActivity}
              renderSlideOverlay={renderSlideOverlay}
              onSlideRenderTiming={onSlideRenderTiming}
              containerRef={containerRef}
              viewportRef={scrollViewportRef}
              getScrollMetrics={getScrollMetrics}
              onScroll={handleViewportScroll}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function restorePptxScrollInteractions(element: HTMLElement | null) {
  if (!element) return;
  element.style.removeProperty("pointer-events");
  element.style.removeProperty("overflow-x");
}

function getPptxDocumentTransformOrigin(align: FileViewerDocumentAlign) {
  switch (align) {
    case "center":
      return "center top";
    case "end":
      return "right top";
    case "start":
      return "left top";
  }
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
