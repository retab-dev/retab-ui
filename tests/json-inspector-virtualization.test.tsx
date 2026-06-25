// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JsonInspector } from "@/registry/new-york-v4/ui/json-inspector";
import {
  createJsonInspectorLineHtmlCache,
  jsonInspectorLineToHtml,
} from "@/registry/new-york-v4/ui/json-inspector-highlight";

beforeEach(() => {
  const requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  };
  globalThis.requestAnimationFrame = requestAnimationFrame;
  globalThis.cancelAnimationFrame = vi.fn();
  window.requestAnimationFrame = requestAnimationFrame;
  window.cancelAnimationFrame = vi.fn();
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "clipboard");
  vi.restoreAllMocks();
});

describe("JsonInspector virtualization", () => {
  it("escapes highlighted HTML while preserving visible JSON text", () => {
    const html = jsonInspectorLineToHtml(
      '  "unsafe": "<script>alert(1)</script>&"',
    );

    expect(html).toContain("text-violet-600 dark:text-violet-400");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;&amp;");
    expect(html).not.toContain("<script>");

    const view = render(
      <JsonInspector data={{ unsafe: "<script>alert(1)</script>&" }} />,
    );

    expect(view.container.querySelector("script")).toBeNull();
    expect(view.container.innerHTML).toContain("&lt;script&gt;");
    expect(view.container.textContent).toContain("<script>alert(1)</script>&");
  });

  it("keeps the highlighted HTML cache bounded", () => {
    const cache = createJsonInspectorLineHtmlCache(2);

    cache.get('"a": 1');
    cache.get('"b": 2');
    cache.get('"c": 3');

    expect(cache.size).toBe(2);
  });

  it("copies the formatted JSON source", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const data = { id: 1, name: "row" };

    const view = render(<JsonInspector data={data} />);
    await act(async () => {
      fireEvent.click(view.getByTitle("Copy"));
    });

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  it("mounts only the visible line projection for large JSON payloads", async () => {
    const data = {
      rows: Array.from({ length: 1_000 }, (_, index) => ({
        id: index,
        name: `row ${index}`,
      })),
    };

    const view = render(
      <div style={{ height: 120 }}>
        <JsonInspector data={data} />
      </div>,
    );
    const viewport = view.container.querySelector<HTMLElement>(
      '[data-slot="json-inspector-virtual-scroll"]',
    );
    if (!viewport) throw new Error("Missing JSON inspector virtual scroll");
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 120,
    });

    await act(async () => {
      viewport.scrollTop = 4_000;
      fireEvent.scroll(viewport);
    });

    const renderedLines = Array.from(
      view.container.querySelectorAll<HTMLElement>("[data-json-line-index]"),
    );
    const lineIndexes = renderedLines.map((line) =>
      Number(line.dataset.jsonLineIndex),
    );

    expect(renderedLines.length).toBeLessThan(40);
    expect(Math.min(...lineIndexes)).toBeGreaterThanOrEqual(190);
    expect(Math.max(...lineIndexes)).toBeLessThan(220);
    expect(view.container.textContent).toContain('"row 50"');
    expect(view.container.textContent).not.toContain('"row 999"');
  });
});
