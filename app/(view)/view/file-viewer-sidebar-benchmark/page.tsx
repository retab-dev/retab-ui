"use client";

import * as React from "react";
import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";
import {
  FileViewer,
  FileViewerContent,
  FileViewerControls,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerInset,
  FileViewerMeta,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarTrigger,
  FileViewerTitle,
  FileViewerViewport,
  type FileViewerSource,
} from "@/components/ui/file-viewer";
import { cn } from "@/lib/utils";

import {
  SIDEBAR_MOTION_BENCHMARK_SCROLL_TARGETS,
  runFileViewerSidebarMotionBenchmark,
  type SidebarMotionBenchmarkActionOrder,
  type SidebarMotionBenchmarkOptions,
  type SidebarMotionBenchmarkResult,
  type SidebarMotionBenchmarkScrollTargetId,
} from "./sidebar-motion-benchmark";

type BenchmarkFormatId =
  | "pdf"
  | "image"
  | "tiff"
  | "xlsx"
  | "pptx"
  | "docx"
  | "csv"
  | "markdown"
  | "html"
  | "code"
  | "text";

type BenchmarkSide = "left" | "right";

type BenchmarkFixture = {
  align: "center" | "start";
  fallbackFrameSize?: { width: number; height: number };
  fallbackSlideSize?: { width: number; height: number };
  id: BenchmarkFormatId;
  label: string;
  source: FileViewerSource;
};

type FileViewerSidebarBenchmarkTelemetryApi = {
  getLastResult: () => SidebarMotionBenchmarkResult | null;
  run: (
    options?: SidebarMotionBenchmarkOptions,
  ) => Promise<SidebarMotionBenchmarkResult | null>;
};

declare global {
  interface Window {
    __fileViewerSidebarBenchmarkTelemetry?: FileViewerSidebarBenchmarkTelemetryApi;
  }
}

const SIDES: readonly BenchmarkSide[] = ["right", "left"];
const ACTION_ORDERS = [
  { id: "close-open", label: "Close then open" },
  { id: "open-close", label: "Open then close" },
] satisfies readonly {
  id: SidebarMotionBenchmarkActionOrder;
  label: string;
}[];

const BENCHMARK_FIXTURES: readonly BenchmarkFixture[] = [
  {
    id: "pdf",
    label: "PDF",
    align: "center",
    source: {
      kind: "url",
      url: "/samples/spacex-prospectus.pdf",
      fileName: "spacex-prospectus.pdf",
      mimeType: "application/pdf",
    },
  },
  {
    id: "image",
    label: "Image",
    align: "center",
    fallbackFrameSize: { width: 918, height: 1188 },
    source: {
      kind: "url",
      url: "/samples/an-image-is-worth-16x16-words-page-1.png",
      fileName: "an-image-is-worth-16x16-words-page-1.png",
      mimeType: "image/png",
    },
  },
  {
    id: "tiff",
    label: "TIFF",
    align: "center",
    fallbackFrameSize: { width: 1275, height: 1650 },
    source: {
      kind: "url",
      url: "/samples/entropy.tiff",
      fileName: "entropy.tiff",
      mimeType: "image/tiff",
    },
  },
  {
    id: "xlsx",
    label: "XLSX",
    align: "start",
    source: {
      kind: "url",
      url: "/samples/nvidia-financials-fy2024.xlsx",
      fileName: "nvidia-financials-fy2024.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  },
  {
    id: "pptx",
    label: "PPTX",
    align: "center",
    fallbackSlideSize: { width: 960, height: 540 },
    source: {
      kind: "url",
      url: "/samples/sample-presentation.pptx",
      fileName: "sample-presentation.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
  },
  {
    id: "docx",
    label: "DOCX",
    align: "center",
    source: {
      kind: "url",
      url: "/samples/quarterly-business-review.docx",
      fileName: "quarterly-business-review.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  },
  {
    id: "csv",
    label: "CSV",
    align: "start",
    source: {
      kind: "url",
      url: "/samples/sales.csv",
      fileName: "sales.csv",
      mimeType: "text/csv",
    },
  },
  {
    id: "markdown",
    label: "Markdown",
    align: "start",
    source: {
      kind: "url",
      url: "/samples/release-notes.md",
      fileName: "release-notes.md",
      mimeType: "text/markdown",
    },
  },
  {
    id: "html",
    label: "HTML",
    align: "start",
    source: {
      kind: "url",
      url: "/samples/welcome.html",
      fileName: "welcome.html",
      mimeType: "text/html",
    },
  },
  {
    id: "code",
    label: "Code",
    align: "start",
    source: {
      kind: "url",
      url: "/samples/use-debounced-value.ts",
      fileName: "use-debounced-value.ts",
      mimeType: "text/typescript",
    },
  },
  {
    id: "text",
    label: "Text",
    align: "start",
    source: {
      kind: "url",
      url: "/samples/review-notes.txt",
      fileName: "review-notes.txt",
      mimeType: "text/plain",
    },
  },
];

const FORMAT_BY_ID = new Map(
  BENCHMARK_FIXTURES.map((fixture) => [fixture.id, fixture]),
);

const CONTRACTS = [
  "overshoot",
  "back-and-forth",
  "motion samples",
  "scroll drift",
  "scroll events",
  "scroll geometry",
  "state sync",
  "focus stability",
  "sidebar sync",
  "renderer continuity",
  "anchor stability",
  "cycle invariance",
  "rapid toggle",
  "renderer mutations",
  "resource quiet",
  "layout shift",
  "main thread",
  "visual smoothness",
];

export default function FileViewerSidebarBenchmarkPage() {
  const [activeFormatId, setActiveFormatId] =
    React.useState<BenchmarkFormatId>("pdf");
  const [side, setSide] = React.useState<BenchmarkSide>("right");
  const [actionOrder, setActionOrder] =
    React.useState<SidebarMotionBenchmarkActionOrder>("close-open");
  const [scrollTargetId, setScrollTargetId] =
    React.useState<SidebarMotionBenchmarkScrollTargetId>("deep");
  const [result, setResult] =
    React.useState<SidebarMotionBenchmarkResult | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const isRunningRef = React.useRef(false);
  const resultRef = React.useRef<SidebarMotionBenchmarkResult | null>(null);
  const activeFixture =
    FORMAT_BY_ID.get(activeFormatId) ?? BENCHMARK_FIXTURES[0];
  const runTelemetry = React.useCallback(
    async (options?: SidebarMotionBenchmarkOptions) => {
      if (isRunningRef.current) return null;

      const telemetryActionOrder = options?.actionOrder ?? actionOrder;
      const telemetryScrollTargetId = options?.scrollTargetId ?? scrollTargetId;
      isRunningRef.current = true;
      setIsRunning(true);
      setResult(null);
      resultRef.current = null;
      try {
        const nextResult = await runFileViewerSidebarMotionBenchmark({
          actionOrder: telemetryActionOrder,
          scrollTargetId: telemetryScrollTargetId,
        });
        setResult(nextResult);
        resultRef.current = nextResult;
        return nextResult;
      } catch (error) {
        const failedResult = {
          actionOrder: telemetryActionOrder,
          durationMs: 0,
          format: activeFormatId,
          metrics: [
            {
              budget: "ready fixture",
              detail: error instanceof Error ? error.message : "Unknown error",
              id: "renderer-continuity",
              label: "Benchmark runner",
              passed: false,
              value: "failed",
            },
          ],
          sampledFrameCount: 0,
          scrollTarget: telemetryScrollTargetId,
          side,
          status: "failed",
        } satisfies SidebarMotionBenchmarkResult;
        setResult(failedResult);
        resultRef.current = failedResult;
        return failedResult;
      } finally {
        isRunningRef.current = false;
        setIsRunning(false);
      }
    },
    [actionOrder, activeFormatId, scrollTargetId, side],
  );

  useKeyedMountEffect(
    joinEffectKey(["file-viewer-sidebar-benchmark-telemetry-api", runTelemetry]),
    () => {
      const api: FileViewerSidebarBenchmarkTelemetryApi = {
        getLastResult: () => resultRef.current,
        run: runTelemetry,
      };
      window.__fileViewerSidebarBenchmarkTelemetry = api;

      return () => {
        if (window.__fileViewerSidebarBenchmarkTelemetry === api) {
          delete window.__fileViewerSidebarBenchmarkTelemetry;
        }
      };
    },
  );

  useKeyedMountEffect(
    joinEffectKey([activeFormatId, side, actionOrder, scrollTargetId]),
    () => {
      setResult(null);
      resultRef.current = null;
    },
  );

  return (
    <main className="bg-background flex h-svh min-h-0 flex-col gap-3 p-4">
      <section
        aria-label="File viewer sidebar benchmark controls"
        data-benchmark-controls=""
        className="flex min-h-0 shrink-0 flex-wrap items-center justify-between gap-3"
      >
        <div
          aria-label="File type"
          className="flex min-w-0 flex-wrap items-center gap-1"
          role="group"
        >
          {BENCHMARK_FIXTURES.map((fixture) => (
            <button
              key={fixture.id}
              aria-pressed={fixture.id === activeFixture.id}
              className={cn(
                "h-9 rounded-md border px-3 text-sm font-medium transition-colors",
                fixture.id === activeFixture.id
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-benchmark-format-option={fixture.id}
              type="button"
              onClick={() => setActiveFormatId(fixture.id)}
            >
              {fixture.label}
            </button>
          ))}
        </div>
        <div
          aria-label="Sidebar side"
          className="flex shrink-0 items-center rounded-md border p-0.5"
          role="group"
        >
          {SIDES.map((option) => (
            <button
              key={option}
              aria-pressed={side === option}
              className={cn(
                "h-8 rounded px-3 text-sm font-medium capitalize transition-colors",
                side === option
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-benchmark-side-option={option}
              type="button"
              onClick={() => setSide(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div
          aria-label="Action order"
          className="flex shrink-0 items-center rounded-md border p-0.5"
          role="group"
        >
          {ACTION_ORDERS.map((option) => (
            <button
              key={option.id}
              aria-pressed={actionOrder === option.id}
              className={cn(
                "h-8 rounded px-3 text-sm font-medium transition-colors",
                actionOrder === option.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-benchmark-action-order-option={option.id}
              type="button"
              onClick={() => setActionOrder(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div
          aria-label="Scroll target"
          className="flex min-w-0 flex-wrap items-center gap-1"
          role="group"
        >
          {SIDEBAR_MOTION_BENCHMARK_SCROLL_TARGETS.map((target) => (
            <button
              key={target.id}
              aria-pressed={scrollTargetId === target.id}
              className={cn(
                "h-8 rounded-md border px-3 text-sm font-medium transition-colors",
                scrollTargetId === target.id
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-benchmark-scroll-target-option={target.id}
              type="button"
              onClick={() => setScrollTargetId(target.id)}
            >
              {target.label}
            </button>
          ))}
        </div>
      </section>

      <section
        data-benchmark-surface=""
        className="min-h-0 flex-1 overflow-hidden rounded-xl border"
      >
        <FileViewerProvider
          key={`${activeFixture.id}:${side}`}
          source={activeFixture.source}
          defaultSidebarOpen
          fallbackFrameSize={activeFixture.fallbackFrameSize}
          fallbackSlideSize={activeFixture.fallbackSlideSize}
          isolateStyles
        >
          <FileViewer
            className="relative h-full"
            data-benchmark-active-format={activeFixture.id}
            data-benchmark-sidebar-width="280"
            data-benchmark-side={side}
            sidebarMode="inline"
          >
            <FileViewerHeader>
              <FileViewerSidebarTrigger className="-ms-1" />
              <FileViewerTitle />
              <FileViewerMeta>
                <span data-benchmark-active-label="">
                  {activeFixture.label}
                </span>
              </FileViewerMeta>
              <BenchmarkTelemetryButton
                isRunning={isRunning}
                onRun={() => {
                  void runTelemetry();
                }}
              />
              <FileViewerControls />
            </FileViewerHeader>
            <FileViewerContent>
              <FileViewerSidebar
                aria-label="Benchmark contracts"
                className="bg-background/95"
                side={side}
                width="280px"
              >
                <FileViewerSidebarContent className="gap-4 p-4">
                  <div>
                    <div className="text-foreground text-sm font-medium">
                      Motion contracts
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {activeFixture.label} · {side} · {scrollTargetId}
                    </div>
                  </div>
                  <div className="grid gap-2" data-benchmark-contracts="">
                    {CONTRACTS.map((contract) => (
                      <div
                        key={contract}
                        className="rounded-md border px-3 py-2 text-sm"
                        data-benchmark-contract={contract}
                      >
                        {contract}
                      </div>
                    ))}
                  </div>
                </FileViewerSidebarContent>
              </FileViewerSidebar>
              <FileViewerInset align={activeFixture.align}>
                <FileViewerViewport data-benchmark-viewport="">
                  <FileViewerDocument controls />
                </FileViewerViewport>
              </FileViewerInset>
            </FileViewerContent>
            <BenchmarkTelemetryPanel result={result} isRunning={isRunning} />
          </FileViewer>
        </FileViewerProvider>
      </section>
    </main>
  );
}

function BenchmarkTelemetryButton({
  isRunning,
  onRun,
}: {
  isRunning: boolean;
  onRun: () => void;
}) {
  return (
    <button
      aria-label="Run telemetry"
      className="hidden h-9 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:opacity-40 md:inline-flex"
      data-benchmark-run-button=""
      data-benchmark-telemetry-button=""
      disabled={isRunning}
      type="button"
      onClick={onRun}
    >
      {isRunning ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Activity className="size-4" aria-hidden />
      )}
      Telemetry
    </button>
  );
}

function BenchmarkTelemetryPanel({
  isRunning,
  result,
}: {
  isRunning: boolean;
  result: SidebarMotionBenchmarkResult | null;
}) {
  if (!isRunning && !result) return null;

  if (!result) {
    return (
      <aside
        className="absolute right-3 bottom-3 z-30 flex max-h-[55%] w-[24rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/95 text-neutral-200 shadow-2xl backdrop-blur"
        data-benchmark-telemetry-panel=""
        data-benchmark-run-status="running"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Loader2 className="size-4 animate-spin text-neutral-400" />
            <div className="truncate text-sm font-medium">
              Running telemetry
            </div>
          </div>
        </div>
        <div className="p-3 text-xs text-neutral-500">
          Sampling sidebar motion, scroll geometry, renderer continuity,
          mutation, resource, layout-shift, and frame timing data across a full
          close/open cycle.
        </div>
      </aside>
    );
  }

  const failedCount = result.metrics.filter((metric) => !metric.passed).length;

  return (
    <aside
      className="absolute right-3 bottom-3 z-30 flex max-h-[55%] w-[24rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/95 text-neutral-200 shadow-2xl backdrop-blur"
      data-benchmark-telemetry-panel=""
      data-benchmark-run-status={result.status}
      data-benchmark-run-action-order={result.actionOrder}
      data-benchmark-run-format={result.format}
      data-benchmark-run-scroll-target={result.scrollTarget}
      data-benchmark-run-side={result.side}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {result.status === "passed" ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          ) : (
            <XCircle className="size-4 shrink-0 text-red-400" />
          )}
          <div className="truncate text-sm font-medium">
            {result.status === "passed"
              ? "Telemetry passed"
              : "Telemetry failed"}
          </div>
        </div>
        <div className="shrink-0 text-xs text-neutral-500">
          {result.sampledFrameCount} frames
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-b border-neutral-800 px-3 py-2 text-xs">
        <BenchmarkTelemetryStat
          label="Duration"
          value={`${Math.round(result.durationMs)}ms`}
        />
        <BenchmarkTelemetryStat
          label="Metrics"
          value={`${result.metrics.length - failedCount}/${result.metrics.length}`}
        />
        <BenchmarkTelemetryStat label="Failures" value={String(failedCount)} />
      </div>
      <div className="min-h-0 overflow-auto p-2">
        <div className="grid gap-1.5">
          {result.metrics.map((metric) => (
            <div
              key={metric.id}
              className="rounded-md border border-neutral-800 bg-neutral-900/70 p-2"
              data-benchmark-metric={metric.id}
              data-benchmark-metric-status={metric.passed ? "passed" : "failed"}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {metric.passed ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="size-3.5 shrink-0 text-red-400" />
                  )}
                  <div className="truncate text-xs font-medium">
                    {metric.label}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-neutral-400 tabular-nums">
                  {metric.value}
                </div>
              </div>
              <div className="mt-1 text-[11px] leading-4 text-neutral-500">
                Budget: {metric.budget}. {metric.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function BenchmarkTelemetryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-neutral-500">{label}</div>
      <div className="mt-0.5 font-medium text-neutral-200 tabular-nums">
        {value}
      </div>
    </div>
  );
}
