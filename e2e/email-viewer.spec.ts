import { expect, test } from "@playwright/test";

test("email viewer sidebar exposes body and attachments and toggles", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.url()} ${request.failure()?.errorText ?? "failed"}`,
    );
  });

  await page.goto("/email-viewer");

  const viewer = page.locator('[data-slot="email-viewer"]').first();
  const sidebar = viewer.locator(
    '[data-slot="viewer-sidebar"][aria-label="Email parts"]',
  );
  const trigger = viewer.getByRole("button", { name: "Toggle sidebar" });

  await expect(viewer).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("heading", { name: "Body" })).toBeVisible();
  await expect(
    sidebar.getByRole("heading", { name: "Attachments" }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: /spacex-prospectus\.pdf/i }),
  ).toBeVisible();
  const sidebarBackground = await sidebar.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(sidebarBackground).toMatch(/^(rgb\(255, 255, 255\)|lab\(100 0 0\))$/);

  const thumbnails = sidebar.locator('[data-slot="file-thumbnail"]');
  await expect(thumbnails.first()).toBeVisible();
  const thumbnailBox = await thumbnails.first().boundingBox();
  expect(thumbnailBox).not.toBeNull();
  expect(Math.abs(thumbnailBox!.width - thumbnailBox!.height)).toBeLessThan(1);

  const bodyButtonBox = await sidebar
    .getByRole("button", { name: /Body text\/html/i })
    .boundingBox();
  const attachmentButtonBox = await sidebar
    .getByRole("button", { name: /spacex-prospectus\.pdf/i })
    .boundingBox();
  expect(bodyButtonBox).not.toBeNull();
  expect(attachmentButtonBox).not.toBeNull();
  expect(Math.abs(bodyButtonBox!.x - attachmentButtonBox!.x)).toBeLessThan(1);

  const viewerScreenshot = await viewer.screenshot();
  expect(viewerScreenshot.byteLength).toBeGreaterThan(10_000);

  await sidebar.getByRole("button", { name: /review-note\.html/i }).click();
  await expect(viewer.locator('[data-slot="email-part-header"]')).toHaveCount(
    0,
  );
  const iframeSrcdocs = await viewer
    .locator("iframe")
    .evaluateAll((iframes) =>
      iframes.map((iframe) => iframe.getAttribute("srcdoc") ?? ""),
    );
  expect(iframeSrcdocs.every((srcdoc) => !srcdoc.includes("cid:"))).toBe(true);
  const surface = viewer.locator('[data-slot="viewer-surface"]').first();
  const surfaceBox = await surface.boundingBox();
  const fileViewerBox = await surface
    .locator('[data-slot="file-viewer"]')
    .boundingBox();
  expect(surfaceBox).not.toBeNull();
  expect(fileViewerBox).not.toBeNull();
  expect(fileViewerBox!.width).toBeGreaterThan(surfaceBox!.width * 0.9);

  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar).not.toHaveAttribute("aria-hidden", "true");

  await page.setViewportSize({ width: 390, height: 760 });
  await expect(viewer).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Toggle sidebar" }),
  ).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
