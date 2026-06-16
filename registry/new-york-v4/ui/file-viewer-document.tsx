"use client"

import * as React from "react"

import { type ViewerResource } from "@/lib/viewer-resource"

import {
  type FileDescriptor,
  type FileViewerProps as FileViewerCoreProps,
} from "./file-viewer-core"
import { FileErrorBoundary, ViewerFallback } from "./file-viewer-fallback"
import { useFileViewerContext } from "./file-viewer-internal"
import { FileViewerRoute } from "./file-viewer-route"
import { type ViewerControlsState } from "./viewer-controls"

export type FileViewerDocumentProps = Pick<
  FileViewerCoreProps,
  "bare" | "className"
>

type FileViewerDocumentState = {
  descriptor: FileDescriptor
  descriptorKey: string
  descriptorSignal: AbortSignal
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
      isClient,
      isolateStyles,
      resource,
      setControlsState,
    }),
    [
      descriptor,
      descriptorKey,
      descriptorSignal,
      isClient,
      isolateStyles,
      resource,
      setControlsState,
    ]
  )
}

export function FileViewerDocument({
  bare = false,
  className,
}: FileViewerDocumentProps) {
  return (
    <InternalFileViewerDocument
      bare={bare}
      className={className}
      leafControls
      leafDownload
    />
  )
}

export function InternalFileViewerDocument({
  bare = false,
  className,
  leafControls,
  leafDownload,
}: FileViewerDocumentProps & {
  leafControls: boolean
  leafDownload: boolean
}) {
  const {
    descriptor,
    descriptorKey,
    descriptorSignal,
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
    >
      <React.Suspense fallback={fallback}>
        <FileViewerRoute
          bare={bare}
          className={className}
          descriptor={descriptor}
          descriptorSignal={descriptorSignal}
          isolateStyles={isolateStyles}
          resource={resource}
          leafControls={leafControls}
          leafDownload={leafDownload}
        />
      </React.Suspense>
    </FileErrorBoundary>
  )
}
