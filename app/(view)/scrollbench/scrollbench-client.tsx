"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import { cn } from "@/lib/utils"
import { CodeViewer, type CodeViewerHandle } from "@/components/ui/code-viewer"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer"
import {
  ImageViewer,
  type ImageFrameRenderTiming,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"
import { PdfViewer, type PdfViewerHandle } from "@/components/ui/pdf-viewer"
import {
  PptxViewer,
  type PptxSlideRenderTiming,
  type PptxSourceLoadTiming,
} from "@/components/ui/pptx-viewer"
import { XlsxViewer, type XlsxViewerHandle } from "@/components/ui/xlsx-viewer"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { SingleFileTableView } from "@/components/json-table/single-file-table-view"
import { JsonFormSourcesBlock } from "@/registry/new-york-v4/blocks/json-form-sources-block"

import {
  normalizeViewerId,
  resolveScenario,
  resolveViewer,
  SCENARIOS,
  summarizeImageRenderTimings,
  summarizeRepeatedScrollBenchRuns,
  VIEWERS,
  type ImageRenderTiming,
  type NumberDistributionResult,
  type ScenarioDefinition,
  type ScenarioRepeatResult,
  type ScenarioResult,
  type ScrollBenchRepeatResult,
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
  | CodeViewerHandle
  | DocxViewerHandle
  | ImageViewerHandle

type RunStatus = "idle" | "running" | "done" | "failed"
type CsvScrollBenchVariant = "default" | "active-cell"

const SCROLLBENCH_JSON_ROW_COUNT = 20_000
const SCROLLBENCH_JSON_OVERSCAN = 12
const SCROLLBENCH_JSON_JUMP_OVERSCAN = 4
const SCROLLBENCH_JSON_MAX_ROW_COUNT = 100_000
const SCROLLBENCH_JSON_MAX_OVERSCAN = 200
const SCROLLBENCH_MAX_REPEAT_RUNS = 10
const JSON_FORM_SOURCES_DEFAULT_OPEN_PATHS = ["transactions"] as const
const jsonTableSchema = createScrollBenchJsonSchema()

interface ScrollBenchJsonSettings {
  rowCount: number
  overscan: number
  jumpOverscan: number
}

interface InitialScrollBenchJsonSettings {
  jumpOverscan?: string
  overscan?: string
  rows?: string
}

interface ScrollBenchController {
  getScroller: () => HTMLElement | null
  run: () => Promise<ScrollBenchResult>
  runMany: (count?: number) => Promise<ScrollBenchRepeatResult>
  runScenario: (scenarioId: ScenarioDefinition["id"]) => Promise<ScenarioResult>
}

declare global {
  interface Window {
    __scrollbench?: ScrollBenchController
  }
}

export function ScrollBenchClient({
  initialJsonSettings,
  initialViewer,
}: {
  initialJsonSettings?: InitialScrollBenchJsonSettings
  initialViewer?: string
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const viewportHandleRef = React.useRef<ViewportHandle | null>(null)
  const controllerRef = React.useRef<ScrollBenchController | null>(null)
  const autorunStartedRef = React.useRef(false)
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
  const [repeatResult, setRepeatResult] =
    React.useState<ScrollBenchRepeatResult | null>(null)

  const csvValue = React.useMemo(() => createScrollBenchCsv(), [])
  const csvVariant = React.useMemo(readCsvScrollBenchVariant, [])
  const jsonSettings = React.useMemo(
    () => readScrollBenchJsonSettings(initialJsonSettings),
    [initialJsonSettings]
  )
  const jsonTableDocument = React.useMemo(
    () => createScrollBenchJsonDocument(jsonSettings.rowCount),
    [jsonSettings.rowCount]
  )
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
  const handleImageFrameRenderTiming = React.useCallback(
    (timing: ImageFrameRenderTiming) => {
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

  const measureOnce = React.useCallback(
    async (signal: AbortSignal) => {
      imageRenderTimingsRef.current = []

      const scroller = await waitForScroller(getScroller, { signal })
      const scenarios: ScenarioResult[] = []

      for (const scenario of SCENARIOS) {
        scenarios.push(
          await measureScenario(scroller, scenario, {
            signal,
          })
        )
      }

      return {
        viewer,
        imageRendering:
          viewer === "pptx" || viewer === "image"
            ? summarizeImageRenderTimings(imageRenderTimingsRef.current)
            : undefined,
        measuredAt: new Date().toISOString(),
        sourceLoad:
          viewer === "pptx"
            ? (sourceLoadTimingRef.current ?? undefined)
            : undefined,
        viewport: viewportMetrics(scroller),
        scenarios,
      } satisfies ScrollBenchResult
    },
    [getScroller, viewer]
  )

  const run = React.useCallback(async () => {
    runAbortRef.current?.abort()
    const abortController = new AbortController()
    runAbortRef.current = abortController

    setStatus("running")
    setError(null)
    setResult(null)
    setRepeatResult(null)

    try {
      const nextResult = await measureOnce(abortController.signal)
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
  }, [measureOnce])

  const runMany = React.useCallback(
    async (count = 3) => {
      runAbortRef.current?.abort()
      const abortController = new AbortController()
      runAbortRef.current = abortController
      const runCount = normalizeRepeatRunCount(count)

      setStatus("running")
      setError(null)
      setResult(null)
      setRepeatResult(null)

      try {
        const runs: ScrollBenchResult[] = []

        for (let index = 0; index < runCount; index += 1) {
          runs.push(await measureOnce(abortController.signal))
        }

        const nextRepeatResult = summarizeRepeatedScrollBenchRuns(runs)
        if (!abortController.signal.aborted) {
          setResult(runs[runs.length - 1] ?? null)
          setRepeatResult(nextRepeatResult)
          setStatus("done")
        }
        return nextRepeatResult
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
    },
    [measureOnce]
  )

  controllerRef.current = { getScroller, run, runMany, runScenario }

  React.useEffect(() => {
    runAbortRef.current?.abort()
    viewportHandleRef.current = null
    setResult(null)
    setRepeatResult(null)
    setError(null)
    setStatus("idle")
    writeViewerToUrl(viewer)
  }, [viewer])

  React.useEffect(() => {
    if (viewer !== "pptx") return
    runAbortRef.current?.abort()
    sourceLoadTimingRef.current = null
    setResult(null)
    setRepeatResult(null)
    setError(null)
    setStatus("idle")
  }, [pptxFile, viewer])

  React.useEffect(() => {
    const controller: ScrollBenchController = {
      getScroller: () => controllerRef.current?.getScroller() ?? null,
      run: () =>
        controllerRef.current?.run() ??
        Promise.reject(scrollBenchControllerNotReadyError()),
      runMany: (count) =>
        controllerRef.current?.runMany(count) ??
        Promise.reject(scrollBenchControllerNotReadyError()),
      runScenario: (scenarioId) =>
        controllerRef.current?.runScenario(scenarioId) ??
        Promise.reject(scrollBenchControllerNotReadyError()),
    }

    window.__scrollbench = controller
    return () => {
      if (window.__scrollbench === controller) delete window.__scrollbench
    }
  }, [])

  React.useEffect(() => {
    if (autorunStartedRef.current) return
    autorunStartedRef.current = true

    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get("autorun") === "1") {
      const runCount = normalizeRepeatRunCount(searchParams.get("runs"))
      const controller = controllerRef.current
      const runPromise =
        (runCount > 1 ? controller?.runMany(runCount) : controller?.run()) ??
        Promise.resolve()
      void runPromise.catch(() => undefined)
    }
  }, [])

  return (
    <main
      className="flex h-svh min-h-0 flex-col bg-background text-foreground"
      data-testid="scrollbench"
    >
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b bg-background px-3 py-2">
        <div className="mr-2 min-w-0">
          <h1 className="text-sm leading-5 font-semibold">Scrollbench</h1>
          <p className="text-xs text-muted-foreground">
            Frame distribution, jank, scroll path, and DOM pressure across
            viewer scrollports.
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

        <button
          type="button"
          className="h-8 rounded-md border bg-background px-3 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={status === "running"}
          onClick={() => void runMany(3).catch(() => undefined)}
          data-testid="scrollbench-run-many"
        >
          Run 3x
        </button>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] max-lg:grid-cols-1">
        <div
          ref={rootRef}
          className="min-h-0 min-w-0"
          data-scrollbench-viewer={viewer}
        >
          {renderViewer({
            viewer,
            csvValue,
            csvVariant,
            jsonTableDocument,
            jsonSettings,
            pptxFile,
            textValue,
            onPptxSourceLoadTiming: handlePptxSourceLoadTiming,
            onPptxSlideRenderTiming: handlePptxSlideRenderTiming,
            onImageFrameRenderTiming: handleImageFrameRenderTiming,
            setViewportHandle,
          })}
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-l bg-muted/20 p-3 max-lg:h-64 max-lg:border-t max-lg:border-l-0">
          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Fixture
            </div>
            <div className="mt-1 text-sm">
              {viewer === "pptx" && pptxFile
                ? pptxFile.name
                : viewer === "json"
                  ? `${formatNumber(jsonSettings.rowCount)} generated rows; overscan ${jsonSettings.overscan}; jump ${jsonSettings.jumpOverscan}`
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

          <MetricPanel
            result={result}
            repeatResult={repeatResult}
            status={status}
            error={error}
          />
        </aside>
      </section>
    </main>
  )
}

function renderViewer({
  viewer,
  csvValue,
  csvVariant,
  jsonTableDocument,
  jsonSettings,
  pptxFile,
  textValue,
  setViewportHandle,
  onPptxSourceLoadTiming,
  onPptxSlideRenderTiming,
  onImageFrameRenderTiming,
}: {
  viewer: ViewerId
  csvValue: string
  csvVariant: CsvScrollBenchVariant
  jsonTableDocument: TableDocument
  jsonSettings: ScrollBenchJsonSettings
  pptxFile: File | null
  textValue: string
  setViewportHandle: (handle: ViewportHandle | null) => void
  onPptxSourceLoadTiming: (timing: PptxSourceLoadTiming) => void
  onPptxSlideRenderTiming: (timing: PptxSlideRenderTiming) => void
  onImageFrameRenderTiming: (timing: ImageFrameRenderTiming) => void
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
          controls={false}
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
          controls={false}
          fillHeight
          activeCell={
            csvVariant === "active-cell"
              ? { rowIndex: 1000, columnIndex: 1 }
              : null
          }
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
            overscan={jsonSettings.overscan}
            jumpOverscan={jsonSettings.jumpOverscan}
          />
        </div>
      )
    case "json-form-sources":
      return (
        <JsonFormSourcesBlock
          defaultOpenPaths={JSON_FORM_SOURCES_DEFAULT_OPEN_PATHS}
        />
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
          controls={false}
          bare
          isolateStyles={false}
        />
      )
    case "text":
      return (
        <CodeViewer
          ref={setViewportHandle as React.Ref<CodeViewerHandle>}
          source={{
            kind: "text",
            text: textValue,
            fileName: "scrollbench.log",
            mimeType: "text/plain",
          }}
          className={viewerClassName}
          controls={false}
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
          controls={false}
          bare
        />
      )
    case "pptx":
      return (
        <PptxViewer
          source={getScrollBenchPptxSource(pptxFile)}
          className={viewerClassName}
          controls={false}
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
            url: "/samples/entropy.tiff",
            fileName: "entropy.tiff",
          }}
          className={viewerClassName}
          controls={false}
          onFrameRenderTiming={onImageFrameRenderTiming}
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
  repeatResult,
  status,
  error,
}: {
  result: ScrollBenchResult | null
  repeatResult: ScrollBenchRepeatResult | null
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
          : "Run the benchmark to record frame budget metrics."}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="scrollbench-results">
      {repeatResult ? <RepeatMetricPanel result={repeatResult} /> : null}

      <div className="grid grid-cols-3 gap-2">
        {result.scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={cn(
              "rounded-md border bg-background p-3",
              scenario.id === "large" ? "col-span-2" : ""
            )}
            data-testid={`scrollbench-${scenario.id}-summary`}
          >
            <div className="text-xs text-muted-foreground">
              {scenario.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatNumber(scenario.p95FrameMs)}ms
            </div>
            <div className="text-xs text-muted-foreground">
              p95 · max {formatNumber(scenario.maxFrameMs)}ms
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {scenario.isRafLimited
                ? `rAF-limited at ${formatNumber(scenario.rafFps)} fps`
                : `${formatNumber(scenario.over16)} over 16.7ms`}
            </div>
          </div>
        ))}
      </div>

      <MetricGroup title="Viewport">
        <Metric label="viewport" value={formatSize(result.viewport)} />
        <Metric label="scroll size" value={formatScrollSize(result.viewport)} />
        <Metric
          label="scrollable y"
          value={`${formatNumber(result.viewport.maxScrollTop)}px`}
        />
        <Metric
          label="scrollable x"
          value={`${formatNumber(result.viewport.maxScrollLeft)}px`}
        />
        <Metric
          label="viewer nodes"
          value={formatNumber(result.viewport.renderedElementCount)}
        />
        <Metric
          label="scrollport nodes"
          value={formatNumber(result.viewport.scrollportElementCount)}
        />
      </MetricGroup>

      {result.scenarios.map((scenario) => (
        <ScenarioMetricGroup key={scenario.id} scenario={scenario} />
      ))}

      {result.imageRendering || result.sourceLoad ? (
        <MetricGroup title="Media">
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
                label="first uncached"
                value={`${formatNumber(result.imageRendering.firstUncachedMs)}ms`}
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
              <Metric
                label="max scale"
                value={formatNumber(result.imageRendering.maxRenderScale)}
              />
              <Metric
                label="max dpr"
                value={formatNumber(result.imageRendering.maxPixelRatio)}
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
        </MetricGroup>
      ) : null}
    </div>
  )
}

function RepeatMetricPanel({ result }: { result: ScrollBenchRepeatResult }) {
  return (
    <>
      <MetricGroup title="Repeatability">
        <Metric label="runs" value={formatNumber(result.runCount)} />
        <Metric label="viewer" value={result.viewer} />
        <Metric label="viewport" value={formatSize(result.viewport)} />
        <Metric
          label="scrollable y"
          value={`${formatNumber(result.viewport.maxScrollTop)}px`}
        />
      </MetricGroup>

      {result.scenarios.map((scenario) => (
        <ScenarioRepeatMetricGroup key={scenario.id} scenario={scenario} />
      ))}
    </>
  )
}

function ScenarioRepeatMetricGroup({
  scenario,
}: {
  scenario: ScenarioRepeatResult
}) {
  return (
    <MetricGroup title={`${scenario.label} repeat`}>
      <Metric
        label="rAF-limited runs"
        value={`${formatNumber(scenario.rafLimitedRuns)} / ${formatNumber(
          scenario.runs
        )}`}
      />
      <Metric
        label="work-limited runs"
        value={formatNumber(scenario.workLimitedRuns)}
      />
      <Metric
        label="worst run"
        value={
          scenario.worstRunIndex >= 0
            ? `#${formatNumber(scenario.worstRunIndex + 1)}`
            : "-"
        }
      />
      <Metric label="p95" value={formatDistributionMs(scenario.p95FrameMs)} />
      <Metric
        label="p95 std dev"
        value={`${formatNumber(scenario.p95FrameMs.stdDev)}ms`}
      />
      <Metric
        label="max frame"
        value={formatDistributionMs(scenario.maxFrameMs)}
      />
      <Metric
        label=">16.7ms"
        value={formatDistributionCount(scenario.over16)}
      />
      <Metric
        label=">33.3ms"
        value={formatDistributionCount(scenario.over33)}
      />
      <Metric
        label="missed 60Hz frames"
        value={formatDistributionCount(scenario.estimatedDroppedFrames)}
      />
      <Metric
        label="p95 / rAF"
        value={formatDistributionRatio(scenario.p95RafBudgetRatio)}
      />
      <Metric
        label="max / rAF"
        value={formatDistributionRatio(scenario.maxRafBudgetRatio)}
      />
      <Metric
        label="scroll mutation p95"
        value={formatDistributionMs(scenario.p95ScrollMutationMs)}
      />
      <Metric
        label="scroll mutation max"
        value={formatDistributionMs(scenario.maxScrollMutationMs)}
      />
      <Metric
        label="long tasks"
        value={formatDistributionCount(scenario.longTaskCount)}
      />
      <Metric
        label="long task total"
        value={formatDistributionMs(scenario.longTaskTotalMs)}
      />
      <Metric
        label="long task max"
        value={formatDistributionMs(scenario.longTaskMaxMs)}
      />
      <Metric
        label="mutation records"
        value={formatDistributionCount(scenario.mutationRecords)}
      />
      <Metric
        label="mutation total"
        value={formatNumber(scenario.mutationRecords.total)}
      />
      <Metric
        label="added elements"
        value={formatDistributionCount(scenario.addedElements)}
      />
      <Metric
        label="removed elements"
        value={formatDistributionCount(scenario.removedElements)}
      />
      <Metric
        label="attribute mutations"
        value={formatDistributionCount(scenario.attributeMutations)}
      />
      <Metric
        label="scrollport nodes"
        value={formatDistributionCount(scenario.maxScrollportElementCount)}
      />
      <Metric
        label="viewer nodes"
        value={formatDistributionCount(scenario.maxViewerElementCount)}
      />
    </MetricGroup>
  )
}

function ScenarioMetricGroup({ scenario }: { scenario: ScenarioResult }) {
  const warmup = scenario.warmupFrameMs
    .map((duration) => `${formatNumber(duration)}ms`)
    .join(" / ")

  return (
    <MetricGroup title={scenario.label}>
      <Metric
        label="status"
        value={scenario.isRafLimited ? "rAF-limited" : "work-limited"}
      />
      <Metric label="measured fps" value={formatNumber(scenario.fps)} />
      <Metric label="rAF ceiling" value={formatNumber(scenario.rafFps)} />
      <Metric
        label="rAF frame"
        value={`${formatNumber(scenario.rafFrameMs)}ms`}
      />
      <Metric label="frames" value={formatNumber(scenario.frames)} />
      <Metric
        label="avg"
        value={`${formatNumber(scenario.averageFrameMs)}ms`}
      />
      <Metric
        label="std dev"
        value={`${formatNumber(scenario.frameStdDevMs)}ms`}
      />
      <Metric label="min" value={`${formatNumber(scenario.minFrameMs)}ms`} />
      <Metric label="p50" value={`${formatNumber(scenario.p50FrameMs)}ms`} />
      <Metric label="p75" value={`${formatNumber(scenario.p75FrameMs)}ms`} />
      <Metric label="p90" value={`${formatNumber(scenario.p90FrameMs)}ms`} />
      <Metric label="p95" value={`${formatNumber(scenario.p95FrameMs)}ms`} />
      <Metric label="p99" value={`${formatNumber(scenario.p99FrameMs)}ms`} />
      <Metric label="max" value={`${formatNumber(scenario.maxFrameMs)}ms`} />
      <Metric
        label="p95 / rAF"
        value={formatRatio(scenario.p95RafBudgetRatio)}
      />
      <Metric
        label="max / rAF"
        value={formatRatio(scenario.maxRafBudgetRatio)}
      />
      <Metric
        label="scroll mutation avg"
        value={`${formatNumber(scenario.averageScrollMutationMs)}ms`}
      />
      <Metric
        label="scroll mutation p95"
        value={`${formatNumber(scenario.p95ScrollMutationMs)}ms`}
      />
      <Metric
        label="scroll mutation max"
        value={`${formatNumber(scenario.maxScrollMutationMs)}ms`}
      />
      <Metric
        label="long tasks"
        value={formatNumber(scenario.longTasks.count)}
      />
      <Metric
        label="long task total"
        value={`${formatNumber(scenario.longTasks.totalMs)}ms`}
      />
      <Metric
        label="long task max"
        value={`${formatNumber(scenario.longTasks.maxMs)}ms`}
      />
      <Metric
        label="mutation records"
        value={formatNumber(scenario.domMutation.mutationRecords)}
      />
      <Metric
        label="added elements"
        value={formatNumber(scenario.domMutation.addedElements)}
      />
      <Metric
        label="removed elements"
        value={formatNumber(scenario.domMutation.removedElements)}
      />
      <Metric
        label="attribute mutations"
        value={formatNumber(scenario.domMutation.attributeMutations)}
      />
      <Metric
        label="text mutations"
        value={formatNumber(scenario.domMutation.characterDataMutations)}
      />
      <Metric
        label="scrollport nodes"
        value={formatNodeRange({
          final: scenario.domMutation.finalScrollportElementCount,
          initial: scenario.domMutation.initialScrollportElementCount,
          max: scenario.domMutation.maxScrollportElementCount,
        })}
      />
      <Metric
        label="viewer nodes"
        value={formatNodeRange({
          final: scenario.domMutation.finalViewerElementCount,
          initial: scenario.domMutation.initialViewerElementCount,
          max: scenario.domMutation.maxViewerElementCount,
        })}
      />
      <Metric
        label="slowest frame"
        value={String(scenario.slowestFrameIndex)}
      />
      <Metric
        label=">16.7ms"
        value={formatBudgetCount(scenario.over16, scenario.over16Ratio)}
      />
      <Metric
        label=">33.3ms"
        value={formatBudgetCount(scenario.over33, scenario.over33Ratio)}
      />
      <Metric label=">50ms" value={formatNumber(scenario.over50)} />
      <Metric label=">100ms" value={formatNumber(scenario.over100)} />
      <Metric
        label="missed 60Hz frames"
        value={formatNumber(scenario.estimatedDroppedFrames)}
      />
      <Metric label="step" value={`${formatNumber(scenario.stepPx)}px`} />
      <Metric
        label="target distance"
        value={`${formatNumber(scenario.distancePx)}px`}
      />
      <Metric
        label="actual distance"
        value={`${formatNumber(scenario.actualDistancePx)}px`}
      />
      <Metric
        label="avg delta"
        value={`${formatNumber(scenario.averageScrollDeltaPx)}px`}
      />
      <Metric
        label="max delta"
        value={`${formatNumber(scenario.maxScrollDeltaPx)}px`}
      />
      <Metric
        label="scroll range"
        value={`${formatNumber(scenario.minScrollTop)}-${formatNumber(
          scenario.maxScrollTop
        )}px`}
      />
      <Metric
        label="targets"
        value={`${formatNumber(scenario.uniqueTargetCount)} / ${formatNumber(
          scenario.targetCount
        )}`}
      />
      <Metric
        label="direction changes"
        value={formatNumber(scenario.directionChanges)}
      />
      <Metric label="warmup" value={warmup || "0ms"} />
    </MetricGroup>
  )
}

function MetricGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-md border bg-background p-3">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">{children}</dl>
    </section>
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

function formatDistributionCount(distribution: NumberDistributionResult) {
  return `${formatNumber(distribution.average)} avg / ${formatNumber(
    distribution.max
  )} max`
}

function formatDistributionMs(distribution: NumberDistributionResult) {
  return `${formatNumber(distribution.average)}ms avg / ${formatNumber(
    distribution.max
  )}ms max`
}

function formatDistributionRatio(distribution: NumberDistributionResult) {
  return `${formatRatio(distribution.average)} avg / ${formatRatio(
    distribution.max
  )} max`
}

function formatBudgetCount(count: number, ratio: number) {
  return `${formatNumber(count)} (${formatPercent(ratio)})`
}

function formatNodeRange({
  final,
  initial,
  max,
}: {
  final: number
  initial: number
  max: number
}) {
  return `${formatNumber(initial)} -> ${formatNumber(final)} (max ${formatNumber(
    max
  )})`
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(Number.isFinite(value) ? value : 0)
}

function formatRatio(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0x"
  return `${formatNumber(value)}x`
}

function formatScrollSize(viewport: ScrollBenchResult["viewport"]) {
  return `${formatNumber(viewport.scrollWidth)} x ${formatNumber(
    viewport.scrollHeight
  )}px`
}

function formatSize(viewport: ScrollBenchResult["viewport"]) {
  return `${formatNumber(viewport.clientWidth)} x ${formatNumber(
    viewport.clientHeight
  )}px`
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

function readCsvScrollBenchVariant(): CsvScrollBenchVariant {
  if (typeof window === "undefined") return "default"
  return new URLSearchParams(window.location.search).get("csvVariant") ===
    "active-cell"
    ? "active-cell"
    : "default"
}

function normalizeRepeatRunCount(value: number | string | null | undefined) {
  return readBoundedIntegerParam({
    rawValue: value == null ? undefined : String(value),
    fallback: 3,
    min: 1,
    max: SCROLLBENCH_MAX_REPEAT_RUNS,
  })
}

function scrollBenchControllerNotReadyError() {
  return new Error("Scrollbench controller is not ready.")
}

function readScrollBenchJsonSettings(
  initialSettings: InitialScrollBenchJsonSettings | undefined
): ScrollBenchJsonSettings {
  const overscan = readBoundedIntegerParam({
    rawValue: initialSettings?.overscan,
    fallback: SCROLLBENCH_JSON_OVERSCAN,
    min: 0,
    max: SCROLLBENCH_JSON_MAX_OVERSCAN,
  })
  return {
    rowCount: readBoundedIntegerParam({
      rawValue: initialSettings?.rows,
      fallback: SCROLLBENCH_JSON_ROW_COUNT,
      min: 1,
      max: SCROLLBENCH_JSON_MAX_ROW_COUNT,
    }),
    overscan,
    jumpOverscan: readBoundedIntegerParam({
      rawValue: initialSettings?.jumpOverscan,
      fallback: Math.min(SCROLLBENCH_JSON_JUMP_OVERSCAN, overscan),
      min: 0,
      max: SCROLLBENCH_JSON_MAX_OVERSCAN,
    }),
  }
}

function readBoundedIntegerParam({
  rawValue,
  fallback,
  min,
  max,
}: {
  rawValue: string | undefined
  fallback: number
  min: number
  max: number
}) {
  if (rawValue === undefined) return fallback

  const value = Number(rawValue)
  if (!Number.isFinite(value)) return fallback

  return Math.min(max, Math.max(min, Math.floor(value)))
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

function createScrollBenchJsonSchema(): JSONSchema7 {
  return {
    title: "Scrollbench Rows",
    type: "object",
    properties: {
      rows: {
        type: "array",
        title: "Rows",
        items: {
          type: "object",
          title: "Row",
          additionalProperties: false,
          properties: {
            record_id: { type: "string", title: "Record" },
            posted_at: { type: "string", format: "date", title: "Posted" },
            merchant: { type: "string", title: "Merchant" },
            category: { type: "string", title: "Category" },
            status: { type: "string", title: "Status" },
            account: { type: "string", title: "Account" },
            amount: { type: "number", title: "Amount" },
            balance: { type: "number", title: "Balance" },
            currency: { type: "string", title: "Currency" },
            region: { type: "string", title: "Region" },
            channel: { type: "string", title: "Channel" },
            risk_score: { type: "integer", title: "Risk" },
            is_reconciled: { type: "boolean", title: "Reconciled" },
            reference: { type: "string", title: "Reference" },
            description: { type: "string", title: "Description" },
            batch_id: { type: "string", title: "Batch" },
            source: { type: "string", title: "Source" },
            confidence: { type: "number", title: "Confidence" },
          },
          required: [
            "record_id",
            "posted_at",
            "merchant",
            "category",
            "status",
            "account",
            "amount",
            "balance",
            "currency",
            "region",
            "channel",
            "risk_score",
            "is_reconciled",
            "reference",
            "description",
            "batch_id",
            "source",
            "confidence",
          ],
        },
      },
    },
    required: ["rows"],
  }
}

function createScrollBenchJsonDocument(rowCount: number): TableDocument {
  const merchants = ["Acme", "Globex", "Initech", "Umbrella", "Soylent"]
  const categories = ["travel", "software", "payroll", "office", "tax"]
  const statuses = ["posted", "pending", "reviewed", "matched"]
  const regions = ["na", "eu", "apac", "latam"]
  const channels = ["card", "wire", "ach", "check"]

  return {
    id: "scrollbench-json",
    data: {
      rows: Array.from({ length: rowCount }, (_, rowIndex) => {
        const sequence = rowIndex + 1
        const amount = ((sequence * 37) % 20_000) / 100
        return {
          record_id: `txn_${String(sequence).padStart(6, "0")}`,
          posted_at: `2025-${String((rowIndex % 12) + 1).padStart(2, "0")}-${String((rowIndex % 28) + 1).padStart(2, "0")}`,
          merchant: merchants[rowIndex % merchants.length],
          category: categories[rowIndex % categories.length],
          status: statuses[rowIndex % statuses.length],
          account: `acct_${String((rowIndex % 32) + 1).padStart(2, "0")}`,
          amount,
          balance: 10_000 + amount + rowIndex * 0.13,
          currency: "USD",
          region: regions[rowIndex % regions.length],
          channel: channels[rowIndex % channels.length],
          risk_score: (rowIndex * 17) % 100,
          is_reconciled: rowIndex % 3 !== 0,
          reference: `ref-${String((rowIndex * 7919) % 1_000_000).padStart(6, "0")}`,
          description: `Generated scrollbench transaction ${sequence}`,
          batch_id: `batch_${String(Math.floor(rowIndex / 250) + 1).padStart(3, "0")}`,
          source: rowIndex % 2 === 0 ? "statement" : "api",
          confidence: ((rowIndex * 19) % 100) / 100,
        }
      }),
    },
  }
}
