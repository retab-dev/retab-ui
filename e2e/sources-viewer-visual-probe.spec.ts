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
test("document far edge decelerates into settle", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/examples/sources-viewer");

  await page.getByRole("tab", { name: "Image" }).click();
  await expect(
    page.locator('[data-slot="image-viewer-document"] canvas').first(),
  ).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1_500);

  const steps = await page.evaluate(async () => {
    const root = Array.from(
      document.querySelectorAll<HTMLElement>('[data-slot="file-viewer-root"]'),
    ).find((candidate) => candidate.getBoundingClientRect().width > 0);
    const trigger = root?.querySelector<HTMLButtonElement>(
      '[data-slot="file-viewer-sidebar-trigger"]',
    );
    const frame = root?.querySelector('[data-slot="image-frame"]');
    if (!root || !trigger || !frame) throw new Error("shell not found");

    const bottoms: number[] = [];
    trigger.click();
    for (let index = 0; index < 40; index += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      bottoms.push(frame.getBoundingClientRect().bottom);
    }
    return bottoms;
  });

  const deltas = steps
    .slice(1)
    .map((bottom, index) => Math.abs(bottom - steps[index]));
  const settleIndex = deltas.findLastIndex((delta) => delta > 0.5);
  expect(settleIndex, "motion never moved the frame").toBeGreaterThan(3);
  const terminalStep = deltas[settleIndex];
  expect(
    terminalStep,
    `far edge hit the settle at ${terminalStep.toFixed(1)}px/frame — the slide must decelerate into rest`,
  ).toBeLessThanOrEqual(10);
});
