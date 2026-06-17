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

import type { SourceFieldLink } from "@/components/ui/source-field-link"
import { Form } from "@/components/json-form/form-primitives"
import { JsonForm, JsonFormField } from "@/components/json-form/json-form"

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

function queryTableDataCell(name: string): HTMLElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-table-cell]")
    ).find((cell) => cell.getAttribute("aria-label") === name) ?? null
  )
}

function getTableDataCell(name: string): HTMLElement {
  const cell = queryTableDataCell(name)
  expect(cell).toBeTruthy()
  expect(cell?.getAttribute("data-slot")).toBe("data-cell")
  return cell as HTMLElement
}

function findAncestorWithClass(
  element: HTMLElement,
  className: string
): HTMLElement {
  let current: HTMLElement | null = element
  while (current) {
    if (current.className.includes(className)) return current
    current = current.parentElement
  }
  throw new Error(`ancestor with class ${className} was not found`)
}

function renderJsonForm({
  schema,
  defaultValues = {},
  sourceLink,
  defaultOpenPaths,
}: {
  schema: JSONSchema7
  defaultValues?: FormValues
  sourceLink?: SourceFieldLink
  defaultOpenPaths?: readonly string[]
}) {
  const submissions: FormValues[] = []
  let formApi: UseFormReturn<FormValues> | null = null

  function Harness() {
    const form = useForm<FormValues>({
      defaultValues,
      mode: "onBlur",
    })
    React.useEffect(() => {
      formApi = form
    }, [form])
    return (
      <JsonForm
        form={form}
        schema={schema}
        sourceLink={sourceLink}
        defaultOpenPaths={defaultOpenPaths}
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
  const optionItem = optionElement.closest<HTMLElement>(
    '[data-slot="select-item"]'
  )
  expect(optionItem).toBeTruthy()
  fireEvent.pointerEnter(optionItem!, { pointerType: "mouse" })
  fireEvent.mouseMove(optionItem!)
  fireEvent.pointerDown(optionItem!, { button: 0, ctrlKey: false })
  fireEvent.pointerUp(optionItem!, { button: 0, ctrlKey: false })
  fireEvent.click(optionItem!)
}

function selectCalendarDay(day: number) {
  const calendar = document.querySelector<HTMLElement>('[data-slot="calendar"]')
  expect(calendar).toBeTruthy()
  const dayLabel = within(calendar!).getByText(String(day))
  const dayButton = dayLabel.closest("button")
  expect(dayButton).toBeTruthy()
  fireEvent.click(dayButton!)
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
          start_time: {
            type: "string",
            format: "time",
            title: "Start Time",
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
        start_time: "09:15",
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
    fireEvent.click(screen.getByLabelText("Issued At"))
    selectCalendarDay(20)
    fireEvent.click(screen.getByLabelText("Start Time"))
    fireEvent.change(
      document.querySelector<HTMLInputElement>('input[type="time"]')!,
      {
        target: { value: "10:45" },
      }
    )
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "updated notes" },
    })
    fireEvent.click(screen.getByRole("checkbox", { name: /Active\s*\*/ }))

    await expect(submit()).resolves.toEqual({
      name: "Janet",
      age: 42,
      amount: 18.75,
      issued_at: "2026-01-20",
      start_time: "10:45",
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
    fireEvent.click(screen.getByLabelText("Paid At"))
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))

    await expect(submit()).resolves.toEqual({
      name: null,
      amount: null,
      paid_at: null,
    })
  })

  it("submits null, true, and false for nullable boolean fields", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          approved: {
            type: ["boolean", "null"],
            title: "Approved",
          },
        },
      },
      defaultValues: {
        approved: null,
      },
    })

    expect(screen.getByLabelText("Approved").textContent).toContain("No value")

    await selectOption("Approved", "True")
    expect(screen.getByLabelText("Approved").textContent).toContain("True")

    await selectOption("Approved", "False")
    expect(screen.getByLabelText("Approved").textContent).toContain("False")

    await selectOption("Approved", "No value")

    await expect(submit()).resolves.toEqual({
      approved: null,
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

    expect(screen.getByLabelText("Due At").textContent).toContain(
      "01/03/2026, 12:30"
    )
    fireEvent.click(screen.getByLabelText("Due At"))
    expect(
      document.querySelector<HTMLInputElement>('input[type="time"]')?.value
    ).toBe("12:30")

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
    expect(screen.getByRole("checkbox", { name: /Active\s*\*/ })).toBeTruthy()
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

  it("does not duplicate null choices for nullable enums that already include null", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          status: {
            type: ["string", "null"],
            title: "Status",
            enum: ["draft", null],
          },
        },
      },
      defaultValues: {
        status: "draft",
      },
    })

    const trigger = screen.getByLabelText("Status")
    fireEvent.focus(trigger)
    fireEvent.keyDown(trigger, { key: "ArrowDown" })

    const nullOptions = await screen.findAllByText("No value")
    expect(nullOptions).toHaveLength(1)
    const nullOptionItem = nullOptions[0].closest<HTMLElement>(
      '[data-slot="select-item"]'
    )
    expect(nullOptionItem).toBeTruthy()
    fireEvent.pointerEnter(nullOptionItem!, { pointerType: "mouse" })
    fireEvent.mouseMove(nullOptionItem!)
    fireEvent.pointerDown(nullOptionItem!, { button: 0, ctrlKey: false })
    fireEvent.pointerUp(nullOptionItem!, { button: 0, ctrlKey: false })
    fireEvent.click(nullOptionItem!)

    await expect(submit()).resolves.toEqual({
      status: null,
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

  it("matches object-valued enum defaults regardless of object key order", async () => {
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          layout: {
            title: "Layout",
            enum: [{ mode: "compact", columns: 2 }],
          },
        },
      },
      defaultValues: {
        layout: { columns: 2, mode: "compact" },
      },
    })

    expect(screen.getByLabelText("Layout").textContent).toContain(
      '{"mode":"compact","columns":2}'
    )
  })

  it("preserves property names that contain react-hook-form path separators", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          "invoice.number": {
            type: "string",
            title: "Invoice Number",
          },
          vendor: {
            type: "object",
            title: "Vendor",
            properties: {
              "tax.id": {
                type: "string",
                title: "Tax ID",
              },
            },
          },
        },
      },
      defaultValues: {
        "invoice.number": "INV-1",
        vendor: { "tax.id": "EU-1" },
      },
    })

    await waitFor(() =>
      expect(
        (screen.getByLabelText("Invoice Number") as HTMLInputElement).value
      ).toBe("INV-1")
    )
    expect((screen.getByLabelText("Tax ID") as HTMLInputElement).value).toBe(
      "EU-1"
    )

    fireEvent.change(screen.getByLabelText("Invoice Number"), {
      target: { value: "INV-2" },
    })
    fireEvent.change(screen.getByLabelText("Tax ID"), {
      target: { value: "EU-2" },
    })

    await expect(submit()).resolves.toEqual({
      "invoice.number": "INV-2",
      vendor: { "tax.id": "EU-2" },
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

  it("renders existing additionalProperties entries and preserves their keys", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            title: "Metadata",
            additionalProperties: {
              type: "string",
            },
          },
        },
      },
      defaultValues: {
        metadata: {
          source: "email",
          "invoice.number": "INV-1",
        },
      },
    })

    const disclosure = await screen.findByRole("button", {
      name: /Metadata 2 fields/,
    })
    if (disclosure.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(disclosure)
    }
    await waitFor(() =>
      expect(disclosure.getAttribute("aria-expanded")).toBe("true")
    )

    expect((screen.getByLabelText("source") as HTMLInputElement).value).toBe(
      "email"
    )
    expect(
      (screen.getByLabelText("invoice.number") as HTMLInputElement).value
    ).toBe("INV-1")

    fireEvent.change(screen.getByLabelText("invoice.number"), {
      target: { value: "INV-2" },
    })

    await expect(submit()).resolves.toEqual({
      metadata: {
        source: "email",
        "invoice.number": "INV-2",
      },
    })
  })

  it("renders root additionalProperties entries and preserves their keys", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        additionalProperties: {
          type: "string",
        },
      },
      defaultValues: {
        source: "email",
        "invoice.number": "INV-1",
      },
    })

    expect((screen.getByLabelText("source") as HTMLInputElement).value).toBe(
      "email"
    )
    expect(
      (screen.getByLabelText("invoice.number") as HTMLInputElement).value
    ).toBe("INV-1")

    fireEvent.change(screen.getByLabelText("invoice.number"), {
      target: { value: "INV-2" },
    })

    await expect(submit()).resolves.toEqual({
      source: "email",
      "invoice.number": "INV-2",
    })
  })

  it("preserves dirty encoded-key values when an inline schema is recreated", async () => {
    const submissions: FormValues[] = []

    function Harness() {
      const [revision, setRevision] = React.useState(0)
      const form = useForm<FormValues>({
        defaultValues: {
          "invoice.number": "INV-1",
        },
      })

      return (
        <>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Rerender {revision}
          </button>
          <JsonForm
            form={form}
            schema={{
              type: "object",
              additionalProperties: { type: "string" },
            }}
            onSubmit={(data) => submissions.push(cloneJson(data) as FormValues)}
          >
            <button type="submit">Submit</button>
          </JsonForm>
        </>
      )
    }

    render(<Harness />)

    const input = (await screen.findByLabelText(
      "invoice.number"
    )) as HTMLInputElement
    fireEvent.change(input, { target: { value: "INV-2" } })
    fireEvent.click(screen.getByRole("button", { name: /Rerender/ }))

    await waitFor(() =>
      expect(
        (screen.getByLabelText("invoice.number") as HTMLInputElement).value
      ).toBe("INV-2")
    )

    fireEvent.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() => expect(submissions).toHaveLength(1))
    expect(submissions[0]).toEqual({ "invoice.number": "INV-2" })
  })

  it("renders patternProperties entries with their matching schema", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            title: "Metadata",
            patternProperties: {
              "^x_": { type: "number" },
              "^flag\\.": { type: "boolean" },
            },
          },
        },
      },
      defaultValues: {
        metadata: {
          x_score: 5,
          "flag.ready": false,
        },
      },
    })

    const disclosure = await screen.findByRole("button", {
      name: /Metadata 2 fields/,
    })
    if (disclosure.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(disclosure)
    }
    await waitFor(() =>
      expect(disclosure.getAttribute("aria-expanded")).toBe("true")
    )

    fireEvent.change(screen.getByLabelText("x_score"), {
      target: { value: "7" },
    })
    fireEvent.click(screen.getByRole("checkbox", { name: "flag.ready" }))

    await expect(submit()).resolves.toEqual({
      metadata: {
        x_score: 7,
        "flag.ready": true,
      },
    })
  })

  it("renders root patternProperties entries with escaped keys", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        patternProperties: {
          "^extra\\.": { type: "string" },
        },
      },
      defaultValues: {
        "extra.note": "old",
      },
    })

    expect(
      (screen.getByLabelText("extra.note") as HTMLInputElement).value
    ).toBe("old")

    fireEvent.change(screen.getByLabelText("extra.note"), {
      target: { value: "new" },
    })

    await expect(submit()).resolves.toEqual({
      "extra.note": "new",
    })
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
    fireEvent.click(getTableDataCell("Code A"))
    fireEvent.change(screen.getByDisplayValue("A"), {
      target: { value: "B" },
    })

    await expect(submit()).resolves.toEqual({ rows: [{ code: "B", count: 1 }] })
  })

  it("normalizes standalone JsonFormField composition schemas", () => {
    function Harness() {
      const form = useForm<FormValues>({
        defaultValues: { total: { amount: 5, currency: "USD" } },
      })
      return (
        <Form {...form}>
          <JsonFormField
            name="total"
            schema={{
              title: "Total",
              allOf: [
                {
                  type: "object",
                  properties: { amount: { type: "number", title: "Amount" } },
                },
                {
                  type: "object",
                  properties: {
                    currency: { type: "string", title: "Currency" },
                  },
                },
              ],
            }}
          />
        </Form>
      )
    }

    render(<Harness />)

    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe(
      "5"
    )
    expect((screen.getByLabelText("Currency") as HTMLInputElement).value).toBe(
      "USD"
    )
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

    const descriptionCell = getTableDataCell("Description Widget")
    fireEvent.mouseEnter(descriptionCell)
    expect(screen.queryByDisplayValue("Widget")).toBeNull()
    fireEvent.click(descriptionCell)
    fireEvent.change(screen.getByDisplayValue("Widget"), {
      target: { value: "Hardware" },
    })
    const quantityCell = getTableDataCell("Quantity 2")
    fireEvent.mouseEnter(quantityCell)
    expect(screen.queryByRole("spinbutton")).toBeNull()
    fireEvent.click(quantityCell)
    const quantityInput = screen.getByDisplayValue("2")
    expect(quantityInput.getAttribute("data-slot")).toBe("data-cell")
    fireEvent.change(quantityInput, {
      target: { value: "3" },
    })
    fireEvent.click(getTableDataCell("Taxable False"))
    fireEvent.click(screen.getByRole("checkbox", { name: "Taxable False" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Remove row" })[1])
    await waitFor(() =>
      expect(queryTableDataCell("Description Service")).toBeNull()
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

  it("renders falsy primitive array items instead of compacting them away", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          flags: {
            type: "array",
            title: "Flags",
            items: { type: "boolean" },
          },
        },
      },
      defaultValues: { flags: [false, true] },
    })

    expect(screen.getByRole("button", { name: /Flags 2 items/ })).toBeTruthy()
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)

    fireEvent.click(screen.getAllByRole("checkbox")[0])
    fireEvent.click(screen.getAllByRole("checkbox")[1])

    await expect(submit()).resolves.toEqual({ flags: [true, false] })
  })

  it("uses per-index schemas for tuple arrays", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          tuple: {
            type: "array",
            title: "Tuple",
            items: [
              { type: "string", title: "Label" },
              { type: "number", title: "Amount" },
              { type: "boolean", title: "Enabled" },
            ],
          },
        },
      },
      defaultValues: {
        tuple: ["fee", 1.5, false],
      },
    })

    fireEvent.change(screen.getByLabelText("Tuple 1"), {
      target: { value: "service" },
    })
    fireEvent.change(screen.getByLabelText("Tuple 2"), {
      target: { value: "2.25" },
    })
    fireEvent.click(screen.getByRole("checkbox", { name: "Tuple 3" }))

    await expect(submit()).resolves.toEqual({
      tuple: ["service", 2.25, true],
    })
  })

  it("uses the next tuple schema when appending tuple items", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          tuple: {
            type: "array",
            title: "Tuple",
            items: [{ type: "string", title: "Label" }],
            additionalItems: { type: "number", title: "Amount" },
          },
        },
      },
      defaultValues: {
        tuple: ["fee"],
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.change(screen.getByLabelText("Tuple 2"), {
      target: { value: "4.5" },
    })

    await expect(submit()).resolves.toEqual({
      tuple: ["fee", 4.5],
    })
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

  it("opens configured long arrays on first render", () => {
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          transactions: {
            type: "array",
            title: "Transactions",
            items: {
              type: "object",
              properties: {
                date: { type: "string", title: "Date" },
              },
            },
          },
        },
      },
      defaultValues: {
        transactions: Array.from({ length: 9 }, (_, index) => ({
          date: `2003-06-${String(index + 1).padStart(2, "0")}`,
        })),
      },
      defaultOpenPaths: ["transactions"],
    })

    expect(
      screen
        .getByRole("button", { name: /Transactions 9 items/ })
        .getAttribute("aria-expanded")
    ).toBe("true")
    expect(getTableDataCell("Date 2003-06-01")).toBeTruthy()
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
    fireEvent.click(getTableDataCell("Name —"))
    fireEvent.change(screen.getByDisplayValue(""), {
      target: { value: "Ada" },
    })

    await expect(submit()).resolves.toEqual({ contacts: [{ name: "Ada" }] })
  })

  it("materializes missing optional arrays on first add", async () => {
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
    })

    expect(screen.getByText("No items.")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.change(screen.getByLabelText("Tags 1"), {
      target: { value: "first" },
    })

    await expect(submit()).resolves.toEqual({ tags: ["first"] })
  })

  it("disables adding array items after maxItems is reached", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            title: "Tags",
            maxItems: 1,
            items: { type: "string" },
          },
        },
      },
      defaultValues: { tags: ["first"] },
    })

    const addButton = screen.getByRole("button", { name: "Add" })
    expect((addButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(addButton)

    await expect(submit()).resolves.toEqual({ tags: ["first"] })
  })

  it("disables adding tuple items when additionalItems is false", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          tuple: {
            type: "array",
            title: "Tuple",
            items: [
              { type: "string", title: "Label" },
              { type: "number", title: "Amount" },
            ],
            additionalItems: false,
          },
        },
      },
      defaultValues: {
        tuple: ["fee", 1.5],
      },
    })

    const addButton = screen.getByRole("button", { name: "Add" })
    expect((addButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(addButton)

    await expect(submit()).resolves.toEqual({
      tuple: ["fee", 1.5],
    })
  })

  it("disables removing array items at minItems", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            title: "Tags",
            minItems: 1,
            items: { type: "string" },
          },
        },
      },
      defaultValues: { tags: ["required"] },
    })

    const removeButton = screen.getByRole("button", { name: "Remove item" })
    expect((removeButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(removeButton)

    await expect(submit()).resolves.toEqual({ tags: ["required"] })
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
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Code A" })).toBeNull()
    )
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

    fireEvent.click(screen.getByRole("button", { name: "Score 1" }))
    let trigger = screen.getByRole("combobox")
    fireEvent.focus(trigger)
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    const scoreOption = await screen.findByText("3")
    const scoreOptionItem = scoreOption.closest<HTMLElement>(
      '[data-slot="select-item"]'
    )
    expect(scoreOptionItem).toBeTruthy()
    fireEvent.pointerEnter(scoreOptionItem!, { pointerType: "mouse" })
    fireEvent.mouseMove(scoreOptionItem!)
    fireEvent.pointerDown(scoreOptionItem!, {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.pointerUp(scoreOptionItem!, {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(scoreOptionItem!)

    fireEvent.click(screen.getByRole("button", { name: "Accepted true" }))
    trigger = screen.getByRole("combobox")
    fireEvent.focus(trigger)
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    const acceptedOption = await screen.findByText("false")
    const acceptedOptionItem = acceptedOption.closest<HTMLElement>(
      '[data-slot="select-item"]'
    )
    expect(acceptedOptionItem).toBeTruthy()
    fireEvent.pointerEnter(acceptedOptionItem!, { pointerType: "mouse" })
    fireEvent.mouseMove(acceptedOptionItem!)
    fireEvent.pointerDown(acceptedOptionItem!, {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.pointerUp(acceptedOptionItem!, {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(acceptedOptionItem!)

    await expect(submit()).resolves.toEqual({
      rows: [{ score: 3, accepted: false }],
    })
  })

  it("preserves table-row property names that contain dots", async () => {
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
                "unit.price": {
                  type: "number",
                  title: "Unit Price",
                },
              },
            },
          },
        },
      },
      defaultValues: {
        rows: [{ "unit.price": 1.5 }],
      },
    })

    const displayCell = getTableDataCell("Unit Price 1.5")
    fireEvent.click(displayCell)
    const input = screen.getByDisplayValue("1.5") as HTMLInputElement
    expect(input.type).toBe("number")
    fireEvent.change(input, {
      target: { value: "2.25" },
    })

    await expect(submit()).resolves.toEqual({
      rows: [{ "unit.price": 2.25 }],
    })
  })

  it("renders additionalProperties entries inside array object items", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            title: "Rows",
            items: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
        },
      },
      defaultValues: {
        rows: [{ "extra.key": "A" }],
      },
    })

    fireEvent.click(screen.getByRole("button", { name: /Rows 1 1 field/ }))
    expect((screen.getByLabelText("extra.key") as HTMLInputElement).value).toBe(
      "A"
    )

    fireEvent.change(screen.getByLabelText("extra.key"), {
      target: { value: "B" },
    })

    await expect(submit()).resolves.toEqual({
      rows: [{ "extra.key": "B" }],
    })
  })

  it("uses card mode for array object items with declared and dynamic properties", async () => {
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
                name: { type: "string", title: "Name" },
              },
              patternProperties: {
                "^extra\\.": { type: "number" },
              },
            },
          },
        },
      },
      defaultValues: {
        rows: [{ name: "Ada", "extra.score": 3 }],
      },
    })

    expect(screen.queryByRole("button", { name: "Name Ada" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /Rows 1 2 fields/ }))
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Ada"
    )
    expect(
      (screen.getByLabelText("extra.score") as HTMLInputElement).value
    ).toBe("3")

    fireEvent.change(screen.getByLabelText("extra.score"), {
      target: { value: "4" },
    })

    await expect(submit()).resolves.toEqual({
      rows: [{ name: "Ada", "extra.score": 4 }],
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
    const shell = findAncestorWithClass(input, "bg-primary/5")
    expect(shell.className).toContain("bg-primary/5")

    fireEvent.focus(input)
    fireEvent.blur(input)
    fireEvent.click(input)

    expect(onFieldHover).toHaveBeenCalledWith("customer_name")
    expect(onFieldHover).toHaveBeenCalledWith(null)
    expect(selectField).toHaveBeenCalledWith("customer_name")
  })

  it("selects a focused source-linked scalar field from the keyboard", () => {
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
        activePath: null,
        onFieldHover,
        selectField,
      },
    })

    const input = screen.getByLabelText("Customer Name")
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.keyDown(input, { key: " " })

    expect(selectField).toHaveBeenCalledTimes(1)
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

    const cell = getTableDataCell("Value A")
    expect(cell).toBeTruthy()

    fireEvent.focus(cell)
    expect(cell.getAttribute("data-source-active")).toBe("true")
    fireEvent.blur(cell)
    fireEvent.click(cell)

    expect(onFieldHover).toHaveBeenCalledWith("rows.0.value")
    expect(onFieldHover).toHaveBeenCalledWith(null)
    expect(selectField).toHaveBeenCalledWith("rows.0.value")
  })

  it("keeps source-linked table cells in display mode on hover", async () => {
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
                amount: { type: "number", title: "Amount" },
              },
            },
          },
        },
      },
      defaultValues: { rows: [{ amount: 1875.24 }] },
      sourceLink: {
        activePath: null,
        onFieldHover,
        selectField,
      },
    })

    const cell = getTableDataCell("Amount 1875.24")
    fireEvent.pointerMove(cell)

    expect(cell.getAttribute("data-mode")).toBe("display")
    expect(screen.queryByRole("spinbutton")).toBeNull()
    await waitFor(() =>
      expect(onFieldHover).toHaveBeenCalledWith("rows.0.amount")
    )

    fireEvent.click(cell)

    const input = screen.getByRole("spinbutton", { name: "Amount 1875.24" })
    expect((input as HTMLInputElement).type).toBe("number")
    expect(input.getAttribute("data-slot")).toBe("data-cell")
    expect(selectField).toHaveBeenCalledWith("rows.0.amount")
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
