// @vitest-environment jsdom
import { readFileSync } from "node:fs";
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

import { useMountEffect } from "@/hooks/use-mount-effect";
import { inferCsvDialect } from "@/lib/csv";
import { createViewerResource } from "@/lib/viewer-resource";
import * as FileViewerModule from "@/registry/new-york-v4/ui/file-viewer";
import {
  FileViewerBody,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerInset,
  FileViewerViewport,
  useFileViewerResource,
} from "@/registry/new-york-v4/ui/file-viewer";
import {
  FileViewerControls,
  FileViewerHarness as FileViewer,
  FileViewerMeta,
  FileViewerTitle,
} from "./file-viewer-test-harness";
import {
  descriptorResetKey,
  detectCategory,
  isProseTextDescriptor,
  resolveFileDescriptor,
} from "@/registry/new-york-v4/ui/file-viewer-core";
import { ViewerFallback } from "@/registry/new-york-v4/ui/file-viewer-fallback";
import { createTextResourceCache } from "@/registry/new-york-v4/ui/file-viewer-text-resource";
import { useViewerControlsRegistration } from "@/registry/new-york-v4/ui/viewer-controls";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

const docxRouteMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));
const pdfRouteMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));
const imageRouteMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));
const pptxRouteMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));
const xlsxRouteMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/ui/pdf-viewer", () => ({
  PdfResourceContent: (props: Record<string, unknown>) => {
    pdfRouteMock.props.push(props);
    return "Mock PDF viewer";
  },
}));

vi.mock("@/components/ui/docx-viewer", () => ({
  DocxResourceContent: (props: Record<string, unknown>) => {
    docxRouteMock.props.push(props);
    return "Mock DOCX viewer";
  },
}));

vi.mock("@/components/ui/image-viewer", () => ({
  ImageResourceContent: (props: Record<string, unknown>) => {
    imageRouteMock.props.push(props);
    return "Mock image viewer";
  },
}));

vi.mock("@/components/ui/pptx-viewer", () => ({
  PptxResourceContent: (props: Record<string, unknown>) => {
    pptxRouteMock.props.push(props);
    return "Mock PPTX viewer";
  },
}));

vi.mock("@/components/ui/xlsx-viewer", () => ({
  XlsxResourceContent: (props: Record<string, unknown>) => {
    xlsxRouteMock.props.push(props);
    return "Mock XLSX viewer";
  },
}));

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  docxRouteMock.props.length = 0;
  pdfRouteMock.props.length = 0;
  imageRouteMock.props.length = 0;
  pptxRouteMock.props.length = 0;
  xlsxRouteMock.props.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, init);
}

function urlSource(url: string, fileName?: string, mimeType?: string) {
  return { kind: "url" as const, url, fileName, mimeType };
}

function mockPretextCanvasMeasurement() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as CanvasRenderingContext2D);
}

function blobFileSource(
  fileName: string,
  mimeType: string,
  identityKey = `blob:${fileName}`,
) {
  return {
    kind: "blob" as const,
    blob: new Blob(["file bytes"], { type: mimeType }),
    fileName,
    mimeType,
    identityKey,
  };
}

function markdownBlobSource(
  text: string,
  fileName = "blob-note.md",
  mimeType = "text/markdown",
  identityKey = `blob:${fileName}`,
) {
  return {
    kind: "blob" as const,
    blob: new Blob([text], { type: mimeType }),
    fileName,
    mimeType,
    identityKey,
  };
}

function textSubscription(url: string) {
  const controller = new AbortController();
  const resource = createViewerResource(urlSource(url));
  return {
    content: resource.content,
    fileName: resource.fileName,
    signal: controller.signal,
    controller,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("FileViewer detection helpers", () => {
  it("detects categories by extension before MIME type", () => {
    expect(detectCategory("report.pdf", "text/plain")).toBe("pdf");
    expect(detectCategory("data", "text/csv")).toBe("csv");
    expect(detectCategory("release-notes.md")).toBe("markdown");
    expect(detectCategory("release-notes.markdown")).toBe("markdown");
    expect(detectCategory("release-notes.mdx")).toBe("text");
    expect(detectCategory("download", "text/markdown")).toBe("markdown");
    expect(detectCategory("forwarded.msg")).toBe("email");
    expect(detectCategory("download", "application/vnd.ms-outlook")).toBe(
      "email",
    );
    expect(detectCategory("config", "application/json")).toBe("text");
    expect(detectCategory("events.log", "text/plain")).toBe("text");
    expect(detectCategory("data.json")).toBe("text");
    expect(detectCategory("download", "application/json")).toBe("text");
    expect(detectCategory("image", "image/png")).toBe("image");
    expect(detectCategory("archive.zip", "application/octet-stream")).toBe(
      "unsupported",
    );
  });

  it("resolves one descriptor for routing, fallback, and downloads", () => {
    const descriptor = resolveFileDescriptor({
      source: urlSource("/files/signed?id=1", "report.pdf", "text/plain"),
    });

    expect(descriptor).toEqual({
      source: {
        kind: "url",
        url: "/files/signed?id=1",
        fileName: "report.pdf",
        mimeType: "text/plain",
      },
      displayName: "report.pdf",
      fileName: "report.pdf",
      identityKey: "url:/files/signed?id=1",
      mimeType: "text/plain",
      category: "pdf",
    });
    expect(
      createViewerResource(
        urlSource("/files/signed?id=1", "report.pdf", "text/plain"),
      ).content.directUrl,
    ).toBe("/files/signed?id=1");
    expect(descriptorResetKey(descriptor)).toBe(
      "url:/files/signed?id=1\u0000report.pdf\u0000text/plain\u0000pdf",
    );

    expect(
      resolveFileDescriptor({
        source: urlSource("/files/export", undefined, "text/csv"),
        category: "text",
      }),
    ).toMatchObject({
      displayName: "/files/export",
      fileName: "export",
      category: "text",
    });
  });

  it("resolves non-url text sources without inventing load capabilities", () => {
    const source = {
      kind: "text" as const,
      text: "inline content",
      fileName: "inline.log",
    };
    const descriptor = resolveFileDescriptor({
      source,
    });

    expect(descriptor).toMatchObject({
      category: "text",
      displayName: "inline.log",
      fileName: "inline.log",
    });
    expect(descriptor.identityKey).toBe("text:14:pnnfux");
    expect(descriptorResetKey(descriptor)).toBe(
      "text:14:pnnfux\u0000inline.log\u0000\u0000text",
    );

    const resource = createViewerResource(source);

    expect(resource.content.directUrl).toBeNull();
    expect(resource.content.key).toContain("text:14:pnnfux");
    expect(resource.keys.resource).toContain("text:14:pnnfux");
    expect(resource.content.key).not.toContain("inline content");
  });

  it("keeps prose as the only text subtype", () => {
    expect(
      isProseTextDescriptor(
        resolveFileDescriptor({
          source: urlSource("/notes.txt", "notes.txt", "text/plain"),
        }),
      ),
    ).toBe(true);
    expect(
      isProseTextDescriptor(
        resolveFileDescriptor({
          source: urlSource("/events.log", "events.log", "text/plain"),
        }),
      ),
    ).toBe(false);
    expect(
      isProseTextDescriptor(
        resolveFileDescriptor({
          source: urlSource("/download", "download", "application/json"),
        }),
      ),
    ).toBe(false);
    expect(
      resolveFileDescriptor({
        source: urlSource("/notes.txt", "notes.txt", "text/plain"),
      }).category,
    ).toBe("text");
    expect(
      resolveFileDescriptor({
        source: urlSource("/events.log", "events.log", "text/plain"),
      }).category,
    ).toBe("text");
    expect(
      resolveFileDescriptor({
        source: urlSource("/download", "download", "application/json"),
      }).category,
    ).toBe("text");
  });

  it("resolves CSV and TSV dialects", () => {
    expect(inferCsvDialect({ fileName: "data.csv" }).delimiter).toBe(",");
    expect(inferCsvDialect({ fileName: "data.tsv" }).delimiter).toBe("\t");
    expect(
      inferCsvDialect({
        fileName: "download",
        mimeType: "text/tab-separated-values",
      }).delimiter,
    ).toBe("\t");
  });

  it("keeps HTML text loading independent from the Markdown adapter", () => {
    const source = readFileSync(
      "registry/new-york-v4/ui/file-viewer-html-viewer.tsx",
      "utf8",
    );

    expect(source).toContain("./file-viewer-text-resource");
    expect(source).not.toContain("./file-viewer-markdown-viewer");
  });

  it("routes DOCX through the canonical resource viewer", () => {
    const source = readFileSync(
      "registry/new-york-v4/ui/file-viewer-route.tsx",
      "utf8",
    );

    expect(source).toContain("<DocxResourceContent");
    expect(source).not.toContain("<DocxViewer");
    expect(source).not.toContain("source={descriptor.source}");
  });

  it("treats text as a first-class renderer, never the unsupported fallback", () => {
    const source = readFileSync(
      "registry/new-york-v4/ui/file-viewer-route.tsx",
      "utf8",
    );
    // `text` is an entry in the renderer table, so it always resolves to a
    // viewer rather than falling through to the UnsupportedCard fallback...
    expect(source).toMatch(/text:\s*renderTextViewer/);
    // ...and it is a permitted category for raw text-kind sources too.
    const allowlist = source.slice(
      source.indexOf("TEXT_SOURCE_CATEGORIES"),
      source.indexOf("const RENDERERS"),
    );
    expect(allowlist).toContain('"text"');
  });

  it("keeps route-owned document adapters resource-first", () => {
    const fileViewerSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer.tsx",
      "utf8",
    );
    const fileViewerFrameSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-frame.tsx",
      "utf8",
    );
    const fileViewerPreviewSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-preview.tsx",
      "utf8",
    );
    const documentSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-document.tsx",
      "utf8",
    );
    const routeSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-route.tsx",
      "utf8",
    );
    const fallbackSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-fallback.tsx",
      "utf8",
    );
    const zoomSource = readFileSync(
      "registry/new-york-v4/ui/viewer-zoom.tsx",
      "utf8",
    );
    const csvAdapterSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-csv-viewer.tsx",
      "utf8",
    );

    expect(documentSource).toContain("ViewerFallback");
    expect(routeSource).toContain("UnsupportedCard");
    expect(documentSource).not.toContain("ViewerResourceFallback");
    expect(routeSource).not.toContain("UnsupportedResourceCard");
    expect(documentSource).not.toMatch(
      /<ViewerFallback\b(?:(?!\/>)[\s\S])*\b(?:category|fileName|url|downloadAction)=/,
    );
    expect(routeSource).not.toMatch(
      /<UnsupportedCard\b(?:(?!\/>)[\s\S])*\b(?:category|fileName|url|downloadAction)=/,
    );
    expect(routeSource).not.toMatch(
      /<CsvFileContent\b(?:(?!\/>)[\s\S])*\b(?:source|fileName|mimeType)=/,
    );
    expect(routeSource).toContain("PdfResourceContent");
    expect(routeSource).toContain("ImageResourceContent");
    expect(routeSource).toContain("DocxResourceContent");
    expect(routeSource).toContain("PptxResourceContent");
    expect(routeSource).toContain("XlsxResourceContent");
    expect(fileViewerSource).not.toContain("slots={slots}");
    expect(fileViewerSource).not.toContain("renderWithViewerShellSlots");
    expect(fileViewerSource).not.toContain("ViewerShell");
    expect(routeSource).toContain(
      'import("@/components/ui/text-viewer-chenglou")',
    );
    expect(routeSource).toContain('import("@/components/ui/markdown-viewer")');
    expect(routeSource).not.toContain(
      'import("@/components/ui/markdown-document-viewer")',
    );
    expect(routeSource).toContain('import("@/components/ui/code-viewer")');
    expect(routeSource).not.toContain('mode="markdown"');
    expect(routeSource).toContain('mode="text"');
    expect(routeSource).not.toContain("MarkdownDocViewer");
    expect(routeSource).not.toContain("file-viewer-markdown-viewer");
    expect(routeSource).not.toContain("loadMarkdownHtml");
    expect(fileViewerSource).not.toMatch(
      /<(?:PdfViewer|ImageViewer|DocxViewer|PptxViewer|XlsxViewer)\b/,
    );
    expect(fileViewerSource).not.toMatch(
      /<(?:PdfResourceContent|ImageResourceContent|DocxResourceContent|PptxResourceContent|XlsxResourceContent)\b(?:(?!\/>)[\s\S])*\bsource=/,
    );
    expect(fallbackSource).not.toContain("ResourceDocShell");
    expect(fallbackSource).not.toContain("export function DocShell");
    expect(fallbackSource).not.toContain("ViewerResourceFallback");
    expect(fallbackSource).not.toContain("UnsupportedResourceCard");
    expect(fallbackSource).not.toContain("fileName: string");
    expect(fallbackSource).not.toContain("url?: string");
    expect(fallbackSource).not.toContain("downloadAction?:");
    expect(fallbackSource).not.toContain("createHrefDownloadAction");
    expect(zoomSource).not.toContain("ZoomActionsSkeleton");
    expect(fileViewerFrameSource).toContain("<ViewerRoot");
    expect(fileViewerPreviewSource).toContain("<FileViewerInset");
    expect(fileViewerPreviewSource).toContain("<FileViewerDocument");
    expect(csvAdapterSource).toMatch(/resource: ViewerResource/);
    expect(csvAdapterSource).not.toContain("ResourceDocShell");
    expect(csvAdapterSource).not.toMatch(/\bfileName:\s*string\b/);
    expect(csvAdapterSource).not.toMatch(/\bmimeType\?:\s*string\b/);
  });

  it("exports the easy API plus shadcn-style FileViewer named parts", () => {
    const exports = Object.keys(FileViewerModule);

    expect(exports).toEqual(
      expect.arrayContaining([
        "FileViewer",
        "FileViewerBody",
        "FileViewerDocument",
        "FileViewerHeader",
        "FileViewerHeaderEnd",
        "FileViewerHeaderStart",
        "FileViewerIdentity",
        "FileViewerProvider",
        "FileViewerPreview",
        "FileViewerSidebar",
        "FileViewerSidebarTrigger",
        "FileViewerInset",
        "FileViewerToolbar",
        "FileViewerViewport",
        "detectCategory",
        "useFileViewerResource",
      ]),
    );
    expect(exports).not.toContain("FileHeader");
    expect(exports).not.toContain("FileHeaderControls");
    expect(exports).not.toContain("FileHeaderMeta");
    expect(exports).not.toContain("FileHeaderTitle");
    expect(exports).not.toContain("FileViewerDocumentRenderer");
    expect(exports).not.toContain("FileViewerControls");
    expect(exports).not.toContain("FileViewerMeta");
    expect(exports).not.toContain("FileViewerTitle");
    expect(exports).not.toContain("InternalFileViewerDocument");
    expect(exports).not.toContain("FileViewerRoute");
    expect(exports).not.toContain("useOptionalFileViewerResource");
  });

  it("renders FileViewerBody as the file viewer body region", () => {
    const { container } = render(<FileViewerBody />);

    expect(
      container.querySelector('[data-slot="file-viewer-body"]'),
    ).toBeTruthy();
  });

  it("requires FileViewerDocument to be rendered inside FileViewer", () => {
    expect(() => render(<FileViewerDocument />)).toThrow(
      "FileViewerDocument must be rendered inside FileViewerViewport.",
    );
  });

  it("renders default FileViewer through the public shell anatomy", async () => {
    const { container } = render(
      <FileViewer source={urlSource("/files/default.pdf", "default.pdf")} />,
    );

    expect(
      container.querySelector('[data-slot="file-viewer-root"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="file-viewer-header"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="file-viewer-body"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="file-viewer-inset"]'),
    ).toBeTruthy();
    expect(
      container.querySelectorAll('[data-slot="file-viewer-toolbar"]'),
    ).toHaveLength(1);
    expect(screen.getByText("default.pdf")).toBeTruthy();
    expect(screen.getByText("pdf")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download" })).toBeTruthy();
    expect(await screen.findByText("Mock PDF viewer")).toBeTruthy();
    expect(pdfRouteMock.props).toHaveLength(1);
    expect(pdfRouteMock.props[0]).toMatchObject({
      bare: true,
      controls: false,
      download: true,
    });
  });

  it("routes composed FileViewer content through the same shell document", async () => {
    const { container } = render(
      <FileViewer source={urlSource("/files/composed.pdf", "composed.pdf")}>
        <FileViewerHeader />
        <FileViewerBody>
          <FileViewerInset>
            <FileViewerViewport>
              <FileViewerDocument className="composed-file" />
            </FileViewerViewport>
          </FileViewerInset>
        </FileViewerBody>
      </FileViewer>,
    );

    expect(
      container.querySelector('[data-slot="file-viewer-header"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="file-viewer-root"]'),
    ).toBeTruthy();
    expect(screen.getByText("composed.pdf")).toBeTruthy();
    expect(screen.getByText("pdf")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download" })).toBeTruthy();
    expect(await screen.findByText("Mock PDF viewer")).toBeTruthy();
    expect(pdfRouteMock.props).toHaveLength(1);
    expect(pdfRouteMock.props[0]).toMatchObject({
      bare: true,
      className: "h-full composed-file",
      controls: false,
      download: true,
    });
    expect(
      (pdfRouteMock.props[0]?.resource as { fileName: string }).fileName,
    ).toBe("composed.pdf");
  });

  it("uses file viewer size hints for image and pptx fallback skeletons", () => {
    const imageResource = createViewerResource(
      urlSource("/files/scan.png", "scan.png"),
    );
    const slideResource = createViewerResource(
      urlSource("/files/deck.pptx", "deck.pptx"),
    );
    const { container, rerender } = render(
      <ViewerFallback
        resource={imageResource}
        bare
        fallbackFrameSize={{ width: 1224, height: 1584 }}
      />,
    );

    expect(
      (
        container.querySelector(
          '[data-slot="image-frame-skeleton"]',
        ) as HTMLElement
      ).style.aspectRatio,
    ).toBe("1224 / 1584");

    rerender(
      <ViewerFallback
        resource={slideResource}
        bare
        fallbackSlideSize={{ width: 960, height: 540 }}
      />,
    );

    expect(
      (
        container.querySelector(
          '[data-slot="pptx-slide-skeleton"]',
        ) as HTMLElement
      ).style.aspectRatio,
    ).toBe("960 / 540");
  });

  it("forwards file viewer size hints to image and pptx renderers", async () => {
    const { unmount } = render(
      <FileViewer
        source={urlSource("/files/scan.png", "scan.png")}
        fallbackFrameSize={{ width: 1224, height: 1584 }}
        bare
      />,
    );

    expect(await screen.findByText("Mock image viewer")).toBeTruthy();
    expect(imageRouteMock.props[0]).toMatchObject({
      fallbackFrameSize: { width: 1224, height: 1584 },
    });

    unmount();
    imageRouteMock.props.length = 0;

    render(
      <FileViewer
        source={urlSource("/files/deck.pptx", "deck.pptx")}
        fallbackSlideSize={{ width: 960, height: 540 }}
        bare
      />,
    );

    expect(await screen.findByText("Mock PPTX viewer")).toBeTruthy();
    expect(pptxRouteMock.props[0]).toMatchObject({
      fallbackSlideSize: { width: 960, height: 540 },
    });
  });

  it("renders registered file header controls without rebuilding the header", async () => {
    function RegisterControls() {
      const registerControls = useViewerControlsRegistration();

      useMountEffect(() => {
        registerControls?.({
          position: { kind: "page", current: 2, total: 5 },
          downloads: [],
        });
        return () => registerControls?.(null);
      });

      return null;
    }

    render(
      <FileViewer source={urlSource("/files/report.pdf", "report.pdf")}>
        <FileViewerHeader>
          <FileViewerTitle />
          <FileViewerMeta />
          <FileViewerControls />
        </FileViewerHeader>
        <RegisterControls />
      </FileViewer>,
    );

    expect(screen.getByText("report.pdf")).toBeTruthy();
    expect(screen.getByText("pdf")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Page 2 of 5")).toBeTruthy());
  });

  it("does not duplicate renderer title or subtitle in FileViewerControls", async () => {
    function RegisterControls() {
      const registerControls = useViewerControlsRegistration();

      useMountEffect(() => {
        registerControls?.({
          title: "Renderer title",
          subtitle: "Renderer subtitle",
          position: { kind: "page", current: 2, total: 5 },
          downloads: [],
        });
        return () => registerControls?.(null);
      });

      return null;
    }

    render(
      <FileViewer source={urlSource("/files/report.pdf", "report.pdf")}>
        <FileViewerHeader>
          <FileViewerTitle />
          <FileViewerMeta />
          <FileViewerControls />
        </FileViewerHeader>
        <RegisterControls />
      </FileViewer>,
    );

    await waitFor(() => expect(screen.getByText("Page 2 of 5")).toBeTruthy());
    expect(screen.getByText("report.pdf")).toBeTruthy();
    expect(screen.getByText("pdf")).toBeTruthy();
    expect(screen.queryByText("Renderer title")).toBeNull();
    expect(screen.queryByText("Renderer subtitle")).toBeNull();
  });

  it("keeps registered controls authoritative over passthrough props", async () => {
    function RegisterControls() {
      const registerControls = useViewerControlsRegistration();

      useMountEffect(() => {
        registerControls?.({
          position: { kind: "page", current: 2, total: 5 },
          downloads: [],
        });
        return () => registerControls?.(null);
      });

      return null;
    }

    render(
      <FileViewer source={urlSource("/files/report.pdf", "report.pdf")}>
        <FileViewerHeader>
          <FileViewerTitle />
          <FileViewerControls
            {...({ position: { label: "Wrong position" } } as object)}
          />
        </FileViewerHeader>
        <RegisterControls />
      </FileViewer>,
    );

    await waitFor(() => expect(screen.getByText("Page 2 of 5")).toBeTruthy());
    expect(screen.queryByText("Wrong position")).toBeNull();
  });

  it("does not rerender file resource consumers when registered controls change", async () => {
    const resourceRenders = vi.fn();

    function ResourceProbe() {
      const resource = useFileViewerResource();
      resourceRenders(resource.fileName);
      return null;
    }

    function RegisterControls() {
      const [current, setCurrent] = React.useState(1);
      const registerControls = useViewerControlsRegistration();

      useKeyedMountEffect(joinEffectKey([current, registerControls]), () => {
        registerControls?.({
          position: { kind: "page", current, total: 5 },
          downloads: [],
        });
        return () => registerControls?.(null);
      });

      return <button onClick={() => setCurrent(2)}>Next page</button>;
    }

    render(
      <FileViewer source={urlSource("/files/report.pdf", "report.pdf")}>
        <FileViewerHeader>
          <FileViewerTitle />
          <FileViewerControls />
        </FileViewerHeader>
        <ResourceProbe />
        <RegisterControls />
      </FileViewer>,
    );

    await waitFor(() => expect(screen.getByText("Page 1 of 5")).toBeTruthy());
    resourceRenders.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => expect(screen.getByText("Page 2 of 5")).toBeTruthy());
    expect(resourceRenders).not.toHaveBeenCalled();
  });

  it("ignores stale file header control cleanup from an inactive registration", async () => {
    function RegisterControls({ current }: { current: number }) {
      const registerControls = useViewerControlsRegistration();

      useKeyedMountEffect(joinEffectKey([current, registerControls]), () => {
        registerControls?.({
          position: { kind: "page", current, total: 5 },
          downloads: [],
        });
        return () => registerControls?.(null);
      });

      return null;
    }

    function Harness({ showFirst }: { showFirst: boolean }) {
      return (
        <FileViewer source={urlSource("/files/report.pdf", "report.pdf")}>
          <FileViewerHeader>
            <FileViewerTitle />
            <FileViewerControls />
          </FileViewerHeader>
          {showFirst ? <RegisterControls current={1} /> : null}
          <RegisterControls current={2} />
        </FileViewer>
      );
    }

    const { rerender } = render(<Harness showFirst />);

    await waitFor(() => expect(screen.getByText("Page 2 of 5")).toBeTruthy());

    rerender(<Harness showFirst={false} />);

    await waitFor(() => expect(screen.getByText("Page 2 of 5")).toBeTruthy());
  });

  it("clears registered file header controls when the file descriptor changes", async () => {
    function RegisterControls() {
      const registerControls = useViewerControlsRegistration();

      useMountEffect(() => {
        registerControls?.({
          position: { kind: "page", current: 2, total: 5 },
          downloads: [],
        });
        return () => registerControls?.(null);
      });

      return null;
    }

    function Harness({
      register,
      source,
    }: {
      register: boolean;
      source: ReturnType<typeof urlSource>;
    }) {
      return (
        <FileViewer source={source}>
          <FileViewerHeader>
            <FileViewerTitle />
            <FileViewerControls />
          </FileViewerHeader>
          <FileViewerBody>
            <FileViewerInset>
              <FileViewerViewport>
                <FileViewerDocument />
              </FileViewerViewport>
            </FileViewerInset>
          </FileViewerBody>
          {register ? <RegisterControls /> : null}
        </FileViewer>
      );
    }

    const { rerender } = render(
      <Harness
        register
        source={urlSource("/files/report.pdf", "report.pdf")}
      />,
    );

    await waitFor(() => expect(screen.getByText("Page 2 of 5")).toBeTruthy());

    rerender(
      <Harness
        register={false}
        source={urlSource("/files/notes.txt", "notes.txt")}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Page 2 of 5")).toBeNull();
    });
    expect(screen.getByText("notes.txt")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download" })).toBeTruthy();
  });

  it("keeps abort subscriptions in the neutral async module", () => {
    const asyncSource = readFileSync(
      "registry/new-york-v4/ui/viewer-abortable-request.ts",
      "utf8",
    );
    const lruCacheSource = readFileSync(
      "registry/new-york-v4/ui/viewer-lru-cache.ts",
      "utf8",
    );
    const textResourceSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-text-resource.ts",
      "utf8",
    );

    expect(asyncSource).toContain("subscribeToAbortableRequest");
    expect(lruCacheSource).not.toContain("AbortController");
    expect(lruCacheSource).not.toContain("subscribeToAbortableRequest");
    expect(textResourceSource).toContain("subscribeToAbortableRequest");
  });
});

describe("FileViewer text resources", () => {
  it("evicts failed text promises so callers can retry the same source", async () => {
    const cache = createTextResourceCache();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("nope", { status: 500 }))
      .mockResolvedValueOnce(response("ok\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(cache.load(textSubscription("/retry.txt"))).rejects.toThrow(
      "Failed to load resource: 500",
    );
    await expect(cache.load(textSubscription("/retry.txt"))).resolves.toBe(
      "ok\n",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts a shared text resource fetch only after every subscriber aborts", async () => {
    const cache = createTextResourceCache();
    const pending = deferred<Response>();
    let fetchSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_src: string, init?: RequestInit) => {
        fetchSignal = init?.signal ?? undefined;
        fetchSignal?.addEventListener("abort", () => {
          pending.reject(new DOMException("Aborted", "AbortError"));
        });
        return pending.promise;
      }),
    );

    const first = textSubscription("/shared-resource.md");
    const second = textSubscription("/shared-resource.md");
    const firstPromise = cache.load(first);
    const secondPromise = cache.load(second);

    first.controller.abort();
    await expect(firstPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchSignal?.aborted).toBe(false);

    second.controller.abort();
    await expect(secondPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchSignal?.aborted).toBe(true);
    expect(cache.size()).toBe(0);
  });
});

describe("FileViewer text rendering", () => {
  it.each([
    {
      label: "PDF",
      source: urlSource("/files/report", "report.pdf", "text/plain"),
      text: "Mock PDF viewer",
      props: pdfRouteMock.props,
    },
    {
      label: "image",
      source: urlSource("/files/diagram", "diagram.png"),
      text: "Mock image viewer",
      props: imageRouteMock.props,
    },
    {
      label: "PPTX",
      source: urlSource(
        "/files/deck",
        undefined,
        "application/vnd.ms-powerpoint",
      ),
      text: "Mock PPTX viewer",
      props: pptxRouteMock.props,
    },
    {
      label: "XLSX",
      source: urlSource("/files/sheet", "sheet.xlsm"),
      text: "Mock XLSX viewer",
      props: xlsxRouteMock.props,
    },
  ])(
    "routes URL $label files to the matching resource viewer",
    async ({ source, text, props }) => {
      render(<FileViewer source={source} className="viewer-frame" bare />);

      expect(await screen.findByText(text)).toBeTruthy();
      expect(props).toHaveLength(1);
      expect(props[0]).toMatchObject({
        bare: true,
        controls: true,
        download: true,
      });
      expect(
        (props[0]?.resource as { content: { directUrl: string | null } })
          .content.directUrl,
      ).toBe(source.url);
      expect("source" in props[0]!).toBe(false);
    },
  );

  it("renders bare FileViewer without children as only the routed document", async () => {
    const { container } = render(
      <FileViewer
        source={urlSource("/files/report.pdf", "report.pdf")}
        className="viewer-frame"
        bare
      />,
    );

    expect(await screen.findByText("Mock PDF viewer")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="file-viewer-root"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="file-viewer-header"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="file-viewer-body"]'),
    ).toBeNull();
    expect(pdfRouteMock.props.at(-1)).toMatchObject({
      bare: true,
      controls: true,
      download: true,
    });
  });

  it.each([
    {
      label: "PDF",
      source: blobFileSource("scan.pdf", "application/pdf"),
      text: "Mock PDF viewer",
      props: pdfRouteMock.props,
    },
    {
      label: "image",
      source: blobFileSource("photo.webp", "image/webp"),
      text: "Mock image viewer",
      props: imageRouteMock.props,
    },
    {
      label: "PPTX",
      source: blobFileSource(
        "deck.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
      text: "Mock PPTX viewer",
      props: pptxRouteMock.props,
    },
    {
      label: "DOCX",
      source: blobFileSource(
        "doc.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
      text: "Mock DOCX viewer",
      props: docxRouteMock.props,
    },
    {
      label: "XLSX",
      source: blobFileSource(
        "book.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
      text: "Mock XLSX viewer",
      props: xlsxRouteMock.props,
    },
  ])(
    "routes Blob $label files without object URLs",
    async ({ source, text, props }) => {
      render(<FileViewer source={source} isolateStyles />);

      expect(await screen.findByText(text)).toBeTruthy();
      expect(props).toHaveLength(1);
      if (source.fileName.endsWith(".xlsx")) {
        expect(props[0]).toMatchObject({
          controls: false,
          download: true,
          isolateStyles: true,
        });
      } else {
        expect(props[0]).toMatchObject({ controls: false, download: true });
        expect("isolateStyles" in props[0]!).toBe(false);
      }
      expect(
        (props[0]?.resource as { content: { directUrl: string | null } })
          .content.directUrl,
      ).toBeNull();
      expect("source" in props[0]!).toBe(false);
    },
  );

  it("routes extensionless URL files through the explicit viewer category", async () => {
    render(
      <FileViewer
        source={urlSource("/signed/file?id=1", "download")}
        as="pdf"
      />,
    );

    expect(await screen.findByText("Mock PDF viewer")).toBeTruthy();
    expect(pdfRouteMock.props).toHaveLength(1);
    const resource = pdfRouteMock.props[0]?.resource as {
      content: { directUrl: string | null };
      descriptor: { category: string };
      fileName: string;
    };
    expect(resource.content.directUrl).toBe("/signed/file?id=1");
    expect(resource.fileName).toBe("download");
    expect(resource.descriptor.category).toBe("pdf");
    expect(pdfRouteMock.props[0]).toMatchObject({
      controls: false,
      download: true,
    });
  });

  it("renders DOCX files through the lazy resource viewer", async () => {
    render(<FileViewer source={urlSource("/report.docx", "report.docx")} />);

    expect(await screen.findByText("Mock DOCX viewer")).toBeTruthy();
    expect(docxRouteMock.props).toHaveLength(1);
    const docxResource = docxRouteMock.props[0]?.resource as {
      content: { directUrl: string | null };
      fileName: string;
      sourceKind: string;
    };
    expect(docxResource).toMatchObject({
      fileName: "report.docx",
      sourceKind: "url",
    });
    expect(docxResource.content).toMatchObject({
      directUrl: "/report.docx",
    });
    expect("source" in docxRouteMock.props[0]!).toBe(false);
    expect(docxRouteMock.props[0]).toMatchObject({
      controls: false,
      download: true,
    });
  });

  it("loads and renders text content under React StrictMode", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            response("first log line\nsecond log line\n", { status: 200 }),
          ),
        ),
      );

      const { container } = render(
        <React.StrictMode>
          <FileViewer source={urlSource("/strict.log", "strict.log")} />
        </React.StrictMode>,
      );

      expect(
        await screen.findByText("first log line", undefined, {
          timeout: 5_000,
        }),
      ).toBeTruthy();
      expect(screen.getByText("second log line")).toBeTruthy();
      expect(container.querySelector('[data-line-number="3"]')).toBeTruthy();
      expect(screen.queryByText("3 lines")).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("routes prose text files through the wrapped Text Viewer without line numbers", async () => {
    mockPretextCanvasMeasurement();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("first note\nsecond note\n"))),
    );

    const { container } = render(
      <FileViewer source={urlSource("/notes.txt", "notes.txt")} />,
    );

    expect(
      await screen.findByText("first note", undefined, { timeout: 5_000 }),
    ).toBeTruthy();
    expect(screen.getByText("second note")).toBeTruthy();
    expect(container.querySelector('[data-slot="text-viewer"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="code-viewer"]')).toBeNull();
    expect(container.querySelector(".fv-markdown")).toBeNull();
    expect(container.querySelector("[data-line-number]")).toBeNull();
  });

  it("routes markdown files through the Markdown Viewer", async () => {
    mockPretextCanvasMeasurement();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("# Release\n\nBody copy\n"))),
    );

    const { container } = render(
      <FileViewer source={urlSource("/release.md", "release.md")} />,
    );

    expect(
      await screen.findByRole(
        "heading",
        { name: "Release" },
        { timeout: 5_000 },
      ),
    ).toBeTruthy();
    expect(screen.getByText("Body copy")).toBeTruthy();
    expect(container.querySelector('[data-slot="text-viewer"]')).toBeTruthy();
    expect(
      container.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-slot="markdown-document-virtual-canvas"]'),
    ).toBeNull();
    expect(container.querySelector('[data-slot="code-viewer"]')).toBeNull();
    expect(container.querySelector(".fv-markdown")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("routes extensionless Markdown MIME URL sources through the Markdown Viewer", async () => {
    mockPretextCanvasMeasurement();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("# MIME Markdown\n\nBody copy\n"))),
    );

    const { container } = render(
      <FileViewer
        source={urlSource("/download?id=release", "download", "text/markdown")}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "MIME Markdown" }),
    ).toBeTruthy();
    expect(screen.getByText("Body copy")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-slot="code-viewer"]')).toBeNull();
    expect(container.querySelector(".fv-markdown")).toBeNull();
  });

  it("routes MDX files through the standalone Code Viewer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(response("import X from './x'\n\n# Title\n<X />")),
      ),
    );

    const { container } = render(
      <FileViewer source={urlSource("/component.mdx", "component.mdx")} />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-slot="code-viewer"]')).toBeTruthy();
    });
    expect(container.querySelector('[data-slot="text-viewer"]')).toBeNull();
  });

  it("routes source-code text files through the standalone Code Viewer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("export const answer = 42"))),
    );

    const { container } = render(
      <FileViewer source={urlSource("/use-answer.ts", "use-answer.ts")} />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-slot="code-viewer"]')).toBeTruthy();
    });
    expect(container.querySelector('[data-slot="text-viewer"]')).toBeNull();
  });

  it("routes logs through the standalone Code Viewer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("first log line\nsecond log line"))),
    );

    const { container } = render(
      <FileViewer source={urlSource("/events.log", "events.log")} />,
    );

    expect(await screen.findByText("first log line")).toBeTruthy();
    expect(screen.getByText("second log line")).toBeTruthy();
    expect(container.querySelector('[data-slot="code-viewer"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="text-viewer"]')).toBeNull();
  });

  it("routes JSON through the standalone Code Viewer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response('{"answer":42}'))),
    );

    const { container } = render(
      <FileViewer source={urlSource("/data.json", "data.json")} />,
    );

    await waitFor(() => {
      expect(container.querySelector(".cv-token-property")?.textContent).toBe(
        '"answer"',
      );
    });
    expect(container.querySelector(".cv-token-number")?.textContent).toBe("42");
    expect(container.querySelector('[data-slot="code-viewer"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="text-viewer"]')).toBeNull();
  });

  it("routes extensionless JSON MIME sources through the standalone Code Viewer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response('{"mode":"code"}'))),
    );

    const { container } = render(
      <FileViewer
        source={urlSource("/api/config", "download", "application/json")}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-slot="code-viewer"]')).toBeTruthy();
    });
    expect(container.querySelector('[data-slot="text-viewer"]')).toBeNull();
  });

  it.each([
    {
      name: "lone CR",
      url: "/mixed-cr-lines.log",
      text: "first line\rsecond line",
      expectedMeta: "2 lines",
    },
    {
      name: "Unicode line and paragraph separators",
      url: "/mixed-unicode-lines.log",
      text: "first line\u2028second line\u2029third line",
      expectedMeta: "3 lines",
    },
  ])("splits streamed text on $name", async ({ url, text, expectedMeta }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response(text, { status: 200 }))),
    );

    const { container } = render(
      <FileViewer source={urlSource(url, "mixed.log")} />,
    );

    expect(await screen.findByText("first line")).toBeTruthy();
    expect(screen.getByText("second line")).toBeTruthy();
    expect(
      container.querySelector(
        `[data-line-number="${Number.parseInt(expectedMeta, 10)}"]`,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(expectedMeta)).toBeNull();
  });

  it("keeps the download action in the code controls", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(response("content\n", { status: 200 }))),
      );

      render(
        <FileViewer source={urlSource("/long-name.log", "long-name.log")} />,
      );

      await screen.findByText("content");
      expect(screen.getByRole("link", { name: "Download" })).toBeTruthy();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps stale code loads from rendering after switching files", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const oldResponse = deferred<Response>();
      const fetchMock = vi.fn((src: string, init?: RequestInit) => {
        if (src === "/old.log") return oldResponse.promise;
        return Promise.resolve(response("new\n", { status: 200 }));
      });
      vi.stubGlobal("fetch", fetchMock);

      const { rerender } = render(
        <FileViewer source={urlSource("/old.log", "old.log")} />,
      );

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      rerender(<FileViewer source={urlSource("/new.log", "new.log")} />);

      await screen.findByText("new");

      oldResponse.resolve(response("old\n", { status: 200 }));
      await Promise.resolve();
      expect(screen.queryByText("old")).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([
    {
      fileName: "old.html",
      nextFileName: "new.html",
      nextBody: "<p>New</p>",
    },
  ])(
    "aborts a pending markup fetch when switching from $fileName",
    async ({ fileName, nextFileName, nextBody }) => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      try {
        const oldResponse = deferred<Response>();
        let oldSignal: AbortSignal | undefined;
        vi.stubGlobal(
          "fetch",
          vi.fn((src: string, init?: RequestInit) => {
            if (src.includes("old")) {
              oldSignal = init?.signal ?? undefined;
              oldSignal?.addEventListener("abort", () => {
                oldResponse.reject(new DOMException("Aborted", "AbortError"));
              });
              return oldResponse.promise;
            }
            return Promise.resolve(response(nextBody, { status: 200 }));
          }),
        );

        const { rerender } = render(
          <FileViewer source={urlSource(`/${fileName}`, fileName)} />,
        );

        await waitFor(() => expect(oldSignal).toBeTruthy());
        rerender(
          <FileViewer source={urlSource(`/${nextFileName}`, nextFileName)} />,
        );

        await waitFor(() => expect(oldSignal?.aborted).toBe(true));
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  it("keeps download access on load errors and recovers on descriptor change", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response("bad", { status: 500 }))
        .mockResolvedValueOnce(response("good\n", { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      const { rerender } = render(
        <FileViewer source={urlSource("/bad.log", "bad.log")} />,
      );

      expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();
      expect(screen.getByRole("alert").getAttribute("data-error-message")).toBe(
        "Failed to load resource: 500",
      );
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download"),
      ).toBe("bad.log");

      rerender(<FileViewer source={urlSource("/good.log", "good.log")} />);

      expect(await screen.findByText("good")).toBeTruthy();
      expect(screen.queryByText("Failed to load file: 500.")).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("renders inline markdown text sources through the resource route", async () => {
    mockPretextCanvasMeasurement();
    await act(async () => {
      render(
        <FileViewer
          source={{
            kind: "text",
            text: "# Inline note\n\nBody copy",
            fileName: "note.md",
            mimeType: "text/markdown",
          }}
        />,
      );
    });

    expect(await screen.findByText("Inline note")).toBeTruthy();
    expect(screen.getByText("Body copy")).toBeTruthy();
    expect(document.querySelector('[data-slot="text-viewer"]')).toBeTruthy();
    expect(
      document.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeTruthy();
    expect(document.querySelector('[data-slot="code-viewer"]')).toBeNull();
    expect(document.querySelector(".fv-markdown")).toBeNull();
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
  });

  it("renders inline MIME-only markdown text sources through the resource route", async () => {
    mockPretextCanvasMeasurement();
    await act(async () => {
      render(
        <FileViewer
          source={{
            kind: "text",
            text: "# Inline MIME note\n\nBody copy",
            fileName: "download",
            mimeType: "text/markdown",
          }}
        />,
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Inline MIME note" }),
    ).toBeTruthy();
    expect(screen.getByText("Body copy")).toBeTruthy();
    expect(
      document.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeTruthy();
    expect(document.querySelector('[data-slot="code-viewer"]')).toBeNull();
    expect(document.querySelector(".fv-markdown")).toBeNull();
  });

  it("renders Blob markdown sources through the resource route", async () => {
    mockPretextCanvasMeasurement();
    render(
      <FileViewer
        source={markdownBlobSource("# Blob Markdown\n\nBody copy\n")}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Blob Markdown" }),
    ).toBeTruthy();
    expect(screen.getByText("Body copy")).toBeTruthy();
    expect(
      document.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeTruthy();
    expect(document.querySelector('[data-slot="code-viewer"]')).toBeNull();
    expect(document.querySelector(".fv-markdown")).toBeNull();
  });

  it("renders MIME-only Blob markdown sources through the resource route", async () => {
    mockPretextCanvasMeasurement();
    render(
      <FileViewer
        source={markdownBlobSource(
          "# Blob MIME Markdown\n\nBody copy\n",
          "download",
          "text/markdown; charset=utf-8",
          "blob:download-markdown",
        )}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Blob MIME Markdown" }),
    ).toBeTruthy();
    expect(screen.getByText("Body copy")).toBeTruthy();
    expect(
      document.querySelector('[data-slot="markdown-virtual-canvas"]'),
    ).toBeTruthy();
    expect(document.querySelector('[data-slot="code-viewer"]')).toBeNull();
    expect(document.querySelector(".fv-markdown")).toBeNull();
  });

  it("renders inline CSV text sources through the resource route", async () => {
    render(
      <FileViewer
        source={{
          kind: "text",
          text: "name,value\nalpha,42\n",
          fileName: "data.csv",
          mimeType: "text/csv",
        }}
      />,
    );

    expect(
      await screen.findByText("alpha", undefined, { timeout: 5_000 }),
    ).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
  });

  it("renders an unsupported fallback with a download link", () => {
    render(<FileViewer source={urlSource("/archive.zip", "archive.zip")} />);

    expect(screen.getByText(/No preview is available/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download"),
    ).toBe("archive.zip");
  });

  it("renders standalone unsupported fallback with its own download link", () => {
    const { container } = render(
      <FileViewer source={urlSource("/archive.zip", "archive.zip")} bare />,
    );

    expect(screen.getByText(/No preview is available/)).toBeTruthy();
    expect(
      container.querySelector('[data-slot="file-viewer-header"]'),
    ).toBeNull();
    expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download"),
    ).toBe("archive.zip");
  });
});
