"use client";

import * as React from "react";

import {
  PdfViewer,
  type PdfPageRenderTiming,
  type PdfViewerHandle,
  type PdfViewerPerformanceOptions,
} from "@/components/ui/pdf-viewer";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

const BENCHMARK_PAGE_COUNT = 585;
const BENCHMARK_PDF_SRC = "/samples/big-911-report.pdf";
const BENCHMARK_JUMP_PAGES = [
  50, 56, 50, 51, 52, 200, 206, 200, 201, 400, 406, 400, 401, 585,
] as const;

type PdfViewerBenchmarkSnapshot = {
  canvasCount: number;
  clientHeight: number;
  currentPageText: string;
  pageSlotCount: number;
  performanceOptions: PdfViewerPerformanceOptions;
  renderSummary: PdfViewerBenchmarkRenderSummary;
  renderTimings: PdfPageRenderTiming[];
  renderedPages: number[];
  scrollHeight: number;
  scrollTop: number;
  slotPages: number[];
  variant: string;
};

type PdfViewerBenchmarkJumpResult = PdfViewerBenchmarkSnapshot & {
  elapsedMs: number;
  pageNumber: number;
};

type PdfViewerBenchmarkRenderSummary = {
  cacheHitCount: number;
  cancelledCount: number;
  failedCount: number;
  pdfRenderCount: number;
  renderedCount: number;
  totalDurationMs: number;
  totalCount: number;
};

type PdfViewerBenchmarkClientProps = {
  performanceOptions: PdfViewerPerformanceOptions;
  variant: string;
};

declare global {
  interface Window {
    __pdfViewerBenchmark?: {
      jumpToPage: (pageNumber: number) => Promise<PdfViewerBenchmarkJumpResult>;
      jumpPages: readonly number[];
      runJumpSequence: (
        pageNumbers?: readonly number[],
        options?: PdfViewerBenchmarkRunOptions,
      ) => Promise<PdfViewerBenchmarkJumpResult[]>;
      snapshot: () => PdfViewerBenchmarkSnapshot;
      variant: string;
    };
  }
}

const pdfViewerBenchmarkRenderTimings: PdfPageRenderTiming[] = [];

type PdfViewerBenchmarkRunOptions = {
  settleMs?: number;
};

export function PdfViewerBenchmarkClient({
  performanceOptions,
  variant,
}: PdfViewerBenchmarkClientProps) {
  const viewerRef = React.useRef<PdfViewerHandle>(null);
  const [resultJson, setResultJson] = React.useState("");

  useKeyedMountEffect(joinEffectKey([performanceOptions, variant]), () => {
    clearPdfViewerBenchmarkRenderTimings();
    const benchmark = {
      jumpPages: BENCHMARK_JUMP_PAGES,
      snapshot: () => readSnapshot({ performanceOptions, variant }),
      jumpToPage: (pageNumber: number) =>
        jumpToPage(viewerRef.current, pageNumber, {
          performanceOptions,
          variant,
        }),
      runJumpSequence: (
        pageNumbers: readonly number[] = BENCHMARK_JUMP_PAGES,
        runOptions?: PdfViewerBenchmarkRunOptions,
      ) =>
        runJumpSequence(viewerRef.current, pageNumbers, {
          performanceOptions,
          runOptions,
          variant,
        }),
      variant,
    };

    window.__pdfViewerBenchmark = benchmark;
    return () => {
      if (window.__pdfViewerBenchmark === benchmark) {
        window.__pdfViewerBenchmark = undefined;
      }
    };
  });

  return (
    <main className="h-svh min-h-0" data-testid="pdf-viewer-benchmark">
      <PdfViewer
        ref={viewerRef}
        source={{
          kind: "url",
          url: BENCHMARK_PDF_SRC,
          fileName: "big-911-report.pdf",
        }}
        className="h-full"
        bare
        onPageRenderTiming={recordPdfViewerBenchmarkRenderTiming}
        performanceOptions={performanceOptions}
      />
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 z-50 flex gap-px opacity-0"
      >
        <button
          type="button"
          tabIndex={-1}
          className="size-px"
          data-testid="pdf-benchmark-snapshot"
          onClick={() =>
            setResultJson(
              JSON.stringify(readSnapshot({ performanceOptions, variant })),
            )
          }
        />
        {BENCHMARK_JUMP_PAGES.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            tabIndex={-1}
            className="size-px"
            data-testid={`pdf-benchmark-jump-${pageNumber}`}
            onClick={() => {
              void jumpToPage(viewerRef.current, pageNumber, {
                performanceOptions,
                variant,
              }).then((result) => setResultJson(JSON.stringify(result)));
            }}
          />
        ))}
        <output
          className="size-px"
          data-testid="pdf-benchmark-result"
          data-result={resultJson}
        />
      </div>
    </main>
  );
}

function jumpToPage(
  viewer: PdfViewerHandle | null,
  pageNumber: number,
  options: {
    performanceOptions: PdfViewerPerformanceOptions;
    variant: string;
  },
): Promise<PdfViewerBenchmarkJumpResult> {
  const targetPage = Math.min(
    BENCHMARK_PAGE_COUNT,
    Math.max(1, Math.round(pageNumber)),
  );
  clearPdfViewerBenchmarkRenderTimings();
  const startedAt = performance.now();
  viewer?.scrollToPage(targetPage, { behavior: "auto" });

  return new Promise((resolve) => {
    const deadline = performance.now() + 10_000;

    function measure() {
      const snapshot = readSnapshot(options);
      const hasTargetSlot = snapshot.slotPages.includes(targetPage);
      const hasRenderedTargetPage =
        snapshot.renderedPages.includes(targetPage) ||
        snapshot.renderTimings.some(
          (timing) =>
            timing.pageNumber === targetPage && timing.status === "rendered",
        );

      if (
        (hasTargetSlot && hasRenderedTargetPage) ||
        performance.now() > deadline
      ) {
        resolve({
          ...snapshot,
          elapsedMs: Math.round(performance.now() - startedAt),
          pageNumber: targetPage,
        });
        return;
      }

      requestAnimationFrame(measure);
    }

    requestAnimationFrame(measure);
  });
}

async function runJumpSequence(
  viewer: PdfViewerHandle | null,
  pageNumbers: readonly number[],
  options: {
    performanceOptions: PdfViewerPerformanceOptions;
    runOptions?: PdfViewerBenchmarkRunOptions;
    variant: string;
  },
) {
  const results: PdfViewerBenchmarkJumpResult[] = [];
  for (const pageNumber of pageNumbers) {
    results.push(await jumpToPage(viewer, pageNumber, options));
    const settleMs = options.runOptions?.settleMs ?? 0;
    if (settleMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, settleMs));
    }
  }
  return results;
}

function readSnapshot({
  performanceOptions,
  variant,
}: {
  performanceOptions: PdfViewerPerformanceOptions;
  variant: string;
}): PdfViewerBenchmarkSnapshot {
  const viewport = document.querySelector<HTMLElement>(
    "[data-slot='scroll-area-viewport']",
  );
  const slots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-slot='pdf-page-slot']"),
  );
  const renderedPages = Array.from(
    document.querySelectorAll<HTMLCanvasElement>(
      "canvas[data-pdf-render-status='rendered']",
    ),
  ).map((canvas) => Number(canvas.dataset.pdfPageNumber));
  const currentPageText = readCurrentPageText();

  return {
    canvasCount: document.querySelectorAll("canvas").length,
    clientHeight: viewport?.clientHeight ?? 0,
    currentPageText,
    pageSlotCount: slots.length,
    performanceOptions,
    renderSummary: summarizeRenderTimings(pdfViewerBenchmarkRenderTimings),
    renderTimings: [...pdfViewerBenchmarkRenderTimings],
    renderedPages,
    scrollHeight: viewport?.scrollHeight ?? 0,
    scrollTop: viewport?.scrollTop ?? 0,
    slotPages: slots.map((slot) => Number(slot.dataset.pageNumber)),
    variant,
  };
}

function readCurrentPageText() {
  const controls = document.querySelector(
    "[data-slot='viewer-controls'], [data-slot='file-viewer-controls']",
  );
  const position =
    controls?.querySelector(":scope > span") ??
    controls?.querySelector(":scope > div > span:last-child");

  return (position ?? controls)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function recordPdfViewerBenchmarkRenderTiming(timing: PdfPageRenderTiming) {
  pdfViewerBenchmarkRenderTimings.push(timing);
}

function clearPdfViewerBenchmarkRenderTimings() {
  pdfViewerBenchmarkRenderTimings.length = 0;
}

function summarizeRenderTimings(
  timings: readonly PdfPageRenderTiming[],
): PdfViewerBenchmarkRenderSummary {
  return timings.reduce<PdfViewerBenchmarkRenderSummary>(
    (summary, timing) => ({
      cacheHitCount:
        summary.cacheHitCount + (timing.source === "cache" ? 1 : 0),
      cancelledCount:
        summary.cancelledCount + (timing.status === "cancelled" ? 1 : 0),
      failedCount: summary.failedCount + (timing.status === "failed" ? 1 : 0),
      pdfRenderCount:
        summary.pdfRenderCount + (timing.source === "pdfjs" ? 1 : 0),
      renderedCount:
        summary.renderedCount + (timing.status === "rendered" ? 1 : 0),
      totalDurationMs: summary.totalDurationMs + timing.durationMs,
      totalCount: summary.totalCount + 1,
    }),
    {
      cacheHitCount: 0,
      cancelledCount: 0,
      failedCount: 0,
      pdfRenderCount: 0,
      renderedCount: 0,
      totalDurationMs: 0,
      totalCount: 0,
    },
  );
}
