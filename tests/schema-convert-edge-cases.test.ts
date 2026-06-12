import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"

function rt(schema: JSONSchema7): JSONSchema7 & Record<string, unknown> {
  return toJsonSchema(fromJsonSchema(schema)) as JSONSchema7 &
    Record<string, unknown>
}

describe("convert: required handling", () => {
  it("preserves a required name that has no matching property (extraRequired)", () => {
    const out = rt({
      type: "object",
      properties: { a: { type: "string" } },
      required: ["a", "ghost"],
    })
    expect(out.required).toContain("a")
    expect(out.required).toContain("ghost")
  })

  it("preserves the source order of the required array", () => {
    const out = rt({
      type: "object",
      properties: { a: { type: "string" }, b: {}, c: {} },
      required: ["c", "a"],
    })
    expect(out.required).toEqual(["c", "a"])
  })

  it("does not emit an empty required array", () => {
    const out = rt({ type: "object", properties: { a: { type: "string" } } })
    expect(out.required).toBeUndefined()
  })
})

describe("convert: lossless preservation of unmodeled shapes", () => {
  it("preserves tuple (array-form) items verbatim", () => {
    const schema: JSONSchema7 = {
      type: "array",
      items: [{ type: "string" }, { type: "number" }],
    }
    expect(rt(schema)).toEqual(schema)
  })

  it("preserves a boolean property schema (true)", () => {
    const out = rt({
      type: "object",
      properties: { anything: true },
    })
    expect((out.properties as Record<string, unknown>).anything).toBe(true)
  })

  it("preserves additionalProperties: false", () => {
    const out = rt({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: false,
    })
    expect(out.additionalProperties).toBe(false)
  })

  it("preserves an unresolved external $ref", () => {
    const out = rt({
      type: "object",
      properties: { r: { $ref: "https://example.com/schema/X" } },
    })
    const r = (out.properties as Record<string, { $ref?: string }>).r
    expect(r.$ref).toBe("https://example.com/schema/X")
  })

  it("preserves the `definitions` keyword instead of rewriting to `$defs`", () => {
    const out = rt({
      type: "object",
      properties: { r: { $ref: "#/definitions/Foo" } },
      definitions: { Foo: { type: "string" } },
    })
    expect(out.definitions).toBeDefined()
    expect(out.$defs).toBeUndefined()
    const r = (out.properties as Record<string, { $ref?: string }>).r
    expect(r.$ref).toBe("#/definitions/Foo")
  })

  it("preserves patternProperties and its nested schemas", () => {
    const schema = {
      type: "object",
      properties: {},
      patternProperties: { "^x-": { type: "string" } },
    } as JSONSchema7
    const out = rt(schema)
    expect(out.patternProperties).toEqual({ "^x-": { type: "string" } })
  })
})

describe("convert: byte-faithful key order", () => {
  it("replays the original property key order", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        zeta: { type: "string" },
        alpha: { type: "number" },
        mu: { type: "boolean" },
      },
    }
    const out = rt(schema)
    expect(Object.keys(out.properties as object)).toEqual([
      "zeta",
      "alpha",
      "mu",
    ])
  })

  it("round-trips a mixed schema to identical JSON", () => {
    const schema: JSONSchema7 = {
      type: "object",
      title: "Invoice",
      description: "An invoice",
      properties: {
        id: { type: "string" },
        total: { type: "number" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: { sku: { type: "string" } },
            required: ["sku"],
          },
        },
      },
      required: ["id", "total"],
    }
    expect(JSON.stringify(rt(schema))).toBe(JSON.stringify(schema))
  })
})
