"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { type FrameSource } from "@/lib/image-frame-source";
import {
  imageFrameSourceManager,
  type FrameSourceLease,
  type ImageSourceContent,
} from "@/lib/image-source-cache";
import { cn } from "@/lib/utils";
import {
  type ViewerContentIdentity,
  type ViewerResource,
} from "@/lib/viewer-resource";
import { ImageFrameScroller } from "@/components/ui/image-viewer-frame";
import {
  MAX_VIEWER_SCALE,
  MIN_VIEWER_SCALE,
  useFrameListWidth,
  useImageViewerHandle,
  useImageViewerScale,
  useVisibleFrame,
} from "@/components/ui/image-viewer-hooks";
import {
  type ImageViewerHandle,
  type ImageViewerProps,
} from "@/components/ui/image-viewer-types";
import {
  useViewerControlsRegistration,
  ViewerControls,
  type ViewerControlsState,
} from "@/components/ui/viewer-controls";

import { resolveFileViewerRendererLayoutInlineSize } from "./file-viewer-renderer-contract";
import {
  useOptionalFileViewerRendererEnvironment,
  useOptionalFileViewerRendererFrame,
} from "./file-viewer-renderer-frame";
import { useReadingFractionRebase } from "./use-reading-fraction-rebase";
import { createImageFrameLayout } from "./image-viewer-virtualization";
import { joinEffectKey } from "@/lib/effect-key";

export function ImageViewerContent({
  resource,
  className,
  scale: controlledScale,
  defaultScale,
  download = true,
  onScaleChange,
  controls = true,
  renderFrameOverlay,
  onFrameRenderTiming,
  onVisibleFrameChange,
  onScrollProgressChange,
  bare = false,
  forwardedRef,
}: Omit<ImageViewerProps, "source"> & {
  forwardedRef?: React.ForwardedRef<ImageViewerHandle>;
  resource: ViewerResource;
}) {
  const frameSource = React.use(getImageSource(resource.content));
  const sourceLeaseRef = useFrameSourceLease(resource.content, frameSource);
  const rendererEnvironment = useOptionalFileViewerRendererEnvironment();
  const { frameListRef, frameListWidth } = useFrameListWidth({
    enabled: !rendererEnvironment.usesShellGeometry,
  });
  const rendererFrame = useOptionalFileViewerRendererFrame({
    fallbackInlineSize: frameListWidth,
  });
  const frameListLayoutWidth = resolveFileViewerRendererLayoutInlineSize({
    fallbackInlineSize: frameListWidth,
    rendererFrame,
  });
  // While the sidebar transition is running, hold the virtualization's
  // mounted-frame window so the reading frames stay visible instead of
  // windowing to the top and rebasing at settle. The freeze must span both the
  // frozen slide and the settling rebase (the scroll container reports a
  // transient top-of-document position until the settle scroll has landed);
  // re-derive the window normally only once the transition is idle again.
  const freezeVisibleFrameWindow = rendererFrame.phase !== "idle";
  const {
    rotateClockwise,
    rotation,
    scale,
    scaleControlsDisabled,
    setViewerScale,
  } = useImageViewerScale(
    frameSource,
    controlledScale,
    defaultScale,
    onScaleChange,
    frameListLayoutWidth,
  );
  const frameLayout = React.useMemo(
    () =>
      createImageFrameLayout({
        frames: frameSource.frames,
        scale,
        rotation,
      }),
    [frameSource.frames, rotation, scale],
  );
  const {
    currentFrameNumber,
    getScrollMetrics,
    getViewportElement,
    handleScroll,
    scrollToFrameArea,
    setScrollViewportRef,
  } = useVisibleFrame(
    frameLayout,
    frameSource,
    onScrollProgressChange,
    onVisibleFrameChange,
  );
  useImageViewerHandle(forwardedRef, getViewportElement, scrollToFrameArea);

  // Preserve the reading position when the image re-fits to a new width (the
  // sidebar toggle). The fit scale is the layout key; capture the fraction on
  // scroll and restore it the instant the scale changes.
  const scrollerRef = React.useRef<HTMLElement | null>(null);
  const { captureReadingFraction } = useReadingFractionRebase({
    scrollerRef,
    layoutKey: scale,
    enabled: rendererEnvironment.usesShellGeometry,
  });
  const setScrollViewportRefWithRebase = React.useCallback(
    (element: HTMLDivElement | null) => {
      scrollerRef.current = element;
      setScrollViewportRef(element);
    },
    [setScrollViewportRef],
  );
  const handleScrollWithRebase = React.useCallback(() => {
    captureReadingFraction();
    handleScroll();
  }, [captureReadingFraction, handleScroll]);

  const frameCount = frameSource.frames.length;
  const countLabel =
    frameSource.kind === "tiff"
      ? `Page ${Math.min(currentFrameNumber, frameCount)} of ${frameCount}`
      : `${frameCount} image${frameCount === 1 ? "" : "s"}`;
  const zoomOut = React.useCallback(
    () =>
      setViewerScale(clamp(scale / 1.2, MIN_VIEWER_SCALE, MAX_VIEWER_SCALE)),
    [scale, setViewerScale],
  );
  const zoomIn = React.useCallback(
    () =>
      setViewerScale(clamp(scale * 1.2, MIN_VIEWER_SCALE, MAX_VIEWER_SCALE)),
    [scale, setViewerScale],
  );
  const fitWidth = React.useCallback(
    () => setViewerScale(null),
    [setViewerScale],
  );
  useImageControlsRegistration({
    countLabel,
    download,
    downloadAction: resource.originalDownload,
    fitWidth,
    rotateClockwise,
    scale,
    scaleControlsDisabled,
    zoomIn,
    zoomOut,
  });

  return (
    <div
      ref={sourceLeaseRef}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "bg-muted/20 h-full" : "bg-muted/30 rounded-xl border",
        className,
      )}
      data-slot="image-viewer"
    >
      {controls ? (
        <ViewerControls
          position={{ label: countLabel }}
          zoom={{
            scale,
            onZoomOut: zoomOut,
            onZoomIn: zoomIn,
            onFit: fitWidth,
            isDisabled: scaleControlsDisabled,
          }}
          rotate={{ onRotate: rotateClockwise }}
          downloads={download ? [resource.originalDownload] : []}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <ImageFrameScroller
              source={frameSource}
              layout={frameLayout}
              scale={scale}
              rotation={rotation}
              frameListRef={frameListRef}
              getScrollMetrics={getScrollMetrics}
              freezeVisibleFrameWindow={freezeVisibleFrameWindow}
              viewportRef={setScrollViewportRefWithRebase}
              onScroll={handleScrollWithRebase}
              renderFrameOverlay={renderFrameOverlay}
              onFrameRenderTiming={onFrameRenderTiming}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function useImageControlsRegistration({
  countLabel,
  download,
  downloadAction,
  fitWidth,
  rotateClockwise,
  scale,
  scaleControlsDisabled,
  zoomIn,
  zoomOut,
}: {
  countLabel: string;
  download: boolean;
  downloadAction: ViewerResource["originalDownload"];
  fitWidth: () => void;
  rotateClockwise: () => void;
  scale: number;
  scaleControlsDisabled: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
}) {
  const onControlsChange = useViewerControlsRegistration();
  const controlsState = React.useMemo<ViewerControlsState>(
    () => ({
      position: { label: countLabel },
      zoom: {
        scale,
        onZoomOut: zoomOut,
        onZoomIn: zoomIn,
        onFit: fitWidth,
        isDisabled: scaleControlsDisabled,
      },
      rotate: { onRotate: rotateClockwise },
      downloads: download ? [downloadAction] : [],
    }),
    [
      countLabel,
      download,
      downloadAction,
      fitWidth,
      rotateClockwise,
      scale,
      scaleControlsDisabled,
      zoomIn,
      zoomOut,
    ],
  );

  useKeyedMountEffect(
    joinEffectKey(["image-controls", onControlsChange, controlsState]),
    () => {
      if (!onControlsChange) return;
      onControlsChange(controlsState);
      return () => onControlsChange(null);
    },
  );
}

export function getImageSource(
  content: ImageSourceContent,
): Promise<FrameSource> {
  return imageFrameSourceManager.load(content, createTiffWorker);
}

export function resetImageSourceCacheForTests() {
  imageFrameSourceManager.clear();
}

function useFrameSourceLease(
  content: ViewerContentIdentity,
  source: FrameSource,
): React.RefCallback<HTMLDivElement> {
  return React.useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      const lease = retainImageSource(content, source);
      return () => lease?.release();
    },
    [content, source],
  );
}

function retainImageSource(
  content: ViewerContentIdentity,
  source: FrameSource,
): FrameSourceLease | null {
  return imageFrameSourceManager.retain(content, source);
}

function createTiffWorker() {
  return new Worker(new URL("./image-viewer.worker", import.meta.url), {
    type: "module",
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
