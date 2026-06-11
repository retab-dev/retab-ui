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
import { afterEach, describe, expect, it, vi } from "vitest"

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
} from "@/registry/new-york-v4/ui/text-viewer-resource"

afterEach(() => {
  cleanup()
  clearTextViewerResourceCacheForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, init)
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
        src: "/cached.txt",
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe("cached text")
    expect(
      readTextResource({ src: "/cached.txt", retryVersion: 0, bounds })
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
        src: "/retry.txt",
        retryVersion: 0,
        bounds,
      })
    ).rejects.toThrow("Failed to load")
    await expect(
      readResourceAfterSuspense({
        src: "/retry.txt",
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
        src: "/too-large-bytes.txt",
        retryVersion: 0,
        bounds: byteBounds,
      })
    ).rejects.toThrow("bytes limit")

    const lineBounds = resolvedTextViewerBounds({ maxLines: 2 })
    await expect(
      readResourceAfterSuspense({
        src: "/too-large-lines.txt",
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
        readResourceAfterSuspense({ src, retryVersion: 0, bounds })
      ).resolves.toBe(src)
    }

    const firstSrc = "/cached-0.txt"
    await expect(
      readResourceAfterSuspense({
        src: firstSrc,
        retryVersion: 0,
        bounds,
      })
    ).resolves.toBe(firstSrc)
    expect(fetchMock).toHaveBeenCalledTimes(MAX_TEXT_RESOURCE_CACHE_ENTRIES + 3)
  })
})

describe("TextViewer", () => {
  it("renders inline value with line numbers", () => {
    render(<TextViewer value={"alpha\nbeta"} />)

    expect(screen.getByText("2 lines")).toBeTruthy()
    expect(screen.getByText("alpha")).toBeTruthy()
    expect(screen.getByText("beta")).toBeTruthy()
  })

  it("hides toolbar chrome when toolbar is false", () => {
    render(<TextViewer value="alpha" toolbar={false} />)

    expect(screen.queryByText("1 line")).toBeNull()
    expect(screen.queryByLabelText("Zoom in")).toBeNull()
  })

  it("hides fallback toolbar chrome when toolbar is false", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {}))
    )

    render(<TextViewer src="/pending.txt" toolbar={false} />)

    expect(screen.queryByLabelText("Zoom in")).toBeNull()
  })

  it("highlights every line in a normalized multi-line range", () => {
    const { container } = render(
      <TextViewer
        value={"one\ntwo\nthree\nfour"}
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
      <TextViewer value={"one\ntwo"} highlight={{ start: 10, end: 20 }} />
    )

    expect(container.querySelector(".bg-primary\\/12")).toBeNull()
  })

  it("scrolls to reveal the full requested range", () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    render(
      <TextViewer
        ref={viewerRef}
        value={Array.from(
          { length: 20 },
          (_, index) => `line ${index + 1}`
        ).join("\n")}
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

  it("renders a local error and retries the same src", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("loaded text", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    render(<TextViewer src="/same.txt" />)
    expect(
      await screen.findByText("Could not load this text file.")
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(screen.getByText("loaded text")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("recovers from a fetch error when src changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("next file", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(<TextViewer src="/broken.txt" />)
    expect(
      await screen.findByText("Could not load this text file.")
    ).toBeTruthy()

    rerender(<TextViewer src="/next.txt" />)

    await waitFor(() => {
      expect(screen.getByText("next file")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("renders a too-large state locally", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(<TextViewer value={"one\ntwo\nthree"} maxLines={2} />)

    expect(
      await screen.findByText(
        "This text file is too large to preview (lines limit)."
      )
    ).toBeTruthy()
  })

  it("recovers when an inline value becomes valid after a local error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { rerender } = render(
      <TextViewer value={"one\ntwo\nthree"} maxLines={2} />
    )

    expect(
      await screen.findByText(
        "This text file is too large to preview (lines limit)."
      )
    ).toBeTruthy()

    rerender(<TextViewer value={"one\ntwo"} maxLines={2} />)

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

    const { rerender } = render(<TextViewer value="one" maxLines={0} />)

    expect(
      await screen.findByText("Text viewer bounds are invalid.")
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()

    rerender(<TextViewer value="one" maxLines={1} />)

    await waitFor(() => {
      expect(screen.getByText("1 line")).toBeTruthy()
      expect(screen.getByText("one")).toBeTruthy()
    })
    expect(screen.queryByText("Text viewer bounds are invalid.")).toBeNull()
  })

  it("shows download only for src", () => {
    const { rerender } = render(<TextViewer value="alpha" />)
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull()

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("alpha")))
    )
    rerender(<TextViewer src="/alpha.txt" downloadName="alpha.txt" />)

    return waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download")
      ).toBe("alpha.txt")
    })
  })
})

describe("text-viewer implementation boundaries", () => {
  it("keeps resource cache keys private to the resource module", () => {
    const textViewerSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer.tsx"
    )
    const testSource = readRegistryFile("tests/text-viewer.test.tsx")
    const resourceKeyName = ["textViewer", "Resource", "Key"].join("")

    expect(textViewerSource).not.toContain(resourceKeyName)
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
    const textViewerSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer.tsx"
    )

    expect(textViewerSource).toContain("TextViewerResetToken")
    expect(textViewerSource).not.toContain("fingerprint")
    expect(textViewerSource).not.toContain("resourceVersion")
  })
})
