// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  __resetPdfDocumentCacheForTests,
  getDocumentResource,
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
    getPage: vi.fn(),
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
  it("deduplicates document loads for the same src", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/same.pdf", doc)

    const first = getDocumentResource(pdfUrlResource("/same.pdf"))
    const second = getDocumentResource(pdfUrlResource("/same.pdf"))

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

  it("removes rejected document loads so the same src can retry", async () => {
    pdfjsMock.docs.set("/retry-resource.pdf", new Error("load failed"))

    await expect(
      getDocumentResource(pdfUrlResource("/retry-resource.pdf"))
    ).rejects.toThrow("load failed")

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
})
