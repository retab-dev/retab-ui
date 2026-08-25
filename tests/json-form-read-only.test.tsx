// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { JSONSchema7 } from "json-schema";
import { useForm } from "react-hook-form";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { JsonForm } from "@/components/json-form/json-form";
import { JsonFormRetab } from "@/components/json-form-retab/json-form-retab";

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

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    document_title: { type: "string", title: "Document title" },
    consideration_amount: { type: "number", title: "Consideration amount" },
    is_condo: { type: "boolean", title: "Is condo" },
    deed_type: {
      type: "string",
      title: "Deed type",
      enum: ["warranty", "quitclaim"],
    },
    document_references: {
      type: "array",
      title: "Document references",
      items: {
        type: "object",
        properties: {
          book: { type: "string", title: "Book" },
          page: { type: "string", title: "Page" },
        },
      },
    },
  },
};

const defaultValues = {
  document_title: "WARRANTY DEED",
  consideration_amount: 10,
  is_condo: false,
  deed_type: "warranty",
  document_references: [{ book: "822", page: "216" }],
};

function renderJsonForm({ readOnly }: { readOnly?: boolean } = {}) {
  function Harness() {
    const form = useForm<Record<string, unknown>>({ defaultValues });
    return <JsonForm form={form} schema={schema} readOnly={readOnly} />;
  }

  return render(<Harness />);
}

function isDisabled(element: HTMLElement): boolean {
  return (element as HTMLButtonElement).disabled === true;
}

function tableCell(label: string): HTMLElement {
  const cell = Array.from(
    document.querySelectorAll<HTMLElement>("[data-table-cell]"),
  ).find((candidate) => candidate.getAttribute("aria-label") === label);
  if (!cell) throw new Error(`table cell ${label} was not found`);
  return cell;
}

describe("JsonForm read-only mode", () => {
  it("marks every scalar input read-only while keeping its value visible", () => {
    renderJsonForm({ readOnly: true });

    const title = screen.getByLabelText("Document title") as HTMLInputElement;
    const amount = screen.getByLabelText(
      "Consideration amount",
    ) as HTMLInputElement;

    expect(title.readOnly).toBe(true);
    expect(title.value).toBe("WARRANTY DEED");
    expect(amount.readOnly).toBe(true);
    expect(amount.value).toBe("10");
  });

  it("disables the controls that have no native read-only state", () => {
    renderJsonForm({ readOnly: true });

    expect(isDisabled(screen.getByLabelText("Is condo"))).toBe(true);
    expect(isDisabled(screen.getByLabelText("Deed type"))).toBe(true);
  });

  it("drops the array add and remove affordances", () => {
    renderJsonForm({ readOnly: true });

    expect(screen.getByText("Document references")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove row" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove item" })).toBeNull();
  });

  it("leaves table cells inert so a click cannot open an editor", () => {
    renderJsonForm({ readOnly: true });

    const cell = tableCell("Book 822");
    expect(cell.getAttribute("data-table-cell-editable")).toBeNull();
    expect(cell.getAttribute("tabindex")).toBeNull();

    fireEvent.click(cell);

    expect(document.querySelector("[data-table-cell-editor]")).toBeNull();
  });

  it("stays editable by default", () => {
    renderJsonForm();

    const title = screen.getByLabelText("Document title") as HTMLInputElement;
    const cell = tableCell("Book 822");

    expect(title.readOnly).toBe(false);
    expect(isDisabled(screen.getByLabelText("Is condo"))).toBe(false);
    expect(isDisabled(screen.getByLabelText("Deed type"))).toBe(false);
    expect(screen.getByRole("button", { name: "Add" })).not.toBeNull();
    expect(cell.getAttribute("data-table-cell-editable")).toBe("true");

    fireEvent.click(cell);

    expect(document.querySelector("[data-table-cell-editor]")).not.toBeNull();
  });
});

describe("JsonFormRetab read-only mode", () => {
  it("propagates read-only through the Retab form", () => {
    function Harness() {
      const form = useForm<Record<string, unknown>>({ defaultValues });
      return <JsonFormRetab form={form} schema={schema} readOnly />;
    }
    render(<Harness />);

    const title = screen.getByLabelText("Document title") as HTMLInputElement;

    expect(title.readOnly).toBe(true);
    expect(isDisabled(screen.getByLabelText("Deed type"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
  });
});
