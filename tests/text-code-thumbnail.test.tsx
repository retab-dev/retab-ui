// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ViewerResource } from "@/lib/viewer-resource";
import { FirstThumbnailUnit } from "@/components/file-thumbnail/renderer-registry";
import { CodeThumbnail } from "@/components/file-thumbnail/renderers/code-thumbnail";
import { TextThumbnail } from "@/components/file-thumbnail/renderers/text-thumbnail";
import { clearThumbnailCachesForTests } from "@/components/file-thumbnail/thumbnail-test-reset";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <div data-testid="thumbnail-error" />;
    return this.props.children;
  }
}

function renderThumbnail(children: React.ReactNode) {
  return render(
    <ErrorBoundary>
      <React.Suspense fallback={<div data-testid="thumbnail-loading" />}>
        {children}
      </React.Suspense>
    </ErrorBoundary>,
  );
}

function textResource({
  fileName,
  key,
  text,
  mimeType = "text/plain",
}: {
  fileName: string;
  key: string;
  text: string;
  mimeType?: string;
}) {
  return {
    fileName,
    mimeType,
    sourceKind: "blob",
    content: {
      key,
      sourceKind: "blob",
      readRange: vi.fn(async () => encodedRange(text)),
      readStream: vi.fn(),
    },
    originalDownload: { isDisabled: true },
  } as unknown as ViewerResource;
}

function encodedRange(text: string) {
  return {
    buffer: new TextEncoder().encode(text).buffer,
    contentRange: {
      start: 0,
      end: Math.max(text.length - 1, 0),
      total: text.length,
    },
    isComplete: true,
  };
}

afterEach(() => {
  cleanup();
  clearThumbnailCachesForTests();
  vi.restoreAllMocks();
});

describe("text and code thumbnails", () => {
  it("renders text as wrapped prose without line numbers", async () => {
    const resource = textResource({
      fileName: "review-notes.txt",
      key: "text-prose",
      text: "Text and code want different surfaces.\n\nProse wants rhythm, wrapping, and a readable measure.",
    });

    const view = renderThumbnail(
      <TextThumbnail resource={resource} thumbnailKey="text-prose" />,
    );

    const prose = await screen.findByText(
      "Text and code want different surfaces.",
    );
    const thumbnail = prose.closest('[data-slot="text-thumbnail"]');

    expect(thumbnail).not.toBeNull();
    expect(view.queryByText("1")).toBeNull();
  });

  it("themes text thumbnails inside dark UI", async () => {
    const resource = textResource({
      fileName: "dark-mode-notes.txt",
      key: "text-dark-mode",
      text: "Dark app chrome should theme the thumbnail page.",
    });

    renderThumbnail(
      <div className="dark">
        <TextThumbnail resource={resource} thumbnailKey="text-dark-mode" />
      </div>,
    );

    const prose = await screen.findByText(
      "Dark app chrome should theme the thumbnail page.",
    );
    const thumbnail = prose.closest('[data-slot="text-thumbnail"]');

    expect(thumbnail?.classList.contains("bg-white")).toBe(true);
    expect(thumbnail?.classList.contains("text-slate-700")).toBe(true);
    expect(thumbnail?.classList.contains("dark:bg-slate-950")).toBe(true);
    expect(thumbnail?.classList.contains("dark:text-slate-300")).toBe(true);
  });

  it("normalizes CRLF prose in text thumbnails", async () => {
    const resource = textResource({
      fileName: "windows-notes.txt",
      key: "text-crlf",
      text: "First line\r\nsecond line\r\n\r\nNext paragraph",
    });

    renderThumbnail(
      <TextThumbnail resource={resource} thumbnailKey="text-crlf" />,
    );

    expect(await screen.findByText("First line second line")).not.toBeNull();
    expect(screen.getByText("Next paragraph")).not.toBeNull();
  });

  it("renders an intentional empty state for empty text", async () => {
    const resource = textResource({
      fileName: "empty.txt",
      key: "text-empty",
      text: " \n\t ",
    });
    const view = renderThumbnail(
      <TextThumbnail resource={resource} thumbnailKey="text-empty" />,
    );

    await screen.findByLabelText("Empty text file");

    expect(
      view.container.querySelector('[data-slot="text-thumbnail-empty"]'),
    ).not.toBeNull();
    expect(
      view.container
        .querySelector('[data-slot="text-thumbnail-empty"]')
        ?.classList.contains("dark:bg-slate-950"),
    ).toBe(true);
    expect(view.queryByText("1")).toBeNull();
  });

  it("renders code as monospaced lines with line numbers", async () => {
    const resource = textResource({
      fileName: "use-debounced-value.ts",
      key: "code-typescript",
      text: 'import * as React from "react"\n\nexport function useX() {}',
    });

    renderThumbnail(
      <CodeThumbnail resource={resource} thumbnailKey="code-typescript" />,
    );

    const code = await screen.findByText('import * as React from "react"');

    expect(code.closest('[data-slot="code-thumbnail"]')).not.toBeNull();
    expect(screen.getByText("1")).not.toBeNull();
  });

  it("preserves whitespace in code thumbnails", async () => {
    const resource = textResource({
      fileName: "indented.ts",
      key: "code-whitespace",
      text: "if (ready) {\n  const answer = 42\n}",
    });
    const view = renderThumbnail(
      <CodeThumbnail resource={resource} thumbnailKey="code-whitespace" />,
    );

    await screen.findByText("if (ready) {");

    expect(view.container.textContent).toContain("  const answer = 42");
  });

  it("pretty-prints strict JSON as code", async () => {
    const resource = textResource({
      fileName: "app-config.json",
      key: "code-json",
      text: '{"name":"retab","enabled":true}',
    });

    renderThumbnail(
      <CodeThumbnail resource={resource} thumbnailKey="code-json" />,
    );

    expect(await screen.findByText('"name": "retab",')).not.toBeNull();
    expect(screen.getByText('"enabled": true')).not.toBeNull();
  });

  it("keeps invalid JSON as raw code text", async () => {
    const resource = textResource({
      fileName: "broken.json",
      key: "code-invalid-json",
      text: '{"name":',
    });

    renderThumbnail(
      <CodeThumbnail resource={resource} thumbnailKey="code-invalid-json" />,
    );

    expect(await screen.findByText('{"name":')).not.toBeNull();
  });

  it("renders JSONL and NDJSON as line-oriented code", async () => {
    const jsonl = textResource({
      fileName: "events.jsonl",
      key: "code-jsonl",
      mimeType: "application/json",
      text: '{"a":1}\n{"b":2}',
    });
    const ndjson = textResource({
      fileName: "events.ndjson",
      key: "code-ndjson",
      text: '{"c":3}\n{"d":4}',
    });

    const view = renderThumbnail(
      <>
        <CodeThumbnail resource={jsonl} thumbnailKey="code-jsonl" />
        <CodeThumbnail resource={ndjson} thumbnailKey="code-ndjson" />
      </>,
    );

    expect(await screen.findByText('{"a":1}')).not.toBeNull();
    expect(screen.getByText('{"b":2}')).not.toBeNull();
    expect(screen.getByText('{"c":3}')).not.toBeNull();
    expect(screen.getByText('{"d":4}')).not.toBeNull();
    expect(
      view.container.querySelectorAll('[data-slot="code-thumbnail"]'),
    ).toHaveLength(2);
  });

  it("routes text category descriptors to text or code thumbnails", async () => {
    const notes = textResource({
      fileName: "notes.txt",
      key: "route-text",
      text: "plain text",
    });
    const config = textResource({
      fileName: "config.json",
      key: "route-code",
      text: '{"mode":"fast"}',
      mimeType: "application/json",
    });

    const view = renderThumbnail(
      <>
        <FirstThumbnailUnit
          resource={notes}
          descriptor={{
            source: { kind: "text", text: "plain text", fileName: "notes.txt" },
            category: "text",
            identityKey: "route-text",
            displayName: "notes.txt",
            fileName: "notes.txt",
            mimeType: "text/plain",
          }}
          thumbnailKey="route-text"
          anchor="top-left"
          onError={vi.fn()}
        />
        <FirstThumbnailUnit
          resource={config}
          descriptor={{
            source: {
              kind: "text",
              text: '{"mode":"fast"}',
              fileName: "config.json",
            },
            category: "text",
            identityKey: "route-code",
            displayName: "config.json",
            fileName: "config.json",
            mimeType: "application/json",
          }}
          thumbnailKey="route-code"
          anchor="top-left"
          onError={vi.fn()}
        />
      </>,
    );

    expect(await screen.findByText("plain text")).not.toBeNull();
    expect(screen.getByText('"mode": "fast"')).not.toBeNull();
    expect(
      view.container.querySelector('[data-slot="text-thumbnail"]'),
    ).not.toBeNull();
    expect(
      view.container.querySelector('[data-slot="code-thumbnail"]'),
    ).not.toBeNull();
  });
});
