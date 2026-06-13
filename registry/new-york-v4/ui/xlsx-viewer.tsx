"use client"

import * as React from "react"

import { createViewerResource } from "@/lib/viewer-resource"
import { useIsClient } from "@/components/ui/use-is-client"
import { ViewerErrorBoundary } from "@/components/ui/viewer-error"

import { XlsxViewerFallback } from "./xlsx-viewer-chrome"
import { XlsxViewerSession } from "./xlsx-viewer-session"
import type {
  XlsxResourceViewerProps,
  XlsxViewerHandle,
  XlsxViewerProps,
} from "./xlsx-viewer-types"

export type {
  XlsxCellRef,
  XlsxDocumentSource,
  XlsxResourceViewerProps,
  XlsxViewerHandle,
  XlsxViewerProps,
} from "./xlsx-viewer-types"

export const XlsxViewer = React.forwardRef<XlsxViewerHandle, XlsxViewerProps>(
  function XlsxViewer(props, ref) {
    const { source, ...resourceProps } = props
    const resource = React.useMemo(() => createViewerResource(source), [source])
    return (
      <XlsxResourceViewer {...resourceProps} ref={ref} resource={resource} />
    )
  }
)

export const XlsxResourceViewer = React.forwardRef<
  XlsxViewerHandle,
  XlsxResourceViewerProps
>(function XlsxResourceViewer(props, ref) {
  const isClient = useIsClient()
  const resource = props.resource
  if (!isClient) {
    return (
      <XlsxViewerFallback
        className={props.className}
        fallbackSheetTabs={props.fallbackSheetTabs}
        toolbar={props.toolbar}
        bare={props.bare}
      />
    )
  }
  return (
    <ViewerErrorBoundary
      className={props.className}
      download={resource.originalDownload}
      format="xlsx"
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <XlsxViewerFallback
            className={props.className}
            fallbackSheetTabs={props.fallbackSheetTabs}
            toolbar={props.toolbar}
            bare={props.bare}
          />
        }
      >
        <XlsxViewerSession
          key={resource.keys.resource}
          {...props}
          forwardedRef={ref}
          resource={resource}
        />
      </React.Suspense>
    </ViewerErrorBoundary>
  )
})
