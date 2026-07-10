import { expect, test } from "@playwright/test";

import {
  setViewerScroll,
  traceReadingLineThroughToggle,
} from "./helpers/reading-line-trace";

// Two anomaly classes no geometry matrix covers:
//
// - SCROLL DURING FLIGHT: the user wheels while the toggle animates — the
//   kernel's rebase and the user's input write the same scroller. The
//   viewers deliberately SUSPEND pointer input during the ~150ms flight
//   (see usePdfScrollInteractionSuspension) to prevent the two-writer
//   fight, so the contract is binary: mid-flight input is either cleanly
//   IGNORED (settle matches the no-wheel baseline) or cleanly APPLIED —
//   anything in between is corruption.
// - RESOURCE ROUND TRIP: after toggle cycles the DOM and canvas populations
//   must return to baseline — retained virtualization windows, orphaned
//   projection roots, and accumulating overlays are invisible to every
//   geometry probe but compound across a session.
//
// Survey mode (MATRIX_SURVEY=1) prints without failing.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const WHEEL_DELTA_PX = 480;
// Cleanly ignored: within this of the no-wheel baseline.
const WHEEL_IGNORED_TOLERANCE_PX = 24;
// Cleanly applied: at least this fraction of the input survives.
const WHEEL_PRESERVED_MIN_RATIO = 0.5;
const NODE_GROWTH_BUDGET = 40;
const CANVAS_GROWTH_BUDGET = 2;
const CANVAS_PIXEL_GROWTH_RATIO = 1.15;

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
  {
    id: "pptx",
    ready: '[data-slot="pptx-slide"]',
    frameSelector: '[data-slot="pptx-slide"]',
    trackSelector: '[data-slot="pptx-slide"]',
    markerRatio: 0,
    align: "center" as const,
  },
  // The text-family renderers virtualize with transform-positioned line
  // windows — a different scroll consumer than the page/slide formats,
  // so their two-writer and round-trip behavior is not implied by them.
  {
    id: "markdown",
    ready: '[data-slot="markdown-virtual-canvas"]',
    frameSelector: '[data-slot="markdown-virtual-canvas"]',
    trackSelector: '[data-slot="markdown-virtual-canvas"]',
    markerRatio: 0,
    align: "start" as const,
  },
  {
    id: "text",
    ready: '[data-slot="text-virtual-canvas"]',
    frameSelector: '[data-slot="text-virtual-canvas"]',
    trackSelector: '[data-slot="text-virtual-canvas"]',
    markerRatio: 0,
    align: "start" as const,
  },
] as const;

async function readScroll(
  page: import("@playwright/test").Page,
  frameSelector: string,
) {
  return page.evaluate((frameSelector) => {
    const root = Array.from(
      document.querySelectorAll<HTMLElement>('[data-slot="file-viewer-root"]'),
    ).find((candidate) => candidate.getBoundingClientRect().width > 0)!;
    const frame = root.querySelector<HTMLElement>(frameSelector);
    const scroller = Array.from(root.querySelectorAll<HTMLElement>("*")).find(
      (el) =>
        el.scrollHeight > el.clientHeight + 4 &&
        /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
        frame != null &&
        el.contains(frame),
    );
    return scroller?.scrollTop ?? null;
  }, frameSelector);
}

for (const format of FORMATS) {
  test(`${format.id} preserves user scroll landing mid-flight`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.locator(`[data-benchmark-format-option="${format.id}"]`).click();
    await expect(page.locator(format.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);
    await setViewerScroll(page, format.frameSelector, "half");
    await page.waitForTimeout(600);

    const viewerRoot = page
      .locator('[data-slot="file-viewer-root"]:visible')
      .first();
    const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });

    // The text-family virtual panes have no native scroller to read — the
    // scroll-conflict contract needs the virtual-scroll driver (tracked)
    // before it can measure them. Skip loudly, not pass.
    const scrollReadable =
      (await readScroll(page, format.frameSelector)) != null;
    test.skip(
      !scrollReadable,
      "no native scroller — needs the virtual-scroll probe driver",
    );

    // Baseline: a clean toggle from the same state — where the rebase alone
    // puts the scroll.
    const before = await readScroll(page, format.frameSelector);
    await trigger.click();
    await page.waitForTimeout(900);
    const baselineAfter = await readScroll(page, format.frameSelector);
    await trigger.click();
    await page.waitForTimeout(900);
    const restored = await readScroll(page, format.frameSelector);

    // Control: the wheel must actually scroll at rest, or the conflict
    // verdict is meaningless (the recurring probe lesson: validate the
    // instrument before believing its reading).
    await page.locator(format.frameSelector).first().hover();
    const preWheel = await readScroll(page, format.frameSelector);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(400);
    const postWheel = await readScroll(page, format.frameSelector);
    expect(
      (postWheel ?? 0) - (preWheel ?? 0),
      "rest-state wheel did not scroll — conflict probe invalid",
    ).toBeGreaterThan(100);
    await setViewerScroll(page, format.frameSelector, "half");
    await page.waitForTimeout(400);

    // Conflict run: same toggle, wheel input landing mid-flight.
    await trigger.click();
    await page.waitForTimeout(50);
    await page.mouse.wheel(0, WHEEL_DELTA_PX / 2);
    await page.waitForTimeout(30);
    await page.mouse.wheel(0, WHEEL_DELTA_PX / 2);
    await page.waitForTimeout(1_100);
    const conflictAfter = await readScroll(page, format.frameSelector);

    const preserved =
      conflictAfter != null && baselineAfter != null
        ? conflictAfter - baselineAfter
        : null;
    console.log(
      `CONFLICT ${format.id}: before=${before} baselineAfter=${baselineAfter} restored=${restored} conflictAfter=${conflictAfter} preserved=${preserved?.toFixed(1)}`,
    );

    if (!SURVEY) {
      expect(preserved, "scroll state unreadable").not.toBeNull();
      const cleanlyIgnored = Math.abs(preserved!) <= WHEEL_IGNORED_TOLERANCE_PX;
      const cleanlyApplied =
        preserved! >= WHEEL_DELTA_PX * WHEEL_PRESERVED_MIN_RATIO;
      expect(
        cleanlyIgnored || cleanlyApplied,
        `mid-flight wheel neither ignored nor applied: settle is ${preserved!.toFixed(1)}px off the no-wheel baseline (input was ${WHEEL_DELTA_PX}px) — a two-writer corruption`,
      ).toBe(true);
    }

    // reset for cleanliness
    await trigger.click();
    await page.waitForTimeout(600);
  });

  test.describe(`${format.id} touch input`, () => {
    // The synthesized gesture only reaches the scroller when the context
    // reports touch support (rule 4: the rest-state control caught this).
    test.use({ hasTouch: true });

    test(`${format.id} preserves touch scroll landing mid-flight`, async ({
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
      await setViewerScroll(page, format.frameSelector, "half");
      await page.waitForTimeout(600);

      const viewerRoot = page
        .locator('[data-slot="file-viewer-root"]:visible')
        .first();
      const trigger = viewerRoot.getByRole("button", {
        name: "Toggle sidebar",
      });
      // The gesture point comes from the shell viewport, measured per
      // gesture — NOT from the document frame: at half-scroll the frame's
      // bounding box tops out far above the scrollport (the docx sticky
      // window sits ~1550px off-screen), and a frame-derived point lands
      // out of bounds. That artifact read as "touch is dead after a
      // toggle" before this probe was fixed — validate the instrument's
      // COORDINATES, not just its rest-state effect.
      const gesturePoint = async () => {
        const viewportBox = await page
          .locator('[data-slot="file-viewer-viewport"]:visible')
          .first()
          .boundingBox();
        return {
          x: Math.round(
            (viewportBox?.x ?? 400) + (viewportBox?.width ?? 800) / 2,
          ),
          y: Math.round(
            (viewportBox?.y ?? 300) + (viewportBox?.height ?? 600) / 2,
          ),
        };
      };
      // A real touch-source scroll gesture (the tablet input path), not a
      // wheel event — chromium-only via CDP, which is where this gate runs.
      const session = await page.context().newCDPSession(page);
      const touchScroll = async (distance: number) => {
        const at = await gesturePoint();
        return session.send("Input.synthesizeScrollGesture", {
          x: at.x,
          y: at.y,
          yDistance: -distance,
          speed: 2_000,
          gestureSourceType: "touch",
        });
      };

      try {
        // Baseline: clean toggle, no touch input.
        await trigger.click();
        await page.waitForTimeout(900);
        const baselineAfter = await readScroll(page, format.frameSelector);
        await trigger.click();
        await page.waitForTimeout(900);

        // Control: the gesture must scroll at rest (validate the instrument).
        const preTouch = await readScroll(page, format.frameSelector);
        await touchScroll(240);
        await page.waitForTimeout(500);
        const postTouch = await readScroll(page, format.frameSelector);
        const touchDelta = (postTouch ?? 0) - (preTouch ?? 0);
        expect(
          touchDelta,
          "rest-state touch scroll did not scroll — touch conflict probe invalid",
        ).toBeGreaterThan(100);
        await setViewerScroll(page, format.frameSelector, "half");
        await page.waitForTimeout(400);

        // Conflict: the gesture landing mid-flight.
        await trigger.click();
        await page.waitForTimeout(50);
        await touchScroll(WHEEL_DELTA_PX);
        await page.waitForTimeout(1_100);
        const conflictAfter = await readScroll(page, format.frameSelector);

        const preserved =
          conflictAfter != null && baselineAfter != null
            ? conflictAfter - baselineAfter
            : null;
        console.log(
          `TOUCHCONFLICT ${format.id}: baseline=${baselineAfter} conflict=${conflictAfter} preserved=${preserved?.toFixed(1)} restDelta=${touchDelta.toFixed(1)}`,
        );
        if (!SURVEY) {
          expect(preserved, "scroll state unreadable").not.toBeNull();
          const cleanlyIgnored =
            Math.abs(preserved!) <= WHEEL_IGNORED_TOLERANCE_PX;
          const cleanlyApplied =
            preserved! >= touchDelta * WHEEL_PRESERVED_MIN_RATIO;
          expect(
            cleanlyIgnored || cleanlyApplied,
            `mid-flight touch scroll neither ignored nor applied: ${preserved!.toFixed(1)}px vs a rest-state gesture of ${touchDelta.toFixed(1)}px`,
          ).toBe(true);
        }
      } finally {
        await session.detach().catch(() => {});
      }
    });
  });

  test(`${format.id} resources return to baseline after toggle cycles`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.locator(`[data-benchmark-format-option="${format.id}"]`).click();
    await expect(page.locator(format.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);
    await setViewerScroll(page, format.frameSelector, "quarter");
    await page.waitForTimeout(600);

    const census = () =>
      page.evaluate(() => {
        const root = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-slot="file-viewer-root"]',
          ),
        ).find((candidate) => candidate.getBoundingClientRect().width > 0)!;
        const canvases = Array.from(root.querySelectorAll("canvas"));
        return {
          nodes: root.querySelectorAll("*").length,
          canvases: canvases.length,
          canvasPixels: canvases.reduce(
            (sum, canvas) => sum + canvas.width * canvas.height,
            0,
          ),
        };
      });

    const baseline = await census();
    await traceReadingLineThroughToggle(
      page,
      {
        frameSelector: format.frameSelector,
        trackSelector: format.trackSelector,
        markerRatio: format.markerRatio,
        align: format.align,
      },
      { cycles: 4 },
    );
    // settle tail: virtualization windows release, idle re-measures run
    await page.waitForTimeout(2_500);
    const after = await census();

    console.log(
      `LEAK ${format.id}: nodes ${baseline.nodes}->${after.nodes} canvases ${baseline.canvases}->${after.canvases} pixels ${baseline.canvasPixels}->${after.canvasPixels}`,
    );

    if (!SURVEY) {
      expect(
        after.nodes - baseline.nodes,
        `DOM grew by ${after.nodes - baseline.nodes} nodes across a toggle round trip`,
      ).toBeLessThanOrEqual(NODE_GROWTH_BUDGET);
      expect(
        after.canvases - baseline.canvases,
        `canvas count grew ${baseline.canvases}->${after.canvases} across a toggle round trip`,
      ).toBeLessThanOrEqual(CANVAS_GROWTH_BUDGET);
      expect(
        after.canvasPixels,
        `canvas backing pixels grew ${baseline.canvasPixels}->${after.canvasPixels} across a toggle round trip`,
      ).toBeLessThanOrEqual(baseline.canvasPixels * CANVAS_PIXEL_GROWTH_RATIO);
    }
  });
}
