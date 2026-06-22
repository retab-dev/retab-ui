// @vitest-environment jsdom

// Behavioral tests for the DOCX thumbnail renderer (DocxFirstPage). It was only
// covered by a structural "live code" assertion; this exercises the actual
// render path: that it renders the first page, hands docx-preview a *copy* of the
// shared cached bytes (so the viewer's cached ArrayBuffer is never detached by
// jszip), applies the fit-to-frame scale, uses the thumbnail-specific render
// options, and surfaces render failures as a ViewerFormatError.

import * as React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDocxDocumentResource,
  resetDocxDocumentResourceCacheForTests,
} from "@/lib/docx-document-resource";
import { isViewerFormatError } from "@/lib/viewer-errors";
import { DocxFirstPage } from "@/components/file-thumbnail/renderers/docx-thumbnail";
import { clearThumbnailCachesForTests } from "@/components/file-thumbnail/thumbnail-test-reset";
import {
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource";

const docxMock = vi.hoisted(() => ({
  renderAsync: vi.fn(),
  calls: [] as Array<{ buffer: ArrayBuffer; options: unknown }>,
}));

vi.mock("docx-preview", () => ({
  renderAsync: docxMock.renderAsync,
}));

let observedWidth = 320;

class ResizeObserverMock {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    this.callback(
      [{ contentRect: { width: observedWidth } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

function response(bytes: Uint8Array, init: ResponseInit = {}) {
  return new Response(new Uint8Array(bytes), init);
}

function docxResource(url = "/thumb.docx", fileName = "thumb.docx") {
  return createViewerResource({ kind: "url", url, fileName });
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? (
      <div data-testid="boundary" />
    ) : (
      this.props.children
    );
  }
}

async function renderThumb(
  resource = docxResource(),
  onError: (error: unknown) => void = () => {},
) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <ErrorBoundary onError={onError}>
        <React.Suspense fallback={<div data-testid="suspense" />}>
          <DocxFirstPage resource={resource} />
        </React.Suspense>
      </ErrorBoundary>,
    );
  });
  return view;
}

beforeEach(() => {
  observedWidth = 320;
  docxMock.calls.length = 0;
  docxMock.renderAsync.mockReset();
  docxMock.renderAsync.mockImplementation(
    async (buffer, host, _styleMap, options) => {
      docxMock.calls.push({ buffer, options });
      const wrapper = document.createElement("div");
      wrapper.className = "docx-wrapper";
      const page = document.createElement("section");
      page.className = "docx";
      page.textContent = "First page body";
      wrapper.append(page);
      host.replaceChildren(wrapper);
    },
  );

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response(Uint8Array.of(7, 8, 9, 10)))),
  );
});

afterEach(() => {
  cleanup();
  resetDocxDocumentResourceCacheForTests();
  clearViewerResourceRegistryForTests();
  clearThumbnailCachesForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DocxFirstPage", () => {
  it("renders the first page of the document", async () => {
    await renderThumb();

    expect(await screen.findByText("First page body")).toBeTruthy();
    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("hands docx-preview a copy of the cached bytes, leaving the shared buffer intact", async () => {
    const resource = docxResource("/copy.docx");
    await renderThumb(resource);

    await waitFor(() => {
      expect(docxMock.calls).toHaveLength(1);
    });

    const cached = await getDocxDocumentResource(resource.content);
    const passed = docxMock.calls[0]!.buffer;

    // A distinct ArrayBuffer instance...
    expect(passed).not.toBe(cached);
    // ...with identical bytes...
    expect(new Uint8Array(passed)).toEqual(new Uint8Array([7, 8, 9, 10]));
    // ...and the shared cached buffer is still readable (not detached/transferred).
    expect(cached.byteLength).toBe(4);
    expect(new Uint8Array(cached)).toEqual(new Uint8Array([7, 8, 9, 10]));
  });

  it("uses the thumbnail render options (no headers/footers/footnotes)", async () => {
    await renderThumb(docxResource("/options.docx"));

    await waitFor(() => {
      expect(docxMock.calls).toHaveLength(1);
    });
    expect(docxMock.calls[0]!.options).toEqual({
      inWrapper: true,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      experimental: true,
    });
  });

  it("scales the page to the measured frame width", async () => {
    observedWidth = 408; // half of the 816px US-Letter page width
    await renderThumb(docxResource("/scale.docx"));
    await screen.findByText("First page body");

    const scaled = document.querySelector<HTMLElement>('[style*="scale("]');
    expect(scaled).toBeTruthy();
    expect(scaled!.style.transform).toBe("scale(0.5)");
    expect(scaled!.style.visibility).toBe("visible");
  });

  it("keeps the rendered page light inside a dark themed thumbnail frame", async () => {
    await act(async () => {
      render(
        <div className="dark text-white">
          <ErrorBoundary onError={() => {}}>
            <React.Suspense fallback={<div data-testid="suspense" />}>
              <DocxFirstPage resource={docxResource("/dark.docx")} />
            </React.Suspense>
          </ErrorBoundary>
        </div>,
      );
    });
    await screen.findByText("First page body");

    const pageHost = document.querySelector<HTMLElement>(
      '[style*="color-scheme: light"]',
    );
    expect(pageHost).toBeTruthy();
    expect(pageHost!.style.backgroundColor).toBe("white");
    expect(pageHost!.style.color).toBe("black");
    expect(pageHost!.style.colorScheme).toBe("light");
    expect(pageHost!.className).toContain("[&_section.docx]:!bg-white");
    expect(pageHost!.className).toContain("[&_section.docx]:!text-black");
  });

  it("surfaces a render failure as a docx ViewerFormatError", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    docxMock.renderAsync.mockReset();
    docxMock.renderAsync.mockRejectedValue(new Error("corrupt docx"));
    let captured: unknown = null;

    await renderThumb(docxResource("/broken.docx"), (error) => {
      captured = error;
    });

    await waitFor(() => {
      expect(screen.getByTestId("boundary")).toBeTruthy();
    });
    expect(isViewerFormatError(captured)).toBe(true);
    expect((captured as { kind?: string }).kind).toBe("render_failed");
  });
});
