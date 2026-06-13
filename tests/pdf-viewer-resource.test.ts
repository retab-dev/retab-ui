// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearPdfDocumentResource,
  getPdfDocumentResource,
  getPdfPageResource,
  readPdfDocumentResource,
  readPdfPageResource,
  releasePdfDocumentResource,
  resetPdfDocumentResourceCacheForTests,
  retainPdfDocumentResource,
} from "@/lib/pdf-document-resource"
import {
  ResourceError,
  type ViewerFormatError,
} from "@/registry/new-york-v4/lib/viewer-errors"
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
  type ViewerContentBytes,
  type ViewerContentDirectUrl,
} from "@/registry/new-york-v4/lib/viewer-resource"

const pdfjsMock = vi.hoisted(() => {
  type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (reason?: unknown) => void
  }
  const deferred = <T>(): Deferred<T> => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  return {
    docs: new Map<string, unknown>(),
    pending: new Map<string, Deferred<unknown>>(),
    deferred,
    getDocument: vi.fn(),
    GlobalWorkerOptions: {} as { workerSrc?: string },
  }
})

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
  pdfjsMock.pending.clear()
  pdfjsMock.getDocument.mockImplementation(
    (input: string | { data: Uint8Array }) => {
      const key =
        typeof input === "string" ? input : `data:${input.data.join(",")}`
      if (!pdfjsMock.docs.has(key)) {
        let pending = pdfjsMock.pending.get(key)
        if (!pending) {
          pending = pdfjsMock.deferred()
          pdfjsMock.pending.set(key, pending)
        }
        return { promise: pending.promise }
      }
      const doc = pdfjsMock.docs.get(key)
      return {
        promise:
          doc instanceof Error ? Promise.reject(doc) : Promise.resolve(doc),
      }
    }
  )
  pdfjsMock.GlobalWorkerOptions.workerSrc = undefined
  resetPdfDocumentResourceCacheForTests()
})

afterEach(() => {
  resetPdfDocumentResourceCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function pdfUrlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName }
}

function pdfUrlContent(url: string, fileName?: string) {
  return createViewerResource(pdfUrlSource(url, fileName)).content
}

function pdfBlobContent(bytes: Uint8Array, identityKey: string) {
  return createViewerResource(
    blobSource(bytes, {
      identityKey,
      fileName: "local.pdf",
      mimeType: "application/pdf",
    })
  ).content
}

describe("pdf-document-resource", () => {
  it("sets the PDF.js worker URL once and preserves an existing worker override", async () => {
    const firstDoc = makeDoc()
    const secondDoc = makeDoc()
    pdfjsMock.docs.set("/worker-default.pdf", firstDoc)
    pdfjsMock.docs.set("/worker-custom.pdf", secondDoc)

    await expect(
      getPdfDocumentResource(pdfUrlContent("/worker-default.pdf"))
    ).resolves.toBe(firstDoc)
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toContain(
      "pdf.worker.min.mjs"
    )

    resetPdfDocumentResourceCacheForTests()
    pdfjsMock.GlobalWorkerOptions.workerSrc = "/custom-worker.mjs"

    await expect(
      getPdfDocumentResource(pdfUrlContent("/worker-custom.pdf"))
    ).resolves.toBe(secondDoc)
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toBe("/custom-worker.mjs")
  })

  it("reinitializes PDF.js worker setup after the test cache reset", async () => {
    const firstDoc = makeDoc()
    const secondDoc = makeDoc()
    pdfjsMock.docs.set("/worker-reset-first.pdf", firstDoc)
    pdfjsMock.docs.set("/worker-reset-second.pdf", secondDoc)

    await expect(
      getPdfDocumentResource(pdfUrlContent("/worker-reset-first.pdf"))
    ).resolves.toBe(firstDoc)
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toContain(
      "pdf.worker.min.mjs"
    )

    resetPdfDocumentResourceCacheForTests()
    pdfjsMock.GlobalWorkerOptions.workerSrc = undefined

    await expect(
      getPdfDocumentResource(pdfUrlContent("/worker-reset-second.pdf"))
    ).resolves.toBe(secondDoc)
    expect(pdfjsMock.GlobalWorkerOptions.workerSrc).toContain(
      "pdf.worker.min.mjs"
    )
  })

  it("deduplicates document loads for the same source", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/same.pdf", doc)

    const first = getPdfDocumentResource(pdfUrlContent("/same.pdf"))
    const second = getPdfDocumentResource(pdfUrlContent("/same.pdf"))

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
      getPdfDocumentResource(pdfUrlContent("/direct.pdf"))
    ).resolves.toBe(doc)

    expect(pdfjsMock.getDocument).toHaveBeenCalledWith("/direct.pdf")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shares URL document loads across metadata-only source changes", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/metadata-shared.pdf", doc)

    const first = getPdfDocumentResource(
      pdfUrlContent("/metadata-shared.pdf", "first.pdf")
    )
    const second = getPdfDocumentResource(
      pdfUrlContent("/metadata-shared.pdf", "second.pdf")
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

    const first = getPdfDocumentResource(
      createViewerResource(
        blobSource(blob, {
          identityKey: "same-blob",
          fileName: "first.pdf",
          mimeType: "application/pdf",
        })
      ).content
    )
    const second = getPdfDocumentResource(
      createViewerResource(
        blobSource(blob, {
          identityKey: "same-blob",
          fileName: "second.pdf",
          mimeType: "application/pdf",
        })
      ).content
    )

    await expect(first).resolves.toBe(doc)
    await expect(second).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1)
  })

  it("does not evict retained documents when pruning the cache", async () => {
    const retainedDoc = makeDoc()
    pdfjsMock.docs.set("/retained.pdf", retainedDoc)
    const retainedContent = pdfUrlContent("/retained.pdf")
    await getPdfDocumentResource(retainedContent)
    retainPdfDocumentResource(retainedContent, retainedDoc as never)

    for (let index = 0; index < 6; index += 1) {
      pdfjsMock.docs.set(`/other-${index}.pdf`, makeDoc())
      await getPdfDocumentResource(pdfUrlContent(`/other-${index}.pdf`))
    }
    await vi.runAllTimersAsync()

    expect(retainedDoc.destroy).not.toHaveBeenCalled()

    releasePdfDocumentResource(retainedContent, retainedDoc as never)
  })

  it("evicts a retained document after its final release", async () => {
    const retainedDoc = makeDoc()
    pdfjsMock.docs.set("/release-then-evict.pdf", retainedDoc)
    const retainedContent = pdfUrlContent("/release-then-evict.pdf")
    await getPdfDocumentResource(retainedContent)
    retainPdfDocumentResource(retainedContent, retainedDoc as never)
    releasePdfDocumentResource(retainedContent, retainedDoc as never)

    for (let index = 0; index < 6; index += 1) {
      pdfjsMock.docs.set(`/release-other-${index}.pdf`, makeDoc())
      await getPdfDocumentResource(pdfUrlContent(`/release-other-${index}.pdf`))
    }
    await vi.runAllTimersAsync()

    expect(retainedDoc.destroy).toHaveBeenCalledTimes(1)
  })

  it("does not destroy a retained document when clearing its active cache entry", async () => {
    const retainedDoc = makeDoc()
    const replacementDoc = makeDoc()
    pdfjsMock.docs.set("/clear-retained.pdf", retainedDoc)
    const retainedContent = pdfUrlContent("/clear-retained.pdf")

    await getPdfDocumentResource(retainedContent)
    retainPdfDocumentResource(retainedContent, retainedDoc as never)

    clearPdfDocumentResource(retainedContent)

    expect(retainedDoc.destroy).not.toHaveBeenCalled()

    pdfjsMock.docs.set("/clear-retained.pdf", replacementDoc)
    await expect(
      getPdfDocumentResource(pdfUrlContent("/clear-retained.pdf"))
    ).resolves.toBe(replacementDoc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
    expect(retainedDoc.destroy).not.toHaveBeenCalled()

    releasePdfDocumentResource(retainedContent, retainedDoc as never)

    expect(retainedDoc.destroy).toHaveBeenCalledTimes(1)
    expect(replacementDoc.destroy).not.toHaveBeenCalled()
  })

  it("waits for every retained consumer to release a cleared document", async () => {
    const retainedDoc = makeDoc()
    pdfjsMock.docs.set("/clear-retained-twice.pdf", retainedDoc)
    const content = pdfUrlContent("/clear-retained-twice.pdf")

    await getPdfDocumentResource(content)
    retainPdfDocumentResource(content, retainedDoc as never)
    retainPdfDocumentResource(content, retainedDoc as never)

    clearPdfDocumentResource(content)
    releasePdfDocumentResource(content, retainedDoc as never)

    expect(retainedDoc.destroy).not.toHaveBeenCalled()

    releasePdfDocumentResource(content, retainedDoc as never)

    expect(retainedDoc.destroy).toHaveBeenCalledTimes(1)
  })

  it("does not destroy an active replacement that shares a detached document object", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/clear-retained-same-object.pdf", doc)
    const content = pdfUrlContent("/clear-retained-same-object.pdf")

    await getPdfDocumentResource(content)
    retainPdfDocumentResource(content, doc as never)
    clearPdfDocumentResource(content)

    await expect(
      getPdfDocumentResource(pdfUrlContent("/clear-retained-same-object.pdf"))
    ).resolves.toBe(doc)

    releasePdfDocumentResource(content, doc as never)

    expect(doc.destroy).not.toHaveBeenCalled()
    await expect(
      getPdfDocumentResource(pdfUrlContent("/clear-retained-same-object.pdf"))
    ).resolves.toBe(doc)
  })

  it("destroys a document object only once when reset sees attached and detached entries", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/reset-attached-detached-same-object.pdf", doc)
    const content = pdfUrlContent("/reset-attached-detached-same-object.pdf")

    await getPdfDocumentResource(content)
    retainPdfDocumentResource(content, doc as never)
    clearPdfDocumentResource(content)

    await expect(
      getPdfDocumentResource(
        pdfUrlContent("/reset-attached-detached-same-object.pdf")
      )
    ).resolves.toBe(doc)

    resetPdfDocumentResourceCacheForTests()

    expect(doc.destroy).toHaveBeenCalledTimes(1)
  })

  it("does not evict-destroy an active entry whose document is still retained as detached", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/evict-attached-detached-same-object.pdf", doc)
    const content = pdfUrlContent("/evict-attached-detached-same-object.pdf")

    await getPdfDocumentResource(content)
    retainPdfDocumentResource(content, doc as never)
    clearPdfDocumentResource(content)

    await expect(
      getPdfDocumentResource(
        pdfUrlContent("/evict-attached-detached-same-object.pdf")
      )
    ).resolves.toBe(doc)

    for (let index = 0; index < 6; index += 1) {
      pdfjsMock.docs.set(`/attached-detached-other-${index}.pdf`, makeDoc())
      await getPdfDocumentResource(
        pdfUrlContent(`/attached-detached-other-${index}.pdf`)
      )
    }
    await vi.runAllTimersAsync()

    expect(doc.destroy).not.toHaveBeenCalled()

    releasePdfDocumentResource(content, doc as never)

    expect(doc.destroy).toHaveBeenCalledTimes(1)
  })

  it("does not release or clear another resource's detached retained document", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/detached-owner-a.pdf", doc)
    pdfjsMock.docs.set("/detached-owner-b.pdf", doc)
    const firstContent = pdfUrlContent("/detached-owner-a.pdf")
    const secondContent = pdfUrlContent("/detached-owner-b.pdf")

    await getPdfDocumentResource(firstContent)
    retainPdfDocumentResource(firstContent, doc as never)
    clearPdfDocumentResource(firstContent)

    await expect(getPdfDocumentResource(secondContent)).resolves.toBe(doc)

    releasePdfDocumentResource(secondContent, doc as never)
    clearPdfDocumentResource(secondContent)

    expect(doc.destroy).not.toHaveBeenCalled()

    releasePdfDocumentResource(firstContent, doc as never)

    expect(doc.destroy).toHaveBeenCalledTimes(1)
  })

  it("destroys unretained resolved documents when evicted", async () => {
    const firstDoc = makeDoc()
    pdfjsMock.docs.set("/doc-0.pdf", firstDoc)
    await getPdfDocumentResource(pdfUrlContent("/doc-0.pdf"))

    for (let index = 1; index <= 6; index += 1) {
      pdfjsMock.docs.set(`/doc-${index}.pdf`, makeDoc())
      await getPdfDocumentResource(pdfUrlContent(`/doc-${index}.pdf`))
    }
    await vi.runAllTimersAsync()

    expect(firstDoc.destroy).toHaveBeenCalledTimes(1)
  })

  it("destroys a pending document if the resource is cleared before it resolves", async () => {
    const content = pdfUrlContent("/clear-pending.pdf")
    const pendingLoad = getPdfDocumentResource(content)
    await vi.waitFor(() =>
      expect(pdfjsMock.pending.has("/clear-pending.pdf")).toBe(true)
    )
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1)

    const replacementDoc = makeDoc()
    pdfjsMock.docs.set("/clear-pending.pdf", replacementDoc)
    clearPdfDocumentResource(content)

    const orphanDoc = makeDoc()
    pdfjsMock.pending.get("/clear-pending.pdf")?.resolve(orphanDoc)

    await expect(pendingLoad).resolves.toBe(orphanDoc)
    await Promise.resolve()
    expect(orphanDoc.destroy).toHaveBeenCalledTimes(1)

    await expect(
      getPdfDocumentResource(pdfUrlContent("/clear-pending.pdf"))
    ).resolves.toBe(replacementDoc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
  })

  it("destroys a pending document if the cache is reset before it resolves", async () => {
    const pendingLoad = getPdfDocumentResource(
      pdfUrlContent("/reset-pending.pdf")
    )
    await vi.waitFor(() =>
      expect(pdfjsMock.pending.has("/reset-pending.pdf")).toBe(true)
    )

    resetPdfDocumentResourceCacheForTests()

    const orphanDoc = makeDoc()
    pdfjsMock.pending.get("/reset-pending.pdf")?.resolve(orphanDoc)

    await expect(pendingLoad).resolves.toBe(orphanDoc)
    await Promise.resolve()
    expect(orphanDoc.destroy).toHaveBeenCalledTimes(1)
  })

  it("does not let a stale pending document replace a newer load for the same source", async () => {
    const firstContent = pdfUrlContent("/replace-pending.pdf")
    const staleLoad = getPdfDocumentResource(firstContent)
    await vi.waitFor(() =>
      expect(pdfjsMock.pending.has("/replace-pending.pdf")).toBe(true)
    )

    clearPdfDocumentResource(firstContent)

    const currentDoc = makeDoc()
    pdfjsMock.docs.set("/replace-pending.pdf", currentDoc)

    await expect(
      getPdfDocumentResource(pdfUrlContent("/replace-pending.pdf"))
    ).resolves.toBe(currentDoc)

    const staleDoc = makeDoc()
    pdfjsMock.pending.get("/replace-pending.pdf")?.resolve(staleDoc)

    await expect(staleLoad).resolves.toBe(staleDoc)
    await Promise.resolve()

    expect(staleDoc.destroy).toHaveBeenCalledTimes(1)
    await expect(
      getPdfDocumentResource(pdfUrlContent("/replace-pending.pdf"))
    ).resolves.toBe(currentDoc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
  })

  it("removes rejected document loads so the same source can retry", async () => {
    pdfjsMock.docs.set("/retry-resource.pdf", new Error("load failed"))

    await expect(
      getPdfDocumentResource(pdfUrlContent("/retry-resource.pdf"))
    ).rejects.toMatchObject({
      cause: expect.any(Error),
      format: "pdf",
      kind: "parse_failed",
    } satisfies Partial<ViewerFormatError>)

    const doc = makeDoc()
    pdfjsMock.docs.set("/retry-resource.pdf", doc)

    await expect(
      getPdfDocumentResource(pdfUrlContent("/retry-resource.pdf"))
    ).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
  })

  it("can retain rejected document loads for Suspense error boundaries", async () => {
    pdfjsMock.docs.set("/retained-error.pdf", new Error("load failed"))
    const content = pdfUrlContent("/retained-error.pdf")

    const first = getPdfDocumentResource(content, { retainRejected: true })

    await expect(first).rejects.toMatchObject({
      format: "pdf",
      kind: "parse_failed",
    })

    expect(getPdfDocumentResource(content, { retainRejected: true })).toBe(
      first
    )

    const doc = makeDoc()
    pdfjsMock.docs.set("/retained-error.pdf", doc)

    await expect(getPdfDocumentResource(content)).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
  })

  it("lets a Suspense document reader retain a pending load started by a non-Suspense caller", async () => {
    const content = pdfUrlContent("/pending-retain-upgrade.pdf")
    const first = getPdfDocumentResource(content)
    await vi.waitFor(() =>
      expect(pdfjsMock.pending.has("/pending-retain-upgrade.pdf")).toBe(true)
    )

    let thrown: unknown
    try {
      readPdfDocumentResource(content)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(first)

    pdfjsMock.pending
      .get("/pending-retain-upgrade.pdf")
      ?.reject(new Error("load failed"))

    await expect(first).rejects.toMatchObject({
      format: "pdf",
      kind: "parse_failed",
    })
    expect(getPdfDocumentResource(content, { retainRejected: true })).toBe(
      first
    )

    const doc = makeDoc()
    pdfjsMock.docs.set("/pending-retain-upgrade.pdf", doc)

    await expect(getPdfDocumentResource(content)).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
  })

  it("loads Blob resources through PDF.js data without fetching a URL", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("data:1,2,3", doc)

    const content = pdfBlobContent(Uint8Array.of(1, 2, 3), "blob:pdf")

    await expect(getPdfDocumentResource(content)).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledWith({
      data: Uint8Array.of(1, 2, 3),
    })
  })

  it("does not direct-load Blob PDFs from their download URL", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("data:7,8,9", doc)

    const content = createViewerResource(
      blobSource(Uint8Array.of(7, 8, 9), {
        identityKey: "blob:download-url",
        fileName: "local.pdf",
        mimeType: "application/pdf",
        downloadUrl: "/download/local.pdf",
      })
    ).content

    await expect(getPdfDocumentResource(content)).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledWith({
      data: Uint8Array.of(7, 8, 9),
    })
    expect(pdfjsMock.getDocument).not.toHaveBeenCalledWith(
      "/download/local.pdf"
    )
  })

  it("preserves ResourceError failures from non-direct resource reads", async () => {
    const error = new ResourceError({
      kind: "fetch_failed",
      message: "No bytes available.",
    })
    const content = {
      key: "manual-resource-error",
      sourceKind: "url",
      directUrl: null,
      readBytes: vi.fn(() => Promise.reject(error)),
    } as ViewerContentDirectUrl & ViewerContentBytes

    await expect(getPdfDocumentResource(content)).rejects.toBe(error)
  })

  it("deduplicates page loads per document and page number", async () => {
    const firstDoc = makeDoc()
    const secondDoc = makeDoc()

    const firstPage = getPdfPageResource(firstDoc as never, 1)
    const duplicateFirstPage = getPdfPageResource(firstDoc as never, 1)
    const secondPage = getPdfPageResource(firstDoc as never, 2)
    const samePageDifferentDocument = getPdfPageResource(secondDoc as never, 1)

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

    await expect(getPdfPageResource(doc as never, 1)).rejects.toThrow(
      "page failed"
    )
    await expect(getPdfPageResource(doc as never, 1)).resolves.toEqual({
      pageNumber: 1,
    })
    expect(doc.getPage).toHaveBeenCalledTimes(2)
  })

  it("can retain rejected page loads for Suspense error boundaries", async () => {
    const firstError = new Error("page failed")
    const doc = {
      getPage: vi
        .fn()
        .mockRejectedValueOnce(firstError)
        .mockResolvedValueOnce({ pageNumber: 1 }),
    }

    const first = getPdfPageResource(doc as never, 1, { retainRejected: true })

    await expect(first).rejects.toBe(firstError)
    expect(getPdfPageResource(doc as never, 1, { retainRejected: true })).toBe(
      first
    )
    await expect(getPdfPageResource(doc as never, 1)).resolves.toEqual({
      pageNumber: 1,
    })
    expect(doc.getPage).toHaveBeenCalledTimes(2)
  })

  it("clears retained page errors when the document resource is cleared", async () => {
    const doc = {
      numPages: 1,
      getPage: vi
        .fn()
        .mockRejectedValueOnce(new Error("page failed"))
        .mockResolvedValueOnce({ pageNumber: 1 }),
      destroy: vi.fn(() => Promise.resolve()),
    }
    const content = pdfUrlContent("/clear-page-cache.pdf")
    pdfjsMock.docs.set("/clear-page-cache.pdf", doc)

    await expect(getPdfDocumentResource(content)).resolves.toBe(doc)
    const failedPage = getPdfPageResource(doc as never, 1, {
      retainRejected: true,
    })

    await expect(failedPage).rejects.toThrow("page failed")
    expect(getPdfPageResource(doc as never, 1, { retainRejected: true })).toBe(
      failedPage
    )

    clearPdfDocumentResource(content)

    await expect(getPdfDocumentResource(content)).resolves.toBe(doc)
    await expect(
      getPdfPageResource(doc as never, 1, { retainRejected: true })
    ).resolves.toEqual({ pageNumber: 1 })
    expect(doc.getPage).toHaveBeenCalledTimes(2)
  })

  it("lets a Suspense page reader retain a pending page load started by a non-Suspense caller", async () => {
    const pageLoad = pdfjsMock.deferred<{ pageNumber: number }>()
    const doc = {
      getPage: vi
        .fn()
        .mockReturnValueOnce(pageLoad.promise)
        .mockResolvedValueOnce({ pageNumber: 1 }),
    }
    const first = getPdfPageResource(doc as never, 1)

    let thrown: unknown
    try {
      readPdfPageResource(doc as never, 1)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(first)

    pageLoad.reject(new Error("page failed"))

    await expect(first).rejects.toThrow("page failed")
    expect(getPdfPageResource(doc as never, 1, { retainRejected: true })).toBe(
      first
    )
    await expect(getPdfPageResource(doc as never, 1)).resolves.toEqual({
      pageNumber: 1,
    })
    expect(doc.getPage).toHaveBeenCalledTimes(2)
  })
})
