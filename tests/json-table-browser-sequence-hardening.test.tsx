// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  findEditableCell,
  findReadonlyCell,
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

type RenderedView = ReturnType<typeof renderInteractionRow>

function browserPointerEventInit(detail = 1) {
  return {
    button: 0,
    buttons: 1,
    clientX: 24,
    clientY: 12,
    detail,
    pointerId: 1,
    pointerType: "mouse",
  }
}

function browserMouseEventInit(detail = 1) {
  return {
    button: 0,
    buttons: 1,
    clientX: 24,
    clientY: 12,
    detail,
  }
}

function browserClick(target: Element | Document | Window, detail = 1) {
  fireEvent.pointerDown(target, browserPointerEventInit(detail))
  fireEvent.mouseDown(target, browserMouseEventInit(detail))
  fireEvent.pointerUp(target, browserPointerEventInit(detail))
  fireEvent.mouseUp(target, browserMouseEventInit(detail))
  fireEvent.click(target, browserMouseEventInit(detail))
}

function pointerActivate(target: Element | Document | Window, detail = 1) {
  fireEvent.pointerDown(target, browserPointerEventInit(detail))
}

function finishBrowserClick(target: Element | Document | Window, detail = 1) {
  fireEvent.mouseDown(target, browserMouseEventInit(detail))
  fireEvent.pointerUp(target, browserPointerEventInit(detail))
  fireEvent.mouseUp(target, browserMouseEventInit(detail))
  fireEvent.click(target, browserMouseEventInit(detail))
}

function outsidePointerDown() {
  fireEvent.pointerDown(document.body, {
    ...browserPointerEventInit(),
    clientX: 600,
    clientY: 400,
    pointerId: 2,
  })
}

async function editableCell(view: RenderedView, fieldPath: string) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

async function editableDataCell(view: RenderedView, fieldPath: string) {
  const cell = await editableCell(view, fieldPath)
  const dataCell = cell.querySelector<HTMLElement>('[data-slot="data-cell"]')
  if (!dataCell) throw new Error(`Expected DataCell for ${fieldPath}`)
  return dataCell
}

function textInput(view: RenderedView) {
  return view.getByRole("textbox") as HTMLInputElement
}

function numberInput(view: RenderedView) {
  return view.getByRole("spinbutton") as HTMLInputElement
}

async function openEnum(view: RenderedView, fieldPath: string) {
  const cell = await editableCell(view, fieldPath)
  browserClick(cell)

  const trigger = await view.findByRole("combobox")
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )

  return { cell, trigger }
}

async function chooseOption(view: RenderedView, optionName: string | RegExp) {
  const option = await view.findByRole("option", { name: optionName })
  fireEvent.pointerDown(option, browserPointerEventInit())
  fireEvent.pointerUp(option, browserPointerEventInit())
  fireEvent.click(option, browserMouseEventInit())
}

function pickerPopup() {
  return document.querySelector<HTMLElement>(
    '[data-slot="data-cell-picker-popup"]'
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

async function openPicker(view: RenderedView, fieldPath: string) {
  const cell = await editableCell(view, fieldPath)
  pointerActivate(cell)

  await view.findByRole("dialog")
  const trigger = pickerTrigger(view, fieldPath)
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )

  return { cell, trigger }
}

describe("json table browser sequence hardening", () => {
  it("keeps a text editor open through the complete browser click sequence that started it", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange,
    })

    browserClick(await editableCell(view, "vendor"))

    const input = textInput(view)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("ACME")
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("keeps a collapsed text caret when the mounted input receives the activation click tail", async () => {
    const view = renderInteractionRow({
      document: {
        id: "doc_1",
        data: {
          vendor: "USD",
        },
      },
      visiblePaths: ["vendor"],
    })
    const cell = await editableDataCell(view, "vendor")

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 30,
      bottom: 24,
      width: 30,
      height: 24,
      toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(cell, {
      ...browserPointerEventInit(),
      clientX: 10,
    })
    const input = textInput(view)
    expect(input.selectionStart).toBe(1)
    expect(input.selectionEnd).toBe(1)
    finishBrowserClick(input)

    expect(input.selectionStart).toBe(1)
    expect(input.selectionEnd).toBe(1)
  })

  it("preserves a dirty text draft through rapid same-cell clicks and commits once on blur", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange,
    })
    const cell = await editableCell(view, "vendor")

    browserClick(cell)
    const input = textInput(view)
    fireEvent.change(input, { target: { value: "BrowserCo" } })
    browserClick(cell)
    browserClick(cell)

    expect(textInput(view).value).toBe("BrowserCo")
    expect(onDocumentDataChange).not.toHaveBeenCalled()

    fireEvent.blur(textInput(view))

    expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
    expect(onDocumentDataChange).toHaveBeenCalledWith(
      "doc_1",
      "vendor",
      "BrowserCo"
    )
  })

  it("keeps double-click on a scalar cell from duplicating sessions or commits", async () => {
    const onDocumentDataChange = vi.fn()
    const sessions: Array<string | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["amount"],
      onDocumentDataChange,
      onEditSessionChange: (session) =>
        sessions.push(session?.fieldPath ?? null),
    })
    const cell = await editableCell(view, "amount")

    browserClick(cell, 1)
    browserClick(cell, 2)
    fireEvent.dblClick(cell, browserMouseEventInit(2))

    expect(numberInput(view).value).toBe("12.5")
    expect(sessions).toEqual(["amount"])
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it.each(["Enter", "F2"] as const)(
    "keeps keyboard %s activation stable when the next event is a cell click",
    async (key) => {
      const onDocumentDataChange = vi.fn()
      const sessions: Array<string | null> = []
      const view = renderInteractionRow({
        visiblePaths: ["vendor"],
        onDocumentDataChange,
        onEditSessionChange: (session) =>
          sessions.push(session?.fieldPath ?? null),
      })
      const cell = await editableCell(view, "vendor")

      cell.focus()
      fireEvent.keyDown(cell, { key })
      browserClick(cell)

      expect(textInput(view).value).toBe("ACME")
      expect(sessions).toEqual(["vendor"])
      expect(onDocumentDataChange).not.toHaveBeenCalled()
    }
  )

  it("does not let an outside pointer between pointerdown and click leave a stale scalar session", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange,
    })
    const cell = await editableCell(view, "vendor")

    fireEvent.pointerDown(cell, browserPointerEventInit())
    expect(textInput(view).value).toBe("ACME")

    outsidePointerDown()
    finishBrowserClick(cell)

    expect(textInput(view).value).toBe("ACME")
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("toggles a boolean cell exactly once for a complete browser click sequence", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["is_paid"],
      onDocumentDataChange,
    })

    browserClick(await editableCell(view, "is_paid"))

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        "doc_1",
        "is_paid",
        true
      )
    )
    expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
    expect(findReadonlyCell(view.container, "is_paid").dataset.active).toBe(
      undefined
    )
    expect(view.container.querySelector('[data-mode="edit"]')).toBeNull()
  })

  it("keeps enum dropdowns open through a complete browser activation click", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onDocumentDataChange,
    })

    browserClick(await editableDataCell(view, "status"))

    const trigger = await view.findByRole("combobox")
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("true")
    )
    expect(await view.findByRole("option", { name: "approved" })).toBeTruthy()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("keeps enum dropdowns open after the follow-up events from the activation click", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onDocumentDataChange,
    })

    const { trigger } = await openEnum(view, "status")

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(await view.findByRole("option", { name: "approved" })).toBeTruthy()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("keeps click-opened enum dropdowns open after the activation sequence settles", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onDocumentDataChange,
    })
    const cell = await editableDataCell(view, "status")

    browserClick(cell)
    const trigger = await view.findByRole("combobox")
    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(await view.findByRole("option", { name: "approved" })).toBeTruthy()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("commits an enum option once from a complete browser option click sequence", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onDocumentDataChange,
    })

    await openEnum(view, "status")
    await chooseOption(view, "approved")

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        "doc_1",
        "status",
        "approved"
      )
    )
    expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
  })

  it("does not open an enum dropdown when the pointerdown is abandoned outside the cell", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onDocumentDataChange,
    })
    const cell = await editableCell(view, "status")

    fireEvent.pointerDown(cell, browserPointerEventInit())
    outsidePointerDown()
    finishBrowserClick(document.body)

    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("opens picker overlays through a complete browser activation click", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onDocumentDataChange,
    })

    browserClick(await editableCell(view, "shipped_at"))

    await view.findByRole("dialog")
    expect(pickerPopup()).toBeTruthy()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("keeps picker overlays open after the follow-up events from the activation click", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onDocumentDataChange,
    })

    const { trigger } = await openPicker(view, "shipped_at")

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(pickerPopup()).toBeTruthy()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("closes picker overlays cleanly when outside pointerdown lands before the original click completes", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onDocumentDataChange,
    })
    const cell = await editableCell(view, "shipped_at")

    fireEvent.pointerDown(cell, browserPointerEventInit())
    expect(await view.findByRole("dialog")).toBeTruthy()

    outsidePointerDown()
    finishBrowserClick(cell)

    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull())
    expect(pickerPopup()).toBeNull()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })
})
