"use client";

import { useRef, useState } from "react";
import type { pdfjs as PdfjsType } from "react-pdf";
import { getReactPdfComponents } from "@/app/dashboard/shared/pdf-utils";
import { useMountEffect } from "@/hooks/useMountEffect";

type Props = { url: string };

function PdfJsLoaderRunner({
  setPdfjs,
}: {
  setPdfjs: (pdfjs: typeof PdfjsType | null) => void;
}) {
  useMountEffect(() => {
    let cancelled = false;
    getReactPdfComponents().then(({ pdfjs }) => {
      if (!cancelled) {
        setPdfjs(pdfjs);
      }
    });
    return () => {
      cancelled = true;
    };
  });

  return null;
}

function SinglePagePdfRenderRunner({
  url,
  pdfjs,
  containerRef,
}: {
  url: string;
  pdfjs: typeof PdfjsType;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  useMountEffect(() => {
    let pdf: PdfjsType.PDFDocumentProxy | null = null;
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    void (async () => {
      try {
        const loadingTask = pdfjs.getDocument(url);
        pdf = await loadingTask.promise;

        if (cancelled) {
          try {
            pdf?.destroy?.();
          } catch {}
          return;
        }

        container.innerHTML = "";

        if (pdf.numPages < 1) return;

        const dpr = window.devicePixelRatio || 1;
        const page = await pdf.getPage(1);

        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth = container.clientWidth || baseViewport.width;
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = "block";
        canvas.oncontextmenu = (e) => e.preventDefault();
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d")!;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const isWorkerError =
          errorMessage.includes("sendWithPromise") ||
          errorMessage.includes("worker") ||
          errorMessage.includes("Worker") ||
          errorMessage.includes("destroyed") ||
          errorMessage.includes("null");

        if (!isWorkerError && !cancelled) {
          console.error("PDF loading error:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      container.innerHTML = "";
      const pdfToCleanup = pdf;
      pdf = null;
      setTimeout(() => {
        try {
          pdfToCleanup?.destroy?.();
        } catch {}
      }, 0);
    };
  });

  return null;
}

export default function PdfViewerNoToolbar({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfjs, setPdfjs] = useState<typeof PdfjsType | null>(null);

  return (
    <>
      <PdfJsLoaderRunner setPdfjs={setPdfjs} />
      {pdfjs ? (
        <SinglePagePdfRenderRunner
          key={url}
          url={url}
          pdfjs={pdfjs}
          containerRef={containerRef}
        />
      ) : null}
      <div
        ref={containerRef}
        className="h-full w-full max-w-full overflow-hidden bg-white"
        style={{ lineHeight: 0, userSelect: "none" }}
      />
    </>
  );
}
