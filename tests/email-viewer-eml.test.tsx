// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createViewerResource } from "@/lib/viewer-resource";
import { EmailResourceContent } from "@/registry/new-york-v4/ui/email-viewer-content";
import {
  decodeEncodedWords,
  parseEmlMessage,
} from "@/registry/new-york-v4/ui/email-viewer-eml";
import type { MimePart } from "@/registry/new-york-v4/ui/email-viewer-types";
import {
  ViewerControlsRegistrationProvider,
  type ViewerControlsState,
} from "@/registry/new-york-v4/ui/viewer-controls";

vi.mock("@/registry/new-york-v4/ui/file-viewer", () => ({
  FileViewerPreview: ({
    source,
    category,
    className,
  }: {
    source: { kind: string; text?: string; fileName?: string };
    category?: string;
    className?: string;
  }) => (
    <div data-testid="file-viewer" data-as={category} className={className}>
      {source.kind === "text" ? (
        <iframe title={source.fileName} srcDoc={source.text} />
      ) : (
        source.fileName
      )}
    </div>
  ),
}));

vi.mock("@/registry/new-york-v4/ui/file-thumbnail", () => ({
  FileThumbnail: ({ source }: { source?: { fileName?: string } }) => (
    <div data-testid="file-thumbnail">{source?.fileName ?? "file"}</div>
  ),
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SAMPLE_EML = readFileSync("public/samples/sample-email.eml", "utf8");

function childByType(part: MimePart, mimeType: string) {
  const child = part.children?.find((entry) => entry.mimeType === mimeType);
  expect(child, `expected a ${mimeType} child of ${part.mimeType}`).toBeTruthy();
  return child as MimePart;
}

describe("parseEmlMessage", () => {
  it("parses envelope headers with RFC 2047 encoded words", () => {
    const message = parseEmlMessage(SAMPLE_EML);

    expect(message.subject).toBe(
      "Northstar Foods contract packet — signature needed",
    );
    expect(message.from).toBe("Mina Patel <mina@samples.retab.dev>");
    expect(message.to).toBe(
      "Avery Lee <avery@samples.retab.dev>, Ops Review <ops@samples.retab.dev>",
    );
    expect(message.cc).toBe("Renée Dubois <renee@samples.retab.dev>");
    expect(message.sentAt).toBe("Fri, 13 Jun 2026 09:42:00 -0400");
  });

  it("builds the recursive MIME tree with alternative and related parts", () => {
    const { root } = parseEmlMessage(SAMPLE_EML);

    expect(root.mimeType).toBe("multipart/mixed");
    expect(root.children).toHaveLength(3);

    const alternative = childByType(root, "multipart/alternative");
    const plain = childByType(alternative, "text/plain");
    const related = childByType(alternative, "multipart/related");
    const html = childByType(related, "text/html");
    const logo = childByType(related, "image/svg+xml");

    // Quoted-printable body decodes soft breaks and =E2=80=94 (em dash).
    expect(plain.source?.kind).toBe("text");
    if (plain.source?.kind === "text") {
      expect(plain.source.text).toContain(
        "attached — the signature page is in the PDF",
      );
    }

    // Base64 HTML body decodes to text and keeps its cid: reference for the
    // inline-resource rewrite performed by the email model.
    expect(html.source?.kind).toBe("text");
    if (html.source?.kind === "text") {
      expect(html.source.text).toContain("Contract packet ready for review");
      expect(html.source.text).toContain(
        "cid:northstar-logo@samples.retab.dev",
      );
    }

    expect(logo.contentId).toBe("<northstar-logo@samples.retab.dev>");
    expect(logo.disposition).toBe("inline");
    expect(logo.fileName).toBe("northstar-logo.svg");
  });

  it("decodes base64 attachments into blob sources", async () => {
    const { root } = parseEmlMessage(SAMPLE_EML);
    const pdf = childByType(root, "application/pdf");
    const csv = childByType(root, "text/csv");

    expect(pdf.disposition).toBe("attachment");
    expect(pdf.fileName).toBe("northstar-signature-page.pdf");
    expect(pdf.source?.kind).toBe("blob");
    if (pdf.source?.kind === "blob") {
      const bytes = new Uint8Array(await pdf.source.blob.arrayBuffer());
      expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
      expect(pdf.size).toBe(bytes.byteLength);
    }

    // text/csv is textual, so it decodes into an inline text source.
    expect(csv.fileName).toBe("regional-sales.csv");
    expect(csv.source?.kind).toBe("text");
    if (csv.source?.kind === "text") {
      expect(csv.source.text).toContain("region,quarter,revenue,orders");
    }
  });

  it("derives stable source identity keys from the provided identity", () => {
    const first = parseEmlMessage(SAMPLE_EML, { identityKey: "resource-a" });
    const second = parseEmlMessage(SAMPLE_EML, { identityKey: "resource-a" });

    const firstHtml = childByType(
      childByType(first.root, "multipart/alternative"),
      "multipart/related",
    );
    const secondHtml = childByType(
      childByType(second.root, "multipart/alternative"),
      "multipart/related",
    );
    expect(childByType(firstHtml, "text/html").source?.identityKey).toBe(
      childByType(secondHtml, "text/html").source?.identityKey,
    );
  });

  it("parses nested message/rfc822 parts as bounded nested messages", () => {
    const nested = [
      "From: original@samples.retab.dev",
      "Subject: Original thread",
      "Content-Type: text/plain",
      "",
      "Original body",
      "",
    ].join("\r\n");
    const eml = [
      "From: forwarder@samples.retab.dev",
      "Subject: Fwd: Original thread",
      'Content-Type: multipart/mixed; boundary="outer"',
      "",
      "--outer",
      "Content-Type: text/plain",
      "",
      "See below.",
      "--outer",
      "Content-Type: message/rfc822",
      "",
      nested,
      "--outer--",
      "",
    ].join("\r\n");

    const { root } = parseEmlMessage(eml);
    const forwarded = childByType(root, "message/rfc822");

    expect(forwarded.children).toHaveLength(1);
    expect(
      forwarded.headers?.some(
        (header) =>
          header.name.toLowerCase() === "subject" &&
          header.value === "Original thread",
      ),
    ).toBe(true);
    const forwardedBody = childByType(forwarded, "text/plain");
    expect(forwardedBody.source?.kind).toBe("text");
    if (forwardedBody.source?.kind === "text") {
      expect(forwardedBody.source.text).toContain("Original body");
    }
  });

  it("degrades headerless input to a renderable text body", () => {
    const { root, subject } = parseEmlMessage("just a plain note\nno headers");

    expect(subject).toBeNull();
    expect(root.mimeType).toBe("text/plain");
    expect(root.source?.kind).toBe("text");
  });

  it("decodes both B and Q encoded words", () => {
    expect(
      decodeEncodedWords("=?utf-8?B?Q2Fmw6k=?= =?utf-8?Q?cr=C3=A8me?="),
    ).toBe("Cafécrème");
  });
});

describe("EmailResourceContent", () => {
  it("renders an inline .eml resource through the email viewer", async () => {
    const resource = createViewerResource(
      {
        kind: "text",
        text: SAMPLE_EML,
        fileName: "sample-email.eml",
        mimeType: "message/rfc822",
      },
      "email",
    );

    const { container } = render(<EmailResourceContent resource={resource} />);

    expect(
      await screen.findByText(
        "Northstar Foods contract packet — signature needed",
      ),
    ).toBeTruthy();
    expect(screen.getByText("2 attachments")).toBeTruthy();
    expect(
      screen.getAllByText("northstar-signature-page.pdf").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("regional-sales.csv").length).toBeGreaterThan(
      0,
    );
    expect(
      container.querySelector('[data-slot="email-file-viewer-content"]'),
    ).toBeTruthy();

    // The HTML body renders with its cid: URL rewritten to an inline data URL.
    await waitFor(() => {
      const frame = container.querySelector("iframe");
      expect(frame?.getAttribute("srcdoc")).toContain("data:image/svg+xml");
    });
  });

  it("registers download-only viewer controls", async () => {
    const resource = createViewerResource(
      {
        kind: "text",
        text: SAMPLE_EML,
        fileName: "sample-email.eml",
        mimeType: "message/rfc822",
      },
      "email",
    );
    const states: Array<ViewerControlsState | null> = [];

    render(
      <ViewerControlsRegistrationProvider
        onControlsChange={(state) => states.push(state)}
      >
        <EmailResourceContent resource={resource} />
      </ViewerControlsRegistrationProvider>,
    );

    await screen.findByText(
      "Northstar Foods contract packet — signature needed",
    );
    const registered = states.findLast((state) => state != null);
    expect(registered).toBeTruthy();
    expect(registered?.downloads).toEqual([resource.originalDownload]);
    expect(registered?.zoom ?? null).toBeNull();
    expect(registered?.position ?? null).toBeNull();
  });
});
