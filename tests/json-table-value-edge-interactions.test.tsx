// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { TableDocument } from "@/components/json-table/lib/projects-types"

import {
  findEditableCell,
  renderInteractionRow,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

const edgeSchema: JSONSchema7 = {
  type: "object",
  properties: {
    string_status: { enum: ["draft", "approved"] },
    number_status: { enum: [1, 2] },
    boolean_status: { enum: [false, true] },
    nullable_status: { enum: ["selected", null] },
    sentinel_status: {
      enum: ["__json_table_null__", "option:1", "__null__", null],
    },
    empty_status: { enum: ["", "filled"] },
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
    count: { type: "integer" },
    is_paid: { type: "boolean" },
  },
}

function edgeDocument(
  data: Partial<TableDocument["data"]> = {}
): TableDocument {
  return {
    id: "doc_1",
    data: {
      string_status: "draft",
      number_status: 1,
      boolean_status: false,
      nullable_status: "selected",
      sentinel_status: "__json_table_null__",
      empty_status: "filled",
      note: "memo",
      count: 3,
      is_paid: false,
      ...data,
    },
  }
}

async function editableCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

async function activateCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  const cell = await editableCell(view, fieldPath)
  fireEvent.pointerDown(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  return cell
}

async function activateEnumCell({
  document = edgeDocument(),
  fieldPath,
  onCellCommit = vi.fn(),
}: {
  document?: TableDocument
  fieldPath: string
  onCellCommit?: (
    docId: string,
    fieldPath: string,
    value: unknown
  ) => void
}) {
  const view = renderInteractionRow({
    document,
    schema: edgeSchema,
    visiblePaths: [fieldPath],
    onCellCommit,
  })

  const cell = await editableCell(view, fieldPath)
  fireEvent.click(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })

  const trigger = await view.findByRole("combobox")
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )

  return { ...view, document, trigger, onCellCommit }
}

async function chooseOption(
  view: ReturnType<typeof renderInteractionRow>,
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

describe("json table value edge interactions", () => {
  it.each([
    {
      fieldPath: "string_status",
      optionName: "approved",
      expectedValue: "approved",
    },
    { fieldPath: "number_status", optionName: "2", expectedValue: 2 },
    { fieldPath: "boolean_status", optionName: "true", expectedValue: true },
    {
      fieldPath: "nullable_status",
      optionName: /no selection/i,
      expectedValue: null,
    },
  ])(
    "commits $fieldPath enum options as their original JSON value type",
    async ({ fieldPath, optionName, expectedValue }) => {
      const view = await activateEnumCell({ fieldPath })

      await chooseOption(view, optionName)

      await waitFor(() =>
        expect(view.onCellCommit).toHaveBeenCalledWith(
          "doc_1",
          fieldPath,
          expectedValue
        )
      )
      expect(view.onCellCommit).toHaveBeenCalledTimes(1)
    }
  )

  it.each([
    {
      currentValue: "__null__",
      optionName: "__json_table_null__",
      expectedValue: "__json_table_null__",
    },
    {
      currentValue: "__json_table_null__",
      optionName: "option:1",
      expectedValue: "option:1",
    },
    {
      currentValue: "option:1",
      optionName: "__null__",
      expectedValue: "__null__",
    },
  ])(
    "keeps sentinel-like string enum value $expectedValue distinct from select internals",
    async ({ currentValue, optionName, expectedValue }) => {
      const view = await activateEnumCell({
        document: edgeDocument({ sentinel_status: currentValue }),
        fieldPath: "sentinel_status",
      })

      await chooseOption(view, optionName)

      await waitFor(() =>
        expect(view.onCellCommit).toHaveBeenCalledWith(
          "doc_1",
          "sentinel_status",
          expectedValue
        )
      )
      expect(view.onCellCommit).toHaveBeenCalledTimes(1)
    }
  )

  it("keeps sentinel-like string enum options separate from nullable No selection", async () => {
    const view = await activateEnumCell({
      document: edgeDocument({ sentinel_status: "__null__" }),
      fieldPath: "sentinel_status",
    })

    expect(
      view.getByRole("option", { name: "__json_table_null__" })
    ).toBeTruthy()
    expect(view.getByRole("option", { name: "option:1" })).toBeTruthy()
    expect(view.getByRole("option", { name: "__null__" })).toBeTruthy()
    expect(view.getByRole("option", { name: /no selection/i })).toBeTruthy()

    await chooseOption(view, /no selection/i)

    await waitFor(() =>
      expect(view.onCellCommit).toHaveBeenCalledWith(
        "doc_1",
        "sentinel_status",
        null
      )
    )
    expect(view.onCellCommit).toHaveBeenCalledTimes(1)
  })

  it("filters empty string enum members from the dropdown", async () => {
    const view = await activateEnumCell({ fieldPath: "empty_status" })

    const options = await view.findAllByRole("option")

    expect(options.map((option) => option.textContent)).toEqual(["filled"])
    expect(view.queryByRole("option", { name: "" })).toBeNull()
  })

  it("commits nullable enum No selection as null exactly once", async () => {
    const view = await activateEnumCell({ fieldPath: "nullable_status" })

    await chooseOption(view, /no selection/i)

    await waitFor(() =>
      expect(view.onCellCommit).toHaveBeenCalledWith(
        "doc_1",
        "nullable_status",
        null
      )
    )
    expect(view.onCellCommit).toHaveBeenCalledTimes(1)
  })

  it("commits empty text blur as null exactly once", async () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      document: edgeDocument(),
      schema: edgeSchema,
      visiblePaths: ["note"],
      onCellCommit,
    })

    await activateCell(view, "note")
    const input = view.getByRole("textbox")

    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)
    fireEvent.blur(input)

    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith("doc_1", "note", null)
    )
    expect(onCellCommit).toHaveBeenCalledTimes(1)
  })

  it.each([
    { draftValue: "3.5", label: "decimal", expectedValue: null },
    { draftValue: "", label: "empty", expectedValue: null },
  ])(
    "commits $label integer drafts as the current null behavior",
    async ({ draftValue, expectedValue }) => {
      const onCellCommit = vi.fn()
      const view = renderInteractionRow({
        document: edgeDocument(),
        schema: edgeSchema,
        visiblePaths: ["count"],
        onCellCommit,
      })

      await activateCell(view, "count")
      const input = view.getByRole("spinbutton")

      fireEvent.change(input, { target: { value: draftValue } })
      fireEvent.blur(input)

      await waitFor(() =>
        expect(onCellCommit).toHaveBeenCalledWith(
          "doc_1",
          "count",
          expectedValue
        )
      )
      expect(onCellCommit).toHaveBeenCalledTimes(1)
    }
  )

  it.each([
    {
      activation: "pointer",
      interact: async (cell: HTMLElement) => {
        fireEvent.pointerDown(cell, { button: 0, detail: 1 })
        fireEvent.pointerUp(cell, { button: 0, detail: 1 })
        fireEvent.click(cell)
      },
    },
    {
      activation: "Space",
      interact: async (cell: HTMLElement) => {
        cell.focus()
        fireEvent.keyDown(cell, { key: " " })
        fireEvent.keyUp(cell, { key: " " })
        fireEvent.click(cell)
      },
    },
  ])(
    "does not double-toggle booleans from $activation activation",
    async ({ interact }) => {
      const onCellCommit = vi.fn()
      const view = renderInteractionRow({
        document: edgeDocument(),
        schema: edgeSchema,
        visiblePaths: ["is_paid"],
        onCellCommit,
      })
      const cell = await editableCell(view, "is_paid")

      await interact(cell)

      await waitFor(() =>
        expect(onCellCommit).toHaveBeenCalledWith(
          "doc_1",
          "is_paid",
          true
        )
      )
      expect(onCellCommit).toHaveBeenCalledTimes(1)
    }
  )
})
