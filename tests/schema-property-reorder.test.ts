// @vitest-environment jsdom
import type * as React from "react";
import { describe, expect, it } from "vitest";

import { moveOrderedItem } from "@/components/schema-editor/primitives/schema-order";
import {
  getSchemaRowDropClasses,
  getSchemaRowDropPlacement,
  getSchemaRowDropTargetIndex,
  resolveSchemaRowDrop,
} from "@/components/schema-editor/primitives/schema-row-drag";

describe("schema row reorder helpers", () => {
  const rowIds = ["prop_a", "prop_b", "prop_c"];

  it("moves ordered items with one clamping rule", () => {
    const first = { id: "first" };
    const second = { id: "second" };
    const third = { id: "third" };
    const items = [first, second, third];

    expect(
      moveOrderedItem({
        items,
        sourceIndex: 0,
        targetIndex: 99,
      }),
    ).toEqual([second, third, first]);

    expect(
      moveOrderedItem({
        items,
        sourceIndex: 2,
        targetIndex: -1,
      }),
    ).toEqual([third, first, second]);

    expect(
      moveOrderedItem({
        items,
        sourceIndex: -1,
        targetIndex: 0,
      }),
    ).toEqual(items);
    expect(
      moveOrderedItem({
        items,
        sourceIndex: 1,
        targetIndex: 1,
      }),
    ).toEqual(items);
    expect(moveOrderedItem({ items, sourceIndex: 0, targetIndex: 2 })[2]).toBe(
      first,
    );
  });

  it("maps indicators to stable CSS classes", () => {
    expect(getSchemaRowDropClasses("before")).toEqual([
      "border-t-2",
      "border-grey-700",
      "border-dashed",
    ]);
    expect(getSchemaRowDropClasses("after")).toEqual([
      "border-b-2",
      "border-grey-700",
      "border-dashed",
    ]);
    expect(getSchemaRowDropClasses(null)).toEqual([]);
  });

  it("resolves placement from the pointer position within the target row", () => {
    expect(
      getSchemaRowDropPlacement({
        clientY: 12,
        targetRect: { top: 10, height: 20 },
      }),
    ).toBe("before");
    expect(
      getSchemaRowDropPlacement({
        clientY: 25,
        targetRect: { top: 10, height: 20 },
      }),
    ).toBe("after");
  });

  it("resolves target index after removing the source row", () => {
    expect(
      getSchemaRowDropTargetIndex({
        placement: "before",
        rowIds,
        sourceRowId: "prop_c",
        targetRowId: "prop_b",
      }),
    ).toBe(1);
    expect(
      getSchemaRowDropTargetIndex({
        placement: "after",
        rowIds,
        sourceRowId: "prop_a",
        targetRowId: "prop_c",
      }),
    ).toBe(2);
    expect(
      getSchemaRowDropTargetIndex({
        placement: "after",
        rowIds,
        sourceRowId: "prop_a",
        targetRowId: "prop_a",
      }),
    ).toBe(-1);
  });

  it("resolves a valid DOM drop before the target and clears target classes", () => {
    const target = document.createElement("div");
    target.classList.add("border-t-2");
    target.getBoundingClientRect = () => ({ top: 10, height: 20 }) as DOMRect;
    const event = {
      stopPropagation: () => undefined,
      preventDefault: () => undefined,
      clientY: 12,
      currentTarget: target,
      dataTransfer: {
        getData: () => "prop_a",
      },
    } as unknown as React.DragEvent<HTMLElement>;

    expect(
      resolveSchemaRowDrop({
        event,
        targetRowId: "prop_c",
        rowIds,
        draggedRowIdRef: { current: "prop_a" },
      }),
    ).toEqual({
      placement: "before",
      sourceRowId: "prop_a",
      targetRowId: "prop_c",
      targetIndex: 1,
    });
    expect(target.classList.contains("border-t-2")).toBe(false);
  });

  it("returns null for same-row and unknown-source drops", () => {
    const target = document.createElement("div");
    target.getBoundingClientRect = () => ({ top: 10, height: 20 }) as DOMRect;
    const event = {
      stopPropagation: () => undefined,
      preventDefault: () => undefined,
      clientY: 25,
      currentTarget: target,
      dataTransfer: {
        getData: () => "prop_b",
      },
    } as unknown as React.DragEvent<HTMLElement>;

    expect(
      resolveSchemaRowDrop({
        event,
        targetRowId: "prop_b",
        rowIds,
        draggedRowIdRef: { current: "prop_b" },
      }),
    ).toBeNull();
    expect(
      resolveSchemaRowDrop({
        event,
        targetRowId: "prop_c",
        rowIds,
        draggedRowIdRef: { current: "prop_x" },
      }),
    ).toBeNull();
  });
});
