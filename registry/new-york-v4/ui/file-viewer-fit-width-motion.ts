"use client";

import type { FileViewerDocumentSurfaceMotionResolver } from "./file-viewer-motion-kernel";
import type { FileViewerMotionFrame } from "./file-viewer-motion-plan";
import type { FileViewerDocumentAlign } from "./file-viewer-renderer-contract";

export const FILE_VIEWER_FIT_WIDTH_MOTION_SCALE_PROPERTY =
  "--file-viewer-fit-width-motion-scale";
export const FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY =
  "--file-viewer-fit-width-anchor-block";

export type FileViewerFitWidthMotionMode = "inline-scale" | "uniform-scale";

export function createFileViewerFitWidthSurfaceMotionResolver({
  align,
  anchorBlockProperty = FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY,
  fitContentInlineSize,
  frozenStageInlineSize,
  isFitWidth,
  mode,
  scaleProperty = FILE_VIEWER_FIT_WIDTH_MOTION_SCALE_PROPERTY,
  stageInlinePadding = 0,
}: {
  align: FileViewerDocumentAlign;
  anchorBlockProperty?: string;
  fitContentInlineSize: number;
  frozenStageInlineSize: number;
  isFitWidth: boolean;
  mode: FileViewerFitWidthMotionMode;
  scaleProperty?: string;
  stageInlinePadding?: number;
}): FileViewerDocumentSurfaceMotionResolver {
  return (frame) => {
    if (!isFitWidth || frame.phase !== "sliding") {
      return {
        customProperties: {
          [scaleProperty]: null,
        },
        transform: "",
        transformOrigin: "",
        willChange: "",
      };
    }

    const motionStyle = getFileViewerFitWidthSurfaceMotionStyle({
      align,
      anchorBlockProperty,
      fitContentInlineSize,
      frame,
      frozenStageInlineSize,
      mode,
      stageInlinePadding,
    });

    return {
      customProperties: {
        [scaleProperty]: motionStyle.scale,
      },
      transform: motionStyle.transform,
      transformOrigin: "0px 0px",
      willChange: frame.phase === "sliding" ? "transform" : "",
    };
  };
}

export function getFileViewerFitWidthScale({
  availableInlineSize,
  contentInlineSize,
  stageInlinePadding = 0,
}: {
  availableInlineSize: number;
  contentInlineSize: number;
  stageInlinePadding?: number;
}) {
  if (availableInlineSize <= 0 || contentInlineSize <= 0) return 1;

  const contentAvailableInlineSize = Math.max(
    1,
    availableInlineSize - stageInlinePadding,
  );
  return contentAvailableInlineSize / contentInlineSize;
}

function getFileViewerFitWidthSurfaceMotionStyle({
  align,
  anchorBlockProperty,
  fitContentInlineSize,
  frame,
  frozenStageInlineSize,
  mode,
  stageInlinePadding,
}: {
  align: FileViewerDocumentAlign;
  anchorBlockProperty: string;
  fitContentInlineSize: number;
  frame: FileViewerMotionFrame;
  frozenStageInlineSize: number;
  mode: FileViewerFitWidthMotionMode;
  stageInlinePadding: number;
}) {
  if (
    fitContentInlineSize <= 0 ||
    frozenStageInlineSize <= 0 ||
    frame.layoutInlineSize <= 0
  ) {
    return { scale: "1", transform: "" };
  }

  // Both branches must resolve to exactly the frozen stage size at motion
  // start (layoutInlineSize === fromInlineSize), or the surface visibly scales
  // on the first frame and — because the transform extends the scroll-measured
  // bbox — perturbs the scroller's scrollable height. Renderers size their stage as
  // an affine function of the available width (stage = width − padding −
  // scrollbar), so the animating target is the frozen stage plus the width
  // delta, never an absolute refit of the kernel width.
  const targetStageInlineSize =
    frame.fromInlineSize > 0
      ? mode === "inline-scale"
        ? frozenStageInlineSize *
          (frame.layoutInlineSize / frame.fromInlineSize)
        : frozenStageInlineSize +
          (frame.layoutInlineSize - frame.fromInlineSize)
      : getFileViewerFitWidthScale({
          availableInlineSize: frame.layoutInlineSize,
          contentInlineSize: fitContentInlineSize,
          stageInlinePadding,
        }) *
          fitContentInlineSize +
        stageInlinePadding;
  const currentFrozenMargin = getFileViewerStageInlineMargin({
    align,
    availableInlineSize: frame.layoutInlineSize,
    stageInlineSize: frozenStageInlineSize,
  });
  const targetMargin = getFileViewerStageInlineMargin({
    align,
    availableInlineSize: frame.layoutInlineSize,
    stageInlineSize: targetStageInlineSize,
  });
  const scale = targetStageInlineSize / frozenStageInlineSize;
  const translateX = targetMargin - currentFrozenMargin;

  if (Math.abs(scale - 1) <= 0.001 && Math.abs(translateX) <= 0.001) {
    return { scale: "1", transform: "" };
  }

  const formattedScale = formatFileViewerMotionScale(scale);
  const formattedTranslateX = formatFileViewerMotionPixel(translateX);
  const scaleTransform =
    mode === "uniform-scale"
      ? `scale(${formattedScale})`
      : `scaleX(${formattedScale})`;
  const translateY =
    mode === "uniform-scale"
      ? `calc((1 - ${formattedScale}) * var(${anchorBlockProperty}, 0px))`
      : "0";

  return {
    scale: formattedScale,
    transform: `translate3d(${formattedTranslateX}px, ${translateY}, 0) ${scaleTransform}`,
  };
}

function getFileViewerStageInlineMargin({
  align,
  availableInlineSize,
  stageInlineSize,
}: {
  align: FileViewerDocumentAlign;
  availableInlineSize: number;
  stageInlineSize: number;
}) {
  switch (align) {
    case "start":
      return 0;
    case "end":
      return Math.max(0, availableInlineSize - stageInlineSize);
    case "center":
      return Math.max(0, (availableInlineSize - stageInlineSize) / 2);
  }
}

function formatFileViewerMotionPixel(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

function formatFileViewerMotionScale(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(6))) : "1";
}
