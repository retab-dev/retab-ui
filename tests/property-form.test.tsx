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
import {
  formatEnumValueInput,
  parseEnumValueInput,
} from "@/components/schema-editor/property-form/model/enum-values"
import {
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import { validatePropertyFormName } from "@/components/schema-editor/property-form/validation"

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

describe("property form models", () => {
  it("parses enum input as JSON when possible and as strings otherwise", () => {
    expect(parseEnumValueInput("paid")).toBe("paid")
    expect(parseEnumValueInput('"paid"')).toBe("paid")
    expect(parseEnumValueInput("42")).toBe(42)
    expect(parseEnumValueInput("true")).toBe(true)
    expect(parseEnumValueInput("null")).toBeNull()
    expect(parseEnumValueInput('{"code":"paid"}')).toEqual({ code: "paid" })
    expect(formatEnumValueInput({ code: "paid" })).toBe('{"code":"paid"}')
  })

  it("keeps object property order and required flags during edits", () => {
    const schemaNode: ExtendedJSONSchema7 = {
      type: "object",
      properties: {
        city: { type: "string" },
        zip: { type: "string" },
      },
      required: ["city"],
    }

    const renamed = renameObjectProperty({
      schemaNode,
      oldName: "city",
      newName: "town",
    })
    expect(Object.keys(renamed.properties || {})).toEqual(["town", "zip"])
    expect(renamed.required).toEqual(["town"])

    const duplicate = renameObjectProperty({
      schemaNode: renamed,
      oldName: "town",
      newName: "zip",
    })
    expect(duplicate).toBe(renamed)

    const replaced = replaceObjectProperty({
      schemaNode: renamed,
      propertyName: "country",
      propertySchema: { type: "string" },
    })
    expect(Object.keys(replaced.properties || {})).toEqual([
      "town",
      "zip",
      "country",
    ])
    expect(replaced.required).toEqual(["town", "country"])

    const removed = removeObjectProperty({
      schemaNode: replaced,
      propertyName: "town",
    })
    expect(Object.keys(removed.properties || {})).toEqual(["zip", "country"])
    expect(removed.required).toEqual(["country"])
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
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string", description: "old" },
        }}
        schemaContext={baseSchemaContext()}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "invoice_id" },
    })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "new description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "invoice_id",
      schemaNode: {
        type: "string",
        description: "new description",
        title: "InvoiceId",
      },
    })
  })

  it("emits property draft changes outside the state updater", async () => {
    const onPropertyDraftChange = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext()}
        onPropertyDraftChange={onPropertyDraftChange}
        onCommitPropertyDraft={() => {}}
      />
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "invoice_id" },
    })

    await waitFor(() =>
      expect(onPropertyDraftChange).toHaveBeenCalledWith({
        name: "invoice_id",
        schemaNode: { type: "string" },
      })
    )
  })

  it("commits the latest draft when submit happens during draft change", async () => {
    let saveButton: HTMLElement | null = null
    const onCommitPropertyDraft = vi.fn()
    const onPropertyDraftChange = vi.fn(() => {
      if (saveButton) fireEvent.click(saveButton)
    })

    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext()}
        onPropertyDraftChange={onPropertyDraftChange}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    saveButton = screen.getByRole("button", { name: "Save Changes" })

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "invoice_id" },
    })

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "invoice_id",
      schemaNode: {
        type: "string",
        title: "InvoiceId",
      },
    })
  })

  it("does not start a second commit while submit is pending", async () => {
    let resolveCommit: () => void = () => {}
    const commitPromise = new Promise<void>((resolve) => {
      resolveCommit = resolve
    })
    const onCommitPropertyDraft = vi.fn(() => commitPromise)

    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext()}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    const saveButton = screen.getByRole("button", { name: "Save Changes" })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(saveButton).toHaveProperty("disabled", true))

    resolveCommit()

    await waitFor(() => expect(saveButton).toHaveProperty("disabled", false))
  })

  it("does not commit duplicate sibling names", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext()}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "total" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText(/already exists/)).toBeTruthy()
    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
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

  it("keeps enum value input focus while editing the value", () => {
    render(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: { type: "string", enum: ["draft"] },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        onCommitPropertyDraft={() => {}}
      />
    )

    const enumValueInput = screen.getByDisplayValue("draft")
    enumValueInput.focus()

    fireEvent.change(enumValueInput, {
      target: { value: "paid" },
    })

    expect(document.activeElement).toBe(enumValueInput)
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
      />
    )

    expect(screen.getByText("List item type")).toBeTruthy()
    expect(screen.getByText("number")).toBeTruthy()
  })
})
