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
import {
  formatEnumValueInput,
  parseEnumValueInput,
} from "@/components/schema-editor/property-form/model/enum-values"
import {
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import { PropertyForm } from "@/components/schema-editor/property-form/property-form"
import type {
  PropertyCapabilities,
  PropertyValidation,
} from "@/components/schema-editor/property-form/types"
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

function invalidValidation(message = "Custom validation failed") {
  return {
    name: { status: "invalid", message, code: "custom_invalid" },
    schemaNode: { status: "valid" },
    canCommit: false,
  } satisfies PropertyValidation
}

function editableCapabilities(
  overrides: Partial<PropertyCapabilities> = {}
): PropertyCapabilities {
  return {
    mode: "editable",
    canEditName: true,
    canEditType: true,
    canEditNullable: true,
    canEditDescription: true,
    canEditNestedObject: true,
    canEditArrayItems: true,
    canEditEnumValues: true,
    canDelete: true,
    ...overrides,
  }
}

async function selectDataType(label: string, triggerIndex = 0) {
  const triggers = screen.getAllByRole("button", { name: /^Data type/ })
  fireEvent.pointerDown(triggers[triggerIndex], {
    button: 0,
    ctrlKey: false,
  })
  fireEvent.click(await screen.findByText(label))
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

  it("does not bypass provided invalid validation when submitting with Enter", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext()}
        validation={invalidValidation()}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    const nameInput = screen.getByLabelText("Name")

    expect(screen.getByRole("button", { name: "Save Changes" })).toHaveProperty(
      "disabled",
      true
    )
    fireEvent.keyDown(nameInput, { key: "Enter" })

    await waitFor(() => expect(onCommitPropertyDraft).not.toHaveBeenCalled())
  })

  it("commits with a custom submit label and calls cancel and delete actions", async () => {
    const onCancel = vi.fn()
    const onDelete = vi.fn()
    const onCommitPropertyDraft = vi.fn()

    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext()}
        submitLabel="Apply"
        onCancel={onCancel}
        onDelete={onDelete}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete Property" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
  })

  it("allows only description edits in description-only mode", async () => {
    const onCommitPropertyDraft = vi.fn()
    const onDelete = vi.fn()

    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string", description: "old description" },
        }}
        schemaContext={baseSchemaContext()}
        mode="descriptionOnly"
        onDelete={onDelete}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByLabelText("Name")).toHaveProperty("disabled", true)
    expect(screen.getByRole("button", { name: "Data type" })).toHaveProperty(
      "disabled",
      true
    )
    expect(screen.getByLabelText("Nullable")).toHaveProperty("disabled", true)
    expect(screen.queryByRole("button", { name: "Delete Property" })).toBeNull()

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "new description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "invoice_number",
      schemaNode: {
        type: "string",
        description: "new description",
        title: "InvoiceNumber",
      },
    })
    expect(onDelete).not.toHaveBeenCalled()
  })

  it("keeps description-only mode authoritative over editable capabilities", async () => {
    const onCommitPropertyDraft = vi.fn()
    const onDelete = vi.fn()

    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string", description: "old description" },
        }}
        schemaContext={baseSchemaContext()}
        mode="descriptionOnly"
        capabilities={editableCapabilities()}
        onDelete={onDelete}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByLabelText("Name")).toHaveProperty("disabled", true)
    expect(screen.getByRole("button", { name: "Data type" })).toHaveProperty(
      "disabled",
      true
    )
    expect(screen.queryByRole("button", { name: "Delete Property" })).toBeNull()

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "new description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "invoice_number",
      schemaNode: {
        type: "string",
        description: "new description",
        title: "InvoiceNumber",
      },
    })
    expect(onDelete).not.toHaveBeenCalled()
  })

  it("allows description-only saves when the locked name would otherwise be invalid", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "1legacy_name",
          schemaNode: { type: "string", description: "old description" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["1legacy_name"],
          originalName: "1legacy_name",
        })}
        mode="descriptionOnly"
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "new description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "1legacy_name",
      schemaNode: {
        type: "string",
        description: "new description",
        title: "1legacyName",
      },
    })
  })

  it("allows description-only saves when locked schema details would otherwise be invalid", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: {
            type: "string",
            enum: [],
            description: "old description",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        mode="descriptionOnly"
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "new description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "status",
      schemaNode: {
        type: "string",
        enum: [],
        description: "new description",
        title: "Status",
      },
    })
  })

  it("honors explicit capabilities by locking fields and hiding disabled nested editors", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: {
            type: "object",
            properties: {
              total: { type: "number" },
            },
            required: ["total"],
            description: "old",
          },
        }}
        schemaContext={baseSchemaContext()}
        capabilities={editableCapabilities({
          canEditName: false,
          canEditType: false,
          canEditNullable: false,
          canEditNestedObject: false,
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByLabelText("Name")).toHaveProperty("disabled", true)
    expect(screen.getByRole("button", { name: "Data type" })).toHaveProperty(
      "disabled",
      true
    )
    expect(screen.getByLabelText("Nullable")).toHaveProperty("disabled", true)
    expect(screen.queryByLabelText("Field name total")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Remove field total" })
    ).toBeNull()

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "allowed description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "invoice_number",
      schemaNode: {
        type: "object",
        properties: {
          total: { type: "number" },
        },
        required: ["total"],
        description: "allowed description",
        title: "InvoiceNumber",
      },
    })
  })

  it("does not submit from plain Enter in the description but does with Control+Enter", async () => {
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

    const description = screen.getByLabelText("Description")

    fireEvent.keyDown(description, { key: "Enter" })
    fireEvent.keyDown(description, { key: "Enter", shiftKey: true })
    expect(onCommitPropertyDraft).not.toHaveBeenCalled()

    fireEvent.keyDown(description, { key: "Enter", ctrlKey: true })

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
  })

  it("does not submit when Enter is pressed on the data type trigger", () => {
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

    fireEvent.keyDown(screen.getByRole("button", { name: "Data type" }), {
      key: "Enter",
    })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
  })

  it("does not submit while an input method editor composition is active", () => {
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

    fireEvent.keyDown(screen.getByLabelText("Name"), {
      key: "Enter",
      isComposing: true,
    })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
  })

  it("updates nullable state without losing type metadata or description", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "due_date",
          schemaNode: {
            type: "string",
            format: "date",
            description: "Invoice due date",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["due_date"],
          originalName: "due_date",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.click(screen.getByLabelText("Nullable"))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "due_date",
      schemaNode: {
        anyOf: [{ type: "string", format: "date" }, { type: "null" }],
        description: "Invoice due date",
        title: "DueDate",
      },
    })
  })

  it("blocks committing an enum after the last option is removed", async () => {
    const onCommitPropertyDraft = vi.fn()
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
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Remove option draft" }))

    expect(
      await screen.findByText("Multiple choice fields need at least one option")
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save Changes" })).toHaveProperty(
      "disabled",
      true
    )
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" })

    await waitFor(() => expect(onCommitPropertyDraft).not.toHaveBeenCalled())
  })

  it("adds enum options using JSON parsing and includes them in the commit", async () => {
    const onCommitPropertyDraft = vi.fn()
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
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByPlaceholderText("Add new value"), {
      target: { value: "42" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "status",
      schemaNode: {
        type: "string",
        enum: ["draft", 42],
        title: "Status",
      },
    })
    expect(screen.getByPlaceholderText("Add new value")).toHaveProperty(
      "value",
      ""
    )
  })

  it("does not submit the form when Enter adds an enum option", async () => {
    const onCommitPropertyDraft = vi.fn()
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
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    const nextValueInput = screen.getByPlaceholderText("Add new value")
    fireEvent.change(nextValueInput, {
      target: { value: "paid" },
    })
    fireEvent.keyDown(nextValueInput, { key: "Enter" })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue("paid")).toBeTruthy()
  })

  it("does not submit the form when Enter is pressed in an existing enum option", async () => {
    const onCommitPropertyDraft = vi.fn()
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
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.keyDown(screen.getByDisplayValue("draft"), { key: "Enter" })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
  })

  it("adds, renames, and removes object fields while preserving order and required flags", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: {
              city: { type: "string" },
              zip: { type: "string" },
            },
            required: ["city", "zip"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["address"],
          originalName: "address",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByLabelText("New object field"), {
      target: { value: "country" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.change(screen.getByLabelText("Field name zip"), {
      target: { value: "postal_code" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Remove field city" }))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft.mock.calls[0][0]).toEqual({
      name: "address",
      schemaNode: {
        type: "object",
        properties: {
          postal_code: { type: "string" },
          country: { type: "string", title: "Country" },
        },
        required: ["postal_code", "country"],
        title: "Address",
      },
    })
    expect(
      Object.keys(onCommitPropertyDraft.mock.calls[0][0].schemaNode.properties)
    ).toEqual(["postal_code", "country"])
  })

  it("does not submit the form when Enter adds an object field", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: {
              city: { type: "string" },
            },
            required: ["city"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["address"],
          originalName: "address",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    const newFieldInput = screen.getByLabelText("New object field")
    fireEvent.change(newFieldInput, {
      target: { value: "country" },
    })
    fireEvent.keyDown(newFieldInput, { key: "Enter" })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Field name country")).toBeTruthy()
  })

  it("does not submit the form when Enter is pressed in an existing object field name", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: {
              city: { type: "string" },
            },
            required: ["city"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["address"],
          originalName: "address",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.keyDown(screen.getByLabelText("Field name city"), {
      key: "Enter",
    })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
  })

  it("rejects invalid and duplicate object field edits without mutating the draft", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: {
              city: { type: "string" },
              zip: { type: "string" },
            },
            required: ["city"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["address"],
          originalName: "address",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByLabelText("New object field"), {
      target: { value: "zip" },
    })
    expect(screen.getByRole("button", { name: "Add" })).toHaveProperty(
      "disabled",
      true
    )

    fireEvent.change(screen.getByLabelText("Field name city"), {
      target: { value: "zip" },
    })
    expect(screen.getByLabelText("Field name city")).toHaveProperty(
      "value",
      "city"
    )

    fireEvent.change(screen.getByLabelText("Field name city"), {
      target: { value: "1bad" },
    })
    expect(screen.getByLabelText("Field name city")).toHaveProperty(
      "value",
      "city"
    )

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "address",
      schemaNode: {
        type: "object",
        properties: {
          city: { type: "string" },
          zip: { type: "string" },
        },
        required: ["city"],
        title: "Address",
      },
    })
  })

  it("changes primitive data type through the picker and preserves description metadata", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "amount",
          schemaNode: {
            type: "string",
            description: "Invoice amount",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["amount"],
          originalName: "amount",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    await selectDataType("number")
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "amount",
      schemaNode: {
        type: "number",
        description: "Invoice amount",
        title: "Amount",
      },
    })
  })

  it("keeps nullable wrapping when changing primitive data type", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "amount",
          schemaNode: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Nullable amount",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["amount"],
          originalName: "amount",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    await selectDataType("integer")
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "amount",
      schemaNode: {
        anyOf: [{ type: "integer" }, { type: "null" }],
        description: "Nullable amount",
        title: "Amount",
      },
    })
  })

  it("requires an option after changing to multiple choice and then commits after adding one", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: { type: "string", description: "Workflow status" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    await selectDataType("multiple choice")

    expect(
      await screen.findByText("Multiple choice fields need at least one option")
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save Changes" })).toHaveProperty(
      "disabled",
      true
    )

    fireEvent.change(screen.getByPlaceholderText("Add new value"), {
      target: { value: "paid" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "status",
      schemaNode: {
        type: "string",
        enum: ["paid"],
        description: "Workflow status",
        title: "Status",
      },
    })
  })

  it("creates an empty object schema with required fields list when changing to object", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: { type: "string", description: "Billing address" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["address"],
          originalName: "address",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    await selectDataType("object")
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "address",
      schemaNode: {
        type: "object",
        properties: {},
        required: [],
        description: "Billing address",
        title: "Address",
      },
    })
  })

  it("edits array item type through the nested item editor", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "amounts",
          schemaNode: {
            type: "array",
            items: { type: "string" },
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["amounts"],
          originalName: "amounts",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByText("List item type")).toBeTruthy()
    await selectDataType("number", 1)
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "amounts",
      schemaNode: {
        type: "array",
        items: { type: "number" },
        title: "Amounts",
      },
    })
  })

  it("selects definitions through commands and commits a reference", async () => {
    const onCommand = vi.fn()
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "billing_address",
          schemaNode: { type: "object", properties: {}, required: [] },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["billing_address"],
          originalName: "billing_address",
          schemaDefinitions: {
            Address: {
              type: "object",
              properties: { city: { type: "string" } },
            },
          },
          onCommand,
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    const trigger = screen.getByRole("button", { name: "Data type" })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    const definitionTrigger = await screen.findByText("definition")
    fireEvent.focus(definitionTrigger)
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" })
    fireEvent.click(await screen.findByText("Address"))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(onCommand).toHaveBeenCalledWith({
      type: "selectDefinition",
      definitionName: "Address",
    })
    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "billing_address",
      schemaNode: {
        $ref: "#/$defs/Address",
        title: "BillingAddress",
      },
    })
  })

  it("preserves description when selecting a definition", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "billing_address",
          schemaNode: {
            type: "object",
            description: "Where invoices are sent",
            properties: {},
            required: [],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["billing_address"],
          originalName: "billing_address",
          schemaDefinitions: {
            Address: {
              type: "object",
              properties: { city: { type: "string" } },
            },
          },
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    const trigger = screen.getByRole("button", { name: "Data type" })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    const definitionTrigger = await screen.findByText("definition")
    fireEvent.focus(definitionTrigger)
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" })
    fireEvent.click(await screen.findByText("Address"))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "billing_address",
      schemaNode: {
        $ref: "#/$defs/Address",
        description: "Where invoices are sent",
        title: "BillingAddress",
      },
    })
  })

  it("preserves nullable wrapping and description when selecting a definition", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "billing_address",
          schemaNode: {
            anyOf: [
              {
                type: "object",
                properties: {},
                required: [],
              },
              { type: "null" },
            ],
            description: "Optional invoice address",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["billing_address"],
          originalName: "billing_address",
          schemaDefinitions: {
            Address: {
              type: "object",
              properties: { city: { type: "string" } },
            },
          },
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    const trigger = screen.getByRole("button", { name: "Data type" })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    const definitionTrigger = await screen.findByText("definition")
    fireEvent.focus(definitionTrigger)
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" })
    fireEvent.click(await screen.findByText("Address"))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "billing_address",
      schemaNode: {
        anyOf: [{ $ref: "#/$defs/Address" }, { type: "null" }],
        description: "Optional invoice address",
        title: "BillingAddress",
      },
    })
  })

  it("dispatches create definition without mutating the draft", async () => {
    const onCommand = vi.fn()
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "billing_address",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["billing_address"],
          originalName: "billing_address",
          schemaDefinitions: {},
          onCommand,
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.pointerDown(screen.getByRole("button", { name: "Data type" }), {
      button: 0,
      ctrlKey: false,
    })
    const definitionTrigger = await screen.findByText("definition")
    fireEvent.focus(definitionTrigger)
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" })
    fireEvent.click(await screen.findByText("Create new definition"))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(onCommand).toHaveBeenCalledWith({ type: "createDefinition" })
    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "billing_address",
      schemaNode: {
        type: "string",
        title: "BillingAddress",
      },
    })
  })

  it("resets local edits when a new property draft prop is received", () => {
    const onCommitPropertyDraft = vi.fn()
    const view = render(
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
      target: { value: "edited" },
    })

    view.rerender(
      <PropertyForm
        propertyDraft={{
          name: "total",
          schemaNode: { type: "number", description: "next" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["invoice_number", "total"],
          originalName: "total",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByLabelText("Name")).toHaveProperty("value", "total")
    expect(screen.getByLabelText("Description")).toHaveProperty("value", "next")
    expect(
      screen.getByRole("button", { name: "Data type" }).textContent
    ).toContain("number")
  })

  it("re-enables actions after a rejected commit and allows retrying", async () => {
    const onCommitPropertyDraft = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce(undefined)
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

    await waitFor(() => expect(saveButton).toHaveProperty("disabled", false))

    fireEvent.click(saveButton)

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(2))
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

  it("does not commit from keyboard shortcuts in read-only mode", () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string", description: "read only" },
        }}
        schemaContext={baseSchemaContext()}
        mode="readOnly"
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.keyDown(screen.getByLabelText("Description"), {
      key: "Enter",
      ctrlKey: true,
    })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
  })

  it("keeps read-only mode authoritative over editable capabilities", () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice_number",
          schemaNode: { type: "string", description: "read only" },
        }}
        schemaContext={baseSchemaContext()}
        mode="readOnly"
        capabilities={editableCapabilities()}
        onCommitPropertyDraft={onCommitPropertyDraft}
        onDelete={() => {}}
      />
    )

    expect(screen.getByLabelText("Name")).toHaveProperty("disabled", true)
    expect(screen.getByLabelText("Description")).toHaveProperty(
      "disabled",
      true
    )
    expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull()

    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
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

  it("renders nullable referenced definitions by definition name", () => {
    render(
      <PropertyForm
        propertyDraft={{
          name: "billing_address",
          schemaNode: {
            anyOf: [{ $ref: "#/$defs/Address" }, { type: "null" }],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["billing_address"],
          originalName: "billing_address",
          schemaDefinitions: {
            Address: {
              type: "object",
              properties: { city: { type: "string" } },
            },
          },
        })}
        onCommitPropertyDraft={() => {}}
      />
    )

    expect(
      screen.getByRole("button", { name: "Data type" }).textContent
    ).toContain("Address")
  })
})
