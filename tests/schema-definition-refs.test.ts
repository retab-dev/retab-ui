import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import {
  removeDefinition,
  renameDefinition,
  setRef,
} from "@/components/schema-editor/document/definition-operations"
import {
  isDanglingRef,
  isDefinitionReferenced,
} from "@/components/schema-editor/document/derive"
import { getChildNodeId } from "@/components/schema-editor/document/node-selectors"
import { getNode } from "@/components/schema-editor/document/traversal"

function defId(doc: ReturnType<typeof fromJsonSchema>, name: string) {
  return doc.defs.find((d) => d.name === name)!.id
}

describe("renameDefinition: rewrites references", () => {
  it("updates a modeled $ref and preserves the definition body", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { ref: { $ref: "#/$defs/Foo" } },
      $defs: { Foo: { type: "string", title: "Foo title" } },
    })
    const next = renameDefinition(doc, defId(doc, "Foo"), "Bar")
    const json = toJsonSchema(next) as JSONSchema7 & Record<string, unknown>
    const props = json.properties as Record<string, { $ref?: string }>
    expect(props.ref.$ref).toBe("#/$defs/Bar")
    const defs = json.$defs as Record<string, JSONSchema7>
    expect(defs.Bar).toMatchObject({ type: "string", title: "Foo title" })
    expect(defs.Foo).toBeUndefined()
  })

  it("rewrites a $ref buried in a rest keyword (additionalProperties)", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        map: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/Foo" },
        },
      },
      $defs: { Foo: { type: "string" } },
    })
    const next = renameDefinition(doc, defId(doc, "Foo"), "Renamed")
    const json = toJsonSchema(next) as JSONSchema7 & Record<string, unknown>
    const props = json.properties as Record<
      string,
      { additionalProperties?: { $ref?: string } }
    >
    expect(props.map.additionalProperties?.$ref).toBe("#/$defs/Renamed")
  })

  it("auto-suffixes when the new name collides with another definition", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {},
      $defs: { Foo: { type: "string" }, Bar: { type: "number" } },
    })
    const next = renameDefinition(doc, defId(doc, "Foo"), "Bar")
    const names = next.defs.map((d) => d.name).sort()
    // The collision is resolved with a numeric suffix rather than overwriting.
    expect(names).toContain("Bar")
    expect(names).toContain("Bar2")
    expect(names).toHaveLength(2)
  })

  it("returns the document unchanged for a blank name", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {},
      $defs: { Foo: { type: "string" } },
    })
    expect(renameDefinition(doc, defId(doc, "Foo"), "   ")).toBe(doc)
  })
})

describe("removeDefinition: dangling-ref behavior", () => {
  // NOTE: deleting a *referenced* definition is normally blocked in the UI by
  // `isDefinitionReferenced` (the controller shows a toast and refuses). These
  // tests pin down the raw model behavior if that guard is ever bypassed.
  it("flags the orphaned node via isDanglingRef", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { ref: { $ref: "#/$defs/Foo" } },
      $defs: { Foo: { type: "string" } },
    })
    const next = removeDefinition(doc, defId(doc, "Foo"))
    const refNodeId = getChildNodeId(next, next.root.id, "ref")!
    expect(isDanglingRef(next, getNode(next, refNodeId)!)).toBe(true)
  })

  it("projects an orphaned ref to an empty (accept-anything) schema", () => {
    // Surprising but currently intended: the dropped $ref widens the property
    // to `{}` on export rather than preserving a dangling pointer or erroring.
    const doc = fromJsonSchema({
      type: "object",
      properties: { ref: { $ref: "#/$defs/Foo" } },
      $defs: { Foo: { type: "string" } },
    })
    const next = removeDefinition(doc, defId(doc, "Foo"))
    const json = toJsonSchema(next) as JSONSchema7
    const props = json.properties as Record<string, JSONSchema7>
    expect(props.ref).toEqual({})
  })
})

describe("setRef on a nullable type-array node", () => {
  it("wraps the ref in a nullable anyOf instead of a bare ref", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { thing: { type: ["string", "null"] } },
      $defs: { Foo: { type: "object", properties: {} } },
    })
    const thingId = getChildNodeId(doc, doc.root.id, "thing")!
    const next = setRef(doc, thingId, defId(doc, "Foo"))
    const node = getNode(next, thingId)!

    expect(node.anyOf).toBeDefined()
    const refBranch = node.anyOf!.find((b) => b.ref)
    const nullBranch = node.anyOf!.find((b) => b.type === "null")
    expect(refBranch).toBeDefined()
    expect(nullBranch).toBeDefined()
  })
})

describe("isDefinitionReferenced", () => {
  it("is true while referenced and false once unreferenced", () => {
    const referenced = fromJsonSchema({
      type: "object",
      properties: { ref: { $ref: "#/$defs/Foo" } },
      $defs: { Foo: { type: "string" } },
    })
    expect(isDefinitionReferenced(referenced, defId(referenced, "Foo"))).toBe(
      true
    )

    const unreferenced = fromJsonSchema({
      type: "object",
      properties: { plain: { type: "string" } },
      $defs: { Foo: { type: "string" } },
    })
    expect(
      isDefinitionReferenced(unreferenced, defId(unreferenced, "Foo"))
    ).toBe(false)
  })
})
