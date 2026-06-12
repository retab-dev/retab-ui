import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import { fromJsonSchema } from "@/components/schema-editor/document/convert"
import { addDefinition, setRef } from "@/components/schema-editor/document/definition-operations"
import {
  getChildNodeId,
  getItemsNodeId,
} from "@/components/schema-editor/document/node-selectors"
import { findNodeByPath, getNode } from "@/components/schema-editor/document/traversal"

describe("findNodeByPath", () => {
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      invoice_number: { type: "string" },
      customer: {
        type: "object",
        properties: {
          name: { type: "string" },
          address: {
            type: "object",
            properties: { city: { type: "string" } },
          },
        },
      },
      line_items: {
        type: "array",
        items: {
          type: "object",
          properties: { sku: { type: "string" } },
        },
      },
      maybe_obj: {
        anyOf: [
          { type: "object", properties: { inner: { type: "string" } } },
          { type: "null" },
        ],
      },
    },
  }

  it("resolves a top-level property", () => {
    const doc = fromJsonSchema(schema)
    expect(findNodeByPath(doc, "invoice_number")).toBe(
      getChildNodeId(doc, doc.root.id, "invoice_number")
    )
  })

  it("resolves a nested object path", () => {
    const doc = fromJsonSchema(schema)
    const customerId = getChildNodeId(doc, doc.root.id, "customer")!
    const addressId = getChildNodeId(doc, customerId, "address")!
    const cityId = getChildNodeId(doc, addressId, "city")
    expect(findNodeByPath(doc, "customer.address.city")).toBe(cityId)
  })

  it("descends through array items transparently", () => {
    const doc = fromJsonSchema(schema)
    const lineItemsId = getChildNodeId(doc, doc.root.id, "line_items")!
    const itemsId = getItemsNodeId(doc, lineItemsId)!
    const skuId = getChildNodeId(doc, itemsId, "sku")
    // The "line_items" segment lands on the array; "sku" reads through items.
    expect(findNodeByPath(doc, "line_items.sku")).toBe(skuId)
  })

  it("unwraps a nullable anyOf object container", () => {
    const doc = fromJsonSchema(schema)
    const maybeId = getChildNodeId(doc, doc.root.id, "maybe_obj")!
    const innerId = findNodeByPath(doc, "maybe_obj.inner")
    expect(innerId).not.toBeNull()
    // It should be a real, resolvable node distinct from the wrapper.
    expect(getNode(doc, innerId!)).not.toBeNull()
    expect(innerId).not.toBe(maybeId)
  })

  it("returns null for an unknown segment", () => {
    const doc = fromJsonSchema(schema)
    expect(findNodeByPath(doc, "customer.nope")).toBeNull()
    expect(findNodeByPath(doc, "nope")).toBeNull()
  })

  it("accepts an array path equivalently to a dotted string", () => {
    const doc = fromJsonSchema(schema)
    expect(findNodeByPath(doc, ["customer", "name"])).toBe(
      findNodeByPath(doc, "customer.name")
    )
  })

  it("resolves the root for an empty path", () => {
    const doc = fromJsonSchema(schema)
    expect(findNodeByPath(doc, "")).toBe(doc.root.id)
    expect(findNodeByPath(doc, [])).toBe(doc.root.id)
  })

  it("follows a $ref into a definition", () => {
    let doc = fromJsonSchema({
      type: "object",
      properties: { node: { type: "string" } },
    })
    const added = addDefinition(doc, {
      name: "Node",
      node: fromJsonSchema({
        type: "object",
        properties: { label: { type: "string" } },
      }).root,
    })
    doc = added.doc
    const nodePropId = getChildNodeId(doc, doc.root.id, "node")!
    doc = setRef(doc, nodePropId, added.defId)
    const resolved = findNodeByPath(doc, "node.label")
    expect(resolved).not.toBeNull()
    expect(getNode(doc, resolved!)).not.toBeNull()
  })

  it("does not loop forever on a self-referential definition", () => {
    let doc = fromJsonSchema({
      type: "object",
      properties: { self: { type: "string" } },
    })
    const added = addDefinition(doc, {
      name: "Recursive",
      node: fromJsonSchema({ type: "object", properties: {} }).root,
    })
    doc = added.doc
    // Make the definition reference itself, and the property point at it.
    // `defId` is the DefinitionEntry id; its node has a distinct id.
    const defNodeId = doc.defs.find((d) => d.id === added.defId)!.node.id
    doc = setRef(doc, defNodeId, added.defId)
    const selfPropId = getChildNodeId(doc, doc.root.id, "self")!
    doc = setRef(doc, selfPropId, added.defId)
    // Should terminate (cycle guard) rather than hang.
    expect(findNodeByPath(doc, "self.whatever")).toBeNull()
  })
})
