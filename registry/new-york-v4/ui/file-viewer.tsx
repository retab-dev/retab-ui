"use client"

import * as React from "react"

import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"

import {
  FileErrorBoundary,
  UnsupportedCard,
  ViewerFallback,
} from "./file-viewer-chrome"
import {
  descriptorResetKey,
  resolveFileDescriptor,
  type FileCategory,
  type FileDescriptor,
  type FileViewerProps,
} from "./file-viewer-core"
import { CsvDocViewer } from "./file-viewer-csv-viewer"
import { HtmlDocViewer } from "./file-viewer-html-viewer"
import { MarkdownDocViewer } from "./file-viewer-markdown-viewer"
import { TextDocViewer } from "./file-viewer-text-viewer"

export { type FileCategory, type FileViewerProps } from "./file-viewer-core"

const PdfViewer = React.lazy(() =>
  import("@/components/ui/pdf-viewer").then((m) => ({ default: m.PdfViewer }))
)
const DocxViewer = React.lazy(() =>
  import("@/components/ui/docx-viewer").then((m) => ({ default: m.DocxViewer }))
)
const ImageViewer = React.lazy(() =>
  import("@/components/ui/image-viewer").then((m) => ({
    default: m.ImageViewer,
  }))
)
const PptxViewer = React.lazy(() =>
  import("@/components/ui/pptx-viewer").then((m) => ({ default: m.PptxViewer }))
)
const XlsxViewer = React.lazy(() =>
  import("@/components/ui/xlsx-viewer").then((m) => ({ default: m.XlsxViewer }))
)
const TextViewer = React.lazy(() =>
  import("@/components/ui/text-viewer").then((m) => ({ default: m.TextViewer }))
)

function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

function useDescriptorSignal(descriptorKey: string): AbortSignal {
  const controller = React.useMemo(() => {
    void descriptorKey
    return new AbortController()
  }, [descriptorKey])
  const abortTimerRef = React.useRef<{
    controller: AbortController
    timer: ReturnType<typeof setTimeout>
  } | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (abortTimerRef.current?.controller === controller) {
      clearTimeout(abortTimerRef.current.timer)
      abortTimerRef.current = null
    }

    return () => {
      const abortTimer = {
        controller,
        timer: setTimeout(() => {
          controller.abort()
          if (abortTimerRef.current === abortTimer) {
            abortTimerRef.current = null
          }
        }, 0),
      }
      abortTimerRef.current = abortTimer
    }
  }, [controller])

  return controller.signal
}

export function FileViewer(props: FileViewerProps) {
  const isClient = useIsClient()
  const resource = React.useMemo(
    () => createViewerResource(props.source),
    [props.source]
  )
  const descriptor = resolveFileDescriptor(props)
  const descriptorKey = descriptorResetKey(descriptor)
  const descriptorSignal = useDescriptorSignal(descriptorKey)
  const directLoad = resource.getDirectLoad()
  const fallback = (
    <ViewerFallback
      category={descriptor.category}
      fileName={descriptor.fileName}
      src={directLoad.kind === "url" ? directLoad.url : undefined}
      className={props.className}
      bare={props.bare}
    />
  )

  if (!isClient) return fallback

  return (
    <FileErrorBoundary
      key={descriptorKey}
      descriptor={descriptor}
      resource={resource}
      className={props.className}
      resetKey={descriptorKey}
    >
      <React.Suspense fallback={fallback}>
        <FileViewerRoute
          {...props}
          descriptor={descriptor}
          resource={resource}
          descriptorSignal={descriptorSignal}
        />
      </React.Suspense>
    </FileErrorBoundary>
  )
}

function FileViewerRoute({
  descriptor,
  className,
  bare = false,
  isolateStyles = false,
  descriptorSignal,
  resource,
}: FileViewerProps & {
  descriptor: FileDescriptor
  resource: ViewerResource
  descriptorSignal: AbortSignal
}) {
  const { category, fileName } = descriptor
  const directLoad = resource.getDirectLoad()
  const directLoadUrl = directLoad.kind === "url" ? directLoad.url : undefined
  if (descriptor.source.kind === "text") {
    if (category === "html") {
      return (
        <HtmlDocViewer
          html={descriptor.source.text}
          fileName={fileName}
          downloadAction={resource.getOriginalDownload()}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "text") {
      return (
        <TextViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    }
    return (
      <UnsupportedCard
        fileName={fileName}
        downloadAction={resource.getOriginalDownload()}
        className={className}
        bare={bare}
      />
    )
  }

  if (!directLoadUrl) {
    if (category === "pdf" && descriptor.source.kind === "blob") {
      return (
        <PdfViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "image" && descriptor.source.kind === "blob") {
      return (
        <ImageViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "pptx" && descriptor.source.kind === "blob") {
      return (
        <PptxViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "csv" && descriptor.source.kind === "blob") {
      return (
        <CsvDocViewer
          source={descriptor.source}
          fileName={fileName}
          mimeType={descriptor.mimeType}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "html" && descriptor.source.kind === "blob") {
      return (
        <HtmlDocViewer
          blob={descriptor.source.blob}
          src={directLoadUrl}
          fileName={fileName}
          downloadAction={resource.getOriginalDownload()}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "docx" && descriptor.source.kind === "blob") {
      return (
        <DocxViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "xlsx" && descriptor.source.kind === "blob") {
      return (
        <XlsxViewer
          source={descriptor.source}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    return (
      <UnsupportedCard
        fileName={fileName}
        downloadAction={resource.getOriginalDownload()}
        className={className}
        bare={bare}
      />
    )
  }

  switch (category) {
    case "pdf":
      return (
        <PdfViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    case "docx":
      return (
        <DocxViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    case "image":
      return (
        <ImageViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    case "pptx":
      return (
        <PptxViewer
          source={descriptor.source}
          className={className}
          bare={bare}
        />
      )
    case "xlsx":
      return (
        <XlsxViewer
          source={descriptor.source}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "csv":
      return (
        <CsvDocViewer
          source={descriptor.source}
          fileName={fileName}
          mimeType={descriptor.mimeType}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "markdown":
      return (
        <MarkdownDocViewer
          src={directLoadUrl}
          fileName={fileName}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "html":
      return (
        <HtmlDocViewer
          src={directLoadUrl}
          fileName={fileName}
          downloadAction={resource.getOriginalDownload()}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "text":
      return (
        <TextDocViewer
          src={directLoadUrl}
          fileName={fileName}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
          descriptorSignal={descriptorSignal}
        />
      )
    default:
      return (
        <UnsupportedCard
          src={directLoadUrl}
          downloadAction={resource.getOriginalDownload()}
          fileName={fileName}
          className={className}
          bare={bare}
        />
      )
  }
}
