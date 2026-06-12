// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DataCell, parseDataCellNumberInput } from "@/components/ui/data-cell"
import { DataCellDemo } from "@/components/data-cell-demo"

afterEach(cleanup)

function getDataCell(element: Element | null | undefined): HTMLElement {
  const cell = element?.closest<HTMLElement>('[data-slot="data-cell"]')
  expect(cell).toBeTruthy()
  return cell as HTMLElement
}

function inputValue(role: "textbox" | "spinbutton"): string {
  return (screen.getByRole(role) as HTMLInputElement).value
}

function getPickerTrigger(): HTMLButtonElement {
  const trigger = document.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"]'
  )
  expect(trigger).toBeTruthy()
  return trigger as HTMLButtonElement
}

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
        <DataCell kind="boolean" value={false} />
        <DataCell kind="date" value="2026-06-12T13:25:37Z" />
        <DataCell kind="time" value="13:25:37" />
        <DataCell kind="date-time" value="2026-06-12T13:25:37Z" />
      </div>
    )

    expect(screen.getByText("CHECKCARD PURCHASE")).toBeTruthy()
    expect(screen.getByText("-108,3")).toBeTruthy()
    expect(screen.getByText("42")).toBeTruthy()
    expect(
      screen.getByRole("checkbox", { name: "true" }).getAttribute(
        "aria-checked"
      )
    ).toBe("true")
    const falseCheckbox = screen.getByRole("checkbox", { name: "false" })
    expect(falseCheckbox.getAttribute("aria-checked")).toBe("false")
    expect(
      falseCheckbox.querySelector('[data-slot="checkbox-indicator"]')
    ).toBeTruthy()
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

  it("renders placeholders for empty display values and edit inputs", () => {
    const { unmount } = render(
      <div>
        <DataCell kind="text" value={null} placeholder="No memo" />
        <DataCell kind="number" value={null} placeholder="No amount" />
        <DataCell kind="date" value={null} placeholder="No date" />
      </div>
    )

    expect(screen.getByText("No memo")).toBeTruthy()
    expect(screen.getByText("No amount")).toBeTruthy()
    expect(screen.getByText("No date")).toBeTruthy()

    unmount()
    render(<DataCell kind="text" mode="edit" value="" placeholder="No memo" />)

    expect((screen.getByRole("textbox") as HTMLInputElement).placeholder).toBe(
      "No memo"
    )
  })

  it("uses custom display formatting with the resolved kind metadata", () => {
    const formatValue = vi.fn((value) => (value === null ? "" : `USD ${value}`))
    render(
      <DataCell
        kind="number"
        value={12.5}
        placeholder="No amount"
        formatValue={formatValue}
      />
    )

    expect(screen.getByText("USD 12.5")).toBeTruthy()
    expect(formatValue).toHaveBeenCalledWith(12.5, { kind: "number" })
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

  it("commits empty scalar edits as null with valid empty metadata", () => {
    const onNumberCommit = vi.fn()
    const onTextCommit = vi.fn()
    const { unmount } = render(
      <DataCell kind="number" mode="edit" value="5" onCommit={onNumberCommit} />
    )

    const numberInput = screen.getByRole("spinbutton") as HTMLInputElement
    fireEvent.change(numberInput, { target: { value: "" } })
    fireEvent.blur(numberInput)

    expect(onNumberCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "number",
        rawValue: "",
        isEmpty: true,
        isValid: true,
      })
    )

    unmount()
    render(
      <DataCell kind="text" mode="edit" value="memo" onCommit={onTextCommit} />
    )

    const textInput = screen.getByRole("textbox") as HTMLInputElement
    fireEvent.change(textInput, { target: { value: "" } })
    fireEvent.blur(textInput)

    expect(onTextCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "text",
        rawValue: "",
        isEmpty: true,
        isValid: true,
      })
    )
  })

  it("trims number parser input without losing raw edit metadata", () => {
    const onCommit = vi.fn()
    render(
      <DataCell kind="number" mode="edit" value="1" onCommit={onCommit} />
    )

    const input = screen.getByRole("spinbutton") as HTMLInputElement
    fireEvent.change(input, { target: { value: "2.5" } })
    fireEvent.blur(input)

    expect(onCommit).toHaveBeenCalledWith(
      2.5,
      expect.objectContaining({
        rawValue: "2.5",
        isEmpty: false,
        isValid: true,
      })
    )
    expect(parseDataCellNumberInput({ kind: "number", value: " 2.5 " })).toEqual(
      { value: 2.5, isEmpty: false, isValid: true }
    )
  })

  it("accepts common native number spellings at commit time", () => {
    expect(parseDataCellNumberInput({ kind: "number", value: ".5" })).toEqual({
      value: 0.5,
      isEmpty: false,
      isValid: true,
    })
    expect(parseDataCellNumberInput({ kind: "number", value: "1." })).toEqual({
      value: 1,
      isEmpty: false,
      isValid: true,
    })
    expect(parseDataCellNumberInput({ kind: "number", value: "1e3" })).toEqual(
      { value: 1000, isEmpty: false, isValid: true }
    )
  })

  it("uses Enter and Escape to end editing through the native blur path", () => {
    const onCommit = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <DataCell
        kind="text"
        mode="edit"
        value="old"
        onCommit={onCommit}
        onKeyDown={onKeyDown}
      />
    )

    const input = screen.getByRole("textbox") as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: "new" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(onCommit).toHaveBeenCalledWith(
      "new",
      expect.objectContaining({ kind: "text", rawValue: "new" })
    )
    expect(onKeyDown).toHaveBeenCalled()

    onCommit.mockClear()
    input.focus()
    fireEvent.keyDown(input, { key: "Escape" })

    expect(onCommit).toHaveBeenCalledWith(
      "new",
      expect.objectContaining({ kind: "text", rawValue: "new" })
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

  it("does not commit disabled boolean edits", () => {
    const onCommit = vi.fn()
    render(
      <DataCell
        kind="boolean"
        mode="edit"
        value={false}
        disabled
        onCommit={onCommit}
      />
    )

    fireEvent.click(screen.getByRole("checkbox"))

    expect(onCommit).not.toHaveBeenCalled()
    expect((screen.getByRole("checkbox") as HTMLButtonElement).disabled).toBe(
      true
    )
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

  it("does not activate auto cells when caller prevents the click", () => {
    render(
      <DataCell
        kind="text"
        value="Vendor"
        editable
        onClick={(event) => event.preventDefault()}
      />
    )

    fireEvent.click(screen.getByText("Vendor"))

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByText("Vendor")).toBeTruthy()
  })

  it("suppresses disabled auto-cell activation callbacks", () => {
    const onClick = vi.fn()
    render(<DataCell kind="text" value="Vendor" editable disabled onClick={onClick} />)

    fireEvent.click(getDataCell(screen.getByText("Vendor")))

    expect(onClick).not.toHaveBeenCalled()
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("focuses the real control when auto cells are activated by click", () => {
    render(<DataCell kind="text" value="Vendor" editable />)

    fireEvent.click(screen.getByText("Vendor"))

    expect(document.activeElement).toBe(screen.getByRole("textbox"))
  })

  it("keeps auto text cells editing while the input remains focused", () => {
    render(<DataCell kind="text" value="Vendor" editable />)

    fireEvent.mouseEnter(screen.getByText("Vendor"))
    const input = screen.getByRole("textbox") as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.mouseLeave(input)

    expect(screen.getByRole("textbox")).toBe(input)
  })

  it("keeps auto picker cells editing while the trigger remains focused", () => {
    render(<DataCell kind="date" value="2026-06-12" editable />)

    fireEvent.mouseEnter(getDataCell(screen.getByText("12/06/2026")))
    const trigger = getPickerTrigger()
    fireEvent.focus(trigger)
    fireEvent.mouseLeave(trigger)

    expect(getPickerTrigger()).toBe(trigger)
    expect(getPickerTrigger().getAttribute("data-mode")).toBe("edit")
  })

  it("keeps disabled editable cells display-only and disabled", () => {
    render(<DataCell kind="text" value="Vendor" editable disabled />)

    const cell = getDataCell(screen.getByText("Vendor"))
    fireEvent.mouseEnter(cell)
    fireEvent.click(cell)

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(cell.getAttribute("aria-disabled")).toBe("true")
    expect(cell.getAttribute("class")).toContain("pointer-events-none")
    expect(cell.getAttribute("class")).toContain("opacity-64")
    expect(cell.getAttribute("class")).not.toContain("cursor-text")
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

  it("resyncs uncontrolled drafts when the committed value changes", () => {
    const { rerender } = render(
      <DataCell kind="text" mode="edit" value="first" />
    )

    expect(inputValue("textbox")).toBe("first")

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "local draft" },
    })
    expect(inputValue("textbox")).toBe("local draft")

    rerender(<DataCell kind="text" mode="edit" value="second" />)

    expect(inputValue("textbox")).toBe("second")
  })

  it("does not overwrite controlled drafts when the committed value changes", () => {
    const { rerender } = render(
      <DataCell kind="text" mode="edit" value="first" draftValue="draft" />
    )

    expect(inputValue("textbox")).toBe("draft")

    rerender(
      <DataCell kind="text" mode="edit" value="second" draftValue="draft" />
    )

    expect(inputValue("textbox")).toBe("draft")
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

  it("marks bad native number input as invalid metadata", () => {
    const onDraftValueChange = vi.fn()
    render(
      <DataCell
        kind="number"
        mode="edit"
        value="1"
        onDraftValueChange={onDraftValueChange}
      />
    )

    const input = screen.getByRole("spinbutton") as HTMLInputElement
    Object.defineProperty(input, "validity", {
      configurable: true,
      value: { badInput: true },
    })
    fireEvent.change(input, { target: { value: "2" } })

    expect(onDraftValueChange).toHaveBeenCalledWith(
      "2",
      expect.objectContaining({ isEmpty: false, isValid: false })
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

    fireEvent.click(getPickerTrigger())

    const input = screen.getByDisplayValue("13:25:37") as HTMLInputElement
    fireEvent.change(input, { target: { value: "09:10" } })
    fireEvent.blur(input)

    expect(onCommit).toHaveBeenCalledWith(
      "2026-06-12T09:10Z",
      expect.objectContaining({ isValid: true })
    )
  })

  it("preserves explicit date-time offsets when requested", () => {
    const onCommit = vi.fn()
    render(
      <DataCell
        kind="date-time"
        mode="edit"
        value="2026-06-12T13:25:37+02:00"
        dateTimeZone="preserve"
        onCommit={onCommit}
      />
    )

    fireEvent.click(screen.getByRole("button"))

    const input = screen.getByDisplayValue("13:25:37") as HTMLInputElement
    fireEvent.change(input, { target: { value: "09:10" } })

    expect(onCommit).toHaveBeenCalledWith(
      "2026-06-12T09:10+02:00",
      expect.objectContaining({ rawValue: "2026-06-12T09:10" })
    )
  })

  it("commits utc date-time edits with an explicit Z suffix", () => {
    const onCommit = vi.fn()
    render(
      <DataCell
        kind="date-time"
        mode="edit"
        value="2026-06-12T13:25:37+02:00"
        dateTimeZone="utc"
        onCommit={onCommit}
      />
    )

    fireEvent.click(screen.getByRole("button"))

    const input = screen.getByDisplayValue("13:25:37") as HTMLInputElement
    fireEvent.change(input, { target: { value: "09:10" } })

    expect(onCommit).toHaveBeenCalledWith(
      "2026-06-12T09:10Z",
      expect.objectContaining({ rawValue: "2026-06-12T09:10" })
    )
  })

  it("commits date picker day selections and closes the date picker", () => {
    const onCommit = vi.fn()
    render(
      <DataCell kind="date" mode="edit" value="2026-06-12" onCommit={onCommit} />
    )

    fireEvent.click(getPickerTrigger())
    const nextDay = document.querySelector<HTMLButtonElement>(
      'button[data-day="6/15/2026"]'
    )
    expect(nextDay).toBeTruthy()
    fireEvent.click(nextDay as HTMLButtonElement)

    expect(onCommit).toHaveBeenCalledWith(
      "2026-06-15",
      expect.objectContaining({
        kind: "date",
        rawValue: "2026-06-15",
        isValid: true,
      })
    )
    expect(document.querySelector('[data-slot="popover-popup"]')).toBeNull()
  })

  it("keeps the time portion when selecting a date-time picker day", () => {
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

    fireEvent.click(getPickerTrigger())
    const nextDay = document.querySelector<HTMLButtonElement>(
      'button[data-day="6/15/2026"]'
    )
    expect(nextDay).toBeTruthy()
    fireEvent.click(nextDay as HTMLButtonElement)

    expect(onCommit).toHaveBeenCalledWith(
      "2026-06-15T13:25:37Z",
      expect.objectContaining({
        kind: "date-time",
        rawValue: "2026-06-15T13:25:37",
        isValid: true,
      })
    )
    expect(document.querySelector('[data-slot="popover-popup"]')).toBeTruthy()
  })

  it("commits time picker edits and closes date pickers without extra commits", () => {
    const onTimeCommit = vi.fn()
    const onDateCommit = vi.fn()
    const { unmount } = render(
      <DataCell kind="time" mode="edit" value="13:25:37" onCommit={onTimeCommit} />
    )

    fireEvent.click(screen.getByRole("button"))
    fireEvent.change(screen.getByDisplayValue("13:25:37"), {
      target: { value: "08:15" },
    })

    expect(onTimeCommit).toHaveBeenCalledWith(
      "08:15",
      expect.objectContaining({ kind: "time", rawValue: "08:15" })
    )

    unmount()
    render(
      <DataCell kind="date" mode="edit" value="2026-06-12" onCommit={onDateCommit} />
    )

    const dateTrigger = getPickerTrigger()
    fireEvent.click(dateTrigger)
    fireEvent.keyDown(dateTrigger, { key: "Escape" })

    expect(onDateCommit).not.toHaveBeenCalled()
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
    expect(parseDataCellNumberInput({ kind: "number", value: "" })).toEqual({
      value: null,
      isEmpty: true,
      isValid: true,
    })
    expect(parseDataCellNumberInput({ kind: "integer", value: " 12 " })).toEqual(
      { value: 12, isEmpty: false, isValid: true }
    )
    expect(parseDataCellNumberInput({ kind: "integer", value: "12e0" })).toEqual(
      { value: null, isEmpty: false, isValid: false }
    )
  })
})
