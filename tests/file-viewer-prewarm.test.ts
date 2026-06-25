import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getFileViewerPrewarmTarget,
  resetFileViewerRendererPrewarmForTests,
  scheduleFileViewerRendererPrewarm,
} from "@/registry/new-york-v4/ui/file-viewer-prewarm";
import type {
  FileCategory,
  FileDescriptor,
  ViewerSource,
} from "@/registry/new-york-v4/ui/file-viewer-core";

const pptxPreloadMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/ui/pptx-viewer", () => ({
  PptxResourceContent: () => null,
  preloadPptxViewer: pptxPreloadMock,
}));

afterEach(() => {
  resetFileViewerRendererPrewarmForTests();
  pptxPreloadMock.mockClear();
  vi.unstubAllGlobals();
});

describe("file viewer renderer prewarm", () => {
  it("selects prewarm targets only for renderable heavy routes", () => {
    expect(
      getFileViewerPrewarmTarget({
        descriptor: descriptor("pdf", { fileName: "paper.pdf" }),
        isRouteRenderable: true,
      }),
    ).toBe("pdf");
    expect(
      getFileViewerPrewarmTarget({
        descriptor: descriptor("csv", { fileName: "table.csv" }),
        isRouteRenderable: true,
      }),
    ).toBeNull();
    expect(
      getFileViewerPrewarmTarget({
        descriptor: descriptor("unsupported", { fileName: "archive.zip" }),
        isRouteRenderable: true,
      }),
    ).toBeNull();
    expect(
      getFileViewerPrewarmTarget({
        descriptor: descriptor("pdf", {
          fileName: "paper.pdf",
          source: textSource("not a real pdf", "paper.pdf"),
        }),
        isRouteRenderable: false,
      }),
    ).toBeNull();
  });

  it("splits text descriptors into prose and code prewarm targets", () => {
    expect(
      getFileViewerPrewarmTarget({
        descriptor: descriptor("text", {
          fileName: "notes.txt",
          mimeType: "text/plain",
          source: textSource("hello", "notes.txt", "text/plain"),
        }),
        isRouteRenderable: true,
      }),
    ).toBe("text");
    expect(
      getFileViewerPrewarmTarget({
        descriptor: descriptor("text", {
          fileName: "app.ts",
          source: textSource("export {}", "app.ts", "text/typescript"),
        }),
        isRouteRenderable: true,
      }),
    ).toBe("code");
  });

  it("is a no-op without a browser window", () => {
    expect(() => scheduleFileViewerRendererPrewarm("pdf")).not.toThrow();
  });

  it("dedupes idle prewarm work per target", async () => {
    const idle = installIdleWindow();

    scheduleFileViewerRendererPrewarm("pptx");
    scheduleFileViewerRendererPrewarm("pptx");

    expect(idle.requestIdleCallback).toHaveBeenCalledTimes(1);
    idle.runNext();
    await vi.dynamicImportSettled();

    expect(pptxPreloadMock).toHaveBeenCalledTimes(1);

    scheduleFileViewerRendererPrewarm("pptx");
    expect(idle.requestIdleCallback).toHaveBeenCalledTimes(1);
  });

  it("keeps duplicate scheduled subscribers alive until all cancel", async () => {
    const idle = installIdleWindow();

    const cancelFirst = scheduleFileViewerRendererPrewarm("pptx");
    scheduleFileViewerRendererPrewarm("pptx");
    cancelFirst();

    expect(idle.cancelIdleCallback).not.toHaveBeenCalled();
    idle.runNext();
    await vi.dynamicImportSettled();

    expect(pptxPreloadMock).toHaveBeenCalledTimes(1);
  });

  it("cancels scheduled idle work before it starts", async () => {
    const idle = installIdleWindow();

    const cancel = scheduleFileViewerRendererPrewarm("pptx");
    cancel();

    expect(idle.cancelIdleCallback).toHaveBeenCalledWith(1);
    idle.runNext();
    await vi.dynamicImportSettled();

    expect(pptxPreloadMock).not.toHaveBeenCalled();

    scheduleFileViewerRendererPrewarm("pptx");
    expect(idle.requestIdleCallback).toHaveBeenCalledTimes(2);
  });
});

function descriptor(
  category: FileCategory,
  overrides: Partial<FileDescriptor> = {},
): FileDescriptor {
  const fileName = overrides.fileName ?? "file";
  return {
    category,
    displayName: fileName,
    fileName,
    identityKey: `test:${fileName}`,
    source: overrides.source ?? urlSource(`/${fileName}`, fileName),
    ...overrides,
  };
}

function urlSource(
  url: string,
  fileName?: string,
  mimeType?: string,
): ViewerSource {
  return { kind: "url", url, fileName, mimeType };
}

function textSource(
  text: string,
  fileName?: string,
  mimeType?: string,
): ViewerSource {
  return { kind: "text", text, fileName, mimeType };
}

function installIdleWindow() {
  const callbacks: IdleRequestCallback[] = [];
  const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  const cancelIdleCallback = vi.fn();

  vi.stubGlobal("window", {
    requestIdleCallback,
    cancelIdleCallback,
  });

  return {
    cancelIdleCallback,
    requestIdleCallback,
    runNext() {
      const callback = callbacks.shift();
      if (!callback) throw new Error("No idle callback scheduled.");
      callback({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    },
  };
}
