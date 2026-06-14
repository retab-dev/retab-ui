// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { JsonTableActiveCell } from "@/components/json-table/json-table-edit-session"

import {
  findEditableCell,
  primitiveEventTarget,
  renderInteractionRow,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

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

async function activateCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  const cell = await editableCell(view, fieldPath)
  fireEvent.pointerDown(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  return cell
}

function latestSession(sessions: Array<JsonTableActiveCell | null>) {
  return sessions[sessions.length - 1]
}

describe("json table text and number interactions", () => {
  it("focuses the text input on first click without mounting it on hover", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] })
    const cell = await editableCell(view, "vendor")

    fireEvent.pointerEnter(cell)
    expect(view.queryByRole("textbox")).toBeNull()

    fireEvent.pointerDown(primitiveEventTarget(cell), {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    })

    const input = view.getByRole("textbox")
    expect(globalThis.document.activeElement).toBe(input)
    expect(input).toHaveProperty("value", "ACME")
  })

  it("saves text edits on blur and Enter, then cancels them on Escape", async () => {
    const onBlurChange = vi.fn()
    const blurView = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit: onBlurChange,
    })
    await activateCell(blurView, "vendor")
    fireEvent.change(blurView.getByRole("textbox"), {
      target: { value: "Globex" },
    })
    fireEvent.blur(blurView.getByRole("textbox"))
    expect(onBlurChange).toHaveBeenCalledWith({
      fieldPath: "vendor",
      value: "Globex",
      previousValue: "ACME",
      visibleThrough: "primitivePendingValue",
    })
    cleanup()

    const onEnterChange = vi.fn()
    const enterView = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit: onEnterChange,
    })
    await activateCell(enterView, "vendor")
    fireEvent.change(enterView.getByRole("textbox"), {
      target: { value: "Initech" },
    })
    fireEvent.keyDown(enterView.getByRole("textbox"), { key: "Enter" })
    expect(onEnterChange).toHaveBeenCalledWith({
      fieldPath: "vendor",
      value: "Initech",
      previousValue: "ACME",
      visibleThrough: "primitivePendingValue",
    })
    cleanup()

    const onEscapeChange = vi.fn()
    const escapeView = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit: onEscapeChange,
    })
    await activateCell(escapeView, "vendor")
    fireEvent.change(escapeView.getByRole("textbox"), {
      target: { value: "Umbrella" },
    })
    fireEvent.keyDown(escapeView.getByRole("textbox"), { key: "Escape" })
    expect(onEscapeChange).not.toHaveBeenCalled()
  })

  it("does not save unchanged text values", async () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit,
    })

    await activateCell(view, "vendor")
    fireEvent.blur(view.getByRole("textbox"))

    expect(onCellCommit).not.toHaveBeenCalled()
  })

  it("commits empty text and number cells as null", async () => {
    const onTextChange = vi.fn()
    const textView = renderInteractionRow({
      visiblePaths: ["note"],
      onCellCommit: onTextChange,
    })
    await activateCell(textView, "note")
    fireEvent.change(textView.getByRole("textbox"), { target: { value: "" } })
    fireEvent.blur(textView.getByRole("textbox"))
    expect(onTextChange).toHaveBeenCalledWith({
      fieldPath: "note",
      value: null,
      previousValue: "memo",
      visibleThrough: "primitivePendingValue",
    })
    cleanup()

    const onNumberChange = vi.fn()
    const numberView = renderInteractionRow({
      visiblePaths: ["amount"],
      onCellCommit: onNumberChange,
    })
    await activateCell(numberView, "amount")
    fireEvent.change(numberView.getByRole("spinbutton"), {
      target: { value: "" },
    })
    fireEvent.blur(numberView.getByRole("spinbutton"))
    expect(onNumberChange).toHaveBeenCalledWith({
      fieldPath: "amount",
      value: null,
      previousValue: 12.5,
      visibleThrough: "primitivePendingValue",
    })
  })

  it("saves valid numbers and commits invalid integer drafts as null", async () => {
    const onValidNumberChange = vi.fn()
    const numberView = renderInteractionRow({
      visiblePaths: ["amount"],
      onCellCommit: onValidNumberChange,
    })
    await activateCell(numberView, "amount")
    fireEvent.change(numberView.getByRole("spinbutton"), {
      target: { value: "45.75" },
    })
    fireEvent.blur(numberView.getByRole("spinbutton"))
    expect(onValidNumberChange).toHaveBeenCalledWith({
      fieldPath: "amount",
      value: 45.75,
      previousValue: 12.5,
      visibleThrough: "primitivePendingValue",
    })
    cleanup()

    const onInvalidIntegerChange = vi.fn()
    const integerView = renderInteractionRow({
      visiblePaths: ["count"],
      onCellCommit: onInvalidIntegerChange,
    })
    await activateCell(integerView, "count")
    fireEvent.change(integerView.getByRole("spinbutton"), {
      target: { value: "3.5" },
    })
    fireEvent.blur(integerView.getByRole("spinbutton"))
    expect(onInvalidIntegerChange).toHaveBeenCalledWith({
      fieldPath: "count",
      value: null,
      previousValue: 3,
      visibleThrough: "primitivePendingValue",
    })
  })

  it("seeds text and number drafts from type-to-edit keyboard input", async () => {
    const textView = renderInteractionRow({ visiblePaths: ["vendor"] })
    const textCell = await editableCell(textView, "vendor")
    primitiveEventTarget(textCell).focus()
    fireEvent.keyDown(primitiveEventTarget(textCell), { key: "Z" })
    expect(textView.getByRole("textbox")).toHaveProperty("value", "Z")
    cleanup()

    const numberView = renderInteractionRow({ visiblePaths: ["amount"] })
    const numberCell = await editableCell(numberView, "amount")
    primitiveEventTarget(numberCell).focus()
    fireEvent.keyDown(primitiveEventTarget(numberCell), { key: "7" })
    expect(numberView.getByRole("spinbutton")).toHaveProperty("value", "7")
  })

  it("does not edit on right click", async () => {
    const sessions: Array<JsonTableActiveCell | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "amount"],
      onEditSessionChange: (session) => sessions.push(session),
    })

    fireEvent.pointerDown(
      primitiveEventTarget(await editableCell(view, "vendor")),
      { button: 2 }
    )
    fireEvent.pointerDown(
      primitiveEventTarget(await editableCell(view, "amount")),
      { button: 2 }
    )

    expect(view.queryByRole("textbox")).toBeNull()
    expect(view.queryByRole("spinbutton")).toBeNull()
    expect(sessions).toEqual([])
  })

  it("does not reset the draft when clicking an already-active cell", async () => {
    const sessions: Array<JsonTableActiveCell | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onEditSessionChange: (session) => sessions.push(session),
    })
    const cell = await activateCell(view, "vendor")
    const startedActiveFieldPath = latestSession(sessions)?.fieldPath

    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "draft vendor" },
    })
    fireEvent.pointerDown(primitiveEventTarget(cell), {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    })

    expect(view.getByRole("textbox")).toHaveProperty("value", "draft vendor")
    expect(latestSession(sessions)?.fieldPath).toBe(startedActiveFieldPath)
  })
})
