// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table"

import {
  findEditableCell,
  getRequiredInteractionFieldMetadata,
  interactionVisibleColumn,
  renderInteractionRow,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => {
  installJsonTableDom()
  Object.assign(globalThis, { Node: window.Node })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const normalizationSchema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
    amount: { type: "number" },
    count: { type: "integer" },
    mixed_status: {
      enum: ["draft", 0, 1, false, true, null, "__json_table_null__"],
    },
    object_status: {
      enum: [
        { code: "a", nested: { rank: 1 } },
        { code: "b", nested: { rank: 2 } },
      ],
    },
    shipped_at: { type: "string", format: "date" },
    shipped_time: { type: "string", format: "time" },
    reviewed_at: { type: "string", format: "date-time" },
  },
}

function normalizationDocument(
  data: Partial<TableDocument["data"]> = {}
): TableDocument {
  return {
    id: "doc_normalize",
    data: {
      vendor: "ACME",
      note: "memo",
      amount: 12.5,
      count: 3,
      mixed_status: 0,
      object_status: { nested: { rank: 1 }, code: "a" },
      shipped_at: "2024-99-99",
      shipped_time: "25:99",
      reviewed_at: "not-a-date-time",
      ...data,
    },
  }
}

function renderNormalizationRow({
  document = normalizationDocument(),
  visiblePaths,
  onDocumentDataChange = vi.fn(),
}: {
  document?: TableDocument
  visiblePaths: string[]
  onDocumentDataChange?: Parameters<
    typeof renderInteractionRow
  >[0]["onDocumentDataChange"]
}) {
  return {
    document,
    onDocumentDataChange,
    ...renderInteractionRow({
      document,
      schema: normalizationSchema,
      visiblePaths,
      onDocumentDataChange,
    }),
  }
}

function headerEffectiveType(fieldMetadata: FieldMetadata) {
  if (fieldMetadata.kind === "string") return "string"
  return fieldMetadata.kind
}

function headerNode(fieldPath: string): JsonTableHeaderNode {
  const fieldMetadata = getRequiredInteractionFieldMetadata(
    fieldPath,
    normalizationSchema
  )

  return {
    key: fieldPath,
    label: fieldPath,
    propName: fieldPath.split(".").at(-1) ?? fieldPath,
    parentPath: "",
    rawSchema: fieldMetadata.rawSchema,
    schema: fieldMetadata.schema,
    effectiveType: headerEffectiveType(fieldMetadata),
    isObject: fieldMetadata.kind === "object",
    isArray: fieldMetadata.kind === "array",
    canFold: false,
    isExpanded: true,
  }
}

function renderVirtualTable({
  document = normalizationDocument(),
  visiblePaths,
  onUpdateDocument = vi.fn<(patch: Record<string, unknown>) => Promise<void>>(
    async () => undefined
  ),
}: {
  document?: TableDocument
  visiblePaths: string[]
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
}) {
  const projectedRows = projectDocumentRows({
    document,
    visiblePaths,
    includeArrayAddRows: false,
  })

  return {
    document,
    onUpdateDocument,
    ...render(
      <SingleFileVirtualizedTable
        headerNodes={visiblePaths.map(headerNode)}
        document={document}
        schema={normalizationSchema}
        setSchema={vi.fn()}
        isPublished={false}
        stopAt={[]}
        setStopAt={vi.fn()}
        draggedItemKeyRef={{ current: null }}
        draggedItemParentPathRef={{ current: null }}
        jsonEditMode="editable"
        schemaEditMode="readOnly"
        projectedRows={projectedRows}
        visibleColumns={visiblePaths.map((path) =>
          interactionVisibleColumn(path, normalizationSchema)
        )}
        rowCount={projectedRows.length}
        onUpdateDocument={onUpdateDocument}
        columnWidth="xxl"
        overscan={4}
        jumpOverscan={4}
      />
    ),
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

function pointerDown(target: Element | Document | Window) {
  fireEvent.pointerDown(target, {
    button: 0,
    buttons: 1,
    clientX: 18,
    clientY: 12,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  })
}

async function activateCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  const cell = await editableCell(view, fieldPath)
  pointerDown(cell)
  return cell
}

async function openEnumCell(
  view: ReturnType<typeof renderNormalizationRow>,
  fieldPath: string
) {
  await activateCell(view, fieldPath)
  const trigger = await view.findByRole("combobox")
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )
  return trigger
}

async function openPickerCell(
  view: ReturnType<typeof renderNormalizationRow>,
  fieldPath: string
) {
  fireEvent.pointerDown(await editableCell(view, fieldPath), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  })
  const cell = await editableCell(view, fieldPath)
  cell.focus()
  fireEvent.keyDown(cell, { key: "Enter" })
  await view.findByRole("dialog")
  const trigger = cell.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"][aria-haspopup="dialog"]'
  )
  if (!trigger) throw new Error(`Expected picker trigger for ${fieldPath}`)
  return trigger
}

describe("json table value normalization hardening", () => {
  it.each([
    { fieldPath: "amount", rawValue: "1e3", expectedValue: 1000 },
    { fieldPath: "amount", rawValue: ".75", expectedValue: 0.75 },
    { fieldPath: "amount", rawValue: "-0", expectedValue: -0 },
    { fieldPath: "count", rawValue: "005", expectedValue: 5 },
    { fieldPath: "count", rawValue: "-7", expectedValue: -7 },
  ])(
    "commits valid weird $fieldPath draft $rawValue as a number with JSON identity",
    async ({ fieldPath, rawValue, expectedValue }) => {
      const view = renderNormalizationRow({ visiblePaths: [fieldPath] })

      await activateCell(view, fieldPath)
      const input = view.getByRole("spinbutton") as HTMLInputElement
      fireEvent.change(input, { target: { value: rawValue } })
      fireEvent.blur(input)

      await waitFor(() =>
        expect(view.onDocumentDataChange).toHaveBeenCalledWith(
          view.document.id,
          fieldPath,
          expectedValue
        )
      )
      expect(view.onDocumentDataChange).toHaveBeenCalledTimes(1)
    }
  )

  it.each([
    { fieldPath: "amount", rawValue: "NaN" },
    { fieldPath: "amount", rawValue: "Infinity" },
    { fieldPath: "amount", rawValue: "1,000" },
    { fieldPath: "count", rawValue: "3.5" },
    { fieldPath: "count", rawValue: "1e3" },
  ])(
    "commits currently invalid $fieldPath draft $rawValue as null",
    async ({ fieldPath, rawValue }) => {
      const view = renderNormalizationRow({ visiblePaths: [fieldPath] })

      await activateCell(view, fieldPath)
      const input = view.getByRole("spinbutton") as HTMLInputElement
      fireEvent.change(input, { target: { value: rawValue } })
      fireEvent.blur(input)

      await waitFor(() =>
        expect(view.onDocumentDataChange).toHaveBeenCalledWith(
          view.document.id,
          fieldPath,
          null
        )
      )
      expect(view.onDocumentDataChange).toHaveBeenCalledTimes(1)
    }
  )

  it("treats null, undefined, and empty string as equivalent no-op values at the cell commit boundary", async () => {
    for (const value of [null, undefined, ""]) {
      const view = renderNormalizationRow({
        document: normalizationDocument({ note: value }),
        visiblePaths: ["note"],
      })

      await activateCell(view, "note")
      const input = view.getByRole("textbox") as HTMLInputElement
      expect(input.value).toBe("")

      fireEvent.blur(input)

      expect(view.onDocumentDataChange).not.toHaveBeenCalled()
      cleanup()
    }
  })

  it("commits an empty non-nullable string as null under the current normalization rule", async () => {
    const view = renderNormalizationRow({ visiblePaths: ["vendor"] })

    await activateCell(view, "vendor")
    const input = view.getByRole("textbox")
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)

    await waitFor(() =>
      expect(view.onDocumentDataChange).toHaveBeenCalledWith(
        view.document.id,
        "vendor",
        null
      )
    )
    expect(view.onDocumentDataChange).toHaveBeenCalledTimes(1)
  })

  it("renders non-string enum values and nullable enum null without stringifying their selection identity", async () => {
    const view = renderNormalizationRow({ visiblePaths: ["mixed_status"] })

    const trigger = await openEnumCell(view, "mixed_status")

    expect(trigger.textContent).toContain("0")
    expect(await view.findByRole("option", { name: "draft" })).toBeTruthy()
    expect(await view.findByRole("option", { name: "0" })).toBeTruthy()
    expect(await view.findByRole("option", { name: "1" })).toBeTruthy()
    expect(await view.findByRole("option", { name: "false" })).toBeTruthy()
    expect(await view.findByRole("option", { name: "true" })).toBeTruthy()
    expect(
      await view.findByRole("option", { name: /no selection/i })
    ).toBeTruthy()

    expect(view.onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("uses structural equality for object-valued enum preselection but exposes duplicate object labels", async () => {
    const view = renderNormalizationRow({ visiblePaths: ["object_status"] })

    const trigger = await openEnumCell(view, "object_status")

    const options = await view.findAllByRole("option", {
      name: "[object Object]",
    })
    expect(options).toHaveLength(2)
    expect(trigger.textContent).toContain("[object Object]")
    expect(document.activeElement).toBe(options[0])
    expect(view.onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("keeps malformed date and date-time values editable while exposing current display drift", async () => {
    const dateView = renderNormalizationRow({ visiblePaths: ["shipped_at"] })
    expect((await editableCell(dateView, "shipped_at")).textContent).toContain(
      "Jun 7, 2032"
    )

    const dateTrigger = await openPickerCell(dateView, "shipped_at")
    expect(dateTrigger.textContent).toContain("99/99/2024")
    expect(dateView.onDocumentDataChange).not.toHaveBeenCalled()
    cleanup()

    const dateTimeView = renderNormalizationRow({
      visiblePaths: ["reviewed_at"],
    })
    const dateTimeTrigger = await openPickerCell(dateTimeView, "reviewed_at")
    expect(dateTimeTrigger.textContent).toContain("not-a-date-time")
    expect(dateTimeView.onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("normalizes malformed time through the time input without preserving the malformed seed", async () => {
    const view = renderNormalizationRow({ visiblePaths: ["shipped_time"] })

    const trigger = await openPickerCell(view, "shipped_time")
    expect(trigger.textContent).toContain("25:99")

    const input = await view.findByDisplayValue("")
    fireEvent.change(input, { target: { value: "09:30" } })

    await waitFor(() =>
      expect(view.onDocumentDataChange).toHaveBeenCalledWith(
        view.document.id,
        "shipped_time",
        "09:30:00"
      )
    )
    expect(view.onDocumentDataChange).toHaveBeenCalledTimes(1)
  })

  it("does not commit unchanged normalized number, text, or malformed date display values", async () => {
    const view = renderNormalizationRow({
      visiblePaths: ["amount", "vendor", "shipped_at"],
    })

    await activateCell(view, "amount")
    const amountInput = view.getByRole("spinbutton")
    fireEvent.change(amountInput, { target: { value: "12.50" } })
    fireEvent.blur(amountInput)

    await activateCell(view, "vendor")
    fireEvent.blur(view.getByRole("textbox"))

    await activateCell(view, "shipped_at")
    pointerDown(document.body)

    expect(view.onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("commits a dirty draft before switching cells and composes the next commit against pending document data", async () => {
    const view = renderVirtualTable({
      visiblePaths: ["vendor", "amount", "count", "note"],
    })

    await activateCell(view, "vendor")
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "Globex" },
    })

    await activateCell(view, "amount")
    expect(view.getByRole("spinbutton")).toHaveProperty("value", "12.5")
    await waitFor(() => expect(view.onUpdateDocument).toHaveBeenCalledTimes(1))
    expect(view.onUpdateDocument).toHaveBeenNthCalledWith(1, {
      data: { ...view.document.data, vendor: "Globex" },
    })

    fireEvent.change(view.getByRole("spinbutton"), {
      target: { value: "20.25" },
    })
    fireEvent.blur(view.getByRole("spinbutton"))
    await waitFor(() => expect(view.onUpdateDocument).toHaveBeenCalledTimes(2))
    expect(view.onUpdateDocument).toHaveBeenNthCalledWith(2, {
      data: { ...view.document.data, vendor: "Globex", amount: 20.25 },
    })

    await activateCell(view, "count")
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "" } })
    await activateCell(view, "note")

    await waitFor(() => expect(view.onUpdateDocument).toHaveBeenCalledTimes(3))
    expect(view.onUpdateDocument).toHaveBeenNthCalledWith(3, {
      data: {
        ...view.document.data,
        vendor: "Globex",
        amount: 20.25,
        count: null,
      },
    })
  })
})
