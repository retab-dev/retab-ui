// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  findEditableCell,
  findReadonlyCell,
  primitivePendingCellCommit,
  renderInteractionRow,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

const originalNode = globalThis.Node

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

async function editableCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

function pickerPopup() {
  return document.querySelector('[data-slot="data-cell-picker-popup"]')
}

function pickerTrigger() {
  const trigger = document.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"][aria-haspopup="dialog"]'
  )
  if (!trigger) throw new Error("Expected picker trigger to render")
  return trigger
}

function dayButton(day: string) {
  const button = document.querySelector<HTMLButtonElement>(
    `button[data-day="${day}"]`
  )
  if (!button) throw new Error(`Expected day button ${day} to render`)
  return button
}

function primitiveEventTarget(cell: HTMLElement) {
  return (
    cell.querySelector<HTMLElement>(
      '[data-slot="input-control"], [data-slot="data-cell"]'
    ) ?? cell
  )
}

async function activatePickerCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  fireEvent.pointerDown(primitiveEventTarget(await editableCell(view, fieldPath)), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
}

describe("json table date and time picker interactions", () => {
  it("opens date pickers on first click with table-controlled overlay state", async () => {
    const view = renderInteractionRow({ visiblePaths: ["shipped_at"] })
    const displayText = (await editableCell(view, "shipped_at")).textContent

    await activatePickerCell(view, "shipped_at")

    expect(await view.findByRole("dialog")).toBeTruthy()
    const trigger = pickerTrigger()
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true")
    })
    expect(trigger.getAttribute("aria-controls")).toBe(
      pickerPopup()?.getAttribute("id")
    )
    expect(trigger.textContent).toBe(displayText)
  })

  it("closes date pickers on outside click and Escape without committing", async () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onCellCommit,
    })

    await activatePickerCell(view, "shipped_at")
    expect(await view.findByRole("dialog")).toBeTruthy()

    Object.assign(globalThis, { Node: window.Node })
    fireEvent.pointerDown(document.body)
    Object.assign(globalThis, { Node: originalNode })

    await waitFor(() => {
      expect(pickerPopup()).toBeNull()
    })
    expect(onCellCommit).not.toHaveBeenCalled()

    await activatePickerCell(view, "shipped_at")
    expect(await view.findByRole("dialog")).toBeTruthy()

    fireEvent.keyDown(document, { key: "Escape" })

    await waitFor(() => {
      expect(pickerPopup()).toBeNull()
    })
    expect(onCellCommit).not.toHaveBeenCalled()
  })

  it("commits date selections and closes the session", async () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onCellCommit,
    })

    await activatePickerCell(view, "shipped_at")
    expect(await view.findByRole("dialog")).toBeTruthy()
    fireEvent.click(dayButton("1/15/2024"))

    await waitFor(() => {
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "shipped_at",
          previousValue: "2024-01-02",
          value: "2024-01-15",
        })
      )
    })
    expect(pickerPopup()).toBeNull()
  })

  it("commits time changes and keeps the picker open", async () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_time"],
      onCellCommit,
    })

    await activatePickerCell(view, "shipped_time")
    expect(await view.findByRole("dialog")).toBeTruthy()

    fireEvent.change(view.getByDisplayValue("09:30:00"), {
      target: { value: "10:45" },
    })

    expect(onCellCommit).toHaveBeenCalledWith(
      primitivePendingCellCommit({
        fieldPath: "shipped_time",
        previousValue: "09:30:00",
        value: "10:45:00",
      })
    )
    expect(pickerPopup()).toBeTruthy()
    expect(pickerTrigger().getAttribute("aria-expanded")).toBe("true")
  })

  it("commits date-time date selections and keeps the picker open", async () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["reviewed_at"],
      onCellCommit,
    })

    await activatePickerCell(view, "reviewed_at")
    expect(await view.findByRole("dialog")).toBeTruthy()
    fireEvent.click(dayButton("1/15/2024"))

    await waitFor(() => {
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "reviewed_at",
          previousValue: "2024-01-02T09:30:00Z",
          value: "2024-01-15T09:30",
        })
      )
    })
    expect(pickerPopup()).toBeTruthy()
    expect(pickerTrigger().getAttribute("aria-expanded")).toBe("true")
  })

  it("commits cleared time edits as null and keeps the picker open", async () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_time"],
      onCellCommit,
    })

    await activatePickerCell(view, "shipped_time")
    expect(await view.findByRole("dialog")).toBeTruthy()

    fireEvent.change(view.getByDisplayValue("09:30:00"), {
      target: { value: "" },
    })

    expect(onCellCommit).toHaveBeenCalledWith(
      primitivePendingCellCommit({
        fieldPath: "shipped_time",
        previousValue: "09:30:00",
        value: null,
      })
    )
    expect(pickerPopup()).toBeTruthy()
    expect(pickerTrigger().getAttribute("aria-expanded")).toBe("true")
  })

  it("keeps read-only date cells inert", () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      isJsonEditable: false,
      onCellCommit,
    })
    const cell = findReadonlyCell(view.container, "shipped_at")

    fireEvent.pointerDown(primitiveEventTarget(cell), { button: 0 })

    expect(cell.getAttribute("data-json-table-editable-cell")).toBeNull()
    expect(pickerPopup()).toBeNull()
    expect(onCellCommit).not.toHaveBeenCalled()
  })
})
