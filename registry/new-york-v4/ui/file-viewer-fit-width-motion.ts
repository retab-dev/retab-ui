"use client";

import type { FileViewerDocumentSurfaceMotionResolver } from "./file-viewer-motion-kernel";
import type { FileViewerMotionFrame } from "./file-viewer-motion-plan";
import type {
  FileViewerDocumentAlign,
  FileViewerInlineDirection,
} from "./file-viewer-renderer-contract";

export const FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY =
  "--file-viewer-fit-width-anchor-block";

// Commit-then-relax: the renderer lays out at the motion's TARGET width from
// the first commit, and this resolver reprojects that settled layout to the
// in-flight visual width with one uniform transform. The transform terminates
// on identity, so settle removes a no-op style instead of committing layout.
//
// The anchor custom property is the reading line's block offset in the settled
// stage's own coordinates (post-rebase scrollTop + marker offset). It is read
// live via var(), so the renderer writes it once per motion (in a layout
// effect after the slide-start scroll rebase) without re-entering the kernel.
export function createFileViewerFitWidthSurfaceMotionResolver({
  align,
  anchorBlockProperty = FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY,
  direction = "ltr",
  isFitWidth,
  stageInlineSize,
}: {
  align: FileViewerDocumentAlign;
  anchorBlockProperty?: string;
  direction?: FileViewerInlineDirection;
  isFitWidth: boolean;
  stageInlineSize: number;
}): FileViewerDocumentSurfaceMotionResolver {
  return (frame) => {
    if (!isFitWidth || frame.phase !== "sliding") {
      return {
        transform: "",
        transformOrigin: "",
        willChange: "",
      };
    }

    return {
      transform: getFileViewerFitWidthSurfaceMotionTransform({
        align,
        anchorBlockProperty,
        direction,
        frame,
        stageInlineSize,
      }),
      transformOrigin: "0px 0px",
      willChange: "transform",
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

// The visual scale the resolver renders for a given live width — the same
// affine unit-slope reprojection as the transform itself. Renderers use it to
// reason about the on-screen state (anchor capture/solve) without duplicating
// the formula.
export function getFileViewerFitWidthVisualScale({
  liveInlineSize,
  stageInlineSize,
  targetInlineSize,
}: {
  liveInlineSize: number;
  stageInlineSize: number;
  targetInlineSize: number;
}) {
  if (
    stageInlineSize <= 0 ||
    !Number.isFinite(liveInlineSize) ||
    !Number.isFinite(targetInlineSize)
  ) {
    return 1;
  }
  return (
    Math.max(1, stageInlineSize + (liveInlineSize - targetInlineSize)) /
    stageInlineSize
  );
}

// Capture side of the motion anchor: the probe content line's on-screen block
// offset relative to the scroll box, taken just before a motion (or retarget)
// commits. When a motion is already in flight the DOM is the settled layout
// PLUS the live transform, so the capture applies that transform — otherwise
// a retarget would solve continuity against a picture the reader never saw.
export function captureFileViewerFitWidthAnchorScreenOffset({
  lastAnchorBlock,
  liveFrame,
  probeStageOffset,
  scrollTop,
  stageInlineSize,
}: {
  lastAnchorBlock: number | null;
  liveFrame: FileViewerMotionFrame | null;
  probeStageOffset: number;
  scrollTop: number;
  stageInlineSize: number;
}) {
  const untransformed = probeStageOffset - scrollTop;
  if (!liveFrame || liveFrame.phase !== "sliding") return untransformed;

  const liveScale = getFileViewerFitWidthVisualScale({
    liveInlineSize: liveFrame.layoutInlineSize,
    stageInlineSize,
    targetInlineSize: liveFrame.toInlineSize,
  });
  if (Math.abs(1 - liveScale) <= 0.001) return untransformed;

  return (
    liveScale * probeStageOffset +
    (1 - liveScale) * (lastAnchorBlock ?? 0) -
    scrollTop
  );
}

// Solve side: the anchor block offset that puts the probe content line back on
// its captured screen position under the NEW layout model at the motion's
// first-frame scale. Exact regardless of how the rebase clamped or how the
// old/new layout models relate (measured page sizes, constant gaps/padding).
// Returns null when the motion is degenerate (caller falls back to the live
// reading marker).
export function resolveFileViewerFitWidthMotionAnchorBlock({
  fromInlineSize,
  probeScreenOffset,
  probeStageOffset,
  scrollTop,
  stageInlineSize,
  toInlineSize,
}: {
  fromInlineSize: number | null;
  probeScreenOffset: number;
  probeStageOffset: number;
  scrollTop: number;
  stageInlineSize: number;
  toInlineSize: number | null;
}) {
  if (fromInlineSize == null || toInlineSize == null) return null;

  const startScale = getFileViewerFitWidthVisualScale({
    liveInlineSize: fromInlineSize,
    stageInlineSize,
    targetInlineSize: toInlineSize,
  });
  if (
    !Number.isFinite(startScale) ||
    Math.abs(1 - startScale) <= 0.001
  ) {
    return null;
  }

  return (
    (probeScreenOffset + scrollTop - startScale * probeStageOffset) /
    (1 - startScale)
  );
}

function getFileViewerFitWidthSurfaceMotionTransform({
  align,
  anchorBlockProperty,
  direction,
  frame,
  stageInlineSize,
}: {
  align: FileViewerDocumentAlign;
  anchorBlockProperty: string;
  direction: FileViewerInlineDirection;
  frame: FileViewerMotionFrame;
  stageInlineSize: number;
}) {
  if (
    stageInlineSize <= 0 ||
    frame.layoutInlineSize <= 0 ||
    frame.toInlineSize <= 0
  ) {
    return "";
  }

  // Fit-width renderers size their stage as an affine function of the
  // available width with unit slope (stage = width − constant padding), so the
  // in-flight visual stage is the settled stage plus the live width delta.
  // At the first frame this resolves to exactly the pre-toggle stage size, and
  // at the last frame to the settled stage — identity.
  const scale = getFileViewerFitWidthVisualScale({
    liveInlineSize: frame.layoutInlineSize,
    stageInlineSize,
    targetInlineSize: frame.toInlineSize,
  });
  const visualStageInlineSize = scale * stageInlineSize;
  const settledMargin = getFileViewerStageInlineMargin({
    align,
    availableInlineSize: frame.layoutInlineSize,
    direction,
    stageInlineSize,
  });
  const visualMargin = getFileViewerStageInlineMargin({
    align,
    availableInlineSize: frame.layoutInlineSize,
    direction,
    stageInlineSize: visualStageInlineSize,
  });
  const translateX = visualMargin - settledMargin;

  if (Math.abs(scale - 1) <= 0.001 && Math.abs(translateX) <= 0.001) {
    return "";
  }

  const formattedScale = formatFileViewerMotionScale(scale);
  const formattedTranslateX = formatFileViewerMotionPixel(translateX);
  // Uniform scale about the stage origin; the anchor term keeps the reading
  // line fixed: y' = s·y + (1 − s)·anchor equals y at y = anchor.
  const translateY = `calc((1 - ${formattedScale}) * var(${anchorBlockProperty}, 0px))`;

  return `translate3d(${formattedTranslateX}px, ${translateY}, 0) scale(${formattedScale})`;
}

// Physical LEFT offset of the stage box inside the available inline size —
// translateX shifts along the physical X axis, so the model must speak
// physical-left in both directions. Stages align with physical auto margins
// (mx-auto for center, ml-auto for end, plain flow for start), so:
// - free space ≥ 0: center splits it; end pins right in both directions
//   (ml-auto is physical); start follows flow (left in LTR, right in RTL).
// - free space < 0 (the settled stage overflows the live container — the
//   close leg's early frames): auto margins collapse to 0 and CSS resolves
//   the over-constraint against the direction's end edge, pinning the box to
//   the start edge — left edge at 0 in LTR, at the negative free space in
//   RTL. The old unconditional max(0, …) clamp encoded only the LTR half and
//   made the RTL close leg overshoot by the overflow amount.
function getFileViewerStageInlineMargin({
  align,
  availableInlineSize,
  direction,
  stageInlineSize,
}: {
  align: FileViewerDocumentAlign;
  availableInlineSize: number;
  direction: FileViewerInlineDirection;
  stageInlineSize: number;
}) {
  const freeInlineSize = availableInlineSize - stageInlineSize;
  if (freeInlineSize < 0) return direction === "rtl" ? freeInlineSize : 0;

  switch (align) {
    case "start":
      return direction === "rtl" ? freeInlineSize : 0;
    case "end":
      return freeInlineSize;
    case "center":
      return freeInlineSize / 2;
  }
}

function formatFileViewerMotionPixel(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

function formatFileViewerMotionScale(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(6))) : "1";
}
