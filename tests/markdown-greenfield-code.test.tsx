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
    fileName: "code.md",
    mimeType: "text/markdown",
    text,
  };
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("pretext markdown greenfield code blocks", () => {
  it("renders Shiki syntax tokens without changing the source lines", async () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "```ts showLineNumbers",
            "const answer = 42",
            "// stable comment",
            "```",
          ].join("\n"),
        )}
      />,
    );

    expect(screen.getByRole("group", { name: "ts code block" })).toBeTruthy();
    await waitFor(() => {
      expect(container.querySelector("[data-shiki-token]")).toBeTruthy();
    });

    const shikiTokens = Array.from(
      container.querySelectorAll<HTMLElement>("[data-shiki-token]"),
    );
    expect(shikiTokens.map((token) => token.textContent).join("")).toContain(
      "const answer = 42",
    );
    expect(shikiTokens[0]?.getAttribute("style")).toContain("--shiki-light");
    expect(shikiTokens[0]?.className).toContain(
      "dark:text-[var(--shiki-dark)]",
    );
    expect(
      Array.from(container.querySelectorAll("[data-line]")).map((line) =>
        line.textContent?.trimEnd(),
      ),
    ).toEqual(["const answer = 42", "// stable comment"]);
  });

  it("keeps metadata highlighted lines and highlighted characters", async () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "```ts showLineNumbers{5} {1} /answer/",
            "const answer = 42",
            "```",
          ].join("\n"),
        )}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("[data-shiki-token]")).toBeTruthy();
    });
    expect(
      container.querySelector("[data-highlighted-line]")?.textContent,
    ).toBe("const answer = 42");
    expect(
      container.querySelector("[data-highlighted-chars]")?.textContent,
    ).toBe("answer");
    expect(
      container
        .querySelector("[data-pretext-code-line-number]")
        ?.getAttribute("data-pretext-code-line-number"),
    ).toBe("5");
  });

  it("supports highlighted code line ranges in fence metadata", async () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "```ts {2-3,5}",
            "const one = 1",
            "const two = 2",
            "const three = 3",
            "const four = 4",
            "const five = 5",
            "```",
          ].join("\n"),
        )}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("[data-shiki-token]")).toBeTruthy();
    });
    expect(
      Array.from(container.querySelectorAll("[data-highlighted-line]")).map(
        (line) => line.textContent?.trimEnd(),
      ),
    ).toEqual(["const two = 2", "const three = 3", "const five = 5"]);
  });

  it("virtualizes ordinary large fenced code blocks without losing code metadata", async () => {
    const sourceLines = Array.from({ length: 120 }, (_, index) =>
      index === 94
        ? "+const needle = 95"
        : `const line${index + 1} = ${index + 1}`,
    );
    const source = sourceLines.join("\n");
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          ["```ts showLineNumbers{10} {95} /needle/", source, "```"].join("\n"),
        )}
      />,
    );

    const sourceRegion = screen.getByRole("region", { name: "ts code source" });
    const code = container.querySelector<HTMLElement>(
      "code[data-pretext-code-virtualized]",
    );

    expect(
      container.querySelector("[data-markdown-hostile-fallback]"),
    ).toBeNull();
    expect(sourceRegion.getAttribute("data-pretext-code-virtualized")).toBe("");
    expect(sourceRegion.getAttribute("data-pretext-code-line-count")).toBe(
      "120",
    );
    expect(code).toBeTruthy();
    expect(code?.style.minWidth).toContain("max(100%");
    expect(
      Number(sourceRegion.getAttribute("data-pretext-code-mounted-lines")),
    ).toBeLessThan(120);
    expect(container.querySelectorAll("[data-line]").length).toBeLessThan(120);
    expect(container.textContent).toContain("const line1 = 1");
    expect(container.textContent).not.toContain("needle");

    sourceRegion.scrollTop = 94 * 24;
    fireEvent.scroll(sourceRegion);

    await waitFor(() => {
      expect(container.querySelector("[data-highlighted-line]")).toBeTruthy();
    });

    const highlightedLine = container.querySelector<HTMLElement>(
      "[data-highlighted-line]",
    );
    expect(highlightedLine?.textContent).toContain("needle");
    expect(highlightedLine?.getAttribute("aria-label")).toBe("Line 104");
    expect(highlightedLine?.getAttribute("data-pretext-code-line-number")).toBe(
      "104",
    );
    expect(highlightedLine?.getAttribute("data-pretext-code-diff-line")).toBe(
      "add",
    );
    expect(highlightedLine?.className).toContain("bg-emerald-500/10");
    expect(
      container.querySelector("[data-highlighted-chars]")?.textContent,
    ).toBe("needle");
    expect(container.textContent).not.toContain("const line1 = 1");

    fireEvent.click(screen.getByLabelText("Copy code block"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(source);
    });
  });
});
