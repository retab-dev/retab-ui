import { expect, test } from "@playwright/test";

import {
  installConsoleSentinel,
  setViewerScroll,
  traceReadingLineThroughToggle,
} from "./helpers/reading-line-trace";

// Keyboard is the input modality no other gate exercises, and focus is the
// state no geometry probe can see. Three anomaly classes:
//
// - KEYBOARD TOGGLE: Enter/Space on the sidebar trigger must fly the same
//   trajectory as a click — a divergence means a second activation path
//   (keydown + click synthesis) double-fires the motion.
// - FOCUS SURVIVAL: the trigger must keep focus through the toggle it
//   causes. A remount that drops focus to <body> strands keyboard users
//   and is invisible to every visual probe.
// - KEYBOARD SCROLL MID-FLIGHT: PageDown during the flight is the keyboard
//   twin of the wheel-conflict gate — same binary contract (cleanly
//   ignored or cleanly applied), different input path.
//
// Survey mode (MATRIX_SURVEY=1) prints without failing.

const SURVEY = process.env.MATRIX_SURVEY === "1";
const SETTLE_DRIFT_BUDGET_PX = 14;
const EXCURSION_BUDGET_PX = 16;
// Keyboard flights start under the activation handler's commit jank, so
// their pop noise band is wider than click-driven flights (survey with
// frame-timestamped sampling: 0.94-1.85 vs ~1.0). A teleport still
// scores ~3 — the budget splits the difference.
const POP_SCORE_BUDGET = 2.2;
// PageDown scrolls by ~one viewport; "applied" means most of it survived.
const KEY_IGNORED_TOLERANCE_PX = 24;
const KEY_APPLIED_MIN_RATIO = 0.5;

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
  test(`${format.id} keyboard toggle flies the click trajectory and keeps focus`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const sentinel = installConsoleSentinel(page, {
      expect: (errors) =>
        expect(
          errors,
          `console/page errors during keyboard toggles:\n${errors.join("\n")}`,
        ).toEqual([]),
    });

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
    await trigger.focus();

    for (const [leg, key] of [
      ["close", "Enter"],
      ["open", " "],
    ] as const) {
      // The tracer clicks the trigger itself; here the KEYBOARD must cause
      // the flight, so drive the trigger with a key and trace a no-op
      // wrapper around the observation instead: press, then sample via the
      // tracer's non-invasive sibling — the toggle is already in flight.
      const tracePromise = traceReadingLineThroughToggle(
        page,
        {
          frameSelector: format.frameSelector,
          trackSelector: format.trackSelector,
          markerRatio: format.markerRatio,
          align: format.align,
        },
        { activate: "none" },
      );
      // Give the probe its arm lead (see the activate option) — the rest
      // frames it pre-samples cost nothing.
      await page.waitForTimeout(400);
      await page.keyboard.press(key);
      const trace = await tracePromise;
      await page.waitForTimeout(700);
      console.log(
        `KEYTOGGLE ${format.id} ${leg} (${key === " " ? "Space" : key}): settle=${trace.settleDrift.toFixed(1)} excursion=${trace.excursion.toFixed(1)} pop=${trace.popScoreX.toFixed(2)}`,
      );
      if (SURVEY) console.log(`  profile(t/y/x): ${trace.profile}`);
      if (!SURVEY) {
        expect(
          Math.abs(trace.settleDrift),
          `${leg} via keyboard settled ${trace.settleDrift.toFixed(1)}px off the reading line`,
        ).toBeLessThanOrEqual(SETTLE_DRIFT_BUDGET_PX);
        expect(trace.excursion).toBeLessThanOrEqual(EXCURSION_BUDGET_PX);
        expect(
          trace.popScoreX,
          `${leg} via keyboard flew ${trace.popScoreX.toFixed(2)}x the plan's peak velocity — teleport-class\n  profile(t/y/x): ${trace.profile}`,
        ).toBeLessThanOrEqual(POP_SCORE_BUDGET);
      }

      // Focus survival: the trigger caused the toggle; it must still own
      // focus after the dust settles.
      const focusInfo = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        return {
          slot: active?.getAttribute?.("data-slot") ?? null,
          tag: active?.tagName ?? null,
        };
      });
      console.log(
        `KEYFOCUS ${format.id} ${leg}: activeElement slot=${focusInfo.slot} tag=${focusInfo.tag}`,
      );
      if (!SURVEY) {
        expect(
          focusInfo.slot,
          `focus escaped the trigger after a keyboard ${leg} (landed on ${focusInfo.tag})`,
        ).toBe("file-viewer-sidebar-trigger");
      }
    }
    sentinel.assertClean();
  });

  test(`${format.id} PageDown mid-flight is cleanly ignored or applied`, async ({
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

    const readScroll = () =>
      page.evaluate((frameSelector) => {
        const root = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-slot="file-viewer-root"]',
          ),
        ).find((candidate) => candidate.getBoundingClientRect().width > 0)!;
        const frame = root.querySelector<HTMLElement>(frameSelector);
        const scroller = Array.from(
          root.querySelectorAll<HTMLElement>("*"),
        ).find(
          (el) =>
            el.scrollHeight > el.clientHeight + 4 &&
            /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
            frame != null &&
            el.contains(frame),
        );
        return {
          top: scroller?.scrollTop ?? null,
          viewport: scroller?.clientHeight ?? 0,
        };
      }, format.frameSelector);

    const viewerRoot = page
      .locator('[data-slot="file-viewer-root"]:visible')
      .first();
    const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });

    // Baseline toggle without keyboard input.
    await trigger.click();
    await page.waitForTimeout(900);
    const baselineAfter = await readScroll();
    await trigger.click();
    await page.waitForTimeout(900);

    // Control: PageDown must scroll at rest, or the verdict is meaningless.
    await page.locator(format.frameSelector).first().click({ position: { x: 5, y: 5 } });
    const preKey = await readScroll();
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(500);
    const postKey = await readScroll();
    const keyDelta = (postKey.top ?? 0) - (preKey.top ?? 0);
    expect(
      keyDelta,
      "rest-state PageDown did not scroll — keyboard conflict probe invalid",
    ).toBeGreaterThan(50);
    await setViewerScroll(page, format.frameSelector, "half");
    await page.waitForTimeout(400);

    // Conflict: PageDown landing mid-flight.
    await trigger.click();
    await page.waitForTimeout(50);
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(1_100);
    const conflictAfter = await readScroll();

    const preserved =
      conflictAfter.top != null && baselineAfter.top != null
        ? conflictAfter.top - baselineAfter.top
        : null;
    console.log(
      `KEYCONFLICT ${format.id}: baseline=${baselineAfter.top} conflict=${conflictAfter.top} preserved=${preserved?.toFixed(1)} keyDelta=${keyDelta.toFixed(1)}`,
    );
    if (!SURVEY) {
      expect(preserved, "scroll state unreadable").not.toBeNull();
      const cleanlyIgnored = Math.abs(preserved!) <= KEY_IGNORED_TOLERANCE_PX;
      const cleanlyApplied = preserved! >= keyDelta * KEY_APPLIED_MIN_RATIO;
      expect(
        cleanlyIgnored || cleanlyApplied,
        `mid-flight PageDown neither ignored nor applied: ${preserved!.toFixed(1)}px vs a rest-state step of ${keyDelta.toFixed(1)}px`,
      ).toBe(true);
    }
  });
}
