// @vitest-environment jsdom
import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { JSONSchema7 } from "json-schema";
import { useForm, type UseFormReturn } from "react-hook-form";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  JsonForm,
  type JsonFormTextInput,
} from "@/components/json-form/json-form";

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

type FormValues = Record<string, unknown>;

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function getTableDataCell(name: string): HTMLElement {
  const cell =
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-table-cell]"),
    ).find((element) => element.getAttribute("aria-label") === name) ?? null;
  expect(cell).toBeTruthy();
  expect(cell?.getAttribute("data-slot")).toBe("data-cell");
  return cell as HTMLElement;
}

function renderJsonForm({
  schema,
  defaultValues = {},
  textInput,
}: {
  schema: JSONSchema7;
  defaultValues?: FormValues;
  textInput?: JsonFormTextInput;
}) {
  const submissions: FormValues[] = [];
  let formApi: UseFormReturn<FormValues> | null = null;

  function Harness() {
    const form = useForm<FormValues>({ defaultValues, mode: "onBlur" });
    useMountEffect(() => {
      formApi = form;
    });
    return (
      <JsonForm
        form={form}
        schema={schema}
        textInput={textInput}
        onSubmit={(data) => submissions.push(cloneJson(data) as FormValues)}
      >
        <button type="submit">Submit</button>
      </JsonForm>
    );
  }

  const utils = render(<Harness />);
  return {
    ...utils,
    submissions,
    form: () => {
      if (!formApi) throw new Error("form did not mount");
      return formApi;
    },
    submit: async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(submissions).toHaveLength(1));
      return submissions[0];
    },
  };
}

// ---------------------------------------------------------------------------
// Scalar edge cases
// ---------------------------------------------------------------------------

describe("JsonForm scalar edge cases", () => {
  it("preserves zero and negative numbers rather than treating them as empty", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          balance: { type: "number", title: "Balance" },
          delta: { type: "integer", title: "Delta" },
        },
      },
      defaultValues: { balance: 0, delta: 5 },
    });

    // A stored 0 must render as "0", not as a blank input.
    expect((screen.getByLabelText("Balance") as HTMLInputElement).value).toBe(
      "0",
    );

    fireEvent.change(screen.getByLabelText("Delta"), {
      target: { value: "-3" },
    });

    await expect(submit()).resolves.toEqual({ balance: 0, delta: -3 });
  });

  it("renders a textarea for long-maxLength strings and for format=textarea", () => {
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          summary: { type: "string", title: "Summary", maxLength: 200 },
          body: { type: "string", title: "Body", format: "textarea" },
          short: { type: "string", title: "Short", maxLength: 40 },
        },
      },
      defaultValues: { summary: "", body: "", short: "" },
    });

    expect(screen.getByLabelText("Summary").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Body").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Short").tagName).toBe("INPUT");
  });

  it("uses textInput to force plain string controls to input or textarea", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        summary: { type: "string", title: "Summary", maxLength: 200 },
        body: { type: "string", title: "Body", format: "textarea" },
        short: { type: "string", title: "Short", maxLength: 40 },
        issued_at: { type: "string", title: "Issued At", format: "date" },
      },
    };

    const inputRender = renderJsonForm({
      schema,
      textInput: "input",
      defaultValues: { summary: "", body: "", short: "", issued_at: "" },
    });

    expect(screen.getByLabelText("Summary").tagName).toBe("INPUT");
    expect(screen.getByLabelText("Body").tagName).toBe("INPUT");
    expect(screen.getByLabelText("Short").tagName).toBe("INPUT");
    expect(screen.getByLabelText("Issued At").tagName).toBe("BUTTON");

    inputRender.unmount();

    renderJsonForm({
      schema,
      textInput: "textarea",
      defaultValues: { summary: "", body: "", short: "", issued_at: "" },
    });

    expect(screen.getByLabelText("Summary").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Body").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Short").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Issued At").tagName).toBe("BUTTON");
  });

  it("marks required nested-object fields with an asterisk", () => {
    renderJsonForm({
      schema: {
        type: "object",
        properties: {
          vendor: {
            type: "object",
            title: "Vendor",
            required: ["name"],
            properties: {
              name: { type: "string", title: "Vendor Name" },
              note: { type: "string", title: "Note" },
            },
          },
        },
      },
      defaultValues: { vendor: { name: "Acme", note: "" } },
    });

    expect(screen.getByLabelText("Vendor Name *")).toBeTruthy();
    expect(screen.queryByLabelText("Note *")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Schema composition — anyOf / allOf / recursive refs
// ---------------------------------------------------------------------------

describe("JsonForm schema composition", () => {
  it("renders an object wrapped in a single-branch anyOf", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          money: {
            title: "Money",
            anyOf: [
              {
                type: "object",
                properties: {
                  amount: { type: "number", title: "Amount" },
                },
              },
            ],
          },
        },
      },
      defaultValues: { money: { amount: 5 } },
    });

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "12.5" },
    });

    await expect(submit()).resolves.toEqual({ money: { amount: 12.5 } });
  });

  it("merges allOf branches into a single object with all properties", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          total: {
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
          },
        },
      },
      defaultValues: { total: { amount: 5, currency: "USD" } },
    });

    expect(screen.getByLabelText("Amount")).toBeTruthy();
    expect(screen.getByLabelText("Currency")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "9.25" },
    });
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "EUR" },
    });

    await expect(submit()).resolves.toEqual({
      total: { amount: 9.25, currency: "EUR" },
    });
  });

  it("renders a self-referential $ref schema without infinite recursion", () => {
    renderJsonForm({
      schema: {
        type: "object",
        $defs: {
          Node: {
            type: "object",
            title: "Node",
            properties: {
              label: { type: "string", title: "Label" },
              parent: { $ref: "#/$defs/Node" },
            },
          },
        },
        properties: {
          root: { $ref: "#/$defs/Node", title: "Root" },
        },
      },
      defaultValues: { root: { label: "top" } },
    });

    expect((screen.getByLabelText("Label") as HTMLInputElement).value).toBe(
      "top",
    );
  });
});

// ---------------------------------------------------------------------------
// Dynamic properties — pattern/additional precedence, special-character keys
// ---------------------------------------------------------------------------

describe("JsonForm dynamic properties", () => {
  it("prefers patternProperties over additionalProperties for matching keys", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            title: "Metadata",
            patternProperties: { "^x_": { type: "number" } },
            additionalProperties: { type: "string" },
          },
        },
      },
      defaultValues: { metadata: { x_score: 5, note: "hi" } },
    });

    // Pattern-matched key gets the number control, the rest get the string one.
    const numberInput = screen.getByLabelText("x_score") as HTMLInputElement;
    const stringInput = screen.getByLabelText("note") as HTMLInputElement;
    expect(numberInput.type).toBe("number");
    expect(stringInput.type).not.toBe("number");

    fireEvent.change(numberInput, { target: { value: "7" } });
    fireEvent.change(stringInput, { target: { value: "world" } });

    await expect(submit()).resolves.toEqual({
      metadata: { x_score: 7, note: "world" },
    });
  });

  it("round-trips additionalProperties keys containing brackets and quotes", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        additionalProperties: { type: "string" },
      },
      defaultValues: { "a[0]": "x", 'say"hi"': "y" },
    });

    expect((screen.getByLabelText("a[0]") as HTMLInputElement).value).toBe("x");
    expect((screen.getByLabelText('say"hi"') as HTMLInputElement).value).toBe(
      "y",
    );

    fireEvent.change(screen.getByLabelText("a[0]"), {
      target: { value: "z" },
    });

    await expect(submit()).resolves.toEqual({
      "a[0]": "z",
      'say"hi"': "y",
    });
  });
});

// ---------------------------------------------------------------------------
// Array edge cases
// ---------------------------------------------------------------------------

describe("JsonForm array edge cases", () => {
  it("removes a middle table row and shifts the remaining values up", async () => {
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
          { code: "C", count: 3 },
        ],
      },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Remove row" })[1]);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Code B" })).toBeNull(),
    );

    await expect(submit()).resolves.toEqual({
      rows: [
        { code: "A", count: 1 },
        { code: "C", count: 3 },
      ],
    });
  });

  it("ignores invalid numeric table-cell input and keeps the prior value", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            title: "Rows",
            items: {
              type: "object",
              properties: { price: { type: "number", title: "Price" } },
            },
          },
        },
      },
      defaultValues: { rows: [{ price: 1.5 }] },
    });

    fireEvent.click(getTableDataCell("Price 1.5"));
    const input = screen.getByDisplayValue("1.5") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "not-a-number" } });
    fireEvent.blur(input);

    await expect(submit()).resolves.toEqual({ rows: [{ price: 1.5 }] });
  });

  it("clears a nullable numeric table cell to null", async () => {
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
                price: {
                  title: "Price",
                  anyOf: [{ type: "number" }, { type: "null" }],
                },
              },
            },
          },
        },
      },
      defaultValues: { rows: [{ price: 2 }] },
    });

    fireEvent.click(getTableDataCell("Price 2"));
    const input = screen.getByDisplayValue("2") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await expect(submit()).resolves.toEqual({ rows: [{ price: null }] });
  });

  it("edits a date-time table cell through the picker", async () => {
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
                due: { type: "string", format: "date-time", title: "Due" },
              },
            },
          },
        },
      },
      defaultValues: { rows: [{ due: "2026-03-01T12:30:45Z" }] },
    });

    fireEvent.click(getTableDataCell("Due 2026-03-01T12:30:45Z"));
    const input = await waitFor(() => {
      const timeInput =
        document.querySelector<HTMLInputElement>('input[type="time"]');
      expect(timeInput).toBeTruthy();
      return timeInput!;
    });
    expect(["12:30", "12:30:45"]).toContain(input.value);
    fireEvent.change(input, { target: { value: "08:15" } });

    await expect(submit()).resolves.toEqual({
      rows: [{ due: "2026-03-01T08:15" }],
    });
  });

  it("preserves an unedited date-time table cell on blur", async () => {
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
                due: { type: "string", format: "date-time", title: "Due" },
              },
            },
          },
        },
      },
      defaultValues: { rows: [{ due: "2026-03-01T12:30:45Z" }] },
    });

    // Open the editor and blur without changing anything. The stored value
    // should be untouched — matching how the non-table date-time control
    // preserves the original ISO string with its seconds and timezone.
    const cell = getTableDataCell("Due 2026-03-01T12:30:45Z");
    fireEvent.click(cell);
    fireEvent.blur(cell);

    await expect(submit()).resolves.toEqual({
      rows: [{ due: "2026-03-01T12:30:45Z" }],
    });
  });

  it("renders arrays of objects with nested arrays in card mode", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          groups: {
            type: "array",
            title: "Groups",
            items: {
              type: "object",
              properties: {
                name: { type: "string", title: "Name" },
                tags: {
                  type: "array",
                  title: "Tags",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
      defaultValues: { groups: [{ name: "G1", tags: ["a"] }] },
    });

    // A nested-array item is not a flat scalar object, so it must use card
    // mode (collapsible cards), not table mode.
    expect(screen.queryByRole("button", { name: /Name G1/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Groups 1 2 fields" }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "G1",
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Group One" },
    });

    await expect(submit()).resolves.toEqual({
      groups: [{ name: "Group One", tags: ["a"] }],
    });
  });

  it("appends a deep empty object for arrays of nested objects", async () => {
    const { submit } = renderJsonForm({
      schema: {
        type: "object",
        properties: {
          people: {
            type: "array",
            title: "People",
            items: {
              type: "object",
              properties: {
                name: { type: "string", title: "Name" },
                address: {
                  type: "object",
                  title: "Address",
                  properties: {
                    city: { type: "string", title: "City" },
                  },
                },
              },
            },
          },
        },
      },
      defaultValues: { people: [] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await expect(submit()).resolves.toEqual({
      people: [{ name: "", address: {} }],
    });
  });
});
