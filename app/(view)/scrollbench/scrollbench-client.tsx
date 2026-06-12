"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import { cn } from "@/lib/utils"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer"
import {
  ImageViewer,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"
import { PdfViewer, type PdfViewerHandle } from "@/components/ui/pdf-viewer"
import {
  PptxViewer,
  type PptxSlideRenderTiming,
  type PptxSourceLoadTiming,
} from "@/components/ui/pptx-viewer"
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer"
import { XlsxViewer, type XlsxViewerHandle } from "@/components/ui/xlsx-viewer"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import sampleData from "@/components/json-table/sample/data.json"
import sampleSchema from "@/components/json-table/sample/schema.json"
import { SingleFileTableView } from "@/components/json-table/single-file-table-view"

import {
  normalizeViewerId,
  resolveScenario,
  resolveViewer,
  SCENARIOS,
  summarizeImageRenderTimings,
  VIEWERS,
  type ImageRenderTiming,
  type ScenarioDefinition,
  type ScenarioResult,
  type ScrollBenchResult,
  type SourceLoadTimingResult,
  type ViewerId,
} from "./scrollbench-core"
import {
  findScrollableViewport,
  isAbortError,
  measureScenario,
  viewportMetrics,
  waitForScroller,
} from "./scrollbench-runner"

type ViewportHandle =
  | PdfViewerHandle
  | CsvViewerHandle
  | XlsxViewerHandle
  | TextViewerHandle
  | DocxViewerHandle
  | ImageViewerHandle

type RunStatus = "idle" | "running" | "done" | "failed"

const jsonTableDocument = {
  id: "scrollbench-json",
  data: sampleData as Record<string, unknown>,
} satisfies TableDocument
const jsonTableSchema = sampleSchema as unknown as JSONSchema7

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
  const imageRenderTimingsRef = React.useRef<ImageRenderTiming[]>([])
  const sourceLoadTimingRef = React.useRef<SourceLoadTimingResult | null>(null)

  const [viewer, setViewer] = React.useState<ViewerId>(() =>
    normalizeViewerId(initialViewer ?? null)
  )
  const [pptxFile, setPptxFile] = React.useState<File | null>(null)
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
      findScrollableViewport(
        rootRef.current,
        resolveViewer(viewer).scrollerSelector
      )
    )
  }, [viewer])
  const handlePptxFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPptxFile(event.target.files?.[0] ?? null)
    },
    []
  )
  const handlePptxSlideRenderTiming = React.useCallback(
    (timing: PptxSlideRenderTiming) => {
      imageRenderTimingsRef.current.push(timing)
    },
    []
  )
  const handlePptxSourceLoadTiming = React.useCallback(
    (timing: PptxSourceLoadTiming) => {
      sourceLoadTimingRef.current = timing
    },
    []
  )

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
    imageRenderTimingsRef.current = []

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
        imageRendering:
          viewer === "pptx"
            ? summarizeImageRenderTimings(imageRenderTimingsRef.current)
            : undefined,
        measuredAt: new Date().toISOString(),
        sourceLoad:
          viewer === "pptx"
            ? (sourceLoadTimingRef.current ?? undefined)
            : undefined,
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
    if (viewer !== "pptx") return
    runAbortRef.current?.abort()
    sourceLoadTimingRef.current = null
    setResult(null)
    setError(null)
    setStatus("idle")
  }, [pptxFile, viewer])

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
            pptxFile,
            textValue,
            onPptxSourceLoadTiming: handlePptxSourceLoadTiming,
            onPptxSlideRenderTiming: handlePptxSlideRenderTiming,
            setViewportHandle,
          })}
        </div>

        <aside className="flex min-h-0 flex-col gap-3 border-l bg-muted/20 p-3 max-lg:h-64 max-lg:border-t max-lg:border-l-0">
          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Fixture
            </div>
            <div className="mt-1 text-sm">
              {viewer === "pptx" && pptxFile
                ? pptxFile.name
                : VIEWERS.find((option) => option.id === viewer)?.sample}
            </div>
            {viewer === "pptx" ? (
              <label className="mt-3 block">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Custom deck
                </span>
                <input
                  className="mt-1 block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={handlePptxFileChange}
                />
              </label>
            ) : null}
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
  pptxFile,
  textValue,
  setViewportHandle,
  onPptxSourceLoadTiming,
  onPptxSlideRenderTiming,
}: {
  viewer: ViewerId
  csvValue: string
  pptxFile: File | null
  textValue: string
  setViewportHandle: (handle: ViewportHandle | null) => void
  onPptxSourceLoadTiming: (timing: PptxSourceLoadTiming) => void
  onPptxSlideRenderTiming: (timing: PptxSlideRenderTiming) => void
}) {
  const viewerClassName = "h-full rounded-none border-0"

  switch (viewer) {
    case "pdf":
      return (
        <PdfViewer
          ref={setViewportHandle as React.Ref<PdfViewerHandle>}
          source={{
            kind: "url",
            url: "/samples/big-911-report.pdf",
            fileName: "big-911-report.pdf",
          }}
          className={viewerClassName}
          toolbar={false}
          bare
        />
      )
    case "csv":
      return (
        <CsvViewer
          ref={setViewportHandle as React.Ref<CsvViewerHandle>}
          source={{
            kind: "text",
            text: csvValue,
            fileName: "scrollbench.csv",
          }}
          className={viewerClassName}
          toolbar={false}
          fillHeight
          isolateStyles={false}
        />
      )
    case "json":
      return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
          <SingleFileTableView
            document={jsonTableDocument}
            schema={jsonTableSchema}
            jsonEditMode="readOnly"
            schemaEditMode="readOnly"
          />
        </div>
      )
    case "xlsx":
      return (
        <XlsxViewer
          ref={setViewportHandle as React.Ref<XlsxViewerHandle>}
          source={{
            kind: "url",
            url: "/samples/nvidia-financials-fy2024.xlsx",
            fileName: "nvidia-financials-fy2024.xlsx",
          }}
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
          source={{
            kind: "url",
            url: "/samples/quarterly-business-review.docx",
            fileName: "quarterly-business-review.docx",
          }}
          className={viewerClassName}
          toolbar={false}
          bare
        />
      )
    case "pptx":
      return (
        <PptxViewer
          source={getScrollBenchPptxSource(pptxFile)}
          className={viewerClassName}
          toolbar={false}
          bare
          eager
          onSourceLoadTiming={onPptxSourceLoadTiming}
          onSlideRenderTiming={onPptxSlideRenderTiming}
        />
      )
    case "image":
      return (
        <ImageViewer
          ref={setViewportHandle as React.Ref<ImageViewerHandle>}
          source={{
            kind: "url",
            url: "/samples/attention-page-1.png",
            fileName: "attention-page-1.png",
          }}
          className={viewerClassName}
          scale={2}
          toolbar={false}
          bare
        />
      )
  }
}

function getScrollBenchPptxSource(file: File | null) {
  if (!file) {
    return {
      kind: "url" as const,
      url: "/samples/sample-presentation.pptx",
      fileName: "sample-presentation.pptx",
    }
  }

  return {
    kind: "blob" as const,
    blob: file,
    fileName: file.name || "custom.pptx",
    identityKey: [
      "scrollbench-pptx",
      file.name,
      file.size,
      file.lastModified,
    ].join(":"),
    mimeType:
      file.type ||
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
        {result.imageRendering ? (
          <>
            <Metric
              label="image renders"
              value={String(result.imageRendering.count)}
            />
            <Metric
              label="image total"
              value={`${formatNumber(result.imageRendering.totalMs)}ms`}
            />
            <Metric
              label="image avg"
              value={`${formatNumber(result.imageRendering.averageMs)}ms`}
            />
            <Metric
              label="image p95"
              value={`${formatNumber(result.imageRendering.p95Ms)}ms`}
            />
            <Metric
              label="image max"
              value={`${formatNumber(result.imageRendering.maxMs)}ms`}
            />
            <Metric
              label="image cached"
              value={String(result.imageRendering.cached)}
            />
            <Metric
              label="uncached p95"
              value={`${formatNumber(result.imageRendering.uncachedTiming.p95Ms)}ms`}
            />
            <Metric
              label="cached p95"
              value={`${formatNumber(result.imageRendering.cachedTiming.p95Ms)}ms`}
            />
          </>
        ) : null}
        {result.sourceLoad ? (
          <>
            <Metric
              label="load total"
              value={`${formatNumber(result.sourceLoad.totalMs)}ms`}
            />
            <Metric
              label="load bytes"
              value={formatBytes(result.sourceLoad.byteLength)}
            />
            <Metric
              label="read bytes"
              value={`${formatNumber(result.sourceLoad.readBytesMs)}ms`}
            />
            <Metric
              label="import pptx"
              value={`${formatNumber(result.sourceLoad.importPptxMs)}ms`}
            />
            <Metric
              label="read size"
              value={`${formatNumber(result.sourceLoad.readSlideSizeMs)}ms`}
            />
            <Metric
              label="parse deck"
              value={`${formatNumber(result.sourceLoad.loadFileMs)}ms`}
            />
          </>
        ) : null}
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  if (value < 1024) return `${formatNumber(value)} B`
  if (value < 1024 * 1024) return `${formatNumber(value / 1024)} KB`
  return `${formatNumber(value / (1024 * 1024))} MB`
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
