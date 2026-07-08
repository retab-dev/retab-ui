import { expect, test } from "@playwright/test";

// Source-switch contract: swapping the FileViewerProvider source is the other
// half of the viewer's motion story (the sidebar benchmark covers resize).
// Default assertions pin what must always hold — every switch renders, warm
// switches reuse caches, churn stays bounded. The continuity contract (a
// switch away from a rendered document never shows an empty viewport) is the
// aspirational target, asserted under FILE_VIEWER_ASSERT_SWITCH_CONTINUITY=1.
const ASSERT_SWITCH_CONTINUITY =
  process.env.FILE_VIEWER_ASSERT_SWITCH_CONTINUITY === "1";

type SourceSwitchBenchmarkMetric = {
  budget: string;
  detail: string;
  id: string;
  label: string;
  passed: boolean;
  value: string;
};

type SourceSwitchBenchmarkResult = {
  durationMs: number;
  formats: string[];
  metrics: SourceSwitchBenchmarkMetric[];
  runs: Array<{
    beforeHadContent: boolean;
    emptyFrameCount: number;
    from: string;
    mutationCount: number;
    oldContentDroppedAtMs: number | null;
    phase: "cold" | "warm";
    settledHasContent: boolean;
    timeToContentMs: number | null;
    to: string;
  }>;
  sampledFrameCount: number;
  status: "failed" | "passed";
};

type SourceSwitchTelemetryRuntime = {
  run: (options?: {
    formats?: readonly string[];
  }) => Promise<SourceSwitchBenchmarkResult | null>;
};

const DEFAULT_METRIC_IDS = [
  "switch-render",
  "switch-warm-render",
  "switch-settled-state",
  "switch-mutations",
] as const;

test.describe("FileViewer source switch benchmark", () => {
  test("benchmark page source switching meets the contract", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.waitForSelector('[data-slot="pdf-page"]', { timeout: 45_000 });
    await page.waitForTimeout(2_000);

    const result = (await page.evaluate(async () => {
      const telemetry = Reflect.get(
        window,
        "__fileViewerSourceSwitchTelemetry",
      ) as SourceSwitchTelemetryRuntime | undefined;
      return (await telemetry?.run()) ?? null;
    })) as SourceSwitchBenchmarkResult | null;

    expect(result, "source-switch telemetry runtime returned a result").not.toBeNull();
    if (!result) return;

    expect(result.formats.length).toBeGreaterThan(2);
    expect(result.runs.length).toBe((result.formats.length - 1) * 2);

    const failures: string[] = [];
    const assertedMetricIds: readonly string[] = ASSERT_SWITCH_CONTINUITY
      ? [...DEFAULT_METRIC_IDS, "switch-continuity"]
      : DEFAULT_METRIC_IDS;
    for (const metric of result.metrics) {
      if (!assertedMetricIds.includes(metric.id)) continue;
      if (metric.passed) continue;
      failures.push(
        `${metric.id}: ${metric.value} (budget: ${metric.budget}) — ${metric.detail}`,
      );
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("home showcase format switch renders every format", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.waitForSelector('[data-slot="file-viewer-root"]', {
      timeout: 45_000,
    });
    await page.waitForTimeout(2_000);
    await page
      .locator("button", { hasText: /^File Viewer$/ })
      .first()
      .click();
    await page.waitForSelector(
      '[data-slot="file-viewer-root"] [data-slot="file-viewer-viewport"]',
      { timeout: 45_000 },
    );
    await page.waitForTimeout(2_500);

    const report = (await page.evaluate(async () => {
      const nextFrame = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      const wait = (ms: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        });
      const readSample = () => {
        const viewport = document.querySelector<HTMLElement>(
          '[data-slot="file-viewer-root"] [data-slot="file-viewer-viewport"]',
        );
        if (!viewport) return { hasContent: false };
        const viewportRect = viewport.getBoundingClientRect();
        const contentSelectors = [
          '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
          '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
          '[data-slot="xlsx-grid"]',
          '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
          '[data-slot="csv-grid"]',
          '[data-slot="text-virtual-canvas"]',
        ];
        const hasRendererContent = contentSelectors.some((selector) =>
          [...viewport.querySelectorAll<HTMLElement>(selector)].some(
            (element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.width > 4 &&
                rect.height > 4 &&
                rect.bottom > viewportRect.top &&
                rect.top < viewportRect.bottom
              );
            },
          ),
        );
        const continuitySelectors = [
          '[data-slot="file-viewer-document-fallback"]',
          '[data-slot="html-file-viewer-content"]',
          '[data-slot="image-viewer"]',
        ];
        const hasContinuityShell = continuitySelectors.some((selector) =>
          [...viewport.querySelectorAll<HTMLElement>(selector)].some(
            (element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.width > 4 &&
                rect.height > 4 &&
                rect.bottom > viewportRect.top &&
                rect.top < viewportRect.bottom
              );
            },
          ),
        );
        let visibleCanvasCount = 0;
        let visibleIframeCount = 0;
        let shadowTextLength = 0;
        for (const canvas of viewport.querySelectorAll("canvas")) {
          const rect = canvas.getBoundingClientRect();
          if (
            canvas.width > 0 &&
            rect.width > 4 &&
            rect.height > 4 &&
            rect.bottom > viewportRect.top &&
            rect.top < viewportRect.bottom
          ) {
            visibleCanvasCount += 1;
          }
        }
        for (const iframe of viewport.querySelectorAll("iframe")) {
          const rect = iframe.getBoundingClientRect();
          if (rect.width > 40 && rect.height > 40) visibleIframeCount += 1;
        }
        for (const element of viewport.querySelectorAll("*")) {
          const shadowRoot = (element as HTMLElement).shadowRoot;
          if (!shadowRoot) continue;
          shadowTextLength += shadowRoot.textContent?.trim().length ?? 0;
          if (shadowTextLength >= 80) break;
        }
        const textLength = viewport.textContent?.trim().length ?? 0;
        const skeletonCount = [
          ...viewport.querySelectorAll('[data-slot="skeleton"]'),
        ].filter((element) => element.getBoundingClientRect().width > 4)
          .length;
        return {
          hasContinuity:
            hasRendererContent || skeletonCount > 0 || hasContinuityShell,
          hasContent:
            hasRendererContent ||
            visibleCanvasCount > 0 ||
            visibleIframeCount > 0 ||
            textLength >= 80 ||
            shadowTextLength >= 80,
          skeletonCount,
        };
      };
      const findTabs = () =>
        [...document.querySelectorAll<HTMLElement>('[role="tab"], button')]
          .filter((element) =>
            /^(PDF|Image|XLSX|DOCX|CSV|Text)$/i.test(
              element.textContent?.trim() ?? "",
            ),
          );
      const tabLabels = [
        ...new Set(findTabs().map((tab) => tab.textContent?.trim() ?? "")),
      ];
      const clickTab = (label: string) => {
        findTabs()
          .find((tab) => tab.textContent?.trim() === label)
          ?.click();
      };

      const sampleSwitch = async (label: string, phase: "cold" | "warm") => {
        const before = readSample();
        const startedAt = performance.now();
        clickTab(label);
        let timeToContentMs: number | null = null;
        let emptyFrameCount = 0;
        let hadContentSinceSwitch = false;
        while (performance.now() - startedAt < 5_000) {
          await nextFrame();
          const sample = readSample();
          const elapsedMs = Math.round(performance.now() - startedAt);
          if (sample.hasContent) {
            hadContentSinceSwitch = true;
            if (timeToContentMs == null) timeToContentMs = elapsedMs;
            if (elapsedMs - timeToContentMs > 200) break;
          } else if (!sample.hasContinuity) {
            emptyFrameCount += 1;
          }
        }
        return {
          beforeHadContent: before.hasContent,
          emptyFrameCount,
          label,
          phase,
          settledHasContent: hadContentSinceSwitch,
          timeToContentMs,
        };
      };

      const runs = [];
      for (const label of tabLabels.slice(1)) {
        runs.push(await sampleSwitch(label, "cold"));
        await wait(700);
      }
      for (const label of [...tabLabels].reverse().slice(1)) {
        runs.push(await sampleSwitch(label, "warm"));
        await wait(500);
      }
      return { runs, tabLabels };
    })) as {
      runs: Array<{
        beforeHadContent: boolean;
        emptyFrameCount: number;
        label: string;
        phase: "cold" | "warm";
        settledHasContent: boolean;
        timeToContentMs: number | null;
      }>;
      tabLabels: string[];
    };

    expect(
      report.tabLabels.length,
      `showcase format tabs found: ${report.tabLabels.join(", ")}`,
    ).toBeGreaterThan(2);

    const failures: string[] = [];
    for (const run of report.runs) {
      if (!run.settledHasContent) {
        failures.push(
          `${run.label} (${run.phase}): never rendered within 5s (budget: every switch renders)`,
        );
      }
      if (run.phase === "warm" && (run.timeToContentMs ?? Infinity) > 1_000) {
        failures.push(
          `${run.label} (warm): rendered after ${run.timeToContentMs}ms (budget: <= 1000ms warm)`,
        );
      }
      if (
        ASSERT_SWITCH_CONTINUITY &&
        run.beforeHadContent &&
        run.emptyFrameCount > 0
      ) {
        failures.push(
          `${run.label} (${run.phase}): ${run.emptyFrameCount} empty viewport frames (budget: 0 — hold the previous document until the successor paints)`,
        );
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
