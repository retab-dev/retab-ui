// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import * as React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { inferCsvDialect } from "@/lib/csv"
import { createViewerResource } from "@/lib/viewer-resource"
import * as FileViewerModule from "@/registry/new-york-v4/ui/file-viewer"
import { FileViewer } from "@/registry/new-york-v4/ui/file-viewer"
import { isAbortError } from "@/registry/new-york-v4/ui/file-viewer-async"
import {
  descriptorResetKey,
  detectCategory,
  resolveFileDescriptor,
} from "@/registry/new-york-v4/ui/file-viewer-core"
import { createMarkdownHtmlCache } from "@/registry/new-york-v4/ui/file-viewer-markdown-viewer"
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

function urlSource(url: string, fileName?: string, mimeType?: string) {
  return { kind: "url" as const, url, fileName, mimeType }
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
      source: urlSource("/files/signed?id=1", "report.pdf", "text/plain"),
    })

    expect(descriptor).toEqual({
      source: {
        kind: "url",
        url: "/files/signed?id=1",
        fileName: "report.pdf",
        mimeType: "text/plain",
      },
      displayName: "report.pdf",
      fileName: "report.pdf",
      identityKey: "url:/files/signed?id=1",
      mimeType: "text/plain",
      category: "pdf",
    })
    expect(
      createViewerResource(
        urlSource("/files/signed?id=1", "report.pdf", "text/plain")
      ).getDirectLoad()
    ).toEqual({ kind: "url", url: "/files/signed?id=1" })
    expect(descriptorResetKey(descriptor)).toBe(
      "url:/files/signed?id=1\u0000report.pdf\u0000text/plain\u0000pdf"
    )

    expect(
      resolveFileDescriptor({
        source: urlSource("/files/export", undefined, "text/csv"),
        as: "text",
      })
    ).toMatchObject({
      displayName: "/files/export",
      fileName: "export",
      category: "text",
    })
  })

  it("resolves non-url text sources without inventing load capabilities", () => {
    const source = {
      kind: "text" as const,
      text: "inline content",
      fileName: "inline.log",
    }
    const descriptor = resolveFileDescriptor({
      source,
    })

    expect(descriptor).toMatchObject({
      category: "text",
      displayName: "inline.log",
      fileName: "inline.log",
    })
    expect(descriptor.identityKey).toBe("text:inline content")
    expect(createViewerResource(source).getDirectLoad()).toEqual({
      kind: "none",
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

  it("routes Blob DOCX sources through the canonical source viewer", () => {
    const source = readFileSync(
      "registry/new-york-v4/ui/file-viewer.tsx",
      "utf8"
    )

    expect(source).toContain(
      'category === "docx" && descriptor.source.kind === "blob"'
    )
    expect(source).toContain(
      "<DocxViewer\n          source={descriptor.source}"
    )
  })

  it("keeps public runtime exports minimal", () => {
    expect(Object.keys(FileViewerModule)).toEqual(["FileViewer"])
  })

  it("keeps abort subscriptions in the neutral async module", () => {
    const asyncSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-async.ts",
      "utf8"
    )
    const resourceCacheSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-resource-cache.ts",
      "utf8"
    )
    const textResourceSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-text-resource.ts",
      "utf8"
    )
    const textLoaderSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer-text-loader.ts",
      "utf8"
    )

    expect(asyncSource).toContain("subscribeToAbortableRequest")
    expect(resourceCacheSource).not.toContain("AbortController")
    expect(resourceCacheSource).not.toContain("subscribeToAbortableRequest")
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

  it("returns a stable Markdown promise for the same source and signal", async () => {
    const markdownCache = createMarkdownHtmlCache({
      textCache: {
        load: vi.fn(async () => "# Title\n"),
        clear() {},
        size() {
          return 0
        },
      },
    })
    const request = textSubscription("/same.md")

    const firstPromise = markdownCache.load(request)
    const secondPromise = markdownCache.load(request)

    expect(secondPromise).toBe(firstPromise)
    await expect(firstPromise).resolves.toContain("<h1>Title</h1>")
  })

  it("drops Markdown subscriber state when a source is evicted", async () => {
    const markdownCache = createMarkdownHtmlCache({
      maxEntries: 1,
      textCache: {
        load: vi.fn(async ({ src }) => `# ${src}\n`),
        clear() {},
        size() {
          return 0
        },
      },
    })
    const first = textSubscription("/first.md")
    const second = textSubscription("/second.md")

    const firstPromise = markdownCache.load(first)
    await expect(firstPromise).resolves.toContain("<h1>/first.md</h1>")
    expect(markdownCache.size()).toBe(1)

    await expect(markdownCache.load(second)).resolves.toContain(
      "<h1>/second.md</h1>"
    )
    expect(markdownCache.size()).toBe(1)

    const firstAfterEviction = markdownCache.load(first)
    expect(firstAfterEviction).not.toBe(firstPromise)
    await expect(firstAfterEviction).resolves.toContain("<h1>/first.md</h1>")
    expect(markdownCache.size()).toBe(1)
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
  it("loads and renders text content under React StrictMode", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            response("first log line\nsecond log line\n", { status: 206 })
          )
        )
      )

      render(
        <React.StrictMode>
          <FileViewer source={urlSource("/strict.log", "strict.log")} />
        </React.StrictMode>
      )

      expect(await screen.findByText("first log line")).toBeTruthy()
      expect(screen.getByText("second log line")).toBeTruthy()
      expect(screen.getByText("2 lines")).toBeTruthy()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("keeps the download action in the toolbar for long filenames", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(response("content\n", { status: 206 })))
      )

      const longName = "very-long-file-name-that-should-truncate-in-toolbar.log"
      render(<FileViewer source={urlSource("/long-name.log", longName)} />)

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
        <FileViewer source={urlSource("/old.log", "old.log")} />
      )

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      rerender(<FileViewer source={urlSource("/new.log", "new.log")} />)

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
          <FileViewer source={urlSource(`/${fileName}`, fileName)} />
        )

        await waitFor(() => expect(oldSignal).toBeTruthy())
        rerender(
          <FileViewer source={urlSource(`/${nextFileName}`, nextFileName)} />
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
        <FileViewer source={urlSource("/bad.log", "bad.log")} />
      )

      expect(await screen.findByText("Couldn't load this file.")).toBeTruthy()
      expect(screen.getByRole("alert").getAttribute("data-error-message")).toBe(
        "Failed to load file: 500"
      )
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download")
      ).toBe("bad.log")

      rerender(<FileViewer source={urlSource("/good.log", "good.log")} />)

      expect(await screen.findByTitle("good.log")).toBeTruthy()
      expect(screen.queryByText("Couldn't load this file.")).toBeNull()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("renders an unsupported fallback with a download link", () => {
    render(<FileViewer source={urlSource("/archive.zip", "archive.zip")} />)

    expect(screen.getByText(/No preview for/)).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download")
    ).toBe("archive.zip")
  })
})
