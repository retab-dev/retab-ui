// @vitest-environment jsdom
import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SchemaBuilder } from "@/components/schema-editor/schema-builder"

afterEach(cleanup)

/** Controlled editor harness that records every emitted schema. */
function renderEditor(
  initial: JSONSchema7,
  options: { readOnly?: boolean } = {}
) {
  const emits: JSONSchema7[] = []
  function Harness() {
    const [schema, setSchema] = React.useState(initial)
    return (
      <SchemaBuilder
        value={schema}
        readOnly={options.readOnly}
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

function openSchemaActionsMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Open schema actions" }),
    {
      button: 0,
      ctrlKey: false,
    }
  )
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
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
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

  it("does not offer to delete definitions referenced from raw schema keywords", () => {
    renderEditor({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      additionalProperties: { $ref: "#/$defs/Money" },
      properties: {},
    } as JSONSchema7)

    const moneySection = screen.getByText("Money").closest("[id]")!

    expect(
      within(moneySection as HTMLElement).queryByRole("button", {
        name: "Delete field",
      })
    ).toBeNull()
  })

  it("renders imported arrays without an items schema", () => {
    expect(() =>
      renderEditor({
        type: "object",
        properties: {
          rows: { type: "array" },
        },
      })
    ).not.toThrow()

    expect(screen.getByText("rows")).toBeTruthy()
    expect(screen.getByText("list")).toBeTruthy()
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
      expect.arrayContaining(["invoice_number", "total", "memo"])
    )
  })

  it("rejects duplicate property names before emitting", () => {
    const { emits } = renderEditor(sample)
    const input = screen.getAllByPlaceholderText("New property name")[0]
    fireEvent.change(input, { target: { value: "total" } })

    expect(screen.getByText(/already exists/)).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: "Add" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)

    fireEvent.keyDown(input, { key: "Enter" })
    expect(emits).toHaveLength(0)
  })

  it("does not render editing controls or emit in read-only mode", () => {
    const { emits } = renderEditor(sample, { readOnly: true })

    expect(screen.getByText("invoice_number")).toBeTruthy()
    expect(screen.queryByPlaceholderText("New property name")).toBeNull()
    expect(screen.queryByRole("button", { name: "Delete field" })).toBeNull()
    expect(
      (screen.getByDisplayValue("Invoice") as HTMLInputElement).disabled
    ).toBe(true)
    expect(
      screen.getByRole("button", { name: "View schema properties" })
    ).toBeTruthy()
    expect(emits).toHaveLength(0)
  })

  it("does not render enum editing controls in read-only mode", () => {
    const { emits } = renderEditor(
      {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "paid"] },
        },
      },
      { readOnly: true }
    )

    expect(
      (screen.getByDisplayValue("draft") as HTMLInputElement).disabled
    ).toBe(true)
    expect(
      (screen.getByDisplayValue("paid") as HTMLInputElement).disabled
    ).toBe(true)
    expect(screen.queryByPlaceholderText("New choice")).toBeNull()
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull()
    expect(emits).toHaveLength(0)
  })

  it("edits root title and description without dropping fields", () => {
    const { last } = renderEditor(sample)
    const titleInput = screen.getByDisplayValue("Invoice") as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: "Receipt" } })
    fireEvent.blur(titleInput)

    const descriptionInput = screen.getByPlaceholderText(
      "Add a description to your schema"
    ) as HTMLTextAreaElement
    fireEvent.change(descriptionInput, {
      target: { value: "Fields captured from the invoice." },
    })
    fireEvent.blur(descriptionInput)

    const out = last()!
    expect(out.title).toBe("Receipt")
    expect(out.description).toBe("Fields captured from the invoice.")
    expect(Object.keys(out.properties!)).toEqual(["invoice_number", "total"])
    expect(out.required).toEqual(["invoice_number", "total"])
  })

  it("deletes all descriptions through the schema actions menu", async () => {
    const { last } = renderEditor({
      type: "object",
      description: "root description",
      $defs: {
        Money: {
          type: "object",
          description: "money description",
          properties: {
            amount: { type: "number", description: "amount description" },
          },
        },
      },
      properties: {
        vendor: {
          type: "object",
          description: "vendor description",
          properties: {
            name: { type: "string", description: "name description" },
          },
        },
        rows: {
          type: "array",
          description: "rows description",
          items: {
            type: "object",
            description: "row description",
            properties: {
              sku: { type: "string", description: "sku description" },
            },
          },
        },
        status: {
          type: "string",
          enum: ["draft", "paid"],
          "x-enumDescriptions": {
            draft: "Draft status",
            paid: "Paid status",
          },
        } as JSONSchema7,
      },
    })

    openSchemaActionsMenu()
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: /Delete all descriptions/,
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    const out = last()!
    expect(out.description).toBeUndefined()
    expect((out.properties!.vendor as JSONSchema7).description).toBeUndefined()
    expect(
      ((out.properties!.vendor as JSONSchema7).properties!.name as JSONSchema7)
        .description
    ).toBeUndefined()
    expect((out.properties!.rows as JSONSchema7).description).toBeUndefined()
    expect(
      (((out.properties!.rows as JSONSchema7).items as JSONSchema7).properties!
        .sku as JSONSchema7).description
    ).toBeUndefined()
    expect((out.$defs!.Money as JSONSchema7).description).toBeUndefined()
    expect(
      ((out.$defs!.Money as JSONSchema7).properties!.amount as JSONSchema7)
        .description
    ).toBeUndefined()
    expect(
      (out.properties!.status as Record<string, unknown>)["x-enumDescriptions"]
    ).toBeUndefined()
  })

  it("deletes root fields through the schema actions menu", async () => {
    const { last } = renderEditor(sample)

    openSchemaActionsMenu()
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Delete Schema/ })
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    const out = last()!
    expect(out.type).toBe("object")
    expect(out.properties).toEqual({})
    expect(out.required).toEqual([])
  })

  it("edits a property description inline and emits it", () => {
    const { last } = renderEditor(sample)
    // total has no description → its row shows the "Add description" placeholder
    const totalRow = screen.getByText("total").closest("div")!
    const placeholder = within(
      totalRow.parentElement as HTMLElement
    ).getAllByText("Add description")[0]
    fireEvent.click(placeholder) // switch to edit mode
    const input = screen.getByPlaceholderText(
      "Add description"
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: "amount due" } })
    fireEvent.blur(input)
    const out = last()!
    expect((out.properties!.total as JSONSchema7).description).toBe(
      "amount due"
    )
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
      expect.arrayContaining(["invoice_number", "total", "memo"])
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
      expect.arrayContaining(["name", "city", "zip"])
    )
    // the edit was node-local to vendor — the root gained nothing
    expect(Object.keys(out.properties!)).toEqual(["vendor"])
  })

  it("keeps the new enum choice input focused after adding a choice", () => {
    const { last } = renderEditor({
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft"] },
      },
    })

    const input = screen.getByPlaceholderText("New choice") as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: "paid" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(document.activeElement).toBe(input)
    const status = last()!.properties!.status as JSONSchema7
    expect(status.enum).toEqual(["draft", "paid"])
  })
})
