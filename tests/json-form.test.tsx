// @vitest-environment jsdom
import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { useForm, type UseFormReturn } from "react-hook-form"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  JsonForm,
  type FieldSourceLink,
} from "@/components/json-form/json-form"

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

type FormValues = Record<string, unknown>

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}

function renderJsonForm({
  schema,
  defaultValues = {},
  sourceLink,
}: {
  schema: JSONSchema7
  defaultValues?: FormValues
  sourceLink?: FieldSourceLink
}) {
  const submissions: FormValues[] = []
  let formApi: UseFormReturn<FormValues> | null = null

  function Harness() {
    const form = useForm<FormValues>({
      defaultValues,
      mode: "onBlur",
    })
    formApi = form
    return (
      <JsonForm
        form={form}
        schema={schema}
        sourceLink={sourceLink}
        onSubmit={(data) => submissions.push(cloneJson(data) as FormValues)}
      >
        <button type="submit">Submit</button>
      </JsonForm>
    )
  }

  const utils = render(<Harness />)
  return {
    ...utils,
    submissions,
    form: () => {
      if (!formApi) throw new Error("form did not mount")
      return formApi
    },
    submit: async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }))
      await waitFor(() => expect(submissions).toHaveLength(1))
      return submissions[0]
    },
  }
}

function getInputByName(name: string): HTMLInputElement {
  const input = document.querySelector(`input[name="${name}"]`)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`input ${name} was not found`)
  }
  return input
}

function closestWithClass(element: Element, className: string): HTMLElement {
  let current: Element | null = element
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.classList.contains(className)
    ) {
      return current
    }
    current = current.parentElement
  }
  throw new Error(`ancestor with class ${className} was not found`)
}

async function selectOption(label: string, option: string) {
  const trigger = screen.getByLabelText(label)
  fireEvent.focus(trigger)
  fireEvent.keyDown(trigger, { key: "ArrowDown" })
  const optionElement = await screen.findByText(option)
  fireEvent.pointerDown(optionElement, { button: 0, ctrlKey: false })
  fireEvent.click(optionElement)
}

describe("JsonForm scalar fields", () => {
  it("renders and submits strings, numbers, dates, textareas, and booleans", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        required: ["name", "active"],
        properties: {
          name: { type: "string", title: "Customer Name" },
          age: { type: "integer", title: "Age" },
          amount: { type: "number", title: "Amount" },
          issued_at: {
            type: "string",
            format: "date",
            title: "Issued At",
          },
          notes: {
            type: "string",
            title: "Notes",
            maxLength: 200,
          },
          active: { type: "boolean", title: "Active" },
        },
      },
      defaultValues: {
        name: "Jane",
        age: 41,
        amount: 12.5,
        issued_at: "2026-01-15",
        notes: "old notes",
        active: false,
      },
    })

    fireEvent.change(screen.getByLabelText("Customer Name *"), {
      target: { value: "Janet" },
    })
    fireEvent.change(screen.getByLabelText("Age"), {
      target: { value: "42" },
    })
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "18.75" },
    })
    fireEvent.change(screen.getByLabelText("Issued At"), {
      target: { value: "2026-02-20" },
    })
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "updated notes" },
    })
    fireEvent.click(screen.getByRole("checkbox", { name: /Active\*/ }))

    await expect(submit()).resolves.toEqual({
      name: "Janet",
      age: 42,
      amount: 18.75,
      issued_at: "2026-02-20",
      notes: "updated notes",
      active: true,
    })
  })

  it("submits null when nullable scalar inputs are cleared", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          name: { type: ["string", "null"], title: "Name" },
          amount: { type: ["number", "null"], title: "Amount" },
          paid_at: {
            title: "Paid At",
            anyOf: [{ type: "string", format: "date" }, { type: "null" }],
          },
        },
      },
      defaultValues: {
        name: "Jane",
        amount: 10,
        paid_at: "2026-03-01",
      },
    })

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText("Paid At"), {
      target: { value: "" },
    })

    await expect(submit()).resolves.toEqual({
      name: null,
      amount: null,
      paid_at: null,
    })
  })

  it("clears required number inputs to undefined instead of null", () => {
    const { form } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          amount: { type: "number", title: "Amount" },
        },
      },
      defaultValues: { amount: 10 },
    })

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "" } })

    expect(form().getValues()).toEqual({ amount: undefined })
  })

  it("displays ISO date-time values with timezone suffixes", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          due_at: {
            type: "string",
            format: "date-time",
            title: "Due At",
          },
        },
      },
      defaultValues: { due_at: "2026-03-01T12:30:45Z" },
    })

    expect((screen.getByLabelText("Due At") as HTMLInputElement).value).toBe(
      "2026-03-01T12:30"
    )

    await expect(submit()).resolves.toEqual({
      due_at: "2026-03-01T12:30:45Z",
    })
  })

  it("marks required boolean labels consistently with scalar fields", () => {
    renderJsonForm({
      schema: {
        type: "object",
        required: ["active"],
        properties: {
          active: { type: "boolean", title: "Active" },
        },
      },
      defaultValues: { active: false },
    })

    expect(screen.getByText("*")).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: /Active\*/ })).toBeTruthy()
  })

  it("submits enum values, including nullable null choices", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            title: "Status",
            enum: ["draft", "paid", "void"],
          },
          decision: {
            title: "Decision",
            anyOf: [
              { type: "string", enum: ["approved", "rejected"] },
              { type: "null" },
            ],
          },
        },
      },
      defaultValues: {
        status: "draft",
        decision: "approved",
      },
    })

    await selectOption("Status", "paid")
    await selectOption("Decision", "No value")

    await expect(submit()).resolves.toEqual({
      status: "paid",
      decision: null,
    })
  })

  it("preserves non-string enum value types", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          priority: {
            type: "integer",
            title: "Priority",
            enum: [1, 2, 3],
          },
          flag: {
            type: "boolean",
            title: "Flag",
            enum: [true, false],
          },
        },
      },
      defaultValues: {
        priority: 1,
        flag: true,
      },
    })

    await selectOption("Priority", "2")
    await selectOption("Flag", "false")

    await expect(submit()).resolves.toEqual({
      priority: 2,
      flag: false,
    })
  })

  it("displays object-valued enum defaults by JSON value equality", async () => {
    const compact = { mode: "compact", columns: 2 }
    const detailed = { mode: "detailed", columns: 4 }
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          layout: {
            title: "Layout",
            enum: [compact, detailed],
          },
        },
      },
      defaultValues: {
        layout: { mode: "compact", columns: 2 },
      },
    })

    expect(screen.getByLabelText("Layout").textContent).toContain(
      JSON.stringify(compact)
    )

    await selectOption("Layout", JSON.stringify(detailed))

    await expect(submit()).resolves.toEqual({
      layout: detailed,
    })
  })
})

describe("JsonForm objects and refs", () => {
  it("lazy-mounts nested objects and expands them on demand", () => {
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          vendor: {
            type: "object",
            title: "Vendor",
            properties: {
              name: { type: "string", title: "Vendor Name" },
              address: {
                type: "object",
                title: "Address",
                properties: {
                  street: { type: "string", title: "Street" },
                },
              },
            },
          },
        },
      },
      defaultValues: {
        vendor: { name: "Retab", address: { street: "1 Main" } },
      },
    })

    expect(screen.getByLabelText("Vendor Name")).toBeTruthy()
    expect(screen.queryByLabelText("Street")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /Address 1 field/ }))

    expect((screen.getByLabelText("Street") as HTMLInputElement).value).toBe(
      "1 Main"
    )
  })

  it("renders fields through $defs refs and submits edited ref values", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        $defs: {
          Money: {
            type: "object",
            title: "Money",
            properties: {
              amount: { type: "number", title: "Amount" },
              currency: { type: "string", title: "Currency" },
            },
          },
        },
        properties: {
          total: { $ref: "#/$defs/Money", title: "Total" },
        },
      },
      defaultValues: { total: { amount: 5, currency: "USD" } },
    })

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "9.25" },
    })
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "EUR" },
    })

    await expect(submit()).resolves.toEqual({
      total: { amount: 9.25, currency: "EUR" },
    })
  })

  it("uses referenced array item schemas for table rendering", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        $defs: {
          Row: {
            type: "object",
            properties: {
              code: { type: "string", title: "Code" },
              count: { type: "integer", title: "Count" },
            },
          },
        },
        properties: {
          rows: {
            type: "array",
            title: "Rows",
            items: { $ref: "#/$defs/Row" },
          },
        },
      },
      defaultValues: { rows: [{ code: "A", count: 1 }] },
    })

    expect(screen.getByText("Code")).toBeTruthy()
    fireEvent.change(screen.getByDisplayValue("A"), {
      target: { value: "B" },
    })

    await expect(submit()).resolves.toEqual({ rows: [{ code: "B", count: 1 }] })
  })
})

describe("JsonForm arrays", () => {
  it("edits, adds, and removes rows in scalar-object table mode", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          line_items: {
            type: "array",
            title: "Line Items",
            items: {
              type: "object",
              required: ["description"],
              properties: {
                description: { type: "string", title: "Description" },
                quantity: { type: "integer", title: "Quantity" },
                taxable: { type: "boolean", title: "Taxable" },
              },
            },
          },
        },
      },
      defaultValues: {
        line_items: [
          { description: "Widget", quantity: 2, taxable: true },
          { description: "Service", quantity: 1, taxable: false },
        ],
      },
    })

    expect(screen.getByText("Description")).toBeTruthy()
    expect(screen.getByText("Quantity")).toBeTruthy()
    expect(screen.getByText("Taxable")).toBeTruthy()

    fireEvent.change(screen.getByDisplayValue("Widget"), {
      target: { value: "Hardware" },
    })
    fireEvent.change(screen.getByDisplayValue("2"), {
      target: { value: "3" },
    })
    fireEvent.click(screen.getAllByRole("checkbox")[1])
    fireEvent.click(screen.getAllByRole("button", { name: "Remove row" })[1])
    await waitFor(() =>
      expect(screen.queryByDisplayValue("Service")).toBeNull()
    )
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await expect(submit()).resolves.toEqual({
      line_items: [
        { description: "Hardware", quantity: 3, taxable: true },
        { description: "", taxable: false },
      ],
    })
  })

  it("uses card mode for primitive arrays and preserves primitive values", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            title: "Tags",
            items: { type: "string" },
          },
        },
      },
      defaultValues: { tags: ["alpha", "beta"] },
    })

    fireEvent.change(screen.getByLabelText("Tags 1"), {
      target: { value: "first" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "Remove item" })[1])
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.change(screen.getByLabelText("Tags 2"), {
      target: { value: "second" },
    })

    await expect(submit()).resolves.toEqual({ tags: ["first", "second"] })
  })

  it("starts long arrays collapsed and opens them when adding an item", () => {
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            title: "Tags",
            items: { type: "string" },
          },
        },
      },
      defaultValues: {
        tags: Array.from({ length: 9 }, (_, index) => `tag-${index + 1}`),
      },
    })

    expect(screen.queryByLabelText("Tags 1")).toBeNull()
    expect(
      screen
        .getByRole("button", { name: /Tags 9 items/ })
        .getAttribute("aria-expanded")
    ).toBe("false")

    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    expect(
      screen
        .getByRole("button", { name: /Tags 10 items/ })
        .getAttribute("aria-expanded")
    ).toBe("true")
    expect((screen.getByLabelText("Tags 10") as HTMLInputElement).value).toBe(
      ""
    )
  })

  it("shows an empty array state and appends the correct empty object", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          contacts: {
            type: "array",
            title: "Contacts",
            items: {
              type: "object",
              properties: {
                name: { type: "string", title: "Name" },
              },
            },
          },
        },
      },
      defaultValues: { contacts: [] },
    })

    expect(screen.getByText("No items.")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.change(getInputByName("contacts.0.name"), {
      target: { value: "Ada" },
    })

    await expect(submit()).resolves.toEqual({ contacts: [{ name: "Ada" }] })
  })

  it("removes the first table row, shifts values, and appends without stale child values", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            title: "Rows",
            items: {
              type: "object",
              properties: {
                code: { type: "string", title: "Code" },
                count: { type: "integer", title: "Count" },
              },
            },
          },
        },
      },
      defaultValues: {
        rows: [
          { code: "A", count: 1 },
          { code: "B", count: 2 },
        ],
      },
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Remove row" })[0])
    await waitFor(() => expect(screen.queryByDisplayValue("A")).toBeNull())
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await expect(submit()).resolves.toEqual({
      rows: [{ code: "B", count: 2 }, { code: "" }],
    })
  })

  it("preserves typed enum values in table cells", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            title: "Rows",
            items: {
              type: "object",
              properties: {
                score: { type: "integer", title: "Score", enum: [1, 2, 3] },
                accepted: {
                  type: "boolean",
                  title: "Accepted",
                  enum: [true, false],
                },
              },
            },
          },
        },
      },
      defaultValues: {
        rows: [{ score: 1, accepted: true }],
      },
    })

    const triggers = screen.getAllByRole("combobox")
    fireEvent.focus(triggers[0])
    fireEvent.keyDown(triggers[0], { key: "ArrowDown" })
    fireEvent.pointerDown(await screen.findByText("3"), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(screen.getByText("3"))

    fireEvent.focus(triggers[1])
    fireEvent.keyDown(triggers[1], { key: "ArrowDown" })
    fireEvent.pointerDown(await screen.findByText("false"), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(screen.getByText("false"))

    await expect(submit()).resolves.toEqual({
      rows: [{ score: 3, accepted: false }],
    })
  })

  it("removes and appends card-mode object rows without resurrecting nested values", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            title: "Entries",
            items: {
              type: "object",
              properties: {
                name: { type: "string", title: "Name" },
                details: {
                  type: "object",
                  title: "Details",
                  properties: {
                    note: { type: "string", title: "Note" },
                  },
                },
              },
            },
          },
        },
      },
      defaultValues: {
        entries: [
          { name: "First", details: { note: "A" } },
          { name: "Second", details: { note: "B" } },
        ],
      },
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Remove item" })[0])
    await waitFor(() => expect(screen.queryByText("Entries 2")).toBeNull())
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await expect(submit()).resolves.toEqual({
      entries: [
        { name: "Second", details: { note: "B" } },
        { name: "", details: {} },
      ],
    })
  })

  it("appends null for nullable primitive array items", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          aliases: {
            type: "array",
            title: "Aliases",
            items: { type: ["string", "null"] },
          },
        },
      },
      defaultValues: { aliases: [] },
    })

    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await expect(submit()).resolves.toEqual({ aliases: [null] })
  })
})

describe("JsonForm source linking", () => {
  it("reports scalar hover, focus, blur, and selection by field path", () => {
    const onFieldHover = vi.fn()
    const selectField = vi.fn()
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          customer_name: { type: "string", title: "Customer Name" },
        },
      },
      defaultValues: { customer_name: "Jane" },
      sourceLink: {
        activePath: "customer_name",
        onFieldHover,
        selectField,
      },
    })

    const input = screen.getByLabelText("Customer Name")
    const shell = input.closest(".rounded-md")
    expect(shell?.className).toContain("bg-primary/5")

    fireEvent.focus(input)
    fireEvent.blur(input)
    fireEvent.click(input)

    expect(onFieldHover).toHaveBeenCalledWith("customer_name")
    expect(onFieldHover).toHaveBeenCalledWith(null)
    expect(selectField).toHaveBeenCalledWith("customer_name")
  })

  it("reports table-cell source paths", () => {
    const onFieldHover = vi.fn()
    const selectField = vi.fn()
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            title: "Rows",
            items: {
              type: "object",
              properties: {
                value: { type: "string", title: "Value" },
              },
            },
          },
        },
      },
      defaultValues: { rows: [{ value: "A" }] },
      sourceLink: {
        activePath: "rows.0.value",
        onFieldHover,
        selectField,
      },
    })

    const input = screen.getByDisplayValue("A")
    const cell = closestWithClass(input, "bg-primary/5")
    expect(cell.className).toContain("bg-primary/5")

    fireEvent.focus(input)
    fireEvent.blur(input)
    fireEvent.click(input)

    expect(onFieldHover).toHaveBeenCalledWith("rows.0.value")
    expect(onFieldHover).toHaveBeenCalledWith(null)
    expect(selectField).toHaveBeenCalledWith("rows.0.value")
  })
})

describe("JsonForm accessibility", () => {
  it("associates validation messages with invalid controls", async () => {
    function Harness() {
      const form = useForm<FormValues>({
        defaultValues: { name: "" },
      })
      return (
        <JsonForm
          form={form}
          schema={{
            type: "object",
            properties: {
              name: { type: "string", title: "Name" },
            },
          }}
        >
          <button
            type="button"
            onClick={() =>
              form.setError("name", { type: "manual", message: "Required" })
            }
          >
            Mark invalid
          </button>
        </JsonForm>
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Mark invalid" }))

    await waitFor(() => expect(screen.getByText("Required")).toBeTruthy())
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe(
      "true"
    )
  })

  it("keeps table headers readable when labels have descriptions", () => {
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            title: "Rows",
            items: {
              type: "object",
              properties: {
                value: {
                  type: "string",
                  title: "Value",
                  description: "Shown in a tooltip",
                },
              },
            },
          },
        },
      },
      defaultValues: { rows: [{ value: "A" }] },
    })

    const table = screen.getByText("Value").closest(".overflow-x-auto")
    expect(table).toBeTruthy()
    expect(within(table as HTMLElement).getByText("Value")).toBeTruthy()
  })
})
