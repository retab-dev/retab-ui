import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import {
  getChildNodeId,
  getChildPropertyId,
} from "@/components/schema-editor/document/node-selectors"
import {
  addProperty,
  moveProperty,
  removeProperty,
  renameProperty,
  setRequired,
} from "@/components/schema-editor/document/property-operations"

const nested: JSONSchema7 = {
  type: "object",
  properties: {
    a: {
      type: "object",
      properties: {
        b: { type: "object", properties: {} },
        x: { type: "string" },
      },
    },
    c: { type: "string" },
  },
}

function props(json: JSONSchema7) {
  return json.properties as Record<string, JSONSchema7>
}

describe("addProperty", () => {
  it("adds a named, projectable property", () => {
    const doc = fromJsonSchema({ type: "object", properties: {} })
    const next = addProperty(doc, doc.root.id, { key: "total" })
    expect(Object.keys(props(toJsonSchema(next)))).toEqual(["total"])
  })

  it("does not project an empty (transient) property", () => {
    const doc = fromJsonSchema({ type: "object", properties: {} })
    const next = addProperty(doc, doc.root.id)
    expect(Object.keys(props(toJsonSchema(next)))).toEqual([])
  })
})

describe("renameProperty / removeProperty", () => {
  it("renames a property key in the projection", () => {
    const doc = fromJsonSchema(nested)
    const cId = getChildPropertyId(doc, doc.root.id, "c")!
    const next = renameProperty(doc, cId, "renamed")
    const keys = Object.keys(props(toJsonSchema(next)))
    expect(keys).toContain("renamed")
    expect(keys).not.toContain("c")
  })

  it("removes a property", () => {
    const doc = fromJsonSchema(nested)
    const cId = getChildPropertyId(doc, doc.root.id, "c")!
    const next = removeProperty(doc, cId)
    expect(Object.keys(props(toJsonSchema(next)))).toEqual(["a"])
  })
})

describe("setRequired", () => {
  it("adds and removes the property from required[]", () => {
    const doc = fromJsonSchema(nested)
    const cId = getChildPropertyId(doc, doc.root.id, "c")!

    const required = toJsonSchema(setRequired(doc, cId, true)) as JSONSchema7
    expect(required.required).toContain("c")

    const optional = toJsonSchema(
      setRequired(setRequired(doc, cId, true), cId, false)
    ) as JSONSchema7
    expect(optional.required ?? []).not.toContain("c")
  })
})

describe("moveProperty", () => {
  it("reorders within the same parent", () => {
    const doc = fromJsonSchema(nested)
    const cId = getChildPropertyId(doc, doc.root.id, "c")!
    const next = moveProperty(doc, cId, doc.root.id, 0)
    expect(Object.keys(props(toJsonSchema(next)))).toEqual(["c", "a"])
  })

  it("moves a property into a nested object", () => {
    const doc = fromJsonSchema(nested)
    const cId = getChildPropertyId(doc, doc.root.id, "c")!
    const aNodeId = getChildNodeId(doc, doc.root.id, "a")!
    const next = moveProperty(doc, cId, aNodeId, 0)

    const json = toJsonSchema(next) as JSONSchema7
    expect(Object.keys(props(json))).toEqual(["a"]) // c left the root
    expect(Object.keys(props(props(json).a))).toContain("c") // now under a
  })

  it("clamps an out-of-range index to the end", () => {
    const doc = fromJsonSchema(nested)
    const cId = getChildPropertyId(doc, doc.root.id, "c")!
    const next = moveProperty(doc, cId, doc.root.id, 99)
    expect(Object.keys(props(toJsonSchema(next)))).toEqual(["a", "c"])
  })

  it("refuses to move a property into its own subtree (cycle guard)", () => {
    const doc = fromJsonSchema(nested)
    const aId = getChildPropertyId(doc, doc.root.id, "a")!
    const aNodeId = getChildNodeId(doc, doc.root.id, "a")!
    const bNodeId = getChildNodeId(doc, aNodeId, "b")!

    // Moving "a" into "a.b" would create a cycle; the document must be unchanged.
    const next = moveProperty(doc, aId, bNodeId, 0)
    expect(toJsonSchema(next)).toEqual(toJsonSchema(doc))
  })
})
