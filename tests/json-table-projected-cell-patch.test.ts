import { describe, expect, it } from "vitest"

import type { ProjectedCell } from "@/components/json-table/lib/document-projection"
import {
  indexProjectedCells,
  projectedRowWithPendingPrimitivePatch,
} from "@/components/json-table/lib/projected-cell-patch"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"

function projectedCell({
  materializedFieldPath,
  value,
}: {
  materializedFieldPath: string
  value: unknown
}): ProjectedCell {
  return {
    key: materializedFieldPath,
    value,
    templateFieldPath: materializedFieldPath,
    materializedFieldPath,
    arrayIndexes: [],
  }
}

describe("projected primitive cell patching", () => {
  it("indexes projected cells by materialized field path", () => {
    const rows: ProjectedRow[] = [
      {
        rowIndex: 0,
        cells: [
          projectedCell({ materializedFieldPath: "vendor", value: "Acme" }),
          projectedCell({ materializedFieldPath: "total", value: 10 }),
        ],
      },
      {
        rowIndex: 1,
        cells: [
          projectedCell({
            materializedFieldPath: "lines.0.name",
            value: "Paper",
          }),
        ],
      },
    ]

    expect(indexProjectedCells(rows)).toEqual(
      new Map([
        ["vendor", { rowIndex: 0, cellIndex: 0 }],
        ["total", { rowIndex: 0, cellIndex: 1 }],
        ["lines.0.name", { rowIndex: 1, cellIndex: 0 }],
      ])
    )
  })

  it("replaces exactly the indexed scalar cell", () => {
    const vendorCell = projectedCell({
      materializedFieldPath: "vendor",
      value: "Acme",
    })
    const totalCell = projectedCell({
      materializedFieldPath: "total",
      value: 10,
    })
    const row: ProjectedRow = {
      rowIndex: 0,
      cells: [vendorCell, totalCell],
    }

    const patchedRow = projectedRowWithPendingPrimitivePatch({
      projectedRow: row,
      patch: {
        data: { vendor: "Retab", total: 10 },
        fieldPaths: new Set(["vendor"]),
      },
      indexEntries: [{ rowIndex: 0, cellIndex: 0 }],
    })

    expect(patchedRow).not.toBe(row)
    expect(patchedRow.cells).not.toBe(row.cells)
    expect(patchedRow.cells[0]).not.toBe(vendorCell)
    expect(patchedRow.cells[0]?.value).toBe("Retab")
    expect(patchedRow.cells[1]).toBe(totalCell)
  })

  it("does not inspect unrelated cells in the same row", () => {
    const vendorCell = projectedCell({
      materializedFieldPath: "vendor",
      value: "Acme",
    })
    const unrelatedCell = {} as ProjectedCell
    Object.defineProperty(unrelatedCell, "materializedFieldPath", {
      get() {
        throw new Error("unrelated cell was inspected")
      },
    })

    const row: ProjectedRow = {
      rowIndex: 0,
      cells: [vendorCell, unrelatedCell],
    }

    const patchedRow = projectedRowWithPendingPrimitivePatch({
      projectedRow: row,
      patch: {
        data: { vendor: "Retab" },
        fieldPaths: new Set(["vendor"]),
      },
      indexEntries: [{ rowIndex: 0, cellIndex: 0 }],
    })

    expect(patchedRow.cells[0]?.value).toBe("Retab")
    expect(patchedRow.cells[1]).toBe(unrelatedCell)
  })

  it("reuses the row when the indexed value is unchanged", () => {
    const row: ProjectedRow = {
      rowIndex: 0,
      cells: [projectedCell({ materializedFieldPath: "vendor", value: "Acme" })],
    }

    const patchedRow = projectedRowWithPendingPrimitivePatch({
      projectedRow: row,
      patch: {
        data: { vendor: "Acme" },
        fieldPaths: new Set(["vendor"]),
      },
      indexEntries: [{ rowIndex: 0, cellIndex: 0 }],
    })

    expect(patchedRow).toBe(row)
  })

  it("reuses rows that do not own the indexed scalar cell", () => {
    const row: ProjectedRow = {
      rowIndex: 1,
      cells: [
        projectedCell({
          materializedFieldPath: "lines.0.name",
          value: "Paper",
        }),
      ],
    }

    const patchedRow = projectedRowWithPendingPrimitivePatch({
      projectedRow: row,
      patch: {
        data: { vendor: "Retab", lines: [{ name: "Paper" }] },
        fieldPaths: new Set(["vendor"]),
      },
      indexEntries: [{ rowIndex: 0, cellIndex: 0 }],
    })

    expect(patchedRow).toBe(row)
  })

  it("patches only indexed pending cells for the current row", () => {
    const lineNameCell = projectedCell({
      materializedFieldPath: "lines.0.name",
      value: "line 0",
    })
    const lineStatusCell = projectedCell({
      materializedFieldPath: "lines.0.status",
      value: "draft",
    })
    const row: ProjectedRow = {
      rowIndex: 0,
      cells: [lineNameCell, lineStatusCell],
    }

    const patchedRow = projectedRowWithPendingPrimitivePatch({
      projectedRow: row,
      patch: {
        data: {
          lines: [
            {
              name: "pending zero",
              status: "approved",
            },
            {
              name: "pending one",
              status: "draft",
            },
          ],
        },
        fieldPaths: new Set(["lines.0.name", "lines.1.name"]),
      },
      indexEntries: [{ rowIndex: 0, cellIndex: 0 }],
    })

    expect(patchedRow.cells[0]?.value).toBe("pending zero")
    expect(patchedRow.cells[1]).toBe(lineStatusCell)
  })
})
