import type * as Pdfjs from "pdfjs-dist"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"

import { ResourceError, ViewerFormatError } from "@/lib/viewer-errors"
import { type ViewerResource } from "@/lib/viewer-resource"

const PDF_CACHE_MAX = 6

type DocumentCacheEntry = {
  promise: Promise<PDFDocumentProxy>
  consumers: number
  lastUsedAt: number
  status: "pending" | "fulfilled" | "rejected"
  document?: PDFDocumentProxy
}

let pdfjsPromise: Promise<typeof Pdfjs> | null = null
const documentCache = new Map<string, DocumentCacheEntry>()
const pageCache = new WeakMap<
  PDFDocumentProxy,
  Map<number, Promise<PDFPageProxy>>
>()
let pruneTimer = 0

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString()
      }
      return pdfjs
    })
  }
  return pdfjsPromise
}

function scheduleDocumentPrune() {
  if (typeof window === "undefined" || pruneTimer) return
  pruneTimer = window.setTimeout(() => {
    pruneTimer = 0
    pruneDocumentCache()
  }, 0)
}

function pruneDocumentCache() {
  while (documentCache.size > PDF_CACHE_MAX) {
    let evictKey: string | null = null
    let evictEntry: DocumentCacheEntry | null = null
    for (const [key, documentEntry] of documentCache) {
      if (documentEntry.consumers > 0 || documentEntry.status === "pending") {
        continue
      }
      if (!evictEntry || documentEntry.lastUsedAt < evictEntry.lastUsedAt) {
        evictKey = key
        evictEntry = documentEntry
      }
    }
    if (!evictKey || !evictEntry) return
    documentCache.delete(evictKey)
    if (evictEntry.status === "fulfilled") {
      void evictEntry.document?.destroy().catch(() => {})
    }
  }
}

export function getDocumentResource(
  resource: ViewerResource
): Promise<PDFDocumentProxy> {
  const resourceKey = resource.keys.load
  const cachedDocumentEntry = documentCache.get(resourceKey)
  if (cachedDocumentEntry) {
    cachedDocumentEntry.lastUsedAt = Date.now()
    return cachedDocumentEntry.promise
  }

  const documentEntry: DocumentCacheEntry = {
    promise: Promise.resolve(null as never),
    consumers: 0,
    lastUsedAt: Date.now(),
    status: "pending",
  }
  documentEntry.promise = loadPdfjs()
    .then((pdfjs) => getPdfDocument(resource, pdfjs))
    .then(
      (document) => {
        documentEntry.status = "fulfilled"
        documentEntry.document = document
        scheduleDocumentPrune()
        return document
      },
      (error) => {
        documentEntry.status = "rejected"
        if (documentCache.get(resourceKey) === documentEntry) {
          documentCache.delete(resourceKey)
        }
        throw error
      }
    )

  documentCache.set(resourceKey, documentEntry)
  scheduleDocumentPrune()
  return documentEntry.promise
}

export function retainDocumentResource(
  resource: ViewerResource,
  document: PDFDocumentProxy
) {
  const documentEntry = documentCache.get(resource.keys.load)
  if (!documentEntry || documentEntry.document !== document) return
  documentEntry.consumers += 1
  documentEntry.lastUsedAt = Date.now()
}

export function releaseDocumentResource(
  resource: ViewerResource,
  document: PDFDocumentProxy
) {
  const documentEntry = documentCache.get(resource.keys.load)
  if (!documentEntry || documentEntry.document !== document) return
  documentEntry.consumers = Math.max(0, documentEntry.consumers - 1)
  documentEntry.lastUsedAt = Date.now()
  scheduleDocumentPrune()
}

export function __resetPdfDocumentCacheForTests() {
  if (pruneTimer && typeof window !== "undefined") {
    window.clearTimeout(pruneTimer)
    pruneTimer = 0
  }
  for (const documentEntry of documentCache.values()) {
    if (documentEntry.status === "fulfilled") {
      void documentEntry.document?.destroy().catch(() => {})
    }
  }
  documentCache.clear()
}

export function getPageResource(
  document: PDFDocumentProxy,
  pageNumber: number
) {
  let pages = pageCache.get(document)
  if (!pages) {
    pages = new Map()
    pageCache.set(document, pages)
  }
  let pagePromise = pages.get(pageNumber)
  if (!pagePromise) {
    pagePromise = document.getPage(pageNumber)
    pages.set(pageNumber, pagePromise)
    pagePromise.catch(() => {
      if (pages?.get(pageNumber) === pagePromise) {
        pages.delete(pageNumber)
      }
    })
  }
  return pagePromise
}

async function getPdfDocument(
  resource: ViewerResource,
  pdfjs: typeof Pdfjs
): Promise<PDFDocumentProxy> {
  try {
    const directLoad = resource.getDirectLoad()
    if (directLoad.kind === "url") {
      return await pdfjs.getDocument(directLoad.url).promise
    }

    const buffer = await resource.readArrayBuffer()
    return await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  } catch (error) {
    if (error instanceof ResourceError) throw error
    throw new ViewerFormatError({
      format: "pdf",
      kind: "parse_failed",
      message: "Failed to parse PDF.",
      cause: error,
    })
  }
}
