// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { JsonTableEditSession } from "@/components/json-table/json-table-edit-session"

import {
  findEditableCell,
  interactionDocument,
  renderInteractionRow,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => {
  cleanup()
  document.body.removeAttribute("style")
  document.documentElement.removeAttribute("style")
  vi.restoreAllMocks()
})

type RenderedView = ReturnType<typeof renderInteractionRow>

async function editableCell(view: RenderedView, fieldPath: string) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

async function renderedCell(view: RenderedView, fieldPath: string) {
  return waitFor(() => {
    const cell = view.container.querySelector<HTMLElement>(
      `td[data-field-path="${fieldPath}"]`
    )
    if (!cell) throw new Error(`Expected rendered cell for ${fieldPath}`)
    return cell
  })
}

function keyDown(target: HTMLElement | Document, key: string, init = {}) {
  fireEvent.keyDown(target, { key, ...init })
}

function pointerActivateCell(cell: HTMLElement) {
  fireEvent.pointerDown(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  })
}

async function keyboardActivateCell(
  view: RenderedView,
  fieldPath: string,
  key: string
) {
  const cell = await editableCell(view, fieldPath)
  cell.focus()
  keyDown(cell, key)
  return cell
}

async function openEnum(view: RenderedView, fieldPath = "status") {
  const cell = await keyboardActivateCell(view, fieldPath, "Enter")
  const trigger = await view.findByRole("combobox")
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )
  return { cell, trigger }
}

async function chooseOption(option: HTMLElement) {
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

function pickerTrigger(view: RenderedView, fieldPath: string) {
  const cell = view.container.querySelector<HTMLElement>(
    `td[data-field-path="${fieldPath}"]`
  )
  const trigger = cell?.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"][aria-haspopup="dialog"]'
  )
  if (!trigger) throw new Error(`Expected picker trigger for ${fieldPath}`)
  return trigger
}

async function openPicker(view: RenderedView, fieldPath = "shipped_at") {
  const cell = await keyboardActivateCell(view, fieldPath, "Enter")
  const trigger = pickerTrigger(view, fieldPath)
  const popup = await view.findByRole("dialog")
  return { cell, trigger, popup }
}

function pickerPopup() {
  return document.querySelector<HTMLElement>(
    '[data-slot="data-cell-picker-popup"]'
  )
}

function expectAriaControlsTarget(trigger: HTMLElement, target: HTMLElement) {
  const controls = trigger.getAttribute("aria-controls")
  expect(controls).toBeTruthy()
  expect(document.getElementById(controls ?? "")).toBe(target)
}

function latestSession(sessions: Array<JsonTableEditSession | null>) {
  return sessions.at(-1)
}

describe("json table a11y and keyboard hardening", () => {
  it("makes editable cells tabbable and read-only cells non-tabbable", async () => {
    const editableView = renderInteractionRow({
      visiblePaths: ["vendor", "amount", "is_paid", "status", "shipped_at"],
    })

    for (const fieldPath of [
      "vendor",
      "amount",
      "is_paid",
      "status",
      "shipped_at",
    ]) {
      expect(
        (await editableCell(editableView, fieldPath)).getAttribute("tabindex")
      ).toBe("0")
    }

    cleanup()

    const readonlyView = renderInteractionRow({
      visiblePaths: ["vendor", "amount", "is_paid", "status", "shipped_at"],
      isJsonEditable: false,
    })

    for (const fieldPath of [
      "vendor",
      "amount",
      "is_paid",
      "status",
      "shipped_at",
    ]) {
      expect((await renderedCell(readonlyView, fieldPath)).tabIndex).toBe(-1)
    }
  })

  it.each(["Enter", "F2"] as const)(
    "opens text input from %s and retains focus inside the input",
    async (key) => {
      const view = renderInteractionRow({ visiblePaths: ["vendor"] })

      await keyboardActivateCell(view, "vendor", key)

      const input = view.getByRole("textbox")
      expect(input).toHaveProperty("value", "ACME")
      expect(document.activeElement).toBe(input)
    }
  )

  it("starts text type-to-edit from Space and printable characters", async () => {
    const spaceView = renderInteractionRow({ visiblePaths: ["vendor"] })
    await keyboardActivateCell(spaceView, "vendor", " ")
    expect(spaceView.getByRole("textbox")).toHaveProperty("value", " ")

    cleanup()

    const letterView = renderInteractionRow({ visiblePaths: ["vendor"] })
    await keyboardActivateCell(letterView, "vendor", "Z")
    expect(letterView.getByRole("textbox")).toHaveProperty("value", "Z")
  })

  it("starts number type-to-edit only from numeric characters", async () => {
    const digitView = renderInteractionRow({ visiblePaths: ["amount"] })
    await keyboardActivateCell(digitView, "amount", "7")
    expect(digitView.getByRole("spinbutton")).toHaveProperty("value", "7")

    cleanup()

    const spaceView = renderInteractionRow({ visiblePaths: ["amount"] })
    const cell = await editableCell(spaceView, "amount")
    cell.focus()
    keyDown(cell, " ")

    expect(spaceView.queryByRole("spinbutton")).toBeNull()
    expect(cell.getAttribute("data-active")).toBeNull()
  })

  it("toggles booleans from Space and only focuses the checkbox from Enter or F2", async () => {
    const onDocumentDataChange = vi.fn()
    const spaceView = renderInteractionRow({
      visiblePaths: ["is_paid"],
      onDocumentDataChange,
    })

    await keyboardActivateCell(spaceView, "is_paid", " ")

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        interactionDocument.id,
        "is_paid",
        true
      )
    )
    await waitFor(() =>
      expect(
        spaceView.container.querySelector('button[role="checkbox"]')
      ).toBeNull()
    )

    for (const key of ["Enter", "F2"] as const) {
      cleanup()
      const view = renderInteractionRow({
        visiblePaths: ["is_paid"],
        onDocumentDataChange,
      })

      await keyboardActivateCell(view, "is_paid", key)

      const checkbox = await view.findByRole("checkbox")
      expect(document.activeElement).toBe(checkbox)
      expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
    }
  })

  it("closes a focused boolean checkbox on Escape without committing", async () => {
    const onDocumentDataChange = vi.fn()
    const sessions: Array<JsonTableEditSession | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["is_paid"],
      onDocumentDataChange,
      onEditSessionChange: (session) => sessions.push(session),
    })
    const cell = await keyboardActivateCell(view, "is_paid", "Enter")
    const checkbox = await view.findByRole("checkbox")

    keyDown(checkbox, "Escape")

    await waitFor(() =>
      expect(
        view.container.querySelector('[data-mode="edit"] [role="checkbox"]')
      ).toBeNull()
    )
    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(latestSession(sessions)).toBeNull()
    expect(document.activeElement).toBe(cell)
  })

  it("ignores platform shortcuts and navigation keys before editing starts", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] })
    const cell = await editableCell(view, "vendor")

    cell.focus()
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "Tab"]) {
      keyDown(cell, key)
    }
    keyDown(cell, "a", { metaKey: true })
    keyDown(cell, "a", { ctrlKey: true })
    keyDown(cell, "a", { altKey: true })

    expect(view.queryByRole("textbox")).toBeNull()
    expect(cell.getAttribute("data-active")).toBeNull()
  })

  it("allows AltGraph printable input while keeping ordinary Ctrl+Alt shortcuts inert", async () => {
    const shortcutView = renderInteractionRow({ visiblePaths: ["vendor"] })
    const shortcutCell = await editableCell(shortcutView, "vendor")
    shortcutCell.focus()
    keyDown(shortcutCell, "e", { ctrlKey: true, altKey: true })
    expect(shortcutView.queryByRole("textbox")).toBeNull()

    cleanup()

    const altGraphView = renderInteractionRow({ visiblePaths: ["vendor"] })
    const altGraphCell = await editableCell(altGraphView, "vendor")
    altGraphCell.focus()
    keyDown(altGraphCell, "€", {
      ctrlKey: true,
      altKey: true,
      getModifierState: (modifier: string) => modifier === "AltGraph",
    })

    expect(altGraphView.getByRole("textbox")).toHaveProperty("value", "€")
  })

  it("ignores type-to-edit while IME composition is active", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] })
    const cell = await editableCell(view, "vendor")

    cell.focus()
    keyDown(cell, "あ", { isComposing: true })

    expect(view.queryByRole("textbox")).toBeNull()
    expect(cell.getAttribute("data-active")).toBeNull()
  })

  it("exposes enum combobox roles, open state, and aria-controls linkage", async () => {
    const view = renderInteractionRow({ visiblePaths: ["status"] })

    const { trigger } = await openEnum(view)

    expect(trigger.getAttribute("role")).toBe("combobox")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox")
    expectAriaControlsTarget(trigger, view.getByRole("listbox"))
    expect(view.getByRole("option", { name: "draft" })).toBeTruthy()
    expect(view.getByRole("option", { name: "approved" })).toBeTruthy()
  })

  it("closes enum on Escape without committing and returns focus to the table cell", async () => {
    const onDocumentDataChange = vi.fn()
    const sessions: Array<JsonTableEditSession | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onDocumentDataChange,
      onEditSessionChange: (session) => sessions.push(session),
    })
    const { cell, trigger } = await openEnum(view)

    keyDown(trigger, "Escape")

    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(latestSession(sessions)).toBeNull()
    expect(document.activeElement).toBe(cell)
  })

  it("cleans up enum focus after committing a selected option", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onDocumentDataChange,
    })
    const { cell } = await openEnum(view)

    await chooseOption(view.getByRole("option", { name: "approved" }))

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        interactionDocument.id,
        "status",
        "approved"
      )
    )
    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(document.activeElement).toBe(cell)
  })

  it("exposes picker button semantics, open state, and dialog aria-controls linkage", async () => {
    const view = renderInteractionRow({ visiblePaths: ["shipped_at"] })

    const { trigger, popup } = await openPicker(view)

    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(popup.getAttribute("role")).toBe("dialog")
    expectAriaControlsTarget(trigger, popup)
    expect(document.activeElement).toBe(trigger)
  })

  it("closes picker on Escape without committing and returns focus to the table cell", async () => {
    const onDocumentDataChange = vi.fn()
    const sessions: Array<JsonTableEditSession | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onDocumentDataChange,
      onEditSessionChange: (session) => sessions.push(session),
    })
    const { cell } = await openPicker(view)

    keyDown(document, "Escape")

    await waitFor(() => expect(pickerPopup()).toBeNull())
    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(latestSession(sessions)).toBeNull()
    expect(document.activeElement).toBe(cell)
  })

  it("keeps read-only cells keyboard inert across scalar, boolean, enum, and picker kinds", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "is_paid", "status", "shipped_at"],
      isJsonEditable: false,
      onDocumentDataChange,
    })

    for (const fieldPath of ["vendor", "is_paid", "status", "shipped_at"]) {
      const cell = await renderedCell(view, fieldPath)
      cell.focus()
      for (const key of ["Enter", "F2", " ", "x", "Escape"]) {
        keyDown(cell, key)
      }
      pointerActivateCell(cell)
    }

    expect(view.queryByRole("textbox")).toBeNull()
    expect(view.container.querySelector('button[role="checkbox"]')).toBeNull()
    expect(view.queryByRole("combobox")).toBeNull()
    expect(pickerPopup()).toBeNull()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("returns focus to the table cell after text commit from Enter", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange,
    })
    const cell = await editableCell(view, "vendor")
    pointerActivateCell(cell)
    const input = view.getByRole("textbox")

    fireEvent.change(input, { target: { value: "Focus Co" } })
    keyDown(input, "Enter")

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      interactionDocument.id,
      "vendor",
      "Focus Co"
    )
    await waitFor(() => expect(view.queryByRole("textbox")).toBeNull())
    expect(document.activeElement).toBe(cell)
  })
})
