import { expect, test, type Locator, type Page } from "@playwright/test"

test("property form object fields reuse schema-builder row mechanics", async ({
  page,
}) => {
  await page.goto("/docs/components/property-form")

  const topLevelType = page
    .getByRole("button", {
      exact: true,
      name: "Data type",
    })
    .first()

  await expect(topLevelType).toContainText("object")

  const streetRow = schemaRowForInput(page.getByLabel("Field name street"))
  await expect(streetRow).toBeVisible()
  await expect(rowGrip(streetRow)).toBeVisible()
  await expect(streetRow).toHaveCSS("cursor", "grab")
  await expect(rowGrip(streetRow)).toHaveCSS("cursor", "grab")

  await propertyFormRowForInput(page.getByLabel("Field name city")).dragTo(
    propertyFormRowForInput(page.getByLabel("Field name street")),
    { targetPosition: { x: 12, y: 4 } }
  )
  await expectPropertyFieldOrder(page, ["city", "street"])
  await page.getByRole("button", { exact: true, name: "Save" }).click()
  await expectPropertyFieldOrder(page, ["city", "street"])

  await page.getByLabel("Field name street").fill("road")
  await page.getByLabel("Field name street").press("Enter")
  await expect(page.getByLabel("Field name road")).toBeVisible()

  await page.getByLabel("New object field").fill("zip")
  await page.getByRole("button", { exact: true, name: "Add" }).click()
  await expect(page.getByLabel("Field name zip")).toBeVisible()

  await page.getByRole("button", { name: "Remove field city" }).click()
  await expect(page.getByLabel("Field name city")).toHaveCount(0)

  await topLevelType.click()
  await page.getByRole("menuitem", { name: "list" }).click()
  await expect(topLevelType).toContainText("list")
  await expect(page.getByText("List item type")).toBeVisible()
})

test("property form object fields support keyboard reordering", async ({
  page,
}) => {
  await page.goto("/docs/components/property-form")

  await page.getByLabel("New object field").fill("zip")
  await page.getByRole("button", { exact: true, name: "Add" }).click()
  await expectPropertyFieldOrder(page, ["street", "city", "zip"])

  await expect(
    page.getByRole("button", { name: "Move field street up" })
  ).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "Move field zip down" })
  ).toBeDisabled()

  await page.getByRole("button", { name: "Move field zip up" }).click()
  await expectPropertyFieldOrder(page, ["street", "zip", "city"])
  await expect(page.getByText("zip moved to position 2 of 3")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Move field zip up" })
  ).toBeFocused()

  await page.getByRole("button", { name: "Move field street down" }).click()
  await expectPropertyFieldOrder(page, ["zip", "street", "city"])

  await page.getByRole("button", { exact: true, name: "Save" }).click()
  await expectPropertyFieldOrder(page, ["zip", "street", "city"])
})

test("schema builder keeps grips, enum chips, and description caret exact", async ({
  page,
}) => {
  await page.goto("/docs/components/schema-builder")

  const invoiceRow = schemaRowForInput(
    page.getByLabel("Field name invoice_number")
  )
  const paidRow = schemaRowForInput(page.getByLabel("Field name paid"))
  await expect(paidRow).toBeVisible()
  await expect(rowGrip(paidRow)).toBeVisible()

  const enumChip = enumChipForInput(page.getByLabel("Option 1: USD"))
  await expect(enumChip).toBeVisible()
  // These classes are the chip shell's explicit compact visual contract.
  await expect(enumChip).toHaveClass(/bg-muted/)
  await expect(enumChip).toHaveClass(/px-1/)
  await expect(enumChip).toHaveClass(/shadow-none/)

  const description = invoiceRow.getByLabel("Field description")
  await clickInputTextOffset(page, description, 12)
  await expectInputSelection(description, {
    selectionEnd: 12,
    selectionStart: 12,
    value: "The invoice identifier",
  })
})

function schemaRowForInput(input: Locator) {
  return input.locator('xpath=ancestor::*[@data-slot="schema-field-row"][1]')
}

function rowGrip(row: Locator) {
  return row.locator("svg").first()
}

function propertyFormRowForInput(input: Locator) {
  return input.locator(
    "xpath=ancestor::*[@data-property-form-property-name][1]"
  )
}

function enumChipForInput(input: Locator) {
  return input.locator('xpath=ancestor::*[@data-slot="schema-chip"][1]')
}

async function expectPropertyFieldOrder(page: Page, expected: string[]) {
  await expect
    .poll(() =>
      page
        .locator('input[aria-label^="Field name "]')
        .evaluateAll((inputs) =>
          inputs.map((input) =>
            input instanceof HTMLInputElement ? input.value : ""
          )
        )
    )
    .toEqual(expected)
}

async function clickInputTextOffset(
  page: Page,
  input: Locator,
  offset: number
) {
  const point = await input.evaluate((element, offset) => {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error("Expected an input element")
    }

    const value = element.value
    if (offset < 0 || offset > value.length) {
      throw new Error(`Offset ${offset} is outside ${JSON.stringify(value)}`)
    }

    const style = window.getComputedStyle(element)
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Missing canvas context")

    context.font = style.font
    const rect = element.getBoundingClientRect()
    const paddingLeft = Number.parseFloat(style.paddingLeft || "0")
    const borderLeft = Number.parseFloat(style.borderLeftWidth || "0")
    const textWidth = context.measureText(value.slice(0, offset)).width

    return {
      x: rect.left + borderLeft + paddingLeft + textWidth,
      y: rect.top + rect.height / 2,
    }
  }, offset)

  await page.mouse.click(point.x, point.y)
}

async function expectInputSelection(
  input: Locator,
  expected: {
    selectionEnd: number
    selectionStart: number
    value: string
  }
) {
  await expect
    .poll(() =>
      input.evaluate((element) => {
        if (!(element instanceof HTMLInputElement)) {
          throw new Error("Expected an input element")
        }

        return {
          selectionEnd: element.selectionEnd,
          selectionStart: element.selectionStart,
          value: element.value,
        }
      })
    )
    .toEqual(expected)
}
