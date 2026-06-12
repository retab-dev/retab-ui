// @vitest-environment jsdom

import { cleanup, fireEvent } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  baseField,
  baseOverlays,
  baseTextDraft,
  renderEditor,
} from "./json-table-editor-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

function activateDataCell(container: HTMLElement) {
  const cell = container.querySelector('[data-slot="data-cell"]')
  expect(cell).toBeTruthy()
  fireEvent.mouseEnter(cell as HTMLElement)
}

describe("json table cell editor dispatch", () => {
  it("renders string display and edit states", () => {
    let view = renderEditor("string", {
      field: { ...baseField("string"), effectiveValue: "hello" },
    })
    expect(view.getByText("hello")).toBeTruthy()
    cleanup()

    view = renderEditor("string")
    activateDataCell(view.container)
    expect(view.getByRole("textbox")).toBeTruthy()
  })

  it("starts text editing from the display state", () => {
    const view = renderEditor("string", {
      field: { ...baseField("string"), effectiveValue: "hello" },
    })

    fireEvent.click(view.getByText("hello"))

    expect(view.getByRole("textbox")).toBeTruthy()
  })

  it("commits empty text as null and exits edit mode on blur", () => {
    const onCommit = vi.fn()
    const setFocusedField = vi.fn()
    const setIsInputFocused = vi.fn()
    const view = renderEditor("string", {
      textDraft: {
        ...baseTextDraft(),
        activeTextValue: "",
        draftTextValue: "",
      },
      focus: {
        focusedField: "doc_1-field",
        setFocusedField,
        setIsInputFocused,
      },
      commit: { onCommit },
    })

    activateDataCell(view.container)
    fireEvent.blur(view.getByRole("textbox"))

    expect(onCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ kind: "text", rawValue: "", isValid: true })
    )
    expect(setFocusedField).toHaveBeenCalledWith(null)
    expect(setIsInputFocused).toHaveBeenCalledWith(false)
  })

  it("renders number, boolean, and enum editors", () => {
    let view = renderEditor("number", {
      overlays: { ...baseOverlays(), showInput: true },
      textDraft: { ...baseTextDraft(), activeTextValue: "42" },
    })
    activateDataCell(view.container)
    expect(view.getByRole("spinbutton")).toBeTruthy()
    cleanup()

    view = renderEditor("boolean", {
      field: { ...baseField("boolean"), effectiveValue: true },
    })
    expect(view.getByRole("checkbox").getAttribute("aria-checked")).toBe("true")
    cleanup()

    view = renderEditor("enum", {
      overlays: { ...baseOverlays(), showInput: true },
      field: {
        ...baseField("enum"),
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
      },
    })
    expect(view.getByRole("combobox")).toBeTruthy()
  })

  it("reports invalid integer inputs without lossy coercion", () => {
    const onCommit = vi.fn()
    const setFocusedField = vi.fn()
    const setIsInputFocused = vi.fn()
    const view = renderEditor("integer", {
      overlays: { ...baseOverlays(), showInput: true },
      textDraft: {
        ...baseTextDraft(),
        activeTextValue: "12.7",
        draftTextValue: "12.7",
      },
      focus: {
        focusedField: "doc_1-field",
        setFocusedField,
        setIsInputFocused,
      },
      commit: { onCommit },
    })

    activateDataCell(view.container)
    fireEvent.blur(view.getByRole("spinbutton"))

    expect(onCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "integer",
        rawValue: "12.7",
        isValid: false,
      })
    )
    expect(setFocusedField).toHaveBeenCalledWith(null)
    expect(setIsInputFocused).toHaveBeenCalledWith(false)
  })

  it("renders date, date-time, and time editors", () => {
    let view = renderEditor("date", {
      textDraft: { ...baseTextDraft(), activeTextValue: "2024-01-02" },
    })
    expect(view.getByText("Jan 2, 2024")).toBeTruthy()
    cleanup()

    view = renderEditor("date-time", {
      overlays: { ...baseOverlays(), showInput: true },
      textDraft: {
        ...baseTextDraft(),
        activeTextValue: "2024-01-02T03:04:00",
      },
    })
    activateDataCell(view.container)
    expect(view.getByDisplayValue("2024-01-02T03:04")).toBeTruthy()
    cleanup()

    view = renderEditor("time", {
      overlays: { ...baseOverlays(), showInput: true },
      textDraft: { ...baseTextDraft(), activeTextValue: "03:04:00" },
    })
    activateDataCell(view.container)
    expect(view.getByDisplayValue("03:04:00")).toBeTruthy()
  })

  it("renders object and array editor triggers", () => {
    let view = renderEditor("object", {
      field: {
        ...baseField("object"),
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
      },
    })
    expect(view.getByRole("button").textContent).toContain("ACME")
    cleanup()

    view = renderEditor("array", {
      field: {
        ...baseField("array"),
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
      },
    })
    expect(view.getByRole("button").textContent).toContain("[2 items]")
  })
})
