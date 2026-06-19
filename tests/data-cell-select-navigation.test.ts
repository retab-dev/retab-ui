import { describe, expect, it } from "vitest";

import {
  firstEnabledDataCellSelectOptionIndex,
  lastEnabledDataCellSelectOptionIndex,
  nextEnabledDataCellSelectOptionIndex,
  selectedDataCellSelectOptionIndex,
} from "@/registry/new-york-v4/ui/data-cell-select-navigation";
import type { DataCellSelectOption } from "@/registry/new-york-v4/ui/data-cell-types";

const options: DataCellSelectOption[] = [
  { value: "a", label: "A", disabled: true },
  { value: "b", label: "B" },
  { value: "c", label: "C", disabled: true },
  { value: "d", label: "D" },
];

describe("DataCell select navigation", () => {
  it("finds the first and last enabled options", () => {
    expect(firstEnabledDataCellSelectOptionIndex(options)).toBe(1);
    expect(lastEnabledDataCellSelectOptionIndex(options)).toBe(3);
  });

  it("returns -1 when every option is disabled", () => {
    const disabledOptions = options.map((option) => ({
      ...option,
      disabled: true,
    }));

    expect(firstEnabledDataCellSelectOptionIndex(disabledOptions)).toBe(-1);
    expect(lastEnabledDataCellSelectOptionIndex(disabledOptions)).toBe(-1);
    expect(
      nextEnabledDataCellSelectOptionIndex({
        options: disabledOptions,
        currentIndex: 0,
        direction: 1,
      }),
    ).toBe(-1);
  });

  it("wraps and skips disabled options", () => {
    expect(
      nextEnabledDataCellSelectOptionIndex({
        options,
        currentIndex: 1,
        direction: 1,
      }),
    ).toBe(3);
    expect(
      nextEnabledDataCellSelectOptionIndex({
        options,
        currentIndex: 3,
        direction: 1,
      }),
    ).toBe(1);
    expect(
      nextEnabledDataCellSelectOptionIndex({
        options,
        currentIndex: 1,
        direction: -1,
      }),
    ).toBe(3);
  });

  it("uses the selected enabled option or falls back to the first enabled option", () => {
    expect(
      selectedDataCellSelectOptionIndex({
        options,
        value: "d",
      }),
    ).toBe(3);
    expect(
      selectedDataCellSelectOptionIndex({
        options,
        value: "a",
      }),
    ).toBe(1);
    expect(
      selectedDataCellSelectOptionIndex({
        options,
        value: null,
      }),
    ).toBe(1);
  });
});
