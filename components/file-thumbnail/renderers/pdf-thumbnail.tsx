"use client";

import * as React from "react";

import type { PdfDocumentProxy } from "@/lib/pdf-document-types";
import {
  getPdfDocumentResource,
  getPdfPageResource,
} from "@/lib/pdf-document-resource";
import { cn } from "@/lib/utils";
import type { ViewerResource } from "@/lib/viewer-resource";
import { withThumbnailFormatError } from "@/components/file-thumbnail/thumbnail-errors";
import { useThumbnailResource } from "@/components/file-thumbnail/thumbnail-resource";
import type { ThumbnailAnchor } from "@/components/file-thumbnail/types";
import { ANCHOR_CORNER } from "@/components/file-thumbnail/types";

// Page 1 via pdfjs, reusing the PdfViewer's cached document.
export function PdfFirstPage({
  resource,
  anchor,
}: {
  resource: ViewerResource;
  anchor: ThumbnailAnchor;
}) {
  const doc = useThumbnailResource(
    getPdfDocumentResource(resource.content),
  ) as PdfDocumentProxy;
  const page = useThumbnailResource(getPdfPageResource(doc, 1));
  const [renderError, setRenderError] = React.useState<unknown>(null);

  const RENDER_W = 520;
  const viewport = React.useMemo(() => {
    const base = page.getViewport({ scale: 1 });
    return page.getViewport({ scale: RENDER_W / base.width });
  }, [page]);
  const dpr =
    (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1;

  if (renderError) throw renderError;

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      let active = true;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      const task = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      void withThumbnailFormatError(
        "pdf",
        "render_failed",
        resource.fileName,
        "Failed to render PDF thumbnail",
        () => task.promise,
      ).catch((error: unknown) => {
        if (active) setRenderError(error);
      });
      return () => {
        active = false;
        task.cancel();
      };
    },
    [page, viewport, dpr, resource.fileName],
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className={cn("absolute block w-full", ANCHOR_CORNER[anchor])}
      />
    </div>
  );
}
