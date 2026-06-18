"use client"

import * as React from "react"

import {
  PdfViewer,
  type PdfPageRenderTiming,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"

const BENCHMARK_PAGE_COUNT = 585
const BENCHMARK_PDF_SRC = "/samples/big-911-report.pdf"
const BENCHMARK_JUMP_PAGES = [50, 200, 400, 585] as const

type PdfViewerBenchmarkSnapshot = {
  canvasCount: number
  clientHeight: number
  currentPageText: string
  pageSlotCount: number
  renderTimings: PdfPageRenderTiming[]
  scrollHeight: number
  scrollTop: number
  slotPages: number[]
}

type PdfViewerBenchmarkJumpResult = PdfViewerBenchmarkSnapshot & {
  elapsedMs: number
  pageNumber: number
}

declare global {
  interface Window {
    __pdfViewerBenchmark?: {
      jumpToPage: (pageNumber: number) => Promise<PdfViewerBenchmarkJumpResult>
      snapshot: () => PdfViewerBenchmarkSnapshot
    }
  }
}

const pdfViewerBenchmarkRenderTimings: PdfPageRenderTiming[] = []

export function PdfViewerBenchmarkClient() {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const [resultJson, setResultJson] = React.useState("")

  React.useEffect(() => {
    clearPdfViewerBenchmarkRenderTimings()
    const benchmark = {
      snapshot: readSnapshot,
      jumpToPage: (pageNumber: number) =>
        jumpToPage(viewerRef.current, pageNumber),
    }

    window.__pdfViewerBenchmark = benchmark
    return () => {
      if (window.__pdfViewerBenchmark === benchmark) {
        window.__pdfViewerBenchmark = undefined
      }
    }
  }, [])

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
          onClick={() => setResultJson(JSON.stringify(readSnapshot()))}
        />
        {BENCHMARK_JUMP_PAGES.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            tabIndex={-1}
            className="size-px"
            data-testid={`pdf-benchmark-jump-${pageNumber}`}
            onClick={() => {
              void jumpToPage(viewerRef.current, pageNumber).then((result) =>
                setResultJson(JSON.stringify(result))
              )
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
  )
}

function jumpToPage(
  viewer: PdfViewerHandle | null,
  pageNumber: number
): Promise<PdfViewerBenchmarkJumpResult> {
  const targetPage = Math.min(
    BENCHMARK_PAGE_COUNT,
    Math.max(1, Math.round(pageNumber))
  )
  clearPdfViewerBenchmarkRenderTimings()
  const startedAt = performance.now()
  viewer?.scrollToPage(targetPage, { behavior: "auto" })

  return new Promise((resolve) => {
    const deadline = performance.now() + 10_000

    function measure() {
      const snapshot = readSnapshot()
      const hasTargetSlot = snapshot.slotPages.includes(targetPage)
      const hasRenderedTargetPage = snapshot.renderTimings.some(
        (timing) =>
          timing.pageNumber === targetPage && timing.status === "rendered"
      )

      if (
        (hasTargetSlot && hasRenderedTargetPage) ||
        performance.now() > deadline
      ) {
        resolve({
          ...snapshot,
          elapsedMs: Math.round(performance.now() - startedAt),
          pageNumber: targetPage,
        })
        return
      }

      requestAnimationFrame(measure)
    }

    requestAnimationFrame(measure)
  })
}

function readSnapshot(): PdfViewerBenchmarkSnapshot {
  const viewport = document.querySelector<HTMLElement>(
    "[data-slot='scroll-area-viewport']"
  )
  const slots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-slot='pdf-page-slot']")
  )
  const currentPageText =
    document
      .querySelector("[data-slot='viewer-controls']")
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? ""

  return {
    canvasCount: document.querySelectorAll("canvas").length,
    clientHeight: viewport?.clientHeight ?? 0,
    currentPageText,
    pageSlotCount: slots.length,
    renderTimings: [...pdfViewerBenchmarkRenderTimings],
    scrollHeight: viewport?.scrollHeight ?? 0,
    scrollTop: viewport?.scrollTop ?? 0,
    slotPages: slots.map((slot) => Number(slot.dataset.pageNumber)),
  }
}

function recordPdfViewerBenchmarkRenderTiming(timing: PdfPageRenderTiming) {
  pdfViewerBenchmarkRenderTimings.push(timing)
}

function clearPdfViewerBenchmarkRenderTimings() {
  pdfViewerBenchmarkRenderTimings.length = 0
}
