"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer"
import {
  ImageViewer,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"
import { PdfViewer, type PdfViewerHandle } from "@/components/ui/pdf-viewer"
import { PptxViewer } from "@/components/ui/pptx-viewer"
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer"
import { XlsxViewer, type XlsxViewerHandle } from "@/components/ui/xlsx-viewer"
import {
  buildScrollTargets,
  getScenarioStepPx,
  measuredScrollDistance,
  normalizeViewerId,
  resolveScenario,
  SCENARIOS,
  summarizeFrameDurations,
  VIEWERS,
  type ScenarioDefinition,
  type ScenarioResult,
  type ScrollBenchResult,
  type ViewerId,
} from "./scrollbench-core"

type ViewportHandle =
  | PdfViewerHandle
  | CsvViewerHandle
  | XlsxViewerHandle
  | TextViewerHandle
  | DocxViewerHandle
  | ImageViewerHandle

type RunStatus = "idle" | "running" | "done" | "failed"

interface ScrollBenchController {
  getScroller: () => HTMLElement | null
  run: () => Promise<ScrollBenchResult>
  runScenario: (scenarioId: ScenarioDefinition["id"]) => Promise<ScenarioResult>
}

declare global {
  interface Window {
    __scrollbench?: ScrollBenchController
  }
}

export function ScrollBenchClient({
  initialViewer,
}: {
  initialViewer?: string
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const viewportHandleRef = React.useRef<ViewportHandle | null>(null)
  const runAbortRef = React.useRef<AbortController | null>(null)

  const [viewer, setViewer] = React.useState<ViewerId>(() =>
    normalizeViewerId(initialViewer ?? null)
  )
  const [status, setStatus] = React.useState<RunStatus>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ScrollBenchResult | null>(null)

  const csvValue = React.useMemo(() => createScrollBenchCsv(), [])
  const textValue = React.useMemo(() => createScrollBenchText(), [])

  const setViewportHandle = React.useCallback(
    (handle: ViewportHandle | null) => {
      viewportHandleRef.current = handle
    },
    []
  )

  const getScroller = React.useCallback(() => {
    return (
      viewportHandleRef.current?.getViewportElement() ??
      findScrollableViewport(rootRef.current)
    )
  }, [])

  const runScenario = React.useCallback(
    async (scenarioId: ScenarioDefinition["id"]) => {
      const scenario = resolveScenario(scenarioId)
      if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`)

      const scroller = await waitForScroller(getScroller)
      return measureScenario(scroller, scenario, {})
    },
    [getScroller]
  )

  const run = React.useCallback(async () => {
    runAbortRef.current?.abort()
    const abortController = new AbortController()
    runAbortRef.current = abortController

    setStatus("running")
    setError(null)
    setResult(null)

    try {
      const scroller = await waitForScroller(getScroller, {
        signal: abortController.signal,
      })
      const scenarios: ScenarioResult[] = []

      for (const scenario of SCENARIOS) {
        scenarios.push(
          await measureScenario(scroller, scenario, {
            signal: abortController.signal,
          })
        )
      }

      const nextResult: ScrollBenchResult = {
        viewer,
        measuredAt: new Date().toISOString(),
        viewport: viewportMetrics(scroller),
        scenarios,
      }
      if (!abortController.signal.aborted) {
        setResult(nextResult)
        setStatus("done")
      }
      return nextResult
    } catch (caught) {
      if (isAbortError(caught)) throw caught

      const message =
        caught instanceof Error ? caught.message : "Scrollbench failed"
      setError(message)
      setStatus("failed")
      throw caught
    } finally {
      if (runAbortRef.current === abortController) runAbortRef.current = null
    }
  }, [getScroller, viewer])

  React.useEffect(() => {
    runAbortRef.current?.abort()
    viewportHandleRef.current = null
    setResult(null)
    setError(null)
    setStatus("idle")
    writeViewerToUrl(viewer)
  }, [viewer])

  React.useEffect(() => {
    window.__scrollbench = { getScroller, run, runScenario }
    return () => {
      if (window.__scrollbench?.run === run) delete window.__scrollbench
    }
  }, [getScroller, run, runScenario])

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("autorun") === "1") {
      void run().catch(() => undefined)
    }
  }, [run])

  return (
    <main
      className="flex h-svh min-h-0 flex-col bg-background text-foreground"
      data-testid="scrollbench"
    >
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b bg-background px-3 py-2">
        <div className="mr-2 min-w-0">
          <h1 className="text-sm leading-5 font-semibold">Scrollbench</h1>
          <p className="text-xs text-muted-foreground">
            Normalized small and large jump FPS across viewer scrollports.
          </p>
        </div>

        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Viewer
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={viewer}
            onChange={(event) => setViewer(event.target.value as ViewerId)}
            data-testid="scrollbench-viewer-select"
          >
            {VIEWERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={status === "running"}
          onClick={() => void run().catch(() => undefined)}
          data-testid="scrollbench-run"
        >
          {status === "running" ? "Running" : "Run"}
        </button>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] max-lg:grid-cols-1">
        <div
          ref={rootRef}
          className="min-h-0 min-w-0"
          data-scrollbench-viewer={viewer}
        >
          {renderViewer({
            viewer,
            csvValue,
            textValue,
            setViewportHandle,
          })}
        </div>

        <aside className="flex min-h-0 flex-col gap-3 border-l bg-muted/20 p-3 max-lg:h-64 max-lg:border-t max-lg:border-l-0">
          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Fixture
            </div>
            <div className="mt-1 text-sm">
              {VIEWERS.find((option) => option.id === viewer)?.sample}
            </div>
          </div>

          <MetricPanel result={result} status={status} error={error} />
        </aside>
      </section>
    </main>
  )
}

function renderViewer({
  viewer,
  csvValue,
  textValue,
  setViewportHandle,
}: {
  viewer: ViewerId
  csvValue: string
  textValue: string
  setViewportHandle: (handle: ViewportHandle | null) => void
}) {
  const viewerClassName = "h-full rounded-none border-0"

  switch (viewer) {
    case "pdf":
      return (
        <PdfViewer
          ref={setViewportHandle as React.Ref<PdfViewerHandle>}
          src="/samples/big-911-report.pdf"
          downloadFileName="big-911-report.pdf"
          className={viewerClassName}
          toolbar={false}
          bare
        />
      )
    case "csv":
      return (
        <CsvViewer
          ref={setViewportHandle as React.Ref<CsvViewerHandle>}
          value={csvValue}
          downloadName="scrollbench.csv"
          className={viewerClassName}
          toolbar={false}
          fillHeight
          isolateStyles={false}
        />
      )
    case "xlsx":
      return (
        <XlsxViewer
          ref={setViewportHandle as React.Ref<XlsxViewerHandle>}
          src="/samples/nvidia-financials-fy2024.xlsx"
          downloadFileName="nvidia-financials-fy2024.xlsx"
          className={viewerClassName}
          toolbar={false}
          bare
          isolateStyles={false}
        />
      )
    case "text":
      return (
        <TextViewer
          ref={setViewportHandle as React.Ref<TextViewerHandle>}
          source={{
            kind: "text",
            text: textValue,
            fileName: "scrollbench.log",
            mimeType: "text/plain",
          }}
          className={viewerClassName}
          toolbar={false}
          bare
          maxBytes={4_000_000}
          maxLines={40_000}
        />
      )
    case "docx":
      return (
        <DocxViewer
          ref={setViewportHandle as React.Ref<DocxViewerHandle>}
          src="/samples/quarterly-business-review.docx"
          downloadFileName="quarterly-business-review.docx"
          className={viewerClassName}
          toolbar={false}
          bare
        />
      )
    case "pptx":
      return (
        <PptxViewer
          src="/samples/sample-presentation.pptx"
          downloadFileName="sample-presentation.pptx"
          className={viewerClassName}
          toolbar={false}
          bare
          eager
        />
      )
    case "image":
      return (
        <ImageViewer
          ref={setViewportHandle as React.Ref<ImageViewerHandle>}
          src="/samples/attention-page-1.png"
          downloadFileName="attention-page-1.png"
          className={viewerClassName}
          scale={2}
          toolbar={false}
          bare
        />
      )
  }
}

function MetricPanel({
  result,
  status,
  error,
}: {
  result: ScrollBenchResult | null
  status: RunStatus
  error: string | null
}) {
  if (error) {
    return (
      <div
        className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        data-testid="scrollbench-error"
      >
        {error}
      </div>
    )
  }

  if (!result) {
    return (
      <div
        className="rounded-md border bg-background p-3 text-sm text-muted-foreground"
        data-testid="scrollbench-empty"
      >
        {status === "running"
          ? "Measuring scroll frames..."
          : "Run the benchmark to record FPS."}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="scrollbench-results">
      <div className="grid grid-cols-3 gap-2">
        {result.scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={cn(
              "rounded-md border bg-background p-3",
              scenario.id === "large" ? "col-span-2" : ""
            )}
            data-testid={`scrollbench-${scenario.id}-fps`}
          >
            <div className="text-xs text-muted-foreground">
              {scenario.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatNumber(scenario.fps)}
            </div>
            <div className="text-xs text-muted-foreground">fps</div>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border bg-background p-3 text-xs">
        <Metric label="Viewport" value={`${result.viewport.clientHeight}px`} />
        <Metric
          label="Scrollable"
          value={`${result.viewport.maxScrollTop}px`}
        />
        {result.scenarios.map((scenario) => (
          <React.Fragment key={scenario.id}>
            <Metric
              label={`${scenario.id} p95`}
              value={`${formatNumber(scenario.p95FrameMs)}ms`}
            />
            <Metric
              label={`${scenario.id} >33ms`}
              value={String(scenario.over33)}
            />
          </React.Fragment>
        ))}
      </dl>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </>
  )
}

async function measureScenario(
  scroller: HTMLElement,
  scenario: ScenarioDefinition,
  { signal }: { signal?: AbortSignal }
): Promise<ScenarioResult> {
  throwIfAborted(signal)

  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight
  if (maxScrollTop <= 0) {
    throw new Error("The selected viewer does not have a scrollable viewport.")
  }

  const stepPx = getScenarioStepPx({
    clientHeight: scroller.clientHeight,
    scenario,
  })
  const targets = buildScrollTargets({ maxScrollTop, stepPx })
  const frameDurations: number[] = []

  scroller.scrollTop = 0
  await nextFrame(signal)
  await nextFrame(signal)

  let previous = performance.now()

  for (const target of targets) {
    throwIfAborted(signal)
    scroller.scrollTop = target
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }))

    await nextFrame(signal)
    const now = performance.now()
    frameDurations.push(now - previous)
    previous = now
  }

  await nextFrame(signal)

  return summarizeFrameDurations({
    scenario,
    frameDurations,
    stepPx,
    distancePx: measuredScrollDistance(targets),
  })
}

function findScrollableViewport(root: HTMLElement | null) {
  if (!root) return null

  const candidates = root.querySelectorAll<HTMLElement>(
    [
      '[data-slot="csv-body"]',
      '[data-slot="xlsx-body"]',
      '[data-slot="scroll-area-viewport"]',
      '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
      '[data-slot="docx-viewer"] [data-slot="scroll-area-viewport"]',
      '[data-slot="image-viewer"] [data-slot="scroll-area-viewport"]',
    ].join(",")
  )

  for (const candidate of candidates) {
    if (candidate.scrollHeight > candidate.clientHeight) return candidate
  }

  const allElements = root.querySelectorAll<HTMLElement>("*")
  for (const element of allElements) {
    const style = window.getComputedStyle(element)
    const canScrollY = /(auto|scroll)/.test(style.overflowY)
    if (canScrollY && element.scrollHeight > element.clientHeight) {
      return element
    }
  }

  return null
}

async function waitForScroller(
  getScroller: () => HTMLElement | null,
  {
    signal,
    timeoutMs = 12_000,
  }: {
    signal?: AbortSignal
    timeoutMs?: number
  } = {}
) {
  const start = performance.now()
  let scroller = getScroller()

  while (
    (!scroller || scroller.scrollHeight <= scroller.clientHeight) &&
    performance.now() - start < timeoutMs
  ) {
    throwIfAborted(signal)
    await delay(100, signal)
    scroller = getScroller()
  }

  if (!scroller) {
    throw new Error("Could not find a viewer scrollport.")
  }

  if (scroller.scrollHeight <= scroller.clientHeight) {
    throw new Error("The viewer scrollport is not scrollable yet.")
  }

  return scroller
}

function viewportMetrics(scroller: HTMLElement) {
  return {
    clientHeight: scroller.clientHeight,
    scrollHeight: scroller.scrollHeight,
    maxScrollTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
  }
}

function nextFrame(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    const frame = requestAnimationFrame(() => {
      signal?.removeEventListener("abort", handleAbort)
      resolve()
    })
    const handleAbort = () => {
      cancelAnimationFrame(frame)
      reject(abortError())
    }

    signal?.addEventListener("abort", handleAbort, { once: true })
  })
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort)
      resolve()
    }, ms)
    const handleAbort = () => {
      window.clearTimeout(timeout)
      reject(abortError())
    }

    signal?.addEventListener("abort", handleAbort, { once: true })
  })
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError()
}

function abortError() {
  return new DOMException("Scrollbench run was cancelled.", "AbortError")
}

function isAbortError(caught: unknown) {
  return caught instanceof DOMException && caught.name === "AbortError"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)
}

function writeViewerToUrl(viewer: ViewerId) {
  const url = new URL(window.location.href)
  url.searchParams.set("viewer", viewer)
  window.history.replaceState(null, "", url)
}

function createScrollBenchCsv() {
  const headers = Array.from(
    { length: 18 },
    (_, index) => `metric_${index + 1}`
  )
  const rows = Array.from({ length: 20_000 }, (_, rowIndex) =>
    headers
      .map((_, columnIndex) =>
        String((rowIndex + 1) * (columnIndex + 3) + (columnIndex % 7))
      )
      .join(",")
  )
  return [headers.join(","), ...rows].join("\n")
}

function createScrollBenchText() {
  return Array.from({ length: 30_000 }, (_, lineIndex) => {
    const sequence = String(lineIndex + 1).padStart(5, "0")
    const latency = 20 + ((lineIndex * 13) % 300)
    const worker = `worker-${(lineIndex % 16) + 1}`
    return `${sequence} ${worker} processed scrollbench event in ${latency}ms`
  }).join("\n")
}
