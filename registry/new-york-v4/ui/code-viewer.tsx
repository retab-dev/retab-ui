"use client"

import * as React from "react"

import {
  createViewerResource,
  type ViewerContentIdentity,
  type ViewerResource,
} from "@/lib/viewer-resource"
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "./text-viewer-resource"
import { useIsClient } from "./use-is-client"
import { ViewerErrorBoundary } from "./viewer-error"

import { CodeViewerFallback } from "./code-viewer-chrome"
import { CodeViewerContent } from "./code-viewer-content"
import type { CodeViewerHandle, CodeViewerProps } from "./code-viewer-types"

export type {
  CodeDocumentSource,
  TextLineRange,
  CodeViewerHandle,
  CodeViewerProps,
} from "./code-viewer-types"

export const CodeViewer = React.forwardRef<CodeViewerHandle, CodeViewerProps>(
  function CodeViewer(props, ref) {
    const [retryState, setRetryState] = React.useState({
      contentKey: "",
      version: 0,
    })
    const isClient = useIsClient()
    const { source } = props
    const resource = React.useMemo(() => createViewerResource(source), [source])
    const contentBaseKey = codeViewerContentBaseKey(resource.content, props)
    const retryVersion =
      retryState.contentKey === contentBaseKey ? retryState.version : 0
    const resetKey = codeViewerResetKey(resource, props, retryVersion)
    const contentResetKey = codeViewerContentResetKey(
      contentBaseKey,
      retryVersion
    )

    if (source.kind !== "text" && !isClient) {
      return (
        <CodeViewerFallback
          className={props.className}
          toolbar={props.toolbar}
          bare={props.bare}
        />
      )
    }

    return (
      <ViewerErrorBoundary
        bare={props.bare}
        className={props.className}
        download={
          props.toolbar === false ? null : codeViewerDownloadAction(resource)
        }
        format="text"
        resetKey={resetKey}
        sourceKind={resource.sourceKind}
        onRetry={() =>
          setRetryState((state) => ({
            contentKey: contentBaseKey,
            version:
              state.contentKey === contentBaseKey ? state.version + 1 : 1,
          }))
        }
      >
        <React.Suspense
          key={contentResetKey}
          fallback={
            <CodeViewerFallback
              className={props.className}
              toolbar={props.toolbar}
              bare={props.bare}
            />
          }
        >
          <CodeViewerContent
            {...props}
            forwardedRef={ref}
            retryVersion={retryVersion}
            resource={resource}
          />
        </React.Suspense>
      </ViewerErrorBoundary>
    )
  }
)

function codeViewerDownloadAction(resource: ViewerResource) {
  return resource.originalDownload
}

function codeViewerResetKey(
  resource: ViewerResource,
  props: Pick<CodeViewerProps, "maxBytes" | "maxLines">,
  retryVersion: number
): string {
  const [maxBytesKey, maxLinesKey] = codeViewerBoundsResetKey(props)
  return [resource.keys.resource, retryVersion, maxBytesKey, maxLinesKey].join(
    "\u0000"
  )
}

function codeViewerContentResetKey(
  contentBaseKey: string,
  retryVersion: number
): string {
  return [contentBaseKey, retryVersion].join("\u0000")
}

function codeViewerContentBaseKey(
  content: ViewerContentIdentity,
  props: Pick<CodeViewerProps, "maxBytes" | "maxLines">
): string {
  const [maxBytesKey, maxLinesKey] = codeViewerBoundsResetKey(props)
  return [content.key, maxBytesKey, maxLinesKey].join("\u0000")
}

function codeViewerBoundsResetKey(
  props: Pick<CodeViewerProps, "maxBytes" | "maxLines">
) {
  return [
    codeViewerBoundResetKeyPart(props.maxBytes, DEFAULT_MAX_BYTES),
    codeViewerBoundResetKeyPart(props.maxLines, DEFAULT_MAX_LINES),
  ] as const
}

function codeViewerBoundResetKeyPart(
  value: number | undefined,
  defaultValue: number
) {
  return String(value === undefined ? defaultValue : value)
}
