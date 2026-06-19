import { describe, expect, it } from "vitest";

import { getMeasuredTextSelectionOffset } from "@/registry/new-york-v4/ui/data-cell-text-hit-test";

function graphemeWidthMeasurer(widths: number[]) {
  return (value: string) => {
    const graphemes = Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value),
    );
    return graphemes.reduce(
      (total, _segment, index) => total + (widths[index] ?? 0),
      0,
    );
  };
}

describe("DataCell text hit testing", () => {
  it("places the caret at the nearest measured boundary for proportional text", () => {
    const value = "illWWW";
    const measurePrefixWidth = graphemeWidthMeasurer([2, 2, 2, 10, 10, 10]);

    expect(
      getMeasuredTextSelectionOffset({
        measurePrefixWidth,
        targetX: 11,
        value,
      }),
    ).toBe(3);
    expect(
      getMeasuredTextSelectionOffset({
        measurePrefixWidth,
        targetX: 12,
        value,
      }),
    ).toBe(4);
  });

  it("never returns an offset inside a multi-code-unit grapheme", () => {
    const value = "Ae\u0301B";
    const measurePrefixWidth = graphemeWidthMeasurer([10, 20, 10]);

    expect(
      getMeasuredTextSelectionOffset({
        measurePrefixWidth,
        targetX: 24,
        value,
      }),
    ).toBe(3);
    expect(
      getMeasuredTextSelectionOffset({
        measurePrefixWidth,
        targetX: 30,
        value,
      }),
    ).toBe(3);
  });

  it("clamps hits before and after the measured text", () => {
    const value = "USD";
    const measurePrefixWidth = graphemeWidthMeasurer([10, 10, 10]);

    expect(
      getMeasuredTextSelectionOffset({
        measurePrefixWidth,
        targetX: -8,
        value,
      }),
    ).toBe(0);
    expect(
      getMeasuredTextSelectionOffset({
        measurePrefixWidth,
        targetX: 48,
        value,
      }),
    ).toBe(value.length);
  });
});
