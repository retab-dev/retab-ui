import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  countSchemaProperties,
  validateProjectedSchema,
} from "@/components/schema-editor/validation"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/schema-builder-types"

describe("countSchemaProperties", () => {
  it("counts direct properties", () => {
    expect(
      countSchemaProperties({
        type: "object",
        properties: { a: { type: "string" }, b: { type: "number" } },
      })
    ).toBe(2)
  })

  it("counts nested object properties", () => {
    expect(
      countSchemaProperties({
        type: "object",
        properties: {
          a: {
            type: "object",
            properties: { x: { type: "string" }, y: { type: "string" } },
          },
        },
      })
    ).toBe(3) // a + x + y
  })

  it("counts properties inside array items", () => {
    expect(
      countSchemaProperties({
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: { p: { type: "string" }, q: { type: "string" } },
            },
          },
        },
      })
    ).toBe(3) // rows + p + q
  })

  it("counts properties reached through a local $ref", () => {
    const schema = {
      type: "object",
      properties: { c: { $ref: "#/$defs/C" } },
      $defs: { C: { type: "object", properties: { p: {}, q: {} } } },
    } as unknown as ExtendedJSONSchema7
    expect(countSchemaProperties(schema)).toBe(3) // c + p + q
  })

  it("terminates on a recursive $ref without double counting", () => {
    const schema = {
      type: "object",
      properties: { node: { $ref: "#/$defs/Node" } },
      $defs: {
        Node: {
          type: "object",
          properties: { child: { $ref: "#/$defs/Node" } },
        },
      },
    } as unknown as ExtendedJSONSchema7
    expect(countSchemaProperties(schema)).toBe(2) // node + child (cycle stops)
  })

  it("returns 0 for non-object input", () => {
    expect(countSchemaProperties(undefined)).toBe(0)
    expect(countSchemaProperties(true as unknown as ExtendedJSONSchema7)).toBe(0)
  })
})

describe("validateProjectedSchema: property limit", () => {
  function objectWithProperties(count: number): ExtendedJSONSchema7 {
    const properties: Record<string, JSONSchema7> = {}
    for (let i = 0; i < count; i += 1) properties[`p${i}`] = { type: "string" }
    return { type: "object", properties } as ExtendedJSONSchema7
  }

  it("accepts a schema at the limit", () => {
    const result = validateProjectedSchema(objectWithProperties(500))
    expect(result.propertyCount).toBe(500)
    expect(result.isPropertyLimitExceeded).toBe(false)
  })

  it("flags a schema over the limit and blocks validity", () => {
    const result = validateProjectedSchema(objectWithProperties(501))
    expect(result.propertyCount).toBe(501)
    expect(result.isPropertyLimitExceeded).toBe(true)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]?.code).toBe("property_limit_exceeded")
  })
})
