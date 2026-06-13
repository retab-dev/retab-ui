// @vitest-environment jsdom
import type * as React from "react"
import { describe, expect, it } from "vitest"

import {
  getSchemaRowDropClasses,
  getSchemaRowDropIndicator,
  getSchemaRowDropTargetIndex,
  resolveSchemaRowDrop,
} from "@/components/schema-editor/primitives/schema-row-drag"

describe("schema row reorder helpers", () => {
  const rowIds = ["prop_a", "prop_b", "prop_c"]

  it("returns before when the source is after the target", () => {
    expect(
      getSchemaRowDropIndicator({
        rowIds,
        sourceRowId: "prop_c",
        targetRowId: "prop_a",
      })
    ).toBe("before")
  })

  it("returns after when the source is before the target", () => {
    expect(
      getSchemaRowDropIndicator({
        rowIds,
        sourceRowId: "prop_a",
        targetRowId: "prop_c",
      })
    ).toBe("after")
  })

  it("returns null for same, missing, or unknown source", () => {
    expect(
      getSchemaRowDropIndicator({
        rowIds,
        sourceRowId: "prop_b",
        targetRowId: "prop_b",
      })
    ).toBeNull()
    expect(
      getSchemaRowDropIndicator({
        rowIds,
        sourceRowId: null,
        targetRowId: "prop_b",
      })
    ).toBeNull()
    expect(
      getSchemaRowDropIndicator({
        rowIds,
        sourceRowId: "prop_x",
        targetRowId: "prop_b",
      })
    ).toBeNull()
  })

  it("maps indicators to stable CSS classes", () => {
    expect(getSchemaRowDropClasses("before")).toEqual([
      "border-t-2",
      "border-grey-700",
      "border-dashed",
    ])
    expect(getSchemaRowDropClasses("after")).toEqual([
      "border-b-2",
      "border-grey-700",
      "border-dashed",
    ])
    expect(getSchemaRowDropClasses(null)).toEqual([])
  })

  it("resolves target index by row id", () => {
    expect(
      getSchemaRowDropTargetIndex({
        rowIds,
        targetRowId: "prop_b",
      })
    ).toBe(1)
  })

  it("resolves a valid DOM drop and clears target classes", () => {
    const target = document.createElement("div")
    target.classList.add("border-t-2")
    const event = {
      stopPropagation: () => undefined,
      preventDefault: () => undefined,
      currentTarget: target,
      dataTransfer: {
        getData: () => "prop_a",
      },
    } as unknown as React.DragEvent<HTMLElement>

    expect(
      resolveSchemaRowDrop({
        event,
        targetRowId: "prop_c",
        rowIds,
        draggedRowIdRef: { current: "prop_a" },
      })
    ).toEqual({
      sourceRowId: "prop_a",
      targetIndex: 2,
    })
    expect(target.classList.contains("border-t-2")).toBe(false)
  })
})
