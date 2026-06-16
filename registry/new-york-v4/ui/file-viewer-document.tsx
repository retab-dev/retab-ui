"use client"

import * as React from "react"

import { type ViewerResource } from "@/lib/viewer-resource"

import {
  type FileDescriptor,
  type FileViewerDocumentChrome,
} from "./file-viewer-core"
import { FileErrorBoundary, ViewerFallback } from "./file-viewer-fallback"
import { useFileViewerContext } from "./file-viewer-internal"
import { FileViewerRoute } from "./file-viewer-route"
import { type ViewerControlsState } from "./viewer-controls"

export type FileViewerDocumentProps = {
  className?: string
}

type FileViewerDocumentContentProps = FileViewerDocumentProps & {
  bare?: boolean
}

type FileViewerDocumentState = {
  descriptor: FileDescriptor
  descriptorKey: string
  descriptorSignal: AbortSignal
  documentChrome: FileViewerDocumentChrome
  isClient: boolean
  isolateStyles: boolean
  resource: ViewerResource
  setControlsState: (state: ViewerControlsState | null) => void
}

function useFileViewerDocument(): FileViewerDocumentState {
  const {
    descriptor,
    descriptorKey,
    descriptorSignal,
    documentChrome,
    isClient,
    isolateStyles,
    resource,
    setControlsState,
  } = useFileViewerContext()

  return React.useMemo(
    () => ({
      descriptor,
      descriptorKey,
      descriptorSignal,
      documentChrome,
      isClient,
      isolateStyles,
      resource,
      setControlsState,
    }),
    [
      descriptor,
      descriptorKey,
      descriptorSignal,
      documentChrome,
      isClient,
      isolateStyles,
      resource,
      setControlsState,
    ]
  )
}

export function FileViewerDocument({ className }: FileViewerDocumentProps) {
  return <FileViewerDocumentContent bare className={className} />
}

function FileViewerDocumentContent({
  bare = false,
  className,
}: FileViewerDocumentContentProps) {
  const {
    descriptor,
    descriptorKey,
    descriptorSignal,
    documentChrome,
    isClient,
    isolateStyles,
    resource,
    setControlsState,
  } = useFileViewerDocument()
  const fallback = (
    <ViewerFallback resource={resource} className={className} bare={bare} />
  )

  React.useEffect(() => {
    setControlsState(null)
    return () => setControlsState(null)
  }, [descriptorKey, setControlsState])

  if (!isClient) return fallback

  return (
    <FileErrorBoundary
      key={descriptorKey}
      descriptor={descriptor}
      resource={resource}
      className={className}
      resetKey={descriptorKey}
      showDownload={documentChrome === "standalone"}
    >
      <React.Suspense fallback={fallback}>
        <FileViewerRoute
          bare={bare}
          className={className}
          descriptor={descriptor}
          descriptorSignal={descriptorSignal}
          isolateStyles={isolateStyles}
          resource={resource}
          chrome={documentChrome}
        />
      </React.Suspense>
    </FileErrorBoundary>
  )
}
