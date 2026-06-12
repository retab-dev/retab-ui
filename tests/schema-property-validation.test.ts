import { describe, expect, it } from "vitest"

import { validatePropertyDraft } from "@/components/schema-editor/property-form/validation"
import type {
  PropertyDraft,
  PropertyFormSchemaContext,
} from "@/components/schema-editor/property-form/types"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

function context(
  overrides: Partial<PropertyFormSchemaContext> = {}
): PropertyFormSchemaContext {
  return {
    siblingNames: [],
    originalName: "",
    schemaDefinitions: {},
    ...overrides,
  }
}

function draft(name: string, schemaNode: ExtendedJSONSchema7): PropertyDraft {
  return { name, schemaNode }
}

describe("validatePropertyDraft: name", () => {
  it("accepts a valid, unique name", () => {
    const result = validatePropertyDraft({
      propertyDraft: draft("total", { type: "number" }),
      schemaContext: context({ siblingNames: ["other"] }),
    })
    expect(result.name.status).toBe("valid")
    expect(result.canCommit).toBe(true)
  })

  it("flags a duplicate name and blocks commit", () => {
    const result = validatePropertyDraft({
      propertyDraft: draft("total", { type: "number" }),
      schemaContext: context({ siblingNames: ["total"] }),
    })
    expect(result.name.status).toBe("invalid")
    expect(result.canCommit).toBe(false)
  })

  it("flags an invalid identifier", () => {
    const result = validatePropertyDraft({
      propertyDraft: draft("1total", { type: "number" }),
      schemaContext: context(),
    })
    expect(result.name.status).toBe("invalid")
    expect(result.name.code).toBe("property_name_invalid")
  })
})

describe("validatePropertyDraft: enum nodes", () => {
  const enumNode = (values: unknown[]): ExtendedJSONSchema7 =>
    ({ type: "string", enum: values }) as ExtendedJSONSchema7

  it("rejects an empty enum", () => {
    const result = validatePropertyDraft({
      propertyDraft: draft("category", enumNode([])),
      schemaContext: context(),
    })
    expect(result.schemaNode.status).toBe("invalid")
    expect(result.schemaNode.code).toBe("enum_empty")
  })

  it("rejects a blank string option", () => {
    const result = validatePropertyDraft({
      propertyDraft: draft("category", enumNode(["ok", "   "])),
      schemaContext: context(),
    })
    expect(result.schemaNode.status).toBe("invalid")
    expect(result.schemaNode.code).toBe("enum_blank")
  })

  it("rejects duplicate scalar options", () => {
    const result = validatePropertyDraft({
      propertyDraft: draft("category", enumNode(["a", "b", "a"])),
      schemaContext: context(),
    })
    expect(result.schemaNode.status).toBe("invalid")
    expect(result.schemaNode.code).toBe("enum_duplicate")
  })

  it("treats objects with reordered keys as duplicates", () => {
    const result = validatePropertyDraft({
      propertyDraft: draft(
        "category",
        enumNode([
          { a: 1, b: 2 },
          { b: 2, a: 1 },
        ])
      ),
      schemaContext: context(),
    })
    expect(result.schemaNode.status).toBe("invalid")
    expect(result.schemaNode.code).toBe("enum_duplicate")
  })

  it("does not treat distinct types with equal text as duplicates", () => {
    // The string "1" and the number 1 must remain distinct options.
    const result = validatePropertyDraft({
      propertyDraft: draft("category", enumNode(["1", 1])),
      schemaContext: context(),
    })
    expect(result.schemaNode.status).toBe("valid")
  })

  it("accepts a valid, unique, non-blank enum", () => {
    const result = validatePropertyDraft({
      propertyDraft: draft("category", enumNode(["a", "b", "c"])),
      schemaContext: context(),
    })
    expect(result.schemaNode.status).toBe("valid")
    expect(result.canCommit).toBe(true)
  })
})
