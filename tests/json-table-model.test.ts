import type { JSONSchema7 } from "json-schema"
import { describe, expect, it, vi } from "vitest"

import {
  buildDocumentDataPatch,
  setValueAtMaterializedPath,
} from "@/components/json-table/lib/document-patches"
import {
  getValueAtPath,
  materializeFieldPath,
} from "@/components/json-table/lib/document-paths"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import {
  buildHeaderGridRows,
  flattenHeaderNodes,
} from "@/components/json-table/lib/header-nodes"
import { hasDateTimeInSchema } from "@/components/json-table/lib/schema-date-detection"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { getSchemaFlatProperties } from "@/components/json-table/lib/schema-flat-properties"
import { buildHeaderNodesFromSchema } from "@/components/json-table/lib/schema-header-nodes"
import {
  deleteSchemaProperty,
  reorderSchemaProperty,
} from "@/components/json-table/lib/schema-mutations"
import { getSchemaPropertyType } from "@/components/json-table/lib/schema-paths"
import {
  resolveSchema,
  unwrapSchema,
} from "@/components/json-table/lib/schema-references"
import {
  autoFormatDateTimeFields,
  formatValueForCommit,
} from "@/components/json-table/lib/value-normalization"

const schema: JSONSchema7 = {
  type: "object",
  $defs: {
    Line: {
      type: "object",
      properties: {
        name: { type: "string" },
        shipped_at: { type: "string", format: "date" },
      },
    },
  },
  properties: {
    vendor: { type: "string" },
    total: { type: "number" },
    lines: {
      type: "array",
      items: { $ref: "#/$defs/Line" },
    },
    maybe_note: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
}

describe("json table schema inspection", () => {
  it("resolves refs, nullable unions, and header paths", () => {
    expect(getSchemaPropertyType(schema, "lines.*.name")?.type).toBe("string")
    expect(getFieldMetadata(schema, "maybe_note")?.isNullable).toBe(true)

    const [nodes] = buildHeaderNodesFromSchema(schema, [])
    expect(nodes.map((node) => node.key)).toEqual([
      "vendor",
      "total",
      "lines",
      "maybe_note",
    ])
    expect(nodes.find((node) => node.key === "lines")?.children?.[0].key).toBe(
      "lines.*.name"
    )
  })

  it("treats nullable type arrays inside union branches as nullable fields", () => {
    const nestedNullableSchema: JSONSchema7 = {
      type: "object",
      properties: {
        note: {
          anyOf: [{ type: ["string", "null"] }],
        },
      },
    }

    const metadata = getFieldMetadata(nestedNullableSchema, "note")
    expect(metadata?.kind).toBe("string")
    expect(metadata?.isNullable).toBe(true)
    expect(metadata?.schema.type).toBe("string")
  })

  it("returns no metadata for invalid object and array paths", () => {
    expect(getSchemaPropertyType(schema, "missing")).toBeUndefined()
    expect(getSchemaPropertyType(schema, "constructor")).toBeUndefined()
    expect(getSchemaPropertyType(schema, "lines.name")).toBeUndefined()
    expect(getSchemaPropertyType(schema, "lines.*.missing")).toBeUndefined()
    expect(getFieldMetadata(schema, "missing")).toBeUndefined()
    expect(getFieldMetadata(schema, "constructor")).toBeUndefined()
    expect(getFieldMetadata(schema, "lines.not_an_index")).toBeUndefined()
    expect(getFieldMetadata(schema, "lines.0abc.name")).toBeUndefined()
  })

  it("resolves tuple array item schemas by index", () => {
    const tupleSchema: JSONSchema7 = {
      type: "object",
      properties: {
        tuple: {
          type: "array",
          items: [{ type: "string" }, { type: "integer" }],
          additionalItems: { type: "boolean" },
        },
      },
    }

    expect(getSchemaPropertyType(tupleSchema, "tuple.0")?.type).toBe("string")
    expect(getSchemaPropertyType(tupleSchema, "tuple.1")?.type).toBe("integer")
    expect(getSchemaPropertyType(tupleSchema, "tuple.2")?.type).toBe("boolean")
    expect(getSchemaPropertyType(tupleSchema, "tuple.1abc")).toBeUndefined()
  })

  it("does not resolve tuple overflow paths when additionalItems is false", () => {
    const tupleSchema: JSONSchema7 = {
      type: "object",
      properties: {
        tuple: {
          type: "array",
          items: [{ type: "string" }],
          additionalItems: false,
        },
      },
    }

    expect(getSchemaPropertyType(tupleSchema, "tuple.0")?.type).toBe("string")
    expect(getSchemaPropertyType(tupleSchema, "tuple.1")).toBeUndefined()
  })

  it("treats time string formats as time fields", () => {
    const timeSchema: JSONSchema7 = {
      type: "object",
      properties: {
        starts_at: { type: "string", format: "time" },
      },
    }

    expect(getFieldMetadata(timeSchema, "starts_at")?.kind).toBe("time")
  })

  it("infers object and array traversal from properties and items", () => {
    const implicitSchema: JSONSchema7 = {
      type: "object",
      properties: {
        vendor: {
          properties: {
            name: { type: "string" },
          },
        },
        lines: {
          items: {
            properties: {
              sku: { type: "string" },
            },
          },
        },
      },
    }

    expect(getSchemaPropertyType(implicitSchema, "vendor.name")?.type).toBe(
      "string"
    )
    expect(getSchemaPropertyType(implicitSchema, "lines.*.sku")?.type).toBe(
      "string"
    )
    expect(getFieldMetadata(implicitSchema, "vendor")?.kind).toBe("object")
    expect(getFieldMetadata(implicitSchema, "lines")?.kind).toBe("array")

    const [nodes] = buildHeaderNodesFromSchema(implicitSchema, [])
    expect(nodes.map((node) => node.effectiveType)).toEqual(["object", "array"])
    expect(flattenHeaderNodes(nodes).map((node) => node.key)).toEqual([
      "vendor.name",
      "lines.*.sku",
    ])
  })

  it("treats boolean schema definitions as leaf fields", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const booleanDefinitionSchema: JSONSchema7 = {
      type: "object",
      properties: {
        anything: true,
        nothing: false,
      },
    }

    expect(
      getSchemaFlatProperties(
        booleanDefinitionSchema,
        [],
        booleanDefinitionSchema
      ).map((property) => property.key)
    ).toEqual(["anything", "nothing"])

    const [nodes] = buildHeaderNodesFromSchema(booleanDefinitionSchema, [])
    expect(flattenHeaderNodes(nodes).map((node) => node.key)).toEqual([
      "anything",
      "nothing",
    ])
    expect(getFieldMetadata(booleanDefinitionSchema, "anything")?.kind).toBe(
      "unknown"
    )
    expect(getFieldMetadata(booleanDefinitionSchema, "nothing")?.kind).toBe(
      "unknown"
    )
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("treats enum values containing null as nullable fields", () => {
    const enumNullSchema: JSONSchema7 = {
      type: "object",
      properties: {
        status: { enum: ["approved", null] },
        nested_status: {
          anyOf: [{ enum: ["approved", null] }],
        },
      },
    }

    const metadata = getFieldMetadata(enumNullSchema, "status")
    expect(metadata?.kind).toBe("enum")
    expect(metadata?.isNullable).toBe(true)
    expect(metadata?.enumValues).toEqual(["approved", null])

    const nestedMetadata = getFieldMetadata(enumNullSchema, "nested_status")
    expect(nestedMetadata?.kind).toBe("enum")
    expect(nestedMetadata?.isNullable).toBe(true)
    expect(nestedMetadata?.enumValues).toEqual(["approved", null])
  })

  it("resolves escaped JSON Pointer tokens in internal refs", () => {
    const escapedRefSchema: JSONSchema7 = {
      type: "object",
      $defs: {
        "Line/Item": {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
        "Tilde~Name": {
          type: "object",
          properties: {
            code: { type: "integer" },
          },
        },
      },
      properties: {
        line: { $ref: "#/$defs/Line~1Item" },
        tilde: { $ref: "#/$defs/Tilde~0Name" },
      },
    }

    expect(
      Object.keys(
        resolveSchema({ $ref: "#/$defs/Line~1Item" }, escapedRefSchema)
          .properties ?? {}
      )
    ).toEqual(["name"])
    expect(getSchemaPropertyType(escapedRefSchema, "line.name")?.type).toBe(
      "string"
    )
    expect(getSchemaPropertyType(escapedRefSchema, "tilde.code")?.type).toBe(
      "integer"
    )
  })

  it("fails closed on circular ref chains", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const circularRefSchema: JSONSchema7 = {
      type: "object",
      $defs: {
        A: { $ref: "#/$defs/B" },
        B: { $ref: "#/$defs/A" },
      },
      properties: {
        value: { $ref: "#/$defs/A" },
      },
    }

    expect(resolveSchema({ $ref: "#/$defs/A" }, circularRefSchema)).toEqual({
      type: "object",
    })
    expect(getSchemaPropertyType(circularRefSchema, "value.missing")).toEqual(
      undefined
    )
    expect(warnSpy).toHaveBeenCalledWith(
      '[resolveSchema] Circular $ref detected while resolving "#/$defs/A"'
    )

    warnSpy.mockRestore()
  })

  it("merges object allOf branches for schema inspection", () => {
    const allOfSchema: JSONSchema7 = {
      type: "object",
      properties: {
        vendor: {
          allOf: [
            {
              type: "object",
              properties: {
                name: { type: "string" },
              },
              required: ["name"],
            },
            {
              type: "object",
              properties: {
                rating: { type: "number" },
              },
              required: ["rating"],
            },
          ],
        },
      },
    }

    const { schema: mergedVendor } = unwrapSchema(
      allOfSchema.properties?.vendor,
      allOfSchema
    )
    expect(Object.keys(mergedVendor.properties ?? {})).toEqual([
      "name",
      "rating",
    ])
    expect(mergedVendor.required).toEqual(["name", "rating"])
    expect(getSchemaPropertyType(allOfSchema, "vendor.rating")?.type).toBe(
      "number"
    )

    const [nodes] = buildHeaderNodesFromSchema(allOfSchema, [])
    expect(flattenHeaderNodes(nodes).map((node) => node.key)).toEqual([
      "vendor.name",
      "vendor.rating",
    ])
  })

  it("builds headers for root schemas composed with allOf", () => {
    const rootAllOfSchema: JSONSchema7 = {
      allOf: [
        {
          type: "object",
          properties: {
            vendor: { type: "string" },
          },
          required: ["vendor"],
        },
        {
          type: "object",
          properties: {
            total: { type: "number" },
          },
        },
      ],
    }

    expect(
      getSchemaFlatProperties(rootAllOfSchema, [], rootAllOfSchema).map(
        (property) => property.key
      )
    ).toEqual(["vendor", "total"])

    const [nodes] = buildHeaderNodesFromSchema(rootAllOfSchema, [])
    expect(nodes.map((node) => node.key)).toEqual(["vendor", "total"])
  })

  it("resolves legacy definitions and stops recursive reference cycles", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const recursiveSchema: JSONSchema7 = {
      type: "object",
      definitions: {
        LegacyLine: {
          type: "object",
          properties: {
            legacy_name: { type: "string" },
          },
        },
      },
      $defs: {
        Node: {
          type: "object",
          properties: {
            label: { type: "string" },
            child: { $ref: "#/$defs/Node" },
          },
        },
      },
      properties: {
        legacy_lines: {
          type: "array",
          items: { $ref: "#/definitions/LegacyLine" },
        },
        tree: { $ref: "#/$defs/Node" },
      },
    }

    expect(
      getSchemaPropertyType(recursiveSchema, "legacy_lines.*.legacy_name")?.type
    ).toBe("string")

    const flatKeys = getSchemaFlatProperties(
      recursiveSchema,
      [],
      recursiveSchema
    ).map((property) => property.key)
    expect(flatKeys).toContain("legacy_lines.*.legacy_name")
    expect(flatKeys).toContain("tree.child")
    warnSpy.mockRestore()
  })

  it("changes visible leaf paths when nested headers fold", () => {
    const [expandedNodes] = buildHeaderNodesFromSchema(schema, [])
    const [collapsedNodes] = buildHeaderNodesFromSchema(schema, ["lines"])

    expect(flattenHeaderNodes(expandedNodes).map((node) => node.key)).toEqual([
      "vendor",
      "total",
      "lines.*.name",
      "lines.*.shipped_at",
      "maybe_note",
    ])
    expect(flattenHeaderNodes(collapsedNodes).map((node) => node.key)).toEqual([
      "vendor",
      "total",
      "lines",
      "maybe_note",
    ])
  })

  it("does not fold sibling paths that only share a prefix", () => {
    const siblingPrefixSchema: JSONSchema7 = {
      type: "object",
      properties: {
        line: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
        line_item: {
          type: "object",
          properties: {
            sku: { type: "string" },
          },
        },
      },
    }

    const [nodes] = buildHeaderNodesFromSchema(siblingPrefixSchema, ["line"])

    expect(flattenHeaderNodes(nodes).map((node) => node.key)).toEqual([
      "line",
      "line_item.sku",
    ])
  })

  it("builds value placeholder leaves for primitive arrays", () => {
    const primitiveArraySchema: JSONSchema7 = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    }

    const [nodes] = buildHeaderNodesFromSchema(primitiveArraySchema, [])
    expect(nodes[0].key).toBe("tags")
    expect(nodes[0].isArray).toBe(true)
    expect(nodes[0].children?.[0]).toMatchObject({
      key: "tags.*",
      label: "Value",
      isArrayValuePlaceholder: true,
      effectiveType: "string",
    })
    expect(flattenHeaderNodes(nodes).map((node) => node.key)).toEqual([
      "tags.*",
    ])
    expect(getFieldMetadata(primitiveArraySchema, "tags.*")?.kind).toBe(
      "string"
    )
  })

  it("folds object and array headers to parent value columns", () => {
    const collapsibleSchema: JSONSchema7 = {
      type: "object",
      properties: {
        vendor: {
          type: "object",
          properties: {
            name: { type: "string" },
            rating: { type: "number" },
          },
        },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: { type: "string" },
              quantity: { type: "integer" },
            },
          },
        },
      },
    }

    const [nodes] = buildHeaderNodesFromSchema(collapsibleSchema, [
      "vendor",
      "lines",
    ])

    expect(flattenHeaderNodes(nodes).map((node) => node.key)).toEqual([
      "vendor",
      "lines",
    ])
    expect(getFieldMetadata(collapsibleSchema, "vendor")?.kind).toBe("object")
    expect(getFieldMetadata(collapsibleSchema, "lines")?.kind).toBe("array")
  })

  it("builds aligned header grid rows with continuation cells", () => {
    const gridSchema: JSONSchema7 = {
      type: "object",
      properties: {
        vendor: { type: "string" },
        address: {
          type: "object",
          properties: {
            city: { type: "string" },
            postal_code: { type: "string" },
          },
        },
      },
    }
    const [nodes] = buildHeaderNodesFromSchema(gridSchema, [])
    const rows = buildHeaderGridRows(nodes)

    expect(rows).toHaveLength(2)
    expect(rows[0].map((cell) => cell.node.key)).toEqual(["vendor", "address"])
    expect(rows[0].map((cell) => cell.leafCount)).toEqual([1, 2])
    expect(rows[1].map((cell) => cell.node.key)).toEqual([
      "vendor",
      "address.city",
      "address.postal_code",
    ])
    expect(rows[1][0].isContinuation).toBe(true)
  })
})

describe("json table schema mutations", () => {
  it("reorders and deletes properties without mutating the input schema", () => {
    const reordered = reorderSchemaProperty({
      schema,
      parentPath: "",
      sourcePropName: "total",
      targetPropName: "vendor",
    })
    expect(Object.keys(reordered.properties ?? {})).toEqual([
      "total",
      "vendor",
      "lines",
      "maybe_note",
    ])
    expect(Object.keys(schema.properties ?? {})).toEqual([
      "vendor",
      "total",
      "lines",
      "maybe_note",
    ])

    const deleted = deleteSchemaProperty({
      schema: reordered,
      schemaPropertyPath: "lines",
    })
    expect(Object.keys(deleted.properties ?? {})).toEqual([
      "total",
      "vendor",
      "maybe_note",
    ])
  })

  it("mutates nested properties through escaped internal refs", () => {
    const escapedRefSchema: JSONSchema7 = {
      type: "object",
      $defs: {
        "Line/Item": {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "integer" },
            price: { type: "number" },
          },
          required: ["name", "quantity"],
        },
      },
      properties: {
        line: { $ref: "#/$defs/Line~1Item" },
      },
    }

    const reordered = reorderSchemaProperty({
      schema: escapedRefSchema,
      parentPath: "line",
      sourcePropName: "price",
      targetPropName: "name",
    })
    expect(
      Object.keys(
        (reordered.$defs?.["Line/Item"] as JSONSchema7).properties ?? {}
      )
    ).toEqual(["price", "name", "quantity"])

    const deleted = deleteSchemaProperty({
      schema: reordered,
      schemaPropertyPath: "line.quantity",
    })
    const lineDef = deleted.$defs?.["Line/Item"] as JSONSchema7
    expect(Object.keys(lineDef.properties ?? {})).toEqual(["price", "name"])
    expect(lineDef.required).toEqual(["name"])
  })

  it("mutates nested properties inside nullable object branches", () => {
    const nullableSchema: JSONSchema7 = {
      type: "object",
      properties: {
        vendor: {
          anyOf: [
            {
              type: "object",
              properties: {
                name: { type: "string" },
                rating: { type: "number" },
                note: { type: "string" },
              },
              required: ["name", "rating"],
            },
            { type: "null" },
          ],
        },
      },
    }

    const reordered = reorderSchemaProperty({
      schema: nullableSchema,
      parentPath: "vendor",
      sourcePropName: "note",
      targetPropName: "name",
    })
    const reorderedVendor = (reordered.properties?.vendor as JSONSchema7)
      .anyOf?.[0] as JSONSchema7
    expect(Object.keys(reorderedVendor.properties ?? {})).toEqual([
      "note",
      "name",
      "rating",
    ])

    const deleted = deleteSchemaProperty({
      schema: reordered,
      schemaPropertyPath: "vendor.rating",
    })
    const deletedVendor = (deleted.properties?.vendor as JSONSchema7)
      .anyOf?.[0] as JSONSchema7
    expect(Object.keys(deletedVendor.properties ?? {})).toEqual([
      "note",
      "name",
    ])
    expect(deletedVendor.required).toEqual(["name"])
  })

  it("mutates matching object branches inside anyOf unions", () => {
    const unionSchema: JSONSchema7 = {
      type: "object",
      properties: {
        payment: {
          anyOf: [
            {
              type: "object",
              properties: {
                card_last4: { type: "string" },
              },
            },
            {
              type: "object",
              properties: {
                bank_name: { type: "string" },
                account_last4: { type: "string" },
              },
              required: ["bank_name", "account_last4"],
            },
          ],
        },
      },
    }

    const reordered = reorderSchemaProperty({
      schema: unionSchema,
      parentPath: "payment",
      sourcePropName: "account_last4",
      targetPropName: "bank_name",
    })
    const reorderedBranch = (reordered.properties?.payment as JSONSchema7)
      .anyOf?.[1] as JSONSchema7
    expect(Object.keys(reorderedBranch.properties ?? {})).toEqual([
      "account_last4",
      "bank_name",
    ])

    const deleted = deleteSchemaProperty({
      schema: reordered,
      schemaPropertyPath: "payment.bank_name",
    })
    const deletedBranch = (deleted.properties?.payment as JSONSchema7)
      .anyOf?.[1] as JSONSchema7
    expect(Object.keys(deletedBranch.properties ?? {})).toEqual([
      "account_last4",
    ])
    expect(deletedBranch.required).toEqual(["account_last4"])
  })

  it("mutates nested properties inside allOf object branches", () => {
    const allOfSchema: JSONSchema7 = {
      type: "object",
      properties: {
        vendor: {
          allOf: [
            {
              type: "object",
              properties: {
                name: { type: "string" },
                note: { type: "string" },
              },
              required: ["name"],
            },
            {
              type: "object",
              properties: {
                rating: { type: "number" },
                tier: { type: "string" },
              },
              required: ["rating"],
            },
          ],
        },
      },
    }

    const reordered = reorderSchemaProperty({
      schema: allOfSchema,
      parentPath: "vendor",
      sourcePropName: "tier",
      targetPropName: "rating",
    })
    const reorderedBranch = (reordered.properties?.vendor as JSONSchema7)
      .allOf?.[1] as JSONSchema7
    expect(Object.keys(reorderedBranch.properties ?? {})).toEqual([
      "tier",
      "rating",
    ])

    const deleted = deleteSchemaProperty({
      schema: reordered,
      schemaPropertyPath: "vendor.rating",
    })
    const deletedBranch = (deleted.properties?.vendor as JSONSchema7)
      .allOf?.[1] as JSONSchema7
    expect(Object.keys(deletedBranch.properties ?? {})).toEqual(["tier"])
    expect(deletedBranch.required).toBeUndefined()
  })

  it("mutates root allOf object branches", () => {
    const rootAllOfSchema: JSONSchema7 = {
      allOf: [
        {
          type: "object",
          properties: {
            vendor: { type: "string" },
            invoice_id: { type: "string" },
          },
          required: ["vendor", "invoice_id"],
        },
        {
          type: "object",
          properties: {
            total: { type: "number" },
          },
        },
      ],
    }

    const reordered = reorderSchemaProperty({
      schema: rootAllOfSchema,
      parentPath: "",
      sourcePropName: "invoice_id",
      targetPropName: "vendor",
    })
    const reorderedBranch = reordered.allOf?.[0] as JSONSchema7
    expect(Object.keys(reorderedBranch.properties ?? {})).toEqual([
      "invoice_id",
      "vendor",
    ])

    const deleted = deleteSchemaProperty({
      schema: reordered,
      schemaPropertyPath: "vendor",
    })
    const deletedBranch = deleted.allOf?.[0] as JSONSchema7
    expect(Object.keys(deletedBranch.properties ?? {})).toEqual(["invoice_id"])
    expect(deletedBranch.required).toEqual(["invoice_id"])
  })

  it("mutates nested properties inside tuple array item objects", () => {
    const tupleSchema: JSONSchema7 = {
      type: "object",
      properties: {
        tuple: {
          type: "array",
          items: [
            {
              type: "object",
              properties: {
                name: { type: "string" },
                note: { type: "string" },
              },
              required: ["name", "note"],
            },
            {
              type: "object",
              properties: {
                amount: { type: "number" },
              },
            },
          ],
        },
      },
    }

    const deleted = deleteSchemaProperty({
      schema: tupleSchema,
      schemaPropertyPath: "tuple.0.note",
    })
    const tupleItems = (deleted.properties?.tuple as JSONSchema7)
      .items as JSONSchema7[]
    const firstItem = tupleItems[0]

    expect(Object.keys(firstItem.properties ?? {})).toEqual(["name"])
    expect(firstItem.required).toEqual(["name"])
  })

  it("mutates tuple array additionalItems object schemas", () => {
    const tupleSchema: JSONSchema7 = {
      type: "object",
      properties: {
        tuple: {
          type: "array",
          items: [{ type: "string" }],
          additionalItems: {
            type: "object",
            properties: {
              name: { type: "string" },
              note: { type: "string" },
            },
            required: ["name", "note"],
          },
        },
      },
    }

    const deleted = deleteSchemaProperty({
      schema: tupleSchema,
      schemaPropertyPath: "tuple.2.note",
    })
    const tuple = deleted.properties?.tuple as JSONSchema7
    const additionalItems = tuple.additionalItems as JSONSchema7

    expect(Object.keys(additionalItems.properties ?? {})).toEqual(["name"])
    expect(additionalItems.required).toEqual(["name"])
  })

  it("mutates nested properties inside implicit object schemas", () => {
    const implicitObjectSchema: JSONSchema7 = {
      type: "object",
      properties: {
        vendor: {
          properties: {
            name: { type: "string" },
            note: { type: "string" },
          },
          required: ["name", "note"],
        },
      },
    }

    const deleted = deleteSchemaProperty({
      schema: implicitObjectSchema,
      schemaPropertyPath: "vendor.note",
    })
    const vendor = deleted.properties?.vendor as JSONSchema7

    expect(Object.keys(vendor.properties ?? {})).toEqual(["name"])
    expect(vendor.required).toEqual(["name"])
  })
})

describe("json table document projection and patches", () => {
  it("projects wildcard array rows and materializes edits", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          vendor: "ACME",
          lines: [
            { name: "one", shipped_at: "1/2/2024" },
            { name: "two", shipped_at: "2/3/2024" },
          ],
        },
      },
      visiblePaths: ["vendor", "lines.*.name", "lines.*.shipped_at"],
    })

    expect(rows).toHaveLength(3)
    expect(rows[0].cells[1]?.materializedFieldPath).toBe("lines.0.name")
    expect(rows[1].cells[1]?.materializedFieldPath).toBe("lines.1.name")
    expect(rows[2].cells[1]?.materializedFieldPath).toBe("lines.2.name")
    expect(materializeFieldPath("lines.*.name", [4])).toBe("lines.4.name")
  })

  it("projects nested arrays without synthetic add rows in read-only mode", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          matrix: [[1, 2], [3]],
        },
      },
      visiblePaths: ["matrix.*.*"],
      includeArrayAddRows: false,
    })

    expect(rows.map((row) => row.cells[0]?.materializedFieldPath)).toEqual([
      "matrix.0.0",
      "matrix.0.1",
      "matrix.1.0",
    ])
  })

  it("reserves read-only columns for empty arrays before later siblings", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          empty_lines: [],
          charges: [{ amount: 5 }],
          vendor: "ACME",
        },
      },
      visiblePaths: ["empty_lines.*.name", "charges.*.amount", "vendor"],
      includeArrayAddRows: false,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].cells[0]).toBeUndefined()
    expect(rows[0].cells[1]?.materializedFieldPath).toBe("charges.0.amount")
    expect(rows[0].cells[1]?.value).toBe(5)
    expect(rows[0].cells[2]?.materializedFieldPath).toBe("vendor")
    expect(rows[0].cells[2]?.value).toBe("ACME")
  })

  it("reserves read-only columns when array-shaped data is invalid", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          lines: null,
          charges: [{ amount: 5 }],
        },
      },
      visiblePaths: ["lines.*.sku", "lines.*.quantity", "charges.*.amount"],
      includeArrayAddRows: false,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].cells[0]).toBeUndefined()
    expect(rows[0].cells[1]).toBeUndefined()
    expect(rows[0].cells[2]?.materializedFieldPath).toBe("charges.0.amount")
    expect(rows[0].cells[2]?.value).toBe(5)
  })

  it("reserves every nested read-only column for empty nested arrays", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          sections: [
            {
              title: "First",
              lines: [],
              charges: [{ amount: 12 }],
            },
          ],
        },
      },
      visiblePaths: [
        "sections.*.title",
        "sections.*.lines.*.sku",
        "sections.*.lines.*.quantity",
        "sections.*.charges.*.amount",
      ],
      includeArrayAddRows: false,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].cells[0]?.materializedFieldPath).toBe("sections.0.title")
    expect(rows[0].cells[1]).toBeUndefined()
    expect(rows[0].cells[2]).toBeUndefined()
    expect(rows[0].cells[3]?.materializedFieldPath).toBe(
      "sections.0.charges.0.amount"
    )
    expect(rows[0].cells[3]?.value).toBe(12)
  })

  it("projects primitive arrays and their editable add row", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          tags: ["paid", "urgent"],
          vendor: "ACME",
        },
      },
      visiblePaths: ["tags.*", "vendor"],
    })

    expect(rows.map((row) => row.cells[0]?.materializedFieldPath)).toEqual([
      "tags.0",
      "tags.1",
      "tags.2",
    ])
    expect(rows.map((row) => row.cells[0]?.value)).toEqual([
      "paid",
      "urgent",
      undefined,
    ])
    expect(rows.map((row) => row.cells[0]?.addArrayItemAtIndex)).toEqual([
      undefined,
      undefined,
      0,
    ])
    expect(rows[0].cells[1]?.materializedFieldPath).toBe("vendor")
    expect(rows[0].cells[1]?.value).toBe("ACME")
    expect(rows[1].cells[1]).toBeUndefined()
    expect(rows[2].cells[1]).toBeUndefined()
  })

  it("projects folded object and array columns as their parent values", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          vendor: { name: "ACME", rating: 4 },
          lines: [{ sku: "A-1" }, { sku: "B-2" }],
        },
      },
      visiblePaths: ["vendor", "lines"],
      includeArrayAddRows: false,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].cells[0]?.materializedFieldPath).toBe("vendor")
    expect(rows[0].cells[0]?.value).toEqual({ name: "ACME", rating: 4 })
    expect(rows[0].cells[1]?.materializedFieldPath).toBe("lines")
    expect(rows[0].cells[1]?.value).toEqual([{ sku: "A-1" }, { sku: "B-2" }])
  })

  it("aligns independent arrays by visible row index and keeps add rows sparse", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          vendor: "ACME",
          lines: [{ name: "one" }, { name: "two" }],
          charges: [{ amount: 5 }],
        },
      },
      visiblePaths: ["vendor", "lines.*.name", "charges.*.amount"],
    })

    expect(rows).toHaveLength(3)
    expect(rows[0].cells[0]?.value).toBe("ACME")
    expect(rows[0].cells[1]?.materializedFieldPath).toBe("lines.0.name")
    expect(rows[0].cells[2]?.materializedFieldPath).toBe("charges.0.amount")
    expect(rows[1].cells[0]).toBeUndefined()
    expect(rows[1].cells[1]?.materializedFieldPath).toBe("lines.1.name")
    expect(rows[1].cells[2]?.materializedFieldPath).toBe("charges.1.amount")
    expect(rows[2].cells[1]?.materializedFieldPath).toBe("lines.2.name")
    expect(rows[2].cells[2]).toBeUndefined()
  })

  it("does not project inherited prototype properties as document values", () => {
    const inheritedData = Object.create({ vendor: "polluted" }) as Record<
      string,
      unknown
    >
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: inheritedData,
      },
      visiblePaths: ["vendor"],
      includeArrayAddRows: false,
    })

    expect(rows[0].cells[0]?.value).toBeUndefined()
  })

  it("materializes nested array add rows at each editable array depth", () => {
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          matrix: [[1, 2], []],
        },
      },
      visiblePaths: ["matrix.*.*"],
    })

    expect(rows.map((row) => row.cells[0]?.materializedFieldPath)).toEqual([
      "matrix.0.0",
      "matrix.0.1",
      "matrix.0.2",
      "matrix.1.0",
      "matrix.2.0",
    ])
    expect(rows.map((row) => row.cells[0]?.addArrayItemAtIndex)).toEqual([
      undefined,
      undefined,
      1,
      1,
      0,
    ])
  })

  it("applies immutable object and array writes", () => {
    const input = { lines: [{ name: "old" }] }
    const output = setValueAtMaterializedPath(input, "lines.0.name", "new")
    expect(output).toEqual({ lines: [{ name: "new" }] })
    expect(input).toEqual({ lines: [{ name: "old" }] })
  })

  it("supports sparse array writes and root replacement", () => {
    const sparse = setValueAtMaterializedPath(
      { lines: [{ name: "old" }] },
      "lines.2.name",
      "new"
    )

    expect((sparse.lines as unknown[]).length).toBe(3)
    expect((sparse.lines as unknown[])[1]).toBeUndefined()
    expect((sparse.lines as unknown[])[2]).toEqual({ name: "new" })
    expect(
      setValueAtMaterializedPath({ old: true }, "", { next: true })
    ).toEqual({ next: true })
  })

  it("supports functional writes, wildcard reads, and patch envelopes", () => {
    expect(
      setValueAtMaterializedPath(
        { total: 2 },
        "total",
        (previous: unknown) => Number(previous) + 3
      )
    ).toEqual({ total: 5 })

    const data = {
      lines: [{ name: undefined }, { name: "second" }],
    }
    expect(getValueAtPath(data, "lines.*.name")).toBe("second")
    expect(buildDocumentDataPatch(data, "lines.1.name", "updated")).toEqual({
      data: { lines: [{ name: undefined }, { name: "updated" }] },
    })
  })

  it("does not read inherited prototype properties from document paths", () => {
    expect(getValueAtPath({}, "constructor")).toBeUndefined()
    expect(getValueAtPath({}, "__proto__.toString")).toBeUndefined()
    expect(getValueAtPath({ safe: "value" }, "safe")).toBe("value")
  })

  it("rejects prototype-polluting document patch paths", () => {
    expect(() =>
      setValueAtMaterializedPath({}, "__proto__.polluted", true)
    ).toThrow("Unsafe document path segment")
    expect(() =>
      setValueAtMaterializedPath({}, "constructor.prototype.polluted", true)
    ).toThrow("Unsafe document path segment")
    expect(
      ({} as Record<string, unknown> & { polluted?: unknown }).polluted
    ).toBeUndefined()
  })

  it("treats non-integer array-looking path segments as object keys", () => {
    expect(setValueAtMaterializedPath({}, "items.1abc.name", "kept")).toEqual({
      items: {
        "1abc": {
          name: "kept",
        },
      },
    })
  })
})

describe("json table value formatting", () => {
  it("detects date-time fields inside implicit object and array schemas", () => {
    expect(
      hasDateTimeInSchema({
        properties: {
          shipped_at: { type: "string", format: "date" },
        },
      })
    ).toBe(true)

    expect(
      hasDateTimeInSchema({
        items: {
          properties: {
            shipped_at: { type: "string", format: "date" },
          },
        },
      })
    ).toBe(true)
  })

  it("detects date-time fields defined through internal refs", () => {
    const refDateSchema: JSONSchema7 = {
      type: "object",
      $defs: {
        DateField: { type: "string", format: "date" },
      },
      properties: {
        shipped_at: { $ref: "#/$defs/DateField" },
        lines: {
          type: "array",
          items: { $ref: "#/$defs/DateField" },
        },
      },
    }

    expect(hasDateTimeInSchema(refDateSchema)).toBe(true)
  })

  it("formats scalar and nested date values before commit", () => {
    expect(
      formatValueForCommit("1/2/2024", { type: "string", format: "date" })
    ).toBe("2024-01-02")

    expect(
      formatValueForCommit(
        { shipped_at: "1/2/2024" },
        {
          type: "object",
          properties: {
            shipped_at: { type: "string", format: "date" },
          },
        }
      )
    ).toEqual({ shipped_at: "2024-01-02" })
  })

  it("formats date values inside implicit object and array schemas", () => {
    expect(
      formatValueForCommit(
        { shipped_at: "1/2/2024" },
        {
          properties: {
            shipped_at: { type: "string", format: "date" },
          },
        }
      )
    ).toEqual({ shipped_at: "2024-01-02" })

    expect(
      formatValueForCommit(["1/2/2024"], {
        items: { type: "string", format: "date" },
      })
    ).toEqual(["2024-01-02"])
  })

  it("formats nullable date and time schemas before commit", () => {
    expect(
      formatValueForCommit("1/2/2024", {
        anyOf: [{ type: "string", format: "date" }, { type: "null" }],
      })
    ).toBe("2024-01-02")

    expect(
      formatValueForCommit("3:04 PM", { type: "string", format: "time" })
    ).toBe("15:04")

    expect(
      formatValueForCommit(
        { shipped_at: "1/2/2024" },
        {
          type: "object",
          properties: {
            shipped_at: {
              anyOf: [{ type: "string", format: "date" }, { type: "null" }],
            },
          },
        }
      )
    ).toEqual({ shipped_at: "2024-01-02" })
  })

  it("formats nested date fields defined through refs", () => {
    expect(
      formatValueForCommit(
        { shipped_at: "1/2/2024" },
        {
          type: "object",
          $defs: {
            DateField: { type: "string", format: "date" },
          },
          properties: {
            shipped_at: { $ref: "#/$defs/DateField" },
          },
        }
      )
    ).toEqual({ shipped_at: "2024-01-02" })

    expect(
      formatValueForCommit(["1/2/2024"], {
        type: "array",
        $defs: {
          DateField: { type: "string", format: "date" },
        },
        items: { $ref: "#/$defs/DateField" },
      })
    ).toEqual(["2024-01-02"])
  })

  it("formats nested date, datetime, and time fields inside arrays", () => {
    const lineSchema: JSONSchema7 = {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              shipped_at: { type: "string", format: "date" },
              started_at: { type: "string", format: "date-time" },
              clock: { type: "string", format: "time" },
              note: { type: "string" },
            },
          },
        },
      },
    }

    expect(
      autoFormatDateTimeFields(
        {
          lines: [
            {
              shipped_at: "1/2/2024",
              started_at: "2024-01-02T03:04:05Z",
              clock: "3:04 PM",
              note: "unchanged",
            },
          ],
        },
        lineSchema
      )
    ).toEqual({
      lines: [
        {
          shipped_at: "2024-01-02",
          started_at: "2024-01-02T03:04",
          clock: "15:04",
          note: "unchanged",
        },
      ],
    })
  })

  it("formats tuple array items using their index-specific schemas", () => {
    expect(
      formatValueForCommit(["1/2/2024", "3:04 PM", "unchanged"], {
        type: "array",
        items: [
          { type: "string", format: "date" },
          { type: "string", format: "time" },
          { type: "string" },
        ],
      })
    ).toEqual(["2024-01-02", "15:04", "unchanged"])

    expect(
      formatValueForCommit([{ shipped_at: "1/2/2024" }, { note: "plain" }], {
        type: "array",
        items: [
          {
            type: "object",
            properties: {
              shipped_at: { type: "string", format: "date" },
            },
          },
          {
            type: "object",
            properties: {
              note: { type: "string" },
            },
          },
        ],
      })
    ).toEqual([{ shipped_at: "2024-01-02" }, { note: "plain" }])
  })

  it("formats tuple array values using additionalItems schemas", () => {
    expect(
      formatValueForCommit(["plain", "1/2/2024"], {
        type: "array",
        items: [{ type: "string" }],
        additionalItems: { type: "string", format: "date" },
      })
    ).toEqual(["plain", "2024-01-02"])
  })
})
