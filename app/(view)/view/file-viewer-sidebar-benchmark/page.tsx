"use client";

import * as React from "react";

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
  runFileViewerSidebarMotionBenchmark,
  type SidebarMotionBenchmarkResult,
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

const SIDES: readonly BenchmarkSide[] = ["right", "left"];

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
  "scroll drift",
  "sidebar sync",
];

export default function FileViewerSidebarBenchmarkPage() {
  const [activeFormatId, setActiveFormatId] =
    React.useState<BenchmarkFormatId>("pdf");
  const [side, setSide] = React.useState<BenchmarkSide>("right");
  const [result, setResult] =
    React.useState<SidebarMotionBenchmarkResult | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const activeFixture =
    FORMAT_BY_ID.get(activeFormatId) ?? BENCHMARK_FIXTURES[0];
  const handleRunBenchmark = React.useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    try {
      setResult(await runFileViewerSidebarMotionBenchmark());
    } catch (error) {
      setResult({
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
        side,
        status: "failed",
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeFormatId, side]);

  useKeyedMountEffect(joinEffectKey([activeFormatId, side]), () => {
    setResult(null);
  });

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
            className="h-full"
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
                      {activeFixture.label} · {side}
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
                  <div className="grid gap-3 border-t pt-4">
                    <button
                      className={cn(
                        "h-9 rounded-md border px-3 text-sm font-medium transition-colors",
                        isRunning
                          ? "text-muted-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                      )}
                      data-benchmark-run-button=""
                      disabled={isRunning}
                      type="button"
                      onClick={handleRunBenchmark}
                    >
                      {isRunning ? "Running" : "Run active benchmark"}
                    </button>
                    <BenchmarkResult result={result} isRunning={isRunning} />
                  </div>
                </FileViewerSidebarContent>
              </FileViewerSidebar>
              <FileViewerInset align={activeFixture.align}>
                <FileViewerViewport data-benchmark-viewport="">
                  <FileViewerDocument controls />
                </FileViewerViewport>
              </FileViewerInset>
            </FileViewerContent>
          </FileViewer>
        </FileViewerProvider>
      </section>
    </main>
  );
}

function BenchmarkResult({
  isRunning,
  result,
}: {
  isRunning: boolean;
  result: SidebarMotionBenchmarkResult | null;
}) {
  if (!result) {
    return (
      <div
        className="text-muted-foreground text-xs"
        data-benchmark-run-status={isRunning ? "running" : "idle"}
      >
        {isRunning ? "Sampling frames" : "No run yet"}
      </div>
    );
  }

  return (
    <div
      className="grid gap-2"
      data-benchmark-run-status={result.status}
      data-benchmark-run-format={result.format}
      data-benchmark-run-side={result.side}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {result.sampledFrameCount} frames
        </span>
        <span
          className={cn(
            "font-medium",
            result.status === "passed" ? "text-foreground" : "text-destructive",
          )}
        >
          {result.status}
        </span>
      </div>
      {result.metrics.map((metric) => (
        <div
          key={metric.id}
          className="rounded-md border px-3 py-2"
          data-benchmark-metric={metric.id}
          data-benchmark-metric-status={metric.passed ? "passed" : "failed"}
        >
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium">{metric.label}</span>
            <span
              className={cn(
                metric.passed ? "text-muted-foreground" : "text-destructive",
              )}
            >
              {metric.value}
            </span>
          </div>
          <div className="text-muted-foreground mt-1 text-[11px]">
            {metric.budget}
          </div>
        </div>
      ))}
    </div>
  );
}
