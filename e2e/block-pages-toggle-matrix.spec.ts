import { expect, test } from "@playwright/test";

import {
  recordMotionMetric,
  setViewerScroll,
  traceReadingLineThroughToggle,
} from "./helpers/reading-line-trace";

// The application-block pages embed FileViewer inside product chrome the
// example pages never exercise — the split/consensus pages mount a
// segment-page-rail that OBSERVES the same scroller the motion kernel
// rebases (a second scroll consumer), and each block wires its own shell
// config. Same reading-line invariant, new hosts.
//
// Survey mode (MATRIX_SURVEY=1) prints without failing.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const SETTLE_DRIFT_BUDGET_PX = 14;
const EXCURSION_BUDGET_PX = 16;
const RAPID_EXCURSION_BUDGET_PX = 220;
const X_CORRIDOR_BUDGET_PX = 218;
const POP_SCORE_BUDGET = 1.5;
const RAPID_POP_SCORE_BUDGET = 1.9;
const SETTLE_MS_BUDGET = 600;

test.use({ deviceScaleFactor: 2, viewport: { width: 1600, height: 1000 } });

// Every block page hosts a PDF document; the probe target is uniform.
const PDF_TARGET = {
  ready: '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
  frameSelector: '[data-slot="pdf-page"]',
  trackSelector: '[data-slot="pdf-page"]',
  markerRatio: 0.2,
  align: "center",
} as const;

const PAGES = [
  "split",
  "split-consensus",
  "classify-consensus",
  "extract",
] as const;

for (const block of PAGES) {
  test(`${block} block keeps the reading line through toggles`, async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.goto(`/view/blocks/${block}`);
    await expect(page.locator(PDF_TARGET.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);

    const failures: string[] = [];
    for (const scroll of ["quarter", "max"] as const) {
      const scrolled = await setViewerScroll(
        page,
        PDF_TARGET.frameSelector,
        scroll,
      );
      if (!scrolled) continue;
      await page.waitForTimeout(600);

      for (const action of ["close", "open", "rapid"] as const) {
        const trace = await traceReadingLineThroughToggle(
          page,
          {
            frameSelector: PDF_TARGET.frameSelector,
            trackSelector: PDF_TARGET.trackSelector,
            markerRatio: PDF_TARGET.markerRatio,
            align: PDF_TARGET.align,
          },
          { rapid: action === "rapid" },
        );
        await page.waitForTimeout(500);
        const line = `${block} scroll=${scroll} ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} excursion=${trace.excursion.toFixed(1)} settleX=${trace.settleDriftX.toFixed(1)} corridorX=${trace.corridorX.toFixed(1)} pop=${trace.popScoreX.toFixed(2)} settleMs=${trace.settleMs.toFixed(0)} (scroll ${trace.scrollBefore.toFixed(0)}->${trace.scrollAfter.toFixed(0)})`;
        console.log(`BLOCKMATRIX ${line}`);
        recordMotionMetric(`blockmatrix:${block}:${scroll}:${action}`, {
          settle: trace.settleDrift,
          corridor: trace.corridor,
          excursion: trace.excursion,
          settleX: trace.settleDriftX,
          corridorX: trace.corridorX,
          pop: trace.popScoreX,
          settleMs: trace.settleMs,
        });

        const excursionBudget =
          action === "rapid" ? RAPID_EXCURSION_BUDGET_PX : EXCURSION_BUDGET_PX;
        const popBudget =
          action === "rapid" ? RAPID_POP_SCORE_BUDGET : POP_SCORE_BUDGET;
        if (
          Math.abs(trace.settleDrift) > SETTLE_DRIFT_BUDGET_PX ||
          trace.excursion > excursionBudget ||
          trace.corridorX > X_CORRIDOR_BUDGET_PX ||
          trace.popScoreX > popBudget ||
          trace.settleMs > SETTLE_MS_BUDGET
        ) {
          failures.push(`${line}\n  profile(t/y/x): ${trace.profile}`);
        }
      }
    }

    if (!SURVEY) {
      expect(failures, failures.join("\n")).toEqual([]);
    }
  });
}
