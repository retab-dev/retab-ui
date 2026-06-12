import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import { isNullable } from "@/components/schema-editor/document/derive"
import { getNodeJson } from "@/components/schema-editor/document/json-node"
import { getChildNodeId } from "@/components/schema-editor/document/node-selectors"
import { getNode } from "@/components/schema-editor/document/traversal"
import {
  setNodeEditorType,
  setNodeType,
  setNullable,
} from "@/components/schema-editor/document/type-operations"

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    scalar: { type: "string" },
    count: { type: "integer" },
    obj: { type: "object", properties: { inner: { type: "string" } } },
    list: { type: "array", items: { type: "string" } },
    pick: { type: "string", enum: ["a", "b"] },
  },
}

function childId(key: string) {
  const doc = fromJsonSchema(schema)
  return { doc, id: getChildNodeId(doc, doc.root.id, key)! }
}

describe("setNullable: marks and reports nullability", () => {
  it.each(["scalar", "count", "obj", "list", "pick"])(
    "makes %s nullable",
    (key) => {
      const { doc, id } = childId(key)
      const next = setNullable(doc, id, true)
      expect(isNullable(getNode(next, id)!)).toBe(true)
      // Projection must stay valid JSON Schema (object form).
      expect(() => toJsonSchema(next)).not.toThrow()
    }
  )

  it.each(["scalar", "count", "obj", "list", "pick"])(
    "round-trips %s: on then off restores the original projection",
    (key) => {
      const { doc, id } = childId(key)
      const before = getNodeJson(doc, id)
      const toggled = setNullable(setNullable(doc, id, true), id, false)
      expect(isNullable(getNode(toggled, id)!)).toBe(false)
      expect(getNodeJson(toggled, id)).toEqual(before)
    }
  )

  it("is idempotent when enabling twice", () => {
    const { doc, id } = childId("scalar")
    const once = setNullable(doc, id, true)
    const twice = setNullable(once, id, true)
    expect(getNodeJson(twice, id)).toEqual(getNodeJson(once, id))
  })

  it("does not add a second null branch to an already-nullable union", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        u: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
    })
    const id = getChildNodeId(doc, doc.root.id, "u")!
    const next = setNullable(doc, id, true)
    const json = getNodeJson(next, id) as { anyOf?: unknown[] }
    const nullBranches = (json.anyOf ?? []).filter(
      (b) => typeof b === "object" && b !== null && (b as JSONSchema7).type === "null"
    )
    expect(nullBranches).toHaveLength(1)
  })
})

describe("setNodeType: transitions preserve nullability and emit valid JSON", () => {
  it("keeps a property nullable after a type change", () => {
    const { doc, id } = childId("scalar")
    const nullable = setNullable(doc, id, true)
    const retyped = setNodeType(nullable, id, "integer")
    expect(isNullable(getNode(retyped, id)!)).toBe(true)
  })

  it.each(["string", "number", "integer", "boolean", "object", "array", "enum"] as const)(
    "switches scalar -> %s and projects cleanly",
    (type) => {
      const { doc, id } = childId("scalar")
      const next = setNodeType(doc, id, type)
      expect(() => toJsonSchema(next)).not.toThrow()
      expect(getNode(next, id)).not.toBeNull()
    }
  )

  it("clears object properties when switching object -> string", () => {
    const { doc, id } = childId("obj")
    const next = setNodeType(doc, id, "string")
    const json = getNodeJson(next, id) as JSONSchema7
    expect(json.type).toBe("string")
    expect(json.properties).toBeUndefined()
  })
})

describe("setNodeEditorType: date/time formats", () => {
  it.each([
    ["date", "date"],
    ["time", "time"],
    ["datetime", "date-time"],
  ] as const)("maps %s to a string with format %s", (editorType, format) => {
    const { doc, id } = childId("scalar")
    const next = setNodeEditorType(doc, id, editorType)
    const json = getNodeJson(next, id) as JSONSchema7
    expect(json.type).toBe("string")
    expect(json.format).toBe(format)
  })
})
