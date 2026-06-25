// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types";
import type { ProjectedRow } from "@/components/json-table/lib/document-projection";
import { useJsonTableRowPolicy } from "@/components/json-table/use-json-table-row-policy";

const projectedRows: ProjectedRow[] = [];
const schemaVisibleColumns: VisibleColumn[] = [];

function renderRowPolicy(isJsonEditable: boolean) {
  const rowWindowRef = { current: null };
  const viewportHeightRef = { current: 0 };

  return renderHook(() =>
    useJsonTableRowPolicy({
      isJsonEditable,
      projectedRows,
      rowHeightPx: 32,
      rowWindowRef,
      schemaVisibleColumns,
      viewportHeightRef,
    }),
  );
}

describe("useJsonTableRowPolicy", () => {
  it("keeps editable tables on the React row policy", () => {
    const { result } = renderRowPolicy(true);

    expect(result.current.rowScrollStrategy).toBeUndefined();
    expect(() => result.current.resyncRows([])).not.toThrow();
  });

  it("installs the read-only DOM patch strategy only for read-only tables", () => {
    const { result } = renderRowPolicy(false);

    expect(result.current.rowScrollStrategy).toBeTruthy();
    expect(
      result.current.rowScrollStrategy?.handleViewport({
        scrollTop: 0,
        scrollLeft: 0,
        clientHeight: 100,
        clientWidth: 100,
        isJumpingRows: false,
        isJumpingColumns: false,
      }),
    ).toBe("pass");
  });

  it("keeps the row policy identity stable while inputs are stable", () => {
    const { result, rerender } = renderRowPolicy(false);
    const firstPolicy = result.current;

    rerender();

    expect(result.current).toBe(firstPolicy);
  });
});
