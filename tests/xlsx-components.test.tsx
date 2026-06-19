// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { XlsxSheetMeta } from "@/lib/xlsx-workbook";
import { XlsxGrid } from "@/registry/new-york-v4/ui/xlsx-grid";
import { XlsxGridRow } from "@/registry/new-york-v4/ui/xlsx-grid-row";
import { XlsxSheetTabs } from "@/registry/new-york-v4/ui/xlsx-sheet-tabs";
import {
  isValidLoadedScrollTarget,
  resolveLoadedScrollTarget,
  toInternalCellRef,
  type PendingXlsxScrollTarget,
} from "@/registry/new-york-v4/ui/xlsx-viewer-scroll";

const originalResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  globalThis.ResizeObserver = originalResizeObserver;
});

function mockElementMetrics({
  clientHeight,
  clientWidth,
}: {
  clientHeight: number;
  clientWidth: number;
}) {
  const clientHeightSpy = vi
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockReturnValue(clientHeight);
  const clientWidthSpy = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockReturnValue(clientWidth);
  const scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });
  return { clientHeightSpy, clientWidthSpy, scrollTo };
}

function makeSheet(name: string): XlsxSheetMeta {
  return {
    name,
    rowCount: 1,
    columnCount: 1,
    nonEmptyCellCount: 1,
  };
}

function xlsxCellByText(text: string) {
  const cell = screen
    .getByText(text)
    .closest('[data-slot="xlsx-cell"]') as HTMLElement | null;
  expect(cell).toBeTruthy();
  return cell!;
}

function mockSheetTabMetrics({
  clientWidth,
  scrollWidth,
  tabWidth,
}: {
  clientWidth: number;
  scrollWidth: number;
  tabWidth: number;
}) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.className.toString().includes("overflow-x-auto")
        ? clientWidth
        : tabWidth;
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.className.toString().includes("overflow-x-auto")
        ? scrollWidth
        : tabWidth;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
    tabWidth,
  );
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    function (this: HTMLElement) {
      if (this.getAttribute("role") !== "tab") return 0;
      const siblings = Array.from(this.parentElement?.children ?? []);
      return Math.max(0, siblings.indexOf(this)) * tabWidth;
    },
  );

  const scrollTo = vi.fn(function (
    this: HTMLElement,
    options?: ScrollToOptions | number,
  ) {
    const left =
      typeof options === "number" ? options : Number(options?.left ?? 0);
    this.scrollLeft = left;
    this.dispatchEvent(new Event("scroll"));
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });

  return { scrollTo };
}

describe("XlsxSheetTabs", () => {
  it("renders sheet tabs with selected state and reports accepted clicks", () => {
    const onSelectSheet = vi.fn();

    render(
      <XlsxSheetTabs
        sheets={[
          {
            name: "Summary",
            rowCount: 1,
            columnCount: 1,
            nonEmptyCellCount: 1,
          },
          {
            name: "Details",
            rowCount: 2,
            columnCount: 3,
            nonEmptyCellCount: 4,
          },
        ]}
        activeSheetIndex={0}
        onSelectSheet={onSelectSheet}
      />,
    );

    expect(
      screen
        .getByRole("tab", { name: "Summary" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen
        .getByRole("tab", { name: "Details" })
        .getAttribute("aria-selected"),
    ).toBe("false");
    expect(screen.getByRole("tab", { name: "Summary" }).tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "Details" }).tabIndex).toBe(-1);

    fireEvent.click(screen.getByRole("tab", { name: "Summary" }));
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));

    expect(onSelectSheet).toHaveBeenCalledWith(1);
    expect(onSelectSheet).toHaveBeenCalledTimes(1);
  });

  it("does not render a tablist for a single-sheet workbook", () => {
    render(
      <XlsxSheetTabs
        sheets={[
          { name: "Only", rowCount: 1, columnCount: 1, nonEmptyCellCount: 1 },
        ]}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("keeps overflow inside one native-like tab strip with clipped overflow", () => {
    mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });

    render(
      <XlsxSheetTabs
        sheets={Array.from({ length: 8 }, (_, index) =>
          makeSheet(`Sheet ${index + 1}`),
        )}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Workbook sheets" });
    const scroller = tablist.querySelector(
      '[data-slot="xlsx-viewer-tabs-scroll"]',
    );
    const list = tablist.querySelector('[data-slot="xlsx-viewer-tabs-track"]');

    expect(tablist.getAttribute("data-overflowing")).toBe("true");
    expect(tablist.style.height).toBe("36px");
    expect(scroller).toBeTruthy();
    expect(list).toBeTruthy();
    expect(tablist.querySelectorAll(".overflow-x-auto")).toHaveLength(1);
    expect(screen.queryByLabelText("Scroll sheets left")).toBeNull();
    expect(screen.queryByLabelText("Scroll sheets right")).toBeNull();
    expect(tablist.querySelector("[aria-hidden='true']")).toBeNull();
    expect(screen.getByRole("tab", { name: "Sheet 1" }).style.height).toBe(
      "28px",
    );
    expect(screen.getByRole("tab", { name: "Sheet 1" }).style.width).toBe(
      "104px",
    );
  });

  it("expands tabs across the strip before they overflow", () => {
    mockSheetTabMetrics({
      clientWidth: 640,
      scrollWidth: 640,
      tabWidth: 156,
    });

    render(
      <XlsxSheetTabs
        sheets={Array.from({ length: 4 }, (_, index) =>
          makeSheet(`Sheet ${index + 1}`),
        )}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Workbook sheets" });
    expect(tablist.getAttribute("data-overflowing")).toBe("false");
    expect(screen.getByRole("tab", { name: "Sheet 1" }).style.width).toBe(
      "156px",
    );
  });

  it("does not reveal the active sheet when it is already fully visible", () => {
    const { scrollTo } = mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });
    const sheets = Array.from({ length: 8 }, (_, index) =>
      makeSheet(`Sheet ${index + 1}`),
    );

    const { rerender } = render(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    scrollTo.mockClear();
    rerender(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={1}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("reveals a far active sheet while preserving a clipped overflow sliver", () => {
    const { scrollTo } = mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });
    const sheets = Array.from({ length: 8 }, (_, index) =>
      makeSheet(`Sheet ${index + 1}`),
    );

    const { rerender } = render(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    scrollTo.mockClear();
    rerender(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={5}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 352,
      behavior: "auto",
    });
  });

  it("uses smooth clipped-overflow reveal for nearby active sheets", () => {
    const { scrollTo } = mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });
    const sheets = Array.from({ length: 8 }, (_, index) =>
      makeSheet(`Sheet ${index + 1}`),
    );

    const { rerender } = render(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    scrollTo.mockClear();
    rerender(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={2}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 64,
      behavior: "smooth",
    });
  });

  it("uses the mobile clipped-overflow reveal size on narrow tab strips", () => {
    const { scrollTo } = mockSheetTabMetrics({
      clientWidth: 200,
      scrollWidth: 720,
      tabWidth: 96,
    });
    const sheets = Array.from({ length: 8 }, (_, index) =>
      makeSheet(`Sheet ${index + 1}`),
    );

    const { rerender } = render(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    scrollTo.mockClear();
    rerender(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={2}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 104,
      behavior: "smooth",
    });
  });

  it("clamps the first and last sheets to the native tab strip edges", () => {
    const { scrollTo } = mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });
    const sheets = Array.from({ length: 8 }, (_, index) =>
      makeSheet(`Sheet ${index + 1}`),
    );

    const { rerender } = render(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );
    const scroller = screen
      .getByRole("tablist", { name: "Workbook sheets" })
      .querySelector(".overflow-x-auto") as HTMLElement;

    scrollTo.mockClear();
    rerender(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={7}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 480,
      behavior: "auto",
    });

    scroller.scrollLeft = 480;
    scrollTo.mockClear();
    rerender(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 0,
      behavior: "auto",
    });
  });

  it("reveals active sheets clipped on the left edge", () => {
    const { scrollTo } = mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });
    const sheets = Array.from({ length: 8 }, (_, index) =>
      makeSheet(`Sheet ${index + 1}`),
    );

    const { rerender } = render(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={5}
        onSelectSheet={vi.fn()}
      />,
    );
    const scroller = screen
      .getByRole("tablist", { name: "Workbook sheets" })
      .querySelector(".overflow-x-auto") as HTMLElement;
    scroller.scrollLeft = 250;

    scrollTo.mockClear();
    rerender(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={1}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 80,
      behavior: "smooth",
    });
  });

  it("clamps active sheet reveal to the max scroll edge", () => {
    const { scrollTo } = mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 430,
      tabWidth: 96,
    });
    const sheets = Array.from({ length: 8 }, (_, index) =>
      makeSheet(`Sheet ${index + 1}`),
    );

    const { rerender } = render(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    scrollTo.mockClear();
    rerender(
      <XlsxSheetTabs
        sheets={sheets}
        activeSheetIndex={5}
        onSelectSheet={vi.fn()}
      />,
    );

    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 190,
      behavior: "smooth",
    });
  });

  it("maps wheel movement to horizontal tab scrolling while overflowing", () => {
    mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });

    render(
      <XlsxSheetTabs
        sheets={Array.from({ length: 8 }, (_, index) =>
          makeSheet(`Sheet ${index + 1}`),
        )}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Workbook sheets" });
    const scroller = tablist.querySelector(".overflow-x-auto") as HTMLElement;

    fireEvent.wheel(scroller, { deltaY: 120 });

    expect(scroller.scrollLeft).toBe(120);
    expect(tablist.getAttribute("data-can-scroll-left")).toBe("true");
  });

  it("does not trap wheel movement at tab strip scroll edges", () => {
    mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });

    render(
      <XlsxSheetTabs
        sheets={Array.from({ length: 8 }, (_, index) =>
          makeSheet(`Sheet ${index + 1}`),
        )}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Workbook sheets" });
    const scroller = tablist.querySelector(".overflow-x-auto") as HTMLElement;

    expect(fireEvent.wheel(scroller, { deltaY: -120 })).toBe(true);
    expect(scroller.scrollLeft).toBe(0);

    scroller.scrollLeft = 480;
    expect(fireEvent.wheel(scroller, { deltaY: 120 })).toBe(true);
    expect(scroller.scrollLeft).toBe(480);
  });

  it("does not trap wheel movement when tabs do not overflow", () => {
    mockSheetTabMetrics({
      clientWidth: 640,
      scrollWidth: 640,
      tabWidth: 156,
    });

    render(
      <XlsxSheetTabs
        sheets={Array.from({ length: 4 }, (_, index) =>
          makeSheet(`Sheet ${index + 1}`),
        )}
        activeSheetIndex={0}
        onSelectSheet={vi.fn()}
      />,
    );

    const scroller = screen
      .getByRole("tablist", { name: "Workbook sheets" })
      .querySelector(".overflow-x-auto") as HTMLElement;

    expect(fireEvent.wheel(scroller, { deltaY: 120 })).toBe(true);
    expect(scroller.scrollLeft).toBe(0);
  });

  it("supports wrapped keyboard selection for crowded sheet tabs", () => {
    mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });
    const onSelectSheet = vi.fn();

    render(
      <XlsxSheetTabs
        sheets={Array.from({ length: 8 }, (_, index) =>
          makeSheet(`Sheet ${index + 1}`),
        )}
        activeSheetIndex={3}
        onSelectSheet={onSelectSheet}
      />,
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Sheet 4" }), {
      key: "ArrowRight",
    });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Sheet 4" }), {
      key: "Home",
    });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Sheet 4" }), {
      key: "End",
    });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Sheet 4" }), {
      key: "ArrowLeft",
    });

    expect(onSelectSheet).toHaveBeenNthCalledWith(1, 4);
    expect(onSelectSheet).toHaveBeenNthCalledWith(2, 0);
    expect(onSelectSheet).toHaveBeenNthCalledWith(3, 7);
    expect(onSelectSheet).toHaveBeenNthCalledWith(4, 2);
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Sheet 3" }),
    );
  });

  it("wraps previous and next selection at the ends of a crowded sheet strip", () => {
    mockSheetTabMetrics({
      clientWidth: 240,
      scrollWidth: 720,
      tabWidth: 96,
    });
    const onSelectSheet = vi.fn();

    const { rerender } = render(
      <XlsxSheetTabs
        sheets={Array.from({ length: 8 }, (_, index) =>
          makeSheet(`Sheet ${index + 1}`),
        )}
        activeSheetIndex={0}
        onSelectSheet={onSelectSheet}
      />,
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Sheet 1" }), {
      key: "ArrowLeft",
    });
    expect(onSelectSheet).toHaveBeenLastCalledWith(7);

    rerender(
      <XlsxSheetTabs
        sheets={Array.from({ length: 8 }, (_, index) =>
          makeSheet(`Sheet ${index + 1}`),
        )}
        activeSheetIndex={7}
        onSelectSheet={onSelectSheet}
      />,
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "Sheet 8" }), {
      key: "ArrowRight",
    });

    expect(onSelectSheet).toHaveBeenLastCalledWith(0);
  });
});

describe("XlsxGrid", () => {
  it("renders an explicit empty-sheet state", () => {
    render(
      <XlsxGrid
        rowCount={0}
        columnCount={0}
        sheetName="Empty"
        getCell={() => ({ text: "", numeric: false })}
        scale={1}
        isolateStyles={false}
      />,
    );

    expect(screen.getByText("Empty sheet")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Empty is empty",
    );
  });

  it("treats invalid grid dimensions as an empty sheet", () => {
    render(
      <XlsxGrid
        rowCount={Number.MAX_SAFE_INTEGER + 1}
        columnCount={1}
        sheetName="Invalid"
        getCell={() => ({ text: "should not render", numeric: false })}
        scale={1}
        isolateStyles={false}
      />,
    );

    expect(screen.getByText("Empty sheet")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Invalid is empty",
    );
    expect(screen.queryByText("should not render")).toBeNull();
  });

  it("falls back to a usable scale when the grid scale is invalid", () => {
    render(
      <XlsxGrid
        rowCount={1}
        columnCount={1}
        sheetName="Invalid scale"
        getCell={() => ({ text: "visible", numeric: false })}
        scale={Number.NaN}
        isolateStyles={false}
      />,
    );

    expect(screen.getByRole("grid").getAttribute("aria-rowcount")).toBe("1");
    expect(screen.getByText("visible")).toBeTruthy();
  });

  it("renders visible rows and cells with grid indexes", () => {
    render(
      <XlsxGridRow
        rowIndex={2}
        getCell={(_rowIndex, columnIndex) => ({
          text: `cell ${columnIndex}`,
          numeric: columnIndex === 1,
        })}
        gridTemplate="52px 0px 128px 128px 0px"
        rowHeight={28}
        columnItems={[
          { key: "0", widthPx: 128, metadata: { columnIndex: 0 } },
          { key: "1", widthPx: 128, metadata: { columnIndex: 1 } },
        ]}
        leftPad={0}
        rightPad={0}
        start={56}
        activeColumnIndex={1}
      />,
    );

    expect(screen.getByRole("row").getAttribute("aria-rowindex")).toBe("3");
    const cells = screen.getAllByRole("gridcell");
    expect(cells[0].getAttribute("aria-rowindex")).toBeNull();
    expect(cells[0].getAttribute("aria-colindex")).toBe("1");
    expect(cells[1].getAttribute("aria-colindex")).toBe("2");
    expect(cells[1].hasAttribute("title")).toBe(false);
    expect(cells[1].className).toContain("ring-primary");
  });

  it("keeps XLSX virtualization compact while preserving sticky row semantics", async () => {
    mockElementMetrics({
      clientHeight: 96,
      clientWidth: 360,
    });

    const { container } = render(
      <XlsxGrid
        rowCount={1000}
        columnCount={1000}
        sheetName="Large"
        getCell={(rowIndex, columnIndex) => ({
          text: `${rowIndex}:${columnIndex}`,
          numeric: columnIndex % 2 === 1,
        })}
        scale={1}
        isolateStyles={false}
      />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('[data-slot="xlsx-row"]')).toHaveLength(
        14,
      );
    });

    const cells = container.querySelectorAll('[data-slot="xlsx-cell"]');
    expect(cells.length).toBeLessThan(200);
    expect(cells.length).toBeGreaterThan(0);
    expect(
      container.querySelector('[data-slot="xlsx-cell"][title]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="xlsx-cell"][aria-rowindex]'),
    ).toBeNull();

    const canvas = container.querySelector<HTMLElement>(
      '[data-slot="xlsx-body"] > div',
    );
    const header = container.querySelector<HTMLElement>(".sticky.top-0");
    const firstRow = container.querySelector<HTMLElement>(
      '[data-slot="xlsx-row"]',
    );
    const rowNumber = firstRow?.querySelector<HTMLElement>(
      '[data-slot="xlsx-row-number"]',
    );

    expect(canvas?.style.contain).toBe("layout paint style");
    expect(header).toBeTruthy();
    expect(firstRow?.getAttribute("aria-rowindex")).toBe("1");
    expect(rowNumber?.className).toContain("sticky");
    expect(rowNumber?.className).toContain("left-0");
    expect(
      firstRow
        ?.querySelector('[data-slot="xlsx-cell"]')
        ?.getAttribute("aria-colindex"),
    ).toBe("1");
  });

  it("uses near-zero overscan when a large XLSX scroll jump settles", async () => {
    vi.useFakeTimers();
    mockElementMetrics({
      clientHeight: 96,
      clientWidth: 360,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      window.clearTimeout(id);
    });

    try {
      const { container } = render(
        <XlsxGrid
          rowCount={1000}
          columnCount={1000}
          sheetName="Jump"
          getCell={(rowIndex, columnIndex) => ({
            text: `${rowIndex}:${columnIndex}`,
            numeric: false,
          })}
          scale={1}
          isolateStyles={false}
        />,
      );

      const viewport = screen.getByRole("grid", { name: "Jump" });
      expect(
        container.querySelector('[data-slot="xlsx-row"]')?.textContent,
      ).toContain("10:0");

      viewport.scrollTop = 28 * 500;
      fireEvent.scroll(viewport);

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(
        container.querySelector('[data-slot="xlsx-row"]')?.textContent,
      ).toContain("501500:0");
      expect(
        Array.from(
          container.querySelectorAll<HTMLElement>(
            '[data-slot="xlsx-row"]:not([hidden])',
          ),
        ).map((row) => row.getAttribute("aria-rowindex")),
      ).toEqual(["501", "502", "503", "504", "505"]);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("marks the active cell only when the active row is visible", () => {
    const { rerender } = render(
      <XlsxGrid
        rowCount={3}
        columnCount={3}
        sheetName="Active"
        getCell={(rowIndex, columnIndex) => ({
          text: `${rowIndex}:${columnIndex}`,
          numeric: false,
        })}
        scale={1}
        activeCell={{ rowIndex: 1, columnIndex: 2 }}
        isolateStyles={false}
      />,
    );

    const activeCell = xlsxCellByText("1:2");
    expect(activeCell.className).toContain("ring-primary");
    expect(xlsxCellByText("0:2").className).not.toContain("ring-primary");

    rerender(
      <XlsxGrid
        rowCount={3}
        columnCount={3}
        sheetName="Active"
        getCell={(rowIndex, columnIndex) => ({
          text: `${rowIndex}:${columnIndex}`,
          numeric: false,
        })}
        scale={1}
        activeCell={{ rowIndex: 2, columnIndex: 2 }}
        isolateStyles={false}
      />,
    );

    expect(xlsxCellByText("1:2").className).not.toContain("ring-primary");
    expect(xlsxCellByText("2:2").className).toContain("ring-primary");
  });

  it("scrolls requested cells to the viewport center using the scaled grid size", () => {
    const { scrollTo } = mockElementMetrics({
      clientHeight: 80,
      clientWidth: 240,
    });

    const { rerender } = render(
      <XlsxGrid
        rowCount={50}
        columnCount={20}
        sheetName="Scroll"
        getCell={() => ({ text: "", numeric: false })}
        scale={2}
        isolateStyles={false}
      />,
    );

    rerender(
      <XlsxGrid
        rowCount={50}
        columnCount={20}
        sheetName="Scroll"
        getCell={() => ({ text: "", numeric: false })}
        scale={2}
        scrollRequest={{
          sheetIndex: 0,
          rowIndex: 10,
          columnIndex: 4,
          behavior: "auto",
          nonce: 1,
        }}
        isolateStyles={false}
      />,
    );

    expect(scrollTo).toHaveBeenCalledWith({
      top: 548,
      left: 1032,
      behavior: "auto",
    });
  });
});

describe("XlsxViewer scroll model", () => {
  const sheets = [
    { name: "Summary", rowCount: 3, columnCount: 2, nonEmptyCellCount: 1 },
    { name: "Detail", rowCount: 4, columnCount: 5, nonEmptyCellCount: 1 },
  ];

  it("converts public compatibility cells to internal coordinates", () => {
    expect(toInternalCellRef({ sheet: 1, row: 2, col: 3 })).toEqual({
      sheetIndex: 1,
      rowIndex: 2,
      columnIndex: 3,
    });
    expect(toInternalCellRef({ sheet: -1, row: 0, col: 0 })).toBeNull();
    expect(toInternalCellRef({ sheet: 0.5, row: 0, col: 0 })).toBeNull();
    expect(toInternalCellRef({ sheet: 0, row: NaN, col: 0 })).toBeNull();
    expect(
      toInternalCellRef({
        sheet: Number.MAX_SAFE_INTEGER + 1,
        row: 0,
        col: 0,
      }),
    ).toBeNull();
    expect(
      toInternalCellRef({
        sheet: 0,
        row: Number.MAX_SAFE_INTEGER + 1,
        col: 0,
      }),
    ).toBeNull();
  });

  it("rejects invalid loaded scroll targets before resolving sheet changes", () => {
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: -1, columnIndex: 0 },
        sheets,
      ),
    ).toBe(false);
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 0, columnIndex: -1 },
        sheets,
      ),
    ).toBe(false);
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 0.5, columnIndex: 0 },
        sheets,
      ),
    ).toBe(false);
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 2, columnIndex: 1 },
        sheets,
      ),
    ).toBe(true);
  });

  it("rejects loaded scroll targets that only fit invalid sheet dimensions", () => {
    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 1, columnIndex: 0 },
        [
          {
            name: "Fractional",
            rowCount: 1.5,
            columnCount: 1,
            nonEmptyCellCount: 0,
          },
        ],
      ),
    ).toBe(false);

    expect(
      isValidLoadedScrollTarget(
        { sheetIndex: 0, rowIndex: 0, columnIndex: 0 },
        [
          {
            name: "Infinite",
            rowCount: Number.POSITIVE_INFINITY,
            columnCount: 1,
            nonEmptyCellCount: 0,
          },
        ],
      ),
    ).toBe(false);
  });

  it("replays a pending pre-load scroll target after sheets are known", () => {
    const pendingTarget: PendingXlsxScrollTarget = {
      sheetIndex: 1,
      rowIndex: 2,
      columnIndex: 3,
      behavior: "auto",
    };

    expect(
      resolveLoadedScrollTarget({
        activeSheetIndex: 0,
        target: pendingTarget,
        sheets,
      }),
    ).toEqual({
      sheetIndex: 1,
      request: pendingTarget,
      changed: true,
    });
  });

  it("drops an out-of-bounds pending pre-load scroll target", () => {
    expect(
      resolveLoadedScrollTarget({
        activeSheetIndex: 0,
        target: {
          sheetIndex: 1,
          rowIndex: 9,
          columnIndex: 3,
          behavior: "auto",
        },
        sheets,
      }),
    ).toBeNull();
  });

  it("resolves same-sheet loaded targets without reporting a sheet change", () => {
    const target: PendingXlsxScrollTarget = {
      sheetIndex: 0,
      rowIndex: 2,
      columnIndex: 1,
      behavior: "smooth",
    };

    expect(
      resolveLoadedScrollTarget({
        activeSheetIndex: 0,
        target,
        sheets,
      }),
    ).toEqual({
      sheetIndex: 0,
      request: target,
      changed: false,
    });
  });
});
