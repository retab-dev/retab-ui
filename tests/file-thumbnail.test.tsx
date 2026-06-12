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

import { ResourceError } from "@/lib/viewer-errors"
import {
  FileThumbnail,
  hasRenderablePreviewContent,
  resolveFileThumbnailState,
} from "@/components/ui/file-thumbnail"
import {
  DocumentThumbnail,
  getThumbnailCacheKey,
  getThumbnailRenderKey,
} from "@/components/document-thumbnail"
import {
  cachedThumbnailResource,
  createThumbnailArtifactCache,
  TEXT_THUMBNAIL_MAX_BYTES,
  withThumbnailFormatError,
  type ThumbnailCacheEntry,
} from "@/components/document-thumbnail/cache"
import { thumbnailOption } from "@/components/document-thumbnail/keys"
import { useObjectUrl } from "@/components/document-thumbnail/renderers/use-object-url"
import { createViewerResource } from "@/registry/new-york-v4/lib/viewer-resource"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("FileThumbnail helpers", () => {
  it("resolves explicit state before inferred preview state", () => {
    expect(
      resolveFileThumbnailState({
        explicitState: "loading",
        hasPreview: false,
      })
    ).toBe("loading")
  })

  it("resolves inferred loaded and error states", () => {
    expect(resolveFileThumbnailState({ hasPreview: true })).toBe("loaded")
    expect(resolveFileThumbnailState({ hasPreview: false })).toBe("error")
  })

  it("treats only nullish and false preview content as absent", () => {
    expect(hasRenderablePreviewContent(0)).toBe(true)
    expect(hasRenderablePreviewContent("")).toBe(true)
    expect(hasRenderablePreviewContent(<span />)).toBe(true)
    expect(hasRenderablePreviewContent(null)).toBe(false)
    expect(hasRenderablePreviewContent(undefined)).toBe(false)
    expect(hasRenderablePreviewContent(false)).toBe(false)
  })
})

describe("DocumentThumbnail helpers", () => {
  function resource(
    url: string,
    fileName = "same.txt",
    mimeType = "text/plain"
  ) {
    return createViewerResource({
      kind: "url",
      url,
      fileName,
      mimeType,
    })
  }

  it("builds stable thumbnail cache keys from resource identity", () => {
    const first = resource("/same.txt")
    const second = resource("/same.txt")

    expect(
      getThumbnailCacheKey({
        resource: first,
        descriptor: first.descriptor,
      })
    ).toBe(
      getThumbnailCacheKey({
        resource: second,
        descriptor: second.descriptor,
      })
    )
  })

  it("separates cache identity from render identity", () => {
    const file = resource("/same.txt")
    const cacheKey = getThumbnailCacheKey({
      resource: file,
      descriptor: file.descriptor,
    })

    expect(
      getThumbnailRenderKey({
        cacheKey,
        anchor: "top-left",
        retryKey: null,
      })
    ).not.toBe(
      getThumbnailRenderKey({
        cacheKey,
        anchor: "top-right",
        retryKey: null,
      })
    )
    expect(
      getThumbnailRenderKey({
        cacheKey,
        anchor: "top-left",
        retryKey: null,
      })
    ).not.toBe(
      getThumbnailRenderKey({
        cacheKey,
        anchor: "top-left",
        retryKey: 1,
      })
    )
  })

  it("distinguishes retry key primitive types and supports bigint keys", () => {
    const file = resource("/same.txt")
    const cacheKey = getThumbnailCacheKey({
      resource: file,
      descriptor: file.descriptor,
    })

    expect(
      getThumbnailRenderKey({
        cacheKey,
        anchor: "top-left",
        retryKey: "1",
      })
    ).not.toBe(
      getThumbnailRenderKey({
        cacheKey,
        anchor: "top-left",
        retryKey: 1,
      })
    )
    expect(() =>
      getThumbnailRenderKey({
        cacheKey,
        anchor: "top-left",
        retryKey: BigInt(1),
      })
    ).not.toThrow()
  })

  it("does not collide when fields contain delimiter-like characters", () => {
    const first = resource("a\u0000src:1")
    const second = resource("a")

    expect(
      getThumbnailCacheKey({
        resource: first,
        descriptor: first.descriptor,
      })
    ).not.toBe(
      getThumbnailCacheKey({
        resource: second,
        descriptor: second.descriptor,
      })
    )

    const cacheKey = getThumbnailCacheKey({
      resource: second,
      descriptor: second.descriptor,
    })
    expect(
      getThumbnailRenderKey({
        cacheKey: "4:kind:text",
        anchor: "top-left",
        retryKey: null,
      })
    ).not.toBe(
      getThumbnailRenderKey({
        cacheKey,
        anchor: "top-left",
        retryKey: "kind:text",
      })
    )
  })

  it("includes thumbnail output options in cache identity", () => {
    const file = resource("/same.txt")
    const base = getThumbnailCacheKey({
      resource: file,
      descriptor: file.descriptor,
      options: [thumbnailOption("text-max-bytes", TEXT_THUMBNAIL_MAX_BYTES)],
    })

    expect(base).not.toBe(
      getThumbnailCacheKey({
        resource: file,
        descriptor: file.descriptor,
        options: [
          thumbnailOption("text-max-bytes", TEXT_THUMBNAIL_MAX_BYTES + 1),
        ],
      })
    )
  })

  it("keeps rejected cache entries observable once before retrying", async () => {
    const cache = new Map<string, ThumbnailCacheEntry<string>>()
    const firstError = new Error("first failure")
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(firstError)
      .mockResolvedValueOnce("recovered")

    await expect(cachedThumbnailResource(cache, "same", load)).rejects.toBe(
      firstError
    )
    await expect(cachedThumbnailResource(cache, "same", load)).rejects.toBe(
      firstError
    )
    await expect(cachedThumbnailResource(cache, "same", load)).resolves.toBe(
      "recovered"
    )
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("bounds artifact caches and disposes evicted fulfilled values", async () => {
    const dispose = vi.fn()
    const first = { id: "first" }
    const second = { id: "second" }
    const cache = createThumbnailArtifactCache<{ id: string }>({
      maxEntries: 1,
      dispose,
    })

    await cachedThumbnailResource(cache, "first", async () => first)
    await cachedThumbnailResource(cache, "second", async () => second)

    expect(cache.size).toBe(1)
    expect(dispose).toHaveBeenCalledWith(first)
  })

  it("wraps format failures while preserving resource failures", async () => {
    await expect(
      withThumbnailFormatError(
        "xlsx",
        "parse_failed",
        "sheet.xlsx",
        "Failed to parse spreadsheet thumbnail",
        async () => {
          throw new Error("bad zip")
        }
      )
    ).rejects.toMatchObject({
      name: "ViewerFormatError",
      format: "xlsx",
      kind: "parse_failed",
    })

    const resourceError = new ResourceError({
      kind: "http_error",
      status: 500,
      message: "Nope",
    })

    await expect(
      withThumbnailFormatError(
        "xlsx",
        "parse_failed",
        "sheet.xlsx",
        "Failed to parse spreadsheet thumbnail",
        async () => {
          throw resourceError
        }
      )
    ).rejects.toBe(resourceError)
  })
})

describe("FileThumbnail", () => {
  const file = { name: "invoice.pdf", type: "application/pdf" }

  it("renders the shimmer while loading even when a preview exists", () => {
    const { container } = render(
      <FileThumbnail
        file={file}
        state="loading"
        previewContent={<span>preview</span>}
        previewImageUrl="/preview.png"
      />
    )

    expect(
      container.querySelector('[data-slot="file-thumbnail-shimmer"]')
    ).not.toBeNull()
    expect(screen.queryByText("preview")).toBeNull()
  })

  it("renders fallback for an errored image preview", () => {
    const { container } = render(
      <FileThumbnail file={file} state="error" previewImageUrl="/preview.png" />
    )

    expect(
      container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).not.toBeNull()
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText("pdf")).toBeTruthy()
  })

  it("renders fallback for errored custom preview content", () => {
    const { container } = render(
      <FileThumbnail
        file={file}
        state="error"
        previewContent={<span>custom preview</span>}
      />
    )

    expect(
      container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).not.toBeNull()
    expect(screen.queryByText("custom preview")).toBeNull()
  })

  it("prefers custom preview content over an image URL when loaded", () => {
    const { container } = render(
      <FileThumbnail
        file={file}
        previewContent={<span>custom preview</span>}
        previewImageUrl="/preview.png"
      />
    )

    expect(screen.getByText("custom preview")).toBeTruthy()
    expect(container.querySelector("img")).toBeNull()
  })

  it("renders numeric zero as custom preview content", () => {
    const { container } = render(
      <FileThumbnail file={file} previewContent={0} />
    )

    expect(screen.getByText("0")).toBeTruthy()
    expect(
      container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).toBeNull()
  })

  it("treats an empty string as intentional custom preview content", () => {
    const { container } = render(
      <FileThumbnail file={file} previewContent="" />
    )

    expect(
      container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("treats false preview content as absent", () => {
    const { container } = render(
      <FileThumbnail file={file} previewContent={false} />
    )

    expect(
      container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).not.toBeNull()
  })

  it("renders fallback when no preview is available", () => {
    const { container } = render(<FileThumbnail file={file} />)

    expect(
      container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).not.toBeNull()
    expect(screen.getByText("pdf")).toBeTruthy()
  })

  it("maps common MIME types to fallback extensions when the name has none", () => {
    render(
      <FileThumbnail
        file={{
          name: "uploaded-file",
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }}
      />
    )

    expect(screen.getByText("docx")).toBeTruthy()
  })

  it("passes wrapper props through and preserves explicit style aspect ratio", () => {
    const { container } = render(
      <FileThumbnail
        file={file}
        aria-label="Invoice preview"
        data-testid="invoice-thumbnail"
        data-slot="custom-slot"
        style={{ aspectRatio: "1 / 1" }}
      />
    )

    const root = screen.getByTestId("invoice-thumbnail")
    expect(root.getAttribute("aria-label")).toBe("Invoice preview")
    expect(root.getAttribute("data-slot")).toBe("file-thumbnail")
    expect((container.firstElementChild as HTMLElement).style.aspectRatio).toBe(
      "1 / 1"
    )
  })

  it("renders fallback when image loading fails", () => {
    const { container } = render(
      <FileThumbnail file={file} previewImageUrl="/preview.png" />
    )

    const img = container.querySelector("img")
    expect(img).not.toBeNull()
    fireEvent.error(img as HTMLImageElement)

    expect(
      container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).not.toBeNull()
  })

  it("marks cached images as loaded from the image ref path", async () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
      true
    )
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
      12
    )

    const { container } = render(
      <FileThumbnail file={file} previewImageUrl="/cached.png" />
    )

    await waitFor(() => {
      expect(container.querySelector("img")?.className).toContain("opacity-100")
    })
    expect(
      container.querySelector('[data-slot="file-thumbnail-shimmer"]')
    ).toBeNull()
  })

  it("renders explicit loaded state", () => {
    render(
      <FileThumbnail
        file={file}
        state="loaded"
        previewContent={<span>state wins</span>}
      />
    )

    expect(screen.getByText("state wins")).toBeTruthy()
  })

  it("renders a self-contained shimmer without style tags", () => {
    const { container } = render(<FileThumbnail file={file} state="loading" />)

    expect(container.querySelector("style")).toBeNull()
    expect(
      container.querySelector('[data-slot="file-thumbnail-shimmer-highlight"]')
    ).not.toBeNull()
  })
})

describe("FileThumbnail registry item", () => {
  it("ships only the dependency-free shell", () => {
    const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
      items: Array<{
        name: string
        files?: Array<{ path: string }>
        registryDependencies?: string[]
        dependencies?: string[]
      }>
    }
    const item = registry.items.find((entry) => entry.name === "file-thumbnail")

    expect(item?.files?.map((file) => file.path)).toEqual([
      "registry/new-york-v4/ui/file-thumbnail.tsx",
    ])
    expect(item?.registryDependencies).toEqual(["utils"])
    expect(item?.dependencies ?? []).toEqual([])
  })
})

describe("DocumentThumbnail renderers", () => {
  function ObjectUrlProbe({ blob }: { blob: Blob | null }) {
    const url = useObjectUrl(blob)
    return <span data-testid="object-url">{url}</span>
  }

  it("revokes object URLs when their blob owner unmounts", async () => {
    const createObjectURL = vi.fn(() => "blob:tiff-thumbnail")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })

    const view = render(<ObjectUrlProbe blob={new Blob(["tiff"])} />)

    await waitFor(() => {
      expect(screen.getByTestId("object-url").textContent).toBe(
        "blob:tiff-thumbnail"
      )
    })

    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tiff-thumbnail")
  })
})

describe("DocumentThumbnail", () => {
  async function renderAsync(ui: React.ReactElement) {
    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(ui)
    })
    return view
  }

  function urlTextSource(url: string, fileName: string) {
    return {
      kind: "url" as const,
      url,
      fileName,
      mimeType: "text/plain",
    }
  }

  it("renders direct URL images without fetching through a renderer", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(
      <DocumentThumbnail
        source={{
          kind: "url",
          url: "/page.png",
          fileName: "page.png",
          mimeType: "image/png",
        }}
      />
    )

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/page.png"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("renders inline text sources without fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await renderAsync(
      <DocumentThumbnail
        source={{
          kind: "text",
          text: "Inline source line",
          fileName: "inline.txt",
          mimeType: "text/plain",
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Inline source line")).toBeTruthy()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("renders blob text sources without fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await renderAsync(
      <DocumentThumbnail
        source={{
          kind: "blob",
          blob: new Blob(["Blob source line"], { type: "text/plain" }),
          identityKey: "blob-source-line",
          fileName: "blob.txt",
          mimeType: "text/plain",
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Blob source line")).toBeTruthy()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("renders the shared FileThumbnail fallback when a renderer fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    )

    const view = render(
      <DocumentThumbnail source={urlTextSource("/broken.txt", "broken.txt")} />
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(
        view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })
    expect(screen.getByText("txt")).toBeTruthy()
  })

  it("retries rendering after a failed source changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi.fn(async (input: string) => {
      if (input === "/broken-reset.txt") {
        return new Response("", { status: 500 })
      }

      return new Response("Recovered line", { status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const view = render(
      <DocumentThumbnail
        source={urlTextSource("/broken-reset.txt", "broken.txt")}
      />
    )

    await waitFor(() => {
      expect(
        view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })

    await act(async () => {
      view.rerender(
        <DocumentThumbnail
          source={urlTextSource("/working-reset.txt", "working.txt")}
        />
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Recovered line")).toBeTruthy()
    })
    expect(
      view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      "/working-reset.txt",
      expect.any(Object)
    )
  })

  it("retries the same source when retryKey changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    let shouldFail = true
    const fetchMock = vi.fn(async () =>
      shouldFail
        ? new Response("", { status: 500 })
        : new Response("Recovered same source", { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const view = render(
      <DocumentThumbnail
        source={urlTextSource("/same-retry.txt", "same.txt")}
        retryKey={0}
      />
    )

    await waitFor(() => {
      expect(
        view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })

    shouldFail = false
    await act(async () => {
      view.rerender(
        <DocumentThumbnail
          source={urlTextSource("/same-retry.txt", "same.txt")}
          retryKey={1}
        />
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Recovered same source")).toBeTruthy()
    })
    expect(
      view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).toBeNull()
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
