"use client"

import * as React from "react"

import { clearDocxDocumentResource } from "@/lib/docx-document-resource"
import { isResourceError, isViewerFormatError } from "@/lib/viewer-errors"
import { createViewerResource } from "@/lib/viewer-resource"
import { useIsClient } from "@/components/ui/use-is-client"
import { ViewerErrorBoundary } from "@/components/ui/viewer-error"

import { DocxViewerFallback } from "./docx-viewer-chrome"
import { DocxViewerContent } from "./docx-viewer-content"
import type {
  DocxResourceViewerProps,
  DocxViewerHandle,
  DocxViewerProps,
} from "./docx-viewer-types"

export type {
  DocxDocumentSource,
  DocxResourceViewerProps,
  DocxTarget,
  DocxViewerHandle,
  DocxViewerProps,
} from "./docx-viewer-types"

export const DocxViewer = React.forwardRef<DocxViewerHandle, DocxViewerProps>(
  function DocxViewer(props, ref) {
    const { source, ...resourceProps } = props
    const resource = React.useMemo(() => createViewerResource(source), [source])
    return (
      <DocxResourceViewer {...resourceProps} ref={ref} resource={resource} />
    )
  }
)

export const DocxResourceViewer = React.forwardRef<
  DocxViewerHandle,
  DocxResourceViewerProps
>(function DocxResourceViewer(props, ref) {
  const isClient = useIsClient()
  const resource = props.resource
  if (!isClient) {
    return (
      <DocxViewerFallback
        bare={props.bare}
        className={props.className}
        toolbar={props.toolbar}
      />
    )
  }
  return (
    <ViewerErrorBoundary
      bare={props.bare}
      className={props.className}
      download={resource.originalDownload}
      format="docx"
      onRetry={(error) => {
        if (isResourceError(error) || !isViewerFormatError(error)) {
          clearDocxDocumentResource(resource.content)
        }
      }}
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <DocxViewerFallback
            bare={props.bare}
            className={props.className}
            toolbar={props.toolbar}
          />
        }
      >
        <DocxViewerContent {...props} forwardedRef={ref} resource={resource} />
      </React.Suspense>
    </ViewerErrorBoundary>
  )
})
