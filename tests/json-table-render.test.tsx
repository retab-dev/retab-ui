// @vitest-environment jsdom

import { cleanup, fireEvent } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { baseField, renderCell } from "./json-table-cell-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

describe("json table active cell controls", () => {
  it("renders scalar controls through the DataCell primitive", () => {
    const view = renderCell("string", {
      effectiveValue: "0628",
      draftValue: "0628",
    })

    const inputControl = view
      .getByRole("textbox")
      .closest('[data-slot="input-control"]')
    expect(inputControl?.getAttribute("class")).toContain("h-full")
    expect(inputControl?.getAttribute("class")).not.toContain("py-2")
    expect(inputControl?.getAttribute("class")).not.toContain("items-start")
    expect(inputControl?.getAttribute("class")).not.toContain("leading-none")
  })

  it("commits empty text as null and closes on blur", () => {
    const commitValue = vi.fn()
    const closeEditSession = vi.fn()
    const view = renderCell("string", {
      draftValue: "",
      commitValue,
      closeEditSession,
    })

    fireEvent.blur(view.getByRole("textbox"))

    expect(commitValue).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ kind: "text", rawValue: "", isValid: true })
    )
    expect(closeEditSession).toHaveBeenCalled()
  })

  it("renders number, boolean, and enum controls", () => {
    let view = renderCell("number", { draftValue: "42" })
    expect(view.getByRole("spinbutton")).toBeTruthy()
    cleanup()

    view = renderCell("boolean", {
      effectiveValue: true,
    })
    expect(view.getByRole("checkbox").getAttribute("aria-checked")).toBe("true")
    cleanup()

    view = renderCell("enum", {
      effectiveValue: "approved",
      fieldMetadata: {
        fieldPath: "field",
        rawSchema: { enum: ["approved", "rejected"] },
        schema: { enum: ["approved", "rejected"] },
        effectiveSchema: { enum: ["approved", "rejected"] },
        isNullable: false,
        kind: "enum",
        enumValues: ["approved", "rejected"],
      },
    })
    const enumTrigger = view.getByRole("combobox")
    expect(enumTrigger.getAttribute("data-slot")).toBe("data-cell")
    expect(enumTrigger.getAttribute("data-mode")).toBe("edit")
    expect(enumTrigger.getAttribute("data-kind")).toBe("select")
  })

  it("reports invalid integer inputs without lossy coercion", () => {
    const commitValue = vi.fn()
    const view = renderCell("integer", {
      draftValue: "12.7",
      commitValue,
    })

    fireEvent.blur(view.getByRole("spinbutton"))

    expect(commitValue).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "integer",
        rawValue: "12.7",
        isValid: false,
      })
    )
  })

  it("renders date, date-time, and time controls", () => {
    let view = renderCell("date", { draftValue: "2024-01-02" })
    expect(view.getByText("02/01/2024")).toBeTruthy()
    cleanup()

    view = renderCell("date-time", {
      draftValue: "2024-01-02T03:04:00",
    })
    const dateTimeTrigger = view.container.querySelector<HTMLElement>(
      'button[data-slot="data-cell"]'
    )
    if (!dateTimeTrigger) throw new Error("Missing date-time trigger")
    expect(dateTimeTrigger.getAttribute("data-slot")).toBe("data-cell")
    expect(dateTimeTrigger.getAttribute("data-mode")).toBe("edit")
    expect(dateTimeTrigger.getAttribute("data-kind")).toBe("date-time")
    expect(dateTimeTrigger.textContent).toContain("02/01/2024, 03:04")
    cleanup()

    view = renderCell("time", { draftValue: "03:04:00" })
    const timeTrigger = view.container.querySelector<HTMLElement>(
      'button[data-slot="data-cell"]'
    )
    if (!timeTrigger) throw new Error("Missing time trigger")
    expect(timeTrigger.getAttribute("data-slot")).toBe("data-cell")
    expect(timeTrigger.getAttribute("data-mode")).toBe("edit")
    expect(timeTrigger.getAttribute("data-kind")).toBe("time")
    expect(timeTrigger.textContent).toContain("03:04:00")
  })

  it("renders object and array structured triggers", () => {
    let view = renderCell("object", {
      effectiveValue: { name: "ACME" },
      fieldMetadata: {
        fieldPath: "field",
        rawSchema: { type: "object", title: "Vendor" },
        schema: { type: "object", title: "Vendor" },
        effectiveSchema: { type: "object", title: "Vendor" },
        isNullable: false,
        kind: "object",
        enumValues: [],
      },
    })
    expect(view.getByRole("button").textContent).toContain("ACME")
    expect(view.container.querySelector('[data-slot="data-cell"]')).toBeNull()
    cleanup()

    view = renderCell("array", {
      effectiveValue: ["one", "two"],
      fieldMetadata: {
        fieldPath: "field",
        rawSchema: {
          type: "array",
          title: "Lines",
          items: { type: "string" },
        },
        schema: { type: "array", title: "Lines", items: { type: "string" } },
        effectiveSchema: {
          type: "array",
          title: "Lines",
          items: { type: "string" },
        },
        isNullable: false,
        kind: "array",
        enumValues: [],
      },
    })
    expect(view.getByRole("button").textContent).toContain("[2 items]")
    expect(view.container.querySelector('[data-slot="data-cell"]')).toBeNull()
  })
})
