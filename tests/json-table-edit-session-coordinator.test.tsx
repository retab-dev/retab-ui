// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type {
  JsonTableActivationIntent,
  JsonTablePrimitiveActiveCell,
} from "@/components/json-table/json-table-edit-session";
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session";
import type { ProjectedCell } from "@/components/json-table/lib/document-projection";
import { useJsonTableEditSessionCoordinator } from "@/components/json-table/use-json-table-edit-session-coordinator";

import { installJsonTableDom } from "./json-table-test-dom";

beforeAll(() => installJsonTableDom());
afterEach(() => cleanup());

function primitiveActiveCell(
  docId: string,
  fieldPath: string,
): JsonTablePrimitiveActiveCell {
  return {
    cellId: jsonTableCellId(docId, fieldPath),
    docId,
    fieldPath,
  };
}

function projectedCell(fieldPath: string): ProjectedCell {
  return {
    key: fieldPath,
    value: "draft",
    templateFieldPath: fieldPath,
    materializedFieldPath: fieldPath,
    arrayIndexes: [],
  };
}

const keyboardIntent: JsonTableActivationIntent = {
  type: "keyboard",
  key: "Enter",
};

describe("json table edit-session coordinator", () => {
  it("keeps primitive active state in a stable external store", () => {
    const { result, rerender } = renderHook(
      ({ documentId }) => useJsonTableEditSessionCoordinator({ documentId }),
      { initialProps: { documentId: "doc_1" } },
    );
    const primitiveActiveCellStore = result.current.primitiveActiveCellStore;

    act(() => {
      result.current.setPrimitiveActiveCell(
        primitiveActiveCell("doc_1", "status"),
      );
    });
    rerender({ documentId: "doc_1" });

    expect(result.current.primitiveActiveCellStore).toBe(
      primitiveActiveCellStore,
    );
    expect(primitiveActiveCellStore.getSnapshot()).toEqual(
      primitiveActiveCell("doc_1", "status"),
    );
  });

  it("starts structured sessions open and clears primitive active state", () => {
    const { result } = renderHook(() =>
      useJsonTableEditSessionCoordinator({ documentId: "doc_1" }),
    );

    act(() => {
      result.current.setPrimitiveActiveCell(
        primitiveActiveCell("doc_1", "status"),
      );
    });
    act(() => {
      result.current.startStructuredEditSession(
        projectedCell("metadata"),
        keyboardIntent,
      );
    });

    expect(result.current.primitiveActiveCellStore.getSnapshot()).toBeNull();
    expect(result.current.structuredEditSession).toMatchObject({
      id: 1,
      cellId: "doc_1:metadata",
      docId: "doc_1",
      fieldPath: "metadata",
      intent: keyboardIntent,
      isOverlayOpen: true,
    });
  });

  it("clears structured sessions when a primitive cell becomes active", () => {
    const { result } = renderHook(() =>
      useJsonTableEditSessionCoordinator({ documentId: "doc_1" }),
    );

    act(() => {
      result.current.startStructuredEditSession(
        projectedCell("metadata"),
        keyboardIntent,
      );
    });
    act(() => {
      result.current.setPrimitiveActiveCell(
        primitiveActiveCell("doc_1", "status"),
      );
    });

    expect(result.current.structuredEditSession).toBeNull();
    expect(result.current.primitiveActiveCellStore.getSnapshot()).toEqual(
      primitiveActiveCell("doc_1", "status"),
    );
  });

  it("updates structured overlay state and closes the structured session", () => {
    const { result } = renderHook(() =>
      useJsonTableEditSessionCoordinator({ documentId: "doc_1" }),
    );

    act(() => {
      result.current.startStructuredEditSession(
        projectedCell("metadata"),
        keyboardIntent,
      );
    });
    act(() => {
      result.current.setStructuredEditSessionOverlayOpen(false);
    });

    expect(result.current.structuredEditSession?.isOverlayOpen).toBe(false);

    act(() => {
      result.current.closeStructuredEditSession();
    });

    expect(result.current.structuredEditSession).toBeNull();
  });

  it("resets edit-session state when the document identity changes", () => {
    const { result, rerender } = renderHook(
      ({ documentId }) => useJsonTableEditSessionCoordinator({ documentId }),
      { initialProps: { documentId: "doc_1" } },
    );
    const primitiveActiveCellStore = result.current.primitiveActiveCellStore;

    act(() => {
      result.current.startStructuredEditSession(
        projectedCell("metadata"),
        keyboardIntent,
      );
    });
    act(() => {
      result.current.setPrimitiveActiveCell(
        primitiveActiveCell("doc_1", "status"),
      );
    });

    rerender({ documentId: "doc_2" });

    expect(result.current.primitiveActiveCellStore).toBe(
      primitiveActiveCellStore,
    );
    expect(primitiveActiveCellStore.getSnapshot()).toBeNull();
    expect(result.current.structuredEditSession).toBeNull();

    act(() => {
      result.current.startStructuredEditSession(
        projectedCell("metadata"),
        keyboardIntent,
      );
    });

    expect(result.current.structuredEditSession).toMatchObject({
      id: 1,
      cellId: "doc_2:metadata",
      docId: "doc_2",
    });
  });

  it("ignores missing projected cells", () => {
    const { result } = renderHook(() =>
      useJsonTableEditSessionCoordinator({ documentId: "doc_1" }),
    );

    act(() => {
      result.current.startStructuredEditSession(undefined, {
        type: "programmatic",
      });
    });

    expect(result.current.structuredEditSession).toBeNull();
  });
});
