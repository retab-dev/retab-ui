// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createFakeEmailMessage } from "@/components/email-viewer-demo"
import { EmailViewer } from "@/registry/new-york-v4/ui/email-viewer"
import type { EmailViewerMessage } from "@/registry/new-york-v4/ui/email-viewer"

vi.mock("@/registry/new-york-v4/ui/file-viewer", () => ({
  FileViewer: ({
    source,
    as,
    className,
  }: {
    source: { kind: string; text?: string; fileName?: string }
    as?: string
    className?: string
  }) => (
    <div data-testid="file-viewer" data-as={as} className={className}>
      {source.kind === "text" ? (
        <iframe title={source.fileName} srcDoc={source.text} />
      ) : (
        source.fileName
      )}
    </div>
  ),
}))

vi.mock("@/registry/new-york-v4/ui/file-thumbnail", () => ({
  FileThumbnail: ({ source }: { source?: { fileName?: string } }) => (
    <div data-testid="file-thumbnail">{source?.fileName ?? "file"}</div>
  ),
}))

beforeEach(() => {
  let nextObjectUrl = 0
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => {
      nextObjectUrl += 1
      return `blob:inline-${nextObjectUrl}`
    }),
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function iframe(container: HTMLElement) {
  const element = container.querySelector("iframe")
  expect(element).toBeTruthy()
  return element as HTMLIFrameElement
}

function htmlTextSource(text: string, fileName: string) {
  return {
    kind: "text" as const,
    text,
    fileName,
    mimeType: "text/html",
  }
}

function imageBlobSource(fileName: string) {
  return {
    kind: "blob" as const,
    blob: new Blob(["image"], { type: "image/png" }),
    identityKey: `blob:${fileName}`,
    fileName,
    mimeType: "image/png",
  }
}

describe("EmailViewer", () => {
  it("renders the full fake email fixture as an integration test case", async () => {
    const { container } = render(
      <EmailViewer message={createFakeEmailMessage()} className="h-[720px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        'src="blob:inline-1"'
      )
    })
    expect(iframe(container).getAttribute("srcdoc")).toContain(
      "Contract packet ready for review"
    )
    expect(
      screen.queryByRole("button", { name: /retab-logo\.svg/i })
    ).toBeNull()
    expect(
      screen.getByRole("button", { name: /spacex-prospectus\.pdf/i })
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: /sales\.csv/i })).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /nvidia-financials-fy2024\.xlsx/i })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /review-note\.html/i })
    ).toBeTruthy()
  })

  it("renders the HTML body and rewrites cid URLs to inline attachment object URLs", async () => {
    const message: EmailViewerMessage = {
      id: "email-1",
      subject: "Quarterly update",
      htmlBody:
        '<main><p>HTML body</p><img alt="Logo" src="cid:<logo@example.com>"></main>',
      textBody: "Plain fallback body",
      attachments: [
        {
          id: "logo",
          contentId: "<logo@example.com>",
          isInline: true,
          source: imageBlobSource("logo.png"),
        },
        {
          id: "invoice",
          source: htmlTextSource("<p>Invoice attachment</p>", "invoice.html"),
          size: 2048,
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        'src="blob:inline-1"'
      )
    })
    expect(iframe(container).getAttribute("srcdoc")).toContain("HTML body")
    expect(iframe(container).getAttribute("srcdoc")).not.toContain("cid:")
    expect(screen.queryByRole("button", { name: /logo\.png/i })).toBeNull()
    expect(
      screen.getByRole("button", { name: /invoice\.html.*2\.0 KB/i })
    ).toBeTruthy()
  })

  it("falls back to the text body when there is no HTML body", async () => {
    const message: EmailViewerMessage = {
      id: "email-2",
      subject: "Plain email",
      textBody: "Plain body only",
    }

    const { container } = render(
      <EmailViewer message={message} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toBe("Plain body only")
    })
    expect(screen.getByText("Plain email")).toBeTruthy()
  })

  it("opens non-inline attachments independently from the message body", async () => {
    const message: EmailViewerMessage = {
      id: "email-3",
      subject: "With attachment",
      htmlBody: "<p>Email body</p>",
      attachments: [
        {
          id: "details",
          source: htmlTextSource(
            "<article>Attachment preview</article>",
            "details.html"
          ),
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain("Email body")
    })

    fireEvent.click(screen.getByRole("button", { name: /details\.html/i }))

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        "Attachment preview"
      )
    })
    expect(
      screen
        .getByRole("button", { name: "Message body" })
        .getAttribute("aria-current")
    ).toBeNull()
  })
})
