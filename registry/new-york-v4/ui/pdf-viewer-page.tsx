import * as React from "react";

import { readPdfPageResource } from "@/lib/pdf-document-resource";
import type { PdfDocumentProxy } from "@/lib/pdf-document-types";

import { getPdfCanvasPixelSize } from "./pdf-viewer-canvas";
import { toPdfRenderFailedError } from "./pdf-viewer-render-error";
import type {
  PageOverlayProps,
  PdfPageRenderStatus,
  PdfPageRenderTiming,
  PdfPageSize,
} from "./pdf-viewer-types";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

type PdfRenderedPage = {
  pageNumber: number;
  scale: number;
  rotation: number;
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
};

export function PdfPage({
  document,
  pageNumber,
  scale,
  rotation,
  devicePixelRatio,
  renderOverlay,
  onRenderTiming,
  onSize,
}: {
  document: PdfDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  devicePixelRatio: number;
  renderOverlay?: (props: PageOverlayProps) => React.ReactNode;
  onRenderTiming?: (timing: PdfPageRenderTiming) => void;
  onSize?: (pageNumber: number, size: PdfPageSize) => void;
}) {
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
      let didReportRenderTiming = false;
      const reportRenderTiming = (
        status: PdfPageRenderStatus,
        source?: PdfPageRenderTiming["source"],
      ) => {
        if (didReportRenderTiming) return;
        didReportRenderTiming = true;
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

      markCanvasRenderStatus(canvas, renderSignature, "pending");
      canvas.width = getPdfCanvasPixelSize(
        renderSignature.viewportWidth,
        devicePixelRatio,
      );
      canvas.height = getPdfCanvasPixelSize(
        renderSignature.viewportHeight,
        devicePixelRatio,
      );
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
      renderTask.promise.then(
        () => {
          if (!isActive) return;
          renderedPageRef.current = renderSignature;
          markCanvasRenderStatus(canvas, renderSignature, "rendered", "pdfjs");
          reportRenderTiming("rendered", "pdfjs");
        },
        (error) => {
          if (!isActive) return;
          markCanvasRenderStatus(canvas, renderSignature, "failed");
          reportRenderTiming("failed");
          setRenderError(toPdfRenderFailedError(error));
        },
      );
      return () => {
        isActive = false;
        if (!didReportRenderTiming) {
          markCanvasRenderStatus(canvas, renderSignature, "cancelled");
          reportRenderTiming("cancelled");
          renderTask.cancel();
        }
      };
    },
    [
      devicePixelRatio,
      onRenderTiming,
      page,
      pageNumber,
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
