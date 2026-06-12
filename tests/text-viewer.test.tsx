// @vitest-environment jsdom

import { readFileSync } from "node:fs"
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

import { ViewerFormatError } from "@/registry/new-york-v4/lib/viewer-errors"
import type { ResourceError } from "@/registry/new-york-v4/lib/viewer-errors"
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  TextViewer,
  type TextViewerHandle,
} from "@/registry/new-york-v4/ui/text-viewer"
import { scrollTopForLineRange } from "@/registry/new-york-v4/ui/text-viewer-layout"
import {
  isLineInRange,
  normalizeTextLineRange,
} from "@/registry/new-york-v4/ui/text-viewer-ranges"
import {
  clearTextViewerResourceCacheForTests,
  MAX_TEXT_RESOURCE_CACHE_ENTRIES,
  readTextResource,
  resolvedTextViewerBounds,
  TextViewerTooLargeError,
} from "@/registry/new-york-v4/ui/text-viewer-resource"

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, init)
}

function streamResponse(
  chunks: string[],
  {
    onCancel,
    closeAfterChunks = true,
    init,
  }: {
    onCancel?: () => void
    closeAfterChunks?: boolean
    init?: ResponseInit
  } = {}
) {
  const encoder = new TextEncoder()
  let nextChunkIndex = 0
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[nextChunkIndex]
        nextChunkIndex += 1

        if (chunk != null) {
          controller.enqueue(encoder.encode(chunk))
        }
        if (closeAfterChunks && nextChunkIndex >= chunks.length) {
          controller.close()
        }
      },
      cancel: onCancel,
    }),
    init
  )
}

function textSource(text: string, fileName?: string) {
  return { kind: "text" as const, text, fileName }
}

function urlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName }
}

function textBlobSource(text: string, fileName: string, identityKey: string) {
  return blobSource(new Blob([text], { type: "text/plain" }), {
    fileName,
    identityKey,
  })
}

function sharedTextBlobSource({
  blob,
  fileName,
  identityKey,
  downloadUrl,
}: {
  blob: Blob
  fileName: string
  identityKey: string
  downloadUrl?: string
}) {
  return blobSource(blob, {
    fileName,
    identityKey,
    downloadUrl,
  })
}

function textResource(url: string, fileName?: string) {
  return createViewerResource(urlSource(url, fileName))
}

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function readRegistryFile(path: string) {
  return readFileSync(path, "utf8")
}

function mockObjectUrls(url = "blob:download") {
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

function captureAnchorClicks() {
  const clicks: Array<{ href: string | null; download: string }> = []
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({
        href: this.getAttribute("href"),
        download: this.download,
      })
    })
  return { click, clicks }
}

beforeEach(() => {
  mockObjectUrls()
})

afterEach(() => {
  cleanup()
  clearTextViewerResourceCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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

describe("text-viewer-ranges", () => {
  it("clamps valid ranges and swaps reversed ranges", () => {
    expect(normalizeTextLineRange({ start: 12, end: 3 }, 10)).toMatchObject({
      start: 3,
      end: 10,
    })
    expect(normalizeTextLineRange({ start: -4, end: 2 }, 10)).toMatchObject({
      start: 1,
      end: 2,
    })
  })

  it("rejects non-finite and fully out-of-document ranges", () => {
    expect(normalizeTextLineRange({ start: Number.NaN, end: 2 }, 10)).toBeNull()
    expect(normalizeTextLineRange({ start: 20, end: 30 }, 10)).toBeNull()
    expect(normalizeTextLineRange({ start: 1, end: 2 }, 0)).toBeNull()
  })

  it("checks line membership only for normalized ranges", () => {
    const range = normalizeTextLineRange({ start: 2, end: 3 }, 5)

    expect(isLineInRange(1, range)).toBe(false)
    expect(isLineInRange(2, range)).toBe(true)
    expect(isLineInRange(3, range)).toBe(true)
    expect(isLineInRange(4, range)).toBe(false)
    expect(isLineInRange(2, null)).toBe(false)
  })

  it("normalizes fractional ranges by truncating before clamping", () => {
    expect(normalizeTextLineRange({ start: 3.9, end: 2.1 }, 5)).toMatchObject({
      start: 2,
      end: 3,
    })
    expect(normalizeTextLineRange({ start: 0.9, end: 1.9 }, 5)).toMatchObject({
      start: 1,
      end: 1,
    })
  })
})

describe("text-viewer-layout", () => {
  it("centers a fitting range", () => {
    expect(
      scrollTopForLineRange({
        startTop: 200,
        endBottom: 240,
        viewportTop: 0,
        viewportScrollTop: 0,
        viewportHeight: 100,
      })
    ).toBe(170)
  })

  it("top-aligns an oversized range and clamps to zero", () => {
    expect(
      scrollTopForLineRange({
        startTop: 30,
        endBottom: 240,
        viewportTop: 0,
        viewportScrollTop: 0,
        viewportHeight: 100,
      })
    ).toBe(0)
  })
})

describe("text-viewer-resource", () => {
  it("models text bounds failures as format errors", () => {
    expect(() =>
      readTextResource({
        resource: createViewerResource(textSource("too large")),
        retryVersion: 0,
        bounds: { maxBytes: 1, maxLines: 10 },
      })
    ).toThrow(TextViewerTooLargeError)
    expect(() =>
      readTextResource({
        resource: createViewerResource(textSource("too large")),
        retryVersion: 0,
        bounds: { maxBytes: 1, maxLines: 10 },
      })
    ).toThrow(ViewerFormatError)
  })

  it("loads and caches successful text by source and retry version", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("cached text")))
    vi.stubGlobal("fetch", fetchMock)
    const bounds = resolvedTextViewerBounds()

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/cached.txt"),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("cached text")
    expect(
      readTextResource({
        resource: textResource("/cached.txt"),
        retryVersion: 0,
        bounds,
      })
    ).toBe("cached text")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("uses retry versions for same-source retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("retried"))
    vi.stubGlobal("fetch", fetchMock)
    const bounds = resolvedTextViewerBounds()

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/retry.txt"),
        retryVersion: 0,
        bounds,
      })
    ).rejects.toThrow("Failed to load")
    await expect(
      readResourceAfterSuspense({
        resource: textResource("/retry.txt"),
        retryVersion: 1,
        bounds,
      })
    ).resolves.toBe("retried")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("rejects by content length and line limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response("", {
            headers: { "content-length": "5" },
          })
        )
        .mockResolvedValueOnce(response("one\ntwo\nthree"))
    )
    const byteBounds = resolvedTextViewerBounds({ maxBytes: 4 })
    await expect(
      readResourceAfterSuspense({
        resource: textResource("/too-large-bytes.txt"),
        retryVersion: 0,
        bounds: byteBounds,
      })
    ).rejects.toThrow("bytes limit")

    const lineBounds = resolvedTextViewerBounds({ maxLines: 2 })
    await expect(
      readResourceAfterSuspense({
        resource: textResource("/too-large-lines.txt"),
        retryVersion: 0,
        bounds: lineBounds,
      })
    ).rejects.toThrow("lines limit")
  })

  it("rejects invalid bounds", () => {
    expect(() => resolvedTextViewerBounds({ maxBytes: 0 })).toThrow("maxBytes")
    expect(() => resolvedTextViewerBounds({ maxLines: Infinity })).toThrow(
      "maxLines"
    )
  })

  it("counts bytes rather than UTF-16 code units for inline text", () => {
    const resource = createViewerResource(textSource("é"))

    expect(() =>
      readTextResource({
        resource,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 1 }),
      })
    ).toThrow("bytes limit")
    expect(
      readTextResource({
        resource,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 2 }),
      })
    ).toBe("é")
  })

  it("counts CR-only newlines toward the line limit", () => {
    expect(() =>
      readTextResource({
        resource: createViewerResource(textSource("one\rtwo")),
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 1 }),
      })
    ).toThrow("lines limit")
  })

  it("counts CR-only newlines loaded from URLs toward the line limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("one\rtwo")))
    )

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/classic-newlines.txt"),
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 1 }),
      })
    ).rejects.toThrow("lines limit")
  })

  it("cancels streamed URL reads when the byte limit is crossed mid-stream", async () => {
    const cancel = vi.fn()
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          streamResponse(["ab", "cd"], {
            closeAfterChunks: false,
            onCancel: cancel,
          })
        )
      )
    )

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/stream-too-large.txt"),
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      })
    ).rejects.toThrow("bytes limit")
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it("cancels streamed URL reads when the line limit is crossed mid-stream", async () => {
    const cancel = vi.fn()
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          streamResponse(["one\n", "two"], {
            closeAfterChunks: false,
            onCancel: cancel,
          })
        )
      )
    )

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/stream-too-many-lines.txt"),
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 1 }),
      })
    ).rejects.toThrow("lines limit")
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it("does not double-count CRLF line breaks split across streamed chunks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(streamResponse(["one\r", "\ntwo"])))
    )

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/split-crlf.txt"),
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 2 }),
      })
    ).resolves.toBe("one\r\ntwo")
  })

  it("decodes UTF-8 characters split across streamed response chunks", async () => {
    const encoded = new TextEncoder().encode("a🙂b")
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(encoded.slice(0, 3))
                controller.enqueue(encoded.slice(3))
                controller.close()
              },
            })
          )
        )
      )
    )

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/split-utf8.txt"),
        retryVersion: 0,
        bounds: resolvedTextViewerBounds(),
      })
    ).resolves.toBe("a🙂b")
  })

  it("rejects partial-content URL responses for full text reads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("part", {
            status: 206,
            headers: { "content-range": "bytes 0-3/100" },
          })
        )
      )
    )

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/partial.txt"),
        retryVersion: 0,
        bounds: resolvedTextViewerBounds(),
      })
    ).rejects.toMatchObject({
      kind: "partial_content",
      status: 206,
    } satisfies Partial<ResourceError>)
  })

  it("does not refetch a rejected URL resource until retry version changes", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(response("", { status: 500 }))
    )
    vi.stubGlobal("fetch", fetchMock)
    const resource = textResource("/cached-error.txt")
    const bounds = resolvedTextViewerBounds()

    await expect(
      readResourceAfterSuspense({ resource, retryVersion: 0, bounds })
    ).rejects.toThrow("Failed to load")
    await expect(
      readResourceAfterSuspense({ resource, retryVersion: 0, bounds })
    ).rejects.toThrow("Failed to load")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("caps the resource cache", async () => {
    const fetchMock = vi.fn((src: string) => Promise.resolve(response(src)))
    vi.stubGlobal("fetch", fetchMock)
    const bounds = resolvedTextViewerBounds()

    for (let index = 0; index < MAX_TEXT_RESOURCE_CACHE_ENTRIES + 2; index++) {
      const src = `/cached-${index}.txt`
      await expect(
        readResourceAfterSuspense({
          resource: textResource(src),
          retryVersion: 0,
          bounds,
        })
      ).resolves.toBe(src)
    }

    const firstSrc = "/cached-0.txt"
    await expect(
      readResourceAfterSuspense({
        resource: textResource(firstSrc),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe(firstSrc)
    expect(fetchMock).toHaveBeenCalledTimes(MAX_TEXT_RESOURCE_CACHE_ENTRIES + 3)
  })

  it("loads blob text through the same resource cache", async () => {
    const bounds = resolvedTextViewerBounds()

    await expect(
      readResourceAfterSuspense({
        resource: createViewerResource(
          textBlobSource("blob text", "blob.txt", "blob:one")
        ),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("blob text")
  })

  it("keys blob text by identity instead of size and MIME only", async () => {
    const bounds = resolvedTextViewerBounds()

    await expect(
      readResourceAfterSuspense({
        resource: createViewerResource(
          textBlobSource("same-size-a", "same.txt", "blob:a")
        ),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("same-size-a")
    await expect(
      readResourceAfterSuspense({
        resource: createViewerResource(
          textBlobSource("same-size-b", "same.txt", "blob:b")
        ),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("same-size-b")
  })

  it("marks URL byte ranges complete when a 206 response reaches EOF", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        response("cde", {
          status: 206,
          headers: { "content-range": "bytes 2-4/5" },
        })
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await textResource("/range.txt").readRange({
      start: 2,
      end: 4,
    })

    expect(fetchMock).toHaveBeenCalledWith("/range.txt", {
      headers: { Range: "bytes=2-4" },
      signal: undefined,
    })
    expect(new TextDecoder().decode(result.buffer)).toBe("cde")
    expect(result.contentRange).toEqual({ start: 2, end: 4, total: 5 })
    expect(result.isComplete).toBe(true)
  })

  it("keeps non-final URL byte ranges incomplete when the server returns the full requested span", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("abc", {
            status: 206,
            headers: { "content-range": "bytes 0-2/5" },
          })
        )
      )
    )

    await expect(
      textResource("/range.txt").readRange({ start: 0, end: 2 })
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: 2, total: 5 },
      isComplete: false,
    })
  })

  it("treats full URL range responses as complete even without Content-Range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("whole", { status: 200 })))
    )

    await expect(
      textResource("/range.txt").readRange({ start: 0, end: 99 })
    ).resolves.toMatchObject({ contentRange: undefined, isComplete: true })
  })

  it("rejects invalid URL byte ranges before sending a request", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      textResource("/range.txt").readRange({ start: -1, end: 2 })
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>)
    await expect(
      textResource("/range.txt").readRange({ start: 4, end: 3 })
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects invalid local byte ranges", async () => {
    await expect(
      createViewerResource(textSource("abc")).readRange({ start: 2.5, end: 3 })
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>)

    await expect(
      createViewerResource(
        textBlobSource("abc", "abc.txt", "blob:abc")
      ).readRange({ start: 3, end: 2 })
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>)
  })

  it("rejects local byte ranges that start past the available payload", async () => {
    await expect(
      createViewerResource(textSource("abc")).readRange({ start: 3, end: 4 })
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>)

    await expect(
      createViewerResource(
        textBlobSource("abc", "abc.txt", "blob:range")
      ).readRange({ start: 4, end: 5 })
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>)
  })

  it("returns a coherent empty range for empty local payloads", async () => {
    await expect(
      createViewerResource(textSource("")).readRange({ start: 0, end: 0 })
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: -1, total: 0 },
      isComplete: true,
    })

    await expect(
      createViewerResource(
        textBlobSource("", "empty.txt", "blob:empty")
      ).readRange({ start: 0, end: 0 })
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: -1, total: 0 },
      isComplete: true,
    })
  })

  it("reads text byte ranges over encoded UTF-8 bytes", async () => {
    const result = await createViewerResource(textSource("éx")).readRange({
      start: 0,
      end: 1,
    })

    expect(new TextDecoder().decode(result.buffer)).toBe("é")
    expect(result.contentRange).toEqual({ start: 0, end: 1, total: 3 })
    expect(result.isComplete).toBe(false)
  })

  it("reports blob range completion against the full blob size", async () => {
    const resource = createViewerResource(
      textBlobSource("abcdef", "letters.txt", "blob:letters")
    )

    await expect(
      resource.readRange({ start: 0, end: 2 })
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: 2, total: 6 },
      isComplete: false,
    })
    await expect(
      resource.readRange({ start: 3, end: 5 })
    ).resolves.toMatchObject({
      contentRange: { start: 3, end: 5, total: 6 },
      isComplete: true,
    })
  })

  it("shares URL text payload cache across metadata-only resource changes", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("same payload")))
    vi.stubGlobal("fetch", fetchMock)
    const bounds = resolvedTextViewerBounds()

    await expect(
      readResourceAfterSuspense({
        resource: textResource("/same.txt", "first.txt"),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("same payload")
    await expect(
      readResourceAfterSuspense({
        resource: textResource("/same.txt", "second.txt"),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("same payload")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(textResource("/same.txt", "second.txt").fileName).toBe("second.txt")
  })

  it("does not reuse cached blob text when a new Blob reuses the same identity", async () => {
    const bounds = resolvedTextViewerBounds()

    await expect(
      readResourceAfterSuspense({
        resource: createViewerResource(
          textBlobSource("first blob", "same.txt", "blob:reused")
        ),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("first blob")
    await expect(
      readResourceAfterSuspense({
        resource: createViewerResource(
          textBlobSource("second blob", "same.txt", "blob:reused")
        ),
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("second blob")
  })
})

describe("TextViewer", () => {
  it("renders inline value with line numbers", () => {
    render(<TextViewer source={textSource("alpha\nbeta")} />)

    expect(screen.getByText("2 lines")).toBeTruthy()
    expect(screen.getByText("alpha")).toBeTruthy()
    expect(screen.getByText("beta")).toBeTruthy()
  })

  it("renders empty text as a single blank line", () => {
    const { container } = render(<TextViewer source={textSource("")} />)

    expect(screen.getByText("1 line")).toBeTruthy()
    expect(container.querySelector('[data-line-number="1"]')).toBeTruthy()
    expect(container.querySelector('[data-line-number="2"]')).toBeNull()
  })

  it("renders trailing newlines as blank final lines", () => {
    const { container } = render(<TextViewer source={textSource("alpha\n")} />)

    expect(screen.getByText("2 lines")).toBeTruthy()
    expect(container.querySelector('[data-line-number="1"]')).toBeTruthy()
    expect(container.querySelector('[data-line-number="2"]')).toBeTruthy()
  })

  it("renders CRLF and CR newline variants without leaking carriage returns", () => {
    const { container } = render(
      <TextViewer source={textSource("alpha\r\nbeta\rgamma")} />
    )

    expect(screen.getByText("3 lines")).toBeTruthy()
    expect(
      container.querySelector('[data-line-number="1"] span:last-child')
        ?.textContent
    ).toBe("alpha")
    expect(
      container.querySelector('[data-line-number="2"] span:last-child')
        ?.textContent
    ).toBe("beta")
    expect(
      container.querySelector('[data-line-number="3"] span:last-child')
        ?.textContent
    ).toBe("gamma")
  })

  it("hides toolbar chrome when toolbar is false", () => {
    render(<TextViewer source={textSource("alpha")} toolbar={false} />)

    expect(screen.queryByText("1 line")).toBeNull()
    expect(screen.queryByLabelText("Zoom in")).toBeNull()
  })

  it("hides fallback toolbar chrome when toolbar is false", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {}))
    )

    render(<TextViewer source={urlSource("/pending.txt")} toolbar={false} />)

    expect(screen.queryByLabelText("Zoom in")).toBeNull()
  })

  it("highlights every line in a normalized multi-line range", () => {
    const { container } = render(
      <TextViewer
        source={textSource("one\ntwo\nthree\nfour")}
        highlight={{ start: 3, end: 2 }}
      />
    )

    expect(
      container.querySelector('[data-line-number="1"]')?.className
    ).not.toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="2"]')?.className
    ).toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="3"]')?.className
    ).toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="4"]')?.className
    ).not.toContain("bg-primary/12")
  })

  it("clamps highlight ranges that partly overlap the document", () => {
    const { container } = render(
      <TextViewer
        source={textSource("one\ntwo\nthree")}
        highlight={{ start: -20, end: 2 }}
      />
    )

    expect(
      container.querySelector('[data-line-number="1"]')?.className
    ).toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="2"]')?.className
    ).toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="3"]')?.className
    ).not.toContain("bg-primary/12")
  })

  it("does not highlight invalid ranges", () => {
    const { container } = render(
      <TextViewer
        source={textSource("one\ntwo")}
        highlight={{ start: 10, end: 20 }}
      />
    )

    expect(container.querySelector(".bg-primary\\/12")).toBeNull()
  })

  it("scrolls to reveal the full requested range", () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    render(
      <TextViewer
        ref={viewerRef}
        source={textSource(
          Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join(
            "\n"
          )
        )}
      />
    )

    const viewportElement = viewerRef.current?.getViewportElement()
    expect(viewportElement).not.toBeNull()
    if (!viewportElement) return

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    })
    Object.defineProperty(viewportElement, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    })
    viewportElement.getBoundingClientRect = () => rect(0, 100)
    const scrollTo = vi.fn()
    viewportElement.scrollTo = scrollTo

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 10, end: 11 },
        { behavior: "auto" }
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 158, behavior: "auto" })
  })

  it("ignores imperative scroll requests for invalid ranges", () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    render(<TextViewer ref={viewerRef} source={textSource("one\ntwo")} />)

    const viewportElement = viewerRef.current?.getViewportElement()
    expect(viewportElement).not.toBeNull()
    if (!viewportElement) return

    const scrollTo = vi.fn()
    viewportElement.scrollTo = scrollTo

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 10, end: 12 },
        { behavior: "auto" }
      )
    })

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("uses the current zoom level for imperative scroll offsets", () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    render(
      <TextViewer
        ref={viewerRef}
        source={textSource(
          Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join(
            "\n"
          )
        )}
      />
    )

    const viewportElement = viewerRef.current?.getViewportElement()
    expect(viewportElement).not.toBeNull()
    if (!viewportElement) return

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    })
    const scrollTo = vi.fn()
    viewportElement.scrollTo = scrollTo

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(screen.getByText("120%")).toBeTruthy()

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 10, end: 10 },
        { behavior: "auto" }
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 186, behavior: "auto" })
  })

  it("clamps zoom controls to the supported scale range", () => {
    render(<TextViewer source={textSource("alpha")} />)

    for (let index = 0; index < 20; index++) {
      fireEvent.click(screen.getByLabelText("Zoom in"))
    }
    expect(screen.getByText("500%")).toBeTruthy()

    for (let index = 0; index < 40; index++) {
      fireEvent.click(screen.getByLabelText("Zoom out"))
    }
    expect(screen.getByText("25%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Reset zoom"))
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("does not mount every line in a large text file", () => {
    const { container } = render(
      <TextViewer
        source={textSource(
          Array.from(
            { length: 10_000 },
            (_, index) => `line ${index + 1}`
          ).join("\n")
        )}
        toolbar={false}
      />
    )

    expect(
      container.querySelectorAll("[data-line-number]").length
    ).toBeLessThan(200)
  })

  it("scrolls to a virtualized line that is not currently mounted", () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const { container } = render(
      <TextViewer
        ref={viewerRef}
        source={textSource(
          Array.from(
            { length: 10_000 },
            (_, index) => `line ${index + 1}`
          ).join("\n")
        )}
        toolbar={false}
      />
    )

    expect(container.querySelector('[data-line-number="5000"]')).toBeNull()

    const viewportElement = viewerRef.current?.getViewportElement()
    expect(viewportElement).not.toBeNull()
    if (!viewportElement) return

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    })
    const scrollTo = vi.fn()
    viewportElement.scrollTo = scrollTo

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 5000, end: 5000 },
        { behavior: "auto" }
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 99948, behavior: "auto" })
  })

  it("renders a local error and retries the same URL source", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("loaded text", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(<TextViewer source={urlSource("/same.txt")} />)
    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(screen.getByText("loaded text")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("recovers from a fetch error when the URL source changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("next file", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(
      <TextViewer source={urlSource("/broken.txt")} />
    )
    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy()

    rerender(<TextViewer source={urlSource("/next.txt")} />)

    await waitFor(() => {
      expect(screen.getByText("next file")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("ignores a stale pending URL load after the source changes", async () => {
    let resolveSlow: ((response: Response) => void) | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === "/slow.txt") {
        return new Promise<Response>((resolve) => {
          resolveSlow = resolve
        })
      }
      return Promise.resolve(response("fast file"))
    })
    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(<TextViewer source={urlSource("/slow.txt")} />)
    rerender(<TextViewer source={urlSource("/fast.txt")} />)

    await waitFor(() => {
      expect(screen.getByText("fast file")).toBeTruthy()
    })

    await act(async () => {
      resolveSlow?.(response("slow file"))
      await Promise.resolve()
    })

    expect(screen.getByText("fast file")).toBeTruthy()
    expect(screen.queryByText("slow file")).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("keeps a shared pending URL load to one fetch across rerenders", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("shared text")))
    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(
      <TextViewer source={urlSource("/shared.txt")} />
    )
    rerender(<TextViewer source={urlSource("/shared.txt")} />)

    await waitFor(() => {
      expect(screen.getByText("shared text")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("renders a too-large state locally", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(<TextViewer source={textSource("one\ntwo\nthree")} maxLines={2} />)

    expect(
      await screen.findByText("This text file has too many lines to preview.")
    ).toBeTruthy()
  })

  it("recovers when an inline value becomes valid after a local error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { rerender } = render(
      <TextViewer source={textSource("one\ntwo\nthree")} maxLines={2} />
    )

    expect(
      await screen.findByText("This text file has too many lines to preview.")
    ).toBeTruthy()

    rerender(<TextViewer source={textSource("one\ntwo")} maxLines={2} />)

    await waitFor(() => {
      expect(screen.getByText("2 lines")).toBeTruthy()
      expect(screen.getByText("one")).toBeTruthy()
      expect(screen.getByText("two")).toBeTruthy()
    })
    expect(
      screen.queryByText("This text file has too many lines to preview.")
    ).toBeNull()
  })

  it("recovers when bounds become valid after a local error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { rerender } = render(
      <TextViewer source={textSource("one")} maxLines={0} />
    )

    expect(
      await screen.findByText("Text viewer bounds are invalid.")
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()

    rerender(<TextViewer source={textSource("one")} maxLines={1} />)

    await waitFor(() => {
      expect(screen.getByText("1 line")).toBeTruthy()
      expect(screen.getByText("one")).toBeTruthy()
    })
    expect(screen.queryByText("Text viewer bounds are invalid.")).toBeNull()
  })

  it("recovers from a URL line-limit error when the limit is raised", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi.fn(() => Promise.resolve(response("one\ntwo\nthree")))
    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(
      <TextViewer source={urlSource("/bounded.txt")} maxLines={2} />
    )

    expect(
      await screen.findByText("This text file has too many lines to preview.")
    ).toBeTruthy()

    rerender(<TextViewer source={urlSource("/bounded.txt")} maxLines={3} />)

    await waitFor(() => {
      expect(screen.getByText("3 lines")).toBeTruthy()
      expect(screen.getByText("three")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("downloads URL, Blob, and inline text sources", async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrls()
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("alpha")))
    )

    const { rerender } = render(
      <TextViewer source={textSource("inline text", "inline.txt")} />
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("button", { name: "Download" }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))

    rerender(
      <TextViewer
        source={textBlobSource("blob text", "blob.txt", "blob:download")}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("button", { name: "Download" }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(2))

    rerender(<TextViewer source={urlSource("/alpha.txt", "alpha.txt")} />)

    await waitFor(() => {
      expect(screen.getByText("alpha")).toBeTruthy()
      const link = screen.getByRole("link", { name: "Download" })
      expect(link.getAttribute("href")).toBe("/alpha.txt")
      expect(link.getAttribute("download")).toBe("alpha.txt")
    })
    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download")
  })

  it("updates URL download metadata without refetching the same text payload", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("cached url text")))
    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(
      <TextViewer source={urlSource("/metadata.txt", "first.txt")} />
    )

    await waitFor(() => {
      expect(screen.getByText("cached url text")).toBeTruthy()
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download")
      ).toBe("first.txt")
    })

    rerender(<TextViewer source={urlSource("/metadata.txt", "second.txt")} />)

    await waitFor(() => {
      expect(screen.getByText("cached url text")).toBeTruthy()
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download")
      ).toBe("second.txt")
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("updates Blob download metadata while reusing the same Blob payload", async () => {
    const { createObjectURL } = mockObjectUrls("blob:shared-text")
    const { click, clicks } = captureAnchorClicks()
    const sharedBlob = new Blob(["shared blob text"], { type: "text/plain" })

    const { rerender } = render(
      <TextViewer
        source={sharedTextBlobSource({
          blob: sharedBlob,
          fileName: "first.txt",
          identityKey: "blob:shared",
        })}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("shared blob text")).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("button", { name: "Download" }))
    await waitFor(() => {
      expect(click).toHaveBeenCalledTimes(1)
    })

    rerender(
      <TextViewer
        source={sharedTextBlobSource({
          blob: sharedBlob,
          fileName: "second.txt",
          identityKey: "blob:shared",
        })}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("shared blob text")).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => expect(click).toHaveBeenCalledTimes(2))
    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect(clicks).toEqual([
      { href: "blob:shared-text", download: "first.txt" },
      { href: "blob:shared-text", download: "second.txt" },
    ])
  })

  it("lets a retry after a metadata-only URL change refetch the same payload identity", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("retried after metadata change"))
    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(
      <TextViewer source={urlSource("/retry-metadata.txt", "first.txt")} />
    )

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy()

    rerender(
      <TextViewer source={urlSource("/retry-metadata.txt", "second.txt")} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(screen.getByText("retried after metadata change")).toBeTruthy()
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download")
      ).toBe("second.txt")
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("renders Blob sources and treats bounds errors as local non-retryable states", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <TextViewer
        source={textBlobSource("one\ntwo\nthree", "blob.txt", "blob:bounds")}
        maxLines={2}
      />
    )

    expect(
      await screen.findByText("This text file has too many lines to preview.")
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  })

  it("supports explicit text and URL source descriptors", async () => {
    mockObjectUrls("blob:descriptor")
    const { rerender } = render(
      <TextViewer
        source={{
          kind: "text",
          text: "descriptor text",
          fileName: "descriptor.txt",
        }}
      />
    )
    expect(screen.getByText("descriptor text")).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeTruthy()
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("descriptor url")))
    )
    rerender(
      <TextViewer
        source={{
          kind: "url",
          url: "/descriptor.txt",
          fileName: "descriptor.txt",
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("descriptor url")).toBeTruthy()
    })
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download")
    ).toBe("descriptor.txt")
  })
})

describe("text-viewer implementation boundaries", () => {
  it("keeps resource cache keys private to the resource module", () => {
    const viewerModuleSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer.tsx"
    )
    const testSource = readRegistryFile("tests/text-viewer.test.tsx")
    const resourceKeyName = ["textViewer", "Resource", "Key"].join("")

    expect(viewerModuleSource).not.toContain(resourceKeyName)
    expect(testSource).not.toContain(resourceKeyName)
  })

  it("does not expose cache size just for tests", () => {
    const resourceSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer-resource.ts"
    )
    const testSource = readRegistryFile("tests/text-viewer.test.tsx")
    const cacheSizeName = ["Resource", "Cache", "Size"].join("")

    expect(resourceSource).not.toContain(cacheSizeName)
    expect(testSource).not.toContain(cacheSizeName)
  })

  it("uses exact reset keys instead of fingerprints", () => {
    const viewerModuleSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer.tsx"
    )

    expect(viewerModuleSource).toContain("textViewerResetKey")
    expect(viewerModuleSource).not.toContain("fingerprint")
    expect(viewerModuleSource).not.toContain("resourceVersion")
  })

  it("keeps source IO out of the component module", () => {
    const viewerModuleSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer.tsx"
    )

    expect(viewerModuleSource).not.toContain("fetch(")
    expect(viewerModuleSource).not.toContain("createObjectURL")
  })

  it("keeps the shared resource layer independent from viewer components", () => {
    const resourceModuleSource = readRegistryFile(
      "registry/new-york-v4/lib/viewer-resource.ts"
    )

    expect(resourceModuleSource).not.toContain("React")
    expect(resourceModuleSource).not.toContain("useDownloadHref")
    expect(resourceModuleSource).not.toContain("createObjectURL")
    expect(resourceModuleSource).not.toContain("@/components/ui/text-viewer")
    expect(resourceModuleSource).not.toContain("@/components/ui/pdf-viewer")
    expect(resourceModuleSource).not.toContain("@/components/ui/image-viewer")
  })

  it("uses structured resource errors instead of parsing messages", () => {
    const resourceModuleSource = readRegistryFile(
      "registry/new-york-v4/lib/viewer-resource.ts"
    )
    const textResourceSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer-resource.ts"
    )

    expect(resourceModuleSource).toContain("tooLargeReason")
    expect(textResourceSource).toContain("tooLargeReason")
    expect(textResourceSource).not.toContain('includes("lines")')
  })

  it("keeps Blob source identity explicit", () => {
    const sourceModuleSource = readRegistryFile(
      "registry/new-york-v4/lib/viewer-source.ts"
    )
    const resourceModuleSource = readRegistryFile(
      "registry/new-york-v4/lib/viewer-resource.ts"
    )

    expect(sourceModuleSource).toContain("identityKey: string")
    expect(sourceModuleSource).not.toContain("blob:${")
    expect(resourceModuleSource).toContain("identityKey: string")
  })
})
