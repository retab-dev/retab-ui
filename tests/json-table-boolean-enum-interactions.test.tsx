// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { JsonTableCellCommitHandler } from "@/components/json-table/json-table-cell-commit"
import type { TableDocument } from "@/components/json-table/lib/projects-types"

import {
  primitiveEventTarget,
  renderInteractionRow,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    is_paid: { type: "boolean" },
    status: { type: "string", enum: ["draft", "paid"] },
    rating: { type: "integer", enum: [1, 2] },
    nullable_status: {
      anyOf: [
        {
          type: "string",
          enum: ["draft", "paid"],
        },
        { type: "null" },
      ],
    },
    sentinel_status: {
      anyOf: [
        {
          type: "string",
          enum: ["__json_table_null__", "option:1", "__null__"],
        },
        { type: "null" },
      ],
    },
  },
}

const tableDocument: TableDocument = {
  id: "doc_1",
  data: {
    is_paid: false,
    status: "draft",
    rating: 1,
    nullable_status: "paid",
    sentinel_status: "__json_table_null__",
  },
}

function renderJsonTableField({
  doc = tableDocument,
  fieldPath,
  isJsonEditable = true,
  onCellCommit = vi.fn(),
}: {
  doc?: TableDocument
  fieldPath: string
  isJsonEditable?: boolean
  onCellCommit?: JsonTableCellCommitHandler
}) {
  const view = renderInteractionRow({
    document: doc,
    schema,
    visiblePaths: [fieldPath],
    isJsonEditable,
    onCellCommit,
  })

  const findCell = async () => {
    return waitFor(
      () => {
        const cell = view.container.querySelector<HTMLElement>(
          `[data-field-path="${fieldPath}"]`
        )
        if (!cell) throw new Error(`Expected ${fieldPath} cell to render`)
        return cell
      },
      { timeout: 5000 }
    )
  }

  return { ...view, findCell, onCellCommit }
}

async function activateEnumCell(fieldPath: string) {
  const view = renderJsonTableField({ fieldPath })
  const cell = await view.findCell()

  fireEvent.click(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })

  const trigger = await view.findByRole("combobox")
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )

  return { ...view, cell, trigger }
}

async function clickEnumCell(fieldPath: string) {
  const view = renderJsonTableField({ fieldPath })
  const cell = await view.findCell()

  fireEvent.pointerDown(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  fireEvent.pointerUp(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  fireEvent.click(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })

  const trigger = await view.findByRole("combobox")
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )

  return { ...view, cell, trigger }
}

async function chooseOption(
  view: ReturnType<typeof renderJsonTableField>,
  optionName: string | RegExp
) {
  const option = await view.findByRole("option", { name: optionName })
  fireEvent.pointerDown(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  })
  fireEvent.pointerUp(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  })
  fireEvent.click(option)
}

function mockElementRect() {
  return vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(
      () =>
        ({
          x: 24,
          y: 48,
          top: 48,
          left: 24,
          right: 204,
          bottom: 78,
          width: 180,
          height: 30,
          toJSON: () => ({}),
        }) as DOMRect
    )
}

describe("json table boolean interactions", () => {
  it("toggles once and closes on the first boolean click", async () => {
    const onCellCommit = vi.fn()
    const view = renderJsonTableField({
      fieldPath: "is_paid",
      onCellCommit,
    })
    const cell = await view.findCell()

    fireEvent.pointerDown(primitiveEventTarget(cell), { button: 0 })

    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith({
        fieldPath: "is_paid",
        value: true,
        previousValue: false,
        visibleThrough: "primitivePendingValue",
      })
    )
    expect(onCellCommit).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(cell.getAttribute("data-active")).toBeNull())
  })

  it("toggles a boolean from Space keyboard activation", async () => {
    const onCellCommit = vi.fn()
    const view = renderJsonTableField({
      fieldPath: "is_paid",
      onCellCommit,
    })
    const cell = await view.findCell()

    primitiveEventTarget(cell).focus()
    fireEvent.keyDown(primitiveEventTarget(cell), { key: " " })

    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith({
        fieldPath: "is_paid",
        value: true,
        previousValue: false,
        visibleThrough: "primitivePendingValue",
      })
    )
    expect(onCellCommit).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(cell.getAttribute("data-active")).toBeNull())
  })

  it("does not auto-toggle booleans from Enter or F2 activation", async () => {
    for (const key of ["Enter", "F2"]) {
      const onCellCommit = vi.fn()
      const view = renderJsonTableField({
        fieldPath: "is_paid",
        onCellCommit,
      })
      const cell = await view.findCell()

      primitiveEventTarget(cell).focus()
      fireEvent.keyDown(primitiveEventTarget(cell), { key })

      await waitFor(() => expect(cell.getAttribute("data-active")).toBe("true"))
      expect(onCellCommit).not.toHaveBeenCalled()

      fireEvent.click(view.getByRole("checkbox"))

      await waitFor(() =>
        expect(onCellCommit).toHaveBeenCalledWith({
          fieldPath: "is_paid",
          value: true,
          previousValue: false,
          visibleThrough: "primitivePendingValue",
        })
      )
      expect(onCellCommit).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it("leaves read-only booleans inert", async () => {
    const onCellCommit = vi.fn()
    const view = renderJsonTableField({
      fieldPath: "is_paid",
      isJsonEditable: false,
      onCellCommit,
    })
    const cell = await view.findCell()

    fireEvent.pointerDown(primitiveEventTarget(cell), { button: 0 })
    fireEvent.keyDown(primitiveEventTarget(cell), { key: " " })
    fireEvent.click(view.getByRole("checkbox"))

    expect(onCellCommit).not.toHaveBeenCalled()
    expect(view.queryByRole("button")).toBeNull()
    expect(cell.getAttribute("data-active")).toBeNull()
  })
})

describe("json table enum interactions", () => {
  it("opens enum options on the first click", async () => {
    const { trigger, findByRole } = await activateEnumCell("status")

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(await findByRole("option", { name: "paid" })).toBeTruthy()
  })

  it("keeps enum options open through the full first browser click sequence", async () => {
    const { trigger, findByRole } = await clickEnumCell("status")

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(await findByRole("option", { name: "paid" })).toBeTruthy()
  })

  it("opens enum options with one anchor layout read", async () => {
    const getBoundingClientRect = mockElementRect()
    const view = await activateEnumCell("status")

    expect(await view.findByRole("option", { name: "paid" })).toBeTruthy()
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1)
  })

  it("commits enum options from keyboard navigation", async () => {
    const view = await activateEnumCell("status")

    fireEvent.keyDown(view.trigger, { key: "ArrowDown" })
    fireEvent.keyDown(view.trigger, { key: "Enter" })

    await waitFor(() =>
      expect(view.onCellCommit).toHaveBeenCalledWith({
        fieldPath: "status",
        value: "paid",
        previousValue: "draft",
        visibleThrough: "primitivePendingValue",
      })
    )
  })

  it("closes enum options on Escape without committing", async () => {
    const view = await activateEnumCell("status")

    fireEvent.keyDown(view.trigger, { key: "Escape" })

    await waitFor(() => expect(view.onCellCommit).not.toHaveBeenCalled())
    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
  })

  it("closes enum options on outside interaction without committing", async () => {
    const view = await activateEnumCell("status")

    fireEvent.pointerDown(globalThis.document.body)

    await waitFor(() => expect(view.onCellCommit).not.toHaveBeenCalled())
    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
  })

  it("commits selected enum options using the original JSON value type", async () => {
    const view = await activateEnumCell("rating")

    await chooseOption(view, "2")

    await waitFor(() =>
      expect(view.onCellCommit).toHaveBeenCalledWith({
        fieldPath: "rating",
        value: 2,
        previousValue: 1,
        visibleThrough: "primitivePendingValue",
      })
    )
  })

  it("commits nullable No selection as null", async () => {
    const view = await activateEnumCell("nullable_status")

    await chooseOption(view, /no selection/i)

    await waitFor(() =>
      expect(view.onCellCommit).toHaveBeenCalledWith({
        fieldPath: "nullable_status",
        value: null,
        previousValue: "paid",
        visibleThrough: "primitivePendingValue",
      })
    )
  })

  it("does not commit when selecting the current enum value", async () => {
    const view = await activateEnumCell("status")

    await chooseOption(view, "draft")

    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(view.onCellCommit).not.toHaveBeenCalled()
  })

  it("keeps sentinel-like enum strings distinct from internal select values", async () => {
    const view = await activateEnumCell("sentinel_status")

    await chooseOption(view, "option:1")

    await waitFor(() =>
      expect(view.onCellCommit).toHaveBeenCalledWith({
        fieldPath: "sentinel_status",
        value: "option:1",
        previousValue: "__json_table_null__",
        visibleThrough: "primitivePendingValue",
      })
    )
  })
})
