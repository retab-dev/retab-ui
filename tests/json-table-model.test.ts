import type { JSONSchema7 } from "json-schema"
import { describe, expect, it, vi } from "vitest"

import { setValueAtMaterializedPath } from "@/components/json-table/lib/document-patches"
import { materializeFieldPath } from "@/components/json-table/lib/document-paths"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import { flattenHeaderNodes } from "@/components/json-table/lib/header-nodes"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { getSchemaFlatProperties } from "@/components/json-table/lib/schema-flat-properties"
import { buildHeaderNodesFromSchema } from "@/components/json-table/lib/schema-header-nodes"
import {
  deleteSchemaProperty,
  reorderSchemaProperty,
} from "@/components/json-table/lib/schema-mutations"
import { getSchemaPropertyType } from "@/components/json-table/lib/schema-paths"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"

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
      getSchemaPropertyType(recursiveSchema, "legacy_lines.*.legacy_name").type
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
