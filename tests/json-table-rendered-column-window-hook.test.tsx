// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types";
import { useJsonTableRenderedColumnWindow } from "@/components/json-table/use-json-table-rendered-column-window";

function column(key: string, widthPx = 80): VisibleColumn {
  return {
    key,
    widthPx,
  };
}

const schemaVisibleColumns = [
  column("a", 80),
  column("b", 120),
  column("c", 160),
  column("d", 200),
];

describe("useJsonTableRenderedColumnWindow", () => {
  it("returns the full schema-visible window for read-only tables", () => {
    const { result } = renderHook(() =>
      useJsonTableRenderedColumnWindow({
        isJsonEditable: false,
        leftPadWidthPx: 80,
        renderedBodyColumnItems: [{ index: 1 }, { index: 3 }],
        rightPadWidthPx: 200,
        schemaVisibleColumns,
      }),
    );

    expect(result.current).toEqual({
      columns: schemaVisibleColumns,
      projectedCellIndexes: [0, 1, 2, 3],
      leftPadWidthPx: 0,
      rightPadWidthPx: 0,
    });
  });

  it("returns the rendered body column window for editable tables", () => {
    const { result } = renderHook(() =>
      useJsonTableRenderedColumnWindow({
        isJsonEditable: true,
        leftPadWidthPx: 80,
        renderedBodyColumnItems: [{ index: 1 }, { index: 3 }],
        rightPadWidthPx: 160,
        schemaVisibleColumns,
      }),
    );

    expect(result.current).toEqual({
      columns: [schemaVisibleColumns[1], schemaVisibleColumns[3]],
      projectedCellIndexes: [1, 3],
      leftPadWidthPx: 80,
      rightPadWidthPx: 160,
    });
  });

  it("keeps identity stable while column-window inputs are stable", () => {
    const renderedBodyColumnItems = [{ index: 1 }, { index: 2 }];
    const { result, rerender } = renderHook(
      ({ isJsonEditable }) =>
        useJsonTableRenderedColumnWindow({
          isJsonEditable,
          leftPadWidthPx: 80,
          renderedBodyColumnItems,
          rightPadWidthPx: 200,
          schemaVisibleColumns,
        }),
      { initialProps: { isJsonEditable: true } },
    );
    const firstWindow = result.current;

    rerender({ isJsonEditable: true });

    expect(result.current).toBe(firstWindow);

    rerender({ isJsonEditable: false });

    expect(result.current).not.toBe(firstWindow);
    expect(result.current.projectedCellIndexes).toEqual([0, 1, 2, 3]);
  });
});
