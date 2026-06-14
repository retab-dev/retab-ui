// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { beforeAll, describe, expect, it, vi } from "vitest"

import {
  buildHeaderDropSchema,
  getHeaderDropSide,
} from "@/components/json-table/lib/header-drag-model"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { createJsonTablePrimitivePatchStore } from "@/components/json-table/json-table-primitive-patch-store"
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

const allOfSchema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: {
      allOf: [
        {
          type: "object",
          properties: {
            name: { type: "string" },
            note: { type: "string" },
          },
        },
        {
          type: "object",
          properties: {
            rating: { type: "number" },
            tier: { type: "string" },
          },
        },
      ],
    },
  },
}

const anyOfSchema: JSONSchema7 = {
  type: "object",
  properties: {
    payment: {
      anyOf: [
        {
          type: "object",
          properties: {
            card_last4: { type: "string" },
          },
        },
        {
          type: "object",
          properties: {
            bank_name: { type: "string" },
            account_last4: { type: "string" },
          },
        },
      ],
    },
  },
}

const vendorNameNode: JsonTableHeaderNode = {
  ...vendorNode,
  key: "vendor.name",
  label: "Name",
  propName: "name",
  parentPath: "vendor",
}

const vendorRatingNode: JsonTableHeaderNode = {
  ...vendorNode,
  key: "vendor.rating",
  label: "Rating",
  propName: "rating",
  parentPath: "vendor",
  rawSchema: { type: "number" },
  schema: { type: "number" },
  effectiveType: "number",
}

const missingParentNode: JsonTableHeaderNode = {
  ...vendorNode,
  key: "missing.name",
  label: "Name",
  propName: "name",
  parentPath: "missing",
}

const paymentBankNameNode: JsonTableHeaderNode = {
  ...vendorNode,
  key: "payment.bank_name",
  label: "Bank Name",
  propName: "bank_name",
  parentPath: "payment",
}

describe("json table cell controller", () => {
  it("skips no-op commits", () => {
    const onDocumentDataChange = vi.fn()
    const primitivePatchStore = createJsonTablePrimitivePatchStore()
    const { result } = renderHook(() =>
      useCellController({
        document,
        docId: document.id,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: true,
        onDocumentDataChange,
        primitivePatchStore,
      })
    )

    act(() => result.current.commitValueChange("ACME"))

    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(result.current.effectiveValue).toBe("ACME")
  })

  it("commits changed values optimistically", () => {
    const onDocumentDataChange = vi.fn()
    const primitivePatchStore = createJsonTablePrimitivePatchStore()
    const { result } = renderHook(() =>
      useCellController({
        document,
        docId: document.id,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: true,
        onDocumentDataChange,
        primitivePatchStore,
      })
    )

    act(() => result.current.commitValueChange("Globex"))

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      document.id,
      "vendor",
      "Globex"
    )
    expect(result.current.effectiveValue).toBe("Globex")
    expect(result.current.committedTextValue).toBe("Globex")
  })

  it("commits when projected value is stale but document data differs", () => {
    const onDocumentDataChange = vi.fn()
    const primitivePatchStore = createJsonTablePrimitivePatchStore()
    const { result } = renderHook(() =>
      useCellController({
        document,
        docId: document.id,
        materializedFieldPath: "vendor",
        value: "Globex",
        isEditable: true,
        onDocumentDataChange,
        primitivePatchStore,
      })
    )

    act(() => result.current.commitValueChange("Globex"))

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      document.id,
      "vendor",
      "Globex"
    )
  })

  it("commits nested array values without replacing sibling data", () => {
    const nestedDocument = {
      ...document,
      data: {
        ...document.data,
        lines: [{ name: "old", quantity: 1 }],
      },
    }
    const onDocumentDataChange = vi.fn()
    const primitivePatchStore = createJsonTablePrimitivePatchStore()
    const { result } = renderHook(() =>
      useCellController({
        document: nestedDocument,
        docId: nestedDocument.id,
        materializedFieldPath: "lines.0.quantity",
        value: 1,
        isEditable: true,
        onDocumentDataChange,
        primitivePatchStore,
      })
    )

    act(() => result.current.commitValueChange(2))

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      nestedDocument.id,
      "lines.0.quantity",
      2
    )
    expect(result.current.effectiveValue).toBe(2)
  })

  it("clears optimistic state when authoritative field data changes", () => {
    const onDocumentDataChange = vi.fn()
    const primitivePatchStore = createJsonTablePrimitivePatchStore()
    const { result, rerender } = renderHook(
      ({ currentDocument, currentValue }) =>
        useCellController({
          document: currentDocument,
          docId: currentDocument.id,
          materializedFieldPath: "vendor",
          value: currentValue,
          isEditable: true,
          onDocumentDataChange,
          primitivePatchStore,
        }),
      {
        initialProps: {
          currentDocument: document,
          currentValue: "ACME",
        },
      }
    )

    act(() => result.current.commitValueChange("Globex"))
    expect(result.current.effectiveValue).toBe("Globex")

    const nextDocument = {
      ...document,
      data: { ...document.data, vendor: "Initech" },
    }
    act(() => {
      primitivePatchStore.reconcileDocumentData(nextDocument.data)
    })
    rerender({
      currentDocument: nextDocument,
      currentValue: "Initech",
    })

    expect(result.current.effectiveValue).toBe("Initech")
  })

  it("treats null and empty strings as equivalent no-op commits", () => {
    const onDocumentDataChange = vi.fn()
    const primitivePatchStore = createJsonTablePrimitivePatchStore()
    const { result } = renderHook(() =>
      useCellController({
        document: {
          ...document,
          data: { ...document.data, vendor: null },
        },
        docId: document.id,
        materializedFieldPath: "vendor",
        value: null,
        isEditable: true,
        onDocumentDataChange,
        primitivePatchStore,
      })
    )

    act(() => result.current.commitValueChange(""))

    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(result.current.committedTextValue).toBe("")
  })

  it("does not commit when disabled", () => {
    const onDocumentDataChange = vi.fn()
    const primitivePatchStore = createJsonTablePrimitivePatchStore()
    const { result } = renderHook(() =>
      useCellController({
        document,
        docId: document.id,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: false,
        onDocumentDataChange,
        primitivePatchStore,
      })
    )

    act(() => result.current.commitValueChange("Globex"))

    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("does not commit when the projected cell has no materialized path", () => {
    const onDocumentDataChange = vi.fn()
    const primitivePatchStore = createJsonTablePrimitivePatchStore()
    const { result } = renderHook(() =>
      useCellController({
        document,
        docId: document.id,
        materializedFieldPath: undefined,
        value: "ACME",
        isEditable: true,
        onDocumentDataChange,
        primitivePatchStore,
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

  it("marks headers as non-draggable while header interactions are disabled", () => {
    const { result } = renderHook(() =>
      useHeaderController({
        node: vendorNode,
        schema,
        setSchema: vi.fn(),
        stopAt: [],
        setStopAt: vi.fn(),
        draggedItemKeyRef: { current: null },
        draggedItemParentPathRef: { current: null },
        disableHeaderInteractions: true,
      })
    )

    expect(result.current.isDraggable).toBe(false)
  })

  it("marks allOf child headers as draggable when their parent branch is mutable", () => {
    const { result } = renderHook(() =>
      useHeaderController({
        node: vendorRatingNode,
        schema: allOfSchema,
        setSchema: vi.fn(),
        stopAt: [],
        setStopAt: vi.fn(),
        draggedItemKeyRef: { current: null },
        draggedItemParentPathRef: { current: null },
        disableHeaderInteractions: false,
      })
    )

    expect(result.current.isDraggable).toBe(true)
  })

  it("does not treat missing header parent paths as root-level draggable objects", () => {
    const { result } = renderHook(() =>
      useHeaderController({
        node: missingParentNode,
        schema,
        setSchema: vi.fn(),
        stopAt: [],
        setStopAt: vi.fn(),
        draggedItemKeyRef: { current: null },
        draggedItemParentPathRef: { current: null },
        disableHeaderInteractions: false,
      })
    )

    expect(result.current.isDraggable).toBe(false)
    expect(
      getHeaderDropSide({
        node: missingParentNode,
        schema,
        sourcePropName: "vendor",
      })
    ).toBeUndefined()
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
    expect(
      buildHeaderDropSchema({
        node: vendorNode,
        schema,
        sourcePropName: "missing",
        sourceParentPath: "",
      })
    ).toBeUndefined()
    expect(
      getHeaderDropSide({ node: totalNode, schema, sourcePropName: "missing" })
    ).toBeUndefined()
  })

  it("ignores allOf drops across different schema branches", () => {
    expect(
      getHeaderDropSide({
        node: vendorNameNode,
        schema: allOfSchema,
        sourcePropName: "tier",
      })
    ).toBeUndefined()
    expect(
      buildHeaderDropSchema({
        node: vendorNameNode,
        schema: allOfSchema,
        sourcePropName: "tier",
        sourceParentPath: "vendor",
      })
    ).toBeUndefined()
  })

  it("allows allOf drops inside the same schema branch", () => {
    expect(
      getHeaderDropSide({
        node: vendorRatingNode,
        schema: allOfSchema,
        sourcePropName: "tier",
      })
    ).toBe("before")
    expect(
      (
        (
          buildHeaderDropSchema({
            node: vendorRatingNode,
            schema: allOfSchema,
            sourcePropName: "tier",
            sourceParentPath: "vendor",
          })?.properties?.vendor as JSONSchema7
        ).allOf?.[1] as JSONSchema7
      ).properties
    ).toEqual({
      tier: { type: "string" },
      rating: { type: "number" },
    })
  })

  it("allows anyOf drops inside the matching schema branch", () => {
    expect(
      getHeaderDropSide({
        node: paymentBankNameNode,
        schema: anyOfSchema,
        sourcePropName: "account_last4",
      })
    ).toBe("before")
    expect(
      (
        (
          buildHeaderDropSchema({
            node: paymentBankNameNode,
            schema: anyOfSchema,
            sourcePropName: "account_last4",
            sourceParentPath: "payment",
          })?.properties?.payment as JSONSchema7
        ).anyOf?.[1] as JSONSchema7
      ).properties
    ).toEqual({
      account_last4: { type: "string" },
      bank_name: { type: "string" },
    })
  })
})
