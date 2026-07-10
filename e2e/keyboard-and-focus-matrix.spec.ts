import { expect, test } from "@playwright/test";

import {
  installConsoleSentinel,
  setViewerScroll,
  traceReadingLineThroughToggle,
} from "./helpers/reading-line-trace";

// Keyboard is the input modality no other gate exercises, and focus and
// selection are the state no geometry probe can see. Four anomaly classes:
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
// - SELECTION SURVIVAL: a text selection in the document must survive the
//   toggle — a remount silently destroys ranges, and the reading-line
//   probes cannot see it.
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
  // The text-family renderers: start-aligned virtual canvases, and the
  // richest selection targets (real text under the cursor everywhere).
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

  test(`${format.id} text selection survives a toggle`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.locator(`[data-benchmark-format-option="${format.id}"]`).click();
    await expect(page.locator(format.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);
    await setViewerScroll(page, format.frameSelector, "quarter");
    await page.waitForTimeout(600);

    // Select a word in the document (dblclick), snapshot the selected text.
    const target = page.locator(format.trackSelector).first();
    await target.dblclick({ position: { x: 200, y: 120 } });
    await page.waitForTimeout(200);
    const before = await page.evaluate(
      () => window.getSelection()?.toString() ?? "",
    );
    // The image canvas has no selectable text — the invariant is vacuous
    // there; only score formats where a selection actually took.
    test.skip(
      before.trim().length === 0,
      "no selectable text at the probe point",
    );

    const viewerRoot = page
      .locator('[data-slot="file-viewer-root"]:visible')
      .first();
    const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });
    await trigger.click();
    await page.waitForTimeout(900);
    const afterClose = await page.evaluate(
      () => window.getSelection()?.toString() ?? "",
    );
    await trigger.click();
    await page.waitForTimeout(900);
    const afterOpen = await page.evaluate(
      () => window.getSelection()?.toString() ?? "",
    );

    console.log(
      `SELECTION ${format.id}: before=${JSON.stringify(before.slice(0, 40))} afterClose=${JSON.stringify(afterClose.slice(0, 40))} afterOpen=${JSON.stringify(afterOpen.slice(0, 40))}`,
    );
    if (!SURVEY) {
      expect(
        afterClose,
        "selection destroyed by the close toggle",
      ).toBe(before);
      expect(afterOpen, "selection destroyed by the open toggle").toBe(before);
    }
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
        // Pierce shadow roots — the csv/xlsx grids host their scroller
        // inside a style-isolation shadow scope where querySelectorAll
        // cannot see it.
        const collect = (node: ParentNode): HTMLElement[] =>
          Array.from(node.querySelectorAll<HTMLElement>("*")).flatMap((el) =>
            el.shadowRoot ? [el, ...collect(el.shadowRoot)] : [el],
          );
        const everything = collect(root);
        const frame =
          everything.find((el) => el.matches(frameSelector)) ?? null;
        const scroller = everything.find(
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

    // Every format has a native scroller (the text family scrolls a
    // scroll-area viewport that arms tabindex=0 once content overflows;
    // the csv/xlsx grids scroll an overflow-auto viewport inside their
    // shadow scope). But a sample that fits the pane never overflows —
    // there is nothing to scroll and the conflict contract is vacuous
    // (today: the 5-line text sample). Skip loudly, not pass.
    const hasOverflowingScroller = (await readScroll()).top != null;
    test.skip(
      !hasOverflowingScroller,
      "document does not overflow the pane — nothing to keyboard-scroll",
    );

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

// The grid renderers (csv, xlsx) scroll a native overflow-auto viewport
// hosted inside a style-isolation shadow scope. Keyboard users must be
// able to reach that viewport with Tab (tabindex=0 — the pane holds no
// other guaranteed tab stop) and drive it with PageDown/End/Home. This
// caught csv shipping its viewport with no tabindex: mouse users could
// click-then-PageDown (the click sets the browser's scroll target), but
// keyboard-only users had no way in.
const GRID_FORMATS = [
  { id: "csv", viewportSlot: "csv-body", ready: '[data-slot="csv-cell"]' },
  {
    id: "xlsx",
    viewportSlot: "xlsx-body",
    ready: '[data-slot="xlsx-row-window"]',
  },
] as const;

for (const format of GRID_FORMATS) {
  test(`${format.id} grid viewport is keyboard-reachable and key-scrollable`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page.locator(`[data-benchmark-format-option="${format.id}"]`).click();
    // Playwright locators pierce shadow roots; the evaluate probes below
    // must walk shadowRoot boundaries by hand.
    await expect(page.locator(format.ready).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_500);

    const readViewport = () =>
      page.evaluate((viewportSlot) => {
        const collect = (node: ParentNode): HTMLElement[] =>
          Array.from(node.querySelectorAll<HTMLElement>("*")).flatMap((el) =>
            el.shadowRoot ? [el, ...collect(el.shadowRoot)] : [el],
          );
        const viewport = collect(document).find(
          (el) => el.getAttribute("data-slot") === viewportSlot,
        );
        if (!viewport) return null;
        const active = (() => {
          let current: Element | null = document.activeElement;
          while (current?.shadowRoot?.activeElement) {
            current = current.shadowRoot.activeElement;
          }
          return current;
        })();
        return {
          tabindex: viewport.getAttribute("tabindex"),
          top: viewport.scrollTop,
          max: viewport.scrollHeight - viewport.clientHeight,
          viewportHeight: viewport.clientHeight,
          hasFocus: active === viewport,
        };
      }, format.viewportSlot);

    const initial = await readViewport();
    expect(initial, "grid viewport not found").not.toBeNull();
    console.log(`GRIDKEY ${format.id} initial:`, JSON.stringify(initial));
    expect(
      initial!.tabindex,
      "grid viewport is not Tab-reachable (tabindex must be 0)",
    ).toBe("0");
    expect(
      initial!.max,
      "sample does not overflow the pane — keyboard-scroll probe invalid",
    ).toBeGreaterThan(50);

    // Reach the pane by keyboard alone: focus it, then drive with keys.
    await page.evaluate((viewportSlot) => {
      const collect = (node: ParentNode): HTMLElement[] =>
        Array.from(node.querySelectorAll<HTMLElement>("*")).flatMap((el) =>
          el.shadowRoot ? [el, ...collect(el.shadowRoot)] : [el],
        );
      collect(document)
        .find((el) => el.getAttribute("data-slot") === viewportSlot)
        ?.focus();
    }, format.viewportSlot);
    const focused = await readViewport();
    expect(focused!.hasFocus, "grid viewport did not take focus").toBe(true);

    await page.keyboard.press("PageDown");
    await page.waitForTimeout(400);
    const afterPageDown = await readViewport();
    await page.keyboard.press("End");
    await page.waitForTimeout(400);
    const afterEnd = await readViewport();
    await page.keyboard.press("Home");
    await page.waitForTimeout(400);
    const afterHome = await readViewport();

    console.log(
      `GRIDKEY ${format.id}: pageDown=${afterPageDown!.top} end=${afterEnd!.top}/${afterEnd!.max} home=${afterHome!.top}`,
    );
    if (!SURVEY) {
      expect(
        afterPageDown!.top,
        "PageDown did not scroll the focused grid viewport",
      ).toBeGreaterThan(50);
      expect(
        afterEnd!.top,
        "End did not reach the bottom of the grid",
      ).toBeGreaterThanOrEqual(afterEnd!.max - 4);
      expect(
        afterHome!.top,
        "Home did not return to the top of the grid",
      ).toBeLessThanOrEqual(4);
    }
  });
}
