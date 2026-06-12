import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import {
  addDefinition,
  removeDefinition,
  renameDefinition,
  setRef,
  setRefByName,
} from "@/components/schema-editor/document/definition-operations"
import {
  addEnumValue,
  removeEnumValue,
  setEnumValues,
  updateEnumValue,
} from "@/components/schema-editor/document/enum-operations"
import { isDefinitionReferenced } from "@/components/schema-editor/document/derive"
import {
  getChildNodeId,
  getChildPropertyId,
  getEffectiveDocNode,
  getItemsNodeId,
} from "@/components/schema-editor/document/node-selectors"
import { stripDescriptions } from "@/components/schema-editor/document/node-metadata"
import { updateNode } from "@/components/schema-editor/document/node-update"
import {
  addProperty,
  moveProperty,
  removeProperty,
  renameProperty,
  setRequired,
} from "@/components/schema-editor/document/property-operations"
import {
  findNodeByPath,
  getNode,
} from "@/components/schema-editor/document/traversal"
import {
  setNodeType,
  setNullable,
} from "@/components/schema-editor/document/type-operations"
import type { SchemaDocument } from "@/components/schema-editor/document/types"

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
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!
    d = renameProperty(d, aPropertyId, "alpha")
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["alpha", "b", "c"])
    expect(out.required).toEqual(["alpha"])
  })

  it("property edge operations are not addressed by child node id", () => {
    const d = doc(base)
    const aNodeId = getChildNodeId(d, d.root.id, "a")!
    expect(renameProperty(d, aNodeId, "alpha")).toBe(d)
  })

  it("renameProperty to an empty key drops it on export but keeps it in the doc", () => {
    let d = doc(base)
    const bPropertyId = getChildPropertyId(d, d.root.id, "b")!
    d = renameProperty(d, bPropertyId, "")
    expect(getNode(d, d.root.id)!.properties).toHaveLength(3) // still in doc
    expect(Object.keys(json(d).properties!)).toEqual(["a", "c"]) // b dropped
  })

  it("duplicate key keeps the first on export", () => {
    let d = doc(base)
    const bPropertyId = getChildPropertyId(d, d.root.id, "b")!
    d = renameProperty(d, bPropertyId, "a") // now two 'a'
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["a", "c"])
    expect(out.properties!.a).toEqual({ type: "string" }) // first 'a' wins
  })

  it("removeProperty removes from object and required", () => {
    let d = doc(base)
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!
    d = removeProperty(d, aPropertyId)
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["b", "c"])
    // matches the editor's `.filter()` — an existing `required` key stays as []
    expect(out.required).toEqual([])
  })

  it("setRequired toggles membership", () => {
    let d = doc(base)
    const bPropertyId = getChildPropertyId(d, d.root.id, "b")!
    d = setRequired(d, bPropertyId, true)
    expect(json(d).required).toEqual(["a", "b"])
    d = setRequired(d, bPropertyId, false)
    expect(json(d).required).toEqual(["a"])
  })
})

describe("moveProperty", () => {
  it("reorders within the same container", () => {
    let d = doc(base)
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!
    d = moveProperty(d, aPropertyId, d.root.id, 2)
    expect(Object.keys(json(d).properties!)).toEqual(["b", "c", "a"])
  })

  it("reparents into a nested object", () => {
    let d = doc(base)
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!
    const cId = getChildNodeId(d, d.root.id, "c")!
    d = moveProperty(d, aPropertyId, cId, 0)
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["b", "c"])
    expect(Object.keys((out.properties!.c as JSONSchema7).properties!)).toEqual(
      ["a", "x"]
    )
  })

  it("refuses to move a node into its own descendant", () => {
    let d = doc(base)
    const cPropertyId = getChildPropertyId(d, d.root.id, "c")!
    const cId = getChildNodeId(d, d.root.id, "c")!
    const xId = getChildNodeId(d, cId, "x")!
    // x is a child of c; moving c into x must be a no-op
    const before = json(d)
    d = moveProperty(d, cPropertyId, xId, 0)
    expect(json(d)).toEqual(before)
  })

  it("clamps an out-of-range index", () => {
    let d = doc(base)
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!
    d = moveProperty(d, aPropertyId, d.root.id, 99)
    expect(Object.keys(json(d).properties!)).toEqual(["b", "c", "a"])
  })

  it("refuses to move a property into an unknown parent", () => {
    const d = doc(base)
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!
    const before = json(d)

    const out = moveProperty(d, aPropertyId, "missing-node-id", 0)

    expect(out).toBe(d)
    expect(json(out)).toEqual(before)
  })

  it("refuses to move a property into a scalar node", () => {
    const d = doc(base)
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!
    const bId = getChildNodeId(d, d.root.id, "b")!
    const before = json(d)

    const out = moveProperty(d, aPropertyId, bId, 0)

    expect(out).toBe(d)
    expect(json(out)).toEqual(before)
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
    expect((json(d).properties!.a as JSONSchema7).type).toEqual([
      "string",
      "null",
    ])
    d = setNullable(d, aId, false)
    expect((json(d).properties!.a as JSONSchema7).type).toBe("string")
  })

  it("is idempotent and does not double-add null", () => {
    let d = doc({ type: "object", properties: { a: { type: "string" } } })
    const aId = getChildNodeId(d, d.root.id, "a")!
    d = setNullable(d, aId, true)
    d = setNullable(d, aId, true)
    expect((json(d).properties!.a as JSONSchema7).type).toEqual([
      "string",
      "null",
    ])
  })
})

describe("enum operations", () => {
  it("add / update / remove values", () => {
    let d = doc({
      type: "object",
      properties: { c: { type: "string", enum: ["a"] } },
    })
    const cId = getChildNodeId(d, d.root.id, "c")!
    d = addEnumValue(d, cId)
    const newId = getNode(d, cId)!.enum![1].id
    d = updateEnumValue(d, cId, newId, { value: "b", description: "bee" })
    let out = json(d)
    expect((out.properties!.c as JSONSchema7).enum).toEqual(["a", "b"])
    expect(
      (out.properties!.c as Record<string, unknown>)["x-enumDescriptions"]
    ).toEqual({ b: "bee" })
    d = removeEnumValue(d, cId, newId)
    out = json(d)
    expect((out.properties!.c as JSONSchema7).enum).toEqual(["a"])
  })

  it("setEnumValues keeps type-array nullable fields nullable", () => {
    let d = doc({
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          description: "optional status",
          default: null,
        },
      },
    })
    const statusId = getChildNodeId(d, d.root.id, "status")!

    d = setEnumValues(d, statusId, ["draft", "paid"])

    expect(json(d).properties!.status).toEqual({
      description: "optional status",
      anyOf: [
        { type: "string", enum: ["draft", "paid"] },
        { type: "null" },
      ],
      default: null,
    })
  })
})

describe("description operations", () => {
  it("stripDescriptions removes enum value descriptions", () => {
    const d = doc({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "paid"],
          "x-enumDescriptions": {
            draft: "Draft status",
            paid: "Paid status",
          },
        } as JSONSchema7,
      },
    })

    const out = json(stripDescriptions(d))

    expect((out.properties!.status as JSONSchema7).enum).toEqual([
      "draft",
      "paid",
    ])
    expect(
      (out.properties!.status as Record<string, unknown>)["x-enumDescriptions"]
    ).toBeUndefined()
  })

  it("stripDescriptions removes descriptions from schema-bearing rest keywords", () => {
    const d = doc({
      type: "object",
      additionalProperties: {
        type: "object",
        description: "extra object",
        properties: {
          code: { type: "string", description: "extra code" },
        },
      },
      properties: {
        pair: {
          type: "array",
          items: [
            { type: "string", description: "first item" },
            { type: "number", description: "second item" },
          ],
        } as JSONSchema7,
      },
    } as JSONSchema7)

    const out = json(stripDescriptions(d)) as Record<string, unknown>
    const additionalProperties = out.additionalProperties as JSONSchema7
    const pair = (out.properties as Record<string, JSONSchema7>)
      .pair as JSONSchema7
    const items = pair.items as JSONSchema7[]

    expect(additionalProperties.description).toBeUndefined()
    expect(
      (additionalProperties.properties!.code as JSONSchema7).description
    ).toBeUndefined()
    expect(items[0].description).toBeUndefined()
    expect(items[1].description).toBeUndefined()
  })

  it("stripDescriptions leaves custom extension metadata untouched", () => {
    const schema = {
      type: "object",
      "x-retab": {
        description: "custom metadata description",
      },
      properties: {
        a: { type: "string", description: "field description" },
      },
    } as unknown as JSONSchema7

    const out = json(stripDescriptions(doc(schema))) as Record<string, unknown>

    expect((out["x-retab"] as Record<string, unknown>).description).toBe(
      "custom metadata description"
    )
    expect(
      ((out.properties as Record<string, JSONSchema7>).a as JSONSchema7)
        .description
    ).toBeUndefined()
  })
})

describe("definition operations", () => {
  const withDefs: JSONSchema7 = {
    type: "object",
    $defs: {
      Money: { type: "object", properties: { amount: { type: "number" } } },
    },
    properties: {
      total: { $ref: "#/$defs/Money" },
      sub: { $ref: "#/$defs/Money" },
    },
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

  it("setRef preserves field title, description, and unmodeled keywords", () => {
    let d = doc({
      ...withDefs,
      properties: {
        local: {
          type: "string",
          title: "Local title",
          description: "Local description",
          default: "value",
        },
      },
    })
    const localId = getChildNodeId(d, d.root.id, "local")!
    const moneyId = d.defs.find((x) => x.name === "Money")!.id

    d = setRef(d, localId, moneyId)

    expect(json(d).properties!.local).toEqual({
      $ref: "#/$defs/Money",
      title: "Local title",
      description: "Local description",
      default: "value",
    })
  })

  it("setRefByName updates the non-null branch of an anyOf nullable field", () => {
    let d = doc({
      type: "object",
      $defs: {
        Money: {
          type: "object",
          properties: { amount: { type: "number" } },
        },
      },
      properties: {
        maybe_money: {
          description: "nullable money",
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
    })
    const maybeMoneyId = getChildNodeId(d, d.root.id, "maybe_money")!

    d = setRefByName(d, maybeMoneyId, "Money")

    expect(json(d).properties!.maybe_money).toEqual({
      description: "nullable money",
      anyOf: [{ $ref: "#/$defs/Money" }, { type: "null" }],
    })
  })

  it("setRefByName keeps type-array nullable fields nullable", () => {
    let d = doc({
      type: "object",
      $defs: {
        Money: {
          type: "object",
          properties: { amount: { type: "number" } },
        },
      },
      properties: {
        maybe_money: {
          type: ["string", "null"],
          description: "nullable money",
          default: null,
        },
      },
    })
    const maybeMoneyId = getChildNodeId(d, d.root.id, "maybe_money")!

    d = setRefByName(d, maybeMoneyId, "Money")

    expect(json(d).properties!.maybe_money).toEqual({
      description: "nullable money",
      anyOf: [{ $ref: "#/$defs/Money" }, { type: "null" }],
      default: null,
    })
  })
})

describe("lookups", () => {
  it("findNodeByPath resolves through objects, arrays and refs", () => {
    const d = doc({
      type: "object",
      $defs: {
        V: { type: "object", properties: { name: { type: "string" } } },
      },
      properties: {
        vendor: { $ref: "#/$defs/V" },
        rows: {
          type: "array",
          items: { type: "object", properties: { sku: { type: "string" } } },
        },
      },
    })
    expect(findNodeByPath(d, "vendor.name")).toBeTruthy()
    expect(findNodeByPath(d, "rows.sku")).toBeTruthy()
    expect(findNodeByPath(d, "nope")).toBeNull()
  })

  it("findNodeByPath resolves through nullable object containers", () => {
    const d = doc({
      type: "object",
      properties: {
        vendor: {
          anyOf: [
            {
              type: "object",
              properties: { name: { type: "string" } },
            },
            { type: "null" },
          ],
        },
      },
    })

    expect(findNodeByPath(d, "vendor.name")).toBeTruthy()
  })

  it("findNodeByPath resolves through nullable arrays of objects", () => {
    const d = doc({
      type: "object",
      properties: {
        rows: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "object",
                properties: { sku: { type: "string" } },
              },
            },
            { type: "null" },
          ],
        },
      },
    })

    expect(findNodeByPath(d, "rows.sku")).toBeTruthy()
  })

  it("getEffectiveDocNode unwraps an anyOf-nullable node", () => {
    const d = doc({
      type: "object",
      properties: {
        v: {
          anyOf: [
            { type: "object", properties: { x: { type: "string" } } },
            { type: "null" },
          ],
        },
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
        v: {
          anyOf: [
            { type: "object", properties: { x: { type: "string" } } },
            { type: "null" },
          ],
        },
      },
    })
    const vId = getChildNodeId(d, d.root.id, "v")!
    expect(getChildNodeId(d, vId, "x")).toBeTruthy()
  })

  it("getItemsNodeId returns the array's item node", () => {
    const d = doc({
      type: "object",
      properties: {
        rows: { type: "array", items: { type: "object", properties: {} } },
      },
    })
    const rowsId = getChildNodeId(d, d.root.id, "rows")!
    expect(getItemsNodeId(d, rowsId)).toBeTruthy()
  })
})

describe("definition reference detection", () => {
  it("finds refs inside schema-bearing rest keywords", () => {
    const d = doc({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      additionalProperties: { $ref: "#/$defs/Money" },
      properties: {
        tuple: {
          type: "array",
          items: [{ $ref: "#/$defs/Money" }],
        } as JSONSchema7,
      },
    } as JSONSchema7)
    const moneyId = d.defs.find((definition) => definition.name === "Money")!.id

    expect(isDefinitionReferenced(d, moneyId)).toBe(true)
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
