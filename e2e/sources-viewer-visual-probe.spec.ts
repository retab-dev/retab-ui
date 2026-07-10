import { expect, test } from "@playwright/test";

import {
  analyzeScreencastFrames,
  captureScreencastDuring,
  scoreScreencastMotion,
  type ScreencastRegion,
} from "./helpers/screencast-pixel-probe";

// The sources viewer keeps its sidebar on the RIGHT (420px), so the document
// pixels live on the left of the viewport in both toggle states.
const SOURCES_DOCUMENT_REGION: ScreencastRegion = {
  heightRatio: 0.62,
  leftRatio: 0.06,
  topRatio: 0.22,
  widthRatio: 0.5,
};

const MOTION_END_MS = 450;

test.describe("Sources Viewer pixel probe", () => {
  for (const format of [
    {
      name: "Image",
      readySelector: '[data-slot="image-viewer-document"] canvas',
    },
    {
      name: "DOCX",
      readySelector: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    },
  ] as const) {
    test(`${format.name} sidebar toggle keeps painted frames steady`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/examples/sources-viewer");

      await page.getByRole("tab", { name: format.name }).click();
      await expect(page.locator(format.readySelector).first()).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(1_500);

      const viewerRoot = page
        .locator('[data-slot="file-viewer-root"]:visible')
        .first();
      const trigger = viewerRoot.getByRole("button", {
        name: "Toggle sidebar",
      });
      await expect(trigger).toHaveAttribute("aria-expanded", "true");

      const failures: string[] = [];
      for (const action of ["close", "open"] as const) {
        const frames = await captureScreencastDuring(
          page,
          async () => {
            await trigger.click();
          },
          { settleMs: 1_600 },
        );
        expect(
          frames.length,
          `${action}: screencast captured too few frames`,
        ).toBeGreaterThan(2);

        const stats = await analyzeScreencastFrames(
          page,
          frames,
          SOURCES_DOCUMENT_REGION,
        );
        const verdict = scoreScreencastMotion(stats, {
          motionEndMs: MOTION_END_MS,
        });

        await test.info().attach(`${format.name}-${action}.json`, {
          body: JSON.stringify({ stats, verdict }, null, 2),
          contentType: "application/json",
        });
        failures.push(
          ...verdict.failures.map((failure) => `${action}: ${failure}`),
        );
        await page.waitForTimeout(600);
      }

      expect(failures, failures.join("\n")).toEqual([]);
    });
  }
});

// The pixel probe sees shimmer; this DOM gate sees the jolt. The document's
// far edge is where slide velocity peaks — under an eased motion its final
// per-frame step approaches zero, while a hard stop arrives at full speed
// (~28px/frame at this fixture's size before the kernel gained its ease-out).
//
// The sample axis is TIME, not rAF count. The close toggle rasters the image
// at its new committed scale synchronously at motion start; on a loaded
// runner that stall starves rAF until the time-based motion has already
// settled, and a frame-indexed gate reads a fully eased slide as "never
// moved" (CI run 29058597890: settleIndex=2; under 4x CPU throttle the first
// sample lands ~180ms after the click with the frame already at rest). A
// flight is scoreable only when the slide spanned enough real frames to
// expose its velocity profile — otherwise toggle again: attempts alternate
// direction, and every observable flight (either direction) must decelerate.
// Repro recipe: FAR_EDGE_CPU_THROTTLE=4 pnpm verify:sources-viewer-visual-blink
test("document far edge decelerates into settle", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/examples/sources-viewer");

  const throttleRate = Number(process.env.FAR_EDGE_CPU_THROTTLE ?? "");
  if (Number.isFinite(throttleRate) && throttleRate > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttleRate });
  }

  await page.getByRole("tab", { name: "Image" }).click();
  await expect(
    page.locator('[data-slot="image-viewer-document"] canvas').first(),
  ).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1_500);

  const measureToggleFlight = async () =>
    page.evaluate(async () => {
      const root = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-slot="file-viewer-root"]',
        ),
      ).find((candidate) => candidate.getBoundingClientRect().width > 0);
      const trigger = root?.querySelector<HTMLButtonElement>(
        '[data-slot="file-viewer-sidebar-trigger"]',
      );
      const frame = root?.querySelector('[data-slot="image-frame"]');
      if (!root || !trigger || !frame) throw new Error("shell not found");

      const nextFrame = () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      const readBottom = () => frame.getBoundingClientRect().bottom;

      // Rule 9: read the rest position to convergence, not after a fixed
      // wait — the prior attempt's slide may still be in flight.
      let stableFrames = 0;
      let previousBottom = readBottom();
      for (let index = 0; index < 240 && stableFrames < 10; index += 1) {
        await nextFrame();
        const bottom = readBottom();
        stableFrames = Math.abs(bottom - previousBottom) <= 0.1
          ? stableFrames + 1
          : 0;
        previousBottom = bottom;
      }

      const startBottom = readBottom();
      const samples: Array<{ t: number; bottom: number }> = [];
      const start = performance.now();
      trigger.click();
      for (let index = 0; index < 40; index += 1) {
        await nextFrame();
        samples.push({ t: performance.now() - start, bottom: readBottom() });
      }
      return { startBottom, samples };
    });

  const scoreFlight = (flight: {
    startBottom: number;
    samples: Array<{ t: number; bottom: number }>;
  }) => {
    const bottoms = [
      flight.startBottom,
      ...flight.samples.map((sample) => sample.bottom),
    ];
    const times = [0, ...flight.samples.map((sample) => sample.t)];
    const deltas = bottoms
      .slice(1)
      .map((bottom, index) => Math.abs(bottom - bottoms[index]));
    const settleIndex = deltas.findLastIndex((delta) => delta > 0.5);
    const moved = settleIndex >= 0;
    const terminalStep = moved ? deltas[settleIndex] : 0;
    const terminalGap = moved
      ? Math.max(8, times[settleIndex + 1] - times[settleIndex])
      : 0;
    // Normalize the terminal step to px per 16.7ms frame: near the settle
    // the runner recurrently stretches a rAF gap to ~65ms, and the raw step
    // across it would compare distance-over-65ms against a per-frame budget.
    // An eased arrival averages under 1px/frame across any terminal gap; a
    // hard stop holds full slide velocity regardless of gap length.
    const terminalVelocity = moved
      ? (terminalStep * (50 / 3)) / terminalGap
      : 0;
    // Scoreable = at least four moving samples preceded the settle; a
    // starved run averages the whole flight into one gap and can prove
    // nothing about deceleration. EXCEPT: a collapse inside a frame-length
    // gap is not starvation — the time-based motion cannot complete in one
    // 16ms frame, so that is a genuine teleport and must stay scoreable
    // (its terminal velocity then fails the gate) rather than read as an
    // unobservable flight and get tolerated.
    const observable = settleIndex > 3 || (moved && terminalGap <= 32);
    return { moved, observable, settleIndex, terminalStep, terminalGap, terminalVelocity };
  };

  const attempts: Array<ReturnType<typeof scoreFlight>> = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const score = scoreFlight(await measureToggleFlight());
    attempts.push(score);
    expect(
      score.moved,
      `toggle ${attempt}: motion never moved the frame`,
    ).toBe(true);
    if (score.observable && attempt >= 1) break;
  }

  const observableFlights = attempts.filter((attempt) => attempt.observable);
  const attemptLog = attempts
    .map(
      (attempt, index) =>
        `toggle ${index}: settleIndex=${attempt.settleIndex} terminalStep=${attempt.terminalStep.toFixed(1)}px terminalGap=${attempt.terminalGap.toFixed(0)}ms terminalVelocity=${attempt.terminalVelocity.toFixed(1)}px/frame observable=${attempt.observable}`,
    )
    .join("\n");
  if (observableFlights.length === 0 && process.env.CI) {
    // Every flight collapsed into starved rAF gaps — this runner cannot
    // observe the velocity profile at all. Tolerated on CI (the screencast
    // gates above still verify the destination); fully strict locally.
    console.warn(
      `[far-edge] flight path unobservable under load; tolerated on CI\n${attemptLog}`,
    );
    return;
  }
  expect(
    observableFlights.length,
    `flight path unobservable across ${attempts.length} toggles (rAF starved during the slide)\n${attemptLog}`,
  ).toBeGreaterThan(0);
  for (const flight of observableFlights) {
    expect(
      flight.terminalVelocity,
      `far edge hit the settle at ${flight.terminalVelocity.toFixed(1)}px/frame — the slide must decelerate into rest\n${attemptLog}`,
    ).toBeLessThanOrEqual(10);
  }
});
