// @vitest-environment jsdom
import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { JSONSchema7 } from "json-schema";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SchemaInlineDescription } from "@/components/schema-editor/primitives/schema-inline-description";
import { SchemaBuilder } from "@/components/schema-editor/schema-builder";

beforeAll(() => {
  // Radix DropdownMenu reads these jsdom-unimplemented pointer APIs when opening.
  HTMLElement.prototype.scrollIntoView = vi.fn();
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

afterEach(cleanup);

/**
 * Opens a Radix DropdownMenu trigger. Radix opens on the pointer-down sequence
 * (a plain `click` is ignored in jsdom), so dispatch that instead.
 */
function openRadixTrigger(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
}

/** Controlled editor harness that records every emitted schema. */
function renderEditor(
  initial: JSONSchema7,
  options: {
    readOnly?: boolean;
    features?: React.ComponentProps<typeof SchemaBuilder>["features"];
  } = {},
) {
  const emits: JSONSchema7[] = [];
  function Harness() {
    const [schema, setSchema] = React.useState(initial);
    return (
      <SchemaBuilder
        value={schema}
        readOnly={options.readOnly}
        features={options.features}
        onValueChange={(s) => {
          emits.push(s as JSONSchema7);
          setSchema(s as JSONSchema7);
        }}
      />
    );
  }
  const utils = render(<Harness />);
  return { emits, last: () => emits.at(-1), ...utils };
}

function openSchemaActionsMenu() {
  openRadixTrigger(screen.getByRole("button", { name: "Open schema actions" }));
}

function openTypeMenu(label: string) {
  openRadixTrigger(screen.getByRole("button", { name: label }));
}

const sample: JSONSchema7 = {
  type: "object",
  title: "Invoice",
  properties: {
    invoice_number: { type: "string", description: "the id" },
    total: { type: "number" },
  },
  required: ["invoice_number"],
};

describe("SchemaBuilder renders (integration smoke)", () => {
  it("mounts the full editor and shows the property names", () => {
    renderEditor(sample);
    expect(screen.getByDisplayValue("invoice_number")).toBeTruthy();
    expect(screen.getByDisplayValue("total")).toBeTruthy();
  });

  it("keeps root properties padded inside the section shell", () => {
    renderEditor(sample);

    const propertiesTrigger = screen
      .getByText("Properties (2)")
      .closest("[data-slot='accordion-trigger']");
    const propertiesSection = propertiesTrigger?.closest(
      "[data-slot='accordion']",
    );

    expect(propertiesSection?.className).toContain("px-4");
    expect(
      screen.getByPlaceholderText("New property name").closest(".px-1"),
    ).toBeTruthy();
  });

  it("keeps property type controls evenly padded", () => {
    renderEditor(sample);

    const typeTrigger = screen.getAllByText("string")[0].closest("button");

    expect(typeTrigger?.className).toContain("pl-2");
    expect(typeTrigger?.className).toContain("pr-1");
    expect(typeTrigger?.className).not.toContain("pr-0");
    expect(typeTrigger?.parentElement?.className).toContain("pr-1");
  });

  it("keeps the root description visually quiet in dark mode", () => {
    renderEditor(sample);

    const descriptionInput = screen.getByPlaceholderText(
      "Add a description to your schema",
    );

    expect(descriptionInput.className).toContain("dark:bg-transparent");
    expect(descriptionInput.className).not.toContain("dark:bg-input/30");
    expect(descriptionInput.className).toContain(
      "placeholder:text-muted-foreground/70",
    );
  });

  it("renders nested objects and $defs without crashing", () => {
    renderEditor({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      properties: {
        vendor: { type: "object", properties: { name: { type: "string" } } },
        cost: { $ref: "#/$defs/Money" },
      },
    });
    expect(screen.getByDisplayValue("vendor")).toBeTruthy();
    expect(screen.getByDisplayValue("name")).toBeTruthy();
    // $defs section header
    expect(screen.getByText(/Definitions/)).toBeTruthy();
  });

  it("allows the definitions accordion to close when definitions exist", async () => {
    renderEditor({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      properties: {},
    });

    expect(screen.getByDisplayValue("Money")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Definitions/ }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Money")).toBeNull();
    });
  });

  it("does not offer to delete definitions referenced from raw schema keywords", () => {
    renderEditor({
      type: "object",
      $defs: {
        Money: { type: "object", properties: { amount: { type: "number" } } },
      },
      additionalProperties: { $ref: "#/$defs/Money" },
      properties: {},
    } as JSONSchema7);

    const moneySection = screen.getByDisplayValue("Money").closest("[id]")!;

    expect(
      within(moneySection as HTMLElement).queryByRole("button", {
        name: "Delete field",
      }),
    ).toBeNull();
  });

  it("renders imported arrays without an items schema", () => {
    expect(() =>
      renderEditor({
        type: "object",
        properties: {
          rows: { type: "array" },
        },
      }),
    ).not.toThrow();

    expect(screen.getByDisplayValue("rows")).toBeTruthy();
    expect(screen.getByText("list")).toBeTruthy();
  });
});

describe("SchemaBuilder interactions (doc-routed)", () => {
  it("adds a property via the inline input and emits an updated schema", () => {
    const { emits, last } = renderEditor(sample);
    const input = screen.getAllByPlaceholderText("New property name")[0];
    fireEvent.change(input, { target: { value: "memo" } });
    // press Enter to add
    fireEvent.keyDown(input, { key: "Enter" });
    expect(emits.length).toBeGreaterThan(0);
    const out = last()!;
    expect(Object.keys(out.properties!)).toContain("memo");
    // existing properties are preserved
    expect(Object.keys(out.properties!)).toEqual(
      expect.arrayContaining(["invoice_number", "total", "memo"]),
    );
  });

  it("rejects duplicate property names before emitting", () => {
    const { emits } = renderEditor(sample);
    const input = screen.getAllByPlaceholderText("New property name")[0];
    fireEvent.change(input, { target: { value: "total" } });

    expect(screen.getByText(/already exists/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Add" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(emits).toHaveLength(0);
  });

  it("does not render editing controls or emit in read-only mode", () => {
    const { emits } = renderEditor(sample, { readOnly: true });

    expect(screen.getByText("invoice_number")).toBeTruthy();
    expect(screen.queryByPlaceholderText("New property name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete field" })).toBeNull();
    expect(
      (screen.getByDisplayValue("Invoice") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "View schema properties" }),
    ).toBeTruthy();
    expect(emits).toHaveLength(0);
  });

  it("does not render enum editing controls in read-only mode", () => {
    const { emits } = renderEditor(
      {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "paid"] },
        },
      },
      { readOnly: true },
    );

    expect(
      (screen.getByDisplayValue("draft") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByDisplayValue("paid") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.queryByPlaceholderText("New choice")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(emits).toHaveLength(0);
  });

  it("edits root title and description without dropping fields", () => {
    const { last } = renderEditor(sample);
    const titleInput = screen.getByDisplayValue("Invoice") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Receipt" } });
    fireEvent.blur(titleInput);

    const descriptionInput = screen.getByPlaceholderText(
      "Add a description to your schema",
    ) as HTMLTextAreaElement;
    fireEvent.change(descriptionInput, {
      target: { value: "Fields captured from the invoice." },
    });
    fireEvent.blur(descriptionInput);

    const out = last()!;
    expect(out.title).toBe("Receipt");
    expect(out.description).toBe("Fields captured from the invoice.");
    expect(Object.keys(out.properties!)).toEqual(["invoice_number", "total"]);
    expect(out.required).toEqual(["invoice_number", "total"]);
  });

  it("changes a date-like field to a scalar type without keeping the stale format", async () => {
    const { last } = renderEditor({
      type: "object",
      properties: {
        issued_at: { type: "string", format: "date-time" },
      },
    });

    openTypeMenu("datetime");
    fireEvent.click(await screen.findByRole("menuitem", { name: "number" }));

    expect(last()!.properties!.issued_at).toEqual({ type: "number" });
  });

  it("selects an existing definition from the property type menu", async () => {
    const { last } = renderEditor({
      type: "object",
      $defs: {
        Address: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      properties: {
        billing_address: { type: "string" },
      },
    });

    openTypeMenu("string");
    const definitionTrigger = await screen.findByText("definition");
    fireEvent.focus(definitionTrigger);
    fireEvent.keyDown(definitionTrigger, { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Address" }));

    expect(last()!.properties!.billing_address).toEqual({
      $ref: "#/$defs/Address",
    });
    expect(last()!.$defs!.Address).toEqual({
      type: "object",
      properties: {},
      required: [],
    });
  });

  it("installs an object template from the property type menu", async () => {
    const { last } = renderEditor(
      {
        type: "object",
        properties: {
          vendor: { type: "string" },
        },
      },
      { features: { objectTemplates: true } },
    );

    openTypeMenu("string");
    const templateTrigger = await screen.findByText("object template");
    fireEvent.focus(templateTrigger);
    fireEvent.keyDown(templateTrigger, { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Company" }));

    await waitFor(() => {
      expect(last()!.properties!.vendor).toEqual({
        $ref: "#/$defs/Company",
      });
    });
    expect(Object.keys(last()!.$defs!)).toEqual(["Address", "Company"]);
    expect((last()!.$defs!.Company as JSONSchema7).properties!.address).toEqual(
      { $ref: "#/$defs/Address" },
    );
  });

  it("deletes all descriptions through the schema actions menu", async () => {
    const { last } = renderEditor({
      type: "object",
      description: "root description",
      $defs: {
        Money: {
          type: "object",
          description: "money description",
          properties: {
            amount: { type: "number", description: "amount description" },
          },
        },
      },
      properties: {
        vendor: {
          type: "object",
          description: "vendor description",
          properties: {
            name: { type: "string", description: "name description" },
          },
        },
        rows: {
          type: "array",
          description: "rows description",
          items: {
            type: "object",
            description: "row description",
            properties: {
              sku: { type: "string", description: "sku description" },
            },
          },
        },
        status: {
          type: "string",
          enum: ["draft", "paid"],
        } as JSONSchema7,
      },
    });

    openSchemaActionsMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: /Delete all descriptions/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const out = last()!;
    expect(out.description).toBeUndefined();
    expect((out.properties!.vendor as JSONSchema7).description).toBeUndefined();
    expect(
      ((out.properties!.vendor as JSONSchema7).properties!.name as JSONSchema7)
        .description,
    ).toBeUndefined();
    expect((out.properties!.rows as JSONSchema7).description).toBeUndefined();
    expect(
      (
        ((out.properties!.rows as JSONSchema7).items as JSONSchema7).properties!
          .sku as JSONSchema7
      ).description,
    ).toBeUndefined();
    expect((out.$defs!.Money as JSONSchema7).description).toBeUndefined();
    expect(
      ((out.$defs!.Money as JSONSchema7).properties!.amount as JSONSchema7)
        .description,
    ).toBeUndefined();
  });

  it("deletes root fields through the schema actions menu", async () => {
    const { last } = renderEditor(sample);

    openSchemaActionsMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Delete Schema/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const out = last()!;
    expect(out.type).toBe("object");
    expect(out.properties).toEqual({});
    expect(out.required).toEqual([]);
  });

  it("edits a property description inline and emits it", () => {
    const { last } = renderEditor(sample);
    // total has no description -> its row shows the "Add description" input placeholder
    const totalRow = screen.getByDisplayValue("total").closest("div")!;
    const input = within(
      totalRow.parentElement as HTMLElement,
    ).getAllByPlaceholderText("Add description")[0] as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "amount due" } });
    fireEvent.blur(input);
    const out = last()!;
    expect((out.properties!.total as JSONSchema7).description).toBe(
      "amount due",
    );
  });

  it("has no per-property Required control (required is the default policy)", () => {
    renderEditor(sample);
    expect(screen.queryByText("Required")).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("names icon-only property action buttons", () => {
    renderEditor(sample);

    expect(
      screen.getAllByRole("button", { name: "Edit field properties" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Delete field" }).length,
    ).toBeGreaterThan(0);
  });

  it("every property — new and existing — is emitted as required", () => {
    const { last } = renderEditor(sample);
    const input = screen.getAllByPlaceholderText("New property name")[0];
    fireEvent.change(input, { target: { value: "memo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const out = last()!;
    // existing + new are all required
    expect(out.required).toEqual(
      expect.arrayContaining(["invoice_number", "total", "memo"]),
    );
  });

  it("never emits a schema that drops existing properties", () => {
    const { emits } = renderEditor(sample);
    const input = screen.getAllByPlaceholderText("New property name")[0];
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Enter" });
    for (const e of emits) {
      // invoice_number must survive every emitted schema
      expect(Object.keys(e.properties ?? {})).toContain("invoice_number");
    }
  });

  it("renames a property inline (parent-level op) and required follows", () => {
    const { last } = renderEditor(sample);
    const input = screen.getByDisplayValue(
      "invoice_number",
    ) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "inv_no" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const out = last()!;
    expect(Object.keys(out.properties!)).toContain("inv_no");
    expect(Object.keys(out.properties!)).not.toContain("invoice_number");
    // all required (policy): the renamed field + the others
    expect(out.required).toEqual(expect.arrayContaining(["inv_no", "total"]));
  });

  it("edits a NESTED property (recursive doc-routing) and keeps the parent intact", () => {
    const { last } = renderEditor({
      type: "object",
      properties: {
        vendor: {
          type: "object",
          properties: { name: { type: "string" }, city: { type: "string" } },
        },
      },
    });
    // The nested `vendor` add-input renders before the root's in the DOM.
    const inputs = screen.getAllByPlaceholderText("New property name");
    const nestedInput = inputs[0];
    fireEvent.change(nestedInput, { target: { value: "zip" } });
    fireEvent.keyDown(nestedInput, { key: "Enter" });
    const out = last()!;
    const vendor = out.properties!.vendor as JSONSchema7;
    expect(Object.keys(vendor.properties!)).toEqual(
      expect.arrayContaining(["name", "city", "zip"]),
    );
    // the edit was node-local to vendor — the root gained nothing
    expect(Object.keys(out.properties!)).toEqual(["vendor"]);
  });

  it("keeps the new enum choice input focused after adding a choice", () => {
    const { last } = renderEditor({
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft"] },
      },
    });

    const chip = screen.getByDisplayValue("draft").parentElement;
    expect(chip?.className).toContain("shadow-none");
    expect(chip?.className).toContain("bg-muted");
    expect(chip?.className).toContain("px-1");
    expect(chip?.className).not.toContain("py-1");
    expect(screen.getByLabelText("Option 1: draft")).toBeTruthy();

    const input = screen.getByPlaceholderText("New choice") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "paid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(document.activeElement).toBe(input);
    const status = last()!.properties!.status as JSONSchema7;
    expect(status.enum).toEqual(["draft", "paid"]);
  });
});

describe("SchemaInlineDescription", () => {
  it("renders editable descriptions as native inputs before they are clicked", () => {
    const onCommit = vi.fn();

    render(
      <SchemaInlineDescription
        ariaLabel="Description"
        editable
        value="The invoice identifier"
        onCommit={onCommit}
      />,
    );

    const input = screen.getByDisplayValue(
      "The invoice identifier",
    ) as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
  });
});
