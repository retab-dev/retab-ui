// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ResourceError,
  type ViewerFormatError,
} from "@/registry/new-york-v4/lib/viewer-errors"
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
  type ViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  __resetPdfDocumentCacheForTests,
  getDocumentResource,
  getPageResource,
  releaseDocumentResource,
  retainDocumentResource,
} from "@/registry/new-york-v4/ui/pdf-viewer-resource"

const pdfjsMock = vi.hoisted(() => ({
  docs: new Map<string, unknown>(),
  getDocument: vi.fn(),
  GlobalWorkerOptions: {} as { workerSrc?: string },
}))

vi.mock("pdfjs-dist", () => pdfjsMock)

function makeDoc() {
  return {
    numPages: 1,
    getPage: vi.fn((pageNumber: number) => Promise.resolve({ pageNumber })),
    destroy: vi.fn(() => Promise.resolve()),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  pdfjsMock.docs.clear()
  pdfjsMock.getDocument.mockImplementation(
    (input: string | { data: Uint8Array }) => {
      const key =
        typeof input === "string" ? input : `data:${input.data.join(",")}`
      const doc = pdfjsMock.docs.get(key)
      return {
        promise:
          doc instanceof Error ? Promise.reject(doc) : Promise.resolve(doc),
      }
    }
  )
  pdfjsMock.GlobalWorkerOptions.workerSrc = undefined
  __resetPdfDocumentCacheForTests()
})

afterEach(() => {
  __resetPdfDocumentCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function pdfUrlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName }
}

function pdfUrlResource(url: string, fileName?: string) {
  return createViewerResource(pdfUrlSource(url, fileName))
}

function pdfBlobResource(bytes: Uint8Array, identityKey: string) {
  return createViewerResource(
    blobSource(bytes, {
      identityKey,
      fileName: "local.pdf",
      mimeType: "application/pdf",
    })
  )
}

describe("pdf-viewer-resource", () => {
  it("deduplicates document loads for the same source", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/same.pdf", doc)

    const first = getDocumentResource(pdfUrlResource("/same.pdf"))
    const second = getDocumentResource(pdfUrlResource("/same.pdf"))

    await expect(first).resolves.toBe(doc)
    await expect(second).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1)
  })

  it("loads URL resources directly through PDF.js without fetching bytes first", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/direct.pdf", doc)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getDocumentResource(pdfUrlResource("/direct.pdf"))
    ).resolves.toBe(doc)

    expect(pdfjsMock.getDocument).toHaveBeenCalledWith("/direct.pdf")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shares URL document loads across metadata-only source changes", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/metadata-shared.pdf", doc)

    const first = getDocumentResource(
      pdfUrlResource("/metadata-shared.pdf", "first.pdf")
    )
    const second = getDocumentResource(
      pdfUrlResource("/metadata-shared.pdf", "second.pdf")
    )

    await expect(first).resolves.toBe(doc)
    await expect(second).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1)
  })

  it("shares Blob document loads across metadata-only source changes", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("data:4,5,6", doc)
    const bytes = Uint8Array.of(4, 5, 6)
    const blob = new Blob([bytes], { type: "application/pdf" })

    const first = getDocumentResource(
      createViewerResource(
        blobSource(blob, {
          identityKey: "same-blob",
          fileName: "first.pdf",
          mimeType: "application/pdf",
        })
      )
    )
    const second = getDocumentResource(
      createViewerResource(
        blobSource(blob, {
          identityKey: "same-blob",
          fileName: "second.pdf",
          mimeType: "application/pdf",
        })
      )
    )

    await expect(first).resolves.toBe(doc)
    await expect(second).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1)
  })

  it("does not evict retained documents when pruning the cache", async () => {
    const retainedDoc = makeDoc()
    pdfjsMock.docs.set("/retained.pdf", retainedDoc)
    const retainedResource = pdfUrlResource("/retained.pdf")
    await getDocumentResource(retainedResource)
    retainDocumentResource(retainedResource, retainedDoc as never)

    for (let index = 0; index < 6; index += 1) {
      pdfjsMock.docs.set(`/other-${index}.pdf`, makeDoc())
      await getDocumentResource(pdfUrlResource(`/other-${index}.pdf`))
    }
    await vi.runAllTimersAsync()

    expect(retainedDoc.destroy).not.toHaveBeenCalled()

    releaseDocumentResource(retainedResource, retainedDoc as never)
  })

  it("evicts a retained document after its final release", async () => {
    const retainedDoc = makeDoc()
    pdfjsMock.docs.set("/release-then-evict.pdf", retainedDoc)
    const retainedResource = pdfUrlResource("/release-then-evict.pdf")
    await getDocumentResource(retainedResource)
    retainDocumentResource(retainedResource, retainedDoc as never)
    releaseDocumentResource(retainedResource, retainedDoc as never)

    for (let index = 0; index < 6; index += 1) {
      pdfjsMock.docs.set(`/release-other-${index}.pdf`, makeDoc())
      await getDocumentResource(pdfUrlResource(`/release-other-${index}.pdf`))
    }
    await vi.runAllTimersAsync()

    expect(retainedDoc.destroy).toHaveBeenCalledTimes(1)
  })

  it("destroys unretained fulfilled documents when evicted", async () => {
    const firstDoc = makeDoc()
    pdfjsMock.docs.set("/doc-0.pdf", firstDoc)
    await getDocumentResource(pdfUrlResource("/doc-0.pdf"))

    for (let index = 1; index <= 6; index += 1) {
      pdfjsMock.docs.set(`/doc-${index}.pdf`, makeDoc())
      await getDocumentResource(pdfUrlResource(`/doc-${index}.pdf`))
    }
    await vi.runAllTimersAsync()

    expect(firstDoc.destroy).toHaveBeenCalledTimes(1)
  })

  it("removes rejected document loads so the same source can retry", async () => {
    pdfjsMock.docs.set("/retry-resource.pdf", new Error("load failed"))

    await expect(
      getDocumentResource(pdfUrlResource("/retry-resource.pdf"))
    ).rejects.toMatchObject({
      cause: expect.any(Error),
      format: "pdf",
      kind: "parse_failed",
    } satisfies Partial<ViewerFormatError>)

    const doc = makeDoc()
    pdfjsMock.docs.set("/retry-resource.pdf", doc)

    await expect(
      getDocumentResource(pdfUrlResource("/retry-resource.pdf"))
    ).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
  })

  it("loads Blob resources through PDF.js data without fetching a URL", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("data:1,2,3", doc)

    const resource = pdfBlobResource(Uint8Array.of(1, 2, 3), "blob:pdf")

    await expect(getDocumentResource(resource)).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledWith({
      data: Uint8Array.of(1, 2, 3),
    })
  })

  it("preserves ResourceError failures from non-direct resource reads", async () => {
    const error = new ResourceError({
      kind: "fetch_failed",
      message: "No bytes available.",
    })
    const resource = {
      cacheKey: "manual-resource-error",
      source: { kind: "url", url: "/manual-resource-error.pdf" },
      getDirectLoad: () => ({ kind: "none" as const }),
      readArrayBuffer: vi.fn(() => Promise.reject(error)),
    } as unknown as ViewerResource

    await expect(getDocumentResource(resource)).rejects.toBe(error)
  })

  it("deduplicates page loads per document and page number", async () => {
    const firstDoc = makeDoc()
    const secondDoc = makeDoc()

    const firstPage = getPageResource(firstDoc as never, 1)
    const duplicateFirstPage = getPageResource(firstDoc as never, 1)
    const secondPage = getPageResource(firstDoc as never, 2)
    const samePageDifferentDocument = getPageResource(secondDoc as never, 1)

    await expect(firstPage).resolves.toEqual({ pageNumber: 1 })
    await expect(duplicateFirstPage).resolves.toEqual({ pageNumber: 1 })
    await expect(secondPage).resolves.toEqual({ pageNumber: 2 })
    await expect(samePageDifferentDocument).resolves.toEqual({ pageNumber: 1 })

    expect(firstPage).toBe(duplicateFirstPage)
    expect(firstPage).not.toBe(secondPage)
    expect(firstPage).not.toBe(samePageDifferentDocument)
    expect(firstDoc.getPage).toHaveBeenCalledTimes(2)
    expect(secondDoc.getPage).toHaveBeenCalledTimes(1)
  })

  it("removes rejected page loads so the same page can retry", async () => {
    const doc = {
      getPage: vi
        .fn()
        .mockRejectedValueOnce(new Error("page failed"))
        .mockResolvedValueOnce({ pageNumber: 1 }),
    }

    await expect(getPageResource(doc as never, 1)).rejects.toThrow(
      "page failed"
    )
    await expect(getPageResource(doc as never, 1)).resolves.toEqual({
      pageNumber: 1,
    })
    expect(doc.getPage).toHaveBeenCalledTimes(2)
  })
})
