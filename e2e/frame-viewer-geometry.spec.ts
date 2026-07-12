import { expect, test } from "@playwright/test";

const OCR_ROOT = '[data-layout-blocks=""]';
const PDF_SKELETON = `${OCR_ROOT} [data-slot="pdf-page-skeleton"]`;
const PDF_PAGE = `${OCR_ROOT} [data-slot="pdf-page"][data-page="1"]`;
const PDF_PAGE_CANVAS = `${PDF_PAGE} canvas[data-pdf-render-status="rendered"]`;
const PDF_VISUAL_CLIP = `${OCR_ROOT} [data-slot="pdf-viewer-visual-clip"]`;
const GEOMETRY_TOLERANCE_PX = 0.75;
const PAGE_RING_OUTSET_PX = 1;

const FRAME_FIXTURES = [
  {
    label: "Image",
    loaded: '[data-slot="image-frame"][data-frame-number="1"]',
    resource: "/samples/an-image-is-worth-16x16-words-page-1.png",
    skeleton: '[data-slot="image-frame-skeleton"]',
  },
  {
    label: "PPTX",
    loaded: '[data-slot="pptx-slide"][data-slide-number="1"]',
    resource: "/samples/sample-presentation.pptx",
    skeleton: '[data-slot="pptx-slide-skeleton"]',
  },
  {
    label: "DOCX",
    loaded: '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    resource: "/samples/quarterly-business-review.docx",
    skeleton: '[data-slot="docx-page-skeleton"]',
  },
] as const;

test("OCR PDF keeps the loaded page inside the exact skeleton frame", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    const readBlob = Blob.prototype.arrayBuffer;
    let releasePdf: (() => void) | null = null;
    const pdfGate = new Promise<void>((resolve) => {
      releasePdf = resolve;
    });

    Object.defineProperty(window, "__releaseFrameGeometryPdf", {
      configurable: true,
      value: () => releasePdf?.(),
    });
    Blob.prototype.arrayBuffer = function arrayBuffer() {
      return this.type === "application/pdf"
        ? pdfGate.then(() => readBlob.call(this))
        : readBlob.call(this);
    };
  });

  await page.goto("/examples/ocr");
  const skeleton = page.locator(PDF_SKELETON);
  await expect(skeleton).toBeVisible({ timeout: 60_000 });
  const skeletonRect = requiredRect(await skeleton.boundingBox(), "skeleton");

  await page.evaluate(() => {
    (
      window as typeof window & {
        __releaseFrameGeometryPdf?: () => void;
      }
    ).__releaseFrameGeometryPdf?.();
  });

  await expect(page.locator(PDF_PAGE_CANVAS)).toBeVisible({ timeout: 60_000 });
  const loadedRect = requiredRect(
    await page.locator(PDF_PAGE).boundingBox(),
    "loaded page",
  );
  const clipRect = requiredRect(
    await page.locator(PDF_VISUAL_CLIP).boundingBox(),
    "visual clip",
  );
  const pageBoxShadow = await page
    .locator(PDF_PAGE)
    .evaluate((element) => getComputedStyle(element).boxShadow);
  const geometry = { clipRect, loadedRect, pageBoxShadow, skeletonRect };
  await testInfo.attach("frame-geometry.json", {
    body: JSON.stringify(geometry, null, 2),
    contentType: "application/json",
  });

  for (const axis of ["x", "y", "width", "height"] as const) {
    expect(
      Math.abs(loadedRect[axis] - skeletonRect[axis]),
      `${axis}: loaded=${loadedRect[axis]}, skeleton=${skeletonRect[axis]}`,
    ).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
  }
  expect(clipRect.x).toBeLessThanOrEqual(loadedRect.x - PAGE_RING_OUTSET_PX);
  expect(clipRect.x + clipRect.width).toBeGreaterThanOrEqual(
    loadedRect.x + loadedRect.width + PAGE_RING_OUTSET_PX,
  );
  expect(pageBoxShadow).not.toBe("none");
});

for (const fixture of FRAME_FIXTURES) {
  test(`${fixture.label} keeps the loaded frame inside the exact skeleton frame`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });

    let releaseResource = () => {};
    let markResourceSeen = () => {};
    const resourceGate = new Promise<void>((resolve) => {
      releaseResource = resolve;
    });
    const resourceSeen = new Promise<void>((resolve) => {
      markResourceSeen = resolve;
    });
    await page.route(`**${fixture.resource}`, async (route) => {
      markResourceSeen();
      await resourceGate;
      await route.continue();
    });

    await page.goto("/view/file-viewer-sidebar-benchmark");
    await page
      .getByRole("button", { name: fixture.label, exact: true })
      .click();
    await resourceSeen;

    const skeleton = page.locator(fixture.skeleton);
    await expect(skeleton).toBeVisible({ timeout: 60_000 });
    const skeletonRect = requiredRect(
      await skeleton.boundingBox(),
      `${fixture.label} skeleton`,
    );

    releaseResource();

    const loaded = page.locator(fixture.loaded).first();
    await expect(loaded).toBeVisible({ timeout: 60_000 });
    const loadedRect = requiredRect(
      await loaded.boundingBox(),
      `${fixture.label} loaded frame`,
    );
    const boxShadow = await loaded.evaluate(
      (element) => getComputedStyle(element).boxShadow,
    );
    const geometry = { boxShadow, loadedRect, skeletonRect };
    await testInfo.attach(
      `${fixture.label.toLowerCase()}-frame-geometry.json`,
      {
        body: JSON.stringify(geometry, null, 2),
        contentType: "application/json",
      },
    );

    expectMatchingFrame(skeletonRect, loadedRect);
    expect(boxShadow).not.toBe("none");
  });
}

function expectMatchingFrame(
  skeletonRect: { x: number; y: number; width: number; height: number },
  loadedRect: { x: number; y: number; width: number; height: number },
) {
  for (const axis of ["x", "y", "width", "height"] as const) {
    expect(
      Math.abs(loadedRect[axis] - skeletonRect[axis]),
      `${axis}: loaded=${loadedRect[axis]}, skeleton=${skeletonRect[axis]}`,
    ).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
  }
}

function requiredRect(
  rect: { x: number; y: number; width: number; height: number } | null,
  label: string,
) {
  if (!rect) throw new Error(`${label} has no rendered rectangle.`);
  return rect;
}
