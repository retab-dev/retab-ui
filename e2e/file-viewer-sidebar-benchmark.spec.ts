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
  frameWidth: number;
  gapWidth: number;
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
    await page.locator("[data-benchmark-run-button]").click();
    const status = page.locator("[data-benchmark-run-status]").first();
    await expect(status).toBeVisible({ timeout: 45_000 });
    await expect(status).toHaveAttribute(
      "data-benchmark-run-action-order",
      "open-close",
    );
    await expect(status).toHaveAttribute(
      "data-benchmark-run-scroll-target",
      "page-4-gap",
    );
    await expect(page.locator("[data-benchmark-metric]")).toHaveCount(18);
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
      const readBenchmarkFingerprint = (host: HTMLElement) =>
        JSON.stringify({
          canvases: host.querySelectorAll("canvas").length,
          codeWindows: host.querySelectorAll("[data-code-render-window]")
            .length,
          csvRows: host.querySelectorAll('[data-slot="csv-row"]').length,
          docxPages: host.querySelectorAll(
            '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
          ).length,
          htmlIframes: host.querySelectorAll(
            '[data-slot="html-file-viewer-content"] iframe',
          ).length,
          imageDocuments: host.querySelectorAll(
            '[data-slot="image-viewer-document"]',
          ).length,
          markdownChunks: host.querySelectorAll("[data-markdown-chunk]").length,
          pdfPages: host.querySelectorAll('[data-slot="pdf-page"]').length,
          pptxSlides: host.querySelectorAll('[data-slot="pptx-slide"]').length,
          textCanvases: host.querySelectorAll(
            '[data-slot="text-virtual-canvas"]',
          ).length,
          xlsxRows: host.querySelectorAll('[data-slot="xlsx-row"]').length,
        });
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

        return {
          activeElementRole: readActiveElementRole(document.activeElement),
          clientHeight: scroller?.clientHeight ?? 0,
          clientWidth: scroller?.clientWidth ?? 0,
          contentWidth: contentRect.width,
          documentHasFocus: document.hasFocus(),
          fingerprint: readBenchmarkFingerprint(root),
          frameWidth: frameRect.width,
          gapWidth: gapRect.width,
          rendererContinuity: readRendererContinuity(root, scroller, visual),
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
        let previousFingerprint = readBenchmarkFingerprint(root);
        let stableFrameCount = 0;

        for (let index = 0; index < 80; index += 1) {
          await nextAnimationFrame();
          const currentFingerprint = readBenchmarkFingerprint(root);

          if (currentFingerprint === previousFingerprint) {
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
            resourceCountDelta: Math.max(
              0,
              performance.getEntriesByType("resource").length -
                resourceCountBefore,
            ),
            resourceNames: performance
              .getEntriesByType("resource")
              .slice(resourceCountBefore)
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

  failures.push(
    ...collectStableValueFailures({
      label: `${prefix} scrollTop`,
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
    ...collectStableValueFailures({
      label: `${prefix} scrollHeight`,
      values: samples.map((sample) => sample.scrollHeight),
      tolerance: 2,
    }),
  );
  if (ASSERT_VISUAL_SMOOTHNESS) {
    failures.push(
      ...collectStableValueFailures({
        label: `${prefix} scrollWidth`,
        values: samples.map((sample) => sample.scrollWidth),
        tolerance: 2,
      }),
    );
  }
  if (run.scrollEventCount > 0) {
    failures.push(
      `${prefix}: scroller emitted ${run.scrollEventCount} scroll events during sidebar motion`,
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
    failures.push(...collectRendererContinuityFailures(run, prefix));
    failures.push(...collectAnchorPositionFailures(run, prefix));
    failures.push(...collectRendererMutationFailures(run, prefix));
    failures.push(...collectResourceQuietFailures(run, prefix));
  }
  if (ASSERT_VISUAL_SMOOTHNESS) {
    failures.push(...collectLayoutShiftFailures(run, prefix));
    failures.push(...collectMainThreadFailures(run, prefix));
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

  if (moving.length < 3) {
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
  const drift = settledSampleDriftPx(expectedStart, restoredEnd);
  const failures: string[] = [];

  if (drift > 2) {
    failures.push(
      `${label}: settled cycle drifted ${drift.toFixed(
        2,
      )}px after ${result.actionOrder}`,
    );
  }
  if (expectedStart.fingerprint !== restoredEnd.fingerprint) {
    failures.push(
      `${label}: renderer fingerprint changed after ${result.actionOrder}: ${expectedStart.fingerprint} -> ${restoredEnd.fingerprint}`,
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

function collectAnchorPositionFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const beforeAnchors = run.before.rendererContinuity.visibleAnchors;
  if (beforeAnchors.length === 0) return [];

  const failures: string[] = [];
  const lifecycleSamples = [...run.samples, run.after];

  for (const [index, sample] of lifecycleSamples.entries()) {
    const sampleLabel = index === run.samples.length ? "settle" : `${index}`;
    const sampleAnchors = sample.rendererContinuity.visibleAnchors;

    if (sampleAnchors.length === 0) {
      failures.push(
        `${prefix}: visible anchors disappeared at sample ${sampleLabel}`,
      );
      continue;
    }

    const drifts = beforeAnchors
      .map((beforeAnchor) => {
        const currentAnchor = sampleAnchors.find(
          (anchor) => anchor.id === beforeAnchor.id,
        );
        return currentAnchor
          ? {
              drift: Math.abs(currentAnchor.top - beforeAnchor.top),
              id: beforeAnchor.id,
            }
          : null;
      })
      .filter((drift): drift is { drift: number; id: string } => drift != null);

    if (drifts.length === 0) {
      failures.push(
        `${prefix}: visible anchor identity churned at sample ${sampleLabel}: ${beforeAnchors
          .map((anchor) => anchor.id)
          .join(
            ", ",
          )} -> ${sampleAnchors.map((anchor) => anchor.id).join(", ")}`,
      );
      continue;
    }

    const worstDrift = drifts.reduce((worst, drift) =>
      drift.drift > worst.drift ? drift : worst,
    );

    if (worstDrift.drift > 3) {
      failures.push(
        `${prefix}: visible anchor ${worstDrift.id} top drifted ${worstDrift.drift.toFixed(
          2,
        )}px at sample ${sampleLabel}`,
      );
    }

    if (failures.length >= 4) break;
  }

  return failures;
}

function collectRendererMutationFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  if (
    run.rendererMutationCount === 0 &&
    run.rendererAddedNodeCount === 0 &&
    run.rendererRemovedNodeCount === 0
  ) {
    return [];
  }

  return [
    `${prefix}: renderer subtree mutated ${run.rendererMutationCount} times, added ${run.rendererAddedNodeCount} nodes, removed ${run.rendererRemovedNodeCount} nodes`,
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
  if (run.layoutShiftScore <= 0.001) return [];

  return [
    `${prefix}: layout shift score ${run.layoutShiftScore.toFixed(
      4,
    )} across ${run.layoutShiftCount} entries`,
  ];
}

function collectMainThreadFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  if (run.longTaskDuration <= 50) return [];

  return [
    `${prefix}: long tasks took ${run.longTaskDuration.toFixed(1)}ms across ${
      run.longTaskCount
    } entries`,
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

function settledSampleDriftPx(before: BenchmarkSample, after: BenchmarkSample) {
  return Math.max(
    Math.abs(after.scrollTop - before.scrollTop),
    Math.abs(after.scrollLeft - before.scrollLeft),
    Math.abs(after.windowScrollY - before.windowScrollY),
    Math.abs(after.scrollHeight - before.scrollHeight),
    Math.abs(after.scrollWidth - before.scrollWidth),
    Math.abs(after.clientHeight - before.clientHeight),
    Math.abs(after.clientWidth - before.clientWidth),
    nullableDelta(before.visualTop, after.visualTop),
    nullableDelta(before.visualLeft, after.visualLeft),
    nullableDelta(before.visualRight, after.visualRight),
    nullableDelta(before.visualWidth, after.visualWidth),
    settledAnchorTopDriftPx(before, after),
  );
}

function settledAnchorTopDriftPx(
  before: BenchmarkSample,
  after: BenchmarkSample,
) {
  const beforeAnchors = before.rendererContinuity.visibleAnchors;
  if (beforeAnchors.length === 0) return 0;

  return Math.max(
    0,
    ...beforeAnchors.map((beforeAnchor) => {
      const afterAnchor = after.rendererContinuity.visibleAnchors.find(
        (anchor) => anchor.id === beforeAnchor.id,
      );
      return afterAnchor ? Math.abs(afterAnchor.top - beforeAnchor.top) : 0;
    }),
  );
}

function nullableDelta(before: number | null, after: number | null) {
  return before == null || after == null ? 0 : Math.abs(after - before);
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
