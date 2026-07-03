"use client";

import * as React from "react";

import {
  useOptionalFileViewerRendererEnvironment,
  useOptionalFileViewerRendererFrame,
} from "./file-viewer-renderer-frame";
import type { FileViewerDocumentSurfaceMotionResolver } from "./file-viewer-motion-kernel";
import type { FileViewerMotionFrame } from "./file-viewer-motion-plan";
import {
  resolveFileViewerRendererLayoutInlineSize,
  type FileViewerRendererFrame,
} from "./file-viewer-renderer-contract";
import {
  createPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout";
import { usePdfPageSizes } from "./pdf-viewer-page-sizes";
import {
  getPdfFitWidthScale,
  getPdfPageDevicePixelRatio,
  useMeasuredElementWidth,
  usePdfScale,
} from "./pdf-viewer-scale";
import {
  usePdfDocumentRotation,
  usePdfFirstPageSize,
  type PdfDocument,
} from "./pdf-viewer-document-resource";
import type { PdfPageSize } from "./pdf-viewer-types";
import type { ViewerDocumentTransition } from "./viewer-types";
import {
  PDF_DOCUMENT_ANCHOR_BLOCK_PROPERTY,
  PDF_DOCUMENT_MOTION_SCALE_PROPERTY,
} from "./pdf-viewer-motion-contract";

export type PdfDocumentLayoutState = {
  containerRef: React.RefCallback<HTMLDivElement>;
  displayScale: number;
  firstPageSize: PdfPageSize;
  fitWidth: () => void;
  isFitWidth: boolean;
  pageDevicePixelRatio: number;
  pageLayout: PdfPageLayoutModel;
  renderScale: number;
  resolvedScale: number;
  rotateClockwise: () => void;
  rotation: number;
  resolveSurfaceMotionStyle: FileViewerDocumentSurfaceMotionResolver;
  setPageSize: ReturnType<typeof usePdfPageSizes>["setPageSize"];
  transition: ViewerDocumentTransition;
  rendererFrame: FileViewerRendererFrame;
  zoomIn: () => void;
  zoomOut: () => void;
};

export function usePdfDocumentLayout({
  controlledScale,
  defaultScale,
  document,
  onScaleChange,
}: {
  controlledScale?: number;
  defaultScale?: number;
  document: PdfDocument;
  onScaleChange?: (scale: number | null) => void;
}): PdfDocumentLayoutState {
  const firstPageSize = usePdfFirstPageSize(document);
  const rendererEnvironment = useOptionalFileViewerRendererEnvironment();
  const { ref: containerRef, width: containerWidth } = useMeasuredElementWidth({
    enabled: !rendererEnvironment.usesShellGeometry,
  });
  const rendererFrame = useOptionalFileViewerRendererFrame({
    fallbackInlineSize: containerWidth,
  });
  const { rotation, rotateClockwise } = usePdfDocumentRotation(document);
  const fitPageWidth =
    rotation % 180 === 0 ? firstPageSize.width : firstPageSize.height;
  const logicalInlineSize = resolveFileViewerRendererLayoutInlineSize({
    fallbackInlineSize: containerWidth,
    rendererFrame,
  });
  const { resolvedScale, isFitWidth, zoomIn, zoomOut, fitWidth } = usePdfScale({
    controlledScale,
    defaultScale,
    onScaleChange,
    containerWidth: logicalInlineSize,
    fitWidthInlinePadding: 0,
    pageWidth: fitPageWidth,
    resetKey: document,
  });
  const fitWidthDisplayScale = isFitWidth
    ? getPdfFitWidthScale(logicalInlineSize, fitPageWidth, 0)
    : resolvedScale;
  const displayScale = isFitWidth ? fitWidthDisplayScale : resolvedScale;
  const renderScale = getPdfPreparedFitWidthRenderScale({
    enabled: isFitWidth,
    fallbackScale: resolvedScale,
    frozenInlineSize: rendererFrame.fromInlineSize,
    isSliding: rendererFrame.isTransitioning,
    pageWidth: fitPageWidth,
    rasterInlineSize: rendererFrame.rasterInlineSize,
  });
  const transition = React.useMemo(
    () =>
      getPdfDocumentTransition({
        isFitWidth,
        rendererTransition: rendererFrame.documentTransition,
      }),
    [isFitWidth, rendererFrame.documentTransition],
  );
  const { pageSizeByNumber, setPageSize } = usePdfPageSizes(document);
  const pageLayout = React.useMemo(
    () =>
      createPdfPageLayout({
        pageCount: document.numPages,
        defaultPageSize: firstPageSize,
        pageSizeByNumber,
        scale: displayScale,
        rotation,
      }),
    [
      document.numPages,
      displayScale,
      firstPageSize,
      pageSizeByNumber,
      rotation,
    ],
  );
  const pageDevicePixelRatio = getPdfPageDevicePixelRatio({
    devicePixelRatio:
      (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1,
    mode: "settled",
  });
  const resolveSurfaceMotionStyle =
    React.useMemo<FileViewerDocumentSurfaceMotionResolver>(
      () =>
        createPdfSurfaceMotionStyleResolver({
          align: rendererFrame.align,
          fitPageWidth,
          frozenStageWidth: pageLayout.maxPageWidth,
          isFitWidth,
        }),
      [fitPageWidth, isFitWidth, pageLayout.maxPageWidth, rendererFrame.align],
    );

  return {
    containerRef,
    displayScale,
    firstPageSize,
    fitWidth,
    isFitWidth,
    pageDevicePixelRatio,
    pageLayout,
    renderScale,
    resolvedScale,
    rotateClockwise,
    rotation,
    resolveSurfaceMotionStyle,
    setPageSize,
    transition,
    rendererFrame,
    zoomIn,
    zoomOut,
  };
}

function createPdfSurfaceMotionStyleResolver({
  align,
  fitPageWidth,
  frozenStageWidth,
  isFitWidth,
}: {
  align: FileViewerRendererFrame["align"];
  fitPageWidth: number;
  frozenStageWidth: number;
  isFitWidth: boolean;
}): FileViewerDocumentSurfaceMotionResolver {
  return (frame) => {
    if (!isFitWidth) {
      return {
        customProperties: {
          [PDF_DOCUMENT_MOTION_SCALE_PROPERTY]: null,
        },
        transform: "",
        transformOrigin: "",
        willChange: "",
      };
    }

    if (frame.phase !== "sliding") {
      return {
        customProperties: {
          [PDF_DOCUMENT_MOTION_SCALE_PROPERTY]: null,
        },
        transform: "",
        transformOrigin: "",
        willChange: "",
      };
    }

    const motionStyle = getPdfDocumentSurfaceMotionStyle({
      align,
      fitPageWidth,
      frame,
      frozenStageWidth,
    });

    return {
      customProperties: {
        [PDF_DOCUMENT_MOTION_SCALE_PROPERTY]: motionStyle.scale,
      },
      transform: motionStyle.transform,
      transformOrigin: `0px var(${PDF_DOCUMENT_ANCHOR_BLOCK_PROPERTY}, 0px)`,
      willChange: frame.phase === "sliding" ? "transform" : "",
    };
  };
}

function getPdfDocumentSurfaceMotionStyle({
  align,
  fitPageWidth,
  frame,
  frozenStageWidth,
}: {
  align: FileViewerRendererFrame["align"];
  fitPageWidth: number;
  frame: FileViewerMotionFrame;
  frozenStageWidth: number;
}) {
  if (
    fitPageWidth <= 0 ||
    frozenStageWidth <= 0 ||
    frame.layoutInlineSize <= 0
  ) {
    return { scale: "1", transform: "" };
  }

  const targetStageWidth =
    getPdfFitWidthScale(frame.layoutInlineSize, fitPageWidth, 0) * fitPageWidth;
  const currentFrozenMargin = getPdfStageInlineMargin({
    align,
    availableInlineSize: frame.layoutInlineSize,
    stageWidth: frozenStageWidth,
  });
  const targetMargin = getPdfStageInlineMargin({
    align,
    availableInlineSize: frame.layoutInlineSize,
    stageWidth: targetStageWidth,
  });
  const scale = targetStageWidth / frozenStageWidth;
  const translateX = targetMargin - currentFrozenMargin;

  if (Math.abs(scale - 1) <= 0.001 && Math.abs(translateX) <= 0.001) {
    return { scale: "1", transform: "" };
  }

  return {
    scale: formatPdfMotionScale(scale),
    transform: `translate3d(${formatPdfMotionPixel(
      translateX,
    )}px, 0, 0) scaleX(${formatPdfMotionScale(scale)})`,
  };
}

function getPdfDocumentTransition({
  isFitWidth,
  rendererTransition,
}: {
  isFitWidth: boolean;
  rendererTransition: ViewerDocumentTransition;
}): ViewerDocumentTransition {
  if (isFitWidth && rendererTransition.source === "viewer-shell") {
    return rendererTransition;
  }

  return {
    layoutPolicy: "live",
    scrollPolicy: "preserve",
    source: "none",
    transitionId: null,
    visualPolicy: "none",
  };
}

function getPdfStageInlineMargin({
  align,
  availableInlineSize,
  stageWidth,
}: {
  align: FileViewerRendererFrame["align"];
  availableInlineSize: number;
  stageWidth: number;
}): number {
  switch (align) {
    case "start":
      return 0;
    case "end":
      return Math.max(0, availableInlineSize - stageWidth);
    case "center":
      return Math.max(0, (availableInlineSize - stageWidth) / 2);
  }
}

function formatPdfMotionPixel(value: number) {
  return formatFinitePdfMotionNumber(value, 3);
}

function formatPdfMotionScale(value: number) {
  return formatFinitePdfMotionNumber(value, 6);
}

function formatFinitePdfMotionNumber(value: number, fractionDigits: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(fractionDigits));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function getPdfPreparedFitWidthRenderScale({
  enabled,
  fallbackScale,
  frozenInlineSize,
  isSliding,
  pageWidth,
  rasterInlineSize,
}: {
  enabled: boolean;
  fallbackScale: number;
  frozenInlineSize: number | null;
  isSliding: boolean;
  pageWidth: number;
  rasterInlineSize: number | null;
}) {
  if (!enabled || rasterInlineSize == null) return fallbackScale;

  // Rasterizing at the slide-target width competes with the motion kernel's
  // rAF loop for the main thread and stalls the slide, so the render scale
  // stays pinned to the frozen pre-slide width until settle adopts the
  // prepared raster size.
  if (isSliding && frozenInlineSize != null) {
    return getPdfFitWidthScale(frozenInlineSize, pageWidth, 0);
  }

  return getPdfFitWidthScale(rasterInlineSize, pageWidth, 0);
}
