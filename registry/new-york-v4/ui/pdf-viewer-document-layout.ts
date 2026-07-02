"use client";

import * as React from "react";

import {
  useOptionalFileViewerRendererEnvironment,
  useOptionalFileViewerRendererFrame,
} from "./file-viewer-renderer-frame";
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
  setPageSize: ReturnType<typeof usePdfPageSizes>["setPageSize"];
  transition: ViewerDocumentTransition;
  visualScale: number;
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
  const visualScale =
    isFitWidth && rendererFrame.isTransitioning && displayScale > 0
      ? getPdfFitWidthScale(rendererFrame.layoutInlineSize, fitPageWidth, 0) /
        displayScale
      : 1;
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
    setPageSize,
    transition,
    visualScale,
    rendererFrame,
    zoomIn,
    zoomOut,
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
