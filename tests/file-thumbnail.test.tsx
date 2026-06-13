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
import { DocumentThumbnail } from "@/components/document-thumbnail"
import {
  getThumbnailKey,
  getThumbnailRenderKey,
  thumbnailOption,
} from "@/components/document-thumbnail/keys"
import { useObjectUrl } from "@/components/document-thumbnail/renderers/use-object-url"
import {
  cachedThumbnailResource,
  createThumbnailArtifactCache,
  type ThumbnailCacheEntry,
} from "@/components/document-thumbnail/thumbnail-cache"
import { withThumbnailFormatError } from "@/components/document-thumbnail/thumbnail-errors"
import {
  TEXT_THUMBNAIL_CACHE_MAX_ENTRIES,
  TEXT_THUMBNAIL_MAX_BYTES,
} from "@/components/document-thumbnail/thumbnail-limits"
import { clearThumbnailCachesForTests } from "@/components/document-thumbnail/thumbnail-test-reset"
import {
  getThumbnailText,
  thumbnailFileMeta,
  type ThumbnailTextContent,
} from "@/components/document-thumbnail/thumbnail-text"
import { createViewerResource } from "@/registry/new-york-v4/lib/viewer-resource"

afterEach(() => {
  cleanup()
  clearThumbnailCachesForTests()
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

  it("keeps thumbnail live code on the canonical resource API", () => {
    const liveFiles = [
      "components/document-thumbnail.tsx",
      "components/document-thumbnail/thumbnail-cache.ts",
      "components/document-thumbnail/thumbnail-direct-image.tsx",
      "components/document-thumbnail/thumbnail-text.ts",
      "components/document-thumbnail/thumbnail-resource.ts",
      "components/document-thumbnail/descriptor.ts",
      "components/document-thumbnail/errors.tsx",
      "components/document-thumbnail/keys.ts",
      "components/document-thumbnail/types.ts",
      "components/document-thumbnail/renderers/csv-thumbnail.tsx",
      "components/document-thumbnail/renderers/docx-thumbnail.tsx",
      "components/document-thumbnail/renderers/html-thumbnail.tsx",
      "components/document-thumbnail/renderers/image-thumbnail.tsx",
      "components/document-thumbnail/renderers/markdown-thumbnail.tsx",
      "components/document-thumbnail/renderers/pdf-thumbnail.tsx",
      "components/document-thumbnail/renderers/pptx-thumbnail.tsx",
      "components/document-thumbnail/renderers/text-thumbnail.tsx",
      "components/document-thumbnail/renderers/tiff-thumbnail.tsx",
      "components/document-thumbnail/renderers/xlsx-thumbnail.tsx",
    ]
    const forbiddenNames = [
      "get" + "DirectLoad",
      "get" + "OriginalDownload",
      "get" + "InlineText",
      "get" + "Blob",
      "read" + "ArrayBuffer",
      "DirectLoad" + "Capability",
      "Download" + "Capability",
    ]
    const forbidden = new RegExp(
      `\\b(${forbiddenNames.join("|")})\\b|resource\\.str` + "eam\\("
    )

    for (const file of liveFiles) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(forbidden)
    }
  })

  it("keeps expensive thumbnail helpers on narrow content contracts", () => {
    const helperFiles = [
      "components/document-thumbnail/thumbnail-cache.ts",
      "components/document-thumbnail/thumbnail-text.ts",
      "components/document-thumbnail/renderers/markdown-thumbnail.tsx",
      "components/document-thumbnail/renderers/pptx-thumbnail.tsx",
      "components/document-thumbnail/renderers/tiff-thumbnail.tsx",
      "components/document-thumbnail/renderers/xlsx-thumbnail.tsx",
    ]
    const broadHelperSignatures = [
      "function getThumbnailText(\n  resource: ViewerResource",
      "function getMarkdownDoc(\n  resource: ViewerResource",
      "function getPptxFirstSlide(\n  resource: ViewerResource",
      "function getTiffFirstPageBlob(\n  resource: ViewerResource",
      "function getXlsxPreview(\n  resource: ViewerResource",
    ]
    const unboundedArtifactCache = "new Map<string, ThumbnailCacheEntry<"

    for (const file of helperFiles) {
      const source = readFileSync(file, "utf8")
      for (const signature of broadHelperSignatures) {
        expect(source, file).not.toContain(signature)
      }
    }
    for (const file of helperFiles.filter(
      (file) =>
        file !== "components/document-thumbnail/thumbnail-cache.ts" &&
        file !== "components/document-thumbnail/thumbnail-text.ts"
    )) {
      expect(readFileSync(file, "utf8"), file).not.toContain(
        unboundedArtifactCache
      )
    }
  })

  it("does not swallow async canvas renderer failures", () => {
    const files = [
      "components/document-thumbnail/renderers/pdf-thumbnail.tsx",
      "components/document-thumbnail/renderers/pptx-thumbnail.tsx",
    ]

    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toContain(".catch(() => {})")
    }
  })

  it("builds stable thumbnail cache keys from resource identity", () => {
    const first = resource("/same.txt")
    const second = resource("/same.txt")

    expect(
      getThumbnailKey({
        resource: first,
        descriptor: first.descriptor,
      })
    ).toBe(
      getThumbnailKey({
        resource: second,
        descriptor: second.descriptor,
      })
    )
  })

  it("keeps metadata-only URL changes on the same expensive cache identity", () => {
    const first = resource("/same.txt", "before.txt", "text/plain")
    const second = resource("/same.txt", "after.txt", "text/plain")

    expect(first.keys.load).toBe(second.keys.load)
    expect(first.keys.presentation).not.toBe(second.keys.presentation)
    expect(
      getThumbnailKey({
        resource: first,
        descriptor: first.descriptor,
        options: [thumbnailOption("text-max-bytes", TEXT_THUMBNAIL_MAX_BYTES)],
      })
    ).toBe(
      getThumbnailKey({
        resource: second,
        descriptor: second.descriptor,
        options: [thumbnailOption("text-max-bytes", TEXT_THUMBNAIL_MAX_BYTES)],
      })
    )
  })

  it("separates cache identity from render identity", () => {
    const file = resource("/same.txt")
    const thumbnailKey = getThumbnailKey({
      resource: file,
      descriptor: file.descriptor,
    })

    expect(
      getThumbnailRenderKey({
        thumbnailKey,
        anchor: "top-left",
        retryKey: null,
      })
    ).not.toBe(
      getThumbnailRenderKey({
        thumbnailKey,
        anchor: "top-right",
        retryKey: null,
      })
    )
    expect(
      getThumbnailRenderKey({
        thumbnailKey,
        anchor: "top-left",
        retryKey: null,
      })
    ).not.toBe(
      getThumbnailRenderKey({
        thumbnailKey,
        anchor: "top-left",
        retryKey: 1,
      })
    )
  })

  it("distinguishes retry key primitive types and supports bigint keys", () => {
    const file = resource("/same.txt")
    const thumbnailKey = getThumbnailKey({
      resource: file,
      descriptor: file.descriptor,
    })

    expect(
      getThumbnailRenderKey({
        thumbnailKey,
        anchor: "top-left",
        retryKey: "1",
      })
    ).not.toBe(
      getThumbnailRenderKey({
        thumbnailKey,
        anchor: "top-left",
        retryKey: 1,
      })
    )
    expect(() =>
      getThumbnailRenderKey({
        thumbnailKey,
        anchor: "top-left",
        retryKey: BigInt(1),
      })
    ).not.toThrow()
  })

  it("does not collide when fields contain delimiter-like characters", () => {
    const first = resource("a\u0000src:1")
    const second = resource("a")

    expect(
      getThumbnailKey({
        resource: first,
        descriptor: first.descriptor,
      })
    ).not.toBe(
      getThumbnailKey({
        resource: second,
        descriptor: second.descriptor,
      })
    )

    const thumbnailKey = getThumbnailKey({
      resource: second,
      descriptor: second.descriptor,
    })
    expect(
      getThumbnailRenderKey({
        thumbnailKey: "4:kind:text",
        anchor: "top-left",
        retryKey: null,
      })
    ).not.toBe(
      getThumbnailRenderKey({
        thumbnailKey,
        anchor: "top-left",
        retryKey: "kind:text",
      })
    )
  })

  it("includes thumbnail output options in cache identity", () => {
    const file = resource("/same.txt")
    const base = getThumbnailKey({
      resource: file,
      descriptor: file.descriptor,
      options: [thumbnailOption("text-max-bytes", TEXT_THUMBNAIL_MAX_BYTES)],
    })

    expect(base).not.toBe(
      getThumbnailKey({
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

  it("bounds artifact caches and disposes evicted resolved values", async () => {
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

  it("bounds the shared text thumbnail cache", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      return new Response(`body:${input}`, { status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const first = resource("/text-cache-0.txt")
    await getThumbnailText(
      thumbnailFileMeta(first),
      first.content,
      "text-cache-0"
    )

    for (let index = 1; index <= TEXT_THUMBNAIL_CACHE_MAX_ENTRIES; index += 1) {
      const file = resource(`/text-cache-${index}.txt`)
      await getThumbnailText(
        thumbnailFileMeta(file),
        file.content,
        `text-cache-${index}`
      )
    }

    await getThumbnailText(
      thumbnailFileMeta(first),
      first.content,
      "text-cache-0"
    )

    expect(fetchMock).toHaveBeenCalledTimes(
      TEXT_THUMBNAIL_CACHE_MAX_ENTRIES + 2
    )
  })

  it("loads thumbnail text from narrow content capabilities", async () => {
    const content: ThumbnailTextContent = {
      key: "narrow-text",
      sourceKind: "text",
      readRange: vi.fn(async () => ({
        buffer: new TextEncoder().encode("Narrow text").buffer as ArrayBuffer,
        isComplete: true,
      })),
      readStream: vi.fn(),
    }

    await expect(
      getThumbnailText(
        {
          fileName: "narrow.txt",
          mimeType: "text/plain",
          sourceKind: "text",
        },
        content,
        "narrow-text"
      )
    ).resolves.toBe("Narrow text")
    expect(content.readRange).toHaveBeenCalledWith({
      start: 0,
      end: TEXT_THUMBNAIL_MAX_BYTES - 1,
    })
    expect(content.readStream).not.toHaveBeenCalled()
  })

  it("falls back to a URL stream prefix when range loading is unavailable", async () => {
    const csv = "Region,Revenue\nEMEA,1250\n"
    const oversizedCsv = `${csv}${"Filler,1\n".repeat(9000)}`
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (headers.has("Range")) return new Response("", { status: 416 })
      return new Response(oversizedCsv, {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-length": String(
            new TextEncoder().encode(oversizedCsv).byteLength
          ),
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const file = resource("/fallback.csv", "fallback.csv", "text/csv")

    await expect(
      getThumbnailText(thumbnailFileMeta(file), file.content, "fallback-csv")
    ).resolves.toContain("EMEA")
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

  it("strips MIME parameters before deriving fallback extensions", () => {
    render(
      <FileThumbnail
        file={{
          name: "uploaded-file",
          type: "text/plain; charset=utf-8",
        }}
      />
    )

    expect(screen.getByText("txt")).toBeTruthy()
    expect(screen.queryByText("plain; charset=utf-8")).toBeNull()
  })

  it("strips URL paths, query strings, and fragments before deriving extensions", () => {
    render(
      <FileThumbnail
        file={{
          name: "https://example.com/files/invoice.PDF?download=1#page=1",
          type: "",
        }}
      />
    )

    expect(screen.getByText("pdf")).toBeTruthy()
    expect(screen.queryByText("pdf?download=1#page=1")).toBeNull()
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
    const onPreviewError = vi.fn()
    const { container } = render(
      <FileThumbnail
        file={file}
        previewImageUrl="/preview.png"
        onPreviewError={onPreviewError}
      />
    )

    const img = container.querySelector("img")
    expect(img).not.toBeNull()
    fireEvent.error(img as HTMLImageElement)

    expect(
      container.querySelector('[data-slot="file-thumbnail-fallback"]')
    ).not.toBeNull()
    expect(onPreviewError).toHaveBeenCalledTimes(1)
  })

  it("reports a fresh image failure after the preview URL changes", () => {
    const onPreviewError = vi.fn()
    const view = render(
      <FileThumbnail
        file={file}
        previewImageUrl="/first-broken.png"
        onPreviewError={onPreviewError}
      />
    )

    fireEvent.error(view.container.querySelector("img") as HTMLImageElement)
    expect(onPreviewError).toHaveBeenCalledTimes(1)

    view.rerender(
      <FileThumbnail
        file={file}
        previewImageUrl="/second-broken.png"
        onPreviewError={onPreviewError}
      />
    )

    const secondImage = view.container.querySelector("img") as HTMLImageElement
    expect(secondImage.getAttribute("src")).toBe("/second-broken.png")
    fireEvent.error(secondImage)
    expect(onPreviewError).toHaveBeenCalledTimes(2)
  })

  it("reports cached broken image previews once from the ref path", async () => {
    const onPreviewError = vi.fn()
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
      true
    )
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
      0
    )

    const { container } = render(
      <FileThumbnail
        file={file}
        previewImageUrl="/broken-cached.png"
        onPreviewError={onPreviewError}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })
    expect(container.querySelector("img")).toBeNull()
    expect(onPreviewError).toHaveBeenCalledTimes(1)
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

  it("remounts image previews and resets loading state when the URL changes", async () => {
    const view = render(
      <FileThumbnail file={file} previewImageUrl="/first.png" />
    )

    const firstImage = view.container.querySelector("img") as HTMLImageElement
    expect(firstImage).not.toBeNull()
    fireEvent.load(firstImage)

    await waitFor(() => {
      expect(firstImage.className).toContain("opacity-100")
    })

    view.rerender(<FileThumbnail file={file} previewImageUrl="/second.png" />)

    const secondImage = view.container.querySelector("img") as HTMLImageElement
    expect(secondImage).not.toBe(firstImage)
    expect(secondImage.getAttribute("src")).toBe("/second.png")
    expect(secondImage.className).toContain("opacity-0")
    expect(
      view.container.querySelector('[data-slot="file-thumbnail-shimmer"]')
    ).not.toBeNull()
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

  it("cancels shimmer animation on unmount", () => {
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ cancel }))
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    })
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const view = render(<FileThumbnail file={file} state="loading" />)

    expect(animate).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it("does not animate the shimmer when reduced motion is preferred", () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }))
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    })
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const { container } = render(<FileThumbnail file={file} state="loading" />)
    const highlight = container.querySelector(
      '[data-slot="file-thumbnail-shimmer-highlight"]'
    ) as HTMLElement

    expect(animate).not.toHaveBeenCalled()
    expect(highlight.style.backgroundPosition).toBe("50% 0px")
  })

  it("supports legacy reduced-motion media query listeners", () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addListener,
      removeListener,
    }))

    const view = render(<FileThumbnail file={file} state="loading" />)

    expect(addListener).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(removeListener).toHaveBeenCalledTimes(1)
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
      "registry/new-york-v4/ui/file-thumbnail-types.ts",
      "registry/new-york-v4/ui/file-thumbnail-extension.ts",
      "registry/new-york-v4/ui/file-thumbnail-fallback.tsx",
      "registry/new-york-v4/ui/file-thumbnail-shimmer.tsx",
      "registry/new-york-v4/ui/file-thumbnail-image.tsx",
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

  function installIntersectionObserver() {
    const observers: Array<{
      callback: IntersectionObserverCallback
      observe: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
      options?: IntersectionObserverInit
    }> = []

    class TestIntersectionObserver {
      observe = vi.fn()
      disconnect = vi.fn()
      readonly callback: IntersectionObserverCallback
      readonly options?: IntersectionObserverInit

      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        this.callback = callback
        this.options = options
        observers.push(this)
      }
    }

    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver)

    return {
      observers,
      async trigger(index: number, isIntersecting: boolean) {
        const observer = observers[index]
        if (!observer) throw new Error(`Missing observer ${index}`)
        await act(async () => {
          observer.callback(
            [
              {
                isIntersecting,
              } as IntersectionObserverEntry,
            ],
            observer as unknown as IntersectionObserver
          )
        })
      },
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

  it("defers document renderer work until the thumbnail enters view", async () => {
    const intersection = installIntersectionObserver()
    const fetchMock = vi.fn(
      async () => new Response("Visible line", { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const view = render(
      <DocumentThumbnail source={urlTextSource("/lazy.txt", "lazy.txt")} />
    )

    await waitFor(() => {
      expect(intersection.observers).toHaveLength(1)
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      view.container.querySelector('[data-slot="file-thumbnail-shimmer"]')
    ).not.toBeNull()
    expect(intersection.observers[0]?.options?.rootMargin).toBe("300px")

    await intersection.trigger(0, false)
    expect(fetchMock).not.toHaveBeenCalled()

    await intersection.trigger(0, true)

    await waitFor(() => {
      expect(screen.getByText("Visible line")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(intersection.observers[0]?.disconnect).toHaveBeenCalledTimes(1)
  })

  it("surfaces direct URL image failures through canonical thumbnail errors", async () => {
    const onError = vi.fn()
    const { container } = render(
      <DocumentThumbnail
        source={{
          kind: "url",
          url: "/broken-image.png",
          fileName: "broken-image.png",
          mimeType: "image/png",
        }}
        onError={onError}
      />
    )

    const img = container.querySelector("img")
    expect(img).not.toBeNull()
    fireEvent.error(img as HTMLImageElement)

    await waitFor(() => {
      expect(
        container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })

    const thumbnail = container.querySelector('[data-slot="file-thumbnail"]')
    expect(thumbnail?.getAttribute("aria-label")).toBe(
      "Couldn't load this image."
    )
    expect(thumbnail?.getAttribute("title")).toBe("Couldn't load this image.")
    expect(thumbnail?.getAttribute("data-error-domain")).toBe("format")
    expect(thumbnail?.getAttribute("data-error-format")).toBe("image")
    expect(thumbnail?.getAttribute("data-error-kind")).toBe("load_failed")
    expect(thumbnail?.getAttribute("data-error-message")).toBe(
      "Could not load image preview."
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      name: "ViewerFormatError",
      format: "image",
      kind: "load_failed",
    })
    expect(onError.mock.calls[0]?.[1]).toMatchObject({
      domain: "format",
      format: "image",
      kind: "load_failed",
      userMessage: "Couldn't load this image.",
    })
  })

  it("clears direct URL image error state when retryKey changes", async () => {
    const onError = vi.fn()
    const view = render(
      <DocumentThumbnail
        source={{
          kind: "url",
          url: "/retry-image.png",
          fileName: "retry-image.png",
          mimeType: "image/png",
        }}
        retryKey={0}
        onError={onError}
      />
    )

    fireEvent.error(view.container.querySelector("img") as HTMLImageElement)

    await waitFor(() => {
      expect(
        view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })
    expect(
      view.container
        .querySelector('[data-slot="file-thumbnail"]')
        ?.getAttribute("data-error-kind")
    ).toBe("load_failed")

    view.rerender(
      <DocumentThumbnail
        source={{
          kind: "url",
          url: "/retry-image.png",
          fileName: "retry-image.png",
          mimeType: "image/png",
        }}
        retryKey={1}
        onError={onError}
      />
    )

    const thumbnail = view.container.querySelector(
      '[data-slot="file-thumbnail"]'
    )
    expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
      "/retry-image.png"
    )
    expect(thumbnail?.getAttribute("data-error-kind")).toBeNull()
    expect(thumbnail?.getAttribute("aria-label")).toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it("renders homepage CSV thumbnails when the server returns an invalid range response", async () => {
    const csv = "Region,Revenue\nEMEA,1250\nNA,980\n"
    const oversizedCsv = `${csv}${"Filler,1\n".repeat(9000)}`
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (headers.has("Range")) {
        return new Response("Region,Revenue\n", {
          status: 206,
          headers: {
            "content-range": "bytes 0-65535/32",
          },
        })
      }
      return new Response(oversizedCsv, {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-length": String(
            new TextEncoder().encode(oversizedCsv).byteLength
          ),
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderAsync(
      <DocumentThumbnail
        source={{
          kind: "url",
          url: "/samples/sales.csv",
          fileName: "sales.csv",
          mimeType: "text/csv",
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Region")).toBeTruthy()
      expect(screen.getByText("EMEA")).toBeTruthy()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Range: `bytes=0-${TEXT_THUMBNAIL_MAX_BYTES - 1}` },
    })
    expect(fetchMock.mock.calls[1]?.[1]).toBeDefined()
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has("Range")
    ).toBe(false)
  })

  it("renders homepage CSV thumbnails when the server rejects range requests", async () => {
    const csv = "Region,Revenue\nEMEA,1250\nNA,980\n"
    const oversizedCsv = `${csv}${"Filler,1\n".repeat(9000)}`
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (headers.has("Range")) {
        return new Response("", { status: 416 })
      }
      return new Response(oversizedCsv, {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-length": String(
            new TextEncoder().encode(oversizedCsv).byteLength
          ),
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderAsync(
      <DocumentThumbnail
        source={{
          kind: "url",
          url: "/samples/sales.csv",
          fileName: "sales.csv",
          mimeType: "text/csv",
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Region")).toBeTruthy()
      expect(screen.getByText("EMEA")).toBeTruthy()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Range: `bytes=0-${TEXT_THUMBNAIL_MAX_BYTES - 1}` },
    })
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has("Range")
    ).toBe(false)
  })

  it("surfaces Blob image object URL failures through canonical thumbnail errors", async () => {
    const onError = vi.fn()
    const OriginalURL = globalThis.URL
    vi.stubGlobal("URL", {
      ...OriginalURL,
      createObjectURL: vi.fn(() => "blob:broken-image"),
      revokeObjectURL: vi.fn(),
    })

    const view = await renderAsync(
      <DocumentThumbnail
        source={{
          kind: "blob",
          blob: new Blob(["not an image"], { type: "image/png" }),
          identityKey: "broken-blob-image",
          fileName: "broken-blob.png",
          mimeType: "image/png",
        }}
        onError={onError}
      />
    )

    await waitFor(() => {
      expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
        "blob:broken-image"
      )
    })

    fireEvent.error(view.container.querySelector("img") as HTMLImageElement)

    await waitFor(() => {
      expect(
        view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })

    const thumbnail = view.container.querySelector(
      '[data-slot="file-thumbnail"]'
    )
    expect(thumbnail?.getAttribute("data-error-domain")).toBe("format")
    expect(thumbnail?.getAttribute("data-error-format")).toBe("image")
    expect(thumbnail?.getAttribute("data-error-kind")).toBe("load_failed")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      name: "ViewerFormatError",
      format: "image",
      kind: "load_failed",
    })
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

  it("renders large inline text sources as a prefix instead of an error", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await renderAsync(
      <DocumentThumbnail
        source={{
          kind: "text",
          text: `Prefix survives\n${"x".repeat(TEXT_THUMBNAIL_MAX_BYTES + 1)}`,
          fileName: "large-inline.txt",
          mimeType: "text/plain",
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Prefix survives")).toBeTruthy()
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

  it("surfaces canonical thumbnail errors through user-safe output and onError", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    )
    const onError = vi.fn()

    const view = render(
      <DocumentThumbnail
        source={urlTextSource("/metadata-error.txt", "metadata.txt")}
        onError={onError}
      />
    )

    await waitFor(() => {
      expect(
        view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })

    const thumbnail = view.container.querySelector(
      '[data-slot="file-thumbnail"]'
    )
    expect(thumbnail?.getAttribute("aria-label")).toBe(
      "Failed to load file: 500."
    )
    expect(thumbnail?.getAttribute("title")).toBe("Failed to load file: 500.")
    expect(thumbnail?.getAttribute("data-error-domain")).toBe("resource")
    expect(thumbnail?.getAttribute("data-error-format")).toBe("text")
    expect(thumbnail?.getAttribute("data-error-kind")).toBe("http_error")
    expect(thumbnail?.getAttribute("data-error-message")).toBe(
      "Failed to load resource: 500"
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      name: "ResourceError",
      kind: "http_error",
      status: 500,
    })
    expect(onError.mock.calls[0]?.[1]).toMatchObject({
      domain: "resource",
      format: "text",
      kind: "http_error",
      userMessage: "Failed to load file: 500.",
    })
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

  it("disconnects stale viewport observers when an unseen source changes", async () => {
    const intersection = installIntersectionObserver()
    const fetchMock = vi.fn(async (input: string) => {
      return new Response(`Loaded ${input}`, { status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const view = render(
      <DocumentThumbnail
        source={urlTextSource("/first-lazy.txt", "first.txt")}
      />
    )

    await waitFor(() => {
      expect(intersection.observers).toHaveLength(1)
    })

    view.rerender(
      <DocumentThumbnail
        source={urlTextSource("/second-lazy.txt", "second.txt")}
      />
    )

    await waitFor(() => {
      expect(intersection.observers).toHaveLength(2)
    })

    expect(intersection.observers[0]?.disconnect).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()

    await intersection.trigger(1, true)

    await waitFor(() => {
      expect(screen.getByText("Loaded /second-lazy.txt")).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/second-lazy.txt",
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
