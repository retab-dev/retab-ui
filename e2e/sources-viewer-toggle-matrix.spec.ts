import { expect, test } from "@playwright/test";

import {
  setViewerScroll,
  traceReadingLineThroughToggle,
} from "./helpers/reading-line-trace";

// Geometry-sweep matrix for the sources viewer sidebar toggle. Traces the
// screen trajectory of the content at the format's pinned reading line
// through BOTH toggle directions, across viewport sizes and scroll depths.
//
// Three numbers per run:
// - settleDrift: where the reading-line content ends vs where it started
//   (destination correctness);
// - corridor: how far it strays from its start DURING the slide (flight
//   correctness — a slide that carries the content away and back scores
//   high here even if the destination is perfect);
// - excursion: corridor minus |net displacement| — the literal
//   back-and-forth number, ~0 for a slide that goes one way and stays.
//
// Survey mode (MATRIX_SURVEY=1) prints every run without failing, for
// calibration. Gate mode asserts the budgets.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const SETTLE_DRIFT_BUDGET_PX = 14;
const EXCURSION_BUDGET_PX = 16;
// Horizontal: a centered document legitimately recenters by half the sidebar
// width (210px here); the budget allows that plus a small tolerance. The
// rapid budget covers the known image retarget x-overshoot (~265px measured,
// tracked separately) without letting it grow.
const X_CORRIDOR_BUDGET_PX = 218;
const RAPID_X_CORRIDOR_BUDGET_PX = 280;
// A rapid retarget travels toward the target before reversing; its excursion
// is bounded by how far one 60ms leg gets, not by the full corridor budget.
const RAPID_EXCURSION_BUDGET_PX = 220;

// The two heights that discriminated during calibration: the in-flight
// clamp-drag only appeared at viewports >= 1000px tall (deeper max scroll).
// Add widths/heights here when a new geometry-dependent report arrives.
test.use({ deviceScaleFactor: 2 });

const VIEWPORTS = [
  { width: 1440, height: 1000 },
  { width: 2000, height: 1250 },
] as const;

const SCROLLS = ["zero", "quarter", "half", "max"] as const;

const FORMATS = [
  {
    name: "PDF",
    readySelector:
      '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
    frameSelector: '[data-slot="pdf-page"]',
    trackSelector: '[data-slot="pdf-page"]',
    markerRatio: 0.2,
  },
  {
    name: "Image",
    readySelector: '[data-slot="image-viewer-document"] canvas',
    frameSelector: '[data-slot="image-frame"]',
    trackSelector: '[data-slot="image-frame"]',
    markerRatio: 0,
  },
  {
    name: "DOCX",
    readySelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    frameSelector: '[data-slot="docx-viewer"] .docx-wrapper',
    // Track the PAGE under the marker, not the wrapper: the wrapper is the
    // virtualization window, and its box changes when pages mount/unmount
    // at settle — tracking it reads window churn as content drift.
    trackSelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    markerRatio: 0.2,
  },
] as const;

for (const viewport of VIEWPORTS) {
  for (const format of FORMATS) {
    test(`${format.name} toggle trajectory at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(300_000);
      await page.setViewportSize(viewport);
      await page.goto("/examples/sources-viewer");
      await page.getByRole("tab", { name: format.name }).click();
      await expect(page.locator(format.readySelector).first()).toBeVisible({
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
          // At scroll 0 every format pins the document TOP (the clamp
          // permits nothing else), so that is the line to probe there;
          // deeper, each format pins its own reading line.
          const trace = await traceReadingLineThroughToggle(
            page,
            {
              frameSelector: format.frameSelector,
              trackSelector: format.trackSelector,
              align: "center",
              markerRatio: scroll === "zero" ? 0 : format.markerRatio,
            },
            { rapid: action === "rapid" },
          );
          await page.waitForTimeout(500);
          const line = `${format.name} ${viewport.width}x${viewport.height} scroll=${scroll} ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} excursion=${trace.excursion.toFixed(1)} settleX=${trace.settleDriftX.toFixed(1)} corridorX=${trace.corridorX.toFixed(1)} (scroll ${trace.scrollBefore.toFixed(0)}->${trace.scrollAfter.toFixed(0)})`;
          console.log(`MATRIX ${line}`);
          // A rapid retarget legitimately travels toward the target before
          // reversing home, so its corridor is motion, not error: gate its
          // DESTINATION strictly and its excursion loosely (it must come
          // back without wild swings beyond the two legs).
          const excursionBudget =
            action === "rapid"
              ? RAPID_EXCURSION_BUDGET_PX
              : EXCURSION_BUDGET_PX;
          const xBudget =
            action === "rapid"
              ? RAPID_X_CORRIDOR_BUDGET_PX
              : X_CORRIDOR_BUDGET_PX;
          if (
            Math.abs(trace.settleDrift) > SETTLE_DRIFT_BUDGET_PX ||
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
}
