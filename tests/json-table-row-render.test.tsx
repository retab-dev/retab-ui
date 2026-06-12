// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileFormRow } from "@/components/json-table/single-file-form-row"

import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    shipped_at: { type: "string", format: "date" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
    },
    metadata: {
      type: "object",
      properties: {
        source: { type: "string" },
      },
    },
    nullable_note: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    status: {
      enum: ["__null__", "approved"],
    },
  },
}

const document: TableDocument = {
  id: "doc_1",
  data: {
    vendor: "ACME",
    shipped_at: "2024-01-02",
    lines: [{ name: "one" }, { name: "two" }],
    metadata: { source: "upload" },
    nullable_note: null,
    status: "__null__",
  },
}

function visibleColumn(key: string): VisibleColumn {
  return {
    key,
    widthPx: 160,
    fieldMetadata: getFieldMetadata(schema, key),
  }
}

describe("json table row rendering", () => {
  it("formats read-only scalar, date, array, object, null, and invalid cells", () => {
    const visiblePaths = [
      "vendor",
      "shipped_at",
      "lines",
      "metadata",
      "nullable_note",
      "status",
      "missing",
    ]
    const rows = projectDocumentRows({
      document,
      visiblePaths,
      includeArrayAddRows: false,
    })

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRow
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            openEditorPath={null}
            setOpenEditorPath={vi.fn()}
            onDocumentDataChange={vi.fn()}
            isJsonEditable={false}
          />
        </tbody>
      </table>
    )

    expect(view.getByText("ACME")).toBeTruthy()
    expect(view.getByText("Jan 2, 2024")).toBeTruthy()
    expect(view.getByText("[2 items]")).toBeTruthy()
    expect(view.getByText(JSON.stringify({ source: "upload" }))).toBeTruthy()

    const cells = Array.from(view.container.querySelectorAll("td"))
    expect(cells).toHaveLength(7)
    expect(
      view.container.querySelectorAll('[data-slot="data-cell"]')
    ).toHaveLength(5)
    expect(view.getAllByRole("button")).toHaveLength(2)
    expect(cells[4].textContent).toBe(String.fromCharCode(8212))
    expect(cells[5].textContent).toBe("__null__")
    expect(cells[6].textContent).toBe("")
    expect(cells[6].getAttribute("data-field-path")).toBe("missing")
  })

  it("keeps read-only cells aligned when an earlier array is empty", () => {
    const visiblePaths = ["empty_lines.*.name", "lines.*.name", "vendor"]
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          empty_lines: [],
          lines: [{ name: "one" }],
          vendor: "ACME",
        },
      },
      visiblePaths,
      includeArrayAddRows: false,
    })

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRow
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            openEditorPath={null}
            setOpenEditorPath={vi.fn()}
            onDocumentDataChange={vi.fn()}
            isJsonEditable={false}
          />
        </tbody>
      </table>
    )

    const cells = Array.from(view.container.querySelectorAll("td"))
    expect(cells).toHaveLength(3)
    expect(cells[0].textContent).toBe("")
    expect(cells[1].getAttribute("data-field-path")).toBe("lines.0.name")
    expect(cells[1].textContent).toContain("one")
    expect(cells[2].getAttribute("data-field-path")).toBe("vendor")
    expect(cells[2].textContent).toContain("ACME")
  })
})
