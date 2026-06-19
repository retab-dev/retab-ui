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
import { MarkdownGreenfieldChunkRenderer } from "@/registry/new-york-v4/ui/markdown-greenfield-renderer";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, source: string) => {
      if (source.includes("unsafe-svg")) {
        return {
          svg: [
            '<svg role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" xmlns="http://www.w3.org/2000/svg" onload="alert(1)" style="background:url(javascript:alert(1))">',
            "<script>alert(1)</script>",
            '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
            '<text onclick="alert(1)">Unsafe</text>',
            "</svg>",
          ].join(""),
        };
      }

      return {
        svg: `<svg role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" data-source="${encodeURIComponent(source)}" xmlns="http://www.w3.org/2000/svg"></svg>`,
      };
    }),
  },
}));

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "diagram.md",
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

describe("pretext markdown greenfield diagrams", () => {
  it("renders Mermaid fences as bounded diagram surfaces", async () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource("```mermaid\ngraph TD\n  A-->B\n```")}
      />,
    );

    expect(screen.getByRole("group", { name: "Mermaid diagram" })).toBeTruthy();
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]',
    );

    expect(diagram).toBeTruthy();
    expect(await screen.findByTestId("mock-mermaid-svg")).toBeTruthy();
    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("ready"));
    expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy();
  });

  it("requests chunk measurement again after Mermaid rendering settles", async () => {
    const onContentReady = vi.fn();
    render(
      <MarkdownGreenfieldChunkRenderer
        chunk={
          {
            hastChildren: [
              {
                type: "element",
                tagName: "pre",
                properties: {},
                children: [
                  {
                    type: "element",
                    tagName: "code",
                    properties: { className: ["language-mermaid"] },
                    children: [{ type: "text", value: "graph TD\n  A-->B\n" }],
                  },
                ],
              },
            ],
            id: "chunk-diagram",
            isHostile: false,
          } as any
        }
        onContentReady={onContentReady}
      />,
    );
    const callsBeforeReady = onContentReady.mock.calls.length;

    await screen.findByTestId("mock-mermaid-svg");

    await waitFor(() => {
      expect(onContentReady.mock.calls.length).toBeGreaterThan(
        callsBeforeReady,
      );
    });
  });

  it("preserves Mermaid fence title and caption metadata", async () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            '```mermaid title="System flow" caption="Rendered architecture diagram"',
            "graph LR",
            "  Start-->Done",
            "```",
          ].join("\n"),
        )}
      />,
    );

    expect(await screen.findByText("System flow")).toBeTruthy();
    expect(screen.getByRole("group", { name: "System flow" })).toBeTruthy();
    expect(
      container.querySelector("[data-pretext-diagram-caption]")?.textContent,
    ).toBe("Rendered architecture diagram");

    fireEvent.click(screen.getByLabelText("Copy diagram source"));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "graph LR\n  Start-->Done",
      );
    });
  });

  it("sanitizes SVG returned by Mermaid before injecting it", async () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource("```mermaid\ngraph TD\n  unsafe-svg\n```")}
      />,
    );

    const svg = await screen.findByTestId("mock-mermaid-svg");
    expect(svg.getAttribute("onload")).toBeNull();
    expect(svg.getAttribute("style")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("foreignObject")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
  });

  it("copies sanitized Mermaid SVG once rendering is ready", async () => {
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource("```mermaid\ngraph TD\n  A-->B\n```")}
      />,
    );

    await screen.findByTestId("mock-mermaid-svg");
    fireEvent.click(screen.getByLabelText("Copy diagram SVG"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    const copiedSvg = vi.mocked(navigator.clipboard.writeText).mock
      .calls[0]?.[0] as string;

    expect(copiedSvg).toContain('role="img"');
    expect(copiedSvg).toContain('aria-label="Mermaid diagram"');
    expect(copiedSvg).toContain('data-source="graph%20TD%0A%20%20A--%3EB"');
    expect(copiedSvg).not.toContain("script");
    expect(copiedSvg).not.toContain("onload");
    expect(copiedSvg).not.toContain("javascript:");
  });
});
