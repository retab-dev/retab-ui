"use client";

import * as React from "react";

import {
  useOptionalFileViewerRendererEnvironment,
  useOptionalFileViewerRendererFrame,
} from "./file-viewer-renderer-frame";
import type { FileViewerDocumentSurfaceMotionResolver } from "./file-viewer-motion-kernel";
import {
  resolveFileViewerRendererLayoutInlineSize,
  type FileViewerRendererFrame,
} from "./file-viewer-renderer-contract";
import { createFileViewerFitWidthSurfaceMotionResolver } from "./file-viewer-fit-width-motion";
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
    pageWidth: fitPageWidth,
    rasterInlineSize: getPdfPreparedFitWidthRasterInlineSize(rendererFrame),
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
  // The page layout is already at the motion's target width (commit-then-
  // relax), so the resolver reprojects that settled stage to the in-flight
  // visual width with one uniform transform.
  const resolveSurfaceMotionStyle =
    React.useMemo<FileViewerDocumentSurfaceMotionResolver>(
      () =>
        createFileViewerFitWidthSurfaceMotionResolver({
          align: rendererFrame.align,
          isFitWidth,
          stageInlineSize: pageLayout.maxPageWidth,
        }),
      [isFitWidth, pageLayout.maxPageWidth, rendererFrame.align],
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
  pageWidth,
  rasterInlineSize,
}: {
  enabled: boolean;
  fallbackScale: number;
  pageWidth: number;
  rasterInlineSize: number | null;
}) {
  if (!enabled || rasterInlineSize == null) return fallbackScale;

  // The CSS page frame stays frozen during shell motion; this prepares the
  // backing canvas for the largest start/current/target width without forcing a
  // visible layout resize or blanking the old canvas while the render is pending.
  return getPdfFitWidthScale(rasterInlineSize, pageWidth, 0);
}

function getPdfPreparedFitWidthRasterInlineSize(
  rendererFrame: FileViewerRendererFrame,
) {
  if (!rendererFrame.canToggleSidebar) return rendererFrame.rasterInlineSize;

  const inlineSize = Math.max(
    rendererFrame.rasterInlineSize ?? 0,
    rendererFrame.shellInlineSize ?? 0,
  );

  return inlineSize > 0 ? inlineSize : null;
}
