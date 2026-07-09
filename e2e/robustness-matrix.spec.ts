import { expect, test } from "@playwright/test";

import {
  installConsoleSentinel,
  setViewerScroll,
  traceReadingLineThroughToggle,
} from "./helpers/reading-line-trace";

// Robustness matrix: conditions where TIMING itself changes.
//
// - THROTTLED TOGGLES (4x CPU): settle races pass on a fast dev machine and
//   break on a user's throttled laptop — the class the original FLIP blink
//   hid in. Frames legitimately drop, so only the DESTINATION is gated; the
//   flight corridor is survey data.
// - COLD-START TOGGLES: every other probe waits for document readiness
//   before acting; users toggle while the document is still decoding. The
//   transient must not error, and the viewer must still converge.
// - RTL TRAJECTORY: dir="rtl" flips every X computation in the fit-width
//   motion. The margin model is direction-aware (overflow pins to the
//   direction's start edge), so both legs must fly straight to the settle —
//   the gate is the X excursion BEYOND the settled center, which is
//   sidebar-width-agnostic. Direction is sampled when the document frame
//   mounts, so dir is set before load.
//
// Survey mode (MATRIX_SURVEY=1) prints without failing where budgets exist.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const THROTTLED_SETTLE_BUDGET_PX = 20;
const RTL_SETTLE_BUDGET_PX = 20;
// The defect this gates was a ~100px mid-flight overshoot past the settled
// center; a straight flight's excursion is frame-sampling jitter only.
const RTL_X_EXCURSION_BUDGET_PX = 24;

test.use({ deviceScaleFactor: 2, viewport: { width: 1440, height: 1000 } });

const FORMATS = [
  {
    id: "image",
    ready:
      '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
    frameSelector: '[data-slot="image-frame"]',
    trackSelector: '[data-slot="image-frame"]',
    markerRatio: 0,
    align: "center" as const,
  },
  {
    id: "docx",
    ready: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    frameSelector: '[data-slot="docx-viewer"] .docx-wrapper',
    trackSelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    markerRatio: 0.2,
    align: "center" as const,
  },
] as const;

for (const format of FORMATS) {
  test(`${format.id} settles exactly under 4x CPU throttle`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.locator(`[data-benchmark-format-option="${format.id}"]`).click();
    await expect(page.locator(format.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);
    await setViewerScroll(page, format.frameSelector, "half");
    await page.waitForTimeout(600);

    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    try {
      for (const action of ["close", "open"] as const) {
        const trace = await traceReadingLineThroughToggle(page, {
          frameSelector: format.frameSelector,
          trackSelector: format.trackSelector,
          markerRatio: format.markerRatio,
          align: format.align,
        });
        await page.waitForTimeout(800);
        console.log(
          `THROTTLE ${format.id} ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} samples=${trace.samples}`,
        );
        if (!SURVEY) {
          expect(
            Math.abs(trace.settleDrift),
            `${action} under 4x throttle settled ${trace.settleDrift.toFixed(1)}px off the reading line`,
          ).toBeLessThanOrEqual(THROTTLED_SETTLE_BUDGET_PX);
        }
      }
    } finally {
      await session
        .send("Emulation.setCPUThrottlingRate", { rate: 1 })
        .catch(() => {});
      await session.detach().catch(() => {});
    }
  });

  test(`${format.id} survives toggling before the document is ready`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const sentinel = installConsoleSentinel(page, {
      expect: (errors) =>
        expect(
          errors,
          `console/page errors during cold-start toggles:\n${errors.join("\n")}`,
        ).toEqual([]),
    });

    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.locator(`[data-benchmark-format-option="${format.id}"]`).click();
    // No readiness wait — toggle immediately, twice, while the document is
    // still loading/decoding.
    const viewerRoot = page
      .locator('[data-slot="file-viewer-root"]:visible')
      .first();
    const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });
    await trigger.click();
    await page.waitForTimeout(80);
    await trigger.click();

    // The viewer must still converge to a rendered document.
    await expect(page.locator(format.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_200);

    // And a normal toggle afterwards must behave.
    await setViewerScroll(page, format.frameSelector, "quarter");
    await page.waitForTimeout(500);
    const trace = await traceReadingLineThroughToggle(page, {
      frameSelector: format.frameSelector,
      trackSelector: format.trackSelector,
      markerRatio: format.markerRatio,
      align: format.align,
    });
    console.log(
      `COLDSTART ${format.id}: post-recovery settle=${trace.settleDrift.toFixed(1)}`,
    );
    if (!SURVEY) {
      expect(Math.abs(trace.settleDrift)).toBeLessThanOrEqual(14);
    }
    sentinel.assertClean();
  });
}

test("rtl trajectory flies straight on both legs", async ({ page }) => {
  test.setTimeout(240_000);
  // Direction is sampled when the document frame mounts, so it must be set
  // before the app loads — which is also how real RTL apps ship (dir on the
  // html element at render time, not flipped under a mounted viewer).
  await page.addInitScript(() => {
    const applyRtl = () => {
      document.documentElement?.setAttribute("dir", "rtl");
    };
    applyRtl();
    document.addEventListener("DOMContentLoaded", applyRtl);
  });
  await page.goto("/view/file-viewer-sidebar-benchmark");
  await page.locator('[data-benchmark-format-option="image"]').click();
  await expect(
    page
      .locator(
        '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
      )
      .first(),
  ).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1_000);
  await setViewerScroll(page, '[data-slot="image-frame"]', "half");
  await page.waitForTimeout(600);

  for (const action of ["close", "open"] as const) {
    const trace = await traceReadingLineThroughToggle(page, {
      frameSelector: '[data-slot="image-frame"]',
      trackSelector: '[data-slot="image-frame"]',
      markerRatio: 0,
      align: "center",
    });
    await page.waitForTimeout(600);
    // The settled X legitimately moves (the container widens on one side);
    // the invariant is the flight never leaving the [start, settle] corridor.
    const excursionX = trace.corridorX - Math.abs(trace.settleDriftX);
    console.log(
      `RTL image ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} settleX=${trace.settleDriftX.toFixed(1)} corridorX=${trace.corridorX.toFixed(1)} excursionX=${excursionX.toFixed(1)}`,
    );
    if (!SURVEY) {
      expect(
        Math.abs(trace.settleDrift),
        `${action} in RTL settled ${trace.settleDrift.toFixed(1)}px off the reading line`,
      ).toBeLessThanOrEqual(RTL_SETTLE_BUDGET_PX);
      expect(
        excursionX,
        `${action} in RTL overshot the settled center by ${excursionX.toFixed(1)}px mid-flight (the LTR-margin-model failure mode)`,
      ).toBeLessThanOrEqual(RTL_X_EXCURSION_BUDGET_PX);
    }
  }
});
