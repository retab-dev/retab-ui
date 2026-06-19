// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownViewer } from "@/components/ui/markdown-viewer";

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "raw-html.md",
    mimeType: "text/markdown",
    text,
  };
}

function visibleMarkdownContent(container: HTMLElement) {
  const content = container.querySelector(
    '[data-slot="markdown-greenfield-content"]',
  );

  if (!(content instanceof HTMLElement)) {
    throw new Error("expected rendered Markdown content");
  }

  return content;
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

describe("pretext markdown greenfield raw HTML policy", () => {
  it("does not trust user-authored internal Pretext metadata attributes", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '<div data-pretext-component-trusted="true" data-pretext-component-name="Image" data-pretext-component-props=\'{"src":"https://example.com/pwn.png","alt":"Pwned"}\'>',
            "Raw content stays raw.",
            "</div>",
          ].join("\n"),
        )}
      />,
    );

    expect(
      within(visibleMarkdownContent(container)).getByText(
        "Raw content stays raw.",
      ),
    ).toBeTruthy();
    expect(container.querySelector("[data-pretext-image-src]")).toBeNull();
    expect(container.querySelector("[data-pretext-component-name]")).toBeNull();
    expect(
      container.querySelector("[data-pretext-component-trusted]"),
    ).toBeNull();
  });

  it("still renders Retab-authored component syntax through trusted metadata", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          '<Image src="https://example.com/trusted.png" alt="Trusted image" title="Trusted title" />',
        )}
      />,
    );

    expect(screen.getByRole("img", { name: "Trusted image" })).toBeTruthy();
    expect(container.querySelector("[data-pretext-image-src]")).toBeTruthy();
    expect(screen.getByText("Trusted title")).toBeTruthy();
  });

  it("sanitizes active raw HTML surfaces before rendering", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '<p onclick="alert(1)" style="background:url(javascript:alert(1))">Safe text</p>',
            "<script>alert(1)</script>",
            "<style>body { display: none }</style>",
            "<svg><script>alert(1)</script><circle /></svg>",
          ].join("\n"),
        )}
      />,
    );

    const content = visibleMarkdownContent(container);

    expect(screen.getByText("Safe text")).toBeTruthy();
    expect(content?.querySelector("[onclick]")).toBeNull();
    expect(content?.querySelector("[style]")).toBeNull();
    expect(content?.querySelector("script")).toBeNull();
    expect(content?.querySelector("style")).toBeNull();
    expect(content?.querySelector("svg")).toBeNull();
  });

  it("applies the Markdown URL policy to raw HTML links", () => {
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '<a href="javascript:alert(1)">Blocked link</a>',
            '<a href="https://example.com/report">Allowed link</a>',
          ].join("\n"),
        )}
      />,
    );

    expect(screen.queryByRole("link", { name: "Blocked link" })).toBeNull();
    expect(screen.getByText("Blocked link")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Allowed link" })).toHaveProperty(
      "href",
      "https://example.com/report",
    );
  });

  it("normalizes raw HTML link targets and rel values at render time", () => {
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '<a href="https://example.com/report" target="_self" rel="opener">External report</a>',
            '<a href="/docs/components" target="_blank" rel="opener">Internal docs</a>',
          ].join("\n"),
        )}
      />,
    );

    const external = screen.getByRole("link", { name: /External report/ });
    const internal = screen.getByRole("link", { name: "Internal docs" });

    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");
    expect(internal.getAttribute("target")).toBeNull();
    expect(internal.getAttribute("rel")).toBeNull();
  });

  it("sanitizes URL-bearing attributes on safe raw inline tags", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '<q cite="https://example.com/quote">quoted</q>',
            '<ins cite="javascript:alert(1)">inserted</ins>',
          ].join(" "),
        )}
      />,
    );

    expect(container.querySelector("q")?.getAttribute("cite")).toBe(
      "https://example.com/quote",
    );
    expect(container.querySelector("ins")?.getAttribute("cite")).toBeNull();
  });

  it("renders unsafe restricted component HTML as inert fallback content", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '<Image src="https://example.com/pwn.png" alt="Pwned" onLoad="alert(1)" />',
            "",
            "<Image {...props} />",
            "",
            '<Metric label="Accuracy" value="99%" tone="loud" />',
          ].join("\n"),
        )}
      />,
    );

    const fallbacks = Array.from(
      container.querySelectorAll("[data-pretext-component-fallback]"),
    );

    expect(
      container.querySelector("[data-pretext-component='Image']"),
    ).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(fallbacks).toHaveLength(3);
    expect(
      fallbacks.map((fallback) =>
        fallback.getAttribute("data-pretext-component-fallback-reason"),
      ),
    ).toEqual([
      "Event handler props are not supported",
      "Component props must be literal values",
      "Unsupported component",
    ]);
  });

  it("renders unsafe restricted component directives as inert fallback content", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '::callout{kind="warning" onClick="alert(1)"}',
            "Directive text",
            "::",
          ].join("\n"),
        )}
      />,
    );

    const fallback = container.querySelector(
      "[data-pretext-component-fallback]",
    );

    expect(
      container.querySelector("[data-pretext-component='Callout']"),
    ).toBeNull();
    expect(fallback).toBeTruthy();
    expect(
      fallback?.getAttribute("data-pretext-component-fallback-reason"),
    ).toBe("Unsupported component directive props");
    expect(fallback?.textContent).toContain(
      '::callout{kind="warning" onClick="alert(1)"}',
    );
  });

  it("does not let raw HTML spoof generated footnote sections", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '<section data-footnotes id="fake-footnotes">',
            '<a href="#fake-ref" data-footnote-backref>Fake backref</a>',
            "</section>",
            "",
            "Real reference.[^real]",
            "",
            "[^real]: Real generated footnote.",
          ].join("\n"),
        )}
      />,
    );

    const rawSection = container.querySelector("#user-content-fake-footnotes");
    const generatedSection = container.querySelector("[data-footnotes]");

    expect(rawSection).toBeTruthy();
    expect(rawSection?.hasAttribute("data-footnotes")).toBe(false);
    expect(rawSection?.querySelector("[data-footnote-backref]")).toBeNull();
    expect(generatedSection?.textContent).toContain("Real generated footnote.");
    expect(
      generatedSection?.querySelector("[data-footnote-backref]"),
    ).toBeTruthy();
  });
});
