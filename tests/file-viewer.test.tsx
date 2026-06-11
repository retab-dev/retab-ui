// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import * as React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { inferCsvDialect } from "@/lib/csv"
import { FileViewer } from "@/registry/new-york-v4/ui/file-viewer"
import {
  descriptorResetKey,
  detectCategory,
  resolveFileDescriptor,
} from "@/registry/new-york-v4/ui/file-viewer-core"
import { createMarkdownHtmlCache } from "@/registry/new-york-v4/ui/file-viewer-markdown-viewer"
import { isAbortError } from "@/registry/new-york-v4/ui/file-viewer-resource-cache"
import {
  createTextLoader,
  isSameTextView,
  textKeyForFile,
} from "@/registry/new-york-v4/ui/file-viewer-text-loader"
import { createTextResourceCache } from "@/registry/new-york-v4/ui/file-viewer-text-resource"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, init)
}

function textSubscription(src: string, mode: "stream" | "full" = "stream") {
  const controller = new AbortController()
  return {
    textKey: textKeyForFile(src, mode),
    src,
    mode,
    signal: controller.signal,
    controller,
  }
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

describe("FileViewer detection helpers", () => {
  it("detects categories by extension before MIME type", () => {
    expect(detectCategory("report.pdf", "text/plain")).toBe("pdf")
    expect(detectCategory("data", "text/csv")).toBe("csv")
    expect(detectCategory("config", "application/json")).toBe("text")
    expect(detectCategory("image", "image/png")).toBe("image")
    expect(detectCategory("archive.zip", "application/octet-stream")).toBe(
      "unsupported"
    )
  })

  it("resolves one descriptor for routing, fallback, and downloads", () => {
    const descriptor = resolveFileDescriptor({
      src: "/files/signed?id=1",
      fileName: "report.pdf",
      mimeType: "text/plain",
    })

    expect(descriptor).toEqual({
      src: "/files/signed?id=1",
      displayName: "report.pdf",
      downloadName: "report.pdf",
      mimeType: "text/plain",
      category: "pdf",
    })
    expect(descriptorResetKey(descriptor)).toBe(
      "/files/signed?id=1\u0000report.pdf\u0000text/plain\u0000pdf"
    )

    expect(
      resolveFileDescriptor({
        src: "/files/export",
        mimeType: "text/csv",
        as: "text",
      })
    ).toMatchObject({
      displayName: "/files/export",
      downloadName: "export",
      category: "text",
    })
  })

  it("separates text cache entries by loading mode", () => {
    expect(textKeyForFile("/same-url", "stream")).not.toBe(
      textKeyForFile("/same-url", "full")
    )
  })

  it("identifies stale text requests by request key", () => {
    const oldKey = textKeyForFile("/old.log", "stream")
    const newKey = textKeyForFile("/new.log", "stream")

    expect(isSameTextView(oldKey, oldKey)).toBe(true)
    expect(isSameTextView(newKey, oldKey)).toBe(false)
  })

  it("resolves CSV and TSV dialects", () => {
    expect(inferCsvDialect({ fileName: "data.csv" }).delimiter).toBe(",")
    expect(inferCsvDialect({ fileName: "data.tsv" }).delimiter).toBe("\t")
    expect(
      inferCsvDialect({
        fileName: "download",
        mimeType: "text/tab-separated-values",
      }).delimiter
    ).toBe("\t")
  })

  it("keeps HTML text loading independent from the Markdown adapter", () => {
    const source = readFileSync(
      "registry/new-york-v4/ui/file-viewer-html-viewer.tsx",
      "utf8"
    )

    expect(source).toContain("./file-viewer-text-resource")
    expect(source).not.toContain("./file-viewer-markdown-viewer")
  })

  it("keeps abort subscriptions in the neutral resource cache", () => {
    const textResourceSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-text-resource.ts",
      "utf8"
    )
    const textLoaderSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-text-loader.ts",
      "utf8"
    )

    expect(textResourceSource).not.toContain("./file-viewer-text-loader")
    expect(textResourceSource).toContain("subscribeToAbortableRequest")
    expect(textLoaderSource).toContain("subscribeToAbortableRequest")
  })
})

describe("FileViewer text cache", () => {
  it("evicts paired first-chunk and loader entries", async () => {
    const cache = createTextLoader(1)
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("content\n", { status: 206 })))
    )

    const first = textSubscription("/first.log")
    const second = textSubscription("/second.log")

    await cache.loadFirstChunk(first)
    expect(cache.snapshot(first.textKey)?.text).toBe("content\n")

    await cache.loadFirstChunk(second)
    expect(cache.snapshot(first.textKey)).toBeNull()
    expect(cache.snapshot(second.textKey)?.text).toBe("content\n")
  })

  it("removes failed first-chunk requests so retry can work", async () => {
    const cache = createTextLoader()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("nope", { status: 500 }))
      .mockResolvedValueOnce(response("ok\n", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const request = textSubscription("/retry.log", "full")

    await expect(cache.loadFirstChunk(request)).rejects.toThrow(
      "Failed to load file: 500"
    )
    expect(cache.size()).toBe(0)

    await expect(
      cache.loadFirstChunk(textSubscription("/retry.log", "full"))
    ).resolves.toMatchObject({
      text: "ok\n",
      done: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("uses byte counts, not UTF-16 string length, in full text mode", async () => {
    const cache = createTextLoader()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("é\n", { status: 200 })))
    )

    await expect(
      cache.loadFirstChunk(textSubscription("/unicode.json", "full"))
    ).resolves.toMatchObject({
      text: "é\n",
      bytesLoaded: 3,
      totalBytes: 3,
      done: true,
    })
  })

  it("does not cache aborted first-chunk requests", async () => {
    const cache = createTextLoader()
    const pending = deferred<Response>()
    let sharedFetchSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((_src: string, init?: RequestInit) => {
        sharedFetchSignal = init?.signal ?? undefined
        sharedFetchSignal?.addEventListener("abort", () => {
          pending.reject(new DOMException("Aborted", "AbortError"))
        })
        return pending.promise
      })
    )

    const request = textSubscription("/abort.log")
    const promise = cache.loadFirstChunk(request)
    request.controller.abort()

    await expect(promise).rejects.toMatchObject({ name: "AbortError" })
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true)
    expect(
      isAbortError(new DOMException("Quota exceeded", "QuotaExceededError"))
    ).toBe(false)
    expect(sharedFetchSignal?.aborted).toBe(true)
    expect(cache.size()).toBe(0)
  })

  it("does not abort a shared first chunk while another subscriber is active", async () => {
    const cache = createTextLoader()
    let fetchSignal: AbortSignal | undefined
    const pending = deferred<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn((_src: string, init?: RequestInit) => {
        fetchSignal = init?.signal ?? undefined
        return pending.promise
      })
    )

    const first = textSubscription("/shared.log")
    const second = textSubscription("/shared.log")
    const firstPromise = cache.loadFirstChunk(first)
    const secondPromise = cache.loadFirstChunk(second)

    first.controller.abort()
    await expect(firstPromise).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchSignal?.aborted).toBe(false)

    pending.resolve(response("shared\n", { status: 206 }))
    await expect(secondPromise).resolves.toMatchObject({ text: "shared\n" })
  })
})

describe("FileViewer text resources", () => {
  it("evicts failed text promises so callers can retry the same source", async () => {
    const cache = createTextResourceCache()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("nope", { status: 500 }))
      .mockResolvedValueOnce(response("ok\n", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(cache.load(textSubscription("/retry.txt"))).rejects.toThrow(
      "Failed to load file: 500"
    )
    await expect(cache.load(textSubscription("/retry.txt"))).resolves.toBe(
      "ok\n"
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("evicts failed Markdown render promises so callers can retry the same source", async () => {
    const markdownCache = createMarkdownHtmlCache()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("nope", { status: 500 }))
      .mockResolvedValueOnce(response("# Title\n", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      markdownCache.load(textSubscription("/retry.md"))
    ).rejects.toThrow("Failed to load file: 500")
    await expect(
      markdownCache.load(textSubscription("/retry.md"))
    ).resolves.toContain("<h1>Title</h1>")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("aborts a shared text resource fetch only after every subscriber aborts", async () => {
    const cache = createTextResourceCache()
    const pending = deferred<Response>()
    let fetchSignal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((_src: string, init?: RequestInit) => {
        fetchSignal = init?.signal ?? undefined
        fetchSignal?.addEventListener("abort", () => {
          pending.reject(new DOMException("Aborted", "AbortError"))
        })
        return pending.promise
      })
    )

    const first = textSubscription("/shared-resource.md")
    const second = textSubscription("/shared-resource.md")
    const firstPromise = cache.load(first)
    const secondPromise = cache.load(second)

    first.controller.abort()
    await expect(firstPromise).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchSignal?.aborted).toBe(false)

    second.controller.abort()
    await expect(secondPromise).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchSignal?.aborted).toBe(true)
    expect(cache.size()).toBe(0)
  })
})

describe("FileViewer text rendering", () => {
  it("keeps the download action in the toolbar for long filenames", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(response("content\n", { status: 206 })))
      )

      const longName = "very-long-file-name-that-should-truncate-in-toolbar.log"
      render(<FileViewer src="/long-name.log" fileName={longName} />)

      expect((await screen.findByTitle(longName)).className).toContain(
        "truncate"
      )
      expect(screen.getByRole("link", { name: "Download" })).toBeTruthy()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("aborts a pending first chunk when switching files", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const oldResponse = deferred<Response>()
      const fetchMock = vi.fn((src: string, init?: RequestInit) => {
        if (src === "/old.log") return oldResponse.promise
        return Promise.resolve(response("new\n", { status: 206 }))
      })
      vi.stubGlobal("fetch", fetchMock)

      const { rerender } = render(
        <FileViewer src="/old.log" fileName="old.log" />
      )

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      rerender(<FileViewer src="/new.log" fileName="new.log" />)

      await screen.findByTitle("new.log")

      const oldSignal = fetchMock.mock.calls[0]?.[1]?.signal
      expect(oldSignal?.aborted).toBe(true)

      oldResponse.resolve(response("old\n", { status: 206 }))
      await Promise.resolve()
      expect(screen.queryByText("old")).toBeNull()
    } finally {
      consoleError.mockRestore()
    }
  })

  it.each([
    { fileName: "old.md", nextFileName: "new.md", nextBody: "# New\n" },
    {
      fileName: "old.html",
      nextFileName: "new.html",
      nextBody: "<p>New</p>",
    },
  ])(
    "aborts a pending markup fetch when switching from $fileName",
    async ({ fileName, nextFileName, nextBody }) => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {})
      try {
        const oldResponse = deferred<Response>()
        let oldSignal: AbortSignal | undefined
        vi.stubGlobal(
          "fetch",
          vi.fn((src: string, init?: RequestInit) => {
            if (src.includes("old")) {
              oldSignal = init?.signal ?? undefined
              oldSignal?.addEventListener("abort", () => {
                oldResponse.reject(new DOMException("Aborted", "AbortError"))
              })
              return oldResponse.promise
            }
            return Promise.resolve(response(nextBody, { status: 200 }))
          })
        )

        const { rerender } = render(
          <FileViewer src={`/${fileName}`} fileName={fileName} />
        )

        await waitFor(() => expect(oldSignal).toBeTruthy())
        rerender(
          <FileViewer src={`/${nextFileName}`} fileName={nextFileName} />
        )

        await waitFor(() => expect(oldSignal?.aborted).toBe(true))
      } finally {
        consoleError.mockRestore()
      }
    }
  )

  it("keeps download access on load errors and recovers on descriptor change", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response("bad", { status: 500 }))
        .mockResolvedValueOnce(response("good\n", { status: 206 }))
      vi.stubGlobal("fetch", fetchMock)

      const { rerender } = render(
        <FileViewer src="/bad.log" fileName="bad.log" />
      )

      expect(await screen.findByText(/Could not load/)).toBeTruthy()
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download")
      ).toBe("bad.log")

      rerender(<FileViewer src="/good.log" fileName="good.log" />)

      expect(await screen.findByTitle("good.log")).toBeTruthy()
      expect(screen.queryByText(/Could not load/)).toBeNull()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("renders an unsupported fallback with a download link", () => {
    render(<FileViewer src="/archive.zip" fileName="archive.zip" />)

    expect(screen.getByText(/No preview for/)).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download")
    ).toBe("archive.zip")
  })
})
