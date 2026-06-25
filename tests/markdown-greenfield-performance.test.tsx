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
import { createMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/markdown-greenfield-document";

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "large.md",
    mimeType: "text/markdown",
    text,
  };
}

function inlinePx(value: string) {
  return Number.parseFloat(value.replace("px", ""));
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

describe("pretext markdown greenfield performance boundaries", () => {
  it("keeps rendered mode mounted chunks bounded for long documents", () => {
    const markdown = Array.from({ length: 180 }, (_, index) =>
      [
        `## Section ${index + 1}`,
        "",
        `This is paragraph ${index + 1} with enough text to produce realistic source lines while staying cheap in unit tests.`,
        "",
        `- item ${index + 1}.1`,
        `- item ${index + 1}.2`,
      ].join("\n"),
    ).join("\n\n");
    const model = createMarkdownGreenfieldDocument(markdown);
    const { container } = render(
      <MarkdownViewer source={markdownSource(markdown)} />,
    );
    const mountedChunks = container.querySelectorAll("[data-markdown-chunk]");

    expect(model.chunks.length).toBeGreaterThan(12);
    expect(mountedChunks.length).toBeGreaterThan(0);
    expect(mountedChunks.length).toBeLessThan(model.chunks.length);
    expect(mountedChunks.length).toBeLessThanOrEqual(8);
  });

  it("renders Markdown chunks inside a buffered inverse-sticky window", () => {
    const markdown = Array.from({ length: 180 }, (_, index) =>
      [`## Section ${index + 1}`, "", `Paragraph ${index + 1}.`].join("\n"),
    ).join("\n\n");
    const { container } = render(
      <MarkdownViewer controls={false} source={markdownSource(markdown)} />,
    );
    const canvas = container.querySelector<HTMLElement>(
      '[data-slot="markdown-virtual-canvas"]',
    );
    const beforeBuffer = container.querySelector<HTMLElement>(
      '[data-slot="markdown-sticky-before-buffer"]',
    );
    const stickyWindow = container.querySelector<HTMLElement>(
      '[data-slot="markdown-sticky-window"]',
    );
    const stickyContent = container.querySelector<HTMLElement>(
      '[data-slot="markdown-sticky-content"]',
    );
    const afterBuffer = container.querySelector<HTMLElement>(
      '[data-slot="markdown-sticky-after-buffer"]',
    );

    expect(beforeBuffer).toBeTruthy();
    expect(stickyWindow).toBeTruthy();
    expect(stickyContent).toBeTruthy();
    expect(afterBuffer).toBeTruthy();
    expect(beforeBuffer?.style.contain).toBe("layout size");
    expect(stickyWindow?.style.position).toBe("sticky");
    expect(stickyWindow?.style.contain).toBe("layout style inline-size");
    expect(stickyWindow?.style.display).toBe("flex");
    expect(stickyWindow?.style.flexDirection).toBe("column");
    expect(stickyWindow?.style.isolation).toBe("isolate");
    expect(stickyWindow?.style.marginTop).toBe("");
    expect(stickyWindow?.style.top).toBe(stickyWindow?.style.bottom);
    expect(stickyWindow?.style.height).toBe(stickyContent?.style.height);
    expect(afterBuffer?.style.contain).toBe("layout size");

    const beforeHeight = inlinePx(beforeBuffer!.style.height);
    const stickyHeight = inlinePx(stickyWindow!.style.height);
    const afterHeight = inlinePx(afterBuffer!.style.height);
    const canvasHeight = inlinePx(canvas!.style.height);
    const stickyOffset = inlinePx(stickyWindow!.style.top);

    expect(beforeHeight).toBeGreaterThan(0);
    expect(stickyHeight).toBeGreaterThan(640);
    expect(afterHeight).toBeGreaterThan(0);
    expect(beforeHeight + stickyHeight + afterHeight).toBeCloseTo(
      canvasHeight,
      3,
    );
    expect(stickyOffset).toBe(-(stickyHeight - 640));
  });

  it("renders huge code fences as copyable virtualized hostile previews", () => {
    const code = Array.from(
      { length: 460 },
      (_, index) => `console.log(${index + 1})`,
    ).join("\n");
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(["```ts", code, "```"].join("\n"))}
      />,
    );
    const fallback = container.querySelector<HTMLElement>(
      "[data-markdown-hostile-fallback]",
    );

    expect(fallback).toBeTruthy();
    expect(fallback?.getAttribute("data-markdown-hostile-line-count")).toBe(
      "462",
    );
    expect(
      Number(fallback?.getAttribute("data-markdown-hostile-omitted-lines")),
    ).toBeGreaterThan(0);
    expect(fallback?.getAttribute("data-markdown-hostile-virtualized")).toBe(
      "",
    );
    expect(
      Number(fallback?.getAttribute("data-markdown-hostile-mounted-lines")),
    ).toBeLessThan(120);
    expect(
      container.querySelector('[data-markdown-hostile-line="1"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-markdown-hostile-line="260"]'),
    ).toBeNull();

    const preview = screen.getByRole("region", {
      name: "Large Markdown source preview",
    });
    preview.scrollTop = 260 * 24;
    fireEvent.scroll(preview);

    expect(
      container.querySelector('[data-markdown-hostile-line="260"]'),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Copy large Markdown block source" }),
    ).toBeTruthy();
  });

  it("renders huge simple GFM tables as bounded virtual tables", () => {
    const header = "| " + ["A", "B", "C", "D", "E", "F"].join(" | ") + " |";
    const divider =
      "| " + Array.from({ length: 6 }, () => "---").join(" | ") + " |";
    const rows = Array.from({ length: 360 }, (_, rowIndex) => {
      const cells = Array.from(
        { length: 6 },
        (_, columnIndex) => `r${rowIndex + 1}c${columnIndex + 1}`,
      );
      return "| " + cells.join(" | ") + " |";
    });
    const markdown = [header, divider, ...rows].join("\n");
    const model = createMarkdownGreenfieldDocument(markdown);
    const { container } = render(
      <MarkdownViewer controls={false} source={markdownSource(markdown)} />,
    );
    const table = container.querySelector<HTMLElement>(
      "[data-markdown-table-virtualized]",
    );

    expect(model.blocks).toHaveLength(1);
    expect(model.blocks[0]?.kind).toBe("table");
    expect(model.blocks[0]?.isHostile).toBe(false);
    expect(
      container.querySelector("[data-markdown-hostile-fallback]"),
    ).toBeNull();
    expect(table).toBeTruthy();
    expect(table?.getAttribute("aria-rowcount")).toBe("361");
    expect(table?.getAttribute("aria-colcount")).toBe("6");
    expect(
      Number(table?.getAttribute("data-markdown-table-mounted-rows")),
    ).toBeLessThan(80);
    expect(
      container.querySelector("[data-markdown-table-spacer-row]"),
    ).toBeTruthy();
  });

  it("renders deeply nested raw HTML as a bounded hostile preview", () => {
    const nestedOpen = Array.from(
      { length: 96 },
      (_, index) => `<div id="layer-${index + 1}">`,
    ).join("");
    const nestedClose = "</div>".repeat(96);
    const markdown = `${nestedOpen}Deep content${nestedClose}`;
    const model = createMarkdownGreenfieldDocument(markdown);
    const { container } = render(
      <MarkdownViewer controls={false} source={markdownSource(markdown)} />,
    );

    expect(model.blocks).toHaveLength(1);
    expect(model.blocks[0]?.kind).toBe("html");
    expect(model.blocks[0]?.isHostile).toBe(true);
    expect(
      container.querySelector("[data-markdown-hostile-fallback]"),
    ).toBeTruthy();
    expect(container.querySelector("#user-content-layer-96")).toBeNull();
  });

  it("keys measured heights by scale-sensitive layout identity", async () => {
    const { container } = render(
      <MarkdownViewer
        source={markdownSource(
          [
            "# Measured Layout",
            "",
            "This paragraph is long enough to produce a mounted virtual chunk with a measurable rendered frame.",
          ].join("\n"),
        )}
      />,
    );
    const firstKey = container
      .querySelector("[data-pretext-measured-height-key]")
      ?.getAttribute("data-pretext-measured-height-key");

    expect(firstKey).toContain(":1.0000:");

    fireEvent.click(screen.getByLabelText("Zoom in"));

    await waitFor(() => {
      const nextKey = container
        .querySelector("[data-pretext-measured-height-key]")
        ?.getAttribute("data-pretext-measured-height-key");

      expect(nextKey).toContain(":1.2000:");
      expect(nextKey).not.toBe(firstKey);
    });
  });
});
