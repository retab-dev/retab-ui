"use client"

import * as React from "react"

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
  isTiffDescriptor,
  resolveThumbnailDescriptor,
} from "@/components/document-thumbnail/descriptor"
import { ThumbnailErrorBoundary } from "@/components/document-thumbnail/errors"
import {
  getThumbnailCacheKey,
  getThumbnailRenderKey,
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

export { getThumbnailCacheKey, getThumbnailRenderKey }
export type { DocumentThumbnailProps, ThumbnailAnchor }

type DocumentRenderer = (props: {
  resource: ViewerResource
  descriptor: ViewerDescriptor
  cacheKey: string
  anchor: ThumbnailAnchor
}) => React.ReactNode

const DOCUMENT_RENDERERS: Record<
  Exclude<FileCategory, "unsupported">,
  DocumentRenderer
> = {
  pdf: ({ resource, anchor }) => (
    <PdfFirstPage resource={resource} anchor={anchor} />
  ),
  xlsx: ({ resource, cacheKey }) => (
    <XlsxFirstSheet resource={resource} cacheKey={cacheKey} />
  ),
  pptx: ({ resource, cacheKey, anchor }) => (
    <PptxFirstSlide resource={resource} cacheKey={cacheKey} anchor={anchor} />
  ),
  docx: ({ resource }) => <DocxFirstPage resource={resource} />,
  image: ({ resource, descriptor, cacheKey, anchor }) =>
    isTiffDescriptor(descriptor) ? (
      <TiffFirstPage resource={resource} cacheKey={cacheKey} anchor={anchor} />
    ) : (
      <ImageFirstFrame resource={resource} anchor={anchor} />
    ),
  csv: ({ resource, cacheKey }) => (
    <CsvFirstRows resource={resource} cacheKey={cacheKey} />
  ),
  markdown: ({ resource, cacheKey }) => (
    <MarkdownFirstPage resource={resource} cacheKey={cacheKey} />
  ),
  html: ({ resource, cacheKey }) => (
    <HtmlFirstPage resource={resource} cacheKey={cacheKey} />
  ),
  text: ({ resource, cacheKey }) => (
    <TextFirstLines resource={resource} cacheKey={cacheKey} />
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
}: DocumentThumbnailProps) {
  const descriptor = resolveThumbnailDescriptor({ source, as })
  const resource = React.useMemo(() => createViewerResource(source), [source])
  const cacheKey = getThumbnailCacheKey({
    resource,
    descriptor,
    options: isTiffDescriptor(descriptor) ? ["tiff"] : [],
  })
  const renderKey = getThumbnailRenderKey({
    cacheKey,
    anchor,
    retryKey: retryKey ?? null,
  })
  const [failedRenderKey, setFailedRenderKey] = React.useState<string | null>(
    null
  )
  const directLoad = resource.getDirectLoad()

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
    directLoad.kind === "url"
  ) {
    return (
      <FileThumbnail
        file={{ name: descriptor.displayName, type: descriptor.mimeType ?? "" }}
        previewImageUrl={directLoad.url}
        previewAspectRatio={previewAspectRatio}
        className={className}
        previewClassName={ANCHOR_OBJECT_POSITION[anchor]}
      />
    )
  }

  return (
    <FileThumbnail
      file={{ name: descriptor.displayName, type: descriptor.mimeType ?? "" }}
      previewAspectRatio={previewAspectRatio}
      className={className}
      state={failedRenderKey === renderKey ? "error" : "loaded"}
      previewContent={
        <ClientPreview
          key={renderKey}
          resource={resource}
          descriptor={descriptor}
          cacheKey={cacheKey}
          anchor={anchor}
          onError={() => setFailedRenderKey(renderKey)}
        />
      }
    />
  )
}

function ClientPreview({
  resource,
  descriptor,
  cacheKey,
  anchor,
  onError,
}: {
  resource: ViewerResource
  descriptor: ViewerDescriptor
  cacheKey: string
  anchor: ThumbnailAnchor
  onError: () => void
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
              cacheKey={cacheKey}
              anchor={anchor}
            />
          </React.Suspense>
        </ThumbnailErrorBoundary>
      ) : (
        <FileThumbnailShimmer />
      )}
    </div>
  )
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
  cacheKey,
  anchor,
}: {
  resource: ViewerResource
  descriptor: ViewerDescriptor
  cacheKey: string
  anchor: ThumbnailAnchor
}) {
  if (descriptor.category === "unsupported") return null
  const render = DOCUMENT_RENDERERS[descriptor.category]
  return render({ resource, descriptor, cacheKey, anchor })
}
