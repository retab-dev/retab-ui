import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import { stripDescriptions } from "@/components/schema-editor/document/node-metadata"

/** Recursively reports whether any `description` key survives anywhere. */
function hasAnyDescription(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasAnyDescription)
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(record, "description")) return true
    return Object.values(record).some(hasAnyDescription)
  }
  return false
}

const rich: JSONSchema7 = {
  type: "object",
  description: "root",
  properties: {
    name: { type: "string", description: "the name" },
    nested: {
      type: "object",
      description: "nested object",
      properties: {
        inner: { type: "string", description: "inner" },
      },
    },
    rows: {
      type: "array",
      description: "array",
      items: { type: "object", description: "row", properties: {} },
    },
    union: {
      anyOf: [
        { type: "string", description: "branch a" },
        { type: "null" },
      ],
    },
  },
  patternProperties: {
    "^x-": { type: "string", description: "pattern" },
  },
  $defs: {
    Thing: {
      type: "object",
      description: "a definition",
      properties: { field: { type: "string", description: "def field" } },
    },
  },
}

describe("stripDescriptions", () => {
  it("removes every description across the whole tree", () => {
    const stripped = stripDescriptions(fromJsonSchema(rich))
    const json = toJsonSchema(stripped)
    expect(hasAnyDescription(json)).toBe(false)
  })

  it("removes descriptions inside if/then/else rest keywords", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { flag: { type: "boolean" } },
      if: { description: "cond", properties: {} },
      then: { description: "then", type: "string" },
      else: { description: "else", type: "number" },
    }
    const stripped = stripDescriptions(fromJsonSchema(schema))
    expect(hasAnyDescription(toJsonSchema(stripped))).toBe(false)
  })

  it("preserves titles and types while removing descriptions", () => {
    const schema: JSONSchema7 = {
      type: "object",
      title: "Root",
      properties: {
        a: { type: "string", title: "A", description: "remove me" },
      },
    }
    const json = toJsonSchema(stripDescriptions(fromJsonSchema(schema)))
    expect(json.title).toBe("Root")
    const a = (json.properties as Record<string, JSONSchema7>).a
    expect(a.title).toBe("A")
    expect(a.type).toBe("string")
    expect(a.description).toBeUndefined()
  })

  it("returns the same document reference when there is nothing to strip", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    expect(stripDescriptions(doc)).toBe(doc)
  })
})
