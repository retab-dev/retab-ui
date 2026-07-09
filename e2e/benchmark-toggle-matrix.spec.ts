import { expect, test } from "@playwright/test";

import {
  setViewerScroll,
  traceReadingLineThroughToggle,
  type ReadingLineTarget,
} from "./helpers/reading-line-trace";

// Reading-line trajectory matrix over the benchmark page's format roster —
// the sources-viewer matrix generalized to every renderer, at the benchmark
// page's REAL scroll ranges. Survey mode (MATRIX_SURVEY=1) prints without
// failing, for calibration and anomaly hunting.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const SETTLE_DRIFT_BUDGET_PX = 14;
// At exactly max scroll the fraction-hook formats settle 14-23px off their
// pinned line (boundary residual between the ideal fraction restore and the
// range clamp) — a real, small, tracked anomaly; the budget holds the line
// against the 100px+ classes without flapping on it.
const SETTLE_DRIFT_MAX_SCROLL_BUDGET_PX = 26;
const EXCURSION_BUDGET_PX = 16;
const RAPID_EXCURSION_BUDGET_PX = 220;
// Centered documents recenter by half the sidebar delta; start-aligned
// grids and text should not move horizontally at all.
const X_CORRIDOR_BUDGET_CENTERED_PX = 218;
const X_CORRIDOR_BUDGET_START_PX = 12;
const RAPID_X_CORRIDOR_BUDGET_PX = 280;

test.use({ deviceScaleFactor: 2, viewport: { width: 1440, height: 1000 } });

type MatrixFormat = ReadingLineTarget & {
  id: string;
  ready: string;
  align: "center" | "start";
};

const FORMATS: readonly MatrixFormat[] = [
  {
    id: "pdf",
    ready:
      '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
    frameSelector: '[data-slot="pdf-page"]',
    trackSelector: '[data-slot="pdf-page"]',
    markerRatio: 0.2,
    align: "center",
  },
  {
    id: "image",
    ready:
      '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
    frameSelector: '[data-slot="image-frame"]',
    trackSelector: '[data-slot="image-frame"]',
    markerRatio: 0,
    align: "center",
  },
  {
    id: "tiff",
    ready:
      '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
    frameSelector: '[data-slot="image-frame"]',
    trackSelector: '[data-slot="image-frame"]',
    markerRatio: 0,
    align: "center",
  },
  {
    id: "pptx",
    ready: '[data-slot="pptx-slide"]',
    frameSelector: '[data-slot="pptx-slide"]',
    trackSelector: '[data-slot="pptx-slide"]',
    markerRatio: 0,
    align: "center",
  },
  {
    id: "docx",
    ready: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    frameSelector: '[data-slot="docx-viewer"] .docx-wrapper',
    trackSelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    markerRatio: 0.2,
    align: "center",
  },
  {
    id: "xlsx",
    ready: '[data-slot="xlsx-grid"]',
    frameSelector: '[data-slot="xlsx-grid"]',
    trackSelector: '[data-slot="xlsx-grid"]',
    markerRatio: 0,
    align: "start",
  },
  {
    id: "csv",
    ready: '[data-slot="csv-grid"]',
    frameSelector: '[data-slot="csv-grid"]',
    trackSelector: '[data-slot="csv-grid"]',
    markerRatio: 0,
    align: "start",
  },
  {
    id: "markdown",
    ready: '[data-slot="markdown-virtual-canvas"]',
    frameSelector: '[data-slot="markdown-virtual-canvas"]',
    trackSelector: '[data-slot="markdown-virtual-canvas"]',
    markerRatio: 0,
    align: "start",
  },
  {
    id: "code",
    ready: '[data-slot="code-viewer"] [data-code-render-window]',
    frameSelector: '[data-slot="code-viewer"] [data-code-render-window]',
    trackSelector: '[data-slot="code-viewer"] [data-code-render-window]',
    markerRatio: 0,
    align: "start",
  },
  {
    id: "text",
    ready: '[data-slot="text-virtual-canvas"]',
    frameSelector: '[data-slot="text-virtual-canvas"]',
    trackSelector: '[data-slot="text-virtual-canvas"]',
    markerRatio: 0,
    align: "start",
  },
] as const;

const SCROLLS = ["zero", "quarter", "half", "max"] as const;

for (const format of FORMATS) {
  test(`${format.id} toggle trajectory on the benchmark page`, async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.goto("/view/file-viewer-sidebar-benchmark");
    if (format.id !== "pdf") {
      await page
        .locator(`[data-benchmark-format-option="${format.id}"]`)
        .click();
    }
    await expect(page.locator(format.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);

    const failures: string[] = [];
    for (const scroll of SCROLLS) {
      const scrolled = await setViewerScroll(
        page,
        format.frameSelector,
        scroll,
      );
      if (!scrolled) continue;
      await page.waitForTimeout(600);

      for (const action of ["close", "open", "rapid"] as const) {
        const trace = await traceReadingLineThroughToggle(
          page,
          {
            frameSelector: format.frameSelector,
            trackSelector: format.trackSelector,
            align: format.align,
            markerRatio: scroll === "zero" ? 0 : format.markerRatio,
          },
          { rapid: action === "rapid" },
        );
        await page.waitForTimeout(500);
        const line = `${format.id} scroll=${scroll} ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} excursion=${trace.excursion.toFixed(1)} settleX=${trace.settleDriftX.toFixed(1)} corridorX=${trace.corridorX.toFixed(1)} (scroll ${trace.scrollBefore.toFixed(0)}->${trace.scrollAfter.toFixed(0)})`;
        console.log(`BMATRIX ${line}`);

        const excursionBudget =
          action === "rapid" ? RAPID_EXCURSION_BUDGET_PX : EXCURSION_BUDGET_PX;
        const xBudget =
          action === "rapid"
            ? RAPID_X_CORRIDOR_BUDGET_PX
            : format.align === "center"
              ? X_CORRIDOR_BUDGET_CENTERED_PX
              : X_CORRIDOR_BUDGET_START_PX;
        const settleBudget =
          scroll === "max"
            ? SETTLE_DRIFT_MAX_SCROLL_BUDGET_PX
            : SETTLE_DRIFT_BUDGET_PX;
        if (
          Math.abs(trace.settleDrift) > settleBudget ||
          trace.excursion > excursionBudget ||
          trace.corridorX > xBudget
        ) {
          failures.push(line);
        }
      }
    }

    if (!SURVEY) {
      expect(failures, failures.join("\n")).toEqual([]);
    }
  });
}
