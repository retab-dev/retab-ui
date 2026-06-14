// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { createJsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"
import {
  buildHeaderDropSchema,
  getHeaderDropSide,
} from "@/components/json-table/lib/header-drag-model"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { useHeaderController } from "@/components/json-table/use-header-controller"
import { useJsonTablePrimitiveCellController } from "@/components/json-table/use-json-table-primitive-cell-controller"
import { useJsonTableStructuredCellController } from "@/components/json-table/use-json-table-structured-cell-controller"
import { useSingleFileTableDocumentModel } from "@/components/json-table/use-single-file-table-document-model"

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

describe("json table primitive cell controller", () => {
  it("skips no-op commits", () => {
    const onCellCommit = vi.fn()
    const primitiveEditStore = createJsonTablePrimitiveEditStore()
    const { result } = renderHook(() =>
      useJsonTablePrimitiveCellController({
        document,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: true,
        onCellCommit,
        primitiveEditStore,
      })
    )

    act(() => result.current.commitPrimitiveValueChange("ACME"))

    expect(onCellCommit).not.toHaveBeenCalled()
    expect(result.current.effectiveValue).toBe("ACME")
  })

  it("emits one primitive commit after one local edit-store write", () => {
    const onCellCommit = vi.fn()
    const primitiveEditStore = createJsonTablePrimitiveEditStore()
    const commitValue = vi.spyOn(primitiveEditStore, "commitValue")
    const { result } = renderHook(() =>
      useJsonTablePrimitiveCellController({
        document,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: true,
        onCellCommit,
        primitiveEditStore,
      })
    )

    act(() => result.current.commitPrimitiveValueChange("Globex"))

    expect(commitValue).toHaveBeenCalledTimes(1)
    expect(commitValue).toHaveBeenCalledWith("vendor", "Globex", "ACME")
    expect(onCellCommit).toHaveBeenCalledTimes(1)
    expect(onCellCommit).toHaveBeenCalledWith({
      fieldPath: "vendor",
      value: "Globex",
      previousValue: "ACME",
      visibleThrough: "primitivePendingValue",
    })
    expect(result.current.effectiveValue).toBe("Globex")
    expect(result.current.committedTextValue).toBe("Globex")
  })

  it("commits when projected value is stale but document data differs", () => {
    const onCellCommit = vi.fn()
    const primitiveEditStore = createJsonTablePrimitiveEditStore()
    const { result } = renderHook(() =>
      useJsonTablePrimitiveCellController({
        document,
        materializedFieldPath: "vendor",
        value: "Globex",
        isEditable: true,
        onCellCommit,
        primitiveEditStore,
      })
    )

    act(() => result.current.commitPrimitiveValueChange("Globex"))

    expect(onCellCommit).toHaveBeenCalledWith({
      fieldPath: "vendor",
      value: "Globex",
      previousValue: "ACME",
      visibleThrough: "primitivePendingValue",
    })
  })

  it("commits nested array values as primitive commits", () => {
    const nestedDocument = {
      ...document,
      data: {
        ...document.data,
        lines: [{ name: "old", quantity: 1 }],
      },
    }
    const onCellCommit = vi.fn()
    const primitiveEditStore = createJsonTablePrimitiveEditStore()
    const { result } = renderHook(() =>
      useJsonTablePrimitiveCellController({
        document: nestedDocument,
        materializedFieldPath: "lines.0.quantity",
        value: 1,
        isEditable: true,
        onCellCommit,
        primitiveEditStore,
      })
    )

    act(() => result.current.commitPrimitiveValueChange(2))

    expect(onCellCommit).toHaveBeenCalledWith({
      fieldPath: "lines.0.quantity",
      value: 2,
      previousValue: 1,
      visibleThrough: "primitivePendingValue",
    })
    expect(result.current.effectiveValue).toBe(2)
  })

  it("clears local edit state when authoritative field data changes", () => {
    const onCellCommit = vi.fn()
    const primitiveEditStore = createJsonTablePrimitiveEditStore()
    const { result, rerender } = renderHook(
      ({ currentDocument, currentValue }) =>
        useJsonTablePrimitiveCellController({
          document: currentDocument,
          materializedFieldPath: "vendor",
          value: currentValue,
          isEditable: true,
          onCellCommit,
          primitiveEditStore,
        }),
      {
        initialProps: {
          currentDocument: document,
          currentValue: "ACME",
        },
      }
    )

    act(() => result.current.commitPrimitiveValueChange("Globex"))
    expect(result.current.effectiveValue).toBe("Globex")

    const nextDocument = {
      ...document,
      data: { ...document.data, vendor: "Initech" },
    }
    act(() => {
      primitiveEditStore.reconcileDocumentData(nextDocument.data)
    })
    rerender({
      currentDocument: nextDocument,
      currentValue: "Initech",
    })

    expect(result.current.effectiveValue).toBe("Initech")
  })

  it("treats null and empty strings as equivalent no-op commits", () => {
    const onCellCommit = vi.fn()
    const primitiveEditStore = createJsonTablePrimitiveEditStore()
    const { result } = renderHook(() =>
      useJsonTablePrimitiveCellController({
        document: {
          ...document,
          data: { ...document.data, vendor: null },
        },
        materializedFieldPath: "vendor",
        value: null,
        isEditable: true,
        onCellCommit,
        primitiveEditStore,
      })
    )

    act(() => result.current.commitPrimitiveValueChange(""))

    expect(onCellCommit).not.toHaveBeenCalled()
    expect(result.current.committedTextValue).toBe("")
  })

  it("does not commit when disabled", () => {
    const onCellCommit = vi.fn()
    const primitiveEditStore = createJsonTablePrimitiveEditStore()
    const { result } = renderHook(() =>
      useJsonTablePrimitiveCellController({
        document,
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: false,
        onCellCommit,
        primitiveEditStore,
      })
    )

    act(() => result.current.commitPrimitiveValueChange("Globex"))

    expect(onCellCommit).not.toHaveBeenCalled()
  })

  it("does not commit when the projected cell has no materialized path", () => {
    const onCellCommit = vi.fn()
    const primitiveEditStore = createJsonTablePrimitiveEditStore()
    const { result } = renderHook(() =>
      useJsonTablePrimitiveCellController({
        document,
        materializedFieldPath: undefined,
        value: "ACME",
        isEditable: true,
        onCellCommit,
        primitiveEditStore,
      })
    )

    act(() => result.current.commitPrimitiveValueChange("Globex"))

    expect(onCellCommit).not.toHaveBeenCalled()
  })
})

describe("json table structured cell controller", () => {
  it("commits changed values to document data without primitive lifecycle", () => {
    const onCellCommit = vi.fn()
    const { result } = renderHook(() =>
      useJsonTableStructuredCellController({
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: true,
        onCellCommit,
      })
    )

    act(() => result.current.commitStructuredValueChange("Globex"))

    expect(onCellCommit).toHaveBeenCalledWith({
      fieldPath: "vendor",
      value: "Globex",
      previousValue: "ACME",
      visibleThrough: "projectedDocumentValue",
    })
    expect(result.current.effectiveValue).toBe("Globex")
    expect(result.current.committedTextValue).toBe("Globex")
  })

  it("skips structured no-op commits", () => {
    const onCellCommit = vi.fn()
    const { result } = renderHook(() =>
      useJsonTableStructuredCellController({
        materializedFieldPath: "vendor",
        value: "ACME",
        isEditable: true,
        onCellCommit,
      })
    )

    act(() => result.current.commitStructuredValueChange("ACME"))

    expect(onCellCommit).not.toHaveBeenCalled()
  })

  it("skips structured no-op commits when object keys are reordered", () => {
    const onCellCommit = vi.fn()
    const { result } = renderHook(() =>
      useJsonTableStructuredCellController({
        materializedFieldPath: "payment",
        value: { amount: 12, currency: "EUR" },
        isEditable: true,
        onCellCommit,
      })
    )

    act(() =>
      result.current.commitStructuredValueChange({
        currency: "EUR",
        amount: 12,
      })
    )

    expect(onCellCommit).not.toHaveBeenCalled()
  })

  it("does not commit structured values when disabled or pathless", () => {
    const onCellCommit = vi.fn()
    const { result, rerender } = renderHook(
      ({ materializedFieldPath, isEditable }) =>
        useJsonTableStructuredCellController({
          materializedFieldPath,
          value: "ACME",
          isEditable,
          onCellCommit,
        }),
      {
        initialProps: {
          materializedFieldPath: "vendor" as string | undefined,
          isEditable: false,
        },
      }
    )

    act(() => result.current.commitStructuredValueChange("Globex"))
    rerender({ materializedFieldPath: undefined, isEditable: true })
    act(() => result.current.commitStructuredValueChange("Initech"))

    expect(onCellCommit).not.toHaveBeenCalled()
  })
})

describe("single file table document model", () => {
  it("keeps primitive pending values visible through the edit store until parent echo", () => {
    const onUpdateDocument = vi.fn(async () => undefined)
    const { result, rerender } = renderHook(
      ({ sourceDocument }) =>
        useSingleFileTableDocumentModel({
          sourceDocument,
          onUpdateDocument,
        }),
      { initialProps: { sourceDocument: document } }
    )

    const originalProjectionDocument = result.current.projectionDocument

    act(() => {
      result.current.primitiveEditStore.commitValue("vendor", "Globex", "ACME")
      result.current.onCellCommit({
        fieldPath: "vendor",
        value: "Globex",
        previousValue: "ACME",
        visibleThrough: "primitivePendingValue",
      })
    })

    expect(result.current.primitiveEditStore.getSnapshot("vendor")).toEqual({
      status: "pending",
      hasValue: true,
      value: "Globex",
    })
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...document.data, vendor: "Globex" },
    })

    rerender({
      sourceDocument: {
        ...document,
        data: { ...document.data, vendor: "Globex" },
      },
    })

    expect(result.current.projectionDocument).toBe(originalProjectionDocument)
    expect(result.current.primitiveEditStore.getSnapshot("vendor")).toEqual({
      status: "confirmed",
      hasValue: true,
      value: "Globex",
    })
  })

  it("replaces the projection document for authoritative same-id parent data", () => {
    const { result, rerender } = renderHook(
      ({ sourceDocument }) =>
        useSingleFileTableDocumentModel({
          sourceDocument,
          onUpdateDocument: vi.fn(async () => undefined),
        }),
      { initialProps: { sourceDocument: document } }
    )
    const authoritativeDocument = {
      ...document,
      data: { ...document.data, vendor: "Initech" },
    }

    rerender({ sourceDocument: authoritativeDocument })

    expect(result.current.projectionDocument).toBe(authoritativeDocument)
  })

  it("patches structured commits from the confirmed document data", () => {
    const onUpdateDocument = vi.fn(async () => undefined)
    const { result } = renderHook(() =>
      useSingleFileTableDocumentModel({
        sourceDocument: document,
        onUpdateDocument,
      })
    )

    act(() => {
      result.current.onCellCommit({
        fieldPath: "total",
        value: 12,
        previousValue: 10,
        visibleThrough: "projectedDocumentValue",
      })
    })

    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...document.data, total: 12 },
    })
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
