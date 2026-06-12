// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"

import { createMarkdownHtmlCache } from "@/registry/new-york-v4/ui/file-viewer-markdown-viewer"
import { type TextResourceCache } from "@/registry/new-york-v4/ui/file-viewer-text-resource"

function textSubscription(src: string) {
  const controller = new AbortController()
  return {
    src,
    signal: controller.signal,
    controller,
  }
}

function textCache(markdown: string): TextResourceCache {
  return {
    load: vi.fn(async () => markdown),
    clear() {},
    size() {
      return 0
    },
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

describe("file viewer markdown html", () => {
  it("renders GFM tables and sanitizes raw HTML", async () => {
    const cache = createMarkdownHtmlCache({
      textCache: textCache(
        [
          "# Statement",
          "",
          "| Item | Amount |",
          "| --- | ---: |",
          "| Cash | $10.00 |",
          "",
          '<script data-testid="xss">alert("xss")</script>',
          '<img src="x" onerror="alert(\'xss\')" />',
        ].join("\n")
      ),
    })

    const html = await cache.load(textSubscription("/statement.md"))

    expect(html).toContain("<h1>Statement</h1>")
    expect(html).toContain("<table>")
    expect(html).toContain("<td>Cash</td>")
    expect(html).not.toContain("<script")
    expect(html).not.toContain("onerror")
  })

  it("opens safe links out of process and strips unsafe hrefs", async () => {
    const cache = createMarkdownHtmlCache({
      textCache: textCache(
        "[Retab](https://retab.com) [Unsafe](javascript:alert('xss'))"
      ),
    })

    const html = await cache.load(textSubscription("/links.md"))
    const document = new DOMParser().parseFromString(html, "text/html")

    const safe = document.querySelector("a")
    expect(safe?.textContent).toBe("Retab")
    expect(safe?.getAttribute("href")).toBe("https://retab.com")
    expect(safe?.getAttribute("target")).toBe("_blank")
    expect(safe?.getAttribute("rel")).toBe("noopener noreferrer")

    const unsafe = Array.from(document.querySelectorAll("a")).find(
      (link) => link.textContent === "Unsafe"
    )
    expect(unsafe?.hasAttribute("href")).toBe(false)
  })

  it("does not start text loading for an already-aborted subscriber", async () => {
    const text = textCache("# Never loaded")
    const cache = createMarkdownHtmlCache({ textCache: text })
    const request = textSubscription("/aborted.md")

    request.controller.abort()

    await expect(cache.load(request)).rejects.toMatchObject({
      name: "AbortError",
    })
    expect(text.load).not.toHaveBeenCalled()
    expect(cache.size()).toBe(0)
  })

  it("drops an aborted pending subscriber so the same source can retry", async () => {
    const pending = deferred<string>()
    const load = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce("# Retry")
    const cache = createMarkdownHtmlCache({
      textCache: {
        load,
        clear() {},
        size() {
          return 0
        },
      },
    })
    const first = textSubscription("/retry-after-abort.md")
    const firstLoad = cache.load(first)

    first.controller.abort()

    await expect(firstLoad).rejects.toMatchObject({ name: "AbortError" })
    expect(cache.size()).toBe(0)

    pending.resolve("# Late result")

    await expect(
      cache.load(textSubscription("/retry-after-abort.md"))
    ).resolves.toContain("<h1>Retry</h1>")
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("drops failed text loads so the same source can retry", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("text load failed"))
      .mockResolvedValueOnce("# Loaded on retry")
    const cache = createMarkdownHtmlCache({
      textCache: {
        load,
        clear() {},
        size() {
          return 0
        },
      },
    })

    await expect(
      cache.load(textSubscription("/retry-after-failure.md"))
    ).rejects.toThrow("text load failed")
    expect(cache.size()).toBe(0)

    await expect(
      cache.load(textSubscription("/retry-after-failure.md"))
    ).resolves.toContain("<h1>Loaded on retry</h1>")
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("shares rendered html across subscribers for the same source", async () => {
    const load = vi.fn(async () => "# Shared")
    const cache = createMarkdownHtmlCache({
      textCache: {
        load,
        clear() {},
        size() {
          return 0
        },
      },
    })

    await expect(cache.load(textSubscription("/shared.md"))).resolves.toContain(
      "<h1>Shared</h1>"
    )
    await expect(cache.load(textSubscription("/shared.md"))).resolves.toContain(
      "<h1>Shared</h1>"
    )

    expect(load).toHaveBeenCalledTimes(1)
    expect(cache.size()).toBe(1)
  })

  it("shares an in-flight text load across concurrent subscribers", async () => {
    const pending = deferred<string>()
    const load = vi.fn(() => pending.promise)
    const cache = createMarkdownHtmlCache({
      textCache: {
        load,
        clear() {},
        size() {
          return 0
        },
      },
    })

    const first = cache.load(textSubscription("/concurrent.md"))
    const second = cache.load(textSubscription("/concurrent.md"))

    expect(load).toHaveBeenCalledTimes(1)

    pending.resolve("# Concurrent")

    await expect(first).resolves.toContain("<h1>Concurrent</h1>")
    await expect(second).resolves.toContain("<h1>Concurrent</h1>")
  })

  it("keeps a shared in-flight load alive until every subscriber aborts", async () => {
    const pending = deferred<string>()
    let textSignal: AbortSignal | undefined
    const load = vi.fn(({ signal }: { signal: AbortSignal }) => {
      textSignal = signal
      return pending.promise
    })
    const cache = createMarkdownHtmlCache({
      textCache: {
        load,
        clear() {},
        size() {
          return 0
        },
      },
    })
    const first = textSubscription("/shared-abort.md")
    const second = textSubscription("/shared-abort.md")
    const firstLoad = cache.load(first)
    const secondLoad = cache.load(second)

    first.controller.abort()

    await expect(firstLoad).rejects.toMatchObject({ name: "AbortError" })
    expect(textSignal?.aborted).toBe(false)

    pending.resolve("# Still loading")

    await expect(secondLoad).resolves.toContain("<h1>Still loading</h1>")
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("aborts a shared in-flight load after every subscriber aborts", async () => {
    const pending = deferred<string>()
    let textSignal: AbortSignal | undefined
    const load = vi.fn(({ signal }: { signal: AbortSignal }) => {
      if (!textSignal) {
        textSignal = signal
        signal.addEventListener("abort", () => {
          pending.reject(new DOMException("Aborted", "AbortError"))
        })
        return pending.promise
      }
      return Promise.resolve("# Retried")
    })
    const cache = createMarkdownHtmlCache({
      textCache: {
        load,
        clear() {},
        size() {
          return 0
        },
      },
    })
    const first = textSubscription("/all-abort.md")
    const second = textSubscription("/all-abort.md")
    const firstLoad = cache.load(first)
    const secondLoad = cache.load(second)

    first.controller.abort()
    await expect(firstLoad).rejects.toMatchObject({ name: "AbortError" })
    expect(textSignal?.aborted).toBe(false)

    second.controller.abort()
    await expect(secondLoad).rejects.toMatchObject({ name: "AbortError" })
    expect(textSignal?.aborted).toBe(true)
    expect(cache.size()).toBe(0)

    await expect(
      cache.load(textSubscription("/all-abort.md"))
    ).resolves.toContain("<h1>Retried</h1>")
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("aborts pending text loads when their markdown entry is evicted", async () => {
    let firstSignal: AbortSignal | undefined
    const firstPending = deferred<string>()
    const load = vi.fn(
      ({ src, signal }: { src: string; signal: AbortSignal }) => {
        if (src === "/first.md") {
          firstSignal = signal
          signal.addEventListener("abort", () => {
            firstPending.reject(new DOMException("Aborted", "AbortError"))
          })
          return firstPending.promise
        }
        return Promise.resolve("# Second")
      }
    )
    const cache = createMarkdownHtmlCache({
      maxEntries: 1,
      textCache: {
        load,
        clear() {},
        size() {
          return 0
        },
      },
    })

    const firstLoad = cache.load(textSubscription("/first.md"))
    await expect(cache.load(textSubscription("/second.md"))).resolves.toContain(
      "<h1>Second</h1>"
    )

    expect(firstSignal?.aborted).toBe(true)
    await expect(firstLoad).rejects.toMatchObject({ name: "AbortError" })
  })

  it("aborts pending text loads when the markdown cache is cleared", async () => {
    const pending = deferred<string>()
    let textSignal: AbortSignal | undefined
    const load = vi.fn(({ signal }: { signal: AbortSignal }) => {
      textSignal = signal
      signal.addEventListener("abort", () => {
        pending.reject(new DOMException("Aborted", "AbortError"))
      })
      return pending.promise
    })
    const cache = createMarkdownHtmlCache({
      textCache: {
        load,
        clear() {},
        size() {
          return 0
        },
      },
    })

    const firstLoad = cache.load(textSubscription("/clear.md"))
    cache.clear()

    expect(textSignal?.aborted).toBe(true)
    expect(cache.size()).toBe(0)
    await expect(firstLoad).rejects.toMatchObject({ name: "AbortError" })
  })
})
