import { describe, expect, it } from "vitest"

import {
  getArrayItemsForDraft,
  setDraftNullable,
} from "@/components/schema-editor/property-form/model/effective-node-edits"
import {
  createObjectPropertySchema,
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import { propertyDraftReducer } from "@/components/schema-editor/property-form/reducer"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type { PropertyDraft } from "@/components/schema-editor/property-form/types"

describe("createObjectPropertySchema", () => {
  it("creates a titled string schema", () => {
    expect(createObjectPropertySchema("first_name")).toEqual({
      type: "string",
      title: "First Name",
    })
  })
})

describe("replaceObjectProperty", () => {
  const base: ExtendedJSONSchema7 = {
    type: "object",
    properties: { a: { type: "string" } },
    required: ["a"],
  }

  it("adds a new property and marks it required", () => {
    const next = replaceObjectProperty({
      schemaNode: base,
      propertyName: "b",
      propertySchema: { type: "number" },
    })
    expect(next.properties).toMatchObject({ b: { type: "number" } })
    expect(next.required).toEqual(["a", "b"])
  })

  it("replaces an existing property without duplicating required", () => {
    const next = replaceObjectProperty({
      schemaNode: base,
      propertyName: "a",
      propertySchema: { type: "boolean" },
    })
    expect(next.properties).toMatchObject({ a: { type: "boolean" } })
    expect(next.required).toEqual(["a"])
  })
})

describe("renameObjectProperty", () => {
  const base: ExtendedJSONSchema7 = {
    type: "object",
    properties: { a: { type: "string" }, b: { type: "number" } },
    required: ["a", "b"],
  }

  it("renames the key and the required entry, preserving order", () => {
    const next = renameObjectProperty({
      schemaNode: base,
      oldName: "a",
      newName: "renamed",
    })
    expect(Object.keys(next.properties as object)).toEqual(["renamed", "b"])
    expect(next.required).toEqual(["renamed", "b"])
  })

  it("is a no-op when the new name is empty or unchanged", () => {
    expect(renameObjectProperty({ schemaNode: base, oldName: "a", newName: "" })).toBe(base)
    expect(
      renameObjectProperty({ schemaNode: base, oldName: "a", newName: "a" })
    ).toBe(base)
  })

  it("is a no-op when the new name collides with an existing property", () => {
    expect(
      renameObjectProperty({ schemaNode: base, oldName: "a", newName: "b" })
    ).toBe(base)
  })
})

describe("removeObjectProperty", () => {
  it("drops the property and its required entry", () => {
    const next = removeObjectProperty({
      schemaNode: {
        type: "object",
        properties: { a: { type: "string" }, b: { type: "number" } },
        required: ["a", "b"],
      },
      propertyName: "a",
    })
    expect(Object.keys(next.properties as object)).toEqual(["b"])
    expect(next.required).toEqual(["b"])
  })
})

describe("getArrayItemsForDraft", () => {
  it("returns the items schema for a plain array", () => {
    expect(
      getArrayItemsForDraft({ type: "array", items: { type: "number" } })
    ).toEqual({ type: "number" })
  })

  it("reads through a nullable anyOf wrapper", () => {
    expect(
      getArrayItemsForDraft({
        anyOf: [
          { type: "array", items: { type: "object", properties: {} } },
          { type: "null" },
        ],
      })
    ).toEqual({ type: "object", properties: {} })
  })

  it("falls back to a string schema for tuple items", () => {
    expect(
      getArrayItemsForDraft({
        type: "array",
        items: [{ type: "string" }, { type: "number" }],
      })
    ).toEqual({ type: "string" })
  })

  it("falls back to a string schema when items are missing", () => {
    expect(getArrayItemsForDraft({ type: "array" })).toEqual({ type: "string" })
  })
})

describe("propertyDraftReducer", () => {
  const draft: PropertyDraft = {
    name: "field",
    schemaNode: { type: "string" },
  }

  it("renames", () => {
    expect(
      propertyDraftReducer(draft, { type: "renameProperty", name: "renamed" })
    ).toEqual({ name: "renamed", schemaNode: { type: "string" } })
  })

  it("sets a description", () => {
    expect(
      propertyDraftReducer(draft, {
        type: "setPropertyDescription",
        description: "hi",
      }).schemaNode
    ).toEqual({ type: "string", description: "hi" })
  })

  it("toggles nullability via setDraftNullable", () => {
    const next = propertyDraftReducer(draft, {
      type: "setPropertyNullable",
      isNullable: true,
    })
    expect(next.schemaNode).toEqual({
      anyOf: [{ type: "string" }, { type: "null" }],
    })
  })

  it("replaces the schema node", () => {
    const next = propertyDraftReducer(draft, {
      type: "replacePropertySchemaNode",
      schemaNode: { type: "number" },
    })
    expect(next.schemaNode).toEqual({ type: "number" })
  })

  it("matches setDraftNullable directly", () => {
    expect(setDraftNullable(draft, true).schemaNode).toEqual({
      anyOf: [{ type: "string" }, { type: "null" }],
    })
  })
})
