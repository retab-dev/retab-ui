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

type BenchmarkSample = {
  contentWidth: number;
  fingerprint: string;
  frameWidth: number;
  gapWidth: number;
  rendererContinuity: BenchmarkRendererContinuity;
  rootWidth: number;
  scrollLeft: number;
  scrollTop: number;
  sidebarState: string | null;
  timestamp: number;
  transform: string | null;
  visualHeight: number | null;
  visualLeft: number | null;
  visualRight: number | null;
  visualWidth: number | null;
  windowScrollY: number;
};

type BenchmarkRendererContinuity = {
  renderedIds: string[];
  visibleRenderedIds: string[];
};

type BenchmarkMotionRun = {
  action: "close" | "open";
  after: BenchmarkSample;
  before: BenchmarkSample;
  samples: BenchmarkSample[];
};

type BenchmarkRunResult = {
  close: BenchmarkMotionRun;
  open: BenchmarkMotionRun;
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

test.describe.configure({ mode: "serial" });

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

    await page.locator("[data-benchmark-run-button]").click();
    await expect(page.locator("[data-benchmark-run-status]")).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.locator("[data-benchmark-metric]")).toHaveCount(6);
  });

  test("files PDF sidebar has no visual surface hop", async ({ page }) => {
    test.skip(
      !ASSERT_VISUAL_SMOOTHNESS,
      "visual surface assertions are opt-in",
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/files");

    const rootSelector = '[data-slot="file-viewer-root"]';
    const root = page.locator(rootSelector).first();
    await expect(root).toBeVisible({ timeout: 45_000 });
    await expect(
      root
        .locator(
          '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
        )
        .first(),
    ).toBeVisible({ timeout: 45_000 });

    const result = await runSidebarBenchmark(page, rootSelector);
    const failures = collectBenchmarkFailures(result, "files/pdf");

    await test.info().attach("file-viewer-sidebar-motion-files-pdf.json", {
      body: JSON.stringify(
        summarizeBenchmarkResult(result, "files/pdf"),
        null,
        2,
      ),
      contentType: "application/json",
    });

    expect(failures, failures.join("\n")).toEqual([]);
  });
});

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
): Promise<BenchmarkRunResult> {
  return page.evaluate(async (benchmarkRootSelector) => {
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
        codeWindows: host.querySelectorAll("[data-code-render-window]").length,
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
        textCanvases: host.querySelectorAll('[data-slot="text-virtual-canvas"]')
          .length,
        xlsxRows: host.querySelectorAll('[data-slot="xlsx-row"]').length,
      });
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
      const format = host.dataset.benchmarkActiveFormat;
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
                rendered: (element) => Boolean(element.querySelector("canvas")),
              })
            : format === "pptx"
              ? keyedElements({
                  selector: '[data-slot="pptx-slide"]',
                  id: (element) => `pptx:${element.dataset.slideNumber ?? ""}`,
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

      return {
        renderedIds: renderedItems.map((item) => item.id),
        visibleRenderedIds: renderedItems
          .filter((item) => isVisibleInViewport(item.element))
          .map((item) => item.id),
      };
    };

    const openSidebarIfNeeded = async () => {
      if (root.dataset.fileViewerSidebarOpen === "true") return;
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
        contentWidth: contentRect.width,
        fingerprint: readBenchmarkFingerprint(root),
        frameWidth: frameRect.width,
        gapWidth: gapRect.width,
        rendererContinuity: readRendererContinuity(root, scroller, visual),
        rootWidth: rootRect.width,
        scrollLeft: scroller?.scrollLeft ?? 0,
        scrollTop: scroller?.scrollTop ?? 0,
        sidebarState: root.dataset.fileViewerSidebarState ?? null,
        timestamp: performance.now(),
        transform: transform && transform !== "none" ? transform : null,
        visualHeight: visualRect?.height ?? null,
        visualLeft: visualRect?.left ?? null,
        visualRight: visualRect?.right ?? null,
        visualWidth: visualRect?.width ?? null,
        windowScrollY: window.scrollY,
      };
    };

    const scrollBenchmarkViewport = async () => {
      const scroller = resolveBenchmarkScroller(root);
      if (!scroller) return;

      const availableScroll = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight,
      );
      scroller.scrollTop = Math.min(
        availableScroll,
        Math.max(160, scroller.clientHeight * 1.35),
      );
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

    const sampleTransition = async (
      action: BenchmarkMotionRun["action"],
    ): Promise<BenchmarkMotionRun> => {
      const before = readSample();
      const samples: BenchmarkSample[] = [];
      trigger.click();

      for (let index = 0; index < 22; index += 1) {
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

    await openSidebarIfNeeded();
    await scrollBenchmarkViewport();
    await waitForStableBenchmarkRenderer();

    const close = await sampleTransition("close");
    const open = await sampleTransition("open");

    return { close, open };
  }, rootSelector);
}

function collectBenchmarkFailures(
  result: BenchmarkRunResult,
  label: string,
): string[] {
  return [
    ...collectMotionFailures(result.close, label),
    ...collectMotionFailures(result.open, label),
  ];
}

function summarizeBenchmarkResult(result: BenchmarkRunResult, label: string) {
  return {
    label,
    close: summarizeMotionRun(result.close),
    open: summarizeMotionRun(result.open),
  };
}

function summarizeMotionRun(run: BenchmarkMotionRun) {
  const moving = run.samples.filter((sample) =>
    isMovingSample(sample, run.before, run.after),
  );
  const contentSums = [run.before, ...run.samples, run.after].map(
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
    frameWidth: {
      start: roundMetric(run.before.frameWidth),
      end: roundMetric(run.after.frameWidth),
    },
    gapWidth: {
      start: roundMetric(run.before.gapWidth),
      end: roundMetric(run.after.gapWidth),
    },
    maxProgressDelta: roundMetric(Math.max(0, ...progressDeltas)),
    sampleCount: run.samples.length,
    scrollDriftPx: roundMetric(
      Math.max(
        valueRange(moving.map((sample) => sample.scrollTop)),
        valueRange(moving.map((sample) => sample.scrollLeft)),
        valueRange(moving.map((sample) => sample.windowScrollY)),
      ),
    ),
    syncDriftPx: roundMetric(valueRange(contentSums)),
    visualLeft: {
      start: roundNullableMetric(run.before.visualLeft),
      end: roundNullableMetric(run.after.visualLeft),
    },
    visualOvershootPx: roundMetric(
      Math.max(
        visualOvershootPx(run, "visualLeft"),
        visualOvershootPx(run, "visualRight"),
        visualOvershootPx(run, "visualWidth"),
      ),
    ),
    visualReversalCount:
      visualReversalCount(run, "visualLeft") +
      visualReversalCount(run, "visualRight") +
      visualReversalCount(run, "visualWidth"),
    visualSettleSnapPx: roundMetric(
      Math.max(
        visualSettleSnapPx(run, "visualLeft"),
        visualSettleSnapPx(run, "visualRight"),
        visualSettleSnapPx(run, "visualWidth"),
      ),
    ),
    visibleAnchors: run.before.rendererContinuity.visibleRenderedIds,
  };
}

function collectMotionFailures(
  run: BenchmarkMotionRun,
  label: string,
): string[] {
  const prefix = `${label} ${run.action}`;
  const samples = [run.before, ...run.samples, run.after];
  const movingSamples = run.samples.filter((sample) =>
    isMovingSample(sample, run.before, run.after),
  );
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

  failures.push(
    ...collectStableValueFailures({
      label: `${prefix} scrollTop`,
      values: movingSamples.map((sample) => sample.scrollTop),
      tolerance: 1,
    }),
  );
  failures.push(
    ...collectStableValueFailures({
      label: `${prefix} scrollLeft`,
      values: movingSamples.map((sample) => sample.scrollLeft),
      tolerance: 1,
    }),
  );
  failures.push(
    ...collectStableValueFailures({
      label: `${prefix} window scrollY`,
      values: movingSamples.map((sample) => sample.windowScrollY),
      tolerance: 0.5,
    }),
  );
  failures.push(...collectSyncFailures(run, prefix));
  if (ASSERT_RENDERER_CONTINUITY) {
    failures.push(...collectRendererContinuityFailures(run, prefix));
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
  const movingSamples = run.samples.filter((sample) =>
    isMovingSample(sample, run.before, run.after),
  );
  const beforeAnchors = rendererContinuityAnchors(run.before);
  const failures: string[] = [];

  for (const [index, sample] of movingSamples.entries()) {
    const sampleAnchors = rendererContinuityAnchors(sample);

    if (sampleAnchors.length === 0) {
      failures.push(`${prefix}: renderer went blank at moving sample ${index}`);
      continue;
    }

    if (
      beforeAnchors.length > 0 &&
      !beforeAnchors.some((anchor) => sampleAnchors.includes(anchor))
    ) {
      failures.push(
        `${prefix}: visible rendered anchor changed at moving sample ${index}: ${beforeAnchors.join(
          ", ",
        )} -> ${sampleAnchors.join(", ")}`,
      );
    }
  }

  return failures;
}

function collectVisualSmoothnessFailures(
  run: BenchmarkMotionRun,
  prefix: string,
): string[] {
  const failures: string[] = [];
  const fields = [
    { key: "visualLeft", label: `${prefix} visual left` },
    { key: "visualRight", label: `${prefix} visual right` },
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

type VisualMetricKey = "visualLeft" | "visualRight" | "visualWidth";

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
  const movingSamples = run.samples.filter((sample) =>
    isMovingSample(sample, run.before, run.after),
  );
  const after = run.after[key];
  const lastMoving = [...movingSamples]
    .reverse()
    .find((sample) => sample[key] != null)?.[key];

  if (after == null || lastMoving == null) return 0;
  return Math.abs(after - lastMoving);
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
