import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type SimplePdfTelemetryMetric = {
  budget: string;
  detail: string;
  id: string;
  label: string;
  passed: boolean;
  value: string;
};

type SimplePdfTelemetryResult = {
  durationMs: number;
  metrics: SimplePdfTelemetryMetric[];
  runs: unknown[];
  sampledFrameCount: number;
  status: "failed" | "passed";
};

type SimplePdfTelemetryRuntime = {
  getLastResult: () => SimplePdfTelemetryResult | null;
  run: () => Promise<SimplePdfTelemetryResult | null>;
};

type SimplePdfScreencastFrame = {
  data: string;
  elapsedMs: number;
};

type SimplePdfVisualGeometrySample = {
  elapsedMs: number;
  pageHeight: number;
  pageLeft: number;
  pageTop: number;
  pageWidth: number;
  renderRefreshing: boolean;
  renderStatus: string | null;
  scrollTop: number;
  sidebarWidth: number;
  viewportHeight: number;
  viewportLeft: number;
  viewportTop: number;
  viewportWidth: number;
};

type SimplePdfVisualBlinkSummary = {
  action: "close" | "open";
  contentPulseCount: number;
  failures: string[];
  frameCount: number;
  geometryFrameCount: number;
  latePulseCount: number;
  maxContentChangedRatio: number;
  maxContentMeanAbsDiff: number;
  maxEndpointLeftRange: number;
  maxEndpointLeftStep: number;
  maxEndpointTopRange: number;
  maxEndpointTopStep: number;
  maxHorizontalReversals: number;
  maxLateEdgeStep: number;
  maxLateInkStep: number;
  maxLateMeanStep: number;
  pulses: Array<{
    changedRatio: number;
    elapsedMs: number;
    edgeStep: number;
    inkStep: number;
    meanAbsDiff: number;
    meanStep: number;
    previousElapsedMs: number;
  }>;
  samples: Array<{
    changedRatio: number;
    edgeEnergy: number;
    elapsedMs: number;
    geometryDeltaMs: number;
    inkRatio: number;
    meanAbsDiff: number;
    meanLuminance: number;
    pageHeight: number;
    pageLeft: number;
    pageTop: number;
    pageWidth: number;
    renderRefreshing: boolean;
    renderStatus: string | null;
    scrollTop: number;
    sidebarWidth: number;
  }>;
  settledElapsedMs: number;
};

const ASSERT_SIMPLE_PDF_TELEMETRY =
  process.env.SIMPLE_PDF_ASSERT_TELEMETRY === "1";

const EXPECTED_METRIC_IDS = [
  "blink",
  "back-and-forth",
  "horizontal-back-and-forth",
  "overshoot",
  "vertical-overshoot",
  "settle-jitter",
  "resize-linearity",
  "scroll-drift",
  "scroll-geometry",
  "gap-stability",
  "renderer-continuity",
  "canvas-pixel-continuity",
  "raster-headroom",
  "dom-mutations",
  "layout-shift",
  "main-thread",
  "geometry-sync",
  "cycle-invariance",
];

const SIMPLE_PDF_TELEMETRY_VIEWPORTS = [
  { height: 1136, width: 799 },
  { height: 1136, width: 800 },
  { height: 720, width: 1280 },
  { height: 900, width: 1280 },
];
const SIMPLE_PDF_VISUAL_BLINK_VIEWPORT = { height: 1136, width: 799 };
const SIMPLE_PDF_VISUAL_CONTENT_REGION = {
  height: 0.52,
  left: 0.18,
  top: 0.2,
  width: 0.64,
};
const SIMPLE_PDF_VISUAL_CONTENT_SAMPLE = { height: 240, width: 320 };
const SIMPLE_PDF_VISUAL_LATE_FRAME_MS = 180;
const SIMPLE_PDF_VISUAL_MEAN_PULSE_STEP = 0.35;
const SIMPLE_PDF_VISUAL_INK_PULSE_STEP = 0.0035;
const SIMPLE_PDF_VISUAL_EDGE_PULSE_STEP = 0.3;
const SIMPLE_PDF_VISUAL_CONTENT_CHANGED_RATIO_BUDGET = 0.035;
const SIMPLE_PDF_VISUAL_CONTENT_MEAN_DIFF_BUDGET = 1.25;
const SIMPLE_PDF_VISUAL_ENDPOINT_LEFT_STEP_BUDGET_PX = 1;
const SIMPLE_PDF_VISUAL_ENDPOINT_TOP_STEP_BUDGET_PX = 2;
const SIMPLE_PDF_VISUAL_GEOMETRY_MATCH_MS = 40;

test.describe("Simple PDF FileViewer telemetry", () => {
  for (const viewport of SIMPLE_PDF_TELEMETRY_VIEWPORTS) {
    test(`reports sidebar resize DOM telemetry at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const telemetryConsoleMessages: string[] = [];
      page.on("console", (message) => {
        const text = message.text();
        if (text.includes("[simple-pdf-file-viewer:telemetry]")) {
          telemetryConsoleMessages.push(text);
        }
      });

      await page.setViewportSize(viewport);
      await page.goto("/view/simple-pdf-file-viewer");
      await waitForSimplePdfTelemetryReady(page);

      const result = (await page.evaluate(async () => {
        const telemetry = Reflect.get(
          window,
          "__simplePdfFileViewerTelemetry",
        ) as SimplePdfTelemetryRuntime | undefined;
        return telemetry?.run() ?? null;
      })) as SimplePdfTelemetryResult | null;

      expect(result).not.toBeNull();
      expect(result?.sampledFrameCount).toBeGreaterThan(20);
      expect(result?.metrics.map((metric) => metric.id)).toEqual(
        EXPECTED_METRIC_IDS,
      );
      expect(
        telemetryConsoleMessages.some((message) =>
          message.startsWith("[simple-pdf-file-viewer:telemetry] result {"),
        ),
      ).toBe(true);
      expect(
        telemetryConsoleMessages.some((message) =>
          message.startsWith(
            "[simple-pdf-file-viewer:telemetry] full result {",
          ),
        ),
      ).toBe(true);

      const telemetryJson = JSON.stringify(result, null, 2);
      const telemetryConsoleLog = telemetryConsoleMessages.join("\n");
      const telemetryOutputPath = test
        .info()
        .outputPath("simple-pdf-file-viewer-telemetry.json");
      const telemetryConsoleOutputPath = test
        .info()
        .outputPath("simple-pdf-file-viewer-telemetry-console.log");
      const latestOutputPath = path.join(
        process.cwd(),
        "test-results",
        "simple-pdf-file-viewer-telemetry",
        "latest.json",
      );

      await writeFile(telemetryOutputPath, telemetryJson);
      await writeFile(telemetryConsoleOutputPath, telemetryConsoleLog);
      await mkdir(path.dirname(latestOutputPath), { recursive: true });
      await writeFile(latestOutputPath, telemetryJson);
      await test.info().attach("simple-pdf-file-viewer-telemetry.json", {
        path: telemetryOutputPath,
        contentType: "application/json",
      });
      await test.info().attach("simple-pdf-file-viewer-telemetry-console.log", {
        path: telemetryConsoleOutputPath,
        contentType: "text/plain",
      });

      if (ASSERT_SIMPLE_PDF_TELEMETRY) {
        const failures =
          result?.metrics
            .filter((metric) => !metric.passed)
            .map(
              (metric) =>
                `${metric.id}: ${metric.value} exceeds ${metric.budget}. ${metric.detail}`,
            ) ?? [];
        expect(failures, failures.join("\n")).toEqual([]);
      }
    });
  }

  test("detects screen-space blink during later-page sidebar resize", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.setViewportSize(SIMPLE_PDF_VISUAL_BLINK_VIEWPORT);
    await page.goto("/view/simple-pdf-file-viewer");
    await waitForSimplePdfTelemetryReady(page);

    const closeSummary = await runSimplePdfVisualBlinkBenchmark(page, "close");
    const openSummary = await runSimplePdfVisualBlinkBenchmark(page, "open");
    const summaries = [closeSummary, openSummary];
    const outputPath = test
      .info()
      .outputPath("simple-pdf-file-viewer-visual-blink.json");

    await writeFile(outputPath, JSON.stringify(summaries, null, 2));
    await test.info().attach("simple-pdf-file-viewer-visual-blink.json", {
      path: outputPath,
      contentType: "application/json",
    });

    for (const summary of summaries) {
      expect(summary.frameCount).toBeGreaterThan(12);
    }
    if (ASSERT_SIMPLE_PDF_TELEMETRY) {
      const failures = summaries.flatMap((summary) =>
        summary.failures.map((failure) => `${summary.action}: ${failure}`),
      );
      expect(failures, failures.join("\n")).toEqual([]);
    }
  });
});

async function waitForSimplePdfTelemetryReady(page: Page) {
  await page.waitForFunction(
    () => {
      const telemetry = Reflect.get(window, "__simplePdfFileViewerTelemetry");
      const pages = Array.from(
        document.querySelectorAll('[data-slot="simple-pdf-page"]'),
      );
      return (
        Boolean(telemetry) &&
        pages.length > 0 &&
        pages.every(
          (page) =>
            page.getAttribute("data-render-status") === "ready" &&
            page.getAttribute("data-render-refreshing") !== "true",
        )
      );
    },
    null,
    { timeout: 30_000 },
  );
}

async function runSimplePdfVisualBlinkBenchmark(
  page: Page,
  action: "close" | "open",
): Promise<SimplePdfVisualBlinkSummary> {
  await page.evaluate(async () => {
    const viewport = document.querySelector(
      '[data-slot="simple-pdf-viewport"]',
    );
    const targetPage = document.querySelector(
      '[data-slot="simple-pdf-page"][data-page-number="12"]',
    );
    if (targetPage instanceof HTMLElement && viewport instanceof HTMLElement) {
      const pageRect = targetPage.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      viewport.scrollTop += pageRect.top - viewportRect.top;
      let previousScrollTop = Number.NaN;
      let stableFrameCount = 0;
      await new Promise<void>((resolve) => {
        const waitForStableScroll = () => {
          if (Math.abs(viewport.scrollTop - previousScrollTop) <= 0.25) {
            stableFrameCount += 1;
          } else {
            stableFrameCount = 0;
            previousScrollTop = viewport.scrollTop;
          }

          if (stableFrameCount >= 4) {
            resolve();
            return;
          }

          requestAnimationFrame(waitForStableScroll);
        };

        requestAnimationFrame(waitForStableScroll);
      });
    }
  });
  await waitForSimplePdfTelemetryReady(page);

  const session = await page.context().newCDPSession(page);
  const startedAtEpochMs = await page.evaluate(() => {
    const startedAt = performance.timeOrigin + performance.now();
    Reflect.set(window, "__simplePdfVisualGeometryActive", true);
    Reflect.set(window, "__simplePdfVisualGeometrySamples", []);

    const sampleGeometry = () => {
      const samples = Reflect.get(
        window,
        "__simplePdfVisualGeometrySamples",
      ) as SimplePdfVisualGeometrySample[];
      const targetPage = document.querySelector(
        '[data-slot="simple-pdf-page"][data-page-number="12"]',
      );
      const viewport = document.querySelector(
        '[data-slot="simple-pdf-viewport"]',
      );
      const sidebar = document.querySelector(
        '[data-slot="simple-file-viewer-sidebar"]',
      );

      if (
        targetPage instanceof HTMLElement &&
        viewport instanceof HTMLElement
      ) {
        const pageRect = targetPage.getBoundingClientRect();
        const sidebarRect =
          sidebar instanceof HTMLElement
            ? sidebar.getBoundingClientRect()
            : null;
        const viewportRect = viewport.getBoundingClientRect();
        samples.push({
          elapsedMs: performance.timeOrigin + performance.now() - startedAt,
          pageHeight: pageRect.height,
          pageLeft: pageRect.left,
          pageTop: pageRect.top,
          pageWidth: pageRect.width,
          renderRefreshing: targetPage.dataset.renderRefreshing === "true",
          renderStatus: targetPage.dataset.renderStatus ?? null,
          scrollTop: viewport.scrollTop,
          sidebarWidth: sidebarRect?.width ?? 0,
          viewportHeight: viewportRect.height,
          viewportLeft: viewportRect.left,
          viewportTop: viewportRect.top,
          viewportWidth: viewportRect.width,
        });
      }

      if (Reflect.get(window, "__simplePdfVisualGeometryActive") === true) {
        window.setTimeout(() => {
          requestAnimationFrame(sampleGeometry);
        }, 0);
      }
    };

    requestAnimationFrame(sampleGeometry);
    return startedAt;
  });
  const frames: SimplePdfScreencastFrame[] = [];

  session.on("Page.screencastFrame", (event) => {
    const metadataTimestampMs =
      typeof event.metadata?.timestamp === "number"
        ? event.metadata.timestamp * 1000
        : null;
    const capturedAtEpochMs =
      metadataTimestampMs &&
      Math.abs(metadataTimestampMs - startedAtEpochMs) < 60_000
        ? metadataTimestampMs
        : Date.now();

    frames.push({
      data: event.data,
      elapsedMs: capturedAtEpochMs - startedAtEpochMs,
    });
    void session
      .send("Page.screencastFrameAck", { sessionId: event.sessionId })
      .catch(() => {});
  });

  await session.send("Page.startScreencast", {
    everyNthFrame: 1,
    format: "jpeg",
    quality: 90,
  });

  try {
    await page
      .getByRole("button", {
        name: action === "close" ? "Close sidebar" : "Open sidebar",
      })
      .click();
    await page.waitForTimeout(900);
  } finally {
    await page.evaluate(() => {
      Reflect.set(window, "__simplePdfVisualGeometryActive", false);
    });
    await session.send("Page.stopScreencast").catch(() => {});
    await session.detach().catch(() => {});
  }

  const geometrySamples = (await page.evaluate(() => {
    const samples = Reflect.get(window, "__simplePdfVisualGeometrySamples");
    return Array.isArray(samples) ? samples : [];
  })) as SimplePdfVisualGeometrySample[];

  return page.evaluate(
    async ({
      action,
      changedRatioBudget,
      contentRegion,
      contentSampleSize,
      endpointLeftStepBudget,
      endpointTopStepBudget,
      edgePulseStep,
      frames,
      geometryMatchMs,
      geometrySamples,
      inkPulseStep,
      lateFrameMs,
      meanDiffBudget,
      meanPulseStep,
    }) => {
      type VisualBenchmarkSample = {
        changedRatio: number;
        edgeEnergy: number;
        elapsedMs: number;
        geometryDeltaMs: number;
        inkRatio: number;
        luminance: Uint8Array;
        meanAbsDiff: number;
        meanLuminance: number;
        pageHeight: number;
        pageLeft: number;
        pageTop: number;
        pageWidth: number;
        renderRefreshing: boolean;
        renderStatus: string | null;
        scrollTop: number;
        sidebarWidth: number;
      };
      const samples: VisualBenchmarkSample[] = [];

      const sortedGeometrySamples = [...geometrySamples].sort(
        (left, right) => left.elapsedMs - right.elapsedMs,
      );

      function readInterpolatedGeometry(elapsedMs: number) {
        let before = sortedGeometrySamples[0] ?? null;
        let after = sortedGeometrySamples.at(-1) ?? null;

        for (let index = 0; index < sortedGeometrySamples.length; index += 1) {
          const sample = sortedGeometrySamples[index];
          if (sample.elapsedMs <= elapsedMs) before = sample;
          if (sample.elapsedMs >= elapsedMs) {
            after = sample;
            break;
          }
        }

        if (!before || !after) return null;

        const deltaMs = Math.min(
          Math.abs(before.elapsedMs - elapsedMs),
          Math.abs(after.elapsedMs - elapsedMs),
        );
        if (deltaMs > geometryMatchMs) return null;

        const span = after.elapsedMs - before.elapsedMs;
        const ratio =
          Math.abs(span) <= 0.001
            ? 0
            : Math.min(1, Math.max(0, (elapsedMs - before.elapsedMs) / span));
        const lerp = (from: number, to: number) => from + (to - from) * ratio;
        const nearest =
          Math.abs(before.elapsedMs - elapsedMs) <=
          Math.abs(after.elapsedMs - elapsedMs)
            ? before
            : after;

        return {
          deltaMs,
          sample: {
            elapsedMs,
            pageHeight: lerp(before.pageHeight, after.pageHeight),
            pageLeft: lerp(before.pageLeft, after.pageLeft),
            pageTop: lerp(before.pageTop, after.pageTop),
            pageWidth: lerp(before.pageWidth, after.pageWidth),
            renderRefreshing: nearest.renderRefreshing,
            renderStatus: nearest.renderStatus,
            scrollTop: lerp(before.scrollTop, after.scrollTop),
            sidebarWidth: lerp(before.sidebarWidth, after.sidebarWidth),
            viewportHeight: lerp(before.viewportHeight, after.viewportHeight),
            viewportLeft: lerp(before.viewportLeft, after.viewportLeft),
            viewportTop: lerp(before.viewportTop, after.viewportTop),
            viewportWidth: lerp(before.viewportWidth, after.viewportWidth),
          },
        };
      }

      function countReversals(values: readonly number[], epsilon: number) {
        let direction = 0;
        let reversals = 0;
        let previous: number | null = null;

        for (const value of values) {
          if (!Number.isFinite(value)) continue;
          if (previous === null) {
            previous = value;
            continue;
          }

          const delta = value - previous;
          previous = value;
          if (Math.abs(delta) <= epsilon) continue;

          const nextDirection = delta > 0 ? 1 : -1;
          if (direction !== 0 && nextDirection !== direction) reversals += 1;
          direction = nextDirection;
        }

        return reversals;
      }

      for (const frame of frames) {
        const geometry = readInterpolatedGeometry(frame.elapsedMs);
        if (!geometry) continue;

        const image = new Image();
        image.src = `data:image/jpeg;base64,${frame.data}`;
        await image.decode();

        const canvas = document.createElement("canvas");
        canvas.width = contentSampleSize.width;
        canvas.height = contentSampleSize.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) continue;

        const scaleX = image.naturalWidth / window.innerWidth;
        const scaleY = image.naturalHeight / window.innerHeight;
        const sourceLeft =
          (geometry.sample.pageLeft +
            geometry.sample.pageWidth * contentRegion.left) *
          scaleX;
        const sourceTop =
          (geometry.sample.pageTop +
            geometry.sample.pageHeight * contentRegion.top) *
          scaleY;
        const sourceWidth =
          geometry.sample.pageWidth * contentRegion.width * scaleX;
        const sourceHeight =
          geometry.sample.pageHeight * contentRegion.height * scaleY;
        if (
          sourceWidth < 8 ||
          sourceHeight < 8 ||
          sourceLeft >= image.naturalWidth ||
          sourceTop >= image.naturalHeight ||
          sourceLeft + sourceWidth <= 0 ||
          sourceTop + sourceHeight <= 0
        ) {
          continue;
        }

        context.drawImage(
          image,
          sourceLeft,
          sourceTop,
          sourceWidth,
          sourceHeight,
          0,
          0,
          contentSampleSize.width,
          contentSampleSize.height,
        );

        const data = context.getImageData(
          0,
          0,
          contentSampleSize.width,
          contentSampleSize.height,
        ).data;
        const luminance = new Uint8Array(
          contentSampleSize.width * contentSampleSize.height,
        );
        let luminanceSum = 0;
        let inkCount = 0;
        let edgeSum = 0;
        let edgeCount = 0;
        let changedCount = 0;
        let absoluteDiffSum = 0;
        const previous = samples.at(-1);

        for (let index = 0, pixel = 0; index < data.length; index += 4) {
          const value = Math.round(
            data[index] * 0.2126 +
              data[index + 1] * 0.7152 +
              data[index + 2] * 0.0722,
          );
          luminance[pixel] = value;
          luminanceSum += value;
          if (value < 245) inkCount += 1;
          if (previous) {
            const diff = Math.abs(value - previous.luminance[pixel]);
            absoluteDiffSum += diff;
            if (diff >= 12) changedCount += 1;
          }
          pixel += 1;
        }

        for (let y = 1; y < contentSampleSize.height; y += 1) {
          for (let x = 1; x < contentSampleSize.width; x += 1) {
            const index = y * contentSampleSize.width + x;
            edgeSum +=
              Math.abs(luminance[index] - luminance[index - 1]) +
              Math.abs(
                luminance[index] - luminance[index - contentSampleSize.width],
              );
            edgeCount += 2;
          }
        }

        samples.push({
          changedRatio: previous ? changedCount / luminance.length : 0,
          edgeEnergy: edgeCount === 0 ? 0 : edgeSum / edgeCount,
          elapsedMs: frame.elapsedMs,
          geometryDeltaMs: geometry.deltaMs,
          inkRatio: inkCount / luminance.length,
          luminance,
          meanAbsDiff: previous ? absoluteDiffSum / luminance.length : 0,
          meanLuminance: luminanceSum / luminance.length,
          pageHeight: geometry.sample.pageHeight,
          pageLeft: geometry.sample.pageLeft,
          pageTop: geometry.sample.pageTop,
          pageWidth: geometry.sample.pageWidth,
          renderRefreshing: geometry.sample.renderRefreshing,
          renderStatus: geometry.sample.renderStatus,
          scrollTop: geometry.sample.scrollTop,
          sidebarWidth: geometry.sample.sidebarWidth,
        });
      }

      const steps = samples.slice(1).map((sample, index) => {
        const previous = samples[index];
        return {
          changedRatio: sample.changedRatio,
          edgeStep: sample.edgeEnergy - previous.edgeEnergy,
          elapsedMs: sample.elapsedMs,
          inkStep: sample.inkRatio - previous.inkRatio,
          meanAbsDiff: sample.meanAbsDiff,
          meanStep: sample.meanLuminance - previous.meanLuminance,
          pageWidth: sample.pageWidth,
          pageLeft: sample.pageLeft,
          previousElapsedMs: previous.elapsedMs,
          scrollTop: sample.scrollTop,
          sidebarWidth: sample.sidebarWidth,
        };
      });
      const pulses: Array<(typeof steps)[number]> = [];
      const lastSample = samples.at(-1);
      const settledIndex = lastSample
        ? samples.findIndex((sample, index) => {
            const tail = samples.slice(index);
            return tail.every(
              (tailSample) =>
                Math.abs(tailSample.sidebarWidth - lastSample.sidebarWidth) <=
                  0.5 &&
                Math.abs(tailSample.pageLeft - lastSample.pageLeft) <= 0.25 &&
                Math.abs(tailSample.pageWidth - lastSample.pageWidth) <= 0.5 &&
                Math.abs(tailSample.pageTop - lastSample.pageTop) <= 0.25 &&
                Math.abs(tailSample.scrollTop - lastSample.scrollTop) <= 0.5,
            );
          })
        : -1;
      const settledElapsedMs =
        settledIndex >= 0 ? samples[settledIndex].elapsedMs : lateFrameMs;
      const failureStartMs = Math.max(lateFrameMs, settledElapsedMs + 16);

      for (let index = 1; index < steps.length; index += 1) {
        const previous = steps[index - 1];
        const current = steps[index];
        if (current.elapsedMs < failureStartMs) continue;

        const meanPulse =
          Math.abs(previous.meanStep) >= meanPulseStep &&
          Math.abs(current.meanStep) >= meanPulseStep &&
          Math.sign(previous.meanStep) === -Math.sign(current.meanStep);
        const inkPulse =
          Math.abs(previous.inkStep) >= inkPulseStep &&
          Math.abs(current.inkStep) >= inkPulseStep &&
          Math.sign(previous.inkStep) === -Math.sign(current.inkStep);
        const edgePulse =
          Math.abs(previous.edgeStep) >= edgePulseStep &&
          Math.abs(current.edgeStep) >= edgePulseStep &&
          Math.sign(previous.edgeStep) === -Math.sign(current.edgeStep);
        const contentPulse =
          current.meanAbsDiff >= meanDiffBudget &&
          current.changedRatio >= changedRatioBudget;

        if (
          [meanPulse, inkPulse, edgePulse].filter(Boolean).length >= 2 ||
          contentPulse
        ) {
          pulses.push(current);
        }
      }

      const lateSteps = steps.filter(
        (step) => step.elapsedMs >= failureStartMs,
      );
      const maxLateMeanStep = Math.max(
        0,
        ...lateSteps.map((step) => Math.abs(step.meanStep)),
      );
      const maxLateInkStep = Math.max(
        0,
        ...lateSteps.map((step) => Math.abs(step.inkStep)),
      );
      const maxLateEdgeStep = Math.max(
        0,
        ...lateSteps.map((step) => Math.abs(step.edgeStep)),
      );
      const maxContentMeanAbsDiff = Math.max(
        0,
        ...lateSteps.map((step) => step.meanAbsDiff),
      );
      const maxContentChangedRatio = Math.max(
        0,
        ...lateSteps.map((step) => step.changedRatio),
      );
      const endpointSamples = lastSample
        ? samples.filter(
            (sample) =>
              Math.abs(sample.sidebarWidth - lastSample.sidebarWidth) <= 0.5 &&
              Math.abs(sample.pageWidth - lastSample.pageWidth) <= 0.5,
          )
        : [];
      const endpointLeftValues = endpointSamples.map(
        (sample) => sample.pageLeft,
      );
      const maxEndpointLeftRange =
        endpointLeftValues.length === 0
          ? 0
          : Math.max(...endpointLeftValues) - Math.min(...endpointLeftValues);
      const maxEndpointLeftStep = Math.max(
        0,
        ...endpointSamples
          .slice(1)
          .map((sample, index) =>
            Math.abs(sample.pageLeft - endpointSamples[index].pageLeft),
          ),
      );
      const endpointTopValues = endpointSamples.map((sample) => sample.pageTop);
      const maxEndpointTopRange =
        endpointTopValues.length === 0
          ? 0
          : Math.max(...endpointTopValues) - Math.min(...endpointTopValues);
      const maxEndpointTopStep = Math.max(
        0,
        ...endpointSamples
          .slice(1)
          .map((sample, index) =>
            Math.abs(sample.pageTop - endpointSamples[index].pageTop),
          ),
      );
      const maxHorizontalReversals = countReversals(
        samples.map((sample) => sample.pageLeft),
        0.5,
      );
      const failures = [];

      if (pulses.length > 0) {
        failures.push(
          `page-locked blink: ${pulses.length} post-settle visual pulses`,
        );
      }
      if (maxContentMeanAbsDiff > meanDiffBudget) {
        failures.push(
          `page-locked blink: post-settle ${maxContentMeanAbsDiff.toFixed(
            2,
          )} mean pixel delta exceeds ${meanDiffBudget}`,
        );
      }
      if (maxContentChangedRatio > changedRatioBudget) {
        failures.push(
          `page-locked blink: post-settle ${(
            maxContentChangedRatio * 100
          ).toFixed(
            1,
          )}% changed pixels exceeds ${(changedRatioBudget * 100).toFixed(1)}%`,
        );
      }
      if (maxEndpointTopStep > endpointTopStepBudget) {
        failures.push(
          `endpoint vertical blink: ${maxEndpointTopStep.toFixed(
            2,
          )}px top step exceeds ${endpointTopStepBudget}px`,
        );
      }
      if (maxEndpointTopRange > endpointTopStepBudget) {
        failures.push(
          `endpoint vertical blink: ${maxEndpointTopRange.toFixed(
            2,
          )}px top range exceeds ${endpointTopStepBudget}px`,
        );
      }
      if (maxEndpointLeftStep > endpointLeftStepBudget) {
        failures.push(
          `endpoint horizontal blink: ${maxEndpointLeftStep.toFixed(
            2,
          )}px left step exceeds ${endpointLeftStepBudget}px`,
        );
      }
      if (maxEndpointLeftRange > endpointLeftStepBudget) {
        failures.push(
          `endpoint horizontal blink: ${maxEndpointLeftRange.toFixed(
            2,
          )}px left range exceeds ${endpointLeftStepBudget}px`,
        );
      }
      if (maxHorizontalReversals > 0) {
        failures.push(
          `horizontal back-and-forth: ${maxHorizontalReversals} left reversals over 0.5px`,
        );
      }

      return {
        action,
        contentPulseCount: pulses.length,
        failures,
        frameCount: samples.length,
        geometryFrameCount: geometrySamples.length,
        latePulseCount: pulses.length,
        maxContentChangedRatio,
        maxContentMeanAbsDiff,
        maxEndpointLeftRange,
        maxEndpointLeftStep,
        maxEndpointTopRange,
        maxEndpointTopStep,
        maxHorizontalReversals,
        maxLateEdgeStep,
        maxLateInkStep,
        maxLateMeanStep,
        pulses,
        samples: samples.map((sample) => ({
          changedRatio: sample.changedRatio,
          edgeEnergy: sample.edgeEnergy,
          elapsedMs: sample.elapsedMs,
          geometryDeltaMs: sample.geometryDeltaMs,
          inkRatio: sample.inkRatio,
          meanAbsDiff: sample.meanAbsDiff,
          meanLuminance: sample.meanLuminance,
          pageHeight: sample.pageHeight,
          pageLeft: sample.pageLeft,
          pageTop: sample.pageTop,
          pageWidth: sample.pageWidth,
          renderRefreshing: sample.renderRefreshing,
          renderStatus: sample.renderStatus,
          scrollTop: sample.scrollTop,
          sidebarWidth: sample.sidebarWidth,
        })),
        settledElapsedMs,
      };
    },
    {
      changedRatioBudget: SIMPLE_PDF_VISUAL_CONTENT_CHANGED_RATIO_BUDGET,
      contentRegion: SIMPLE_PDF_VISUAL_CONTENT_REGION,
      contentSampleSize: SIMPLE_PDF_VISUAL_CONTENT_SAMPLE,
      endpointLeftStepBudget: SIMPLE_PDF_VISUAL_ENDPOINT_LEFT_STEP_BUDGET_PX,
      endpointTopStepBudget: SIMPLE_PDF_VISUAL_ENDPOINT_TOP_STEP_BUDGET_PX,
      edgePulseStep: SIMPLE_PDF_VISUAL_EDGE_PULSE_STEP,
      frames,
      geometryMatchMs: SIMPLE_PDF_VISUAL_GEOMETRY_MATCH_MS,
      geometrySamples,
      inkPulseStep: SIMPLE_PDF_VISUAL_INK_PULSE_STEP,
      lateFrameMs: SIMPLE_PDF_VISUAL_LATE_FRAME_MS,
      meanDiffBudget: SIMPLE_PDF_VISUAL_CONTENT_MEAN_DIFF_BUDGET,
      meanPulseStep: SIMPLE_PDF_VISUAL_MEAN_PULSE_STEP,
      action,
    },
  );
}
