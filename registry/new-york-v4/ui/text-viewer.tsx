"use client"

import * as React from "react"

import {
  createViewerResource,
  type ViewerContentIdentity,
  type ViewerResource,
} from "@/lib/viewer-resource"
import { TextViewerFallback } from "@/components/ui/text-viewer-chrome"
import { TextViewerContent } from "@/components/ui/text-viewer-content"
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@/components/ui/text-viewer-resource"
import type {
  TextViewerHandle,
  TextViewerProps,
} from "@/components/ui/text-viewer-types"
import { useIsClient } from "@/components/ui/use-is-client"
import { ViewerErrorBoundary } from "@/components/ui/viewer-error"

export type {
  TextDocumentSource,
  TextLineRange,
  TextViewerHandle,
  TextViewerProps,
} from "@/components/ui/text-viewer-types"

export const TextViewer = React.forwardRef<TextViewerHandle, TextViewerProps>(
  function TextViewer(props, ref) {
    const [retryState, setRetryState] = React.useState({
      contentKey: "",
      version: 0,
    })
    const isClient = useIsClient()
    const { source } = props
    const resource = React.useMemo(() => createViewerResource(source), [source])
    const contentBaseKey = textViewerContentBaseKey(resource.content, props)
    const retryVersion =
      retryState.contentKey === contentBaseKey ? retryState.version : 0
    const resetKey = textViewerResetKey(resource, props, retryVersion)
    const contentResetKey = textViewerContentResetKey(
      contentBaseKey,
      retryVersion
    )

    if (source.kind !== "text" && !isClient) {
      return (
        <TextViewerFallback
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
          props.toolbar === false ? null : textViewerDownloadAction(resource)
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
            <TextViewerFallback
              className={props.className}
              toolbar={props.toolbar}
              bare={props.bare}
            />
          }
        >
          <TextViewerContent
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

function textViewerDownloadAction(resource: ViewerResource) {
  return resource.originalDownload
}

function textViewerResetKey(
  resource: ViewerResource,
  props: Pick<TextViewerProps, "maxBytes" | "maxLines">,
  retryVersion: number
): string {
  const [maxBytesKey, maxLinesKey] = textViewerBoundsResetKey(props)
  return [resource.keys.resource, retryVersion, maxBytesKey, maxLinesKey].join(
    "\u0000"
  )
}

function textViewerContentResetKey(
  contentBaseKey: string,
  retryVersion: number
): string {
  return [contentBaseKey, retryVersion].join("\u0000")
}

function textViewerContentBaseKey(
  content: ViewerContentIdentity,
  props: Pick<TextViewerProps, "maxBytes" | "maxLines">
): string {
  const [maxBytesKey, maxLinesKey] = textViewerBoundsResetKey(props)
  return [content.key, maxBytesKey, maxLinesKey].join("\u0000")
}

function textViewerBoundsResetKey(
  props: Pick<TextViewerProps, "maxBytes" | "maxLines">
) {
  return [
    textViewerBoundResetKeyPart(props.maxBytes, DEFAULT_MAX_BYTES),
    textViewerBoundResetKeyPart(props.maxLines, DEFAULT_MAX_LINES),
  ] as const
}

function textViewerBoundResetKeyPart(
  value: number | undefined,
  defaultValue: number
) {
  return String(value === undefined ? defaultValue : value)
}
