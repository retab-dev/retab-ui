import { afterEach, describe, expect, it, vi } from "vitest"

import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  __resetDocxResourceCacheForTests,
  getDocxResource,
} from "@/registry/new-york-v4/ui/docx-viewer-resource"

afterEach(() => {
  __resetDocxResourceCacheForTests()
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

    const resource = docxUrlResource("/document.docx")
    const first = getDocxResource(resource)
    const second = getDocxResource(resource)

    expect(first).toBe(second)
    await expect(first).resolves.toHaveProperty("byteLength", 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/document.docx", {
      signal: undefined,
    })
  })

  it("removes rejected document bytes so the same resource can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(Uint8Array.of(), { status: 500 }))
      .mockResolvedValueOnce(response(Uint8Array.of(4, 5), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const resource = docxUrlResource("/retry.docx")

    await expect(getDocxResource(resource)).rejects.toMatchObject({
      kind: "http_error",
      status: 500,
    })
    await expect(getDocxResource(resource)).resolves.toHaveProperty(
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

    const resource = docxUrlResource("/retained-error.docx")
    const first = getDocxResource(resource, { retainRejected: true })

    await expect(first).rejects.toMatchObject({
      kind: "http_error",
      status: 500,
    })

    const second = getDocxResource(resource, { retainRejected: true })
    expect(second).toBe(first)
    await expect(second).rejects.toMatchObject({
      kind: "http_error",
      status: 500,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("loads Blob sources through the resource without fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const buffer = await getDocxResource(
      docxBlobResource(Uint8Array.of(7, 8, 9), "blob:docx")
    )

    expect(new Uint8Array(buffer)).toEqual(Uint8Array.of(7, 8, 9))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
