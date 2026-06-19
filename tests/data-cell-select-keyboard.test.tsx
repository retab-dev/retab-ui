import type * as React from "react";
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDataCellSelectKeyboard } from "@/registry/new-york-v4/ui/data-cell-select-keyboard";
import type { DataCellSelectOption } from "@/registry/new-york-v4/ui/data-cell-types";

const options: DataCellSelectOption[] = [
  { value: "a", label: "A", disabled: true },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

function keyboardEvent(key: string) {
  const nativeEvent = new KeyboardEvent("keydown", { key });
  return {
    key,
    nativeEvent,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLButtonElement>;
}

describe("DataCell select keyboard", () => {
  it("opens on arrow navigation when closed", () => {
    const openEditor = vi.fn();
    const { result } = renderHook(() =>
      useDataCellSelectKeyboard({
        activeOption: undefined,
        open: false,
        options,
        openEditor,
        closeEditor: vi.fn(),
        commitValue: vi.fn(),
        setActiveOptionIndex: vi.fn(),
        shouldCancelDismiss: vi.fn(() => false),
      }),
    );
    const event = keyboardEvent("ArrowDown");

    act(() => result.current(event));

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openEditor).toHaveBeenCalledTimes(1);
  });

  it("skips disabled options with arrows, Home, and End", () => {
    let activeIndex = 1;
    const setActiveOptionIndex = vi.fn((update) => {
      activeIndex =
        typeof update === "function" ? update(activeIndex) : Number(update);
    });
    const { result } = renderHook(() =>
      useDataCellSelectKeyboard({
        activeOption: options[activeIndex],
        open: true,
        options,
        openEditor: vi.fn(),
        closeEditor: vi.fn(),
        commitValue: vi.fn(),
        setActiveOptionIndex,
        shouldCancelDismiss: vi.fn(() => false),
      }),
    );

    act(() => result.current(keyboardEvent("ArrowDown")));
    expect(activeIndex).toBe(2);

    act(() => result.current(keyboardEvent("ArrowDown")));
    expect(activeIndex).toBe(1);

    act(() => result.current(keyboardEvent("Home")));
    expect(activeIndex).toBe(1);

    act(() => result.current(keyboardEvent("End")));
    expect(activeIndex).toBe(2);
  });

  it("commits the active option with Enter and cancels with Escape", () => {
    const commitValue = vi.fn();
    const closeEditor = vi.fn();
    const shouldCancelDismiss = vi.fn(() => false);
    const { result } = renderHook(() =>
      useDataCellSelectKeyboard({
        activeOption: options[1],
        open: true,
        options,
        openEditor: vi.fn(),
        closeEditor,
        commitValue,
        setActiveOptionIndex: vi.fn(),
        shouldCancelDismiss,
      }),
    );

    act(() => result.current(keyboardEvent("Enter")));
    act(() => result.current(keyboardEvent("Escape")));

    expect(commitValue).toHaveBeenCalledWith("b");
    expect(shouldCancelDismiss).toHaveBeenCalledTimes(1);
    expect(closeEditor).toHaveBeenCalledTimes(1);
  });
});
