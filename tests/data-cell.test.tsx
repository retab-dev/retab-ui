// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DataCell,
  parseDataCellNumberInput,
} from "@/components/ui/data-cell"
import { DataCellDemo } from "@/components/data-cell-demo"

afterEach(cleanup)

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
    expect(screen.getByText("-108.3")).toBeTruthy()
    expect(screen.getByText("42")).toBeTruthy()
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "true"
    )
    expect(screen.getByText("2026-06-12")).toBeTruthy()
    expect(screen.getByText("13:25:37")).toBeTruthy()
    expect(screen.getByText("2026-06-12T13:25")).toBeTruthy()
  })

  it("commits number edits from native number inputs", () => {
    const onValueCommit = vi.fn()
    render(
      <DataCell
        kind="number"
        mode="edit"
        value="1.5"
        onValueCommit={onValueCommit}
      />
    )

    const input = screen.getByRole("spinbutton") as HTMLInputElement
    expect(input.type).toBe("number")
    expect(input.className).toContain("text-right")
    expect(input.className).toContain("tabular-nums")
    fireEvent.change(input, { target: { value: "2.25" } })
    fireEvent.blur(input)

    expect(onValueCommit).toHaveBeenCalledWith(
      2.25,
      expect.objectContaining({ isValid: true })
    )
  })

  it("commits boolean edits", () => {
    const onValueCommit = vi.fn()
    render(
      <DataCell
        kind="boolean"
        mode="edit"
        value={false}
        onValueCommit={onValueCommit}
      />
    )

    fireEvent.click(screen.getByRole("switch"))

    expect(onValueCommit).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ kind: "boolean", rawValue: "true" })
    )
    expect(screen.getByRole("switch").tagName).toBe("BUTTON")
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

  it("toggles editable boolean display cells on click", () => {
    const onValueCommit = vi.fn()
    render(
      <DataCell
        kind="boolean"
        value={false}
        editable
        onValueCommit={onValueCommit}
      />
    )

    fireEvent.click(screen.getByRole("switch"))

    expect(onValueCommit).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ kind: "boolean", rawValue: "true" })
    )
  })

  it("keeps boolean display free of native inputs", () => {
    render(<DataCell kind="boolean" value={true} />)

    expect(screen.getByRole("switch").tagName).toBe("SPAN")
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
    const onValueCommit = vi.fn()
    render(
      <DataCell
        kind="integer"
        mode="edit"
        value="1"
        onDraftValueChange={onDraftValueChange}
        onValueCommit={onValueCommit}
      />
    )

    const input = screen.getByRole("spinbutton") as HTMLInputElement
    fireEvent.change(input, { target: { value: "1.5" } })
    fireEvent.blur(input)

    expect(onDraftValueChange).toHaveBeenCalledWith(
      "1.5",
      expect.objectContaining({ isEmpty: false, isValid: false })
    )
    expect(onValueCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ rawValue: "1.5", isValid: false })
    )
  })

  it("preserves date-time timezone suffixes when requested", () => {
    const onValueCommit = vi.fn()
    render(
      <DataCell
        kind="date-time"
        mode="edit"
        value="2026-06-12T13:25:37Z"
        dateTimeZone="preserve"
        onValueCommit={onValueCommit}
      />
    )

    const input = screen.getByDisplayValue(
      "2026-06-12T13:25"
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: "2026-06-13T09:10" } })
    fireEvent.blur(input)

    expect(onValueCommit).toHaveBeenCalledWith(
      "2026-06-13T09:10Z",
      expect.objectContaining({ isValid: true })
    )
  })

  it("mounts date and time native inputs in edit mode", () => {
    const { unmount } = render(
      <DataCell kind="date" mode="edit" value="2026-06-12" />
    )

    expect((screen.getByDisplayValue("2026-06-12") as HTMLInputElement).type).toBe(
      "date"
    )

    unmount()
    render(<DataCell kind="time" mode="edit" value="13:25:37" />)

    expect((screen.getByDisplayValue("13:25:37") as HTMLInputElement).type).toBe(
      "time"
    )
  })

  it("keeps demo display examples static on hover", () => {
    render(<DataCellDemo />)

    const displayNumber = screen.getByText("-108.3")
    const displayCell = displayNumber.closest('[data-slot="data-cell"]')
    expect(displayCell?.getAttribute("data-mode")).toBe("display")

    fireEvent.mouseEnter(displayNumber)

    expect(displayCell?.getAttribute("data-mode")).toBe("display")
  })

  it("shares number parsing and draft formatting", () => {
    expect(parseDataCellNumberInput({ kind: "number", value: "12.7" })).toEqual(
      { value: 12.7, isEmpty: false, isValid: true }
    )
    expect(
      parseDataCellNumberInput({ kind: "integer", value: "12.7" })
    ).toEqual({ value: null, isEmpty: false, isValid: false })
    expect(parseDataCellNumberInput({ kind: "number", value: "abc" })).toEqual(
      { value: null, isEmpty: false, isValid: false }
    )
  })
})
