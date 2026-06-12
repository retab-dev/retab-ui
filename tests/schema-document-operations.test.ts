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
  getOwnProperty,
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
  setNodeEditorType,
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

  it("addProperty refuses non-object parent nodes", () => {
    const d = doc(base)
    const aId = getChildNodeId(d, d.root.id, "a")!

    const out = addProperty(d, aId, { key: "child" })

    expect(out).toBe(d)
    expect(json(out)).toEqual(json(d))
  })

  it("renameProperty renames and keeps order + required", () => {
    let d = doc(base)
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!
    d = renameProperty(d, aPropertyId, "alpha")
    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["alpha", "b", "c"])
    expect(out.required).toEqual(["alpha"])
  })

  it("renameProperty preserves external required names in source order", () => {
    let d = doc({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
      required: ["external", "a"],
    })
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!

    d = renameProperty(d, aPropertyId, "alpha")

    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["alpha", "b"])
    expect(out.required).toEqual(["external", "alpha"])
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

  it("preserves imported empty-string property names during projection", () => {
    const d = doc({
      type: "object",
      properties: { "": { type: "string" }, named: { type: "number" } },
      required: ["", "named"],
    })

    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["", "named"])
    expect(out.required).toEqual(["", "named"])
  })

  it("addProperty can intentionally add a real empty-string property", () => {
    let d = doc({ type: "object", properties: {} })

    d = addProperty(d, d.root.id, {
      key: "",
      isTransient: false,
      required: true,
    })

    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual([""])
    expect(out.required).toEqual([""])
  })

  it("keeps an imported empty-string property before a later transient blank row", () => {
    let d = doc({
      type: "object",
      properties: { "": { type: "string" } },
      required: [""],
    })

    d = addProperty(d, d.root.id)

    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual([""])
    expect(out.required).toEqual([""])
  })

  it("preserves non-empty whitespace property names during projection", () => {
    let d = doc(base)
    const bPropertyId = getChildPropertyId(d, d.root.id, "b")!

    d = renameProperty(d, bPropertyId, " b ")
    d = setRequired(d, bPropertyId, true)

    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["a", " b ", "c"])
    expect(out.required).toEqual(["a", " b "])
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

  it("removeProperty preserves required names that are not modeled properties", () => {
    let d = doc({
      type: "object",
      properties: { a: { type: "string" } },
      required: ["external", "a"],
    })
    const aPropertyId = getChildPropertyId(d, d.root.id, "a")!

    d = removeProperty(d, aPropertyId)

    const out = json(d)
    expect(out.properties).toEqual({})
    expect(out.required).toEqual(["external"])
  })

  it("setRequired toggles membership", () => {
    let d = doc(base)
    const bPropertyId = getChildPropertyId(d, d.root.id, "b")!
    d = setRequired(d, bPropertyId, true)
    expect(json(d).required).toEqual(["a", "b"])
    d = setRequired(d, bPropertyId, false)
    expect(json(d).required).toEqual(["a"])
  })

  it("adds properties through imported anyOf nullable object containers", () => {
    let d = doc({
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
    const vendorId = getChildNodeId(d, d.root.id, "vendor")!

    d = addProperty(d, vendorId, { key: "code" })

    expect(json(d).properties!.vendor).toEqual({
      anyOf: [
        {
          type: "object",
          properties: {
            name: { type: "string" },
            code: { type: "string" },
          },
        },
        { type: "null" },
      ],
    })
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

  it("moves properties into imported anyOf nullable object containers", () => {
    let d = doc({
      type: "object",
      properties: {
        sku: { type: "string" },
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
      required: ["sku"],
    })
    const skuPropertyId = getChildPropertyId(d, d.root.id, "sku")!
    const vendorId = getChildNodeId(d, d.root.id, "vendor")!

    d = moveProperty(d, skuPropertyId, vendorId, 0)

    const out = json(d)
    expect(Object.keys(out.properties!)).toEqual(["vendor"])
    expect(out.required).toEqual([])
    expect(out.properties!.vendor).toEqual({
      anyOf: [
        {
          type: "object",
          properties: {
            sku: { type: "string" },
            name: { type: "string" },
          },
          required: ["sku"],
        },
        { type: "null" },
      ],
    })
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

  it("retyping a boolean schema replaces the boolean literal", () => {
    let d = doc({
      type: "object",
      properties: {
        anything: true,
      },
    } as JSONSchema7)
    const anythingId = getChildNodeId(d, d.root.id, "anything")!

    d = setNodeType(d, anythingId, "string")

    expect(json(d).properties!.anything).toEqual({ type: "string" })
  })

  it("keeps imported anyOf nullable fields nullable when retyping", () => {
    let d = doc({
      type: "object",
      properties: {
        count: {
          description: "optional count",
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
    })
    const countId = getChildNodeId(d, d.root.id, "count")!

    d = setNodeType(d, countId, "integer")

    expect(json(d).properties!.count).toEqual({
      type: ["integer", "null"],
      description: "optional count",
    })
  })

  it("setNodeEditorType removes stale date formats when changing away from date-like strings", () => {
    let d = doc({
      type: "object",
      properties: {
        issued_at: {
          type: "string",
          format: "date-time",
          description: "when it happened",
        },
      },
    })
    const issuedAtId = getChildNodeId(d, d.root.id, "issued_at")!

    d = setNodeEditorType(d, issuedAtId, "number")

    expect(json(d).properties!.issued_at).toEqual({
      type: "number",
      description: "when it happened",
    })
  })

  it("drops string-only constraints when changing a string field to a number", () => {
    let d = doc({
      type: "object",
      properties: {
        code: {
          type: "string",
          minLength: 2,
          maxLength: 8,
          pattern: "^A",
          default: "A1",
          "x-retab": { source: "user" },
        } as JSONSchema7,
      },
    })
    const codeId = getChildNodeId(d, d.root.id, "code")!

    d = setNodeType(d, codeId, "number")

    expect(json(d).properties!.code).toEqual({
      type: "number",
      default: "A1",
      "x-retab": { source: "user" },
    })
  })

  it("drops number-only constraints when changing a number field to a string", () => {
    let d = doc({
      type: "object",
      properties: {
        amount: {
          type: "number",
          minimum: 0,
          maximum: 100,
          exclusiveMaximum: 101,
          multipleOf: 0.01,
          description: "amount",
        } as JSONSchema7,
      },
    })
    const amountId = getChildNodeId(d, d.root.id, "amount")!

    d = setNodeType(d, amountId, "string")

    expect(json(d).properties!.amount).toEqual({
      type: "string",
      description: "amount",
    })
  })

  it("drops object required metadata when changing an object field to a scalar", () => {
    let d = doc({
      type: "object",
      properties: {
        payload: {
          type: "object",
          properties: { a: { type: "string" } },
          required: ["external", "a"],
        },
      },
    })
    const payloadId = getChildNodeId(d, d.root.id, "payload")!

    d = setNodeType(d, payloadId, "string")

    expect(json(d).properties!.payload).toEqual({ type: "string" })
  })

  it("drops tuple items when changing a tuple array field to a scalar", () => {
    let d = doc({
      type: "object",
      properties: {
        pair: {
          type: "array",
          items: [{ type: "string" }, { type: "number" }],
        } as JSONSchema7,
      },
    })
    const pairId = getChildNodeId(d, d.root.id, "pair")!

    d = setNodeType(d, pairId, "string")

    expect(json(d).properties!.pair).toEqual({ type: "string" })
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

  it("removes null from imported anyOf nullable fields without losing wrapper metadata", () => {
    let d = doc({
      type: "object",
      properties: {
        a: {
          description: "optional text",
          anyOf: [{ type: "string", minLength: 2 }, { type: "null" }],
          default: null,
        },
      },
    } as JSONSchema7)
    const aId = getChildNodeId(d, d.root.id, "a")!

    d = setNullable(d, aId, false)

    expect(json(d).properties!.a).toEqual({
      type: "string",
      description: "optional text",
      minLength: 2,
      default: null,
    })
  })

  it("wraps refs in anyOf when making them nullable", () => {
    let d = doc({
      type: "object",
      $defs: {
        Money: {
          type: "object",
          properties: { amount: { type: "number" } },
        },
      },
      properties: {
        total: {
          $ref: "#/$defs/Money",
          description: "optional total",
        },
      },
    })
    const totalId = getChildNodeId(d, d.root.id, "total")!

    d = setNullable(d, totalId, true)

    expect(json(d).properties!.total).toEqual({
      description: "optional total",
      anyOf: [{ $ref: "#/$defs/Money" }, { type: "null" }],
    })
  })

  it("wraps enums in anyOf when making them nullable so null is actually allowed", () => {
    let d = doc({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "paid"],
          description: "optional status",
        },
      },
    })
    const statusId = getChildNodeId(d, d.root.id, "status")!

    d = setNullable(d, statusId, true)

    expect(json(d).properties!.status).toEqual({
      description: "optional status",
      anyOf: [
        { type: "string", enum: ["draft", "paid"] },
        { type: "null" },
      ],
    })
  })

  it("normalizes type-array nullable enums into a non-null enum branch", () => {
    let d = doc({
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["draft", "paid"],
          description: "optional status",
        },
      },
    })
    const statusId = getChildNodeId(d, d.root.id, "status")!

    d = setNullable(d, statusId, true)

    expect(json(d).properties!.status).toEqual({
      description: "optional status",
      anyOf: [
        { type: "string", enum: ["draft", "paid"] },
        { type: "null" },
      ],
    })
  })

  it("keeps nullable enum wrapping idempotent", () => {
    let d = doc({
      type: "object",
      properties: {
        status: {
          description: "optional status",
          anyOf: [
            { type: "string", enum: ["draft", "paid"] },
            { type: "null" },
          ],
        },
      },
    })
    const statusId = getChildNodeId(d, d.root.id, "status")!
    const before = json(d)

    d = setNullable(d, statusId, true)

    expect(json(d)).toEqual(before)
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
    d = updateEnumValue(d, cId, newId, { value: "b" })
    let out = json(d)
    expect((out.properties!.c as JSONSchema7).enum).toEqual(["a", "b"])
    d = removeEnumValue(d, cId, newId)
    out = json(d)
    expect((out.properties!.c as JSONSchema7).enum).toEqual(["a"])
  })

  it("addEnumValue normalizes type-array nullable enums", () => {
    let d = doc({
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["draft"],
          description: "optional status",
        },
      },
    })
    const statusId = getChildNodeId(d, d.root.id, "status")!

    d = addEnumValue(d, statusId, "paid")

    expect(json(d).properties!.status).toEqual({
      description: "optional status",
      anyOf: [
        { type: "string", enum: ["draft", "paid"] },
        { type: "null" },
      ],
    })
  })

  it("updateEnumValue remaps x-enumDescriptions by row", () => {
    let d = doc({
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
    const statusId = getChildNodeId(d, d.root.id, "status")!
    const paidId = getNode(d, statusId)!.enum![1].id

    d = updateEnumValue(d, statusId, paidId, { value: "complete" })

    expect(json(d).properties!.status).toEqual({
      type: "string",
      enum: ["draft", "complete"],
      "x-enumDescriptions": {
        draft: "Draft status",
        complete: "Paid status",
      },
    })
  })

  it("removeEnumValue drops the matching x-enumDescriptions entry", () => {
    let d = doc({
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
    const statusId = getChildNodeId(d, d.root.id, "status")!
    const draftId = getNode(d, statusId)!.enum![0].id

    d = removeEnumValue(d, statusId, draftId)

    expect(json(d).properties!.status).toEqual({
      type: "string",
      enum: ["paid"],
      "x-enumDescriptions": { paid: "Paid status" },
    })
  })

  it("setEnumValues remaps x-enumDescriptions by row", () => {
    let d = doc({
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
    const statusId = getChildNodeId(d, d.root.id, "status")!

    d = setEnumValues(d, statusId, ["new", "complete"])

    expect(json(d).properties!.status).toEqual({
      type: "string",
      enum: ["new", "complete"],
      "x-enumDescriptions": {
        new: "Draft status",
        complete: "Paid status",
      },
    })
  })

  it("setNodeType drops x-enumDescriptions when converting away from enum", () => {
    let d = doc({
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft"],
          "x-enumDescriptions": { draft: "Draft status" },
        } as JSONSchema7,
      },
    })
    const statusId = getChildNodeId(d, d.root.id, "status")!

    d = setNodeType(d, statusId, "number")

    expect(json(d).properties!.status).toEqual({ type: "number" })
  })

  it("setRef drops x-enumDescriptions when converting an enum to a ref", () => {
    let d = doc({
      type: "object",
      $defs: { Status: { type: "string" } },
      properties: {
        status: {
          type: "string",
          enum: ["draft"],
          "x-enumDescriptions": { draft: "Draft status" },
        } as JSONSchema7,
      },
    })
    const statusId = getChildNodeId(d, d.root.id, "status")!

    d = setRef(d, statusId, d.defs[0].id)

    expect(json(d).properties!.status).toEqual({ $ref: "#/$defs/Status" })
  })

  it("setEnumValues on an existing type-array nullable enum does not leave enum on the wrapper", () => {
    let d = doc({
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["draft"],
          description: "optional status",
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
    })
  })

  it("update and remove enum values normalize type-array nullable enums", () => {
    let d = doc({
      type: "object",
      properties: {
        status: {
          type: ["string", "null"],
          enum: ["draft", "paid"],
          "x-enumDescriptions": { paid: "Paid status" },
        } as JSONSchema7,
      },
    })
    const statusId = getChildNodeId(d, d.root.id, "status")!
    const paidId = getNode(d, statusId)!.enum![1].id

    d = updateEnumValue(d, statusId, paidId, {
      value: "complete",
    })
    d = removeEnumValue(
      d,
      statusId,
      getEffectiveDocNode(getNode(d, statusId)!).enum![0].id
    )

    expect(json(d).properties!.status).toEqual({
      anyOf: [
        {
          type: "string",
          enum: ["complete"],
        },
        { type: "null" },
      ],
      "x-enumDescriptions": { complete: "Paid status" },
    })
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

  it("setEnumValues replaces boolean schema literals", () => {
    let d = doc({
      type: "object",
      properties: {
        status: true,
      },
    } as JSONSchema7)
    const statusId = getChildNodeId(d, d.root.id, "status")!

    d = setEnumValues(d, statusId, ["draft", "paid"])

    expect(json(d).properties!.status).toEqual({
      type: "string",
      enum: ["draft", "paid"],
    })
  })
})

describe("description operations", () => {
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
          additionalItems: {
            type: "string",
            description: "additional tuple item",
          },
          unevaluatedItems: {
            type: "number",
            description: "unevaluated tuple item",
          },
          dependencies: {
            code: {
              type: "object",
              description: "dependent object",
              properties: {
                dependent: {
                  type: "string",
                  description: "dependent field",
                },
              },
            },
          },
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
    expect(
      (pair.additionalItems as JSONSchema7).description
    ).toBeUndefined()
    expect(
      ((pair as Record<string, unknown>).unevaluatedItems as JSONSchema7)
        .description
    ).toBeUndefined()
    const dependencies = pair.dependencies as Record<string, JSONSchema7>
    expect(dependencies.code.description).toBeUndefined()
    expect(
      (dependencies.code.properties!.dependent as JSONSchema7).description
    ).toBeUndefined()
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

  it("stripDescriptions preserves schema map keys that collide with object prototype keys", () => {
    const d = doc(
      JSON.parse(
        '{"type":"object","patternProperties":{"__proto__":{"type":"object","description":"proto","properties":{"value":{"type":"string","description":"value"}}},"constructor":{"type":"string","description":"ctor"}},"properties":{}}'
      ) as JSONSchema7
    )

    const out = json(stripDescriptions(d))

    expect(Object.prototype.hasOwnProperty.call(out.patternProperties, "__proto__"))
      .toBe(true)
    expect(Object.keys(out.patternProperties!)).toEqual([
      "__proto__",
      "constructor",
    ])
    expect((out.patternProperties!.__proto__ as JSONSchema7).description)
      .toBeUndefined()
    expect(
      ((out.patternProperties!.__proto__ as JSONSchema7).properties!
        .value as JSONSchema7).description
    ).toBeUndefined()
    expect((out.patternProperties!.constructor as JSONSchema7).description)
      .toBeUndefined()
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

  it("resolves and renames definitions whose names need JSON Pointer escaping", () => {
    let d = doc({
      type: "object",
      $defs: {
        "A/B~C": { type: "object", properties: { value: { type: "string" } } },
      },
      properties: {
        escaped: { $ref: "#/$defs/A~1B~0C" },
      },
    })
    const defId = d.defs.find((definition) => definition.name === "A/B~C")!.id

    expect(isDefinitionReferenced(d, defId)).toBe(true)

    d = renameDefinition(d, defId, "D/E~F")

    const out = json(d)
    expect(Object.keys(out.$defs!)).toEqual(["D/E~F"])
    expect((out.properties!.escaped as JSONSchema7).$ref).toBe(
      "#/$defs/D~1E~0F"
    )
  })

  it("resolves percent-encoded definition refs and normalizes them on rename", () => {
    let d = doc({
      type: "object",
      $defs: {
        "Line Item": {
          type: "object",
          properties: { sku: { type: "string" } },
        },
      },
      properties: {
        item: { $ref: "#/$defs/Line%20Item" },
      },
    })
    const defId = d.defs.find((definition) => definition.name === "Line Item")!
      .id

    expect(isDefinitionReferenced(d, defId)).toBe(true)

    d = renameDefinition(d, defId, "Order Item")

    const out = json(d)
    expect((out.properties!.item as JSONSchema7).$ref).toBe(
      "#/$defs/Order Item"
    )
  })

  it("resolves lowercase percent-encoded unicode definition refs", () => {
    let d = doc({
      type: "object",
      $defs: {
        "Café Item": {
          type: "object",
          properties: { name: { type: "string" } },
        },
      },
      properties: {
        item: { $ref: "#/$defs/Caf%c3%a9%20Item" },
      },
    })
    const defId = d.defs.find((definition) => definition.name === "Café Item")!
      .id

    expect(isDefinitionReferenced(d, defId)).toBe(true)

    d = renameDefinition(d, defId, "Menu Item")

    const out = json(d)
    expect((out.properties!.item as JSONSchema7).$ref).toBe(
      "#/$defs/Menu Item"
    )
  })

  it("resolves refs that percent-encode slash and tilde in definition names", () => {
    let d = doc({
      type: "object",
      $defs: {
        "A/B~C": {
          type: "object",
          properties: { value: { type: "string" } },
        },
      },
      properties: {
        item: { $ref: "#/$defs/A%2FB%7EC" },
      },
    })
    const defId = d.defs.find((definition) => definition.name === "A/B~C")!.id

    expect(isDefinitionReferenced(d, defId)).toBe(true)

    d = renameDefinition(d, defId, "D/E~F")

    const out = json(d)
    expect((out.properties!.item as JSONSchema7).$ref).toBe(
      "#/$defs/D~1E~0F"
    )
  })

  it("prefers JSON Pointer semantics over tolerant encoded-name aliases", () => {
    let d = doc({
      type: "object",
      $defs: {
        "A/B": {
          type: "object",
          properties: { slash: { type: "string" } },
        },
        "A~1B": {
          type: "object",
          properties: { tilde_one: { type: "string" } },
        },
      },
      properties: {
        item: { $ref: "#/$defs/A~1B" },
      },
    })
    const slashId = d.defs.find((definition) => definition.name === "A/B")!.id
    const tildeOneId = d.defs.find((definition) => definition.name === "A~1B")!
      .id

    expect(isDefinitionReferenced(d, slashId)).toBe(true)
    expect(isDefinitionReferenced(d, tildeOneId)).toBe(false)

    d = renameDefinition(d, slashId, "Slash")

    const out = json(d)
    expect((out.properties!.item as JSONSchema7).$ref).toBe("#/$defs/Slash")
  })

  it("renameDefinition updates refs inside schema-bearing rest keywords", () => {
    let d = doc({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      additionalProperties: { $ref: "#/$defs/Money" },
      properties: {
        tuple: {
          type: "array",
          items: [{ $ref: "#/$defs/Money" }],
          additionalItems: { $ref: "#/$defs/Money" },
          unevaluatedItems: { $ref: "#/$defs/Money" },
          dependencies: {
            tag: { $ref: "#/$defs/Money" },
            code: ["tag"],
          },
        } as JSONSchema7,
      },
    } as JSONSchema7)
    const moneyId = d.defs.find((definition) => definition.name === "Money")!.id

    d = renameDefinition(d, moneyId, "Amount")

    const out = json(d) as Record<string, unknown>
    expect(
      (out.additionalProperties as JSONSchema7).$ref
    ).toBe("#/$defs/Amount")
    expect(
      (((out.properties as Record<string, JSONSchema7>).tuple.items as JSONSchema7[])[0])
        .$ref
    ).toBe("#/$defs/Amount")
    const tuple = (out.properties as Record<string, JSONSchema7>)
      .tuple as JSONSchema7 & Record<string, unknown>
    expect((tuple.additionalItems as JSONSchema7).$ref).toBe("#/$defs/Amount")
    expect((tuple.unevaluatedItems as JSONSchema7).$ref).toBe(
      "#/$defs/Amount"
    )
    expect(
      (tuple.dependencies as Record<string, JSONSchema7 | string[]>).tag
    ).toEqual({ $ref: "#/$defs/Amount" })
    expect(
      (tuple.dependencies as Record<string, JSONSchema7 | string[]>).code
    ).toEqual(["tag"])
  })

  it("renames escaped refs inside schema-bearing rest keywords", () => {
    let d = doc({
      type: "object",
      $defs: {
        "A/B~C": { type: "object", properties: { value: { type: "string" } } },
      },
      additionalProperties: { $ref: "#/$defs/A~1B~0C" },
      properties: {},
    } as JSONSchema7)
    const defId = d.defs.find((definition) => definition.name === "A/B~C")!.id

    expect(isDefinitionReferenced(d, defId)).toBe(true)

    d = renameDefinition(d, defId, "D/E~F")

    const out = json(d) as Record<string, unknown>
    expect((out.additionalProperties as JSONSchema7).$ref).toBe(
      "#/$defs/D~1E~0F"
    )
  })

  it("renames percent-encoded refs inside schema-bearing rest keywords", () => {
    let d = doc({
      type: "object",
      $defs: {
        "Line Item": {
          type: "object",
          properties: { sku: { type: "string" } },
        },
      },
      additionalProperties: { $ref: "#/$defs/Line%20Item" },
      properties: {},
    } as JSONSchema7)
    const defId = d.defs.find((definition) => definition.name === "Line Item")!
      .id

    expect(isDefinitionReferenced(d, defId)).toBe(true)

    d = renameDefinition(d, defId, "Order Item")

    const out = json(d) as Record<string, unknown>
    expect((out.additionalProperties as JSONSchema7).$ref).toBe(
      "#/$defs/Order Item"
    )
  })

  it("renames refs in schema maps whose keys collide with object prototype keys", () => {
    let d = doc(
      JSON.parse(
        '{"type":"object","$defs":{"Money":{"type":"object","properties":{"amount":{"type":"number"}}}},"patternProperties":{"__proto__":{"$ref":"#/$defs/Money"},"constructor":{"$ref":"#/$defs/Money"}},"properties":{}}'
      ) as JSONSchema7
    )
    const moneyId = d.defs.find((definition) => definition.name === "Money")!.id

    d = renameDefinition(d, moneyId, "Amount")

    const out = json(d)
    expect(Object.prototype.hasOwnProperty.call(out.patternProperties, "__proto__"))
      .toBe(true)
    expect(Object.keys(out.patternProperties!)).toEqual([
      "__proto__",
      "constructor",
    ])
    expect(out.patternProperties!.__proto__).toEqual({
      $ref: "#/$defs/Amount",
    })
    expect(out.patternProperties!.constructor).toEqual({
      $ref: "#/$defs/Amount",
    })
  })

  it("round-trips mixed $defs and definitions refs with the same name", () => {
    const schema = {
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      definitions: {
        Money: { type: "object", properties: { currency: { type: "string" } } },
      },
      properties: {
        modern: { $ref: "#/$defs/Money" },
        legacy: { $ref: "#/definitions/Money" },
      },
    } as unknown as JSONSchema7

    expect(json(doc(schema))).toEqual(schema)
  })

  it("renameDefinition does not rewrite refs into the unmodeled definitions namespace", () => {
    let d = doc({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      definitions: {
        Money: { type: "object", properties: { currency: { type: "string" } } },
      },
      additionalProperties: { $ref: "#/definitions/Money" },
      properties: {
        modern: { $ref: "#/$defs/Money" },
        legacy: { $ref: "#/definitions/Money" },
      },
    } as unknown as JSONSchema7)
    const moneyId = d.defs.find((definition) => definition.name === "Money")!.id

    d = renameDefinition(d, moneyId, "Amount")

    const out = json(d) as Record<string, unknown>
    expect(Object.keys(out.$defs!)).toEqual(["Amount"])
    expect((out.definitions as Record<string, JSONSchema7>).Money).toEqual({
      type: "object",
      properties: { currency: { type: "string" } },
    })
    const properties = out.properties as Record<string, JSONSchema7>
    expect(properties.modern.$ref).toBe("#/$defs/Amount")
    expect(properties.legacy.$ref).toBe(
      "#/definitions/Money"
    )
    expect((out.additionalProperties as JSONSchema7).$ref).toBe(
      "#/definitions/Money"
    )
  })

  it("addDefinition adds a uniquely-named entry", () => {
    let d = doc(withDefs)
    d = addDefinition(d, { name: "Money" }).doc // collides
    expect(d.defs.map((x) => x.name)).toEqual(["Money", "Money2"])
  })

  it("addDefinition trims names before uniquing", () => {
    let d = doc(withDefs)
    d = addDefinition(d, { name: " Money " }).doc
    expect(d.defs.map((x) => x.name)).toEqual(["Money", "Money2"])
  })

  it("renameDefinition refuses blank names", () => {
    const d = doc(withDefs)
    const id = d.defs.find((x) => x.name === "Money")!.id

    const out = renameDefinition(d, id, "   ")

    expect(out).toBe(d)
    expect(json(out)).toEqual(json(d))
  })

  it("renameDefinition trims names before updating refs", () => {
    let d = doc(withDefs)
    const id = d.defs.find((x) => x.name === "Money")!.id

    d = renameDefinition(d, id, " Amount ")

    const out = json(d)
    expect(Object.keys(out.$defs!)).toEqual(["Amount"])
    expect((out.properties!.total as JSONSchema7).$ref).toBe("#/$defs/Amount")
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

  it("setRefByName removes stale date formats while preserving unrelated metadata", () => {
    let d = doc({
      ...withDefs,
      properties: {
        issued_at: {
          type: "string",
          format: "date-time",
          default: "2025-01-01T00:00:00Z",
        },
      },
    })
    const issuedAtId = getChildNodeId(d, d.root.id, "issued_at")!

    d = setRefByName(d, issuedAtId, "Money")

    expect(json(d).properties!.issued_at).toEqual({
      $ref: "#/$defs/Money",
      default: "2025-01-01T00:00:00Z",
    })
  })

  it("setRefByName removes stale scalar constraints while preserving neutral metadata", () => {
    let d = doc({
      ...withDefs,
      properties: {
        code: {
          type: "string",
          minLength: 2,
          pattern: "^A",
          default: "A1",
        } as JSONSchema7,
      },
    })
    const codeId = getChildNodeId(d, d.root.id, "code")!

    d = setRefByName(d, codeId, "Money")

    expect(json(d).properties!.code).toEqual({
      $ref: "#/$defs/Money",
      default: "A1",
    })
  })

  it("setRefByName removes stale tuple items when converting a tuple array to a ref", () => {
    let d = doc({
      ...withDefs,
      properties: {
        pair: {
          type: "array",
          items: [{ type: "string" }, { type: "number" }],
        } as JSONSchema7,
      },
    })
    const pairId = getChildNodeId(d, d.root.id, "pair")!

    d = setRefByName(d, pairId, "Money")

    expect(json(d).properties!.pair).toEqual({ $ref: "#/$defs/Money" })
  })

  it("setRefByName removes stale formats inside nullable formatted branches", () => {
    let d = doc({
      type: "object",
      $defs: {
        Money: {
          type: "object",
          properties: { amount: { type: "number" } },
        },
      },
      properties: {
        maybe_issued_at: {
          anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          default: null,
        },
      },
    })
    const maybeIssuedAtId = getChildNodeId(d, d.root.id, "maybe_issued_at")!

    d = setRefByName(d, maybeIssuedAtId, "Money")

    expect(json(d).properties!.maybe_issued_at).toEqual({
      anyOf: [{ $ref: "#/$defs/Money" }, { type: "null" }],
      default: null,
    })
  })

  it("setEnumValues removes stale date formats when converting a formatted string to choices", () => {
    let d = doc({
      type: "object",
      properties: {
        issued_at: {
          type: "string",
          format: "date-time",
        },
      },
    })
    const issuedAtId = getChildNodeId(d, d.root.id, "issued_at")!

    d = setEnumValues(d, issuedAtId, ["draft", "paid"])

    expect(json(d).properties!.issued_at).toEqual({
      type: "string",
      enum: ["draft", "paid"],
    })
  })

  it("setEnumValues removes stale scalar constraints when converting to choices", () => {
    let d = doc({
      type: "object",
      properties: {
        amount: {
          type: "number",
          minimum: 0,
          maximum: 100,
          default: 10,
        } as JSONSchema7,
      },
    })
    const amountId = getChildNodeId(d, d.root.id, "amount")!

    d = setEnumValues(d, amountId, ["low", "high"])

    expect(json(d).properties!.amount).toEqual({
      type: "string",
      enum: ["low", "high"],
      default: 10,
    })
  })

  it("setEnumValues removes stale tuple items when converting a tuple array to choices", () => {
    let d = doc({
      type: "object",
      properties: {
        pair: {
          type: "array",
          items: [{ type: "string" }, { type: "number" }],
        } as JSONSchema7,
      },
    })
    const pairId = getChildNodeId(d, d.root.id, "pair")!

    d = setEnumValues(d, pairId, ["left", "right"])

    expect(json(d).properties!.pair).toEqual({
      type: "string",
      enum: ["left", "right"],
    })
  })

  it("setEnumValues removes stale formats from nullable formatted strings", () => {
    let d = doc({
      type: "object",
      properties: {
        status_at: {
          type: ["string", "null"],
          format: "date-time",
        },
      },
    })
    const statusAtId = getChildNodeId(d, d.root.id, "status_at")!

    d = setEnumValues(d, statusAtId, ["draft", "paid"])

    expect(json(d).properties!.status_at).toEqual({
      anyOf: [
        { type: "string", enum: ["draft", "paid"] },
        { type: "null" },
      ],
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

  it("findNodeByPath accepts exact path segments for keys containing separators", () => {
    const d = doc({
      type: "object",
      properties: {
        "a.b": {
          type: "object",
          properties: {
            "": { type: "string" },
          },
        },
      },
    })

    const id = findNodeByPath(d, ["a.b", ""])

    expect(getNode(d, id!)!.type).toBe("string")
    expect(findNodeByPath(d, "a.b")).toBeNull()
  })

  it("findNodeByPath stops unwrapping self-referential refs", () => {
    const d = doc({
      type: "object",
      $defs: {
        Loop: { $ref: "#/$defs/Loop" },
      },
      properties: {
        loop: { $ref: "#/$defs/Loop" },
      },
    })

    expect(findNodeByPath(d, "loop.child")).toBeNull()
  })

  it("findNodeByPath still resolves finite paths through recursive object refs", () => {
    const d = doc({
      type: "object",
      $defs: {
        Node: {
          type: "object",
          properties: {
            name: { type: "string" },
            next: { $ref: "#/$defs/Node" },
          },
        },
      },
      properties: {
        node: { $ref: "#/$defs/Node" },
      },
    })

    const id = findNodeByPath(d, "node.next.name")

    expect(getNode(d, id!)!.type).toBe("string")
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

  it("getOwnProperty works through an anyOf-nullable object parent", () => {
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
    expect(getOwnProperty(d, vId, 0)?.key).toBe("x")
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
          additionalItems: { $ref: "#/$defs/Money" },
          dependencies: {
            tag: { $ref: "#/$defs/Money" },
            code: ["tag"],
          },
        } as JSONSchema7,
      },
    } as JSONSchema7)
    const moneyId = d.defs.find((definition) => definition.name === "Money")!.id

    expect(isDefinitionReferenced(d, moneyId)).toBe(true)
  })

  it("finds refs inside array rest schema keywords", () => {
    const d = doc({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      properties: {
        tuple: {
          type: "array",
          items: [{ type: "string" }],
          additionalItems: { $ref: "#/$defs/Money" },
          unevaluatedItems: { $ref: "#/$defs/Money" },
        } as JSONSchema7,
      },
    } as JSONSchema7)
    const moneyId = d.defs.find((definition) => definition.name === "Money")!.id

    expect(isDefinitionReferenced(d, moneyId)).toBe(true)
  })

  it("does not treat raw refs into a secondary definitions namespace as modeled refs", () => {
    const d = doc({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      definitions: {
        Money: { type: "object", properties: { currency: { type: "string" } } },
      },
      additionalProperties: { $ref: "#/definitions/Money" },
      properties: {
        legacy: { $ref: "#/definitions/Money" },
      },
    } as unknown as JSONSchema7)
    const moneyId = d.defs.find((definition) => definition.name === "Money")!.id

    expect(isDefinitionReferenced(d, moneyId)).toBe(false)
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
