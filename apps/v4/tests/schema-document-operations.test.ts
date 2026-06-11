import { describe, expect, it } from "vitest"
import type { JSONSchema7 } from "json-schema"

import {
  addDefinition,
  addEnumValue,
  addProperty,
  findNodeByPath,
  fromJsonSchema,
  getChildNodeId,
  getEffectiveDocNode,
  getItemsNodeId,
  getNode,
  moveProperty,
  removeDefinition,
  removeEnumValue,
  removeProperty,
  renameDefinition,
  renameProperty,
  setNodeType,
  setNullable,
  setRef,
  setRequired,
  toJsonSchema,
  updateEnumValue,
  updateNode,
  type SchemaDocument,
} from "@/components/schema-editor/document"

function doc(schema: JSONSchema7): SchemaDocument {
  return fromJsonSchema(schema)
}
function json(d: SchemaDocument) {
  return toJsonSchema(d) as JSONSchema7 & Record<string, unknown>
}
const base: JSONSchema7 = {
  type: "object",
  properties: {
    a: { type: "string" },
    b: { type: "number" },
    c: { type: "object", properties: { x: { type: "string" } } },
  },
  required: ["a"],
}

describe("property operations", () => {
  it("addProperty appends an empty-key string node (dropped on export until named)", () => {
    let d = doc(base)
    d = addProperty(d, d.root.id)
    expect(getNode(d, d.root.id)!.properties).toHaveLength(4)
    // empty key → not emitted yet
    expect(Object.keys(json(d).properties!)).toEqual(["a", "b", "c"])
  })

  it("renameProperty renames and keeps order + required", () => {
    let d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = renameProperty(d, aId, "alpha")
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["alpha", "b", "c"])
    expect(out.required).toEqual(["alpha"])
  })

  it("renameProperty to an empty key drops it on export but keeps it in the doc", () => {
    let d = doc(base)
    const bId = getChildNodeId(d, d.root.id, "b")!
    d = renameProperty(d, bId, "")
    expect(getNode(d, d.root.id)!.properties).toHaveLength(3) // still in doc
    expect(Object.keys(json(d).properties!)).toEqual(["a", "c"]) // b dropped
  })

  it("duplicate key keeps the first on export", () => {
    let d = doc(base)
    const bId = getChildNodeId(d, d.root.id, "b")!
    d = renameProperty(d, bId, "a") // now two 'a'
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["a", "c"])
    expect(out.properties!.a).toEqual({ type: "string" }) // first 'a' wins
  })

  it("removeProperty removes from object and required", () => {
    let d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = removeProperty(d, aId)
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["b", "c"])
    // matches the editor's `.filter()` — an existing `required` key stays as []
    expect(out.required).toEqual([])
  })

  it("setRequired toggles membership", () => {
    let d = doc(base)
    const bId = getChildNodeId(d, d.root.id, "b")!
    d = setRequired(d, bId, true)
    expect(json(d).required).toEqual(["a", "b"])
    d = setRequired(d, bId, false)
    expect(json(d).required).toEqual(["a"])
  })
})

describe("moveProperty", () => {
  it("reorders within the same container", () => {
    let d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = moveProperty(d, aId, d.root.id, 2)
    expect(Object.keys(json(d).properties!)).toEqual(["b", "c", "a"])
  })

  it("reparents into a nested object", () => {
    let d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    const cId = getChildNodeId(d, d.root.id, "c")!
    d = moveProperty(d, aId, cId, 0)
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["b", "c"])
    expect(Object.keys((out.properties!.c as JSONSchema7).properties!)).toEqual(["a", "x"])
  })

  it("refuses to move a node into its own descendant", () => {
    let d = doc(base)
    const cId = getChildNodeId(d, d.root.id, "c")!
    const xId = getChildNodeId(d, cId, "x")!
    // x is a child of c; moving c into x must be a no-op
    const before = json(d)
    d = moveProperty(d, cId, xId, 0)
    expect(json(d)).toEqual(before)
  })

  it("clamps an out-of-range index", () => {
    let d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = moveProperty(d, aId, d.root.id, 99)
    expect(Object.keys(json(d).properties!)).toEqual(["b", "c", "a"])
  })
})

describe("setNodeType", () => {
  it("string → object seeds one blank property", () => {
    let d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = setNodeType(d, aId, "object")
    const node = getNode(d, aId)!
    expect(node.type).toBe("object")
    expect(node.properties).toHaveLength(1)
  })

  it("object → string clears properties", () => {
    let d = doc(base)
    const cId = getChildNodeId(d, d.root.id, "c")!
    d = setNodeType(d, cId, "string")
    expect((json(d).properties!.c as JSONSchema7).type).toBe("string")
    expect((json(d).properties!.c as JSONSchema7).properties).toBeUndefined()
  })

  it("→ array seeds a string item; → enum seeds one value", () => {
    let d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = setNodeType(d, aId, "array")
    expect(getNode(d, aId)!.items?.type).toBe("string")
    d = setNodeType(d, aId, "enum")
    expect(getNode(d, aId)!.enum).toHaveLength(1)
    expect(getNode(d, aId)!.type).toBe("string")
  })
})

describe("setNullable (document canonical: type-union)", () => {
  it("adds and removes null from the type", () => {
    let d = doc({ type: "object", properties: { a: { type: "string" } } })
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = setNullable(d, aId, true)
    expect((json(d).properties!.a as JSONSchema7).type).toEqual(["string", "null"])
    d = setNullable(d, aId, false)
    expect((json(d).properties!.a as JSONSchema7).type).toBe("string")
  })

  it("is idempotent and does not double-add null", () => {
    let d = doc({ type: "object", properties: { a: { type: "string" } } })
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = setNullable(d, aId, true)
    d = setNullable(d, aId, true)
    expect((json(d).properties!.a as JSONSchema7).type).toEqual(["string", "null"])
  })
})

describe("enum operations", () => {
  it("add / update / remove values", () => {
    let d = doc({ type: "object", properties: { c: { type: "string", enum: ["a"] } } })
    const cId = getChildNodeId(d, d.root.id, "c")!
    d = addEnumValue(d, cId)
    const newId = getNode(d, cId)!.enum![1].id
    d = updateEnumValue(d, cId, newId, { value: "b", description: "bee" })
    let out = json(d)
    expect((out.properties!.c as JSONSchema7).enum).toEqual(["a", "b"])
    expect((out.properties!.c as Record<string, unknown>)["x-enumDescriptions"]).toEqual({ b: "bee" })
    d = removeEnumValue(d, cId, newId)
    out = json(d)
    expect((out.properties!.c as JSONSchema7).enum).toEqual(["a"])
  })
})

describe("definition operations", () => {
  const withDefs: JSONSchema7 = {
    type: "object",
    $defs: { Money: { type: "object", properties: { amount: { type: "number" } } } },
    properties: { total: { $ref: "#/$defs/Money" }, sub: { $ref: "#/$defs/Money" } },
  }

  it("renameDefinition makes every $ref follow by id", () => {
    let d = doc(withDefs)
    const id = d.defs.find((x) => x.name === "Money")!.id
    d = renameDefinition(d, id, "Amount")
    const out = json(d)
    expect(Object.keys(out.$defs!)).toEqual(["Amount"])
    expect((out.properties!.total as JSONSchema7).$ref).toBe("#/$defs/Amount")
    expect((out.properties!.sub as JSONSchema7).$ref).toBe("#/$defs/Amount")
  })

  it("addDefinition adds a uniquely-named entry", () => {
    let d = doc(withDefs)
    d = addDefinition(d, { name: "Money" }).doc // collides
    expect(d.defs.map((x) => x.name)).toEqual(["Money", "Money2"])
  })

  it("removeDefinition removes the entry (refs become dangling, not rewritten)", () => {
    let d = doc(withDefs)
    const id = d.defs.find((x) => x.name === "Money")!.id
    d = removeDefinition(d, id)
    const out = json(d)
    expect(out.$defs).toBeUndefined()
    // ref string can no longer be projected → ref dropped, leaving an empty node
    expect((out.properties!.total as JSONSchema7).$ref).toBeUndefined()
  })

  it("setRef points a node at a definition by id and projects the pointer", () => {
    let d = doc(withDefs)
    const subId = getChildNodeId(d, d.root.id, "sub")!
    const moneyId = d.defs.find((x) => x.name === "Money")!.id
    d = setRef(d, subId, moneyId)
    expect((json(d).properties!.sub as JSONSchema7).$ref).toBe("#/$defs/Money")
  })
})

describe("lookups", () => {
  it("findNodeByPath resolves through objects, arrays and refs", () => {
    const d = doc({
      type: "object",
      $defs: { V: { type: "object", properties: { name: { type: "string" } } } },
      properties: {
        vendor: { $ref: "#/$defs/V" },
        rows: { type: "array", items: { type: "object", properties: { sku: { type: "string" } } } },
      },
    })
    expect(findNodeByPath(d, "vendor.name")).toBeTruthy()
    expect(findNodeByPath(d, "rows.sku")).toBeTruthy()
    expect(findNodeByPath(d, "nope")).toBeNull()
  })

  it("getEffectiveDocNode unwraps an anyOf-nullable node", () => {
    const d = doc({
      type: "object",
      properties: {
        v: { anyOf: [{ type: "object", properties: { x: { type: "string" } } }, { type: "null" }] },
      },
    })
    const vId = getChildNodeId(d, d.root.id, "v")!
    const eff = getEffectiveDocNode(getNode(d, vId)!)
    expect(eff.type).toBe("object")
    expect(eff.properties?.[0].key).toBe("x")
  })

  it("getChildNodeId works through an anyOf-nullable object parent", () => {
    const d = doc({
      type: "object",
      properties: {
        v: { anyOf: [{ type: "object", properties: { x: { type: "string" } } }, { type: "null" }] },
      },
    })
    const vId = getChildNodeId(d, d.root.id, "v")!
    expect(getChildNodeId(d, vId, "x")).toBeTruthy()
  })

  it("getItemsNodeId returns the array's item node", () => {
    const d = doc({
      type: "object",
      properties: { rows: { type: "array", items: { type: "object", properties: {} } } },
    })
    const rowsId = getChildNodeId(d, d.root.id, "rows")!
    expect(getItemsNodeId(d, rowsId)).toBeTruthy()
  })
})

describe("updateNode immutability", () => {
  it("returns the same reference when nothing changes", () => {
    const d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!
    const same = updateNode(d, aId, (n) => n)
    expect(same).toBe(d)
  })
})
