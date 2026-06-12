// @vitest-environment jsdom

import type * as React from "react"
import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildFixedGridColumns,
  fixedGridColumnWidths,
} from "@/registry/new-york-v4/ui/fixed-grid-columns"
import {
  findFixedGridScroller,
  isScrollableViewport,
} from "@/registry/new-york-v4/ui/fixed-grid-benchmark"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "@/registry/new-york-v4/ui/fixed-grid-layout"
import {
  gridCellKey,
  isSameGridCell,
  parseGridCellKey,
} from "@/registry/new-york-v4/ui/fixed-grid-selection"
import { getFixedGridRowStyle } from "@/registry/new-york-v4/ui/fixed-grid-row-style"
import { buildVirtualGridTemplate } from "@/registry/new-york-v4/ui/fixed-grid-template"
import {
  fixedScrollOffset,
  fixedVirtualItems,
  useFixedGridVirtualization,
  useFixedRowVirtualization,
} from "@/registry/new-york-v4/ui/fixed-grid-virtualization"
import {
  findScrollableViewport,
  isAbortError,
  measureScenario,
  viewportMetrics,
  waitForScroller,
} from "@/app/(view)/scrollbench/scrollbench-runner"
import { SCENARIOS } from "@/app/(view)/scrollbench/scrollbench-core"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("fixed grid columns", () => {
  it("builds stable columns with keys, widths, and optional metadata", () => {
    const columns = buildFixedGridColumns({
      items: ["name", "total", "delete"],
      getKey: (key) => key,
      getWidthPx: (key) => (key === "delete" ? 48 : 160),
      getMetadata: (key, index) =>
        key === "delete" ? undefined : { path: key, index },
    })

    expect(columns).toEqual([
      { key: "name", widthPx: 160, metadata: { path: "name", index: 0 } },
      { key: "total", widthPx: 160, metadata: { path: "total", index: 1 } },
      { key: "delete", widthPx: 48 },
    ])
    expect(columns[2]).not.toHaveProperty("metadata")
  })

  it("extracts column widths without changing order", () => {
    expect(
      fixedGridColumnWidths([
        { widthPx: 120 },
        { widthPx: 80 },
        { widthPx: 240 },
      ])
    ).toEqual([120, 80, 240])
  })

  it("handles empty column inputs", () => {
    expect(
      buildFixedGridColumns({
        items: [],
        getKey: (key: string) => key,
        getWidthPx: () => 100,
      })
    ).toEqual([])
    expect(fixedGridColumnWidths([])).toEqual([])
  })

  it("normalizes invalid column widths", () => {
    expect(
      buildFixedGridColumns({
        items: ["negative", "nan", "infinite", "decimal"],
        getKey: (key) => key,
        getWidthPx: (key) =>
          ({
            negative: -10,
            nan: Number.NaN,
            infinite: Number.POSITIVE_INFINITY,
            decimal: 12.5,
          })[key] ?? 0,
      })
    ).toEqual([
      { key: "negative", widthPx: 0 },
      { key: "nan", widthPx: 0 },
      { key: "infinite", widthPx: 0 },
      { key: "decimal", widthPx: 12.5 },
    ])

    expect(
      fixedGridColumnWidths([
        { widthPx: -1 },
        { widthPx: Number.NaN },
        { widthPx: Number.POSITIVE_INFINITY },
        { widthPx: 48 },
      ])
    ).toEqual([0, 0, 0, 48])
  })
})

describe("fixed grid layout styles", () => {
  it("formats numeric canvas dimensions and keeps containment opt-in", () => {
    expect(getFixedGridCanvasStyle({ width: 480 })).toEqual({
      position: "relative",
      width: "480px",
      minWidth: "100%",
    })

    expect(
      getFixedGridCanvasStyle({
        width: "max-content",
        minWidth: 320,
        contain: true,
      })
    ).toEqual({
      position: "relative",
      width: "max-content",
      minWidth: "320px",
      contain: "layout paint style",
    })
  })

  it("formats row-window height and optional min width", () => {
    expect(getFixedGridRowWindowStyle({ height: 1200 })).toEqual({
      position: "relative",
      height: "1200px",
    })

    expect(
      getFixedGridRowWindowStyle({ height: "calc(100% - 40px)", minWidth: 600 })
    ).toEqual({
      position: "relative",
      height: "calc(100% - 40px)",
      minWidth: "600px",
    })
  })

  it("preserves zero and decimal CSS lengths", () => {
    expect(getFixedGridCanvasStyle({ width: 0, minWidth: 0 })).toEqual({
      position: "relative",
      width: "0px",
      minWidth: "0px",
    })

    expect(getFixedGridRowWindowStyle({ height: 12.5 })).toEqual({
      position: "relative",
      height: "12.5px",
    })
  })

  it("omits non-finite CSS lengths instead of emitting invalid px values", () => {
    const canvasStyle = getFixedGridCanvasStyle({
      width: Number.NaN,
      minWidth: Number.POSITIVE_INFINITY,
    })

    expect(canvasStyle).toStrictEqual({
      position: "relative",
    })
    expect(canvasStyle).not.toHaveProperty("width")
    expect(canvasStyle).not.toHaveProperty("minWidth")

    const rowWindowStyle = getFixedGridRowWindowStyle({
      height: Number.NaN,
      minWidth: Number.NEGATIVE_INFINITY,
    })

    expect(rowWindowStyle).toStrictEqual({
      position: "relative",
    })
    expect(rowWindowStyle).not.toHaveProperty("height")
    expect(rowWindowStyle).not.toHaveProperty("minWidth")
  })

  it("omits negative numeric CSS lengths instead of emitting invalid geometry", () => {
    const canvasStyle = getFixedGridCanvasStyle({
      width: -1,
      minWidth: -20,
    })

    expect(canvasStyle).toStrictEqual({
      position: "relative",
    })
    expect(canvasStyle).not.toHaveProperty("width")
    expect(canvasStyle).not.toHaveProperty("minWidth")

    const rowWindowStyle = getFixedGridRowWindowStyle({
      height: -100,
      minWidth: -1,
    })

    expect(rowWindowStyle).toStrictEqual({
      position: "relative",
    })
    expect(rowWindowStyle).not.toHaveProperty("height")
    expect(rowWindowStyle).not.toHaveProperty("minWidth")
  })
})

describe("fixed grid selection", () => {
  it("compares nullable cell coordinates", () => {
    expect(
      isSameGridCell({ rowIndex: 2, columnIndex: 3 }, { rowIndex: 2, columnIndex: 3 })
    ).toBe(true)
    expect(
      isSameGridCell({ rowIndex: 2, columnIndex: 3 }, { rowIndex: 2, columnIndex: 4 })
    ).toBe(false)
    expect(isSameGridCell(null, { rowIndex: 2, columnIndex: 3 })).toBe(false)
    expect(isSameGridCell(undefined, undefined)).toBe(false)
  })

  it("round-trips stable cell keys and rejects malformed keys", () => {
    const coordinate = { rowIndex: 12, columnIndex: 4 }

    expect(gridCellKey(coordinate)).toBe("12:4")
    expect(parseGridCellKey("12:4")).toEqual(coordinate)
    expect(parseGridCellKey("12")).toBeNull()
    expect(parseGridCellKey("12:4:1")).toBeNull()
    expect(parseGridCellKey(":4")).toBeNull()
    expect(parseGridCellKey("12:")).toBeNull()
    expect(parseGridCellKey("row:4")).toBeNull()
    expect(parseGridCellKey("12:column")).toBeNull()
    expect(parseGridCellKey("-1:4")).toBeNull()
    expect(parseGridCellKey("12:-1")).toBeNull()
    expect(parseGridCellKey(" 12:4")).toBeNull()
    expect(parseGridCellKey("12:4 ")).toBeNull()
    expect(parseGridCellKey("1.5:4")).toBeNull()
  })

  it("does not serialize invalid cell coordinates", () => {
    expect(gridCellKey({ rowIndex: Number.NaN, columnIndex: 1 })).toBeNull()
    expect(gridCellKey({ rowIndex: 1.5, columnIndex: 1 })).toBeNull()
    expect(gridCellKey({ rowIndex: 1, columnIndex: -1 })).toBeNull()
  })

  it("rejects unsafe integer cell coordinates", () => {
    expect(
      gridCellKey({ rowIndex: Number.MAX_SAFE_INTEGER + 1, columnIndex: 1 })
    ).toBeNull()
    expect(
      parseGridCellKey(`${Number.MAX_SAFE_INTEGER + 1}:1`)
    ).toBeNull()
  })

  it("does not consider invalid matching coordinates equal", () => {
    expect(
      isSameGridCell(
        { rowIndex: Number.NaN, columnIndex: 1 },
        { rowIndex: Number.NaN, columnIndex: 1 }
      )
    ).toBe(false)
    expect(
      isSameGridCell(
        { rowIndex: -1, columnIndex: 1 },
        { rowIndex: -1, columnIndex: 1 }
      )
    ).toBe(false)
  })
})

describe("fixed grid template and row styles", () => {
  it("builds virtual grid templates with leading and spacer columns", () => {
    expect(
      buildVirtualGridTemplate({
        leadingWidth: 56,
        leftPad: 180,
        columnWidths: [120, 160],
        rightPad: 240,
      })
    ).toBe("56px 180px 120px 160px 240px")
  })

  it("keeps zero-width spacer columns explicit", () => {
    expect(
      buildVirtualGridTemplate({
        leadingWidth: 52,
        leftPad: 0,
        columnWidths: [128],
        rightPad: 0,
      })
    ).toBe("52px 0px 128px 0px")
  })

  it("keeps templates valid when there are no visible data columns", () => {
    expect(
      buildVirtualGridTemplate({
        leadingWidth: 52,
        leftPad: 0,
        columnWidths: [],
        rightPad: 0,
      })
    ).toBe("52px 0px 0px")
  })

  it("normalizes invalid template widths to zero", () => {
    expect(
      buildVirtualGridTemplate({
        leadingWidth: Number.NaN,
        leftPad: Number.POSITIVE_INFINITY,
        columnWidths: [120, Number.NaN, Number.NEGATIVE_INFINITY],
        rightPad: -20,
      })
    ).toBe("0px 0px 120px 0px 0px 0px")
  })

  it("positions virtual rows with optional grid templates and containment", () => {
    expect(
      getFixedGridRowStyle({
        gridTemplate: "56px 120px",
        rowHeight: 32,
        top: 96,
      })
    ).toEqual({
      height: 32,
      minHeight: 32,
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      transform: "translate3d(0, 96px, 0)",
      gridTemplateColumns: "56px 120px",
      contain: "layout paint style",
    })

    expect(
      getFixedGridRowStyle({
        rowHeight: 28,
        top: 56,
        contain: false,
      })
    ).not.toHaveProperty("contain")
  })

  it("normalizes invalid row style geometry", () => {
    expect(
      getFixedGridRowStyle({
        rowHeight: Number.NaN,
        top: Number.POSITIVE_INFINITY,
      })
    ).toMatchObject({
      height: 0,
      minHeight: 0,
      transform: "translate3d(0, 0px, 0)",
    })
  })
})

describe("fixed grid virtualization math", () => {
  it("returns an empty window for invalid counts and sizes", () => {
    expect(
      fixedVirtualItems({
        count: 0,
        size: 32,
        scrollOffset: 0,
        viewportSize: 640,
        overscan: 2,
      })
    ).toEqual([])
    expect(
      fixedVirtualItems({
        count: 10,
        size: 0,
        scrollOffset: 0,
        viewportSize: 640,
        overscan: 2,
      })
    ).toEqual([])
    expect(
      fixedVirtualItems({
        count: Number.NaN,
        size: 32,
        scrollOffset: 0,
        viewportSize: 640,
        overscan: 2,
      })
    ).toEqual([])
    expect(
      fixedVirtualItems({
        count: 10,
        size: Number.POSITIVE_INFINITY,
        scrollOffset: 0,
        viewportSize: 640,
        overscan: 2,
      })
    ).toEqual([])
  })

  it("builds bounded virtual windows with overscan", () => {
    expect(
      fixedVirtualItems({
        count: 100,
        size: 20,
        scrollOffset: 95,
        viewportSize: 60,
        overscan: 2,
      })
    ).toEqual([
      { index: 2, start: 40, size: 20, end: 60 },
      { index: 3, start: 60, size: 20, end: 80 },
      { index: 4, start: 80, size: 20, end: 100 },
      { index: 5, start: 100, size: 20, end: 120 },
      { index: 6, start: 120, size: 20, end: 140 },
      { index: 7, start: 140, size: 20, end: 160 },
      { index: 8, start: 160, size: 20, end: 180 },
      { index: 9, start: 180, size: 20, end: 200 },
      { index: 10, start: 200, size: 20, end: 220 },
    ])
  })

  it("uses a minimum visible count before the viewport is measurable", () => {
    expect(
      fixedVirtualItems({
        count: 100,
        size: 30,
        scrollOffset: 0,
        viewportSize: 0,
        overscan: 1,
        minimumVisibleCount: 4,
      }).map((item) => item.index)
    ).toEqual([0, 1, 2, 3, 4, 5])
  })

  it("clamps virtual windows at the beginning and end of the grid", () => {
    expect(
      fixedVirtualItems({
        count: 5,
        size: 10,
        scrollOffset: 0,
        viewportSize: 20,
        overscan: 4,
      }).map((item) => item.index)
    ).toEqual([0, 1, 2, 3, 4])

    expect(
      fixedVirtualItems({
        count: 5,
        size: 10,
        scrollOffset: 45,
        viewportSize: 20,
        overscan: 2,
      }).map((item) => item.index)
    ).toEqual([2, 3, 4])
  })

  it("keeps a tail window when scroll offset is beyond the current grid size", () => {
    expect(
      fixedVirtualItems({
        count: 5,
        size: 10,
        scrollOffset: 1000,
        viewportSize: 20,
        overscan: 2,
      }).map((item) => item.index)
    ).toEqual([2, 3, 4])
  })

  it("treats negative overscan as zero", () => {
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: 40,
        viewportSize: 40,
        overscan: -3,
      }).map((item) => item.index)
    ).toEqual([2, 3, 4])
  })

  it("uses at least one initial item when minimum visible count is invalid", () => {
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: 0,
        viewportSize: 0,
        overscan: 0,
        minimumVisibleCount: 0,
      }).map((item) => item.index)
    ).toEqual([0, 1])
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: 0,
        viewportSize: Number.NaN,
        overscan: Number.NaN,
        minimumVisibleCount: Number.NaN,
      }).map((item) => item.index)
    ).toEqual([0, 1])
  })

  it("treats non-finite scroll offsets as the start of the grid", () => {
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: Number.NaN,
        viewportSize: 40,
        overscan: 1,
      }).map((item) => item.index)
    ).toEqual([0, 1, 2, 3])
  })

  it("treats negative scroll offsets as the start of the grid", () => {
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: -100,
        viewportSize: 40,
        overscan: 1,
      }).map((item) => item.index)
    ).toEqual([0, 1, 2, 3])
  })

  it("keeps item geometry monotonic across fractional scroll offsets", () => {
    expect(
      fixedVirtualItems({
        count: 20,
        size: 25,
        scrollOffset: 49.5,
        viewportSize: 51,
        overscan: 1,
      })
    ).toEqual([
      { index: 0, start: 0, size: 25, end: 25 },
      { index: 1, start: 25, size: 25, end: 50 },
      { index: 2, start: 50, size: 25, end: 75 },
      { index: 3, start: 75, size: 25, end: 100 },
      { index: 4, start: 100, size: 25, end: 125 },
      { index: 5, start: 125, size: 25, end: 150 },
      { index: 6, start: 150, size: 25, end: 175 },
    ])
  })

  it("computes scroll offsets for start, center, end, and auto alignment", () => {
    const target = { index: 10, itemSize: 25, viewportSize: 100 }

    expect(fixedScrollOffset({ ...target, align: "start" })).toBe(250)
    expect(fixedScrollOffset({ ...target, align: "center" })).toBe(212.5)
    expect(fixedScrollOffset({ ...target, align: "end" })).toBe(175)
    expect(fixedScrollOffset({ ...target, align: "auto" })).toBe(250)
  })

  it("never returns a negative scroll offset for leading cells", () => {
    const target = { index: 0, itemSize: 25, viewportSize: 100 }

    expect(fixedScrollOffset({ ...target, align: "start" })).toBe(0)
    expect(fixedScrollOffset({ ...target, align: "center" })).toBe(0)
    expect(fixedScrollOffset({ ...target, align: "end" })).toBe(0)
  })

  it("returns zero for invalid scroll-offset inputs", () => {
    expect(
      fixedScrollOffset({
        index: Number.NaN,
        itemSize: 25,
        viewportSize: 100,
        align: "start",
      })
    ).toBe(0)
    expect(
      fixedScrollOffset({
        index: 1,
        itemSize: Number.NaN,
        viewportSize: 100,
        align: "center",
      })
    ).toBe(0)
    expect(
      fixedScrollOffset({
        index: 1,
        itemSize: 25,
        viewportSize: Number.NaN,
        align: "end",
      })
    ).toBe(0)
  })

  it("keeps hook total sizes finite for malformed grid dimensions", () => {
    const scrollRef = { current: null } as React.RefObject<HTMLElement | null>
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: Number.NaN,
        columnCount: Number.POSITIVE_INFINITY,
        rowSize: 32,
        columnSize: Number.NaN,
        rowOverscan: 2,
        columnOverscan: 2,
        scrollRef,
      })
    )

    expect(result.current.totalRowSize).toBe(0)
    expect(result.current.totalColumnSize).toBe(0)
    expect(result.current.virtualRows).toEqual([])
    expect(result.current.columnItems).toEqual([])
  })

  it("keeps row-only hook total sizes finite for malformed row dimensions", () => {
    const scrollRef = { current: null } as React.RefObject<HTMLElement | null>
    const { result } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: Number.POSITIVE_INFINITY,
        rowSize: 32,
        rowOverscan: 2,
        scrollRef,
      })
    )

    expect(result.current.totalRowSize).toBe(0)
    expect(result.current.virtualRows).toEqual([])
  })

  it("does not throw for malformed non-virtualized column dimensions", () => {
    const scrollRef = { current: null } as React.RefObject<HTMLElement | null>
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 1,
        columnCount: Number.POSITIVE_INFINITY,
        rowSize: 32,
        columnSize: Number.NaN,
        rowOverscan: 2,
        columnOverscan: 2,
        scrollRef,
        virtualizeColumns: false,
      })
    )

    expect(result.current.columnItems).toEqual([])
    expect(result.current.totalColumnSize).toBe(0)
  })
})

describe("fixed grid benchmark scroller discovery", () => {
  it("accepts only scrollports with positive height and overflow content", () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", 200)
    defineViewportMetric(scroller, "scrollHeight", 201)

    expect(isScrollableViewport(null)).toBe(false)
    expect(isScrollableViewport(scroller)).toBe(true)

    defineViewportMetric(scroller, "clientHeight", 0)
    expect(isScrollableViewport(scroller)).toBe(false)

    defineViewportMetric(scroller, "clientHeight", 200)
    defineViewportMetric(scroller, "scrollHeight", 200)
    expect(isScrollableViewport(scroller)).toBe(false)
  })

  it("rejects scrollports with non-finite geometry", () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", 200)
    defineViewportMetric(scroller, "scrollHeight", Number.POSITIVE_INFINITY)

    expect(isScrollableViewport(scroller)).toBe(false)

    defineViewportMetric(scroller, "clientHeight", Number.POSITIVE_INFINITY)
    defineViewportMetric(scroller, "scrollHeight", 1000)
    expect(isScrollableViewport(scroller)).toBe(false)
  })

  it("finds the first matching selector that is actually scrollable", () => {
    const root = document.createElement("div")
    const collapsed = document.createElement("div")
    const scrollable = document.createElement("div")
    const ignored = document.createElement("div")

    collapsed.dataset.slot = "grid-body"
    scrollable.dataset.slot = "grid-body"
    ignored.dataset.slot = "other-body"

    defineViewportMetric(collapsed, "clientHeight", 0)
    defineViewportMetric(collapsed, "scrollHeight", 1000)
    defineViewportMetric(scrollable, "clientHeight", 300)
    defineViewportMetric(scrollable, "scrollHeight", 900)
    defineViewportMetric(ignored, "clientHeight", 300)
    defineViewportMetric(ignored, "scrollHeight", 900)

    root.append(collapsed, scrollable, ignored)

    expect(
      findFixedGridScroller({
        root,
        selector: '[data-slot="grid-body"]',
      })
    ).toBe(scrollable)
    expect(
      findFixedGridScroller({
        root,
        selector: '[data-slot="missing"]',
      })
    ).toBeNull()
  })

  it("prefers a declared scrollable match over other scrollable elements", () => {
    const root = document.createElement("div")
    const generic = document.createElement("div")
    const declared = document.createElement("div")

    generic.dataset.slot = "generic"
    declared.dataset.slot = "declared"

    defineViewportMetric(generic, "clientHeight", 300)
    defineViewportMetric(generic, "scrollHeight", 900)
    defineViewportMetric(declared, "clientHeight", 300)
    defineViewportMetric(declared, "scrollHeight", 900)

    root.append(generic, declared)

    expect(
      findFixedGridScroller({
        root,
        selector: '[data-slot="declared"]',
      })
    ).toBe(declared)
  })

  it("returns null for invalid selector strings", () => {
    const root = document.createElement("div")

    expect(
      findFixedGridScroller({
        root,
        selector: "[",
      })
    ).toBeNull()
  })
})

describe("scrollbench runner infrastructure", () => {
  it("falls back to the first scrollable overflow element", () => {
    const root = document.createElement("div")
    const declaredButCollapsed = document.createElement("div")
    const fallback = document.createElement("div")

    declaredButCollapsed.dataset.slot = "declared"
    fallback.style.overflowY = "auto"

    defineViewportMetric(declaredButCollapsed, "clientHeight", 0)
    defineViewportMetric(declaredButCollapsed, "scrollHeight", 1000)
    defineViewportMetric(fallback, "clientHeight", 240)
    defineViewportMetric(fallback, "scrollHeight", 960)

    root.append(declaredButCollapsed, fallback)

    expect(findScrollableViewport(root, '[data-slot="declared"]')).toBe(fallback)
  })

  it("falls back instead of throwing when the declared selector is invalid", () => {
    const root = document.createElement("div")
    const fallback = document.createElement("div")

    fallback.style.overflowY = "auto"
    defineViewportMetric(fallback, "clientHeight", 240)
    defineViewportMetric(fallback, "scrollHeight", 960)
    root.append(fallback)

    expect(findScrollableViewport(root, "[")).toBe(fallback)
  })

  it("does not fall back to elements whose overflow is not scrollable", () => {
    const root = document.createElement("div")
    const tallButHidden = document.createElement("div")

    tallButHidden.style.overflowY = "hidden"
    defineViewportMetric(tallButHidden, "clientHeight", 200)
    defineViewportMetric(tallButHidden, "scrollHeight", 800)
    root.append(tallButHidden)

    expect(findScrollableViewport(root, '[data-slot="missing"]')).toBeNull()
  })

  it("does not fall back to collapsed overflow elements", () => {
    const root = document.createElement("div")
    const collapsed = document.createElement("div")

    collapsed.style.overflowY = "auto"
    defineViewportMetric(collapsed, "clientHeight", 0)
    defineViewportMetric(collapsed, "scrollHeight", 800)
    root.append(collapsed)

    expect(findScrollableViewport(root, '[data-slot="missing"]')).toBeNull()
  })

  it("reports viewport metrics from the selected scroller", () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", 320)
    defineViewportMetric(scroller, "scrollHeight", 1280)

    expect(viewportMetrics(scroller)).toEqual({
      clientHeight: 320,
      scrollHeight: 1280,
      maxScrollTop: 960,
    })
  })

  it("clamps viewport max scroll when content is shorter than the viewport", () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", 500)
    defineViewportMetric(scroller, "scrollHeight", 120)

    expect(viewportMetrics(scroller)).toEqual({
      clientHeight: 500,
      scrollHeight: 120,
      maxScrollTop: 0,
    })
  })

  it("keeps viewport metrics finite for malformed DOM geometry", () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", Number.NaN)
    defineViewportMetric(scroller, "scrollHeight", Number.POSITIVE_INFINITY)

    expect(viewportMetrics(scroller)).toEqual({
      clientHeight: 0,
      scrollHeight: 0,
      maxScrollTop: 0,
    })
  })

  it("waits for an already-available scroller without delay", async () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", 200)
    defineViewportMetric(scroller, "scrollHeight", 600)

    await expect(waitForScroller(() => scroller, { timeoutMs: 0 })).resolves.toBe(
      scroller
    )
  })

  it("fails clearly when no scroller is found before timeout", async () => {
    await expect(waitForScroller(() => null, { timeoutMs: 0 })).rejects.toThrow(
      "Could not find a viewer scrollport."
    )
  })

  it("fails clearly when the scroller exists but is not scrollable", async () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", 200)
    defineViewportMetric(scroller, "scrollHeight", 200)

    await expect(waitForScroller(() => scroller, { timeoutMs: 0 })).rejects.toThrow(
      "The viewer scrollport is not scrollable yet."
    )
  })

  it("rejects with an abort error when waiting is cancelled", async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      waitForScroller(() => null, {
        signal: controller.signal,
        timeoutMs: 100,
      })
    ).rejects.toMatchObject({ name: "AbortError" })
  })

  it("honors an already-aborted signal before accepting a scroller", async () => {
    const scroller = document.createElement("div")
    const controller = new AbortController()
    defineViewportMetric(scroller, "clientHeight", 200)
    defineViewportMetric(scroller, "scrollHeight", 600)
    controller.abort()

    await expect(
      waitForScroller(() => scroller, {
        signal: controller.signal,
        timeoutMs: 0,
      })
    ).rejects.toMatchObject({ name: "AbortError" })
  })

  it("measures a scenario by driving scrollTop and dispatching scroll events", async () => {
    const scroller = document.createElement("div")
    const scrollEvents: number[] = []
    defineViewportMetric(scroller, "clientHeight", 100)
    defineViewportMetric(scroller, "scrollHeight", 400)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    scroller.addEventListener("scroll", () => {
      scrollEvents.push(scroller.scrollTop)
    })

    const result = await measureScenario(scroller, SCENARIOS[0], {})

    expect(result.frames).toBe(120)
    expect(result.stepPx).toBe(16)
    expect(result.distancePx).toBeGreaterThan(0)
    expect(scrollEvents).toHaveLength(120)
    expect(Math.max(...scrollEvents)).toBeLessThanOrEqual(300)
  })

  it("supports scenario measurement with an active abort signal", async () => {
    const scroller = document.createElement("div")
    const controller = new AbortController()
    defineViewportMetric(scroller, "clientHeight", 100)
    defineViewportMetric(scroller, "scrollHeight", 400)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    await expect(
      measureScenario(scroller, SCENARIOS[0], { signal: controller.signal })
    ).resolves.toMatchObject({
      frames: 120,
      stepPx: 16,
    })
  })

  it("rejects scenario measurement for unscrollable viewports", async () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", 200)
    defineViewportMetric(scroller, "scrollHeight", 200)

    await expect(measureScenario(scroller, SCENARIOS[0], {})).rejects.toThrow(
      "The selected viewer does not have a scrollable viewport."
    )
  })

  it("rejects scenario measurement for malformed viewport metrics", async () => {
    const scroller = document.createElement("div")
    defineViewportMetric(scroller, "clientHeight", 200)
    defineViewportMetric(scroller, "scrollHeight", Number.NaN)

    await expect(measureScenario(scroller, SCENARIOS[0], {})).rejects.toThrow(
      "The selected viewer does not have a scrollable viewport."
    )
  })

  it("classifies abort errors without swallowing ordinary errors", () => {
    expect(isAbortError(new DOMException("cancelled", "AbortError"))).toBe(true)
    expect(isAbortError(new Error("cancelled"))).toBe(false)
  })
})

function defineViewportMetric(
  element: HTMLElement,
  key: "clientHeight" | "scrollHeight",
  value: number
) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
  })
}
