// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { inferCsvDialect } from "@/lib/csv";
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer";
import { ViewerFormatError } from "@/registry/new-york-v4/lib/viewer-errors";
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource";
import {
  createCsvExportAction,
  defaultCsvDownloadName,
} from "@/registry/new-york-v4/ui/csv-viewer-download";
import { resolveCsvResource } from "@/registry/new-york-v4/ui/csv-viewer-resource";
import { toCsvFormatError } from "@/registry/new-york-v4/ui/csv-viewer-worker";

// Stock Radix dropdown-menu relies on pointer capture and scrollIntoView, which
// jsdom does not implement. Without these shims the Download menu never opens.
if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Stock Radix DropdownMenuTrigger opens on pointerdown (not click); base-ui
// opened on click. Drive both events so the menu opens under jsdom.
function openDownloadMenu() {
  const trigger = screen.getByRole("button", { name: "Download" });
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(trigger);
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function response(text: string, init?: ResponseInit) {
  return new Response(text, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function mockObjectUrls(url = "blob:csv-download") {
  const createObjectURL = vi.fn<(input: Blob | MediaSource) => string>(
    () => url,
  );
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
  return { createObjectURL, revokeObjectURL };
}

function captureAnchorClicks() {
  const clicks: Array<{ href: string | null; download: string }> = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push({
      href: this.getAttribute("href"),
      download: this.download,
    });
  });
  return clicks;
}

function csvRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-slot="csv-row"]'));
}

function csvCells(row: Element) {
  return Array.from(row.querySelectorAll('[data-slot="csv-cell"]'));
}

function csvBlobSource(text: string, identityKey: string) {
  return blobSource(new Blob([text], { type: "text/csv" }), {
    identityKey,
    fileName: `${identityKey}.csv`,
    mimeType: "text/csv",
  });
}

function runNativeFindIndexImmediately() {
  vi.stubGlobal(
    "requestIdleCallback",
    (
      callback: (deadline: {
        didTimeout: boolean;
        timeRemaining: () => number;
      }) => void,
    ) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    },
  );
  vi.stubGlobal("cancelIdleCallback", vi.fn());
}

function selectNativeFindText(element: HTMLElement, text: string) {
  const offset = element.textContent?.indexOf(text) ?? -1;
  expect(offset).toBeGreaterThanOrEqual(0);

  const textNode = element.firstChild;
  expect(textNode?.nodeType).toBe(Node.TEXT_NODE);

  const range = document.createRange();
  range.setStart(textNode!, offset);
  range.setEnd(textNode!, offset + text.length);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function csvStreamResponse(parts: string[]) {
  const encoder = new TextEncoder();
  return responseFromStream(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    }),
  );
}

function csvByteStreamResponse(text: string, splitAt: number) {
  const bytes = new TextEncoder().encode(text);
  return responseFromStream(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, splitAt));
        controller.enqueue(bytes.slice(splitAt));
        controller.close();
      },
    }),
  );
}

function responseFromStream(body: ReadableStream<Uint8Array>) {
  return new Response(body, { status: 200 });
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  clearViewerResourceRegistryForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CsvViewer", () => {
  it("renders quoted delimiters, escaped quotes, and embedded newlines as single cells", () => {
    render(
      <CsvViewer
        source={{
          kind: "text",
          text:
            "name,notes\n" +
            '"Alice","line 1\nline 2, still one cell"\n' +
            '"Bob","she said ""hi"""',
          fileName: "quoted.csv",
        }}
        controls={false}
      />,
    );

    expect(
      Array.from(document.querySelectorAll("[title]")).find(
        (element) =>
          element.getAttribute("title") === "line 1\nline 2, still one cell",
      ),
    ).toBeTruthy();
    expect(screen.getByTitle('she said "hi"')).toBeTruthy();
    expect(screen.queryByText('"Alice"')).toBeNull();
  });

  it("keeps a final quoted empty field as a real row", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "text",
          text: 'value\n""',
          fileName: "quoted-empty.csv",
        }}
        controls={false}
      />,
    );

    const rows = csvRows(container);
    expect(rows).toHaveLength(1);
    expect(csvCells(rows[0]!).map((cell) => cell.textContent)).toEqual([""]);
  });

  it("keeps quotes inside unquoted fields without swallowing delimiters", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "text",
          text: 'note,other\nab"cd,ef\nnext,row',
          fileName: "literal-quotes.csv",
        }}
        controls={false}
      />,
    );

    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(['ab"cd', "ef"]);
    expect(
      csvCells(csvRows(container)[1]!).map((cell) => cell.textContent),
    ).toEqual(["next", "row"]);
  });

  it("strips a leading UTF-8 BOM from the first header", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "text",
          text: "\uFEFFname,age\nAlice,30",
          fileName: "bom.csv",
        }}
        controls={false}
      />,
    );

    const headerTitles = Array.from(
      container.querySelectorAll('[data-slot="csv-header-cell"] button'),
    ).map((button) => button.getAttribute("title"));
    expect(headerTitles).toContain("Sort by name");
    expect(headerTitles).not.toContain("Sort by \uFEFFname");
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("synthesizes headers and keeps the first record when header parsing is disabled", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a,b\n1,2",
          fileName: "headerless.csv",
        }}
        dialect={{ delimiter: ",", hasHeader: false }}
        controls={false}
      />,
    );

    expect(screen.getByTitle("Sort by Column 1")).toBeTruthy();
    expect(screen.getByTitle("Sort by Column 2")).toBeTruthy();

    const rows = csvRows(container);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("1ab");
    expect(rows[1]?.textContent).toContain("212");
  });

  it("pads displayed rows when later records widen parsed text", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a,b\n1\n2,3,4",
          fileName: "ragged.csv",
        }}
        controls={false}
      />,
    );

    expect(screen.getByTitle("Sort by Column 3")).toBeTruthy();

    const rows = csvRows(container);
    expect(csvCells(rows[0]!).map((cell) => cell.textContent)).toEqual([
      "1",
      "",
      "",
    ]);
    expect(csvCells(rows[1]!).map((cell) => cell.textContent)).toEqual([
      "2",
      "3",
      "4",
    ]);
  });

  it("renders TSV data with an explicit tab delimiter", () => {
    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a\tb\n1\t2",
          fileName: "data.tsv",
        }}
        dialect={{ delimiter: "\t", hasHeader: true }}
        controls={false}
      />,
    );

    expect(screen.getByText("a")).toBeTruthy();
    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("normalizes escaped tab delimiters passed through the dialect prop", () => {
    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a\tb\n1\t2",
          fileName: "escaped-tab.csv",
        }}
        dialect={{ delimiter: "\\t", hasHeader: true }}
        controls={false}
      />,
    );

    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("a\tb")).toBeNull();
  });

  it("infers tab delimiters for inline .tsv text sources", () => {
    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a\tb\n1\t2",
          fileName: "inline.tsv",
        }}
        controls={false}
      />,
    );

    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("a\tb")).toBeNull();
  });

  it("uses an explicit dialect instead of the source extension", () => {
    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a,b\n1,2",
          fileName: "comma-data.tsv",
        }}
        dialect={{ delimiter: ",", hasHeader: true }}
        controls={false}
      />,
    );

    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("a,b")).toBeNull();
  });

  it("re-parses a stable text source when the dialect prop changes", () => {
    const source = {
      kind: "text" as const,
      text: "a,b\n1,2",
      fileName: "stable.csv",
    };
    const { rerender } = render(
      <CsvViewer
        source={source}
        dialect={{ delimiter: "\t", hasHeader: true }}
        controls={false}
      />,
    );

    expect(screen.getByTitle("Sort by a,b")).toBeTruthy();
    expect(screen.queryByText("b")).toBeNull();

    rerender(
      <CsvViewer
        source={source}
        dialect={{ delimiter: ",", hasHeader: true }}
        controls={false}
      />,
    );

    expect(screen.getByTitle("Sort by b")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("clears sort state when a dialect change keeps the same column names", () => {
    const source = {
      kind: "text" as const,
      text: "Column 1,Column 2\nb,2\na,1",
      fileName: "stable.csv",
    };
    const { container, rerender } = render(
      <CsvViewer
        source={source}
        dialect={{ delimiter: ",", hasHeader: true }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by Column 1"));
    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["a", "1"]);

    rerender(
      <CsvViewer
        source={source}
        dialect={{ delimiter: ",", hasHeader: false }}
        controls={false}
      />,
    );

    expect(
      screen
        .getByTitle("Sort by Column 1")
        .closest('[role="columnheader"]')
        ?.getAttribute("aria-sort"),
    ).toBe("none");
    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["Column 1", "Column 2"]);
  });

  it("renders empty parsed data with header counts and a no-rows state", () => {
    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a,b\n",
          fileName: "headers-only.csv",
        }}
      />,
    );

    expect(screen.getByText("0 rows")).toBeTruthy();
    expect(screen.getByText("2 columns")).toBeTruthy();
    expect(screen.getByText("No rows")).toBeTruthy();
  });

  it("renders an idle no-source state without allowing empty derived exports", () => {
    const { createObjectURL } = mockObjectUrls();
    captureAnchorClicks();

    render(<CsvViewer />);

    expect(screen.getByText("0 rows")).toBeTruthy();
    expect(screen.getByText("0 columns")).toBeTruthy();
    expect(screen.getByText("No rows")).toBeTruthy();

    const exportButton = screen.getByRole("button", { name: "Export table" });
    expect((exportButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(exportButton);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("uses singular controls counts for one row and one column", () => {
    render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["only"],
            rows: [["value"]],
          },
        }}
      />,
    );

    expect(screen.getByText("1 row")).toBeTruthy();
    expect(screen.getByText("1 column")).toBeTruthy();
  });

  it("reports full ARIA table dimensions including the row-number column", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a", "b", "c"],
            rows: [
              ["1", "2", "3"],
              ["4", "5", "6"],
            ],
          },
        }}
        controls={false}
      />,
    );

    const table = screen.getByRole("table", { name: "CSV data" });
    expect(table.getAttribute("aria-rowcount")).toBe("3");
    expect(table.getAttribute("aria-colcount")).toBe("4");

    const rows = csvRows(container);
    expect(rows[0]?.getAttribute("aria-rowindex")).toBe("2");
    expect(
      rows[0]
        ?.querySelector('[data-slot="csv-row-number"]')
        ?.getAttribute("aria-colindex"),
    ).toBe("1");
    expect(
      csvCells(rows[0]!).map((cell) => cell.getAttribute("aria-colindex")),
    ).toEqual(["2", "3", "4"]);
  });

  it("virtualizes large tables while preserving full row counts", () => {
    const rows = Array.from({ length: 250 }, (_, index) => [
      String(index + 1),
      `value-${index + 1}`,
    ]);

    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["id", "value"],
            rows,
          },
        }}
        controls={false}
      />,
    );

    expect(screen.getByRole("table").getAttribute("aria-rowcount")).toBe("251");
    expect(csvRows(container).length).toBeLessThan(250);
    expect(csvRows(container).length).toBeGreaterThan(0);
    const rowWindow = container.querySelector<HTMLElement>(
      '[data-slot="csv-row-window"]',
    );
    const rowOffset = container.querySelector<HTMLElement>(
      '[data-slot="csv-row-offset"]',
    );
    expect(rowOffset?.style.height).toBe("0px");
    expect(rowWindow?.style.position).toBe("sticky");
    expect(rowWindow?.style.marginTop).toBe("");
    expect(rowWindow?.style.height).not.toBe(`${250 * 33}px`);
    expect(screen.getByText("value-1")).toBeTruthy();
  });

  it("indexes virtualized cells for native browser find and scrolls to the matched cell", async () => {
    runNativeFindIndexImmediately();
    const columns = Array.from(
      { length: 12 },
      (_, index) => `col-${index + 1}`,
    );
    const needle = "needle-offscreen-cell";
    const rows = Array.from({ length: 250 }, (_, rowIndex) =>
      columns.map((_, columnIndex) =>
        rowIndex === 249 && columnIndex === 10
          ? needle
          : `r${rowIndex}-c${columnIndex}`,
      ),
    );

    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns,
            rows,
          },
        }}
        controls={false}
      />,
    );

    const index = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(
        '[data-slot="csv-native-find-index"]',
      );
      expect(element).toBeTruthy();
      return element!;
    });
    expect(index.getAttribute("data-native-find-indexed-cells")).toBe("3000");
    expect(
      csvRows(container).some((row) => row.textContent?.includes(needle)),
    ).toBe(false);

    const entry = Array.from(
      index.querySelectorAll<HTMLElement>("[data-native-find-start-row]"),
    ).find((element) => element.textContent?.includes(needle));
    expect(entry).toBeTruthy();
    expect(entry?.getAttribute("hidden")).toBe("until-found");

    const viewport = container.querySelector(
      '[data-slot="csv-body"]',
    ) as HTMLDivElement | null;
    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      value: 360,
    });
    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    selectNativeFindText(entry!, needle);
    act(() => {
      entry!.dispatchEvent(new Event("beforematch"));
    });

    expect(scrollTo).toHaveBeenCalledWith({
      top: 8183.5,
      left: 1710,
      behavior: "auto",
    });
  });

  it("renders horizontally virtualized columns after scrolling", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const columns = Array.from(
      { length: 20 },
      (_, index) => `col-${index + 1}`,
    );
    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns,
            rows: [columns.map((_, index) => `value-${index + 1}`)],
          },
        }}
        controls={false}
      />,
    );

    expect(screen.queryByTitle("Sort by col-16")).toBeNull();

    const viewport = container.querySelector(
      '[data-slot="csv-body"]',
    ) as HTMLDivElement | null;
    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      value: 360,
    });
    Object.defineProperty(viewport, "scrollLeft", {
      configurable: true,
      value: 12 * 180,
    });

    fireEvent.scroll(viewport!);

    expect(await screen.findByTitle("Sort by col-16")).toBeTruthy();
    expect(screen.getByText("value-16")).toBeTruthy();
  });

  it("omits controls when controls is disabled", () => {
    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a,b\n1,2",
          fileName: "data.csv",
        }}
        controls={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("cycles numeric sort state without losing source row numbers", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["amount", "label"],
            rows: [
              ["10", "ten"],
              ["2", "two"],
            ],
          },
          fileName: "numbers.csv",
        }}
        controls={false}
      />,
    );

    const sortButton = screen.getByTitle("Sort by amount");
    const sortHeader = sortButton.closest('[role="columnheader"]');
    expect(sortHeader?.getAttribute("aria-sort")).toBe("none");

    fireEvent.click(sortButton);
    expect(sortHeader?.getAttribute("aria-sort")).toBe("ascending");
    expect(csvRows(container)[0]?.textContent).toContain("22two");

    fireEvent.click(sortButton);
    expect(sortHeader?.getAttribute("aria-sort")).toBe("descending");
    expect(csvRows(container)[0]?.textContent).toContain("110ten");

    fireEvent.click(sortButton);
    expect(sortHeader?.getAttribute("aria-sort")).toBe("none");
    expect(csvRows(container)[0]?.textContent).toContain("110ten");
  });

  it("keeps active cells tied to source rows after sorting", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["id", "name"],
            rows: [
              ["2", "b"],
              ["1", "a"],
            ],
          },
          fileName: "data.csv",
        }}
        activeCell={{ rowIndex: 0, columnIndex: 1 }}
        controls={false}
      />,
    );

    expect(screen.getByTitle("b").className).toContain("ring-primary");

    fireEvent.click(screen.getByTitle("Sort by id"));

    expect(screen.getByTitle("b").className).toContain("ring-primary");

    const rows = Array.from(
      container.querySelectorAll('[data-slot="csv-row"]'),
    );
    expect(
      rows[0]?.querySelector('[data-slot="csv-row-number"]')?.textContent,
    ).toBe("2");
    expect(rows[0]?.textContent).toContain("1a");
    expect(
      rows[1]?.querySelector('[data-slot="csv-row-number"]')?.textContent,
    ).toBe("1");
    expect(rows[1]?.textContent).toContain("2b");
  });

  it("maps imperative scrolling through the sorted display order", () => {
    const viewerRef = React.createRef<CsvViewerHandle>();
    render(
      <CsvViewer
        ref={viewerRef}
        source={{
          kind: "table",
          table: {
            columns: ["id", "name"],
            rows: [
              ["4", "d"],
              ["1", "a"],
              ["3", "c"],
              ["2", "b"],
            ],
          },
          fileName: "data.csv",
        }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by id"));

    const viewport = viewerRef.current?.getViewportElement();
    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      value: 220,
    });
    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    act(() => {
      viewerRef.current?.scrollToCell(
        { rowIndex: 0, columnIndex: 1 },
        { behavior: "auto" },
      );
    });

    expect(scrollTo).toHaveBeenCalledWith({
      top: 65.5,
      left: 160,
      behavior: "auto",
    });
  });

  it("updates zoom labels and viewer scale from the controls", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a"],
            rows: [["1"]],
          },
          fileName: "zoom.csv",
        }}
      />,
    );

    const viewer = container.querySelector('[data-slot="csv-viewer"]');
    expect((viewer as HTMLElement | null)?.style.fontSize).toBe("13px");
    expect(screen.getByText("100%")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(screen.getByText("120%")).toBeTruthy();
    expect((viewer as HTMLElement | null)?.style.fontSize).toBe("15.6px");

    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));

    expect(screen.getByText("100%")).toBeTruthy();
    expect((viewer as HTMLElement | null)?.style.fontSize).toBe("13px");
  });

  it("clamps zoom controls to supported minimum and maximum scales", () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a"],
            rows: [["1"]],
          },
        }}
      />,
    );

    const viewer = container.querySelector(
      '[data-slot="csv-viewer"]',
    ) as HTMLElement | null;

    for (let index = 0; index < 20; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    }

    expect(screen.getByText("25%")).toBeTruthy();
    expect(viewer?.style.fontSize).toBe("3.25px");

    for (let index = 0; index < 40; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    }

    expect(screen.getByText("500%")).toBeTruthy();
    expect(viewer?.style.fontSize).toBe("65px");
  });

  it("applies fixed height and fill-height layout modes", () => {
    const { container, rerender } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a"],
            rows: [["1"]],
          },
        }}
        height={320}
        controls={false}
      />,
    );

    const frame = container.querySelector(
      '[data-slot="csv-grid"] > div',
    ) as HTMLElement | null;
    expect(frame?.style.height).toBe("320px");

    rerender(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a"],
            rows: [["1"]],
          },
        }}
        fillHeight
        controls={false}
      />,
    );

    const fillFrame = container.querySelector(
      '[data-slot="csv-grid"] > div',
    ) as HTMLElement | null;
    expect(fillFrame?.style.height).toBe("");
    expect(fillFrame?.className).toContain("h-full");
  });

  it("recomputes dialect and table shape when the source changes", () => {
    const { rerender } = render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a,b\n1,2",
          fileName: "first.csv",
        }}
        controls={false}
      />,
    );

    expect(screen.getByTitle("Sort by b")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();

    rerender(
      <CsvViewer
        source={{
          kind: "text",
          text: "left\tright\textra\nx\ty\tz",
          fileName: "second.tsv",
        }}
        controls={false}
      />,
    );

    expect(screen.getByTitle("Sort by extra")).toBeTruthy();
    expect(screen.getByText("z")).toBeTruthy();
    expect(screen.queryByTitle("Sort by b")).toBeNull();
  });

  it("clears sort state when a same-identity text source has new content", async () => {
    const { container, rerender } = render(
      <CsvViewer
        source={{
          kind: "text",
          identityKey: "inline-data",
          text: "id,label\n2,two\n1,one",
          fileName: "data.csv",
        }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(csvRows(container)[0]?.textContent).toContain("21one");

    rerender(
      <CsvViewer
        source={{
          kind: "text",
          identityKey: "inline-data",
          text: "id,label\nb,native-first\na,native-second",
          fileName: "data.csv",
        }}
        controls={false}
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTitle("Sort by id")
          .closest('[role="columnheader"]')
          ?.getAttribute("aria-sort"),
      ).toBe("none");
    });
    expect(csvRows(container)[0]?.textContent).toContain("1bnative-first");
  });

  it("keeps sort state when only text source presentation metadata changes", () => {
    const { container, rerender } = render(
      <CsvViewer
        source={{
          kind: "text",
          text: "name\nz\na",
          fileName: "first.csv",
        }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by name"));
    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["a"]);

    rerender(
      <CsvViewer
        source={{
          kind: "text",
          text: "name\nz\na",
          fileName: "second.csv",
        }}
        controls={false}
      />,
    );

    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["a"]);
  });

  it("clears sort state when a new source has a different column shape", async () => {
    const { container, rerender } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["id", "label"],
            rows: [
              ["2", "two"],
              ["1", "one"],
            ],
          },
        }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(csvRows(container)[0]?.textContent).toContain("21one");

    rerender(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["name", "score", "status"],
            rows: [
              ["b", "2", "current"],
              ["a", "1", "later"],
            ],
          },
        }}
        controls={false}
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTitle("Sort by name")
          .closest('[role="columnheader"]')
          ?.getAttribute("aria-sort"),
      ).toBe("none");
    });
    expect(csvRows(container)[0]?.textContent).toContain("1b2current");
  });

  it("clears sort state when a new source keeps the same column shape", async () => {
    const { container, rerender } = render(
      <CsvViewer
        source={{
          kind: "table",
          identityKey: "first",
          table: {
            columns: ["id", "label"],
            rows: [
              ["2", "two"],
              ["1", "one"],
            ],
          },
        }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(csvRows(container)[0]?.textContent).toContain("21one");

    rerender(
      <CsvViewer
        source={{
          kind: "table",
          identityKey: "second",
          table: {
            columns: ["id", "label"],
            rows: [
              ["b", "native-first"],
              ["a", "native-second"],
            ],
          },
        }}
        controls={false}
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTitle("Sort by id")
          .closest('[role="columnheader"]')
          ?.getAttribute("aria-sort"),
      ).toBe("none");
    });
    expect(csvRows(container)[0]?.textContent).toContain("1bnative-first");
  });

  it("clears sort state for a new anonymous table object with the same columns", async () => {
    const { container, rerender } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["id", "label"],
            rows: [
              ["2", "two"],
              ["1", "one"],
            ],
          },
        }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(csvRows(container)[0]?.textContent).toContain("21one");

    rerender(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["id", "label"],
            rows: [
              ["b", "native-first"],
              ["a", "native-second"],
            ],
          },
        }}
        controls={false}
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTitle("Sort by id")
          .closest('[role="columnheader"]')
          ?.getAttribute("aria-sort"),
      ).toBe("none");
    });
    expect(csvRows(container)[0]?.textContent).toContain("1bnative-first");
  });

  it("clears sort state when a same-named table source has new data", async () => {
    const { container, rerender } = render(
      <CsvViewer
        source={{
          kind: "table",
          fileName: "data.csv",
          table: {
            columns: ["id", "label"],
            rows: [
              ["2", "two"],
              ["1", "one"],
            ],
          },
        }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(csvRows(container)[0]?.textContent).toContain("21one");

    rerender(
      <CsvViewer
        source={{
          kind: "table",
          fileName: "data.csv",
          table: {
            columns: ["id", "label"],
            rows: [
              ["b", "native-first"],
              ["a", "native-second"],
            ],
          },
        }}
        controls={false}
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTitle("Sort by id")
          .closest('[role="columnheader"]')
          ?.getAttribute("aria-sort"),
      ).toBe("none");
    });
    expect(csvRows(container)[0]?.textContent).toContain("1bnative-first");
  });

  it("keeps sort state when the same table source rerenders", () => {
    const table = {
      columns: ["id", "label"],
      rows: [
        ["2", "two"],
        ["1", "one"],
      ],
    };
    const source = { kind: "table" as const, table };
    const { container, rerender } = render(
      <CsvViewer source={source} controls={false} />,
    );

    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(csvRows(container)[0]?.textContent).toContain("21one");

    rerender(<CsvViewer source={source} controls={false} />);

    expect(
      screen
        .getByTitle("Sort by id")
        .closest('[role="columnheader"]')
        ?.getAttribute("aria-sort"),
    ).toBe("ascending");
    expect(csvRows(container)[0]?.textContent).toContain("21one");
  });

  it("keeps sort state when a new source wrapper points at the same table object", () => {
    const table = {
      columns: ["id", "label"],
      rows: [
        ["2", "two"],
        ["1", "one"],
      ],
    };
    const { container, rerender } = render(
      <CsvViewer
        source={{ kind: "table", table, fileName: "data.csv" }}
        controls={false}
      />,
    );

    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(csvRows(container)[0]?.textContent).toContain("21one");

    rerender(
      <CsvViewer
        source={{ kind: "table", table, fileName: "data.csv" }}
        controls={false}
      />,
    );

    expect(
      screen
        .getByTitle("Sort by id")
        .closest('[role="columnheader"]')
        ?.getAttribute("aria-sort"),
    ).toBe("ascending");
    expect(csvRows(container)[0]?.textContent).toContain("21one");
  });

  it("renders the grid inside a shadow root when style isolation is enabled", async () => {
    const { container } = render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a,b\n1,2",
          fileName: "isolated.csv",
        }}
        controls={false}
        isolateStyles
      />,
    );

    const host = container.querySelector(
      '[data-slot="csv-grid"] > div',
    ) as HTMLDivElement | null;

    await waitFor(() => {
      expect(
        host?.shadowRoot?.querySelector('[data-slot="csv-body"]'),
      ).toBeTruthy();
    });
    expect(host?.shadowRoot?.textContent).toContain("2");
  });
});

describe("FileViewer CSV integration", () => {
  it("selects tab delimiters for TSV descriptors", () => {
    expect(inferCsvDialect({ fileName: "data.tsv" }).delimiter).toBe("\t");
    expect(
      inferCsvDialect({
        fileName: "data",
        mimeType: "text/tab-separated-values",
      }).delimiter,
    ).toBe("\t");
    expect(
      inferCsvDialect({
        fileName: "data.csv",
        mimeType: "text/tab-separated-values",
      }).delimiter,
    ).toBe(",");
  });
});

describe("CsvViewer URL source loading", () => {
  it("shows loading state for a pending URL and then renders parsed rows", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise),
    );

    render(
      <CsvViewer
        source={{ kind: "url", url: "/slow.csv", fileName: "slow.csv" }}
      />,
    );

    expect(screen.getByText(/0 rows.*loading/)).toBeTruthy();

    pending.resolve(response("a,b\n1,2"));

    expect(await screen.findByText("b")).toBeTruthy();
    expect(screen.getByText("1 row")).toBeTruthy();
  });

  it("infers tab delimiters for .tsv URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("a\tb\n1\t2", { status: 200 }))),
    );

    render(
      <CsvViewer
        source={{ kind: "url", url: "/data.tsv", fileName: "data.tsv" }}
        controls={false}
      />,
    );

    expect(await screen.findByText("b")).toBeTruthy();
    expect(screen.queryByText("a\tb")).toBeNull();
  });

  it("preserves UTF-8 characters split across URL byte chunks", async () => {
    const text = "name\ncaf\u00e9";
    const splitAt = new TextEncoder().encode(text).length - 1;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(csvByteStreamResponse(text, splitAt))),
    );

    render(
      <CsvViewer
        source={{ kind: "url", url: "/utf8.csv", fileName: "utf8.csv" }}
        controls={false}
      />,
    );

    expect(await screen.findByText("caf\u00e9")).toBeTruthy();
  });

  it("renders retryable URL errors and retries the same source", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("a,b\nretry,ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CsvViewer
        source={{ kind: "url", url: "/broken.csv", fileName: "broken.csv" }}
      />,
    );

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("ok")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders fetch rejections as retryable URL errors", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(response("a,b\nretry,ok"));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CsvViewer
        source={{ kind: "url", url: "/network.csv", fileName: "network.csv" }}
      />,
    );

    expect(await screen.findByText("Couldn't load this file.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("ok")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders unsupported URL stream bodies without retrying derived export", async () => {
    const { createObjectURL } = mockObjectUrls();
    captureAnchorClicks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
    );

    render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/empty-body.csv",
          fileName: "empty-body.csv",
        }}
      />,
    );

    expect(
      await screen.findByText("This source cannot be previewed here."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

    openDownloadMenu();

    const exportItem = await screen.findByText("Export table");
    expect(
      exportItem.closest('[role="menuitem"]')?.getAttribute("aria-disabled"),
    ).toBe("true");

    fireEvent.click(exportItem);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("treats HTTP 204 URL responses as empty CSV files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );

    render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/no-content.csv",
          fileName: "no-content.csv",
        }}
      />,
    );

    expect(
      await screen.findByText("No rows", {}, { timeout: 3000 }),
    ).toBeTruthy();
    expect(screen.getByText("0 rows")).toBeTruthy();
    expect(screen.getByText("0 columns")).toBeTruthy();
    expect(
      screen.queryByText("This source cannot be previewed here."),
    ).toBeNull();
  });

  it("treats HTTP 205 URL responses as empty CSV files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 205 }))),
    );

    render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/reset-content.csv",
          fileName: "reset-content.csv",
        }}
      />,
    );

    expect(
      await screen.findByText("No rows", {}, { timeout: 3000 }),
    ).toBeTruthy();
    expect(screen.getByText("0 rows")).toBeTruthy();
    expect(screen.getByText("0 columns")).toBeTruthy();
    expect(
      screen.queryByText("This source cannot be previewed here."),
    ).toBeNull();
  });

  it("does not reload URL CSV content when only presentation metadata changes", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("a,b\n1,2")));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/stable.csv",
          fileName: "first.csv",
        }}
      />,
    );

    expect(await screen.findByText("2")).toBeTruthy();

    rerender(
      <CsvViewer
        source={{
          kind: "url",
          url: "/stable.csv",
          fileName: "second.csv",
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("keeps URL sort state when only presentation metadata changes", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("name\nz\na")));
    vi.stubGlobal("fetch", fetchMock);

    const { container, rerender } = render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/stable-sort.csv",
          fileName: "first.csv",
        }}
      />,
    );

    expect(await screen.findByText("z")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Sort by name"));
    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["a"]);

    rerender(
      <CsvViewer
        source={{
          kind: "url",
          url: "/stable-sort.csv",
          fileName: "second.csv",
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["a"]);
  });

  it("updates URL export filenames when only presentation metadata changes", async () => {
    const { createObjectURL } = mockObjectUrls();
    const clicks = captureAnchorClicks();
    const fetchMock = vi.fn(() => Promise.resolve(response("a,b\n1,2")));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/stable-name.csv",
          fileName: "first.csv",
        }}
      />,
    );

    expect(await screen.findByText("2")).toBeTruthy();

    rerender(
      <CsvViewer
        source={{
          kind: "url",
          url: "/stable-name.csv",
          fileName: "second.csv",
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    openDownloadMenu();
    fireEvent.click(await screen.findByText("Export table"));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(clicks).toEqual([
      { href: "blob:csv-download", download: "second.csv" },
    ]);
  });

  it("bypasses the browser cache for URL CSV reads", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("a,b\n1,2")));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/cache-sensitive.csv",
          fileName: "cache-sensitive.csv",
        }}
      />,
    );

    expect(await screen.findByText("2")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/cache-sensitive.csv", {
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  });

  it("ignores stale URL loads after the source changes", async () => {
    const slow = deferred<Response>();
    const fetchMock = vi.fn((url: string) => {
      if (url === "/slow.csv") return slow.promise;
      return Promise.resolve(response("a,b\nnext,file"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CsvViewer
        source={{ kind: "url", url: "/slow.csv", fileName: "slow.csv" }}
      />,
    );

    rerender(
      <CsvViewer
        source={{ kind: "url", url: "/next.csv", fileName: "next.csv" }}
      />,
    );

    expect(await screen.findByText("file")).toBeTruthy();

    slow.resolve(response("a,b\nstale,value"));
    await waitFor(() => expect(screen.queryByText("stale")).toBeNull());
  });

  it("ignores stale URL rejections after the source changes", async () => {
    const slow = deferred<Response>();
    const fetchMock = vi.fn((url: string) => {
      if (url === "/slow-error.csv") return slow.promise;
      return Promise.resolve(response("a,b\nfresh,value"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/slow-error.csv",
          fileName: "slow-error.csv",
        }}
      />,
    );

    rerender(
      <CsvViewer
        source={{ kind: "url", url: "/fresh.csv", fileName: "fresh.csv" }}
      />,
    );

    expect(await screen.findByText("fresh")).toBeTruthy();

    slow.reject(new Error("stale failure"));
    await waitFor(() => {
      expect(screen.queryByText("Couldn't load this file.")).toBeNull();
    });
  });

  it("disables derived export and clears rows when switching from loaded URL data to a pending URL", async () => {
    const pending = deferred<Response>();
    const { createObjectURL } = mockObjectUrls();
    captureAnchorClicks();
    const fetchMock = vi.fn((url: string) => {
      if (url === "/next.csv") return pending.promise;
      return Promise.resolve(response("id,label\n2,two\n1,one"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CsvViewer
        source={{ kind: "url", url: "/first.csv", fileName: "first.csv" }}
      />,
    );

    expect(await screen.findByText("two")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(screen.getByText("one")).toBeTruthy();

    rerender(
      <CsvViewer
        source={{ kind: "url", url: "/next.csv", fileName: "next.csv" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/0 rows.*loading/)).toBeTruthy();
    });
    expect(screen.queryByText("one")).toBeNull();
    expect(screen.queryByText("two")).toBeNull();

    openDownloadMenu();
    const exportItem = await screen.findByText("Export table");
    expect(
      exportItem.closest('[role="menuitem"]')?.getAttribute("aria-disabled"),
    ).toBe("true");

    fireEvent.click(exportItem);
    expect(createObjectURL).not.toHaveBeenCalled();

    pending.resolve(response("id,label\nfresh,value"));
    expect(await screen.findByText("fresh")).toBeTruthy();
  });

  it("recovers from a URL error when switching to a table source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("", { status: 500 }))),
    );

    const { rerender } = render(
      <CsvViewer
        source={{ kind: "url", url: "/broken.csv", fileName: "broken.csv" }}
      />,
    );

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();

    rerender(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a", "b"],
            rows: [["recovered", "table"]],
          },
        }}
      />,
    );

    expect(screen.getByText("recovered")).toBeTruthy();
    expect(screen.queryByText("Failed to load file: 500.")).toBeNull();
  });

  it("pads already streamed row batches when a later URL row widens the table", async () => {
    const firstBatch = Array.from(
      { length: 5000 },
      (_, index) => `${index + 1},value-${index + 1}`,
    ).join("\n");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          csvStreamResponse([`a,b\n${firstBatch}\n`, "wide,row,extra"]),
        ),
      ),
    );

    const { container } = render(
      <CsvViewer
        source={{
          kind: "url",
          url: "/wide-late.csv",
          fileName: "wide-late.csv",
        }}
        controls={false}
      />,
    );

    expect(await screen.findByTitle("Sort by Column 3")).toBeTruthy();
    await waitFor(() => {
      expect(csvRows(container).length).toBeGreaterThan(0);
    });

    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["1", "value-1", ""]);
    expect(screen.queryByText("extra")).toBeNull();
  });
});

describe("CsvViewer Blob source loading", () => {
  it("parses Blob resources through the source boundary", async () => {
    render(
      <CsvViewer
        source={csvBlobSource("a,b\n1,2", "csv:blob-test")}
        controls={false}
      />,
    );

    expect(await screen.findByText("b")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("clears sort state when a same-identity Blob source has new content", async () => {
    const { container, rerender } = render(
      <CsvViewer
        source={csvBlobSource("id,label\n2,two\n1,one", "csv:same-blob-id")}
        controls={false}
      />,
    );

    expect(await screen.findByText("two")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Sort by id"));
    expect(csvRows(container)[0]?.textContent).toContain("21one");

    rerender(
      <CsvViewer
        source={csvBlobSource(
          "id,label\nb,native-first\na,native-second",
          "csv:same-blob-id",
        )}
        controls={false}
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByTitle("Sort by id")
          .closest('[role="columnheader"]')
          ?.getAttribute("aria-sort"),
      ).toBe("none");
    });
    expect(csvRows(container)[0]?.textContent).toContain("1bnative-first");
  });

  it("parses Blob resources through a successful worker path", async () => {
    const terminate = vi.fn();
    class SuccessfulWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      postMessage(request: { parseRequestId: string }) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              type: "columns",
              parseRequestId: request.parseRequestId,
              columns: ["a", "b"],
            },
          } as MessageEvent);
          this.onmessage?.({
            data: {
              type: "sourceRows",
              parseRequestId: request.parseRequestId,
              sourceRows: [["worker", "ok"]],
            },
          } as MessageEvent);
          this.onmessage?.({
            data: {
              type: "done",
              parseRequestId: request.parseRequestId,
            },
          } as MessageEvent);
        });
      }

      terminate = terminate;
    }

    vi.stubGlobal("Worker", SuccessfulWorker);

    render(
      <CsvViewer
        source={csvBlobSource("ignored", "csv:worker-success")}
        controls={false}
      />,
    );

    expect(await screen.findByText("ok")).toBeTruthy();
    expect(screen.getByText("worker")).toBeTruthy();
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("parses large text resources through the worker path", async () => {
    let postedSource: unknown = null;

    class SuccessfulTextWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      postMessage(request: { parseRequestId: string; source: Blob }) {
        postedSource = request.source;
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              type: "columns",
              parseRequestId: request.parseRequestId,
              columns: ["a", "b"],
            },
          } as MessageEvent);
          this.onmessage?.({
            data: {
              type: "sourceRows",
              parseRequestId: request.parseRequestId,
              sourceRows: [["large-text", "worker"]],
            },
          } as MessageEvent);
          this.onmessage?.({
            data: {
              type: "done",
              parseRequestId: request.parseRequestId,
            },
          } as MessageEvent);
        });
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", SuccessfulTextWorker);

    render(
      <CsvViewer
        source={{
          kind: "text",
          text: `a,b\n${"1,2\n".repeat(80_000)}`,
          fileName: "large-text.csv",
        }}
        controls={false}
      />,
    );

    expect(await screen.findByText("large-text")).toBeTruthy();
    expect(screen.getByText("worker")).toBeTruthy();
    expect(postedSource).toBeInstanceOf(Blob);
  });

  it("pads worker rows that were emitted before a later column-widening event", async () => {
    class WideningWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      postMessage(request: { parseRequestId: string }) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              type: "columns",
              parseRequestId: request.parseRequestId,
              columns: ["a", "b"],
            },
          } as MessageEvent);
          this.onmessage?.({
            data: {
              type: "sourceRows",
              parseRequestId: request.parseRequestId,
              sourceRows: [["first", "row"]],
            },
          } as MessageEvent);
          this.onmessage?.({
            data: {
              type: "columns",
              parseRequestId: request.parseRequestId,
              columns: ["a", "b", ""],
            },
          } as MessageEvent);
          this.onmessage?.({
            data: {
              type: "sourceRows",
              parseRequestId: request.parseRequestId,
              sourceRows: [["wide", "row", "extra"]],
            },
          } as MessageEvent);
          this.onmessage?.({
            data: {
              type: "done",
              parseRequestId: request.parseRequestId,
            },
          } as MessageEvent);
        });
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", WideningWorker);

    const { container } = render(
      <CsvViewer
        source={csvBlobSource("ignored", "csv:worker-widen")}
        controls={false}
      />,
    );

    expect(await screen.findByTitle("Sort by Column 3")).toBeTruthy();
    await waitFor(() => {
      expect(csvRows(container)).toHaveLength(2);
    });

    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["first", "row", ""]);
    expect(
      csvCells(csvRows(container)[1]!).map((cell) => cell.textContent),
    ).toEqual(["wide", "row", "extra"]);
  });

  it("falls back to main-thread parsing when Worker construction fails", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("workers disabled");
        }
      },
    );

    render(
      <CsvViewer
        source={csvBlobSource("a,b\nfallback,ok", "csv:worker-fallback")}
        controls={false}
      />,
    );

    expect(await screen.findByText("ok")).toBeTruthy();
    expect(screen.getByText("fallback")).toBeTruthy();
  });

  it("maps CSV boundary failures through the canonical CSV mapper", () => {
    const parseError = toCsvFormatError(new Error("bad table"));

    expect(parseError).toBeInstanceOf(ViewerFormatError);
    expect(parseError).toMatchObject({
      format: "csv",
      kind: "parse_failed",
    });
    expect((parseError as ViewerFormatError).cause).toBeInstanceOf(Error);

    const existing = new ViewerFormatError({
      format: "csv",
      kind: "worker_failed",
      message: "Worker failed.",
    });
    expect(
      toCsvFormatError(existing, {
        kind: "parse_failed",
        message: "ignored",
      }),
    ).toBe(existing);
  });

  it("renders worker parse failures as CSV format errors", async () => {
    class FailingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      postMessage(request: { parseRequestId: string }) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              type: "error",
              parseRequestId: request.parseRequestId,
              message: "worker parse failed",
            },
          } as MessageEvent);
        });
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", FailingWorker);

    render(
      <CsvViewer
        source={csvBlobSource("a,b\n1,2", "csv:worker-error")}
        controls={false}
      />,
    );

    expect(await screen.findByText("Couldn't parse this table.")).toBeTruthy();
    expect(screen.getByRole("alert").getAttribute("data-error-domain")).toBe(
      "format",
    );
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "parse_failed",
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("renders worker crashes as CSV worker format errors", async () => {
    class CrashingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      postMessage() {
        queueMicrotask(() => {
          this.onerror?.();
        });
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", CrashingWorker);

    render(
      <CsvViewer
        source={csvBlobSource("a,b\n1,2", "csv:worker-crash")}
        controls={false}
      />,
    );

    expect(await screen.findByText("Couldn't parse this table.")).toBeTruthy();
    expect(screen.getByRole("alert").getAttribute("data-error-domain")).toBe(
      "format",
    );
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "worker_failed",
    );
  });

  it("ignores stale worker messages after switching Blob sources", async () => {
    const workers: Array<{
      request?: { parseRequestId: string };
      onmessage: ((event: MessageEvent) => void) | null;
      terminated: boolean;
      terminate: () => void;
    }> = [];

    class ControlledWorker {
      request?: { parseRequestId: string };
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      terminated = false;

      constructor() {
        workers.push(this);
      }

      postMessage(request: { parseRequestId: string }) {
        this.request = request;
      }

      terminate = () => {
        this.terminated = true;
      };
    }

    vi.stubGlobal("Worker", ControlledWorker);

    const { rerender } = render(
      <CsvViewer
        source={csvBlobSource("old", "csv:old-worker")}
        controls={false}
      />,
    );

    await waitFor(() => expect(workers[0]?.request).toBeTruthy());

    rerender(
      <CsvViewer
        source={csvBlobSource("new", "csv:new-worker")}
        controls={false}
      />,
    );

    await waitFor(() => expect(workers[1]?.request).toBeTruthy());
    workers[1]!.onmessage?.({
      data: {
        type: "columns",
        parseRequestId: workers[1]!.request!.parseRequestId,
        columns: ["a", "b"],
      },
    } as MessageEvent);
    workers[1]!.onmessage?.({
      data: {
        type: "sourceRows",
        parseRequestId: workers[1]!.request!.parseRequestId,
        sourceRows: [["fresh", "value"]],
      },
    } as MessageEvent);
    workers[1]!.onmessage?.({
      data: {
        type: "done",
        parseRequestId: workers[1]!.request!.parseRequestId,
      },
    } as MessageEvent);

    expect(await screen.findByText("fresh")).toBeTruthy();

    workers[0]!.onmessage?.({
      data: {
        type: "columns",
        parseRequestId: workers[0]!.request!.parseRequestId,
        columns: ["stale"],
      },
    } as MessageEvent);
    workers[0]!.onmessage?.({
      data: {
        type: "sourceRows",
        parseRequestId: workers[0]!.request!.parseRequestId,
        sourceRows: [["stale"]],
      },
    } as MessageEvent);
    workers[0]!.onmessage?.({
      data: {
        type: "done",
        parseRequestId: workers[0]!.request!.parseRequestId,
      },
    } as MessageEvent);

    await waitFor(() => expect(screen.queryByText("stale")).toBeNull());
    expect(workers[0]!.terminated).toBe(true);
  });
});

describe("CsvViewer resource precedence", () => {
  it("resolves document sources, table sources, then empty", () => {
    const resource = createViewerResource(
      blobSource(new Blob(["source"]), {
        identityKey: "csv:test",
        fileName: "file.csv",
        mimeType: "text/csv",
      }),
    );
    const table = { columns: ["a"], rows: [["data"]] };

    expect(resolveCsvResource({ resource }).kind).toBe("resource");
    expect(
      resolveCsvResource({
        source: { kind: "table", table, fileName: "data.csv" },
      }),
    ).toEqual({
      kind: "table",
      table,
      fileName: "data.csv",
    });
    expect(resolveCsvResource({}).kind).toBe("empty");
  });

  it("treats text resources as synchronous values", () => {
    const resource = createViewerResource({
      kind: "text",
      text: "a,b\n1,2",
      fileName: "inline.csv",
    });

    expect(resolveCsvResource({ resource })).toEqual({
      kind: "text",
      text: "a,b\n1,2",
    });
  });
});

describe("CsvViewer download names", () => {
  it("uses dialect-only generated names for parsed data downloads", () => {
    expect(defaultCsvDownloadName({ delimiter: ",", hasHeader: true })).toBe(
      "data.csv",
    );
    expect(defaultCsvDownloadName({ delimiter: "\t", hasHeader: true })).toBe(
      "data.tsv",
    );
    expect(defaultCsvDownloadName({ delimiter: "\\t", hasHeader: true })).toBe(
      "data.tsv",
    );
  });

  it("exports escaped-tab dialects with real tab delimiters and TSV metadata", () => {
    const action = createCsvExportAction({
      columns: ["a", "b"],
      sourceRows: [["1", "2"]],
      dialect: { delimiter: "\\t", hasHeader: true },
      fileName: defaultCsvDownloadName({
        delimiter: "\\t",
        hasHeader: true,
      }),
    });

    expect(action.fileName).toBe("data.tsv");
    expect(action.getPayload()).toEqual({
      kind: "text",
      text: "a\tb\r\n1\t2",
      mimeType: "text/tab-separated-values;charset=utf-8",
    });
  });

  it("exports TSV table sources with generated TSV names and MIME type", async () => {
    const { createObjectURL } = mockObjectUrls();
    const clicks = captureAnchorClicks();

    render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a", "b"],
            rows: [["1", "2"]],
          },
          dialect: { delimiter: "\t", hasHeader: true },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export table" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a\tb\r\n1\t2");
    expect(blob.type).toBe("text/tab-separated-values;charset=utf-8");
    expect(clicks).toEqual([
      { href: "blob:csv-download", download: "data.tsv" },
    ]);
  });

  it("lets the viewer-level dialect override the table source dialect for exports", async () => {
    const { createObjectURL } = mockObjectUrls();
    const clicks = captureAnchorClicks();

    render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a", "b"],
            rows: [["1", "2"]],
          },
          dialect: { delimiter: "\t", hasHeader: true },
        }}
        dialect={{ delimiter: ",", hasHeader: true }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export table" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a,b\r\n1,2");
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(clicks).toEqual([
      { href: "blob:csv-download", download: "data.csv" },
    ]);
  });

  it("exports parsed empty tables after loading completes", async () => {
    const { createObjectURL } = mockObjectUrls();
    captureAnchorClicks();

    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a,b\n",
          fileName: "empty.csv",
        }}
      />,
    );

    expect(screen.getByText("No rows")).toBeTruthy();
    openDownloadMenu();
    const exportItem = await screen.findByText("Export table");
    expect(
      exportItem.closest('[role="menuitem"]')?.getAttribute("aria-disabled"),
    ).toBeNull();
    fireEvent.click(exportItem);

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a,b");
  });

  it("exports inline TSV document sources with inferred TSV content and MIME type", async () => {
    const { createObjectURL } = mockObjectUrls();
    const clicks = captureAnchorClicks();

    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a\tb\n1\t2",
          fileName: "inline.tsv",
        }}
      />,
    );

    openDownloadMenu();
    fireEvent.click(await screen.findByText("Export table"));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a\tb\r\n1\t2");
    expect(blob.type).toBe("text/tab-separated-values;charset=utf-8");
    expect(clicks).toEqual([
      { href: "blob:csv-download", download: "inline.tsv" },
    ]);
  });

  it("exports loaded URL TSV sources with inferred TSV content and filename", async () => {
    const { createObjectURL } = mockObjectUrls();
    const clicks = captureAnchorClicks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("a\tb\n1\t2"))),
    );

    render(
      <CsvViewer
        source={{ kind: "url", url: "/report.tsv", fileName: "report.tsv" }}
      />,
    );

    expect(await screen.findByText("2")).toBeTruthy();

    openDownloadMenu();
    fireEvent.click(await screen.findByText("Export table"));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a\tb\r\n1\t2");
    expect(blob.type).toBe("text/tab-separated-values;charset=utf-8");
    expect(clicks).toEqual([
      { href: "blob:csv-download", download: "report.tsv" },
    ]);
  });

  it("downloads the original URL source without materializing a derived blob", async () => {
    const { createObjectURL } = mockObjectUrls();
    const clicks = captureAnchorClicks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("a,b\n1,2"))),
    );

    render(
      <CsvViewer
        source={{ kind: "url", url: "/original.csv", fileName: "original.csv" }}
      />,
    );

    openDownloadMenu();
    fireEvent.click(await screen.findByText("Download original"));

    await waitFor(() => {
      expect(clicks).toEqual([
        { href: "/original.csv", download: "original.csv" },
      ]);
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("downloads the original Blob source from the document menu", async () => {
    const { createObjectURL, revokeObjectURL } =
      mockObjectUrls("blob:original");
    const clicks = captureAnchorClicks();

    render(
      <CsvViewer source={csvBlobSource("a,b\n1,2", "csv:original-blob")} />,
    );

    openDownloadMenu();
    fireEvent.click(await screen.findByText("Download original"));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a,b\n1,2");
    expect(clicks).toEqual([
      { href: "blob:original", download: "csv:original-blob.csv" },
    ]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:original");
  });

  it("exports parsed table sources through the shared derived action", async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrls();
    const clicks = captureAnchorClicks();

    render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a", "b"],
            rows: [["1", "2"]],
          },
          fileName: "table.csv",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Export table" })).toBeTruthy();
    expect(createObjectURL).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Export table" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a,b\r\n1,2");
    expect(clicks).toEqual([
      { href: "blob:csv-download", download: "table.csv" },
    ]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv-download");
  });

  it("exports fields that need CSV escaping without corrupting cell boundaries", async () => {
    const { createObjectURL } = mockObjectUrls();
    captureAnchorClicks();

    render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["name", "notes", "empty"],
            rows: [["A, B", 'she said "hi"\nthen left', ""]],
          },
          fileName: "escaped.csv",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export table" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe(
      'name,notes,empty\r\n"A, B","she said ""hi""\nthen left",',
    );
  });

  it("exports ragged table sources with the same padded shape shown in the grid", async () => {
    const { createObjectURL } = mockObjectUrls();
    captureAnchorClicks();

    const { container } = render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a", "b", "c"],
            rows: [["1"], ["2", "3", "4", "hidden"]],
          },
          fileName: "ragged-table.csv",
        }}
      />,
    );

    expect(
      csvCells(csvRows(container)[0]!).map((cell) => cell.textContent),
    ).toEqual(["1", "", ""]);

    fireEvent.click(screen.getByRole("button", { name: "Export table" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a,b,c\r\n1,,\r\n2,3,4");
  });

  it("offers original and derived actions for document sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("a,b\n1,2", { status: 200 }))),
    );

    render(
      <CsvViewer
        source={{ kind: "url", url: "/report.csv", fileName: "report.csv" }}
      />,
    );

    expect(await screen.findByText("b")).toBeTruthy();

    openDownloadMenu();

    expect(await screen.findByText("Download original")).toBeTruthy();
    expect(within(document.body).getByText("Export table")).toBeTruthy();
  });

  it("does not allow derived exports while URL parsing is still loading", async () => {
    const pending = deferred<Response>();
    const { createObjectURL } = mockObjectUrls();
    captureAnchorClicks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise),
    );

    render(
      <CsvViewer
        source={{ kind: "url", url: "/loading.csv", fileName: "loading.csv" }}
      />,
    );

    openDownloadMenu();

    const exportItem = await screen.findByText("Export table");
    expect(
      exportItem.closest('[role="menuitem"]')?.getAttribute("aria-disabled"),
    ).toBe("true");

    fireEvent.click(exportItem);
    expect(createObjectURL).not.toHaveBeenCalled();

    pending.resolve(response("a,b\n1,2"));
    expect(await screen.findByText("2")).toBeTruthy();

    await waitFor(() => {
      expect(
        exportItem.closest('[role="menuitem"]')?.getAttribute("aria-disabled"),
      ).toBeNull();
    });

    fireEvent.click(exportItem);

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("a,b\r\n1,2");
  });

  it("does not allow derived exports after URL loading fails", async () => {
    const { createObjectURL } = mockObjectUrls();
    captureAnchorClicks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("", { status: 500 }))),
    );

    render(
      <CsvViewer
        source={{ kind: "url", url: "/broken.csv", fileName: "broken.csv" }}
      />,
    );

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();

    openDownloadMenu();

    const exportItem = await screen.findByText("Export table");
    expect(
      exportItem.closest('[role="menuitem"]')?.getAttribute("aria-disabled"),
    ).toBe("true");

    fireEvent.click(exportItem);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
