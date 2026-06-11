// @vitest-environment jsdom
import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { PropertyForm } from "@/components/schema-editor/property-form"
import { propertyDraftReducer } from "@/components/schema-editor/property-form-reducer"
import { validatePropertyFormName } from "@/components/schema-editor/property-form-validation"

const originalResizeObserver = globalThis.ResizeObserver

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver
})

function baseSchemaContext(overrides = {}) {
  return {
    siblingNames: ["invoice_number", "total"],
    originalName: "invoice_number",
    schemaDefinitions: {},
    ...overrides,
  }
}

describe("propertyDraftReducer", () => {
  it("writes nullable array item edits into the non-null branch", () => {
    const draft = {
      name: "items",
      schemaNode: {
        anyOf: [{ type: "array", items: { type: "number" } }, { type: "null" }],
      } as ExtendedJSONSchema7,
    }

    const next = propertyDraftReducer(draft, {
      type: "setArrayItemSchemaNode",
      schemaNode: { type: "boolean" },
    })

    expect(next.schemaNode).toEqual({
      anyOf: [{ type: "array", items: { type: "boolean" } }, { type: "null" }],
    })
  })

  it("keeps nullable wrappers when replacing the effective node", () => {
    const draft = {
      name: "address",
      schemaNode: {
        anyOf: [
          { type: "object", properties: { city: { type: "string" } } },
          { type: "null" },
        ],
      } as ExtendedJSONSchema7,
    }

    const next = propertyDraftReducer(draft, {
      type: "replaceEffectiveSchemaNode",
      schemaNode: {
        type: "object",
        properties: {
          city: { type: "string" },
          zip: { type: "string" },
        },
      },
    })

    const anyOf = next.schemaNode.anyOf as ExtendedJSONSchema7[]
    expect(anyOf[0].properties).toEqual({
      city: { type: "string" },
      zip: { type: "string" },
    })
    expect(anyOf[1]).toEqual({ type: "null" })
  })

  it("writes nullable enum edits into the non-null branch", () => {
    const draft = {
      name: "status",
      schemaNode: {
        anyOf: [{ type: "string", enum: ["draft"] }, { type: "null" }],
      } as ExtendedJSONSchema7,
    }

    const next = propertyDraftReducer(draft, {
      type: "setEnumValues",
      values: ["draft", "paid"],
    })

    expect(next.schemaNode).toEqual({
      anyOf: [
        { type: "string", enum: ["draft", "paid"] },
        { type: "null" },
      ],
    })
  })
})

describe("PropertyForm validation", () => {
  it("validates against the provided parent sibling names", () => {
    expect(
      validatePropertyFormName({
        name: "total",
        siblingNames: ["invoice_number", "total"],
        originalName: "invoice_number",
      })
    ).toContain("already exists")

    expect(
      validatePropertyFormName({
        name: "root_duplicate",
        siblingNames: ["city", "street"],
        originalName: "city",
      })
    ).toBeNull()
  })
})

describe("PropertyForm", () => {
  it("commits a valid edited draft", async () => {
    const onCommit = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string", description: "old" },
        }}
        schemaContext={baseSchemaContext()}
        onCommitPropertyDraft={onCommit}
      />
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "invoice_id" },
    })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "new description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1))
    expect(onCommit).toHaveBeenCalledWith({
      name: "invoice_id",
      schemaNode: {
        type: "string",
        description: "new description",
        title: "InvoiceId",
      },
    })
  })

  it("does not commit duplicate sibling names", async () => {
    const onCommit = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext()}
        onCommitPropertyDraft={onCommit}
      />
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "total" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText(/already exists/)).toBeTruthy()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("renders no save or delete actions in read-only mode", () => {
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext()}
        mode="readOnly"
        onCommitPropertyDraft={() => {}}
        onDelete={() => {}}
      />
    )

    expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Delete Property" })).toBeNull()
  })

  it("renders nullable array item editors without a schema provider", () => {
    render(
      <PropertyForm
        propertyDraft={{
          name: "amounts",
          schemaNode: {
            anyOf: [
              { type: "array", items: { type: "number" } },
              { type: "null" },
            ],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["amounts"],
          originalName: "amounts",
        })}
        onCommitPropertyDraft={() => {}}
      />,
    )

    expect(screen.getByText("List item type")).toBeTruthy()
    expect(screen.getByText("number")).toBeTruthy()
  })
})
