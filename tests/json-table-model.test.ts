import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  materializeFieldPath,
  setValueAtMaterializedPath,
} from "@/components/json-table/lib/document-patches"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import {
  buildHeaderNodesFromSchema,
  getFieldMetadata,
  getSchemaPropertyType,
} from "@/components/json-table/lib/schema-inspection"
import {
  deleteSchemaProperty,
  reorderSchemaProperty,
} from "@/components/json-table/lib/schema-mutations"
import { formatValueForCommit } from "@/components/json-table/lib/value-formatting"

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
    expect(getSchemaPropertyType(schema, "lines.*.name").type).toBe("string")
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

    const deleted = deleteSchemaProperty({ schema: reordered, path: "lines" })
    expect(Object.keys(deleted.properties ?? {})).toEqual([
      "total",
      "vendor",
      "maybe_note",
    ])
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
    expect(rows[0].cells[1]?.materializedPath).toBe("lines.0.name")
    expect(rows[1].cells[1]?.materializedPath).toBe("lines.1.name")
    expect(rows[2].cells[1]?.materializedPath).toBe("lines.2.name")
    expect(materializeFieldPath("lines.*.name", [4])).toBe("lines.4.name")
  })

  it("applies immutable object and array writes", () => {
    const input = { lines: [{ name: "old" }] }
    const output = setValueAtMaterializedPath(input, "lines.0.name", "new")
    expect(output).toEqual({ lines: [{ name: "new" }] })
    expect(input).toEqual({ lines: [{ name: "old" }] })
  })
})

describe("json table value formatting", () => {
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
})
