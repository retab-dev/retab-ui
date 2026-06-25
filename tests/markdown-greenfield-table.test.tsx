// @vitest-environment jsdom

import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownViewer } from "@/components/ui/markdown-viewer";

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "tables.md",
    mimeType: "text/markdown",
    text,
  };
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("pretext markdown greenfield tables", () => {
  it("renders GFM tables with a visible TSV copy control", () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "| Name | Qty | Note |",
            "| :--- | --: | :--- |",
            "| Alpha | 2 | **ready** |",
            "| Pipe | 3 | a \\| b |",
          ].join("\n"),
        )}
      />,
    );

    const region = screen.getByRole("region", { name: "Markdown table" });
    const table = container.querySelector("[data-markdown-table]");

    expect(region.getAttribute("data-markdown-table-region")).toBe("");
    expect(table?.getAttribute("aria-colcount")).toBe("3");
    expect(table?.getAttribute("aria-rowcount")).toBe("3");
    expect(
      screen.getByRole("columnheader", { name: "Qty" }).getAttribute("align"),
    ).toBe("right");
    expect(
      screen.getByRole("columnheader", { name: "Qty" }).getAttribute("id"),
    ).toBe("markdown-table-1-column-2");
    expect(
      screen.getByRole("cell", { name: "2" }).getAttribute("headers"),
    ).toBe("markdown-table-1-column-2");

    fireEvent.click(screen.getByRole("button", { name: "Copy table as TSV" }));

    expect(writeText).toHaveBeenCalledWith(
      ["Name\tQty\tNote", "Alpha\t2\tready", "Pipe\t3\ta | b"].join("\n"),
    );
  });

  it("reserves an inner width floor for wide tables instead of shrinking the page", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "| Area | Status | Owner | Risk | Notes |",
            "| :--- | :---: | ---: | ---: | --- |",
            "| Layout | Ready | Platform | Low | Continuous virtual flow. |",
          ].join("\n"),
        )}
      />,
    );

    const table = container.querySelector<HTMLElement>("[data-markdown-table]");
    const scroller = container.querySelector<HTMLElement>(
      "[data-markdown-table-scroll]",
    );
    const region = screen.getByRole("region", { name: "Markdown table" });

    expect(table?.style.minWidth).toBe("800px");
    expect(scroller).toBeTruthy();

    Object.defineProperty(scroller, "clientWidth", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(scroller, "scrollWidth", {
      configurable: true,
      value: 800,
    });
    fireEvent.keyDown(region, { key: "ArrowRight" });

    expect(scroller?.scrollLeft).toBe(50);
  });

  it("virtualizes large tables while preserving copy and native find reveal", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const header = "| " + ["A", "B", "C", "D"].join(" | ") + " |";
    const divider =
      "| " + Array.from({ length: 4 }, () => "---").join(" | ") + " |";
    const rows = Array.from({ length: 140 }, (_, rowIndex) => {
      const cells = Array.from(
        { length: 4 },
        (_, columnIndex) => `r${rowIndex + 1}c${columnIndex + 1}`,
      );
      return "| " + cells.join(" | ") + " |";
    });
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource([header, divider, ...rows].join("\n"))}
      />,
    );
    const table = container.querySelector<HTMLElement>(
      "[data-markdown-table-virtualized]",
    );
    const scroller = container.querySelector<HTMLElement>(
      "[data-markdown-table-scroll]",
    );

    expect(table).toBeTruthy();
    expect(table?.getAttribute("aria-rowcount")).toBe("141");
    expect(
      Number(table?.getAttribute("data-markdown-table-mounted-rows")),
    ).toBeLessThan(80);
    expect(screen.getByRole("cell", { name: "r1c1" })).toBeTruthy();
    expect(screen.queryByRole("cell", { name: "r120c3" })).toBeNull();

    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 144,
    });
    scroller!.scrollTop = 120 * 36;
    fireEvent.scroll(scroller!);

    await waitFor(() => {
      expect(screen.getByRole("cell", { name: "r120c3" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy table as TSV" }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("r140c1\tr140c2\tr140c3\tr140c4"),
    );

    const findEntry = Array.from(
      container.querySelectorAll<HTMLElement>(
        "[data-markdown-table-native-find-entry]",
      ),
    ).at(-1);
    expect(findEntry?.getAttribute("hidden")).toBe("until-found");

    fireEvent(findEntry!, new Event("beforematch"));

    expect(scroller?.scrollTop).toBe(136 * 36);
    await waitFor(() => {
      expect(screen.getByRole("cell", { name: "r140c4" })).toBeTruthy();
    });
  });
});
