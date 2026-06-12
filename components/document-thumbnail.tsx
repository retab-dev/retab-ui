"use client"

import * as React from "react"

import { toViewerErrorInfo, type ViewerErrorInfo } from "@/lib/viewer-errors"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import type { FileCategory, ViewerDescriptor } from "@/lib/viewer-source"
import {
  FileThumbnail,
  FileThumbnailShimmer,
} from "@/components/ui/file-thumbnail"
import {
  createThumbnailImageLoadError,
  CSV_THUMBNAIL_MAX_COLUMNS,
  CSV_THUMBNAIL_MAX_ROWS,
  TEXT_THUMBNAIL_MAX_BYTES,
  thumbnailCategoryFormat,
  TIFF_THUMBNAIL_TARGET_WIDTH,
  XLSX_THUMBNAIL_MAX_COLUMNS,
  XLSX_THUMBNAIL_MAX_ROWS,
} from "@/components/document-thumbnail/cache"
import {
  isTiffDescriptor,
  resolveThumbnailDescriptor,
} from "@/components/document-thumbnail/descriptor"
import { ThumbnailErrorBoundary } from "@/components/document-thumbnail/errors"
import {
  getThumbnailKey,
  getThumbnailRenderKey,
  thumbnailOption,
  type ThumbnailOption,
} from "@/components/document-thumbnail/keys"
import { CsvFirstRows } from "@/components/document-thumbnail/renderers/csv-thumbnail"
import { DocxFirstPage } from "@/components/document-thumbnail/renderers/docx-thumbnail"
import { HtmlFirstPage } from "@/components/document-thumbnail/renderers/html-thumbnail"
import { ImageFirstFrame } from "@/components/document-thumbnail/renderers/image-thumbnail"
import { MarkdownFirstPage } from "@/components/document-thumbnail/renderers/markdown-thumbnail"
import { PdfFirstPage } from "@/components/document-thumbnail/renderers/pdf-thumbnail"
import { PptxFirstSlide } from "@/components/document-thumbnail/renderers/pptx-thumbnail"
import { TextFirstLines } from "@/components/document-thumbnail/renderers/text-thumbnail"
import { TiffFirstPage } from "@/components/document-thumbnail/renderers/tiff-thumbnail"
import { XlsxFirstSheet } from "@/components/document-thumbnail/renderers/xlsx-thumbnail"
import {
  ANCHOR_OBJECT_POSITION,
  type DocumentThumbnailProps,
  type ThumbnailAnchor,
} from "@/components/document-thumbnail/types"

export { getThumbnailKey, getThumbnailRenderKey }
export type { DocumentThumbnailProps, ThumbnailAnchor }

type DocumentRenderer = (props: {
  resource: ViewerResource
  descriptor: ViewerDescriptor
  thumbnailKey: string
  anchor: ThumbnailAnchor
  onError: (error: unknown) => void
}) => React.ReactNode

interface ThumbnailErrorState {
  renderKey: string
  info: ViewerErrorInfo
}

const DOCUMENT_RENDERERS: Record<
  Exclude<FileCategory, "unsupported">,
  DocumentRenderer
> = {
  pdf: ({ resource, anchor }) => (
    <PdfFirstPage resource={resource} anchor={anchor} />
  ),
  xlsx: ({ resource, thumbnailKey }) => (
    <XlsxFirstSheet resource={resource} thumbnailKey={thumbnailKey} />
  ),
  pptx: ({ resource, thumbnailKey, anchor }) => (
    <PptxFirstSlide
      resource={resource}
      thumbnailKey={thumbnailKey}
      anchor={anchor}
    />
  ),
  docx: ({ resource }) => <DocxFirstPage resource={resource} />,
  image: ({ resource, descriptor, thumbnailKey, anchor, onError }) =>
    isTiffDescriptor(descriptor) ? (
      <TiffFirstPage
        resource={resource}
        thumbnailKey={thumbnailKey}
        anchor={anchor}
        onError={onError}
      />
    ) : (
      <ImageFirstFrame resource={resource} anchor={anchor} onError={onError} />
    ),
  csv: ({ resource, thumbnailKey }) => (
    <CsvFirstRows resource={resource} thumbnailKey={thumbnailKey} />
  ),
  markdown: ({ resource, thumbnailKey }) => (
    <MarkdownFirstPage resource={resource} thumbnailKey={thumbnailKey} />
  ),
  html: ({ resource, thumbnailKey }) => (
    <HtmlFirstPage resource={resource} thumbnailKey={thumbnailKey} />
  ),
  text: ({ resource, thumbnailKey }) => (
    <TextFirstLines resource={resource} thumbnailKey={thumbnailKey} />
  ),
}

/**
 * Generates a first-unit thumbnail for a document — page 1, first sheet, or
 * first slide — then drops it into the dependency-free `FileThumbnail` shell.
 */
export function DocumentThumbnail({
  source,
  as,
  className,
  previewAspectRatio = 3 / 4,
  anchor = "top-left",
  retryKey,
  onError,
}: DocumentThumbnailProps) {
  const descriptor = resolveThumbnailDescriptor({ source, as })
  const resource = React.useMemo(() => createViewerResource(source), [source])
  const thumbnailKey = getThumbnailKey({
    resource,
    descriptor,
    options: getThumbnailOptions(descriptor),
  })
  const renderKey = getThumbnailRenderKey({
    thumbnailKey,
    anchor,
    retryKey: retryKey ?? null,
  })
  const [errorState, setErrorState] =
    React.useState<ThumbnailErrorState | null>(null)
  const currentErrorState =
    errorState?.renderKey === renderKey ? errorState : null
  const directUrl = resource.content.directUrl

  if (descriptor.category === "unsupported") {
    return (
      <FileThumbnail
        file={{ name: descriptor.displayName, type: descriptor.mimeType ?? "" }}
        previewAspectRatio={previewAspectRatio}
        className={className}
      />
    )
  }

  if (
    descriptor.category === "image" &&
    !isTiffDescriptor(descriptor) &&
    directUrl
  ) {
    const failedDirectImage =
      currentErrorState?.info.format === "image" ? currentErrorState : null
    return (
      <FileThumbnail
        file={{ name: descriptor.displayName, type: descriptor.mimeType ?? "" }}
        previewImageUrl={directUrl}
        previewAspectRatio={previewAspectRatio}
        className={className}
        previewClassName={ANCHOR_OBJECT_POSITION[anchor]}
        state={failedDirectImage ? "error" : "loaded"}
        aria-label={failedDirectImage?.info.userMessage}
        title={failedDirectImage?.info.userMessage}
        data-error-domain={failedDirectImage?.info.domain}
        data-error-format={failedDirectImage?.info.format}
        data-error-kind={failedDirectImage?.info.kind}
        data-error-message={failedDirectImage?.info.message}
        onPreviewError={() => {
          const error = createThumbnailImageLoadError()
          const nextErrorState = createThumbnailErrorState({
            renderKey,
            error,
            resource,
            descriptor,
          })
          setErrorState(nextErrorState)
          onError?.(error, nextErrorState.info)
        }}
      />
    )
  }

  return (
    <FileThumbnail
      file={{ name: descriptor.displayName, type: descriptor.mimeType ?? "" }}
      previewAspectRatio={previewAspectRatio}
      className={className}
      state={currentErrorState ? "error" : "loaded"}
      aria-label={currentErrorState?.info.userMessage}
      title={currentErrorState?.info.userMessage}
      data-error-domain={currentErrorState?.info.domain}
      data-error-format={currentErrorState?.info.format}
      data-error-kind={currentErrorState?.info.kind}
      data-error-message={currentErrorState?.info.message}
      previewContent={
        <ClientPreview
          key={renderKey}
          resource={resource}
          descriptor={descriptor}
          thumbnailKey={thumbnailKey}
          anchor={anchor}
          onError={(error) => {
            const nextErrorState = createThumbnailErrorState({
              renderKey,
              error,
              resource,
              descriptor,
            })
            setErrorState(nextErrorState)
            onError?.(error, nextErrorState.info)
          }}
        />
      }
    />
  )
}

function getThumbnailOptions(descriptor: ViewerDescriptor): ThumbnailOption[] {
  switch (descriptor.category) {
    case "text":
    case "markdown":
    case "html":
      return [thumbnailOption("text-max-bytes", TEXT_THUMBNAIL_MAX_BYTES)]
    case "csv":
      return [
        thumbnailOption("text-max-bytes", TEXT_THUMBNAIL_MAX_BYTES),
        thumbnailOption("csv-max-rows", CSV_THUMBNAIL_MAX_ROWS),
        thumbnailOption("csv-max-columns", CSV_THUMBNAIL_MAX_COLUMNS),
      ]
    case "xlsx":
      return [
        thumbnailOption("xlsx-max-rows", XLSX_THUMBNAIL_MAX_ROWS),
        thumbnailOption("xlsx-max-columns", XLSX_THUMBNAIL_MAX_COLUMNS),
      ]
    case "image":
      return isTiffDescriptor(descriptor)
        ? [thumbnailOption("tiff-target-width", TIFF_THUMBNAIL_TARGET_WIDTH)]
        : []
    default:
      return []
  }
}

function ClientPreview({
  resource,
  descriptor,
  thumbnailKey,
  anchor,
  onError,
}: {
  resource: ViewerResource
  descriptor: ViewerDescriptor
  thumbnailKey: string
  anchor: ThumbnailAnchor
  onError: (error: unknown) => void
}) {
  const isClient = useIsClient()
  const { ref: inViewRef, seen: isSeen } = useThumbnailInView()

  return (
    <div ref={inViewRef} className="absolute inset-0">
      {isClient && isSeen ? (
        <ThumbnailErrorBoundary fallback={null} onError={onError}>
          <React.Suspense fallback={<FileThumbnailShimmer />}>
            <FirstUnit
              resource={resource}
              descriptor={descriptor}
              thumbnailKey={thumbnailKey}
              anchor={anchor}
              onError={onError}
            />
          </React.Suspense>
        </ThumbnailErrorBoundary>
      ) : (
        <FileThumbnailShimmer />
      )}
    </div>
  )
}

function createThumbnailErrorState({
  renderKey,
  error,
  resource,
  descriptor,
}: {
  renderKey: string
  error: unknown
  resource: ViewerResource
  descriptor: ViewerDescriptor
}): ThumbnailErrorState {
  return {
    renderKey,
    info: toViewerErrorInfo(error, {
      format: thumbnailCategoryFormat(descriptor.category),
      sourceKind: resource.sourceKind,
      canDownload: !resource.originalDownload.isDisabled,
    }),
  }
}

function useThumbnailInView() {
  const [seen, setSeen] = React.useState(false)
  const [node, setNode] = React.useState<HTMLElement | null>(null)
  const seenRef = React.useRef(false)
  const ref = React.useCallback((el: HTMLElement | null) => setNode(el), [])

  React.useEffect(() => {
    if (!node || seenRef.current) return
    if (typeof IntersectionObserver === "undefined") {
      seenRef.current = true
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seenRef.current = true
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  return { ref, seen }
}

function useIsClient() {
  const [isClient, setIsClient] = React.useState(false)
  React.useEffect(() => setIsClient(true), [])
  return isClient
}

function FirstUnit({
  resource,
  descriptor,
  thumbnailKey,
  anchor,
  onError,
}: {
  resource: ViewerResource
  descriptor: ViewerDescriptor
  thumbnailKey: string
  anchor: ThumbnailAnchor
  onError: (error: unknown) => void
}) {
  if (descriptor.category === "unsupported") return null
  const render = DOCUMENT_RENDERERS[descriptor.category]
  return render({ resource, descriptor, thumbnailKey, anchor, onError })
}
