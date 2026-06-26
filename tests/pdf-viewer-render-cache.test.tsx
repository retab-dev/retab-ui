// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPdfRenderedPageCache,
  readPdfRenderedPageCache,
  writePdfRenderedPageCache,
  type PdfRenderedPageSignature,
} from "@/registry/new-york-v4/ui/pdf-viewer-render-cache";

function signature(
  overrides: Partial<PdfRenderedPageSignature> = {},
): PdfRenderedPageSignature {
  return {
    documentKey: "doc-a",
    pageNumber: 1,
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    viewportWidth: 100,
    viewportHeight: 200,
    ...overrides,
  };
}

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return element;
}

describe("pdf rendered page cache", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      setTransform: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serves a higher resolution same-document page bitmap to a smaller request", () => {
    const cache = createPdfRenderedPageCache("doc-a");
    writePdfRenderedPageCache({
      cache,
      rendered: signature({
        scale: 2,
        viewportWidth: 200,
        viewportHeight: 400,
      }),
      sourceCanvas: canvas(200, 400),
    });

    const cached = readPdfRenderedPageCache(
      cache,
      signature({
        scale: 0.5,
        viewportWidth: 50,
        viewportHeight: 100,
      }),
    );

    expect(cached).not.toBeNull();
    expect(cached?.canvas.width).toBe(200);
    expect(cached?.canvas.height).toBe(400);
  });

  it("does not reuse thumbnail-resolution or cross-document bitmaps for page renders", () => {
    const cache = createPdfRenderedPageCache("doc-a");
    writePdfRenderedPageCache({
      cache,
      rendered: signature({
        scale: 0.5,
        viewportWidth: 50,
        viewportHeight: 100,
      }),
      sourceCanvas: canvas(50, 100),
    });

    expect(readPdfRenderedPageCache(cache, signature())).toBeNull();
    expect(
      readPdfRenderedPageCache(cache, signature({ documentKey: "doc-b" })),
    ).toBeNull();
  });
});
