import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import { isNullable } from "@/components/schema-editor/document/derive"
import {
  addEnumValue,
  removeEnumValueAtIndex,
  setEnumValues,
  updateEnumValueAtIndex,
} from "@/components/schema-editor/document/enum-operations"
import { getEffectiveDocNode } from "@/components/schema-editor/document/node-selectors"
import { getChildNodeId } from "@/components/schema-editor/document/node-selectors"
import { getNode } from "@/components/schema-editor/document/traversal"

function enumDoc(schema: JSONSchema7) {
  const doc = fromJsonSchema({
    type: "object",
    properties: { pick: schema },
  })
  return { doc, id: getChildNodeId(doc, doc.root.id, "pick")! }
}

/** Reads the projected enum values for the "pick" property. */
function projectedEnum(json: JSONSchema7): unknown[] | undefined {
  const pick = (json.properties as Record<string, JSONSchema7>).pick
  if (pick.enum) return pick.enum
  const branch = pick.anyOf?.find(
    (b) => typeof b === "object" && b !== null && (b as JSONSchema7).enum
  ) as JSONSchema7 | undefined
  return branch?.enum
}

describe("enum-operations on a plain enum", () => {
  it("appends a value", () => {
    const { doc, id } = enumDoc({ type: "string", enum: ["a", "b"] })
    const next = addEnumValue(doc, id, "c")
    expect(projectedEnum(toJsonSchema(next))).toEqual(["a", "b", "c"])
  })

  it("updates a value by index", () => {
    const { doc, id } = enumDoc({ type: "string", enum: ["a", "b"] })
    const next = updateEnumValueAtIndex(doc, id, 0, "z")
    expect(projectedEnum(toJsonSchema(next))).toEqual(["z", "b"])
  })

  it("removes a value by index", () => {
    const { doc, id } = enumDoc({ type: "string", enum: ["a", "b", "c"] })
    const next = removeEnumValueAtIndex(doc, id, 1)
    expect(projectedEnum(toJsonSchema(next))).toEqual(["a", "c"])
  })

  it("replaces all values with setEnumValues", () => {
    const { doc, id } = enumDoc({ type: "string", enum: ["a"] })
    const next = setEnumValues(doc, id, ["x", "y", "z"])
    expect(projectedEnum(toJsonSchema(next))).toEqual(["x", "y", "z"])
  })

  it("is a no-op when updating an out-of-range index", () => {
    const { doc, id } = enumDoc({ type: "string", enum: ["a"] })
    expect(updateEnumValueAtIndex(doc, id, 5, "z")).toBe(doc)
    expect(removeEnumValueAtIndex(doc, id, 5)).toBe(doc)
  })

  it("preserves enum entry ids across an update (stable identity)", () => {
    const { doc, id } = enumDoc({ type: "string", enum: ["a", "b"] })
    const before = getEffectiveDocNode(getNode(doc, id)!).enum!.map((e) => e.id)
    const next = updateEnumValueAtIndex(doc, id, 0, "z")
    const after = getEffectiveDocNode(getNode(next, id)!).enum!.map((e) => e.id)
    expect(after).toEqual(before)
  })
})

describe("enum-operations on a nullable enum", () => {
  it("wraps a nullable type-array enum in a nullable anyOf when appending", () => {
    const { doc, id } = enumDoc({
      type: ["string", "null"],
      enum: ["a", "b"],
    })
    const next = addEnumValue(doc, id, "c")
    expect(isNullable(getNode(next, id)!)).toBe(true)
    expect(projectedEnum(toJsonSchema(next))).toEqual(["a", "b", "c"])
  })

  it("keeps the null branch while replacing values", () => {
    const { doc, id } = enumDoc({
      type: ["string", "null"],
      enum: ["a"],
    })
    const next = setEnumValues(doc, id, ["x", "y"])
    expect(isNullable(getNode(next, id)!)).toBe(true)
    expect(projectedEnum(toJsonSchema(next))).toEqual(["x", "y"])
  })
})
