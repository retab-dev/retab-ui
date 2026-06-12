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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  blobSource,
  clearViewerResourceRegistryForTests,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  DocxViewer,
  type DocxViewerHandle,
} from "@/registry/new-york-v4/ui/docx-viewer"
import { __resetDocxResourceCacheForTests } from "@/registry/new-york-v4/ui/docx-viewer-resource"

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
    text = "Quarterly   revenue \nincreased",
  }: { pageTops?: number[]; text?: string } = {}
) {
  const wrapper = document.createElement("div")
  wrapper.className = "docx-wrapper"

  pageTops.forEach((top, index) => {
    const page = document.createElement("section")
    page.className = "docx"
    page.getBoundingClientRect = vi.fn(() => rect(top))
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
  __resetDocxResourceCacheForTests()
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
    __resetDocxResourceCacheForTests()
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

  it("resets the toolbar page cursor when the document source changes", async () => {
    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/first-page-state.docx")} />
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

    await act(async () => {
      view.rerender(
        <DocxViewer source={docxUrlSource("/second-page-state.docx")} />
      )
    })

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(2)
      expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    })
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
})
