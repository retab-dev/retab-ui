// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DataCell, parseDataCellNumberInput } from "@/components/ui/data-cell"
import { DataCellDemo } from "@/components/data-cell-demo"

afterEach(cleanup)

function expectNoBorderOrShadow(element: Element | null | undefined) {
  const className = element?.getAttribute("class") ?? ""
  expect(className).not.toMatch(/(?:^|\s)border(?:\s|$|-)/)
  expect(className).not.toMatch(/(?:^|\s)shadow(?:\s|$|-)/)
  expect(className).not.toContain("before:shadow")
}

function expectTransparentBackground(element: Element | null | undefined) {
  const className = element?.getAttribute("class") ?? ""
  expect(className).toContain("bg-transparent")
  expect(className).not.toContain("bg-background")
  expect(className).not.toContain("bg-accent")
  expect(className).not.toContain("bg-input")
}

describe("DataCell", () => {
  it("renders scalar display values", () => {
    render(
      <div>
        <DataCell kind="text" value="CHECKCARD PURCHASE" />
        <DataCell kind="number" value={-108.3} />
        <DataCell kind="integer" value={42} />
        <DataCell kind="boolean" value={true} />
        <DataCell kind="date" value="2026-06-12T13:25:37Z" />
        <DataCell kind="time" value="13:25:37" />
        <DataCell kind="date-time" value="2026-06-12T13:25:37Z" />
      </div>
    )

    expect(screen.getByText("CHECKCARD PURCHASE")).toBeTruthy()
    expect(screen.getByText("-108,3")).toBeTruthy()
    expect(screen.getByText("42")).toBeTruthy()
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe(
      "true"
    )
    expect(screen.getByText("12/06/2026")).toBeTruthy()
    expect(screen.getByText("13:25:37")).toBeTruthy()
    expect(screen.getByText("12/06/2026, 13:25")).toBeTruthy()
  })

  it("does not render default data-cell borders or shadows", () => {
    render(
      <div>
        <DataCell kind="text" value="Vendor" />
        <DataCell kind="boolean" value={true} />
        <DataCell kind="text" mode="edit" value="Editable" />
        <DataCell kind="date" mode="edit" value="2026-06-12" />
      </div>
    )

    for (const cell of document.querySelectorAll('[data-slot="data-cell"]')) {
      expectNoBorderOrShadow(cell)
      expectTransparentBackground(cell)
    }

    expectNoBorderOrShadow(screen.getByRole("checkbox"))
    expectTransparentBackground(screen.getByRole("checkbox"))

    const inputControl = screen
      .getByRole("textbox")
      .closest('[data-slot="input-control"]')
    expectNoBorderOrShadow(inputControl)
    expectTransparentBackground(inputControl)
  })

  it("keeps caller-provided data-cell borders and shadows", () => {
    render(
      <div>
        <DataCell
          kind="text"
          value="Vendor"
          className="border border-input shadow-sm"
        />
        <DataCell
          kind="text"
          mode="edit"
          value="Editable"
          className="border border-input shadow-sm"
        />
      </div>
    )

    const cell = screen.getByText("Vendor").closest('[data-slot="data-cell"]')
    expect(cell?.getAttribute("class")).toContain("border")
    expect(cell?.getAttribute("class")).toContain("border-input")
    expect(cell?.getAttribute("class")).toContain("shadow-sm")

    const inputControl = screen
      .getByRole("textbox")
      .closest('[data-slot="input-control"]')
    expect(inputControl?.getAttribute("class")).toContain("border")
    expect(inputControl?.getAttribute("class")).toContain("border-input")
    expect(inputControl?.getAttribute("class")).toContain("shadow-sm")
  })

  it("commits number edits from native number inputs", () => {
    const onCommit = vi.fn()
    render(
      <DataCell kind="number" mode="edit" value="1.5" onCommit={onCommit} />
    )

    const input = screen.getByRole("spinbutton") as HTMLInputElement
    expect(input.type).toBe("number")
    expect(input.closest('[data-slot="input-control"]')).toBeTruthy()
    fireEvent.change(input, { target: { value: "2.25" } })
    fireEvent.blur(input)

    expect(onCommit).toHaveBeenCalledWith(
      2.25,
      expect.objectContaining({ isValid: true })
    )
  })

  it("commits boolean edits", () => {
    const onCommit = vi.fn()
    render(
      <DataCell kind="boolean" mode="edit" value={false} onCommit={onCommit} />
    )

    fireEvent.click(screen.getByRole("checkbox"))

    expect(onCommit).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ kind: "boolean", rawValue: "true" })
    )
    expect(screen.getByRole("checkbox").tagName).toBe("BUTTON")
  })

  it("keeps forced display cells inert on hover", () => {
    render(<DataCell kind="number" value={42} mode="display" editable />)

    fireEvent.mouseEnter(screen.getByText("42"))

    expect(screen.queryByRole("spinbutton")).toBeNull()
  })

  it("keeps editable cells display-only until activation", () => {
    render(<DataCell kind="number" value={42} editable />)

    expect(screen.getByText("42")).toBeTruthy()
    expect(screen.queryByRole("spinbutton")).toBeNull()

    fireEvent.mouseEnter(screen.getByText("42"))

    const input = screen.getByRole("spinbutton") as HTMLInputElement
    expect(input.type).toBe("number")
    expect(input.value).toBe("42")
  })

  it("activates editable cells on click", () => {
    render(<DataCell kind="text" value="Vendor" editable />)

    fireEvent.click(screen.getByText("Vendor"))

    expect(screen.getByRole("textbox")).toBeTruthy()
  })

  it("keeps boolean display free of native inputs", () => {
    render(<DataCell kind="boolean" value={true} />)

    expect(screen.getByRole("checkbox").tagName).toBe("SPAN")
    expect(document.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it("supports controlled drafts and forwards cell props", () => {
    const onDraftValueChange = vi.fn()
    const onFocus = vi.fn()
    render(
      <DataCell
        kind="text"
        mode="edit"
        value="committed"
        draftValue="draft"
        onDraftValueChange={onDraftValueChange}
        onFocus={onFocus}
        aria-label="Name"
      />
    )

    const input = screen.getByRole("textbox", { name: "Name" })
    expect((input as HTMLInputElement).value).toBe("draft")

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "next" } })

    expect(onFocus).toHaveBeenCalled()
    expect(onDraftValueChange).toHaveBeenCalledWith(
      "next",
      expect.objectContaining({ isValid: true })
    )
  })

  it("keeps raw invalid number drafts and reports parse metadata", () => {
    const onDraftValueChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <DataCell
        kind="integer"
        mode="edit"
        value="1"
        onDraftValueChange={onDraftValueChange}
        onCommit={onCommit}
      />
    )

    const input = screen.getByRole("spinbutton") as HTMLInputElement
    fireEvent.change(input, { target: { value: "1.5" } })
    fireEvent.blur(input)

    expect(onDraftValueChange).toHaveBeenCalledWith(
      "1.5",
      expect.objectContaining({ isEmpty: false, isValid: false })
    )
    expect(onCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ rawValue: "1.5", isValid: false })
    )
  })

  it("preserves date-time timezone suffixes when requested", () => {
    const onCommit = vi.fn()
    render(
      <DataCell
        kind="date-time"
        mode="edit"
        value="2026-06-12T13:25:37Z"
        dateTimeZone="preserve"
        onCommit={onCommit}
      />
    )

    fireEvent.click(screen.getByRole("button"))

    const input = screen.getByDisplayValue("13:25") as HTMLInputElement
    fireEvent.change(input, { target: { value: "09:10" } })
    fireEvent.blur(input)

    expect(onCommit).toHaveBeenCalledWith(
      "2026-06-12T09:10Z",
      expect.objectContaining({ isValid: true })
    )
  })

  it("mounts date and time picker triggers in edit mode", () => {
    const { unmount } = render(
      <DataCell kind="date" mode="edit" value="2026-06-12" />
    )

    expect(screen.getByRole("button").textContent).toContain("12/06/2026")
    expect(screen.queryByDisplayValue("2026-06-12")).toBeNull()

    unmount()
    render(<DataCell kind="time" mode="edit" value="13:25:37" />)

    fireEvent.click(screen.getByRole("button"))

    expect(
      (screen.getByDisplayValue("13:25:37") as HTMLInputElement).type
    ).toBe("time")
  })

  it("keeps demo display examples static on hover", () => {
    render(<DataCellDemo />)

    const numberRow = screen.getByText("Number").parentElement
    const displayColumn = numberRow?.children[1] as HTMLElement
    const displayCell = displayColumn.querySelector('[data-slot="data-cell"]')
    expect(displayCell?.getAttribute("data-mode")).toBe("display")

    fireEvent.mouseEnter(displayCell as HTMLElement)

    expect(displayCell?.getAttribute("data-mode")).toBe("display")
  })

  it("keeps every demo edit cell as a display shell until hover", () => {
    render(<DataCellDemo />)

    for (const label of [
      "Text",
      "Number",
      "Integer",
      "Boolean",
      "Date",
      "Time",
      "Date Time",
      "Enum",
    ]) {
      const row = screen.getByText(label).parentElement
      const editCell = row?.children[2] as HTMLElement
      const displayCell = editCell.querySelector('[data-slot="data-cell"]')
      expect(displayCell?.getAttribute("data-mode")).toBe("display")
      expectNoBorderOrShadow(displayCell)
      expectTransparentBackground(displayCell)
      expect(editCell.querySelector("input")).toBeNull()
      expect(editCell.querySelector('[data-slot="select-trigger"]')).toBeNull()
    }
  })

  it("turns demo edit cells into real controls on hover", () => {
    const { unmount } = render(<DataCellDemo />)

    const numberRow = screen.getByText("Number").parentElement
    const numberEditCell = numberRow?.children[2] as HTMLElement
    fireEvent.mouseEnter(
      numberEditCell.querySelector('[data-slot="data-cell"]') as HTMLElement
    )

    expect(numberEditCell.querySelector('[data-mode="edit"]')).toBeTruthy()
    expect(numberEditCell.querySelector('input[type="number"]')).toBeTruthy()

    unmount()
    render(<DataCellDemo />)

    const enumRow = screen.getByText("Enum").parentElement
    const enumEditCell = enumRow?.children[2] as HTMLElement
    fireEvent.mouseEnter(
      enumEditCell.querySelector('[data-slot="data-cell"]') as HTMLElement
    )

    const enumTrigger = enumEditCell.querySelector(
      '[data-slot="select-trigger"]'
    )
    expect(enumTrigger?.getAttribute("data-mode")).toBe("edit")
    expect(enumTrigger?.getAttribute("data-kind")).toBe("enum")
    expectNoBorderOrShadow(enumTrigger)
    expectTransparentBackground(enumTrigger)
    expect(screen.getByRole("combobox")).toBe(enumTrigger)
  })

  it("shares number parsing and draft formatting", () => {
    expect(parseDataCellNumberInput({ kind: "number", value: "12.7" })).toEqual(
      { value: 12.7, isEmpty: false, isValid: true }
    )
    expect(
      parseDataCellNumberInput({ kind: "integer", value: "12.7" })
    ).toEqual({ value: null, isEmpty: false, isValid: false })
    expect(parseDataCellNumberInput({ kind: "number", value: "abc" })).toEqual({
      value: null,
      isEmpty: false,
      isValid: false,
    })
  })
})
