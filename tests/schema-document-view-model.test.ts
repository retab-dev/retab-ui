import { describe, expect, it } from "vitest"
import type { JSONSchema7 } from "json-schema"

import {
  fromJsonSchema,
  getDocumentNodeView,
  getSchemaDocumentView,
} from "@/components/schema-editor/document"

describe("schema document view model", () => {
  it("projects object properties with stable property ids", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        total: { type: "number" },
      },
      required: ["invoice_number"],
    })

    const view = getDocumentNodeView(doc, doc.root)

    expect(view.type).toBe("object")
    expect(view.properties.map((property) => property.propertyName)).toEqual([
      "invoice_number",
      "total",
    ])
    expect(view.properties[0].propertyId).toMatch(/^prop-/)
    expect(view.properties[0].isRequired).toBe(true)
    expect(view.properties[1].isRequired).toBe(false)
  })

  it("derives arrays, enum entries, nullable state, and formatted strings", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        issued_at: { type: "string", format: "date-time" },
        tags: { type: "array", items: { type: "string", enum: ["a", "b"] } },
        note: { type: ["string", "null"] },
      },
    })

    const view = getDocumentNodeView(doc, doc.root)
    const issuedAt = view.properties.find(
      (property) => property.propertyName === "issued_at"
    )!.nodeView
    const tags = view.properties.find(
      (property) => property.propertyName === "tags"
    )!.nodeView
    const note = view.properties.find(
      (property) => property.propertyName === "note"
    )!.nodeView

    expect(issuedAt.type).toBe("datetime")
    expect(tags.type).toBe("array")
    expect(tags.items?.type).toBe("enum")
    expect(tags.items?.enumEntries.map((entry) => entry.value)).toEqual([
      "a",
      "b",
    ])
    expect(note.type).toBe("string")
    expect(note.isNullable).toBe(true)
  })

  it("resolves ref display names from definition identity", () => {
    const doc = fromJsonSchema({
      type: "object",
      $defs: {
        Address: {
          type: "object",
          properties: { city: { type: "string" } },
        },
      },
      properties: {
        billing_address: { $ref: "#/$defs/Address" },
      },
    })

    const view = getSchemaDocumentView(doc)
    const address = view.root.properties[0].nodeView

    expect(view.definitions).toHaveLength(1)
    expect(view.definitions[0].definitionName).toBe("Address")
    expect(address.type).toBe("$ref")
    expect(address.refName).toBe("Address")
  })

  it("builds a large object view within an interactive budget", () => {
    const properties: NonNullable<JSONSchema7["properties"]> = Object.fromEntries(
      Array.from({ length: 750 }, (_, index) => [
        `field_${index}`,
        { type: index % 2 === 0 ? "string" : "number" } satisfies JSONSchema7,
      ])
    )
    const doc = fromJsonSchema({ type: "object", properties })

    const startedAt = performance.now()
    const view = getDocumentNodeView(doc, doc.root)
    const elapsedMs = performance.now() - startedAt

    expect(view.properties).toHaveLength(750)
    expect(elapsedMs).toBeLessThan(100)
  })
})
