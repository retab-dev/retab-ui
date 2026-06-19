import { describe, expect, it } from "vitest";

import {
  buildTextVirtualOffsets,
  getTextScrollAnchor,
  getTextVirtualItems,
  textScrollTopForItem,
} from "@/registry/new-york-v4/ui/text-viewer-virtualization";

describe("text viewer variable virtualization", () => {
  it("builds variable offsets with top and bottom padding", () => {
    expect(
      buildTextVirtualOffsets({
        itemSizes: [20, 40, 30],
        paddingStart: 8,
        paddingEnd: 12,
      }),
    ).toEqual({
      starts: [8, 28, 68],
      totalSize: 110,
    });
  });

  it("returns the visible variable-height window with overscan", () => {
    const itemSizes = [20, 40, 30, 50, 25];
    const offsets = buildTextVirtualOffsets({
      itemSizes,
      paddingStart: 10,
    });

    expect(
      getTextVirtualItems({
        itemSizes,
        offsets,
        scrollTop: 52,
        viewportHeight: 40,
        overscan: 1,
      }).map(({ index, start, size, end }) => ({ index, start, size, end })),
    ).toEqual([
      { index: 0, start: 10, size: 20, end: 30 },
      { index: 1, start: 30, size: 40, end: 70 },
      { index: 2, start: 70, size: 30, end: 100 },
      { index: 3, start: 100, size: 50, end: 150 },
    ]);
  });

  it("clamps hostile inputs without allocating invalid rows", () => {
    const itemSizes = [20, Number.NaN, -10, 30];
    const offsets = buildTextVirtualOffsets({
      itemSizes,
      paddingStart: Number.NaN,
      paddingEnd: -100,
    });

    expect(offsets).toEqual({
      starts: [0, 20, 20, 20],
      totalSize: 50,
    });
    expect(
      getTextVirtualItems({
        itemSizes,
        offsets,
        scrollTop: Number.NaN,
        viewportHeight: 0,
        overscan: -1,
      }),
    ).toEqual([{ index: 0, key: 0, start: 0, size: 20, end: 20 }]);
  });

  it("caps the rendered window for hostile viewport sizes", () => {
    const itemSizes = Array.from({ length: 2_000 }, () => 20);
    const offsets = buildTextVirtualOffsets({ itemSizes });

    expect(
      getTextVirtualItems({
        itemSizes,
        offsets,
        scrollTop: 0,
        viewportHeight: 1_000_000,
      }),
    ).toHaveLength(500);
  });

  it("computes aligned scroll offsets for variable rows", () => {
    const itemSizes = [20, 40, 30];
    const offsets = buildTextVirtualOffsets({
      itemSizes,
      paddingStart: 8,
    });

    expect(
      textScrollTopForItem({
        itemIndex: 1,
        itemSizes,
        offsets,
        viewportHeight: 100,
        align: "start",
      }),
    ).toBe(28);
    expect(
      textScrollTopForItem({
        itemIndex: 1,
        itemSizes,
        offsets,
        viewportHeight: 100,
        align: "center",
      }),
    ).toBe(0);
    expect(
      textScrollTopForItem({
        itemIndex: 2,
        itemSizes,
        offsets,
        viewportHeight: 50,
        align: "end",
      }),
    ).toBe(48);
  });

  it("captures the source item and intra-item offset for scroll preservation", () => {
    const itemSizes = [20, 40, 30];
    const offsets = buildTextVirtualOffsets({
      itemSizes,
      paddingStart: 8,
    });

    expect(
      getTextScrollAnchor({
        itemSizes,
        offsets,
        scrollTop: 35,
      }),
    ).toEqual({
      index: 1,
      offsetWithinLine: 7,
    });
  });
});
