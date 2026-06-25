// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as PublicFixedGridBenchmark from "@/components/ui/fixed-grid-benchmark";
import * as PublicFixedGridColumns from "@/components/ui/fixed-grid-columns";
import * as PublicFixedGridLayout from "@/components/ui/fixed-grid-layout";
import * as PublicFixedGridRowStyle from "@/components/ui/fixed-grid-row-style";
import * as PublicFixedGridRowWindow from "@/components/ui/fixed-grid-row-window";
import * as PublicFixedGridSelection from "@/components/ui/fixed-grid-selection";
import * as PublicFixedGridTemplate from "@/components/ui/fixed-grid-template";
import * as PublicFixedGridViewport from "@/components/ui/fixed-grid-viewport";
import * as PublicFixedGridVirtualization from "@/components/ui/fixed-grid-virtualization";
import * as PublicHeaderAwareScrollbar from "@/components/ui/header-aware-scrollbar";
import * as PublicXlsxGridScrollbar from "@/components/ui/xlsx-grid-scrollbar";
import {
  CSV_SCROLLBAR_CSS,
  HeaderAwareScrollbar as CsvHeaderAwareScrollbar,
} from "@/registry/new-york-v4/ui/csv-viewer-scrollbar";
import {
  findFixedGridScroller,
  isScrollableViewport,
} from "@/registry/new-york-v4/ui/fixed-grid-benchmark";
import {
  buildFixedGridColumns,
  fixedGridColumnWidths,
} from "@/registry/new-york-v4/ui/fixed-grid-columns";
import {
  fixedGridInverseStickyOffset,
  getFixedGridCanvasStyle,
  getFixedGridInverseRowOffsetStyle,
  getFixedGridInverseRowWindowStyle,
  getFixedGridInverseRowWindowStyles,
  getFixedGridInverseStickyRowWindowStyle,
  getFixedGridRowWindowStyle,
  setFixedGridInverseRowWindowGeometry,
} from "@/registry/new-york-v4/ui/fixed-grid-layout";
import { getFixedGridRowStyle } from "@/registry/new-york-v4/ui/fixed-grid-row-style";
import { FixedGridRowWindow } from "@/registry/new-york-v4/ui/fixed-grid-row-window";
import {
  gridCellKey,
  isSameGridCell,
  parseGridCellKey,
} from "@/registry/new-york-v4/ui/fixed-grid-selection";
import { buildVirtualGridTemplate } from "@/registry/new-york-v4/ui/fixed-grid-template";
import { FixedGridViewport } from "@/registry/new-york-v4/ui/fixed-grid-viewport";
import {
  fixedScrollOffset,
  fixedVirtualItemWindow,
  fixedVirtualItems,
  useFixedGridVirtualization,
  useFixedRowPool,
  useFixedRowVirtualization,
} from "@/registry/new-york-v4/ui/fixed-grid-virtualization";
import { HeaderAwareScrollbar } from "@/registry/new-york-v4/ui/header-aware-scrollbar";
import {
  XLSX_SCROLLBAR_CSS,
  HeaderAwareScrollbar as XlsxHeaderAwareScrollbar,
} from "@/registry/new-york-v4/ui/xlsx-grid-scrollbar";
import { SCENARIOS } from "@/app/(view)/scrollbench/scrollbench-core";
import {
  findScrollableViewport,
  isAbortError,
  measureScenario,
  viewportMetrics,
  waitForScroller,
} from "@/app/(view)/scrollbench/scrollbench-runner";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fixed grid public entrypoints", () => {
  it("keeps component-facing re-exports wired to the registry implementations", () => {
    expect(PublicFixedGridBenchmark.findFixedGridScroller).toBe(
      findFixedGridScroller,
    );
    expect(PublicFixedGridBenchmark.isScrollableViewport).toBe(
      isScrollableViewport,
    );
    expect(PublicFixedGridColumns.buildFixedGridColumns).toBe(
      buildFixedGridColumns,
    );
    expect(PublicFixedGridColumns.fixedGridColumnWidths).toBe(
      fixedGridColumnWidths,
    );
    expect(PublicFixedGridLayout.getFixedGridCanvasStyle).toBe(
      getFixedGridCanvasStyle,
    );
    expect(PublicFixedGridLayout.getFixedGridRowWindowStyle).toBe(
      getFixedGridRowWindowStyle,
    );
    expect(PublicFixedGridLayout.getFixedGridInverseRowWindowStyle).toBe(
      getFixedGridInverseRowWindowStyle,
    );
    expect(PublicFixedGridRowStyle.getFixedGridRowStyle).toBe(
      getFixedGridRowStyle,
    );
    expect(PublicFixedGridRowWindow.FixedGridRowWindow).toBe(
      FixedGridRowWindow,
    );
    expect(PublicFixedGridSelection.gridCellKey).toBe(gridCellKey);
    expect(PublicFixedGridSelection.isSameGridCell).toBe(isSameGridCell);
    expect(PublicFixedGridSelection.parseGridCellKey).toBe(parseGridCellKey);
    expect(PublicFixedGridTemplate.buildVirtualGridTemplate).toBe(
      buildVirtualGridTemplate,
    );
    expect(PublicFixedGridViewport.FixedGridViewport).toBe(FixedGridViewport);
    expect(PublicFixedGridVirtualization.fixedScrollOffset).toBe(
      fixedScrollOffset,
    );
    expect(PublicFixedGridVirtualization.fixedVirtualItems).toBe(
      fixedVirtualItems,
    );
    expect(PublicFixedGridVirtualization.fixedVirtualItemWindow).toBe(
      fixedVirtualItemWindow,
    );
    expect(PublicFixedGridVirtualization.useFixedGridVirtualization).toBe(
      useFixedGridVirtualization,
    );
    expect(PublicFixedGridVirtualization.useFixedRowPool).toBe(useFixedRowPool);
    expect(PublicFixedGridVirtualization.useFixedRowVirtualization).toBe(
      useFixedRowVirtualization,
    );
    expect(PublicHeaderAwareScrollbar.HeaderAwareScrollbar).toBe(
      HeaderAwareScrollbar,
    );
    expect(PublicXlsxGridScrollbar.HeaderAwareScrollbar).toBe(
      HeaderAwareScrollbar,
    );
    expect(CsvHeaderAwareScrollbar).toBe(HeaderAwareScrollbar);
    expect(XlsxHeaderAwareScrollbar).toBe(HeaderAwareScrollbar);
    expect(CSV_SCROLLBAR_CSS).toContain('[data-slot="csv-body"]');
    expect(XLSX_SCROLLBAR_CSS).toContain('[data-slot="xlsx-body"]');
    expect(PublicXlsxGridScrollbar.XLSX_SCROLLBAR_CSS).toBe(XLSX_SCROLLBAR_CSS);
  });
});

describe("fixed grid columns", () => {
  it("builds stable columns with keys, widths, and optional metadata", () => {
    const columns = buildFixedGridColumns({
      items: ["name", "total", "delete"],
      getKey: (key) => key,
      getWidthPx: (key) => (key === "delete" ? 48 : 160),
      getMetadata: (key, index) =>
        key === "delete" ? undefined : { path: key, index },
    });

    expect(columns).toEqual([
      { key: "name", widthPx: 160, metadata: { path: "name", index: 0 } },
      { key: "total", widthPx: 160, metadata: { path: "total", index: 1 } },
      { key: "delete", widthPx: 48 },
    ]);
    expect(columns[2]).not.toHaveProperty("metadata");
  });

  it("extracts column widths without changing order", () => {
    expect(
      fixedGridColumnWidths([
        { widthPx: 120 },
        { widthPx: 80 },
        { widthPx: 240 },
      ]),
    ).toEqual([120, 80, 240]);
  });

  it("handles empty column inputs", () => {
    expect(
      buildFixedGridColumns({
        items: [],
        getKey: (key: string) => key,
        getWidthPx: () => 100,
      }),
    ).toEqual([]);
    expect(fixedGridColumnWidths([])).toEqual([]);
  });

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
      }),
    ).toEqual([
      { key: "negative", widthPx: 0 },
      { key: "nan", widthPx: 0 },
      { key: "infinite", widthPx: 0 },
      { key: "decimal", widthPx: 12.5 },
    ]);

    expect(
      fixedGridColumnWidths([
        { widthPx: -1 },
        { widthPx: Number.NaN },
        { widthPx: Number.POSITIVE_INFINITY },
        { widthPx: 48 },
      ]),
    ).toEqual([0, 0, 0, 48]);
  });
});

describe("fixed grid layout styles", () => {
  it("formats numeric canvas dimensions and keeps containment opt-in", () => {
    expect(getFixedGridCanvasStyle({ width: 480 })).toEqual({
      position: "relative",
      width: "480px",
      minWidth: "100%",
    });

    expect(
      getFixedGridCanvasStyle({
        width: "max-content",
        minWidth: 320,
        contain: true,
      }),
    ).toEqual({
      position: "relative",
      width: "max-content",
      minWidth: "320px",
      contain: "layout paint style",
    });
  });

  it("formats row-window height and optional min width", () => {
    expect(getFixedGridRowWindowStyle({ height: 1200 })).toEqual({
      position: "relative",
      height: "1200px",
    });

    expect(
      getFixedGridRowWindowStyle({
        height: "calc(100% - 40px)",
        minWidth: 600,
      }),
    ).toEqual({
      position: "relative",
      height: "calc(100% - 40px)",
      minWidth: "600px",
    });
  });

  it("formats inverse-sticky row-window geometry", () => {
    expect(
      getFixedGridInverseRowOffsetStyle({
        height: 480,
        minWidth: 600,
      }),
    ).toEqual({
      height: "480px",
      minWidth: "600px",
    });
    expect(
      getFixedGridInverseStickyRowWindowStyle({
        height: 160,
        minWidth: 600,
        viewportHeight: 60,
      }),
    ).toEqual({
      position: "sticky",
      height: "160px",
      minWidth: "600px",
      top: "-100px",
      bottom: "-100px",
    });
    expect(
      getFixedGridInverseRowWindowStyles({
        totalSize: 1200,
        minWidth: 800,
        rowMinWidth: 600,
        viewportHeight: 60,
        window: { start: 480, size: 160 },
      }),
    ).toEqual({
      spacerStyle: {
        position: "relative",
        height: "1200px",
        minWidth: "800px",
      },
      offsetStyle: {
        height: "480px",
        minWidth: "600px",
      },
      windowStyle: {
        position: "sticky",
        height: "160px",
        minWidth: "600px",
        top: "-100px",
        bottom: "-100px",
      },
    });
    expect(
      getFixedGridInverseRowWindowStyle({
        height: 160,
        minWidth: 600,
        top: 480,
        viewportHeight: 60,
      }),
    ).toEqual({
      position: "sticky",
      height: "160px",
      marginTop: "480px",
      minWidth: "600px",
      top: "-100px",
      bottom: "-100px",
    });
    expect(
      fixedGridInverseStickyOffset({
        windowSize: 40,
        viewportSize: 60,
      }),
    ).toBe(0);
  });

  it("patches inverse-sticky row-window geometry imperatively", () => {
    const rowOffset = document.createElement("div");
    const rowWindow = document.createElement("div");
    rowWindow.style.marginTop = "999px";

    setFixedGridInverseRowWindowGeometry({
      rowOffsetElement: rowOffset,
      rowWindowElement: rowWindow,
      viewportHeight: 60,
      window: { start: 480, size: 160 },
    });

    expect(rowOffset.style.height).toBe("480px");
    expect(rowWindow.style.position).toBe("sticky");
    expect(rowWindow.style.height).toBe("160px");
    expect(rowWindow.style.marginTop).toBe("");
    expect(rowWindow.style.top).toBe("-100px");
    expect(rowWindow.style.bottom).toBe("-100px");
  });

  it("renders the default inverse-sticky row-window component", () => {
    const rowOffsetRef = React.createRef<HTMLElement>();
    const rowWindowRef = React.createRef<HTMLElement>();

    const { container } = render(
      React.createElement(
        FixedGridRowWindow,
        {
          "data-slot": "fixed-grid-row-spacer",
          rowOffsetRef,
          rowWindowRef,
          totalSize: 1200,
          virtualRowWindow: { start: 480, size: 160 },
          viewportHeight: 60,
          windowDataSlot: "fixed-grid-row-window",
        },
        React.createElement("div", { "data-slot": "fixed-grid-row" }),
      ),
    );

    const spacer = container.querySelector<HTMLElement>(
      '[data-slot="fixed-grid-row-spacer"]',
    );
    const rowWindow = container.querySelector<HTMLElement>(
      '[data-slot="fixed-grid-row-window"]',
    );

    expect(spacer?.style.position).toBe("relative");
    expect(spacer?.style.height).toBe("1200px");
    expect(rowOffsetRef.current?.style.height).toBe("480px");
    expect(rowWindowRef.current).toBe(rowWindow);
    expect(rowWindow?.style.position).toBe("sticky");
    expect(rowWindow?.style.height).toBe("160px");
    expect(rowWindow?.style.top).toBe("-100px");
    expect(rowWindow?.style.bottom).toBe("-100px");
    expect(
      rowWindow?.querySelector('[data-slot="fixed-grid-row"]'),
    ).toBeTruthy();
  });

  it("preserves zero and decimal CSS lengths", () => {
    expect(getFixedGridCanvasStyle({ width: 0, minWidth: 0 })).toEqual({
      position: "relative",
      width: "0px",
      minWidth: "0px",
    });

    expect(getFixedGridRowWindowStyle({ height: 12.5 })).toEqual({
      position: "relative",
      height: "12.5px",
    });
  });

  it("omits non-finite CSS lengths instead of emitting invalid px values", () => {
    const canvasStyle = getFixedGridCanvasStyle({
      width: Number.NaN,
      minWidth: Number.POSITIVE_INFINITY,
    });

    expect(canvasStyle).toStrictEqual({
      position: "relative",
    });
    expect(canvasStyle).not.toHaveProperty("width");
    expect(canvasStyle).not.toHaveProperty("minWidth");

    const rowWindowStyle = getFixedGridRowWindowStyle({
      height: Number.NaN,
      minWidth: Number.NEGATIVE_INFINITY,
    });

    expect(rowWindowStyle).toStrictEqual({
      position: "relative",
    });
    expect(rowWindowStyle).not.toHaveProperty("height");
    expect(rowWindowStyle).not.toHaveProperty("minWidth");
  });

  it("omits negative numeric CSS lengths instead of emitting invalid geometry", () => {
    const canvasStyle = getFixedGridCanvasStyle({
      width: -1,
      minWidth: -20,
    });

    expect(canvasStyle).toStrictEqual({
      position: "relative",
    });
    expect(canvasStyle).not.toHaveProperty("width");
    expect(canvasStyle).not.toHaveProperty("minWidth");

    const rowWindowStyle = getFixedGridRowWindowStyle({
      height: -100,
      minWidth: -1,
    });

    expect(rowWindowStyle).toStrictEqual({
      position: "relative",
    });
    expect(rowWindowStyle).not.toHaveProperty("height");
    expect(rowWindowStyle).not.toHaveProperty("minWidth");
  });

  it("omits blank CSS length strings", () => {
    const canvasStyle = getFixedGridCanvasStyle({
      width: "",
      minWidth: "   ",
    });

    expect(canvasStyle).toStrictEqual({
      position: "relative",
    });
    expect(canvasStyle).not.toHaveProperty("width");
    expect(canvasStyle).not.toHaveProperty("minWidth");
  });
});

describe("fixed grid selection", () => {
  it("compares nullable cell coordinates", () => {
    expect(
      isSameGridCell(
        { rowIndex: 2, columnIndex: 3 },
        { rowIndex: 2, columnIndex: 3 },
      ),
    ).toBe(true);
    expect(
      isSameGridCell(
        { rowIndex: 2, columnIndex: 3 },
        { rowIndex: 2, columnIndex: 4 },
      ),
    ).toBe(false);
    expect(isSameGridCell(null, { rowIndex: 2, columnIndex: 3 })).toBe(false);
    expect(isSameGridCell(undefined, undefined)).toBe(false);
  });

  it("round-trips stable cell keys and rejects malformed keys", () => {
    const coordinate = { rowIndex: 12, columnIndex: 4 };

    expect(gridCellKey(coordinate)).toBe("12:4");
    expect(parseGridCellKey("12:4")).toEqual(coordinate);
    expect(parseGridCellKey("12")).toBeNull();
    expect(parseGridCellKey("12:4:1")).toBeNull();
    expect(parseGridCellKey(":4")).toBeNull();
    expect(parseGridCellKey("12:")).toBeNull();
    expect(parseGridCellKey("row:4")).toBeNull();
    expect(parseGridCellKey("12:column")).toBeNull();
    expect(parseGridCellKey("-1:4")).toBeNull();
    expect(parseGridCellKey("12:-1")).toBeNull();
    expect(parseGridCellKey(" 12:4")).toBeNull();
    expect(parseGridCellKey("12:4 ")).toBeNull();
    expect(parseGridCellKey("1.5:4")).toBeNull();
  });

  it("does not serialize invalid cell coordinates", () => {
    expect(gridCellKey({ rowIndex: Number.NaN, columnIndex: 1 })).toBeNull();
    expect(gridCellKey({ rowIndex: 1.5, columnIndex: 1 })).toBeNull();
    expect(gridCellKey({ rowIndex: 1, columnIndex: -1 })).toBeNull();
  });

  it("rejects unsafe integer cell coordinates", () => {
    expect(
      gridCellKey({ rowIndex: Number.MAX_SAFE_INTEGER + 1, columnIndex: 1 }),
    ).toBeNull();
    expect(parseGridCellKey(`${Number.MAX_SAFE_INTEGER + 1}:1`)).toBeNull();
  });

  it("does not consider invalid matching coordinates equal", () => {
    expect(
      isSameGridCell(
        { rowIndex: Number.NaN, columnIndex: 1 },
        { rowIndex: Number.NaN, columnIndex: 1 },
      ),
    ).toBe(false);
    expect(
      isSameGridCell(
        { rowIndex: -1, columnIndex: 1 },
        { rowIndex: -1, columnIndex: 1 },
      ),
    ).toBe(false);
  });
});

describe("fixed grid template and row styles", () => {
  it("builds virtual grid templates with leading and spacer columns", () => {
    expect(
      buildVirtualGridTemplate({
        leadingWidth: 56,
        leftPad: 180,
        columnWidths: [120, 160],
        rightPad: 240,
      }),
    ).toBe("56px 180px 120px 160px 240px");
  });

  it("keeps zero-width spacer columns explicit", () => {
    expect(
      buildVirtualGridTemplate({
        leadingWidth: 52,
        leftPad: 0,
        columnWidths: [128],
        rightPad: 0,
      }),
    ).toBe("52px 0px 128px 0px");
  });

  it("keeps templates valid when there are no visible data columns", () => {
    expect(
      buildVirtualGridTemplate({
        leadingWidth: 52,
        leftPad: 0,
        columnWidths: [],
        rightPad: 0,
      }),
    ).toBe("52px 0px 0px");
  });

  it("normalizes invalid template widths to zero", () => {
    expect(
      buildVirtualGridTemplate({
        leadingWidth: Number.NaN,
        leftPad: Number.POSITIVE_INFINITY,
        columnWidths: [120, Number.NaN, Number.NEGATIVE_INFINITY],
        rightPad: -20,
      }),
    ).toBe("0px 0px 120px 0px 0px 0px");
  });

  it("positions virtual rows with optional grid templates and containment", () => {
    expect(
      getFixedGridRowStyle({
        gridTemplate: "56px 120px",
        rowHeight: 32,
        top: 96,
      }),
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
    });

    expect(
      getFixedGridRowStyle({
        rowHeight: 28,
        top: 56,
        contain: false,
      }),
    ).not.toHaveProperty("contain");
  });

  it("normalizes invalid row style geometry", () => {
    expect(
      getFixedGridRowStyle({
        rowHeight: Number.NaN,
        top: Number.POSITIVE_INFINITY,
      }),
    ).toMatchObject({
      height: 0,
      minHeight: 0,
      transform: "translate3d(0, 0px, 0)",
    });
  });

  it("omits blank row grid templates", () => {
    const rowStyle = getFixedGridRowStyle({
      gridTemplate: "   ",
      rowHeight: 32,
      top: 0,
    });

    expect(rowStyle).not.toHaveProperty("gridTemplateColumns");
  });
});

describe("fixed grid viewport shell", () => {
  it("forwards refs, data-slot, default classes, children, and DOM props", () => {
    const ref = vi.fn();

    const { unmount } = render(
      React.createElement(FixedGridViewport, {
        scrollRef: ref,
        dataSlot: "shared-grid-body",
        role: "grid",
        tabIndex: 0,
        "aria-label": "Shared grid",
        children: React.createElement("span", null, "cell"),
      }),
    );

    const viewport = ref.mock.calls[0]?.[0] as HTMLDivElement;
    expect(viewport).toBeInstanceOf(HTMLDivElement);
    expect(viewport.dataset.slot).toBe("shared-grid-body");
    expect(viewport.className).toBe("absolute inset-0 overflow-auto");
    expect(viewport.getAttribute("role")).toBe("grid");
    expect(viewport.getAttribute("aria-label")).toBe("Shared grid");
    expect(viewport.tabIndex).toBe(0);
    expect(viewport.textContent).toBe("cell");

    unmount();

    expect(ref.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it("allows consumers to replace the viewport className", () => {
    const ref = vi.fn();

    render(
      React.createElement(FixedGridViewport, {
        scrollRef: ref,
        dataSlot: "json-table-scroll",
        className: "w-full flex-1 overflow-auto",
        children: "body",
      }),
    );

    const viewport = ref.mock.calls[0]?.[0] as HTMLDivElement;
    expect(viewport.className).toBe("w-full flex-1 overflow-auto");
    expect(viewport.dataset.slot).toBe("json-table-scroll");
  });

  it("supports object refs used by grid consumers", () => {
    const ref = React.createRef<HTMLDivElement>();

    const { unmount } = render(
      React.createElement(FixedGridViewport, {
        scrollRef: ref,
        dataSlot: "xlsx-body",
        children: "sheet",
      }),
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.dataset.slot).toBe("xlsx-body");

    unmount();

    expect(ref.current).toBeNull();
  });
});

describe("header-aware scrollbar", () => {
  function expectThumbOffset(
    element: HTMLElement | null | undefined,
    offset: string,
  ) {
    expect(element?.style.transform).toBe(`translateY(${offset})`);
  }

  it("renders a thumb below the header without ResizeObserver", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 50);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      const thumb = container.querySelector(
        ".pointer-events-auto",
      ) as HTMLElement | null;
      expect(thumb).toBeTruthy();
      expect(thumb?.style.height).toBe("40px");
      expectThumbOffset(thumb, "20px");
    });

    const track = container.firstElementChild as HTMLElement | null;
    expect(track?.style.top).toBe("20px");
    expect(track?.style.bottom).toBe("0px");
  });

  it("hides the thumb when content is not scrollable", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 100);
    defineScrollMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    expect(container.firstElementChild).toBeNull();
  });

  it("hides the thumb for malformed scrollbar geometry", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", Number.NaN);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    expect(container.firstElementChild).toBeNull();
  });

  it("updates the thumb from scroll events", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expectThumbOffset(
        container.querySelector(".pointer-events-auto") as HTMLElement | null,
        "0px",
      );
    });

    defineScrollMetric(scroller, "scrollTop", 50);
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expectThumbOffset(
        container.querySelector(".pointer-events-auto") as HTMLElement | null,
        "20px",
      );
    });
  });

  it("reattaches measurements when the scrollbar scroll ref element changes", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const firstScroller = document.createElement("div");
    const nextScroller = document.createElement("div");
    defineViewportMetric(firstScroller, "clientHeight", 100);
    defineViewportMetric(firstScroller, "scrollHeight", 200);
    defineScrollMetric(firstScroller, "scrollTop", 0);
    defineViewportMetric(nextScroller, "clientHeight", 100);
    defineViewportMetric(nextScroller, "scrollHeight", 300);
    defineScrollMetric(nextScroller, "scrollTop", 50);
    const removeEventListener = vi.spyOn(firstScroller, "removeEventListener");
    const addEventListener = vi.spyOn(nextScroller, "addEventListener");
    const scrollRef = {
      current: firstScroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container, rerender } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expectThumbOffset(
        container.querySelector(".pointer-events-auto") as HTMLElement | null,
        "0px",
      );
    });

    scrollRef.current = nextScroller;
    rerender(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expectThumbOffset(
        container.querySelector(".pointer-events-auto") as HTMLElement | null,
        "13px",
      );
    });
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
    expect(addEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      {
        passive: true,
      },
    );
  });

  it("hides the thumb when the scrollbar scroll ref element is cleared", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    const removeEventListener = vi.spyOn(scroller, "removeEventListener");
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container, rerender } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expect(container.querySelector(".pointer-events-auto")).toBeTruthy();
    });

    scrollRef.current = null;
    rerender(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expect(container.firstElementChild).toBeNull();
    });
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("remeasures scrollbar geometry when the header height changes", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 50);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container, rerender } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expectThumbOffset(
        container.querySelector(".pointer-events-auto") as HTMLElement | null,
        "20px",
      );
    });

    rerender(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 40,
      }),
    );

    await waitFor(() => {
      const track = container.firstElementChild as HTMLElement | null;
      const thumb = container.querySelector(
        ".pointer-events-auto",
      ) as HTMLElement | null;
      expect(track?.style.top).toBe("40px");
      expectThumbOffset(thumb, "15px");
    });
  });

  it("clamps the measured thumb position when scrollTop is stale", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 1_000);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expectThumbOffset(
        container.querySelector(".pointer-events-auto") as HTMLElement | null,
        "40px",
      );
    });
  });

  it("drags the thumb into scrollTop using header-adjusted track geometry", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 300);
    defineScrollMetric(scroller, "scrollTop", 30);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    const thumb = await waitFor(() => {
      const element = container.querySelector(
        ".pointer-events-auto",
      ) as HTMLElement | null;
      expect(element).toBeTruthy();
      return element!;
    });
    thumb.setPointerCapture = vi.fn();
    thumb.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(thumb, {
      clientY: 10,
      pointerId: 7,
    });
    fireEvent.pointerMove(thumb, {
      clientY: 36,
      pointerId: 7,
    });

    expect(scroller.scrollTop).toBe(130);
    expect(thumb.setPointerCapture).toHaveBeenCalledWith(7);

    fireEvent.pointerUp(thumb, {
      pointerId: 7,
    });
    expect(thumb.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("clamps dragged scrollTop and tolerates missing pointer capture APIs", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 300);
    defineScrollMetric(scroller, "scrollTop", 30);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    const thumb = await waitFor(() => {
      const element = container.querySelector(
        ".pointer-events-auto",
      ) as HTMLElement | null;
      expect(element).toBeTruthy();
      return element!;
    });

    fireEvent.pointerDown(thumb, {
      clientY: 10,
      pointerId: 7,
    });
    fireEvent.pointerMove(thumb, {
      clientY: 1000,
      pointerId: 7,
    });
    expect(scroller.scrollTop).toBe(200);

    fireEvent.pointerMove(thumb, {
      clientY: -1000,
      pointerId: 7,
    });
    expect(scroller.scrollTop).toBe(0);
  });

  it("updates the thumb from ResizeObserver notifications", async () => {
    let resizeCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expect(
        (container.querySelector(".pointer-events-auto") as HTMLElement | null)
          ?.style.height,
      ).toBe("40px");
    });

    defineViewportMetric(scroller, "scrollHeight", 400);
    act(() => {
      resizeCallback?.(
        [{ target: scroller } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    await waitFor(() => {
      expect(
        (container.querySelector(".pointer-events-auto") as HTMLElement | null)
          ?.style.height,
      ).toBe("28px");
    });
  });

  it("hides a previously visible thumb after resize makes content fit", async () => {
    let resizeCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { container } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expect(container.querySelector(".pointer-events-auto")).toBeTruthy();
    });

    defineViewportMetric(scroller, "scrollHeight", 100);
    act(() => {
      resizeCallback?.(
        [{ target: scroller } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    await waitFor(() => {
      expect(container.firstElementChild).toBeNull();
    });
  });

  it("cancels pending scrollbar measurements and removes listeners on unmount", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 13),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    const removeEventListener = vi.spyOn(scroller, "removeEventListener");
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { unmount } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    await waitFor(() => {
      expect(scroller.removeEventListener).not.toHaveBeenCalled();
    });
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(13);
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("disconnects ResizeObserver while cancelling pending scrollbar measurements", async () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        disconnect = disconnect;
      },
    );
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 31),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    const { unmount } = render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(31);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("coalesces repeated scrollbar scroll events into one frame", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLDivElement | null>;

    render(
      React.createElement(HeaderAwareScrollbar, {
        scrollRef,
        headerHeight: 20,
      }),
    );

    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });
});

describe("fixed grid virtualization math", () => {
  it("returns an empty window for invalid counts and sizes", () => {
    expect(
      fixedVirtualItems({
        count: 0,
        size: 32,
        scrollOffset: 0,
        viewportSize: 640,
        overscan: 2,
      }),
    ).toEqual([]);
    expect(
      fixedVirtualItems({
        count: 10,
        size: 0,
        scrollOffset: 0,
        viewportSize: 640,
        overscan: 2,
      }),
    ).toEqual([]);
    expect(
      fixedVirtualItems({
        count: Number.NaN,
        size: 32,
        scrollOffset: 0,
        viewportSize: 640,
        overscan: 2,
      }),
    ).toEqual([]);
    expect(
      fixedVirtualItems({
        count: 10,
        size: Number.POSITIVE_INFINITY,
        scrollOffset: 0,
        viewportSize: 640,
        overscan: 2,
      }),
    ).toEqual([]);
  });

  it("builds bounded virtual windows with overscan", () => {
    expect(
      fixedVirtualItems({
        count: 100,
        size: 20,
        scrollOffset: 95,
        viewportSize: 60,
        overscan: 2,
      }),
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
    ]);
  });

  it("builds relative row items for an inverse-sticky rendered window", () => {
    expect(
      fixedVirtualItemWindow([
        { index: 2, start: 40, size: 20, end: 60 },
        { index: 3, start: 60, size: 20, end: 80 },
        { index: 4, start: 80, size: 20, end: 100 },
      ]),
    ).toEqual({
      start: 40,
      end: 100,
      size: 60,
      items: [
        { index: 2, start: 0, size: 20, end: 20 },
        { index: 3, start: 20, size: 20, end: 40 },
        { index: 4, start: 40, size: 20, end: 60 },
      ],
    });
    expect(fixedVirtualItemWindow([])).toEqual({
      start: 0,
      end: 0,
      size: 0,
      items: [],
    });
  });

  it("uses a minimum visible count before the viewport is measurable", () => {
    expect(
      fixedVirtualItems({
        count: 100,
        size: 30,
        scrollOffset: 0,
        viewportSize: 0,
        overscan: 1,
        minimumVisibleCount: 4,
      }).map((item) => item.index),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("clamps virtual windows at the beginning and end of the grid", () => {
    expect(
      fixedVirtualItems({
        count: 5,
        size: 10,
        scrollOffset: 0,
        viewportSize: 20,
        overscan: 4,
      }).map((item) => item.index),
    ).toEqual([0, 1, 2, 3, 4]);

    expect(
      fixedVirtualItems({
        count: 5,
        size: 10,
        scrollOffset: 45,
        viewportSize: 20,
        overscan: 2,
      }).map((item) => item.index),
    ).toEqual([2, 3, 4]);
  });

  it("keeps a tail window when scroll offset is beyond the current grid size", () => {
    expect(
      fixedVirtualItems({
        count: 5,
        size: 10,
        scrollOffset: 1000,
        viewportSize: 20,
        overscan: 2,
      }).map((item) => item.index),
    ).toEqual([2, 3, 4]);
  });

  it("treats negative overscan as zero", () => {
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: 40,
        viewportSize: 40,
        overscan: -3,
      }).map((item) => item.index),
    ).toEqual([2, 3, 4]);
  });

  it("uses at least one initial item when minimum visible count is invalid", () => {
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: 0,
        viewportSize: 0,
        overscan: 0,
        minimumVisibleCount: 0,
      }).map((item) => item.index),
    ).toEqual([0, 1]);
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: 0,
        viewportSize: Number.NaN,
        overscan: Number.NaN,
        minimumVisibleCount: Number.NaN,
      }).map((item) => item.index),
    ).toEqual([0, 1]);
  });

  it("treats non-finite scroll offsets as the start of the grid", () => {
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: Number.NaN,
        viewportSize: 40,
        overscan: 1,
      }).map((item) => item.index),
    ).toEqual([0, 1, 2, 3]);
  });

  it("treats negative scroll offsets as the start of the grid", () => {
    expect(
      fixedVirtualItems({
        count: 10,
        size: 20,
        scrollOffset: -100,
        viewportSize: 40,
        overscan: 1,
      }).map((item) => item.index),
    ).toEqual([0, 1, 2, 3]);
  });

  it("keeps item geometry monotonic across fractional scroll offsets", () => {
    expect(
      fixedVirtualItems({
        count: 20,
        size: 25,
        scrollOffset: 49.5,
        viewportSize: 51,
        overscan: 1,
      }),
    ).toEqual([
      { index: 0, start: 0, size: 25, end: 25 },
      { index: 1, start: 25, size: 25, end: 50 },
      { index: 2, start: 50, size: 25, end: 75 },
      { index: 3, start: 75, size: 25, end: 100 },
      { index: 4, start: 100, size: 25, end: 125 },
      { index: 5, start: 125, size: 25, end: 150 },
      { index: 6, start: 150, size: 25, end: 175 },
    ]);
  });

  it("preserves virtual window invariants across varied grid inputs", () => {
    let seed = 0x12345678;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    for (let run = 0; run < 100; run += 1) {
      const count = 1 + Math.floor(next() * 2_000);
      const size = 1 + Math.floor(next() * 80);
      const scrollOffset = next() * count * size * 1.25 - count * size * 0.1;
      const viewportSize = next() < 0.1 ? 0 : next() * size * 120;
      const overscan = Math.floor(next() * 200) - 20;
      const minimumVisibleCount = Math.floor(next() * 40);
      const items = fixedVirtualItems({
        count,
        size,
        scrollOffset,
        viewportSize,
        overscan,
        minimumVisibleCount,
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(10_000);

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]!;
        expect(item.index).toBeGreaterThanOrEqual(0);
        expect(item.index).toBeLessThan(count);
        expect(item.start).toBe(item.index * size);
        expect(item.size).toBe(size);
        expect(item.end).toBe(item.start + size);
        if (index > 0) {
          expect(item.index).toBe(items[index - 1]!.index + 1);
        }
      }

      const safeScrollOffset =
        Number.isFinite(scrollOffset) && scrollOffset > 0 ? scrollOffset : 0;
      const safeViewportSize = Number.isFinite(viewportSize) ? viewportSize : 0;
      const safeMinimumVisibleCount =
        Number.isFinite(minimumVisibleCount) && minimumVisibleCount > 0
          ? Math.ceil(minimumVisibleCount)
          : 1;
      const effectiveViewportSize = Math.max(
        safeViewportSize,
        size * safeMinimumVisibleCount,
      );
      const visibleStart = Math.min(
        count - 1,
        Math.max(0, Math.floor(safeScrollOffset / size)),
      );
      const visibleEnd = Math.min(
        count - 1,
        Math.max(
          visibleStart,
          Math.ceil((safeScrollOffset + effectiveViewportSize) / size),
        ),
      );

      expect(items[0]!.index).toBeLessThanOrEqual(visibleStart);
      if (visibleEnd - visibleStart + 1 <= 10_000) {
        expect(items.at(-1)!.index).toBeGreaterThanOrEqual(visibleEnd);
      } else {
        expect(items.at(-1)!.index).toBe(visibleStart + 9_999);
      }
    }
  });

  it("caps hostile virtual windows", () => {
    const items = fixedVirtualItems({
      count: 1_000_000,
      size: 1,
      scrollOffset: 0,
      viewportSize: 1_000_000,
      overscan: 1_000_000,
    });

    expect(items).toHaveLength(10_000);
    expect(items[0]?.index).toBe(0);
    expect(items.at(-1)?.index).toBe(9_999);
  });

  it("keeps the visible grid range inside capped hostile windows", () => {
    const items = fixedVirtualItems({
      count: 1_000_000,
      size: 1,
      scrollOffset: 500_000,
      viewportSize: 100,
      overscan: 1_000_000,
    });

    expect(items).toHaveLength(10_000);
    expect(items[0]!.index).toBeLessThanOrEqual(500_000);
    expect(items.at(-1)!.index).toBeGreaterThanOrEqual(500_100);
  });

  it("computes scroll offsets for start, center, end, and auto alignment", () => {
    const target = { index: 10, itemSize: 25, viewportSize: 100 };

    expect(fixedScrollOffset({ ...target, align: "start" })).toBe(250);
    expect(fixedScrollOffset({ ...target, align: "center" })).toBe(212.5);
    expect(fixedScrollOffset({ ...target, align: "end" })).toBe(175);
    expect(fixedScrollOffset({ ...target, align: "auto" })).toBe(250);
  });

  it("never returns a negative scroll offset for leading cells", () => {
    const target = { index: 0, itemSize: 25, viewportSize: 100 };

    expect(fixedScrollOffset({ ...target, align: "start" })).toBe(0);
    expect(fixedScrollOffset({ ...target, align: "center" })).toBe(0);
    expect(fixedScrollOffset({ ...target, align: "end" })).toBe(0);
  });

  it("returns zero for invalid scroll-offset inputs", () => {
    expect(
      fixedScrollOffset({
        index: Number.NaN,
        itemSize: 25,
        viewportSize: 100,
        align: "start",
      }),
    ).toBe(0);
    expect(
      fixedScrollOffset({
        index: 1,
        itemSize: Number.NaN,
        viewportSize: 100,
        align: "center",
      }),
    ).toBe(0);
    expect(
      fixedScrollOffset({
        index: 1,
        itemSize: 25,
        viewportSize: Number.NaN,
        align: "end",
      }),
    ).toBe(0);
  });

  it("returns zero for non-integer scroll target indexes", () => {
    expect(
      fixedScrollOffset({
        index: 1.5,
        itemSize: 25,
        viewportSize: 100,
        align: "start",
      }),
    ).toBe(0);
    expect(
      fixedScrollOffset({
        index: Number.MAX_SAFE_INTEGER + 1,
        itemSize: 25,
        viewportSize: 100,
        align: "center",
      }),
    ).toBe(0);
  });

  it("keeps hook total sizes finite for malformed grid dimensions", () => {
    const scrollRef = { current: null } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: Number.NaN,
        columnCount: Number.POSITIVE_INFINITY,
        rowSize: 32,
        columnSize: Number.NaN,
        rowOverscan: 2,
        columnOverscan: 2,
        scrollRef,
      }),
    );

    expect(result.current.totalRowSize).toBe(0);
    expect(result.current.totalColumnSize).toBe(0);
    expect(result.current.virtualRows).toEqual([]);
    expect(result.current.columnItems).toEqual([]);
  });

  it("keeps row-only hook total sizes finite for malformed row dimensions", () => {
    const scrollRef = { current: null } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: Number.POSITIVE_INFINITY,
        rowSize: 32,
        rowOverscan: 2,
        scrollRef,
      }),
    );

    expect(result.current.totalRowSize).toBe(0);
    expect(result.current.virtualRows).toEqual([]);
  });

  it("treats negative row-only overscan as zero", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 64);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: 10,
        rowSize: 32,
        rowOverscan: -3,
        scrollRef,
      }),
    );

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([0, 1]);
  });

  it("does not throw for malformed non-virtualized column dimensions", () => {
    const scrollRef = { current: null } as React.RefObject<HTMLElement | null>;
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
      }),
    );

    expect(result.current.columnItems).toEqual([]);
    expect(result.current.totalColumnSize).toBe(0);
  });

  it("does not allocate hostile non-virtualized column counts", () => {
    const scrollRef = { current: null } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 1,
        columnCount: 1_000_000,
        rowSize: 32,
        columnSize: 80,
        rowOverscan: 2,
        columnOverscan: 2,
        scrollRef,
        virtualizeColumns: false,
      }),
    );

    expect(result.current.columnItems).toEqual([]);
    expect(result.current.totalColumnSize).toBe(80_000_000);
  });

  it("normalizes malformed viewport metrics before virtualizing", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", Number.NaN);
    defineHorizontalViewportMetric(
      scroller,
      "clientWidth",
      Number.POSITIVE_INFINITY,
    );
    defineScrollMetric(scroller, "scrollTop", Number.NaN);
    defineScrollMetric(scroller, "scrollLeft", Number.POSITIVE_INFINITY);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 10,
        columnCount: 10,
        rowSize: 32,
        columnSize: 80,
        rowOverscan: 0,
        columnOverscan: 0,
        scrollRef,
        scrollElement: scroller,
      }),
    );

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(result.current.columnItems.map((column) => column.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("keeps fixed row pool slots stable and hides surplus rows", () => {
    const firstRows = fixedVirtualItems({
      count: 100,
      size: 10,
      scrollOffset: 0,
      viewportSize: 30,
      overscan: 0,
    });
    const nextRows = fixedVirtualItems({
      count: 100,
      size: 10,
      scrollOffset: 50,
      viewportSize: 10,
      overscan: 0,
    });

    const { result, rerender } = renderHook(
      ({ rowCount, virtualRows }) => useFixedRowPool({ rowCount, virtualRows }),
      {
        initialProps: {
          rowCount: 100,
          virtualRows: firstRows,
        },
      },
    );

    expect(result.current.map((slot) => slot.slotIndex)).toEqual([0, 1, 2, 3]);
    expect(
      result.current.map((slot) => slot.virtualRow?.index ?? null),
    ).toEqual([0, 1, 2, 3]);

    rerender({ rowCount: 100, virtualRows: nextRows });

    expect(result.current.map((slot) => slot.slotIndex)).toEqual([0, 1, 2, 3]);
    expect(
      result.current.map((slot) => slot.virtualRow?.index ?? null),
    ).toEqual([5, 6, null, null]);
    expect(result.current.map((slot) => slot.isHidden)).toEqual([
      false,
      false,
      true,
      true,
    ]);

    rerender({ rowCount: 2, virtualRows: nextRows.slice(0, 1) });

    expect(result.current.map((slot) => slot.slotIndex)).toEqual([0, 1]);
  });

  it("preallocates fixed row pool reserve slots without exceeding row count", () => {
    const virtualRows = fixedVirtualItems({
      count: 10,
      size: 10,
      scrollOffset: 0,
      viewportSize: 20,
      overscan: 0,
    });

    const { result, rerender } = renderHook(
      ({ minimumPoolSize, rowCount }) =>
        useFixedRowPool({
          minimumPoolSize,
          rowCount,
          virtualRows,
        }),
      {
        initialProps: {
          minimumPoolSize: 6,
          rowCount: 10,
        },
      },
    );

    expect(result.current).toHaveLength(6);
    expect(result.current.map((slot) => slot.isHidden)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
    ]);

    rerender({ minimumPoolSize: 6, rowCount: 2 });

    expect(result.current).toHaveLength(2);
  });

  it("updates grid windows from scroll events using jump overscan", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 20);
    defineHorizontalViewportMetric(scroller, "clientWidth", 30);
    defineScrollMetric(scroller, "scrollTop", 0);
    defineScrollMetric(scroller, "scrollLeft", 0);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 100,
        columnCount: 100,
        rowSize: 10,
        columnSize: 10,
        rowOverscan: 5,
        columnOverscan: 5,
        jumpRowOverscan: 0,
        jumpColumnOverscan: 0,
        scrollRef,
        scrollElement: scroller,
      }),
    );

    expect(result.current.virtualRows[0]?.index).toBe(0);
    expect(result.current.columnItems[0]?.index).toBe(0);

    defineScrollMetric(scroller, "scrollTop", 500);
    defineScrollMetric(scroller, "scrollLeft", 400);
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.virtualRows[0]?.index).toBe(50);
    expect(result.current.virtualRows.at(-1)?.index).toBe(82);
    expect(result.current.virtualRowWindow.start).toBe(500);
    expect(result.current.virtualRowWindow.items[0]?.start).toBe(0);
    expect(result.current.columnItems[0]?.index).toBe(40);
    expect(result.current.columnItems.at(-1)?.index).toBe(48);
    expect(result.current.leftPad).toBe(400);
    expect(result.current.rightPad).toBe(510);
  });

  it("lets horizontal jump viewports settle back to full column overscan", () => {
    vi.useFakeTimers();
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 20);
    defineHorizontalViewportMetric(scroller, "clientWidth", 30);
    defineScrollMetric(scroller, "scrollTop", 0);
    defineScrollMetric(scroller, "scrollLeft", 0);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 100,
        columnCount: 100,
        rowSize: 10,
        columnSize: 10,
        rowOverscan: 5,
        columnOverscan: 5,
        jumpRowOverscan: 0,
        jumpColumnOverscan: 0,
        scrollRef,
        scrollElement: scroller,
      }),
    );

    defineScrollMetric(scroller, "scrollLeft", 400);
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.columnItems[0]?.index).toBe(40);
    expect(result.current.columnItems.at(-1)?.index).toBe(48);

    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(result.current.columnItems[0]?.index).toBe(35);
    expect(result.current.columnItems.at(-1)?.index).toBe(53);
    expect(result.current.leftPad).toBe(350);
    expect(result.current.rightPad).toBe(460);
  });

  it("lets handled jump-row viewports settle after skipping immediate React window updates", () => {
    vi.useFakeTimers();
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 20);
    defineHorizontalViewportMetric(scroller, "clientWidth", 30);
    defineScrollMetric(scroller, "scrollTop", 0);
    defineScrollMetric(scroller, "scrollLeft", 0);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const handleViewport = vi.fn(() => "handled" as const);
    const rowScrollStrategy = { handleViewport };

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 100,
        columnCount: 100,
        rowSize: 10,
        columnSize: 10,
        rowOverscan: 5,
        columnOverscan: 5,
        jumpRowOverscan: 0,
        jumpColumnOverscan: 0,
        rowScrollStrategy,
        scrollRef,
        scrollElement: scroller,
      }),
    );

    expect(result.current.virtualRows[0]?.index).toBe(0);

    defineScrollMetric(scroller, "scrollTop", 500);
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(handleViewport).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollTop: 500,
        isJumpingRows: true,
      }),
    );
    expect(result.current.virtualRows[0]?.index).toBe(0);

    act(() => {
      vi.advanceTimersByTime(80);
    });

    // When the handled scroll settles, the viewport re-reads the live scroll
    // metrics and commits them as a non-jumping window, so the canonical React
    // window uses the full row overscan (5) on both edges rather than the zero
    // jump-overscan. visibleStart 50 expands to 45; the overscan-extended tail
    // reaches 87. This keeps freshly-revealed leading-edge rows in the window
    // so the imperative patcher never leaves a blank gap at rest.
    expect(result.current.virtualRows[0]?.index).toBe(45);
    expect(result.current.virtualRows.at(-1)?.index).toBe(87);
  });

  it("lets handled small row-scroll viewports use the same deferred React update path", () => {
    vi.useFakeTimers();
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 20);
    defineHorizontalViewportMetric(scroller, "clientWidth", 30);
    defineScrollMetric(scroller, "scrollTop", 0);
    defineScrollMetric(scroller, "scrollLeft", 0);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const handleViewport = vi.fn(() => "handled" as const);
    const rowScrollStrategy = { handleViewport };

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 100,
        columnCount: 100,
        rowSize: 10,
        columnSize: 10,
        rowOverscan: 5,
        columnOverscan: 5,
        jumpRowOverscan: 0,
        jumpColumnOverscan: 0,
        rowScrollStrategy,
        scrollRef,
        scrollElement: scroller,
      }),
    );

    expect(result.current.virtualRows[0]?.index).toBe(0);

    defineScrollMetric(scroller, "scrollTop", 5);
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(handleViewport).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollTop: 5,
        isJumpingRows: false,
      }),
    );
    expect(result.current.virtualRows[0]?.index).toBe(0);

    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(result.current.virtualRows[0]?.index).toBe(0);
  });

  it("restores row aria indexes when a handled jump-row viewport settles", () => {
    vi.useFakeTimers();
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 20);
    defineHorizontalViewportMetric(scroller, "clientWidth", 30);
    defineScrollMetric(scroller, "scrollTop", 0);
    defineScrollMetric(scroller, "scrollLeft", 0);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    function Harness() {
      const scrollRef = React.useRef<HTMLElement | null>(scroller);
      const { virtualRows } = useFixedGridVirtualization({
        rowCount: 100,
        columnCount: 1,
        rowSize: 10,
        columnSize: 10,
        rowOverscan: 0,
        columnOverscan: 0,
        jumpRowOverscan: 0,
        jumpColumnOverscan: 0,
        minimumRenderedRows: 1,
        rowScrollStrategy: { handleViewport: () => "handled" },
        scrollRef,
        scrollElement: scroller,
      });

      return React.createElement(
        "div",
        null,
        virtualRows.map((row) =>
          React.createElement(
            "div",
            {
              key: row.index,
              "data-testid": "virtual-row",
              "aria-rowindex": row.index + 2,
            },
            row.index,
          ),
        ),
      );
    }

    render(React.createElement(Harness));

    expect(
      screen
        .getAllByTestId("virtual-row")
        .map((row) => row.getAttribute("aria-rowindex")),
    ).toEqual(["2", "3", "4"]);

    defineScrollMetric(scroller, "scrollTop", 500);
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(
      screen
        .getAllByTestId("virtual-row")
        .map((row) => row.getAttribute("aria-rowindex")),
    ).toEqual(["2", "3", "4"]);

    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(
      screen
        .getAllByTestId("virtual-row")
        .map((row) => row.getAttribute("aria-rowindex")),
    ).toEqual(["52", "53", "54"]);
  });

  it("switches the measured grid viewport when the scroll element changes", () => {
    const firstScroller = document.createElement("div");
    const nextScroller = document.createElement("div");
    defineViewportMetric(firstScroller, "clientHeight", 20);
    defineHorizontalViewportMetric(firstScroller, "clientWidth", 20);
    defineScrollMetric(firstScroller, "scrollTop", 0);
    defineScrollMetric(firstScroller, "scrollLeft", 0);
    defineViewportMetric(nextScroller, "clientHeight", 20);
    defineHorizontalViewportMetric(nextScroller, "clientWidth", 20);
    defineScrollMetric(nextScroller, "scrollTop", 600);
    defineScrollMetric(nextScroller, "scrollLeft", 300);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: firstScroller,
    } as React.RefObject<HTMLElement | null>;
    const { result, rerender } = renderHook(
      ({ scrollElement }) =>
        useFixedGridVirtualization({
          rowCount: 100,
          columnCount: 100,
          rowSize: 10,
          columnSize: 10,
          rowOverscan: 0,
          columnOverscan: 0,
          scrollRef,
          scrollElement,
        }),
      { initialProps: { scrollElement: firstScroller } },
    );

    expect(result.current.virtualRows[0]?.index).toBe(0);
    expect(result.current.columnItems[0]?.index).toBe(0);

    scrollRef.current = nextScroller;
    rerender({ scrollElement: nextScroller });

    expect(result.current.virtualRows[0]?.index).toBe(60);
    expect(result.current.columnItems[0]?.index).toBe(30);
  });

  it("scrolls grid cells through the shared offset helper", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineHorizontalViewportMetric(scroller, "clientWidth", 200);
    const scrollTo = vi.fn();
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 100,
        columnCount: 100,
        rowSize: 20,
        columnSize: 50,
        rowOverscan: 2,
        columnOverscan: 2,
        scrollRef,
      }),
    );

    act(() => {
      result.current.scrollToCell({
        rowIndex: 10,
        columnIndex: 5,
        align: "end",
        behavior: "auto",
      });
    });

    expect(scrollTo).toHaveBeenCalledWith({
      top: 120,
      left: 100,
      behavior: "auto",
    });
  });

  it("scrolls grid cells when scrollTo is unavailable", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineHorizontalViewportMetric(scroller, "clientWidth", 200);
    defineScrollMetric(scroller, "scrollTop", 0);
    defineScrollMetric(scroller, "scrollLeft", 0);
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: undefined,
    });

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 100,
        columnCount: 100,
        rowSize: 20,
        columnSize: 50,
        rowOverscan: 2,
        columnOverscan: 2,
        scrollRef,
      }),
    );

    act(() => {
      result.current.scrollToCell({
        rowIndex: 10,
        columnIndex: 5,
        align: "end",
        behavior: "auto",
      });
    });

    expect(scroller.scrollTop).toBe(120);
    expect(scroller.scrollLeft).toBe(100);
  });

  it("preserves the semantic grid anchor when item sizes change", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 30);
    defineHorizontalViewportMetric(scroller, "clientWidth", 50);
    defineScrollMetric(scroller, "scrollTop", 45);
    defineScrollMetric(scroller, "scrollLeft", 68);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result, rerender } = renderHook(
      ({ rowSize, columnSize }) =>
        useFixedGridVirtualization({
          rowCount: 100,
          columnCount: 100,
          rowSize,
          columnSize,
          rowOverscan: 0,
          columnOverscan: 0,
          scrollRef,
          scrollElement: scroller,
        }),
      { initialProps: { rowSize: 10, columnSize: 20 } },
    );

    expect(result.current.virtualRows[0]?.index).toBe(4);
    expect(result.current.columnItems[0]?.index).toBe(3);

    rerender({ rowSize: 20, columnSize: 40 });

    expect(scroller.scrollTop).toBe(85);
    expect(scroller.scrollLeft).toBe(128);
    expect(result.current.virtualRows[0]?.index).toBe(4);
    expect(result.current.columnItems[0]?.index).toBe(3);
  });

  it("cancels pending grid viewport reads on unmount", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineHorizontalViewportMetric(scroller, "clientWidth", 100);
    defineScrollMetric(scroller, "scrollTop", 0);
    defineScrollMetric(scroller, "scrollLeft", 0);
    const removeEventListener = vi.spyOn(scroller, "removeEventListener");
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 17),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { unmount } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 100,
        columnCount: 100,
        rowSize: 20,
        columnSize: 50,
        rowOverscan: 2,
        columnOverscan: 2,
        scrollRef,
        scrollElement: scroller,
      }),
    );

    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("detaches grid viewport listeners from replaced scroll elements", () => {
    const firstScroller = document.createElement("div");
    const nextScroller = document.createElement("div");
    defineViewportMetric(firstScroller, "clientHeight", 100);
    defineHorizontalViewportMetric(firstScroller, "clientWidth", 100);
    defineScrollMetric(firstScroller, "scrollTop", 0);
    defineScrollMetric(firstScroller, "scrollLeft", 0);
    defineViewportMetric(nextScroller, "clientHeight", 100);
    defineHorizontalViewportMetric(nextScroller, "clientWidth", 100);
    defineScrollMetric(nextScroller, "scrollTop", 0);
    defineScrollMetric(nextScroller, "scrollLeft", 0);
    const removeEventListener = vi.spyOn(firstScroller, "removeEventListener");
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: firstScroller,
    } as React.RefObject<HTMLElement | null>;
    const { rerender } = renderHook(
      ({ scrollElement }) =>
        useFixedGridVirtualization({
          rowCount: 100,
          columnCount: 100,
          rowSize: 20,
          columnSize: 50,
          rowOverscan: 2,
          columnOverscan: 2,
          scrollRef,
          scrollElement,
        }),
      { initialProps: { scrollElement: firstScroller } },
    );

    scrollRef.current = nextScroller;
    rerender({ scrollElement: nextScroller });

    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("resets grid viewport state when the scroll element is cleared", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 20);
    defineHorizontalViewportMetric(scroller, "clientWidth", 20);
    defineScrollMetric(scroller, "scrollTop", 600);
    defineScrollMetric(scroller, "scrollLeft", 300);
    const removeEventListener = vi.spyOn(scroller, "removeEventListener");
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result, rerender } = renderHook(
      ({ scrollElement }) =>
        useFixedGridVirtualization({
          rowCount: 100,
          columnCount: 100,
          rowSize: 10,
          columnSize: 10,
          rowOverscan: 0,
          columnOverscan: 0,
          scrollRef,
          scrollElement,
        }),
      { initialProps: { scrollElement: scroller as HTMLElement | null } },
    );

    expect(result.current.virtualRows[0]?.index).toBe(60);
    expect(result.current.columnItems[0]?.index).toBe(30);

    scrollRef.current = null;
    rerender({ scrollElement: null });

    expect(result.current.virtualRows[0]?.index).toBe(0);
    expect(result.current.columnItems[0]?.index).toBe(0);
    expect(result.current.leftPad).toBe(0);
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("keeps visible grid rows and columns mounted when hostile overscan is capped", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineHorizontalViewportMetric(scroller, "clientWidth", 100);
    defineScrollMetric(scroller, "scrollTop", 500_000);
    defineScrollMetric(scroller, "scrollLeft", 400_000);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedGridVirtualization({
        rowCount: 1_000_000,
        columnCount: 1_000_000,
        rowSize: 1,
        columnSize: 1,
        rowOverscan: 1_000_000,
        columnOverscan: 1_000_000,
        scrollRef,
        scrollElement: scroller,
      }),
    );

    expect(result.current.virtualRows).toHaveLength(10_000);
    expect(result.current.virtualRows[0]!.index).toBeLessThanOrEqual(500_000);
    expect(result.current.virtualRows.at(-1)!.index).toBeGreaterThanOrEqual(
      500_100,
    );
    expect(result.current.columnItems).toHaveLength(10_000);
    expect(result.current.columnItems[0]!.index).toBeLessThanOrEqual(400_000);
    expect(result.current.columnItems.at(-1)!.index).toBeGreaterThanOrEqual(
      400_100,
    );
  });

  it("caps row-only virtualization without dropping the visible rows", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineScrollMetric(scroller, "scrollTop", 500_000);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: 1_000_000,
        rowSize: 1,
        rowOverscan: 1_000_000,
        scrollRef,
      }),
    );

    expect(result.current.virtualRows).toHaveLength(10_000);
    expect(result.current.virtualRows[0]!.index).toBeLessThanOrEqual(500_000);
    expect(result.current.virtualRows.at(-1)!.index).toBeGreaterThanOrEqual(
      500_100,
    );
  });

  it("keeps a row-only tail window when scroll offset is beyond the row count", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 64);
    defineScrollMetric(scroller, "scrollTop", 10_000);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: 5,
        rowSize: 32,
        rowOverscan: 2,
        scrollRef,
      }),
    );

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      2, 3, 4,
    ]);
  });

  it("updates row-only windows from scroll events using jump overscan", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 60);
    defineScrollMetric(scroller, "scrollTop", 0);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: 100,
        rowSize: 20,
        rowOverscan: 6,
        jumpRowOverscan: 1,
        scrollRef,
      }),
    );

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);

    defineScrollMetric(scroller, "scrollTop", 800);
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      39, 40, 41, 42, 43,
    ]);
    expect(result.current.viewportClientHeight).toBe(60);
    expect(result.current.virtualRowWindow.start).toBe(780);
    expect(result.current.virtualRowWindow.items[0]?.start).toBe(0);
  });

  it("reattaches row-only measurement when the scroll ref element changes", () => {
    const firstScroller = document.createElement("div");
    const nextScroller = document.createElement("div");
    defineViewportMetric(firstScroller, "clientHeight", 60);
    defineScrollMetric(firstScroller, "scrollTop", 0);
    defineViewportMetric(nextScroller, "clientHeight", 60);
    defineScrollMetric(nextScroller, "scrollTop", 800);
    const removeEventListener = vi.spyOn(firstScroller, "removeEventListener");
    const addEventListener = vi.spyOn(nextScroller, "addEventListener");
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: firstScroller,
    } as React.RefObject<HTMLElement | null>;
    const { result, rerender } = renderHook(
      ({ revision }) => {
        void revision;
        return useFixedRowVirtualization({
          rowCount: 100,
          rowSize: 20,
          rowOverscan: 2,
          scrollRef,
        });
      },
      { initialProps: { revision: 0 } },
    );

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      0, 1, 2, 3, 4,
    ]);

    scrollRef.current = nextScroller;
    rerender({ revision: 1 });

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      38, 39, 40, 41, 42, 43, 44,
    ]);
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
    expect(addEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      {
        passive: true,
      },
    );
  });

  it("clears row-only windows when the scroll ref element is cleared", async () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 60);
    defineScrollMetric(scroller, "scrollTop", 800);
    const removeEventListener = vi.spyOn(scroller, "removeEventListener");
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result, rerender } = renderHook(
      ({ revision }) => {
        void revision;
        return useFixedRowVirtualization({
          rowCount: 100,
          rowSize: 20,
          rowOverscan: 2,
          scrollRef,
        });
      },
      { initialProps: { revision: 0 } },
    );

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      38, 39, 40, 41, 42, 43, 44,
    ]);

    scrollRef.current = null;
    rerender({ revision: 1 });

    await waitFor(() => {
      expect(result.current.virtualRows).toEqual([]);
    });
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("remeasures row-only windows when row count shrinks without scrolling", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 60);
    defineScrollMetric(scroller, "scrollTop", 800);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result, rerender } = renderHook(
      ({ rowCount }) =>
        useFixedRowVirtualization({
          rowCount,
          rowSize: 20,
          rowOverscan: 2,
          scrollRef,
        }),
      { initialProps: { rowCount: 100 } },
    );

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      38, 39, 40, 41, 42, 43, 44,
    ]);

    rerender({ rowCount: 5 });

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      2, 3, 4,
    ]);
    expect(result.current.totalRowSize).toBe(100);
  });

  it("remeasures row-only geometry when row size changes without scrolling", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 30);
    defineScrollMetric(scroller, "scrollTop", 40);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result, rerender } = renderHook(
      ({ rowSize }) =>
        useFixedRowVirtualization({
          rowCount: 20,
          rowSize,
          rowOverscan: 0,
          scrollRef,
        }),
      { initialProps: { rowSize: 20 } },
    );

    expect(result.current.virtualRows).toEqual([
      { index: 2, start: 40, size: 20, end: 60 },
      { index: 3, start: 60, size: 20, end: 80 },
    ]);

    rerender({ rowSize: 10 });

    expect(result.current.virtualRows).toEqual([
      { index: 4, start: 40, size: 10, end: 50 },
      { index: 5, start: 50, size: 10, end: 60 },
      { index: 6, start: 60, size: 10, end: 70 },
    ]);
    expect(result.current.totalRowSize).toBe(200);
  });

  it("scrolls row-only targets through the shared offset helper", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    const scrollTo = vi.fn();
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: 100,
        rowSize: 20,
        rowOverscan: 2,
        scrollRef,
      }),
    );

    act(() => {
      result.current.scrollToRow({
        rowIndex: 10,
        align: "center",
        behavior: "auto",
      });
    });

    expect(scrollTo).toHaveBeenCalledWith({
      top: 160,
      behavior: "auto",
    });
  });

  it("scrolls row-only targets when scrollTo is unavailable", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 100);
    defineScrollMetric(scroller, "scrollTop", 0);
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: undefined,
    });

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: 100,
        rowSize: 20,
        rowOverscan: 2,
        scrollRef,
      }),
    );

    act(() => {
      result.current.scrollToRow({
        rowIndex: 10,
        align: "center",
        behavior: "auto",
      });
    });

    expect(scroller.scrollTop).toBe(160);
  });

  it("cancels pending row-only measurements on unmount", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 60);
    defineScrollMetric(scroller, "scrollTop", 0);
    let nextFrame = 0;
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => ++nextFrame),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { unmount } = renderHook(() =>
      useFixedRowVirtualization({
        rowCount: 100,
        rowSize: 20,
        rowOverscan: 2,
        scrollRef,
      }),
    );

    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});

describe("fixed grid benchmark scroller discovery", () => {
  it("accepts only scrollports with positive height and overflow content", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", 201);

    expect(isScrollableViewport(null)).toBe(false);
    expect(isScrollableViewport(scroller)).toBe(true);

    defineViewportMetric(scroller, "clientHeight", 0);
    expect(isScrollableViewport(scroller)).toBe(false);

    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", 200);
    expect(isScrollableViewport(scroller)).toBe(false);
  });

  it("rejects scrollports with non-finite geometry", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", Number.POSITIVE_INFINITY);

    expect(isScrollableViewport(scroller)).toBe(false);

    defineViewportMetric(scroller, "clientHeight", Number.POSITIVE_INFINITY);
    defineViewportMetric(scroller, "scrollHeight", 1000);
    expect(isScrollableViewport(scroller)).toBe(false);
  });

  it("finds the first matching selector that is actually scrollable", () => {
    const root = document.createElement("div");
    const collapsed = document.createElement("div");
    const scrollable = document.createElement("div");
    const ignored = document.createElement("div");

    collapsed.dataset.slot = "grid-body";
    scrollable.dataset.slot = "grid-body";
    ignored.dataset.slot = "other-body";

    defineViewportMetric(collapsed, "clientHeight", 0);
    defineViewportMetric(collapsed, "scrollHeight", 1000);
    defineViewportMetric(scrollable, "clientHeight", 300);
    defineViewportMetric(scrollable, "scrollHeight", 900);
    defineViewportMetric(ignored, "clientHeight", 300);
    defineViewportMetric(ignored, "scrollHeight", 900);

    root.append(collapsed, scrollable, ignored);

    expect(
      findFixedGridScroller({
        root,
        selector: '[data-slot="grid-body"]',
      }),
    ).toBe(scrollable);
    expect(
      findFixedGridScroller({
        root,
        selector: '[data-slot="missing"]',
      }),
    ).toBeNull();
  });

  it("prefers a declared scrollable match over other scrollable elements", () => {
    const root = document.createElement("div");
    const generic = document.createElement("div");
    const declared = document.createElement("div");

    generic.dataset.slot = "generic";
    declared.dataset.slot = "declared";

    defineViewportMetric(generic, "clientHeight", 300);
    defineViewportMetric(generic, "scrollHeight", 900);
    defineViewportMetric(declared, "clientHeight", 300);
    defineViewportMetric(declared, "scrollHeight", 900);

    root.append(generic, declared);

    expect(
      findFixedGridScroller({
        root,
        selector: '[data-slot="declared"]',
      }),
    ).toBe(declared);
  });

  it("returns null for invalid selector strings", () => {
    const root = document.createElement("div");

    expect(
      findFixedGridScroller({
        root,
        selector: "[",
      }),
    ).toBeNull();
  });
});

describe("scrollbench runner infrastructure", () => {
  it("falls back to the first scrollable overflow element", () => {
    const root = document.createElement("div");
    const declaredButCollapsed = document.createElement("div");
    const fallback = document.createElement("div");

    declaredButCollapsed.dataset.slot = "declared";
    fallback.style.overflowY = "auto";

    defineViewportMetric(declaredButCollapsed, "clientHeight", 0);
    defineViewportMetric(declaredButCollapsed, "scrollHeight", 1000);
    defineViewportMetric(fallback, "clientHeight", 240);
    defineViewportMetric(fallback, "scrollHeight", 960);

    root.append(declaredButCollapsed, fallback);

    expect(findScrollableViewport(root, '[data-slot="declared"]')).toBe(
      fallback,
    );
  });

  it("falls back instead of throwing when the declared selector is invalid", () => {
    const root = document.createElement("div");
    const fallback = document.createElement("div");

    fallback.style.overflowY = "auto";
    defineViewportMetric(fallback, "clientHeight", 240);
    defineViewportMetric(fallback, "scrollHeight", 960);
    root.append(fallback);

    expect(findScrollableViewport(root, "[")).toBe(fallback);
  });

  it("does not fall back to elements whose overflow is not scrollable", () => {
    const root = document.createElement("div");
    const tallButHidden = document.createElement("div");

    tallButHidden.style.overflowY = "hidden";
    defineViewportMetric(tallButHidden, "clientHeight", 200);
    defineViewportMetric(tallButHidden, "scrollHeight", 800);
    root.append(tallButHidden);

    expect(findScrollableViewport(root, '[data-slot="missing"]')).toBeNull();
  });

  it("does not fall back to collapsed overflow elements", () => {
    const root = document.createElement("div");
    const collapsed = document.createElement("div");

    collapsed.style.overflowY = "auto";
    defineViewportMetric(collapsed, "clientHeight", 0);
    defineViewportMetric(collapsed, "scrollHeight", 800);
    root.append(collapsed);

    expect(findScrollableViewport(root, '[data-slot="missing"]')).toBeNull();
  });

  it("reports viewport metrics from the selected scroller", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 320);
    defineViewportMetric(scroller, "scrollHeight", 1280);

    expect(viewportMetrics(scroller)).toEqual({
      clientHeight: 320,
      clientWidth: 0,
      maxScrollLeft: 0,
      scrollHeight: 1280,
      scrollWidth: 0,
      maxScrollTop: 960,
      renderedElementCount: 0,
      scrollportElementCount: 0,
    });
  });

  it("clamps viewport max scroll when content is shorter than the viewport", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 500);
    defineViewportMetric(scroller, "scrollHeight", 120);

    expect(viewportMetrics(scroller)).toEqual({
      clientHeight: 500,
      clientWidth: 0,
      maxScrollLeft: 0,
      scrollHeight: 120,
      scrollWidth: 0,
      maxScrollTop: 0,
      renderedElementCount: 0,
      scrollportElementCount: 0,
    });
  });

  it("keeps viewport metrics finite for malformed DOM geometry", () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", Number.NaN);
    defineViewportMetric(scroller, "scrollHeight", Number.POSITIVE_INFINITY);

    expect(viewportMetrics(scroller)).toEqual({
      clientHeight: 0,
      clientWidth: 0,
      maxScrollLeft: 0,
      scrollHeight: 0,
      scrollWidth: 0,
      maxScrollTop: 0,
      renderedElementCount: 0,
      scrollportElementCount: 0,
    });
  });

  it("waits for an already-available scroller without delay", async () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", 600);

    await expect(
      waitForScroller(() => scroller, { timeoutMs: 0 }),
    ).resolves.toBe(scroller);
  });

  it("fails clearly when no scroller is found before timeout", async () => {
    await expect(waitForScroller(() => null, { timeoutMs: 0 })).rejects.toThrow(
      "Could not find a viewer scrollport.",
    );
  });

  it("treats malformed scroller wait timeouts as immediate timeouts", async () => {
    await expect(
      waitForScroller(() => null, { timeoutMs: Number.POSITIVE_INFINITY }),
    ).rejects.toThrow("Could not find a viewer scrollport.");

    await expect(
      waitForScroller(() => null, { timeoutMs: Number.NaN }),
    ).rejects.toThrow("Could not find a viewer scrollport.");
  });

  it("supports synchronous timer stubs while waiting for a scroller", async () => {
    const scroller = document.createElement("div");
    let calls = 0;
    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", 600);
    vi.stubGlobal("setTimeout", (callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal("clearTimeout", vi.fn());

    await expect(
      waitForScroller(
        () => {
          calls += 1;
          return calls > 1 ? scroller : null;
        },
        { timeoutMs: 100 },
      ),
    ).resolves.toBe(scroller);
  });

  it("fails clearly when the scroller exists but is not scrollable", async () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", 200);

    await expect(
      waitForScroller(() => scroller, { timeoutMs: 0 }),
    ).rejects.toThrow("The viewer scrollport is not scrollable yet.");
  });

  it("rejects with an abort error when waiting is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForScroller(() => null, {
        signal: controller.signal,
        timeoutMs: 100,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("honors an already-aborted signal before accepting a scroller", async () => {
    const scroller = document.createElement("div");
    const controller = new AbortController();
    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", 600);
    controller.abort();

    await expect(
      waitForScroller(() => scroller, {
        signal: controller.signal,
        timeoutMs: 0,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("measures a scenario by driving scrollTop and dispatching scroll events", async () => {
    const scroller = document.createElement("div");
    const scrollEvents: number[] = [];
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 400);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    scroller.addEventListener("scroll", () => {
      scrollEvents.push(scroller.scrollTop);
    });

    const result = await measureScenario(scroller, SCENARIOS[0], {});

    expect(result.frames).toBe(120);
    expect(result.stepPx).toBe(16);
    expect(result.distancePx).toBeGreaterThan(0);
    expect(scrollEvents).toHaveLength(120);
    expect(Math.max(...scrollEvents)).toBeLessThanOrEqual(300);
  });

  it("supports scenario measurement with an active abort signal", async () => {
    const scroller = document.createElement("div");
    const controller = new AbortController();
    defineViewportMetric(scroller, "clientHeight", 100);
    defineViewportMetric(scroller, "scrollHeight", 400);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    await expect(
      measureScenario(scroller, SCENARIOS[0], { signal: controller.signal }),
    ).resolves.toMatchObject({
      frames: 120,
      stepPx: 16,
    });
  });

  it("rejects scenario measurement for unscrollable viewports", async () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", 200);

    await expect(measureScenario(scroller, SCENARIOS[0], {})).rejects.toThrow(
      "The selected viewer does not have a scrollable viewport.",
    );
  });

  it("rejects scenario measurement for malformed viewport metrics", async () => {
    const scroller = document.createElement("div");
    defineViewportMetric(scroller, "clientHeight", 200);
    defineViewportMetric(scroller, "scrollHeight", Number.NaN);

    await expect(measureScenario(scroller, SCENARIOS[0], {})).rejects.toThrow(
      "The selected viewer does not have a scrollable viewport.",
    );
  });

  it("classifies abort errors without swallowing ordinary errors", () => {
    expect(isAbortError(new DOMException("cancelled", "AbortError"))).toBe(
      true,
    );
    expect(isAbortError(new Error("cancelled"))).toBe(false);
  });
});

function defineViewportMetric(
  element: HTMLElement,
  key: "clientHeight" | "scrollHeight",
  value: number,
) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
  });
}

function defineHorizontalViewportMetric(
  element: HTMLElement,
  key: "clientWidth",
  value: number,
) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
  });
}

function defineScrollMetric(
  element: HTMLElement,
  key: "scrollLeft" | "scrollTop",
  value: number,
) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
    writable: true,
  });
}

class StubResizeObserver {
  observe() {}
  disconnect() {}
}
