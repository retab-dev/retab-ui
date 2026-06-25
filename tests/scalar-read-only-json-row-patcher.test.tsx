// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import type { JSONSchema7 } from "json-schema";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FixedGridViewport } from "@/components/ui/fixed-grid-virtualization";
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types";
import type { ProjectedRow } from "@/components/json-table/lib/document-projection";
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata";
import {
  useScalarReadOnlyJsonRowPatcher,
  type ScalarReadOnlyJsonRowPatchState,
} from "@/components/json-table/scalar-read-only-json-row-patcher";

afterEach(() => {
  cleanup();
});

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    amount: { type: "number" },
    is_paid: { type: "boolean" },
  },
};

describe("scalar read-only JSON row patcher", () => {
  it("patches read-only row positions and cell text", () => {
    const rowWindow = buildRowWindow([
      { rowIndex: 0, cells: ["row 0", "1"] },
      { rowIndex: 1, cells: ["row 1", "2"] },
      { rowIndex: 2, cells: ["row 2", "3"] },
    ]);
    const state = createPatchState();
    const { result } = renderHook(() =>
      useScalarReadOnlyJsonRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      }),
    );

    expect(result.current.patch(createJumpViewport())).toBe("handled");

    const rows = rowHandles(rowWindow);
    expect(rows.map((row) => row.dataset.index)).toEqual(["3", "4", "5"]);
    expect(rows.map((row) => row.style.transform)).toEqual([
      "translate3d(0, 0px, 0)",
      "translate3d(0, 10px, 0)",
      "translate3d(0, 20px, 0)",
    ]);
    expect(rowWindow.style.position).toBe("sticky");
    expect(rowWindow.style.marginTop).toBe("30px");
    expect(rowWindow.style.height).toBe("30px");
    expect(rowWindow.style.top).toBe("-10px");
    expect(rowWindow.style.bottom).toBe("-10px");
    expect(rowText(rows[0]!)).toEqual(["row 3", "4"]);
    expect(rowText(rows[1]!)).toEqual(["row 4", "5"]);
    expect(rowText(rows[2]!)).toEqual(["row 5", "6"]);
  });

  it("reports handled patch diagnostics with the number of repatched rows", () => {
    const rowWindow = buildRowWindow([
      { rowIndex: 0, cells: ["row 0", "1"] },
      { rowIndex: 1, cells: ["row 1", "2"] },
      { rowIndex: 2, cells: ["row 2", "3"] },
    ]);
    const onDiagnostic = vi.fn();
    const state = createPatchState();
    const { result } = renderHook(() =>
      useScalarReadOnlyJsonRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
        onDiagnostic,
      }),
    );

    expect(result.current.patch(createJumpViewport())).toBe("handled");

    expect(onDiagnostic).toHaveBeenCalledWith({
      reason: "handled",
      rowsPatched: 3,
    });
  });

  it("patches boolean cells instead of rejecting the row", () => {
    const rowWindow = buildRowWindow([
      { rowIndex: 0, cells: ["row 0", "1", "false"] },
      { rowIndex: 1, cells: ["row 1", "2", "true"] },
      { rowIndex: 2, cells: ["row 2", "3", "false"] },
    ]);
    const state = createPatchState({
      visibleColumns: [
        visibleColumn("name"),
        visibleColumn("amount"),
        visibleColumn("is_paid"),
      ],
    });
    const { result } = renderHook(() =>
      useScalarReadOnlyJsonRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
      }),
    );

    expect(result.current.patch(createJumpViewport())).toBe("handled");

    const rows = rowHandles(rowWindow);
    expect(rowText(rows[0]!)).toEqual(["row 3", "4", "true"]);
    expect(rowText(rows[1]!)).toEqual(["row 4", "5", "false"]);
    expect(rowText(rows[2]!)).toEqual(["row 5", "6", "true"]);
    expect(booleanCheckboxes(rows[0]!)[0]?.getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(booleanCheckboxes(rows[1]!)[0]?.dataset.state).toBe("unchecked");
    expect(booleanCheckboxes(rows[2]!)[0]?.getAttribute("aria-label")).toBe(
      "true",
    );
  });

  it("falls back to React when a required read-only text node is missing", () => {
    const rowWindow = buildRowWindow([
      { rowIndex: 0, cells: ["row 0", "1"] },
      { rowIndex: 1, cells: ["row 1", "2"] },
      { rowIndex: 2, cells: ["row 2", "3"] },
    ]);
    const firstText = rowWindow.querySelector(
      '[data-slot="json-table-read-only-cell"] [data-slot="data-cell-value"]',
    );
    firstText?.replaceChildren(document.createElement("strong"));
    const onDiagnostic = vi.fn();
    const state = createPatchState();
    const { result } = renderHook(() =>
      useScalarReadOnlyJsonRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
        onDiagnostic,
      }),
    );

    expect(result.current.patch(createJumpViewport())).toBe("pass");
    expect(rowText(rowHandles(rowWindow)[0]!)).toEqual(["", "1"]);
    expect(onDiagnostic).toHaveBeenCalledWith({
      reason: "shape-mismatch",
      rowsPatched: 0,
    });
  });

  it("reports unsupported viewport diagnostics instead of patching horizontal jumps", () => {
    const rowWindow = buildRowWindow([
      { rowIndex: 0, cells: ["row 0", "1"] },
      { rowIndex: 1, cells: ["row 1", "2"] },
      { rowIndex: 2, cells: ["row 2", "3"] },
    ]);
    const onDiagnostic = vi.fn();
    const state = createPatchState();
    const { result } = renderHook(() =>
      useScalarReadOnlyJsonRowPatcher({
        rowWindowRef: { current: rowWindow },
        getState: () => state,
        onDiagnostic,
      }),
    );

    expect(
      result.current.patch({
        ...createJumpViewport(),
        scrollLeft: 24,
        isJumpingColumns: true,
      }),
    ).toBe("pass");

    expect(onDiagnostic).toHaveBeenCalledWith({
      reason: "unsupported-viewport",
      rowsPatched: 0,
    });
  });
});

function createPatchState(
  overrides: Partial<ScalarReadOnlyJsonRowPatchState> = {},
): ScalarReadOnlyJsonRowPatchState {
  return {
    isEnabled: true,
    projectedRows: Array.from({ length: 10 }, (_, rowIndex) =>
      projectedRow(rowIndex),
    ),
    rowHeightPx: 10,
    visibleColumns: [visibleColumn("name"), visibleColumn("amount")],
    ...overrides,
  };
}

function visibleColumn(
  fieldPath: "name" | "amount" | "is_paid",
): VisibleColumn {
  const fieldMetadata = getFieldMetadata(schema, fieldPath);
  if (!fieldMetadata) throw new Error(`Missing metadata for ${fieldPath}`);
  return {
    key: fieldPath,
    widthPx: 100,
    fieldMetadata,
  };
}

function projectedRow(rowIndex: number): ProjectedRow {
  return {
    rowIndex,
    cells: [
      {
        key: "name",
        value: `row ${rowIndex}`,
        displayValue: `row ${rowIndex}`,
        templateFieldPath: "name",
        materializedFieldPath: "name",
        arrayIndexes: [],
      },
      {
        key: "amount",
        value: rowIndex + 1,
        displayValue: String(rowIndex + 1),
        templateFieldPath: "amount",
        materializedFieldPath: "amount",
        arrayIndexes: [],
      },
      {
        key: "is_paid",
        value: rowIndex % 2 === 1,
        displayValue: rowIndex % 2 === 1 ? "true" : "false",
        templateFieldPath: "is_paid",
        materializedFieldPath: "is_paid",
        arrayIndexes: [],
      },
    ],
  };
}

function createJumpViewport(): FixedGridViewport {
  return {
    scrollTop: 30,
    scrollLeft: 0,
    clientHeight: 20,
    clientWidth: 200,
    isJumpingRows: true,
    isJumpingColumns: false,
  };
}

function buildRowWindow(rows: Array<{ rowIndex: number; cells: string[] }>) {
  const rowWindow = document.createElement("tbody");
  for (const row of rows) {
    const rowElement = document.createElement("tr");
    rowElement.dataset.slot = "json-table-row";
    rowElement.dataset.index = String(row.rowIndex);

    for (const [cellIndex, text] of row.cells.entries()) {
      const cell = document.createElement("td");
      cell.dataset.slot = "json-table-read-only-cell";
      cell.dataset.fieldPath =
        cellIndex === 0 ? "name" : cellIndex === 1 ? "amount" : "is_paid";
      if (cellIndex === 2) {
        const checkbox = document.createElement("span");
        checkbox.setAttribute("role", "checkbox");
        checkbox.setAttribute("aria-checked", text);
        checkbox.setAttribute("aria-label", text);
        checkbox.dataset.state = text === "true" ? "checked" : "unchecked";
        cell.append(checkbox);
      }
      const span = document.createElement("span");
      span.dataset.slot = "data-cell-value";
      span.append(text);
      cell.append(span);
      rowElement.append(cell);
    }

    rowWindow.append(rowElement);
  }
  return rowWindow;
}

function rowHandles(rowWindow: HTMLElement) {
  return Array.from(
    rowWindow.querySelectorAll<HTMLElement>('[data-slot="json-table-row"]'),
  );
}

function rowText(row: HTMLElement) {
  return Array.from(
    row.querySelectorAll<HTMLElement>(
      '[data-slot="json-table-read-only-cell"]',
    ),
  ).map((cell) => cell.textContent ?? "");
}

function booleanCheckboxes(row: HTMLElement) {
  return Array.from(row.querySelectorAll<HTMLElement>('[role="checkbox"]'));
}
