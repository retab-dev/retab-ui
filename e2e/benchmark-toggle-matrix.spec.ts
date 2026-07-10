import { expect, test } from "@playwright/test";

import {
  recordMotionMetric,
  setViewerScroll,
  traceReadingLineThroughResize,
  traceReadingLineThroughToggle,
  type ReadingLineTarget,
} from "./helpers/reading-line-trace";

// Reading-line trajectory matrix over the benchmark page's format roster —
// the sources-viewer matrix generalized to every renderer, at the benchmark
// page's REAL scroll ranges. Survey mode (MATRIX_SURVEY=1) prints without
// failing, for calibration and anomaly hunting.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const SETTLE_DRIFT_BUDGET_PX = 14;
// Resize budgets calibrated by survey; the sweep exercises the same re-fit
// capture/restore as a toggle, ten times in a row.
const RESIZE_SETTLE_BUDGET_PX = 14;
const RESIZE_CORRIDOR_BUDGET_PX = 40;
const EXCURSION_BUDGET_PX = 16;
const RAPID_EXCURSION_BUDGET_PX = 220;
// Cycles legitimately traverse the full toggle repeatedly; the vertical
// excursion at the pinned line stays single-digit when nothing accumulates.
const CYCLE_EXCURSION_BUDGET_PX = 40;
// Centered documents recenter by half the sidebar delta; start-aligned
// grids and text should not move horizontally at all.
const X_CORRIDOR_BUDGET_CENTERED_PX = 218;
const X_CORRIDOR_BUDGET_START_PX = 12;
const RAPID_X_CORRIDOR_BUDGET_PX = 280;
// TEMPORAL budgets. popScoreX ~1.0 is a clean cubic ease-out flight, ~3.0
// a single-frame teleport of the whole travel — the jump corridorX cannot
// see. Survey: close/open 0.68-1.00, rapid legs 1.11-1.31 (they launch
// from a moving start). settleMs: motion must be DONE; survey ≤103ms on a
// 150ms plan — the budget exists to catch runaway/oscillating settles.
const POP_SCORE_BUDGET = 1.5;
const RAPID_POP_SCORE_BUDGET = 1.9;
const SETTLE_MS_BUDGET = 600;

// Hunt axis: MATRIX_DPR=1|3 re-runs the matrix at a different device pixel
// ratio — the raster paths (rasterDeviceScale, canvas backing sizes) and
// half-pixel rounding are dpr-sensitive, and everything else runs at dpr2.
test.use({
  deviceScaleFactor: Number(process.env.MATRIX_DPR ?? 2),
  viewport: { width: 1440, height: 1000 },
});

type MatrixFormat = ReadingLineTarget & {
  id: string;
  ready: string;
  align: "center" | "start";
};

const FORMATS: readonly MatrixFormat[] = [
  // PDF was parked here for a while: deep-scroll toggles once unmounted
  // every [data-slot="pdf-page"] for the whole flight, leaving the probe
  // zero samples. The PDF fixes of 2026-07 changed that — a frame census
  // shows pages mounted and keyed through the entire relax — so the
  // flagship format is back on the matrix. If zero-sample throws return
  // here, re-run the flight census before re-parking.
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
  // The grid and text formats track a CONTENT row/line, not the grid or
  // canvas element: those are the fixed virtualization windows, whose rect
  // never moves with virtual scroll (probe rule 1), so window-tracked depth
  // cells would measure nothing. Rows carry aria-rowindex and text lines
  // data-source-line; the tracer re-resolves recycled pool nodes by that
  // identity. Their real scroller lives behind the style-isolation shadow
  // root — the tracer's deep lookup finds it.
  {
    id: "xlsx",
    ready: '[data-slot="xlsx-grid"]',
    frameSelector: '[data-slot="xlsx-grid"]',
    trackSelector: '[data-slot="xlsx-row"]',
    markerRatio: 0,
    align: "start",
  },
  {
    id: "csv",
    ready: '[data-slot="csv-grid"]',
    frameSelector: '[data-slot="csv-grid"]',
    trackSelector: '[data-slot="csv-row"]',
    markerRatio: 0,
    align: "start",
  },
  // Markdown joins them: the virtual canvas moves rigidly with scrollTop,
  // so canvas-tracked cells saw scroll drift but were blind to per-chunk
  // placement errors inside the sticky window — the old markdown baseline
  // read 0.0 in EVERY column, X included. Chunks carry
  // data-source-start-line; they are React-keyed (not pool-recycled), so
  // detach-rehome is the identity path the tracer must survive. Unlike the
  // other canvas formats the chunk itself is a CENTERED document
  // (max-w-4xl, left-1/2 -translate-x-1/2): its X-observable is its
  // center, which legitimately recenters by half the sidebar delta
  // (rule 5) — start-align here would read the recenter as a 140px fault.
  // The close-leg snap this retracking unmasked (canvas commits the TARGET
  // width via minWidth at the click, no motion resolver to reproject it —
  // widening pane snapped the centered chunk in one frame while a narrowing
  // pane glided) is FIXED: the markdown surface registers the align-derived
  // translate-only resolver (file-viewer-fit-width-motion), so both legs
  // now glide and close cells score like docx. The tracer's pre-click rest
  // samples keep this class visible to single-leg pop — the snap used to
  // land before the first post-click sample and read 0.00, with only the
  // cycle leg's continuous sampling recording it (pop ~6).
  {
    id: "markdown",
    ready: '[data-slot="markdown-virtual-canvas"]',
    frameSelector: '[data-slot="markdown-virtual-canvas"]',
    trackSelector: "section[data-markdown-chunk]",
    markerRatio: 0,
    align: "center",
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
    trackSelector: '[data-slot="text-line"]',
    markerRatio: 0,
    align: "start",
  },
] as const;

type ScrollDepth = "zero" | "quarter" | "half" | "max" | number;

// Hunt mode: MATRIX_SCROLL_STEPS=12 sweeps N evenly spaced depths instead of
// the four structural ones — for finding depth-specific anomalies like the
// PDF page-boundary anchor miss (survey mode recommended).
const SCROLL_STEPS = Number(process.env.MATRIX_SCROLL_STEPS ?? 0);
// Hunt axis: MATRIX_ZOOM=N clicks "Zoom in" N times before the cells run.
// Explicit zoom leaves the fit-width resolver for the zoom code path, and
// zoomed geometry multiplies scrollHeight — the mode-state matrix gates
// exactly one zoomed config; this sweeps them all (survey recommended).
const ZOOM_STEPS = Number(process.env.MATRIX_ZOOM ?? 0);
const SCROLLS: readonly ScrollDepth[] =
  SCROLL_STEPS > 1
    ? Array.from({ length: SCROLL_STEPS }, (_, i) => i / (SCROLL_STEPS - 1))
    : (["zero", "quarter", "half", "max"] as const);

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

    if (ZOOM_STEPS > 0) {
      // Both the header FileViewerControls and the document's own controls
      // overlay expose a "Zoom in" — an unscoped role query matches two
      // buttons, and the strict-mode violation used to be swallowed by the
      // isVisible catch below, silently running the sweep unzoomed.
      const zoomIn = page
        .locator('[data-slot="file-viewer-root"]:visible')
        .first()
        .getByRole("button", { name: "Zoom in" })
        .first();
      if (await zoomIn.isVisible().catch(() => false)) {
        // Prove the lever ENGAGES (rule 13): this sweep once ran silently
        // unzoomed and a whole investigation chased the misattributed
        // numbers. Zoom that applied must change the frame's rendered
        // width; a no-op throws instead of surveying the wrong world.
        const widthBefore = (
          await page.locator(format.frameSelector).first().boundingBox()
        )?.width;
        let clicked = 0;
        for (let step = 0; step < ZOOM_STEPS; step += 1) {
          if (!(await zoomIn.isEnabled().catch(() => false))) break;
          await zoomIn.click();
          clicked += 1;
          await page.waitForTimeout(250);
        }
        await page.waitForTimeout(800);
        const widthAfter = (
          await page.locator(format.frameSelector).first().boundingBox()
        )?.width;
        if (
          clicked > 0 &&
          widthBefore != null &&
          widthAfter != null &&
          Math.abs(widthAfter - widthBefore) < 1
        ) {
          throw new Error(
            `MATRIX_ZOOM lever did not engage for ${format.id}: frame width ${widthBefore.toFixed(1)} -> ${widthAfter.toFixed(1)} after ${clicked} zoom clicks`,
          );
        }
      } else {
        console.log(`ZOOM ${format.id}: no zoom control — running unzoomed`);
      }
    }

    const failures: string[] = [];
    for (const scroll of SCROLLS) {
      const scrolled = await setViewerScroll(
        page,
        format.frameSelector,
        scroll,
      );
      const scrollLabel =
        typeof scroll === "number" ? scroll.toFixed(2) : scroll;
      if (!scrolled) {
        // A depth cell that cannot scroll is a coverage hole, not a pass —
        // this exact silent `continue` hid the text/csv/xlsx zero-only gap
        // for the suite's whole life (a one-viewport text fixture plus the
        // grids' shadow-hidden scroller). Every benchmark fixture overflows
        // at this viewport by construction now, so a false return means a
        // fixture shrank or the scroller lookup broke. Fail loudly.
        console.log(`BMATRIX ${format.id} scroll=${scrollLabel}: UNSCROLLABLE`);
        if (scroll !== "zero" && scroll !== 0) {
          failures.push(
            `${format.id} scroll=${scrollLabel}: pane did not scroll — the fixture no longer overflows or the scroller lookup regressed`,
          );
        }
        continue;
      }
      await page.waitForTimeout(600);

      const actions =
        scroll === "quarter"
          ? (["close", "open", "rapid", "cycle"] as const)
          : (["close", "open", "rapid"] as const);
      for (const action of actions) {
        const trace = await traceReadingLineThroughToggle(
          page,
          {
            frameSelector: format.frameSelector,
            trackSelector: format.trackSelector,
            align: format.align,
            markerRatio:
              scroll === "zero" || scroll === 0 ? 0 : format.markerRatio,
          },
          { rapid: action === "rapid", cycles: action === "cycle" ? 4 : 0 },
        );
        await page.waitForTimeout(500);
        const line = `${format.id} scroll=${scrollLabel} ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} excursion=${trace.excursion.toFixed(1)} settleX=${trace.settleDriftX.toFixed(1)} corridorX=${trace.corridorX.toFixed(1)} pop=${trace.popScoreX.toFixed(2)} settleMs=${trace.settleMs.toFixed(0)} (scroll ${trace.scrollBefore.toFixed(0)}->${trace.scrollAfter.toFixed(0)})`;
        console.log(`BMATRIX ${line}`);
        recordMotionMetric(
          `bmatrix:${format.id}:${scrollLabel}:${action}`,
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

        const excursionBudget =
          action === "rapid"
            ? RAPID_EXCURSION_BUDGET_PX
            : action === "cycle"
              ? CYCLE_EXCURSION_BUDGET_PX
              : EXCURSION_BUDGET_PX;
        const xBudget =
          action === "rapid" || action === "cycle"
            ? RAPID_X_CORRIDOR_BUDGET_PX
            : format.align === "center"
              ? X_CORRIDOR_BUDGET_CENTERED_PX
              : X_CORRIDOR_BUDGET_START_PX;
        // Cycles are the ACCUMULATION detector (settle/excursion); their
        // per-leg pop is redundant with close/open and load-sensitive on
        // CI runners (a leg's first paint lands deep into the time-based
        // ease — 1.6-1.7 observed at plain runner load). Recorded for
        // drift, not gated.
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

  test(`${format.id} reading line survives a resize sweep`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page
      .locator(`[data-benchmark-format-option="${format.id}"]`)
      .click();
    await expect(page.locator(format.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);
    await setViewerScroll(page, format.frameSelector, "quarter");
    await page.waitForTimeout(600);

    const sweep = await traceReadingLineThroughResize(page, {
      frameSelector: format.frameSelector,
      trackSelector: format.trackSelector,
      markerRatio: format.markerRatio,
      align: format.align,
    });
    const settle = sweep.positions.at(-1) ?? 0;
    let corridor = 0;
    for (const position of sweep.positions) {
      corridor = Math.max(corridor, Math.abs(position));
    }
    console.log(
      `BRESIZE ${format.id}: settle=${settle.toFixed(1)} corridor=${corridor.toFixed(1)} steps=${sweep.positions.map((v: number) => v.toFixed(1)).join(",")}`,
    );
    recordMotionMetric(`bresize:${format.id}`, { settle, corridor });
    if (!SURVEY) {
      expect(
        Math.abs(settle),
        `reading line drifted ${settle.toFixed(1)}px across a resize round trip`,
      ).toBeLessThanOrEqual(RESIZE_SETTLE_BUDGET_PX);
      expect(
        corridor,
        `reading line strayed ${corridor.toFixed(1)}px during the resize sweep`,
      ).toBeLessThanOrEqual(RESIZE_CORRIDOR_BUDGET_PX);
    }
  });
}
