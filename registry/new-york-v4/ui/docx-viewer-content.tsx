"use client"

import * as React from "react"

import { getDocxDocumentResource } from "@/lib/docx-document-resource"
import { isAbortError, isResourceError } from "@/lib/viewer-errors"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  DocxSkeleton,
  DocxViewerBody,
  DocxViewerFrame,
} from "./docx-viewer-chrome"
import { DOCX_SCOPED_STYLES, toDocxFormatError } from "./docx-viewer-core"
import { useDocxHighlight } from "./docx-viewer-highlight"
import type { DocxPageLayout } from "./docx-viewer-layout"
import {
  commitDocxRender,
  loadDocxPreview,
  renderDocxPreview,
} from "./docx-viewer-render"
import { useDocxViewerScale } from "./docx-viewer-scale"
import { useDocxViewerScroll } from "./docx-viewer-scroll"
import {
  buildDocxRenderIndex,
  resolveDocxTarget,
  type DocxRenderIndex,
} from "./docx-viewer-targets"
import type {
  DocxResourceContentProps,
  DocxViewerHandle,
} from "./docx-viewer-types"
import {
  useViewerControlsRegistration,
  ViewerControls,
  ViewerControlsSkeleton,
  type ViewerControlsState,
} from "./viewer-controls"

export function DocxViewerContent({
  bare = false,
  className,
  defaultScale,
  download = true,
  forwardedRef,
  highlight,
  onScaleChange,
  onScrollProgressChange,
  onVisiblePageChange,
  resource,
  scale: controlledScale,
  controls = true,
}: DocxResourceContentProps & {
  forwardedRef?: React.ForwardedRef<DocxViewerHandle>
}) {
  const docxPreviewPromise = loadDocxPreview()
  void docxPreviewPromise.catch(() => undefined)
  const buffer = React.use(
    getDocxDocumentResource(resource.content, { retainRejected: true })
  )
  const [containerWidth, setContainerWidth] = React.useState<number | null>(
    null
  )
  const [numPages, setNumPages] = React.useState(0)
  const [pageWidth, setPageWidth] = React.useState<number | null>(null)
  const [renderIndex, setRenderIndex] = React.useState<DocxRenderIndex | null>(
    null
  )
  const [pageLayout, setPageLayout] = React.useState<DocxPageLayout | null>(
    null
  )
  const [ready, setReady] = React.useState(false)
  const [renderError, setRenderError] = React.useState<Error | null>(null)
  if (renderError) throw renderError

  const { fitWidth, scale, zoomIn, zoomOut } = useDocxViewerScale({
    containerWidth,
    defaultScale,
    onScaleChange,
    pageWidth,
    resetKey: resource.keys.resource,
    scale: controlledScale,
  })
  const {
    currentPage,
    handleScroll,
    measureScroll,
    resetScroll,
    scrollViewportRef,
  } = useDocxViewerScroll({
    layoutKey: scale,
    pageLayout,
    onScrollProgressChange,
    onVisiblePageChange,
    ready,
    scale,
  })
  const scaleRef = React.useRef(scale)
  React.useEffect(() => {
    scaleRef.current = scale
  })

  const containerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setContainerWidth(el.clientWidth)
    if (typeof ResizeObserver === "undefined") return
    let frame = 0
    let latest = el.clientWidth
    let observer: ResizeObserver | null = null
    try {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries)
          latest = (entry.target as HTMLElement).clientWidth
        if (frame) return
        frame = -1
        const requestedFrame = requestAnimationFrame(() => {
          frame = 0
          setContainerWidth(latest)
        })
        if (frame === -1) frame = requestedFrame
      })
      observer.observe(el)
    } catch {
      if (frame > 0) cancelAnimationFrame(frame)
      observer?.disconnect()
      return
    }
    return () => {
      if (frame > 0) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const renderIndexRef = React.useRef<DocxRenderIndex | null>(null)
  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setReady(false)
    setNumPages(0)
    setRenderIndex(null)
    setPageLayout(null)
    renderIndexRef.current = null
    resetScroll()
    host.replaceChildren()
    renderDocxPreview(buffer, docxPreviewPromise)
      .then((renderHost) => {
        if (cancelled) return
        const result = commitDocxRender({
          host,
          renderHost,
          scale: scaleRef.current,
        })
        const nextRenderIndex = buildDocxRenderIndex(host)
        renderIndexRef.current = nextRenderIndex
        setRenderIndex(nextRenderIndex)
        setNumPages(result.numPages)
        setPageWidth(result.pageWidth)
        setPageLayout(result.pageLayout)
        setReady(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setRenderError(
            isResourceError(err) || isAbortError(err)
              ? err
              : toDocxFormatError(err, {
                  kind: "render_failed",
                  message: "Failed to render DOCX.",
                })
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [buffer, docxPreviewPromise, resetScroll])

  React.useEffect(() => {
    if (ready) measureScroll()
  }, [measureScroll, ready, scale])

  React.useEffect(() => {
    renderIndexRef.current = renderIndex
  }, [renderIndex])

  const highlightName = useDocxHighlight({
    highlight,
    renderIndex,
    ready,
  })
  useDocxControlsRegistration({
    currentPage,
    download,
    downloadAction: resource.originalDownload,
    fitWidth,
    numPages,
    ready,
    scale,
    zoomIn,
    zoomOut,
  })

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToTarget: (target, options) => {
        const index = renderIndexRef.current
        if (!index) return
        const node = resolveDocxTarget(index, target)?.startContainer
        const el =
          node?.nodeType === Node.ELEMENT_NODE
            ? (node as HTMLElement)
            : (node?.parentElement ?? null)
        el?.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: options?.behavior ?? "smooth",
          ...options,
        })
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    [scrollViewportRef]
  )

  return (
    <DocxViewerFrame bare={bare} className={className}>
      <style>{DOCX_SCOPED_STYLES}</style>
      <style>{`::highlight(${highlightName}){background-color:color-mix(in oklab, var(--primary) 22%, transparent);}`}</style>
      {controls ? (
        ready ? (
          <ViewerControls
            position={{
              kind: "page",
              current: currentPage,
              total: numPages,
            }}
            zoom={{
              scale,
              onZoomOut: zoomOut,
              onZoomIn: zoomIn,
              onFit: fitWidth,
            }}
            downloads={
              download && resource.originalDownload
                ? [resource.originalDownload]
                : []
            }
          />
        ) : (
          <ViewerControlsSkeleton position zoom download={download} />
        )
      ) : null}
      <DocxViewerBody>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportRef={scrollViewportRef}
          viewportProps={{ onScroll: handleScroll }}
        >
          <div ref={containerRef} className="flex flex-col items-center p-4">
            {!ready ? <DocxSkeleton /> : null}
            <div
              ref={hostRef}
              className={
                ready
                  ? "w-full opacity-100 transition-opacity duration-200"
                  : "w-full opacity-0 transition-opacity duration-200"
              }
              style={{ zoom: scale }}
            />
          </div>
        </ScrollArea>
      </DocxViewerBody>
    </DocxViewerFrame>
  )
}

function useDocxControlsRegistration({
  currentPage,
  download,
  downloadAction,
  fitWidth,
  numPages,
  ready,
  scale,
  zoomIn,
  zoomOut,
}: {
  currentPage: number
  download: boolean
  downloadAction: NonNullable<ViewerControlsState["downloads"]>[number]
  fitWidth: () => void
  numPages: number
  ready: boolean
  scale: number
  zoomIn: () => void
  zoomOut: () => void
}) {
  const onControlsChange = useViewerControlsRegistration()
  const controlsState = React.useMemo<ViewerControlsState>(
    () => ({
      loading: !ready,
      position: ready
        ? {
            kind: "page",
            current: currentPage,
            total: numPages,
          }
        : null,
      zoom: ready
        ? {
            scale,
            onZoomOut: zoomOut,
            onZoomIn: zoomIn,
            onFit: fitWidth,
          }
        : null,
      downloads: download && downloadAction ? [downloadAction] : [],
    }),
    [
      currentPage,
      download,
      downloadAction,
      fitWidth,
      numPages,
      ready,
      scale,
      zoomIn,
      zoomOut,
    ]
  )

  React.useEffect(() => {
    if (!onControlsChange) return
    onControlsChange(controlsState)
    return () => onControlsChange(null)
  }, [onControlsChange, controlsState])
}
