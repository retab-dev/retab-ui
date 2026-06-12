import { describe, expect, it } from "vitest"

import {
  getEffectiveType,
  setNullable,
  updateSchemaProperty,
  updateType,
} from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

describe("getEffectiveType", () => {
  it("reads a plain scalar type", () => {
    expect(getEffectiveType({ type: "string" })).toEqual({
      type: "string",
      isNullable: false,
    })
  })

  it("detects nullability from a nullable anyOf", () => {
    expect(
      getEffectiveType({ anyOf: [{ type: "number" }, { type: "null" }] })
    ).toEqual({ type: "number", isNullable: true })
  })

  it("recognizes $ref, enum, and date formats", () => {
    expect(getEffectiveType({ $ref: "#/$defs/X" }).type).toBe("$ref")
    expect(getEffectiveType({ enum: ["a"] }).type).toBe("enum")
    expect(getEffectiveType({ type: "string", format: "date" }).type).toBe(
      "date"
    )
    expect(
      getEffectiveType({ type: "string", format: "date-time" }).type
    ).toBe("datetime")
  })

  it("detects $ref / enum inside a nullable anyOf", () => {
    expect(
      getEffectiveType({ anyOf: [{ $ref: "#/$defs/X" }, { type: "null" }] })
    ).toEqual({ type: "$ref", isNullable: true })
    expect(
      getEffectiveType({ anyOf: [{ enum: ["a"] }, { type: "null" }] })
    ).toEqual({ type: "enum", isNullable: true })
  })

  it("treats a type union ['string','null'] as a nullable scalar", () => {
    expect(getEffectiveType({ type: ["string", "null"] })).toEqual({
      type: "string",
      isNullable: true,
    })
    expect(getEffectiveType({ type: ["integer", "null"] })).toEqual({
      type: "integer",
      isNullable: true,
    })
  })

  it("reads date formats off a nullable type union", () => {
    expect(
      getEffectiveType({ type: ["string", "null"], format: "date" })
    ).toEqual({ type: "date", isNullable: true })
  })
})

describe("updateType", () => {
  it("changes the scalar type and preserves title/description", () => {
    const next = updateType("number", false, {
      type: "string",
      title: "Amount",
      description: "The amount",
    })
    expect(next).toEqual({
      type: "number",
      title: "Amount",
      description: "The amount",
    })
  })

  it("wraps in a nullable anyOf when nullable is requested", () => {
    const next = updateType("string", true, { type: "number" })
    expect(next).toEqual({ anyOf: [{ type: "string" }, { type: "null" }] })
  })

  it("preserves existing enum values when switching to enum", () => {
    const next = updateType("enum", false, {
      type: "string",
      enum: ["a", "b"],
    })
    expect(next).toMatchObject({ type: "string", enum: ["a", "b"] })
  })

  it("produces an array with string items by default", () => {
    const next = updateType("array", false, { type: "string" })
    expect(next).toEqual({ type: "array", items: { type: "string" } })
  })
})

describe("setNullable", () => {
  it("wraps a scalar into a nullable anyOf", () => {
    expect(setNullable({ type: "string" }, true)).toEqual({
      anyOf: [{ type: "string" }, { type: "null" }],
    })
  })

  it("unwraps a nullable anyOf back to the scalar", () => {
    expect(
      setNullable({ anyOf: [{ type: "string" }, { type: "null" }] }, false)
    ).toEqual({ type: "string" })
  })

  it("preserves title and description across the wrap", () => {
    expect(
      setNullable({ type: "string", title: "T", description: "D" }, true)
    ).toEqual({
      anyOf: [{ type: "string" }, { type: "null" }],
      title: "T",
      description: "D",
    })
  })

  it("is idempotent when already nullable", () => {
    const nullable = setNullable({ type: "string" }, true)
    expect(setNullable(nullable, true)).toEqual(nullable)
  })

  it("round-trips scalar -> nullable -> scalar", () => {
    const scalar: ExtendedJSONSchema7 = { type: "integer" }
    expect(setNullable(setNullable(scalar, true), false)).toEqual(scalar)
  })

  it("returns the node unchanged when disabling on a non-nullable node", () => {
    const node: ExtendedJSONSchema7 = { type: "string" }
    expect(setNullable(node, false)).toBe(node)
  })
})

describe("updateSchemaProperty", () => {
  const base: ExtendedJSONSchema7 = {
    type: "object",
    properties: {
      old: { type: "string" },
      keep: { type: "number" },
    },
    required: ["old", "keep"],
  }

  it("renames a property and rewrites the required array", () => {
    const next = updateSchemaProperty(base, "old", "renamed", { type: "string" })
    const props = next.properties as Record<string, ExtendedJSONSchema7>
    expect(Object.keys(props)).toEqual(["renamed", "keep"])
    expect(props.old).toBeUndefined()
    expect(next.required).toEqual(["renamed", "keep"])
  })

  it("preserves property order when renaming", () => {
    const next = updateSchemaProperty(base, "old", "renamed", { type: "string" })
    expect(Object.keys(next.properties as object)).toEqual(["renamed", "keep"])
  })

  it("updates a property in place without a rename", () => {
    const next = updateSchemaProperty(base, "old", "old", { type: "integer" })
    const props = next.properties as Record<string, ExtendedJSONSchema7>
    expect(props.old).toMatchObject({ type: "integer" })
    expect(next.required).toEqual(["old", "keep"])
  })

  it("refuses to rename onto an existing sibling (no data loss)", () => {
    // Renaming "old" -> "keep" must not drop a property or duplicate required.
    const next = updateSchemaProperty(base, "old", "keep", { type: "string" })
    const props = next.properties as Record<string, ExtendedJSONSchema7>
    expect(Object.keys(props).sort()).toEqual(["keep", "old"])
    expect(props.keep).toEqual({ type: "number" })
    expect(next.required).toEqual(["old", "keep"])
  })
})
