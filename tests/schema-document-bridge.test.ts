import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import {
  getNodeJson,
  replaceNodeJson,
  updateNodeJson,
} from "@/components/schema-editor/document/json-node"
import {
  getChildNodeId,
  getItemsNodeId,
} from "@/components/schema-editor/document/node-selectors"
import { getNode } from "@/components/schema-editor/document/traversal"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import {
  setNullable,
  updateEffectiveNode,
  updateSchemaProperty,
  updateType,
} from "@/components/schema-editor/draft/draft-node-edits"

function json(d: SchemaDocument) {
  return toJsonSchema(d) as JSONSchema7 & Record<string, unknown>
}

describe("JSON bridge: getNodeJson / replaceNodeJson", () => {
  it("getNodeJson projects a $ref node to its pointer", () => {
    const d = fromJsonSchema({
      type: "object",
      $defs: { M: { type: "object", properties: { a: { type: "number" } } } },
      properties: { total: { $ref: "#/$defs/M" } },
    })
    const id = getChildNodeId(d, d.root.id, "total")!
    expect(getNodeJson(d, id)).toEqual({ $ref: "#/$defs/M" })
  })

  it("replaceNodeJson preserves the node id", () => {
    const d = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const id = getChildNodeId(d, d.root.id, "a")!
    const d2 = replaceNodeJson(d, id, { type: "number" })
    expect(getNode(d2, id)).toBeTruthy()
    expect(getNode(d2, id)!.type).toBe("number")
  })

  it("replaceNodeJson on a child leaves siblings byte-identical", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        a: { type: "string", pattern: "^a", format: "email" } as JSONSchema7,
        b: { type: "number" },
      },
    }
    const d = fromJsonSchema(schema)
    const bId = getChildNodeId(d, d.root.id, "b")!
    const out = json(replaceNodeJson(d, bId, { type: "integer" }))
    expect(out.properties!.a).toEqual(schema.properties!.a)
    expect(out.properties!.b).toEqual({ type: "integer" })
  })

  it("replaceNodeJson preserves unmodeled prototype-key keywords", () => {
    const d = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const aId = getChildNodeId(d, d.root.id, "a")!
    const replacement = JSON.parse(
      '{"type":"string","__proto__":{"safe":true},"constructor":{"safe":true},"toString":{"safe":true}}'
    ) as JSONSchema7

    const out = json(replaceNodeJson(d, aId, replacement))

    expect(out.properties!.a).toEqual(replacement)
  })

  it("a root edit (whose JSON carries $defs) does not duplicate $defs", () => {
    const d = fromJsonSchema({
      type: "object",
      $defs: { M: { type: "object", properties: { a: { type: "number" } } } },
      properties: { x: { type: "string" } },
    })
    const rootJson = json(d) // includes $defs, like the editor's root node prop
    const next = updateEffectiveNode(rootJson, {
      ...rootJson,
      properties: { ...rootJson.properties, y: { type: "string" } },
    })
    const out = json(replaceNodeJson(d, d.root.id, next))
    expect(JSON.stringify(out).match(/"\$defs"/g)).toHaveLength(1)
    expect(out.$defs).toEqual({
      M: { type: "object", properties: { a: { type: "number" } } },
    })
    expect(Object.keys(out.properties!)).toEqual(["x", "y"])
  })

  it("root edit keeps $defs in its original position", () => {
    const schema: JSONSchema7 = {
      type: "object",
      title: "T",
      $defs: { M: { type: "string" } },
      properties: { x: { type: "string" } },
    }
    const d = fromJsonSchema(schema)
    const rootJson = json(d)
    const next = updateEffectiveNode(rootJson, {
      ...rootJson,
      properties: { ...rootJson.properties, y: { type: "number" } },
    })
    const out = json(replaceNodeJson(d, d.root.id, next))
    expect(Object.keys(out)).toEqual(["type", "title", "$defs", "properties"])
  })
})

describe("editor-path simulation (their leaf utils through the Document)", () => {
  it("changes a nested field type, siblings intact", () => {
    const d = fromJsonSchema({
      type: "object",
      properties: {
        v: {
          type: "object",
          properties: { name: { type: "string" }, age: { type: "number" } },
        },
      },
    })
    const vId = getChildNodeId(d, d.root.id, "v")!
    const nameId = getChildNodeId(d, vId, "name")!
    const next = updateType(
      "integer",
      false,
      getNodeJson(d, nameId) as JSONSchema7
    )
    const out = json(replaceNodeJson(d, nameId, next))
    const v = out.properties!.v as JSONSchema7
    expect((v.properties!.name as JSONSchema7).type).toBe("integer")
    expect((v.properties!.age as JSONSchema7).type).toBe("number")
  })

  it("edits a child INSIDE an anyOf-nullable object parent", () => {
    // v is nullable object via anyOf; we edit its child `x`.
    const d = fromJsonSchema({
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
    const xId = getChildNodeId(d, vId, "x")!
    expect(xId).toBeTruthy()
    const next = updateEffectiveNode(getNodeJson(d, xId) as JSONSchema7, {
      type: "string",
      description: "the x",
    })
    const out = json(replaceNodeJson(d, xId, next))
    // the parent stays nullable; the child got its description
    expect(out.properties!.v).toEqual({
      anyOf: [
        {
          type: "object",
          properties: { x: { type: "string", description: "the x" } },
        },
        { type: "null" },
      ],
    })
  })

  it("makes a field nullable via their setNullable util (anyOf), routed by id", () => {
    const d = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const aId = getChildNodeId(d, d.root.id, "a")!
    const next = setNullable(getNodeJson(d, aId) as JSONSchema7, true)
    const out = json(replaceNodeJson(d, aId, next))
    expect(out.properties!.a).toEqual({
      anyOf: [{ type: "string" }, { type: "null" }],
    })
  })

  it("renames a property (parent-level op routed by parent id)", () => {
    const d = fromJsonSchema({
      type: "object",
      properties: { old: { type: "string" }, keep: { type: "number" } },
      required: ["old"],
    })
    const rootJson = getNodeJson(d, d.root.id) as JSONSchema7
    const renamed = updateEffectiveNode(
      rootJson,
      updateSchemaProperty(
        rootJson,
        "old",
        "renamed",
        rootJson.properties!.old as JSONSchema7
      )
    )
    const out = json(replaceNodeJson(d, d.root.id, renamed))
    expect(Object.keys(out.properties!)).toEqual(["renamed", "keep"])
    expect(out.required).toEqual(["renamed"])
  })

  it("array item-object edits route by the items node id", () => {
    const d = fromJsonSchema({
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: { type: "object", properties: { sku: { type: "string" } } },
        },
      },
    })
    const rowsId = getChildNodeId(d, d.root.id, "rows")!
    const itemsId = getItemsNodeId(d, rowsId)!
    const itemsJson = getNodeJson(d, itemsId) as JSONSchema7
    const next = updateEffectiveNode(itemsJson, {
      ...itemsJson,
      properties: { ...itemsJson.properties, qty: { type: "integer" } },
    })
    const out = json(replaceNodeJson(d, itemsId, next))
    const items = (out.properties!.rows as JSONSchema7).items as JSONSchema7
    expect(Object.keys(items.properties!)).toEqual(["sku", "qty"])
  })

  it("edits a nested property inside a $def (routed by id in doc.defs)", () => {
    const d = fromJsonSchema({
      type: "object",
      $defs: {
        M: { type: "object", properties: { amount: { type: "number" } } },
      },
      properties: { total: { $ref: "#/$defs/M" } },
    })
    const defNode = d.defs.find((x) => x.name === "M")!.node
    const amountId = getChildNodeId(d, defNode.id, "amount")!
    const next = updateType(
      "integer",
      false,
      getNodeJson(d, amountId) as JSONSchema7
    )
    const out = json(replaceNodeJson(d, amountId, next))
    expect((out.$defs!.M as JSONSchema7).properties!.amount).toEqual({
      type: "integer",
    })
    expect((out.properties!.total as JSONSchema7).$ref).toBe("#/$defs/M")
  })

  it("updateNodeJson composes read+transform+write", () => {
    const d = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const aId = getChildNodeId(d, d.root.id, "a")!
    const d2 = updateNodeJson(
      d,
      aId,
      (j) => ({ ...(j as object), description: "hi" }) as JSONSchema7
    )
    expect((json(d2).properties!.a as JSONSchema7).description).toBe("hi")
  })
})

describe("id stability across edits", () => {
  it("editing one field does not change a sibling's id", () => {
    const d = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
    })
    const aId = getChildNodeId(d, d.root.id, "a")!
    const bId = getChildNodeId(d, d.root.id, "b")!
    const d2 = replaceNodeJson(d, aId, { type: "number" })
    expect(getChildNodeId(d2, d2.root.id, "b")).toBe(bId)
    expect(getChildNodeId(d2, d2.root.id, "a")).toBe(aId)
  })
})
