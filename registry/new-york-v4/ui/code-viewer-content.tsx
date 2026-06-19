"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"

import {
  CodeViewerControls,
  codeViewerControlsState,
  CodeViewerFrame,
} from "./code-viewer-chrome"
import { scrollLineRangeMetricsIntoView } from "./code-viewer-layout"
import { useCodeProjectionScheduler } from "./code-viewer-projection-scheduler"
import { createCodeProjector } from "./code-viewer-projector"
import {
  clampCodeViewerScale,
  CODE_VIEWER_BASE_LINE_PX,
  CODE_VIEWER_BLOCK_PADDING,
} from "./code-viewer-scale"
import { createCodeSyntax } from "./code-viewer-syntax"
import { useCodeViewerSyntaxStyle } from "./code-viewer-syntax-style"
import type { CodeViewerHandle, CodeViewerProps } from "./code-viewer-types"
import { CodeViewerViewport } from "./code-viewer-viewport"
import { normalizeTextLineRange } from "./line-ranges"
import {
  readTextDocument,
  resolvedTextViewerBounds,
} from "./plain-text-resource"
import { useViewerControlsRegistration } from "./viewer-controls"

type CodeReadingAnchor = {
  lineIndex: number
  offsetPx: number
}

const CODE_VIEWER_DEFERRED_SYNTAX_LINE_COUNT = 500

export function CodeViewerContent({
  resource,
  className,
  controls = true,
  download = true,
  highlight,
  bare = false,
  maxBytes,
  maxLines,
  retryVersion,
  forwardedRef,
}: CodeViewerProps & {
  resource: ViewerResource
  retryVersion: number
  forwardedRef?: React.ForwardedRef<CodeViewerHandle>
}) {
  const bounds = resolvedTextViewerBounds({ maxBytes, maxLines })
  const textDocument = readTextDocument({
    content: resource.content,
    retryVersion,
    bounds,
  })
  const textLines = textDocument.lines
  const [syntaxVersion, setSyntaxVersion] = React.useState(0)
  const syntax = React.useMemo(
    () =>
      createCodeSyntax(resource, {
        deferTokens: textLines.length > CODE_VIEWER_DEFERRED_SYNTAX_LINE_COUNT,
        onTokensChanged: () => setSyntaxVersion((version) => version + 1),
      }),
    [resource, textLines.length]
  )
  const syntaxIdentity =
    syntaxVersion === 0
      ? syntax.identity
      : `${syntax.identity}\u0000${syntaxVersion}`
  const highlightStart = highlight?.start
  const highlightEnd = highlight?.end
  const highlightRange = React.useMemo(
    () =>
      normalizeTextLineRange(
        highlightStart == null || highlightEnd == null
          ? null
          : { start: highlightStart, end: highlightEnd },
        textLines.length
      ),
    [highlightStart, highlightEnd, textLines.length]
  )
  const downloadAction = download ? resource.originalDownload : null

  const [fontScale, setFontScale] = React.useState(1)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const rowHostRef = React.useRef<HTMLPreElement | null>(null)
  const pendingScrollAnchorRef = React.useRef<CodeReadingAnchor | null>(null)
  const projector = React.useMemo(() => createCodeProjector(), [])
  const lineHeight = CODE_VIEWER_BASE_LINE_PX * fontScale
  const contentIdentity = React.useMemo(
    () =>
      codeContentIdentity({
        contentKey: resource.content.key,
        maxBytes: bounds.maxBytes,
        maxLines: bounds.maxLines,
        retryVersion,
      }),
    [bounds.maxBytes, bounds.maxLines, resource.content.key, retryVersion]
  )
  const gutterWidth = `calc(${String(textLines.length).length + 1}ch + 1.25rem)`
  const layoutIdentity = codeLayoutIdentity({ gutterWidth, lineHeight })

  useCodeViewerSyntaxStyle()

  const commitFontScale = React.useCallback(
    (nextScale: number) => {
      const clampedScale = clampCodeViewerScale(nextScale)
      if (clampedScale === fontScale) return

      pendingScrollAnchorRef.current = captureCodeReadingAnchor({
        lineCount: textLines.length,
        lineHeight,
        viewportElement: viewportRef.current,
      })
      setFontScale(clampedScale)
    },
    [fontScale, lineHeight, textLines.length]
  )

  const zoom = React.useCallback(
    (factor: number) => commitFontScale(fontScale * factor),
    [commitFontScale, fontScale]
  )
  const onZoomOut = React.useCallback(() => zoom(1 / 1.2), [zoom])
  const onZoomIn = React.useCallback(() => zoom(1.2), [zoom])
  const onResetZoom = React.useCallback(
    () => commitFontScale(1),
    [commitFontScale]
  )

  React.useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current
    const viewportElement = viewportRef.current
    if (!anchor || !viewportElement) return

    pendingScrollAnchorRef.current = null
    viewportElement.scrollTop = restoreCodeReadingAnchor({
      anchor,
      lineCount: textLines.length,
      lineHeight,
    })
  }, [lineHeight, textLines.length])

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToLineRange: (range, options) => {
        scrollLineRangeMetricsIntoView({
          viewportElement: viewportRef.current,
          range: normalizeTextLineRange(range, textLines.length),
          lineHeight,
          paddingStart: CODE_VIEWER_BLOCK_PADDING,
          options,
        })
      },
      getViewportElement: () => viewportRef.current,
    }),
    [lineHeight, textLines.length]
  )

  React.useEffect(() => {
    scrollLineRangeMetricsIntoView({
      viewportElement: viewportRef.current,
      range: highlightRange,
      lineHeight,
      paddingStart: CODE_VIEWER_BLOCK_PADDING,
    })
  }, [highlightRange, lineHeight])

  const project = React.useCallback(() => {
    const rowHost = rowHostRef.current
    const viewport = viewportRef.current
    if (!rowHost || !viewport) return

    projector.project({
      contentIdentity,
      gutterWidth,
      highlightRange,
      layoutIdentity,
      lineHeight,
      rowHost,
      syntax,
      syntaxIdentity,
      textLines,
      viewport,
    })
  }, [
    contentIdentity,
    gutterWidth,
    highlightRange,
    layoutIdentity,
    lineHeight,
    projector,
    syntax,
    syntaxIdentity,
    textLines,
  ])

  useCodeProjectionScheduler({
    project,
    viewportRef,
  })

  React.useEffect(() => () => projector.destroy(), [projector])
  React.useEffect(() => {
    setSyntaxVersion(0)
    return () => syntax.destroy?.()
  }, [syntax])

  useCodeControlsRegistration({
    downloadAction,
    fontScale,
    lineCount: textLines.length,
    onResetZoom,
    onZoomIn,
    onZoomOut,
  })

  return (
    <CodeViewerFrame className={className} bare={bare}>
      {controls ? (
        <CodeViewerControls
          lineCount={textLines.length}
          fontScale={fontScale}
          downloadAction={downloadAction}
          onZoomOut={onZoomOut}
          onZoomIn={onZoomIn}
          onResetZoom={onResetZoom}
        />
      ) : null}
      <CodeViewerViewport
        contentIdentity={contentIdentity}
        fontScale={fontScale}
        gutterWidth={gutterWidth}
        lineCount={textLines.length}
        lineHeight={lineHeight}
        rowHostRef={rowHostRef}
        viewportRef={viewportRef}
      />
    </CodeViewerFrame>
  )
}

function useCodeControlsRegistration({
  downloadAction,
  fontScale,
  lineCount,
  onResetZoom,
  onZoomIn,
  onZoomOut,
}: {
  downloadAction: ViewerResource["originalDownload"] | null
  fontScale: number
  lineCount: number
  onResetZoom: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  const onControlsChange = useViewerControlsRegistration()
  const controlsState = React.useMemo(
    () =>
      codeViewerControlsState({
        downloadAction,
        fontScale,
        lineCount,
        onResetZoom,
        onZoomIn,
        onZoomOut,
      }),
    [downloadAction, fontScale, lineCount, onResetZoom, onZoomIn, onZoomOut]
  )

  React.useEffect(() => {
    if (!onControlsChange) return
    onControlsChange(controlsState)
    return () => onControlsChange(null)
  }, [onControlsChange, controlsState])
}

function captureCodeReadingAnchor({
  lineCount,
  lineHeight,
  viewportElement,
}: {
  lineCount: number
  lineHeight: number
  viewportElement: HTMLDivElement | null
}): CodeReadingAnchor | null {
  if (!viewportElement || lineCount <= 0 || lineHeight <= 0) return null

  const scrollTop = Math.max(0, viewportElement.scrollTop)
  const contentTop = Math.max(0, scrollTop - CODE_VIEWER_BLOCK_PADDING)
  const lineIndex = Math.min(
    lineCount - 1,
    Math.max(0, Math.floor(contentTop / lineHeight))
  )

  return {
    lineIndex,
    offsetPx: Math.max(0, contentTop - lineIndex * lineHeight),
  }
}

function restoreCodeReadingAnchor({
  anchor,
  lineCount,
  lineHeight,
}: {
  anchor: CodeReadingAnchor
  lineCount: number
  lineHeight: number
}) {
  if (lineCount <= 0 || lineHeight <= 0) return 0

  const lineIndex = Math.min(lineCount - 1, Math.max(0, anchor.lineIndex))
  return (
    CODE_VIEWER_BLOCK_PADDING +
    lineIndex * lineHeight +
    Math.min(anchor.offsetPx, Math.max(0, lineHeight - 1))
  )
}

function codeContentIdentity({
  contentKey,
  maxBytes,
  maxLines,
  retryVersion,
}: {
  contentKey: string
  maxBytes: number
  maxLines: number
  retryVersion: number
}) {
  return [contentKey, retryVersion, maxBytes, maxLines].join("\u0000")
}

function codeLayoutIdentity({
  gutterWidth,
  lineHeight,
}: {
  gutterWidth: string
  lineHeight: number
}) {
  return [lineHeight, gutterWidth].join("\u0000")
}
