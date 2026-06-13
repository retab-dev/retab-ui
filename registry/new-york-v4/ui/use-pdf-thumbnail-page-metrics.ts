"use client"

import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { getPdfPageResource } from "@/lib/pdf-document-resource"

import { normalizeThumbnailPage } from "./pdf-thumbnail-layout"

export const PDF_THUMBNAIL_PAGE_METRIC_CONCURRENCY = 4

export interface PdfThumbnailPageMetric {
  pageNumber: number
  width: number
  height: number
}

export interface PdfThumbnailPageMetrics {
  pageCount: number
  metricByPageNumber: ReadonlyMap<number, PdfThumbnailPageMetric>
  requestPageMetrics: (pageNumbers: Iterable<number>) => void
  status: "idle" | "loading"
}

type PdfThumbnailPageMetricState = {
  resetKey: unknown
  pageCount: number
  metricByPageNumber: ReadonlyMap<number, PdfThumbnailPageMetric>
  status: "idle" | "loading"
  error: unknown
}

export function usePdfThumbnailPageMetrics(
  doc: PDFDocumentProxy,
  resetKey: unknown
): PdfThumbnailPageMetrics {
  const generationRef = React.useRef(0)
  const activeRequestCountRef = React.useRef(0)
  const queuedPageNumbersRef = React.useRef<number[]>([])
  const pendingPageNumbersRef = React.useRef(new Set<number>())
  const metricByPageNumberRef = React.useRef(
    new Map<number, PdfThumbnailPageMetric>()
  )
  const [state, setState] = React.useState<PdfThumbnailPageMetricState>(() => ({
    resetKey,
    pageCount: doc.numPages,
    metricByPageNumber: new Map(),
    status: "idle",
    error: null,
  }))

  const emptyMetricByPageNumber = React.useMemo<
    ReadonlyMap<number, PdfThumbnailPageMetric>
  >(() => new Map(), [])
  const isCurrentState = Object.is(state.resetKey, resetKey)
  const currentState = isCurrentState
    ? state
    : {
        resetKey,
        pageCount: doc.numPages,
        metricByPageNumber: emptyMetricByPageNumber,
        status: "idle" as const,
        error: null,
      }

  React.useEffect(() => {
    generationRef.current += 1
    activeRequestCountRef.current = 0
    queuedPageNumbersRef.current = []
    pendingPageNumbersRef.current.clear()
    metricByPageNumberRef.current = new Map()
    setState({
      resetKey,
      pageCount: doc.numPages,
      metricByPageNumber: new Map(),
      status: "idle",
      error: null,
    })
  }, [doc, resetKey])

  const getPageMetricStatus = React.useCallback(
    () =>
      queuedPageNumbersRef.current.length > 0 ||
      activeRequestCountRef.current > 0 ||
      pendingPageNumbersRef.current.size > 0
        ? "loading"
        : "idle",
    []
  )

  const finishPageMetricRequest = React.useCallback(
    (generation: number, pageNumber: number) => {
      if (generationRef.current !== generation) return

      activeRequestCountRef.current = Math.max(
        0,
        activeRequestCountRef.current - 1
      )
      pendingPageNumbersRef.current.delete(pageNumber)
      setState((current) =>
        Object.is(current.resetKey, resetKey)
          ? {
              ...current,
              status: getPageMetricStatus(),
            }
          : current
      )
    },
    [getPageMetricStatus, resetKey]
  )

  const drainPageMetricQueue = React.useMemo(
    () =>
      function drain(generation: number) {
      if (generationRef.current !== generation) return

      while (
        activeRequestCountRef.current < PDF_THUMBNAIL_PAGE_METRIC_CONCURRENCY
      ) {
        const pageNumber = queuedPageNumbersRef.current.shift()
        if (pageNumber == null) return

        activeRequestCountRef.current += 1
        void getPdfPageResource(doc, pageNumber, {
          retainRejected: true,
        })
          .then((page) => {
            if (generationRef.current !== generation) return

            const viewport = page.getViewport({ scale: 1 })
            const metric = {
              pageNumber,
              width: viewport.width,
              height: viewport.height,
            }

            setState((current) => {
              if (!Object.is(current.resetKey, resetKey)) return current

              const metricByPageNumber = new Map(metricByPageNumberRef.current)
              metricByPageNumber.set(pageNumber, metric)
              metricByPageNumberRef.current = metricByPageNumber

              return {
                ...current,
                metricByPageNumber,
                status: getPageMetricStatus(),
              }
            })
          })
          .catch((error: unknown) => {
            if (generationRef.current !== generation) return
            setState((current) =>
              Object.is(current.resetKey, resetKey)
                ? { ...current, status: "idle", error }
                : current
            )
          })
          .finally(() => {
            finishPageMetricRequest(generation, pageNumber)
            drain(generation)
          })
      }
    },
    [doc, finishPageMetricRequest, getPageMetricStatus, resetKey]
  )

  const requestPageMetrics = React.useCallback(
    (pageNumbers: Iterable<number>) => {
      const generation = generationRef.current
      const nextPageNumbers = Array.from(pageNumbers)
        .map((pageNumber) => normalizeThumbnailPage(pageNumber, doc.numPages))
        .filter((pageNumber): pageNumber is number => pageNumber != null)

      setState((current) => {
        if (!Object.is(current.resetKey, resetKey)) return current
        const hasMissingPage = nextPageNumbers.some(
          (pageNumber) =>
            !metricByPageNumberRef.current.has(pageNumber) &&
            !pendingPageNumbersRef.current.has(pageNumber)
        )
        return hasMissingPage ? { ...current, status: "loading" } : current
      })

      for (const pageNumber of nextPageNumbers) {
        if (metricByPageNumberRef.current.has(pageNumber)) continue
        if (pendingPageNumbersRef.current.has(pageNumber)) continue

        pendingPageNumbersRef.current.add(pageNumber)
        queuedPageNumbersRef.current.push(pageNumber)
      }

      drainPageMetricQueue(generation)
    },
    [doc, drainPageMetricQueue, resetKey]
  )

  if (currentState.error) throw currentState.error

  return {
    pageCount: currentState.pageCount,
    metricByPageNumber: currentState.metricByPageNumber,
    requestPageMetrics,
    status: currentState.status,
  }
}
