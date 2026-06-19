// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { JSONSchema7 } from "json-schema";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { TableDocument } from "@/components/json-table/lib/projects-types";

import {
  findEditableCell,
  primitivePendingCellCommit,
  renderInteractionRow,
} from "./json-table-interaction-test-utils";
import { installJsonTableDom } from "./json-table-test-dom";

beforeAll(() => {
  installJsonTableDom();
  Object.assign(globalThis, { Node: window.Node });
});
afterEach(() => cleanup());

const enumSchema: JSONSchema7 = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["draft", "paid", "void"] },
    payment_type: { type: "string", enum: ["CREDIT", "DEBIT"] },
    numeric_status: { type: "integer", enum: [1, 2] },
    sentinel_status: {
      type: "string",
      enum: ["__json_table_null__", "option:1", "plain"],
    },
    nullable_status: {
      anyOf: [{ type: "string", enum: ["draft", "paid"] }, { type: "null" }],
    },
  },
};

const enumDocument: TableDocument = {
  id: "doc_enum",
  data: {
    status: "draft",
    payment_type: "DEBIT",
    numeric_status: 1,
    sentinel_status: "__json_table_null__",
    nullable_status: "paid",
  },
};

function renderEnumRow({
  document = enumDocument,
  visiblePaths,
  onCellCommit = vi.fn(),
  onEditSessionChange,
}: {
  document?: TableDocument;
  visiblePaths: string[];
  onCellCommit?: Parameters<typeof renderInteractionRow>[0]["onCellCommit"];
  onEditSessionChange?: Parameters<
    typeof renderInteractionRow
  >[0]["onEditSessionChange"];
}) {
  return {
    onCellCommit,
    ...renderInteractionRow({
      document,
      schema: enumSchema,
      visiblePaths,
      onCellCommit,
      onEditSessionChange,
    }),
  };
}

function pointerDown(target: Element | Document | Window) {
  fireEvent.pointerDown(primitiveEventTarget(target), {
    button: 0,
    buttons: 1,
    clientX: 24,
    clientY: 12,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  });
}

function clickCell(target: Element | Document | Window) {
  fireEvent.click(primitiveEventTarget(target), {
    button: 0,
    clientX: 24,
    clientY: 12,
    detail: 1,
  });
}

function primitiveEventTarget(target: Element | Document | Window) {
  if (!(target instanceof HTMLElement)) return target;
  if (!target.matches('[data-json-table-editable-cell="true"]')) return target;
  return target.matches('[data-slot="input-control"], [data-slot="data-cell"]')
    ? target
    : (target.querySelector<HTMLElement>(
        '[data-slot="input-control"], [data-slot="data-cell"]',
      ) ?? target);
}

async function openEnumCell(
  view: ReturnType<typeof renderEnumRow>,
  fieldPath: string,
) {
  const cell = await waitFor(() => findEditableCell(view.container, fieldPath));

  clickCell(cell);

  const trigger = await view.findByRole("combobox");
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true"),
  );

  return { cell, trigger };
}

async function selectOption(
  view: ReturnType<typeof renderEnumRow>,
  optionName: string | RegExp,
) {
  const option = await view.findByRole("option", { name: optionName });

  fireEvent.pointerDown(option, {
    button: 0,
    buttons: 1,
    clientX: 32,
    clientY: 16,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(option, {
    button: 0,
    clientX: 32,
    clientY: 16,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(option, { button: 0, detail: 1 });
}

async function expectDropdownClosed(view: ReturnType<typeof renderEnumRow>) {
  await waitFor(() => expect(view.queryByRole("combobox")).toBeNull());
}

describe("json table enum dropdown hardening", () => {
  it("opens options on the first click and marks the selected option active", async () => {
    const view = renderEnumRow({ visiblePaths: ["status"] });

    const { cell, trigger } = await openEnumCell(view, "status");

    expect(cell.getAttribute("data-active")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const activeOptionId = trigger.getAttribute("aria-activedescendant");
    expect(activeOptionId).toBeTruthy();
    const activeOption = activeOptionId
      ? document.getElementById(activeOptionId)
      : null;
    expect(activeOption?.getAttribute("role")).toBe("option");
    expect(activeOption?.textContent).toContain("draft");
    expect(await view.findByRole("option", { name: "paid" })).toBeTruthy();
  });

  it("commits a changed option and closes the dropdown session", async () => {
    const onCellCommit = vi.fn();
    const view = renderEnumRow({
      visiblePaths: ["status"],
      onCellCommit,
    });

    await openEnumCell(view, "status");
    await selectOption(view, "paid");

    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "status",
          previousValue: "draft",
          value: "paid",
        }),
      ),
    );
    expect(onCellCommit).toHaveBeenCalledTimes(1);
    await expectDropdownClosed(view);
  });

  it("closes on Escape without committing a document change", async () => {
    const onCellCommit = vi.fn();
    const view = renderEnumRow({
      visiblePaths: ["status"],
      onCellCommit,
    });

    const { trigger } = await openEnumCell(view, "status");
    fireEvent.keyDown(trigger, { key: "Escape" });

    await expectDropdownClosed(view);
    expect(onCellCommit).not.toHaveBeenCalled();
  });

  it("closes on outside pointer interaction without committing a document change", async () => {
    const onCellCommit = vi.fn();
    const view = renderEnumRow({
      visiblePaths: ["status"],
      onCellCommit,
    });

    await openEnumCell(view, "status");
    pointerDown(document.body);

    await expectDropdownClosed(view);
    expect(onCellCommit).not.toHaveBeenCalled();
  });

  it("closes without changing the document when selecting the current value", async () => {
    const onCellCommit = vi.fn();
    const view = renderEnumRow({
      visiblePaths: ["status"],
      onCellCommit,
    });

    await openEnumCell(view, "status");
    await selectOption(view, "draft");

    await expectDropdownClosed(view);
    expect(onCellCommit).not.toHaveBeenCalled();
  });

  it("commits number, sentinel-like string, and null enum values with JSON identity intact", async () => {
    const onCellCommit = vi.fn();
    const view = renderEnumRow({
      visiblePaths: ["numeric_status", "sentinel_status", "nullable_status"],
      onCellCommit,
    });

    await openEnumCell(view, "numeric_status");
    await selectOption(view, "2");
    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "numeric_status",
          previousValue: 1,
          value: 2,
        }),
      ),
    );

    await openEnumCell(view, "sentinel_status");
    await selectOption(view, "option:1");
    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "sentinel_status",
          previousValue: "__json_table_null__",
          value: "option:1",
        }),
      ),
    );

    await openEnumCell(view, "nullable_status");
    await selectOption(view, /no selection/i);
    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "nullable_status",
          previousValue: "paid",
          value: null,
        }),
      ),
    );

    expect(onCellCommit.mock.calls).toEqual([
      [
        primitivePendingCellCommit({
          fieldPath: "numeric_status",
          previousValue: 1,
          value: 2,
        }),
      ],
      [
        primitivePendingCellCommit({
          fieldPath: "sentinel_status",
          previousValue: "__json_table_null__",
          value: "option:1",
        }),
      ],
      [
        primitivePendingCellCommit({
          fieldPath: "nullable_status",
          previousValue: "paid",
          value: null,
        }),
      ],
    ]);
    await expectDropdownClosed(view);
  });

  it("survives repeated open and close cycles before committing once", async () => {
    const onCellCommit = vi.fn();
    const view = renderEnumRow({
      visiblePaths: ["status"],
      onCellCommit,
    });

    let active = await openEnumCell(view, "status");
    fireEvent.keyDown(active.trigger, { key: "Escape" });
    await expectDropdownClosed(view);

    await openEnumCell(view, "status");
    pointerDown(document.body);
    await expectDropdownClosed(view);

    active = await openEnumCell(view, "status");
    expect(active.trigger.getAttribute("aria-expanded")).toBe("true");
    const activeOptionId = active.trigger.getAttribute("aria-activedescendant");
    expect(activeOptionId).toBeTruthy();
    const activeOption = activeOptionId
      ? document.getElementById(activeOptionId)
      : null;
    expect(activeOption?.getAttribute("role")).toBe("option");
    await selectOption(view, "void");

    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "status",
          previousValue: "draft",
          value: "void",
        }),
      ),
    );
    expect(onCellCommit).toHaveBeenCalledTimes(1);
    await expectDropdownClosed(view);
  });

  it("switches directly from one enum cell to another without committing the first cell", async () => {
    const onCellCommit = vi.fn();
    const sessions: Array<string | null> = [];
    const view = renderEnumRow({
      visiblePaths: ["status", "payment_type"],
      onCellCommit,
      onEditSessionChange: (session) =>
        sessions.push(session?.fieldPath ?? null),
    });

    const first = await openEnumCell(view, "status");
    expect(first.cell.getAttribute("data-active")).toBe("true");
    expect(await view.findByRole("option", { name: "paid" })).toBeTruthy();

    const secondCell = findEditableCell(view.container, "payment_type");
    clickCell(secondCell);

    const trigger = await view.findByRole("combobox");
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("true"),
    );
    expect(
      findEditableCell(view.container, "status").getAttribute("data-active"),
    ).toBeNull();
    expect(secondCell.getAttribute("data-active")).toBe("true");
    expect(await view.findByRole("option", { name: "CREDIT" })).toBeTruthy();
    expect(onCellCommit).not.toHaveBeenCalled();
    expect(sessions).toContain("status");
    expect(sessions).toContain("payment_type");
  });
});
