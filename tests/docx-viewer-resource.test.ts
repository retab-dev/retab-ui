import { afterEach, describe, expect, it, vi } from "vitest"

import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  clearDocxResource,
  getDocxResource,
  resetDocxResourceCacheForTests,
} from "@/registry/new-york-v4/ui/docx-viewer-resource"

afterEach(() => {
  resetDocxResourceCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function docxUrlResource(url: string, fileName = "document.docx") {
  return createViewerResource({
    kind: "url",
    url,
    fileName,
  })
}

function docxBlobResource(bytes: Uint8Array, identityKey: string) {
  return createViewerResource(
    blobSource(bytes, {
      identityKey,
      fileName: "document.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
  )
}

function response(bytes: Uint8Array, init: ResponseInit = {}) {
  return new Response(new Uint8Array(bytes), init)
}

describe("docx-viewer-resource", () => {
  it("deduplicates document bytes for the same resource", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(response(Uint8Array.of(1, 2, 3), { status: 200 }))
    )
    vi.stubGlobal("fetch", fetchMock)

    const content = docxUrlResource("/document.docx").content
    const first = getDocxResource(content)
    const second = getDocxResource(content)

    expect(first).toBe(second)
    await expect(first).resolves.toHaveProperty("byteLength", 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/document.docx", {
      signal: undefined,
    })
  })

  it("shares document bytes across resources with the same load key", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(response(Uint8Array.of(1, 2, 3), { status: 200 }))
    )
    vi.stubGlobal("fetch", fetchMock)

    const firstResource = docxUrlResource("/same-bytes.docx", "a.docx")
    const secondResource = docxUrlResource("/same-bytes.docx", "renamed.docx")

    expect(firstResource.content).toBe(secondResource.content)

    const first = getDocxResource(firstResource.content)
    const second = getDocxResource(secondResource.content)

    expect(first).toBe(second)
    await expect(first).resolves.toHaveProperty("byteLength", 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("removes rejected document bytes so the same resource can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(Uint8Array.of(), { status: 500 }))
      .mockResolvedValueOnce(response(Uint8Array.of(4, 5), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const content = docxUrlResource("/retry.docx").content

    await expect(getDocxResource(content)).rejects.toMatchObject({
      kind: "http_error",
      status: 500,
    })
    await expect(getDocxResource(content)).resolves.toHaveProperty(
      "byteLength",
      2
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("can retain rejected document bytes for Suspense error boundaries", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(response(Uint8Array.of(), { status: 500 }))
    )
    vi.stubGlobal("fetch", fetchMock)

    const content = docxUrlResource("/retained-error.docx").content
    const first = getDocxResource(content, { retainRejected: true })

    await expect(first).rejects.toMatchObject({
      kind: "http_error",
      status: 500,
    })

    const second = getDocxResource(content, { retainRejected: true })
    expect(second).toBe(first)
    await expect(second).rejects.toMatchObject({
      kind: "http_error",
      status: 500,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("clears a retained rejected document so retry can load the same resource", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(Uint8Array.of(), { status: 500 }))
      .mockResolvedValueOnce(response(Uint8Array.of(8, 9), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const content = docxUrlResource("/clear-retry.docx").content

    await expect(
      getDocxResource(content, { retainRejected: true })
    ).rejects.toMatchObject({
      kind: "http_error",
      status: 500,
    })

    clearDocxResource(content)

    await expect(
      getDocxResource(content, { retainRejected: true })
    ).resolves.toHaveProperty("byteLength", 2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("loads Blob sources through the resource without fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const buffer = await getDocxResource(
      docxBlobResource(Uint8Array.of(7, 8, 9), "blob:docx").content
    )

    expect(new Uint8Array(buffer)).toEqual(Uint8Array.of(7, 8, 9))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
