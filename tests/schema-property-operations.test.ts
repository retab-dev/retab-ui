import { describe, expect, it } from "vitest"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import {
  applyTemplateToTableSchemaProperty,
  renamePropertyAtPath,
} from "@/components/json-table/schema-property-operations"

describe("schema property operations", () => {
  it("renames a property at an explicit path", () => {
    const schema: ExtendedJSONSchema7 = {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
      },
    }

    expect(
      Object.keys(
        renamePropertyAtPath(schema, "invoice_number", "id").properties!
      )
    ).toEqual(["id"])
  })

  it("applies an object template at an explicit path", async () => {
    const schema: ExtendedJSONSchema7 = {
      type: "object",
      properties: {
        address: { type: "object", properties: {} },
      },
    }

    const next = await applyTemplateToTableSchemaProperty(
      schema,
      "address",
      "Address"
    )

    expect(next.$defs?.Address).toBeTruthy()
    expect(next.properties?.address).toEqual({ $ref: "#/$defs/Address" })
  })

  it("preserves nullable wrappers when applying an object template", async () => {
    const schema: ExtendedJSONSchema7 = {
      type: "object",
      properties: {
        address: {
          anyOf: [{ type: "object", properties: {} }, { type: "null" }],
        },
      },
    }

    const next = await applyTemplateToTableSchemaProperty(
      schema,
      "address",
      "Address"
    )

    expect(next.properties?.address).toEqual({
      anyOf: [{ $ref: "#/$defs/Address" }, { type: "null" }],
    })
  })

  it("applies object template dependencies without leaking template metadata", async () => {
    const schema: ExtendedJSONSchema7 = {
      type: "object",
      properties: {
        company: { type: "object", properties: {} },
      },
    }

    const next = await applyTemplateToTableSchemaProperty(
      schema,
      "company",
      "Company"
    )
    const defs = next.$defs as Record<
      string,
      ExtendedJSONSchema7 & Record<string, unknown>
    >

    expect(defs.Address).toBeTruthy()
    expect(defs.Company).toBeTruthy()
    expect(defs.Company.deps).toBeUndefined()
    expect(next.properties?.company).toEqual({ $ref: "#/$defs/Company" })
  })
})
