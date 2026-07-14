import { expect, test } from "@playwright/test";

import {
  analyzeScreencastFrames,
  captureScreencastDuring,
  scoreScreencastMotion,
} from "./helpers/screencast-pixel-probe";

// Screen-space gate for the FileViewer sidebar motion. DOM-sampled telemetry
// (shell benchmark, __pdfViewerTelemetry, __fileViewerMotionTelemetry) reads
// coherent state inside rAF and cannot see paint-level artifacts; this spec
// scores the actual composited frames over a CDP screencast, so a
// settle-boundary wobble or a canvas whiteout fails CI even when every DOM
// metric passes. Not opt-in.
const BENCHMARK_ROUTE = "/view/file-viewer-sidebar-benchmark";
const PDF_READY_SELECTOR =
  '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]';
const PDF_SCROLLER_SELECTOR =
  '[data-slot="file-viewer-root"][data-benchmark-active-format="pdf"] [data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]';
const SIDEBAR_TRIGGER_SELECTOR = '[data-slot="file-viewer-sidebar-trigger"]';
// Motion is 150ms; the settle hold adds a few frames and the first raster
// tail may land right after. Pixels must be at rest beyond this point.
const MOTION_END_MS = 450;

test.describe("FileViewer sidebar visual blink gate", () => {
  test("painted frames stay inside the endpoint interval through a deep-scroll toggle cycle", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BENCHMARK_ROUTE);
    await page.waitForSelector(PDF_READY_SELECTOR, { timeout: 60_000 });

    await page.evaluate(async (scrollerSelector) => {
      const scroller = document.querySelector<HTMLElement>(scrollerSelector);
      if (!scroller) throw new Error("PDF scroller unavailable.");
      const availableScroll = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight,
      );
      scroller.scrollTop = Math.max(
        scroller.clientHeight * 3.6,
        availableScroll * 0.72,
      );
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      for (let index = 0; index < 30; index += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
    }, PDF_SCROLLER_SELECTOR);
    await page.waitForTimeout(1_200);

    const failures: string[] = [];
    for (const action of ["close", "open"] as const) {
      const frames = await captureScreencastDuring(page, async () => {
        await page.click(SIDEBAR_TRIGGER_SELECTOR);
      });
      expect(
        frames.length,
        `${action}: screencast captured too few frames`,
      ).toBeGreaterThan(5);

      const stats = await analyzeScreencastFrames(page, frames);
      const verdict = scoreScreencastMotion(stats, {
        motionEndMs: MOTION_END_MS,
      });

      await test.info().attach(`screencast-${action}.json`, {
        body: JSON.stringify({ stats, verdict }, null, 2),
        contentType: "application/json",
      });
      failures.push(
        ...verdict.failures.map((failure) => `${action}: ${failure}`),
      );
      await page.waitForTimeout(400);
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("shell motion telemetry passes every budget at deep scroll", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BENCHMARK_ROUTE);
    await page.waitForSelector(PDF_READY_SELECTOR, { timeout: 60_000 });
    await page.waitForFunction(() =>
      Boolean(window.__fileViewerMotionTelemetry),
    );

    await page.evaluate(async (scrollerSelector) => {
      const scroller = document.querySelector<HTMLElement>(scrollerSelector);
      if (!scroller) throw new Error("PDF scroller unavailable.");
      const availableScroll = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight,
      );
      scroller.scrollTop = availableScroll * 0.72;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      for (let index = 0; index < 20; index += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
    }, PDF_SCROLLER_SELECTOR);
    await page.waitForTimeout(800);

    const result = await page.evaluate(async () => {
      const runtime = window.__fileViewerMotionTelemetry;
      if (!runtime) return null;
      const telemetry = await runtime.run();
      if (!telemetry) return null;
      return {
        contentStartSnap: telemetry.metrics.find(
          (metric) => metric.id === "content-start-snap",
        ),
        failed: telemetry.metrics
          .filter((metric) => !metric.passed)
          // Timing metrics are environment-bound; the geometry budgets are
          // the hard gate. CI machines may drop frames without a visual bug.
          .filter((metric) => metric.id !== "main-thread")
          .map(
            (metric) =>
              `${metric.id}: ${metric.value} exceeds ${metric.budget}`,
          ),
        flightRecords: runtime.getFlightRecords().length,
        sampledFrameCount: telemetry.sampledFrameCount,
        status: telemetry.status,
      };
    });

    expect(result).not.toBeNull();
    expect(result?.sampledFrameCount ?? 0).toBeGreaterThan(10);
    expect(result?.flightRecords ?? 0).toBeGreaterThan(0);
    expect(result?.contentStartSnap).toMatchObject({
      passed: true,
    });
    expect(
      result?.failed ?? ["telemetry unavailable"],
      (result?.failed ?? []).join("\n"),
    ).toEqual([]);
  });
});
