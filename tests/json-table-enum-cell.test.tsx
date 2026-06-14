// @vitest-environment jsdom

import { cleanup, fireEvent } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { JsonTableCellHarnessProps } from "./json-table-cell-test-utils"
import {
  baseField,
  baseSession,
  renderEnumCell,
} from "./json-table-cell-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

function renderEnumCellForTest(overrides: JsonTableCellHarnessProps = {}) {
  return renderEnumCell({
    fieldMetadata: baseField("enum"),
    fieldPath: "status",
    structuredEditSession: baseSession({ fieldPath: "status" }),
    onOpenChange: vi.fn(),
    onEditingEnd: vi.fn(),
    commitValue: vi.fn(),
    ...overrides,
  })
}

describe("json table enum cell", () => {
  it("commits integer enum values as numbers", () => {
    const onCommit = vi.fn()
    const view = renderEnumCellForTest({
      effectiveValue: 1,
      fieldMetadata: {
        fieldPath: "status",
        rawSchema: { type: "integer", enum: [1, 2] },
        schema: { type: "integer", enum: [1, 2] },
        effectiveSchema: { type: "integer", enum: [1, 2] },
        isNullable: false,
        kind: "enum",
        enumValues: [1, 2],
      },
      commitValue: onCommit,
    })

    fireEvent.click(view.getByRole("option", { name: "2" }))

    expect(onCommit).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ kind: "select", rawValue: "option:1" })
    )
  })

  it("commits number enum values as numbers", () => {
    const onCommit = vi.fn()
    const view = renderEnumCellForTest({
      effectiveValue: 1.5,
      fieldMetadata: {
        fieldPath: "score",
        rawSchema: { type: "number", enum: [1.5, 2.25] },
        schema: { type: "number", enum: [1.5, 2.25] },
        effectiveSchema: { type: "number", enum: [1.5, 2.25] },
        isNullable: false,
        kind: "enum",
        enumValues: [1.5, 2.25],
      },
      commitValue: onCommit,
    })

    fireEvent.click(view.getByRole("option", { name: "2.25" }))

    expect(onCommit).toHaveBeenCalledWith(
      2.25,
      expect.objectContaining({ kind: "select", rawValue: "option:1" })
    )
  })

  it("commits boolean enum values as booleans", () => {
    const onCommit = vi.fn()
    const view = renderEnumCellForTest({
      effectiveValue: false,
      fieldMetadata: {
        fieldPath: "flag",
        rawSchema: { type: "boolean", enum: [false, true] },
        schema: { type: "boolean", enum: [false, true] },
        effectiveSchema: { type: "boolean", enum: [false, true] },
        isNullable: false,
        kind: "enum",
        enumValues: [false, true],
      },
      commitValue: onCommit,
    })

    fireEvent.click(view.getByRole("option", { name: "true" }))

    expect(onCommit).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ kind: "select", rawValue: "option:1" })
    )
  })

  it("renders the selected option label in the trigger, not the internal option id", () => {
    const view = renderEnumCellForTest({
      effectiveValue: "DEBIT",
      fieldMetadata: {
        fieldPath: "payment_type",
        rawSchema: { type: "string", enum: ["CREDIT", "DEBIT"] },
        schema: { type: "string", enum: ["CREDIT", "DEBIT"] },
        effectiveSchema: { type: "string", enum: ["CREDIT", "DEBIT"] },
        isNullable: false,
        kind: "enum",
        enumValues: ["CREDIT", "DEBIT"],
      },
    })

    const trigger = view.container.querySelector<HTMLElement>(
      '[data-slot="data-cell"]'
    )
    if (!trigger) throw new Error("Missing enum trigger")
    expect(trigger.textContent).toContain("DEBIT")
    expect(trigger.textContent).not.toContain("option:")
    expect(trigger.getAttribute("aria-activedescendant")).toMatch(/option-1$/)
  })

  it("renders literal sentinel-like string enum values", () => {
    const view = renderEnumCellForTest({
      effectiveValue: "__null__",
      fieldMetadata: {
        fieldPath: "status",
        rawSchema: { enum: ["__null__", "approved"] },
        schema: { enum: ["__null__", "approved"] },
        effectiveSchema: { enum: ["__null__", "approved"] },
        isNullable: false,
        kind: "enum",
        enumValues: ["__null__", "approved"],
      },
    })

    expect(view.getAllByText("__null__")).toHaveLength(2)
  })

  it("ends editing from trigger blur after primitive-owned activation", () => {
    const onEditingEnd = vi.fn()
    const onOpenChange = vi.fn()
    const view = renderEnumCellForTest({
      onEditingEnd,
      structuredEditSession: baseSession({
        fieldPath: "status",
        isOverlayOpen: false,
      }),
      onOpenChange,
    })

    const trigger = view.container.querySelector<HTMLElement>(
      '[data-slot="data-cell"]'
    )
    if (!trigger) throw new Error("Missing enum trigger")
    fireEvent.blur(trigger)

    expect(onEditingEnd).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  })

  it("distinguishes nullable null from a literal sentinel-like string option", () => {
    const onLiteralCommit = vi.fn()
    const literalView = renderEnumCellForTest({
      effectiveValue: null,
      fieldMetadata: {
        fieldPath: "status",
        rawSchema: { enum: ["__null__", null] },
        schema: { enum: ["__null__", null] },
        effectiveSchema: { enum: ["__null__", null] },
        isNullable: true,
        kind: "enum",
        enumValues: ["__null__", null],
      },
      commitValue: onLiteralCommit,
    })

    fireEvent.click(
      literalView.getAllByRole("option", { name: "__null__" }).at(-1)!
    )
    expect(onLiteralCommit).toHaveBeenCalledWith(
      "__null__",
      expect.objectContaining({ kind: "select", rawValue: "option:0" })
    )
    cleanup()

    const onNullCommit = vi.fn()
    const nullView = renderEnumCellForTest({
      effectiveValue: "__null__",
      fieldMetadata: {
        fieldPath: "status",
        rawSchema: { enum: ["__null__", null] },
        schema: { enum: ["__null__", null] },
        effectiveSchema: { enum: ["__null__", null] },
        isNullable: true,
        kind: "enum",
        enumValues: ["__null__", null],
      },
      commitValue: onNullCommit,
    })

    fireEvent.click(nullView.getByRole("option", { name: /no selection/i }))
    expect(onNullCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "select",
        rawValue: "__json_table_null__",
      })
    )
  })

  it("commits the null sentinel only for nullable enum fields", () => {
    const onNullableCommit = vi.fn()
    const nullableView = renderEnumCellForTest({
      effectiveValue: null,
      fieldMetadata: {
        fieldPath: "status",
        rawSchema: { enum: ["approved", null] },
        schema: { enum: ["approved", null] },
        effectiveSchema: { enum: ["approved", null] },
        isNullable: true,
        kind: "enum",
        enumValues: ["approved", null],
      },
      commitValue: onNullableCommit,
    })

    fireEvent.click(
      nullableView.getAllByRole("option", { name: /no selection/i }).at(-1)!
    )
    expect(onNullableCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "select",
        rawValue: "__json_table_null__",
      })
    )
    cleanup()

    const onRequiredCommit = vi.fn()
    const requiredView = renderEnumCellForTest({
      effectiveValue: "approved",
      fieldMetadata: {
        fieldPath: "status",
        rawSchema: { enum: ["approved"] },
        schema: { enum: ["approved"] },
        effectiveSchema: { enum: ["approved"] },
        isNullable: false,
        kind: "enum",
        enumValues: ["approved"],
      },
      commitValue: onRequiredCommit,
    })

    expect(
      requiredView.queryByRole("option", { name: /no selection/i })
    ).toBeNull()
  })

  it("selects structurally equal object enum values", () => {
    const view = renderEnumCellForTest({
      effectiveValue: { code: "approved" },
      fieldMetadata: {
        fieldPath: "status",
        rawSchema: { enum: [{ code: "approved" }, { code: "rejected" }] },
        schema: { enum: [{ code: "approved" }, { code: "rejected" }] },
        effectiveSchema: {
          enum: [{ code: "approved" }, { code: "rejected" }],
        },
        isNullable: false,
        kind: "enum",
        enumValues: [{ code: "approved" }, { code: "rejected" }],
      },
    })

    const selectedOption = view.getAllByRole("option", {
      name: "[object Object]",
    })[0]
    expect(selectedOption?.getAttribute("aria-selected")).toBe("true")
  })

  it("commits a clicked option and ends editing once", () => {
    const onEditingEnd = vi.fn()
    const onCommit = vi.fn()
    const view = renderEnumCellForTest({
      effectiveValue: "draft",
      fieldMetadata: {
        fieldPath: "status",
        rawSchema: { enum: ["draft", "paid"] },
        schema: { enum: ["draft", "paid"] },
        effectiveSchema: { enum: ["draft", "paid"] },
        isNullable: false,
        kind: "enum",
        enumValues: ["draft", "paid"],
      },
      onEditingEnd,
      commitValue: onCommit,
    })

    fireEvent.click(view.getByRole("option", { name: "paid" }))

    expect(onCommit).toHaveBeenCalledWith(
      "paid",
      expect.objectContaining({ kind: "select", rawValue: "option:1" })
    )
    expect(onEditingEnd).toHaveBeenCalledTimes(1)
  })

  it("closes immediately after a dropdown dismisses without selecting a value", () => {
    const onEditingEnd = vi.fn()
    const onOpenChange = vi.fn()
    const view = renderEnumCellForTest({ onEditingEnd, onOpenChange })

    fireEvent.keyDown(view.getByRole("combobox"), { key: "Escape" })

    expect(onEditingEnd).toHaveBeenCalledTimes(1)
  })
})
