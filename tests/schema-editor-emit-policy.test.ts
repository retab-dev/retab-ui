import Ajv from "ajv"
import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import { fromJsonSchema } from "@/components/schema-editor/document/convert"
import { getChildPropertyId } from "@/components/schema-editor/document/node-selectors"
import {
  addProperty,
  setRequired,
} from "@/components/schema-editor/document/property-operations"
import {
  setNodeType,
  setNullable,
} from "@/components/schema-editor/document/type-operations"
import { findNodeByPath } from "@/components/schema-editor/document/traversal"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import { projectSchemaDocument } from "@/components/schema-editor/use-schema-builder-state"

/**
 * `projectSchemaDocument` is the editor's real output contract:
 * `requireAllProperties(toJsonSchema(doc))`. These tests exercise that boundary
 * end-to-end — the place a consumer of the schema-builder actually reads from.
 */

const emit = (doc: SchemaDocument) => projectSchemaDocument(doc) as JSONSchema7

function nodeId(doc: SchemaDocument, path: string): string {
  const id = findNodeByPath(doc, path)
  if (!id) throw new Error(`no node at "${path}"`)
  return id
}

describe("emit policy: every property is required in the output", () => {
  it("forces required even for a property imported as optional", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a"],
    })
    const out = emit(doc)
    expect(out.required).toEqual(["a", "b"])
  })

  it("toggling a property's required flag off does NOT make it optional in output", () => {
    // Documents the policy: the in-model `required` flag is overridden by the
    // emit boundary, so the visible JSON always lists the property as required.
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
      required: ["a"],
    })
    const off = setRequired(doc, getChildPropertyId(doc, doc.root.id, "a")!, false)
    expect(emit(off).required).toEqual(["a"])
  })

  it("applies the policy recursively to nested objects and array items", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: { x: { type: "string" }, y: { type: "string" } },
        },
        rows: {
          type: "array",
          items: { type: "object", properties: { z: { type: "string" } } },
        },
      },
    })
    const out = emit(doc)
    expect(out.required).toEqual(["nested", "rows"])
    expect((out.properties!.nested as JSONSchema7).required).toEqual(["x", "y"])
    expect(
      ((out.properties!.rows as JSONSchema7).items as JSONSchema7).required
    ).toEqual(["z"])
  })
})

describe("emit policy: required and nullable coexist", () => {
  it("a nullable field is still required and still permits null", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const nullable = setNullable(doc, nodeId(doc, "a"), true)
    const out = emit(nullable)
    expect(out.required).toContain("a")

    const validate = new Ajv({ strict: false }).compile(out)
    expect(validate({ a: null })).toBe(true) // present-but-null is valid
    expect(validate({})).toBe(false) // absent fails required
  })
})

describe("emit policy: structural soundness", () => {
  it("is idempotent — re-projecting a re-imported output is stable", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: ["number", "null"] },
        c: { type: "object", properties: { d: { type: "string" } } },
      },
    })
    const once = emit(doc)
    const twice = emit(fromJsonSchema(once))
    expect(twice).toEqual(once)
  })

  it("a freshly added blank-key property never reaches the output", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const withBlank = addProperty(doc, doc.root.id) // empty transient key
    const out = emit(withBlank)
    expect(Object.keys(out.properties!)).toEqual(["a"])
    // the blank key must not leak into required[] either
    expect(out.required).toEqual(["a"])
  })

  it("changing a leaf to an object materializes a required default property", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const toObject = setNodeType(doc, nodeId(doc, "a"), "object")
    const out = emit(toObject)
    const a = out.properties!.a as JSONSchema7
    expect(a.type).toBe("object")
    // the editor seeds a starter property; until named it is blank/transient,
    // so it must not appear as a phantom key or required entry.
    expect(a.properties ?? {}).toEqual({})
    expect(a.required ?? []).toEqual([])
  })
})
