// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  DocxResourceViewer,
  DocxViewer,
  type DocxViewerHandle,
} from "@/registry/new-york-v4/ui/docx-viewer"
import { resetDocxResourceCacheForTests } from "@/registry/new-york-v4/ui/docx-viewer-resource"

const docxMock = vi.hoisted(() => ({
  renderAsync: vi.fn(),
  renderedBuffers: [] as ArrayBuffer[],
  deferred: null as null | Deferred<void>,
}))

vi.mock("docx-preview", () => ({
  renderAsync: docxMock.renderAsync,
}))

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

let observedContainerWidth = 848

class ResizeObserverMock {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    setClientWidth(target, observedContainerWidth)
    this.callback(
      [{ target } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    )
  }

  disconnect() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}

class MockHighlight {
  readonly ranges: Range[]

  constructor(...ranges: Range[]) {
    this.ranges = ranges
  }
}

const originalGetAnimations = HTMLElement.prototype.getAnimations
const originalAnchorClick = HTMLAnchorElement.prototype.click
const originalCss = globalThis.CSS
const originalWindowCss = window.CSS
const originalHighlight = globalThis.Highlight
const originalWindowHighlight = window.Highlight
const originalNodeFilter = globalThis.NodeFilter

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function response(bytes: Uint8Array, init: ResponseInit = {}) {
  return new Response(new Uint8Array(bytes), init)
}

function arrayBufferRejectingResponse(error: unknown): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: vi.fn().mockRejectedValue(error),
  } as unknown as Response
}

function docxUrlSource(url: string, fileName = "document.docx") {
  return { kind: "url" as const, url, fileName }
}

function docxBlobSource(bytes: Uint8Array, identityKey = "blob:docx") {
  return blobSource(bytes, {
    identityKey,
    fileName: "local.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

function flakyBlobSource({
  bytes = Uint8Array.of(1, 2, 3),
  identityKey = "blob:flaky-docx",
}: {
  bytes?: Uint8Array
  identityKey?: string
} = {}) {
  const blob = new Blob([], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  )
  Object.defineProperty(blob, "arrayBuffer", {
    configurable: true,
    value: vi
      .fn()
      .mockRejectedValueOnce(new Error("transient blob read failure"))
      .mockResolvedValueOnce(buffer),
  })
  return {
    kind: "blob" as const,
    blob,
    identityKey,
    fileName: "flaky.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
}

function abortingBlobSource(identityKey = "blob:aborted-docx") {
  const blob = new Blob([], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
  Object.defineProperty(blob, "arrayBuffer", {
    configurable: true,
    value: vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
  })
  return {
    kind: "blob" as const,
    blob,
    identityKey,
    fileName: "aborted.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
}

function mockObjectUrls(url = "blob:docx-download") {
  const createObjectURL = vi.fn(() => url)
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  })
  return { createObjectURL, revokeObjectURL }
}

function setClientWidth(element: Element, width: number) {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: width,
  })
}

function setScrollMetrics(
  element: Element,
  {
    clientHeight,
    scrollHeight,
    scrollTop,
  }: { clientHeight: number; scrollHeight: number; scrollTop?: number }
) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  })
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  })
  if (scrollTop != null) {
    Object.defineProperty(element, "scrollTop", {
      configurable: true,
      writable: true,
      value: scrollTop,
    })
  }
}

function rect(top: number, width = 816, height = 1056): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: width,
    top,
    width,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function installRenderedDocument(
  host: HTMLElement,
  {
    pageTops = [0, 1100],
    pageWidth = 816,
    pageHeight = 1056,
    text = "Quarterly   revenue \nincreased",
  }: {
    pageTops?: number[]
    pageWidth?: number
    pageHeight?: number
    text?: string
  } = {}
) {
  const wrapper = document.createElement("div")
  wrapper.className = "docx-wrapper"

  pageTops.forEach((top, index) => {
    const page = document.createElement("section")
    page.className = "docx"
    page.getBoundingClientRect = vi.fn(() => rect(top, pageWidth, pageHeight))
    if (index === 0) {
      const paragraph = document.createElement("p")
      const [first, second = ""] = text.split("\n")
      paragraph.append(first)
      paragraph.append(document.createElement("span"))
      paragraph.append(second)
      page.append(paragraph)

      const table = document.createElement("table")
      const row = table.insertRow()
      row.insertCell().textContent = "A1"
      row.insertCell().textContent = "Target cell"
      page.append(table)
    } else {
      page.textContent = `Page ${index + 1}`
    }
    wrapper.append(page)
  })

  host.replaceChildren(wrapper)
}

function installEmptyRenderedDocument(host: HTMLElement) {
  const wrapper = document.createElement("div")
  wrapper.className = "docx-wrapper"
  host.replaceChildren(wrapper)
}

function installRenderedDocumentWithNonDocumentMatches(host: HTMLElement) {
  const style = document.createElement("style")
  style.dataset.testid = "docx-generated-style"
  style.textContent = ".generated::before { content: 'Shadow target'; }"

  const wrapper = document.createElement("div")
  wrapper.className = "docx-wrapper"

  const page = document.createElement("section")
  page.className = "docx"
  page.getBoundingClientRect = vi.fn(() => rect(0))

  const hidden = document.createElement("p")
  hidden.hidden = true
  hidden.textContent = "Shadow target"
  page.append(hidden)

  const ariaHidden = document.createElement("p")
  ariaHidden.setAttribute("aria-hidden", "true")
  ariaHidden.textContent = "Shadow target"
  page.append(ariaHidden)

  const ariaHiddenUppercase = document.createElement("p")
  ariaHiddenUppercase.setAttribute("aria-hidden", "TRUE")
  ariaHiddenUppercase.textContent = "Shadow target"
  page.append(ariaHiddenUppercase)

  const ariaHiddenWhitespace = document.createElement("p")
  ariaHiddenWhitespace.setAttribute("aria-hidden", " true ")
  ariaHiddenWhitespace.textContent = "Shadow target"
  page.append(ariaHiddenWhitespace)

  const displayNone = document.createElement("p")
  displayNone.style.display = "none"
  displayNone.textContent = "Shadow target"
  page.append(displayNone)

  const visibilityHidden = document.createElement("p")
  visibilityHidden.style.visibility = "hidden"
  visibilityHidden.textContent = "Shadow target"
  page.append(visibilityHidden)

  const visibilityCollapse = document.createElement("p")
  visibilityCollapse.style.visibility = "collapse"
  visibilityCollapse.textContent = "Shadow target"
  page.append(visibilityCollapse)

  const contentVisibilityHidden = document.createElement("p")
  contentVisibilityHidden.style.setProperty("content-visibility", "hidden")
  contentVisibilityHidden.textContent = "Shadow target"
  page.append(contentVisibilityHidden)

  const visible = document.createElement("p")
  visible.textContent = "Visible Shadow target"
  page.append(visible)

  wrapper.append(page)
  host.replaceChildren(style, wrapper)
}

function installRenderedDocumentWithHiddenCell(host: HTMLElement) {
  const wrapper = document.createElement("div")
  wrapper.className = "docx-wrapper"

  const page = document.createElement("section")
  page.className = "docx"
  page.getBoundingClientRect = vi.fn(() => rect(0))

  const table = document.createElement("table")
  const row = table.insertRow()
  row.insertCell().textContent = "Visible cell"
  const hiddenCell = row.insertCell()
  hiddenCell.style.display = "none"
  hiddenCell.textContent = "Hidden target cell"
  page.append(table)

  wrapper.append(page)
  host.replaceChildren(wrapper)
}

function installRenderedDocumentWithExternalTable(host: HTMLElement) {
  const externalTable = document.createElement("table")
  externalTable.dataset.testid = "external-table"
  externalTable.insertRow().insertCell().textContent = "External target cell"

  const wrapper = document.createElement("div")
  wrapper.className = "docx-wrapper"

  const page = document.createElement("section")
  page.className = "docx"
  page.getBoundingClientRect = vi.fn(() => rect(0))

  const table = document.createElement("table")
  table.insertRow().insertCell().textContent = "Real target cell"
  page.append(table)

  wrapper.append(page)
  host.replaceChildren(externalTable, wrapper)
}

async function renderDocx(ui: React.ReactElement) {
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(ui)
  })
  return view
}

async function waitForRenderedDocx() {
  await screen.findByText("Page 1 of 2")
  await waitFor(() => {
    expect(docxMock.renderAsync).toHaveBeenCalled()
  })
}

beforeEach(() => {
  observedContainerWidth = 848
  docxMock.renderedBuffers.length = 0
  docxMock.deferred = null
  docxMock.renderAsync.mockReset()
  docxMock.renderAsync.mockImplementation(async (buffer, host) => {
    docxMock.renderedBuffers.push(buffer)
    installRenderedDocument(host)
  })

  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0)
    return 1
  })
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response(Uint8Array.of(1, 2, 3))))
  )
  mockObjectUrls()

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: vi.fn(() => []),
  })
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(globalThis, "NodeFilter", {
    configurable: true,
    value: window.NodeFilter,
  })
})

afterEach(() => {
  cleanup()
  resetDocxResourceCacheForTests()
  clearViewerResourceRegistryForTests()
  if (originalGetAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: originalGetAnimations,
    })
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "getAnimations")
  }
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: originalAnchorClick,
  })
  restoreBrowserGlobal("CSS", originalCss)
  restoreWindowGlobal("CSS", originalWindowCss)
  restoreBrowserGlobal("Highlight", originalHighlight)
  restoreWindowGlobal("Highlight", originalWindowHighlight)
  restoreBrowserGlobal("NodeFilter", originalNodeFilter)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function installHighlightApi(highlights: Map<string, MockHighlight>) {
  const css = { highlights }
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    value: css,
  })
  Object.defineProperty(window, "CSS", {
    configurable: true,
    value: css,
  })
  Object.defineProperty(globalThis, "Highlight", {
    configurable: true,
    value: MockHighlight,
  })
  Object.defineProperty(window, "Highlight", {
    configurable: true,
    value: MockHighlight,
  })
}

function restoreBrowserGlobal<K extends keyof typeof globalThis>(
  key: K,
  value: (typeof globalThis)[K]
) {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key)
    return
  }
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
  })
}

function restoreWindowGlobal(key: string, value: unknown) {
  if (value === undefined) {
    Reflect.deleteProperty(window, key)
    return
  }
  Object.defineProperty(window, key, {
    configurable: true,
    value,
  })
}

describe("DocxViewer", () => {
  it("renders server fallback markup without loading document bytes", () => {
    const html = renderToStaticMarkup(
      <DocxViewer
        source={docxUrlSource("/server.docx")}
        header={<div>Server header</div>}
        aside={<div>Server aside</div>}
      />
    )

    expect(html).toContain('data-slot="docx-viewer"')
    expect(html).toContain('data-slot="docx-viewer-header"')
    expect(html).toContain("Server header")
    expect(html).toContain('data-slot="docx-viewer-aside"')
    expect(html).toContain("Server aside")
    expect(html).toContain('data-slot="docx-page-skeleton"')
    expect(html).toContain("<button")
    expect(fetch).not.toHaveBeenCalled()
    expect(docxMock.renderAsync).not.toHaveBeenCalled()
  })

  it("does not render toolbar fallback chrome in toolbar-free server markup", () => {
    const html = renderToStaticMarkup(
      <DocxViewer
        source={docxUrlSource("/server-toolbarless.docx")}
        toolbar={false}
      />
    )

    expect(html).toContain('data-slot="docx-viewer"')
    expect(html).toContain('data-slot="docx-page-skeleton"')
    expect(html).not.toContain("<button")
    expect(fetch).not.toHaveBeenCalled()
    expect(docxMock.renderAsync).not.toHaveBeenCalled()
  })

  it("loads document bytes, renders with docx-preview, and tags rendered pages", async () => {
    await renderDocx(<DocxViewer source={docxUrlSource("/report.docx")} />)

    await waitForRenderedDocx()

    expect(fetch).toHaveBeenCalledWith("/report.docx", { signal: undefined })
    expect(docxMock.renderedBuffers[0]?.byteLength).toBe(3)
    expect(screen.getByText("100%")).toBeTruthy()

    const pages = document.querySelectorAll<HTMLElement>("[data-page-number]")
    expect([...pages].map((page) => page.dataset.pageNumber)).toEqual([
      "1",
      "2",
    ])
    expect(pages[0]?.style.contentVisibility).toBe("auto")
    expect(pages[0]?.style.containIntrinsicSize).toBe("816px 1056px")

    const link = screen.getByRole("link", { name: "Download" })
    expect(link.getAttribute("href")).toBe("/report.docx")
    expect(link.getAttribute("download")).toBe("document.docx")
  })

  it("passes paginated document render options to docx-preview", async () => {
    await renderDocx(<DocxViewer source={docxUrlSource("/options.docx")} />)

    await waitForRenderedDocx()

    expect(docxMock.renderAsync).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.any(HTMLDivElement),
      undefined,
      expect.objectContaining({
        breakPages: true,
        experimental: true,
        ignoreLastRenderedPageBreak: false,
        inWrapper: true,
        renderFooters: true,
        renderFootnotes: true,
        renderHeaders: true,
      })
    )
  })

  it("fetches the source URL while downloading from a separate download URL", async () => {
    await renderDocx(
      <DocxViewer
        source={{
          kind: "url",
          url: "/private/report.docx",
          downloadUrl: "/download/report.docx?token=abc",
          fileName: "signed-report.docx",
        }}
      />
    )

    await waitForRenderedDocx()

    expect(fetch).toHaveBeenCalledWith("/private/report.docx", {
      signal: undefined,
    })
    const link = screen.getByRole("link", { name: "Download" })
    expect(link.getAttribute("href")).toBe("/download/report.docx?token=abc")
    expect(link.getAttribute("download")).toBe("signed-report.docx")
  })

  it("uses a Blob source downloadUrl as a direct link instead of creating an object URL", async () => {
    const { createObjectURL } = mockObjectUrls("blob:should-not-be-used")

    await renderDocx(
      <DocxViewer
        source={blobSource(Uint8Array.of(1, 2, 3), {
          identityKey: "blob-with-download-url",
          fileName: "export.docx",
          downloadUrl: "/exports/export.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })}
      />
    )

    await waitForRenderedDocx()

    const link = screen.getByRole("link", { name: "Download" })
    expect(link.getAttribute("href")).toBe("/exports/export.docx")
    expect(link.getAttribute("download")).toBe("export.docx")
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("shares fetched bytes for matching source identities across mounted viewers", async () => {
    await renderDocx(
      <div>
        <DocxViewer source={docxUrlSource("/shared.docx")} />
        <DocxViewer source={docxUrlSource("/shared.docx")} />
      </div>
    )

    expect(await screen.findAllByText("Page 1 of 2")).toHaveLength(2)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
  })

  it("does not share bytes when callers provide distinct source identity keys", async () => {
    await renderDocx(
      <div>
        <DocxViewer
          source={{ ...docxUrlSource("/same-url.docx"), identityKey: "first" }}
        />
        <DocxViewer
          source={{ ...docxUrlSource("/same-url.docx"), identityKey: "second" }}
        />
      </div>
    )

    expect(await screen.findAllByText("Page 1 of 2")).toHaveLength(2)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("updates download metadata without reloading identical document bytes", async () => {
    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/metadata.docx", "first.docx")} />
    )

    await waitForRenderedDocx()
    let link = screen.getByRole("link", { name: "Download" })
    expect(link.getAttribute("download")).toBe("first.docx")

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/metadata.docx", "second.docx")} />
      )
    })

    link = screen.getByRole("link", { name: "Download" })
    expect(link.getAttribute("href")).toBe("/metadata.docx")
    expect(link.getAttribute("download")).toBe("second.docx")
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(docxMock.renderAsync).toHaveBeenCalledTimes(1)
  })

  it("loads Blob sources without fetch and exposes a Blob download", async () => {
    const { createObjectURL, revokeObjectURL } =
      mockObjectUrls("blob:local-docx")

    await renderDocx(
      <DocxViewer
        source={docxBlobSource(Uint8Array.of(8, 9, 10), "blob:local-docx")}
      />
    )

    await waitForRenderedDocx()
    expect(fetch).not.toHaveBeenCalled()
    expect(docxMock.renderedBuffers[0]).toHaveProperty("byteLength", 3)

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-docx")
    })
  })

  it("renders a pre-created resource through DocxResourceViewer", async () => {
    const resource = createViewerResource(docxUrlSource("/resource.docx"))

    await renderDocx(<DocxResourceViewer resource={resource} />)

    await waitForRenderedDocx()
    expect(fetch).toHaveBeenCalledWith("/resource.docx", {
      signal: undefined,
    })
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("href")
    ).toBe("/resource.docx")
  })

  it("recovers DocxResourceViewer when its resource prop changes after a load error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve(
        response(
          url === "/resource-broken.docx"
            ? Uint8Array.of()
            : Uint8Array.of(4, 5, 6),
          { status: url === "/resource-broken.docx" ? 500 : 200 }
        )
      )
    )
    const broken = createViewerResource(docxUrlSource("/resource-broken.docx"))
    const fixed = createViewerResource(docxUrlSource("/resource-fixed.docx"))

    const view = await renderDocx(<DocxResourceViewer resource={broken} />)

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy()

    await act(async () => {
      view.rerender(<DocxResourceViewer resource={fixed} />)
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("does not show toolbar chrome when toolbar is disabled during loading or after render", async () => {
    const pending = deferred<void>()
    docxMock.deferred = pending
    docxMock.renderAsync.mockImplementation(async (_buffer, host) => {
      installRenderedDocument(host)
      await pending.promise
    })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/no-toolbar.docx")} toolbar={false} />
    )

    expect(screen.queryByLabelText("Zoom in")).toBeNull()
    expect(screen.queryByLabelText("Download")).toBeNull()

    await act(async () => {
      pending.resolve()
      await pending.promise
    })
    await screen.findByText("Target cell")

    expect(
      view.container.querySelector("[data-slot='docx-viewer']")
    ).toBeTruthy()
    expect(screen.queryByLabelText("Zoom in")).toBeNull()
    expect(screen.queryByLabelText("Download")).toBeNull()
  })

  it("reacts to controlled scale prop changes", async () => {
    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/scale.docx")} scale={1} />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("100%")).toBeTruthy()

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/scale.docx")} scale={2} />
      )
    })

    expect(await screen.findByText("200%")).toBeTruthy()
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("2")
  })

  it("measures natural page dimensions when controlled scale changes before render completes", async () => {
    const pending = deferred<void>()
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      await pending.promise
      installRenderedDocument(host, { pageWidth: 1632, pageHeight: 2112 })
    })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/pending-scale.docx")} scale={1} />
    )

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/pending-scale.docx")} scale={2} />
      )
    })
    await act(async () => {
      pending.resolve()
      await pending.promise
    })

    expect(await screen.findByText("200%")).toBeTruthy()
    const firstPage = document.querySelector<HTMLElement>("[data-page-number]")
    expect(firstPage?.style.containIntrinsicSize).toBe("816px 1056px")
  })

  it("clamps controlled scale values to the supported zoom range", async () => {
    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/controlled-low.docx")} scale={-1} />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("25%")).toBeTruthy()
    let host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("0.25")

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/controlled-low.docx")} scale={20} />
      )
    })

    expect(await screen.findByText("500%")).toBeTruthy()
    host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("5")
  })

  it("keeps toolbar zoom actions from overriding a controlled scale prop", async () => {
    await renderDocx(
      <DocxViewer source={docxUrlSource("/controlled-fixed.docx")} scale={1} />
    )

    await waitForRenderedDocx()
    fireEvent.click(screen.getByLabelText("Zoom in"))

    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.queryByText("120%")).toBeNull()
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("1")
  })

  it("returns to fit-width when a controlled scale prop is removed", async () => {
    observedContainerWidth = 440
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocument(host, { pageWidth: 1632, pageHeight: 2112 })
    })
    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/controlled-to-fit.docx")} scale={2} />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("200%")).toBeTruthy()

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/controlled-to-fit.docx")} />
      )
    })

    expect(await screen.findByText("50%")).toBeTruthy()
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("0.5")
  })

  it("renders with the initial container width when ResizeObserver is unavailable", async () => {
    vi.stubGlobal("ResizeObserver", undefined)

    await renderDocx(
      <DocxViewer source={docxUrlSource("/no-resize-observer.docx")} />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByText("Target cell")).toBeTruthy()
  })

  it("renders with the initial container width when ResizeObserver construction throws", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor() {
          throw new Error("resize observer unavailable")
        }
      }
    )
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(848)

    await renderDocx(
      <DocxViewer source={docxUrlSource("/throwing-resize-observer.docx")} />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByText("Target cell")).toBeTruthy()
    clientWidth.mockRestore()
  })

  it("renders with the initial container width when ResizeObserver observe throws", async () => {
    class ObserveThrowingResizeObserver {
      static instances: ObserveThrowingResizeObserver[] = []

      disconnect = vi.fn()
      observe = vi.fn(() => {
        throw new Error("resize observer observe failed")
      })

      constructor() {
        ObserveThrowingResizeObserver.instances.push(this)
      }
    }
    vi.stubGlobal("ResizeObserver", ObserveThrowingResizeObserver)
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(848)

    await renderDocx(
      <DocxViewer source={docxUrlSource("/throwing-resize-observe.docx")} />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByText("Target cell")).toBeTruthy()
    expect(
      ObserveThrowingResizeObserver.instances.some(
        (observer) => observer.disconnect.mock.calls.length > 0
      )
    ).toBe(true)
    clientWidth.mockRestore()
  })

  it("recomputes fit-width zoom when the container is resized", async () => {
    const observations: Array<{
      callback: ResizeObserverCallback
      observer: ResizeObserver
      target: Element
    }> = []
    class ManualResizeObserver {
      private callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe(target: Element) {
        setClientWidth(target, 848)
        observations.push({
          callback: this.callback,
          observer: this as unknown as ResizeObserver,
          target,
        })
        this.callback(
          [{ target } as ResizeObserverEntry],
          this as unknown as ResizeObserver
        )
      }

      disconnect() {}
      unobserve() {}
      takeRecords() {
        return []
      }
    }
    vi.stubGlobal("ResizeObserver", ManualResizeObserver)

    await renderDocx(<DocxViewer source={docxUrlSource("/resize.docx")} />)
    await waitForRenderedDocx()
    expect(screen.getByText("100%")).toBeTruthy()

    expect(observations.length).toBeGreaterThan(0)
    await act(async () => {
      for (const observation of observations) {
        setClientWidth(observation.target, 440)
        observation.callback(
          [{ target: observation.target } as ResizeObserverEntry],
          observation.observer
        )
      }
    })

    expect(await screen.findByText("50%")).toBeTruthy()
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("0.5")
  })

  it("disconnects the ResizeObserver when the viewer unmounts", async () => {
    const disconnectSpy = vi.fn()
    class DisconnectTrackingResizeObserver {
      private callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe(target: Element) {
        setClientWidth(target, 848)
        this.callback(
          [{ target } as ResizeObserverEntry],
          this as unknown as ResizeObserver
        )
      }

      disconnect = disconnectSpy
      unobserve() {}
      takeRecords() {
        return []
      }
    }
    vi.stubGlobal("ResizeObserver", DisconnectTrackingResizeObserver)

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/resize-cleanup.docx")} />
    )
    await waitForRenderedDocx()

    view.unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it("cancels pending resize measurement when unmounted", async () => {
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrame = 1
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      const id = nextFrame
      nextFrame += 1
      frames.set(id, callback)
      return id
    })
    vi.mocked(window.cancelAnimationFrame).mockImplementation((id) => {
      frames.delete(id)
    })
    class QueuedResizeObserver {
      private callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe(target: Element) {
        setClientWidth(target, 848)
        this.callback(
          [{ target } as ResizeObserverEntry],
          this as unknown as ResizeObserver
        )
      }

      disconnect() {}
      unobserve() {}
      takeRecords() {
        return []
      }
    }
    vi.stubGlobal("ResizeObserver", QueuedResizeObserver)

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/cancel-resize-frame.docx")} />
    )
    await waitForRenderedDocx()

    expect(frames.size).toBeGreaterThan(0)
    vi.mocked(window.cancelAnimationFrame).mockClear()
    view.unmount()

    expect(window.cancelAnimationFrame).toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it("zooms, clamps the lower bound, and restores fit-width scale", async () => {
    await renderDocx(<DocxViewer source={docxUrlSource("/zoom.docx")} />)
    await waitForRenderedDocx()

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(await screen.findByText("120%")).toBeTruthy()

    for (let i = 0; i < 12; i += 1) {
      fireEvent.click(screen.getByLabelText("Zoom out"))
    }
    expect(await screen.findByText("25%")).toBeTruthy()

    const container = document.querySelector(
      '[data-slot="docx-viewer"] [class*="items-center"]'
    )
    expect(container).toBeTruthy()
    setClientWidth(container!, 848)
    fireEvent.click(screen.getByLabelText("Fit width"))

    expect(await screen.findByText("100%")).toBeTruthy()
  })

  it("clamps automatic fit-width scale to the supported zoom range", async () => {
    observedContainerWidth = 16
    const narrowView = await renderDocx(
      <DocxViewer source={docxUrlSource("/narrow.docx")} />
    )
    await waitForRenderedDocx()

    expect(screen.getByText("25%")).toBeTruthy()
    let host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("0.25")

    narrowView.unmount()
    cleanup()
    resetDocxResourceCacheForTests()
    clearViewerResourceRegistryForTests()

    observedContainerWidth = 5000
    await renderDocx(<DocxViewer source={docxUrlSource("/wide.docx")} />)
    await waitForRenderedDocx()

    expect(screen.getByText("500%")).toBeTruthy()
    host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("5")
  })

  it("uses default page dimensions when rendered pages measure as zero", async () => {
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocument(host, { pageWidth: 0, pageHeight: 0 })
    })

    await renderDocx(<DocxViewer source={docxUrlSource("/zero-size.docx")} />)

    await waitForRenderedDocx()
    const firstPage = document.querySelector<HTMLElement>("[data-page-number]")
    expect(firstPage?.style.containIntrinsicSize).toBe("816px 1056px")
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("renders header and aside slots without blocking document render", async () => {
    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/slots.docx")}
        header={<div>Document legend</div>}
        aside={<nav aria-label="Pages">Page rail</nav>}
      />
    )

    await waitForRenderedDocx()

    expect(
      view.container.querySelector('[data-slot="docx-viewer-header"]')
        ?.textContent
    ).toBe("Document legend")
    expect(
      view.container.querySelector('[data-slot="docx-viewer-aside"]')
        ?.textContent
    ).toBe("Page rail")
    expect(screen.getByText("Target cell")).toBeTruthy()
  })

  it("keeps header and aside slots visible while resource bytes are loading", async () => {
    const pendingResponse = deferred<Response>()
    vi.mocked(fetch).mockImplementation(() => pendingResponse.promise)

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/loading-slots.docx")}
        header={<div>Loading legend</div>}
        aside={<nav>Loading rail</nav>}
      />
    )

    expect(await screen.findByText("Loading legend")).toBeTruthy()
    expect(screen.getByText("Loading rail")).toBeTruthy()
    expect(screen.queryByText("Target cell")).toBeNull()

    await act(async () => {
      pendingResponse.resolve(response(Uint8Array.of(1, 2, 3), { status: 200 }))
      await pendingResponse.promise
    })

    expect(await screen.findByText("Target cell")).toBeTruthy()
  })

  it("keeps header and aside slots visible while rendering is pending", async () => {
    const pending = deferred<void>()
    docxMock.renderAsync.mockImplementation(async (_buffer, host) => {
      installRenderedDocument(host)
      await pending.promise
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/pending-slots.docx")}
        header={<div>Pending legend</div>}
        aside={<nav>Pending rail</nav>}
      />
    )

    expect(await screen.findByText("Pending legend")).toBeTruthy()
    expect(screen.getByText("Pending rail")).toBeTruthy()
    expect(screen.queryByText("Target cell")).toBeNull()

    await act(async () => {
      pending.resolve()
      await pending.promise
    })

    expect(await screen.findByText("Target cell")).toBeTruthy()
  })

  it("reports visible page and scroll progress from the scroll viewport", async () => {
    const onVisiblePageChange = vi.fn()
    const onScrollProgressChange = vi.fn()

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/scroll.docx")}
        onScrollProgressChange={onScrollProgressChange}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    await waitForRenderedDocx()

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    const pages = document.querySelectorAll<HTMLElement>("[data-page-number]")
    pages[0]!.getBoundingClientRect = vi.fn(() => rect(-500))
    pages[1]!.getBoundingClientRect = vi.fn(() => rect(50))
    setScrollMetrics(viewport!, {
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 500,
    })
    viewport!.getBoundingClientRect = vi.fn(() => rect(0, 800, 500))

    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(onScrollProgressChange).toHaveBeenCalledWith(0.5)
      expect(onVisiblePageChange).toHaveBeenCalledWith(2)
    })
    expect(screen.getByText("Page 2 of 2")).toBeTruthy()
  })

  it("resets the visible page when the document source changes", async () => {
    const onVisiblePageChange = vi.fn()
    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/first-page-state.docx")}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    await waitForRenderedDocx()

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    const pages = document.querySelectorAll<HTMLElement>("[data-page-number]")
    pages[0]!.getBoundingClientRect = vi.fn(() => rect(-500))
    pages[1]!.getBoundingClientRect = vi.fn(() => rect(50))
    setScrollMetrics(viewport!, {
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 500,
    })
    viewport!.getBoundingClientRect = vi.fn(() => rect(0, 800, 500))

    fireEvent.scroll(viewport!)
    expect(await screen.findByText("Page 2 of 2")).toBeTruthy()
    expect(onVisiblePageChange).toHaveBeenLastCalledWith(2)

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/second-page-state.docx")}
          onVisiblePageChange={onVisiblePageChange}
        />
      )
    })

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
      expect(screen.getByText("Page 1 of 2")).toBeTruthy()
      expect(onVisiblePageChange).toHaveBeenLastCalledWith(1)
    })
  })

  it("scrolls back to the top when the document source changes", async () => {
    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/first-scroll-position.docx")} />
    )
    await waitForRenderedDocx()

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    setScrollMetrics(viewport!, {
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 650,
    })

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/second-scroll-position.docx")} />
      )
    })

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
    })
    expect(viewport!.scrollTop).toBe(0)
  })

  it("reports zero scroll progress when the viewport is not scrollable", async () => {
    const onScrollProgressChange = vi.fn()

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/no-scroll.docx")}
        onScrollProgressChange={onScrollProgressChange}
      />
    )
    await waitForRenderedDocx()

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    setScrollMetrics(viewport!, {
      clientHeight: 500,
      scrollHeight: 500,
      scrollTop: 250,
    })

    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(onScrollProgressChange).toHaveBeenCalledWith(0)
    })
  })

  it("clamps scroll progress to the supported range", async () => {
    const onScrollProgressChange = vi.fn()

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/clamped-scroll.docx")}
        onScrollProgressChange={onScrollProgressChange}
      />
    )
    await waitForRenderedDocx()

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    setScrollMetrics(viewport!, {
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 5000,
    })

    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(onScrollProgressChange).toHaveBeenLastCalledWith(1)
    })

    cleanup()
    resetDocxResourceCacheForTests()
    clearViewerResourceRegistryForTests()
    onScrollProgressChange.mockClear()

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/negative-scroll.docx")}
        onScrollProgressChange={onScrollProgressChange}
      />
    )
    await waitForRenderedDocx()

    const negativeViewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(negativeViewport).toBeTruthy()
    setScrollMetrics(negativeViewport!, {
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: -50,
    })

    fireEvent.scroll(negativeViewport!)

    await waitFor(() => {
      expect(onScrollProgressChange).toHaveBeenLastCalledWith(0)
    })
  })

  it("coalesces scroll work to one animation frame and reads the latest scroll position", async () => {
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrame = 1
    vi.stubGlobal("ResizeObserver", undefined)
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      const id = nextFrame
      nextFrame += 1
      frames.set(id, callback)
      return id
    })
    vi.mocked(window.cancelAnimationFrame).mockImplementation((id) => {
      frames.delete(id)
    })
    const onVisiblePageChange = vi.fn()
    const onScrollProgressChange = vi.fn()

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/coalesced-scroll.docx")}
        onScrollProgressChange={onScrollProgressChange}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    await waitForRenderedDocx()
    vi.mocked(window.requestAnimationFrame).mockClear()
    onVisiblePageChange.mockClear()
    onScrollProgressChange.mockClear()

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    const pages = document.querySelectorAll<HTMLElement>("[data-page-number]")
    pages[0]!.getBoundingClientRect = vi.fn(() => rect(-1200))
    pages[1]!.getBoundingClientRect = vi.fn(() => rect(-50))
    viewport!.getBoundingClientRect = vi.fn(() => rect(0, 800, 500))

    setScrollMetrics(viewport!, {
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 250,
    })
    fireEvent.scroll(viewport!)
    setScrollMetrics(viewport!, {
      clientHeight: 500,
      scrollHeight: 1500,
      scrollTop: 750,
    })
    fireEvent.scroll(viewport!)

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(1)

    await act(async () => {
      for (const callback of [...frames.values()]) callback(16)
      frames.clear()
    })

    expect(onScrollProgressChange).toHaveBeenCalledTimes(1)
    expect(onScrollProgressChange).toHaveBeenCalledWith(0.75)
    expect(onVisiblePageChange).toHaveBeenCalledTimes(1)
    expect(onVisiblePageChange).toHaveBeenCalledWith(2)
  })

  it("cancels pending scroll measurement when unmounted", async () => {
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrame = 1
    vi.stubGlobal("ResizeObserver", undefined)
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      const id = nextFrame
      nextFrame += 1
      frames.set(id, callback)
      return id
    })
    vi.mocked(window.cancelAnimationFrame).mockImplementation((id) => {
      frames.delete(id)
    })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/cancel-scroll-frame.docx")} />
    )
    await waitForRenderedDocx()
    vi.mocked(window.cancelAnimationFrame).mockClear()

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    fireEvent.scroll(viewport!)

    expect(frames.size).toBe(1)
    view.unmount()

    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })

  it("uses CSS highlights for whitespace-normalized text targets and removes stale highlights", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/highlight.docx")}
        highlight={{ kind: "text", text: "revenue increased" }}
      />
    )

    await waitForRenderedDocx()
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "revenue increased"
    )

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/highlight.docx")}
          highlight={{ kind: "text", text: "missing" }}
        />
      )
    })

    await waitFor(() => {
      expect(highlights.size).toBe(0)
    })
  })

  it("ignores style, hidden, and aria-hidden text when resolving text highlights", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocumentWithNonDocumentMatches(host)
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/hidden-text-highlight.docx")}
        highlight={{ kind: "text", text: "Shadow target" }}
      />
    )

    await screen.findByText("Visible Shadow target")
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    const range = [...highlights.values()][0]?.ranges[0]
    expect(range?.toString()).toBe("Shadow target")
    expect(range?.startContainer.parentElement?.tagName).toBe("P")
    expect(range?.startContainer.parentElement?.hidden).toBe(false)
    expect(
      range?.startContainer.parentElement
        ?.getAttribute("aria-hidden")
        ?.toLowerCase()
    ).not.toBe("true")
    expect(range?.startContainer.parentElement?.style.display).not.toBe("none")
    expect(range?.startContainer.parentElement?.style.visibility).not.toBe(
      "hidden"
    )
    expect(range?.startContainer.parentElement?.style.visibility).not.toBe(
      "collapse"
    )
    expect(
      range?.startContainer.parentElement?.style.getPropertyValue(
        "content-visibility"
      )
    ).not.toBe("hidden")
  })

  it("does not recreate CSS highlights for equivalent target values", async () => {
    const highlights = new Map<string, MockHighlight>()
    const set = vi.spyOn(highlights, "set")
    installHighlightApi(highlights)

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/stable-highlight.docx")}
        highlight={{ kind: "text", text: "Target cell" }}
      />
    )

    await waitForRenderedDocx()
    await waitFor(() => {
      expect(set).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/stable-highlight.docx")}
          highlight={{ kind: "text", text: "Target cell" }}
        />
      )
    })

    expect(set).toHaveBeenCalledTimes(1)
    expect(highlights.size).toBe(1)
  })

  it("does not recreate CSS highlights for whitespace-equivalent text targets", async () => {
    const highlights = new Map<string, MockHighlight>()
    const set = vi.spyOn(highlights, "set")
    installHighlightApi(highlights)

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/stable-whitespace-highlight.docx")}
        highlight={{ kind: "text", text: "revenue increased" }}
      />
    )

    await waitForRenderedDocx()
    await waitFor(() => {
      expect(set).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/stable-whitespace-highlight.docx")}
          highlight={{ kind: "text", text: "revenue   \n increased" }}
        />
      )
    })

    expect(set).toHaveBeenCalledTimes(1)
    expect(highlights.size).toBe(1)
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "revenue increased"
    )
  })

  it("removes the active CSS highlight when the viewer unmounts", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/highlight-cleanup.docx")}
        highlight={{ kind: "text", text: "Target cell" }}
      />
    )

    await waitForRenderedDocx()
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })

    view.unmount()

    await waitFor(() => {
      expect(highlights.size).toBe(0)
    })
  })

  it("removes CSS highlights while a new source is rendering", async () => {
    const highlights = new Map<string, MockHighlight>()
    const second = deferred<void>()
    installHighlightApi(highlights)
    docxMock.renderAsync
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host, { text: "old highlighted document" })
      })
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host, { text: "new highlighted document" })
        await second.promise
      })

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/highlight-old.docx")}
        highlight={{ kind: "text", text: "old highlighted document" }}
      />
    )

    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/highlight-new.docx")}
          highlight={{ kind: "text", text: "new highlighted document" }}
        />
      )
    })

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
      expect(highlights.size).toBe(0)
    })

    await act(async () => {
      second.resolve()
      await second.promise
    })

    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "new highlighted document"
    )
  })

  it("renders safely when the CSS Highlight API is unavailable", async () => {
    Reflect.deleteProperty(globalThis, "CSS")
    Reflect.deleteProperty(window, "CSS")
    Reflect.deleteProperty(globalThis, "Highlight")
    Reflect.deleteProperty(window, "Highlight")

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/no-highlight-api.docx")}
        highlight={{ kind: "text", text: "Target cell" }}
      />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("Target cell")).toBeTruthy()
  })

  it("renders safely when the CSS Highlight API throws", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    class ThrowingHighlight {
      constructor() {
        throw new Error("highlight construction failed")
      }
    }
    Object.defineProperty(globalThis, "Highlight", {
      configurable: true,
      value: ThrowingHighlight,
    })
    Object.defineProperty(window, "Highlight", {
      configurable: true,
      value: ThrowingHighlight,
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/throwing-highlight.docx")}
        highlight={{ kind: "text", text: "Target cell" }}
      />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("Target cell")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(highlights.size).toBe(0)
  })

  it("highlights table cell targets by table row and column index", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/table-highlight.docx")}
        highlight={{ kind: "cell", table: 0, row: 0, column: 1 }}
      />
    )

    await waitForRenderedDocx()
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "Target cell"
    )
  })

  it("does not highlight hidden table cell targets", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocumentWithHiddenCell(host)
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/hidden-cell-highlight.docx")}
        highlight={{ kind: "cell", table: 0, row: 0, column: 1 }}
      />
    )

    await screen.findByText("Visible cell")

    await waitFor(() => {
      expect(highlights.size).toBe(0)
    })
  })

  it("indexes table cell targets from document pages only", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocumentWithExternalTable(host)
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/external-table-highlight.docx")}
        highlight={{ kind: "cell", table: 0, row: 0, column: 0 }}
      />
    )

    await screen.findByText("Real target cell")
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "Real target cell"
    )
  })

  it("keeps CSS highlights isolated across multiple viewer instances", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    const view = await renderDocx(
      <div>
        <DocxViewer
          source={docxUrlSource("/highlight-one.docx")}
          highlight={{ kind: "text", text: "revenue increased" }}
        />
        <DocxViewer
          source={docxUrlSource("/highlight-two.docx")}
          highlight={{ kind: "cell", table: 0, row: 0, column: 1 }}
        />
      </div>
    )

    await waitFor(() => {
      expect(screen.getAllByText("Page 1 of 2")).toHaveLength(2)
      expect(highlights.size).toBe(2)
    })
    expect(
      [...highlights.values()].map((highlight) =>
        highlight.ranges[0]?.toString()
      )
    ).toEqual(["revenue increased", "Target cell"])

    await act(async () => {
      view.rerender(
        <div>
          <DocxViewer
            source={docxUrlSource("/highlight-one.docx")}
            highlight={null}
          />
          <DocxViewer
            source={docxUrlSource("/highlight-two.docx")}
            highlight={{ kind: "cell", table: 0, row: 0, column: 1 }}
          />
        </div>
      )
    })

    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "Target cell"
    )
  })

  it("exposes the viewport and scrolls resolved targets through the imperative handle", async () => {
    const ref = React.createRef<DocxViewerHandle>()

    await renderDocx(
      <DocxViewer ref={ref} source={docxUrlSource("/ref.docx")} />
    )
    await waitForRenderedDocx()

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(ref.current?.getViewportElement()).toBe(viewport)

    const scrollIntoView = vi.fn()
    const targetCell = screen.getByText("Target cell")
    Object.defineProperty(targetCell, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })

    ref.current?.scrollToTarget(
      { kind: "cell", table: 0, row: 0, column: 1 },
      { behavior: "instant", block: "start", inline: "start" }
    )

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "instant",
      block: "start",
      inline: "start",
    })
  })

  it("does not scroll non-document text when the imperative handle resolves targets", async () => {
    const ref = React.createRef<DocxViewerHandle>()
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocumentWithNonDocumentMatches(host)
    })

    await renderDocx(
      <DocxViewer
        ref={ref}
        source={docxUrlSource("/hidden-text-scroll.docx")}
      />
    )
    await screen.findByText("Visible Shadow target")

    const style = document.querySelector("[data-testid='docx-generated-style']")
    const hidden = document.querySelector<HTMLElement>("p[hidden]")
    const ariaHidden = document.querySelector<HTMLElement>(
      'p[aria-hidden="true"]'
    )
    const ariaHiddenUppercase = document.querySelector<HTMLElement>(
      'p[aria-hidden="TRUE"]'
    )
    const ariaHiddenWhitespace = document.querySelector<HTMLElement>(
      'p[aria-hidden=" true "]'
    )
    const displayNone = document.querySelector<HTMLElement>(
      'p[style*="display: none"]'
    )
    const visibilityHidden = document.querySelector<HTMLElement>(
      'p[style*="visibility: hidden"]'
    )
    const visibilityCollapse = document.querySelector<HTMLElement>(
      'p[style*="visibility: collapse"]'
    )
    const contentVisibilityHidden = document.querySelector<HTMLElement>(
      'p[style*="content-visibility: hidden"]'
    )
    const visible = screen.getByText("Visible Shadow target")
    const styleScroll = vi.fn()
    const hiddenScroll = vi.fn()
    const ariaHiddenScroll = vi.fn()
    const ariaHiddenUppercaseScroll = vi.fn()
    const ariaHiddenWhitespaceScroll = vi.fn()
    const displayNoneScroll = vi.fn()
    const visibilityHiddenScroll = vi.fn()
    const visibilityCollapseScroll = vi.fn()
    const contentVisibilityHiddenScroll = vi.fn()
    const visibleScroll = vi.fn()
    Object.defineProperty(style, "scrollIntoView", {
      configurable: true,
      value: styleScroll,
    })
    Object.defineProperty(hidden, "scrollIntoView", {
      configurable: true,
      value: hiddenScroll,
    })
    Object.defineProperty(ariaHidden, "scrollIntoView", {
      configurable: true,
      value: ariaHiddenScroll,
    })
    Object.defineProperty(ariaHiddenUppercase, "scrollIntoView", {
      configurable: true,
      value: ariaHiddenUppercaseScroll,
    })
    Object.defineProperty(ariaHiddenWhitespace, "scrollIntoView", {
      configurable: true,
      value: ariaHiddenWhitespaceScroll,
    })
    Object.defineProperty(displayNone, "scrollIntoView", {
      configurable: true,
      value: displayNoneScroll,
    })
    Object.defineProperty(visibilityHidden, "scrollIntoView", {
      configurable: true,
      value: visibilityHiddenScroll,
    })
    Object.defineProperty(visibilityCollapse, "scrollIntoView", {
      configurable: true,
      value: visibilityCollapseScroll,
    })
    Object.defineProperty(contentVisibilityHidden, "scrollIntoView", {
      configurable: true,
      value: contentVisibilityHiddenScroll,
    })
    Object.defineProperty(visible, "scrollIntoView", {
      configurable: true,
      value: visibleScroll,
    })

    ref.current?.scrollToTarget({
      kind: "text",
      text: "Shadow target",
    })

    expect(styleScroll).not.toHaveBeenCalled()
    expect(hiddenScroll).not.toHaveBeenCalled()
    expect(ariaHiddenScroll).not.toHaveBeenCalled()
    expect(ariaHiddenUppercaseScroll).not.toHaveBeenCalled()
    expect(ariaHiddenWhitespaceScroll).not.toHaveBeenCalled()
    expect(displayNoneScroll).not.toHaveBeenCalled()
    expect(visibilityHiddenScroll).not.toHaveBeenCalled()
    expect(visibilityCollapseScroll).not.toHaveBeenCalled()
    expect(contentVisibilityHiddenScroll).not.toHaveBeenCalled()
    expect(visibleScroll).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    })
  })

  it("no-ops imperative scrolling for unresolved targets", async () => {
    const ref = React.createRef<DocxViewerHandle>()

    await renderDocx(
      <DocxViewer ref={ref} source={docxUrlSource("/missing-ref.docx")} />
    )
    await waitForRenderedDocx()

    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView")

    ref.current?.scrollToTarget({ kind: "text", text: "not in document" })
    ref.current?.scrollToTarget({ kind: "cell", table: 9, row: 9, column: 9 })

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("does not scroll hidden table cell targets", async () => {
    const ref = React.createRef<DocxViewerHandle>()
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocumentWithHiddenCell(host)
    })

    await renderDocx(
      <DocxViewer
        ref={ref}
        source={docxUrlSource("/hidden-cell-scroll.docx")}
      />
    )
    await screen.findByText("Visible cell")

    const hiddenCell = document.querySelector<HTMLElement>(
      'td[style*="display: none"]'
    )
    const hiddenCellScroll = vi.fn()
    Object.defineProperty(hiddenCell, "scrollIntoView", {
      configurable: true,
      value: hiddenCellScroll,
    })

    ref.current?.scrollToTarget({ kind: "cell", table: 0, row: 0, column: 1 })

    expect(hiddenCellScroll).not.toHaveBeenCalled()
  })

  it("scrolls table cell targets from document pages only", async () => {
    const ref = React.createRef<DocxViewerHandle>()
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocumentWithExternalTable(host)
    })

    await renderDocx(
      <DocxViewer
        ref={ref}
        source={docxUrlSource("/external-table-scroll.docx")}
      />
    )
    await screen.findByText("Real target cell")

    const externalCell = screen.getByText("External target cell")
    const realCell = screen.getByText("Real target cell")
    const externalScroll = vi.fn()
    const realScroll = vi.fn()
    Object.defineProperty(externalCell, "scrollIntoView", {
      configurable: true,
      value: externalScroll,
    })
    Object.defineProperty(realCell, "scrollIntoView", {
      configurable: true,
      value: realScroll,
    })

    ref.current?.scrollToTarget({ kind: "cell", table: 0, row: 0, column: 0 })

    expect(externalScroll).not.toHaveBeenCalled()
    expect(realScroll).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    })
  })

  it("ignores stale async renders after the source changes", async () => {
    const first = deferred<void>()
    docxMock.renderAsync
      .mockImplementationOnce(async (_buffer, host) => {
        await first.promise
        installRenderedDocument(host, { text: "old document" })
      })
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host, { text: "new document" })
      })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/old.docx")} />
    )

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      view.rerender(<DocxViewer source={docxUrlSource("/new.docx")} />)
    })
    expect(await screen.findByText("new document")).toBeTruthy()

    await act(async () => {
      first.resolve()
      await first.promise
    })

    expect(screen.queryByText("old document")).toBeNull()
    expect(screen.getByText("new document")).toBeTruthy()
  })

  it("removes the previous document DOM while a new source is rendering", async () => {
    const second = deferred<void>()
    docxMock.renderAsync
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host, { text: "old visible document" })
      })
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host, { text: "new pending document" })
        await second.promise
      })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/old-visible.docx")} />
    )
    expect(await screen.findByText("old visible document")).toBeTruthy()

    await act(async () => {
      view.rerender(<DocxViewer source={docxUrlSource("/new-pending.docx")} />)
    })

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText("old visible document")).toBeNull()
    expect(screen.queryByText("new pending document")).toBeNull()

    await act(async () => {
      second.resolve()
      await second.promise
    })

    expect(await screen.findByText("new pending document")).toBeTruthy()
  })

  it("ignores stale document bytes after the source changes during loading", async () => {
    const firstResponse = deferred<Response>()
    vi.mocked(fetch).mockImplementation((url) => {
      if (url === "/slow-load.docx") return firstResponse.promise
      return Promise.resolve(response(Uint8Array.of(4, 5, 6), { status: 200 }))
    })
    docxMock.renderAsync.mockImplementation(async (_buffer, host) => {
      installRenderedDocument(host, { text: "fast document" })
    })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/slow-load.docx")} />
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/slow-load.docx", {
        signal: undefined,
      })
    })

    await act(async () => {
      view.rerender(<DocxViewer source={docxUrlSource("/fast-load.docx")} />)
    })
    expect(await screen.findByText("fast document")).toBeTruthy()

    await act(async () => {
      firstResponse.resolve(response(Uint8Array.of(1, 2, 3), { status: 200 }))
      await firstResponse.promise
    })

    expect(screen.getByText("fast document")).toBeTruthy()
    expect(docxMock.renderAsync).toHaveBeenCalledTimes(1)
  })

  it("does not render bytes that resolve after the viewer unmounts", async () => {
    const pendingResponse = deferred<Response>()
    vi.mocked(fetch).mockImplementation(() => pendingResponse.promise)

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/unmounted-load.docx")} />
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/unmounted-load.docx", {
        signal: undefined,
      })
    })

    view.unmount()

    await act(async () => {
      pendingResponse.resolve(response(Uint8Array.of(1, 2, 3), { status: 200 }))
      await pendingResponse.promise
    })

    expect(docxMock.renderAsync).not.toHaveBeenCalled()
  })

  it("does not commit a docx-preview render that resolves after unmount", async () => {
    const pending = deferred<void>()
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      await pending.promise
      installRenderedDocument(host, { text: "late unmounted document" })
    })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/unmounted-render.docx")} />
    )

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(1)
    })
    view.unmount()

    await act(async () => {
      pending.resolve()
      await pending.promise
    })

    expect(screen.queryByText("late unmounted document")).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("ignores docx-preview failures that reject after unmount", async () => {
    const pending = deferred<void>()
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    docxMock.renderAsync.mockImplementationOnce(async () => {
      await pending.promise
      throw new Error("late unmounted failure")
    })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/unmounted-render-error.docx")} />
    )

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(1)
    })
    view.unmount()

    await act(async () => {
      pending.resolve()
      await pending.promise
    })

    expect(screen.queryByRole("alert")).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("ignores stale render failures after the source changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const first = deferred<void>()
    docxMock.renderAsync
      .mockImplementationOnce(async () => {
        await first.promise
        throw new Error("old render failed")
      })
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host, { text: "fresh document" })
      })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/stale-error-old.docx")} />
    )

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/stale-error-new.docx")} />
      )
    })
    expect(await screen.findByText("fresh document")).toBeTruthy()

    await act(async () => {
      first.resolve()
      await first.promise.catch(() => undefined)
    })

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("fresh document")).toBeTruthy()
  })

  it("shows a render error when docx-preview produces no pages", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installEmptyRenderedDocument(host)
    })

    await renderDocx(<DocxViewer source={docxUrlSource("/empty.docx")} />)

    expect(
      await screen.findByText("Couldn't render this document.")
    ).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "render_failed"
    )
    expect(screen.queryByText("Page 0 of 0")).toBeNull()
  })

  it("shows a load error and recovers when the source changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve(
        response(
          url === "/broken.docx" ? Uint8Array.of() : Uint8Array.of(4, 5, 6),
          { status: url === "/broken.docx" ? 500 : 200 }
        )
      )
    )

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/broken.docx")} />
    )

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "http_error"
    )

    await act(async () => {
      view.rerender(<DocxViewer source={docxUrlSource("/recovered.docx")} />)
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
  })

  it("does not offer retry for aborted URL loads", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(fetch).mockRejectedValueOnce(
      new DOMException("aborted", "AbortError")
    )

    await renderDocx(<DocxViewer source={docxUrlSource("/aborted.docx")} />)

    expect(await screen.findByText("Loading was cancelled.")).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "aborted"
    )
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  })

  it("does not offer retry when URL response body reading is aborted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(fetch).mockResolvedValueOnce(
      arrayBufferRejectingResponse(new DOMException("aborted", "AbortError"))
    )

    await renderDocx(
      <DocxViewer source={docxUrlSource("/aborted-body.docx")} />
    )

    expect(await screen.findByText("Loading was cancelled.")).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "aborted"
    )
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  })

  it("retries URL response body read failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        arrayBufferRejectingResponse(new Error("body read failed"))
      )
      .mockResolvedValueOnce(response(Uint8Array.of(4, 5, 6), { status: 200 }))

    await renderDocx(
      <DocxViewer source={docxUrlSource("/retry-body-read.docx")} />
    )

    expect(await screen.findByText("Couldn't load this file.")).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "fetch_failed"
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("does not offer retry for aborted Blob loads", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    await renderDocx(<DocxViewer source={abortingBlobSource()} />)

    expect(await screen.findByText("Loading was cancelled.")).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "aborted"
    )
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  })

  it("does not offer retry when docx-preview aborts rendering", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    docxMock.renderAsync.mockRejectedValueOnce(
      new DOMException("aborted", "AbortError")
    )

    await renderDocx(
      <DocxViewer source={docxUrlSource("/aborted-render.docx")} />
    )

    expect(await screen.findByText("Loading was cancelled.")).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "aborted"
    )
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  })

  it("keeps bare styling on load errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(fetch).mockResolvedValueOnce(
      response(Uint8Array.of(), { status: 500 })
    )

    await renderDocx(
      <DocxViewer source={docxUrlSource("/bare-load-error.docx")} bare />
    )

    const error = await screen.findByRole("alert")
    expect(error.getAttribute("data-error-kind")).toBe("http_error")
    expect(error.className).toContain("bg-muted/20")
    expect(error.className).not.toContain("rounded-xl")
    expect(error.className).not.toContain("border")
  })

  it("updates bare styling while a load error is already displayed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(fetch).mockResolvedValue(
      response(Uint8Array.of(), { status: 500 })
    )

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/toggle-bare-error.docx")} />
    )

    let error = await screen.findByRole("alert")
    expect(error.className).toContain("rounded-xl")
    expect(error.className).toContain("border")

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/toggle-bare-error.docx")} bare />
      )
    })

    error = screen.getByRole("alert")
    expect(error.className).toContain("bg-muted/20")
    expect(error.className).not.toContain("rounded-xl")
    expect(error.className).not.toContain("border")
  })

  it("retries a failed document load for the same source", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(Uint8Array.of(), { status: 500 }))
      .mockResolvedValueOnce(response(Uint8Array.of(4, 5, 6), { status: 200 }))

    await renderDocx(<DocxViewer source={docxUrlSource("/retry-load.docx")} />)

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("restores loading slots while retrying a failed document load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const retryResponse = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(Uint8Array.of(), { status: 500 }))
      .mockImplementationOnce(() => retryResponse.promise)

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/retry-loading-slots.docx")}
        header={<div>Retry legend</div>}
        aside={<nav>Retry rail</nav>}
      />
    )

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    })

    expect(await screen.findByText("Retry legend")).toBeTruthy()
    expect(screen.getByText("Retry rail")).toBeTruthy()

    await act(async () => {
      retryResponse.resolve(response(Uint8Array.of(4, 5, 6), { status: 200 }))
      await retryResponse.promise
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("clears a retained Blob read failure before retrying the same source", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const source = flakyBlobSource()

    await renderDocx(<DocxViewer source={source} />)

    expect(await screen.findByText("Couldn't load this document.")).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "unknown"
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(source.blob.arrayBuffer).toHaveBeenCalledTimes(2)
    expect(docxMock.renderAsync).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("shows a render error and recovers when the source changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    docxMock.renderAsync
      .mockRejectedValueOnce(new Error("bad docx"))
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host)
      })

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/bad-render.docx")} />
    )

    expect(
      await screen.findByText("Couldn't render this document.")
    ).toBeTruthy()
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe(
      "render_failed"
    )

    await act(async () => {
      view.rerender(<DocxViewer source={docxUrlSource("/good-render.docx")} />)
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
  })

  it("keeps bare styling on render errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    docxMock.renderAsync.mockRejectedValueOnce(new Error("bad docx"))

    await renderDocx(
      <DocxViewer source={docxUrlSource("/bare-render-error.docx")} bare />
    )

    const error = await screen.findByRole("alert")
    expect(error.getAttribute("data-error-kind")).toBe("render_failed")
    expect(error.className).toContain("bg-muted/20")
    expect(error.className).not.toContain("rounded-xl")
    expect(error.className).not.toContain("border")
  })

  it("recovers from render errors on metadata-only source changes without refetching bytes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    docxMock.renderAsync
      .mockRejectedValueOnce(new Error("bad docx"))
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host)
      })

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/metadata-render-error.docx", "broken.docx")}
      />
    )

    expect(
      await screen.findByText("Couldn't render this document.")
    ).toBeTruthy()

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/metadata-render-error.docx", "renamed.docx")}
        />
      )
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download")
    ).toBe("renamed.docx")
  })

  it("retries a failed document render for the same source", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    docxMock.renderAsync
      .mockRejectedValueOnce(new Error("bad docx"))
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host)
      })

    await renderDocx(
      <DocxViewer source={docxUrlSource("/retry-render.docx")} />
    )

    expect(
      await screen.findByText("Couldn't render this document.")
    ).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("retries a failed Blob document render for the same source", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    docxMock.renderAsync
      .mockRejectedValueOnce(new Error("transient blob render failure"))
      .mockImplementationOnce(async (_buffer, host) => {
        installRenderedDocument(host)
      })

    await renderDocx(
      <DocxViewer
        source={docxBlobSource(Uint8Array.of(1, 2, 3), "blob:retry-render")}
      />
    )

    expect(
      await screen.findByText("Couldn't render this document.")
    ).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    })

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
    expect(fetch).not.toHaveBeenCalled()
  })
})

// Targeted edge-case probes around the trickiest logic: the text-range boundary
// math (off-by-one at match edges), whitespace/case normalization, page
// counting, and the scale/zoom controls. These dig into corners the broad suite
// above doesn't exercise, to surface latent bugs.
describe("DocxViewer edge cases", () => {
  // Build a document with arbitrary per-page contents. Pages are stacked 1100px
  // apart (matching the default fixture) so scroll/page math stays realistic.
  function installCustomPages(
    host: HTMLElement,
    builders: Array<(page: HTMLElement) => void>
  ) {
    const wrapper = document.createElement("div")
    wrapper.className = "docx-wrapper"
    builders.forEach((build, index) => {
      const page = document.createElement("section")
      page.className = "docx"
      page.getBoundingClientRect = vi.fn(() => rect(index * 1100))
      build(page)
      wrapper.append(page)
    })
    host.replaceChildren(wrapper)
  }

  function paragraphPage(text: string) {
    return (page: HTMLElement) => {
      const p = document.createElement("p")
      p.textContent = text
      page.append(p)
    }
  }

  it("highlights a partial text match without an off-by-one at the trailing edge", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installCustomPages(host, [paragraphPage("Hello World Extra")])
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/partial-match.docx")}
        highlight={{ kind: "text", text: "Hello World" }}
      />
    )

    await screen.findByText("Hello World Extra")
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    // A regression that dropped the `+ 1` on the end offset would yield
    // "Hello Worl"; one that over-ran would pull in " Extra".
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "Hello World"
    )
  })

  it("highlights a text match that ends at the very end of the document", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installCustomPages(host, [paragraphPage("Alpha Beta")])
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/match-at-end.docx")}
        highlight={{ kind: "text", text: "Beta" }}
      />
    )

    await screen.findByText("Alpha Beta")
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    // setEnd(node, offset + 1) must land exactly on the node's length here.
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe("Beta")
  })

  it("matches text targets after collapsing tabs and newlines in the query", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/tabbed-query.docx")}
        highlight={{ kind: "text", text: "Quarterly\t\t revenue \n increased" }}
      />
    )

    await waitForRenderedDocx()
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    // The fixture's raw DOM keeps its original spacing; the match spans the full
    // run despite the query's tabs/newlines.
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "Quarterly   revenue increased"
    )
  })

  it("matches text targets case-sensitively", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/case-sensitive.docx")}
        highlight={{ kind: "text", text: "TARGET CELL" }}
      />
    )

    await waitForRenderedDocx()
    // Normalization collapses whitespace but does not fold case, so a
    // differently-cased query resolves nothing.
    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalled()
    })
    expect(highlights.size).toBe(0)
  })

  it("highlights the first occurrence when the target text repeats", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installCustomPages(host, [
        (page) => {
          const first = document.createElement("p")
          first.id = "first-occurrence"
          first.textContent = "Repeat me"
          const second = document.createElement("p")
          second.id = "second-occurrence"
          second.textContent = "Repeat me"
          page.append(first, second)
        },
      ])
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/repeat-text.docx")}
        highlight={{ kind: "text", text: "Repeat me" }}
      />
    )

    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    const range = [...highlights.values()][0]?.ranges[0]
    expect(range?.startContainer.parentElement?.id).toBe("first-occurrence")
  })

  it("renders a single-page document as Page 1 of 1", async () => {
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installCustomPages(host, [paragraphPage("Solo page")])
    })

    await renderDocx(<DocxViewer source={docxUrlSource("/single-page.docx")} />)

    expect(await screen.findByText("Page 1 of 1")).toBeTruthy()
    const pages = document.querySelectorAll<HTMLElement>("[data-page-number]")
    expect([...pages].map((page) => page.dataset.pageNumber)).toEqual(["1"])
  })

  it("reports the first page on initial render before any scroll", async () => {
    const onVisiblePageChange = vi.fn()

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/initial-page.docx")}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    await waitForRenderedDocx()

    expect(onVisiblePageChange).toHaveBeenCalledWith(1)
  })

  it("treats a NaN scale as a controlled 100% zoom", async () => {
    await renderDocx(
      <DocxViewer source={docxUrlSource("/nan-scale.docx")} scale={NaN} />
    )

    await waitForRenderedDocx()
    expect(screen.getByText("100%")).toBeTruthy()

    // NaN is a non-null fixed scale, so it must stay controlled — toolbar zoom
    // is inert.
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.queryByText("120%")).toBeNull()
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("1")
  })

  it("clamps repeated zoom-in clicks to the maximum 500% zoom", async () => {
    await renderDocx(<DocxViewer source={docxUrlSource("/zoom-clamp.docx")} />)
    await waitForRenderedDocx()
    expect(screen.getByText("100%")).toBeTruthy()

    for (let i = 0; i < 12; i += 1) {
      fireEvent.click(screen.getByLabelText("Zoom in"))
    }

    expect(await screen.findByText("500%")).toBeTruthy()
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )?.parentElement
    expect(host?.style.zoom).toBe("5")
  })

  it("ignores whitespace-only text highlight targets", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/whitespace-highlight.docx")}
        highlight={{ kind: "text", text: "  \n\t  " }}
      />
    )

    await waitForRenderedDocx()
    expect(highlights.size).toBe(0)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Target cell")).toBeTruthy()
  })

  it("clears the highlight when the target becomes null without unmounting", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/clear-highlight.docx")}
        highlight={{ kind: "text", text: "Target cell" }}
      />
    )

    await waitForRenderedDocx()
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/clear-highlight.docx")}
          highlight={null}
        />
      )
    })

    await waitFor(() => {
      expect(highlights.size).toBe(0)
    })
  })

  it("switches the highlight when the target kind changes from text to cell", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/switch-kind.docx")}
        highlight={{ kind: "text", text: "revenue increased" }}
      />
    )

    await waitForRenderedDocx()
    await waitFor(() => {
      expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
        "revenue increased"
      )
    })

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/switch-kind.docx")}
          highlight={{ kind: "cell", table: 0, row: 0, column: 1 }}
        />
      )
    })

    await waitFor(() => {
      expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
        "Target cell"
      )
    })
    expect(highlights.size).toBe(1)
  })
})

// `textContentRange` joins the visible text of every run, inserting a separating
// space at block boundaries but none between inline runs. Inside one paragraph,
// docx-preview splits a sentence across many inline <span>s that must join with
// no gap; across blocks (paragraph-to-paragraph, page <section>-to-<section>,
// table cell-to-cell) the rendered text has a visual break, so a quoted phrase
// that straddles the break still resolves — and a gap-less token across the
// break does not falsely resolve.
describe("DocxViewer cross-boundary text resolution", () => {
  function installBlocks(
    host: HTMLElement,
    pages: string[][] // pages[i] = paragraphs on page i
  ) {
    const wrapper = document.createElement("div")
    wrapper.className = "docx-wrapper"
    pages.forEach((paragraphs, pageIndex) => {
      const page = document.createElement("section")
      page.className = "docx"
      page.getBoundingClientRect = vi.fn(() => rect(pageIndex * 1100))
      for (const text of paragraphs) {
        const p = document.createElement("p")
        p.textContent = text
        page.append(p)
      }
      wrapper.append(page)
    })
    host.replaceChildren(wrapper)
  }

  it("resolves a text target that spans a paragraph boundary", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installBlocks(host, [["alpha", "bravo"]])
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/para-boundary.docx")}
        highlight={{ kind: "text", text: "alpha bravo" }}
      />
    )

    await screen.findByText("Page 1 of 1")
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    const range = [...highlights.values()][0]?.ranges[0]
    // The DOM has no character at the paragraph break, so the resolved range's
    // text is gap-less even though the quoted phrase contained a space.
    expect(range?.toString()).toBe("alphabravo")
    expect(range?.startContainer.parentElement?.tagName).toBe("P")
    expect(range?.endContainer.parentElement?.tagName).toBe("P")
    expect(range?.startContainer).not.toBe(range?.endContainer)
  })

  it("resolves a text target that spans a page/section boundary", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installBlocks(host, [["alpha"], ["bravo"]])
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/page-boundary.docx")}
        highlight={{ kind: "text", text: "alpha bravo" }}
      />
    )

    await screen.findByText("Page 1 of 2")
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
  })

  it("does not resolve a gap-less token straddling a paragraph boundary", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installBlocks(host, [["alpha", "bravo"]])
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/para-no-concat.docx")}
        highlight={{ kind: "text", text: "alphabravo" }}
      />
    )

    await screen.findByText("Page 1 of 1")
    // The inserted boundary space makes the two paragraphs read as "alpha
    // bravo", so the run-together token no longer matches across the break.
    expect(highlights.size).toBe(0)
  })

  it("resolves a text target that spans a <br> soft line break", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      const wrapper = document.createElement("div")
      wrapper.className = "docx-wrapper"
      const page = document.createElement("section")
      page.className = "docx"
      page.getBoundingClientRect = vi.fn(() => rect(0))
      const p = document.createElement("p")
      // docx-preview renders w:br as <br>; the two text fragments share one <p>.
      p.append(
        document.createTextNode("line1"),
        document.createElement("br"),
        document.createTextNode("line2")
      )
      page.append(p)
      wrapper.append(page)
      host.replaceChildren(wrapper)
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/br-boundary.docx")}
        highlight={{ kind: "text", text: "line1 line2" }}
      />
    )

    await screen.findByText("Page 1 of 1")
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "line1line2"
    )
  })

  it("joins inline runs within a single paragraph with no separator", async () => {
    const highlights = new Map<string, MockHighlight>()
    installHighlightApi(highlights)
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      const wrapper = document.createElement("div")
      wrapper.className = "docx-wrapper"
      const page = document.createElement("section")
      page.className = "docx"
      page.getBoundingClientRect = vi.fn(() => rect(0))
      const p = document.createElement("p")
      // docx-preview shatters a sentence across run <span>s; "foo" + "bar"
      // inside one paragraph must read as "foobar".
      const runA = document.createElement("span")
      runA.textContent = "foo"
      const runB = document.createElement("span")
      runB.textContent = "bar"
      p.append(runA, runB)
      page.append(p)
      wrapper.append(page)
      host.replaceChildren(wrapper)
    })

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/inline-runs.docx")}
        highlight={{ kind: "text", text: "foobar" }}
      />
    )

    await screen.findByText("Page 1 of 1")
    await waitFor(() => {
      expect(highlights.size).toBe(1)
    })
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe("foobar")
  })
})
