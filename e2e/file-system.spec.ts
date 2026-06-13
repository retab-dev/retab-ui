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
