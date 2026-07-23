import { expect, test, type Page } from "@playwright/test";

// Gates for the toolbar zoom relax (pdf-viewer-zoom-motion): the flight
// recorder runs in-product, this spec only reads it. "Apple preview grade"
// means: the relax's clock never visibly stutters (frame gaps), nothing
// contends with it (no mid-flight raster work, no long tasks from the
// viewer), the scroll stays nailed down for the whole flight, and the eased
// progress lands monotonically with an ease-out shape.
type ZoomFlightTick = {
  elapsedMs: number;
  frameGapMs: number;
  progress: number;
  scrollDriftPx: number;
};

type ZoomFlightRecord = {
  anchorDriftMax: { x: number; y: number };
  durationMs: number;
  id: number;
  interruption: "cancelled" | "none" | "stalled";
  longTaskCount: number;
  longTaskMs: number;
  maxTickGapMs: number;
  pageRenderCount: number;
  pageRenderMainThreadMs: number;
  pathDeviationMaxPx: number;
  residualPx: number;
  residualSnapped: boolean;
  scale: { x: number; y: number };
  scrollDriftMaxPx: number;
  settledClean: boolean;
  skipReason: string | null;
  startLatencyMs: number | null;
  startSnapPx: number | null;
  status: "played" | "skipped";
  tickCount: number;
  ticks: ZoomFlightTick[];
  translate: { x: number; y: number };
};

const PDF_READY_SELECTOR =
  '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]';
// ~60Hz frame is 16.7ms; two dropped frames in a 200ms flight is already a
// visible hitch. p95 keeps one CI scheduling hiccup from flaking the gate
// while the hard cap still catches a real stall.
const ZOOM_TICK_GAP_P95_BUDGET_MS = 40;
const ZOOM_TICK_GAP_MAX_BUDGET_MS = 100;
const ZOOM_SCROLL_DRIFT_BUDGET_PX = 1;
const ZOOM_MIN_TICK_COUNT = 6;
const ZOOM_START_LATENCY_BUDGET_MS = 250;
const ZOOM_SETTLE_WAIT_MS = 700;
// The zoom is anchored on the viewport-center content point: away from the
// document edges that point must not move AT ALL during the relax (measured
// ≤0.05px; budget leaves headroom for rect rounding). The trajectory of
// every other point is a straight line — curvature is foreign motion. The
// commit's sub-pixel residual folds into the opening frame, whose snap is
// budgeted like the shell motion's content-start-snap.
const ZOOM_ANCHOR_DRIFT_BUDGET_PX = 0.75;
const ZOOM_PATH_DEVIATION_BUDGET_PX = 1;
const ZOOM_START_SNAP_BUDGET_PX = 1.5;

async function openPdfBenchmark(page: Page) {
  await page.goto("/view/file-viewer-sidebar-benchmark");
  await expect(page.locator(PDF_READY_SELECTOR).first()).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForTimeout(1_500);
}

async function setPdfScrollFraction(page: Page, fraction: number) {
  await page.evaluate((scrollFraction) => {
    const range = document.querySelector(
      '[data-slot="pdf-viewer-scroll-range"]',
    );
    const viewport = range?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!viewport) throw new Error("pdf scroll viewport not found");
    viewport.scrollTop =
      (viewport.scrollHeight - viewport.clientHeight) * scrollFraction;
  }, fraction);
  await page.waitForTimeout(500);
}

function zoomButton(page: Page, label: "Zoom in" | "Zoom out") {
  // Both the header FileViewerControls and the document's own controls can
  // expose the same label; scope to the visible viewer root.
  return page
    .locator('[data-slot="file-viewer-root"]:visible')
    .first()
    .getByRole("button", { name: label })
    .first();
}

async function readZoomFlights(page: Page): Promise<ZoomFlightRecord[]> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __pdfViewerTelemetry?: {
            getZoomFlightRecords: () => ZoomFlightRecord[];
          };
        }
      ).__pdfViewerTelemetry?.getZoomFlightRecords() ?? [],
  );
}

function percentile(values: readonly number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function expectSmoothFlight(
  record: ZoomFlightRecord,
  label: string,
  {
    // Clamped-edge flights pan the anchor by design (the center target hits
    // the scrollable range's end); only unclamped flights gate stationarity.
    expectStationaryAnchor = true,
  }: { expectStationaryAnchor?: boolean } = {},
) {
  const failures: string[] = [];

  if (record.status !== "played") {
    failures.push(`status ${record.status} (skip: ${record.skipReason})`);
  }
  if (record.interruption !== "none") {
    failures.push(`interrupted: ${record.interruption}`);
  }
  if (expectStationaryAnchor) {
    if (
      record.anchorDriftMax.x > ZOOM_ANCHOR_DRIFT_BUDGET_PX ||
      record.anchorDriftMax.y > ZOOM_ANCHOR_DRIFT_BUDGET_PX
    ) {
      failures.push(
        `anchor wandered ${record.anchorDriftMax.x.toFixed(2)}px/${record.anchorDriftMax.y.toFixed(2)}px`,
      );
    }
    if (
      record.startSnapPx != null &&
      record.startSnapPx > ZOOM_START_SNAP_BUDGET_PX
    ) {
      failures.push(`opening frame snapped ${record.startSnapPx.toFixed(2)}px`);
    }
  }
  if (record.pathDeviationMaxPx > ZOOM_PATH_DEVIATION_BUDGET_PX) {
    failures.push(
      `trajectory curved ${record.pathDeviationMaxPx.toFixed(2)}px off the chord`,
    );
  }
  if (!record.settledClean) failures.push("settle left inline styles behind");
  if (record.pageRenderCount > 0) {
    failures.push(
      `${record.pageRenderCount} page rasters (${record.pageRenderMainThreadMs.toFixed(0)}ms) landed mid-flight`,
    );
  }
  if (record.scrollDriftMaxPx > ZOOM_SCROLL_DRIFT_BUDGET_PX) {
    failures.push(`scroll drifted ${record.scrollDriftMaxPx.toFixed(2)}px`);
  }
  if (record.tickCount < ZOOM_MIN_TICK_COUNT) {
    failures.push(`only ${record.tickCount} ticks`);
  }
  if (
    record.startLatencyMs != null &&
    record.startLatencyMs > ZOOM_START_LATENCY_BUDGET_MS
  ) {
    failures.push(`start latency ${record.startLatencyMs.toFixed(0)}ms`);
  }

  // Frame pacing: skip the first tick's zero gap; p95 within ~2 frames,
  // hard cap on any single gap.
  const gaps = record.ticks.slice(1).map((tick) => tick.frameGapMs);
  const gapP95 = percentile(gaps, 0.95);
  if (gapP95 > ZOOM_TICK_GAP_P95_BUDGET_MS) {
    failures.push(`tick gap p95 ${gapP95.toFixed(1)}ms`);
  }
  if (record.maxTickGapMs > ZOOM_TICK_GAP_MAX_BUDGET_MS) {
    failures.push(`max tick gap ${record.maxTickGapMs.toFixed(1)}ms`);
  }

  // The eased progress must land monotonically (no backtracking frame) and
  // with an ease-out shape: the first half of the flight covers more
  // progress per ms than the second half.
  for (let index = 1; index < record.ticks.length; index += 1) {
    if (record.ticks[index].progress < record.ticks[index - 1].progress) {
      failures.push(`progress reversed at tick ${index}`);
      break;
    }
  }
  const lastTick = record.ticks.at(-1);
  if (lastTick && lastTick.progress < 0.95) {
    failures.push(`final progress ${lastTick.progress.toFixed(3)}`);
  }
  const halfway = record.ticks.find(
    (tick) => tick.elapsedMs >= record.durationMs / 2,
  );
  if (lastTick && halfway && halfway.elapsedMs > 0 && lastTick.elapsedMs > 0) {
    const firstHalfVelocity = halfway.progress / halfway.elapsedMs;
    const wholeVelocity = lastTick.progress / lastTick.elapsedMs;
    if (firstHalfVelocity <= wholeVelocity) {
      failures.push(
        `ease-out shape lost (first-half ${firstHalfVelocity.toFixed(5)}/ms vs whole ${wholeVelocity.toFixed(5)}/ms)`,
      );
    }
  }

  expect(
    failures,
    `${label}: ${failures.join("; ")} — ticks ${JSON.stringify(record.ticks.slice(0, 24))}`,
  ).toEqual([]);
}

test.describe("pdf zoom motion flight telemetry", () => {
  test("zoom in and out relax smoothly at mid-document", async ({ page }) => {
    await openPdfBenchmark(page);
    await setPdfScrollFraction(page, 0.4);

    await zoomButton(page, "Zoom in").click();
    await page.waitForTimeout(ZOOM_SETTLE_WAIT_MS);
    await zoomButton(page, "Zoom out").click();
    await page.waitForTimeout(ZOOM_SETTLE_WAIT_MS);

    const flights = await readZoomFlights(page);
    expect(flights.length).toBeGreaterThanOrEqual(2);
    expectSmoothFlight(flights.at(-2)!, "zoom-in");
    expectSmoothFlight(flights.at(-1)!, "zoom-out");
  });

  test("rapid zoom steps retarget cleanly", async ({ page }) => {
    await openPdfBenchmark(page);
    await setPdfScrollFraction(page, 0.6);

    await zoomButton(page, "Zoom in").click();
    await page.waitForTimeout(60);
    await zoomButton(page, "Zoom in").click();
    await page.waitForTimeout(ZOOM_SETTLE_WAIT_MS);

    const flights = await readZoomFlights(page);
    expect(flights.length).toBeGreaterThanOrEqual(2);
    const interrupted = flights.at(-2)!;
    const settled = flights.at(-1)!;
    // The first flight is retargeted by the second click; interruption is
    // its expected, recorded outcome — and it must still have cleaned up
    // without its anchor wandering while it flew.
    expect(interrupted.interruption).toBe("cancelled");
    expect(interrupted.settledClean).toBe(true);
    expect(interrupted.anchorDriftMax.x).toBeLessThanOrEqual(
      ZOOM_ANCHOR_DRIFT_BUDGET_PX,
    );
    expect(interrupted.anchorDriftMax.y).toBeLessThanOrEqual(
      ZOOM_ANCHOR_DRIFT_BUDGET_PX,
    );
    expectSmoothFlight(settled, "rapid-retarget-final");
  });

  test("zoom at the document top edge still relaxes (clamped anchor)", async ({
    page,
  }) => {
    await openPdfBenchmark(page);
    await setPdfScrollFraction(page, 0);

    await zoomButton(page, "Zoom in").click();
    await page.waitForTimeout(ZOOM_SETTLE_WAIT_MS);

    const flights = await readZoomFlights(page);
    expect(flights.length).toBeGreaterThanOrEqual(1);
    expectSmoothFlight(flights.at(-1)!, "top-edge-zoom-in", {
      expectStationaryAnchor: false,
    });
  });
});
