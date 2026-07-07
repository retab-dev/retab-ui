// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  detectCategory,
  resolveFileDescriptor,
} from "@/registry/new-york-v4/ui/file-viewer-core";
import {
  getFileViewerPrewarmTarget,
  resetFileViewerRendererPrewarmForTests,
} from "@/registry/new-york-v4/ui/file-viewer-prewarm";
import { FileViewerHarness as FileViewer } from "./file-viewer-test-harness";

const emailRouteMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/ui/email-viewer", () => ({
  EmailResourceContent: (props: Record<string, unknown>) => {
    emailRouteMock.props.push(props);
    return "Mock email viewer";
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
  resetFileViewerRendererPrewarmForTests();
  emailRouteMock.props.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function urlSource(url: string, fileName?: string, mimeType?: string) {
  return { kind: "url" as const, url, fileName, mimeType };
}

describe("FileViewer email routing", () => {
  it("detects .eml and RFC 822 MIME types as the email category", () => {
    expect(detectCategory("contract-packet.eml")).toBe("email");
    expect(detectCategory("download", "message/rfc822")).toBe("email");
    expect(detectCategory("download", "message/global")).toBe("email");
    expect(detectCategory("forwarded.msg")).toBe("email");
  });

  it("selects the email prewarm target for renderable email routes", () => {
    const descriptor = resolveFileDescriptor({
      source: urlSource("/mail/contract-packet.eml", "contract-packet.eml"),
    });

    expect(descriptor.category).toBe("email");
    expect(
      getFileViewerPrewarmTarget({ descriptor, isRouteRenderable: true }),
    ).toBe("email");
    expect(
      getFileViewerPrewarmTarget({ descriptor, isRouteRenderable: false }),
    ).toBeNull();
  });

  it("routes URL .eml sources to the email renderer", async () => {
    render(
      <FileViewer
        source={urlSource("/mail/contract-packet.eml", "contract-packet.eml")}
      />,
    );

    expect(await screen.findByText("Mock email viewer")).toBeTruthy();
    expect(emailRouteMock.props).toHaveLength(1);
    expect(emailRouteMock.props[0]).toMatchObject({
      bare: true,
      controls: false,
      download: true,
    });
    expect(
      (emailRouteMock.props[0]?.resource as { fileName: string }).fileName,
    ).toBe("contract-packet.eml");
    expect(
      emailRouteMock.props[0]?.descriptorSignal,
    ).toBeInstanceOf(AbortSignal);
  });

  it("allows raw text-kind .eml sources instead of the unsupported fallback", async () => {
    const emlText = readFileSync("public/samples/sample-email.eml", "utf8");

    render(
      <FileViewer
        bare
        source={{
          kind: "text",
          text: emlText,
          fileName: "sample-email.eml",
          mimeType: "message/rfc822",
        }}
      />,
    );

    expect(await screen.findByText("Mock email viewer")).toBeTruthy();
    expect(screen.queryByText(/No preview is available/i)).toBeNull();
    expect(emailRouteMock.props[0]).toMatchObject({
      controls: true,
      download: true,
    });
  });
});
