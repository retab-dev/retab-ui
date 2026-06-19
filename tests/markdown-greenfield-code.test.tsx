// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
});
