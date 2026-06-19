// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataCell } from "@/components/ui/data-cell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function getPickerTrigger(): HTMLButtonElement {
  const trigger = document.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"]',
  );
  expect(trigger).toBeTruthy();
  return trigger as HTMLButtonElement;
}

function getPickerPopup(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-slot="data-cell-picker-popup"]',
  );
}

function getDataCellSurface(): HTMLElement {
  const surface = document.querySelector<HTMLElement>(
    '[data-slot="data-cell"]',
  );
  expect(surface).toBeTruthy();
  return surface as HTMLElement;
}

function expectPickerOpen() {
  expect(getPickerPopup()).toBeTruthy();
  expect(getPickerTrigger().getAttribute("aria-expanded")).toBe("true");
}

function expectPickerClosed() {
  expect(getPickerPopup()).toBeNull();
  const trigger = document.querySelector<HTMLButtonElement>(
    'button[data-slot="data-cell"]',
  );
  if (trigger) {
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  }
}

function dateDaySelector(date: Date) {
  return `button[data-day="${date.toLocaleDateString()}"]`;
}

describe("DataCell direct control lifecycle", () => {
  it("focuses text controls and places the caret from pointer activation intent", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 10,
      y: 0,
      top: 0,
      left: 10,
      right: 110,
      bottom: 24,
      width: 100,
      height: 24,
      toJSON: () => ({}),
    } as DOMRect);

    render(<DataCell kind="text" editable value="abcdefghij" />);

    fireEvent.pointerDown(getDataCellSurface(), {
      button: 0,
      clientX: 60,
      clientY: 8,
      detail: 1,
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);
  });

  it("keeps pointer caret placement through activation click tail events", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 30,
      bottom: 24,
      width: 30,
      height: 24,
      toJSON: () => ({}),
    } as DOMRect);

    render(<DataCell kind="text" editable value="USD" />);

    fireEvent.pointerDown(getDataCellSurface(), {
      button: 0,
      clientX: 10,
      clientY: 8,
      detail: 1,
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);

    fireEvent.mouseUp(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);

    fireEvent.click(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);
  });

  it("ignores unchanged blur from the pointer opening sequence", () => {
    const onCommit = vi.fn();
    const onEditingEnd = vi.fn();
    render(
      <DataCell
        kind="text"
        editable
        value="USD"
        onCommit={onCommit}
        onEditingEnd={onEditingEnd}
      />,
    );

    fireEvent.pointerDown(getDataCellSurface(), {
      button: 0,
      clientX: 10,
      clientY: 8,
      detail: 1,
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onEditingEnd).not.toHaveBeenCalled();
  });

  it("commits dirty blur even during the pointer opening sequence", () => {
    const onCommit = vi.fn();
    const onEditingEnd = vi.fn();
    render(
      <DataCell
        kind="text"
        editable
        value="USD"
        onCommit={onCommit}
        onEditingEnd={onEditingEnd}
      />,
    );

    fireEvent.pointerDown(getDataCellSurface(), {
      button: 0,
      clientX: 10,
      clientY: 8,
      detail: 1,
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "USDe" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(
      "USDe",
      expect.objectContaining({
        kind: "text",
        rawValue: "USDe",
        isEmpty: false,
        isValid: true,
      }),
    );
    expect(onEditingEnd).toHaveBeenCalledTimes(1);
  });

  it("commits empty number and integer controls as valid null values", () => {
    const onNumberCommit = vi.fn();
    const onIntegerCommit = vi.fn();
    const { unmount } = render(
      <DataCell kind="number" active value={12.5} onCommit={onNumberCommit} />,
    );

    const numberInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "" } });
    fireEvent.blur(numberInput);

    expect(onNumberCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "number",
        rawValue: "",
        isEmpty: true,
        isValid: true,
      }),
    );

    unmount();
    render(
      <DataCell kind="integer" active value={12} onCommit={onIntegerCommit} />,
    );

    const integerInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(integerInput, { target: { value: "" } });
    fireEvent.blur(integerInput);

    expect(onIntegerCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "integer",
        rawValue: "",
        isEmpty: true,
        isValid: true,
      }),
    );
  });

  it("commits invalid integer drafts as null with invalid metadata", () => {
    const onDraftValueChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <DataCell
        kind="integer"
        active
        value={1}
        onDraftValueChange={onDraftValueChange}
        onCommit={onCommit}
      />,
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.blur(input);

    expect(onDraftValueChange).toHaveBeenCalledWith(
      "1.5",
      expect.objectContaining({
        kind: "integer",
        rawValue: "1.5",
        isEmpty: false,
        isValid: false,
      }),
    );
    expect(onCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "integer",
        rawValue: "1.5",
        isEmpty: false,
        isValid: false,
      }),
    );
  });

  it("marks native number bad input invalid while preserving current commit parsing", () => {
    const onDraftValueChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <DataCell
        kind="number"
        active
        value={1}
        onDraftValueChange={onDraftValueChange}
        onCommit={onCommit}
      />,
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    Object.defineProperty(input, "validity", {
      configurable: true,
      value: { badInput: true },
    });
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);

    expect(onDraftValueChange).toHaveBeenCalledWith(
      "2",
      expect.objectContaining({
        kind: "number",
        rawValue: "2",
        isEmpty: false,
        isValid: false,
      }),
    );
    expect(onCommit).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        kind: "number",
        rawValue: "2",
        isEmpty: false,
        isValid: false,
      }),
    );
  });

  it("commits text controls on Enter and cancels them on Escape", () => {
    const onCommit = vi.fn();
    render(<DataCell kind="text" active value="old" onCommit={onCommit} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "entered" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(document.activeElement).not.toBe(input);
    expect(onCommit).toHaveBeenCalledWith(
      "entered",
      expect.objectContaining({
        kind: "text",
        rawValue: "entered",
        isEmpty: false,
        isValid: true,
      }),
    );

    onCommit.mockClear();
    input.focus();
    fireEvent.change(input, { target: { value: "escaped" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(document.activeElement).not.toBe(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits number controls on Enter and cancels them on Escape", () => {
    const onCommit = vi.fn();
    render(<DataCell kind="number" active value={1} onCommit={onCommit} />);

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(document.activeElement).not.toBe(input);
    expect(onCommit).toHaveBeenCalledWith(
      2.5,
      expect.objectContaining({
        kind: "number",
        rawValue: "2.5",
        isEmpty: false,
        isValid: true,
      }),
    );

    onCommit.mockClear();
    input.focus();
    fireEvent.change(input, { target: { value: "3.25" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(document.activeElement).not.toBe(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits text blur exactly once when a follow-up blur fires", () => {
    const onCommit = vi.fn();
    const onEditingEnd = vi.fn();
    render(
      <DataCell
        kind="text"
        active
        value="old"
        onCommit={onCommit}
        onEditingEnd={onEditingEnd}
      />,
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "finished" } });
    fireEvent.blur(input);
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      "finished",
      expect.objectContaining({
        kind: "text",
        rawValue: "finished",
        isValid: true,
      }),
    );
    expect(onEditingEnd).toHaveBeenCalledTimes(1);
  });

  it("cancels number edits on Escape without committing when blur follows", () => {
    const onCommit = vi.fn();
    const onEditingEnd = vi.fn();
    render(
      <DataCell
        kind="number"
        active
        value={1}
        onCommit={onCommit}
        onEditingEnd={onEditingEnd}
      />,
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3.25" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onEditingEnd).toHaveBeenCalledTimes(1);
  });

  it("commits invalid integer drafts on Enter with invalid metadata", () => {
    const onCommit = vi.fn();
    render(<DataCell kind="integer" active value={1} onCommit={onCommit} />);

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: "integer",
        rawValue: "1.5",
        isEmpty: false,
        isValid: false,
      }),
    );
  });

  it("opens date pickers from autofocus and activation, then closes on outside pointer and Escape", () => {
    const { unmount } = render(
      <div>
        <DataCell kind="date" editable value="2026-06-12" autoFocus />
        <button type="button">Outside</button>
      </div>,
    );

    fireEvent.pointerDown(getDataCellSurface(), {
      button: 0,
      clientX: 24,
      clientY: 12,
      detail: 1,
    });

    const trigger = getPickerTrigger();
    expectPickerOpen();

    fireEvent.click(trigger);
    expectPickerOpen();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expectPickerClosed();

    unmount();
    render(<DataCell kind="date" active value="2026-06-12" />);

    fireEvent.click(getPickerTrigger());
    expectPickerOpen();

    fireEvent.keyDown(document, { key: "Escape" });
    expectPickerClosed();
  });

  it("commits a selected date picker day and closes date controls", () => {
    const onCommit = vi.fn();
    render(
      <DataCell kind="date" active value="2026-06-12" onCommit={onCommit} />,
    );

    fireEvent.click(getPickerTrigger());
    const nextDay = document.querySelector<HTMLButtonElement>(
      dateDaySelector(new Date(2026, 5, 15)),
    );
    expect(nextDay).toBeTruthy();
    fireEvent.click(nextDay as HTMLButtonElement);

    expect(onCommit).toHaveBeenCalledWith(
      "2026-06-15",
      expect.objectContaining({
        kind: "date",
        rawValue: "2026-06-15",
        isEmpty: false,
        isValid: true,
      }),
    );
    expectPickerClosed();
  });

  it("commits boolean pointer activation and leaves raw key events to the native button", () => {
    const onCommit = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <DataCell
        kind="boolean"
        active
        value={false}
        onCommit={onCommit}
        onKeyDown={onKeyDown}
      />,
    );

    const checkbox = screen.getByRole("checkbox") as HTMLButtonElement;
    fireEvent.keyDown(checkbox, { key: "Enter" });

    expect(onKeyDown).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(checkbox);

    expect(onCommit).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        kind: "boolean",
        rawValue: "true",
        isEmpty: false,
        isValid: true,
      }),
    );
  });
});
