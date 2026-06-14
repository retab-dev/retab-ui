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
import {
  buildMimeTree,
  EmailViewer,
  findMimeNodeByPath,
  getDefaultMimeSelectionPath,
  getInlineResourceScope,
} from "@/registry/new-york-v4/ui/email-viewer"
import type {
  EmailViewerMessage,
  MimePart,
} from "@/registry/new-york-v4/ui/email-viewer"

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
  })

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

function htmlSource(text: string, fileName: string) {
  return {
    kind: "text" as const,
    text,
    fileName,
    mimeType: "text/html",
    identityKey: `html:${fileName}:${text.length}`,
  }
}

function textSource(text: string, fileName: string) {
  return {
    kind: "text" as const,
    text,
    fileName,
    mimeType: "text/plain",
    identityKey: `text:${fileName}:${text.length}`,
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

function htmlPart(id: string, html: string, fileName = `${id}.html`): MimePart {
  return {
    id,
    mimeType: "text/html",
    fileName,
    source: htmlSource(html, fileName),
    size: html.length,
  }
}

function textPart(id: string, text: string, fileName = `${id}.txt`): MimePart {
  return {
    id,
    mimeType: "text/plain",
    fileName,
    source: textSource(text, fileName),
    size: text.length,
  }
}

function message(root: MimePart): EmailViewerMessage {
  return {
    id: "message-1",
    subject: "Quarterly update",
    from: "Mina Patel <mina@example.com>",
    to: "Avery Lee <avery@example.com>",
    sentAt: "2026-06-13T09:42:00-04:00",
    root,
  }
}

describe("EmailViewer MIME model", () => {
  it("selects HTML over text inside recursive multipart alternatives", () => {
    const tree = buildMimeTree({
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        {
          id: "alternative",
          mimeType: "multipart/alternative",
          children: [
            textPart("plain", "Plain body"),
            {
              id: "related",
              mimeType: "multipart/related",
              children: [
                htmlPart("html", "<main>HTML body</main>", "message.html"),
                {
                  id: "logo",
                  mimeType: "image/png",
                  contentId: "<logo@example.com>",
                  disposition: "inline",
                  fileName: "logo.png",
                  source: imageBlobSource("logo.png"),
                },
              ],
            },
          ],
        },
      ],
    })

    const path = getDefaultMimeSelectionPath(tree)
    expect(path).toEqual(["root", "alternative", "related", "html"])
    const selected = findMimeNodeByPath(tree, path)
    expect(selected?.part.mimeType).toBe("text/html")
    expect(getInlineResourceScope(selected!).part.id).toBe("related")
  })
})

describe("EmailViewer", () => {
  it("renders the fake recursive MIME fixture without duplicated part headers", async () => {
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
    expect(iframe(container).getAttribute("title")).toBe("message.html")
    expect(
      container.querySelector('[data-slot="email-message-header"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-slot="email-part-header"]')
    ).toBeNull()
    expect(
      container.querySelector('[data-slot="mime-part-sidebar"]')
    ).toBeTruthy()
    expect(
      container.querySelectorAll('[data-slot="viewer-root"]')
    ).toHaveLength(1)
    const root = container.querySelector<HTMLElement>(
      '[data-slot="viewer-root"]'
    )
    expect(root?.children[0]?.getAttribute("data-slot")).toBe("viewer-header")
    expect(root?.children[1]?.getAttribute("data-slot")).toBe("viewer-body")
    const body = root?.querySelector<HTMLElement>('[data-slot="viewer-body"]')
    expect(
      body?.querySelector(':scope > [data-slot="viewer-sidebar"]')
    ).toBeTruthy()
    expect(
      body?.querySelector(':scope > [data-slot="viewer-surface"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-slot="attachment-sidebar"]')
    ).toBeNull()
    expect(
      screen.getByRole("button", { name: /Body text\/html · 2\.1 KB/i })
    ).toBeTruthy()
    expect(screen.getAllByText("Body")).toHaveLength(2)
    expect(screen.getByText("Attachments")).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: /Text body text\/plain/i })
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: /Multipart mixed/i })
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: /Multipart alternative/i })
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: /retab-logo\.svg image\/svg\+xml/i })
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

  it("rewrites cid URLs from multipart/related sibling resources", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/related",
      children: [
        htmlPart(
          "html",
          '<main><p>HTML body</p><img alt="Logo" src="cid:<logo@example.com>"></main>',
          "message.html"
        ),
        {
          id: "logo",
          mimeType: "image/png",
          contentId: "<logo@example.com>",
          disposition: "inline",
          fileName: "logo.png",
          source: imageBlobSource("logo.png"),
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message(root)} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        'src="blob:inline-1"'
      )
    })
    expect(iframe(container).getAttribute("srcdoc")).toContain("HTML body")
    expect(iframe(container).getAttribute("srcdoc")).not.toContain("cid:")
    expect(screen.queryByRole("button", { name: /logo\.png/i })).toBeNull()
  })

  it("does not inline content-id files marked as attachments", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        htmlPart(
          "html",
          '<main><img alt="Logo" src="cid:logo@example.com"></main>',
          "message.html"
        ),
        {
          id: "logo",
          mimeType: "image/png",
          contentId: "<logo@example.com>",
          disposition: "attachment",
          fileName: "logo.png",
          source: imageBlobSource("logo.png"),
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message(root)} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        "cid:logo@example.com"
      )
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /logo\.png/i })).toBeTruthy()
  })

  it("falls back to a text leaf when no HTML part exists", async () => {
    const root = textPart("plain", "Plain body only", "message.txt")

    const { container } = render(
      <EmailViewer message={message(root)} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toBe("Plain body only")
    })
    expect(screen.getByText("Quarterly update")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Body text\/plain/i }))
    expect(
      screen.queryByRole("button", { name: /message\.txt text\/plain/i })
    ).toBeNull()
  })

  it("opens attachment leaves independently from the message body", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        htmlPart("html", "<p>Email body</p>", "message.html"),
        {
          ...htmlPart(
            "details",
            "<article>Attachment preview</article>",
            "details.html"
          ),
          disposition: "attachment",
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message(root)} className="h-[600px]" />
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
        .getByRole("button", { name: /details\.html/i })
        .getAttribute("aria-current")
    ).toBe("page")
  })

  it("renders message/rfc822 parts as nested MIME viewers", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        htmlPart("html", "<p>Outer body</p>", "message.html"),
        {
          id: "forwarded",
          mimeType: "message/rfc822",
          disposition: "attachment",
          fileName: "forwarded.eml",
          headers: [
            { name: "Subject", value: "Forwarded note" },
            { name: "From", value: "Nested <nested@example.com>" },
          ],
          children: [htmlPart("forwarded-html", "<p>Forwarded body</p>")],
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message(root)} className="h-[720px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain("Outer body")
    })

    fireEvent.click(screen.getByRole("button", { name: /forwarded\.eml/i }))

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        "Forwarded body"
      )
    })
    expect(screen.getByText("Forwarded note")).toBeTruthy()
  })
})
