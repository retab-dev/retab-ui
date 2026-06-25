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
  const { frameListRef, frameListWidth } = useFrameListWidth();
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
    frameListWidth,
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
    handleScroll,
    scrollToLogicalTop,
    scrollViewportRef,
    setScrollViewportRef,
  } = useVisibleFrame(
    frameLayout,
    frameSource,
    onScrollProgressChange,
    onVisibleFrameChange,
  );
  useImageViewerHandle(
    forwardedRef,
    scrollViewportRef,
    frameLayout,
    scrollToLogicalTop,
  );

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
              viewportRef={setScrollViewportRef}
              onScroll={handleScroll}
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
