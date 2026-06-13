import { describe, expect, it } from "vitest"

import { getDataCellSelectPopupPosition } from "@/registry/new-york-v4/ui/data-cell-select-popup-position"

describe("DataCell select popup position", () => {
  it("places the popup below the anchor when space is available", () => {
    expect(
      getDataCellSelectPopupPosition({
        anchorRect: {
          bottom: 120,
          left: 40,
          top: 80,
          width: 160,
        },
        viewport: { width: 800, height: 600 },
      })
    ).toEqual({
      left: 40,
      top: 124,
      width: 160,
      maxHeight: 468,
    })
  })

  it("places the popup above the anchor when below space is too small", () => {
    expect(
      getDataCellSelectPopupPosition({
        anchorRect: {
          bottom: 590,
          left: 40,
          top: 550,
          width: 160,
        },
        viewport: { width: 800, height: 600 },
      })
    ).toEqual({
      left: 40,
      top: 8,
      width: 160,
      maxHeight: 538,
    })
  })

  it("clamps the left edge inside the viewport", () => {
    expect(
      getDataCellSelectPopupPosition({
        anchorRect: {
          bottom: 120,
          left: 760,
          top: 80,
          width: 80,
        },
        viewport: { width: 800, height: 600 },
      }).left
    ).toBe(712)
  })

  it("keeps a minimum popup height", () => {
    expect(
      getDataCellSelectPopupPosition({
        anchorRect: {
          bottom: 70,
          left: 40,
          top: 30,
          width: 160,
        },
        viewport: { width: 800, height: 130 },
      }).maxHeight
    ).toBe(64)
  })
})
