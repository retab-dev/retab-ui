import { expect, test, type Page } from "@playwright/test";

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
type BenchmarkActionOrder = "close-open" | "open-close";

type BenchmarkSample = {
  activeElementRole: string;
  clientHeight: number;
  clientWidth: number;
  contentWidth: number;
  documentHasFocus: boolean;
  fingerprint: string;
  format: string | null;
  frameWidth: number;
  gapWidth: number;
  readingAnchor: BenchmarkReadingAnchor | null;
  rendererContinuity: BenchmarkRendererContinuity;
  rootWidth: number;
  sidebarOpen: string | null;
  sidebarState: string | null;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  timestamp: number;
  transform: string | null;
  triggerExpanded: string | null;
  triggerState: string | null;
  visualBottom: number | null;
  visualHeight: number | null;
  visualLeft: number | null;
  visualRight: number | null;
  visualTop: number | null;
  visualWidth: number | null;
  windowScrollY: number;
};

type BenchmarkRendererAnchor = {
  bottom: number;
  height: number;
  id: string;
  top: number;
};

type BenchmarkReadingAnchor =
  | {
      kind: "top";
    }
  | {
      id: string;
      kind: "boundary";
      topInViewport: number;
      yRatio: number;
    }
  | {
      id: string;
      kind: "page";
      markerTop: number;
      yRatio: number;
    };

type BenchmarkRendererContinuity = {
  renderedIds: string[];
  visibleAnchors: BenchmarkRendererAnchor[];
  visibleRenderedIds: string[];
};

type BenchmarkMotionRun = {
  action: "close" | "open";
  after: BenchmarkSample;
  before: BenchmarkSample;
  layoutShiftCount: number;
  layoutShiftScore: number;
  longTaskCount: number;
  longTaskDuration: number;
  rendererAddedNodeCount: number;
  rendererMutationCount: number;
  rendererRemovedNodeCount: number;
  resourceCountDelta: number;
  resourceNames: string[];
  samples: BenchmarkSample[];
  scrollEventCount: number;
  scrollTarget: BenchmarkScrollTarget;
  windowScrollEventCount: number;
};

type BenchmarkRunResult = {
  actionOrder: BenchmarkActionOrder;
  close: BenchmarkMotionRun;
  open: BenchmarkMotionRun;
};

type BenchmarkRunOptions = {
  actionOrder?: BenchmarkActionOrder;
  sampleFrameCount?: number;
  scrollTarget?: BenchmarkScrollTarget;
  settleFrameCount?: number;
};

type BenchmarkViewportScenario = {
  deviceScaleFactor?: number;
  label: string;
  viewport: {
    height: number;
    width: number;
  };
};

type BenchmarkScrollTarget = {
  bottomOffsetPx?: number;
  label: string;
  minTop?: number;
  pdfPage?: number;
  pdfPageOffsetPx?: number;
  ratio?: number;
  top?: number;
  viewportMultiplier?: number;
};

type BenchmarkViewport = {
  height: number;
  label: string;
  width: number;
};

type PdfPageGapRun = {
  action: "close" | "open";
  pairs: PdfPageGapPair[];
};

type PdfPageGapPair = {
  gapValues: number[];
  movingRange: number;
  pair: string;
  range: number;
  reversals: number;
  settleSnap: number;
};

type PdfPageGapBenchmarkResult = {
  close: PdfPageGapRun;
  open: PdfPageGapRun;
};

type PdfViewerTelemetryMetric = {
  budget: string;
  detail: string;
  id: string;
  label: string;
  passed: boolean;
  value: string;
};

type PdfViewerTelemetryResult = {
  durationMs: number;
  metrics: PdfViewerTelemetryMetric[];
  sampledFrameCount: number;
  status: "failed" | "passed";
};

type PdfViewerTelemetryRuntime = {
  runShellMotion: (options?: {
    sampleFrameCount?: number;
    settleFrameCount?: number;
  }) => Promise<PdfViewerTelemetryResult | null>;
};

type FileViewerSidebarBenchmarkTelemetryMetric = {
  budget: string;
  detail: string;
  id: string;
  label: string;
  passed: boolean;
  value: string;
};

type FileViewerSidebarBenchmarkTelemetryResult = {
  actionOrder: BenchmarkActionOrder;
  durationMs: number;
  format: string;
  metrics: FileViewerSidebarBenchmarkTelemetryMetric[];
  runs?: {
    close: { samples: unknown[] };
    open: { samples: unknown[] };
    rapidToggle: { samples: unknown[] };
  };
  sampledFrameCount: number;
  scrollTarget: string;
  side: string;
  status: "failed" | "passed";
};

type FileViewerSidebarBenchmarkTelemetryRuntime = {
  getLastResult: () => FileViewerSidebarBenchmarkTelemetryResult | null;
  run: (options?: {
    actionOrder?: BenchmarkActionOrder;
    scrollTargetId?: string;
  }) => Promise<FileViewerSidebarBenchmarkTelemetryResult | null>;
};

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput?: boolean;
  value?: number;
};

const FORMAT_IDS: readonly BenchmarkFormatId[] = [
  "pdf",
  "image",
  "tiff",
  "xlsx",
  "pptx",
  "docx",
  "csv",
  "markdown",
  "html",
  "code",
  "text",
];

const SIDES: readonly BenchmarkSide[] = ["right", "left"];
const ASSERT_RENDERER_CONTINUITY =
  process.env.FILE_VIEWER_ASSERT_RENDERER_CONTINUITY === "1";
const ASSERT_VISUAL_SMOOTHNESS =
  process.env.FILE_VIEWER_ASSERT_VISUAL_SMOOTHNESS === "1";
const ASSERT_VIEWPORT_MATRIX =
  process.env.FILE_VIEWER_ASSERT_VIEWPORT_MATRIX === "1";
const READING_ANCHOR_Y_RATIO_BUDGET = 0.01;
const READING_FRACTION_FALLBACK_BUDGET = 0.01;
const CYCLE_READING_ANCHOR_Y_RATIO_BUDGET = 0.005;
const CYCLE_READING_FRACTION_FALLBACK_BUDGET = 0.005;
const DEFAULT_BENCHMARK_SCROLL_TARGET = {
  label: "deep",
  minTop: 160,
  ratio: 0.72,
  viewportMultiplier: 3.6,
} satisfies BenchmarkScrollTarget;
const PDF_VISUAL_SCROLL_TARGETS = [
  { label: "top", top: 0 },
  { label: "one-viewport", minTop: 160, viewportMultiplier: 1 },
  { label: "page-boundary", minTop: 160, viewportMultiplier: 2.05 },
  {
    label: "page-4-gap",
    minTop: 160,
    pdfPage: 4,
    pdfPageOffsetPx: -96,
    viewportMultiplier: 4.05,
  },
  DEFAULT_BENCHMARK_SCROLL_TARGET,
  { bottomOffsetPx: 64, label: "near-bottom" },
] satisfies readonly BenchmarkScrollTarget[];
const PDF_VISUAL_SCENARIOS = [
  ...PDF_VISUAL_SCROLL_TARGETS.map((scrollTarget) => ({
    actionOrder: "close-open" as const,
    label: scrollTarget.label,
    scrollTarget,
  })),
  {
    actionOrder: "open-close" as const,
    label: "deep-closed-start",
    scrollTarget: DEFAULT_BENCHMARK_SCROLL_TARGET,
  },
] satisfies readonly {
  actionOrder: BenchmarkActionOrder;
  label: string;
  scrollTarget: BenchmarkScrollTarget;
}[];
const PDF_VIEWPORT_SCENARIOS = [
  { label: "compact", viewport: { width: 1024, height: 700 } },
  { label: "short", viewport: { width: 1280, height: 640 } },
  { label: "desktop", viewport: { width: 1440, height: 1000 } },
  { label: "tall", viewport: { width: 1180, height: 1200 } },
  {
    deviceScaleFactor: 2,
    label: "retina",
    viewport: { width: 1280, height: 900 },
  },
] satisfies readonly BenchmarkViewportScenario[];
const PDF_VISUAL_VIEWPORTS = [
  { height: 900, label: "desktop", width: 1280 },
  { height: 760, label: "compact", width: 980 },
  { height: 1040, label: "wide", width: 1600 },
] satisfies readonly BenchmarkViewport[];
const PDF_VISUAL_ROUTES = [
  { label: "files", path: "/files" },
  { label: "home", path: "/" },
] satisfies readonly { label: string; path: string }[];

const READY_SELECTORS: Record<BenchmarkFormatId, string> = {
  pdf: '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
  image:
    '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
  tiff: '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
  xlsx: '[data-slot="xlsx-grid"]',
  pptx: '[data-slot="pptx-slide"]',
  docx: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
  csv: '[data-slot="csv-grid"]',
  markdown: '[data-slot="markdown-virtual-canvas"]',
  html: '[data-slot="html-file-viewer-content"] iframe',
  code: '[data-slot="code-viewer"] [data-code-render-window]',
  text: '[data-slot="text-virtual-canvas"]',
};

test.describe("FileViewer sidebar motion benchmark", () => {
  for (const side of SIDES) {
    test(`${side} sidebar has no overshoot, reversal, scroll drift, or desync`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/view/file-viewer-sidebar-benchmark");
      await selectBenchmarkSide(page, side);

      const failures: string[] = [];
      const summaries: unknown[] = [];

      for (const format of FORMAT_IDS) {
        await test.step(`${format}/${side}`, async () => {
          await selectBenchmarkFormat(page, format);
          await waitForBenchmarkFormat(page, format);

          const result = await runSidebarBenchmark(page);
          summaries.push(summarizeBenchmarkResult(result, `${format}/${side}`));
          failures.push(
            ...collectBenchmarkFailures(result, `${format}/${side}`),
          );
        });
      }

      await test.info().attach(`file-viewer-sidebar-motion-${side}.json`, {
        body: JSON.stringify(summaries, null, 2),
        contentType: "application/json",
      });

      expect(failures, failures.join("\n")).toEqual([]);
    });
  }

  test("manual runner reports active benchmark metrics", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await waitForBenchmarkFormat(page, "pdf");

    await page
      .locator('[data-benchmark-action-order-option="open-close"]')
      .click();
    await page
      .locator('[data-benchmark-scroll-target-option="page-4-gap"]')
      .click();
    await expect(page.locator("[data-benchmark-telemetry-panel]")).toHaveCount(
      0,
    );
    await page.locator("[data-benchmark-run-button]").click();
    const status = page.locator("[data-benchmark-run-status]").first();
    await expect(status).toBeVisible({ timeout: 45_000 });
    await expect(status).toHaveClass(/absolute right-3 bottom-3/);
    expect(
      await status.evaluate((element) =>
        Boolean(element.closest('[aria-label="Benchmark contracts"]')),
      ),
    ).toBe(false);
    await expect(status).toHaveAttribute(
      "data-benchmark-run-action-order",
      "open-close",
    );
    await expect(status).toHaveAttribute(
      "data-benchmark-run-scroll-target",
      "page-4-gap",
    );
    await expect(page.locator("[data-benchmark-metric]")).toHaveCount(20);
  });

  test("telemetry runtime exposes full active benchmark result", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const telemetryConsoleMessages: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("[file-viewer:sidebar-benchmark]")) {
        telemetryConsoleMessages.push(text);
      }
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await selectBenchmarkFormat(page, "tiff");
    await waitForBenchmarkFormat(page, "tiff");
    await expect(
      page.locator("[data-benchmark-telemetry-button]"),
    ).toContainText("Telemetry");

    const result = (await page.evaluate(async () => {
      const telemetry = Reflect.get(
        window,
        "__fileViewerSidebarBenchmarkTelemetry",
      ) as FileViewerSidebarBenchmarkTelemetryRuntime | undefined;
      // Discarded warm-up run: the first cycle on a cold dev server pays
      // module compilation and first-raster costs that read as main-thread
      // long tasks. The asserted run measures the steady state.
      await telemetry?.run({
        actionOrder: "close-open",
        scrollTargetId: "deep",
      });
      return (
        (await telemetry?.run({
          actionOrder: "close-open",
          scrollTargetId: "deep",
        })) ?? null
      );
    })) as FileViewerSidebarBenchmarkTelemetryResult | null;

    expect(result).not.toBeNull();
    expect(result?.format).toBe("tiff");
    expect(result?.status).toBe("passed");
    expect(result?.sampledFrameCount).toBeGreaterThan(80);
    expect(result?.metrics).toHaveLength(20);
    expect(result?.runs?.close.samples.length).toBeGreaterThan(20);
    expect(result?.runs?.open.samples.length).toBeGreaterThan(20);
    expect(result?.runs?.rapidToggle.samples.length).toBeGreaterThan(20);
    expect(
      result?.metrics
        .filter((metric) => !metric.passed)
        .map((metric) => metric.id) ?? [],
    ).toEqual([]);

    const lastResult = (await page.evaluate(() => {
      const telemetry = Reflect.get(
        window,
        "__fileViewerSidebarBenchmarkTelemetry",
      ) as FileViewerSidebarBenchmarkTelemetryRuntime | undefined;
      return telemetry?.getLastResult() ?? null;
    })) as FileViewerSidebarBenchmarkTelemetryResult | null;

    expect(lastResult?.status).toBe(result?.status);
    await expect(
      page.locator(
        '[data-benchmark-telemetry-panel][data-benchmark-run-status="passed"]',
      ),
    ).toBeVisible();
    expect(
      telemetryConsoleMessages.some((message) =>
        message.startsWith("[file-viewer:sidebar-benchmark] result {"),
      ),
    ).toBe(true);
    expect(
      telemetryConsoleMessages.some((message) =>
        message.startsWith("[file-viewer:sidebar-benchmark] full result {"),
      ),
    ).toBe(true);
  });

  test("PDF deep telemetry preserves reading identity", async ({ page }) => {
    test.setTimeout(90_000);
    const telemetryConsoleMessages: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("[file-viewer:sidebar-benchmark]")) {
        telemetryConsoleMessages.push(text);
      }
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await waitForBenchmarkFormat(page, "pdf");
    await page.locator('[data-benchmark-scroll-target-option="deep"]').click();
    await page.waitForFunction(() => {
      const scroller = document.querySelector<HTMLElement>(
        '[data-slot="file-viewer-root"][data-benchmark-active-format="pdf"] [data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
      );
      return (
        scroller != null && scroller.scrollHeight > scroller.clientHeight * 20
      );
    });

    const result = (await page.evaluate(async () => {
      const telemetry = Reflect.get(
        window,
        "__fileViewerSidebarBenchmarkTelemetry",
      ) as FileViewerSidebarBenchmarkTelemetryRuntime | undefined;
      return (
        (await telemetry?.run({
          actionOrder: "close-open",
          scrollTargetId: "deep",
        })) ?? null
      );
    })) as FileViewerSidebarBenchmarkTelemetryResult | null;

    expect(result).not.toBeNull();
    expect(result?.format).toBe("pdf");
    expect(result?.scrollTarget).toBe("deep");
    expect(result?.status).toBe("passed");
    expect(
      result?.metrics
        .filter((metric) => !metric.passed)
        .map((metric) => metric.id) ?? [],
    ).toEqual([]);
    expect(
      telemetryConsoleMessages.some((message) =>
        message.startsWith("[file-viewer:sidebar-benchmark] failures "),
      ),
    ).toBe(false);
  });

  test("production PDF telemetry reports no sidebar motion regressions", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const telemetryConsoleMessages: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("[pdf-viewer:telemetry]")) {
        telemetryConsoleMessages.push(text);
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await waitForBenchmarkFormat(page, "pdf");

    const failures: string[] = [];
    for (const scenario of [
      { label: "top", top: 0 },
      { label: "deep", minTop: 160, ratio: 0.72, viewportMultiplier: 3.6 },
    ]) {
      await page.evaluate(async (target) => {
        const scroller = document.querySelector<HTMLElement>(
          '[data-slot="file-viewer-root"][data-benchmark-active-format="pdf"] [data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
        );
        if (!scroller) throw new Error("PDF telemetry scroller unavailable.");

        const availableScroll = Math.max(
          0,
          scroller.scrollHeight - scroller.clientHeight,
        );
        const candidates = [target.top ?? target.minTop ?? 0];
        if (target.viewportMultiplier != null) {
          candidates.push(scroller.clientHeight * target.viewportMultiplier);
        }
        if (target.ratio != null) {
          candidates.push(availableScroll * target.ratio);
        }
        scroller.scrollTop = Math.min(
          availableScroll,
          Math.max(0, ...candidates),
        );
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        for (let index = 0; index < 20; index += 1) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
        }
      }, scenario);
      await expect
        .poll(
          async () =>
            page.evaluate((label) => {
              const sample = Reflect.get(
                window,
                "__pdfViewerTelemetry",
              )?.readSample?.();
              if (!sample || sample.hasBlink) return "pending";
              if (label === "deep" && (sample.primaryPageNumber ?? 0) <= 1) {
                return "pending";
              }
              return "ready";
            }, scenario.label),
          { timeout: 45_000 },
        )
        .toBe("ready");

      const result = (await page.evaluate(async () => {
        const telemetry = Reflect.get(window, "__pdfViewerTelemetry") as
          | PdfViewerTelemetryRuntime
          | undefined;
        return (
          (await telemetry?.runShellMotion({
            sampleFrameCount: 40,
            settleFrameCount: 14,
          })) ?? null
        );
      })) as PdfViewerTelemetryResult | null;

      expect(result).not.toBeNull();
      expect(result?.sampledFrameCount).toBeGreaterThan(40);

      await test.info().attach(`pdf-viewer-telemetry-${scenario.label}.json`, {
        body: JSON.stringify(result, null, 2),
        contentType: "application/json",
      });

      failures.push(
        ...(result?.metrics
          .filter((metric) => !metric.passed)
          .map(
            (metric) =>
              `${scenario.label}/${metric.id}: ${metric.value} exceeds ${metric.budget}. ${metric.detail}`,
          ) ?? []),
      );
    }

    expect(
      telemetryConsoleMessages.some((message) =>
        message.startsWith("[pdf-viewer:telemetry] result {"),
      ),
    ).toBe(true);
    expect(
      telemetryConsoleMessages.some((message) =>
        message.startsWith("[pdf-viewer:telemetry] full result {"),
      ),
    ).toBe(true);

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("benchmark page PDF sidebar survives viewport matrix", async ({
    browser,
  }) => {
    test.skip(!ASSERT_VIEWPORT_MATRIX, "viewport matrix is opt-in");
    test.setTimeout(240_000);

    const failures: string[] = [];
    const summaries: unknown[] = [];

    for (const scenario of PDF_VIEWPORT_SCENARIOS) {
      const context = await browser.newContext({
        deviceScaleFactor: scenario.deviceScaleFactor,
        viewport: scenario.viewport,
      });
      const page = await context.newPage();

      try {
        await page.goto("/view/file-viewer-sidebar-benchmark");
        await waitForBenchmarkFormat(page, "pdf");

        const result = await runSidebarBenchmark(page, undefined, {
          sampleFrameCount: 48,
          scrollTarget: DEFAULT_BENCHMARK_SCROLL_TARGET,
          settleFrameCount: 24,
        });
        const label = `benchmark/pdf/${scenario.label}`;
        summaries.push(summarizeBenchmarkResult(result, label));
        failures.push(...collectBenchmarkFailures(result, label));
      } finally {
        await context.close();
      }
    }

    await test
      .info()
      .attach("file-viewer-sidebar-motion-viewport-matrix.json", {
        body: JSON.stringify(summaries, null, 2),
        contentType: "application/json",
      });

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("files PDF sidebar has no visual surface hop", async ({ page }) => {
    test.skip(
      !ASSERT_VISUAL_SMOOTHNESS,
      "visual surface assertions are opt-in",
    );
    test.setTimeout(360_000);

    const failures: string[] = [];
    const summaries: unknown[] = [];

    for (const viewport of PDF_VISUAL_VIEWPORTS) {
      await preparePdfVisualBenchmarkRoute(page, "/files", viewport);

      for (const scenario of PDF_VISUAL_SCENARIOS) {
        const result = await runSidebarBenchmark(
          page,
          '[data-slot="file-viewer-root"]',
          {
            actionOrder: scenario.actionOrder,
            sampleFrameCount: 48,
            scrollTarget: scenario.scrollTarget,
            settleFrameCount: 24,
          },
        );
        const label = `files/pdf/${viewport.label}/${scenario.label}`;
        summaries.push(summarizeBenchmarkResult(result, label));
        failures.push(...collectBenchmarkFailures(result, label));
      }
    }

    await test.info().attach("file-viewer-sidebar-motion-files-pdf.json", {
      body: JSON.stringify(summaries, null, 2),
      contentType: "application/json",
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("home PDF sidebar has no deep scroll geometry jump", async ({
    page,
  }) => {
    test.skip(
      !ASSERT_VISUAL_SMOOTHNESS,
      "visual surface assertions are opt-in",
    );
    test.setTimeout(360_000);

    const failures: string[] = [];
    const summaries: unknown[] = [];

    for (const viewport of PDF_VISUAL_VIEWPORTS) {
      await preparePdfVisualBenchmarkRoute(page, "/", viewport);

      for (const scenario of PDF_VISUAL_SCENARIOS) {
        const result = await runSidebarBenchmark(
          page,
          '[data-slot="file-viewer-root"]',
          {
            actionOrder: scenario.actionOrder,
            sampleFrameCount: 48,
            scrollTarget: scenario.scrollTarget,
            settleFrameCount: 24,
          },
        );
        const label = `home/pdf/${viewport.label}/${scenario.label}`;
        summaries.push(summarizeBenchmarkResult(result, label));
        failures.push(...collectBenchmarkFailures(result, label));
      }
    }

    await test.info().attach("file-viewer-sidebar-motion-home-pdf.json", {
      body: JSON.stringify(summaries, null, 2),
      contentType: "application/json",
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("PDF sidebar keeps page gaps fixed", async ({ page }) => {
    test.skip(
      !ASSERT_VISUAL_SMOOTHNESS,
      "visual surface assertions are opt-in",
    );
    test.setTimeout(420_000);

    const failures: string[] = [];
    const summaries: unknown[] = [];

    for (const route of PDF_VISUAL_ROUTES) {
      for (const viewport of PDF_VISUAL_VIEWPORTS) {
        await preparePdfVisualBenchmarkRoute(page, route.path, viewport);

        for (const scrollTarget of PDF_VISUAL_SCROLL_TARGETS) {
          const result = await runPdfPageGapBenchmark(
            page,
            '[data-slot="file-viewer-root"]',
            scrollTarget,
          );
          const label = `${route.label}/pdf/${viewport.label}/${scrollTarget.label}`;
          summaries.push({ label, result });
          failures.push(...collectPdfPageGapFailures(result, label));
        }
      }
    }

    await test.info().attach("file-viewer-sidebar-motion-pdf-gaps.json", {
      body: JSON.stringify(summaries, null, 2),
      contentType: "application/json",
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });
});

async function preparePdfVisualBenchmarkRoute(
  page: Page,
  path: string,
  viewport: BenchmarkViewport,
) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  await page.goto(path);

  const root = page.locator('[data-slot="file-viewer-root"]').first();
  await expect(root).toBeVisible({ timeout: 45_000 });
  await expect(
    root
      .locator(
        '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
      )
      .first(),
  ).toBeVisible({ timeout: 45_000 });
  await page.evaluate(async () => {
    for (let index = 0; index < 4; index += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
  });
}

async function selectBenchmarkSide(page: Page, side: BenchmarkSide) {
  await page.locator(`[data-benchmark-side-option="${side}"]`).click();
  await expect(
    page.locator(
      `[data-slot="file-viewer-root"][data-benchmark-side="${side}"]`,
    ),
  ).toBeVisible();
}

async function selectBenchmarkFormat(page: Page, format: BenchmarkFormatId) {
  await page.locator(`[data-benchmark-format-option="${format}"]`).click();
  await expect(
    page.locator(
      `[data-slot="file-viewer-root"][data-benchmark-active-format="${format}"]`,
    ),
  ).toBeVisible();
}

async function waitForBenchmarkFormat(page: Page, format: BenchmarkFormatId) {
  const root = page.locator(
    `[data-slot="file-viewer-root"][data-benchmark-active-format="${format}"]`,
  );
  await expect(root.locator(READY_SELECTORS[format]).first()).toBeVisible({
    timeout: 45_000,
  });
  await page.evaluate(async () => {
    for (let index = 0; index < 4; index += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
  });
}

async function runSidebarBenchmark(
  page: Page,
  rootSelector = '[data-slot="file-viewer-root"][data-benchmark-active-format]',
  options: BenchmarkRunOptions = {},
): Promise<BenchmarkRunResult> {
  const {
    actionOrder = "close-open",
    sampleFrameCount = 22,
    scrollTarget = DEFAULT_BENCHMARK_SCROLL_TARGET,
    settleFrameCount = 8,
  } = options;

  return page.evaluate(
    async (benchmarkOptions) => {
      const {
        actionOrder,
        benchmarkRootSelector,
        sampleFrameCount,
        scrollTarget,
        settleFrameCount,
      } = benchmarkOptions;
      const nextAnimationFrame = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const sampleAnimationFrames = async (count: number) => {
        for (let index = 0; index < count; index += 1) {
          await nextAnimationFrame();
        }
      };
      const readingBoundarySnapPx = 24;
      const root = document.querySelector<HTMLElement>(benchmarkRootSelector);
      const trigger = root?.querySelector<HTMLButtonElement>(
        '[data-slot="file-viewer-sidebar-trigger"]',
      );
      const gap = root?.querySelector<HTMLElement>(
        '[data-slot="file-viewer-sidebar-gap"]',
      );
      const frame = root?.querySelector<HTMLElement>(
        '[data-slot="file-viewer-document-frame"]',
      );
      const content = root?.querySelector<HTMLElement>(
        '[data-slot="file-viewer-content"]',
      );

      if (!root || !trigger || !gap || !frame || !content) {
        throw new Error("FileViewer benchmark fixture is not mounted.");
      }

      const queryFirst = (
        host: ParentNode,
        selectors: readonly string[],
      ): HTMLElement | null => {
        for (const selector of selectors) {
          const element = host.querySelector<HTMLElement>(selector);
          if (element) return element;
        }
        return null;
      };
      const resolveBenchmarkScroller = (host: HTMLElement) =>
        queryFirst(host, [
          '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
          '[data-slot="image-viewer"] [data-slot="scroll-area-viewport"]',
          '[data-slot="docx-viewer"] [data-slot="scroll-area-viewport"]',
          '[data-slot="pptx-viewer"] [data-slot="scroll-area-viewport"]',
          '[data-slot="markdown-greenfield-content"] [data-slot="scroll-area-viewport"]',
          '[data-slot="text-viewer"] [data-slot="scroll-area-viewport"]',
          '[data-slot="code-viewer"] [data-slot="scroll-area-viewport"]',
          '[data-slot="csv-body"]',
          '[data-slot="xlsx-body"]',
          '[data-slot="html-file-viewer-content"] > div:last-child',
          "[data-benchmark-viewport]",
        ]);
      const resolveBenchmarkVisual = (host: HTMLElement) =>
        queryFirst(host, [
          '[data-slot="pdf-viewer-visual-stage"]',
          '[data-slot="image-viewer-document"]',
          '[data-slot="pptx-viewer-document-surface"]',
          '[data-slot="docx-viewer"] .docx-wrapper',
          '[data-slot="markdown-virtual-canvas"]',
          '[data-slot="text-virtual-canvas"]',
          "[data-code-render-window]",
          '[data-slot="csv-grid"]',
          '[data-slot="xlsx-grid"]',
          '[data-slot="html-file-viewer-content"] iframe',
          '[data-slot="file-viewer-document-frame"]',
        ]);
      // Scoped to the document frame: sidebar thumbnails legitimately warm
      // more canvases while the sidebar is open (and stay mounted after it
      // closes), which is cache warm-up, not renderer churn.
      const readBenchmarkFingerprint = (host: HTMLElement) => {
        const documentHost =
          host.querySelector<HTMLElement>(
            '[data-slot="file-viewer-document-frame"]',
          ) ?? host;
        return JSON.stringify({
          canvases: documentHost.querySelectorAll("canvas").length,
          codeWindows: documentHost.querySelectorAll(
            "[data-code-render-window]",
          ).length,
          csvRows: documentHost.querySelectorAll('[data-slot="csv-row"]')
            .length,
          docxPages: documentHost.querySelectorAll(
            '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
          ).length,
          htmlIframes: documentHost.querySelectorAll(
            '[data-slot="html-file-viewer-content"] iframe',
          ).length,
          imageDocuments: documentHost.querySelectorAll(
            '[data-slot="image-viewer-document"]',
          ).length,
          markdownChunks: documentHost.querySelectorAll("[data-markdown-chunk]")
            .length,
          pdfPages: documentHost.querySelectorAll('[data-slot="pdf-page"]')
            .length,
          pptxSlides: documentHost.querySelectorAll('[data-slot="pptx-slide"]')
            .length,
          textCanvases: documentHost.querySelectorAll(
            '[data-slot="text-virtual-canvas"]',
          ).length,
          xlsxRows: documentHost.querySelectorAll('[data-slot="xlsx-row"]')
            .length,
        });
      };
      const readActiveElementRole = (activeElement: Element | null) => {
        if (!(activeElement instanceof HTMLElement)) return "none";
        if (activeElement === document.body) return "body";
        if (activeElement === trigger) return "trigger";
        if (root.contains(activeElement)) {
          return (
            activeElement.dataset.slot ?? activeElement.tagName.toLowerCase()
          );
        }
        return "outside";
      };
      const formatSelectors = [
        { format: "pdf", selector: '[data-slot="pdf-viewer"]' },
        { format: "image", selector: '[data-slot="image-viewer"]' },
        { format: "pptx", selector: '[data-slot="pptx-viewer"]' },
        { format: "docx", selector: '[data-slot="docx-viewer"]' },
        { format: "csv", selector: '[data-slot="csv-grid"]' },
        { format: "xlsx", selector: '[data-slot="xlsx-grid"]' },
        {
          format: "markdown",
          selector: '[data-slot="markdown-virtual-canvas"]',
        },
        { format: "text", selector: '[data-slot="text-virtual-canvas"]' },
        { format: "code", selector: "[data-code-render-window]" },
        {
          format: "html",
          selector: '[data-slot="html-file-viewer-content"] iframe',
        },
      ] as const;
      const readBenchmarkFormat = (host: HTMLElement) => {
        if (host.dataset.benchmarkActiveFormat) {
          return host.dataset.benchmarkActiveFormat;
        }

        return formatSelectors.find(({ selector }) =>
          host.querySelector(selector),
        )?.format;
      };
      const readRendererContinuity = (
        host: HTMLElement,
        scroller: HTMLElement | null,
        visual: HTMLElement | null,
      ): BenchmarkRendererContinuity => {
        const viewportRect = (scroller ?? host).getBoundingClientRect();
        const isVisibleInViewport = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 1 &&
            rect.height > 1 &&
            rect.bottom > viewportRect.top + 1 &&
            rect.top < viewportRect.bottom - 1 &&
            rect.right > viewportRect.left + 1 &&
            rect.left < viewportRect.right - 1
          );
        };
        const keyedElements = ({
          id,
          rendered,
          selector,
        }: {
          id: (element: HTMLElement, index: number) => string;
          rendered?: (element: HTMLElement) => boolean;
          selector: string;
        }) =>
          Array.from(host.querySelectorAll<HTMLElement>(selector)).map(
            (element, index) => ({
              element,
              id: id(element, index),
              rendered: rendered ? rendered(element) : true,
            }),
          );
        const format = readBenchmarkFormat(host);
        const items =
          format === "pdf"
            ? keyedElements({
                selector: '[data-slot="pdf-page"]',
                id: (element) => `pdf:${element.dataset.page ?? ""}`,
                rendered: (element) => Boolean(element.querySelector("canvas")),
              })
            : format === "image" || format === "tiff"
              ? keyedElements({
                  selector: '[data-slot="image-frame"]',
                  id: (element) => `image:${element.dataset.frameNumber ?? ""}`,
                  rendered: (element) =>
                    Boolean(element.querySelector("canvas")),
                })
              : format === "pptx"
                ? keyedElements({
                    selector: '[data-slot="pptx-slide"]',
                    id: (element) =>
                      `pptx:${element.dataset.slideNumber ?? ""}`,
                  })
                : format === "docx"
                  ? keyedElements({
                      selector:
                        '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
                      id: (_element, index) => `docx:${index + 1}`,
                    })
                  : format === "csv"
                    ? visual
                      ? [{ element: visual, id: "csv:grid", rendered: true }]
                      : []
                    : format === "xlsx"
                      ? visual
                        ? [{ element: visual, id: "xlsx:grid", rendered: true }]
                        : []
                      : visual
                        ? [
                            {
                              element: visual,
                              id: `${format ?? "renderer"}:surface`,
                              rendered: true,
                            },
                          ]
                        : [];
        const renderedItems = items.filter((item) => item.rendered);

        const visibleAnchors = renderedItems
          .filter((item) => isVisibleInViewport(item.element))
          .map((item) => {
            const rect = item.element.getBoundingClientRect();

            return {
              bottom: rect.bottom,
              height: rect.height,
              id: item.id,
              top: rect.top,
            };
          });

        return {
          renderedIds: renderedItems.map((item) => item.id),
          visibleAnchors,
          visibleRenderedIds: visibleAnchors.map((anchor) => anchor.id),
        };
      };
      const readReadingAnchor = (
        scroller: HTMLElement | null,
        rendererContinuity: BenchmarkRendererContinuity,
      ) => {
        const anchors = rendererContinuity.visibleAnchors;
        if (!scroller || anchors.length === 0) return null;
        if (scroller.scrollTop <= 1) return { kind: "top" as const };

        const viewportRect = scroller.getBoundingClientRect();
        const markerOffset = viewportRect.height * 0.2;
        const markerTop = viewportRect.top + markerOffset;
        const containingAnchor = anchors.find(
          (anchor) => anchor.top <= markerTop && anchor.bottom >= markerTop,
        );
        let previousAnchor: BenchmarkRendererAnchor | undefined;
        for (const anchor of anchors) {
          if (anchor.top <= markerTop) previousAnchor = anchor;
        }
        const nextAnchor = anchors.find((anchor) => anchor.top > markerTop);
        const anchor = containingAnchor ?? previousAnchor ?? nextAnchor;
        if (!anchor || anchor.height <= 0) return null;

        const topInViewport = anchor.top - viewportRect.top;
        const yRatio = Math.min(
          1,
          Math.max(0, (markerTop - anchor.top) / anchor.height),
        );
        if (
          Math.abs(topInViewport) <=
          Math.min(markerOffset, readingBoundarySnapPx)
        ) {
          return {
            id: anchor.id,
            kind: "boundary" as const,
            topInViewport: Math.round(topInViewport),
            yRatio,
          };
        }

        return {
          id: anchor.id,
          kind: "page" as const,
          markerTop,
          yRatio,
        };
      };

      const setSidebarOpenState = async (open: boolean) => {
        if ((root.dataset.fileViewerSidebarOpen === "true") === open) return;
        trigger.click();
        await sampleAnimationFrames(24);
      };

      const readSample = (): BenchmarkSample => {
        const rootRect = root.getBoundingClientRect();
        const gapRect = gap.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const scroller = resolveBenchmarkScroller(root);
        const visual = resolveBenchmarkVisual(root);
        const visualRect = visual?.getBoundingClientRect();
        const transform = visual
          ? visual.style.transform || getComputedStyle(visual).transform
          : null;
        const rendererContinuity = readRendererContinuity(
          root,
          scroller,
          visual,
        );

        return {
          activeElementRole: readActiveElementRole(document.activeElement),
          clientHeight: scroller?.clientHeight ?? 0,
          clientWidth: scroller?.clientWidth ?? 0,
          contentWidth: contentRect.width,
          documentHasFocus: document.hasFocus(),
          fingerprint: readBenchmarkFingerprint(root),
          format: readBenchmarkFormat(root) ?? null,
          frameWidth: frameRect.width,
          gapWidth: gapRect.width,
          readingAnchor: readReadingAnchor(scroller, rendererContinuity),
          rendererContinuity,
          rootWidth: rootRect.width,
          sidebarOpen: root.dataset.fileViewerSidebarOpen ?? null,
          sidebarState: root.dataset.fileViewerSidebarState ?? null,
          scrollHeight: scroller?.scrollHeight ?? 0,
          scrollLeft: scroller?.scrollLeft ?? 0,
          scrollTop: scroller?.scrollTop ?? 0,
          scrollWidth: scroller?.scrollWidth ?? 0,
          timestamp: performance.now(),
          transform: transform && transform !== "none" ? transform : null,
          triggerExpanded: trigger.getAttribute("aria-expanded"),
          triggerState: trigger.dataset.fileViewerSidebarState ?? null,
          visualBottom: visualRect?.bottom ?? null,
          visualHeight: visualRect?.height ?? null,
          visualLeft: visualRect?.left ?? null,
          visualRight: visualRect?.right ?? null,
          visualTop: visualRect?.top ?? null,
          visualWidth: visualRect?.width ?? null,
          windowScrollY: window.scrollY,
        };
      };

      const resolveScrollTop = (
        target: BenchmarkScrollTarget,
        scroller: HTMLElement,
      ) => {
        const availableScroll = Math.max(
          0,
          scroller.scrollHeight - scroller.clientHeight,
        );
        const clampScrollTop = (scrollTop: number) =>
          Math.min(availableScroll, Math.max(0, scrollTop));

        if (target.top != null) {
          return clampScrollTop(target.top);
        }

        if (target.pdfPage != null) {
          const pdfPage = root.querySelector<HTMLElement>(
            `[data-slot="pdf-page"][data-page="${target.pdfPage}"]`,
          );

          if (pdfPage) {
            const pageRect = pdfPage.getBoundingClientRect();
            const scrollerRect = scroller.getBoundingClientRect();

            return clampScrollTop(
              scroller.scrollTop +
                pageRect.top -
                scrollerRect.top +
                (target.pdfPageOffsetPx ?? 0),
            );
          }
        }

        const candidates = [target.minTop ?? 0];
        if (target.viewportMultiplier != null) {
          candidates.push(scroller.clientHeight * target.viewportMultiplier);
        }
        if (target.ratio != null) {
          candidates.push(availableScroll * target.ratio);
        }
        if (target.bottomOffsetPx != null) {
          candidates.push(availableScroll - target.bottomOffsetPx);
        }

        return clampScrollTop(Math.max(...candidates));
      };

      const scrollBenchmarkViewport = async () => {
        const scroller = resolveBenchmarkScroller(root);
        if (!scroller) return;

        scroller.scrollTop = resolveScrollTop(scrollTarget, scroller);
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        await sampleAnimationFrames(4);
      };
      const waitForStableBenchmarkRenderer = async () => {
        // An empty renderer (all counts zero) is trivially stable but means the
        // virtualization window has not mounted yet — sampling then would race
        // the first mount and record its layout correction as motion drift.
        const isEmptyFingerprint = (fingerprint: string) =>
          Object.values(
            JSON.parse(fingerprint) as Record<string, number>,
          ).every((count) => count === 0);
        const isRendererReady = () => {
          if (readBenchmarkFormat(root) !== "pdf") return true;

          const visibleSlots = Array.from(
            root.querySelectorAll<HTMLElement>(
              '[data-slot="pdf-page-slot"][data-visible]',
            ),
          );
          if (visibleSlots.length === 0) return false;

          return visibleSlots.every((slot) =>
            Boolean(
              slot.querySelector(
                '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
              ),
            ),
          );
        };
        let previousFingerprint = readBenchmarkFingerprint(root);
        let stableFrameCount = 0;

        for (let index = 0; index < 300; index += 1) {
          await nextAnimationFrame();
          const currentFingerprint = readBenchmarkFingerprint(root);

          if (
            currentFingerprint === previousFingerprint &&
            !isEmptyFingerprint(currentFingerprint) &&
            isRendererReady()
          ) {
            stableFrameCount += 1;
          } else {
            previousFingerprint = currentFingerprint;
            stableFrameCount = 0;
          }

          if (stableFrameCount >= 8) return;
        }
      };
      const createPerformanceObserver = (
        entryType: string,
        handleEntries: (entries: PerformanceEntry[]) => void,
      ) => {
        if (
          typeof PerformanceObserver === "undefined" ||
          !PerformanceObserver.supportedEntryTypes?.includes(entryType)
        ) {
          return null;
        }

        const observer = new PerformanceObserver((list) => {
          handleEntries(list.getEntries());
        });
        observer.observe({ type: entryType, buffered: false });
        return observer;
      };

      const sampleTransition = async (
        action: BenchmarkMotionRun["action"],
      ): Promise<BenchmarkMotionRun> => {
        const before = readSample();
        const samples: BenchmarkSample[] = [];
        const rendererRoot = resolveBenchmarkVisual(root) ?? frame;
        let scrollEventCount = 0;
        let windowScrollEventCount = 0;
        let rendererAddedNodeCount = 0;
        let rendererMutationCount = 0;
        let rendererRemovedNodeCount = 0;
        let layoutShiftCount = 0;
        let layoutShiftScore = 0;
        let longTaskCount = 0;
        let longTaskDuration = 0;
        // Third-party scripts (dev analytics beacons) load on their own
        // schedule; only same-origin loads can be attributed to the toggle.
        const isFirstPartyResource = (entry: PerformanceEntry) =>
          entry.name.startsWith(window.location.origin);
        const resourceCountBefore =
          performance.getEntriesByType("resource").length;
        const handleScroll = () => {
          scrollEventCount += 1;
        };
        const handleWindowScroll = () => {
          windowScrollEventCount += 1;
        };
        const scroller = resolveBenchmarkScroller(root);
        const mutationObserver = new MutationObserver((records) => {
          for (const record of records) {
            rendererMutationCount += 1;
            rendererAddedNodeCount += record.addedNodes.length;
            rendererRemovedNodeCount += record.removedNodes.length;
          }
        });
        const layoutShiftObserver = createPerformanceObserver(
          "layout-shift",
          (entries) => {
            for (const entry of entries as LayoutShiftEntry[]) {
              layoutShiftCount += 1;
              layoutShiftScore += entry.value ?? 0;
            }
          },
        );
        const longTaskObserver = createPerformanceObserver(
          "longtask",
          (entries) => {
            for (const entry of entries) {
              longTaskCount += 1;
              longTaskDuration += entry.duration;
            }
          },
        );

        scroller?.addEventListener("scroll", handleScroll);
        window.addEventListener("scroll", handleWindowScroll);
        mutationObserver.observe(rendererRoot, {
          childList: true,
          subtree: true,
        });

        try {
          trigger.click();

          for (let index = 0; index < sampleFrameCount; index += 1) {
            await nextAnimationFrame();
            samples.push(readSample());
          }

          await sampleAnimationFrames(settleFrameCount);

          return {
            action,
            before,
            layoutShiftCount,
            layoutShiftScore,
            longTaskCount,
            longTaskDuration,
            rendererAddedNodeCount,
            rendererMutationCount,
            rendererRemovedNodeCount,
            resourceCountDelta: performance
              .getEntriesByType("resource")
              .slice(resourceCountBefore)
              .filter(isFirstPartyResource).length,
            resourceNames: performance
              .getEntriesByType("resource")
              .slice(resourceCountBefore)
              .filter(isFirstPartyResource)
              .map((entry) => entry.name),
            samples,
            after: readSample(),
            scrollEventCount,
            scrollTarget,
            windowScrollEventCount,
          };
        } finally {
          layoutShiftObserver?.disconnect();
          longTaskObserver?.disconnect();
          mutationObserver.disconnect();
          scroller?.removeEventListener("scroll", handleScroll);
          window.removeEventListener("scroll", handleWindowScroll);
        }
      };

      const firstAction = actionOrder === "close-open" ? "close" : "open";
      const secondAction = actionOrder === "close-open" ? "open" : "close";

      await setSidebarOpenState(firstAction === "close");
      await scrollBenchmarkViewport();
      await waitForStableBenchmarkRenderer();

      if (!root.contains(document.activeElement)) {
        if (!content.hasAttribute("tabindex")) {
          content.tabIndex = -1;
        }
        content.focus({ preventScroll: true });
        await nextAnimationFrame();
      }

      const first = await sampleTransition(firstAction);
      const second = await sampleTransition(secondAction);
      const close = first.action === "close" ? first : second;
      const open = first.action === "open" ? first : second;

      return { actionOrder, close, open };
    },
    {
      actionOrder,
      benchmarkRootSelector: rootSelector,
      sampleFrameCount,
      scrollTarget,
      settleFrameCount,
    },
  );
}

async function runPdfPageGapBenchmark(
  page: Page,
  rootSelector: string,
  scrollTarget: BenchmarkScrollTarget = DEFAULT_BENCHMARK_SCROLL_TARGET,
): Promise<PdfPageGapBenchmarkResult> {
  return page.evaluate(
    async (benchmarkOptions) => {
      const { benchmarkRootSelector, scrollTarget } = benchmarkOptions;
      const nextAnimationFrame = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const sampleAnimationFrames = async (count: number) => {
        for (let index = 0; index < count; index += 1) {
          await nextAnimationFrame();
        }
      };
      const root = document.querySelector<HTMLElement>(benchmarkRootSelector);
      const trigger = root?.querySelector<HTMLButtonElement>(
        '[data-slot="file-viewer-sidebar-trigger"]',
      );
      const frame = root?.querySelector<HTMLElement>(
        '[data-slot="file-viewer-document-frame"]',
      );
      const sidebarGap = root?.querySelector<HTMLElement>(
        '[data-slot="file-viewer-sidebar-gap"]',
      );
      const scroller = root?.querySelector<HTMLElement>(
        '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
      );

      if (!root || !trigger || !frame || !sidebarGap || !scroller) {
        throw new Error("PDF page-gap benchmark fixture is not mounted.");
      }

      const pages = () =>
        Array.from(
          root.querySelectorAll<HTMLElement>('[data-slot="pdf-page"]'),
        );

      for (let index = 0; index < 80 && pages().length < 2; index += 1) {
        await nextAnimationFrame();
      }

      if (root.dataset.fileViewerSidebarOpen !== "true") {
        trigger.click();
        await sampleAnimationFrames(24);
      }

      const resolveScrollTop = (
        target: BenchmarkScrollTarget,
        viewport: HTMLElement,
      ) => {
        const availableScroll = Math.max(
          0,
          viewport.scrollHeight - viewport.clientHeight,
        );
        const clampScrollTop = (scrollTop: number) =>
          Math.min(availableScroll, Math.max(0, scrollTop));

        if (target.top != null) {
          return clampScrollTop(target.top);
        }

        if (target.pdfPage != null) {
          const pdfPage = root.querySelector<HTMLElement>(
            `[data-slot="pdf-page"][data-page="${target.pdfPage}"]`,
          );

          if (pdfPage) {
            const pageRect = pdfPage.getBoundingClientRect();
            const viewportRect = viewport.getBoundingClientRect();

            return clampScrollTop(
              viewport.scrollTop +
                pageRect.top -
                viewportRect.top +
                (target.pdfPageOffsetPx ?? 0),
            );
          }
        }

        const candidates = [target.minTop ?? 0];
        if (target.viewportMultiplier != null) {
          candidates.push(viewport.clientHeight * target.viewportMultiplier);
        }
        if (target.ratio != null) {
          candidates.push(availableScroll * target.ratio);
        }
        if (target.bottomOffsetPx != null) {
          candidates.push(availableScroll - target.bottomOffsetPx);
        }

        return clampScrollTop(Math.max(...candidates));
      };

      scroller.scrollTop = resolveScrollTop(scrollTarget, scroller);
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sampleAnimationFrames(12);

      const readSample = () => {
        const viewportRect = scroller.getBoundingClientRect();
        const pageRects = pages()
          .map((element, index) => {
            const rect = element.getBoundingClientRect();
            return {
              bottom: rect.bottom,
              index,
              page: element.dataset.page ?? String(index + 1),
              top: rect.top,
            };
          })
          .sort((a, b) => a.top - b.top);
        const gaps: { pair: string; value: number }[] = [];

        for (let index = 0; index < pageRects.length - 1; index += 1) {
          const current = pageRects[index];
          const next = pageRects[index + 1];
          const isNearViewport =
            current.bottom > viewportRect.top - 160 &&
            current.bottom < viewportRect.bottom + 160;

          if (isNearViewport) {
            gaps.push({
              pair: `${current.page}->${next.page}`,
              value: next.top - current.bottom,
            });
          }
        }

        return {
          frameWidth: frame.getBoundingClientRect().width,
          gapWidth: sidebarGap.getBoundingClientRect().width,
          gaps,
        };
      };

      const sampleTransition = async (action: "close" | "open") => {
        const before = readSample();
        const samples: ReturnType<typeof readSample>[] = [];
        trigger.click();

        for (let index = 0; index < 32; index += 1) {
          await nextAnimationFrame();
          samples.push(readSample());
        }

        await sampleAnimationFrames(8);
        return {
          action,
          before,
          samples,
          after: readSample(),
        };
      };

      const summarize = (
        run: Awaited<ReturnType<typeof sampleTransition>>,
      ): PdfPageGapRun => {
        const all = [run.before, ...run.samples, run.after];
        const pairs = [
          ...new Set(
            all.flatMap((sample) => sample.gaps.map((gap) => gap.pair)),
          ),
        ];

        return {
          action: run.action,
          pairs: pairs.map((pair) => {
            const values = all
              .map(
                (sample) => sample.gaps.find((gap) => gap.pair === pair)?.value,
              )
              .filter((value): value is number => Number.isFinite(value));
            const movingValues = run.samples
              .filter((sample) =>
                isBenchmarkMovingSample(sample, run.before, run.after),
              )
              .map(
                (sample) => sample.gaps.find((gap) => gap.pair === pair)?.value,
              )
              .filter((value): value is number => Number.isFinite(value));
            const range = valueRange(values);
            const movingRange = valueRange(movingValues);
            const settleSnap =
              movingValues.length > 0 && values.length > 0
                ? Math.abs(
                    values[values.length - 1] -
                      movingValues[movingValues.length - 1],
                  )
                : 0;

            return {
              gapValues: values.map(roundMetric),
              movingRange: roundMetric(movingRange),
              pair,
              range: roundMetric(range),
              reversals: countDirectionalReversals(values, 0.25),
              settleSnap: roundMetric(settleSnap),
            };
          }),
        };
      };

      const close = await sampleTransition("close");
      const open = await sampleTransition("open");

      return {
        close: summarize(close),
        open: summarize(open),
      };

      function isBenchmarkMovingSample(
        sample: ReturnType<typeof readSample>,
        before: ReturnType<typeof readSample>,
        after: ReturnType<typeof readSample>,
      ) {
        const min = Math.min(before.gapWidth, after.gapWidth) + 1;
        const max = Math.max(before.gapWidth, after.gapWidth) - 1;
        return sample.gapWidth > min && sample.gapWidth < max;
      }

      function valueRange(values: number[]) {
        return values.length === 0
          ? 0
          : Math.max(...values) - Math.min(...values);
      }

      function roundMetric(value: number) {
        return Math.round(value * 1000) / 1000;
      }

      function countDirectionalReversals(values: number[], tolerance: number) {
        let reversals = 0;
        let lastSign = 0;

        for (let index = 1; index < values.length; index += 1) {
          const delta = values[index] - values[index - 1];
          const sign = Math.abs(delta) <= tolerance ? 0 : Math.sign(delta);
          if (sign !== 0 && lastSign !== 0 && sign !== lastSign) reversals += 1;
          if (sign !== 0) lastSign = sign;
        }

        return reversals;
      }
    },
    {
      benchmarkRootSelector: rootSelector,
      scrollTarget,
    },
  );
}

function collectBenchmarkFailures(
  result: BenchmarkRunResult,
  label: string,
): string[] {
  return [
    ...collectMotionFailures(result.close, label),
    ...collectMotionFailures(result.open, label),
    ...collectCycleInvarianceFailures(result, label),
  ];
}

function collectPdfPageGapFailures(
  result: PdfPageGapBenchmarkResult,
  label: string,
): string[] {
  return [
    ...collectPdfPageGapRunFailures(result.close, label),
    ...collectPdfPageGapRunFailures(result.open, label),
  ];
}

function collectPdfPageGapRunFailures(run: PdfPageGapRun, label: string) {
  const failures: string[] = [];
  const prefix = `${label} ${run.action}`;

  for (const pair of run.pairs) {
    if (pair.range > 1) {
      failures.push(
        `${prefix} ${pair.pair} page gap range exceeded 1px: ${formatValues(
          pair.gapValues,
        )}`,
      );
    }
    if (pair.movingRange > 1) {
      failures.push(
        `${prefix} ${pair.pair} moving page gap range exceeded 1px: ${formatValues(
          pair.gapValues,
        )}`,
      );
    }
    if (pair.settleSnap > 1) {
      failures.push(
        `${prefix} ${pair.pair} page gap snapped ${pair.settleSnap.toFixed(
          2,
        )}px after sidebar movement: ${formatValues(pair.gapValues)}`,
      );
    }
    if (pair.reversals > 0) {
      failures.push(
        `${prefix} ${pair.pair} page gap reversed ${pair.reversals} times: ${formatValues(
          pair.gapValues,
        )}`,
      );
    }
  }

  return failures;
}

function summarizeBenchmarkResult(result: BenchmarkRunResult, label: string) {
  return {
    actionOrder: result.actionOrder,
    label,
    close: summarizeMotionRun(result.close),
    open: summarizeMotionRun(result.open),
  };
}

function summarizeMotionRun(run: BenchmarkMotionRun) {
  const samples = [run.before, ...run.samples, run.after];
  const moving = run.samples.filter((sample) =>
    isMovingSample(sample, run.before, run.after),
  );
  const contentSums = samples.map(
    (sample) => sample.gapWidth + sample.frameWidth,
  );
  const progressDeltas = moving.map((sample) =>
    Math.abs(
      progress(run.before.gapWidth, run.after.gapWidth, sample.gapWidth) -
        progress(
          run.before.frameWidth,
          run.after.frameWidth,
          sample.frameWidth,
        ),
    ),
  );

  return {
    action: run.action,
    anchorTopDriftPx: roundMetric(visibleAnchorTopDriftPx(run)),
    layoutShift: {
      count: run.layoutShiftCount,
      score: roundMetric(run.layoutShiftScore),
    },
    clientHeight: {
      start: roundMetric(run.before.clientHeight),
      end: roundMetric(run.after.clientHeight),
    },
    clientWidth: {
      start: roundMetric(run.before.clientWidth),
      end: roundMetric(run.after.clientWidth),
    },
    frameWidth: {
      start: roundMetric(run.before.frameWidth),
      end: roundMetric(run.after.frameWidth),
    },
    gapWidth: {
      start: roundMetric(run.before.gapWidth),
      end: roundMetric(run.after.gapWidth),
    },
    maxProgressDelta: roundMetric(Math.max(0, ...progressDeltas)),
    motionSampleCount: moving.length,
    instantSnapProgress: roundMetric(
      Math.max(
        instantSnapProgressRatio(run, "gapWidth"),
        instantSnapProgressRatio(run, "frameWidth"),
      ),
    ),
    longTasks: {
      count: run.longTaskCount,
      durationMs: roundMetric(run.longTaskDuration),
    },
    rendererMutations: {
      addedNodes: run.rendererAddedNodeCount,
      mutations: run.rendererMutationCount,
      removedNodes: run.rendererRemovedNodeCount,
    },
    resourceCountDelta: run.resourceCountDelta,
    resourceNames: run.resourceNames,
    sampleCount: run.samples.length,
    scrollEventCount: run.scrollEventCount,
    scrollHeight: {
      start: roundMetric(run.before.scrollHeight),
      end: roundMetric(run.after.scrollHeight),
    },
    scrollHeightDriftPx: roundMetric(
      valueRange(samples.map((sample) => sample.scrollHeight)),
    ),
    scrollDriftPx: roundMetric(
      Math.max(
        valueRange(samples.map((sample) => sample.scrollTop)),
        valueRange(samples.map((sample) => sample.scrollLeft)),
        valueRange(samples.map((sample) => sample.windowScrollY)),
      ),
    ),
    scrollTarget: run.scrollTarget.label,
    scrollWidth: {
      start: roundMetric(run.before.scrollWidth),
      end: roundMetric(run.after.scrollWidth),
    },
    readingAnchor: {
      start: formatReadingAnchor(run.before.readingAnchor),
      end: formatReadingAnchor(run.after.readingAnchor),
      driftPercent: roundNullableMetric(
        readingAnchorYRatioDriftPercent(run.before, run.after),
      ),
    },
    syncDriftPx: roundMetric(valueRange(contentSums)),
    visualLeft: {
      start: roundNullableMetric(run.before.visualLeft),
      end: roundNullableMetric(run.after.visualLeft),
    },
    visualTop: {
      start: roundNullableMetric(run.before.visualTop),
      end: roundNullableMetric(run.after.visualTop),
    },
    visualTopDriftPx: roundMetric(
      valueRange(nullableMetricValues(samples, "visualTop")),
    ),
    visualOvershootPx: roundMetric(
      Math.max(
        visualOvershootPx(run, "visualLeft"),
        visualOvershootPx(run, "visualRight"),
        visualOvershootPx(run, "visualTop"),
        visualOvershootPx(run, "visualWidth"),
      ),
    ),
    visualReversalCount:
      visualReversalCount(run, "visualLeft") +
      visualReversalCount(run, "visualRight") +
      visualReversalCount(run, "visualTop") +
      visualReversalCount(run, "visualWidth"),
    visualSettleSnapPx: roundMetric(
      Math.max(
        visualSettleSnapPx(run, "visualLeft"),
        visualSettleSnapPx(run, "visualRight"),
        visualSettleSnapPx(run, "visualTop"),
        visualSettleSnapPx(run, "visualWidth"),
      ),
    ),
    visibleAnchors: run.before.rendererContinuity.visibleRenderedIds,
    windowScrollEventCount: run.windowScrollEventCount,
  };
}

function collectMotionFailures(
  run: BenchmarkMotionRun,
  label: string,
): string[] {
  const prefix = `${label} ${run.action}`;
  const samples = [run.before, ...run.samples, run.after];
  const failures: string[] = [];

  failures.push(
    ...collectOvershootFailures({
      label: `${prefix} sidebar gap`,
      start: run.before.gapWidth,
      end: run.after.gapWidth,
      values: samples.map((sample) => sample.gapWidth),
      tolerance: 1.5,
    }),
  );
  failures.push(
    ...collectOvershootFailures({
      label: `${prefix} document frame`,
      start: run.before.frameWidth,
      end: run.after.frameWidth,
      values: samples.map((sample) => sample.frameWidth),
      tolerance: 1.5,
    }),
  );
  failures.push(
    ...collectMonotonicFailures({
      label: `${prefix} sidebar gap`,
      start: run.before.gapWidth,
      end: run.after.gapWidth,
      values: samples.map((sample) => sample.gapWidth),
      tolerance: 1.25,
    }),
  );
  failures.push(
    ...collectMonotonicFailures({
      label: `${prefix} document frame`,
      start: run.before.frameWidth,
      end: run.after.frameWidth,
      values: samples.map((sample) => sample.frameWidth),
      tolerance: 1.25,
    }),
  );
  failures.push(...collectMotionSampleFailures(run, prefix));

  // A shell-owned fit-width resize freezes renderer layout during the slide and
  // materializes the new scroll range at settle, so the vertical scroll geometry
  // legitimately steps once per toggle. The invariants are: the step never
  // overshoots or oscillates, the horizontal/outer-window scroll never moves,
  // and the settled reading position lands on the same logical spot.
  failures.push(
    ...collectOvershootFailures({
      label: `${prefix} scrollTop`,
      start: run.before.scrollTop,
      end: run.after.scrollTop,
      values: samples.map((sample) => sample.scrollTop),
      tolerance: 1,
    }),
  );
  failures.push(
    ...collectMonotonicFailures({
      label: `${prefix} scrollTop`,
      start: run.before.scrollTop,
      end: run.after.scrollTop,
      values: samples.map((sample) => sample.scrollTop),
      tolerance: 1,
    }),
  );
  failures.push(
    ...collectStableValueFailures({
      label: `${prefix} scrollLeft`,
      values: samples.map((sample) => sample.scrollLeft),
      tolerance: 1,
    }),
  );
  failures.push(
    ...collectStableValueFailures({
      label: `${prefix} window scrollY`,
      values: samples.map((sample) => sample.windowScrollY),
      tolerance: 0.5,
    }),
  );
  failures.push(
    ...collectMonotonicFailures({
      label: `${prefix} scrollHeight`,
      start: run.before.scrollHeight,
      end: run.after.scrollHeight,
      values: samples.map((sample) => sample.scrollHeight),
      tolerance: 2,
    }),
  );
  if (ASSERT_VISUAL_SMOOTHNESS) {
    failures.push(
      ...collectMonotonicFailures({
        label: `${prefix} scrollWidth`,
        start: run.before.scrollWidth,
        end: run.after.scrollWidth,
        values: samples.map((sample) => sample.scrollWidth),
        tolerance: 2,
      }),
    );
  }
  failures.push(...collectReadingIdentityFailures(run, prefix));
  if (run.scrollEventCount > 1) {
    failures.push(
      `${prefix}: scroller emitted ${run.scrollEventCount} scroll events during sidebar motion (budget: one settle rebase)`,
    );
  }
  if (run.windowScrollEventCount > 0) {
    failures.push(
      `${prefix}: window emitted ${run.windowScrollEventCount} scroll events during sidebar motion`,
    );
  }
  failures.push(...collectStateSyncFailures(run, prefix));
  failures.push(...collectFocusStabilityFailures(run, prefix));
  failures.push(...collectSyncFailures(run, prefix));
  if (ASSERT_RENDERER_CONTINUITY || ASSERT_VISUAL_SMOOTHNESS) {
    // Fit-width refits intentionally move absolute page/frame tops while
    // preserving reading identity and settled reading fraction; those are
    // already asserted by the default benchmark contract.
    failures.push(...collectRendererContinuityFailures(run, prefix));
    failures.push(...collectRendererMutationFailures(run, prefix));
    failures.push(...collectResourceQuietFailures(run, prefix));
  }
  if (ASSERT_VISUAL_SMOOTHNESS) {
    failures.push(...collectLayoutShiftFailures(run, prefix));
    failures.push(...collectMainThreadFailures(run, prefix));
  }
  if (ASSERT_VISUAL_SMOOTHNESS) {
    failures.push(...collectVisualSmoothnessFailures(run, prefix));
  }

  return failures;
}

function collectOvershootFailures({
  end,
  label,
  start,
  tolerance,
  values,
}: {
  end: number;
  label: string;
  start: number;
  tolerance: number;
  values: number[];
}) {
  const min = Math.min(start, end) - tolerance;
  const max = Math.max(start, end) + tolerance;
  const outliers = values.filter((value) => value < min || value > max);
  if (outliers.length === 0) return [];

  return [
    `${label} overshot [${min.toFixed(2)}, ${max.toFixed(2)}]: ${formatValues(
      values,
    )}`,
  ];
}

function collectMonotonicFailures({
  end,
  label,
  start,
  tolerance,
  values,
}: {
  end: number;
  label: string;
  start: number;
  tolerance: number;
  values: number[];
}) {
  if (Math.abs(end - start) <= tolerance) return [];

  const direction = end > start ? "increasing" : "decreasing";
  const violations: number[] = [];

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (direction === "increasing" && current < previous - tolerance) {
      violations.push(index);
    }
    if (direction === "decreasing" && current > previous + tolerance) {
      violations.push(index);
    }
  }

  if (violations.length === 0) return [];

  return [
    `${label} moved ${direction} with reversals at samples ${violations.join(
      ", ",
    )}: ${formatValues(values)}`,
  ];
}

function collectMotionSampleFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const gapTravel = Math.abs(run.after.gapWidth - run.before.gapWidth);
  const frameTravel = Math.abs(run.after.frameWidth - run.before.frameWidth);
  const travel = Math.max(gapTravel, frameTravel);
  if (travel <= 8) return [];

  const failures: string[] = [];
  const moving = run.samples.filter((sample) =>
    isMovingSample(sample, run.before, run.after),
  );

  // A 150ms slide yields ~9 intermediate frames at 60fps; 2-core CI runners
  // composite ~20fps, so 2 moving samples still proves the width animated
  // rather than snapped. Local runs keep the tighter smoothness floor.
  const minimumMovingSamples = process.env.CI ? 2 : 3;
  if (moving.length < minimumMovingSamples) {
    failures.push(
      `${prefix}: sidebar transition only produced ${moving.length} intermediate moving samples: ${formatValues(
        run.samples.map((sample) => sample.gapWidth),
      )}`,
    );
  }

  for (const field of [
    { key: "gapWidth", label: "sidebar gap" },
    { key: "frameWidth", label: "document frame" },
  ] satisfies { key: LayoutMetricKey; label: string }[]) {
    const firstFrameProgress = instantSnapProgressRatio(run, field.key);

    if (firstFrameProgress > 0.85) {
      failures.push(
        `${prefix} ${field.label} covered ${(firstFrameProgress * 100).toFixed(
          1,
        )}% of its travel on the first sampled frame: ${formatValues(
          [run.before, ...run.samples, run.after].map(
            (sample) => sample[field.key],
          ),
        )}`,
      );
    }
  }

  return failures;
}

function collectStableValueFailures({
  label,
  tolerance,
  values,
}: {
  label: string;
  tolerance: number;
  values: number[];
}) {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min <= tolerance) return [];

  return [
    `${label} drifted by ${(max - min).toFixed(2)}px: ${formatValues(values)}`,
  ];
}

function collectStateSyncFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const samples = [run.before, ...run.samples, run.after];
  const failures: string[] = [];
  const mismatches = samples
    .map((sample, index) => ({ index, sample }))
    .filter(
      ({ sample }) =>
        sample.sidebarState == null ||
        sample.triggerState == null ||
        sample.sidebarState !== sample.triggerState,
    );
  const expectedOpen = run.action === "open" ? "true" : "false";
  const expectedExpanded = run.action === "open" ? "true" : "false";

  if (mismatches.length > 0) {
    failures.push(
      `${prefix}: root/trigger sidebar state diverged at samples ${mismatches
        .slice(0, 6)
        .map(({ index }) => index)
        .join(", ")}`,
    );
  }
  if (run.after.sidebarOpen !== expectedOpen) {
    failures.push(
      `${prefix}: settled requested open state expected ${expectedOpen}, got ${run.after.sidebarOpen}`,
    );
  }
  if (run.after.triggerExpanded !== expectedExpanded) {
    failures.push(
      `${prefix}: settled trigger aria-expanded expected ${expectedExpanded}, got ${run.after.triggerExpanded}`,
    );
  }

  return failures;
}

function readingFraction(sample: BenchmarkSample) {
  const range = Math.max(1, sample.scrollHeight - sample.clientHeight);
  return Math.min(1, Math.max(0, sample.scrollTop / range));
}

function readingAnchorYRatioDrift(
  before: BenchmarkSample,
  after: BenchmarkSample,
) {
  if (before.format !== "pdf" || after.format !== "pdf") return null;
  if (!before.readingAnchor || !after.readingAnchor) return null;
  if (before.readingAnchor.kind === "top") return 0;
  if (after.readingAnchor.kind === "top") return Infinity;
  if (before.readingAnchor.id !== after.readingAnchor.id) return Infinity;

  if (
    before.readingAnchor.kind === "boundary" &&
    after.readingAnchor.kind === "boundary"
  ) {
    return (
      Math.abs(
        before.readingAnchor.topInViewport - after.readingAnchor.topInViewport,
      ) / 1000
    );
  }

  return Math.abs(before.readingAnchor.yRatio - after.readingAnchor.yRatio);
}

function readingAnchorYRatioDriftPercent(
  before: BenchmarkSample,
  after: BenchmarkSample,
) {
  const drift = readingAnchorYRatioDrift(before, after);
  return drift == null || !Number.isFinite(drift) ? null : drift * 100;
}

function formatReadingAnchor(anchor: BenchmarkReadingAnchor | null) {
  if (!anchor) return "none";
  if (anchor.kind === "top") return "top";
  if (anchor.kind === "boundary") {
    return `${anchor.id}#boundary@${anchor.topInViewport.toFixed(0)}px`;
  }
  return `${anchor.id}@${(anchor.yRatio * 100).toFixed(2)}%`;
}

function collectReadingIdentityFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const anchorDrift = readingAnchorYRatioDrift(run.before, run.after);
  if (anchorDrift != null) {
    if (anchorDrift <= READING_ANCHOR_Y_RATIO_BUDGET) return [];

    return [
      `${prefix}: settled reading anchor drifted ${formatReadingAnchor(
        run.before.readingAnchor,
      )} -> ${formatReadingAnchor(run.after.readingAnchor)} (budget: same anchor, drift <= ${(
        READING_ANCHOR_Y_RATIO_BUDGET * 100
      ).toFixed(2)}%)`,
    ];
  }

  const drift = Math.abs(
    readingFraction(run.after) - readingFraction(run.before),
  );
  if (drift <= READING_FRACTION_FALLBACK_BUDGET) return [];

  return [
    `${prefix}: settled reading position drifted ${(drift * 100).toFixed(
      2,
    )}% across the refit (fallback budget: <= ${(
      READING_FRACTION_FALLBACK_BUDGET * 100
    ).toFixed(2)}%)`,
  ];
}

function collectFocusStabilityFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const samples = [run.before, ...run.samples, run.after];
  const failures = samples
    .map((sample, index) => ({ index, sample }))
    .filter(
      ({ sample }) =>
        !sample.documentHasFocus || sample.activeElementRole === "outside",
    );

  if (failures.length === 0) return [];

  return [
    `${prefix}: focus escaped or document lost focus at samples ${failures
      .slice(0, 6)
      .map(({ index, sample }) => `${index}:${sample.activeElementRole}`)
      .join(", ")}`,
  ];
}

function collectCycleInvarianceFailures(
  result: BenchmarkRunResult,
  label: string,
) {
  const expectedStart =
    result.actionOrder === "close-open"
      ? result.close.before
      : result.open.before;
  const restoredEnd =
    result.actionOrder === "close-open"
      ? result.open.after
      : result.close.after;
  const anchorDrift = readingAnchorYRatioDrift(expectedStart, restoredEnd);
  const drift =
    anchorDrift ??
    Math.abs(readingFraction(restoredEnd) - readingFraction(expectedStart));
  const failures: string[] = [];

  if (
    anchorDrift != null
      ? anchorDrift > CYCLE_READING_ANCHOR_Y_RATIO_BUDGET
      : drift > CYCLE_READING_FRACTION_FALLBACK_BUDGET
  ) {
    failures.push(
      anchorDrift != null
        ? `${label}: settled cycle reading anchor drifted ${formatReadingAnchor(
            expectedStart.readingAnchor,
          )} -> ${formatReadingAnchor(
            restoredEnd.readingAnchor,
          )} after ${result.actionOrder} (budget: same anchor, drift <= ${(
            CYCLE_READING_ANCHOR_Y_RATIO_BUDGET * 100
          ).toFixed(2)}%)`
        : `${label}: settled cycle reading position drifted ${(
            drift * 100
          ).toFixed(2)}% after ${result.actionOrder} (fallback budget: <= ${(
            CYCLE_READING_FRACTION_FALLBACK_BUDGET * 100
          ).toFixed(2)}%)`,
    );
  }
  return failures;
}

function collectSyncFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const samples = [run.before, ...run.samples, run.after];
  const failures: string[] = [];
  const contentSums = samples.map(
    (sample) => sample.gapWidth + sample.frameWidth,
  );
  const contentSumMin = Math.min(...contentSums);
  const contentSumMax = Math.max(...contentSums);

  if (contentSumMax - contentSumMin > 2.5) {
    failures.push(
      `${prefix}: sidebar gap + document frame is not conserved: ${formatValues(
        contentSums,
      )}`,
    );
  }

  const gapTravel = run.after.gapWidth - run.before.gapWidth;
  const frameTravel = run.after.frameWidth - run.before.frameWidth;
  if (Math.abs(gapTravel) <= 8 || Math.abs(frameTravel) <= 8) return failures;

  const progressDeltas = run.samples
    .filter((sample) => isMovingSample(sample, run.before, run.after))
    .map((sample) =>
      Math.abs(
        progress(run.before.gapWidth, run.after.gapWidth, sample.gapWidth) -
          progress(
            run.before.frameWidth,
            run.after.frameWidth,
            sample.frameWidth,
          ),
      ),
    );
  const maxProgressDelta = Math.max(0, ...progressDeltas);

  if (maxProgressDelta > 0.18) {
    failures.push(
      `${prefix}: sidebar and document frame progress diverged by ${maxProgressDelta.toFixed(
        3,
      )}: ${formatValues(progressDeltas)}`,
    );
  }

  return failures;
}

function collectRendererContinuityFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const lifecycleSamples = [...run.samples, run.after];
  const beforeAnchors = rendererContinuityAnchors(run.before);
  const failures: string[] = [];

  for (const [index, sample] of lifecycleSamples.entries()) {
    const sampleAnchors = rendererContinuityAnchors(sample);
    const sampleLabel = index === run.samples.length ? "settle" : `${index}`;

    if (sampleAnchors.length === 0) {
      failures.push(`${prefix}: renderer went blank at sample ${sampleLabel}`);
      continue;
    }

    if (
      beforeAnchors.length > 0 &&
      !beforeAnchors.some((anchor) => sampleAnchors.includes(anchor))
    ) {
      failures.push(
        `${prefix}: visible rendered anchor changed at sample ${sampleLabel}: ${beforeAnchors.join(
          ", ",
        )} -> ${sampleAnchors.join(", ")}`,
      );
    }
  }

  return failures;
}

function collectRendererMutationFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const nodeCount = run.rendererAddedNodeCount + run.rendererRemovedNodeCount;

  if (run.rendererMutationCount <= 200 && nodeCount <= 200) {
    return [];
  }

  return [
    `${prefix}: renderer subtree mutated ${run.rendererMutationCount} times, added ${run.rendererAddedNodeCount} nodes, removed ${run.rendererRemovedNodeCount} nodes (budget: <= 200 mutations / <= 200 nodes)`,
  ];
}

function collectResourceQuietFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  if (run.resourceCountDelta === 0) return [];

  return [
    `${prefix}: loaded ${run.resourceCountDelta} resources during sidebar motion: ${run.resourceNames.join(
      ", ",
    )}`,
  ];
}

function collectLayoutShiftFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  // A fit-width resize is an intentional, input-triggered layout change (real
  // CLS excludes input-triggered shifts via hadRecentInput, which synthetic
  // clicks cannot set). The budget bounds runaway/oscillating reflow while
  // accepting the one-shot resize — mirrors the in-page benchmark's <= 8 per
  // close+open pair.
  if (run.layoutShiftScore <= 4) return [];

  return [
    `${prefix}: layout shift score ${run.layoutShiftScore.toFixed(
      4,
    )} across ${run.layoutShiftCount} entries (budget: <= 4)`,
  ];
}

function collectMainThreadFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  // The resize re-rasters the visible pages at the new scale on settle, which
  // is real, bounded main-thread work — mirrors the in-page benchmark's
  // <= 120ms budget (DEV-mode React reconcile inflates this 3-5x vs prod).
  if (run.longTaskDuration <= 120) return [];

  return [
    `${prefix}: long tasks took ${run.longTaskDuration.toFixed(1)}ms across ${
      run.longTaskCount
    } entries (budget: <= 120ms)`,
  ];
}

function collectVisualSmoothnessFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const failures: string[] = [];
  const fields = [
    { key: "visualLeft", label: `${prefix} visual left` },
    { key: "visualRight", label: `${prefix} visual right` },
    { key: "visualTop", label: `${prefix} visual top` },
    { key: "visualWidth", label: `${prefix} visual width` },
  ] satisfies { key: VisualMetricKey; label: string }[];

  for (const field of fields) {
    const start = run.before[field.key];
    const end = run.after[field.key];
    const values = nullableMetricValues(
      [run.before, ...run.samples, run.after],
      field.key,
    );

    if (start == null || end == null || values.length < 2) continue;

    failures.push(
      ...collectOvershootFailures({
        label: field.label,
        start,
        end,
        values,
        tolerance: 2,
      }),
    );
    failures.push(
      ...collectMonotonicFailures({
        label: field.label,
        start,
        end,
        values,
        tolerance: 0.75,
      }),
    );

    const snap = visualSettleSnapPx(run, field.key);
    if (snap > 3) {
      failures.push(
        `${field.label} snapped ${snap.toFixed(
          2,
        )}px after sidebar movement: ${formatValues(values)}`,
      );
    }
  }

  return failures;
}

function rendererContinuityAnchors(sample: BenchmarkSample) {
  return sample.rendererContinuity.visibleRenderedIds.length > 0
    ? sample.rendererContinuity.visibleRenderedIds
    : sample.rendererContinuity.renderedIds;
}

function visibleAnchorTopDriftPx(run: BenchmarkMotionRun) {
  const beforeTops = new Map(
    run.before.rendererContinuity.visibleAnchors.map((anchor) => [
      anchor.id,
      anchor.top,
    ]),
  );
  if (beforeTops.size === 0) return 0;

  const drifts = [run.before, ...run.samples, run.after].flatMap((sample) =>
    sample.rendererContinuity.visibleAnchors
      .map((anchor) => {
        const beforeTop = beforeTops.get(anchor.id);
        return beforeTop == null ? null : Math.abs(anchor.top - beforeTop);
      })
      .filter((drift): drift is number => drift != null),
  );

  return Math.max(0, ...drifts);
}

type LayoutMetricKey = "frameWidth" | "gapWidth";
type VisualMetricKey =
  | "visualLeft"
  | "visualRight"
  | "visualTop"
  | "visualWidth";

function instantSnapProgressRatio(
  run: BenchmarkMotionRun,
  key: LayoutMetricKey,
) {
  const first = run.samples[0]?.[key] ?? run.after[key];
  const travel = run.after[key] - run.before[key];
  if (Math.abs(travel) <= 8) return 0;
  return Math.abs((first - run.before[key]) / travel);
}

function visualOvershootPx(run: BenchmarkMotionRun, key: VisualMetricKey) {
  const start = run.before[key];
  const end = run.after[key];
  if (start == null || end == null) return 0;

  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const values = nullableMetricValues(
    [run.before, ...run.samples, run.after],
    key,
  );

  return Math.max(
    0,
    ...values.map((value) => Math.max(min - value, value - max)),
  );
}

function visualReversalCount(run: BenchmarkMotionRun, key: VisualMetricKey) {
  const start = run.before[key];
  const end = run.after[key];
  if (start == null || end == null || Math.abs(end - start) <= 8) return 0;

  const values = nullableMetricValues(
    [run.before, ...run.samples, run.after],
    key,
  );
  const direction = end > start ? "increasing" : "decreasing";
  let count = 0;

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (direction === "increasing" && current < previous - 0.75) count += 1;
    if (direction === "decreasing" && current > previous + 0.75) count += 1;
  }

  return count;
}

function visualSettleSnapPx(run: BenchmarkMotionRun, key: VisualMetricKey) {
  const after = run.after[key];
  const lastSample = [...run.samples]
    .reverse()
    .find((sample) => sample[key] != null)?.[key];

  if (after == null || lastSample == null) return 0;
  return Math.abs(after - lastSample);
}

function nullableMetricValues(
  samples: BenchmarkSample[],
  key: VisualMetricKey,
) {
  return samples
    .map((sample) => sample[key])
    .filter((value): value is number => value != null);
}

function isMovingSample(
  sample: BenchmarkSample,
  before: BenchmarkSample,
  after: BenchmarkSample,
) {
  const min = Math.min(before.gapWidth, after.gapWidth) + 1;
  const max = Math.max(before.gapWidth, after.gapWidth) - 1;
  return sample.gapWidth > min && sample.gapWidth < max;
}

function progress(start: number, end: number, value: number) {
  const travel = end - start;
  if (Math.abs(travel) < 0.001) return 1;
  return (value - start) / travel;
}

function formatValues(values: number[]) {
  return values.map((value) => value.toFixed(2)).join(", ");
}

function valueRange(values: number[]) {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function roundMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundNullableMetric(value: number | null) {
  return value == null ? null : roundMetric(value);
}
