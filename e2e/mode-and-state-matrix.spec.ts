import { expect, test } from "@playwright/test";

import {
  setViewerScroll,
  traceReadingLineThroughToggle,
  traceReadingLineThroughResize,
} from "./helpers/reading-line-trace";

// State-and-mode matrix: the branches the geometry matrices never enter.
//
// - OVERLAY mode (shell narrower than the 768 inline breakpoint): the
//   sidebar floats above the document, which must not move AT ALL — the
//   strictest invariant in the suite.
// - BREAKPOINT CROSSING: a resize sweep across 768 flips inline<->overlay
//   mid-sweep; the kernel snaps the mode without animating, and the reading
//   line must survive the flip.
// - EXPLICIT ZOOM: zooming disables fit-width, so a toggle must not re-fit —
//   zero vertical motion, pure horizontal recenter.
// - REDUCED MOTION: the toggle snaps in one commit to the exact destination.
//
// Survey mode (MATRIX_SURVEY=1) prints without failing.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const OVERLAY_DOC_MOTION_BUDGET_PX = 2;
const BREAKPOINT_SETTLE_BUDGET_PX = 14;
const BREAKPOINT_CORRIDOR_BUDGET_PX = 40;
const ZOOMED_VERTICAL_BUDGET_PX = 8;
// A zoomed document overflows horizontally and is left-anchored; the pane
// change shifts it bounded by the sidebar delta, far under the recenter.
const ZOOMED_X_BUDGET_PX = 60;
const REDUCED_MOTION_SETTLE_BUDGET_PX = 14;

const IMAGE_TARGET = {
  frameSelector: '[data-slot="image-frame"]',
  trackSelector: '[data-slot="image-frame"]',
  markerRatio: 0,
  align: "center" as const,
};

test.describe("overlay mode", () => {
  // Sources page shell sits inside the docs layout; a ~740px viewport puts
  // the shell width under the 768 inline breakpoint.
  test.use({ deviceScaleFactor: 2, viewport: { width: 740, height: 900 } });

  test("overlay sidebar toggle leaves the document untouched", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/examples/sources-viewer");
    await page.getByRole("tab", { name: "Image" }).click();
    await expect(
      page.locator('[data-slot="image-viewer-document"] canvas').first(),
    ).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);

    const mode = await page.evaluate(() => {
      const root = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-slot="file-viewer-root"]',
        ),
      ).find((candidate) => candidate.getBoundingClientRect().width > 0);
      return root?.getAttribute("data-file-viewer-sidebar-mode");
    });
    expect(mode, "expected the shell to resolve to overlay mode").toBe(
      "overlay",
    );

    for (const action of ["open", "close"] as const) {
      const trace = await traceReadingLineThroughToggle(page, IMAGE_TARGET);
      await page.waitForTimeout(500);
      console.log(
        `MODEMATRIX overlay image ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} corridorX=${trace.corridorX.toFixed(1)}`,
      );
      if (!SURVEY) {
        expect(
          Math.max(trace.corridor, trace.corridorX),
          `${action}: an overlay toggle moved the document ${trace.corridor.toFixed(1)}/${trace.corridorX.toFixed(1)}px — the panel floats, the document must not move`,
        ).toBeLessThanOrEqual(OVERLAY_DOC_MOTION_BUDGET_PX);
      }
    }
  });
});

test.describe("breakpoint crossing", () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 900, height: 900 } });

  test("reading line survives an inline-overlay mode flip resize", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/examples/sources-viewer");
    await page.getByRole("tab", { name: "Image" }).click();
    await expect(
      page.locator('[data-slot="image-viewer-document"] canvas').first(),
    ).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await setViewerScroll(page, IMAGE_TARGET.frameSelector, "half");
    await page.waitForTimeout(600);

    // 900 -> 540 -> 900 in 60px steps crosses the 768 shell breakpoint in
    // both directions. Intermediate samples are sparse (the flip remounts
    // enough of the shell that mid-flip reads drop); the assertions target
    // what survives — the recorded corridor and, above all, the round-trip
    // settle across two mode flips.
    const sweep = await traceReadingLineThroughResize(page, IMAGE_TARGET, {
      stepPx: 60,
      steps: 6,
    });
    const settle = sweep.positions.at(-1) ?? 0;
    let corridor = 0;
    for (const position of sweep.positions) {
      corridor = Math.max(corridor, Math.abs(position));
    }
    console.log(
      `MODEMATRIX breakpoint image: settle=${settle.toFixed(1)} corridor=${corridor.toFixed(1)} steps=${sweep.positions.map((v: number) => v.toFixed(1)).join(",")}`,
    );
    if (!SURVEY) {
      expect(Math.abs(settle)).toBeLessThanOrEqual(
        BREAKPOINT_SETTLE_BUDGET_PX,
      );
      expect(corridor).toBeLessThanOrEqual(BREAKPOINT_CORRIDOR_BUDGET_PX);
    }
  });
});

test.describe("explicit zoom and reduced motion", () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 1440, height: 1000 } });

  test("zoomed (non-fit-width) toggle does not re-fit the document", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.locator('[data-benchmark-format-option="image"]').click();
    await expect(
      page
        .locator(
          '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
        )
        .first(),
    ).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);

    const viewerRoot = page
      .locator('[data-slot="file-viewer-root"]:visible')
      .first();
    // Some formats (pdf/csv/docx) expose a second "Zoom in" in the
    // document's own controls overlay alongside the header's — an unscoped
    // role query is a strict-mode violation there. Both drive the shared
    // zoom state, so take the first.
    await viewerRoot.getByRole("button", { name: "Zoom in" }).first().click();
    await page.waitForTimeout(800);
    await setViewerScroll(page, IMAGE_TARGET.frameSelector, "quarter");
    await page.waitForTimeout(600);

    for (const action of ["close", "open"] as const) {
      const trace = await traceReadingLineThroughToggle(page, IMAGE_TARGET);
      await page.waitForTimeout(500);
      console.log(
        `MODEMATRIX zoomed image ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} corridorX=${trace.corridorX.toFixed(1)}`,
      );
      if (!SURVEY) {
        expect(
          trace.corridor,
          `${action}: a zoomed document re-fit vertically (${trace.corridor.toFixed(1)}px) — explicit zoom must pin the scale through a toggle`,
        ).toBeLessThanOrEqual(ZOOMED_VERTICAL_BUDGET_PX);
        expect(trace.corridorX).toBeLessThanOrEqual(ZOOMED_X_BUDGET_PX);
      }
    }
  });

  test("reduced motion snaps to the exact destination", async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.locator('[data-benchmark-format-option="image"]').click();
    await expect(
      page
        .locator(
          '[data-slot="image-viewer-document"] canvas[data-image-frame-rendered="true"]',
        )
        .first(),
    ).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await setViewerScroll(page, IMAGE_TARGET.frameSelector, "half");
    await page.waitForTimeout(600);

    for (const action of ["close", "open"] as const) {
      const trace = await traceReadingLineThroughToggle(page, IMAGE_TARGET);
      await page.waitForTimeout(500);
      console.log(
        `MODEMATRIX reduced image ${action}: settle=${trace.settleDrift.toFixed(1)} corridor=${trace.corridor.toFixed(1)} samples=${trace.samples}`,
      );
      if (!SURVEY) {
        expect(Math.abs(trace.settleDrift)).toBeLessThanOrEqual(
          REDUCED_MOTION_SETTLE_BUDGET_PX,
        );
        // A snap has no in-flight frames: the corridor IS the settle step.
        expect(
          trace.excursion,
          `${action}: reduced motion animated (excursion ${trace.excursion.toFixed(1)}px) — it must snap in one commit`,
        ).toBeLessThanOrEqual(2);
      }
    }
  });
});
