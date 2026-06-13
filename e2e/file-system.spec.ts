import { expect, test } from "@playwright/test"

const DEMO_PATH = "/view/blocks/file-system"

test("file system preserves selection and supports keyboard navigation across views", async ({
  page,
}) => {
  await page.goto(DEMO_PATH)

  const fileSystem = page.locator('[data-slot="file-system"]').first()

  await expect(fileSystem).toBeVisible()
  await fileSystem.getByRole("treeitem", { name: /research/i }).dblclick()
  await expect(
    fileSystem.getByRole("treeitem", { name: /attention\.pdf/i })
  ).toBeVisible()

  await fileSystem.getByRole("treeitem", { name: /attention\.pdf/i }).click()
  await expect(fileSystem.getByText("attention.pdf selected")).toBeVisible()

  await fileSystem.getByRole("tab", { name: "Grid view" }).click()
  await expect(
    fileSystem.getByRole("option", { name: /attention\.pdf/i })
  ).toHaveAttribute("aria-selected", "true")

  await fileSystem.getByRole("listbox", { name: "Files" }).press("Home")
  await expect(
    fileSystem.getByRole("option", {
      name: /an-image-is-worth-16x16-words\.pdf/i,
    })
  ).toHaveAttribute("aria-selected", "true")

  await fileSystem.getByRole("tab", { name: "Gallery view" }).click()
  await fileSystem.getByRole("listbox", { name: "Files" }).press("ArrowRight")
  await expect(
    fileSystem.getByRole("option", { name: /attention\.pdf/i })
  ).toHaveAttribute("aria-selected", "true")
})

test("file system demo round-trips controlled state through the URL", async ({
  page,
}) => {
  await page.goto(DEMO_PATH)

  const fileSystem = page.locator('[data-slot="file-system"]').first()

  await fileSystem.getByRole("treeitem", { name: /research/i }).dblclick()
  await fileSystem.getByRole("treeitem", { name: /attention\.pdf/i }).click()
  await fileSystem.getByRole("tab", { name: "Grid view" }).click()
  await fileSystem
    .getByRole("searchbox", { name: "Search files" })
    .fill("attention")
  await expectUrlParams(page, {
    path: "research/",
    search: "attention",
    selectedPath: "research/attention.pdf",
    view: "grid",
  })
  await fileSystem.getByRole("button", { name: "PDF" }).click()
  await expectUrlParams(page, {
    "filters.categories": "pdf",
    path: "research/",
    search: "attention",
    selectedPath: "research/attention.pdf",
    view: "grid",
  })
  await fileSystem.getByRole("tab", { name: "List view" }).click()
  await expectUrlParams(page, {
    "filters.categories": "pdf",
    path: "research/",
    search: "attention",
    selectedPath: "research/attention.pdf",
    view: null,
  })
  await fileSystem.getByRole("button", { exact: true, name: "Type" }).click()
  await fileSystem.getByRole("button", { name: /Type/ }).click()

  await expectUrlParams(page, {
    "filters.categories": "pdf",
    path: "research/",
    search: "attention",
    selectedPath: "research/attention.pdf",
    "sort.direction": "desc",
    "sort.key": "kind",
  })

  await page.reload()
  await expect(fileSystem.getByText("attention.pdf selected")).toBeVisible()
  await expect(
    fileSystem.getByRole("treeitem", { name: /attention\.pdf/i })
  ).toHaveAttribute("aria-selected", "true")
})

test("file system demo falls back from invalid URL state", async ({ page }) => {
  await page.goto(
    `${DEMO_PATH}?path=missing/&selectedPath=missing.pdf&view=missing&filters.updatedAfter=never&sort.key=missing&sort.direction=sideways`
  )

  const fileSystem = page.locator('[data-slot="file-system"]').first()

  await expect(fileSystem).toBeVisible()
  await expect(
    fileSystem.getByRole("treeitem", { name: /research/i })
  ).toBeVisible()
  await expect(
    fileSystem.getByRole("tab", { name: "List view" })
  ).toHaveAttribute("aria-selected", "true")
})

test("file system keeps large grid and columns render pressure bounded", async ({
  page,
}) => {
  await page.goto(
    `${DEMO_PATH}?large=true&path=large/&selectedPath=large/file-0000.pdf&view=grid`
  )

  const fileSystem = page.locator('[data-slot="file-system"]').first()
  const grid = fileSystem.getByRole("listbox", { name: "Files" })

  await expect(fileSystem.getByText("file-0000.pdf selected")).toBeVisible()
  await expect.poll(() => grid.getByRole("option").count()).toBeLessThan(250)

  await grid.evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight, behavior: "auto" })
  })
  await expect(fileSystem.getByText("file-0000.pdf selected")).toBeVisible()
  await expect.poll(() => grid.getByRole("option").count()).toBeLessThan(250)

  await page.goto(`${DEMO_PATH}?large=true&path=large/&view=columns`)

  const columns = fileSystem.getByRole("listbox", { name: "large/" })

  await expect.poll(() => columns.getByRole("option").count()).toBeLessThan(250)
})

async function expectUrlParams(
  page: { url: () => string },
  params: Record<string, string | null>
) {
  await expect
    .poll(() => {
      const searchParams = new URL(page.url()).searchParams

      return Object.fromEntries(
        Object.keys(params).map((key) => [key, searchParams.get(key)])
      )
    })
    .toEqual(params)
}
