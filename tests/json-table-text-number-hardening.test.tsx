// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table"

import {
  findEditableCell,
  findReadonlyCell,
  getRequiredInteractionFieldMetadata,
  interactionDocument,
  interactionSchema,
  interactionVisibleColumn,
  renderInteractionRow,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function editableCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

function pointerActivateCell(cell: HTMLElement) {
  fireEvent.pointerDown(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
}

async function activateCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  const cell = await editableCell(view, fieldPath)
  pointerActivateCell(cell)
  return cell
}

function inputValue(input: HTMLElement) {
  return (input as HTMLInputElement).value
}

function headerEffectiveType(fieldMetadata: FieldMetadata) {
  if (fieldMetadata.kind === "string") return "string"
  return fieldMetadata.kind
}

function headerNode(fieldPath: string): JsonTableHeaderNode {
  const fieldMetadata = getRequiredInteractionFieldMetadata(
    fieldPath,
    interactionSchema
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
  tableDocument = interactionDocument,
  visiblePaths,
  jsonEditMode = "editable",
  onUpdateDocument = vi.fn(),
}: {
  tableDocument?: TableDocument
  visiblePaths: string[]
  jsonEditMode?: "editable" | "readOnly"
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
}) {
  const projectedRows = projectDocumentRows({
    document: tableDocument,
    visiblePaths,
    includeArrayAddRows: false,
  })

  return render(
    <SingleFileVirtualizedTable
      headerNodes={visiblePaths.map(headerNode)}
      document={tableDocument}
      schema={interactionSchema}
      setSchema={vi.fn()}
      isPublished={false}
      stopAt={[]}
      setStopAt={vi.fn()}
      draggedItemKeyRef={{ current: null }}
      draggedItemParentPathRef={{ current: null }}
      jsonEditMode={jsonEditMode}
      schemaEditMode="readOnly"
      projectedRows={projectedRows}
      visibleColumns={visiblePaths.map((path) =>
        interactionVisibleColumn(path, interactionSchema)
      )}
      rowCount={projectedRows.length}
      onUpdateDocument={onUpdateDocument}
      columnWidth="xxl"
      overscan={4}
      jumpOverscan={4}
    />
  )
}

async function virtualCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

describe("json table text and number hardening", () => {
  it("focuses a text input on first click and places the caret at the expected jsdom boundary", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] })
    const cell = await editableCell(view, "vendor")

    pointerActivateCell(cell)

    const input = view.getByRole("textbox") as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("ACME")
    expect(input.selectionStart).toBe(input.value.length)
    expect(input.selectionEnd).toBe(input.value.length)
  })

  it("focuses a number input on first click without requiring a second click", async () => {
    const view = renderInteractionRow({ visiblePaths: ["amount"] })

    await activateCell(view, "amount")

    const input = view.getByRole("spinbutton") as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("12.5")
  })

  it("seeds text and numeric type-to-edit from supported keyboard characters", async () => {
    const textView = renderInteractionRow({ visiblePaths: ["vendor"] })
    const textCell = await editableCell(textView, "vendor")
    textCell.focus()
    fireEvent.keyDown(textCell, { key: "G" })
    expect(textView.getByRole("textbox")).toHaveProperty("value", "G")
    cleanup()

    const numberView = renderInteractionRow({ visiblePaths: ["amount"] })
    const numberCell = await editableCell(numberView, "amount")
    numberCell.focus()
    fireEvent.keyDown(numberCell, { key: "7" })
    expect(numberView.getByRole("spinbutton")).toHaveProperty("value", "7")
    cleanup()

    const integerView = renderInteractionRow({ visiblePaths: ["count"] })
    const integerCell = await editableCell(integerView, "count")
    integerCell.focus()
    fireEvent.keyDown(integerCell, { key: "8" })
    expect(integerView.getByRole("spinbutton")).toHaveProperty("value", "8")
  })

  it("opens editors from Enter and F2 without replacing the current draft", async () => {
    for (const key of ["Enter", "F2"]) {
      const view = renderInteractionRow({ visiblePaths: ["vendor"] })
      const cell = await editableCell(view, "vendor")
      cell.focus()

      fireEvent.keyDown(cell, { key })

      expect(view.getByRole("textbox")).toHaveProperty("value", "ACME")
      cleanup()
    }
  })

  it("treats Space as printable text type-to-edit input", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] })
    const cell = await editableCell(view, "vendor")

    cell.focus()
    fireEvent.keyDown(cell, { key: " " })

    expect(view.getByRole("textbox")).toHaveProperty("value", " ")
  })

  it("ignores navigation keys and modified shortcuts before editing starts", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor", "amount"] })
    const vendorCell = await editableCell(view, "vendor")
    const amountCell = await editableCell(view, "amount")

    vendorCell.focus()
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "Tab"]) {
      fireEvent.keyDown(vendorCell, { key })
    }
    fireEvent.keyDown(vendorCell, { key: "a", metaKey: true })
    fireEvent.keyDown(vendorCell, { key: "a", ctrlKey: true })

    amountCell.focus()
    fireEvent.keyDown(amountCell, { key: "ArrowUp" })
    fireEvent.keyDown(amountCell, { key: "PageDown" })

    expect(view.queryByRole("textbox")).toBeNull()
    expect(view.queryByRole("spinbutton")).toBeNull()
  })

  it("guards type-to-edit while IME composition is active", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange,
    })
    const cell = await editableCell(view, "vendor")

    cell.focus()
    fireEvent.keyDown(cell, { key: "a", isComposing: true })

    expect(view.queryByRole("textbox")).toBeNull()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("saves text edits on blur, Enter, and Escape through the current blur path", async () => {
    for (const [key, value] of [
      ["blur", "BlurCo"],
      ["Enter", "EnterCo"],
      ["Escape", "EscapeCo"],
    ] as const) {
      const onDocumentDataChange = vi.fn()
      const view = renderInteractionRow({
        visiblePaths: ["vendor"],
        onDocumentDataChange,
      })

      await activateCell(view, "vendor")
      const input = view.getByRole("textbox")
      fireEvent.change(input, { target: { value } })
      if (key === "blur") {
        fireEvent.blur(input)
      } else {
        fireEvent.keyDown(input, { key })
      }

      expect(onDocumentDataChange).toHaveBeenCalledWith(
        "doc_1",
        "vendor",
        value
      )
      expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it("saves number edits on blur, Enter, and Escape through the current blur path", async () => {
    for (const [key, rawValue, committedValue] of [
      ["blur", "45.25", 45.25],
      ["Enter", "46.5", 46.5],
      ["Escape", "47.75", 47.75],
    ] as const) {
      const onDocumentDataChange = vi.fn()
      const view = renderInteractionRow({
        visiblePaths: ["amount"],
        onDocumentDataChange,
      })

      await activateCell(view, "amount")
      const input = view.getByRole("spinbutton")
      fireEvent.change(input, { target: { value: rawValue } })
      if (key === "blur") {
        fireEvent.blur(input)
      } else {
        fireEvent.keyDown(input, { key })
      }

      expect(onDocumentDataChange).toHaveBeenCalledWith(
        "doc_1",
        "amount",
        committedValue
      )
      expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it("does not save unchanged equivalent text or numeric drafts", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "amount", "count"],
      onDocumentDataChange,
    })

    await activateCell(view, "vendor")
    fireEvent.blur(view.getByRole("textbox"))

    await activateCell(view, "amount")
    const amountInput = view.getByRole("spinbutton")
    fireEvent.change(amountInput, { target: { value: "12.50" } })
    fireEvent.blur(amountInput)

    await activateCell(view, "count")
    fireEvent.blur(view.getByRole("spinbutton"))

    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("commits empty nullable and non-nullable text fields as null", async () => {
    for (const fieldPath of ["vendor", "note"]) {
      const onDocumentDataChange = vi.fn()
      const view = renderInteractionRow({
        visiblePaths: [fieldPath],
        onDocumentDataChange,
      })

      await activateCell(view, fieldPath)
      const input = view.getByRole("textbox")
      fireEvent.change(input, { target: { value: "" } })
      fireEvent.blur(input)

      expect(onDocumentDataChange).toHaveBeenCalledWith(
        "doc_1",
        fieldPath,
        null
      )
      expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it("commits empty non-nullable number and integer fields as null", async () => {
    for (const fieldPath of ["amount", "count"]) {
      const onDocumentDataChange = vi.fn()
      const view = renderInteractionRow({
        visiblePaths: [fieldPath],
        onDocumentDataChange,
      })

      await activateCell(view, fieldPath)
      const input = view.getByRole("spinbutton")
      fireEvent.change(input, { target: { value: "" } })
      fireEvent.blur(input)

      expect(onDocumentDataChange).toHaveBeenCalledWith(
        "doc_1",
        fieldPath,
        null
      )
      expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it("commits currently invalid numeric drafts as null", async () => {
    const invalidNumberChange = vi.fn()
    const numberView = renderInteractionRow({
      visiblePaths: ["amount"],
      onDocumentDataChange: invalidNumberChange,
    })
    await activateCell(numberView, "amount")
    const numberInput = numberView.getByRole("spinbutton")
    fireEvent.change(numberInput, { target: { value: "-" } })
    expect(inputValue(numberInput)).toBe("")
    fireEvent.blur(numberInput)
    expect(invalidNumberChange).toHaveBeenCalledWith("doc_1", "amount", null)
    cleanup()

    const invalidIntegerChange = vi.fn()
    const integerView = renderInteractionRow({
      visiblePaths: ["count"],
      onDocumentDataChange: invalidIntegerChange,
    })
    await activateCell(integerView, "count")
    const integerInput = integerView.getByRole("spinbutton")
    fireEvent.change(integerInput, { target: { value: "3.5" } })
    expect(inputValue(integerInput)).toBe("3.5")
    fireEvent.blur(integerInput)
    expect(invalidIntegerChange).toHaveBeenCalledWith("doc_1", "count", null)
  })

  it("does not reset a dirty draft when the active cell is clicked again", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] })
    const cell = await activateCell(view, "vendor")
    const input = view.getByRole("textbox")

    fireEvent.change(input, { target: { value: "draft vendor" } })
    pointerActivateCell(cell)

    expect(view.getByRole("textbox")).toHaveProperty("value", "draft vendor")
  })

  it("commits a dirty text draft before switching into a number cell", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      visiblePaths: ["vendor", "amount"],
      onUpdateDocument,
    })

    pointerActivateCell(await virtualCell(view, "vendor"))
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "Globex" },
    })
    pointerActivateCell(await virtualCell(view, "amount"))

    expect(view.getByRole("spinbutton")).toHaveProperty("value", "12.5")
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...interactionDocument.data, vendor: "Globex" },
    })
    expect(onUpdateDocument).toHaveBeenCalledTimes(1)
  })

  it("commits a dirty number draft before switching into a text cell", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      visiblePaths: ["amount", "vendor"],
      onUpdateDocument,
    })

    pointerActivateCell(await virtualCell(view, "amount"))
    fireEvent.change(view.getByRole("spinbutton"), {
      target: { value: "19.75" },
    })
    pointerActivateCell(await virtualCell(view, "vendor"))

    expect(view.getByRole("textbox")).toHaveProperty("value", "ACME")
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...interactionDocument.data, amount: 19.75 },
    })
    expect(onUpdateDocument).toHaveBeenCalledTimes(1)
  })

  it("composes rapid sequential text and number commits against pending table data", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      visiblePaths: ["vendor", "amount", "count"],
      onUpdateDocument,
    })

    pointerActivateCell(await virtualCell(view, "vendor"))
    const vendorInput = view.getByRole("textbox")
    fireEvent.change(vendorInput, { target: { value: "Globex" } })
    fireEvent.blur(vendorInput)

    pointerActivateCell(await virtualCell(view, "amount"))
    const amountInput = view.getByRole("spinbutton")
    fireEvent.change(amountInput, { target: { value: "20.5" } })
    fireEvent.blur(amountInput)

    pointerActivateCell(await virtualCell(view, "count"))
    const countInput = view.getByRole("spinbutton")
    fireEvent.change(countInput, { target: { value: "9" } })
    fireEvent.blur(countInput)

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(3))
    expect(onUpdateDocument).toHaveBeenNthCalledWith(1, {
      data: { ...interactionDocument.data, vendor: "Globex" },
    })
    expect(onUpdateDocument).toHaveBeenNthCalledWith(2, {
      data: { ...interactionDocument.data, vendor: "Globex", amount: 20.5 },
    })
    expect(onUpdateDocument).toHaveBeenNthCalledWith(3, {
      data: {
        ...interactionDocument.data,
        vendor: "Globex",
        amount: 20.5,
        count: 9,
      },
    })
  })

  it("keeps read-only text and number cells inert for pointer and keyboard activation", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "amount", "count"],
      isJsonEditable: false,
      onDocumentDataChange,
    })

    for (const fieldPath of ["vendor", "amount", "count"]) {
      const cell = findReadonlyCell(view.container, fieldPath)
      pointerActivateCell(cell)
      fireEvent.keyDown(cell, { key: "Enter" })
      fireEvent.keyDown(cell, { key: "F2" })
      fireEvent.keyDown(cell, { key: "x" })
    }

    expect(view.queryByRole("textbox")).toBeNull()
    expect(view.queryByRole("spinbutton")).toBeNull()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("keeps right-click and auxiliary pointer activation inert", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "amount"],
      onDocumentDataChange,
    })

    fireEvent.pointerDown(await editableCell(view, "vendor"), { button: 2 })
    fireEvent.pointerDown(await editableCell(view, "amount"), { button: 1 })

    expect(view.queryByRole("textbox")).toBeNull()
    expect(view.queryByRole("spinbutton")).toBeNull()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })
})
