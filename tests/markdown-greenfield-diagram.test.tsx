// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownViewer } from "@/components/ui/markdown-viewer";
import { resetMarkdownMermaidRendererForTests } from "@/registry/new-york-v4/ui/markdown-greenfield-diagram";
import { MarkdownGreenfieldChunkRenderer } from "@/registry/new-york-v4/ui/markdown-greenfield-renderer";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id: string, source: string) => {
      if (source.includes("unsafe-svg")) {
        return {
          svg: [
            '<svg role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" xmlns="http://www.w3.org/2000/svg" onload="alert(1)" style="background:url(javascript:alert(1))">',
            "<style>.unsafe{fill:url(javascript:alert(1))}</style>",
            "<script>alert(1)</script>",
            '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
            '<text onclick="alert(1)">Unsafe</text>',
            "</svg>",
          ].join(""),
        };
      }

      return {
        svg: [
          `<svg id="${id}" role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" data-source="${encodeURIComponent(source)}" xmlns="http://www.w3.org/2000/svg">`,
          `<style>#${id} .label-container{fill:#000;stroke:#000}#${id} .flowchart-link{stroke:#000}#${id} text{fill:#000}</style>`,
          `<defs><marker id="${id}-pointEnd"><path class="arrowMarkerPath" style="fill:#000;stroke:#000" /></marker></defs>`,
          '<g class="node" id="node-a"><rect class="basic label-container" style="fill:#000;stroke:#000" /><text style="fill:#000">A</text></g>',
          `<path class="flowchart-link" marker-end="url(#${id}-pointEnd)" style="stroke:#000" />`,
          "</svg>",
        ].join(""),
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
  resetMarkdownMermaidRendererForTests();
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
  vi.unstubAllGlobals();
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

  it("replaces Mermaid SVG styling with the viewer-owned theme layer", async () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource("```mermaid\ngraph TD\n  styled-svg-->B\n```")}
      />,
    );

    const svg = await screen.findByTestId("mock-mermaid-svg");
    const themedSurface = container.querySelector("[data-pretext-mermaid-svg]");
    const viewerStyles = container.querySelector(
      "[data-pretext-mermaid-styles]",
    );
    const node = svg.querySelector(".label-container");
    const edge = svg.querySelector(".flowchart-link");

    expect(themedSurface).toBeTruthy();
    expect(viewerStyles?.textContent).toContain(".label-container");
    expect(viewerStyles?.textContent).toContain(".flowchart-link");
    expect(svg.getAttribute("data-pretext-sanitized-mermaid")).toBe("");
    expect(svg.querySelector("style")).toBeNull();
    expect(node?.getAttribute("style")).toBeNull();
    expect(edge?.getAttribute("style")).toBeNull();
  });

  it("renders Mermaid only after an observed diagram approaches the viewport", async () => {
    const mermaid = (await import("mermaid")).default;
    vi.mocked(mermaid.render).mockClear();
    let observerCallback: IntersectionObserverCallback | null = null;

    class TestIntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];
      disconnect = vi.fn();
      observe = vi.fn();
      takeRecords = vi.fn(() => []);
      unobserve = vi.fn();

      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
    }

    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          `\`\`\`mermaid\ngraph TD\n  A-->B\n  %% lazy-${Date.now()}-${Math.random()}\n\`\`\``,
        )}
      />,
    );

    await waitFor(() => expect(observerCallback).toBeTruthy());
    expect(mermaid.render).not.toHaveBeenCalled();

    act(() => {
      observerCallback?.(
        [
          {
            intersectionRatio: 1,
            isIntersecting: true,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    await screen.findByTestId("mock-mermaid-svg");
    expect(mermaid.render).toHaveBeenCalledTimes(1);
  });

  it("reuses cached Mermaid renders across remounts", async () => {
    const mermaid = (await import("mermaid")).default;
    vi.mocked(mermaid.render).mockClear();
    const source = `graph TD\n  A-->B\n  %% cache-${Date.now()}-${Math.random()}`;
    const first = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(`\`\`\`mermaid\n${source}\n\`\`\``)}
      />,
    );

    await screen.findByTestId("mock-mermaid-svg");
    expect(mermaid.render).toHaveBeenCalledTimes(1);

    first.unmount();
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(`\`\`\`mermaid\n${source}\n\`\`\``)}
      />,
    );

    await screen.findByTestId("mock-mermaid-svg");
    expect(mermaid.render).toHaveBeenCalledTimes(1);
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
