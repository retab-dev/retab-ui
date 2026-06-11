import { describe, expect, it } from "vitest"
import type { JSONSchema7 } from "json-schema"

import {
  fromJsonSchema,
  getChildNodeId,
  getNode,
  moveProperty,
  renameDefinition,
  setNodeType,
  toJsonSchema,
  type SchemaDocument,
} from "@/components/schema-editor/document"

function rt(schema: JSONSchema7) {
  return toJsonSchema(fromJsonSchema(schema))
}
function json(d: SchemaDocument) {
  return toJsonSchema(d) as JSONSchema7 & Record<string, unknown>
}

describe("adversarial round-trip", () => {
  it("$schema and $id at the root are preserved", () => {
    const schema: JSONSchema7 = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "https://example.com/s.json",
      type: "object",
      properties: { a: { type: "string" } },
    }
    expect(rt(schema)).toEqual(schema)
  })

  it("a $ref node with sibling description/title round-trips", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: { M: { type: "string" } },
      properties: { x: { $ref: "#/$defs/M", description: "money", title: "Money" } as JSONSchema7 },
    }
    expect(rt(schema)).toEqual(schema)
  })

  it("enum with mixed scalar values (string/number/boolean/null)", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { e: { enum: ["a", 1, true, null] } as JSONSchema7 },
    }
    expect(rt(schema)).toEqual(schema)
  })

  it("a property literally named __order does not corrupt the schema", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { __order: { type: "string" }, real: { type: "number" } },
    }
    const out = rt(schema)
    expect(Object.keys(out.properties!)).toEqual(["__order", "real"])
    expect((out.properties!.__order as JSONSchema7).type).toBe("string")
  })

  it("a node carrying an `__order` keyword value does not collide with the order marker", () => {
    // Extremely unlikely, but the internal marker must not eat real data.
    const schema = {
      type: "object",
      properties: { a: { type: "string" } },
      __order: "real-value",
    } as unknown as JSONSchema7
    const out = rt(schema) as Record<string, unknown>
    expect(out.__order).toBe("real-value")
  })

  it("empty enum array is preserved", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { e: { type: "string", enum: [] } },
    }
    expect(rt(schema)).toEqual(schema)
  })

  it("array of arrays round-trips", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { matrix: { type: "array", items: { type: "array", items: { type: "number" } } } },
    }
    expect(rt(schema)).toEqual(schema)
  })
})

describe("type changes preserve nullability + metadata", () => {
  it("setNodeType keeps a type-array nullable field nullable", () => {
    let d = fromJsonSchema({ type: "object", properties: { a: { type: ["string", "null"] } } })
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = setNodeType(d, aId, "number")
    expect((json(d).properties!.a as JSONSchema7).type).toEqual(["number", "null"])
  })

  it("setNodeType preserves title and description", () => {
    let d = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string", title: "A", description: "desc" } as JSONSchema7 },
    })
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = setNodeType(d, aId, "object")
    const a = json(d).properties!.a as JSONSchema7
    expect(a.title).toBe("A")
    expect(a.description).toBe("desc")
  })
})

describe("moveProperty edge cases", () => {
  it("moving to the same index is a no-op", () => {
    const base: JSONSchema7 = {
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
    }
    const d = fromJsonSchema(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    const before = json(d)
    const d2 = moveProperty(d, aId, d.root.id, 0)
    expect(json(d2)).toEqual(before)
  })
})

describe("definition rename collisions", () => {
  it("renaming a def onto an existing def name does not silently merge both into one", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: {
        A: { type: "object", properties: { x: { type: "string" } } },
        B: { type: "object", properties: { y: { type: "number" } } },
      },
      properties: { a: { $ref: "#/$defs/A" }, b: { $ref: "#/$defs/B" } },
    }
    const d = fromJsonSchema(schema)
    const aId = d.defs.find((x) => x.name === "A")!.id
    const out = json(renameDefinition(d, aId, "B")) // collide A -> B
    // Whatever the policy, we must not lose a definition's content.
    const defs = out.$defs as Record<string, JSONSchema7>
    const names = Object.keys(defs)
    // both original shapes must still be represented somewhere
    const shapes = Object.values(defs).map((s) => JSON.stringify(s.properties))
    expect(shapes).toContain(JSON.stringify({ x: { type: "string" } }))
    expect(shapes).toContain(JSON.stringify({ y: { type: "number" } }))
    expect(names.length).toBe(2)
  })
})

describe("ref integrity through node identity", () => {
  it("getNode finds nodes nested inside definitions", () => {
    const d = fromJsonSchema({
      type: "object",
      $defs: { M: { type: "object", properties: { amount: { type: "number" } } } },
      properties: { total: { $ref: "#/$defs/M" } },
    })
    const defNode = d.defs.find((x) => x.name === "M")!.node
    const amountId = getChildNodeId(d, defNode.id, "amount")!
    expect(getNode(d, amountId)).toBeTruthy()
    expect(getNode(d, amountId)!.type).toBe("number")
  })
})
