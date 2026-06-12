// @vitest-environment jsdom
import * as React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JSONSchema7 } from "json-schema"

import { SchemaBuilder } from "@/components/schema-editor/schema-builder"

afterEach(cleanup)

/** Controlled editor harness that records every emitted schema. */
function renderEditor(initial: JSONSchema7) {
  const emits: JSONSchema7[] = []
  function Harness() {
    const [schema, setSchema] = React.useState(initial)
    return (
      <SchemaBuilder
        value={schema}
        onValueChange={(s) => {
          emits.push(s as JSONSchema7)
          setSchema(s as JSONSchema7)
        }}
      />
    )
  }
  const utils = render(<Harness />)
  return { emits, last: () => emits.at(-1), ...utils }
}

const sample: JSONSchema7 = {
  type: "object",
  title: "Invoice",
  properties: {
    invoice_number: { type: "string", description: "the id" },
    total: { type: "number" },
  },
  required: ["invoice_number"],
}

describe("SchemaBuilder renders (integration smoke)", () => {
  it("mounts the full editor and shows the property names", () => {
    renderEditor(sample)
    expect(screen.getByText("invoice_number")).toBeTruthy()
    expect(screen.getByText("total")).toBeTruthy()
  })

  it("renders nested objects and $defs without crashing", () => {
    renderEditor({
      type: "object",
      $defs: { Money: { type: "object", properties: { amount: { type: "number" } } } },
      properties: {
        vendor: { type: "object", properties: { name: { type: "string" } } },
        cost: { $ref: "#/$defs/Money" },
      },
    })
    expect(screen.getByText("vendor")).toBeTruthy()
    expect(screen.getByText("name")).toBeTruthy()
    // $defs section header
    expect(screen.getByText(/Definitions/)).toBeTruthy()
  })
})

describe("SchemaBuilder interactions (doc-routed)", () => {
  it("adds a property via the inline input and emits an updated schema", () => {
    const { emits, last } = renderEditor(sample)
    const input = screen.getAllByPlaceholderText("New property name")[0]
    fireEvent.change(input, { target: { value: "memo" } })
    // press Enter to add
    fireEvent.keyDown(input, { key: "Enter" })
    expect(emits.length).toBeGreaterThan(0)
    const out = last()!
    expect(Object.keys(out.properties!)).toContain("memo")
    // existing properties are preserved
    expect(Object.keys(out.properties!)).toEqual(
      expect.arrayContaining(["invoice_number", "total", "memo"]),
    )
  })

  it("edits a property description inline and emits it", () => {
    const { last } = renderEditor(sample)
    // total has no description → its row shows the "Add description" placeholder
    const totalRow = screen.getByText("total").closest("div")!
    const placeholder = within(totalRow.parentElement as HTMLElement)
      .getAllByText("Add description")[0]
    fireEvent.click(placeholder) // switch to edit mode
    const input = screen.getByPlaceholderText("Add description") as HTMLInputElement
    fireEvent.change(input, { target: { value: "amount due" } })
    fireEvent.blur(input)
    const out = last()!
    expect((out.properties!.total as JSONSchema7).description).toBe("amount due")
  })

  it("has no per-property Required control (required is the default policy)", () => {
    renderEditor(sample)
    expect(screen.queryByText("Required")).toBeNull()
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
  })

  it("names icon-only property action buttons", () => {
    renderEditor(sample)

    expect(
      screen.getAllByRole("button", { name: "Edit field properties" }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole("button", { name: "Delete field" }).length
    ).toBeGreaterThan(0)
  })

  it("every property — new and existing — is emitted as required", () => {
    const { last } = renderEditor(sample)
    const input = screen.getAllByPlaceholderText("New property name")[0]
    fireEvent.change(input, { target: { value: "memo" } })
    fireEvent.keyDown(input, { key: "Enter" })
    const out = last()!
    // existing + new are all required
    expect(out.required).toEqual(
      expect.arrayContaining(["invoice_number", "total", "memo"]),
    )
  })

  it("never emits a schema that drops existing properties", () => {
    const { emits } = renderEditor(sample)
    const input = screen.getAllByPlaceholderText("New property name")[0]
    fireEvent.change(input, { target: { value: "x" } })
    fireEvent.keyDown(input, { key: "Enter" })
    for (const e of emits) {
      // invoice_number must survive every emitted schema
      expect(Object.keys(e.properties ?? {})).toContain("invoice_number")
    }
  })

  it("renames a property inline (parent-level op) and required follows", () => {
    const { last } = renderEditor(sample)
    fireEvent.click(screen.getByText("invoice_number")) // enter edit mode
    const input = screen.getByDisplayValue("invoice_number") as HTMLInputElement
    fireEvent.change(input, { target: { value: "inv_no" } })
    fireEvent.keyDown(input, { key: "Enter" })
    const out = last()!
    expect(Object.keys(out.properties!)).toContain("inv_no")
    expect(Object.keys(out.properties!)).not.toContain("invoice_number")
    // all required (policy): the renamed field + the others
    expect(out.required).toEqual(expect.arrayContaining(["inv_no", "total"]))
  })

  it("edits a NESTED property (recursive doc-routing) and keeps the parent intact", () => {
    const { last } = renderEditor({
      type: "object",
      properties: {
        vendor: {
          type: "object",
          properties: { name: { type: "string" }, city: { type: "string" } },
        },
      },
    })
    // The nested `vendor` add-input renders before the root's in the DOM.
    const inputs = screen.getAllByPlaceholderText("New property name")
    const nestedInput = inputs[0]
    fireEvent.change(nestedInput, { target: { value: "zip" } })
    fireEvent.keyDown(nestedInput, { key: "Enter" })
    const out = last()!
    const vendor = out.properties!.vendor as JSONSchema7
    expect(Object.keys(vendor.properties!)).toEqual(
      expect.arrayContaining(["name", "city", "zip"]),
    )
    // the edit was node-local to vendor — the root gained nothing
    expect(Object.keys(out.properties!)).toEqual(["vendor"])
  })
})
