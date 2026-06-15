// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createFakeEmailMessage } from "@/components/email-viewer-demo"
import {
  buildMimeTree,
  categoryForMimeNode,
  createMimeMessageScope,
  deriveEmailContentModel,
  deriveEmailHeaderModel,
  deriveEmailInlineResourceScope,
  deriveEmailSidebarModel,
  EmailViewer,
  EmailViewerHeader,
  EmailViewerProvider,
  findMimeNodeByPath,
  getDefaultMimeSelectionPath,
  getInlineResourceScope,
  inlineResourceKeyToString,
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

function blobSource(fileName: string, mimeType: string) {
  return {
    kind: "blob" as const,
    blob: new Blob([fileName], { type: mimeType }),
    identityKey: `blob:${fileName}`,
    fileName,
    mimeType,
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
  it("normalizes duplicate sibling ids into stable selectable paths", () => {
    const tree = buildMimeTree({
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        textPart("duplicate", "Plain body"),
        htmlPart("duplicate", "<p>HTML body</p>"),
      ],
    })

    expect(tree.children.map((child) => child.path)).toEqual([
      ["root", "duplicate"],
      ["root", "duplicate~2"],
    ])
    expect(findMimeNodeByPath(tree, ["root", "duplicate"])?.part.mimeType).toBe(
      "text/plain"
    )
    expect(
      findMimeNodeByPath(tree, ["root", "duplicate~2"])?.part.mimeType
    ).toBe("text/html")
  })

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
    expect(getInlineResourceScope(tree, selected!).part.id).toBe("related")
  })

  it("stores normalized node facts and parent paths without object parents", () => {
    const tree = buildMimeTree({
      id: "root",
      mimeType: "multipart/mixed",
      children: [htmlPart("", "<p>HTML body</p>")],
    })

    expect(tree.parentPath).toBeNull()
    expect(tree.facts.kind).toBe("multipart")
    expect(tree.children[0]?.path).toEqual(["root", "part-1"])
    expect(tree.children[0]?.parentPath).toEqual(["root"])
    expect("parent" in tree.children[0]!).toBe(false)
    expect(tree.children[0]?.facts).toMatchObject({
      kind: "body",
      mimeType: "text/html",
      isRenderable: true,
      preview: { kind: "preview", category: "html" },
    })
  })

  it("derives scoped body and attachment sections without nested message leakage", () => {
    const tree = buildMimeTree({
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        htmlPart("html", "<p>Outer body</p>", "message.html"),
        {
          id: "forwarded",
          mimeType: "message/rfc822",
          disposition: "attachment",
          fileName: "forwarded.eml",
          headers: [{ name: "Subject", value: "Forwarded note" }],
          children: [
            htmlPart("forwarded-html", "<p>Forwarded body</p>"),
            {
              ...htmlPart("nested-details", "<p>Nested attachment</p>"),
              disposition: "attachment",
            },
          ],
        },
      ],
    })
    const scope = createMimeMessageScope(message(tree.part), tree)
    const sidebar = deriveEmailSidebarModel({
      scope,
      selectedPath: ["root", "html"],
    })
    const body = sidebar.sections.find((section) => section.id === "body")
    const attachments = sidebar.sections.find(
      (section) => section.id === "attachments"
    )

    expect(sidebar.bodyCount).toBe(1)
    expect(sidebar.attachmentCount).toBe(1)
    expect(body?.items.map((item) => item.kind)).toEqual(["body"])
    expect(body?.items.map((item) => item.title)).toEqual(["Body"])
    expect(attachments?.items.map((item) => item.kind)).toEqual(["attachment"])
    expect(attachments?.items.map((item) => item.title)).toEqual([
      "forwarded.eml",
    ])
  })

  it("derives structured email header addresses", () => {
    const header = deriveEmailHeaderModel({
      ...message(textPart("plain", "Plain body")),
      from: '"Mina Patel" <mina@example.com>',
      to: ["Avery Lee <avery@example.com>", "ops@example.com"],
    })

    expect(header.from).toEqual([
      {
        name: "Mina Patel",
        address: "mina@example.com",
        display: '"Mina Patel" <mina@example.com>',
      },
    ])
    expect(header.to).toEqual([
      {
        name: "Avery Lee",
        address: "avery@example.com",
        display: "Avery Lee <avery@example.com>",
      },
      {
        name: null,
        address: "ops@example.com",
        display: "ops@example.com",
      },
    ])
  })

  it("derives nested message content and headers in the model", () => {
    const tree = buildMimeTree({
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
            { name: "Date", value: "2026-06-13T09:42:00-04:00" },
          ],
          children: [htmlPart("forwarded-html", "<p>Forwarded body</p>")],
        },
      ],
    })
    const selected = findMimeNodeByPath(tree, ["root", "forwarded"])
    expect(selected).toBeTruthy()

    const content = deriveEmailContentModel({
      inlineResourceUrls: new Map(),
      message: message(tree.part),
      selectedNode: selected!,
    })

    expect(content.kind).toBe("nested-message")
    if (content.kind !== "nested-message") return
    expect(content.message.subject).toBe("Forwarded note")
    expect(content.message.from).toBe("Nested <nested@example.com>")
    expect(deriveEmailHeaderModel(content.message).subject).toBe(
      "Forwarded note"
    )
  })

  it("enforces a nested message recursion budget in the content model", () => {
    const tree = buildMimeTree({
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        {
          id: "forwarded",
          mimeType: "message/rfc822",
          disposition: "attachment",
          fileName: "forwarded.eml",
          children: [htmlPart("forwarded-html", "<p>Forwarded body</p>")],
        },
      ],
    })
    const selected = findMimeNodeByPath(tree, ["root", "forwarded"])
    expect(selected).toBeTruthy()

    const content = deriveEmailContentModel({
      inlineResourceUrls: new Map(),
      maxNestedMessageDepth: 1,
      message: message(tree.part),
      nestedMessageDepth: 1,
      selectedNode: selected!,
    })

    expect(content.kind).toBe("empty")
    if (content.kind !== "empty") return
    expect(content.reason).toBe("nested-depth-exceeded")
    expect(content.message).toMatch(/too deeply nested/i)
  })

  it("derives named empty states for security envelopes", () => {
    const tree = buildMimeTree({
      id: "encrypted",
      mimeType: "application/pgp-encrypted",
      source: textSource("Version: 1", "encrypted.asc"),
    })

    const content = deriveEmailContentModel({
      inlineResourceUrls: new Map(),
      message: message(tree.part),
      selectedNode: tree,
    })

    expect(content.kind).toBe("empty")
    if (content.kind !== "empty") return
    expect(content.reason).toBe("security-envelope")
    expect(content.message).toMatch(/encrypted/i)
  })

  it("assigns explicit preview policy for less common MIME parts", () => {
    const tree = buildMimeTree({
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        {
          id: "calendar",
          mimeType: "text/calendar",
          fileName: "invite.ics",
          source: textSource("BEGIN:VCALENDAR", "invite.ics"),
        },
        {
          id: "delivery",
          mimeType: "message/delivery-status",
          fileName: "delivery-status.txt",
          source: textSource(
            "Final-Recipient: rfc822; a@example.com",
            "delivery-status.txt"
          ),
        },
        {
          id: "binary",
          mimeType: "application/octet-stream",
          fileName: "archive.bin",
          source: blobSource("archive.bin", "application/octet-stream"),
        },
        {
          id: "inline-image",
          mimeType: "image/png",
          disposition: "inline",
          fileName: "photo.png",
          source: imageBlobSource("photo.png"),
        },
        {
          id: "pkcs7",
          mimeType: "application/pkcs7-mime",
          fileName: "smime.p7m",
          source: blobSource("smime.p7m", "application/pkcs7-mime"),
        },
      ],
    })
    const [calendar, delivery, binary, inlineImage, pkcs7] = tree.children

    expect(calendar?.facts).toMatchObject({
      kind: "attachment",
      preview: { kind: "attachment", category: "text" },
    })
    expect(categoryForMimeNode(calendar!)).toBe("text")
    expect(delivery?.facts).toMatchObject({
      kind: "attachment",
      preview: { kind: "attachment", category: "text" },
    })
    expect(binary?.facts).toMatchObject({
      kind: "attachment",
      preview: { kind: "attachment" },
    })
    expect(inlineImage?.facts).toMatchObject({
      kind: "attachment",
      preview: { kind: "attachment", category: "image" },
    })
    expect(pkcs7?.facts).toMatchObject({
      kind: "unsupported",
      preview: { kind: "security-envelope" },
    })
  })

  it("previews the body of multipart signed messages without leaking the signature as body", () => {
    const tree = buildMimeTree({
      id: "signed",
      mimeType: "multipart/signed",
      children: [
        htmlPart("html", "<p>Signed body</p>", "message.html"),
        {
          id: "signature",
          mimeType: "application/pkcs7-signature",
          disposition: "attachment",
          fileName: "smime.p7s",
          source: blobSource("smime.p7s", "application/pkcs7-signature"),
        },
      ],
    })
    const scope = createMimeMessageScope(message(tree.part), tree)
    const sidebar = deriveEmailSidebarModel({
      scope,
      selectedPath: ["signed", "html"],
    })
    const content = deriveEmailContentModel({
      inlineResourceUrls: new Map(),
      message: message(tree.part),
      selectedNode: tree,
    })

    expect(content.kind).toBe("file")
    if (content.kind !== "file") return
    expect(content.node.path).toEqual(["signed", "html"])
    expect(content.file.category).toBe("html")
    expect(sidebar.bodyCount).toBe(1)
    expect(sidebar.attachmentCount).toBe(1)
    expect(
      sidebar.sections
        .find((section) => section.id === "attachments")
        ?.items.map((item) => item.title)
    ).toEqual(["smime.p7s"])
  })

  it("keeps malformed ids and empty MIME types selectable through normalized facts", () => {
    const tree = buildMimeTree({
      id: "",
      mimeType: "multipart/mixed",
      children: [
        {
          id: "",
          mimeType: "",
          fileName: "unknown.bin",
          source: blobSource("unknown.bin", "application/octet-stream"),
        },
      ],
    })
    const child = tree.children[0]

    expect(tree.path).toEqual(["part-1"])
    expect(child?.path).toEqual(["part-1", "part-1"])
    expect(child?.facts).toMatchObject({
      kind: "attachment",
      mimeType: "",
      preview: { kind: "attachment" },
    })
  })

  it("derives content-location inline resource keys", () => {
    const tree = buildMimeTree({
      id: "root",
      mimeType: "multipart/related",
      children: [
        htmlPart("html", '<main><img src="logo.png"></main>', "message.html"),
        {
          id: "logo",
          mimeType: "image/png",
          contentLocation: "logo.png",
          disposition: "inline",
          fileName: "logo.png",
          source: imageBlobSource("logo.png"),
        },
      ],
    })
    const selected = findMimeNodeByPath(tree, ["root", "html"])
    expect(selected).toBeTruthy()

    const scope = deriveEmailInlineResourceScope(tree, selected!)

    expect(scope.resources).toHaveLength(1)
    expect(scope.resources[0]?.keys).toEqual([
      { kind: "content-location", value: "logo.png" },
    ])
  })

  it("rewrites HTML sidebar thumbnail sources with the same inline resources as the content surface", () => {
    const tree = buildMimeTree({
      id: "root",
      mimeType: "multipart/related",
      children: [
        htmlPart(
          "html",
          '<main><img alt="Logo" src="cid:<logo@example.com>"></main>',
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
    })
    const scope = createMimeMessageScope(message(tree.part), tree)
    const sidebar = deriveEmailSidebarModel({
      inlineResourceUrls: new Map([
        [
          inlineResourceKeyToString({
            kind: "content-id",
            value: "logo@example.com",
          }),
          "blob:inline-1",
        ],
      ]),
      scope,
      selectedPath: ["root", "html"],
    })
    const bodyThumbnail = sidebar.sections[0]?.items[0]?.thumbnail

    expect(bodyThumbnail?.kind).toBe("file")
    if (bodyThumbnail?.kind !== "file") return
    expect(bodyThumbnail.source.kind).toBe("text")
    if (bodyThumbnail.source.kind !== "text") return
    expect(bodyThumbnail.source.text).toContain('src="blob:inline-1"')
    expect(bodyThumbnail.source.text).not.toContain("cid:")
  })
})

describe("EmailViewer", () => {
  it("renders the easy API through viewer anatomy", () => {
    const { container } = render(
      <EmailViewer message={message(htmlPart("html", "Hello"))} />
    )

    expect(container.querySelector('[data-slot="email-viewer"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="viewer-root"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="viewer-sidebar"]')).toBeTruthy()
    expect(screen.getByText("0 attachments")).toBeTruthy()
  })

  it("lets composed headers replace the default trailing sidebar trigger", () => {
    const { container } = render(
      <EmailViewerProvider message={message(htmlPart("html", "Hello"))}>
        <EmailViewerHeader
          trailing={<button type="button">Custom action</button>}
        />
      </EmailViewerProvider>
    )

    expect(screen.getByRole("button", { name: "Custom action" })).toBeTruthy()
    expect(
      container.querySelector('[data-slot="viewer-sidebar-trigger"]')
    ).toBeNull()
  })

  it("treats controlled null selection as a default body selection", async () => {
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
      <EmailViewer
        message={message(root)}
        selectedPath={null}
        className="h-[600px]"
      />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain("Email body")
    })
    expect(
      screen
        .getByRole("button", { name: /Body text\/html/i })
        .getAttribute("aria-current")
    ).toBe("page")
  })

  it("falls back from an invalid controlled path without firing selection callbacks", async () => {
    const onSelectedPathChange = vi.fn()
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        htmlPart("html", "<p>Email body</p>", "message.html"),
        {
          ...htmlPart("details", "<p>Attachment</p>", "details.html"),
          disposition: "attachment",
        },
      ],
    }

    const { container } = render(
      <EmailViewer
        message={message(root)}
        selectedPath={["root", "missing"]}
        onSelectedPathChange={onSelectedPathChange}
        className="h-[600px]"
      />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain("Email body")
    })
    expect(onSelectedPathChange).not.toHaveBeenCalled()
    expect(
      screen
        .getByRole("button", { name: /Body text\/html/i })
        .getAttribute("aria-current")
    ).toBe("page")
  })

  it("emits normalized paths when duplicate MIME ids are selected", async () => {
    const onSelectedPathChange = vi.fn()
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        htmlPart("duplicate", "<p>Email body</p>", "message.html"),
        {
          ...htmlPart(
            "duplicate",
            "<article>Attachment preview</article>",
            "details.html"
          ),
          disposition: "attachment",
        },
      ],
    }

    render(
      <EmailViewer
        message={message(root)}
        onSelectedPathChange={onSelectedPathChange}
        className="h-[600px]"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /details\.html/i }))

    await waitFor(() => {
      expect(onSelectedPathChange).toHaveBeenCalled()
    })
    expect(onSelectedPathChange.mock.calls[0]?.[0]).toEqual([
      "root",
      "duplicate~2",
    ])
  })

  it("renders the fake recursive MIME fixture without duplicated part headers", async () => {
    const { container } = render(
      <EmailViewer message={createFakeEmailMessage()} className="h-[720px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        'src="data:image/svg+xml;base64,'
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
    const emailPartsSidebar = screen.getByRole("complementary", {
      name: "Email parts",
    })
    const emailParts = within(emailPartsSidebar)
    expect(emailPartsSidebar.getAttribute("data-slot")).toBe("viewer-sidebar")
    expect(
      emailPartsSidebar.querySelector('[data-slot="mime-part-sidebar"]')
    ).toBeTruthy()
    expect(emailPartsSidebar.querySelector("[data-sidebar]")).toBeNull()
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
    expect(
      emailParts.getByRole("heading", { level: 3, name: "Body" })
    ).toBeTruthy()
    expect(
      emailParts.getByRole("heading", { level: 3, name: "Attachments" })
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

  it("rewrites text-backed cid resources as sandbox-safe data URLs", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/related",
      children: [
        htmlPart(
          "html",
          '<main><img alt="Logo" src="cid:logo@example.com"></main>',
          "message.html"
        ),
        {
          id: "logo",
          mimeType: "image/svg+xml",
          contentId: "<logo@example.com>",
          disposition: "inline",
          fileName: "logo.svg",
          source: {
            kind: "text",
            text: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
            fileName: "logo.svg",
            mimeType: "image/svg+xml",
            identityKey: "text:logo.svg",
          },
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message(root)} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        'src="data:image/svg+xml;base64,'
      )
    })
    expect(iframe(container).getAttribute("srcdoc")).not.toContain("cid:")
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /logo\.svg/i })).toBeNull()
  })

  it("rewrites content-location relative URLs from multipart/related resources", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/related",
      children: [
        htmlPart(
          "html",
          '<main><img alt="Logo" src="./logo.png"><a href="https://example.com/file">external</a></main>',
          "message.html"
        ),
        {
          id: "logo",
          mimeType: "image/png",
          contentLocation: "logo.png",
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
    expect(iframe(container).getAttribute("srcdoc")).toContain(
      'href="https://example.com/file"'
    )
    expect(iframe(container).getAttribute("srcdoc")).not.toContain("./logo.png")
    expect(screen.queryByRole("button", { name: /logo\.png/i })).toBeNull()
  })

  it("gives rewritten HTML sources a stable inline-resource identity", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/related",
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
          disposition: "inline",
          fileName: "logo.png",
          source: imageBlobSource("logo.png"),
        },
      ],
    }
    const tree = buildMimeTree(root)
    const selected = findMimeNodeByPath(tree, ["root", "html"])
    expect(selected).toBeTruthy()

    const content = deriveEmailContentModel({
      inlineResourceUrls: new Map([
        [
          inlineResourceKeyToString({
            kind: "content-id",
            value: "logo@example.com",
          }),
          "blob:inline-1",
        ],
      ]),
      message: message(root),
      selectedNode: selected!,
    })

    expect(content.kind).toBe("file")
    if (content.kind !== "file") return
    expect(content.file.source.identityKey).toContain("email-inline")
    expect(content.file.source.identityKey).toContain("content-id")
  })

  it("revokes blob-backed cid object URLs when the inline scope unmounts", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/related",
      children: [
        htmlPart(
          "html",
          '<main><img alt="Logo" src="cid:<logo@example.com>"></main>',
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

    const { container, unmount } = render(
      <EmailViewer message={message(root)} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        'src="blob:inline-1"'
      )
    })

    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:inline-1")
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
      expect(iframe(container).getAttribute("srcdoc")).not.toContain("cid:")
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /logo\.png/i })).toBeTruthy()
  })

  it("renders less common MIME attachments through the normal content surface", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        htmlPart("html", "<p>Email body</p>", "message.html"),
        {
          id: "calendar",
          mimeType: "text/calendar",
          fileName: "invite.ics",
          source: textSource("BEGIN:VCALENDAR", "invite.ics"),
        },
        {
          id: "delivery",
          mimeType: "message/delivery-status",
          fileName: "delivery-status.txt",
          source: textSource(
            "Final-Recipient: rfc822; avery@example.com",
            "delivery-status.txt"
          ),
        },
        {
          id: "binary",
          mimeType: "application/octet-stream",
          fileName: "archive.bin",
          source: blobSource("archive.bin", "application/octet-stream"),
        },
        {
          id: "inline-image",
          mimeType: "image/png",
          disposition: "inline",
          fileName: "photo.png",
          source: imageBlobSource("photo.png"),
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message(root)} className="h-[600px]" />
    )

    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain("Email body")
    })

    fireEvent.click(screen.getByRole("button", { name: /invite\.ics/i }))
    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        "BEGIN:VCALENDAR"
      )
    })
    expect(screen.getByTestId("file-viewer").getAttribute("data-as")).toBe(
      "text"
    )

    fireEvent.click(
      screen.getByRole("button", { name: /delivery-status\.txt/i })
    )
    await waitFor(() => {
      expect(iframe(container).getAttribute("srcdoc")).toContain(
        "Final-Recipient"
      )
    })

    fireEvent.click(screen.getByRole("button", { name: /archive\.bin/i }))
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer").textContent).toContain(
        "archive.bin"
      )
    })

    fireEvent.click(screen.getByRole("button", { name: /photo\.png/i }))
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer").textContent).toContain(
        "photo.png"
      )
    })
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
    const viewerRoots = container.querySelectorAll('[data-slot="viewer-root"]')
    expect(viewerRoots).toHaveLength(2)
    expect(viewerRoots[1]?.className).not.toContain("rounded-xl")
    expect(viewerRoots[1]?.className).not.toContain("border")
  })

  it("renders recursive message viewers only along the selected MIME chain", async () => {
    const root: MimePart = {
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        htmlPart("html", "<p>Outer body</p>", "message.html"),
        {
          id: "level-1",
          mimeType: "message/rfc822",
          disposition: "attachment",
          fileName: "level-1.eml",
          headers: [{ name: "Subject", value: "Level 1" }],
          children: [
            htmlPart("level-1-html", "<p>Level 1 body</p>"),
            {
              id: "level-2",
              mimeType: "message/rfc822",
              disposition: "attachment",
              fileName: "level-2.eml",
              headers: [{ name: "Subject", value: "Level 2" }],
              children: [htmlPart("level-2-html", "<p>Level 2 body</p>")],
            },
          ],
        },
      ],
    }

    const { container } = render(
      <EmailViewer message={message(root)} className="h-[720px]" />
    )

    await waitFor(() => {
      expect(
        container.querySelectorAll('[data-slot="viewer-root"]')
      ).toHaveLength(1)
    })

    fireEvent.click(screen.getByRole("button", { name: /level-1\.eml/i }))
    await waitFor(() => {
      expect(
        container.querySelectorAll('[data-slot="viewer-root"]')
      ).toHaveLength(2)
    })
    expect(screen.queryByText("Level 2")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /level-2\.eml/i }))
    await waitFor(() => {
      expect(
        container.querySelectorAll('[data-slot="viewer-root"]')
      ).toHaveLength(3)
    })
    expect(screen.getByText("Level 2")).toBeTruthy()
  })
})
