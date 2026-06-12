import { describe, expect, it } from "vitest"

import {
  getEffectiveType,
  setNullable,
} from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

/**
 * The property-form draft layer historically assumed nullability is always the
 * `anyOf: [X, {type:"null"}]` form. But the standard JSON Schema nullable form —
 * and what the document-model schema builder emits — is a type union
 * `type: ["string", "null"]`. These tests pin down that both reading
 * (`getEffectiveType`) and writing (`setNullable`) handle the union form.
 */

describe("getEffectiveType: type-union nullable form", () => {
  it("reports a `[scalar, null]` union as the scalar, nullable", () => {
    expect(getEffectiveType({ type: ["string", "null"] })).toEqual({
      type: "string",
      isNullable: true,
    })
    expect(getEffectiveType({ type: ["integer", "null"] })).toEqual({
      type: "integer",
      isNullable: true,
    })
  })

  it("keeps format-derived types nullable in union form", () => {
    expect(
      getEffectiveType({ type: ["string", "null"], format: "date" })
    ).toEqual({ type: "date", isNullable: true })
    expect(
      getEffectiveType({ type: ["string", "null"], format: "date-time" })
    ).toEqual({ type: "datetime", isNullable: true })
  })

  it("treats an enum/ref with a union null member as nullable", () => {
    expect(
      getEffectiveType({ type: ["string", "null"], enum: ["a", "b"] })
    ).toEqual({ type: "enum", isNullable: true })
    expect(
      getEffectiveType({
        type: ["string", "null"],
        $ref: "#/$defs/X",
      } as ExtendedJSONSchema7)
    ).toEqual({ type: "$ref", isNullable: true })
  })

  it("leaves plain (non-union) nodes unchanged", () => {
    expect(getEffectiveType({ type: "string" })).toEqual({
      type: "string",
      isNullable: false,
    })
    expect(
      getEffectiveType({ anyOf: [{ type: "number" }, { type: "null" }] })
    ).toEqual({ type: "number", isNullable: true })
  })
})

describe("setNullable: type-union nullable form", () => {
  it("turning OFF a `[scalar, null]` union actually removes null", () => {
    expect(setNullable({ type: ["string", "null"] }, false)).toEqual({
      type: "string",
    })
    expect(setNullable({ type: ["integer", "null"] }, false)).toEqual({
      type: "integer",
    })
  })

  it("turning ON a union node does not produce a doubly-null branch", () => {
    const out = setNullable({ type: ["string", "null"] }, true)
    // exactly one null branch, and the non-null branch is a clean scalar
    expect(out.anyOf).toEqual([{ type: "string" }, { type: "null" }])
  })

  it("is idempotent and reversible against the union form", () => {
    const start: ExtendedJSONSchema7 = { type: ["string", "null"] }
    const off = setNullable(start, false)
    expect(getEffectiveType(off).isNullable).toBe(false)
    const onAgain = setNullable(off, true)
    expect(getEffectiveType(onAgain).isNullable).toBe(true)
    expect(getEffectiveType(onAgain).type).toBe("string")
  })

  it("preserves title/description when collapsing a union", () => {
    const out = setNullable(
      { type: ["string", "null"], title: "T", description: "D" },
      false
    )
    expect(out.title).toBe("T")
    expect(out.description).toBe("D")
    expect(out.type).toBe("string")
  })

  it("does not disturb plain scalar nodes", () => {
    expect(setNullable({ type: "string" }, false)).toEqual({ type: "string" })
  })
})
