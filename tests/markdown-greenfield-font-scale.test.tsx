// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/markdown-greenfield-document";
import {
  MARKDOWN_GREENFIELD_BASE_FONT_PX,
  MARKDOWN_GREENFIELD_BASE_SPACING_REM,
  MarkdownGreenfieldChunkRenderer,
} from "@/registry/new-york-v4/ui/markdown-greenfield-renderer";

afterEach(cleanup);

function renderFirstChunk(fontScale?: number) {
  const parsed = createMarkdownGreenfieldDocument(
    "Body copy whose size is driven by the zoom font scale.",
  );
  const { container } = render(
    <MarkdownGreenfieldChunkRenderer
      chunk={parsed.chunks[0]}
      fontScale={fontScale}
    />,
  );
  return container.querySelector<HTMLElement>(
    '[data-slot="markdown-greenfield-content"]',
  );
}

describe("pretext markdown rendered font scaling", () => {
  it("renders the base size at the default (100%) scale", () => {
    const content = renderFirstChunk();
    expect(content?.style.fontSize).toBe(
      `${MARKDOWN_GREENFIELD_BASE_FONT_PX}px`,
    );
  });

  it("scales the rendered body font-size with the zoom fontScale", () => {
    const content = renderFirstChunk(2);
    // The whole document cascades off this one value, so doubling the scale
    // doubles the body size (and, via em units, everything else).
    expect(content?.style.fontSize).toBe(
      `${MARKDOWN_GREENFIELD_BASE_FONT_PX * 2}px`,
    );
  });

  it("scales the spacing unit with zoom so vertical rhythm tracks the type", () => {
    expect(renderFirstChunk(1)?.style.getPropertyValue("--spacing")).toBe(
      `${(MARKDOWN_GREENFIELD_BASE_SPACING_REM * 1).toFixed(5)}rem`,
    );
    // Doubling the zoom doubles the spacing scale, so every margin/padding/gap
    // that resolves to calc(var(--spacing) * n) grows in step with the body.
    expect(renderFirstChunk(2)?.style.getPropertyValue("--spacing")).toBe(
      `${(MARKDOWN_GREENFIELD_BASE_SPACING_REM * 2).toFixed(5)}rem`,
    );
  });

  it("keeps code blocks on the em cascade so they scale with the body", () => {
    const parsed = createMarkdownGreenfieldDocument(
      "```ts\nexport const scaled = true\n```",
    );
    const { container } = render(
      <MarkdownGreenfieldChunkRenderer chunk={parsed.chunks[0]} />,
    );

    // The figure must neutralize any host-stylesheet fixed font-size...
    const figure = container.querySelector("figure");
    expect(figure?.className).toContain("text-[1em]");

    // ...and the code lines must be sized in em (rem-based text-sm would pin
    // the block to the root and break zoom).
    const code = container.querySelector("figure code");
    expect(code?.className).toMatch(/text-\[[0-9.]+em\]/);
    expect(code?.className).not.toMatch(/\btext-sm\b/);
  });

  it("scales alert labels with the body instead of pinning them", () => {
    const parsed = createMarkdownGreenfieldDocument(
      "> [!NOTE]\n> Body copy that scales with the document.",
    );
    const { container } = render(
      <MarkdownGreenfieldChunkRenderer chunk={parsed.chunks[0]} />,
    );

    // The alert title (label + icon) must ride the em cascade so it grows with
    // the alert body under zoom — a rem-based text-sm would leave it pinned.
    const title = container.querySelector("[data-pretext-alert-title]");
    expect(title?.className).toMatch(/text-\[[0-9.]+em\]/);
    expect(title?.className).not.toMatch(/\btext-sm\b/);
    expect(title?.querySelector("svg")?.getAttribute("class")).toMatch(
      /size-\[[0-9.]+em\]/,
    );
  });
});
