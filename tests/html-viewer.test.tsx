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

import { createViewerResource } from "@/lib/viewer-resource"
import { FileViewer } from "@/registry/new-york-v4/ui/file-viewer"
import { HtmlDocViewer } from "@/registry/new-york-v4/ui/file-viewer-html-viewer"

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, init)
}

function htmlUrlSource(url: string, fileName?: string, mimeType = "text/html") {
  return { kind: "url" as const, url, fileName, mimeType }
}

function htmlTextSource(text: string, fileName = "inline.html") {
  return { kind: "text" as const, text, fileName, mimeType: "text/html" }
}

function htmlBlobSource(
  text: string,
  fileName = "blob.html",
  type = "text/html"
) {
  return {
    kind: "blob" as const,
    blob: new Blob([text], { type }),
    identityKey: `blob:${fileName}:${text}`,
    fileName,
    mimeType: type,
  }
}

function htmlUrlResource(url: string, fileName?: string) {
  return createViewerResource(htmlUrlSource(url, fileName))
}

function htmlTextResource(text: string, fileName = "inline.html") {
  return createViewerResource(htmlTextSource(text, fileName))
}

function htmlBlobResource(blob: Blob, fileName = "blob.html") {
  return createViewerResource({
    kind: "blob" as const,
    blob,
    identityKey: `blob-resource:${fileName}:${blob.size}`,
    fileName,
    mimeType: blob.type || "text/html",
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function resolveFetch(
  pending: ReturnType<typeof deferred<Response>>,
  value: Response
) {
  await act(async () => {
    pending.resolve(value)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function findIframe(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector("iframe")).toBeTruthy()
  })
  return container.querySelector("iframe") as HTMLIFrameElement
}

function iframes(container: HTMLElement) {
  return Array.from(container.querySelectorAll("iframe"))
}

class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown }
> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return <div role="alert">failed</div>
    }
    return this.props.children
  }
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:html-viewer-download"),
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("HtmlDocViewer", () => {
  it("renders URL HTML into an empty-sandbox iframe without rewriting the document", async () => {
    const html =
      "<!doctype html><html><body><h1>Invoice</h1><script>window.__html_viewer_ran = true</script></body></html>"
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    const { container } = render(
      <FileViewer
        source={htmlUrlSource("/samples/invoice.html", "invoice.html")}
      />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await resolveFetch(pending, response(html, { status: 200 }))

    const iframe = await findIframe(container)

    expect(fetch).toHaveBeenCalledWith(
      "/samples/invoice.html",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(iframe.getAttribute("sandbox")).toBe("")
    expect(iframe.getAttribute("srcdoc")).toBe(html)
    expect(iframe.getAttribute("title")).toBe("invoice.html")
    expect(
      (globalThis as { __html_viewer_ran?: boolean }).__html_viewer_ran
    ).toBe(undefined)
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download")
    ).toBe("invoice.html")
  })

  it("routes text/html MIME URLs with no HTML extension to the HTML viewer", async () => {
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    const { container } = render(
      <FileViewer
        source={htmlUrlSource(
          "/api/files/preview?id=42",
          undefined,
          "text/html; charset=utf-8"
        )}
      />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await resolveFetch(
      pending,
      response("<main>signed document</main>", { status: 200 })
    )

    const iframe = await findIframe(container)

    expect(fetch).toHaveBeenCalledWith(
      "/api/files/preview?id=42",
      expect.any(Object)
    )
    expect(iframe.getAttribute("srcdoc")).toBe("<main>signed document</main>")
    expect(iframe.getAttribute("title")).toBe("preview")
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download")
    ).toBe("preview")
  })

  it("uses the original download URL instead of the HTML preview URL", async () => {
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    const { container } = render(
      <FileViewer
        source={{
          ...htmlUrlSource("/preview/rendered.html", "rendered.html"),
          downloadUrl: "/download/original.html",
        }}
      />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await resolveFetch(pending, response("<p>preview</p>", { status: 200 }))

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>preview</p>"
    )
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("href")
    ).toBe("/download/original.html")
  })

  it("uses the original download URL while an HTML preview is still loading", async () => {
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    render(
      <FileViewer
        source={{
          ...htmlUrlSource("/preview/loading.html", "loading.html"),
          downloadUrl: "/download/loading-original.html",
        }}
      />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalled())

    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("href")
    ).toBe("/download/loading-original.html")
  })

  it("updates the HTML download URL when the preview URL is reused", async () => {
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    const { rerender } = render(
      <FileViewer
        source={{
          ...htmlUrlSource("/preview/reused.html", "reused.html"),
          downloadUrl: "/download/first.html",
        }}
      />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await resolveFetch(pending, response("<p>same preview</p>"))
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("href")
    ).toBe("/download/first.html")

    rerender(
      <FileViewer
        source={{
          ...htmlUrlSource("/preview/reused.html", "reused.html"),
          downloadUrl: "/download/second.html",
        }}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("href")
      ).toBe("/download/second.html")
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("updates HTML filename metadata while reusing the fetched document", async () => {
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    const { container, rerender } = render(
      <FileViewer source={htmlUrlSource("/preview/same.html", "first.html")} />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await resolveFetch(pending, response("<p>same body</p>"))

    expect((await findIframe(container)).getAttribute("title")).toBe(
      "first.html"
    )
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download")
    ).toBe("first.html")

    rerender(
      <FileViewer source={htmlUrlSource("/preview/same.html", "second.html")} />
    )

    await waitFor(() => {
      expect(container.querySelector("iframe")?.getAttribute("title")).toBe(
        "second.html"
      )
    })
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download")
    ).toBe("second.html")
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("renders inline HTML text sources in the same sandboxed viewer", async () => {
    const html = "<section><h2>Inline</h2><p>No network needed.</p></section>"
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(<FileViewer source={htmlTextSource(html)} />)

    const iframe = await findIframe(container)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(iframe.getAttribute("sandbox")).toBe("")
    expect(iframe.getAttribute("srcdoc")).toBe(html)
    expect(iframe.getAttribute("title")).toBe("inline.html")
    expect(screen.queryByText(/No preview for/)).toBeNull()
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy()
  })

  it("downloads inline HTML text sources from the toolbar", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    const html = "<section>download inline</section>"

    const { container } = render(
      <FileViewer source={htmlTextSource(html, "inline-download.html")} />
    )

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(html)

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1))
    const downloadedBlob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0]
    expect(downloadedBlob).toBeInstanceOf(Blob)
    await expect((downloadedBlob as Blob).text()).resolves.toBe(html)
    expect((downloadedBlob as Blob).type).toBe("text/html")
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:html-viewer-download"
    )
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("renders HTML Blob sources without falling back to unsupported", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(
      <FileViewer source={htmlBlobSource("<main><h1>Blob HTML</h1></main>")} />
    )

    const iframe = await findIframe(container)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(iframe.getAttribute("sandbox")).toBe("")
    expect(iframe.getAttribute("srcdoc")).toBe(
      "<main><h1>Blob HTML</h1></main>"
    )
    expect(iframe.getAttribute("title")).toBe("blob.html")
    expect(screen.queryByText(/No preview for/)).toBeNull()
  })

  it("keeps a download action for HTML Blob sources", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    const { container } = render(
      <FileViewer
        source={htmlBlobSource("<p>download me</p>", "download.html")}
      />
    )

    await findIframe(container)

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:html-viewer-download"
    )
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("keeps HTML Blob downloads available while the preview is loading", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    const text = deferred<string>()
    const blob = {
      type: "text/html",
      text: vi.fn(() => text.promise),
    } as unknown as Blob

    render(
      <FileViewer
        source={{
          kind: "blob",
          blob,
          identityKey: "slow-download-blob",
          fileName: "slow.html",
          mimeType: "text/html",
        }}
      />
    )

    await waitFor(() => expect(blob.text).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(blob))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:html-viewer-download"
    )
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector("iframe")).toBeNull()
  })

  it("downloads the latest HTML Blob after the source changes", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    const firstSource = htmlBlobSource("<p>first</p>", "first.html")
    const secondSource = htmlBlobSource("<p>second</p>", "second.html")
    vi.mocked(URL.createObjectURL).mockReturnValueOnce(
      "blob:second-html-download"
    )

    const { container, rerender } = render(<FileViewer source={firstSource} />)

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>first</p>"
    )

    rerender(<FileViewer source={secondSource} />)

    await waitFor(() => {
      expect(container.querySelector("iframe")?.getAttribute("srcdoc")).toBe(
        "<p>second</p>"
      )
    })
    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1))
    const downloadedBlob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0]
    expect(downloadedBlob).toBe(secondSource.blob)
    expect(downloadedBlob).not.toBe(firstSource.blob)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:second-html-download"
    )
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("ignores late stale HTML Blob text after the source changes", async () => {
    const firstText = deferred<string>()
    const secondText = deferred<string>()
    const firstBlob = {
      type: "text/html",
      text: vi.fn(() => firstText.promise),
    } as unknown as Blob
    const secondBlob = {
      type: "text/html",
      text: vi.fn(() => secondText.promise),
    } as unknown as Blob

    const { container, rerender } = render(
      <FileViewer
        source={{
          kind: "blob",
          blob: firstBlob,
          identityKey: "first-slow-blob",
          fileName: "first.html",
          mimeType: "text/html",
        }}
      />
    )

    await waitFor(() => expect(firstBlob.text).toHaveBeenCalledTimes(1))

    rerender(
      <FileViewer
        source={{
          kind: "blob",
          blob: secondBlob,
          identityKey: "second-slow-blob",
          fileName: "second.html",
          mimeType: "text/html",
        }}
      />
    )

    await waitFor(() => expect(secondBlob.text).toHaveBeenCalledTimes(1))
    await act(async () => {
      secondText.resolve("<p>second slow blob</p>")
      await Promise.resolve()
    })

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>second slow blob</p>"
    )

    await act(async () => {
      firstText.resolve("<p>first late blob</p>")
      await Promise.resolve()
    })

    expect(container.querySelector("iframe")?.getAttribute("srcdoc")).toBe(
      "<p>second slow blob</p>"
    )
  })

  it("prefers an HTML Blob download URL over a generated object URL", async () => {
    const { container } = render(
      <FileViewer
        source={{
          ...htmlBlobSource("<p>remote original</p>", "remote.html"),
          downloadUrl: "/download/remote-original.html",
        }}
      />
    )

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>remote original</p>"
    )
    const download = await screen.findByRole("link", { name: "Download" })
    expect(download.getAttribute("href")).toBe("/download/remote-original.html")
    expect(download.getAttribute("download")).toBe("remote.html")
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("updates HTML Blob filename and download metadata for the same Blob", async () => {
    const blob = new Blob(["<p>same blob</p>"], { type: "text/html" })
    const firstSource = {
      kind: "blob" as const,
      blob,
      identityKey: "same-blob",
      fileName: "first.html",
      mimeType: "text/html",
      downloadUrl: "/download/first.html",
    }
    const secondSource = {
      ...firstSource,
      fileName: "second.html",
      downloadUrl: "/download/second.html",
    }

    const { container, rerender } = render(<FileViewer source={firstSource} />)

    expect((await findIframe(container)).getAttribute("title")).toBe(
      "first.html"
    )
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("href")
    ).toBe("/download/first.html")

    rerender(<FileViewer source={secondSource} />)

    await waitFor(() => {
      expect(container.querySelector("iframe")?.getAttribute("title")).toBe(
        "second.html"
      )
    })
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("href")
    ).toBe("/download/second.html")
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("honors an explicit HTML override for non-HTML URL descriptors", async () => {
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    const { container } = render(
      <FileViewer
        as="html"
        source={htmlUrlSource("/exports/raw.txt", "raw.txt", "text/plain")}
      />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await resolveFetch(pending, response("<strong>forced html</strong>"))

    const iframe = await findIframe(container)
    expect(iframe.getAttribute("srcdoc")).toBe("<strong>forced html</strong>")
    expect(iframe.getAttribute("title")).toBe("raw.txt")
  })

  it("honors an explicit HTML override for opaque Blob descriptors", async () => {
    const { container } = render(
      <FileViewer
        as="html"
        source={htmlBlobSource(
          "<p>forced blob</p>",
          "payload.bin",
          "application/octet-stream"
        )}
      />
    )

    const iframe = await findIframe(container)
    expect(iframe.getAttribute("srcdoc")).toBe("<p>forced blob</p>")
    expect(iframe.getAttribute("title")).toBe("payload.bin")
    expect(screen.queryByText(/No preview for/)).toBeNull()
  })

  it("zooms the iframe with toolbar controls and resets to actual size", async () => {
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    const { container } = render(
      <FileViewer source={htmlUrlSource("/samples/zoom.html", "zoom.html")} />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await resolveFetch(pending, response("<p>zoom me</p>", { status: 200 }))

    const iframe = await findIframe(container)

    expect(iframe.style.zoom).toBe("1")
    expect(screen.getByText("100%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(iframe.style.zoom).toBe("1.2")
    expect(screen.getByText("120%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom out"))
    expect(iframe.style.zoom).toBe("1")

    fireEvent.click(screen.getByLabelText("Zoom in"))
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(iframe.style.zoom).toBe("1.44")
    fireEvent.click(screen.getByLabelText("Actual size"))
    expect(iframe.style.zoom).toBe("1")
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("clamps HTML zoom between 25% and 500%", async () => {
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending.promise)
    )

    const { container } = render(
      <FileViewer source={htmlUrlSource("/samples/clamp.html", "clamp.html")} />
    )

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await resolveFetch(pending, response("<p>clamp</p>", { status: 200 }))

    const iframe = await findIframe(container)

    for (let i = 0; i < 20; i += 1) {
      fireEvent.click(screen.getByLabelText("Zoom out"))
    }
    expect(iframe.style.zoom).toBe("0.25")
    expect(screen.getByText("25%")).toBeTruthy()

    for (let i = 0; i < 30; i += 1) {
      fireEvent.click(screen.getByLabelText("Zoom in"))
    }
    expect(iframe.style.zoom).toBe("5")
    expect(screen.getByText("500%")).toBeTruthy()
  })

  it("shares one fetch across duplicate HTML viewers for the same URL", async () => {
    const pending = deferred<Response>()
    const fetchMock = vi.fn(() => pending.promise)
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(
      <div>
        <FileViewer source={htmlUrlSource("/shared/document.html", "a.html")} />
        <FileViewer source={htmlUrlSource("/shared/document.html", "b.html")} />
      </div>
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await resolveFetch(pending, response("<p>shared</p>", { status: 200 }))

    await waitFor(() => expect(iframes(container)).toHaveLength(2))
    expect(
      iframes(container).map((iframe) => iframe.getAttribute("srcdoc"))
    ).toEqual(["<p>shared</p>", "<p>shared</p>"])
  })

  it("keeps a shared HTML fetch alive until every subscriber unmounts", async () => {
    const pending = deferred<Response>()
    let fetchSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((_src: string, init?: RequestInit) => {
        fetchSignal = init?.signal ?? undefined
        return pending.promise
      })
    )

    const { rerender } = render(
      <div>
        <FileViewer source={htmlUrlSource("/shared/live.html", "a.html")} />
        <FileViewer source={htmlUrlSource("/shared/live.html", "b.html")} />
      </div>
    )

    await waitFor(() => expect(fetchSignal).toBeTruthy())

    rerender(
      <FileViewer source={htmlUrlSource("/shared/live.html", "b.html")} />
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchSignal?.aborted).toBe(false)

    rerender(<div />)
    await waitFor(() => expect(fetchSignal?.aborted).toBe(true))
  })

  it("does not evict active HTML preview fetches when the text cache exceeds its limit", async () => {
    const urls = Array.from(
      { length: 13 },
      (_, index) => `/cache/active-${index}.html`
    )
    const pendingByUrl = new Map(urls.map((url) => [url, deferred<Response>()]))
    const signalByUrl = new Map<string, AbortSignal>()
    vi.stubGlobal(
      "fetch",
      vi.fn((src: string, init?: RequestInit) => {
        signalByUrl.set(src, init?.signal as AbortSignal)
        const pending = pendingByUrl.get(src)
        if (!pending) throw new Error(`unexpected fetch: ${src}`)
        return pending.promise
      })
    )

    const { container } = render(
      <>
        {urls.map((url, index) => (
          <FileViewer
            key={url}
            source={htmlUrlSource(url, `active-${index}.html`)}
          />
        ))}
      </>
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(urls.length))

    expect(signalByUrl.get(urls[0])?.aborted).toBe(false)

    await resolveFetch(
      pendingByUrl.get(urls[0])!,
      response("<p>first still mounted</p>", { status: 200 })
    )

    await waitFor(() => {
      expect(
        iframes(container).some(
          (iframe) =>
            iframe.getAttribute("srcdoc") === "<p>first still mounted</p>"
        )
      ).toBe(true)
    })
  })

  it("aborts stale HTML fetches on descriptor changes and ignores late old responses", async () => {
    const oldResponse = deferred<Response>()
    const newResponse = deferred<Response>()
    let oldSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((src: string, init?: RequestInit) => {
        if (src === "/old/page.html") {
          oldSignal = init?.signal ?? undefined
          return oldResponse.promise
        }
        return newResponse.promise
      })
    )

    const { container, rerender } = render(
      <FileViewer source={htmlUrlSource("/old/page.html", "old.html")} />
    )

    await waitFor(() => expect(oldSignal).toBeTruthy())

    rerender(
      <FileViewer source={htmlUrlSource("/new/page.html", "new.html")} />
    )

    await waitFor(() => expect(oldSignal?.aborted).toBe(true))
    await resolveFetch(newResponse, response("<p>new</p>", { status: 200 }))

    const iframe = await findIframe(container)
    expect(iframe.getAttribute("srcdoc")).toBe("<p>new</p>")

    oldResponse.resolve(response("<p>old</p>", { status: 200 }))
    await Promise.resolve()

    expect(iframes(container)).toHaveLength(1)
    expect(iframes(container)[0]?.getAttribute("srcdoc")).toBe("<p>new</p>")
  })

  it("ignores late stale HTML failures after a descriptor change", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const oldResponse = deferred<Response>()
      const newResponse = deferred<Response>()
      vi.stubGlobal(
        "fetch",
        vi.fn((src: string) => {
          if (src === "/old/fails-late.html") return oldResponse.promise
          return newResponse.promise
        })
      )

      const { container, rerender } = render(
        <FileViewer
          source={htmlUrlSource("/old/fails-late.html", "old.html")}
        />
      )

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          "/old/fails-late.html",
          expect.any(Object)
        )
      )

      rerender(
        <FileViewer source={htmlUrlSource("/new/succeeds.html", "new.html")} />
      )

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          "/new/succeeds.html",
          expect.any(Object)
        )
      )
      await resolveFetch(newResponse, response("<p>new wins</p>"))

      oldResponse.reject(new Error("old request failed late"))
      await Promise.resolve()

      expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
        "<p>new wins</p>"
      )
      expect(screen.queryByRole("alert")).toBeNull()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("shows the error fallback with a download link when HTML loading fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const pending = deferred<Response>()
      vi.stubGlobal(
        "fetch",
        vi.fn(() => pending.promise)
      )

      render(
        <FileViewer source={htmlUrlSource("/broken.html", "broken.html")} />
      )

      await waitFor(() => expect(fetch).toHaveBeenCalled())
      await resolveFetch(pending, response("nope", { status: 503 }))

      const alert = await screen.findByRole("alert")
      expect(alert.getAttribute("data-error-message")).toBe(
        "Failed to load resource: 503"
      )
      expect(document.querySelector("iframe")).toBeNull()
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download")
      ).toBe("broken.html")
    } finally {
      consoleError.mockRestore()
    }
  })

  it("recovers after an HTML load error when the descriptor changes", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const bad = deferred<Response>()
      const good = deferred<Response>()
      vi.stubGlobal(
        "fetch",
        vi.fn((src: string) => {
          if (src === "/bad.html") return bad.promise
          return good.promise
        })
      )

      const { container, rerender } = render(
        <FileViewer source={htmlUrlSource("/bad.html", "bad.html")} />
      )

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith("/bad.html", expect.any(Object))
      )
      await resolveFetch(bad, response("bad", { status: 500 }))
      expect(
        (await screen.findByRole("alert")).getAttribute("data-error-message")
      ).toBe("Failed to load resource: 500")

      rerender(<FileViewer source={htmlUrlSource("/good.html", "good.html")} />)

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith("/good.html", expect.any(Object))
      )
      await resolveFetch(good, response("<p>good</p>", { status: 200 }))

      const iframe = await findIframe(container)
      expect(iframe.getAttribute("srcdoc")).toBe("<p>good</p>")
      expect(screen.queryByRole("alert")).toBeNull()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("does not keep showing stale direct HTML when its URL changes", async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn((src: string) => {
        if (src === "/direct-a.html") return first.promise
        return second.promise
      })
    )
    const firstController = new AbortController()
    const secondController = new AbortController()

    const { container, rerender } = render(
      <HtmlDocViewer
        resource={htmlUrlResource("/direct-a.html", "direct-a.html")}
        descriptorSignal={firstController.signal}
      />
    )

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/direct-a.html", expect.any(Object))
    )
    await resolveFetch(first, response("<p>first</p>", { status: 200 }))
    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>first</p>"
    )

    rerender(
      <HtmlDocViewer
        resource={htmlUrlResource("/direct-b.html", "direct-b.html")}
        descriptorSignal={secondController.signal}
      />
    )

    await waitFor(() => {
      expect(container.querySelector("iframe")).toBeNull()
    })

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/direct-b.html", expect.any(Object))
    )
    await resolveFetch(second, response("<p>second</p>", { status: 200 }))

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>second</p>"
    )
  })

  it("aborts stale direct HTML fetches when URL changes with the same signal", async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    let firstSignal: AbortSignal | undefined
    let secondSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((src: string, init?: RequestInit) => {
        if (src === "/direct/same-signal-a.html") {
          firstSignal = init?.signal ?? undefined
          return first.promise
        }
        secondSignal = init?.signal ?? undefined
        return second.promise
      })
    )
    const controller = new AbortController()

    const { container, rerender } = render(
      <HtmlDocViewer
        resource={htmlUrlResource("/direct/same-signal-a.html", "first.html")}
        descriptorSignal={controller.signal}
      />
    )

    await waitFor(() => expect(firstSignal).toBeTruthy())

    rerender(
      <HtmlDocViewer
        resource={htmlUrlResource("/direct/same-signal-b.html", "second.html")}
        descriptorSignal={controller.signal}
      />
    )

    await waitFor(() => expect(firstSignal?.aborted).toBe(true))
    await waitFor(() => expect(secondSignal).toBeTruthy())
    await resolveFetch(second, response("<p>second same signal</p>"))

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>second same signal</p>"
    )
  })

  it("keeps a shared direct HTML fetch alive when one subscriber changes URL", async () => {
    const shared = deferred<Response>()
    const next = deferred<Response>()
    let sharedSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((src: string, init?: RequestInit) => {
        if (src === "/direct/shared.html") {
          sharedSignal = init?.signal ?? undefined
          return shared.promise
        }
        return next.promise
      })
    )
    const firstController = new AbortController()
    const secondController = new AbortController()
    const nextController = new AbortController()

    const { container, rerender } = render(
      <div>
        <HtmlDocViewer
          resource={htmlUrlResource("/direct/shared.html", "first.html")}
          descriptorSignal={firstController.signal}
        />
        <HtmlDocViewer
          resource={htmlUrlResource("/direct/shared.html", "second.html")}
          descriptorSignal={secondController.signal}
        />
      </div>
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

    rerender(
      <div>
        <HtmlDocViewer
          resource={htmlUrlResource("/direct/next.html", "next.html")}
          descriptorSignal={nextController.signal}
        />
        <HtmlDocViewer
          resource={htmlUrlResource("/direct/shared.html", "second.html")}
          descriptorSignal={secondController.signal}
        />
      </div>
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(sharedSignal?.aborted).toBe(false)

    await resolveFetch(shared, response("<p>shared still needed</p>"))
    await resolveFetch(next, response("<p>next direct</p>"))

    await waitFor(() => expect(iframes(container)).toHaveLength(2))
    expect(
      iframes(container).map((iframe) => iframe.getAttribute("srcdoc"))
    ).toEqual(["<p>next direct</p>", "<p>shared still needed</p>"])
  })

  it("aborts direct HTML fetches on unmount", async () => {
    const pending = deferred<Response>()
    let fetchSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((_src: string, init?: RequestInit) => {
        fetchSignal = init?.signal ?? undefined
        return pending.promise
      })
    )
    const controller = new AbortController()

    const { unmount } = render(
      <HtmlDocViewer
        resource={htmlUrlResource("/direct/unmount.html", "unmount.html")}
        descriptorSignal={controller.signal}
      />
    )

    await waitFor(() => expect(fetchSignal).toBeTruthy())

    unmount()

    await waitFor(() => expect(fetchSignal?.aborted).toBe(true))
  })

  it("aborts direct HTML fetches when the parent descriptor signal aborts", async () => {
    const pending = deferred<Response>()
    let fetchSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((_src: string, init?: RequestInit) => {
        fetchSignal = init?.signal ?? undefined
        return pending.promise
      })
    )
    const controller = new AbortController()

    render(
      <HtmlDocViewer
        resource={htmlUrlResource(
          "/direct/parent-abort.html",
          "parent-abort.html"
        )}
        descriptorSignal={controller.signal}
      />
    )

    await waitFor(() => expect(fetchSignal).toBeTruthy())

    controller.abort()

    await waitFor(() => expect(fetchSignal?.aborted).toBe(true))
  })

  it("does not start direct HTML fetches for already-aborted signals", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("<p>unused</p>")))
    vi.stubGlobal("fetch", fetchMock)
    const controller = new AbortController()
    controller.abort()

    render(
      <HtmlDocViewer
        resource={htmlUrlResource(
          "/direct/already-aborted.html",
          "already-aborted.html"
        )}
        descriptorSignal={controller.signal}
      />
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.querySelector("iframe")).toBeNull()
  })

  it("switches direct HtmlDocViewer from loaded HTML to a fetched URL", async () => {
    const fetched = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => fetched.promise)
    )
    const controller = new AbortController()

    const { container, rerender } = render(
      <HtmlDocViewer
        resource={htmlTextResource("<p>inline first</p>", "inline.html")}
        descriptorSignal={new AbortController().signal}
      />
    )

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>inline first</p>"
    )

    rerender(
      <HtmlDocViewer
        resource={htmlUrlResource("/direct/from-inline.html", "fetched.html")}
        descriptorSignal={controller.signal}
      />
    )

    await waitFor(() => {
      expect(container.querySelector("iframe")).toBeNull()
    })
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/direct/from-inline.html",
        expect.any(Object)
      )
    )
    await resolveFetch(fetched, response("<p>fetched next</p>"))

    const iframe = await findIframe(container)
    expect(iframe.getAttribute("srcdoc")).toBe("<p>fetched next</p>")
    expect(iframe.getAttribute("title")).toBe("fetched.html")
  })

  it("switches direct HtmlDocViewer from a fetched URL to loaded HTML without keeping stale content", async () => {
    const fetched = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => fetched.promise)
    )
    const controller = new AbortController()

    const { container, rerender } = render(
      <HtmlDocViewer
        resource={htmlUrlResource("/direct/to-inline.html", "fetched.html")}
        descriptorSignal={controller.signal}
      />
    )

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/direct/to-inline.html",
        expect.any(Object)
      )
    )
    await resolveFetch(fetched, response("<p>fetched first</p>"))
    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>fetched first</p>"
    )

    rerender(
      <HtmlDocViewer
        resource={htmlTextResource("<p>inline next</p>", "inline.html")}
        descriptorSignal={new AbortController().signal}
      />
    )

    const iframe = await findIframe(container)
    expect(iframe.getAttribute("srcdoc")).toBe("<p>inline next</p>")
    expect(iframe.getAttribute("title")).toBe("inline.html")
  })

  it("does not keep showing stale direct Blob HTML when its blob changes", async () => {
    const firstBlob = new Blob(["<p>first blob</p>"], { type: "text/html" })
    const secondBlob = new Blob(["<p>second blob</p>"], { type: "text/html" })

    const { container, rerender } = render(
      <HtmlDocViewer
        resource={htmlBlobResource(firstBlob, "first.html")}
        descriptorSignal={new AbortController().signal}
      />
    )

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>first blob</p>"
    )

    rerender(
      <HtmlDocViewer
        resource={htmlBlobResource(secondBlob, "second.html")}
        descriptorSignal={new AbortController().signal}
      />
    )

    await waitFor(() => {
      expect(container.querySelector("iframe")).toBeNull()
    })

    expect((await findIframe(container)).getAttribute("srcdoc")).toBe(
      "<p>second blob</p>"
    )
  })

  it("surfaces Blob HTML read failures to an error boundary", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const brokenBlob = {
      text: vi.fn(() => Promise.reject(new Error("cannot read blob"))),
    } as unknown as Blob

    try {
      render(
        <TestErrorBoundary>
          <HtmlDocViewer
            resource={htmlBlobResource(brokenBlob, "broken.html")}
            descriptorSignal={new AbortController().signal}
          />
        </TestErrorBoundary>
      )

      expect(await screen.findByRole("alert")).toBeTruthy()
      expect(screen.queryByTitle("broken.html")).toBeNull()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("shows the viewer error state when FileViewer cannot read an HTML Blob", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const brokenBlob = {
      type: "text/html",
      text: vi.fn(() => Promise.reject(new Error("blob text failed"))),
    } as unknown as Blob

    try {
      render(
        <FileViewer
          source={{
            kind: "blob",
            blob: brokenBlob,
            identityKey: "broken-html-blob",
            fileName: "broken-blob.html",
            mimeType: "text/html",
            downloadUrl: "/download/broken-blob.html",
          }}
        />
      )

      const alert = await screen.findByRole("alert")
      expect(alert.getAttribute("data-error-message")).toBe("blob text failed")
      expect(document.querySelector("iframe")).toBeNull()
      const download = screen.getByRole("link", { name: "Download" })
      expect(download.getAttribute("href")).toBe("/download/broken-blob.html")
      expect(download.getAttribute("download")).toBe("broken-blob.html")
    } finally {
      consoleError.mockRestore()
    }
  })

  it("can be mounted directly with already-loaded HTML", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const signal = new AbortController().signal

    const { container } = render(
      <HtmlDocViewer
        resource={htmlTextResource("<article>direct</article>", "direct.html")}
        descriptorSignal={signal}
        bare
      />
    )

    const iframe = await findIframe(container)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      container.querySelector('[data-slot="file-viewer"]')?.className
    ).toContain("h-full")
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull()
    expect(iframe.getAttribute("srcdoc")).toBe("<article>direct</article>")
    expect(iframe.getAttribute("title")).toBe("direct.html")
  })
})
