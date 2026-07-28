import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 965, height: 474 } });

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
  test(`${format.name} content stays inside the telemetry motion corridor`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/examples/sources-viewer");
    await page.getByRole("tab", { name: format.name }).click();
    await expect(page.locator(format.readySelector).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1_000);

    const result = await page.evaluate(async () => {
      return window.__fileViewerMotionTelemetry?.run({ settleFrameCount: 8 });
    });

    expect(result).not.toBeNull();
    const contentOvershoot = result?.metrics.find(
      (metric) => metric.id === "content-overshoot",
    );
    // Budget, not pixel-exact zero: the document surface centres itself with
    // auto margins, and the browser resolves half the free space in layout
    // units (1/64px) while the motion model resolves it in floats. That
    // quantization leaves a ~0.01px residual — two orders of magnitude below
    // the corridor and invisible; a real wobble is >= 1px.
    expect(contentOvershoot).toMatchObject({ passed: true });
    expect(result?.status, JSON.stringify(result?.metrics, null, 2)).toBe(
      "passed",
    );
  });
}
