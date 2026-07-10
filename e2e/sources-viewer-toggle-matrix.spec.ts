import { expect, test } from "@playwright/test";

import {
  recordMotionMetric,
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
// width (210px here); the budget allows that plus a small tolerance. A rapid
// retarget's corridor is bounded by the full one-way recenter (the first leg
// reverses at most from its far point), so it shares the plain ceiling — the
// old ~265px image rapid overshoot was the image surface's hardcoded mx-auto
// fighting the fit-width counter-transform's align-margin model (fixed with
// the open-leg pop anomaly; the surface margin now follows rendererFrame's
// align like PDF/DOCX).
const X_CORRIDOR_BUDGET_PX = 218;
const RAPID_X_CORRIDOR_BUDGET_PX = 218;
// A rapid retarget travels toward the target before reversing; its excursion
// is bounded by how far one 60ms leg gets, not by the full corridor budget.
const RAPID_EXCURSION_BUDGET_PX = 220;
const CYCLE_EXCURSION_BUDGET_PX = 40;
// Repeated toggles trace the same one-way recenter per leg (the old ~300px
// image cycle overshoot was the same align-model mismatch as the rapid
// case, fixed alongside it — cycles now measure exactly 210).
const CYCLE_X_CORRIDOR_BUDGET_PX = 218;
// TEMPORAL budgets (see MOTION-TESTING.md). Survey: plain toggles 0.4-0.9
// across formats (the image open leg's tracked ~40% velocity excess was the
// align-model mismatch above — fixed, opens now 0.5-0.8), rapids ≤1.46.
// Matches the benchmark matrix ceiling. A single-frame teleport scores ~3.
const POP_SCORE_BUDGET = 1.5;
const RAPID_POP_SCORE_BUDGET = 1.9;
const SETTLE_MS_BUDGET = 600;

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

        // No cycle leg for PDF: across repeated toggles its page window
        // recenters and the tracked page unmounts for whole legs — the
        // zero-sample guard (correctly) refuses to score that. Single and
        // rapid toggles keep PDF gated.
        const actions =
          scroll === "quarter" && format.name !== "PDF"
            ? (["close", "open", "rapid", "cycle"] as const)
            : (["close", "open", "rapid"] as const);
        for (const action of actions) {
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
            { rapid: action === "rapid", cycles: action === "cycle" ? 4 : 0 },
          );
          await page.waitForTimeout(500);
          const line = `${format.name} ${viewport.width}x${viewport.height} scroll=${scroll} ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} excursion=${trace.excursion.toFixed(1)} settleX=${trace.settleDriftX.toFixed(1)} corridorX=${trace.corridorX.toFixed(1)} pop=${trace.popScoreX.toFixed(2)} settleMs=${trace.settleMs.toFixed(0)} (scroll ${trace.scrollBefore.toFixed(0)}->${trace.scrollAfter.toFixed(0)})`;
          console.log(`MATRIX ${line}`);
          recordMotionMetric(
            `smatrix:${format.name}:${viewport.width}x${viewport.height}:${scroll}:${action}`,
            {
              settle: trace.settleDrift,
              corridor: trace.corridor,
              excursion: trace.excursion,
              settleX: trace.settleDriftX,
              corridorX: trace.corridorX,
              pop: trace.popScoreX,
              settleMs: trace.settleMs,
            },
          );
          // A rapid retarget legitimately travels toward the target before
          // reversing home, so its corridor is motion, not error: gate its
          // DESTINATION strictly and its excursion loosely (it must come
          // back without wild swings beyond the two legs).
          const excursionBudget =
            action === "rapid"
              ? RAPID_EXCURSION_BUDGET_PX
              : action === "cycle"
                ? CYCLE_EXCURSION_BUDGET_PX
                : EXCURSION_BUDGET_PX;
          const xBudget =
            action === "rapid"
              ? RAPID_X_CORRIDOR_BUDGET_PX
              : action === "cycle"
                ? CYCLE_X_CORRIDOR_BUDGET_PX
                : X_CORRIDOR_BUDGET_PX;
          // Cycle pop is load-sensitive on CI (leg first-paints land deep
          // into the ease) and redundant with close/open — recorded, not
          // gated; cycles gate accumulation via settle/excursion.
          const popBudget =
            action === "rapid"
              ? RAPID_POP_SCORE_BUDGET
              : action === "cycle"
                ? Number.POSITIVE_INFINITY
                : POP_SCORE_BUDGET;
          if (
            Math.abs(trace.settleDrift) > SETTLE_DRIFT_BUDGET_PX ||
            trace.excursion > excursionBudget ||
            trace.corridorX > xBudget ||
            trace.popScoreX > popBudget ||
            (action !== "cycle" && trace.settleMs > SETTLE_MS_BUDGET)
          ) {
            // The profile says WHERE in the flight the defect sat — no
            // re-instrumented repro run needed.
            failures.push(`${line}\n  profile(t/y/x): ${trace.profile}`);
          }
        }
      }

      if (!SURVEY) {
        expect(failures, failures.join("\n")).toEqual([]);
      }
    });
  }
}
