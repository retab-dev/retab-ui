"use client"

import * as React from "react"

import { type ViewerResource } from "@/lib/viewer-resource"

import { isProseTextDescriptor, type FileDescriptor } from "./file-viewer-core"
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
const PretextMarkdownViewer = React.lazy(() =>
  import("@/components/ui/pretext-markdown-viewer").then((m) => ({
    default: m.PretextMarkdownViewer,
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
  descriptor: FileDescriptor
  descriptorSignal: AbortSignal
  isolateStyles: boolean
  leafControls: boolean
  leafDownload: boolean
  resource: ViewerResource
}

export function FileViewerRoute({
  descriptor,
  className,
  bare = false,
  isolateStyles,
  descriptorSignal,
  resource,
  leafControls,
  leafDownload,
}: FileViewerRouteProps) {
  const { category } = descriptor
  const directLoadUrl = resource.content.directUrl ?? undefined

  if (descriptor.source.kind === "text") {
    if (category === "csv") {
      return (
        <CsvFileContent
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "markdown") {
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          download={leafDownload}
          bare={bare}
        />
      )
    }
    if (category === "html") {
      return (
        <HtmlFileContent
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    }
    if (category === "text") {
      return renderTextViewer({
        descriptor,
        resource,
        className,
        bare,
        download: leafDownload,
      })
    }
    return (
      <UnsupportedCard
        resource={resource}
        className={className}
        bare={bare}
        showDownload={leafDownload}
      />
    )
  }

  if (!directLoadUrl) {
    if (category === "pdf" && descriptor.source.kind === "blob") {
      return (
        <PdfResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
          controls={leafControls}
        />
      )
    }
    if (category === "image" && descriptor.source.kind === "blob") {
      return (
        <ImageResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
          controls={leafControls}
        />
      )
    }
    if (category === "pptx" && descriptor.source.kind === "blob") {
      return (
        <PptxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
          controls={leafControls}
        />
      )
    }
    if (category === "csv" && descriptor.source.kind === "blob") {
      return (
        <CsvFileContent
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "html" && descriptor.source.kind === "blob") {
      return (
        <HtmlFileContent
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    }
    if (category === "docx" && descriptor.source.kind === "blob") {
      return (
        <DocxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
          controls={leafControls}
        />
      )
    }
    if (category === "xlsx" && descriptor.source.kind === "blob") {
      return (
        <XlsxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "markdown" && descriptor.source.kind === "blob") {
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          download={leafDownload}
          bare={bare}
        />
      )
    }
    if (category === "text" && descriptor.source.kind === "blob") {
      return renderTextViewer({
        descriptor,
        resource,
        className,
        bare,
        download: leafDownload,
      })
    }
    return (
      <UnsupportedCard
        resource={resource}
        className={className}
        bare={bare}
        showDownload={leafDownload}
      />
    )
  }

  switch (category) {
    case "pdf":
      return (
        <PdfResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
        />
      )
    case "docx":
      return (
        <DocxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
        />
      )
    case "image":
      return (
        <ImageResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
        />
      )
    case "pptx":
      return (
        <PptxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
        />
      )
    case "xlsx":
      return (
        <XlsxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          download={leafDownload}
          isolateStyles={isolateStyles}
        />
      )
    case "csv":
      return (
        <CsvFileContent
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "markdown":
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          download={leafDownload}
          bare={bare}
        />
      )
    case "html":
      return (
        <HtmlFileContent
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "text":
      return renderTextViewer({
        descriptor,
        resource,
        className,
        bare,
        download: leafDownload,
      })
    default:
      return (
        <UnsupportedCard
          resource={resource}
          className={className}
          bare={bare}
          showDownload={leafDownload}
        />
      )
  }
}

function renderTextViewer({
  descriptor,
  resource,
  className,
  bare,
  download,
}: {
  descriptor: FileDescriptor
  resource: ViewerResource
  className?: string
  bare: boolean
  download?: boolean
}) {
  const source = resource.descriptor.source
  if (isProseTextDescriptor(descriptor)) {
    return (
      <ProseTextViewer
        source={source}
        className={className}
        download={download}
        bare={bare}
        mode="text"
      />
    )
  }
  return (
    <CodeTextViewer
      source={source}
      className={className}
      download={download}
      bare={bare}
    />
  )
}
