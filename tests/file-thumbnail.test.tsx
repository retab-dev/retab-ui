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
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  FileThumbnail,
  hasRenderablePreviewContent,
  resolveFileThumbnailState,
} from "@/components/ui/file-thumbnail"
import {
  DocumentThumbnail,
  getThumbnailResourceKey,
} from "@/components/document-thumbnail"
import { useObjectUrl } from "@/components/document-thumbnail/renderers/use-object-url"

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
  it("builds stable resource keys from the complete render identity", () => {
    expect(
      getThumbnailResourceKey({
        kind: "text",
        src: "/same.txt",
        anchor: "top-left",
        retryKey: null,
      })
    ).toBe(
      getThumbnailResourceKey({
        kind: "text",
        src: "/same.txt",
        anchor: "top-left",
        retryKey: null,
      })
    )
  })

  it("includes retryKey, kind, and anchor in the resource identity", () => {
    const base = {
      kind: "text" as const,
      src: "/same.txt",
      anchor: "top-left" as const,
      retryKey: null,
    }

    expect(getThumbnailResourceKey(base)).not.toBe(
      getThumbnailResourceKey({ ...base, retryKey: 1 })
    )
    expect(getThumbnailResourceKey(base)).not.toBe(
      getThumbnailResourceKey({ ...base, kind: "pdf" })
    )
    expect(getThumbnailResourceKey(base)).not.toBe(
      getThumbnailResourceKey({ ...base, anchor: "top-right" })
    )
  })

  it("distinguishes retry key primitive types and supports bigint keys", () => {
    const base = {
      kind: "text" as const,
      src: "/same.txt",
      anchor: "top-left" as const,
    }

    expect(getThumbnailResourceKey({ ...base, retryKey: "1" })).not.toBe(
      getThumbnailResourceKey({ ...base, retryKey: 1 })
    )
    expect(() =>
      getThumbnailResourceKey({ ...base, retryKey: BigInt(1) })
    ).not.toThrow()
  })

  it("does not collide when fields contain delimiter-like characters", () => {
    const base = {
      kind: "text" as const,
      anchor: "top-left" as const,
      retryKey: null,
    }

    expect(
      getThumbnailResourceKey({
        ...base,
        src: "a\u0000src:1",
      })
    ).not.toBe(
      getThumbnailResourceKey({
        ...base,
        src: "a",
        retryKey: "\u0000src:1",
      })
    )
    expect(
      getThumbnailResourceKey({
        ...base,
        src: "4:kind:text",
      })
    ).not.toBe(
      getThumbnailResourceKey({
        ...base,
        src: "kind:text",
      })
    )
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
  it("renders the shared FileThumbnail fallback when a renderer fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => "",
      }))
    )

    let container!: HTMLElement
    await act(async () => {
      container = render(
        <DocumentThumbnail
          kind="text"
          src="/broken.txt"
          name="broken.txt"
          type="text/plain"
        />
      ).container
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(
        container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })
    expect(screen.getByText("txt")).toBeTruthy()
  })

  it("retries rendering after a failed source changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetchMock = vi.fn(async (src: string) => {
      if (src === "/broken-reset.txt") {
        return {
          ok: false,
          status: 500,
          text: async () => "",
        }
      }

      return {
        ok: true,
        status: 200,
        text: async () => "Recovered line",
      }
    })
    vi.stubGlobal("fetch", fetchMock)

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <DocumentThumbnail
          kind="text"
          src="/broken-reset.txt"
          name="broken.txt"
          type="text/plain"
        />
      )
    })

    await waitFor(() => {
      expect(
        view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })

    await act(async () => {
      view.rerender(
        <DocumentThumbnail
          kind="text"
          src="/working-reset.txt"
          name="working.txt"
          type="text/plain"
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "Recovered same source",
      })
    vi.stubGlobal("fetch", fetchMock)

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <DocumentThumbnail
          kind="text"
          src="/same-retry.txt"
          name="same.txt"
          type="text/plain"
          retryKey={0}
        />
      )
    })

    await waitFor(() => {
      expect(
        view.container.querySelector('[data-slot="file-thumbnail-fallback"]')
      ).not.toBeNull()
    })

    await act(async () => {
      view.rerender(
        <DocumentThumbnail
          kind="text"
          src="/same-retry.txt"
          name="same.txt"
          type="text/plain"
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
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
