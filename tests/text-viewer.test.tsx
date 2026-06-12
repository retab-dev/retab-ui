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

import {
  TextViewer,
  type TextViewerHandle,
} from "@/registry/new-york-v4/ui/text-viewer"
import {
  blobSource,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
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
} from "@/registry/new-york-v4/ui/text-viewer-resource"

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, init)
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

beforeEach(() => {
  mockObjectUrls()
})

afterEach(() => {
  cleanup()
  clearTextViewerResourceCacheForTests()
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
  it("loads and caches successful text by src and retry version", async () => {
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

  it("uses retry versions for same-src retry", async () => {
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
})

describe("TextViewer", () => {
  it("renders inline value with line numbers", () => {
    render(<TextViewer source={textSource("alpha\nbeta")} />)

    expect(screen.getByText("2 lines")).toBeTruthy()
    expect(screen.getByText("alpha")).toBeTruthy()
    expect(screen.getByText("beta")).toBeTruthy()
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
          Array.from(
            { length: 20 },
            (_, index) => `line ${index + 1}`
          ).join("\n")
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

    const startLineElement = viewportElement.querySelector<HTMLElement>(
      '[data-line-number="10"]'
    )
    const endLineElement = viewportElement.querySelector<HTMLElement>(
      '[data-line-number="11"]'
    )
    expect(startLineElement).not.toBeNull()
    expect(endLineElement).not.toBeNull()
    if (!startLineElement || !endLineElement) return

    startLineElement.getBoundingClientRect = () => rect(200, 220)
    endLineElement.getBoundingClientRect = () => rect(220, 240)

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 10, end: 11 },
        { behavior: "auto" }
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 170, behavior: "auto" })
  })

  it("renders a local error and retries the same URL source", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("loaded text", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(<TextViewer source={urlSource("/same.txt")} />)
    expect(
      await screen.findByText("Could not load this text file.")
    ).toBeTruthy()

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
    expect(
      await screen.findByText("Could not load this text file.")
    ).toBeTruthy()

    rerender(<TextViewer source={urlSource("/next.txt")} />)

    await waitFor(() => {
      expect(screen.getByText("next file")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("renders a too-large state locally", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(<TextViewer source={textSource("one\ntwo\nthree")} maxLines={2} />)

    expect(
      await screen.findByText(
        "This text file is too large to preview (lines limit)."
      )
    ).toBeTruthy()
  })

  it("recovers when an inline value becomes valid after a local error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { rerender } = render(
      <TextViewer source={textSource("one\ntwo\nthree")} maxLines={2} />
    )

    expect(
      await screen.findByText(
        "This text file is too large to preview (lines limit)."
      )
    ).toBeTruthy()

    rerender(<TextViewer source={textSource("one\ntwo")} maxLines={2} />)

    await waitFor(() => {
      expect(screen.getByText("2 lines")).toBeTruthy()
      expect(screen.getByText("one")).toBeTruthy()
      expect(screen.getByText("two")).toBeTruthy()
    })
    expect(
      screen.queryByText(
        "This text file is too large to preview (lines limit)."
      )
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

  it("downloads URL, Blob, and inline text sources", async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrls()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("alpha")))
    )

    const { rerender } = render(
      <TextViewer source={textSource("inline text", "inline.txt")} />
    )

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Download" })
      expect(link.getAttribute("href")).toBe("blob:download")
      expect(link.getAttribute("download")).toBe("inline.txt")
    })

    rerender(
      <TextViewer
        source={textBlobSource("blob text", "blob.txt", "blob:download")}
      />
    )

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Download" })
      expect(link.getAttribute("href")).toBe("blob:download")
      expect(link.getAttribute("download")).toBe("blob.txt")
    })

    rerender(<TextViewer source={urlSource("/alpha.txt", "alpha.txt")} />)

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Download" })
      expect(link.getAttribute("href")).toBe("/alpha.txt")
      expect(link.getAttribute("download")).toBe("alpha.txt")
    })
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download")
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
      await screen.findByText(
        "This text file is too large to preview (lines limit)."
      )
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
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download")
      ).toBe("descriptor.txt")
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

  it("uses exact reset tokens instead of fingerprints", () => {
    const viewerModuleSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer.tsx"
    )

    expect(viewerModuleSource).toContain("TextViewerResetToken")
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
