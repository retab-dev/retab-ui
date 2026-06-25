// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageMarkdownContent } from "@/components/viewers/page-markdown/page-markdown-content";
import {
  clearPageMarkdownProjectionCacheForTests,
  isPlainPageMarkdown,
  projectPageMarkdown,
} from "@/components/viewers/page-markdown/page-markdown-projection";

afterEach(() => {
  cleanup();
  clearPageMarkdownProjectionCacheForTests();
});

describe("page markdown projection", () => {
  it("caches projected markdown by page text", () => {
    const markdown =
      "# Cached page\n\n| Item | Amount |\n| --- | ---: |\n| Cash | $10 |";

    const firstProjection = projectPageMarkdown(markdown);
    const secondProjection = projectPageMarkdown(markdown);

    expect(secondProjection).toBe(firstProjection);
    expect(projectPageMarkdown("# Different page")).not.toBe(firstProjection);
  });

  it("identifies only syntax-free pages as plain markdown", () => {
    expect(isPlainPageMarkdown("Invoice #123\nDue on receipt")).toBe(true);
    expect(isPlainPageMarkdown("# Invoice\n\nDue on receipt")).toBe(false);
    expect(isPlainPageMarkdown("[Retab](https://retab.com)")).toBe(false);
    expect(isPlainPageMarkdown("```ts\nconst total = 10\n```")).toBe(false);
  });

  it("renders GFM through the page projection", () => {
    render(
      <PageMarkdownContent
        markdown={[
          "# Statement",
          "",
          "- [x] Reviewed",
          "",
          "| Item | Amount |",
          "| --- | ---: |",
          "| Cash | $10.00 |",
        ].join("\n")}
        mode="rendered"
        scale={1}
      />,
    );

    expect(screen.getByRole("heading", { name: "Statement" })).toBeTruthy();
    expect(screen.getByText("Reviewed")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeTruthy();
  });

  it("keeps raw HTML escaped and unsafe URLs inert", () => {
    const { container } = render(
      <PageMarkdownContent
        markdown={[
          "[Retab](https://retab.com)",
          "[Unsafe](javascript:alert('xss'))",
          '<div data-testid="raw-html">raw html</div>',
          "![Unsafe image](javascript:alert('xss'))",
        ].join("\n\n")}
        mode="rendered"
        scale={1}
      />,
    );

    const link = screen.getByRole("link", { name: "Retab" });
    expect(link.getAttribute("href")).toBe("https://retab.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Unsafe").closest("a")).toBeNull();
    expect(container.querySelector("[data-testid='raw-html']")).toBeNull();
    expect(container.textContent).toContain(
      '<div data-testid="raw-html">raw html</div>',
    );
    expect(container.querySelector("img[alt='Unsafe image']")).toBeNull();
    expect(screen.getByText("Unsafe image")).toBeTruthy();
  });
});
