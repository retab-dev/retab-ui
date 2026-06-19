// @vitest-environment jsdom

import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  findEditableCell,
  primitiveEventTarget,
  renderInteractionRow,
} from "./json-table-interaction-test-utils";
import { installJsonTableDom } from "./json-table-test-dom";

beforeAll(() => installJsonTableDom());
afterEach(() => cleanup());

async function editableCell(
  view: { container: HTMLElement },
  fieldPath: string,
) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  });
}

function pickerPopup() {
  return document.querySelector('[data-slot="data-cell-picker-popup"]');
}

function pickerTrigger() {
  const trigger = document.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"][aria-haspopup="dialog"]',
  );
  if (!trigger) throw new Error("Expected picker trigger");
  return trigger;
}

async function activateCell(
  view: { container: HTMLElement },
  fieldPath: string,
) {
  const cell = await editableCell(view, fieldPath);
  fireEvent.pointerDown(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  });
  return cell;
}

describe("json table interaction regressions", () => {
  it("does not start type-to-edit from platform shortcuts", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] });
    const cell = await editableCell(view, "vendor");
    const surface = primitiveEventTarget(cell) as HTMLElement;

    surface.focus();
    fireEvent.keyDown(surface, { key: "c", metaKey: true });
    fireEvent.keyDown(surface, { key: "c", ctrlKey: true });
    fireEvent.keyDown(surface, { key: "e", altKey: true });

    expect(view.queryByRole("textbox")).toBeNull();
  });

  it("still starts type-to-edit from AltGraph character input", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] });
    const cell = await editableCell(view, "vendor");
    const surface = primitiveEventTarget(cell) as HTMLElement;

    surface.focus();
    fireEvent.keyDown(surface, {
      key: "€",
      ctrlKey: true,
      altKey: true,
      getModifierState: (key: string) => key === "AltGraph",
    });

    expect(view.getByRole("textbox")).toHaveProperty("value", "€");
  });

  it("does not start type-to-edit while IME composition is active", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] });
    const cell = await editableCell(view, "vendor");
    const surface = primitiveEventTarget(cell) as HTMLElement;

    surface.focus();
    fireEvent.keyDown(surface, {
      key: "a",
      isComposing: true,
    });

    expect(view.queryByRole("textbox")).toBeNull();
  });

  it("moves focus into the checkbox after non-toggle keyboard activation", async () => {
    for (const key of ["Enter", "F2"]) {
      const view = renderInteractionRow({ visiblePaths: ["is_paid"] });
      const cell = await editableCell(view, "is_paid");
      const surface = primitiveEventTarget(cell) as HTMLElement;

      surface.focus();
      fireEvent.keyDown(surface, { key });

      const checkbox = await view.findByRole("checkbox");
      expect(document.activeElement).toBe(checkbox);
      cleanup();
    }
  });

  it("lets keyboard-opened pickers close from the first trigger click", async () => {
    const view = renderInteractionRow({ visiblePaths: ["shipped_at"] });
    const cell = await editableCell(view, "shipped_at");
    const surface = primitiveEventTarget(cell) as HTMLElement;

    surface.focus();
    fireEvent.keyDown(surface, { key: "Enter" });

    const trigger = pickerTrigger();
    expect(await view.findByRole("dialog")).toBeTruthy();

    fireEvent.click(trigger);

    await waitFor(() => expect(pickerPopup()).toBeNull());
  });

  it("still keeps pointer-opened pickers open through the follow-up click", async () => {
    const view = renderInteractionRow({ visiblePaths: ["shipped_at"] });

    await activateCell(view, "shipped_at");
    const trigger = pickerTrigger();
    expect(await view.findByRole("dialog")).toBeTruthy();

    fireEvent.click(trigger);

    expect(pickerPopup()).toBeTruthy();
  });

  it("does not let read-only cells start editing from keyboard shortcuts", async () => {
    const onCellCommit = vi.fn();
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "is_paid", "shipped_at"],
      isJsonEditable: false,
      onCellCommit,
    });

    for (const fieldPath of ["vendor", "is_paid", "shipped_at"]) {
      const cell = view.container.querySelector<HTMLElement>(
        `td[data-field-path="${fieldPath}"]`,
      );
      if (!cell) throw new Error(`Missing ${fieldPath}`);
      fireEvent.keyDown(cell, { key: "Enter" });
      fireEvent.keyDown(cell, { key: " " });
      fireEvent.pointerDown(cell, { button: 0 });
    }

    expect(view.queryByRole("textbox")).toBeNull();
    expect(
      view.container.querySelector('[data-slot="data-cell"][data-mode="edit"]'),
    ).toBeNull();
    expect(pickerPopup()).toBeNull();
    expect(onCellCommit).not.toHaveBeenCalled();
  });
});
