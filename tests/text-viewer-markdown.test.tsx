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

import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer";

function markdownSource(text: string, fileName = "notes.md") {
  return {
    kind: "text" as const,
    fileName,
    mimeType: "text/markdown",
    text,
  };
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function scrollTo(
      this: HTMLElement,
      options?: ScrollToOptions | number,
    ) {
      if (typeof options === "object" && typeof options.top === "number") {
        this.scrollTop = options.top;
      }
    }),
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as CanvasRenderingContext2D);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn(() => Promise.resolve()),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TextViewer Markdown routing", () => {
  it("routes inferred Markdown sources through the Markdown canvas", async () => {
    const { container } = render(
      <TextViewer
        source={markdownSource(
          [
            "# Statement",
            "",
            "| Name | Amount |",
            "| --- | ---: |",
            "| Alpha | 1 |",
          ].join("\n"),
        )}
        controls={false}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Statement" }),
    ).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="text-virtual-canvas"]'),
    ).toBeNull();

    fireEvent.click(screen.getByLabelText("Copy table as TSV"));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["Name\tAmount", "Alpha\t1"].join("\n"),
      );
    });
  });

  it("routes explicit Markdown mode through the Markdown canvas", async () => {
    const { container } = render(
      <TextViewer
        source={markdownSource("# Explicit", "explicit.txt")}
        mode="markdown"
        controls={false}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Explicit" }),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeTruthy();
  });

  it("keeps explicit text mode on the prose projection", async () => {
    const { container } = render(
      <TextViewer
        source={markdownSource("# Not Markdown")}
        mode="text"
        controls={false}
      />,
    );

    expect(await screen.findByText("# Not Markdown")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="text-virtual-canvas"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: "Not Markdown" })).toBeNull();
  });

  it("forwards the imperative line-scroll handle through Markdown delegation", async () => {
    const ref = React.createRef<TextViewerHandle>();
    const text = [
      "# Start",
      "",
      ...Array.from({ length: 80 }, (_, index) => `Paragraph ${index + 1}`),
      "",
      "## Target",
    ].join("\n");
    const { container } = render(
      <TextViewer
        ref={ref}
        className="h-40 w-[360px]"
        source={markdownSource(text)}
        controls={false}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Start" })).toBeTruthy();
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(viewport).toBeTruthy();

    ref.current?.scrollToLineRange(
      { start: 84, end: 84 },
      { behavior: "auto" },
    );
    await waitFor(() => {
      expect(viewport!.scrollTop).toBeGreaterThan(0);
    });
  });
});
