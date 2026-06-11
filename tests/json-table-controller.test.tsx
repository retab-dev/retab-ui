// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { beforeAll, describe, expect, it, vi } from "vitest"

import {
  buildHeaderDropSchema,
  getHeaderDropSide,
} from "@/components/json-table/lib/header-drag-model"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { useCellController } from "@/components/json-table/use-cell-controller"
import { useHeaderController } from "@/components/json-table/use-header-controller"

import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())

const document = {
  id: "doc_1",
  data: {
    vendor: "ACME",
    total: 10,
  },
}

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    total: { type: "number" },
    status: { type: "string" },
  },
}

const vendorNode: JsonTableHeaderNode = {
  key: "vendor",
  label: "Vendor",
  propName: "vendor",
  parentPath: "",
  rawSchema: { type: "string" },
  schema: { type: "string" },
  effectiveType: "string",
  isObject: false,
  isArray: false,
  canFold: false,
  isExpanded: false,
}

const totalNode: JsonTableHeaderNode = {
  ...vendorNode,
  key: "total",
  label: "Total",
  propName: "total",
  rawSchema: { type: "number" },
  schema: { type: "number" },
  effectiveType: "number",
}

describe("json table cell controller", () => {
  it("skips no-op commits", () => {
    const onDocumentDataChange = vi.fn()
    const { result } = renderHook(() =>
      useCellController({
        document,
        docId: document.id,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: true,
        onDocumentDataChange,
      })
    )

    act(() => result.current.commitValueChange("ACME"))

    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(result.current.effectiveValue).toBe("ACME")
  })

  it("commits changed values optimistically", () => {
    const onDocumentDataChange = vi.fn()
    const { result } = renderHook(() =>
      useCellController({
        document,
        docId: document.id,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: true,
        onDocumentDataChange,
      })
    )

    act(() => result.current.commitValueChange("Globex"))

    expect(onDocumentDataChange).toHaveBeenCalledWith(document.id, {
      vendor: "Globex",
      total: 10,
    })
    expect(result.current.effectiveValue).toBe("Globex")
    expect(result.current.committedTextValue).toBe("Globex")
  })

  it("does not commit when disabled", () => {
    const onDocumentDataChange = vi.fn()
    const { result } = renderHook(() =>
      useCellController({
        document,
        docId: document.id,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: false,
        onDocumentDataChange,
      })
    )

    act(() => result.current.commitValueChange("Globex"))

    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })
})

describe("json table header controller", () => {
  it("toggles folded paths", () => {
    const setStopAt = vi.fn()
    const { result, rerender } = renderHook(
      ({ stopAt }) =>
        useHeaderController({
          node: vendorNode,
          schema,
          setSchema: vi.fn(),
          stopAt,
          setStopAt,
          draggedItemKeyRef: { current: null },
          draggedItemParentPathRef: { current: null },
          disableHeaderInteractions: false,
        }),
      { initialProps: { stopAt: [] as string[] } }
    )

    act(() => result.current.toggleExpanded())
    expect(setStopAt).toHaveBeenLastCalledWith(["vendor"])

    rerender({ stopAt: ["vendor"] })
    act(() => result.current.toggleExpanded())
    expect(setStopAt).toHaveBeenLastCalledWith([])
  })

  it("cleans up drag refs", () => {
    const draggedItemKeyRef = { current: "vendor" }
    const draggedItemParentPathRef = { current: "" }
    const { result } = renderHook(() =>
      useHeaderController({
        node: vendorNode,
        schema,
        setSchema: vi.fn(),
        stopAt: [],
        setStopAt: vi.fn(),
        draggedItemKeyRef,
        draggedItemParentPathRef,
        disableHeaderInteractions: false,
      })
    )

    act(() => result.current.handleDragEnd())

    expect(draggedItemKeyRef.current).toBeNull()
    expect(draggedItemParentPathRef.current).toBeNull()
  })
})

describe("json table header drag model", () => {
  it("builds a reordered schema for valid drops", () => {
    const nextSchema = buildHeaderDropSchema({
      node: vendorNode,
      schema,
      sourcePropName: "total",
      sourceParentPath: "",
    })

    expect(Object.keys(nextSchema?.properties ?? {})).toEqual([
      "total",
      "vendor",
      "status",
    ])
    expect(
      getHeaderDropSide({ node: totalNode, schema, sourcePropName: "vendor" })
    ).toBe("after")
  })

  it("ignores invalid drops", () => {
    expect(
      buildHeaderDropSchema({
        node: vendorNode,
        schema,
        sourcePropName: "vendor",
        sourceParentPath: "",
      })
    ).toBeUndefined()
    expect(
      buildHeaderDropSchema({
        node: vendorNode,
        schema,
        sourcePropName: "total",
        sourceParentPath: "other",
      })
    ).toBeUndefined()
  })
})
