// @vitest-environment jsdom

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { EnumEditor } from "@/components/json-table/cell-editors/enum-editor"

import {
  baseField,
  baseOverlays,
  baseTextDraft,
} from "./json-table-editor-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

const selectContext = {
  onValueChange: (_value: string) => {},
  value: "",
}

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode
    onValueChange: (value: string) => void
    value: string
  }) => {
    selectContext.onValueChange = onValueChange
    selectContext.value = value
    return <div>{children}</div>
  },
  SelectTrigger: ({
    children,
    ...props
  }: {
    children: ReactNode
  } & ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder ?? "value"}</span>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div data-slot="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <button type="button" onClick={() => selectContext.onValueChange(value)}>
      {children}
    </button>
  ),
}))

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

function renderEnumEditor(
  overrides: Partial<CellEditorProps> = {}
): ReturnType<typeof render> {
  const props: CellEditorProps = {
    identity: {
      docId: "doc_1",
      fieldPath: "status",
    },
    field: baseField("enum"),
    textDraft: baseTextDraft(),
    focus: {
      focusedField: null,
      setFocusedField: vi.fn(),
      setIsInputFocused: vi.fn(),
    },
    overlays: { ...baseOverlays(), showInput: true },
    commit: { onCommit: vi.fn() },
    ...overrides,
  }

  return render(<EnumEditor {...props} />)
}

describe("json table enum editor", () => {
  it("commits integer enum values as numbers", () => {
    const onCommit = vi.fn()
    const view = renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
      commit: { onCommit },
    })

    fireEvent.click(view.getByRole("button", { name: "2" }))

    expect(onCommit).toHaveBeenCalledWith(2)
  })

  it("commits number enum values as numbers", () => {
    const onCommit = vi.fn()
    const view = renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
      commit: { onCommit },
    })

    fireEvent.click(view.getByRole("button", { name: "2.25" }))

    expect(onCommit).toHaveBeenCalledWith(2.25)
  })

  it("commits boolean enum values as booleans", () => {
    const onCommit = vi.fn()
    const view = renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
      commit: { onCommit },
    })

    fireEvent.click(view.getByRole("button", { name: "true" }))

    expect(onCommit).toHaveBeenCalledWith(true)
  })

  it("renders the selected option label in the trigger, not the internal option id", () => {
    const view = renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
    })

    const trigger = view.container.querySelector<HTMLElement>(
      '[data-slot="data-cell"]'
    )
    if (!trigger) throw new Error("Missing enum trigger")
    expect(trigger.textContent).toContain("DEBIT")
    expect(trigger.textContent).not.toContain("option:")
    expect(selectContext.value).toBe("option:1")
  })

  it("renders literal sentinel-like string enum values", () => {
    const view = renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
      overlays: { ...baseOverlays(), showInput: false },
    })

    expect(view.getByText("__null__")).toBeTruthy()
  })

  it("distinguishes nullable null from a literal sentinel-like string option", () => {
    const onCommit = vi.fn()
    const view = renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
      commit: { onCommit },
    })

    fireEvent.click(view.getAllByRole("button", { name: "__null__" }).at(-1)!)
    expect(onCommit).toHaveBeenCalledWith("__null__")

    fireEvent.click(view.getByRole("button", { name: /no selection/i }))
    expect(onCommit).toHaveBeenCalledWith(null)
  })

  it("commits the null sentinel only for nullable enum fields", () => {
    const onNullableCommit = vi.fn()
    const nullableView = renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
      commit: { onCommit: onNullableCommit },
    })

    fireEvent.click(
      nullableView.getAllByRole("button", { name: /no selection/i }).at(-1)!
    )
    expect(onNullableCommit).toHaveBeenCalledWith(null)
    cleanup()

    const onRequiredCommit = vi.fn()
    const requiredView = renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
      commit: { onCommit: onRequiredCommit },
    })

    expect(
      requiredView.queryByRole("button", { name: /no selection/i })
    ).toBeNull()
  })

  it("selects structurally equal object enum values", () => {
    renderEnumEditor({
      field: {
        ...baseField("enum"),
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
      },
    })

    expect(selectContext.value).toBe("option:0")
  })
})
