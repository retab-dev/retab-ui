"use client";

import * as React from "react";
import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";

// The runtime is registered on window by usePdfViewerTelemetry (mounted by
// every pdf viewer document runtime); its Window augmentation makes these
// types ambient, so the widget consumes the API without importing the module.
type TelemetryRuntime = NonNullable<Window["__pdfViewerTelemetry"]>;
type TelemetryResult = NonNullable<
  Awaited<ReturnType<TelemetryRuntime["runShellMotion"]>>
>;

// Floating Telemetry button + results popover for any page hosting a pdf
// FileViewer. Mount inside a `relative` container that wraps the viewer.
// Running it toggles the sidebar twice, samples every frame (including canvas
// pixel ink), prints the full result to the console, and shows the metric
// table in the popover — the same workflow as the simple-pdf-file-viewer
// playground.
export function FileViewerTelemetryWidget() {
  const [isRunning, setIsRunning] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<TelemetryResult | null>(null);

  const run = React.useCallback(async () => {
    const runtime = window.__pdfViewerTelemetry;
    if (!runtime) {
      setError(
        "Telemetry runtime is not mounted — open a PDF in the viewer first.",
      );
      setIsOpen(true);
      return;
    }

    setIsRunning(true);
    setIsOpen(true);
    setError(null);
    try {
      const nextResult = await runtime.runShellMotion();
      if (!nextResult) {
        setError("Telemetry run was skipped — the viewer shell is not ready.");
        return;
      }
      setResult(nextResult);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const failedCount = result
    ? result.metrics.filter((metric) => !metric.passed).length
    : 0;

  return (
    <>
      <button
        type="button"
        data-file-viewer-telemetry-button=""
        className="bg-background text-muted-foreground hover:text-foreground absolute right-3 top-3 z-30 inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm shadow-sm transition disabled:opacity-40"
        disabled={isRunning}
        onClick={() => {
          void run();
        }}
      >
        {isRunning ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Activity className="size-4" aria-hidden="true" />
        )}
        Telemetry
      </button>

      {isOpen && (isRunning || result || error) ? (
        <aside
          data-file-viewer-telemetry-panel=""
          data-file-viewer-telemetry-status={
            isRunning ? "running" : (result?.status ?? "error")
          }
          className="bg-background/95 absolute right-3 bottom-3 z-30 flex max-h-[55%] w-96 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border shadow-2xl backdrop-blur"
        >
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {isRunning ? (
                <Loader2
                  className="text-muted-foreground size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : result?.status === "passed" ? (
                <CheckCircle2
                  className="size-4 text-emerald-500"
                  aria-hidden="true"
                />
              ) : (
                <XCircle className="size-4 text-red-500" aria-hidden="true" />
              )}
              <div className="truncate text-sm font-medium">
                {isRunning
                  ? "Running telemetry"
                  : error
                    ? "Telemetry unavailable"
                    : result?.status === "passed"
                      ? "Telemetry passed"
                      : "Telemetry failed"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result ? (
                <div className="text-muted-foreground text-xs">
                  {result.sampledFrameCount} frames
                </div>
              ) : null}
              <button
                type="button"
                aria-label="Close telemetry panel"
                className="text-muted-foreground hover:text-foreground text-xs"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          {error ? (
            <div className="text-muted-foreground p-3 text-xs">{error}</div>
          ) : result ? (
            <>
              <div className="grid shrink-0 grid-cols-3 gap-2 border-b px-3 py-2 text-xs">
                <TelemetryStat
                  label="Duration"
                  value={`${Math.round(result.durationMs)}ms`}
                />
                <TelemetryStat
                  label="Metrics"
                  value={`${result.metrics.length - failedCount}/${result.metrics.length}`}
                />
                <TelemetryStat label="Failures" value={String(failedCount)} />
              </div>
              <div className="min-h-0 overflow-auto p-2">
                <div className="grid gap-1.5">
                  {result.metrics.map((metric) => (
                    <div
                      key={metric.id}
                      data-file-viewer-telemetry-metric={metric.id}
                      data-file-viewer-telemetry-metric-status={
                        metric.passed ? "passed" : "failed"
                      }
                      className="bg-muted/40 rounded-md border p-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {metric.passed ? (
                            <CheckCircle2
                              className="size-3.5 shrink-0 text-emerald-500"
                              aria-hidden="true"
                            />
                          ) : (
                            <XCircle
                              className="size-3.5 shrink-0 text-red-500"
                              aria-hidden="true"
                            />
                          )}
                          <div className="truncate text-xs font-medium">
                            {metric.label}
                          </div>
                        </div>
                        <div className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {metric.value}
                        </div>
                      </div>
                      <div className="text-muted-foreground/80 mt-1 text-[11px] leading-4">
                        Budget: {metric.budget}. {metric.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground p-3 text-xs">
              Toggling the sidebar and sampling scroll, page, canvas-pixel, and
              frame data across a close/open cycle. The full result is printed
              to the console.
            </div>
          )}
        </aside>
      ) : null}
    </>
  );
}

function TelemetryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}
