import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  emptyValueFor,
  expandRefs,
  fieldKind,
  labelFor,
  scalarObjectColumns,
  unwrapNullable,
} from "@/components/json-form/schema-model"

describe("json-form schema model", () => {
  it("expands local $defs refs while preserving sibling overrides", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: {
        Person: {
          type: "object",
          title: "Person",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
      },
      properties: {
        owner: {
          $ref: "#/$defs/Person",
          title: "Owner",
          properties: {
            email: { type: "string", format: "email" },
          },
          required: ["email"],
        },
      },
    }

    const expanded = expandRefs(schema)
    const owner = expanded.properties?.owner as JSONSchema7

    expect(owner.$ref).toBeUndefined()
    expect(owner.title).toBe("Owner")
    expect(Object.keys(owner.properties ?? {})).toEqual(["name", "email"])
    expect(owner.required).toEqual(["name", "email"])
  })

  it("decodes JSON Pointer escapes in local $defs refs", () => {
    const expanded = expandRefs({
      type: "object",
      $defs: {
        "price/currency": {
          type: "object",
          properties: {
            amount: { type: "number" },
          },
        },
        "tax~rate": {
          type: "number",
        },
      },
      properties: {
        total: { $ref: "#/$defs/price~1currency" },
        tax_rate: { $ref: "#/$defs/tax~0rate" },
      },
    })

    expect(expanded.properties?.total).toEqual({
      type: "object",
      properties: {
        amount: { type: "number" },
      },
    })
    expect(expanded.properties?.tax_rate).toEqual({ type: "number" })
  })

  it("expands local refs to nested schema nodes", () => {
    const expanded = expandRefs({
      type: "object",
      $defs: {
        Envelope: {
          type: "object",
          properties: {
            id: { type: "string", title: "Envelope ID" },
            total: { type: "number" },
          },
        },
      },
      properties: {
        envelope_id: {
          $ref: "#/$defs/Envelope/properties/id",
          description: "Copied from the envelope",
        },
      },
    })

    expect(expanded.properties?.envelope_id).toEqual({
      type: "string",
      title: "Envelope ID",
      description: "Copied from the envelope",
    })
  })

  it("expands refs inside dictionary property schemas", () => {
    const expanded = expandRefs({
      type: "object",
      $defs: {
        Value: {
          type: "string",
          title: "Metadata value",
        },
      },
      properties: {
        metadata: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/Value" },
          patternProperties: {
            "^x_": { $ref: "#/$defs/Value", description: "Extension" },
          },
        },
      },
    })
    const metadata = expanded.properties?.metadata as JSONSchema7

    expect(metadata.additionalProperties).toEqual({
      type: "string",
      title: "Metadata value",
    })
    expect(metadata.patternProperties?.["^x_"]).toEqual({
      type: "string",
      title: "Metadata value",
      description: "Extension",
    })
  })

  it("merges allOf object branches", () => {
    const expanded = expandRefs({
      allOf: [
        {
          type: "object",
          properties: { first_name: { type: "string" } },
          required: ["first_name"],
        },
        {
          type: "object",
          properties: { age: { type: "integer" } },
          required: ["age"],
        },
      ],
    })

    expect(Object.keys(expanded.properties ?? {})).toEqual([
      "first_name",
      "age",
    ])
    expect(expanded.required).toEqual(["first_name", "age"])
  })

  it("deep-merges overlapping object properties across allOf branches", () => {
    const expanded = expandRefs({
      allOf: [
        {
          type: "object",
          properties: {
            vendor: {
              type: "object",
              properties: {
                name: { type: "string", title: "Name" },
              },
              required: ["name"],
            },
          },
        },
        {
          type: "object",
          properties: {
            vendor: {
              type: "object",
              properties: {
                email: { type: "string", format: "email", title: "Email" },
              },
              required: ["email"],
            },
          },
        },
      ],
    })

    expect(expanded.properties?.vendor).toEqual({
      type: "object",
      properties: {
        name: { type: "string", title: "Name" },
        email: { type: "string", format: "email", title: "Email" },
      },
      required: ["name", "email"],
    })
  })

  it("expands sibling schema nodes after merging allOf branches", () => {
    const expanded = expandRefs({
      type: "object",
      $defs: {
        Code: { type: "string", title: "Code" },
        Row: {
          type: "object",
          properties: {
            code: { $ref: "#/$defs/Code" },
          },
        },
      },
      properties: {
        status: { $ref: "#/$defs/Code" },
        rows: {
          type: "array",
          items: { $ref: "#/$defs/Row" },
        },
        metadata: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/Code" },
        },
      },
      allOf: [
        {
          type: "object",
          properties: {
            amount: { type: "number" },
          },
        },
      ],
    })

    expect(expanded.properties?.status).toEqual({
      type: "string",
      title: "Code",
    })
    const rows = expanded.properties?.rows as JSONSchema7
    expect(rows.items).toEqual({
      type: "object",
      properties: {
        code: { type: "string", title: "Code" },
      },
    })
    const metadata = expanded.properties?.metadata as JSONSchema7
    expect(metadata.additionalProperties).toEqual({
      type: "string",
      title: "Code",
    })
    expect(expanded.properties?.amount).toEqual({ type: "number" })
  })

  it("unwraps nullable unions without losing top-level metadata", () => {
    expect(
      unwrapNullable({
        title: "Invoice date",
        description: "When the invoice was issued",
        anyOf: [{ type: "null" }, { type: "string", format: "date" }],
      })
    ).toEqual({
      nullable: true,
      schema: {
        type: "string",
        format: "date",
        title: "Invoice date",
        description: "When the invoice was issued",
      },
    })

    expect(unwrapNullable({ type: ["number", "null"], minimum: 0 })).toEqual({
      nullable: true,
      schema: { type: "number", minimum: 0 },
    })
  })

  it("classifies enums before primitive schema types", () => {
    expect(fieldKind({ type: "string", enum: ["draft", "paid"] })).toBe("enum")
    expect(fieldKind({ type: ["integer", "null"] })).toBe("integer")
    expect(fieldKind({})).toBe("string")
  })

  it("derives labels from title, explicit labels, and path leaves", () => {
    expect(labelFor("vendor.name", { title: "Supplier" })).toBe("Supplier")
    expect(labelFor("vendor.tax-id", {}, "Tax ID")).toBe("Tax ID")
    expect(labelFor("line_items.0.unit_price", {})).toBe("Unit Price")
  })

  it("returns stable empty values for appended fields", () => {
    expect(emptyValueFor({ type: "boolean" })).toBe(false)
    expect(emptyValueFor({ type: "object" })).toEqual({})
    expect(emptyValueFor({ type: "array" })).toEqual([])
    expect(emptyValueFor({ type: "number" })).toBeUndefined()
    expect(emptyValueFor({ type: ["string", "null"] })).toBeNull()
  })

  it("detects table columns only for flat scalar object arrays", () => {
    expect(
      scalarObjectColumns({
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Line name" },
          count: { type: ["integer", "null"] },
          active: { type: "boolean" },
        },
      })
    ).toEqual([
      {
        key: "name",
        schema: { type: "string", description: "Line name" },
        kind: "string",
        required: true,
        nullable: false,
      },
      {
        key: "count",
        schema: { type: "integer" },
        kind: "integer",
        required: false,
        nullable: true,
      },
      {
        key: "active",
        schema: { type: "boolean" },
        kind: "boolean",
        required: false,
        nullable: false,
      },
    ])

    expect(
      scalarObjectColumns({
        type: "object",
        properties: {
          nested: {
            type: "object",
            properties: { value: { type: "string" } },
          },
        },
      })
    ).toBeNull()
  })
})
