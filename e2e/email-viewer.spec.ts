import { expect, test } from "@playwright/test"

test("email viewer sidebar exposes body and attachments and toggles", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  await page.goto("/view/email-viewer")

  const viewer = page.locator('[data-slot="email-viewer"]').first()
  const sidebar = viewer.getByRole("complementary", { name: "Email parts" })
  const trigger = viewer.getByRole("button", { name: "Toggle sidebar" })

  await expect(viewer).toBeVisible()
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByRole("heading", { name: "Body" })).toBeVisible()
  await expect(
    sidebar.getByRole("heading", { name: "Attachments" })
  ).toBeVisible()
  await expect(
    sidebar.getByRole("button", { name: /spacex-prospectus\.pdf/i })
  ).toBeVisible()

  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(sidebar).toHaveAttribute("aria-hidden", "true")

  await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await expect(sidebar).not.toHaveAttribute("aria-hidden", "true")
  expect(consoleErrors).toEqual([])
})
