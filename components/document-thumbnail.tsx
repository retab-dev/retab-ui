"use client"

import * as React from "react"

import {
  FileThumbnail,
  FileThumbnailShimmer,
} from "@/components/ui/file-thumbnail"
import { ThumbnailErrorBoundary } from "@/components/document-thumbnail/errors"
import { CsvFirstRows } from "@/components/document-thumbnail/renderers/csv-thumbnail"
import { DocxFirstPage } from "@/components/document-thumbnail/renderers/docx-thumbnail"
import { HtmlFirstPage } from "@/components/document-thumbnail/renderers/html-thumbnail"
import { MarkdownFirstPage } from "@/components/document-thumbnail/renderers/markdown-thumbnail"
import { PdfFirstPage } from "@/components/document-thumbnail/renderers/pdf-thumbnail"
import { PptxFirstSlide } from "@/components/document-thumbnail/renderers/pptx-thumbnail"
import { TiffFirstPage } from "@/components/document-thumbnail/renderers/tiff-thumbnail"
import { TextFirstLines } from "@/components/document-thumbnail/renderers/text-thumbnail"
import { XlsxFirstSheet } from "@/components/document-thumbnail/renderers/xlsx-thumbnail"
import {
  ANCHOR_OBJECT_POSITION,
  getThumbnailResourceKey,
  type DocumentKind,
  type DocumentThumbnailProps,
  type ThumbnailAnchor,
  type ThumbnailResourceIdentity,
} from "@/components/document-thumbnail/types"

export { getThumbnailResourceKey }
export type {
  DocumentKind,
  DocumentThumbnailProps,
  ThumbnailAnchor,
  ThumbnailResourceIdentity,
}

type ThumbnailDocumentKind = Exclude<DocumentKind, "image">

type DocumentRenderer = (props: {
  src: string
  resourceKey: string
  anchor: ThumbnailAnchor
}) => React.ReactNode

const DOCUMENT_RENDERERS: Record<ThumbnailDocumentKind, DocumentRenderer> = {
  // PDF reuses the shared PdfViewer resource cache by `src`; `resourceKey`
  // remounts the canvas/error boundary but does not evict the pdfjs document.
  pdf: ({ src, anchor }) => <PdfFirstPage src={src} anchor={anchor} />,
  xlsx: ({ src, resourceKey }) => (
    <XlsxFirstSheet src={src} resourceKey={resourceKey} />
  ),
  pptx: ({ src, resourceKey, anchor }) => (
    <PptxFirstSlide src={src} resourceKey={resourceKey} anchor={anchor} />
  ),
  docx: ({ src, resourceKey }) => (
    <DocxFirstPage src={src} resourceKey={resourceKey} />
  ),
  tiff: ({ src, resourceKey, anchor }) => (
    <TiffFirstPage src={src} resourceKey={resourceKey} anchor={anchor} />
  ),
  csv: ({ src, resourceKey }) => (
    <CsvFirstRows src={src} resourceKey={resourceKey} />
  ),
  markdown: ({ src, resourceKey }) => (
    <MarkdownFirstPage src={src} resourceKey={resourceKey} />
  ),
  html: ({ src, resourceKey }) => (
    <HtmlFirstPage src={src} resourceKey={resourceKey} />
  ),
  text: ({ src, resourceKey }) => (
    <TextFirstLines src={src} resourceKey={resourceKey} />
  ),
}

/**
 * Generates a first-unit thumbnail for a document — page 1, first sheet, or
 * first slide — then drops it into the dependency-free `FileThumbnail` shell.
 */
export function DocumentThumbnail({
  src,
  name,
  type,
  kind,
  className,
  previewAspectRatio = 3 / 4,
  anchor = "top-left",
  retryKey,
}: DocumentThumbnailProps) {
  const resourceKey = getThumbnailResourceKey({
    kind,
    src,
    anchor,
    retryKey: retryKey ?? null,
  })
  const [failedKey, setFailedKey] = React.useState<string | null>(null)

  if (kind === "image") {
    return (
      <FileThumbnail
        file={{ name, type }}
        previewImageUrl={src}
        previewAspectRatio={previewAspectRatio}
        className={className}
        previewClassName={ANCHOR_OBJECT_POSITION[anchor]}
      />
    )
  }

  return (
    <FileThumbnail
      file={{ name, type }}
      previewAspectRatio={previewAspectRatio}
      className={className}
      state={failedKey === resourceKey ? "error" : "loaded"}
      previewContent={
        <ClientPreview
          key={resourceKey}
          src={src}
          resourceKey={resourceKey}
          kind={kind}
          anchor={anchor}
          onError={() => setFailedKey(resourceKey)}
        />
      }
    />
  )
}

function ClientPreview({
  src,
  resourceKey,
  kind,
  anchor,
  onError,
}: {
  src: string
  resourceKey: string
  kind: DocumentKind
  anchor: ThumbnailAnchor
  onError: () => void
}) {
  const isClient = useIsClient()
  const inView = useInView()

  return (
    <div ref={inView.ref} className="absolute inset-0">
      {isClient && inView.seen ? (
        <ThumbnailErrorBoundary fallback={null} onError={onError}>
          <React.Suspense fallback={<FileThumbnailShimmer />}>
            <FirstUnit
              src={src}
              resourceKey={resourceKey}
              kind={kind}
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

function useInView() {
  const [seen, setSeen] = React.useState(false)
  const seenRef = React.useRef(false)
  const ref = React.useCallback((el: HTMLElement | null) => {
    if (!el || seenRef.current) return
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
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, seen }
}

function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

function FirstUnit({
  src,
  resourceKey,
  kind,
  anchor,
}: {
  src: string
  resourceKey: string
  kind: DocumentKind
  anchor: ThumbnailAnchor
}) {
  if (kind === "image") return null
  const render = DOCUMENT_RENDERERS[kind]
  return render({ src, resourceKey, anchor })
}
