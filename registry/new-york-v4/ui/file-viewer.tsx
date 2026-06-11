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
  const controller = React.useMemo(() => new AbortController(), [descriptorKey])
  useIsomorphicLayoutEffect(() => {
    return () => controller.abort()
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
      fileName={descriptor.downloadName}
      src={descriptor.src}
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
  src,
  className,
  bare = false,
  isolateStyles = false,
  descriptorSignal,
}: FileViewerProps & {
  descriptor: FileDescriptor
  descriptorSignal: AbortSignal
}) {
  const { category, downloadName } = descriptor

  switch (category) {
    case "pdf":
      return (
        <PdfViewer
          src={src}
          className={className}
          bare={bare}
          downloadFileName={downloadName}
        />
      )
    case "docx":
      return <DocxViewer src={src} className={className} bare={bare} />
    case "image":
      return (
        <ImageViewer
          src={src}
          className={className}
          bare={bare}
          downloadFileName={downloadName}
        />
      )
    case "pptx":
      return (
        <PptxViewer
          src={src}
          className={className}
          bare={bare}
          downloadFileName={downloadName}
        />
      )
    case "xlsx":
      return (
        <XlsxViewer
          src={src}
          className={className}
          bare={bare}
          downloadFileName={downloadName}
          isolateStyles={isolateStyles}
        />
      )
    case "csv":
      return (
        <CsvDocViewer
          src={src}
          fileName={downloadName}
          mimeType={descriptor.mimeType}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "markdown":
      return (
        <MarkdownDocViewer
          src={src}
          fileName={downloadName}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "html":
      return (
        <HtmlDocViewer
          src={src}
          fileName={downloadName}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "text":
      return (
        <TextDocViewer
          src={src}
          fileName={downloadName}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
          descriptorSignal={descriptorSignal}
        />
      )
    default:
      return (
        <UnsupportedCard
          src={src}
          fileName={downloadName}
          className={className}
          bare={bare}
        />
      )
  }
}
