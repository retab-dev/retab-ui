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

const PdfResourceViewer = React.lazy(() =>
  import("@/components/ui/pdf-viewer").then((m) => ({
    default: m.PdfResourceViewer,
  }))
)
const DocxResourceViewer = React.lazy(() =>
  import("@/components/ui/docx-viewer").then((m) => ({
    default: m.DocxResourceViewer,
  }))
)
const ImageResourceViewer = React.lazy(() =>
  import("@/components/ui/image-viewer").then((m) => ({
    default: m.ImageResourceViewer,
  }))
)
const PptxResourceViewer = React.lazy(() =>
  import("@/components/ui/pptx-viewer").then((m) => ({
    default: m.PptxResourceViewer,
  }))
)
const XlsxResourceViewer = React.lazy(() =>
  import("@/components/ui/xlsx-viewer").then((m) => ({
    default: m.XlsxResourceViewer,
  }))
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
    () => createViewerResource(props.source, props.as),
    [props.source, props.as]
  )
  const descriptor = resolveFileDescriptor(props)
  const descriptorKey = descriptorResetKey(descriptor)
  const descriptorSignal = useDescriptorSignal(descriptorKey)
  const fallback = (
    <ViewerFallback
      resource={resource}
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
  const { category } = descriptor
  const directLoadUrl = resource.content.directUrl ?? undefined
  if (descriptor.source.kind === "text") {
    if (category === "csv") {
      return (
        <CsvDocViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "markdown") {
      return (
        <MarkdownDocViewer
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    }
    if (category === "html") {
      return (
        <HtmlDocViewer
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    }
    if (category === "text") {
      return (
        <TextDocViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
          descriptorSignal={descriptorSignal}
        />
      )
    }
    return (
      <UnsupportedCard resource={resource} className={className} bare={bare} />
    )
  }

  if (!directLoadUrl) {
    if (category === "pdf" && descriptor.source.kind === "blob") {
      return (
        <PdfResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "image" && descriptor.source.kind === "blob") {
      return (
        <ImageResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "pptx" && descriptor.source.kind === "blob") {
      return (
        <PptxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "csv" && descriptor.source.kind === "blob") {
      return (
        <CsvDocViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "html" && descriptor.source.kind === "blob") {
      return (
        <HtmlDocViewer
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    }
    if (category === "docx" && descriptor.source.kind === "blob") {
      return (
        <DocxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "xlsx" && descriptor.source.kind === "blob") {
      return (
        <XlsxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    return (
      <UnsupportedCard resource={resource} className={className} bare={bare} />
    )
  }

  switch (category) {
    case "pdf":
      return (
        <PdfResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    case "docx":
      return (
        <DocxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    case "image":
      return (
        <ImageResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    case "pptx":
      return (
        <PptxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    case "xlsx":
      return (
        <XlsxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "csv":
      return (
        <CsvDocViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "markdown":
      return (
        <MarkdownDocViewer
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "html":
      return (
        <HtmlDocViewer
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "text":
      return (
        <TextDocViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
          descriptorSignal={descriptorSignal}
        />
      )
    default:
      return (
        <UnsupportedCard
          resource={resource}
          className={className}
          bare={bare}
        />
      )
  }
}
