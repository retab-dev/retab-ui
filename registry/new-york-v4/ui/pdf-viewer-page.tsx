import * as React from "react";

import { readPdfPageResource } from "@/lib/pdf-document-resource";
import type { PdfDocumentProxy } from "@/lib/pdf-document-types";

import { getPdfCanvasPixelSize } from "./pdf-viewer-canvas";
import {
  readPdfRenderedPageCache,
  writePdfRenderedPageCache,
  type PdfRenderedPageCache,
  type PdfRenderedPageSignature,
} from "./pdf-viewer-render-cache";
import { toPdfRenderFailedError } from "./pdf-viewer-render-error";
import type {
  PageOverlayProps,
  PdfPageRenderStatus,
  PdfPageRenderTiming,
  PdfPageSize,
} from "./pdf-viewer-types";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

type PdfRenderedPage = PdfRenderedPageSignature;

type PdfPageProps = {
  document: PdfDocumentProxy;
  documentKey: string;
  pageNumber: number;
  scale: number;
  rotation: number;
  devicePixelRatio: number;
  renderCache?: PdfRenderedPageCache;
  renderOverlay?: (props: PageOverlayProps) => React.ReactNode;
  onRenderTiming?: (timing: PdfPageRenderTiming) => void;
  onSize?: (pageNumber: number, size: PdfPageSize) => void;
};

export const PdfPage = React.memo(function PdfPage({
  document,
  documentKey,
  pageNumber,
  scale,
  rotation,
  devicePixelRatio,
  renderCache,
  renderOverlay,
  onRenderTiming,
  onSize,
}: PdfPageProps) {
  const page = readPdfPageResource(document, pageNumber);
  const intrinsicViewport = React.useMemo(
    () => page.getViewport({ scale: 1, rotation: page.rotate ?? 0 }),
    [page],
  );

  useKeyedMountEffect(
    joinEffectKey([
      intrinsicViewport.height,
      intrinsicViewport.width,
      onSize,
      pageNumber,
    ]),
    () => {
      onSize?.(pageNumber, {
        width: intrinsicViewport.width,
        height: intrinsicViewport.height,
      });
    },
  );

  const viewport = React.useMemo(
    () =>
      page.getViewport({
        scale,
        rotation: ((page.rotate ?? 0) + rotation) % 360,
      }),
    [page, rotation, scale],
  );
  const [renderError, setRenderError] = React.useState<unknown>(null);
  if (renderError) throw renderError;

  const renderedPageRef = React.useRef<PdfRenderedPage | null>(null);

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const renderSignature = {
        documentKey,
        pageNumber,
        scale,
        rotation,
        devicePixelRatio,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      } satisfies PdfRenderedPage;
      if (
        renderedPageRef.current &&
        areRenderedPagesEqual(renderedPageRef.current, renderSignature)
      ) {
        return;
      }

      const startedAt = readNow();
      const reportRenderTiming = (
        status: PdfPageRenderStatus,
        source?: PdfPageRenderTiming["source"],
      ) => {
        onRenderTiming?.({
          pageNumber,
          scale,
          rotation,
          devicePixelRatio,
          status,
          source,
          durationMs: Math.max(0, readNow() - startedAt),
        });
      };
      const context = canvas.getContext("2d");
      if (!context) {
        markCanvasRenderStatus(canvas, renderSignature, "failed");
        reportRenderTiming("failed");
        setRenderError(
          toPdfRenderFailedError(new Error("Canvas 2D context unavailable.")),
        );
        return;
      }

      const canvasWidth = getPdfCanvasPixelSize(
        renderSignature.viewportWidth,
        devicePixelRatio,
      );
      const canvasHeight = getPdfCanvasPixelSize(
        renderSignature.viewportHeight,
        devicePixelRatio,
      );
      const cachedPage = readPdfRenderedPageCache(renderCache, renderSignature);
      const previousCanvas =
        cachedPage == null ? copyCanvasContents(canvas) : null;

      resizeCanvas(canvas, canvasWidth, canvasHeight);
      if (cachedPage) {
        drawCanvasImage(context, cachedPage.canvas, canvasWidth, canvasHeight);
        renderedPageRef.current = renderSignature;
        markCanvasRenderStatus(canvas, renderSignature, "rendered", "cache");
        reportRenderTiming("rendered", "cache");
      } else {
        if (previousCanvas) {
          drawCanvasImage(context, previousCanvas, canvasWidth, canvasHeight);
        }
        markCanvasRenderStatus(canvas, renderSignature, "pending");
      }

      let renderTask: ReturnType<typeof page.render>;
      try {
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform:
            devicePixelRatio !== 1
              ? [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
              : undefined,
        });
      } catch (error) {
        markCanvasRenderStatus(canvas, renderSignature, "failed");
        reportRenderTiming("failed");
        setRenderError(toPdfRenderFailedError(error));
        return;
      }
      let isActive = true;
      let didFinishPdfRender = false;
      renderTask.promise.then(
        () => {
          if (!isActive) return;
          didFinishPdfRender = true;
          renderedPageRef.current = renderSignature;
          writePdfRenderedPageCache({
            cache: renderCache,
            rendered: renderSignature,
            sourceCanvas: canvas,
          });
          markCanvasRenderStatus(canvas, renderSignature, "rendered", "pdfjs");
          reportRenderTiming("rendered", "pdfjs");
        },
        (error) => {
          if (!isActive) return;
          didFinishPdfRender = true;
          markCanvasRenderStatus(canvas, renderSignature, "failed");
          reportRenderTiming("failed");
          setRenderError(toPdfRenderFailedError(error));
        },
      );
      return () => {
        isActive = false;
        if (!didFinishPdfRender) {
          renderTask.cancel();
        }
        if (!didFinishPdfRender && !cachedPage) {
          markCanvasRenderStatus(canvas, renderSignature, "cancelled");
          reportRenderTiming("cancelled");
        }
      };
    },
    [
      devicePixelRatio,
      documentKey,
      onRenderTiming,
      page,
      pageNumber,
      renderCache,
      rotation,
      scale,
      viewport,
    ],
  );

  return (
    <div
      className="ring-border relative shadow-sm ring-1"
      style={{ width: viewport.width, height: viewport.height }}
      data-slot="pdf-page"
      data-page={pageNumber}
    >
      <canvas
        ref={canvasRef}
        style={{ width: viewport.width, height: viewport.height }}
        className="block bg-white"
      />
      {renderOverlay ? (
        <div className="pointer-events-none absolute inset-0">
          {renderOverlay({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            scale,
            rotation,
          })}
        </div>
      ) : null}
    </div>
  );
}, arePdfPagePropsEqual);

function arePdfPagePropsEqual(previous: PdfPageProps, next: PdfPageProps) {
  return (
    previous.document === next.document &&
    previous.documentKey === next.documentKey &&
    previous.pageNumber === next.pageNumber &&
    previous.scale === next.scale &&
    previous.rotation === next.rotation &&
    previous.devicePixelRatio === next.devicePixelRatio &&
    previous.renderCache === next.renderCache &&
    previous.renderOverlay === next.renderOverlay &&
    previous.onRenderTiming === next.onRenderTiming &&
    previous.onSize === next.onSize
  );
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function copyCanvasContents(canvas: HTMLCanvasElement) {
  if (canvas.width <= 0 || canvas.height <= 0) return null;

  const snapshot = document.createElement("canvas");
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  const context = snapshot.getContext("2d");
  if (!context || typeof context.drawImage !== "function") return null;

  context.drawImage(canvas, 0, 0);
  return snapshot;
}

function drawCanvasImage(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  width: number,
  height: number,
) {
  if (typeof context.setTransform === "function") {
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (typeof context.drawImage === "function") {
    context.drawImage(image, 0, 0, width, height);
  }
}

function markCanvasRenderStatus(
  canvas: HTMLCanvasElement,
  rendered: PdfRenderedPage,
  status: "pending" | PdfPageRenderStatus,
  source?: PdfPageRenderTiming["source"],
) {
  canvas.dataset.pdfPageNumber = String(rendered.pageNumber);
  canvas.dataset.pdfRenderStatus = status;
  if (source) {
    canvas.dataset.pdfRenderSource = source;
  } else {
    delete canvas.dataset.pdfRenderSource;
  }
}

function areRenderedPagesEqual(
  rendered: PdfRenderedPage,
  requested: PdfRenderedPage,
) {
  return (
    rendered.pageNumber === requested.pageNumber &&
    rendered.documentKey === requested.documentKey &&
    rendered.scale === requested.scale &&
    rendered.rotation === requested.rotation &&
    rendered.devicePixelRatio === requested.devicePixelRatio &&
    rendered.viewportWidth === requested.viewportWidth &&
    rendered.viewportHeight === requested.viewportHeight
  );
}

function readNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
