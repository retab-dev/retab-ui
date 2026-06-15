"use client"

/**
 * @internal
 * First-party PdfViewer part state. Do not import from app code or examples.
 */
import * as React from "react"

import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source"

import type { PdfViewerHandle } from "./pdf-viewer-types"

export type PdfDocumentSource = UrlViewerSource | BlobViewerSource

export type PdfViewerHeaderControls = {
  currentPage: number
  downloadAction: ViewerResource["originalDownload"]
  onFitWidth: () => void
  onRotate: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  pageCount: number
  scale: number
}

type PdfViewerHeaderState = {
  currentPage: number | null
  headerControls: PdfViewerHeaderControls | null
  resource: ViewerResource
}

type PdfViewerPagesState = {
  resource: ViewerResource
  setCurrentPage: (page: number | null) => void
  setViewerHandle: (handle: PdfViewerHandle | null) => void
}

export type PdfViewerThumbnailsState = {
  currentPage: number | null
  onSelectPage: ((page: number) => void) | undefined
  resource: ViewerResource
}

type PdfViewerHeaderControlSetter = (
  controls: PdfViewerHeaderControls | null
) => void

export interface PdfViewerProviderProps {
  source: PdfDocumentSource
  children: React.ReactNode
}

type PdfViewerContextValue = {
  currentPage: number | null
  headerControls: PdfViewerHeaderControls | null
  resource: ViewerResource
  setCurrentPage: (page: number | null) => void
  setHeaderControls: (controls: PdfViewerHeaderControls | null) => void
  setViewerHandle: (handle: PdfViewerHandle | null) => void
  viewerHandle: PdfViewerHandle | null
}

const PdfViewerContext = React.createContext<PdfViewerContextValue | null>(null)

function usePdfViewerContext(): PdfViewerContextValue {
  const context = React.useContext(PdfViewerContext)
  if (!context) {
    throw new Error("usePdfViewer must be used within PdfViewerProvider.")
  }
  return context
}

function useOptionalPdfViewerContext() {
  return React.useContext(PdfViewerContext)
}

export function useInternalPdfViewerHeader(): PdfViewerHeaderState {
  const { currentPage, headerControls, resource } = usePdfViewerContext()
  return { currentPage, headerControls, resource }
}

export function useInternalPdfViewerPages(): PdfViewerPagesState {
  const { resource, setCurrentPage, setViewerHandle } = usePdfViewerContext()
  return { resource, setCurrentPage, setViewerHandle }
}

export function usePdfViewerThumbnails(): PdfViewerThumbnailsState {
  const { currentPage, resource, viewerHandle } = usePdfViewerContext()
  const onSelectPage = React.useCallback(
    (page: number) => viewerHandle?.scrollToPage(page),
    [viewerHandle]
  )

  return {
    currentPage,
    onSelectPage: viewerHandle ? onSelectPage : undefined,
    resource,
  }
}

export function useInternalPdfViewerHeaderControls(): PdfViewerHeaderControlSetter | null {
  return useOptionalPdfViewerContext()?.setHeaderControls ?? null
}

export function PdfViewerProvider({
  source,
  children,
}: PdfViewerProviderProps) {
  const resource = React.useMemo(() => createViewerResource(source), [source])
  const [currentPage, setCurrentPage] = React.useState<number | null>(null)
  const [headerControls, setHeaderControls] =
    React.useState<PdfViewerHeaderControls | null>(null)
  const [viewerHandle, setViewerHandle] =
    React.useState<PdfViewerHandle | null>(null)
  const value = React.useMemo<PdfViewerContextValue>(
    () => ({
      currentPage,
      headerControls,
      resource,
      setCurrentPage,
      setHeaderControls,
      setViewerHandle,
      viewerHandle,
    }),
    [currentPage, headerControls, resource, viewerHandle]
  )

  return (
    <PdfViewerContext.Provider value={value}>
      {children}
    </PdfViewerContext.Provider>
  )
}
