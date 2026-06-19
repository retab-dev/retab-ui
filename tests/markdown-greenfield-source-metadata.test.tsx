// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownViewer } from "@/components/ui/markdown-viewer";

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "source-metadata.md",
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

describe("pretext markdown greenfield source metadata", () => {
  it("projects HAST source ranges onto rendered elements", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          ["# Source title", "", "Rendered paragraph."].join("\n"),
        )}
      />,
    );
    const heading = container.querySelector("h1");
    const paragraph = container.querySelector("p");

    expect(heading?.getAttribute("data-pretext-source-start-line")).toBe("1");
    expect(heading?.getAttribute("data-pretext-source-end-line")).toBe("1");
    expect(heading?.getAttribute("data-pretext-source-start-offset")).toBe("0");
    expect(paragraph?.getAttribute("data-pretext-source-start-line")).toBe("3");
    expect(paragraph?.getAttribute("data-pretext-source-end-line")).toBe("3");
  });
});
