// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownViewer } from "@/components/ui/markdown-viewer";
import {
  createMarkdownUnifiedDocument,
  getMarkdownMathRenderCacheStatsForTests,
  resetMarkdownMathRenderCacheForTests,
} from "@/registry/new-york-v4/ui/markdown-unified-pipeline";
import type { MarkdownHastNode } from "@/registry/new-york-v4/ui/markdown-hast-types";

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "math.md",
    mimeType: "text/markdown",
    text,
  };
}

beforeEach(() => {
  resetMarkdownMathRenderCacheForTests();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  resetMarkdownMathRenderCacheForTests();
  vi.restoreAllMocks();
});

describe("pretext markdown greenfield math", () => {
  it("caches repeated KaTeX renders by formula source and mode", () => {
    const formula = String.raw`a^2 + b^2 = c^2`;
    const document = createMarkdownUnifiedDocument(
      [
        `Inline $${formula}$ and again $${formula}$.`,
        "",
        "$$",
        formula,
        "$$",
        "",
        "$$",
        formula,
        "$$",
      ].join("\n"),
    );

    expect(countHastElementsWithClass(document.hast, "katex")).toBeGreaterThan(
      0,
    );
    expect(countHastElementsWithClass(document.hast, "katex-display")).toBe(2);
    expect(getMarkdownMathRenderCacheStatsForTests()).toEqual({
      hits: 0,
      misses: 2,
      sameDocumentHits: 2,
      size: 2,
      writes: 2,
    });

    createMarkdownUnifiedDocument(`Again $${formula}$.`);

    expect(getMarkdownMathRenderCacheStatsForTests()).toEqual({
      hits: 1,
      misses: 2,
      sameDocumentHits: 2,
      size: 2,
      writes: 2,
    });
  });

  it("preserves KaTeX error messages for cached duplicate formulas", () => {
    const formula = String.raw`\notacommand`;
    const document = createMarkdownUnifiedDocument(
      [`Bad $${formula}$.`, "", `Again $${formula}$.`].join("\n"),
    );
    const katexMessages = document.messages.filter(
      (message) => message.source === "rehype-katex",
    );

    expect(katexMessages).toHaveLength(2);
    expect(katexMessages.map((message) => message.line)).toEqual([1, 3]);
    expect(getMarkdownMathRenderCacheStatsForTests()).toMatchObject({
      misses: 1,
      sameDocumentHits: 1,
      size: 1,
      writes: 1,
    });
  });

  it("renders inline and display math through bounded KaTeX surfaces", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "Inline math $a^2 + b^2 = c^2$ stays in prose.",
            "",
            "$$",
            "\\int_0^1 x^2\\,dx = \\frac{1}{3}",
            "$$",
          ].join("\n"),
        )}
      />,
    );

    expect(container.querySelector("[data-pretext-math-inline]")).toBeTruthy();

    const mathBlock = screen.getByRole("region", { name: "Math block" });
    expect(mathBlock.getAttribute("data-pretext-math-block")).toBe("");
    expect(mathBlock.className).toContain("overflow-x-auto");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
  });
});

function countHastElementsWithClass(
  node: MarkdownHastNode | { children: MarkdownHastNode[] },
  className: string,
): number {
  const classes =
    "type" in node && node.type === "element" && "properties" in node
      ? node.properties?.className
      : undefined;
  const children = "children" in node ? (node.children ?? []) : [];
  const self = Array.isArray(classes) && classes.includes(className) ? 1 : 0;
  return (
    self +
    children.reduce(
      (count, child) => count + countHastElementsWithClass(child, className),
      0,
    )
  );
}
