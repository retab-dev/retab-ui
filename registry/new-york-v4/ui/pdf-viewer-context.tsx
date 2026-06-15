"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source"

import {
  PdfResourceContent,
  type PdfViewerContentProps,
} from "./pdf-viewer-content"
import type {
  PdfDocumentViewportControls,
  PdfViewerHandle,
} from "./pdf-viewer-types"
import { PdfDocumentViewportRegistrationProvider } from "./pdf-viewer-viewport"
import { ViewerHeader } from "./viewer"
import { ViewerToolbar } from "./viewer-toolbar"

export type PdfDocumentSource = UrlViewerSource | BlobViewerSource

export type PdfViewerThumbnailsState = {
  currentPage: number | null
  onSelectPage: ((page: number) => void) | undefined
  resource: ViewerResource
}

export interface PdfViewerProviderProps {
  source: PdfDocumentSource
  children: React.ReactNode
}

type PdfViewerContextValue = {
  currentPage: number | null
  viewportControls: PdfDocumentViewportControls | null
  resource: ViewerResource
  setCurrentPage: (page: number | null) => void
  setViewerHandle: (handle: PdfViewerHandle | null) => void
  viewerHandle: PdfViewerHandle | null
}

type PdfDocumentHeaderState = {
  currentPage: number | null
  viewportControls: PdfDocumentViewportControls | null
  resource: ViewerResource
}

type PdfDocumentPagesState = {
  resource: ViewerResource
  setCurrentPage: (page: number | null) => void
  setViewerHandle: (handle: PdfViewerHandle | null) => void
}

const PdfViewerContext = React.createContext<PdfViewerContextValue | null>(null)

function usePdfViewerContext(
  consumer = "PdfViewer parts"
): PdfViewerContextValue {
  const context = React.useContext(PdfViewerContext)
  if (!context) {
    throw new Error(`${consumer} must be used within PdfViewerProvider.`)
  }
  return context
}

export function usePdfViewerThumbnails(): PdfViewerThumbnailsState {
  const { currentPage, resource, viewerHandle } = usePdfViewerContext(
    "usePdfViewerThumbnails"
  )
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

function usePdfDocumentHeaderState(): PdfDocumentHeaderState {
  const { currentPage, viewportControls, resource } = usePdfViewerContext()
  return { currentPage, viewportControls, resource }
}

function usePdfDocumentPagesState(): PdfDocumentPagesState {
  const { resource, setCurrentPage, setViewerHandle } = usePdfViewerContext()
  return { resource, setCurrentPage, setViewerHandle }
}

export function PdfViewerHeader({
  children,
  className,
  download = true,
  toolbar = true,
}: {
  children?: React.ReactNode
  className?: string
  download?: boolean
  toolbar?: boolean
}) {
  const { currentPage, viewportControls, resource } =
    usePdfDocumentHeaderState()
  const label = resource.fileName || "PDF"

  if (children !== undefined) {
    return (
      <ViewerHeader
        className={cn("flex min-h-10 items-center gap-3 px-2 py-1", className)}
      >
        {children}
      </ViewerHeader>
    )
  }

  return (
    <ViewerHeader
      className={cn("flex min-h-10 items-center gap-3 px-2 py-1", className)}
    >
      {toolbar && viewportControls ? (
        <ViewerToolbar
          className="h-auto flex-1 border-b-0 bg-transparent px-0"
          title={label}
          position={{
            kind: "page",
            current: viewportControls.currentPage,
            total: viewportControls.pageCount,
          }}
          zoom={{
            scale: viewportControls.scale,
            onZoomOut: viewportControls.onZoomOut,
            onZoomIn: viewportControls.onZoomIn,
            onFit: viewportControls.onFitWidth,
          }}
          rotate={{ onRotate: viewportControls.onRotate }}
          downloads={download ? [viewportControls.downloadAction] : []}
        />
      ) : (
        <ViewerToolbar
          className="h-auto flex-1 border-b-0 bg-transparent px-0"
          title={label}
          position={
            toolbar && currentPage
              ? { kind: "page", current: currentPage }
              : null
          }
        />
      )}
    </ViewerHeader>
  )
}

export const PdfViewerPages = React.forwardRef<
  PdfViewerHandle,
  PdfViewerContentProps
>(function PdfViewerPages(props, ref) {
  const { resource, setCurrentPage, setViewerHandle } =
    usePdfDocumentPagesState()
  const { onVisiblePageChange } = props
  const handleVisiblePageChange = React.useCallback(
    (page: number) => {
      setCurrentPage(page)
      onVisiblePageChange?.(page)
    },
    [onVisiblePageChange, setCurrentPage]
  )
  const handleRef = React.useCallback(
    (handle: PdfViewerHandle | null) => {
      setViewerHandle(handle)
      if (typeof ref === "function") {
        ref(handle)
        return
      }
      if (ref) ref.current = handle
    },
    [ref, setViewerHandle]
  )

  return (
    <PdfResourceContent
      {...props}
      ref={handleRef}
      resource={resource}
      toolbar={false}
      onVisiblePageChange={handleVisiblePageChange}
    />
  )
})

export function PdfViewerProvider({
  source,
  children,
}: PdfViewerProviderProps) {
  const resource = React.useMemo(() => createViewerResource(source), [source])
  const [currentPage, setCurrentPage] = React.useState<number | null>(null)
  const [viewportControls, updateViewportControls] =
    React.useState<PdfDocumentViewportControls | null>(null)
  const [viewerHandle, setViewerHandle] =
    React.useState<PdfViewerHandle | null>(null)
  const handleViewportControlsChange = React.useCallback(
    (controls: PdfDocumentViewportControls | null) => {
      updateViewportControls(controls)
    },
    []
  )
  const value = React.useMemo<PdfViewerContextValue>(
    () => ({
      currentPage,
      viewportControls,
      resource,
      setCurrentPage,
      setViewerHandle,
      viewerHandle,
    }),
    [currentPage, resource, viewportControls, viewerHandle]
  )

  return (
    <PdfViewerContext.Provider value={value}>
      <PdfDocumentViewportRegistrationProvider
        onViewportControlsChange={handleViewportControlsChange}
      >
        {children}
      </PdfDocumentViewportRegistrationProvider>
    </PdfViewerContext.Provider>
  )
}
