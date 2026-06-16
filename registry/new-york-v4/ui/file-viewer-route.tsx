"use client"

import * as React from "react"

import { type ViewerResource } from "@/lib/viewer-resource"

import {
  isProseTextDescriptor,
  type FileDescriptor,
  type FileViewerDocumentChrome,
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

type FileViewerRouteChrome = {
  exposeDownload: boolean
  localFallbackDownload: boolean
  localControls: boolean
}

type FileViewerRendererChrome = {
  controls: boolean
  download: boolean
}

type FileViewerLocalChrome = {
  controls: boolean
}

type FileViewerFallbackChrome = {
  showDownload: boolean
}

export type FileViewerRouteProps = {
  bare?: boolean
  className?: string
  chrome: FileViewerDocumentChrome
  descriptor: FileDescriptor
  descriptorSignal: AbortSignal
  isolateStyles: boolean
  resource: ViewerResource
}

export function FileViewerRoute({
  descriptor,
  className,
  chrome,
  bare = false,
  isolateStyles,
  descriptorSignal,
  resource,
}: FileViewerRouteProps) {
  const { category } = descriptor
  const directLoadUrl = resource.content.directUrl ?? undefined
  const routeChrome = fileViewerRouteChrome(chrome)
  const rendererChrome = fileViewerRendererChrome(routeChrome)
  const localChrome = fileViewerLocalChrome(routeChrome)
  const fallbackChrome = fileViewerFallbackChrome(routeChrome)

  if (descriptor.source.kind === "text") {
    if (category === "csv") {
      return (
        <CsvFileContent
          resource={resource}
          className={className}
          bare={bare}
          {...localChrome}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "markdown") {
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          {...rendererChrome}
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
          {...localChrome}
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
        ...rendererChrome,
      })
    }
    return (
      <UnsupportedCard
        resource={resource}
        className={className}
        bare={bare}
        {...fallbackChrome}
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
          {...rendererChrome}
        />
      )
    }
    if (category === "image" && descriptor.source.kind === "blob") {
      return (
        <ImageResourceContent
          resource={resource}
          className={className}
          bare={bare}
          {...rendererChrome}
        />
      )
    }
    if (category === "pptx" && descriptor.source.kind === "blob") {
      return (
        <PptxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          {...rendererChrome}
        />
      )
    }
    if (category === "csv" && descriptor.source.kind === "blob") {
      return (
        <CsvFileContent
          resource={resource}
          className={className}
          bare={bare}
          {...localChrome}
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
          {...localChrome}
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
          {...rendererChrome}
        />
      )
    }
    if (category === "xlsx" && descriptor.source.kind === "blob") {
      return (
        <XlsxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          {...rendererChrome}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "markdown" && descriptor.source.kind === "blob") {
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          {...rendererChrome}
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
        ...rendererChrome,
      })
    }
    return (
      <UnsupportedCard
        resource={resource}
        className={className}
        bare={bare}
        {...fallbackChrome}
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
          {...rendererChrome}
        />
      )
    case "docx":
      return (
        <DocxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          {...rendererChrome}
        />
      )
    case "image":
      return (
        <ImageResourceContent
          resource={resource}
          className={className}
          bare={bare}
          {...rendererChrome}
        />
      )
    case "pptx":
      return (
        <PptxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          {...rendererChrome}
        />
      )
    case "xlsx":
      return (
        <XlsxResourceContent
          resource={resource}
          className={className}
          bare={bare}
          {...rendererChrome}
          isolateStyles={isolateStyles}
        />
      )
    case "csv":
      return (
        <CsvFileContent
          resource={resource}
          className={className}
          bare={bare}
          {...localChrome}
          isolateStyles={isolateStyles}
        />
      )
    case "markdown":
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          {...rendererChrome}
          bare={bare}
        />
      )
    case "html":
      return (
        <HtmlFileContent
          resource={resource}
          className={className}
          bare={bare}
          {...localChrome}
          descriptorSignal={descriptorSignal}
        />
      )
    case "text":
      return renderTextViewer({
        descriptor,
        resource,
        className,
        bare,
        ...rendererChrome,
      })
    default:
      return (
        <UnsupportedCard
          resource={resource}
          className={className}
          bare={bare}
          {...fallbackChrome}
        />
      )
  }
}

function fileViewerRouteChrome(
  chrome: FileViewerDocumentChrome
): FileViewerRouteChrome {
  const standalone = chrome === "standalone"

  return {
    exposeDownload: true,
    localFallbackDownload: standalone,
    localControls: standalone,
  }
}

function fileViewerRendererChrome(
  chrome: FileViewerRouteChrome
): FileViewerRendererChrome {
  return {
    controls: chrome.localControls,
    download: chrome.exposeDownload,
  }
}

function fileViewerLocalChrome(
  chrome: FileViewerRouteChrome
): FileViewerLocalChrome {
  return {
    controls: chrome.localControls,
  }
}

function fileViewerFallbackChrome(
  chrome: FileViewerRouteChrome
): FileViewerFallbackChrome {
  return {
    showDownload: chrome.localFallbackDownload,
  }
}

function renderTextViewer({
  descriptor,
  resource,
  className,
  bare,
  controls,
  download,
}: {
  descriptor: FileDescriptor
  resource: ViewerResource
  className?: string
  bare: boolean
  controls: boolean
  download?: boolean
}) {
  const source = resource.descriptor.source
  if (isProseTextDescriptor(descriptor)) {
    return (
      <ProseTextViewer
        source={source}
        className={className}
        controls={controls}
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
      controls={controls}
      download={download}
      bare={bare}
    />
  )
}
