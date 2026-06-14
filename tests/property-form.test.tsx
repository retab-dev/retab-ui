// @vitest-environment jsdom
import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
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
import { useEnumValueIdentity } from "@/components/schema-editor/property-form/fields/enum-value-identity"
import { EnumValuesField } from "@/components/schema-editor/property-form/fields/enum-values-field"
import { useObjectPropertiesModel } from "@/components/schema-editor/property-form/fields/object-properties-model"
import {
  formatEnumValueInput,
  parseEnumValueInput,
} from "@/components/schema-editor/property-form/model/enum-values"
import {
  moveObjectProperty,
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import { PropertyForm } from "@/components/schema-editor/property-form/property-form"
import type {
  PropertyCapabilities,
  PropertyDraft,
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
  fireEvent.click(triggers[triggerIndex])
  fireEvent.click(await screen.findByText(label))
}

function openInlineFieldName(name: string) {
  const input = screen.getByLabelText(`Field name ${name}`)
  fireEvent.focus(input)
  return input
}

function renameInlineField(name: string, nextName: string) {
  const input = openInlineFieldName(name)
  fireEvent.change(input, { target: { value: nextName } })
  fireEvent.keyDown(input, { key: "Enter" })
}

function createDragDataTransfer(): DataTransfer {
  const data = new Map<string, string>()
  return {
    effectAllowed: "uninitialized",
    dropEffect: "none",
    setData: (format: string, value: string) => {
      data.set(format, value)
    },
    getData: (format: string) => data.get(format) ?? "",
    setDragImage: () => undefined,
  } as unknown as DataTransfer
}

function getPropertyFormRow(propertyName: string) {
  const row = document.querySelector(
    `[data-property-form-property-name="${propertyName}"]`
  )
  expect(row).toBeTruthy()
  return row as HTMLElement
}

describe("property form models", () => {
  it("parses enum input as JSON when possible and as strings otherwise", () => {
    expect(parseEnumValueInput("paid")).toBe("paid")
    expect(parseEnumValueInput(" paid ")).toBe("paid")
    expect(parseEnumValueInput('"paid"')).toBe("paid")
    expect(parseEnumValueInput("42")).toBe(42)
    expect(parseEnumValueInput("true")).toBe(true)
    expect(parseEnumValueInput("null")).toBeNull()
    expect(parseEnumValueInput('{"code":"paid"}')).toEqual({ code: "paid" })
    expect(formatEnumValueInput({ code: "paid" })).toBe('{"code":"paid"}')
  })

  it("preserves enum identity across replace, remove, and add until reset", () => {
    const { result, rerender } = renderHook(
      ({ resetKey, values }: { resetKey: string; values: string[] }) =>
        useEnumValueIdentity({ resetKey, values }),
      {
        initialProps: {
          resetKey: "schema-a",
          values: ["USD", "EUR"],
        },
      }
    )

    const [usdId, eurId] = result.current.ids

    rerender({ resetKey: "schema-a", values: ["CAD", "EUR"] })
    expect(result.current.ids).toEqual([usdId, eurId])

    act(() => {
      result.current.removeId(usdId)
    })
    rerender({ resetKey: "schema-a", values: ["EUR"] })
    expect(result.current.ids).toEqual([eurId])

    rerender({ resetKey: "schema-a", values: ["EUR", "GBP"] })
    expect(result.current.ids[0]).toBe(eurId)
    expect(result.current.ids[1]).not.toBe(usdId)
    expect(result.current.ids[1]).not.toBe(eurId)

    rerender({ resetKey: "schema-b", values: ["EUR", "GBP"] })
    expect(result.current.ids).toEqual(["enum-value-0", "enum-value-1"])
  })

  it("emits only schema enum values from enum field changes", () => {
    const onChange = vi.fn()
    const view = render(
      <EnumValuesField
        values={["USD"]}
        resetKey="schema-a"
        disabled={false}
        onChange={onChange}
      />
    )

    fireEvent.change(screen.getByLabelText("Option 1: USD"), {
      target: { value: "CAD" },
    })
    expect(onChange).toHaveBeenLastCalledWith(["CAD"])

    fireEvent.change(screen.getByLabelText("Add new value"), {
      target: { value: "EUR" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    expect(onChange).toHaveBeenLastCalledWith(["USD", "EUR"])

    view.rerender(
      <EnumValuesField
        values={["USD"]}
        resetKey="schema-a"
        disabled={false}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove option USD" }))
    expect(onChange).toHaveBeenLastCalledWith([])
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

  it("moves object properties without changing required semantics", () => {
    const street = { type: "string" } satisfies ExtendedJSONSchema7
    const city = { type: "string" } satisfies ExtendedJSONSchema7
    const zip = { type: "string" } satisfies ExtendedJSONSchema7
    const schemaNode: ExtendedJSONSchema7 = {
      type: "object",
      description: "Address",
      properties: { street, city, zip },
      required: ["street", "zip"],
    }

    const firstToEnd = moveObjectProperty({
      schemaNode,
      propertyName: "street",
      targetIndex: 99,
    })
    expect(Object.keys(firstToEnd.properties || {})).toEqual([
      "city",
      "zip",
      "street",
    ])
    expect(firstToEnd.required).toEqual(["street", "zip"])
    expect(firstToEnd.description).toBe("Address")
    expect(firstToEnd.properties?.street).toBe(street)

    const lastToStart = moveObjectProperty({
      schemaNode,
      propertyName: "zip",
      targetIndex: 0,
    })
    expect(Object.keys(lastToStart.properties || {})).toEqual([
      "zip",
      "street",
      "city",
    ])

    const missing = moveObjectProperty({
      schemaNode,
      propertyName: "country",
      targetIndex: 0,
    })
    expect(missing).toBe(schemaNode)
  })

  it("keeps object properties whose names collide with object prototype keys", () => {
    const schemaNode: ExtendedJSONSchema7 = {
      type: "object",
      properties: {
        safe: { type: "string" },
      },
      required: ["safe"],
    }

    const renamed = renameObjectProperty({
      schemaNode,
      oldName: "safe",
      newName: "__proto__",
    })

    expect(
      Object.prototype.hasOwnProperty.call(renamed.properties, "__proto__")
    ).toBe(true)
    expect(Object.keys(renamed.properties || {})).toEqual(["__proto__"])
    expect(renamed.required).toEqual(["__proto__"])

    const moved = moveObjectProperty({
      schemaNode: replaceObjectProperty({
        schemaNode: renamed,
        propertyName: "safe",
        propertySchema: { type: "number" },
      }),
      propertyName: "__proto__",
      targetIndex: 1,
    })
    expect(
      Object.prototype.hasOwnProperty.call(moved.properties, "__proto__")
    ).toBe(true)
    expect(Object.keys(moved.properties || {})).toEqual(["safe", "__proto__"])
  })

  it("preserves object property row ids and reset keys across local row edits", () => {
    let schemaNode: ExtendedJSONSchema7 = {
      type: "object",
      properties: {
        street: { type: "string" },
        city: { type: "string" },
      },
      required: ["street", "city"],
    }
    const onChange = vi.fn((nextSchemaNode: ExtendedJSONSchema7) => {
      schemaNode = nextSchemaNode
    })
    let model: ReturnType<typeof useObjectPropertiesModel> | undefined
    const captureModel = (
      nextModel: ReturnType<typeof useObjectPropertiesModel>
    ) => {
      model = nextModel
    }

    function Harness({ node }: { node: ExtendedJSONSchema7 }) {
      const nextModel = useObjectPropertiesModel({
        access: {
          arrayItems: true,
          enumValues: true,
          objectProperties: true,
          type: true,
        },
        editable: true,
        mode: "editable",
        schemaNode: node,
        schemaContext: {
          siblingNames: [],
          originalName: "address",
          fieldPath: "address",
          schemaDefinitions: {},
        },
        onChange,
      })
      React.useEffect(() => {
        captureModel(nextModel)
      }, [nextModel])
      return null
    }

    const view = render(<Harness node={schemaNode} />)

    expect(model?.rows.map((row) => [row.name, row.id])).toEqual([
      ["street", "draft-property-0"],
      ["city", "draft-property-1"],
    ])

    act(() => {
      model?.rows[0]?.nameField.onCommit("road")
    })
    view.rerender(<Harness node={schemaNode} />)

    expect(model?.rows.map((row) => [row.name, row.id])).toEqual([
      ["road", "draft-property-0"],
      ["city", "draft-property-1"],
    ])
    expect(model?.rows[0]?.typeField.ariaLabel).toBe(
      "Data type for address.draft-property-0"
    )

    act(() => {
      model?.addInput.onChange("zip")
    })
    act(() => {
      model?.addInput.onSubmit()
    })
    view.rerender(<Harness node={schemaNode} />)

    expect(model?.rows.map((row) => [row.name, row.id])).toEqual([
      ["road", "draft-property-0"],
      ["city", "draft-property-1"],
      ["zip", "draft-property-2"],
    ])
    expect(model?.addInput.value).toBe("")

    act(() => {
      model?.addInput.onChange("country")
    })
    act(() => {
      model?.rows[2]?.reorder.move(0)
    })
    view.rerender(<Harness node={schemaNode} />)

    expect(model?.rows.map((row) => [row.name, row.id])).toEqual([
      ["zip", "draft-property-2"],
      ["road", "draft-property-0"],
      ["city", "draft-property-1"],
    ])
    expect(Object.keys(schemaNode.properties || {})).toEqual([
      "zip",
      "road",
      "city",
    ])
    expect(model?.addInput.value).toBe("country")
  })

  it("clears pending object property input after external schema resets", () => {
    let model: ReturnType<typeof useObjectPropertiesModel> | undefined
    const captureModel = (
      nextModel: ReturnType<typeof useObjectPropertiesModel>
    ) => {
      model = nextModel
    }

    function Harness({ node }: { node: ExtendedJSONSchema7 }) {
      const nextModel = useObjectPropertiesModel({
        access: {
          arrayItems: true,
          enumValues: true,
          objectProperties: true,
          type: true,
        },
        editable: true,
        mode: "editable",
        schemaNode: node,
        schemaContext: {
          siblingNames: [],
          originalName: "address",
          fieldPath: "address",
          schemaDefinitions: {},
        },
        onChange: () => {},
      })
      React.useEffect(() => {
        captureModel(nextModel)
      }, [nextModel])
      return null
    }

    const view = render(
      <Harness
        node={{
          type: "object",
          properties: {
            street: { type: "string" },
          },
        }}
      />
    )

    act(() => {
      model?.addInput.onChange("zip")
    })
    expect(model?.addInput.value).toBe("zip")

    view.rerender(
      <Harness
        node={{
          type: "object",
          properties: {
            street: { type: "string" },
            country: { type: "string" },
          },
        }}
      />
    )

    expect(model?.addInput.value).toBe("")
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
        title: "Invoice Id",
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
        title: "Invoice Id",
      },
    })
  })

  it("wires nested object property drag affordances", () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              zip: { type: "string" },
            },
            required: ["street", "zip"],
          },
        }}
        schemaContext={{
          siblingNames: [],
          originalName: "address",
          schemaDefinitions: {},
        }}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    const dataTransfer = createDragDataTransfer()
    const cityRow = getPropertyFormRow("city")
    expect(cityRow).toHaveProperty("draggable", true)
    expect(cityRow.classList.contains("cursor-grab")).toBe(true)
    fireEvent.dragStart(getPropertyFormRow("zip"), { dataTransfer })
    expect(dataTransfer.getData("text/plain")).toMatch(/^draft-property-/)
    fireEvent.dragOver(cityRow, {
      clientY: -1,
      dataTransfer,
    })
    expect(
      cityRow.classList.contains("border-t-2") ||
        cityRow.classList.contains("border-b-2")
    ).toBe(true)
    fireEvent.dragLeave(cityRow)
    expect(cityRow.classList.contains("border-t-2")).toBe(false)
    expect(cityRow.classList.contains("border-b-2")).toBe(false)
  })

  it("reorders nested object properties by keyboard controls before committing", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              zip: { type: "string" },
            },
            required: ["street", "zip"],
          },
        }}
        schemaContext={{
          siblingNames: [],
          originalName: "address",
          schemaDefinitions: {},
        }}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(
      screen.getByRole("button", { name: "Move field street up" })
    ).toHaveProperty("disabled", true)
    expect(
      screen.getByRole("button", { name: "Move field zip down" })
    ).toHaveProperty("disabled", true)

    fireEvent.change(screen.getByLabelText("New object field"), {
      target: { value: "country" },
    })
    const zipUp = screen.getByRole("button", { name: "Move field zip up" })
    zipUp.focus()
    fireEvent.click(zipUp)

    await waitFor(() =>
      expect(
        screen
          .getAllByLabelText(/^Field name /)
          .map((input) => (input as HTMLInputElement).value)
      ).toEqual(["street", "zip", "city"])
    )
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Move field zip up"
    )
    expect(screen.getByText("zip moved to position 2 of 3")).toBeTruthy()
    expect(screen.getByLabelText("New object field")).toHaveProperty(
      "value",
      "country"
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Move field street down" })
    )
    await waitFor(() =>
      expect(
        screen
          .getAllByLabelText(/^Field name /)
          .map((input) => (input as HTMLInputElement).value)
      ).toEqual(["zip", "street", "city"])
    )

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))
    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    const committed = onCommitPropertyDraft.mock.calls[0]?.[0]
    expect(Object.keys(committed.schemaNode.properties || {})).toEqual([
      "zip",
      "street",
      "city",
    ])
    expect(committed.schemaNode.required).toEqual(["street", "zip"])
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
        title: "Invoice Number",
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
        title: "Invoice Number",
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
        title: "1legacy Name",
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

  it("hides nested object rows in description-only mode", () => {
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
            description: "editable description",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["address"],
          originalName: "address",
        })}
        mode="descriptionOnly"
        onCommitPropertyDraft={() => {}}
      />
    )

    expect(screen.getByLabelText("Description")).toHaveProperty(
      "disabled",
      false
    )
    expect(screen.queryByLabelText("Field name city")).toBeNull()
    expect(screen.queryByLabelText("New object field")).toBeNull()
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
        title: "Invoice Number",
      },
    })
  })

  it("does not expose nested enum editors when enum value editing is disabled", () => {
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice",
          schemaNode: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["draft"] },
            },
            required: ["status"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["invoice"],
          originalName: "invoice",
        })}
        capabilities={editableCapabilities({
          canEditEnumValues: false,
        })}
        onCommitPropertyDraft={() => {}}
      />
    )

    expect(screen.getByDisplayValue("status")).toBeTruthy()
    expect(screen.queryByPlaceholderText("Add new value")).toBeNull()
    expect(screen.queryByDisplayValue("draft")).toBeNull()
  })

  it("disables nested type selectors when type editing is disabled", () => {
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
        capabilities={editableCapabilities({
          canEditType: false,
        })}
        onCommitPropertyDraft={() => {}}
      />
    )

    const typeButtons = screen.getAllByRole("button", { name: "Data type" })
    expect(typeButtons).toHaveLength(1)
    expect(typeButtons[0]).toHaveProperty("disabled", true)
    expect(screen.getAllByText("string").length).toBeGreaterThan(0)
  })

  it("does not select a definition from an already open menu after type editing is disabled", async () => {
    const onCommitPropertyDraft = vi.fn()
    const draft: PropertyDraft = {
      name: "billing_address",
      schemaNode: { type: "string" },
    }
    const schemaContext = baseSchemaContext({
      siblingNames: ["billing_address"],
      originalName: "billing_address",
      schemaDefinitions: {
        Address: {
          type: "object",
          properties: { city: { type: "string" } },
        },
      },
    })
    const view = render(
      <PropertyForm
        propertyDraft={draft}
        schemaContext={schemaContext}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Data type" }))
    const definitionTrigger = await screen.findByText("definition")
    fireEvent.focus(definitionTrigger)
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" })

    view.rerender(
      <PropertyForm
        propertyDraft={draft}
        schemaContext={schemaContext}
        capabilities={editableCapabilities({
          canEditType: false,
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.click(await screen.findByText("Address"))
    fireEvent.keyDown(screen.getByRole("menu", { name: "Data type" }), {
      key: "Escape",
    })
    await waitFor(() =>
      expect(screen.queryByRole("menu", { name: "Data type" })).toBeNull()
    )
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "billing_address",
      schemaNode: {
        type: "string",
        title: "Billing Address",
      },
    })
  })

  it("does not create a definition from an already open menu after type editing is disabled", async () => {
    const onCommand = vi.fn()
    const draft: PropertyDraft = {
      name: "billing_address",
      schemaNode: { type: "string" },
    }
    const schemaContext = baseSchemaContext({
      siblingNames: ["billing_address"],
      originalName: "billing_address",
      onCommand,
    })
    const view = render(
      <PropertyForm
        propertyDraft={draft}
        schemaContext={schemaContext}
        onCommitPropertyDraft={() => {}}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Data type" }))
    const definitionTrigger = await screen.findByText("definition")
    fireEvent.focus(definitionTrigger)
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" })

    view.rerender(
      <PropertyForm
        propertyDraft={draft}
        schemaContext={schemaContext}
        capabilities={editableCapabilities({
          canEditType: false,
        })}
        onCommitPropertyDraft={() => {}}
      />
    )

    fireEvent.click(await screen.findByText("Create new definition"))

    await waitFor(() => expect(onCommand).not.toHaveBeenCalled())
  })

  it("allows saving editable fields when a locked name is invalid", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "1legacy_name",
          schemaNode: { type: "string", description: "old" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["1legacy_name"],
          originalName: "1legacy_name",
        })}
        capabilities={editableCapabilities({
          canEditName: false,
        })}
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
        title: "1legacy Name",
      },
    })
  })

  it("allows saving editable fields when locked enum values are invalid", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: {
            type: "string",
            enum: [],
            description: "old",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        capabilities={editableCapabilities({
          canEditType: false,
          canEditEnumValues: false,
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByRole("button", { name: "Data type" })).toHaveProperty(
      "disabled",
      true
    )
    expect(screen.queryByPlaceholderText("Add new value")).toBeNull()

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

  it("allows saving editable fields when locked enum values are duplicates", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: {
            type: "string",
            enum: ["draft", "draft"],
            description: "old",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        capabilities={editableCapabilities({
          canEditType: false,
          canEditEnumValues: false,
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.queryByPlaceholderText("Add new value")).toBeNull()

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "new description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "status",
      schemaNode: {
        type: "string",
        enum: ["draft", "draft"],
        description: "new description",
        title: "Status",
      },
    })
  })

  it("allows saving editable fields when locked enum values are blank", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: {
            type: "string",
            enum: [""],
            description: "old",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        capabilities={editableCapabilities({
          canEditType: false,
          canEditEnumValues: false,
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.queryByPlaceholderText("Add new value")).toBeNull()

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "new description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "status",
      schemaNode: {
        type: "string",
        enum: [""],
        description: "new description",
        title: "Status",
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
        title: "Due Date",
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

  it("blocks committing duplicate enum options", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: { type: "string", enum: ["draft", "paid"] },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByDisplayValue("paid"), {
      target: { value: "draft" },
    })

    expect(
      await screen.findByText("Multiple choice options must be unique")
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save Changes" })).toHaveProperty(
      "disabled",
      true
    )
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" })

    await waitFor(() => expect(onCommitPropertyDraft).not.toHaveBeenCalled())
  })

  it("blocks committing blank enum options after editing an existing option", async () => {
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

    fireEvent.change(screen.getByDisplayValue("draft"), {
      target: { value: "   " },
    })

    expect(
      await screen.findByText("Multiple choice options cannot be blank")
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save Changes" })).toHaveProperty(
      "disabled",
      true
    )
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).not.toHaveBeenCalled())
  })

  it("blocks duplicate object enum options regardless of key order", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: {
            type: "string",
            enum: [
              { code: "paid", label: "Paid" },
              { label: "Paid", code: "paid" },
            ],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(
      await screen.findByText("Multiple choice options must be unique")
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save Changes" })).toHaveProperty(
      "disabled",
      true
    )

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

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

  it("preserves pending enum option input when editing an existing option", () => {
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

    fireEvent.change(screen.getByPlaceholderText("Add new value"), {
      target: { value: "paid" },
    })
    fireEvent.change(screen.getByDisplayValue("draft"), {
      target: { value: "open" },
    })

    expect(screen.getByPlaceholderText("Add new value")).toHaveProperty(
      "value",
      "paid"
    )
  })

  it("preserves pending nested enum option input when renaming its object field", () => {
    render(
      <PropertyForm
        propertyDraft={{
          name: "invoice",
          schemaNode: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["draft"] },
            },
            required: ["status"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["invoice"],
          originalName: "invoice",
        })}
        onCommitPropertyDraft={() => {}}
      />
    )

    fireEvent.change(screen.getByPlaceholderText("Add new value"), {
      target: { value: "paid" },
    })
    renameInlineField("status", "state")

    expect(screen.getByPlaceholderText("Add new value")).toHaveProperty(
      "value",
      "paid"
    )
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
    renameInlineField("zip", "postal_code")
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

  it("adds and renames object fields whose names collide with object prototype keys", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "record",
          schemaNode: {
            type: "object",
            properties: {
              safe: { type: "string" },
            },
            required: ["safe"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["record"],
          originalName: "record",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByLabelText("New object field"), {
      target: { value: "__proto__" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    renameInlineField("safe", "constructor")
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    const schemaNode = onCommitPropertyDraft.mock.calls[0][0].schemaNode
    expect(
      Object.prototype.hasOwnProperty.call(schemaNode.properties, "__proto__")
    ).toBe(true)
    expect(Object.keys(schemaNode.properties)).toEqual([
      "constructor",
      "__proto__",
    ])
    expect(schemaNode.required).toEqual(["constructor", "__proto__"])
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
    expect(screen.getByDisplayValue("country")).toBeTruthy()
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

    fireEvent.keyDown(openInlineFieldName("city"), {
      key: "Enter",
    })

    expect(onCommitPropertyDraft).not.toHaveBeenCalled()
  })

  it("preserves pending object field input when renaming an existing field", () => {
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
        onCommitPropertyDraft={() => {}}
      />
    )

    fireEvent.change(screen.getByLabelText("New object field"), {
      target: { value: "country" },
    })
    renameInlineField("zip", "postal_code")

    expect(screen.getByLabelText("New object field")).toHaveProperty(
      "value",
      "country"
    )
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

    let nameInput = openInlineFieldName("city")
    fireEvent.change(nameInput, { target: { value: "zip" } })
    fireEvent.keyDown(nameInput, { key: "Escape" })

    nameInput = openInlineFieldName("city")
    fireEvent.change(nameInput, { target: { value: "1bad" } })
    fireEvent.keyDown(nameInput, { key: "Escape" })

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

  it("preserves nullable object structure when changing it to a list", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "addresses",
          schemaNode: {
            anyOf: [
              {
                type: "object",
                properties: {
                  city: { type: "string" },
                },
                required: ["city"],
              },
              { type: "null" },
            ],
            description: "Optional addresses",
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["addresses"],
          originalName: "addresses",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    await selectDataType("list")
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "addresses",
      schemaNode: {
        anyOf: [
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                city: { type: "string" },
              },
              required: ["city"],
            },
          },
          { type: "null" },
        ],
        description: "Optional addresses",
        title: "Addresses",
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
    fireEvent.click(trigger)
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
        title: "Billing Address",
      },
    })
  })

  it("escapes definition names when committing a reference", async () => {
    const onCommitPropertyDraft = vi.fn()
    render(
      <PropertyForm
        propertyDraft={{
          name: "escaped_definition",
          schemaNode: { type: "string" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["escaped_definition"],
          originalName: "escaped_definition",
          schemaDefinitions: {
            "A/B~C": {
              type: "object",
              properties: { value: { type: "string" } },
            },
          },
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Data type" }))
    const definitionTrigger = await screen.findByText("definition")
    fireEvent.focus(definitionTrigger)
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" })
    fireEvent.click(await screen.findByText("A/B~C"))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "escaped_definition",
      schemaNode: {
        $ref: "#/$defs/A~1B~0C",
        title: "Escaped Definition",
      },
    })
  })

  it("displays escaped definition refs with their decoded definition name", () => {
    render(
      <PropertyForm
        propertyDraft={{
          name: "escaped_definition",
          schemaNode: { $ref: "#/$defs/A~1B~0C" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["escaped_definition"],
          originalName: "escaped_definition",
          schemaDefinitions: {
            "A/B~C": {
              type: "object",
              properties: { value: { type: "string" } },
            },
          },
        })}
        onCommitPropertyDraft={() => {}}
      />
    )

    expect(screen.getByRole("button", { name: "Data type" }).textContent).toBe(
      "A/B~C"
    )
  })

  it("displays URI-encoded definition refs with their decoded definition name", () => {
    render(
      <PropertyForm
        propertyDraft={{
          name: "encoded_definition",
          schemaNode: { $ref: "#/$defs/Line%20Item" },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["encoded_definition"],
          originalName: "encoded_definition",
          schemaDefinitions: {
            "Line Item": {
              type: "object",
              properties: { sku: { type: "string" } },
            },
          },
        })}
        onCommitPropertyDraft={() => {}}
      />
    )

    expect(screen.getByRole("button", { name: "Data type" }).textContent).toBe(
      "Line Item"
    )
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
    fireEvent.click(trigger)
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
        title: "Billing Address",
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
    fireEvent.click(trigger)
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
        title: "Billing Address",
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

    fireEvent.click(screen.getByRole("button", { name: "Data type" }))
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
        title: "Billing Address",
      },
    })
  })

  it("handles rejected create definition commands without mutating the draft", async () => {
    const onCommand = vi.fn().mockRejectedValue(new Error("command failed"))
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

    fireEvent.click(screen.getByRole("button", { name: "Data type" }))
    const definitionTrigger = await screen.findByText("definition")
    fireEvent.focus(definitionTrigger)
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" })
    fireEvent.click(await screen.findByText("Create new definition"))
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() =>
      expect(onCommand).toHaveBeenCalledWith({ type: "createDefinition" })
    )
    await waitFor(() => expect(onCommitPropertyDraft).toHaveBeenCalledTimes(1))
    expect(onCommitPropertyDraft).toHaveBeenCalledWith({
      name: "billing_address",
      schemaNode: {
        type: "string",
        title: "Billing Address",
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

  it("resets pending nested input state when a new property draft prop is received", () => {
    const onCommitPropertyDraft = vi.fn()
    const view = render(
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
      target: { value: "paid" },
    })

    view.rerender(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: { city: { type: "string" } },
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
      target: { value: "country" },
    })

    view.rerender(
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

    expect(screen.getByPlaceholderText("Add new value")).toHaveProperty(
      "value",
      ""
    )
  })

  it("resets pending nested enum input when the same object draft receives new enum values", () => {
    const onCommitPropertyDraft = vi.fn()
    const view = render(
      <PropertyForm
        propertyDraft={{
          name: "invoice",
          schemaNode: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["draft"] },
            },
            required: ["status"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["invoice"],
          originalName: "invoice",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    fireEvent.change(screen.getByPlaceholderText("Add new value"), {
      target: { value: "paid" },
    })

    view.rerender(
      <PropertyForm
        propertyDraft={{
          name: "invoice",
          schemaNode: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["open"] },
            },
            required: ["status"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["invoice"],
          originalName: "invoice",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByPlaceholderText("Add new value")).toHaveProperty(
      "value",
      ""
    )
    expect(screen.getByDisplayValue("open")).toBeTruthy()
  })

  it("resets pending object field input when switching between object drafts", () => {
    const onCommitPropertyDraft = vi.fn()
    const view = render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: { city: { type: "string" } },
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
      target: { value: "country" },
    })

    view.rerender(
      <PropertyForm
        propertyDraft={{
          name: "company",
          schemaNode: {
            type: "object",
            properties: { name: { type: "string" } },
            required: ["name"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["company"],
          originalName: "company",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByLabelText("New object field")).toHaveProperty(
      "value",
      ""
    )
  })

  it("resets pending object field input when the same object draft receives new properties", () => {
    const onCommitPropertyDraft = vi.fn()
    const view = render(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: { city: { type: "string" } },
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
      target: { value: "country" },
    })

    view.rerender(
      <PropertyForm
        propertyDraft={{
          name: "address",
          schemaNode: {
            type: "object",
            properties: { line1: { type: "string" } },
            required: ["line1"],
          },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["address"],
          originalName: "address",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByLabelText("New object field")).toHaveProperty(
      "value",
      ""
    )
    expect(screen.getByDisplayValue("line1")).toBeTruthy()
  })

  it("resets pending enum option input when switching between enum drafts", () => {
    const onCommitPropertyDraft = vi.fn()
    const view = render(
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
      target: { value: "paid" },
    })

    view.rerender(
      <PropertyForm
        propertyDraft={{
          name: "priority",
          schemaNode: { type: "string", enum: ["low"] },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["priority"],
          originalName: "priority",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByPlaceholderText("Add new value")).toHaveProperty(
      "value",
      ""
    )
  })

  it("resets pending enum option input when the same enum draft receives new values", () => {
    const onCommitPropertyDraft = vi.fn()
    const view = render(
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
      target: { value: "paid" },
    })

    view.rerender(
      <PropertyForm
        propertyDraft={{
          name: "status",
          schemaNode: { type: "string", enum: ["open"] },
        }}
        schemaContext={baseSchemaContext({
          siblingNames: ["status"],
          originalName: "status",
        })}
        onCommitPropertyDraft={onCommitPropertyDraft}
      />
    )

    expect(screen.getByPlaceholderText("Add new value")).toHaveProperty(
      "value",
      ""
    )
    expect(screen.getByDisplayValue("open")).toBeTruthy()
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

  it("hides nested object rows in read-only mode", () => {
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
        mode="readOnly"
        onCommitPropertyDraft={() => {}}
      />
    )

    expect(screen.queryByLabelText("Field name city")).toBeNull()
    expect(screen.queryByLabelText("New object field")).toBeNull()
    expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull()
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
