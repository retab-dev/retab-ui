import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import { getChildNodeId } from "@/components/schema-editor/document/node-selectors"
import { getNode } from "@/components/schema-editor/document/traversal"
import {
  addObjectTemplateDefinitionsToDocument,
  applyObjectTemplateReferenceToDocument,
} from "@/components/schema-editor/optional/object-templates/object-template-reference"

function baseDoc() {
  return fromJsonSchema({
    type: "object",
    properties: { company: { type: "string" } },
  })
}

describe("addObjectTemplateDefinitionsToDocument", () => {
  it("installs a template plus its declared dependencies", () => {
    const doc = addObjectTemplateDefinitionsToDocument(baseDoc(), "Company")
    const names = doc.defs.map((d) => d.name)
    expect(names).toContain("Company")
    expect(names).toContain("Address") // Company depends on Address
  })

  it("is idempotent — installing twice does not duplicate", () => {
    let doc = addObjectTemplateDefinitionsToDocument(baseDoc(), "Company")
    doc = addObjectTemplateDefinitionsToDocument(doc, "Company")
    const names = doc.defs.map((d) => d.name)
    expect(names.filter((n) => n === "Company")).toHaveLength(1)
    expect(names.filter((n) => n === "Address")).toHaveLength(1)
  })

  it("is a no-op for an unknown template", () => {
    const doc = baseDoc()
    expect(addObjectTemplateDefinitionsToDocument(doc, "DoesNotExist")).toBe(doc)
  })
})

describe("applyObjectTemplateReferenceToDocument", () => {
  it("points the target node at the installed definition", () => {
    const doc = baseDoc()
    const nodeId = getChildNodeId(doc, doc.root.id, "company")!
    const next = applyObjectTemplateReferenceToDocument(doc, nodeId, "Company")

    const companyDef = next.defs.find((d) => d.name === "Company")!
    const node = getNode(next, nodeId)!
    expect(node.ref).toBe(companyDef.id)

    // Projecting back yields a $ref to the Company definition.
    const json = toJsonSchema(next)
    const company = (json.properties as Record<string, { $ref?: string }>)
      .company
    expect(company.$ref).toBe("#/$defs/Company")
  })

  it("returns a usable document even for an unknown template", () => {
    const doc = baseDoc()
    const nodeId = getChildNodeId(doc, doc.root.id, "company")!
    const next = applyObjectTemplateReferenceToDocument(doc, nodeId, "Nope")
    expect(next).toBe(doc)
  })
})
