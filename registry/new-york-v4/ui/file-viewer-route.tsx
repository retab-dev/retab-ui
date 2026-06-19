"use client"

import * as React from "react"

import { type ViewerResource } from "@/lib/viewer-resource"

import {
  isProseTextDescriptor,
  type FileCategory,
  type FileDescriptor,
  type FileViewerDocumentChrome,
  type FileViewerFallbackSize,
} from "./file-viewer-core"
import { CsvFileContent } from "./file-viewer-csv-viewer"
import { UnsupportedCard } from "./file-viewer-fallback"
import { HtmlFileContent } from "./file-viewer-html-viewer"

const PdfResourceContent = React.lazy(() =>
  import("@/components/ui/pdf-viewer").then((m) => ({
    default: m.PdfResourceContent,
  }))
)
const DocxResourceContent = React.lazy(() =>
  import("@/components/ui/docx-viewer").then((m) => ({
    default: m.DocxResourceContent,
  }))
)
const ImageResourceContent = React.lazy(() =>
  import("@/components/ui/image-viewer").then((m) => ({
    default: m.ImageResourceContent,
  }))
)
const PptxResourceContent = React.lazy(() =>
  import("@/components/ui/pptx-viewer").then((m) => ({
    default: m.PptxResourceContent,
  }))
)
const XlsxResourceContent = React.lazy(() =>
  import("@/components/ui/xlsx-viewer").then((m) => ({
    default: m.XlsxResourceContent,
  }))
)
const ProseTextViewer = React.lazy(() =>
  import("@/components/ui/text-viewer-chenglou").then((m) => ({
    default: m.ChenglouTextViewer,
  }))
)
const MarkdownViewer = React.lazy(() =>
  import("@/components/ui/markdown-viewer").then((m) => ({
    default: m.MarkdownViewer,
  }))
)
const CodeTextViewer = React.lazy(() =>
  import("@/components/ui/code-viewer").then((m) => ({
    default: m.CodeViewer,
  }))
)

export type FileViewerRouteProps = {
  bare?: boolean
  className?: string
  documentChrome: FileViewerDocumentChrome
  descriptor: FileDescriptor
  descriptorSignal: AbortSignal
  fallbackFrameSize?: FileViewerFallbackSize
  fallbackSlideSize?: FileViewerFallbackSize
  isolateStyles: boolean
  resource: ViewerResource
}

type RenderContext = {
  descriptor: FileDescriptor
  resource: ViewerResource
  className?: string
  bare: boolean
  controls: boolean
  fallbackFrameSize?: FileViewerFallbackSize
  fallbackSlideSize?: FileViewerFallbackSize
  isolateStyles: boolean
  descriptorSignal: AbortSignal
}

// Categories a text-kind source (raw text, no blob/url backing) can render.
const TEXT_SOURCE_CATEGORIES = new Set<FileCategory>([
  "csv",
  "markdown",
  "html",
  "text",
])

const RENDERERS: Partial<
  Record<FileCategory, (ctx: RenderContext) => React.ReactNode>
> = {
  pdf: ({ resource, className, bare, controls }) => (
    <PdfResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
    />
  ),
  docx: ({ resource, className, bare, controls }) => (
    <DocxResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
    />
  ),
  image: ({ resource, className, bare, controls, fallbackFrameSize }) => (
    <ImageResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
      fallbackFrameSize={fallbackFrameSize}
    />
  ),
  pptx: ({ resource, className, bare, controls, fallbackSlideSize }) => (
    <PptxResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
      fallbackSlideSize={fallbackSlideSize}
    />
  ),
  xlsx: ({ resource, className, bare, controls, isolateStyles }) => (
    <XlsxResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
      isolateStyles={isolateStyles}
    />
  ),
  csv: ({ resource, className, bare, controls, isolateStyles }) => (
    <CsvFileContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      isolateStyles={isolateStyles}
    />
  ),
  html: ({ resource, className, bare, controls, descriptorSignal }) => (
    <HtmlFileContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      descriptorSignal={descriptorSignal}
    />
  ),
  markdown: ({ resource, className, bare, controls }) => (
    <MarkdownViewer
      source={resource.descriptor.source}
      className={className}
      controls={controls}
      download
      bare={bare}
      urlFragmentNavigation={false}
    />
  ),
  text: renderTextViewer,
}

export function FileViewerRoute({
  descriptor,
  className,
  documentChrome,
  bare = false,
  isolateStyles,
  descriptorSignal,
  fallbackFrameSize,
  fallbackSlideSize,
  resource,
}: FileViewerRouteProps) {
  const { category } = descriptor
  const standalone = documentChrome === "standalone"
  const isTextSource = descriptor.source.kind === "text"

  const renderer = RENDERERS[category]
  if (renderer && (!isTextSource || TEXT_SOURCE_CATEGORIES.has(category))) {
    return renderer({
      descriptor,
      resource,
      className,
      bare,
      controls: standalone,
      fallbackFrameSize,
      fallbackSlideSize,
      isolateStyles,
      descriptorSignal,
    })
  }

  return (
    <UnsupportedCard
      resource={resource}
      className={className}
      bare={bare}
      showDownload={standalone}
    />
  )
}

function renderTextViewer({
  descriptor,
  resource,
  className,
  bare,
  controls,
}: RenderContext): React.ReactNode {
  const source = resource.descriptor.source
  if (isProseTextDescriptor(descriptor)) {
    return (
      <ProseTextViewer
        source={source}
        className={className}
        controls={controls}
        download
        bare={bare}
        mode="text"
      />
    )
  }
  return (
    <CodeTextViewer
      source={source}
      className={className}
      controls={controls}
      download
      bare={bare}
    />
  )
}
