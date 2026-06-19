// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { JsonTableActiveCell } from "@/components/json-table/json-table-edit-session";

import {
  findEditableCell,
  interactionDocument,
  primitivePendingCellCommit,
  renderInteractionRow,
} from "./json-table-interaction-test-utils";
import { installJsonTableDom } from "./json-table-test-dom";

beforeAll(() => installJsonTableDom());
afterEach(() => {
  cleanup();
  document.body.removeAttribute("style");
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

type RenderedView = ReturnType<typeof renderInteractionRow>;

async function editableCell(view: RenderedView, fieldPath: string) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  });
}

async function renderedCell(view: RenderedView, fieldPath: string) {
  return waitFor(() => {
    const cell = view.container.querySelector<HTMLElement>(
      `td[data-field-path="${fieldPath}"]`,
    );
    if (!cell) throw new Error(`Expected rendered cell for ${fieldPath}`);
    return cell;
  });
}

function keyDown(target: HTMLElement | Document, key: string, init = {}) {
  fireEvent.keyDown(target, { key, ...init });
}

function pointerActivateCell(cell: HTMLElement) {
  fireEvent.pointerDown(dataCellSurface(cell) ?? cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  });
}

function dataCellSurface(cell: HTMLElement) {
  return cell.querySelector<HTMLElement>('[data-slot="data-cell"]');
}

async function editableDataCell(view: RenderedView, fieldPath: string) {
  const cell = await editableCell(view, fieldPath);
  const surface = dataCellSurface(cell);
  if (!surface) throw new Error(`Expected DataCell surface for ${fieldPath}`);
  return { cell, surface };
}

async function expectFocusReturnedToDataCell(
  view: RenderedView,
  fieldPath: string,
) {
  await waitFor(async () => {
    const { surface } = await editableDataCell(view, fieldPath);
    expect(document.activeElement).toBe(surface);
  });
}

async function keyboardActivateCell(
  view: RenderedView,
  fieldPath: string,
  key: string,
) {
  const { cell, surface } = await editableDataCell(view, fieldPath);
  surface.focus();
  keyDown(surface, key);
  return { cell, surface };
}

async function openEnum(view: RenderedView, fieldPath = "status") {
  const { cell, surface } = await keyboardActivateCell(
    view,
    fieldPath,
    "Enter",
  );
  const trigger = await view.findByRole("combobox");
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true"),
  );
  return { cell, surface, trigger };
}

async function chooseOption(option: HTMLElement) {
  fireEvent.pointerDown(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(option);
}

function pickerTrigger(view: RenderedView, fieldPath: string) {
  const cell = view.container.querySelector<HTMLElement>(
    `td[data-field-path="${fieldPath}"]`,
  );
  const trigger = cell?.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"][aria-haspopup="dialog"]',
  );
  if (!trigger) throw new Error(`Expected picker trigger for ${fieldPath}`);
  return trigger;
}

async function openPicker(view: RenderedView, fieldPath = "shipped_at") {
  const { cell, surface } = await keyboardActivateCell(
    view,
    fieldPath,
    "Enter",
  );
  const trigger = pickerTrigger(view, fieldPath);
  const popup = await view.findByRole("dialog");
  return { cell, surface, trigger, popup };
}

function pickerPopup() {
  return document.querySelector<HTMLElement>(
    '[data-slot="data-cell-picker-popup"]',
  );
}

function expectAriaControlsTarget(trigger: HTMLElement, target: HTMLElement) {
  const controls = trigger.getAttribute("aria-controls");
  expect(controls).toBeTruthy();
  expect(document.getElementById(controls ?? "")).toBe(target);
}

function latestSession(sessions: Array<JsonTableActiveCell | null>) {
  return sessions.at(-1);
}

describe("json table a11y and keyboard hardening", () => {
  it("makes editable cells tabbable and read-only cells non-tabbable", async () => {
    const editableView = renderInteractionRow({
      visiblePaths: ["vendor", "amount", "is_paid", "status", "shipped_at"],
    });

    for (const fieldPath of [
      "vendor",
      "amount",
      "is_paid",
      "status",
      "shipped_at",
    ]) {
      expect(
        (await editableDataCell(editableView, fieldPath)).surface.getAttribute(
          "tabindex",
        ),
      ).toBe("0");
    }

    cleanup();

    const readonlyView = renderInteractionRow({
      visiblePaths: ["vendor", "amount", "is_paid", "status", "shipped_at"],
      isJsonEditable: false,
    });

    for (const fieldPath of [
      "vendor",
      "amount",
      "is_paid",
      "status",
      "shipped_at",
    ]) {
      expect((await renderedCell(readonlyView, fieldPath)).tabIndex).toBe(-1);
    }
  });

  it.each(["Enter", "F2"] as const)(
    "opens text input from %s and retains focus inside the input",
    async (key) => {
      const view = renderInteractionRow({ visiblePaths: ["vendor"] });

      await keyboardActivateCell(view, "vendor", key);

      const input = view.getByRole("textbox");
      expect(input).toHaveProperty("value", "ACME");
      expect(document.activeElement).toBe(input);
    },
  );

  it("starts text type-to-edit from Space and printable characters", async () => {
    const spaceView = renderInteractionRow({ visiblePaths: ["vendor"] });
    await keyboardActivateCell(spaceView, "vendor", " ");
    expect(spaceView.getByRole("textbox")).toHaveProperty("value", " ");

    cleanup();

    const letterView = renderInteractionRow({ visiblePaths: ["vendor"] });
    await keyboardActivateCell(letterView, "vendor", "Z");
    expect(letterView.getByRole("textbox")).toHaveProperty("value", "Z");
  });

  it("starts number type-to-edit only from numeric characters", async () => {
    const digitView = renderInteractionRow({ visiblePaths: ["amount"] });
    await keyboardActivateCell(digitView, "amount", "7");
    expect(digitView.getByRole("spinbutton")).toHaveProperty("value", "7");

    cleanup();

    const spaceView = renderInteractionRow({ visiblePaths: ["amount"] });
    const { cell, surface } = await editableDataCell(spaceView, "amount");
    surface.focus();
    keyDown(surface, " ");

    expect(spaceView.queryByRole("spinbutton")).toBeNull();
    expect(cell.getAttribute("data-active")).toBeNull();
  });

  it("toggles booleans from Space and only focuses the checkbox from Enter or F2", async () => {
    const onCellCommit = vi.fn();
    const spaceView = renderInteractionRow({
      visiblePaths: ["is_paid"],
      onCellCommit,
    });

    await keyboardActivateCell(spaceView, "is_paid", " ");

    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "is_paid",
          value: true,
          previousValue: false,
        }),
      ),
    );
    await waitFor(() =>
      expect(
        spaceView.container.querySelector('button[role="checkbox"]'),
      ).toBeNull(),
    );

    for (const key of ["Enter", "F2"] as const) {
      cleanup();
      const view = renderInteractionRow({
        visiblePaths: ["is_paid"],
        onCellCommit,
      });

      await keyboardActivateCell(view, "is_paid", key);

      const checkbox = await view.findByRole("checkbox");
      expect(document.activeElement).toBe(checkbox);
      expect(onCellCommit).toHaveBeenCalledTimes(1);
    }
  });

  it("closes a focused boolean checkbox on Escape without committing", async () => {
    const onCellCommit = vi.fn();
    const sessions: Array<JsonTableActiveCell | null> = [];
    const view = renderInteractionRow({
      visiblePaths: ["is_paid"],
      onCellCommit,
      onEditSessionChange: (session) => sessions.push(session),
    });
    await keyboardActivateCell(view, "is_paid", "Enter");
    const checkbox = await view.findByRole("checkbox");

    keyDown(checkbox, "Escape");

    await waitFor(() =>
      expect(
        view.container.querySelector('[data-mode="edit"] [role="checkbox"]'),
      ).toBeNull(),
    );
    expect(onCellCommit).not.toHaveBeenCalled();
    expect(latestSession(sessions)).toBeNull();
    await expectFocusReturnedToDataCell(view, "is_paid");
  });

  it("ignores platform shortcuts and navigation keys before editing starts", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] });
    const { cell, surface } = await editableDataCell(view, "vendor");

    surface.focus();
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "Tab"]) {
      keyDown(surface, key);
    }
    keyDown(surface, "a", { metaKey: true });
    keyDown(surface, "a", { ctrlKey: true });
    keyDown(surface, "a", { altKey: true });

    expect(view.queryByRole("textbox")).toBeNull();
    expect(cell.getAttribute("data-active")).toBeNull();
  });

  it("allows AltGraph printable input while keeping ordinary Ctrl+Alt shortcuts inert", async () => {
    const shortcutView = renderInteractionRow({ visiblePaths: ["vendor"] });
    const { surface: shortcutSurface } = await editableDataCell(
      shortcutView,
      "vendor",
    );
    shortcutSurface.focus();
    keyDown(shortcutSurface, "e", { ctrlKey: true, altKey: true });
    expect(shortcutView.queryByRole("textbox")).toBeNull();

    cleanup();

    const altGraphView = renderInteractionRow({ visiblePaths: ["vendor"] });
    const { surface: altGraphSurface } = await editableDataCell(
      altGraphView,
      "vendor",
    );
    altGraphSurface.focus();
    keyDown(altGraphSurface, "€", {
      ctrlKey: true,
      altKey: true,
      getModifierState: (modifier: string) => modifier === "AltGraph",
    });

    expect(altGraphView.getByRole("textbox")).toHaveProperty("value", "€");
  });

  it("ignores type-to-edit while IME composition is active", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] });
    const { cell, surface } = await editableDataCell(view, "vendor");

    surface.focus();
    keyDown(surface, "あ", { isComposing: true });

    expect(view.queryByRole("textbox")).toBeNull();
    expect(cell.getAttribute("data-active")).toBeNull();
  });

  it("exposes enum combobox roles, open state, and aria-controls linkage", async () => {
    const view = renderInteractionRow({ visiblePaths: ["status"] });

    const { trigger } = await openEnum(view);

    expect(trigger.getAttribute("role")).toBe("combobox");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expectAriaControlsTarget(trigger, view.getByRole("listbox"));
    expect(view.getByRole("option", { name: "draft" })).toBeTruthy();
    expect(view.getByRole("option", { name: "approved" })).toBeTruthy();
  });

  it("closes enum on Escape without committing and returns focus to the table cell", async () => {
    const onCellCommit = vi.fn();
    const sessions: Array<JsonTableActiveCell | null> = [];
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onCellCommit,
      onEditSessionChange: (session) => sessions.push(session),
    });
    const { trigger } = await openEnum(view);

    keyDown(trigger, "Escape");

    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull());
    expect(onCellCommit).not.toHaveBeenCalled();
    expect(latestSession(sessions)).toBeNull();
    await expectFocusReturnedToDataCell(view, "status");
  });

  it("cleans up enum focus after committing a selected option", async () => {
    const onCellCommit = vi.fn();
    const view = renderInteractionRow({
      visiblePaths: ["status"],
      onCellCommit,
    });
    await openEnum(view);

    await chooseOption(view.getByRole("option", { name: "approved" }));

    await waitFor(() =>
      expect(onCellCommit).toHaveBeenCalledWith(
        primitivePendingCellCommit({
          fieldPath: "status",
          value: "approved",
          previousValue: "draft",
        }),
      ),
    );
    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull());
    await expectFocusReturnedToDataCell(view, "status");
  });

  it("exposes picker button semantics, open state, and dialog aria-controls linkage", async () => {
    const view = renderInteractionRow({ visiblePaths: ["shipped_at"] });

    const { trigger, popup } = await openPicker(view);

    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.getAttribute("role")).toBe("dialog");
    expectAriaControlsTarget(trigger, popup);
    expect(document.activeElement).toBe(trigger);
  });

  it("closes picker on Escape without committing and returns focus to the table cell", async () => {
    const onCellCommit = vi.fn();
    const sessions: Array<JsonTableActiveCell | null> = [];
    const view = renderInteractionRow({
      visiblePaths: ["shipped_at"],
      onCellCommit,
      onEditSessionChange: (session) => sessions.push(session),
    });
    await openPicker(view);

    keyDown(document, "Escape");

    await waitFor(() => expect(pickerPopup()).toBeNull());
    expect(onCellCommit).not.toHaveBeenCalled();
    expect(latestSession(sessions)).toBeNull();
    await expectFocusReturnedToDataCell(view, "shipped_at");
  });

  it("keeps read-only cells keyboard inert across scalar, boolean, enum, and picker kinds", async () => {
    const onCellCommit = vi.fn();
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "is_paid", "status", "shipped_at"],
      isJsonEditable: false,
      onCellCommit,
    });

    for (const fieldPath of ["vendor", "is_paid", "status", "shipped_at"]) {
      const cell = await renderedCell(view, fieldPath);
      cell.focus();
      for (const key of ["Enter", "F2", " ", "x", "Escape"]) {
        keyDown(cell, key);
      }
      pointerActivateCell(cell);
    }

    expect(view.queryByRole("textbox")).toBeNull();
    expect(view.container.querySelector('button[role="checkbox"]')).toBeNull();
    expect(view.queryByRole("combobox")).toBeNull();
    expect(pickerPopup()).toBeNull();
    expect(onCellCommit).not.toHaveBeenCalled();
  });

  it("returns focus to the table cell after text commit from Enter", async () => {
    const onCellCommit = vi.fn();
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit,
    });
    const { cell } = await editableDataCell(view, "vendor");
    pointerActivateCell(cell);
    const input = view.getByRole("textbox");

    fireEvent.change(input, { target: { value: "Focus Co" } });
    keyDown(input, "Enter");

    expect(onCellCommit).toHaveBeenCalledWith(
      primitivePendingCellCommit({
        fieldPath: "vendor",
        value: "Focus Co",
        previousValue: "ACME",
      }),
    );
    await waitFor(() => expect(view.queryByRole("textbox")).toBeNull());
    await expectFocusReturnedToDataCell(view, "vendor");
  });
});
