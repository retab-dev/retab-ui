import { expect, test, type Page } from "@playwright/test"

const LAB_PATH = "/data-cell-caret-lab"

type TextInputState = {
  active: boolean
  selectionEnd: number | null
  selectionStart: number | null
  value: string
}

test.beforeEach(async ({ page }) => {
  await page.goto(LAB_PATH)
  await expect(jsonTableCell(page, "code")).toBeVisible()
})

test.describe("JSON table text caret", () => {
  for (const offset of [0, 1, 2, 3]) {
    test(`activation click places a collapsed caret at USD offset ${offset}`, async ({
      page,
    }) => {
      await clickCellTextOffset(page, "code", offset)

      await expectTextInputState(page, "code", {
        active: true,
        selectionStart: offset,
        selectionEnd: offset,
        value: "USD",
      })
    })
  }

  for (const [offset, expectedValue] of [
    [0, "xUSD"],
    [1, "UxSD"],
    [2, "USxD"],
    [3, "USDx"],
  ] as const) {
    test(`typing after activation inserts at USD offset ${offset}`, async ({
      page,
    }) => {
      await clickCellTextOffset(page, "code", offset)
      await page.keyboard.type("x")

      await expectTextInputState(page, "code", {
        active: true,
        selectionStart: offset + 1,
        selectionEnd: offset + 1,
        value: expectedValue,
      })
    })
  }

  for (const [offset, expectedValue] of [
    [0, "xACME BANK"],
    [1, "AxCME BANK"],
    [4, "ACMEx BANK"],
    [9, "ACME BANKx"],
  ] as const) {
    test(`typing after activation inserts at memo offset ${offset}`, async ({
      page,
    }) => {
      await clickCellTextOffset(page, "memo", offset)
      await page.keyboard.type("x")

      await expectTextInputState(page, "memo", {
        active: true,
        selectionStart: offset + 1,
        selectionEnd: offset + 1,
        value: expectedValue,
      })
    })
  }

  test("clicking inside an already mounted text editor moves the caret before typing", async ({
    page,
  }) => {
    await clickCellTextOffset(page, "code", 0)
    await expectTextInputState(page, "code", {
      active: true,
      selectionStart: 0,
      selectionEnd: 0,
      value: "USD",
    })

    await clickInputTextOffset(page, "code", 2)
    await page.keyboard.type("x")

    await expectTextInputState(page, "code", {
      active: true,
      selectionStart: 3,
      selectionEnd: 3,
      value: "USxD",
    })
  })

  test("typed insertion commits on blur without reverting to the original value", async ({
    page,
  }) => {
    await clickCellTextOffset(page, "code", 1)
    await page.keyboard.type("x")
    await page.mouse.click(20, 20)

    await expect
      .poll(() => documentData(page))
      .toMatchObject({ code: "UxSD" })
  })

  test("printable key activation from the focused display cell still replaces intentionally", async ({
    page,
  }) => {
    await jsonTableCell(page, "code").focus()
    await page.keyboard.press("z")

    await expectTextInputState(page, "code", {
      active: true,
      selectionStart: 1,
      selectionEnd: 1,
      value: "z",
    })
  })
})

test.describe("JSON table enum select", () => {
  test("first click opens the enum options", async ({ page }) => {
    await clickCellCenter(page, "status")

    await expect(page.getByRole("combobox")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    await expect(page.getByRole("option", { name: "approved" })).toBeVisible()
  })

  test("clicking an enum option commits the JSON value once", async ({
    page,
  }) => {
    await clickCellCenter(page, "status")
    await page.getByRole("option", { name: "approved" }).click()

    await expect.poll(() => documentData(page)).toMatchObject({
      status: "approved",
    })
    await expect(page.getByRole("combobox")).toHaveCount(0)
  })
})

function jsonTableCell(page: Page, fieldPath: string) {
  return page.locator(
    `td[data-field-path="${fieldPath}"][data-json-table-editable-cell="true"]`
  )
}

async function clickCellTextOffset(
  page: Page,
  fieldPath: string,
  offset: number
) {
  const position = await textOffsetPosition(page, {
    fieldPath,
    offset,
    target: "cell",
  })
  await dataCellLocator(page, fieldPath).click({ force: true, position })
}

async function clickInputTextOffset(
  page: Page,
  fieldPath: string,
  offset: number
) {
  const position = await textOffsetPosition(page, {
    fieldPath,
    offset,
    target: "input",
  })
  await textInputLocator(page, fieldPath).click({ force: true, position })
}

async function clickCellCenter(page: Page, fieldPath: string) {
  await dataCellLocator(page, fieldPath).click({ force: true })
}

function dataCellLocator(page: Page, fieldPath: string) {
  return jsonTableCell(page, fieldPath).locator('[data-slot="data-cell"]')
}

function textInputLocator(page: Page, fieldPath: string) {
  return jsonTableCell(page, fieldPath).locator(
    'input[data-kind="text"][data-mode="edit"]'
  )
}

async function textOffsetPosition(
  page: Page,
  options: {
    fieldPath: string
    offset: number
    target: "cell" | "input"
  }
) {
  return page.evaluate(({ fieldPath, offset, target }) => {
    const cell = document.querySelector<HTMLElement>(
      `td[data-field-path="${fieldPath}"][data-json-table-editable-cell="true"]`
    )
    if (!cell) throw new Error(`Missing JSON table cell for ${fieldPath}`)

    const element =
      target === "input"
        ? cell.querySelector<HTMLInputElement>(
            'input[data-kind="text"][data-mode="edit"]'
          )
        : cell.querySelector<HTMLElement>('[data-slot="data-cell"]')
    if (!element) throw new Error(`Missing ${target} target for ${fieldPath}`)

    const value =
      element instanceof HTMLInputElement
        ? element.value
        : (element.textContent ?? "").trim()
    if (offset < 0 || offset > value.length) {
      throw new Error(`Offset ${offset} is outside ${JSON.stringify(value)}`)
    }

    const rect = element.getBoundingClientRect()
    const styles = getComputedStyle(element)
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Could not create 2D canvas context")

    context.font = styles.font
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
    const prefix = value.slice(0, offset)
    const prefixWidth = context.measureText(prefix).width

    return { x: paddingLeft + prefixWidth, y: rect.height / 2 }
  }, options)
}

async function textInputState(
  page: Page,
  fieldPath: string
): Promise<TextInputState> {
  return page.evaluate((path) => {
    const input = document.querySelector<HTMLInputElement>(
      `td[data-field-path="${path}"] input[data-kind="text"][data-mode="edit"]`
    )
    if (!input) {
      return {
        active: false,
        selectionEnd: null,
        selectionStart: null,
        value: "",
      }
    }

    return {
      active: document.activeElement === input,
      selectionEnd: input.selectionEnd,
      selectionStart: input.selectionStart,
      value: input.value,
    }
  }, fieldPath)
}

async function expectTextInputState(
  page: Page,
  fieldPath: string,
  expectedState: TextInputState
) {
  await expect
    .poll(() => textInputState(page, fieldPath))
    .toEqual(expectedState)
}

async function documentData(page: Page) {
  return page.getByTestId("data-cell-caret-document").evaluate((output) => {
    return JSON.parse(output.textContent ?? "{}") as Record<string, unknown>
  })
}
