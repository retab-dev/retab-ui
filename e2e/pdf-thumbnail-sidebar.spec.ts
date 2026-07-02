import { expect, test, type Locator, type Page } from "@playwright/test";

const DEMO_PATH = "/view/blocks/pdf-thumbnails";
const SCROLLED_PAGE = 8;
const CLICKED_PAGE = 12;

test("PDF thumbnail sidebar co-scrolls with the document and thumbnail clicks", async ({
  page,
}) => {
  await page.goto(DEMO_PATH);

  const viewerRoot = page.locator('[data-slot="file-viewer-root"]');
  const pdfViewer = viewerRoot.locator('[data-slot="pdf-viewer"]');
  const documentViewport = pdfViewer.locator(
    '[data-slot="scroll-area-viewport"]',
  );
  const thumbnailRail = viewerRoot.getByRole("navigation", {
    name: "PDF pages",
  });

  await expect(pdfViewer).toBeVisible();
  await expect(documentViewport).toBeVisible();
  await expect(thumbnailRail).toBeVisible();
  await expect(pdfPage(page, 1)).toBeVisible();

  await scrollDocumentToPage(page, documentViewport, SCROLLED_PAGE);
  await expectCurrentThumbnail(page, thumbnailRail, SCROLLED_PAGE);

  await thumbnailButton(thumbnailRail, CLICKED_PAGE).click();
  await page.mouse.move(900, 80);

  await expectVisiblePdfPage(page, CLICKED_PAGE);
  await expectCurrentThumbnail(page, thumbnailRail, CLICKED_PAGE);

  await thumbnailRail.focus();
  await page.keyboard.press("ArrowDown");
  await expectVisiblePdfPage(page, CLICKED_PAGE + 1);
  await expectCurrentThumbnail(page, thumbnailRail, CLICKED_PAGE + 1);

  await thumbnailRail.focus();
  await page.keyboard.press("Home");
  await expectVisiblePdfPage(page, 1);
  await expectCurrentThumbnail(page, thumbnailRail, 1);
});

test("PDF thumbnail sidebar toggles from the viewer header with pointer and keyboard", async ({
  page,
}) => {
  await page.goto(DEMO_PATH);

  const viewerRoot = page.locator('[data-slot="file-viewer-root"]');
  const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });
  const sidebar = viewerRoot.locator('[data-slot="file-viewer-sidebar"]');

  await expect(viewerRoot).toBeVisible();
  await expect(sidebar).toHaveAttribute("aria-label", "PDF pages");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
  await expect(sidebar).toHaveAttribute("inert", "");

  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar).not.toHaveAttribute("aria-hidden", "true");

  await trigger.focus();
  await page.keyboard.press("Space");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveAttribute("inert", "");
});

test("PDF thumbnail sidebar uses overlay dismissal on narrow viewports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 520, height: 760 });
  await page.goto(DEMO_PATH);

  const viewerRoot = page.locator('[data-slot="file-viewer-root"]');
  const trigger = viewerRoot.getByRole("button", { name: "Toggle sidebar" });
  const sidebar = viewerRoot.locator('[data-slot="file-viewer-sidebar"]');

  await expect(viewerRoot).toBeVisible();
  await expect(sidebar).toHaveAttribute(
    "data-file-viewer-sidebar-mode",
    "overlay",
  );
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await trigger.focus();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page.mouse.click(500, 740);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
});

async function scrollDocumentToPage(
  page: Page,
  documentViewport: Locator,
  pageNumber: number,
) {
  await page.evaluate((targetPageNumber) => {
    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
    );
    const firstPageSlot = document.querySelector<HTMLElement>(
      '[data-slot="pdf-page-slot"][data-page-number="1"]',
    );

    if (!viewport || !firstPageSlot) {
      throw new Error("The first PDF page is not mounted.");
    }

    const firstPage = firstPageSlot.querySelector<HTMLElement>(
      '[data-slot="pdf-page"]',
    );
    const pageHeight = firstPage?.offsetHeight ?? firstPageSlot.offsetHeight;
    const pageGap = 16;
    const targetTop =
      firstPageSlot.offsetTop + (targetPageNumber - 1) * (pageHeight + pageGap);

    viewport.scrollTo({ top: targetTop, behavior: "auto" });
  }, pageNumber);

  await documentViewport.dispatchEvent("scroll");
  await expectVisiblePdfPage(page, pageNumber);
}

async function expectVisiblePdfPage(page: Page, pageNumber: number) {
  await expect
    .poll(
      async () =>
        page.evaluate((targetPageNumber) => {
          const viewport = document.querySelector<HTMLElement>(
            '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
          );
          const pageElement = document.querySelector<HTMLElement>(
            `[data-slot="pdf-page"][data-page="${targetPageNumber}"]`,
          );

          if (!viewport || !pageElement) return false;

          const viewportRect = viewport.getBoundingClientRect();
          const pageRect = pageElement.getBoundingClientRect();

          return (
            pageRect.bottom > viewportRect.top + viewportRect.height * 0.2 &&
            pageRect.top < viewportRect.bottom - viewportRect.height * 0.2
          );
        }, pageNumber),
      { message: `page ${pageNumber} should be visible in the PDF document` },
    )
    .toBe(true);
}

async function expectCurrentThumbnail(
  page: Page,
  thumbnailRail: Locator,
  pageNumber: number,
) {
  const thumbnail = thumbnailButton(thumbnailRail, pageNumber);

  await expect(thumbnail).toHaveAttribute("aria-current", "page");
  await expect(thumbnail).not.toHaveAttribute("aria-selected", /.+/);
  await expect
    .poll(
      async () =>
        page.evaluate((targetPageNumber) => {
          const rail = document.querySelector<HTMLElement>(
            '[data-slot="pdf-viewer-thumbnails"]',
          );
          const thumbnail = document.querySelector<HTMLElement>(
            `[data-slot="pdf-viewer-thumbnails"] [data-page-number="${targetPageNumber}"]`,
          );

          if (!rail || !thumbnail) return false;

          const railRect = rail.getBoundingClientRect();
          const thumbnailRect = thumbnail.getBoundingClientRect();

          return (
            thumbnailRect.top >= railRect.top &&
            thumbnailRect.bottom <= railRect.bottom
          );
        }, pageNumber),
      {
        message: `page ${pageNumber} thumbnail should be visible in the rail`,
      },
    )
    .toBe(true);
}

function pdfPage(page: Page, pageNumber: number) {
  return page.locator(`[data-slot="pdf-page"][data-page="${pageNumber}"]`);
}

function thumbnailButton(thumbnailRail: Locator, pageNumber: number) {
  return thumbnailRail.getByRole("button", {
    name: `Page ${pageNumber}`,
    exact: true,
  });
}
