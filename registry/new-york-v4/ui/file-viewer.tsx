"use client"

import * as React from "react"

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
  const descriptor = resolveFileDescriptor(props)
  const descriptorKey = descriptorResetKey(descriptor)
  const descriptorSignal = useDescriptorSignal(descriptorKey)
  const fallback = (
    <ViewerFallback
      category={descriptor.category}
      fileName={descriptor.downloadFileName}
      src={descriptor.loadUrl}
      className={props.className}
      bare={props.bare}
    />
  )

  if (!isClient) return fallback

  return (
    <FileErrorBoundary
      key={descriptorKey}
      descriptor={descriptor}
      className={props.className}
      resetKey={descriptorKey}
    >
      <React.Suspense fallback={fallback}>
        <FileViewerRoute
          {...props}
          descriptor={descriptor}
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
}: FileViewerProps & {
  descriptor: FileDescriptor
  descriptorSignal: AbortSignal
}) {
  const { category, downloadFileName, loadUrl } = descriptor
  if (descriptor.source.kind === "text") {
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
        fileName={downloadFileName}
        className={className}
        bare={bare}
      />
    )
  }

  if (!loadUrl) {
    if (category === "pdf" && descriptor.source.kind === "blob") {
      return (
        <PdfViewer
          source={descriptor.source}
          className={className}
          bare={bare}
          downloadFileName={downloadFileName}
        />
      )
    }
    if (category === "image" && descriptor.source.kind === "blob") {
      return (
        <ImageViewer
          source={descriptor.source}
          className={className}
          bare={bare}
          downloadFileName={downloadFileName}
        />
      )
    }
    if (category === "pptx" && descriptor.source.kind === "blob") {
      return (
        <PptxViewer
          source={descriptor.source}
          className={className}
          bare={bare}
          downloadFileName={downloadFileName}
        />
      )
    }
    return (
      <UnsupportedCard
        fileName={downloadFileName}
        downloadHref={descriptor.downloadHref}
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
          downloadFileName={downloadFileName}
        />
      )
    case "docx":
      return <DocxViewer src={loadUrl} className={className} bare={bare} />
    case "image":
      return (
        <ImageViewer
          source={descriptor.source}
          className={className}
          bare={bare}
          downloadFileName={downloadFileName}
        />
      )
    case "pptx":
      return (
        <PptxViewer
          source={descriptor.source}
          className={className}
          bare={bare}
          downloadFileName={downloadFileName}
        />
      )
    case "xlsx":
      return (
        <XlsxViewer
          src={loadUrl}
          className={className}
          bare={bare}
          downloadFileName={downloadFileName}
          isolateStyles={isolateStyles}
        />
      )
    case "csv":
      return (
        <CsvDocViewer
          src={loadUrl}
          fileName={downloadFileName}
          mimeType={descriptor.mimeType}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "markdown":
      return (
        <MarkdownDocViewer
          src={loadUrl}
          fileName={downloadFileName}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "html":
      return (
        <HtmlDocViewer
          src={loadUrl}
          fileName={downloadFileName}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "text":
      return (
        <TextDocViewer
          src={loadUrl}
          fileName={downloadFileName}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
          descriptorSignal={descriptorSignal}
        />
      )
    default:
      return (
        <UnsupportedCard
          src={loadUrl}
          fileName={downloadFileName}
          className={className}
          bare={bare}
        />
      )
  }
}
