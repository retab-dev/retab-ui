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
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  TextViewer,
  type TextViewerHandle,
} from "@/registry/new-york-v4/ui/text-viewer"
import {
  clearTextViewerResourceCacheForTests,
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "@/registry/new-york-v4/ui/text-viewer-resource"

function response(body: BodyInit | null, init: ResponseInit = {}) {
  return new Response(body, init)
}

function textSource(text: string, fileName?: string) {
  return { kind: "text" as const, text, fileName }
}

function urlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName }
}

function textResource(url: string) {
  return createViewerResource(urlSource(url))
}

function manyLines(count: number) {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`).join(
    "\n"
  )
}

function streamResponse(chunks: string[], init: ResponseInit = {}) {
  const encoder = new TextEncoder()
  let chunkIndex = 0
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[chunkIndex]
        chunkIndex += 1
        if (chunk == null) {
          controller.close()
          return
        }
        controller.enqueue(encoder.encode(chunk))
      },
    }),
    init
  )
}

async function readResourceAfterSuspense(
  args: Parameters<typeof readTextResource>[0]
) {
  try {
    return readTextResource(args)
  } catch (thrown) {
    if (thrown instanceof Promise) {
      await thrown.catch(() => undefined)
      return readTextResource(args)
    }
    throw thrown
  }
}

afterEach(() => {
  cleanup()
  clearTextViewerResourceCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("text viewer resource bug hunt", () => {
  it("rejects syntactically valid oversized Content-Length values before reading the body", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("body should not be read")
      },
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response(body, {
            headers: { "content-length": "0000000000000004" },
          })
        )
      )
    )

    await expect(
      readResourceAfterSuspense({
        content: textResource("/valid-oversized-content-length.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      })
    ).rejects.toThrow("bytes limit")
  })

  it("ignores fractional Content-Length values and accepts a body within the byte limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("abc", {
            headers: { "content-length": "3.5" },
          })
        )
      )
    )

    await expect(
      readResourceAfterSuspense({
        content: textResource("/fractional-content-length.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      })
    ).resolves.toBe("abc")
  })

  it("still enforces actual streamed bytes when Content-Length is malformed and too small", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("abcd", {
            headers: { "content-length": "1.5" },
          })
        )
      )
    )

    await expect(
      readResourceAfterSuspense({
        content: textResource("/fractional-content-length-too-large.txt")
          .content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      })
    ).rejects.toThrow("bytes limit")
  })

  it("matches splitTextLines for streamed line-limit enforcement across chunk boundaries", async () => {
    const texts = [
      "one\ntwo\nthree",
      "one\r\ntwo\rthree",
      "one\u2028two\u2029three",
      "one\r\n\u2028two",
      "\nleading\nand\ntrailing\n",
    ]

    for (const [index, text] of texts.entries()) {
      const chunkings = [
        [text],
        Array.from(text),
        [text.slice(0, 1), text.slice(1, -1), text.slice(-1)],
        [text.slice(0, 4), text.slice(4)],
      ]
      const lineCount = splitTextLines(text).length

      for (const [chunkIndex, chunks] of chunkings.entries()) {
        vi.stubGlobal(
          "fetch",
          vi.fn(() => Promise.resolve(streamResponse(chunks)))
        )

        await expect(
          readResourceAfterSuspense({
            content: textResource(`/stream-lines-${index}-${chunkIndex}-ok.txt`)
              .content,
            retryVersion: 0,
            bounds: resolvedTextViewerBounds({ maxLines: lineCount }),
          })
        ).resolves.toBe(text)

        clearTextViewerResourceCacheForTests()
        clearViewerResourceRegistryForTests()
        vi.unstubAllGlobals()

        if (lineCount > 1) {
          vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve(streamResponse(chunks)))
          )

          await expect(
            readResourceAfterSuspense({
              content: textResource(
                `/stream-lines-${index}-${chunkIndex}-too-many.txt`
              ).content,
              retryVersion: 0,
              bounds: resolvedTextViewerBounds({ maxLines: lineCount - 1 }),
            })
          ).rejects.toThrow("lines limit")

          clearTextViewerResourceCacheForTests()
          clearViewerResourceRegistryForTests()
          vi.unstubAllGlobals()
        }
      }
    }
  })

  it("keeps stale imperative handles unavailable while a replacement URL source is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {}))
    )
    const viewerRef = React.createRef<TextViewerHandle>()
    const { rerender } = render(
      <TextViewer ref={viewerRef} source={textSource("old text")} />
    )

    expect(viewerRef.current?.getViewportElement()).toBeInstanceOf(HTMLElement)

    rerender(
      <TextViewer ref={viewerRef} source={urlSource("/pending-source.txt")} />
    )

    expect(screen.queryByText("old text")).toBeNull()
    expect(viewerRef.current).toBeNull()
  })

  it("replaces a pending fallback with a ref-backed viewport after the URL text resolves", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("loaded url text")))
    vi.stubGlobal("fetch", fetchMock)
    const viewerRef = React.createRef<TextViewerHandle>()

    render(<TextViewer ref={viewerRef} source={urlSource("/loaded.txt")} />)

    expect(viewerRef.current).toBeNull()
    expect(await screen.findByText("loaded url text")).toBeTruthy()
    await waitFor(() => {
      expect(viewerRef.current?.getViewportElement()).toBeInstanceOf(
        HTMLElement
      )
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("server-renders URL sources as a non-fetching skeleton", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const html = renderToString(
      <TextViewer source={urlSource("/server-only.txt")} />
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(html).toContain('data-slot="text-viewer"')
    expect(html).toContain('data-slot="text-body-skeleton"')
    expect(html).not.toContain("server-only")
  })

  it("server-renders inline text without falling back to a skeleton", () => {
    const html = renderToString(
      <TextViewer source={textSource("server inline\nsecond line")} />
    )

    expect(html).toContain("2 lines")
    expect(html).toContain("server inline")
    expect(html).toContain("second line")
    expect(html).not.toContain('data-slot="text-body-skeleton"')
  })

  it("scrolls a newly highlighted virtual line into view", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const { rerender } = render(
      <TextViewer
        ref={viewerRef}
        source={textSource(manyLines(10_000))}
        toolbar={false}
      />
    )

    const viewportElement = viewerRef.current?.getViewportElement()
    expect(viewportElement).toBeInstanceOf(HTMLElement)
    if (!viewportElement) return

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    })
    const scrollTo = vi.fn()
    viewportElement.scrollTo = scrollTo

    await act(async () => {
      rerender(
        <TextViewer
          ref={viewerRef}
          source={textSource(manyLines(10_000))}
          toolbar={false}
          highlight={{ start: 5000, end: 5000 }}
        />
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 99948, behavior: "smooth" })
  })

  it("does not auto-scroll when a highlight range is outside the document", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const { rerender } = render(
      <TextViewer ref={viewerRef} source={textSource("one\ntwo")} />
    )

    const viewportElement = viewerRef.current?.getViewportElement()
    expect(viewportElement).toBeInstanceOf(HTMLElement)
    if (!viewportElement) return

    const scrollTo = vi.fn()
    viewportElement.scrollTo = scrollTo

    await act(async () => {
      rerender(
        <TextViewer
          ref={viewerRef}
          source={textSource("one\ntwo")}
          highlight={{ start: 30, end: 40 }}
        />
      )
    })

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("does not auto-scroll again for equivalent highlight coordinates", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const { rerender } = render(
      <TextViewer ref={viewerRef} source={textSource(manyLines(100))} />
    )

    const viewportElement = viewerRef.current?.getViewportElement()
    expect(viewportElement).toBeInstanceOf(HTMLElement)
    if (!viewportElement) return

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    })
    const scrollTo = vi.fn()
    viewportElement.scrollTo = scrollTo

    await act(async () => {
      rerender(
        <TextViewer
          ref={viewerRef}
          source={textSource(manyLines(100))}
          highlight={{ start: 10, end: 10 }}
        />
      )
    })
    expect(scrollTo).toHaveBeenCalledTimes(1)

    await act(async () => {
      rerender(
        <TextViewer
          ref={viewerRef}
          source={textSource(manyLines(100))}
          highlight={{ start: 10, end: 10 }}
        />
      )
    })

    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it("uses the current zoom level when keeping a highlight in view", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const { rerender } = render(
      <TextViewer ref={viewerRef} source={textSource(manyLines(100))} />
    )

    const viewportElement = viewerRef.current?.getViewportElement()
    expect(viewportElement).toBeInstanceOf(HTMLElement)
    if (!viewportElement) return

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    })
    const scrollTo = vi.fn()
    viewportElement.scrollTo = scrollTo

    await act(async () => {
      rerender(
        <TextViewer
          ref={viewerRef}
          source={textSource(manyLines(100))}
          highlight={{ start: 10, end: 10 }}
        />
      )
    })
    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 148,
      behavior: "smooth",
    })

    fireEvent.click(screen.getByLabelText("Zoom in"))

    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 186,
      behavior: "smooth",
    })
  })
})
