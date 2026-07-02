import { describe, expect, it } from "vitest";

import type { Column } from "@/components/json-form/schema-model";
import {
  NO_ARRAY_TABLE_CELL_COMMIT,
  normalizeArrayTableCellValue,
} from "@/components/json-form/table/array-table-cell-commit";

function column(overrides: Partial<Column>): Column {
  return {
    key: "value",
    kind: "string",
    nullable: false,
    required: false,
    schema: { type: "string" },
    ...overrides,
  };
}

describe("array table cell commit normalization", () => {
  it("ignores invalid number edits", () => {
    expect(
      normalizeArrayTableCellValue({
        column: column({
          kind: "number",
          schema: { type: "number" },
        }),
        currentValue: 12,
        nextValue: "abc",
        meta: {
          isEmpty: false,
          isValid: false,
          kind: "number",
          rawValue: "abc",
        },
      }),
    ).toBe(NO_ARRAY_TABLE_CELL_COMMIT);
  });

  it("normalizes nullable empty number edits to null", () => {
    expect(
      normalizeArrayTableCellValue({
        column: column({
          kind: "number",
          nullable: true,
          schema: { type: ["number", "null"] },
        }),
        currentValue: 12,
        nextValue: null,
        meta: { isEmpty: true, isValid: true, kind: "number", rawValue: "" },
      }),
    ).toBeNull();
  });

  it("suppresses unchanged text commits", () => {
    expect(
      normalizeArrayTableCellValue({
        column: column({ kind: "string", schema: { type: "string" } }),
        currentValue: "Acme",
        nextValue: "Acme",
      }),
    ).toBe(NO_ARRAY_TABLE_CELL_COMMIT);
  });

  it("normalizes boolean commits with Boolean semantics", () => {
    expect(
      normalizeArrayTableCellValue({
        column: column({
          kind: "boolean",
          schema: { type: "boolean" },
        }),
        currentValue: false,
        nextValue: true,
      }),
    ).toBe(true);
  });

  it("preserves enum commit identity for non-string JSON values", () => {
    const option = { code: "approved" };

    expect(
      normalizeArrayTableCellValue({
        column: column({
          kind: "enum",
          schema: { enum: [{ code: "draft" }, option] },
        }),
        currentValue: { code: "draft" },
        nextValue: option,
      }),
    ).toBe(option);
  });

  it("compares date-time commits by local editable display value", () => {
    expect(
      normalizeArrayTableCellValue({
        column: column({
          kind: "string",
          schema: { type: "string", format: "date-time" },
        }),
        currentValue: "2026-06-17T09:30:00Z",
        nextValue: "2026-06-17T09:30",
      }),
    ).toBe(NO_ARRAY_TABLE_CELL_COMMIT);
  });
});
