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
  vi.restoreAllMocks()
})

async function editableCell(
  view: { container: HTMLElement },
  fieldPath = "status"
) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

function latestSession(sessions: Array<JsonTableEditSession | null>) {
  return sessions[sessions.length - 1]
}

function optionNames(view: {
  getAllByRole: (role: "option") => HTMLElement[]
}) {
  return view.getAllByRole("option").map((option) => option.textContent)
}

async function openEnumFromClick({
  fieldPath = "status",
  onDocumentDataChange = vi.fn(),
  onEditSessionChange = vi.fn(),
}: {
  fieldPath?: string
  onDocumentDataChange?: ReturnType<typeof vi.fn>
  onEditSessionChange?: (editSession: JsonTableEditSession | null) => void
} = {}) {
  const view = renderInteractionRow({
    visiblePaths: [fieldPath],
    onDocumentDataChange,
    onEditSessionChange,
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

  return { ...view, cell, trigger, onDocumentDataChange }
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

describe("json table enum accessibility interactions", () => {
  it("focuses the combobox and opens options on the first click activation", async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus")
    const view = await openEnumFromClick()

    expect(view.trigger.getAttribute("role")).toBe("combobox")
    expect(focusSpy.mock.contexts).toContain(view.trigger)
    expect(view.cell.getAttribute("data-active")).toBe("true")
    expect(optionNames(view)).toEqual(["draft", "approved", "option:1"])
  })

  it("exposes combobox and option roles while open", async () => {
    const view = await openEnumFromClick()

    expect(view.trigger.getAttribute("role")).toBe("combobox")
    expect(view.trigger.getAttribute("aria-expanded")).toBe("true")
    expect(view.trigger.getAttribute("aria-haspopup")).toBe("listbox")
    expect(view.getByRole("option", { name: "draft" })).toBeTruthy()
    expect(view.getByRole("option", { name: "approved" })).toBeTruthy()
    expect(view.getByRole("option", { name: "option:1" })).toBeTruthy()
  })

  it("closes on Escape without committing and removes the active session", async () => {
    const sessions: Array<JsonTableEditSession | null> = []
    const onDocumentDataChange = vi.fn()
    const view = await openEnumFromClick({
      onDocumentDataChange,
      onEditSessionChange: (editSession) => sessions.push(editSession),
    })

    fireEvent.keyDown(view.trigger, { key: "Escape" })

    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(view.cell.getAttribute("data-active")).toBeNull()
    expect(latestSession(sessions)).toBeNull()
  })

  it("closes on outside pointer without committing and removes the active session", async () => {
    const sessions: Array<JsonTableEditSession | null> = []
    const onDocumentDataChange = vi.fn()
    const view = await openEnumFromClick({
      onDocumentDataChange,
      onEditSessionChange: (editSession) => sessions.push(editSession),
    })

    fireEvent.pointerDown(document.body)

    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(view.cell.getAttribute("data-active")).toBeNull()
    expect(latestSession(sessions)).toBeNull()
  })

  it.each(["Enter", "F2", " "] as const)(
    "opens enum options from %s keyboard activation",
    async (key) => {
      const view = renderInteractionRow({ visiblePaths: ["status"] })
      const cell = await editableCell(view)
      const focusSpy = vi.spyOn(HTMLElement.prototype, "focus")

      cell.focus()
      fireEvent.keyDown(cell, { key })

      const trigger = await view.findByRole("combobox")
      await waitFor(() =>
        expect(trigger.getAttribute("aria-expanded")).toBe("true")
      )
      expect(focusSpy.mock.contexts).toContain(trigger)
      expect(view.getByRole("option", { name: "approved" })).toBeTruthy()
    }
  )

  it("commits a selected option exactly once and closes", async () => {
    const sessions: Array<JsonTableEditSession | null> = []
    const onDocumentDataChange = vi.fn()
    const view = await openEnumFromClick({
      onDocumentDataChange,
      onEditSessionChange: (editSession) => sessions.push(editSession),
    })

    await chooseOption(view.getByRole("option", { name: "approved" }))

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        interactionDocument.id,
        "status",
        "approved"
      )
    )
    expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(view.cell.getAttribute("data-active")).toBeNull()
    expect(latestSession(sessions)).toBeNull()
  })

  it("closes without committing when reselecting the current option", async () => {
    const sessions: Array<JsonTableEditSession | null> = []
    const onDocumentDataChange = vi.fn()
    const view = await openEnumFromClick({
      onDocumentDataChange,
      onEditSessionChange: (editSession) => sessions.push(editSession),
    })

    await chooseOption(view.getByRole("option", { name: "draft" }))

    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(view.cell.getAttribute("data-active")).toBeNull()
    expect(latestSession(sessions)).toBeNull()
  })
})
