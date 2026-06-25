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

import { ChenglouTextViewer } from "@/registry/new-york-v4/ui/text-viewer-chenglou";
import { clearPreparedTextDocumentCacheForTests } from "@/registry/new-york-v4/ui/text-viewer-layout";

function markdownSource(text: string) {
  return {
    fileName: "notes.md",
    kind: "text" as const,
    mimeType: "text/markdown",
    text,
  };
}

function viewport(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>(
    '[data-slot="scroll-area-viewport"]',
  );
  expect(element).toBeTruthy();
  return element as HTMLElement;
}

async function scrollNestedWindow(container: HTMLElement, top: number) {
  const element = viewport(container);
  element.scrollTop = top;
  fireEvent.scroll(element);
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function projectedElement(
  container: HTMLElement,
  slot: string,
  indexName: "lineIndex" | "rowIndex",
  index: number,
) {
  const attr = indexName === "lineIndex" ? "data-line-index" : "data-row-index";
  return await waitFor(() => {
    const element = container.querySelector<HTMLElement>(
      `[data-slot="${slot}"][${attr}="${index}"]`,
    );
    expect(element).toBeTruthy();
    return element as HTMLElement;
  });
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as CanvasRenderingContext2D);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    return window.setTimeout(() => callback(performance.now()), 0);
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
    window.clearTimeout(handle);
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn(() => Promise.resolve()),
    },
  });
});

afterEach(() => {
  cleanup();
  clearPreparedTextDocumentCacheForTests();
  vi.restoreAllMocks();
});

describe("Chenglou text viewer nested projection", () => {
  it("patches code lines without rebuilding code block chrome", async () => {
    const markdown = [
      "```ts",
      ...Array.from(
        { length: 160 },
        (_, index) => `const line${index} = ${index};`,
      ),
      "```",
    ].join("\n");
    const { container } = render(
      <ChenglouTextViewer
        controls={false}
        mode="markdown"
        source={markdownSource(markdown)}
      />,
    );

    const pre = await waitFor(() => {
      const element = container.querySelector("pre");
      expect(element).toBeTruthy();
      return element as HTMLPreElement;
    });
    const toolbar = screen.getByLabelText("Copy code block").parentElement;
    const line20 = await projectedElement(
      container,
      "text-code-line",
      "lineIndex",
      20,
    );

    await scrollNestedWindow(container, 600);

    await waitFor(() => {
      expect(container.querySelector("pre")).toBe(pre);
      expect(screen.getByLabelText("Copy code block").parentElement).toBe(
        toolbar,
      );
      expect(
        container.querySelector(
          '[data-slot="text-code-line"][data-line-index="20"]',
        ),
      ).toBe(line20);
      expect(
        container.querySelector(
          '[data-slot="text-code-line"][data-line-index="0"]',
        ),
      ).toBeNull();
    });
  });

  it("patches wrapped inline lines without rebuilding the inline line host", async () => {
    const markdown = Array.from(
      { length: 520 },
      (_, index) => `projection-word-${index}`,
    ).join(" ");
    const { container } = render(
      <ChenglouTextViewer
        controls={false}
        mode="markdown"
        source={markdownSource(markdown)}
      />,
    );

    const linesHost = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(
        '[data-slot="text-inline-lines"]',
      );
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    const line20 = await projectedElement(
      container,
      "text-inline-line",
      "lineIndex",
      20,
    );

    await scrollNestedWindow(container, 700);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="text-inline-lines"]')).toBe(
        linesHost,
      );
      expect(
        container.querySelector(
          '[data-slot="text-inline-line"][data-line-index="20"]',
        ),
      ).toBe(line20);
      expect(
        container.querySelector(
          '[data-slot="text-inline-line"][data-line-index="0"]',
        ),
      ).toBeNull();
    });
  });

  it("patches table body rows without rebuilding table chrome", async () => {
    const markdown = [
      "| Name | Value |",
      "| --- | ---: |",
      ...Array.from(
        { length: 140 },
        (_, index) => `| Row ${index} | ${index} |`,
      ),
    ].join("\n");
    const { container } = render(
      <ChenglouTextViewer
        controls={false}
        mode="markdown"
        source={markdownSource(markdown)}
      />,
    );

    const table = await waitFor(() => {
      const element = container.querySelector("table");
      expect(element).toBeTruthy();
      return element as HTMLTableElement;
    });
    const headerCell = table.querySelector("th");
    const copyButton = screen.getByLabelText("Copy table");
    const row20 = await projectedElement(
      container,
      "text-table-row",
      "rowIndex",
      20,
    );

    await scrollNestedWindow(container, 900);

    await waitFor(() => {
      expect(container.querySelector("table")).toBe(table);
      expect(table.querySelector("th")).toBe(headerCell);
      expect(screen.getByLabelText("Copy table")).toBe(copyButton);
      expect(
        container.querySelector(
          '[data-slot="text-table-row"][data-row-index="20"]',
        ),
      ).toBe(row20);
      expect(
        container.querySelector(
          '[data-slot="text-table-row"][data-row-index="0"]',
        ),
      ).toBeNull();
    });
  });
});
