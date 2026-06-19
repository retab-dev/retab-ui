// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDocxDocumentResourceCacheForTests } from "@/lib/docx-document-resource";
import { clearViewerResourceRegistryForTests } from "@/registry/new-york-v4/lib/viewer-resource";
import { DocxViewer } from "@/registry/new-york-v4/ui/docx-viewer";

const docxPreviewMock = vi.hoisted(() => ({
  shouldFailImport: false,
  renderAsync: vi.fn(),
}));

vi.mock("docx-preview", () => {
  if (docxPreviewMock.shouldFailImport) throw new Error("chunk failed");
  return { renderAsync: docxPreviewMock.renderAsync };
});

const originalGetAnimations = HTMLElement.prototype.getAnimations;

class ResizeObserverMock {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    Object.defineProperty(target, "clientWidth", {
      configurable: true,
      value: 848,
    });
    this.callback(
      [{ target } as ResizeObserverEntry],
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

function installRenderedDocument(host: HTMLElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "docx-wrapper";

  const page = document.createElement("section");
  page.className = "docx";
  page.getBoundingClientRect = vi.fn(
    () =>
      ({
        bottom: 1056,
        height: 1056,
        left: 0,
        right: 816,
        top: 0,
        width: 816,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
  page.textContent = "Recovered document";
  wrapper.append(page);

  host.replaceChildren(wrapper);
}

async function renderDocx(ui: React.ReactElement) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(ui);
  });
  return view;
}

beforeEach(() => {
  docxPreviewMock.shouldFailImport = false;
  docxPreviewMock.renderAsync.mockReset();
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response(Uint8Array.of(1, 2, 3)))),
  );
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: vi.fn(() => []),
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  resetDocxDocumentResourceCacheForTests();
  clearViewerResourceRegistryForTests();
  if (originalGetAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: originalGetAnimations,
    });
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DocxViewer lazy import", () => {
  it("retries the docx-preview import after a transient chunk failure", async () => {
    docxPreviewMock.shouldFailImport = true;
    docxPreviewMock.renderAsync.mockImplementation(async (_buffer, host) => {
      installRenderedDocument(host);
    });

    await renderDocx(
      <DocxViewer
        source={{
          kind: "url",
          url: "/transient-import.docx",
          fileName: "document.docx",
        }}
      />,
    );

    expect(
      await screen.findByText("Couldn't render this document."),
    ).toBeTruthy();
    docxPreviewMock.shouldFailImport = false;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });

    expect(await screen.findByText("Recovered document")).toBeTruthy();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(docxPreviewMock.renderAsync).toHaveBeenCalledTimes(1);
  });
});
