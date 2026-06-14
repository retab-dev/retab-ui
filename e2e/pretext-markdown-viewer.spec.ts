import { expect, test, type Locator } from "@playwright/test"

const PRETEXT_MARKDOWN_VIEW_PATH = "/view/pretext-markdown-viewer"

test("pretext markdown docs demo renders as one continuous virtual document", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  await page.goto(PRETEXT_MARKDOWN_VIEW_PATH)

  const viewer = page.locator('[data-slot="text-viewer"]').first()
  const viewport = viewer.locator('[data-slot="scroll-area-viewport"]').first()
  const canvas = viewer
    .locator('[data-slot="pretext-markdown-virtual-canvas"]')
    .first()

  await expect(viewer).toBeVisible()
  await expect(canvas).toBeVisible()
  await expect(
    viewer.getByRole("heading", { name: "Current Surface" })
  ).toBeVisible()
  await expect(viewer.getByText("Page 1 of")).toHaveCount(0)
  await expect(viewer.locator("[data-pretext-markdown-page]")).toHaveCount(0)
  await expect(
    viewer.locator('[data-slot="pretext-markdown-empty-state"]')
  ).toHaveCount(0)

  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)

  const initialScrollTop = await viewport.evaluate(
    (element) => element.scrollTop
  )
  expect(initialScrollTop).toBeLessThan(80)

  await viewport.evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight * 0.55, behavior: "auto" })
  })

  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(500)
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)
  await expect(viewer.getByText("Page 1 of")).toHaveCount(0)

  const settledScrollTop = await viewport.evaluate(
    (element) => element.scrollTop
  )
  await page.waitForTimeout(300)
  await expect
    .poll(async () =>
      Math.abs(
        (await viewport.evaluate((element) => element.scrollTop)) -
          settledScrollTop
      )
    )
    .toBeLessThan(3)

  await viewer.getByRole("button", { name: "Text" }).click()
  await expect(
    viewer.getByRole("region", { name: "Markdown source" })
  ).toBeVisible()

  await viewer.getByRole("button", { name: "Rendered" }).click()
  await expect(canvas).toBeVisible()
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)

  expect(consoleErrors).toEqual([])
})

async function mountedChunkCount(viewer: Locator) {
  return viewer.locator("[data-pretext-markdown-chunk]").count()
}

async function hasDocumentHorizontalOverflow(viewport: Locator) {
  return viewport.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 2
  )
}
