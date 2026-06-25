// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MermaidDiagram } from "@/components/mermaid-diagram";
import { resetMermaidRendererForTests } from "@/registry/new-york-v4/ui/mermaid-renderer";

const MMDR_WASM_BYTES = readFileSync("public/vendor/mmdr/typst_mmdr.wasm");

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id: string, source: string) => {
      if (source.includes("force-basic-fallback")) {
        throw new Error("getBBox is not a function");
      }

      if (source.includes("unsafe-svg")) {
        return {
          svg: [
            `<svg id="${id}" role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" xmlns="http://www.w3.org/2000/svg" onload="alert(1)" style="background:url(javascript:alert(1))">`,
            "<style>.unsafe{fill:url(javascript:alert(1))}</style>",
            "<script>alert(1)</script>",
            '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
            '<text onclick="alert(1)">Unsafe</text>',
            "</svg>",
          ].join(""),
        };
      }

      return {
        svg: `<svg id="${id}" role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" data-source="${encodeURIComponent(source)}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="${id}-pointEnd" /></defs><path marker-end="url(#${id}-pointEnd)" /></svg>`,
      };
    }),
  },
}));

function disableMmdrFetchForTests() {
  Object.defineProperty(window, "fetch", {
    configurable: true,
    value: undefined,
  });
}

function copyMmdrWasmBuffer() {
  return new Uint8Array(MMDR_WASM_BYTES).buffer;
}

function stubMmdrWasmFetch() {
  const fetch = vi.fn(async () => ({
    arrayBuffer: vi.fn(async () => copyMmdrWasmBuffer()),
    ok: true,
    status: 200,
  }));
  Object.defineProperty(window, "fetch", {
    configurable: true,
    value: fetch,
  });
  return fetch;
}

beforeEach(() => {
  resetMermaidRendererForTests();
  disableMmdrFetchForTests();
});

afterEach(() => {
  cleanup();
  disableMmdrFetchForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MermaidDiagram", () => {
  it("uses local mmdr WASM before Mermaid JS", async () => {
    const mermaid = (await import("mermaid")).default;
    vi.mocked(mermaid.render).mockClear();
    const mmdrFetch = stubMmdrWasmFetch();
    const { container } = render(
      <MermaidDiagram chart={"graph LR\n  Docs-->MMDR\n  MMDR-->SVG"} />,
    );

    const svg = await screen.findByRole("img", { name: "Mermaid diagram" });
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]',
    );

    await waitFor(() => expect(diagram?.dataset.diagramRenderer).toBe("mmdr"));
    expect(mmdrFetch).toHaveBeenCalledWith("/vendor/mmdr/typst_mmdr.wasm");
    expect(svg.getAttribute("data-pretext-sanitized-mermaid")).toBe("");
    expect(svg.outerHTML).toContain("var(--mmdr");
    expect(mermaid.render).not.toHaveBeenCalled();
    expect(document.querySelector('script[data-mermaid="true"]')).toBeNull();
  });

  it("falls back to Mermaid npm output and sanitizes injected SVG", async () => {
    const mermaid = (await import("mermaid")).default;
    vi.mocked(mermaid.render).mockClear();
    const { container } = render(
      <MermaidDiagram chart={"graph TD\n  unsafe-svg-->B"} />,
    );

    const svg = await screen.findByTestId("mock-mermaid-svg");
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]',
    );

    expect(diagram?.dataset.diagramRenderer).toBe("mermaid");
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: "strict",
        startOnLoad: false,
        suppressErrorRendering: true,
      }),
    );
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(svg.getAttribute("data-pretext-sanitized-mermaid")).toBe("");
    expect(svg.getAttribute("onload")).toBeNull();
    expect(svg.getAttribute("style")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("foreignObject")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(document.querySelector('script[data-mermaid="true"]')).toBeNull();
  });

  it("renders a basic diagram when Mermaid reports a known layout failure", async () => {
    const mermaid = (await import("mermaid")).default;
    vi.mocked(mermaid.render).mockClear();
    const { container } = render(
      <MermaidDiagram
        chart={[
          "%% force-basic-fallback",
          "sequenceDiagram",
          "participant U as User",
          "participant A as App",
          "U->>A: Request",
        ].join("\n")}
      />,
    );

    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]',
    );

    await waitFor(() => expect(diagram?.dataset.diagramRenderer).toBe("basic"));
    const svg = container.querySelector<SVGSVGElement>(
      'svg[data-pretext-basic-mermaid="sequence"]',
    );

    expect(svg).toBeTruthy();
    expect(svg?.textContent).toContain("User");
    expect(svg?.textContent).toContain("App");
    expect(svg?.textContent).toContain("Request");
    expect(screen.queryByTestId("mock-mermaid-svg")).toBeNull();
    expect(mermaid.render).toHaveBeenCalledTimes(1);
  });
});
