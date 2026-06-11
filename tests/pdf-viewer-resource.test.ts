// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  pdfjsMock.getDocument.mockImplementation((src: string) => {
    const doc = pdfjsMock.docs.get(src)
    return {
      promise:
        doc instanceof Error ? Promise.reject(doc) : Promise.resolve(doc),
    }
  })
  pdfjsMock.GlobalWorkerOptions.workerSrc = undefined
  __resetPdfDocumentCacheForTests()
})

afterEach(() => {
  __resetPdfDocumentCacheForTests()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("pdf-viewer-resource", () => {
  it("deduplicates document loads for the same src", async () => {
    const doc = makeDoc()
    pdfjsMock.docs.set("/same.pdf", doc)

    const first = getDocumentResource("/same.pdf")
    const second = getDocumentResource("/same.pdf")

    await expect(first).resolves.toBe(doc)
    await expect(second).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1)
  })

  it("does not evict retained documents when pruning the cache", async () => {
    const retainedDoc = makeDoc()
    pdfjsMock.docs.set("/retained.pdf", retainedDoc)
    await getDocumentResource("/retained.pdf")
    retainDocumentResource("/retained.pdf", retainedDoc as never)

    for (let index = 0; index < 6; index += 1) {
      pdfjsMock.docs.set(`/other-${index}.pdf`, makeDoc())
      await getDocumentResource(`/other-${index}.pdf`)
    }
    await vi.runAllTimersAsync()

    expect(retainedDoc.destroy).not.toHaveBeenCalled()

    releaseDocumentResource("/retained.pdf", retainedDoc as never)
  })

  it("destroys unretained fulfilled documents when evicted", async () => {
    const firstDoc = makeDoc()
    pdfjsMock.docs.set("/doc-0.pdf", firstDoc)
    await getDocumentResource("/doc-0.pdf")

    for (let index = 1; index <= 6; index += 1) {
      pdfjsMock.docs.set(`/doc-${index}.pdf`, makeDoc())
      await getDocumentResource(`/doc-${index}.pdf`)
    }
    await vi.runAllTimersAsync()

    expect(firstDoc.destroy).toHaveBeenCalledTimes(1)
  })

  it("removes rejected document loads so the same src can retry", async () => {
    pdfjsMock.docs.set("/retry-resource.pdf", new Error("load failed"))

    await expect(getDocumentResource("/retry-resource.pdf")).rejects.toThrow(
      "load failed"
    )

    const doc = makeDoc()
    pdfjsMock.docs.set("/retry-resource.pdf", doc)

    await expect(getDocumentResource("/retry-resource.pdf")).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
  })
})
