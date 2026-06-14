import { expect, test, type Locator, type Page } from "@playwright/test"

const DEMO_PATH = "/view/blocks/pdf-thumbnails"
const SCROLLED_PAGE = 8
const CLICKED_PAGE = 12

test("PDF thumbnail sidebar co-scrolls with the document and thumbnail clicks", async ({
  page,
}) => {
  await page.goto(DEMO_PATH)

  const viewer = page.locator('[data-slot="pdf-viewer"]')
  const documentViewport = viewer.locator('[data-slot="scroll-area-viewport"]')
  const thumbnailRail = page.getByRole("navigation", { name: "PDF pages" })

  await expect(viewer).toBeVisible()
  await expect(documentViewport).toBeVisible()
  await expect(thumbnailRail).toBeVisible()
  await expect(pdfPage(page, 1)).toBeVisible()

  await scrollDocumentToPage(page, documentViewport, SCROLLED_PAGE)
  await expectCurrentThumbnail(page, thumbnailRail, SCROLLED_PAGE)

  await thumbnailButton(thumbnailRail, CLICKED_PAGE).click()
  await page.mouse.move(900, 80)

  await expectVisiblePdfPage(page, CLICKED_PAGE)
  await expectCurrentThumbnail(page, thumbnailRail, CLICKED_PAGE)
})

async function scrollDocumentToPage(
  page: Page,
  documentViewport: Locator,
  pageNumber: number
) {
  await page.evaluate((targetPageNumber) => {
    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]'
    )
    const firstPageSlot = document.querySelector<HTMLElement>(
      '[data-slot="pdf-page-slot"][data-page-number="1"]'
    )

    if (!viewport || !firstPageSlot) {
      throw new Error("The first PDF page is not mounted.")
    }

    const firstPage = firstPageSlot.querySelector<HTMLElement>(
      '[data-slot="pdf-page"]'
    )
    const pageHeight = firstPage?.offsetHeight ?? firstPageSlot.offsetHeight
    const pageGap = 16
    const targetTop =
      firstPageSlot.offsetTop + (targetPageNumber - 1) * (pageHeight + pageGap)

    viewport.scrollTo({ top: targetTop, behavior: "auto" })
  }, pageNumber)

  await documentViewport.dispatchEvent("scroll")
  await expectVisiblePdfPage(page, pageNumber)
}

async function expectVisiblePdfPage(page: Page, pageNumber: number) {
  await expect
    .poll(
      async () =>
        page.evaluate((targetPageNumber) => {
          const viewport = document.querySelector<HTMLElement>(
            '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]'
          )
          const pageElement = document.querySelector<HTMLElement>(
            `[data-slot="pdf-page"][data-page="${targetPageNumber}"]`
          )

          if (!viewport || !pageElement) return false

          const viewportRect = viewport.getBoundingClientRect()
          const pageRect = pageElement.getBoundingClientRect()

          return (
            pageRect.bottom > viewportRect.top + viewportRect.height * 0.2 &&
            pageRect.top < viewportRect.bottom - viewportRect.height * 0.2
          )
        }, pageNumber),
      { message: `page ${pageNumber} should be visible in the PDF document` }
    )
    .toBe(true)
}

async function expectCurrentThumbnail(
  page: Page,
  thumbnailRail: Locator,
  pageNumber: number
) {
  const thumbnail = thumbnailButton(thumbnailRail, pageNumber)

  await expect(thumbnail).toHaveAttribute("aria-current", "page")
  await expect(thumbnail).not.toHaveAttribute("aria-selected", /.+/)
  await expect
    .poll(
      async () =>
        page.evaluate((targetPageNumber) => {
          const rail = document.querySelector<HTMLElement>(
            '[data-slot="pdf-viewer-thumbnails"]'
          )
          const thumbnail = document.querySelector<HTMLElement>(
            `[data-slot="pdf-viewer-thumbnails"] [data-page-number="${targetPageNumber}"]`
          )

          if (!rail || !thumbnail) return false

          const railRect = rail.getBoundingClientRect()
          const thumbnailRect = thumbnail.getBoundingClientRect()

          return (
            thumbnailRect.top >= railRect.top &&
            thumbnailRect.bottom <= railRect.bottom
          )
        }, pageNumber),
      {
        message: `page ${pageNumber} thumbnail should be visible in the rail`,
      }
    )
    .toBe(true)
}

function pdfPage(page: Page, pageNumber: number) {
  return page.locator(`[data-slot="pdf-page"][data-page="${pageNumber}"]`)
}

function thumbnailButton(thumbnailRail: Locator, pageNumber: number) {
  return thumbnailRail.getByRole("button", { name: `Page ${pageNumber}` })
}
