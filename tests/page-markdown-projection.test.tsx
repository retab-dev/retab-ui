// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PageMarkdownContent } from "@/components/viewers/page-markdown/page-markdown-content";
import { createPageMarkdownProjectionTree } from "@/components/viewers/page-markdown/page-markdown-projection-parser";
import {
  clearPageMarkdownProjectionCacheForTests,
  isPlainPageMarkdown,
  preloadPageMarkdownProjection,
  projectPageMarkdown,
  readCachedPageMarkdownProjection,
} from "@/components/viewers/page-markdown/page-markdown-projection";
import {
  type PageMarkdownProjectionWorkerRequest,
  type PageMarkdownProjectionWorkerResponse,
} from "@/components/viewers/page-markdown/page-markdown-projection-protocol";

afterEach(() => {
  cleanup();
  clearPageMarkdownProjectionCacheForTests();
  vi.unstubAllGlobals();
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

  it("renders GFM through the page projection", async () => {
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

    expect(
      await screen.findByRole("heading", { name: "Statement" }),
    ).toBeTruthy();
    expect(screen.getByText("Reviewed")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeTruthy();
  });

  it("keeps cold parsed markdown out of the first rendered pass", async () => {
    vi.stubGlobal("Worker", undefined);

    render(
      <PageMarkdownContent
        markdown={["# Deferred page", "", "Parsed after render"].join("\n")}
        mode="rendered"
        scale={1}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Deferred page" })).toBeNull();
    expect(
      await screen.findByRole("heading", { name: "Deferred page" }),
    ).toBeTruthy();
  });

  it("preloads parsed markdown through a worker-backed projection cache", async () => {
    const requests: PageMarkdownProjectionWorkerRequest[] = [];

    class ProjectionWorker {
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessage:
        | ((event: MessageEvent<PageMarkdownProjectionWorkerResponse>) => void)
        | null = null;

      postMessage(message: PageMarkdownProjectionWorkerRequest) {
        requests.push(message);
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              id: message.id,
              ok: true,
              projection: createPageMarkdownProjectionTree(message.markdown),
              type: "projected",
            },
          } as MessageEvent<PageMarkdownProjectionWorkerResponse>);
        });
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", ProjectionWorker as unknown as typeof Worker);

    const markdown = "# Worker page\n\n- projected";
    const preload = preloadPageMarkdownProjection(markdown);

    expect(readCachedPageMarkdownProjection(markdown)).toBeNull();
    await preload;

    expect(requests).toHaveLength(1);
    render(
      <PageMarkdownContent markdown={markdown} mode="rendered" scale={1} />,
    );

    expect(screen.getByRole("heading", { name: "Worker page" })).toBeTruthy();
  });

  it("keeps raw HTML escaped and unsafe URLs inert", async () => {
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

    const link = await screen.findByRole("link", { name: "Retab" });
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
