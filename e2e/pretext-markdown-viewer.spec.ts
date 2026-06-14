import { expect, test, type Locator, type Page } from "@playwright/test"

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
  await expectMarkdownLinkPolicy(viewer)

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

  await viewport.evaluate((element) => {
    element.scrollTo({ top: 0, behavior: "auto" })
  })
  await viewer.getByRole("link", { name: "local fragment link" }).click()
  await expect(page).toHaveURL(/#release-readiness-matrix$/)
  await expect(
    viewer.getByRole("heading", { name: "Release Readiness Matrix" })
  ).toBeVisible()
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(300)
  await expect(viewer.getByText("Page 1 of")).toHaveCount(0)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)

  await page.evaluate(() => window.history.back())
  await expect(page).toHaveURL(new RegExp(`${PRETEXT_MARKDOWN_VIEW_PATH}$`))
  await page.evaluate(() => window.history.forward())
  await expect(page).toHaveURL(/#release-readiness-matrix$/)
  await expect(
    viewer.getByRole("heading", { name: "Release Readiness Matrix" })
  ).toBeVisible()

  await page.goto(`${PRETEXT_MARKDOWN_VIEW_PATH}#raw-html-policy`)
  await expect(
    viewer.getByRole("heading", { name: "Raw HTML Policy" })
  ).toBeVisible()
  await viewer.getByText("Open raw HTML details").click()
  await expectRawHtmlLinkPolicy(viewer)
  await expect(viewer.getByText("Page 1 of")).toHaveCount(0)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)

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

  await viewer.getByRole("button", { name: "Text", exact: true }).click()
  await expect(
    viewer.getByRole("region", { name: "Markdown source" })
  ).toBeVisible()

  await viewer.getByRole("button", { name: "Rendered", exact: true }).click()
  await expect(canvas).toBeVisible()
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)

  expect(consoleErrors).toEqual([])
})

test("pretext markdown docs demo resolves initial hash fragments inside the virtual viewport", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  await page.goto(`${PRETEXT_MARKDOWN_VIEW_PATH}#release-readiness-matrix`)

  const viewer = page.locator('[data-slot="text-viewer"]').first()
  const viewport = viewer.locator('[data-slot="scroll-area-viewport"]').first()

  await expect(
    viewer.getByRole("heading", { name: "Release Readiness Matrix" })
  ).toBeVisible()
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(300)
  await expect(viewer.getByText("Page 1 of")).toHaveCount(0)
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)
  expect(consoleErrors).toEqual([])
})

test("pretext markdown docs demo resolves footnote refs and backrefs inside the virtual viewport", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page)

  await page.goto(PRETEXT_MARKDOWN_VIEW_PATH)

  const viewer = page.locator('[data-slot="text-viewer"]').first()
  const viewport = viewer.locator('[data-slot="scroll-area-viewport"]').first()
  const reference = viewer.getByRole("link", { name: "Footnote 1" }).first()

  await expect(reference).toHaveAttribute(
    "href",
    /^#(?:user-content-)?fn-overview$/
  )
  await reference.click()
  await expect(page).toHaveURL(/#(?:user-content-)?fn-overview$/)
  await expect(viewer.getByRole("region", { name: "Footnotes" })).toBeVisible()

  const backref = viewer
    .getByRole("link", { name: /Back to footnote reference/ })
    .first()
  await expect(backref).toHaveAttribute(
    "href",
    /^#(?:user-content-)?fnref-overview$/
  )
  await backref.click()
  await expect(page).toHaveURL(/#(?:user-content-)?fnref-overview$/)
  await expect(reference).toBeVisible()
  await expect(viewer.getByText("Page 1 of")).toHaveCount(0)
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)
  expect(consoleErrors).toEqual([])
})

test("pretext markdown docs demo exposes source highlights in rendered and text modes", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page)

  await page.goto(PRETEXT_MARKDOWN_VIEW_PATH)

  const viewer = page.locator('[data-slot="text-viewer"]').first()
  const viewport = viewer.locator('[data-slot="scroll-area-viewport"]').first()
  const highlightedChunk = viewer.getByRole("region", {
    name: "Highlighted source lines 7-7",
  })

  await expect(highlightedChunk).toBeVisible()
  await expect(highlightedChunk).toHaveAttribute(
    "data-pretext-markdown-highlighted",
    ""
  )
  await expect(highlightedChunk).toHaveAttribute(
    "data-source-highlight-start",
    "7"
  )
  await expect(highlightedChunk).toHaveAttribute(
    "data-source-highlight-end",
    "7"
  )

  await viewer.getByRole("button", { name: "Text", exact: true }).click()

  const source = viewer.getByRole("region", { name: "Markdown source" })
  const highlightedLine = source.locator('[data-source-line="7"]')

  await expect(source).toBeVisible()
  await expect(highlightedLine).toBeVisible()
  await expect(
    highlightedLine.locator("[data-source-line-content]")
  ).toContainText("Inline Markdown includes")
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)
  expect(consoleErrors).toEqual([])
})

test("pretext markdown docs demo keeps scroll stable as rich blocks settle", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page)

  await page.goto(`${PRETEXT_MARKDOWN_VIEW_PATH}#diagrams`)

  const viewer = page.locator('[data-slot="text-viewer"]').first()
  const viewport = viewer.locator('[data-slot="scroll-area-viewport"]').first()
  const diagrams = viewer.locator('[data-diagram-language="mermaid"]')

  await expect(viewer.getByRole("heading", { name: "Diagrams" })).toBeVisible()
  await expect(diagrams.first()).toBeVisible()
  const diagramScrollTop = await viewport.evaluate(
    (element) => element.scrollTop
  )

  await expect.poll(() => settledMermaidDiagramCount(viewer)).toBeGreaterThan(1)
  await page.waitForTimeout(300)
  await expect
    .poll(() => scrollTopDelta(viewport, diagramScrollTop))
    .toBeLessThan(8)
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)

  await page.goto(`${PRETEXT_MARKDOWN_VIEW_PATH}#media`)

  await expect(viewer.getByRole("heading", { name: "Media" })).toBeVisible()
  await expect(
    viewer.locator('[data-pretext-image-state="blocked"]').first()
  ).toBeVisible()
  const imageScrollTop = await viewport.evaluate((element) => element.scrollTop)
  await expect(
    viewer.locator('[data-pretext-image-state="ready"]').first()
  ).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(300)
  await expect
    .poll(() => scrollTopDelta(viewport, imageScrollTop))
    .toBeLessThan(8)
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)
  expect(consoleErrors).toEqual([])
})

test("pretext markdown docs demo stays continuous on a narrow mobile viewport", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto(PRETEXT_MARKDOWN_VIEW_PATH)

  const viewer = page.locator('[data-slot="text-viewer"]').first()
  const viewport = viewer.locator('[data-slot="scroll-area-viewport"]').first()

  await expect(viewer).toBeVisible()
  await expect(
    viewer.getByRole("heading", { name: "Pretext Markdown Viewer" })
  ).toBeVisible()
  await expect(viewer.getByText("Page 1 of")).toHaveCount(0)
  await expect(viewer.locator("[data-pretext-markdown-page]")).toHaveCount(0)
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)
  await expect.poll(() => hasPageHorizontalOverflow(page)).toBe(false)

  await viewport.evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight * 0.45, behavior: "auto" })
  })
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(400)
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)
  await expect.poll(() => hasPageHorizontalOverflow(page)).toBe(false)

  const screenshot = await viewer.screenshot()
  expect(screenshot.byteLength).toBeGreaterThan(10_000)
  expect(consoleErrors).toEqual([])
})

test("pretext markdown docs demo renders the rich surface in dark mode", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page)
  await page.emulateMedia({ colorScheme: "dark" })

  await page.goto(PRETEXT_MARKDOWN_VIEW_PATH)

  const viewer = page.locator('[data-slot="text-viewer"]').first()
  const viewport = viewer.locator('[data-slot="scroll-area-viewport"]').first()

  await expect(viewer).toBeVisible()
  await expect(
    viewer.getByRole("heading", { name: "Current Surface" })
  ).toBeVisible()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(viewer.getByText("Page 1 of")).toHaveCount(0)
  await expect(viewer.locator("[data-pretext-markdown-page]")).toHaveCount(0)
  await expect.poll(() => mountedChunkCount(viewer)).toBeLessThan(24)
  await expect.poll(() => hasDocumentHorizontalOverflow(viewport)).toBe(false)

  const colors = await viewer.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      background: style.backgroundColor,
      color: style.color,
    }
  })
  expect(colors.background).not.toBe("rgba(0, 0, 0, 0)")
  expect(colors.color).not.toBe(colors.background)

  const screenshot = await viewer.screenshot()
  expect(screenshot.byteLength).toBeGreaterThan(10_000)
  expect(consoleErrors).toEqual([])
})

function collectConsoleErrors(page: Page) {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  return consoleErrors
}

async function expectMarkdownLinkPolicy(viewer: Locator) {
  const fragment = viewer.getByRole("link", { name: "local fragment link" })
  const external = viewer.getByRole("link", { name: "external link" })
  const autolink = viewer.getByRole("link", {
    name: "https://example.com/reports/alpha",
  })

  await expect(fragment).toHaveAttribute("href", "#release-readiness-matrix")
  await expect(fragment).not.toHaveAttribute("target", /.+/)
  await expect(fragment).not.toHaveAttribute("rel", /.+/)
  await expect(external).toHaveAttribute("href", "https://retab.com")
  await expect(external).toHaveAttribute("target", "_blank")
  await expect(external).toHaveAttribute("rel", "noopener noreferrer")
  await expect(autolink).toHaveAttribute(
    "href",
    "https://example.com/reports/alpha"
  )
  await expect(autolink).toHaveAttribute("target", "_blank")
  await expect(autolink).toHaveAttribute("rel", "noopener noreferrer")
}

async function expectRawHtmlLinkPolicy(viewer: Locator) {
  const external = viewer.getByRole("link", { name: "raw external links" })
  const internal = viewer.getByRole("link", { name: "raw internal links" })

  await expect(external).toHaveAttribute("href", "https://example.com/raw")
  await expect(external).toHaveAttribute("target", "_blank")
  await expect(external).toHaveAttribute("rel", "noopener noreferrer")
  await expect(internal).toHaveAttribute("href", "/docs/viewers")
  await expect(internal).not.toHaveAttribute("target", /.+/)
  await expect(internal).not.toHaveAttribute("rel", /.+/)
}

async function mountedChunkCount(viewer: Locator) {
  return viewer.locator("[data-pretext-markdown-chunk]").count()
}

async function settledMermaidDiagramCount(viewer: Locator) {
  return viewer
    .locator(
      '[data-diagram-language="mermaid"][data-diagram-state="ready"], [data-diagram-language="mermaid"][data-diagram-state="failed"]'
    )
    .count()
}

async function scrollTopDelta(viewport: Locator, baseline: number) {
  return Math.abs(
    (await viewport.evaluate((element) => element.scrollTop)) - baseline
  )
}

async function hasDocumentHorizontalOverflow(viewport: Locator) {
  return viewport.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 2
  )
}

async function hasPageHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2
  )
}
