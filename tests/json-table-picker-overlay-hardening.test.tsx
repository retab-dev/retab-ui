// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  getFieldMetadata,
  type FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table"

import {
  findEditableCell,
  findReadonlyCell,
  interactionDocument,
  interactionSchema,
  interactionVisibleColumn,
  projectedRowsFor,
  renderInteractionRow,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

const originalNode = globalThis.Node

beforeAll(() => {
  installJsonTableDom()
})

afterEach(() => cleanup())

type RenderedView = ReturnType<typeof renderInteractionRow>

function pickerPopup() {
  return document.querySelector<HTMLElement>(
    '[data-slot="data-cell-picker-popup"]'
  )
}

function pickerPopups() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-slot="data-cell-picker-popup"]'
    )
  )
}

function pickerTrigger(view: RenderedView, fieldPath: string) {
  const cell = findReadonlyCell(view.container, fieldPath)
  const trigger = cell.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"][aria-haspopup="dialog"]'
  )
  if (!trigger) throw new Error(`Expected picker trigger for ${fieldPath}`)
  return trigger
}

function timeInput() {
  const input = document.querySelector<HTMLInputElement>('input[type="time"]')
  if (!input) throw new Error("Expected time input")
  return input
}

function isoDateFromDayAttribute(day: string) {
  const [month, date, year] = day.split("/").map(Number)
  if (!month || !date || !year) throw new Error(`Invalid day ${day}`)
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(
    2,
    "0"
  )}`
}

function selectableDay() {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button[data-day]")
  ).find((candidate) => !candidate.disabled)
  const day = button?.getAttribute("data-day")
  if (!button || !day) throw new Error("Expected selectable day button")
  return { button, isoDate: isoDateFromDayAttribute(day) }
}

async function activatePickerCell(view: RenderedView, fieldPath: string) {
  fireEvent.pointerDown(await editableCell(view, fieldPath), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  })
}

async function editableCell(view: RenderedView, fieldPath: string) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

async function openPicker(view: RenderedView, fieldPath: string) {
  await activatePickerCell(view, fieldPath)
  await view.findByRole("dialog")
  return pickerTrigger(view, fieldPath)
}

async function expectPopupClosed(view: Pick<RenderedView, "queryByRole">) {
  await waitFor(() => expect(view.queryByRole("dialog")).toBeNull())
  expect(pickerPopup()).toBeNull()
}

function outsidePointerDown() {
  Object.assign(globalThis, { Node: window.Node })
  fireEvent.pointerDown(document.body, {
    button: 0,
    clientX: 500,
    clientY: 500,
    detail: 1,
    pointerId: 2,
    pointerType: "mouse",
  })
  Object.assign(globalThis, { Node: originalNode })
}

function expectOpenAriaLink(trigger: HTMLButtonElement) {
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  const controls = trigger.getAttribute("aria-controls")
  expect(controls).toBeTruthy()
  expect(document.getElementById(controls ?? "")).toBe(pickerPopup())
}

describe("json table picker overlay hardening", () => {
  it.each([
    ["date", "shipped_at"],
    ["time", "shipped_time"],
    ["date-time", "reviewed_at"],
  ])("opens %s picker overlays on the first click", async (_, fieldPath) => {
    const view = renderInteractionRow({ visiblePaths: [fieldPath] })

    const trigger = await openPicker(view, fieldPath)

    expect(pickerPopups()).toHaveLength(1)
    expectOpenAriaLink(trigger)
  })

  it("links aria-expanded and aria-controls to the mounted popup while open", async () => {
    const view = renderInteractionRow({ visiblePaths: ["shipped_at"] })

    const trigger = await openPicker(view, "shipped_at")

    expectOpenAriaLink(trigger)
    expect(pickerPopup()?.getAttribute("role")).toBe("dialog")
  })

  it.each([
    ["date", "shipped_at"],
    ["time", "shipped_time"],
    ["date-time", "reviewed_at"],
  ])(
    "closes %s picker overlays on outside click without committing",
    async (_, fieldPath) => {
      const onDocumentDataChange = vi.fn()
      const view = renderInteractionRow({
        visiblePaths: [fieldPath],
        onDocumentDataChange,
      })

      await openPicker(view, fieldPath)
      outsidePointerDown()

      await expectPopupClosed(view)
      expect(onDocumentDataChange).not.toHaveBeenCalled()
    }
  )

  it.each([
    ["date", "shipped_at"],
    ["time", "shipped_time"],
    ["date-time", "reviewed_at"],
  ])(
    "closes %s picker overlays on Escape without committing",
    async (_, fieldPath) => {
      const onDocumentDataChange = vi.fn()
      const view = renderInteractionRow({
        visiblePaths: [fieldPath],
        onDocumentDataChange,
      })

      await openPicker(view, fieldPath)
      fireEvent.keyDown(document, { key: "Escape" })

      await expectPopupClosed(view)
      expect(onDocumentDataChange).not.toHaveBeenCalled()
    }
  )

  it("commits date selections and closes the picker session", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onDocumentDataChange,
    })

    await openPicker(view, "shipped_at")
    const { button, isoDate } = selectableDay()
    fireEvent.click(button)

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        "doc_1",
        "shipped_at",
        isoDate
      )
    )
    await expectPopupClosed(view)
  })

  it("commits date-time date selections and keeps the picker open", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["reviewed_at"],
      onDocumentDataChange,
    })

    const trigger = await openPicker(view, "reviewed_at")
    const { button, isoDate } = selectableDay()
    fireEvent.click(button)

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        "doc_1",
        "reviewed_at",
        `${isoDate}T09:30`
      )
    )
    expect(pickerPopup()).toBeTruthy()
    expectOpenAriaLink(trigger)
  })

  it("commits pure time changes and keeps the picker open", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_time"],
      onDocumentDataChange,
    })

    const trigger = await openPicker(view, "shipped_time")
    fireEvent.change(timeInput(), { target: { value: "10:45" } })

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      "doc_1",
      "shipped_time",
      "10:45:00"
    )
    expect(pickerPopup()).toBeTruthy()
    expectOpenAriaLink(trigger)
  })

  it("commits date-time time changes and keeps the picker open", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["reviewed_at"],
      onDocumentDataChange,
    })

    const trigger = await openPicker(view, "reviewed_at")
    fireEvent.change(timeInput(), { target: { value: "10:45" } })

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      "doc_1",
      "reviewed_at",
      "2024-01-02T10:45"
    )
    expect(pickerPopup()).toBeTruthy()
    expectOpenAriaLink(trigger)
  })

  it("commits cleared time values as null and keeps the picker open", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_time"],
      onDocumentDataChange,
    })

    const trigger = await openPicker(view, "shipped_time")
    fireEvent.change(timeInput(), { target: { value: "" } })

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      "doc_1",
      "shipped_time",
      null
    )
    expect(pickerPopup()).toBeTruthy()
    expectOpenAriaLink(trigger)
  })

  it("cleans the previous picker overlay when switching picker cells", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at", "shipped_time", "reviewed_at"],
      onDocumentDataChange,
    })

    await openPicker(view, "shipped_at")
    const firstPopup = pickerPopup()
    expect(firstPopup).toBeTruthy()

    await activatePickerCell(view, "reviewed_at")
    await view.findByRole("dialog")

    expect(pickerPopups()).toHaveLength(1)
    expect(pickerPopup()).not.toBe(firstPopup)
    expect(
      pickerTrigger(view, "reviewed_at").getAttribute("aria-expanded")
    ).toBe("true")
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("removes the picker overlay when the row unmounts", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onDocumentDataChange,
    })

    await openPicker(view, "shipped_at")
    view.unmount()

    expect(pickerPopup()).toBeNull()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("keeps read-only picker cells inert", () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at", "shipped_time", "reviewed_at"],
      isJsonEditable: false,
      onDocumentDataChange,
    })

    for (const fieldPath of ["shipped_at", "shipped_time", "reviewed_at"]) {
      fireEvent.pointerDown(findReadonlyCell(view.container, fieldPath), {
        button: 0,
        clientX: 0,
        clientY: 0,
        detail: 1,
      })
    }

    expect(pickerPopup()).toBeNull()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("survives repeated open and close cycles without stale popups", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onDocumentDataChange,
    })

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const trigger = await openPicker(view, "shipped_at")
      expectOpenAriaLink(trigger)

      if (cycle % 2 === 0) outsidePointerDown()
      else fireEvent.keyDown(document, { key: "Escape" })

      await expectPopupClosed(view)
      expect(pickerPopups()).toHaveLength(0)
    }

    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("focuses the picker trigger while the overlay is open", async () => {
    const view = renderInteractionRow({ visiblePaths: ["shipped_at"] })

    const trigger = await openPicker(view, "shipped_at")

    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

const virtualSchema: JSONSchema7 = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          shipped_at: { type: "string", format: "date" },
          label: { type: "string" },
        },
      },
    },
  },
}

function requireFieldMetadata(key: string): FieldMetadata {
  const fieldMetadata = getFieldMetadata(virtualSchema, key)
  if (!fieldMetadata) throw new Error(`Missing field metadata for ${key}`)
  return fieldMetadata
}

function visibleColumn(key: string): VisibleColumn {
  return {
    key,
    widthPx: 180,
    fieldMetadata: requireFieldMetadata(key),
  }
}

function headerNode(key: string): JsonTableHeaderNode {
  const fieldMetadata = requireFieldMetadata(key)

  return {
    key,
    label: key,
    propName: key.split(".").at(-1) ?? key,
    parentPath: "",
    rawSchema: fieldMetadata.rawSchema,
    schema: fieldMetadata.schema,
    effectiveType:
      fieldMetadata.kind === "date-time" ? "datetime" : fieldMetadata.kind,
    isObject: fieldMetadata.kind === "object",
    isArray: fieldMetadata.kind === "array",
    canFold: false,
    isExpanded: true,
  }
}

function renderVirtualPickerTable({
  tableDocument,
  visiblePaths,
  overscan = 1,
}: {
  tableDocument: TableDocument
  visiblePaths: string[]
  overscan?: number
}) {
  return render(
    <SingleFileVirtualizedTable
      headerNodes={visiblePaths.map(headerNode)}
      document={tableDocument}
      schema={virtualSchema}
      setSchema={vi.fn()}
      isPublished={false}
      stopAt={[]}
      setStopAt={vi.fn()}
      draggedItemKeyRef={{ current: null }}
      draggedItemParentPathRef={{ current: null }}
      jsonEditMode="editable"
      schemaEditMode="readOnly"
      projectedRows={projectedRowsFor({
        document: tableDocument,
        visiblePaths,
      })}
      visibleColumns={visiblePaths.map(visibleColumn)}
      rowCount={
        projectedRowsFor({ document: tableDocument, visiblePaths }).length
      }
      onUpdateDocument={vi.fn(async () => undefined)}
      columnWidth="xxl"
      overscan={overscan}
      jumpOverscan={overscan}
    />
  )
}

function virtualCellByFieldPath(container: HTMLElement, fieldPath: string) {
  const cell = container.querySelector<HTMLElement>(
    `[data-field-path="${fieldPath}"]`
  )
  if (!cell) throw new Error(`Missing virtual cell ${fieldPath}`)
  return cell
}

function installSynchronousAnimationFrame() {
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame
  const previousWindowRequestAnimationFrame = window.requestAnimationFrame
  const previousWindowCancelAnimationFrame = window.cancelAnimationFrame

  const requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }
  const cancelAnimationFrame = vi.fn()

  globalThis.requestAnimationFrame = requestAnimationFrame
  globalThis.cancelAnimationFrame = cancelAnimationFrame
  window.requestAnimationFrame = requestAnimationFrame
  window.cancelAnimationFrame = cancelAnimationFrame

  return () => {
    globalThis.requestAnimationFrame = previousRequestAnimationFrame
    globalThis.cancelAnimationFrame = previousCancelAnimationFrame
    window.requestAnimationFrame = previousWindowRequestAnimationFrame
    window.cancelAnimationFrame = previousWindowCancelAnimationFrame
  }
}

describe("json table virtualized picker overlay cleanup", () => {
  it("removes the picker overlay when virtualization unmounts the active row", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const tableDocument: TableDocument = {
      id: "doc_lines",
      data: {
        lines: Array.from({ length: 40 }, (_, index) => ({
          label: `line ${index}`,
          shipped_at: "2024-01-02",
        })),
      },
    }
    const view = renderVirtualPickerTable({
      tableDocument,
      visiblePaths: ["lines.*.shipped_at", "lines.*.label"],
    })

    try {
      await waitFor(() =>
        expect(
          virtualCellByFieldPath(view.container, "lines.0.shipped_at")
        ).toBeTruthy()
      )

      fireEvent.pointerDown(
        virtualCellByFieldPath(view.container, "lines.0.shipped_at"),
        {
          button: 0,
          clientX: 0,
          clientY: 0,
          detail: 1,
          pointerId: 1,
          pointerType: "mouse",
        }
      )
      expect(await view.findByRole("dialog")).toBeTruthy()

      const viewport = view.container.querySelector<HTMLElement>(
        '[data-slot="json-table-scroll"]'
      )
      if (!viewport) throw new Error("Missing json table viewport")
      Object.defineProperty(viewport, "clientHeight", {
        configurable: true,
        value: 64,
      })

      await act(async () => {
        viewport.scrollTop = 32 * 12
        fireEvent.scroll(viewport)
      })

      await waitFor(() =>
        expect(
          view.container.querySelector('[data-field-path="lines.0.shipped_at"]')
        ).toBeNull()
      )
      await expectPopupClosed(view)
    } finally {
      restoreAnimationFrame()
    }
  })
})
